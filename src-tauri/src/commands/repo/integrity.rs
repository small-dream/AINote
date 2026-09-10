use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::maintenance::IntegrityReport;
use crate::repositories::git2_maintenance::Git2Maintenance;
use crate::services::maintenance_service;

/// Controller：对当前活动仓库做只读完整性检查。
#[tauri::command]
pub async fn check_repo_integrity(app: AppHandle) -> Result<IntegrityReport, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || maintenance_service::check(&Git2Maintenance, &root))
        .await
        .map_err(AppErrorDto::from)
}
