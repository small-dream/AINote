//! 本地加密凭证存储原语（AES-256-GCM，与 auth_store 同模式）。
//! 供 GitHub Token / AI API Key 等敏感凭证复用：明文永不落盘，前端永远拿不到明文。
//! 文件名约定：{name}.key（AES 密钥）+ {name}.cred（密文），magic 按 name 区分域。

use std::fs;
use std::io::ErrorKind;
use std::path::Path;

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};

use crate::domain::error::AppError;

const KEY_LEN: usize = 32;
const NONCE_LEN: usize = 12;
const KEY_RECORD_LEN: usize = 5 + KEY_LEN;
const CRED_HEADER_LEN: usize = 5 + NONCE_LEN;

/// 保存（覆盖）一条加密凭证。
pub fn save_secret(root: &Path, name: &str, secret: &str) -> Result<(), AppError> {
    fs::create_dir_all(root)?;
    let key = ensure_key(root, name)?;
    let mut nonce = [0u8; NONCE_LEN];
    getrandom::getrandom(&mut nonce).map_err(|e| AppError::Io(e.to_string()))?;
    let cipher = cipher_from_key(&key)?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), secret.as_bytes())
        .map_err(|e| AppError::Io(e.to_string()))?;
    write_secure(&cred_path(root, name), encode_cred_record(&nonce, &ciphertext))?;
    Ok(())
}

/// 读取加密凭证；未配置返回 None。
pub fn read_secret(root: &Path, name: &str) -> Result<Option<String>, AppError> {
    if !key_path(root, name).is_file() {
        return Ok(None);
    }
    let key = load_key(root, name)?;
    let record = match fs::read(cred_path(root, name)) {
        Ok(b) => b,
        Err(err) if err.kind() == ErrorKind::NotFound => return Ok(None),
        Err(err) => return Err(AppError::Io(err.to_string())),
    };
    let (nonce, ciphertext) = decode_cred_record(&record)?;
    let cipher = cipher_from_key(&key)?;
    let bytes = cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext)
        .map_err(|_| AppError::Io("本地加密凭证失效".into()))?;
    String::from_utf8(bytes)
        .map(Some)
        .map_err(|e| AppError::Io(e.to_string()))
}

/// 删除加密凭证（含密钥）。
pub fn delete_secret(root: &Path, name: &str) -> Result<(), AppError> {
    remove_if_exists(&key_path(root, name))?;
    remove_if_exists(&cred_path(root, name))?;
    Ok(())
}

fn ensure_key(root: &Path, name: &str) -> Result<[u8; KEY_LEN], AppError> {
    let path = key_path(root, name);
    if path.is_file() {
        return load_key(root, name);
    }
    let mut key = [0u8; KEY_LEN];
    getrandom::getrandom(&mut key).map_err(|e| AppError::Io(e.to_string()))?;
    write_secure(&path, encode_key_record(&key))?;
    Ok(key)
}

fn load_key(root: &Path, name: &str) -> Result<[u8; KEY_LEN], AppError> {
    let record = fs::read(key_path(root, name)).map_err(|e| AppError::Io(e.to_string()))?;
    decode_key_record(&record)
}

fn write_secure(path: &Path, bytes: Vec<u8>) -> Result<(), AppError> {
    fs::write(path, bytes)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

fn remove_if_exists(path: &Path) -> Result<(), AppError> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == ErrorKind::NotFound => Ok(()),
        Err(err) => Err(AppError::Io(err.to_string())),
    }
}

fn key_path(root: &Path, name: &str) -> std::path::PathBuf {
    root.join(format!("{name}.key"))
}

fn cred_path(root: &Path, name: &str) -> std::path::PathBuf {
    root.join(format!("{name}.cred"))
}

fn cipher_from_key(key: &[u8; KEY_LEN]) -> Result<Aes256Gcm, AppError> {
    Aes256Gcm::new_from_slice(key).map_err(|e| AppError::Io(e.to_string()))
}

fn encode_key_record(key: &[u8; KEY_LEN]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(KEY_RECORD_LEN);
    bytes.extend_from_slice(b"SEKR");
    bytes.push(1);
    bytes.extend_from_slice(key);
    bytes
}

fn decode_key_record(bytes: &[u8]) -> Result<[u8; KEY_LEN], AppError> {
    if bytes.len() != KEY_RECORD_LEN || &bytes[..4] != b"SEKR" || bytes[4] != 1 {
        return Err(AppError::Io("本地加密密钥格式无效".into()));
    }
    let mut key = [0u8; KEY_LEN];
    key.copy_from_slice(&bytes[5..]);
    Ok(key)
}

fn encode_cred_record(nonce: &[u8; NONCE_LEN], ciphertext: &[u8]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(CRED_HEADER_LEN + ciphertext.len());
    bytes.extend_from_slice(b"SECR");
    bytes.push(1);
    bytes.extend_from_slice(nonce);
    bytes.extend_from_slice(ciphertext);
    bytes
}

fn decode_cred_record(bytes: &[u8]) -> Result<([u8; NONCE_LEN], &[u8]), AppError> {
    if bytes.len() <= CRED_HEADER_LEN || &bytes[..4] != b"SECR" || bytes[4] != 1 {
        return Err(AppError::Io("本地加密凭证格式无效".into()));
    }
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&bytes[5..CRED_HEADER_LEN]);
    Ok((nonce, &bytes[CRED_HEADER_LEN..]))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn roundtrip_secret() {
        let dir = tmp();
        save_secret(dir.path(), "ai", "sk-secret-123").unwrap();
        assert_eq!(read_secret(dir.path(), "ai").unwrap().as_deref(), Some("sk-secret-123"));
    }

    #[test]
    fn missing_secret_returns_none() {
        let dir = tmp();
        assert_eq!(read_secret(dir.path(), "ai").unwrap(), None);
    }

    #[test]
    fn overwrite_and_delete() {
        let dir = tmp();
        save_secret(dir.path(), "ai", "first").unwrap();
        save_secret(dir.path(), "ai", "second").unwrap();
        assert_eq!(read_secret(dir.path(), "ai").unwrap().as_deref(), Some("second"));
        delete_secret(dir.path(), "ai").unwrap();
        assert_eq!(read_secret(dir.path(), "ai").unwrap(), None);
    }
}
