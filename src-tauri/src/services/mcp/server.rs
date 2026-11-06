//! MCP Streamable HTTP 传输：单个 `POST /mcp` 端点，返回 JSON（不使用 SSE）。
//!
//! 安全边界：只绑定 127.0.0.1；Bearer Token；校验 Origin/Host；限制 body 大小；
//! 请求串行处理；单请求 panic 被兜底，不终止服务线程。请求校验在 `http.rs`，
//! 方法分发在 `dispatch.rs`。

use std::panic::AssertUnwindSafe;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};
use std::time::Duration;

use tiny_http::{Request, Server};

use crate::domain::error::AppError;

use super::executor::ToolExecutor;
use super::http;
use super::protocol;

/// 运行中的服务句柄：停止标志 + 监听器 + 线程。
pub struct ServerHandle {
    stop: Arc<AtomicBool>,
    server: Arc<Server>,
    join: Option<std::thread::JoinHandle<()>>,
}

impl ServerHandle {
    pub fn is_alive(&self) -> bool {
        self.join.as_ref().is_some_and(|join| !join.is_finished())
    }

    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        self.server.unblock();
        if let Some(join) = self.join.take() {
            let _ = join.join();
        }
    }
}

/// 启动监听；绑定失败同步返回错误，便于 UI 直接展示端口占用。
pub fn start(
    port: u16,
    token: Arc<RwLock<Option<String>>>,
    executor: Arc<dyn ToolExecutor>,
) -> Result<ServerHandle, AppError> {
    let server = Server::http(("127.0.0.1", port)).map_err(|error| {
        AppError::Mcp(format!("无法监听 127.0.0.1:{port}（端口可能被占用）: {error}"))
    })?;
    let server = Arc::new(server);
    let stop = Arc::new(AtomicBool::new(false));
    let thread_server = server.clone();
    let thread_stop = stop.clone();
    let join = std::thread::Builder::new()
        .name("ainote-mcp".into())
        .spawn(move || run_loop(port, thread_server, token, executor, thread_stop))
        .map_err(|error| AppError::Mcp(format!("启动 MCP 服务线程失败: {error}")))?;
    Ok(ServerHandle {
        stop,
        server,
        join: Some(join),
    })
}

fn run_loop(
    port: u16,
    server: Arc<Server>,
    token: Arc<RwLock<Option<String>>>,
    executor: Arc<dyn ToolExecutor>,
    stop: Arc<AtomicBool>,
) {
    log::info!(target: "ainote::mcp", "MCP 服务已启动 port={port}");
    while !stop.load(Ordering::SeqCst) {
        match server.recv_timeout(Duration::from_millis(200)) {
            Ok(Some(request)) => handle_request(request, port, &token, &executor),
            Ok(None) => {}
            Err(error) => {
                if stop.load(Ordering::SeqCst) {
                    break;
                }
                log::warn!(target: "ainote::mcp", "MCP 接受请求失败: {error}");
                std::thread::sleep(Duration::from_millis(50));
            }
        }
    }
    log::info!(target: "ainote::mcp", "MCP 服务已停止 port={port}");
}

fn handle_request(
    mut request: Request,
    port: u16,
    token: &Arc<RwLock<Option<String>>>,
    executor: &Arc<dyn ToolExecutor>,
) {
    let outcome = std::panic::catch_unwind(AssertUnwindSafe(|| {
        http::build_response(&mut request, port, token, executor)
    }));
    let response = match outcome {
        Ok(response) => response,
        Err(_) => {
            log::error!(target: "ainote::mcp", "MCP 请求处理 panic，已返回内部错误");
            http::json_rpc_response(
                500,
                protocol::JsonRpcError::new(protocol::ERR_INTERNAL, "Internal error")
                    .to_value(None),
            )
        }
    };
    if let Err(error) = request.respond(response) {
        log::warn!(target: "ainote::mcp", "MCP 响应写回失败: {error}");
    }
}

#[cfg(test)]
#[path = "server_tests.rs"]
mod tests;
