// 桌面端入口：仅转发到库入口
// Release 构建使用 Windows GUI 子系统，避免启动时弹出命令行窗口；debug 构建保留控制台便于查看日志
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ainote_core_lib::run()
}
