use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

use crate::commands::blocking;
use crate::config;
use crate::domain::backup::{BackupExportDto, BackupProgressDto};
use crate::domain::error::{AppError, AppErrorDto};
use crate::services::backup_service::{self, BackupOptions};

/// 当前进行中的备份取消标志；同时只允许一个备份任务。
#[derive(Default)]
pub struct BackupState(Mutex<Option<Arc<AtomicBool>>>);

impl BackupState {
    fn set(&self, flag: Option<Arc<AtomicBool>>) -> Result<(), AppError> {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| AppError::Io("备份状态锁不可用".into()))?;
        *guard = flag;
        Ok(())
    }

    fn current(&self) -> Option<Arc<AtomicBool>> {
        self.0.lock().ok().and_then(|guard| guard.clone())
    }
}

/// Controller：弹出保存对话框并把当前仓库整库备份为 zip。
/// 用户取消保存或中途取消时返回 `None`，不视为错误。
#[tauri::command]
pub async fn export_repo_backup(
    app: AppHandle,
    exclude_assets: bool,
    on_event: Channel<BackupProgressDto>,
) -> Result<Option<BackupExportDto>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let Some(dest) = choose_destination(app.clone(), &root).await? else {
        return Ok(None);
    };

    let cancel = Arc::new(AtomicBool::new(false));
    app.state::<BackupState>()
        .set(Some(cancel.clone()))
        .map_err(AppErrorDto::from)?;

    let result = blocking::run(move || {
        let options = BackupOptions { exclude_assets };
        backup_service::export(&root, &dest, &options, &cancel, |progress| {
            let _ = on_event.send(progress);
        })
    })
    .await
    .map_err(AppErrorDto::from);

    let _ = app.state::<BackupState>().set(None);
    result
}

/// Controller：请求取消进行中的备份；无任务时静默成功。
#[tauri::command]
pub fn cancel_repo_backup(app: AppHandle) -> Result<(), AppErrorDto> {
    if let Some(flag) = app.state::<BackupState>().current() {
        flag.store(true, Ordering::SeqCst);
    }
    Ok(())
}

async fn choose_destination(app: AppHandle, root: &Path) -> Result<Option<PathBuf>, AppErrorDto> {
    let file_name = format!("ainote-backup-{}.zip", repo_name(root));
    blocking::run(move || {
        app.dialog()
            .file()
            .set_file_name(file_name)
            .add_filter("ZIP", &["zip"])
            .blocking_save_file()
            .map(|file| file.into_path())
            .transpose()
            .map_err(|err| AppError::Io(err.to_string()))
    })
    .await
    .map_err(AppErrorDto::from)
}

fn repo_name(root: &Path) -> String {
    root.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "notes".into())
}
