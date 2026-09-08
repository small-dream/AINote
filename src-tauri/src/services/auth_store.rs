use std::fs;
#[cfg(not(any(target_os = "ios", target_os = "android")))]
use std::io::ErrorKind;
use std::path::PathBuf;

#[cfg(not(any(target_os = "ios", target_os = "android")))]
use aes_gcm::aead::{Aead, KeyInit};
#[cfg(not(any(target_os = "ios", target_os = "android")))]
use aes_gcm::{Aes256Gcm, Nonce};
use tauri::{AppHandle, Manager};

use crate::domain::error::AppError;

#[cfg(not(any(target_os = "ios", target_os = "android")))]
const KEY_FILE: &str = "auth.key";
#[cfg(not(any(target_os = "ios", target_os = "android")))]
const TOKEN_FILE: &str = "auth.token";
#[cfg(not(any(target_os = "ios", target_os = "android")))]
const KEY_MAGIC: &[u8; 4] = b"MYNK";
#[cfg(not(any(target_os = "ios", target_os = "android")))]
const TOKEN_MAGIC: &[u8; 4] = b"MYNT";
#[cfg(not(any(target_os = "ios", target_os = "android")))]
const VERSION: u8 = 1;
#[cfg(not(any(target_os = "ios", target_os = "android")))]
const KEY_LEN: usize = 32;
#[cfg(not(any(target_os = "ios", target_os = "android")))]
const NONCE_LEN: usize = 12;
#[cfg(not(any(target_os = "ios", target_os = "android")))]
const KEY_RECORD_LEN: usize = 5 + KEY_LEN;
#[cfg(not(any(target_os = "ios", target_os = "android")))]
const TOKEN_HEADER_LEN: usize = 5 + NONCE_LEN;

#[derive(Debug, Clone)]
pub struct AuthStore {
    #[cfg_attr(any(target_os = "ios", target_os = "android"), allow(dead_code))]
    root: PathBuf,
}

impl AuthStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn from_app(app: &AppHandle) -> Result<Self, AppError> {
        let root = app
            .path()
            .app_config_dir()
            .map_err(|e| AppError::Io(e.to_string()))?;
        fs::create_dir_all(&root)?;
        Ok(Self::new(root))
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    pub fn save_token(&self, token: &str) -> Result<(), AppError> {
        self.ensure_root()?;
        let key = self.ensure_key()?;
        let mut nonce = [0u8; NONCE_LEN];
        getrandom::getrandom(&mut nonce).map_err(|e| AppError::Io(e.to_string()))?;
        let cipher = cipher_from_key(&key)?;
        let ciphertext = cipher
            .encrypt(Nonce::from_slice(&nonce), token.as_bytes())
            .map_err(|e| AppError::Auth(e.to_string()))?;
        self.write_secure(self.token_path(), encode_token_record(&nonce, &ciphertext))?;
        Ok(())
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    pub fn read_token(&self) -> Result<String, AppError> {
        let key = self.load_key()?;
        let record = self.read_required(self.token_path(), "未登录或本地凭证已失效")?;
        let (nonce, ciphertext) = decode_token_record(&record)?;
        let cipher = cipher_from_key(&key)?;
        let bytes = cipher
            .decrypt(Nonce::from_slice(&nonce), ciphertext)
            .map_err(|_| AppError::Auth("未登录或本地凭证已失效".into()))?;
        String::from_utf8(bytes).map_err(|e| AppError::Auth(e.to_string()))
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    pub fn has_token(&self) -> Result<bool, AppError> {
        match self.read_token() {
            Ok(_) => Ok(true),
            Err(AppError::Auth(_)) => Ok(false),
            Err(err) => Err(err),
        }
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    pub fn delete_token(&self) -> Result<(), AppError> {
        self.remove_if_exists(self.token_path())?;
        self.remove_if_exists(self.key_path())?;
        Ok(())
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    fn ensure_root(&self) -> Result<(), AppError> {
        fs::create_dir_all(&self.root)?;
        Ok(())
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    fn ensure_key(&self) -> Result<[u8; KEY_LEN], AppError> {
        if self.key_path().is_file() {
            return self.load_key();
        }
        let mut key = [0u8; KEY_LEN];
        getrandom::getrandom(&mut key).map_err(|e| AppError::Io(e.to_string()))?;
        self.write_secure(self.key_path(), encode_key_record(&key))?;
        Ok(key)
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    fn load_key(&self) -> Result<[u8; KEY_LEN], AppError> {
        let record = self.read_required(self.key_path(), "本地加密密钥不存在")?;
        decode_key_record(&record)
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    fn read_required(&self, path: PathBuf, missing_msg: &str) -> Result<Vec<u8>, AppError> {
        match fs::read(path) {
            Ok(bytes) => Ok(bytes),
            Err(err) if err.kind() == ErrorKind::NotFound => {
                Err(AppError::Auth(missing_msg.into()))
            }
            Err(err) => Err(AppError::Io(err.to_string())),
        }
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    fn write_secure(&self, path: PathBuf, bytes: Vec<u8>) -> Result<(), AppError> {
        fs::write(&path, bytes)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o600))?;
        }
        Ok(())
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    fn remove_if_exists(&self, path: PathBuf) -> Result<(), AppError> {
        match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(err) if err.kind() == ErrorKind::NotFound => Ok(()),
            Err(err) => Err(AppError::Io(err.to_string())),
        }
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    fn key_path(&self) -> PathBuf {
        self.root.join(KEY_FILE)
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    fn token_path(&self) -> PathBuf {
        self.root.join(TOKEN_FILE)
    }
}

#[cfg(any(target_os = "ios", target_os = "android"))]
const KEYRING_SERVICE: &str = "dev.ainote.app.credentials";

#[cfg(any(target_os = "ios", target_os = "android"))]
impl AuthStore {
    pub fn save_token(&self, token: &str) -> Result<(), AppError> {
        tauri_plugin_keyring_store::KeyringStore::new(KEYRING_SERVICE)
            .set_password("github_token", token)
            .map_err(|err| AppError::Io(err.to_string()))
    }

    pub fn read_token(&self) -> Result<String, AppError> {
        tauri_plugin_keyring_store::KeyringStore::new(KEYRING_SERVICE)
            .get_password("github_token")
            .map_err(|err| AppError::Io(err.to_string()))?
            .ok_or_else(|| AppError::Auth("未登录或本地凭证已失效".into()))
    }

    pub fn has_token(&self) -> Result<bool, AppError> {
        match self.read_token() {
            Ok(_) => Ok(true),
            Err(AppError::Auth(_)) => Ok(false),
            Err(err) => Err(err),
        }
    }

    pub fn delete_token(&self) -> Result<(), AppError> {
        tauri_plugin_keyring_store::KeyringStore::new(KEYRING_SERVICE)
            .delete("github_token")
            .map_err(|err| AppError::Io(err.to_string()))
    }
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn cipher_from_key(key: &[u8; KEY_LEN]) -> Result<Aes256Gcm, AppError> {
    Aes256Gcm::new_from_slice(key).map_err(|e| AppError::Auth(e.to_string()))
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn encode_key_record(key: &[u8; KEY_LEN]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(KEY_RECORD_LEN);
    bytes.extend_from_slice(KEY_MAGIC);
    bytes.push(VERSION);
    bytes.extend_from_slice(key);
    bytes
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn decode_key_record(bytes: &[u8]) -> Result<[u8; KEY_LEN], AppError> {
    if bytes.len() != KEY_RECORD_LEN || &bytes[..4] != KEY_MAGIC || bytes[4] != VERSION {
        return Err(AppError::Auth("本地加密密钥格式无效".into()));
    }
    let mut key = [0u8; KEY_LEN];
    key.copy_from_slice(&bytes[5..]);
    Ok(key)
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn encode_token_record(nonce: &[u8; NONCE_LEN], ciphertext: &[u8]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(TOKEN_HEADER_LEN + ciphertext.len());
    bytes.extend_from_slice(TOKEN_MAGIC);
    bytes.push(VERSION);
    bytes.extend_from_slice(nonce);
    bytes.extend_from_slice(ciphertext);
    bytes
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn decode_token_record(bytes: &[u8]) -> Result<([u8; NONCE_LEN], &[u8]), AppError> {
    if bytes.len() <= TOKEN_HEADER_LEN || &bytes[..4] != TOKEN_MAGIC || bytes[4] != VERSION {
        return Err(AppError::Auth("本地加密凭证格式无效".into()));
    }
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&bytes[5..TOKEN_HEADER_LEN]);
    Ok((nonce, &bytes[TOKEN_HEADER_LEN..]))
}
