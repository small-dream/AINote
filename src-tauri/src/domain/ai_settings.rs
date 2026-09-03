use serde::{Deserialize, Serialize};

use super::ai::{AiConfig, AiProvider};
use super::error::AppError;

pub const SCHEMA_VERSION: u8 = 2;
pub const LEGACY_PROVIDER_ID: &str = "legacy-provider";
pub const LEGACY_MODEL_ID: &str = "legacy-model";

/// AI Provider 连接：一个服务源可包含多个模型。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    pub id: String,
    pub provider: AiProvider,
    pub display_name: String,
    pub base_url: String,
    #[serde(default)]
    pub enabled: bool,
}

/// AI 模型：属于某个 Provider，可独立启停。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModelConfig {
    pub id: String,
    pub provider_id: String,
    pub model_id: String,
    pub display_name: String,
    #[serde(default)]
    pub enabled: bool,
}

/// 保存时批量更新的 Provider Key（空 Key 表示清除）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiApiKeyInput {
    pub provider_id: String,
    pub key: String,
}

/// AI 设置 v2（非敏感部分存 ai.json；Key 按 Provider 加密存储）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    #[serde(default = "default_schema_version")]
    pub schema_version: u8,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub providers: Vec<AiProviderConfig>,
    #[serde(default)]
    pub models: Vec<AiModelConfig>,
    #[serde(default)]
    pub default_model_id: Option<String>,
}

/// 传输给前端的 Provider（含 has_key，不含明文 Key）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderDto {
    pub id: String,
    pub provider: AiProvider,
    pub display_name: String,
    pub base_url: String,
    pub enabled: bool,
    pub has_key: bool,
}

/// 传输给前端的 AI 设置。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettingsDto {
    pub enabled: bool,
    pub providers: Vec<AiProviderDto>,
    pub models: Vec<AiModelConfig>,
    pub default_model_id: Option<String>,
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            enabled: false,
            providers: Vec::new(),
            models: Vec::new(),
            default_model_id: None,
        }
    }
}

impl AiSettings {
    /// 将 v1 单配置迁移为一个 Provider 与一个默认模型，避免老用户重新配置。
    pub fn from_legacy(cfg: LegacyAiConfig) -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            enabled: cfg.enabled,
            providers: vec![AiProviderConfig {
                id: LEGACY_PROVIDER_ID.into(),
                provider: cfg.provider,
                display_name: provider_display_name(cfg.provider),
                base_url: cfg.base_url,
                enabled: cfg.enabled,
            }],
            models: vec![AiModelConfig {
                id: LEGACY_MODEL_ID.into(),
                provider_id: LEGACY_PROVIDER_ID.into(),
                model_id: cfg.model,
                display_name: "Legacy model".into(),
                enabled: cfg.enabled,
            }],
            default_model_id: Some(LEGACY_MODEL_ID.into()),
        }
    }

    /// 校验引用关系、唯一性与基础 URL，避免保存后请求路由歧义。
    pub fn validate(&self) -> Result<(), AppError> {
        validate_ids(
            &self
                .providers
                .iter()
                .map(|p| p.id.as_str())
                .collect::<Vec<_>>(),
            "Provider ID",
        )?;
        validate_ids(
            &self
                .models
                .iter()
                .map(|m| m.id.as_str())
                .collect::<Vec<_>>(),
            "模型 ID",
        )?;
        for provider in &self.providers {
            validate_provider_id(&provider.id)?;
            if !provider.base_url.starts_with("http://")
                && !provider.base_url.starts_with("https://")
            {
                return Err(AppError::Ai(format!(
                    "Provider “{}”的接口地址必须以 http(s):// 开头",
                    provider.display_name
                )));
            }
        }
        for model in &self.models {
            validate_id(&model.id, "模型 ID")?;
            validate_id(&model.model_id, "模型名")?;
            validate_provider_id(&model.provider_id)?;
            if !self.providers.iter().any(|p| p.id == model.provider_id) {
                return Err(AppError::Ai(format!(
                    "模型“{}”引用了不存在的 Provider",
                    model.display_name
                )));
            }
        }
        if let Some(id) = &self.default_model_id {
            if !self.models.iter().any(|m| &m.id == id) {
                return Err(AppError::Ai("默认模型不存在，请重新选择".into()));
            }
        }
        Ok(())
    }

    /// 解析一次请求要使用的 Provider 与模型；model_id 为空时使用默认模型。
    pub fn resolve_model(
        &self,
        model_id: Option<&str>,
    ) -> Result<(AiProviderConfig, AiModelConfig), AppError> {
        if !self.enabled {
            return Err(AppError::Ai("AI 功能未启用，请先在设置中配置".into()));
        }
        let requested = model_id.or(self.default_model_id.as_deref());
        let Some(model_id) = requested else {
            return Err(AppError::Ai("尚未选择 AI 模型，请先在设置中添加".into()));
        };
        let model = self
            .models
            .iter()
            .find(|model| model.id == model_id)
            .ok_or_else(|| AppError::Ai("所选 AI 模型不存在，请重新选择".into()))?;
        if !model.enabled {
            return Err(AppError::Ai("所选 AI 模型已停用，请重新选择".into()));
        }
        let provider = self
            .providers
            .iter()
            .find(|provider| provider.id == model.provider_id)
            .ok_or_else(|| AppError::Ai("所选模型的服务商不存在".into()))?;
        if !provider.enabled {
            return Err(AppError::Ai("所选模型的服务商已停用，请重新选择".into()));
        }
        Ok((provider.clone(), model.clone()))
    }

    /// 转换为请求运行时配置。
    pub fn runtime_config(provider: &AiProviderConfig, model: &AiModelConfig) -> AiConfig {
        AiConfig {
            provider: provider.provider,
            base_url: provider.base_url.clone(),
            model: model.model_id.clone(),
        }
    }
}

fn validate_provider_id(value: &str) -> Result<(), AppError> {
    let valid = !value.is_empty()
        && value.len() <= 64
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_');
    if valid {
        Ok(())
    } else {
        Err(AppError::Ai(
            "Provider ID 只能包含字母、数字、连字符和下划线".into(),
        ))
    }
}

/// v1 配置结构，仅用于读取旧 ai.json。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyAiConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub provider: AiProvider,
    #[serde(default = "legacy_base_url")]
    pub base_url: String,
    #[serde(default = "legacy_model")]
    pub model: String,
}

fn validate_ids(ids: &[&str], label: &str) -> Result<(), AppError> {
    for (index, id) in ids.iter().enumerate() {
        if ids[(index + 1)..].contains(id) {
            return Err(AppError::Ai(format!("{label}重复：{id}")));
        }
    }
    Ok(())
}

fn validate_id(value: &str, label: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        return Err(AppError::Ai(format!("{label}不能为空")));
    }
    Ok(())
}

fn default_schema_version() -> u8 {
    SCHEMA_VERSION
}

fn legacy_base_url() -> String {
    "https://api.openai.com/v1".into()
}

fn legacy_model() -> String {
    "gpt-4o-mini".into()
}

fn provider_display_name(provider: AiProvider) -> String {
    match provider {
        AiProvider::OpenAiCompatible => "OpenAI compatible".into(),
        AiProvider::Ollama => "Ollama".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setting() -> AiSettings {
        AiSettings::from_legacy(LegacyAiConfig {
            enabled: true,
            provider: AiProvider::OpenAiCompatible,
            base_url: "https://example.com/v1".into(),
            model: "gpt-test".into(),
        })
    }

    #[test]
    fn legacy_config_becomes_default_model() {
        let setting = setting();
        assert!(setting.enabled);
        assert_eq!(setting.default_model_id.as_deref(), Some(LEGACY_MODEL_ID));
        setting.validate().unwrap();
    }

    #[test]
    fn disabled_model_cannot_be_resolved() {
        let mut setting = setting();
        setting.models[0].enabled = false;
        assert!(setting.resolve_model(None).is_err());
    }

    #[test]
    fn missing_default_is_rejected() {
        let mut setting = setting();
        setting.default_model_id = Some("missing".into());
        assert!(setting.validate().is_err());
    }

    #[test]
    fn provider_id_cannot_escape_key_file_name() {
        let mut setting = setting();
        setting.providers[0].id = "../escape".into();
        assert!(setting.validate().is_err());
    }
}
