//! AI 配置存储：非敏感配置存 ai.json（明文），API Key 走 secure_store 加密（前端拿不到明文）。

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::domain::ai_settings::{AiProviderDto, AiSettings, AiSettingsDto};
use crate::domain::error::AppError;

use super::secure_store;

const CONFIG_FILE: &str = "ai.json";
const LEGACY_KEY_NAME: &str = "ai_key";

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

    /// 读取 v2 设置；发现 v1 文件时自动迁移（含旧 API Key）。
    pub fn settings(&self) -> Result<AiSettings, AppError> {
        let path = self.root.join(CONFIG_FILE);
        if !path.is_file() {
            return Ok(AiSettings::default());
        }
        let raw = fs::read_to_string(path)?;
        let value: serde_json::Value =
            serde_json::from_str(&raw).map_err(|e| AppError::Io(e.to_string()))?;
        if value
            .get("schemaVersion")
            .and_then(serde_json::Value::as_u64)
            == Some(2)
        {
            serde_json::from_value(value).map_err(|e| AppError::Io(e.to_string()))
        } else {
            self.migrate_legacy(value)
        }
    }

    pub fn save_settings(&self, settings: &AiSettings) -> Result<(), AppError> {
        settings.validate()?;
        let raw =
            serde_json::to_string_pretty(settings).map_err(|e| AppError::Io(e.to_string()))?;
        fs::write(self.root.join(CONFIG_FILE), raw)?;
        Ok(())
    }

    pub fn provider_key(&self, provider_id: &str) -> Result<Option<String>, AppError> {
        secure_store::read_secret(&self.root, &key_name(provider_id))
    }

    pub fn save_provider_key(&self, provider_id: &str, key: &str) -> Result<(), AppError> {
        secure_store::save_secret(&self.root, &key_name(provider_id), key)
    }

    pub fn delete_provider_key(&self, provider_id: &str) -> Result<(), AppError> {
        secure_store::delete_secret(&self.root, &key_name(provider_id))
    }

    /// 返回给前端的配置视图（含 has_key，不含明文 Key）。
    pub fn dto(&self) -> Result<AiSettingsDto, AppError> {
        let settings = self.settings()?;
        let mut providers = Vec::with_capacity(settings.providers.len());
        for provider in &settings.providers {
            providers.push(AiProviderDto {
                id: provider.id.clone(),
                provider: provider.provider,
                display_name: provider.display_name.clone(),
                base_url: provider.base_url.clone(),
                enabled: provider.enabled,
                has_key: self.provider_key(&provider.id)?.is_some(),
            });
        }
        Ok(AiSettingsDto {
            enabled: settings.enabled,
            providers,
            models: settings.models,
            default_model_id: settings.default_model_id,
        })
    }

    fn migrate_legacy(&self, value: serde_json::Value) -> Result<AiSettings, AppError> {
        let legacy: crate::domain::ai_settings::LegacyAiConfig =
            serde_json::from_value(value).map_err(|e| AppError::Io(e.to_string()))?;
        let settings = AiSettings::from_legacy(legacy);
        self.migrate_legacy_key()?;
        self.save_settings(&settings)?;
        Ok(settings)
    }

    fn migrate_legacy_key(&self) -> Result<(), AppError> {
        let Some(key) = secure_store::read_secret(&self.root, LEGACY_KEY_NAME)? else {
            return Ok(());
        };
        self.save_provider_key(crate::domain::ai_settings::LEGACY_PROVIDER_ID, &key)?;
        secure_store::delete_secret(&self.root, LEGACY_KEY_NAME)
    }
}

fn key_name(provider_id: &str) -> String {
    format!("ai_provider_{provider_id}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::ai::AiProvider;

    #[test]
    fn missing_file_returns_safe_default() {
        let dir = tempfile::tempdir().unwrap();
        let store = AiStore {
            root: dir.path().to_path_buf(),
        };
        let settings = store.settings().unwrap();
        assert!(!settings.enabled);
        assert!(settings.providers.is_empty());
    }

    #[test]
    fn settings_roundtrip_and_key_storage() {
        let dir = tempfile::tempdir().unwrap();
        let store = AiStore {
            root: dir.path().to_path_buf(),
        };
        let mut settings = store.settings().unwrap();
        settings.enabled = true;
        settings
            .providers
            .push(crate::domain::ai_settings::AiProviderConfig {
                id: "provider-1".into(),
                provider: AiProvider::Ollama,
                display_name: "Local".into(),
                base_url: "http://localhost:11434".into(),
                enabled: true,
            });
        settings
            .models
            .push(crate::domain::ai_settings::AiModelConfig {
                id: "model-1".into(),
                provider_id: "provider-1".into(),
                model_id: "llama3".into(),
                display_name: "Llama 3".into(),
                enabled: true,
            });
        settings.default_model_id = Some("model-1".into());
        store.save_settings(&settings).unwrap();
        store.save_provider_key("provider-1", "secret").unwrap();
        assert!(store.provider_key("provider-1").unwrap().is_some());
    }
}
