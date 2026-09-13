//! 桌面端凭证后端：AES-256-GCM 加密文件。
//!
//! 文件布局：共享密钥 `auth.key`（0600）+ 每平台密文 `auth.<平台>.token`。
//! 历史版本只有单平台文件 `auth.token`，视为 GitHub 令牌：读取时回退，写入新位置后清理，
//! 保证老用户升级后不掉登录。
//!
//! 威胁模型与原实现一致：任何能读取用户配置目录的本地进程都能同时拿到密钥与密文，
//! 机密性依赖 OS 级目录权限（0600）缓解。

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};

use crate::domain::error::AppError;

const KEY_FILE: &str = "auth.key";
/// 历史遗留的单一凭证文件名（迁移前）。
const LEGACY_TOKEN_FILE: &str = "auth.token";
const KEY_MAGIC: &[u8; 4] = b"MYNK";
const TOKEN_MAGIC: &[u8; 4] = b"MYNT";
const VERSION: u8 = 1;
const KEY_LEN: usize = 32;
const NONCE_LEN: usize = 12;
const KEY_RECORD_LEN: usize = 5 + KEY_LEN;
const TOKEN_HEADER_LEN: usize = 5 + NONCE_LEN;

pub(super) fn save(root: &Path, provider_id: &str, token: &str) -> Result<(), AppError> {
    fs::create_dir_all(root)?;
    let key = ensure_key(root)?;
    let mut nonce = [0u8; NONCE_LEN];
    getrandom::getrandom(&mut nonce).map_err(|e| AppError::Io(e.to_string()))?;
    let cipher = cipher_from_key(&key)?;
    let ciphertext = cipher
        .encrypt(&Nonce::from(nonce), token.as_bytes())
        .map_err(|e| AppError::Auth(e.to_string()))?;
    write_secure(
        token_path(root, provider_id),
        encode_token_record(&nonce, &ciphertext),
    )?;
    // 迁移完成后清理历史文件，避免同一凭证存在两份。
    if is_default_provider(provider_id) {
        remove_if_exists(&legacy_token_path(root))?;
    }
    Ok(())
}

pub(super) fn read(root: &Path, provider_id: &str) -> Result<String, AppError> {
    let key = load_key(root)?;
    let path = match readable_token_path(root, provider_id) {
        Some(path) => path,
        None => return Err(AppError::Auth("未登录或本地凭证已失效".into())),
    };
    let record = fs::read(path).map_err(|e| AppError::Io(e.to_string()))?;
    let (nonce, ciphertext) = decode_token_record(&record)?;
    let cipher = cipher_from_key(&key)?;
    let bytes = cipher
        .decrypt(&Nonce::from(nonce), ciphertext)
        .map_err(|_| AppError::Auth("未登录或本地凭证已失效".into()))?;
    String::from_utf8(bytes).map_err(|e| AppError::Auth(e.to_string()))
}

pub(super) fn remove(root: &Path, provider_id: &str) -> Result<(), AppError> {
    remove_if_exists(&token_path(root, provider_id))?;
    if is_default_provider(provider_id) {
        remove_if_exists(&legacy_token_path(root))?;
    }
    Ok(())
}

/// 删除共享密钥；令牌文件由 `delete_all` 逐平台删除。
pub(super) fn remove_key(root: &Path) -> Result<(), AppError> {
    remove_if_exists(&key_path(root))
}

/// 读取候选路径：优先当前文件，桌面端 GitHub 回退历史文件。
fn readable_token_path(root: &Path, provider_id: &str) -> Option<PathBuf> {
    let path = token_path(root, provider_id);
    if path.is_file() {
        return Some(path);
    }
    let legacy = legacy_token_path(root);
    if is_default_provider(provider_id) && legacy.is_file() {
        return Some(legacy);
    }
    None
}

fn is_default_provider(provider_id: &str) -> bool {
    provider_id == crate::domain::hosting::DEFAULT.id()
}

fn token_path(root: &Path, provider_id: &str) -> PathBuf {
    root.join(format!("auth.{provider_id}.token"))
}

fn legacy_token_path(root: &Path) -> PathBuf {
    root.join(LEGACY_TOKEN_FILE)
}

fn key_path(root: &Path) -> PathBuf {
    root.join(KEY_FILE)
}

fn ensure_key(root: &Path) -> Result<[u8; KEY_LEN], AppError> {
    if key_path(root).is_file() {
        return load_key(root);
    }
    let mut key = [0u8; KEY_LEN];
    getrandom::getrandom(&mut key).map_err(|e| AppError::Io(e.to_string()))?;
    write_secure(key_path(root), encode_key_record(&key))?;
    Ok(key)
}

fn load_key(root: &Path) -> Result<[u8; KEY_LEN], AppError> {
    let record = match fs::read(key_path(root)) {
        Ok(bytes) => bytes,
        Err(err) if err.kind() == ErrorKind::NotFound => {
            return Err(AppError::Auth("本地加密密钥不存在".into()))
        }
        Err(err) => return Err(AppError::Io(err.to_string())),
    };
    decode_key_record(&record)
}

fn write_secure(path: PathBuf, bytes: Vec<u8>) -> Result<(), AppError> {
    fs::write(&path, bytes)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))?;
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

fn cipher_from_key(key: &[u8; KEY_LEN]) -> Result<Aes256Gcm, AppError> {
    Aes256Gcm::new_from_slice(key).map_err(|e| AppError::Auth(e.to_string()))
}

fn encode_key_record(key: &[u8; KEY_LEN]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(KEY_RECORD_LEN);
    bytes.extend_from_slice(KEY_MAGIC);
    bytes.push(VERSION);
    bytes.extend_from_slice(key);
    bytes
}

fn decode_key_record(bytes: &[u8]) -> Result<[u8; KEY_LEN], AppError> {
    if bytes.len() != KEY_RECORD_LEN || &bytes[..4] != KEY_MAGIC || bytes[4] != VERSION {
        return Err(AppError::Auth("本地加密密钥格式无效".into()));
    }
    let mut key = [0u8; KEY_LEN];
    key.copy_from_slice(&bytes[5..]);
    Ok(key)
}

fn encode_token_record(nonce: &[u8; NONCE_LEN], ciphertext: &[u8]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(TOKEN_HEADER_LEN + ciphertext.len());
    bytes.extend_from_slice(TOKEN_MAGIC);
    bytes.push(VERSION);
    bytes.extend_from_slice(nonce);
    bytes.extend_from_slice(ciphertext);
    bytes
}

fn decode_token_record(bytes: &[u8]) -> Result<([u8; NONCE_LEN], &[u8]), AppError> {
    if bytes.len() <= TOKEN_HEADER_LEN || &bytes[..4] != TOKEN_MAGIC || bytes[4] != VERSION {
        return Err(AppError::Auth("本地加密凭证格式无效".into()));
    }
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&bytes[5..TOKEN_HEADER_LEN]);
    Ok((nonce, &bytes[TOKEN_HEADER_LEN..]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_path_is_per_provider() {
        let root = Path::new("/cfg");
        assert_eq!(token_path(root, "github"), root.join("auth.github.token"));
        assert_eq!(token_path(root, "gitee"), root.join("auth.gitee.token"));
        assert_eq!(legacy_token_path(root), root.join("auth.token"));
    }

    #[test]
    fn record_codecs_round_trip() {
        let key = [7u8; KEY_LEN];
        assert_eq!(decode_key_record(&encode_key_record(&key)).unwrap(), key);

        let nonce = [3u8; NONCE_LEN];
        let record = encode_token_record(&nonce, b"cipher");
        let (decoded_nonce, decoded_cipher) = decode_token_record(&record).unwrap();
        assert_eq!(decoded_nonce, nonce);
        assert_eq!(decoded_cipher, b"cipher");
    }

    #[test]
    fn malformed_records_are_rejected_as_auth_errors() {
        assert!(matches!(
            decode_key_record(b"short"),
            Err(AppError::Auth(_))
        ));
        assert!(matches!(
            decode_token_record(b"MYNT\x01short"),
            Err(AppError::Auth(_))
        ));
    }
}
