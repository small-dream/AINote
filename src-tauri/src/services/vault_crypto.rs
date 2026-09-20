//! 加密笔记的密码学原语（E1）：口令派生、主密钥封装、正文加解密。
//! 全部是无状态纯函数（仅随机数来自 OS），不做 IO、不持有会话；编排见 `vault_service`。

use aes_gcm::aead::{Aead, KeyInit as AeadKeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use aes_siv::siv::Aes256Siv;
use aes_siv::KeyInit as SivKeyInit;
use argon2::{Algorithm, Argon2, Params, Version};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use hkdf::Hkdf;
use sha2::Digest;
use sha2::Sha256;
use zeroize::Zeroizing;

use crate::domain::error::AppError;
use crate::domain::vault::{
    encode_envelope, envelope_payload, KdfParams, VaultFile, WrapParams, ARGON2_ITERATIONS,
    ARGON2_M_KIB, ARGON2_PARALLELISM, ENVELOPE_AD, KDF_ALG, MASTER_KEY_LEN, NONCE_LEN, SALT_LEN,
    WRAP_ALG,
};

/// AES-256-SIV 需要两把 256 位子密钥（RFC 5297）。
const SIV_KEY_LEN: usize = 64;
/// HKDF 域分隔：从主密钥派生子密钥，避免同一把密钥跨用途复用。
const SIV_INFO: &[u8] = b"ainote.note.siv.v1";
/// 主密钥封装的 associated data（固定常量，不需要绑定仓库路径）。
const WRAP_AD: &[u8] = b"ainote.vault.v1";
/// AES-GCM tag 长度：用于识别「密文长度不足」这类明显损坏。
const GCM_TAG_LEN: usize = 16;
/// SIV tag 长度（SIV 输出 = tag || ciphertext）。
const SIV_TAG_LEN: usize = 16;
/// Argon2 盐值最小长度（RFC 9106 建议 ≥ 8 字节）。
const MIN_SALT_LEN: usize = 8;

/// 生成新的仓库主密钥（32B 随机，仅用于笔记正文加密）。
pub fn new_master_key() -> Result<Zeroizing<[u8; MASTER_KEY_LEN]>, AppError> {
    Ok(Zeroizing::new(random_array::<MASTER_KEY_LEN>()?))
}

/// 生成建库用的 KDF 参数（随机盐 + 默认 Argon2id 强度）。
pub fn new_kdf_params() -> Result<KdfParams, AppError> {
    let salt = random_array::<SALT_LEN>()?;
    Ok(KdfParams {
        alg: KDF_ALG.to_string(),
        salt: b64_encode(&salt),
        memory_kib: ARGON2_M_KIB,
        iterations: ARGON2_ITERATIONS,
        parallelism: ARGON2_PARALLELISM,
    })
}

/// 口令 → KEK（Argon2id）。参数来自仓库密钥文件，便于未来升级强度而不改格式。
pub fn derive_kek(
    passphrase: &str,
    kdf: &KdfParams,
) -> Result<Zeroizing<[u8; MASTER_KEY_LEN]>, AppError> {
    let salt = b64_decode(&kdf.salt, "盐值")?;
    if salt.len() < MIN_SALT_LEN {
        return Err(AppError::VaultInvalid("仓库密钥文件的盐值长度不足".into()));
    }
    let params = Params::new(
        kdf.memory_kib,
        kdf.iterations,
        kdf.parallelism,
        Some(MASTER_KEY_LEN),
    )
    .map_err(|e| AppError::VaultInvalid(format!("密钥派生参数非法: {e}")))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut kek = Zeroizing::new([0u8; MASTER_KEY_LEN]);
    argon
        .hash_password_into(passphrase.as_bytes(), &salt, &mut kek[..])
        .map_err(|e| AppError::VaultInvalid(format!("口令派生失败: {e}")))?;
    Ok(kek)
}

/// 用 KEK 封装主密钥（AES-256-GCM，随机 nonce）。
pub fn wrap_master_key(
    kek: &[u8; MASTER_KEY_LEN],
    master: &[u8; MASTER_KEY_LEN],
) -> Result<WrapParams, AppError> {
    let nonce = random_array::<NONCE_LEN>()?;
    let cipher = Aes256Gcm::new_from_slice(kek)
        .map_err(|e| AppError::VaultInvalid(format!("主密钥封装初始化失败: {e}")))?;
    let ciphertext = cipher
        .encrypt(
            &Nonce::from(nonce),
            Payload {
                msg: master,
                aad: WRAP_AD,
            },
        )
        .map_err(|e| AppError::VaultInvalid(format!("主密钥封装失败: {e}")))?;
    Ok(WrapParams {
        alg: WRAP_ALG.to_string(),
        nonce: b64_encode(&nonce),
        ciphertext: b64_encode(&ciphertext),
    })
}

/// 解封主密钥。口令错误与文件损坏对外统一为「解锁失败」，避免给出可利用的区分信息。
pub fn unwrap_master_key(
    kek: &[u8; MASTER_KEY_LEN],
    wrap: &WrapParams,
) -> Result<Zeroizing<[u8; MASTER_KEY_LEN]>, AppError> {
    let failed = |detail: &str| AppError::VaultUnlockFailed(detail.to_string());
    let nonce = b64_decode(&wrap.nonce, "nonce")?;
    let nonce = <[u8; NONCE_LEN]>::try_from(nonce.as_slice())
        .map_err(|_| failed("仓库密钥文件已损坏"))?;
    let ciphertext = b64_decode(&wrap.ciphertext, "主密钥密文")?;
    if ciphertext.len() != MASTER_KEY_LEN + GCM_TAG_LEN {
        return Err(failed("仓库密钥文件已损坏"));
    }
    let cipher = Aes256Gcm::new_from_slice(kek).map_err(|_| failed("仓库密钥文件已损坏"))?;
    let plain = Zeroizing::new(
        cipher
            .decrypt(
                &Nonce::from(nonce),
                Payload {
                    msg: &ciphertext,
                    aad: WRAP_AD,
                },
            )
            .map_err(|_| failed("口令错误，或仓库密钥文件已损坏"))?,
    );
    let master = <[u8; MASTER_KEY_LEN]>::try_from(plain.as_slice())
        .map_err(|_| failed("仓库密钥文件已损坏"))?;
    Ok(Zeroizing::new(master))
}

/// 加密笔记正文：输出可直接落盘的完整信封文本（确定性加密，同内容同密文）。
pub fn encrypt_note(master: &[u8; MASTER_KEY_LEN], plaintext: &str) -> Result<String, AppError> {
    let mut siv = siv_cipher(master)?;
    let ciphertext = siv
        .encrypt([ENVELOPE_AD], plaintext.as_bytes())
        .map_err(|e| AppError::VaultInvalid(format!("笔记加密失败: {e}")))?;
    Ok(encode_envelope(&b64_encode(&ciphertext)))
}

/// 解密笔记正文：输入完整信封文本，输出明文。任何格式/校验失败都视为密文损坏。
pub fn decrypt_note(master: &[u8; MASTER_KEY_LEN], text: &str) -> Result<String, AppError> {
    let corrupt = |detail: &str| AppError::VaultCorrupt(detail.to_string());
    let payload =
        envelope_payload(text).ok_or_else(|| corrupt("该文件不是有效的加密笔记信封"))?;
    let raw = b64_decode(&payload, "笔记密文").map_err(|_| corrupt("笔记密文不是合法的 base64"))?;
    if raw.len() < SIV_TAG_LEN {
        return Err(corrupt("笔记密文长度不足"));
    }
    let mut siv = siv_cipher(master)?;
    let plain = siv
        .decrypt([ENVELOPE_AD], &raw)
        .map_err(|_| corrupt("笔记解密失败：密文已损坏或与当前密钥不匹配"))?;
    String::from_utf8(plain).map_err(|_| corrupt("解密结果不是合法的 UTF-8 文本"))
}

/// 由主密钥派生 AES-256-SIV 子密钥（HKDF-SHA256，固定 AD 作为 salt）。
fn siv_cipher(master: &[u8; MASTER_KEY_LEN]) -> Result<Aes256Siv, AppError> {
    let hkdf = Hkdf::<Sha256>::new(Some(ENVELOPE_AD), master);
    let mut key = Zeroizing::new([0u8; SIV_KEY_LEN]);
    hkdf.expand(SIV_INFO, &mut key[..])
        .map_err(|_| AppError::VaultInvalid("笔记密钥派生失败".into()))?;
    Aes256Siv::new_from_slice(key.as_ref())
        .map_err(|_| AppError::VaultInvalid("笔记密钥长度非法".into()))
}

/// 仓库密钥指纹：sha256(封装密文) 的前 16 字节 hex（32 字符）。
/// 设备级快速解锁条目用它绑定某一次密钥封装：改口令会换盐与 nonce，重建密钥库会换主密钥，
/// 两种情况指纹都会变，因此不存在「拿旧主密钥打开新笔记」的窗口。
/// 该指纹不是机密（`vault.json` 本身随仓库公开），只用于匹配。
pub fn vault_fingerprint(file: &VaultFile) -> String {
    let digest = Sha256::digest(file.wrap.ciphertext.as_bytes());
    let mut fingerprint = String::with_capacity(32);
    for byte in digest.iter().take(16) {
        fingerprint.push_str(&format!("{byte:02x}"));
    }
    fingerprint
}

fn random_array<const N: usize>() -> Result<[u8; N], AppError> {
    let mut buf = [0u8; N];
    getrandom::getrandom(&mut buf).map_err(|e| AppError::Io(format!("随机数生成失败: {e}")))?;
    Ok(buf)
}

/// base64 编码（标准字母表 + 补位），用于 vault.json 与信封载荷。
pub fn b64_encode(bytes: &[u8]) -> String {
    B64.encode(bytes)
}

/// base64 解码；失败信息带上字段名，便于定位损坏的配置文件。
pub fn b64_decode(value: &str, field: &str) -> Result<Vec<u8>, AppError> {
    B64.decode(value.trim())
        .map_err(|_| AppError::VaultInvalid(format!("{field}不是合法的 base64")))
}

#[cfg(test)]
#[path = "vault_crypto_tests.rs"]
mod vault_crypto_tests;
