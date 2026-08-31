//! 仓库注册表：已绑定仓库的增删改查与活动仓库切换。
//! 纯逻辑（`*_cfg` 操作 `AppConfig`）可单测；AppHandle 包装负责读改写持久化配置。

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::domain::error::AppError;

use super::{load_config, save_config, AppConfig};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepoConfig {
    pub id: String,
    pub name: String,
    pub path: String,
    pub remote_url: Option<String>,
}

pub(crate) fn list(app: &AppHandle) -> Result<Vec<RepoConfig>, AppError> {
    Ok(load_config(app)?.repos)
}

pub(crate) fn active_path(app: &AppHandle) -> Result<Option<String>, AppError> {
    Ok(active_path_cfg(&load_config(app)?))
}

pub(crate) fn register(
    app: &AppHandle,
    name: &str,
    path: &str,
    remote_url: Option<String>,
) -> Result<String, AppError> {
    let mut cfg = load_config(app)?;
    let id = register_cfg(&mut cfg, name, path, remote_url);
    save_config(app, &cfg)?;
    Ok(id)
}

pub(crate) fn rename(app: &AppHandle, id: &str, name: &str) -> Result<(), AppError> {
    let mut cfg = load_config(app)?;
    rename_cfg(&mut cfg, id, name)?;
    save_config(app, &cfg)
}

/// 移除仓库；返回移除后新的活动仓库路径（无仓库时返回 None）。
pub(crate) fn remove(app: &AppHandle, id: &str) -> Result<Option<String>, AppError> {
    let mut cfg = load_config(app)?;
    let active = remove_cfg(&mut cfg, id)?;
    save_config(app, &cfg)?;
    Ok(active)
}

/// 切换活动仓库；返回新活动仓库路径。
pub(crate) fn switch_to(app: &AppHandle, id: &str) -> Result<String, AppError> {
    let mut cfg = load_config(app)?;
    let path = switch_cfg(&mut cfg, id)?;
    save_config(app, &cfg)?;
    Ok(path)
}

// ---- 纯逻辑（可单测）----

pub(crate) fn active_cfg(cfg: &AppConfig) -> Option<&RepoConfig> {
    let id = cfg.active_repo_id.as_deref()?;
    cfg.repos.iter().find(|r| r.id == id)
}

pub(crate) fn active_path_cfg(cfg: &AppConfig) -> Option<String> {
    active_cfg(cfg).map(|r| r.path.clone())
}

pub(crate) fn register_cfg(
    cfg: &mut AppConfig,
    name: &str,
    path: &str,
    remote_url: Option<String>,
) -> String {
    let id = path.to_string();
    let is_first = cfg.repos.is_empty();
    cfg.repos.push(RepoConfig {
        id: id.clone(),
        name: name.to_string(),
        path: path.to_string(),
        remote_url,
    });
    if is_first {
        cfg.active_repo_id = Some(id.clone());
    }
    id
}

pub(crate) fn rename_cfg(cfg: &mut AppConfig, id: &str, name: &str) -> Result<(), AppError> {
    let repo = cfg
        .repos
        .iter_mut()
        .find(|r| r.id == id)
        .ok_or_else(|| AppError::Repo("未找到该笔记仓库".into()))?;
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::Repo("仓库名称不能为空".into()));
    }
    repo.name = name.to_string();
    Ok(())
}

/// 移除仓库；若移除的是活动仓库则切换到剩余第一个，无仓库则活动为 None。
pub(crate) fn remove_cfg(cfg: &mut AppConfig, id: &str) -> Result<Option<String>, AppError> {
    let index = cfg
        .repos
        .iter()
        .position(|r| r.id == id)
        .ok_or_else(|| AppError::Repo("未找到该笔记仓库".into()))?;
    cfg.repos.remove(index);
    if cfg.active_repo_id.as_deref() == Some(id) {
        cfg.active_repo_id = cfg.repos.first().map(|r| r.id.clone());
    }
    Ok(active_path_cfg(cfg))
}

pub(crate) fn switch_cfg(cfg: &mut AppConfig, id: &str) -> Result<String, AppError> {
    let repo = cfg
        .repos
        .iter()
        .find(|r| r.id == id)
        .ok_or_else(|| AppError::Repo("未找到该笔记仓库".into()))?;
    let path = repo.path.clone();
    cfg.active_repo_id = Some(id.to_string());
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg() -> AppConfig {
        let mut cfg = AppConfig::default();
        register_cfg(&mut cfg, "工作", "/a/work", Some("https://github.com/u/work.git".into()));
        register_cfg(&mut cfg, "生活", "/b/life", None);
        cfg
    }
    #[test]
    fn first_registered_becomes_active() {
        let mut cfg = AppConfig::default();
        let id = register_cfg(&mut cfg, "notes", "/p/notes", None);
        assert_eq!(cfg.active_repo_id.as_deref(), Some(id.as_str()));
    }
    #[test]
    fn later_registrations_do_not_steal_active() {
        let mut cfg = cfg();
        register_cfg(&mut cfg, "新", "/c/new", None);
        assert_eq!(active_path_cfg(&cfg).as_deref(), Some("/a/work"));
    }
    #[test]
    fn switch_changes_active_path() {
        let mut cfg = cfg();
        assert_eq!(switch_cfg(&mut cfg, "/b/life").unwrap(), "/b/life");
        assert_eq!(active_path_cfg(&cfg).as_deref(), Some("/b/life"));
    }
    #[test]
    fn switch_unknown_repo_errors() {
        assert!(switch_cfg(&mut cfg(), "/nope").is_err());
    }
    #[test]
    fn rename_updates_name_and_rejects_blank() {
        let mut cfg = cfg();
        rename_cfg(&mut cfg, "/a/work", "  研发  ").unwrap();
        assert_eq!(cfg.repos[0].name, "研发");
        assert!(rename_cfg(&mut cfg, "/a/work", "  ").is_err());
        assert!(rename_cfg(&mut cfg, "/nope", "x").is_err());
    }
    #[test]
    fn remove_non_active_keeps_active() {
        let mut cfg = cfg();
        let active = remove_cfg(&mut cfg, "/b/life").unwrap();
        assert_eq!(active.as_deref(), Some("/a/work"));
        assert_eq!(cfg.repos.len(), 1);
    }
    #[test]
    fn remove_active_falls_back_to_first() {
        let mut cfg = cfg();
        let active = remove_cfg(&mut cfg, "/a/work").unwrap();
        assert_eq!(active.as_deref(), Some("/b/life"));
        assert_eq!(cfg.active_repo_id.as_deref(), Some("/b/life"));
    }
    #[test]
    fn remove_last_repo_yields_none() {
        let mut cfg = cfg();
        remove_cfg(&mut cfg, "/a/work").unwrap();
        assert_eq!(remove_cfg(&mut cfg, "/b/life").unwrap(), None);
        assert_eq!(cfg.active_repo_id, None);
    }
    #[test]
    fn remove_unknown_repo_errors() {
        assert!(remove_cfg(&mut cfg(), "/nope").is_err());
    }
}
