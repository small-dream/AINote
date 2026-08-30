// 库入口：模块声明与应用启动（Tauri 2 移动端需要 lib 形式）
mod commands;
mod domain;
mod repositories;
mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::note::list::list_notes,
            commands::repo::validate::validate_repo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MyNote");
}
