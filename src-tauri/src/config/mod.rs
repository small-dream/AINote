//! 应用配置持久化：已绑定仓库路径存于 app config dir 下的 mynote.json。

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::domain::error::AppError;

const CONFIG_FILE: &str = "mynote.json";

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    #[serde(default)]
    repo_path: Option<String>,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    fs::create_dir_all(&dir)?;
    Ok(dir.join(CONFIG_FILE))
}

/// 当前绑定的仓库路径；未绑定返回 Ok(None)。
pub fn load_repo_path(app: &AppHandle) -> Result<Option<String>, AppError> {
    let path = config_path(app)?;
    if !path.is_file() {
        return Ok(None);
    }
    let cfg: AppConfig = serde_json::from_str(&fs::read_to_string(path)?)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(cfg.repo_path)
}

/// 读取绑定路径，未绑定时报 REPO_3001（供各 Command 统一前置校验）。
pub fn require_repo_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    load_repo_path(app)?
        .map(PathBuf::from)
        .ok_or_else(|| AppError::Repo("尚未绑定笔记仓库".into()))
}

pub fn save_repo_path(app: &AppHandle, repo_path: &str) -> Result<(), AppError> {
    let cfg = AppConfig {
        repo_path: Some(repo_path.to_string()),
    };
    let json = serde_json::to_string_pretty(&cfg).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(fs::write(config_path(app)?, json)?)
}

/// 清除绑定（logout 时调用）。
pub fn clear(app: &AppHandle) -> Result<(), AppError> {
    let path = config_path(app)?;
    if path.is_file() {
        fs::remove_file(path)?;
    }
    Ok(())
}

/// clone 的默认目标目录：app data dir 下的 notes/。
pub fn notes_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(dir.join("notes"))
}
