use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager};

use crate::domain::error::AppErrorDto;

/// 退出确认守卫：`confirm_close` 后放行一次退出请求。
/// 未确认的退出请求若存在待保存变更（Git 未提交或未落盘草稿），
/// 由 `platform::tray` 的窗口 / 退出事件拦下并通知前端弹确认框。
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

/// 是否存在待保存变更：Git 工作区未提交，或编辑器里仍有未落盘草稿。
/// 未落盘草稿还没写进工作区，`git status` 看不到，因此需叠加前端的 `set_draft_dirty` 上报。
#[cfg(desktop)]
pub fn has_pending_changes(app: &AppHandle) -> bool {
    use crate::repositories::git_backend::GitBackend;

    let has_uncommitted = crate::config::load_repo_path(app)
        .ok()
        .flatten()
        .and_then(|path| {
            crate::repositories::git2_backend::Git2Backend
                .has_uncommitted(&path)
                .ok()
        })
        .unwrap_or(false);
    has_uncommitted || app.state::<DraftState>().get()
}

/// Controller：上报编辑器是否存在未落盘草稿（前端在 dirty 变化时调用）。
#[tauri::command]
pub fn set_draft_dirty(app: AppHandle, dirty: bool) -> Result<(), AppErrorDto> {
    app.state::<DraftState>().set(dirty);
    Ok(())
}

/// Controller：用户确认退出 —— 放行退出并请求退出应用（窗口此时是隐藏到托盘的，不再走关闭窗口）。
#[tauri::command]
pub async fn confirm_close(app: AppHandle) -> Result<(), AppErrorDto> {
    app.state::<CloseGuard>().allow();
    app.exit(0);
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
