// 库入口：模块声明与应用启动（Tauri 2 移动端需要 lib 形式）
//
// 说明：Command 均为同步实现（git2 / ureq / keyring 均为阻塞 API）。
// 按任务约束采用简单方案：同步 command 直接阻塞调用，单次操作（本地 Git / 小文件 IO /
// 短超时 HTTP）耗时可控；后续若出现长耗时操作，可改为 async command + spawn_blocking。
mod commands;
mod config;
mod domain;
mod repositories;
mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::note::create::create_note,
            commands::note::read::read_note,
            commands::note::update::update_note,
            commands::note::delete::delete_note,
            commands::note::r#move::move_note,
            commands::note::tree::note_tree,
            commands::note::list::list_notes,
            commands::git::commit::git_commit,
            commands::git::pull::git_pull,
            commands::git::push::git_push,
            commands::git::status::sync_status,
            commands::git::sync::sync_now,
            commands::git::resolve::resolve_conflict,
            commands::repo::bind::bind_repo,
            commands::repo::create::create_repo,
            commands::repo::validate::validate_repo,
            commands::repo::path::get_repo_path,
            commands::auth::save_token::save_token,
            commands::auth::validate::validate_token,
            commands::auth::status::auth_status,
            commands::auth::logout::logout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MyNote");
}
