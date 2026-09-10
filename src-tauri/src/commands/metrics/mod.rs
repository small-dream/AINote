//! 本机使用计数的 Controller：读写快照、白名单事件记录、开关与导出。

use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::metrics::{MetricEvent, MetricsDto};
use crate::services::metrics_service::{self, MetricsStore};

pub mod export;

/// Controller：读取本机指标快照（开关状态 + 事件计数 + 近 7 天活跃天数与同步成功率）。
#[tauri::command]
pub async fn metrics_read(app: AppHandle) -> Result<MetricsDto, AppErrorDto> {
    blocking::run(move || {
        let enabled = config::metrics_enabled(&app)?;
        MetricsStore::from_app(&app)?.dto(enabled)
    })
    .await
    .map_err(AppErrorDto::from)
}

/// Controller：记录一次白名单事件；开关关闭或事件名未登记时静默忽略。
#[tauri::command]
pub async fn metrics_record(app: AppHandle, event: String) -> Result<(), AppErrorDto> {
    let Some(event) = MetricEvent::parse(&event) else {
        log::warn!(target: "ainote::metrics", "忽略未登记的事件名");
        return Ok(());
    };
    blocking::run(move || {
        let enabled = config::metrics_enabled(&app)?;
        metrics_service::record_if_enabled(&MetricsStore::from_app(&app)?, enabled, event)
    })
    .await
    .map_err(AppErrorDto::from)
}

/// Controller：清空本机指标（用户主动操作，与开关无关）。
#[tauri::command]
pub async fn metrics_clear(app: AppHandle) -> Result<(), AppErrorDto> {
    blocking::run(move || MetricsStore::from_app(&app)?.clear())
        .await
        .map_err(AppErrorDto::from)
}

/// Controller：切换本地指标开关；关闭后立即停止写入。
#[tauri::command]
pub async fn metrics_set_enabled(app: AppHandle, enabled: bool) -> Result<(), AppErrorDto> {
    blocking::run(move || config::set_metrics_enabled(&app, enabled))
        .await
        .map_err(AppErrorDto::from)
}
