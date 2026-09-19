//! 仓库级写互斥：所有会写 index/refs 的命令（sync/pull/push/commit/resolve/reset 等）
//! 共用同一把锁。锁只加在 command 入口，service 内部不再加锁，命令之间不得互相调用。

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager};

use crate::domain::error::AppError;

/// 仓库写锁：以仓库路径为键的槽位表，槽位值兼作同步重试的取消标志（P2-2）。
/// 同一仓库同一时刻只允许一个写操作：占用期间第二个写命令立即返回 SYNC_4005，
/// 避免并发写落到同一 .git 后由 git2 的 index.lock 兜底产生偶发假错误，
/// 也避免两个 commit_all 交错把语义无关的变更打进同一提交。
/// 取消标志只结束同步的退避等待，不中断已经发出的网络请求；其它写操作不读标志。
#[derive(Default)]
pub struct RepoWriteLock(Mutex<HashMap<String, Arc<AtomicBool>>>);

impl RepoWriteLock {
    /// 抢占指定仓库的写槽位并返回其取消标志；已有进行中写操作时报「仓库操作进行中」。
    pub(crate) fn acquire(&self, repo: &str) -> Result<Arc<AtomicBool>, AppError> {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| AppError::Io("仓库写锁不可用".into()))?;
        if guard.contains_key(repo) {
            return Err(AppError::SyncBusy("仓库操作进行中，请稍后再试".into()));
        }
        let flag = Arc::new(AtomicBool::new(false));
        guard.insert(repo.to_string(), flag.clone());
        Ok(flag)
    }

    /// 任务结束释放槽位：只有槽位里仍是自己的 flag 才清理，避免误清后来的任务。
    pub(crate) fn release(&self, repo: &str, flag: &Arc<AtomicBool>) {
        if let Ok(mut guard) = self.0.lock() {
            if guard.get(repo).is_some_and(|current| Arc::ptr_eq(current, flag)) {
                guard.remove(repo);
            }
        }
    }

    /// 取消全部进行中的同步（前端取消按钮不区分仓库）；其它写操作忽略标志，不受影响。
    pub(crate) fn cancel_all(&self) {
        if let Ok(guard) = self.0.lock() {
            for flag in guard.values() {
                flag.store(true, Ordering::SeqCst);
            }
        }
    }
}

/// RAII 写槽位：command 入口获取，函数返回（含提前 return）即自动释放。
pub(crate) struct RepoWriteGuard {
    app: AppHandle,
    key: String,
    flag: Arc<AtomicBool>,
}

impl RepoWriteGuard {
    pub(crate) fn acquire(app: &AppHandle, key: String) -> Result<Self, AppError> {
        let flag = app.state::<RepoWriteLock>().acquire(&key)?;
        Ok(Self {
            app: app.clone(),
            key,
            flag,
        })
    }

    /// 同步重试的取消标志；其它写操作不需要取消，忽略即可。
    pub(crate) fn cancel_flag(&self) -> Arc<AtomicBool> {
        self.flag.clone()
    }
}

impl Drop for RepoWriteGuard {
    fn drop(&mut self) {
        self.app
            .state::<RepoWriteLock>()
            .release(&self.key, &self.flag);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::error::AppErrorDto;

    #[test]
    fn acquire_rejects_reentry_for_same_repo() {
        let state = RepoWriteLock::default();
        let first = state.acquire("/repo").unwrap();
        let err = state.acquire("/repo").unwrap_err();
        assert!(matches!(err, AppError::SyncBusy(_)), "同仓库重入被拒");
        assert!(state.acquire("/other").is_ok(), "不同仓库互不阻塞");
        state.release("/repo", &first);
        assert!(state.acquire("/repo").is_ok(), "释放后可再次进入");
    }

    #[test]
    fn busy_error_maps_to_sync_4005() {
        let state = RepoWriteLock::default();
        let _running = state.acquire("/repo").unwrap();
        let dto = AppErrorDto::from(state.acquire("/repo").unwrap_err());
        assert_eq!(dto.code, "SYNC_4005");
        assert!(dto.retriable);
    }

    #[test]
    fn release_only_clears_own_flag() {
        let state = RepoWriteLock::default();
        let current = state.acquire("/repo").unwrap();
        let stale = Arc::new(AtomicBool::new(false));
        state.release("/repo", &stale);
        assert!(state.acquire("/repo").is_err(), "别人的 flag 不得清理槽位");
        state.release("/repo", &current);
        assert!(state.acquire("/repo").is_ok());
    }

    #[test]
    fn cancel_all_marks_every_running_flag() {
        let state = RepoWriteLock::default();
        let a = state.acquire("/a").unwrap();
        let b = state.acquire("/b").unwrap();
        state.cancel_all();
        assert!(a.load(Ordering::SeqCst));
        assert!(b.load(Ordering::SeqCst));
    }

    #[test]
    fn concurrent_acquire_grants_exactly_one_slot() {
        let state = Arc::new(RepoWriteLock::default());
        let handles: Vec<_> = (0..8)
            .map(|_| {
                let state = state.clone();
                std::thread::spawn(move || state.acquire("/repo").is_ok())
            })
            .collect();
        let granted = handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .filter(|ok| *ok)
            .count();
        assert_eq!(granted, 1, "并发抢占只有一个获胜者");
        assert!(state.acquire("/repo").is_err(), "获胜者仍占用槽位");
    }
}
