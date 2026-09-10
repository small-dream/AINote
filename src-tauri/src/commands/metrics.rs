use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::error::AppErrorDto;
use crate::domain::metrics::{MetricEvent, MetricsDto};
use crate::services::metrics_service::MetricsStore;

/// Controller：读取本机指标快照（事件计数 + 近 7 天活跃天数与同步成功率）。
#[tauri::command]
pub async fn metrics_read(app: AppHandle) -> Result<MetricsDto, AppErrorDto> {
    blocking::run(move || MetricsStore::from_app(&app)?.dto())
        .await
        .map_err(AppErrorDto::from)
}

/// Controller：记录一次白名单事件；未知事件名忽略（返回成功，避免前端埋点报错）。
#[tauri::command]
pub async fn metrics_record(app: AppHandle, event: String) -> Result<(), AppErrorDto> {
    let Some(event) = MetricEvent::parse(&event) else {
        log::warn!(target: "ainote::metrics", "忽略未登记的事件名");
        return Ok(());
    };
    blocking::run(move || MetricsStore::from_app(&app)?.record(event))
        .await
        .map_err(AppErrorDto::from)
}

/// Controller：清空本机指标（用户主动操作）。
#[tauri::command]
pub async fn metrics_clear(app: AppHandle) -> Result<(), AppErrorDto> {
    blocking::run(move || MetricsStore::from_app(&app)?.clear())
        .await
        .map_err(AppErrorDto::from)
}
