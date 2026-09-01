use tauri::command;

/// 使用系统默认程序打开外部 URL。
/// 禁止用于仓库内部路径或潜在文件路径；仅用于 http/https 链接。
#[command]
pub fn open_external(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(format!("unsupported url scheme: {url}"));
    }
    opener::open(&url).map_err(|err| err.to_string())
}
