use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::commands::blocking;
use crate::config;
use crate::domain::diagnostics::SupportInfoDto;
use crate::domain::error::{AppError, AppErrorDto};

/// Controller：设置页「诊断与反馈」的运行信息（日志目录、开关、占用）。
#[tauri::command]
pub async fn support_info(app: AppHandle) -> Result<SupportInfoDto, AppErrorDto> {
    let log_dir = log_dir(&app)?;
    let logging_enabled = config::logging_enabled(&app)?;
    let dir_for_size = log_dir.clone();
    let log_bytes = blocking::run(move || Ok(dir_size(&dir_for_size)))
        .await
        .map_err(AppErrorDto::from)?;
    Ok(SupportInfoDto {
        log_dir: log_dir.to_string_lossy().into_owned(),
        logging_enabled,
        log_bytes,
    })
}

/// Controller：持久化日志开关并立即生效（无需重启）。
#[tauri::command]
pub async fn set_logging_enabled(app: AppHandle, enabled: bool) -> Result<(), AppErrorDto> {
    config::set_logging_enabled(&app, enabled)?;
    log::set_max_level(if enabled {
        log::LevelFilter::Info
    } else {
        log::LevelFilter::Off
    });
    Ok(())
}

/// Controller：清理本地日志，返回释放的字节数。
#[tauri::command]
pub async fn clear_logs(app: AppHandle) -> Result<u64, AppErrorDto> {
    let log_dir = log_dir(&app)?;
    blocking::run(move || clear_log_files(&log_dir))
        .await
        .map_err(AppErrorDto::from)
}

fn log_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .app_log_dir()
        .map_err(|err| AppError::Io(err.to_string()))
}

fn dir_size(dir: &Path) -> u64 {
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(|entry| entry.ok())
                .filter_map(|entry| entry.metadata().ok())
                .filter(|metadata| metadata.is_file())
                .map(|metadata| metadata.len())
                .sum()
        })
        .unwrap_or(0)
}

/// 只删除日志目录内以 `ainote` 开头的日志文件；被占用的文件跳过，不影响其余清理。
fn clear_log_files(dir: &Path) -> Result<u64, AppError> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Ok(0);
    };
    let mut freed = 0;
    for entry in entries.filter_map(|entry| entry.ok()) {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !is_log_file(&name) {
            continue;
        }
        let path = entry.path();
        let size = entry.metadata().map(|metadata| metadata.len()).unwrap_or(0);
        match fs::remove_file(&path) {
            Ok(()) => freed += size,
            Err(err) => log::warn!(
                target: "ainote::support",
                "清理日志失败 file={name} error={err}"
            ),
        }
    }
    Ok(freed)
}

fn is_log_file(name: &str) -> bool {
    name.starts_with("ainote") && (name.ends_with(".log") || name.ends_with(".log.bak"))
}

#[cfg(test)]
mod tests {
    use std::fs::File;
    use std::io::Write;

    use tempfile::tempdir;

    use super::*;

    fn write_file(path: &Path, contents: &[u8]) {
        let mut file = File::create(path).unwrap();
        file.write_all(contents).unwrap();
    }

    #[test]
    fn clears_only_app_log_files() {
        let tmp = tempdir().unwrap();
        write_file(&tmp.path().join("ainote.log"), b"1234");
        write_file(&tmp.path().join("ainote_2026-09-10.log"), b"12");
        write_file(&tmp.path().join("other.log"), b"keep");
        write_file(&tmp.path().join("notes.md"), b"keep");

        let freed = clear_log_files(tmp.path()).unwrap();
        assert_eq!(freed, 6);
        assert!(tmp.path().join("other.log").is_file());
        assert!(tmp.path().join("notes.md").is_file());
        assert!(!tmp.path().join("ainote.log").exists());
    }

    #[test]
    fn missing_directory_is_noop() {
        let tmp = tempdir().unwrap();
        assert_eq!(clear_log_files(&tmp.path().join("missing")).unwrap(), 0);
    }

    #[test]
    fn matches_log_file_names() {
        assert!(is_log_file("ainote.log"));
        assert!(is_log_file("ainote_2026-09-10.log"));
        assert!(is_log_file("ainote.log.bak"));
        assert!(!is_log_file("other.log"));
        assert!(!is_log_file("ainote.md"));
    }
}
