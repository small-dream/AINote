use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager};

use crate::domain::error::{AppError, AppErrorDto};

/// 退出确认守卫：`confirm_close` 后放行一次窗口关闭请求。
/// 未确认的关闭请求若存在待保存变更（Git 未提交或未落盘草稿），
/// 由 on_window_event 拦截并通知前端弹确认框。
#[derive(Default)]
pub struct CloseGuard(AtomicBool);

impl CloseGuard {
    /// 放行下一次关闭请求（用户已在确认框选择退出）。
    pub fn allow(&self) {
        self.0.store(true, Ordering::SeqCst);
    }

    /// 取走放行标记；返回 true 表示本次关闭请求应直接放行。
    #[cfg(desktop)]
    pub fn take_allow(&self) -> bool {
        self.0.swap(false, Ordering::SeqCst)
    }
}

/// 前端编辑器草稿状态：前端在「有 / 无未落盘草稿」切换时上报。
/// Git 干净但编辑器里仍有未落盘草稿时，仅靠 git status 无法拦截关闭，会静默丢稿。
#[derive(Default)]
pub struct DraftState(AtomicBool);

impl DraftState {
    pub fn set(&self, dirty: bool) {
        self.0.store(dirty, Ordering::SeqCst);
    }

    /// 当前是否存在未落盘草稿。
    #[cfg_attr(not(desktop), allow(dead_code))]
    pub fn get(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

/// 纯逻辑：关闭请求是否应被拦截（未放行且存在待保存变更）。
#[cfg(desktop)]
pub fn should_intercept(allow_close: bool, has_pending_changes: bool) -> bool {
    !allow_close && has_pending_changes
}

/// Controller：上报编辑器是否存在未落盘草稿（前端在 dirty 变化时调用）。
#[tauri::command]
pub fn set_draft_dirty(app: AppHandle, dirty: bool) -> Result<(), AppErrorDto> {
    app.state::<DraftState>().set(dirty);
    Ok(())
}

/// Controller：用户确认退出 —— 放行关闭并请求关闭主窗口。
#[tauri::command]
pub async fn confirm_close(app: AppHandle) -> Result<(), AppErrorDto> {
    app.state::<CloseGuard>().allow();
    if let Some(window) = app.get_webview_window("main") {
        window
            .close()
            .map_err(|error| AppErrorDto::from(AppError::Io(format!("关闭窗口失败: {error}"))))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn intercepts_only_when_not_allowed_and_uncommitted() {
        assert!(should_intercept(false, true));
        assert!(!should_intercept(false, false));
        assert!(!should_intercept(true, true), "已放行则不再拦截");
        assert!(!should_intercept(true, false));
    }

    #[test]
    fn draft_state_tracks_frontend_draft() {
        let draft = DraftState::default();
        assert!(!draft.get(), "默认无未落盘草稿");
        draft.set(true);
        assert!(draft.get());
        draft.set(false);
        assert!(!draft.get());
    }

    #[test]
    fn allow_takes_single_close_request() {
        let guard = CloseGuard::default();
        assert!(!guard.take_allow());
        guard.allow();
        assert!(guard.take_allow());
        assert!(!guard.take_allow(), "放行标记一次性");
    }
}
