use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::save_file;
use crate::config;
use crate::domain::error::{AppError, AppErrorDto};
use crate::domain::metrics::MetricsExportDto;
use crate::services::metrics_service::{self, MetricsFormat, MetricsStore};

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
