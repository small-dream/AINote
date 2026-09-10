// 库入口：模块声明与应用启动（Tauri 2 移动端需要 lib 形式）
//
// 说明：Command 统一把 git2 / ureq / 本地加密文件 IO 放到后台线程执行，避免阻塞前端。
mod commands;
mod config;
mod domain;
mod repositories;
mod services;

#[cfg(test)]
mod perf_baseline;

pub use services::auth_store::AuthStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(config::logging::plugin())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_keyring_store::Builder::new()
                .service("dev.ainote.app.credentials")
                .build(),
        )
        .manage(commands::repo::backup::BackupState::default())
        .setup(|_app| {
            apply_logging_preference(_app.handle());
            log::info!(target: "ainote::startup", "AINote {} 启动", env!("CARGO_PKG_VERSION"));
            #[cfg(desktop)]
            {
                _app.handle().plugin(tauri_plugin_process::init())?;
                _app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            #[cfg(target_os = "android")]
            {
                use tauri::Manager;
                match _app.path().app_cache_dir() {
                    Ok(dir) => repositories::ca_bundle::set_bundle_dir(dir),
                    Err(error) => {
                        eprintln!("[ainote] 无法解析应用 cache 目录，HTTPS 证书校验将失败: {error}")
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ai::config::ai_get_config,
            commands::ai::config::ai_save_config,
            commands::ai::generate::ai_generate,
            commands::ai::generate_stream::ai_generate_stream,
            commands::ai::models::ai_fetch_models,
            commands::ai::chat::ai_chat,
            commands::ai::chat_stream::ai_chat_stream,
            commands::note::create::create_note,
            commands::note::import::import_note,
            commands::note::convert::convert_note,
            commands::note::create_folder::create_folder,
            commands::note::read::read_note,
            commands::note::update::update_note,
            commands::note::delete::delete_note,
            commands::note::delete_folder::delete_folder,
            commands::note::r#move::move_note,
            commands::note::tree::note_tree,
            commands::note::list::list_notes,
            commands::note::favorites_list::list_favorite_notes,
            commands::note::toggle_favorite::toggle_note_favorite,
            commands::note::search::search_notes,
            commands::note::wiki::wiki_index,
            commands::git::commit::git_commit,
            commands::git::pull::git_pull,
            commands::git::push::git_push,
            commands::git::status::sync_status,
            commands::git::sync::sync_now,
            commands::git::resolve::resolve_conflict,
            commands::git::conflicts::list_conflicts,
            commands::git::resolve_file::resolve_file_conflict,
            commands::git::history::git_file_history,
            commands::git::diff::git_file_diff,
            commands::git::restore::git_restore_file,
            commands::repo::bind::bind_repo,
            commands::repo::create::create_repo,
            commands::repo::backup::export_repo_backup,
            commands::repo::backup::cancel_repo_backup,
            commands::repo::restore::restore_repo_backup,
            commands::repo::integrity::check_repo_integrity,
            commands::repo::list::list_repos,
            commands::repo::rename::rename_repo,
            commands::repo::remove::remove_repo,
            commands::repo::size::get_repo_size,
            commands::repo::switch::switch_repo,
            commands::repo::validate::validate_repo,
            commands::trash::list::trash_list,
            commands::trash::restore::trash_restore,
            commands::trash::delete::trash_delete,
            commands::trash::empty::trash_empty,
            commands::repo::path::get_repo_path,
            commands::auth::save_token::save_token,
            commands::auth::validate::validate_token,
            commands::auth::status::auth_status,
            commands::auth::logout::logout,
            commands::asset::exists::asset_exists,
            commands::asset::import::import_asset,
            commands::asset::import_bytes::import_asset_bytes,
            commands::app::open_external,
            commands::print::print_current_page,
            commands::support::log_frontend::log_frontend,
            commands::support::export::export_diagnostics,
            commands::support::settings::support_info,
            commands::support::settings::set_logging_enabled,
            commands::support::settings::clear_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AINote");
}

/// 启动时应用用户保存的日志开关；读取失败保持默认开启。
fn apply_logging_preference(app: &tauri::AppHandle) {
    if let Ok(enabled) = config::logging_enabled(app) {
        log::set_max_level(if enabled {
            log::LevelFilter::Info
        } else {
            log::LevelFilter::Off
        });
    }
}
