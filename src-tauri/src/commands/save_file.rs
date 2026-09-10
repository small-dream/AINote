use std::path::PathBuf;

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::commands::blocking;
use crate::domain::error::{AppError, AppErrorDto};

/// 弹出系统保存对话框；用户取消时返回 `None`（不视为错误）。
/// 诊断包与指标导出共用，保证「用户主动选择位置」这一行为在两端一致。
pub(crate) async fn choose_destination(
    app: AppHandle,
    file_name: String,
    filter_name: &'static str,
    extensions: &'static [&'static str],
) -> Result<Option<PathBuf>, AppErrorDto> {
    blocking::run(move || {
        app.dialog()
            .file()
            .set_file_name(file_name)
            .add_filter(filter_name, extensions)
            .blocking_save_file()
            .map(|file| file.into_path())
            .transpose()
            .map_err(|err| AppError::Io(err.to_string()))
    })
    .await
    .map_err(AppErrorDto::from)
}
