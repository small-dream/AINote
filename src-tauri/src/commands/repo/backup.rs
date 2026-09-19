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
/// 必须走 acquire/release：无条件覆盖会让先完成的备份清掉后者的取消标志。
#[derive(Default)]
pub struct BackupState(Mutex<Option<Arc<AtomicBool>>>);

impl BackupState {
    /// 抢占备份槽位并返回取消标志；已有备份进行中时拒绝重入（REPO_3003）。
    fn acquire(&self) -> Result<Arc<AtomicBool>, AppError> {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| AppError::Io("备份状态锁不可用".into()))?;
        if guard.is_some() {
            return Err(AppError::BackupBusy("已有备份任务进行中，请稍后再试".into()));
        }
        let flag = Arc::new(AtomicBool::new(false));
        *guard = Some(flag.clone());
        Ok(flag)
    }

    /// 任务结束释放槽位：只有槽位里仍是自己的 flag 才清理，
    /// 避免先完成者把仍在备份任务的取消标志清掉。
    fn release(&self, flag: &Arc<AtomicBool>) {
        if let Ok(mut guard) = self.0.lock() {
            if guard.as_ref().is_some_and(|current| Arc::ptr_eq(current, flag)) {
                *guard = None;
            }
        }
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

    let cancel = app
        .state::<BackupState>()
        .acquire()
        .map_err(AppErrorDto::from)?;
    let slot = cancel.clone();

    let result = blocking::run(move || {
        let options = BackupOptions { exclude_assets };
        backup_service::export(&root, &dest, &options, &cancel, |progress| {
            let _ = on_event.send(progress);
        })
    })
    .await
    .map_err(AppErrorDto::from);

    app.state::<BackupState>().release(&slot);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acquire_rejects_reentry_and_release_frees_slot() {
        let state = BackupState::default();
        let first = state.acquire().unwrap();
        let err = state.acquire().unwrap_err();
        assert!(matches!(err, AppError::BackupBusy(_)), "备份中重入被拒");
        let dto = AppErrorDto::from(err);
        assert_eq!(dto.code, "REPO_3003");
        state.release(&first);
        assert!(state.acquire().is_ok(), "释放后可再次备份");
    }

    #[test]
    fn release_only_clears_own_flag() {
        let state = BackupState::default();
        let current = state.acquire().unwrap();
        let stale = Arc::new(AtomicBool::new(false));
        state.release(&stale);
        assert!(state.acquire().is_err(), "别人的 flag 不得清理槽位");
        assert!(state.current().is_some_and(|f| Arc::ptr_eq(&f, &current)),
            "取消标志仍归属当前任务");
        state.release(&current);
        assert!(state.current().is_none());
    }
}
