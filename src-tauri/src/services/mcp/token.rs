//! MCP Bearer Token 与客户端配置生成（桌面端）。
//!
//! Token 存 `SecureStore`（AES-256-GCM 文件，0600），不写入 `ainote.json`；
//! 前端只在“首次生成 / 轮换”时一次性拿到明文用于复制到客户端。

use std::path::PathBuf;

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde_json::json;
use tauri::{AppHandle, Manager};

use crate::domain::error::AppError;
use crate::domain::mcp::{endpoint_url, MCP_SERVER_NAME, MCP_TOKEN_PREFIX};
use crate::services::secure_store;

const SECRET_NAME: &str = "mcp";
const TOKEN_BYTES: usize = 32;

fn config_root(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|err| AppError::Io(err.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// 生成新 Token：`ainote_mcp_` + 32 字节随机数的 Base64URL（无填充）。
pub fn generate_token() -> Result<String, AppError> {
    let mut bytes = [0u8; TOKEN_BYTES];
    getrandom::getrandom(&mut bytes).map_err(|err| AppError::Io(err.to_string()))?;
    Ok(format!(
        "{MCP_TOKEN_PREFIX}{}",
        URL_SAFE_NO_PAD.encode(bytes)
    ))
}

/// 读取已保存 Token；不存在返回 None，密文损坏返回错误（由调用方决定是否重新生成）。
pub fn read_token(app: &AppHandle) -> Result<Option<String>, AppError> {
    secure_store::read_secret(&config_root(app)?, SECRET_NAME)
}

pub fn save_token(app: &AppHandle, token: &str) -> Result<(), AppError> {
    secure_store::save_secret(&config_root(app)?, SECRET_NAME, token)
}

/// 确保存在 Token：已有则原样返回，否则生成并保存。第二个返回值表示是否新生成。
pub fn ensure_token(app: &AppHandle) -> Result<(String, bool), AppError> {
    match read_token(app) {
        Ok(Some(token)) if !token.trim().is_empty() => Ok((token, false)),
        Ok(_) => {
            let token = generate_token()?;
            save_token(app, &token)?;
            Ok((token, true))
        }
        Err(err) => {
            // 密文损坏/密钥丢失时重新生成：本地集成凭证可重新签发，不阻断用户。
            log::warn!(target: "ainote::mcp", "读取 MCP Token 失败，重新生成: {err}");
            let token = generate_token()?;
            save_token(app, &token)?;
            Ok((token, true))
        }
    }
}

/// 轮换 Token 并返回新明文。
pub fn rotate_token(app: &AppHandle) -> Result<String, AppError> {
    let token = generate_token()?;
    save_token(app, &token)?;
    Ok(token)
}

/// 生成可直接粘贴到 MCP 客户端的 JSON 配置（含 Bearer Token）。
pub fn client_config(port: u16, token: &str) -> String {
    serde_json::to_string_pretty(&json!({
        "mcpServers": {
            MCP_SERVER_NAME: {
                "url": endpoint_url(port),
                "headers": {
                    "Authorization": format!("Bearer {token}")
                }
            }
        }
    }))
    .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_token_has_prefix_and_entropy() {
        let a = generate_token().unwrap();
        let b = generate_token().unwrap();
        assert!(a.starts_with(MCP_TOKEN_PREFIX));
        assert!(a.len() > 40);
        assert_ne!(a, b);
        assert!(a
            .trim_start_matches(MCP_TOKEN_PREFIX)
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
    }

    #[test]
    fn client_config_contains_url_and_bearer_header() {
        let config = client_config(39471, "ainote_mcp_testtoken");
        let value: serde_json::Value = serde_json::from_str(&config).unwrap();
        let server = &value["mcpServers"][MCP_SERVER_NAME];
        assert_eq!(server["url"], "http://127.0.0.1:39471/mcp");
        assert_eq!(server["headers"]["Authorization"], "Bearer ainote_mcp_testtoken");
    }
}
