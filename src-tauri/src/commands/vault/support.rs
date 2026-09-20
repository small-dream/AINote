//! vault 命令共用的编排：把设备级快速解锁状态并入返回给前端的响应。
//! 设备条目名来自仓库路径，标记文件落在应用配置目录，因此两个路径都要在这里给出。

use std::path::Path;

use tauri::{AppHandle, Manager};

use crate::domain::error::AppError;
use crate::domain::vault::{VaultStatus, VaultStatusResponse};
use crate::platform::quick_unlock;
use crate::services::quick_unlock_service::{self, QuickUnlockContext};

/// 设备条目上下文：配置目录（设备侧标记） + 仓库路径（条目名来源）。
pub(crate) fn context(app: &AppHandle, root: &Path) -> Result<QuickUnlockContext, AppError> {
    let config_root = app
        .path()
        .app_config_dir()
        .map_err(|err| AppError::Io(err.to_string()))?;
    Ok(QuickUnlockContext::new(config_root, root))
}

/// 组装响应：状态查询与全部 vault 变更命令共用同一形状，前端只需一份类型。
/// 状态查询只读标记文件与平台能力，不会触发系统认证弹窗。
pub(crate) fn respond(context: &QuickUnlockContext, status: VaultStatus) -> VaultStatusResponse {
    VaultStatusResponse::new(
        status,
        quick_unlock_service::status(context, quick_unlock::store()),
    )
}
