use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::save_file;
use crate::config;
use crate::domain::error::{AppError, AppErrorDto};
use crate::domain::metrics::{MetricEvent, MetricsDto, MetricsExportDto};
use crate::services::metrics_service::{self, MetricsFormat, MetricsStore};

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

/// Controller：导出本机指标为 JSON / CSV；用户取消保存时返回 None。
#[tauri::command]
pub async fn metrics_export(
    app: AppHandle,
    format: String,
) -> Result<Option<MetricsExportDto>, AppErrorDto> {
    let Some(format) = MetricsFormat::parse(&format) else {
        return Err(AppErrorDto::from(AppError::Io("不支持的导出格式".into())));
    };
    let file_name = format!(
        "ainote-metrics-{}.{}",
        env!("CARGO_PKG_VERSION"),
        format.extension()
    );
    let Some(dest) = save_file::choose_destination(
        app.clone(),
        file_name,
        format.filter_name(),
        format.extensions(),
    )
    .await?
    else {
        return Ok(None);
    };

    blocking::run(move || {
        let enabled = config::metrics_enabled(&app)?;
        metrics_service::export(&MetricsStore::from_app(&app)?, &dest, format, enabled)
    })
    .await
    .map(Some)
    .map_err(AppErrorDto::from)
}
