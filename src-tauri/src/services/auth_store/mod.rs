//! 凭证存储：按托管平台分别保存访问令牌。
//!
//! 桌面端是 AES-256-GCM 加密文件（`auth.<平台>.token` + 共享密钥 `auth.key`，0600 权限），
//! 移动端是系统安全存储（iOS Keychain / Android Keystore）；前端永远拿不到明文。
//! 平台差异收敛在 backend（desktop / mobile），本文件只做编排与迁移策略。

use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::domain::error::AppError;
use crate::domain::hosting::{self, HostingProvider};

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[path = "desktop.rs"]
mod backend;
#[cfg(any(target_os = "ios", target_os = "android"))]
#[path = "mobile.rs"]
mod backend;

/// 按平台读写访问令牌；具体存储介质由平台后端决定。
#[derive(Debug, Clone)]
pub struct AuthStore {
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
        std::fs::create_dir_all(&root)?;
        Ok(Self::new(root))
    }

    /// 保存指定平台的令牌（覆盖旧值；桌面端顺带清理历史遗留文件）。
    pub fn save_token(&self, provider: HostingProvider, token: &str) -> Result<(), AppError> {
        backend::save(&self.root, provider.id(), token)
    }

    /// 读取指定平台的令牌；未登录或本地凭证失效返回 AUTH_2001。
    pub fn read_token(&self, provider: HostingProvider) -> Result<String, AppError> {
        backend::read(&self.root, provider.id())
    }

    /// 该平台是否已保存可用令牌。
    pub fn has_token(&self, provider: HostingProvider) -> Result<bool, AppError> {
        match self.read_token(provider) {
            Ok(_) => Ok(true),
            Err(AppError::Auth(_)) => Ok(false),
            Err(err) => Err(err),
        }
    }

    /// 删除指定平台的令牌（不影响其它平台，也不触碰仓库注册表）。
    pub fn delete_token(&self, provider: HostingProvider) -> Result<(), AppError> {
        backend::remove(&self.root, provider.id())
    }

    /// 删除全部平台令牌与共享密钥（登出）。
    pub fn delete_all(&self) -> Result<(), AppError> {
        for provider in hosting::ALL {
            self.delete_token(provider)?;
        }
        backend::remove_key(&self.root)
    }
}
