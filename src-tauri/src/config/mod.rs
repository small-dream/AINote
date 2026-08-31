//! 应用配置持久化：仓库注册表与非敏感认证状态存于 app config dir 下的 ainote.json。
//! 注册表纯逻辑见 config/repos.rs（可单测）。

pub(crate) mod repos;

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::domain::error::AppError;

const CONFIG_FILE: &str = "ainote.json";

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppConfig {
    #[serde(default)]
    pub(crate) repos: Vec<repos::RepoConfig>,
    #[serde(default)]
    pub(crate) active_repo_id: Option<String>,
    #[serde(default)]
    pub(crate) has_token: Option<bool>,
    /// 旧版单仓库字段（repoPath），加载时迁移进 repos。
    #[serde(default, rename = "repoPath")]
    legacy_repo_path: Option<String>,
}

impl AppConfig {
    /// 兼容旧版单仓库配置：将 repoPath 迁移为首个仓库并设为活动仓库。
    fn migrate(&mut self) {
        let Some(path) = self.legacy_repo_path.take() else { return };
        if !self.repos.is_empty() {
            return;
        }
        let name = PathBuf::from(&path)
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.clone());
        repos::register_cfg(self, &name, &path, None);
    }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    fs::create_dir_all(&dir)?;
    Ok(dir.join(CONFIG_FILE))
}

fn load_config(app: &AppHandle) -> Result<AppConfig, AppError> {
    let path = config_path(app)?;
    if !path.is_file() {
        return Ok(AppConfig::default());
    }
    let mut cfg: AppConfig = serde_json::from_str(&fs::read_to_string(path)?)
        .map_err(|e| AppError::Io(e.to_string()))?;
    cfg.migrate();
    Ok(cfg)
}

fn save_config(app: &AppHandle, cfg: &AppConfig) -> Result<(), AppError> {
    let json = serde_json::to_string_pretty(cfg).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(fs::write(config_path(app)?, json)?)
}

/// 当前活动仓库路径；未绑定返回 Ok(None)。
pub fn load_repo_path(app: &AppHandle) -> Result<Option<String>, AppError> {
    repos::active_path(app)
}

/// 当前认证状态与活动仓库路径（启动守卫使用）。
pub fn load_auth_status(app: &AppHandle) -> Result<(bool, Option<String>), AppError> {
    let cfg = load_config(app)?;
    Ok((cfg.has_token.unwrap_or(false), repos::active_path_cfg(&cfg)))
}

/// 读取活动仓库路径，未绑定时报 REPO_3001（供各 Command 统一前置校验）。
pub fn require_repo_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    repos::active_path(app)?
        .map(PathBuf::from)
        .ok_or_else(|| AppError::Repo("尚未绑定笔记仓库".into()))
}

/// 标记当前已保存 token（只记录存在性，不记录明文）。
pub fn save_token_present(app: &AppHandle, has_token: bool) -> Result<(), AppError> {
    let mut cfg = load_config(app)?;
    cfg.has_token = Some(has_token);
    save_config(app, &cfg)
}

/// 清除全部配置（logout 时调用）。
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
