use serde::{Deserialize, Serialize};

use crate::domain::error::AppError;

/// 加密笔记信封首行 magic：版本号内嵌在标识里，便于未来格式升级时分支。
pub const ENVELOPE_MAGIC: &str = "AINOTE-ENC-v1";
/// 信封 base64 折行宽度（与 PEM 一致），让密文在 Git diff 中呈行级变化。
pub const ENVELOPE_LINE_WIDTH: usize = 76;
/// SIV 的 associated data：域分隔常量，**不绑定路径**，因此移动/重命名无需重新加密。
pub const ENVELOPE_AD: &[u8] = b"ainote.note.v1";

pub const VAULT_SCHEMA_VERSION: u32 = 1;
pub const KDF_ALG: &str = "argon2id";
pub const WRAP_ALG: &str = "aes-256-gcm";
pub const ARGON2_M_KIB: u32 = 65_536;
pub const ARGON2_ITERATIONS: u32 = 3;
pub const ARGON2_PARALLELISM: u32 = 1;
pub const SALT_LEN: usize = 16;
pub const NONCE_LEN: usize = 12;
pub const MASTER_KEY_LEN: usize = 32;
/// 口令是唯一凭证，最低长度是硬门槛（见 docs/ENCRYPTED_NOTES_PLAN.md §4.3）。
pub const MIN_PASSPHRASE_CHARS: usize = 6;

/// 读取 vault.json 时允许的 KDF 参数区间：防止被篡改的文件要求荒谬内存/迭代导致 DoS。
pub const MIN_KDF_M_KIB: u32 = 8 * 1024;
pub const MAX_KDF_M_KIB: u32 = 256 * 1024;
pub const MAX_KDF_ITERATIONS: u32 = 10;
pub const MAX_KDF_PARALLELISM: u32 = 8;

/// vault.json 结构：口令派生的 KEK 封装主密钥，文件本身可公开（随 Git 同步）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultFile {
    pub schema_version: u32,
    pub kdf: KdfParams,
    pub wrap: WrapParams,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KdfParams {
    pub alg: String,
    pub salt: String,
    #[serde(rename = "memoryKiB")]
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WrapParams {
    pub alg: String,
    pub nonce: String,
    pub ciphertext: String,
}

/// 仓库加密状态（下发给前端的状态机）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VaultState {
    /// 该仓库尚未建库（无 vault.json）
    Absent,
    /// 已有 vault.json 但本进程未解锁
    Locked,
    /// 会话已解锁
    Unlocked,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub state: VaultState,
    /// 仓库内处于加密态的笔记数量（由服务层扫描后传入）
    pub encrypted_notes: u32,
}

impl VaultFile {
    /// 纯校验：算法白名单、参数区间、封装字段长度。任何不合法都视为「文件损坏/被篡改」。
    pub fn validate(&self) -> Result<(), AppError> {
        let invalid = |detail: &str| AppError::VaultInvalid(detail.to_string());
        if self.schema_version != VAULT_SCHEMA_VERSION {
            return Err(invalid("不支持的仓库加密格式版本"));
        }
        if self.kdf.alg != KDF_ALG {
            return Err(invalid("不支持的密钥派生算法"));
        }
        if self.wrap.alg != WRAP_ALG {
            return Err(invalid("不支持的主密钥封装算法"));
        }
        if !(MIN_KDF_M_KIB..=MAX_KDF_M_KIB).contains(&self.kdf.memory_kib)
            || self.kdf.iterations == 0
            || self.kdf.iterations > MAX_KDF_ITERATIONS
            || self.kdf.parallelism == 0
            || self.kdf.parallelism > MAX_KDF_PARALLELISM
        {
            return Err(invalid("密钥派生参数超出允许范围"));
        }
        if self.kdf.salt.is_empty() || self.wrap.nonce.is_empty() || self.wrap.ciphertext.is_empty() {
            return Err(invalid("仓库密钥文件缺少必要字段"));
        }
        Ok(())
    }
}

/// 纯函数：判断文本是否为加密笔记信封（只看首行，不解析全文）。
pub fn is_envelope(text: &str) -> bool {
    text.lines().next().map(str::trim_end) == Some(ENVELOPE_MAGIC)
}

/// 纯函数：拼装信封文本（magic 行 + base64 折行 + 结尾换行，保证 Git 友好）。
pub fn encode_envelope(payload: &str) -> String {
    let mut out = String::with_capacity(payload.len() + ENVELOPE_MAGIC.len() + 8);
    out.push_str(ENVELOPE_MAGIC);
    out.push('\n');
    for chunk in payload.as_bytes().chunks(ENVELOPE_LINE_WIDTH) {
        out.push_str(&String::from_utf8_lossy(chunk));
        out.push('\n');
    }
    out
}

/// 纯函数：取出信封的 base64 载荷（忽略折行与空白）；非信封返回 None。
pub fn envelope_payload(text: &str) -> Option<String> {
    let mut lines = text.lines();
    if lines.next().map(str::trim_end) != Some(ENVELOPE_MAGIC) {
        return None;
    }
    let payload: String = lines
        .flat_map(|line| line.chars())
        .filter(|c| !c.is_whitespace())
        .collect();
    if payload.is_empty() {
        None
    } else {
        Some(payload)
    }
}

/// 纯函数：口令强度校验。`context` 传入邮箱/用户名/仓库名等不得直接复用的词。
/// 口令是唯一凭证且 vault.json 可公开，因此这里不提供「弱口令但允许」的降级。
pub fn check_passphrase_strength(passphrase: &str, context: &[&str]) -> Result<(), AppError> {
    let chars = passphrase.chars().count();
    if chars < MIN_PASSPHRASE_CHARS {
        return Err(AppError::VaultInvalid(format!(
            "口令至少需要 {MIN_PASSPHRASE_CHARS} 个字符"
        )));
    }
    let lowered = passphrase.to_lowercase();
    if context
        .iter()
        .filter(|item| !item.trim().is_empty())
        .any(|item| lowered == item.trim().to_lowercase())
    {
        return Err(AppError::VaultInvalid(
            "口令不能与邮箱、账号名或仓库名相同".to_string(),
        ));
    }
    if lowered.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::VaultInvalid(
            "口令不能是纯数字".to_string(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_file() -> VaultFile {
        VaultFile {
            schema_version: VAULT_SCHEMA_VERSION,
            kdf: KdfParams {
                alg: KDF_ALG.to_string(),
                salt: "c2FsdA==".to_string(),
                memory_kib: ARGON2_M_KIB,
                iterations: ARGON2_ITERATIONS,
                parallelism: ARGON2_PARALLELISM,
            },
            wrap: WrapParams {
                alg: WRAP_ALG.to_string(),
                nonce: "bm9uY2U=".to_string(),
                ciphertext: "Y2lwaGVy".to_string(),
            },
        }
    }

    #[test]
    fn envelope_round_trips_and_wraps_lines() {
        let payload = "A".repeat(ENVELOPE_LINE_WIDTH * 2 + 5);
        let text = encode_envelope(&payload);
        assert!(is_envelope(&text));
        assert_eq!(envelope_payload(&text).unwrap(), payload);
        for line in text.lines().skip(1) {
            assert!(line.chars().count() <= ENVELOPE_LINE_WIDTH);
        }
        assert!(text.ends_with('\n'));
    }

    #[test]
    fn envelope_detection_is_cheap_and_strict() {
        assert!(is_envelope("AINOTE-ENC-v1\nQUJD\n"));
        assert!(is_envelope("AINOTE-ENC-v1\r\nQUJD\r\n"), "容忍 CRLF 检出");
        assert!(!is_envelope("# 普通 Markdown\nAINOTE-ENC-v1\n"));
        assert!(!is_envelope("AINOTE-ENC-v2\nQUJD\n"));
        assert!(!is_envelope(""));
        assert!(envelope_payload("# 普通笔记").is_none());
    }

    #[test]
    fn envelope_payload_ignores_wrapping_whitespace() {
        let text = "AINOTE-ENC-v1\nQUJD\nREVG\n";
        assert_eq!(envelope_payload(text).unwrap(), "QUJDREVG");
        // 只有 magic 行、没有载荷时视为无效
        assert!(envelope_payload("AINOTE-ENC-v1\n").is_none());
    }

    #[test]
    fn vault_file_validation_rejects_tampered_params() {
        assert!(sample_file().validate().is_ok());

        let mut bad_schema = sample_file();
        bad_schema.schema_version = 99;
        assert!(bad_schema.validate().is_err());

        let mut bad_alg = sample_file();
        bad_alg.kdf.alg = "pbkdf2".to_string();
        assert!(bad_alg.validate().is_err());

        let mut huge_memory = sample_file();
        huge_memory.kdf.memory_kib = MAX_KDF_M_KIB + 1;
        assert!(huge_memory.validate().is_err(), "拒绝荒谬内存参数造成 DoS");

        let mut empty_wrap = sample_file();
        empty_wrap.wrap.ciphertext = String::new();
        assert!(empty_wrap.validate().is_err());
    }

    #[test]
    fn vault_file_serializes_camel_case() {
        let json = serde_json::to_value(sample_file()).unwrap();
        assert_eq!(json["schemaVersion"], 1);
        assert_eq!(json["kdf"]["memoryKiB"], ARGON2_M_KIB);
        assert_eq!(json["wrap"]["nonce"], "bm9uY2U=");
        let back: VaultFile = serde_json::from_value(json).unwrap();
        assert_eq!(back, sample_file());
    }

    #[test]
    fn passphrase_strength_enforces_minimum_and_context() {
        assert!(check_passphrase_strength("short", &[]).is_err());
        assert!(check_passphrase_strength("123456", &[]).is_err(), "纯数字拒绝");
        assert!(check_passphrase_strength("correct horse battery", &[]).is_ok());
        assert!(
            check_passphrase_strength(
                "Jake@example.com",
                &["jake@example.com"],
            )
            .is_err(),
            "不得与账号上下文相同"
        );
        assert!(check_passphrase_strength("Jake@example.com", &[""]).is_ok());
    }
}
