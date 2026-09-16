use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::vault::{VaultFile, ENVELOPE_MAGIC};

/// 仓库密钥文件：随 Git 同步、可公开，机密性由口令强度承担。
pub const VAULT_FILE: &str = ".ainote/vault.json";

/// 判断文件是否为加密信封：只读首行，不解密、不读全文。读取失败一律视为「不是」。
pub fn is_envelope_file(path: &Path) -> bool {
    let Ok(file) = fs::File::open(path) else {
        return false;
    };
    let mut line = String::new();
    match BufReader::new(file).read_line(&mut line) {
        Ok(_) => line.trim_end() == ENVELOPE_MAGIC,
        Err(_) => false,
    }
}

/// Repository 边界：读取仓库密钥文件；未建库返回 None。
/// 文件存在但格式非法时返回 `VAULT_9004`，绝不静默当成「未配置」（否则会诱导用户重复建库）。
pub fn load(root: &Path) -> Result<Option<VaultFile>, AppError> {
    let path = root.join(VAULT_FILE);
    if !path.is_file() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)
        .map_err(|err| AppError::io_context("读取仓库密钥文件失败", &path, err))?;
    let file: VaultFile = serde_json::from_str(&raw)
        .map_err(|error| AppError::VaultInvalid(format!("仓库密钥文件无法解析: {error}")))?;
    file.validate()?;
    Ok(Some(file))
}

/// Repository 边界：原子写入仓库密钥文件（临时文件 + rename，避免半写状态）。
pub fn save(root: &Path, file: &VaultFile) -> Result<(), AppError> {
    file.validate()?;
    let path = root.join(VAULT_FILE);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| AppError::io_context("创建目录失败", parent, err))?;
    }
    let temporary = path.with_extension("tmp");
    let mut serialized = serde_json::to_vec_pretty(file)
        .map_err(|error| AppError::VaultInvalid(format!("序列化仓库密钥文件失败: {error}")))?;
    serialized.push(b'\n');
    fs::write(&temporary, serialized)
        .map_err(|err| AppError::io_context("写入仓库密钥文件失败", &temporary, err))?;
    fs::rename(&temporary, &path)
        .map_err(|err| AppError::io_context("替换仓库密钥文件失败", &path, err))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::vault::{KdfParams, WrapParams, ARGON2_ITERATIONS, ARGON2_M_KIB, KDF_ALG, VAULT_SCHEMA_VERSION, WRAP_ALG};

    fn sample() -> VaultFile {
        VaultFile {
            schema_version: VAULT_SCHEMA_VERSION,
            kdf: KdfParams {
                alg: KDF_ALG.to_string(),
                salt: "c2FsdHNhbHRzYWx0c2E=".to_string(),
                memory_kib: ARGON2_M_KIB,
                iterations: ARGON2_ITERATIONS,
                parallelism: 1,
            },
            wrap: WrapParams {
                alg: WRAP_ALG.to_string(),
                nonce: "bm9uY2Vub25jZQ==".to_string(),
                ciphertext: "Y2lwaGVydGV4dA==".to_string(),
            },
        }
    }

    #[test]
    fn load_returns_none_when_repo_has_no_vault() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(load(tmp.path()).unwrap().is_none());
    }

    #[test]
    fn save_then_load_round_trips() {
        let tmp = tempfile::tempdir().unwrap();
        save(tmp.path(), &sample()).unwrap();
        assert!(tmp.path().join(VAULT_FILE).is_file());
        assert_eq!(load(tmp.path()).unwrap().unwrap(), sample());
        // 临时文件不残留
        assert!(!tmp.path().join(".ainote/vault.tmp").exists());
    }

    #[test]
    fn load_rejects_broken_json_and_tampered_params() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join(VAULT_FILE);
        fs::create_dir_all(path.parent().unwrap()).unwrap();

        fs::write(&path, "{ not json").unwrap();
        assert!(load(tmp.path()).is_err());

        fs::write(&path, r#"{"schemaVersion":1,"kdf":{"alg":"pbkdf2","salt":"x","memoryKiB":65536,"iterations":3,"parallelism":1},"wrap":{"alg":"aes-256-gcm","nonce":"n","ciphertext":"c"}}"#).unwrap();
        let err = load(tmp.path()).unwrap_err();
        assert!(matches!(err, AppError::VaultInvalid(_)), "非法算法必须显式报错");
    }

    #[test]
    fn save_refuses_invalid_payload() {
        let tmp = tempfile::tempdir().unwrap();
        let mut broken = sample();
        broken.wrap.ciphertext = String::new();
        assert!(save(tmp.path(), &broken).is_err());
        assert!(!tmp.path().join(VAULT_FILE).exists(), "非法内容不落盘");
    }

    #[test]
    fn envelope_detection_reads_only_the_header() {
        let tmp = tempfile::tempdir().unwrap();
        let encrypted = tmp.path().join("enc.md");
        fs::write(&encrypted, format!("{ENVELOPE_MAGIC}\nQUJD\n")).unwrap();
        assert!(is_envelope_file(&encrypted));

        let plain = tmp.path().join("plain.md");
        fs::write(&plain, "# 明文笔记\n").unwrap();
        assert!(!is_envelope_file(&plain));
        assert!(!is_envelope_file(&tmp.path().join("missing.md")));
    }
}
