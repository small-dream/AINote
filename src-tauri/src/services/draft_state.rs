//! 编辑器未落盘草稿状态：前端在 dirty 变化时上报，Rust 用于退出确认与 MCP 写入守卫。
//!
//! 放在 services 层是因为它同时被 commands（退出确认）与 MCP 服务端使用；
//! 只是一份进程内布尔状态，不依赖任何具体 UI 或 Git 实现。

use std::sync::atomic::{AtomicBool, Ordering};

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tracks_frontend_draft() {
        let draft = DraftState::default();
        assert!(!draft.get(), "默认无未落盘草稿");
        draft.set(true);
        assert!(draft.get());
        draft.set(false);
        assert!(!draft.get());
    }
}
