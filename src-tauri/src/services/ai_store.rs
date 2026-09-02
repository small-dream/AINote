//! AI 配置存储：非敏感配置存 ai.json（明文），API Key 走 secure_store 加密（前端拿不到明文）。

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::domain::ai::{AiConfig, AiConfigDto};
use crate::domain::error::AppError;

use super::secure_store;

const CONFIG_FILE: &str = "ai.json";
const KEY_NAME: &str = "ai_key";

pub struct AiStore {
    root: PathBuf,
}

impl AiStore {
    pub fn from_app(app: &AppHandle) -> Result<Self, AppError> {
        let root = app
            .path()
            .app_config_dir()
            .map_err(|e| AppError::Io(e.to_string()))?;
        fs::create_dir_all(&root)?;
        Ok(Self { root })
    }

    /// 读取配置；文件缺失返回默认（未启用）。
    pub fn config(&self) -> Result<AiConfig, AppError> {
        let path = self.root.join(CONFIG_FILE);
        if !path.is_file() {
            return Ok(AiConfig::default());
        }
        let raw = fs::read_to_string(path)?;
        serde_json::from_str(&raw).map_err(|e| AppError::Io(e.to_string()))
    }

    pub fn save_config(&self, cfg: &AiConfig) -> Result<(), AppError> {
        let raw = serde_json::to_string_pretty(cfg).map_err(|e| AppError::Io(e.to_string()))?;
        fs::write(self.root.join(CONFIG_FILE), raw)?;
        Ok(())
    }

    pub fn key(&self) -> Result<Option<String>, AppError> {
        secure_store::read_secret(&self.root, KEY_NAME)
    }

    pub fn save_key(&self, key: &str) -> Result<(), AppError> {
        secure_store::save_secret(&self.root, KEY_NAME, key)
    }

    pub fn delete_key(&self) -> Result<(), AppError> {
        secure_store::delete_secret(&self.root, KEY_NAME)
    }

    /// 返回给前端的配置视图（含 has_key，不含明文 Key）。
    pub fn dto(&self) -> Result<AiConfigDto, AppError> {
        let cfg = self.config()?;
        let mut dto = AiConfigDto::from(&cfg);
        dto.has_key = self.key()?.is_some();
        Ok(dto)
    }
}
