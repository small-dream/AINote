//! MCP 服务端（桌面端）。
//!
//! 本模块是入站适配器：协议与工具逻辑尽量保持纯函数（`protocol` / `tools`），
//! 生命周期、HTTP 与 Tauri 集成在桌面端实现；移动端只保留可编译的 stub。

pub mod protocol;
pub mod tools;

#[cfg(desktop)]
mod dispatch;
#[cfg(desktop)]
mod executor;
#[cfg(desktop)]
mod http;
#[cfg(desktop)]
mod server;
mod token;

#[cfg(desktop)]
mod desktop;
#[cfg(desktop)]
pub use desktop::{
    rotate_token, set_enabled, set_port, shutdown, start_if_enabled, status, McpState,
};

#[cfg(not(desktop))]
mod unsupported;
#[cfg(not(desktop))]
pub use unsupported::{
    rotate_token, set_enabled, set_port, shutdown, start_if_enabled, status, McpState,
};
