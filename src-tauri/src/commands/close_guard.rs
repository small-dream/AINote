use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager};

use crate::domain::error::{AppError, AppErrorDto};

/// 退出确认守卫：`confirm_close` 后放行一次窗口关闭请求。
/// 未确认的关闭请求若存在未提交变更，由 on_window_event 拦截并通知前端弹确认框。
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

/// 纯逻辑：关闭请求是否应被拦截（未放行且存在未提交变更）。
#[cfg(desktop)]
pub fn should_intercept(allow_close: bool, has_uncommitted: bool) -> bool {
    !allow_close && has_uncommitted
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
    fn allow_takes_single_close_request() {
        let guard = CloseGuard::default();
        assert!(!guard.take_allow());
        guard.allow();
        assert!(guard.take_allow());
        assert!(!guard.take_allow(), "放行标记一次性");
    }
}
