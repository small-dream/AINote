//! 客户端配置的原子写：临时文件 + rename；Windows 冲突时先备份再替换。

use std::fs;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "配置文件没有父目录".to_string())?;
    fs::create_dir_all(parent).map_err(|err| format!("创建配置目录失败: {err}"))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| "配置文件没有文件名".to_string())?
        .to_string_lossy();
    let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let temp = parent.join(format!(
        ".{file_name}.ainote-{}-{sequence}.tmp",
        std::process::id()
    ));
    {
        let mut file =
            fs::File::create(&temp).map_err(|err| format!("创建临时配置失败: {err}"))?;
        if let Ok(metadata) = fs::metadata(path) {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = file.set_permissions(fs::Permissions::from_mode(
                    metadata.permissions().mode() & 0o777,
                ));
            }
            #[cfg(not(unix))]
            let _ = metadata;
        }
        file.write_all(bytes)
            .map_err(|err| format!("写入临时配置失败: {err}"))?;
        file.sync_all()
            .map_err(|err| format!("同步临时配置失败: {err}"))?;
    }
    if fs::rename(&temp, path).is_err() {
        // Windows 上目标被占用时 rename 可能失败：先备份目标，失败时恢复，避免丢配置。
        let backup = parent.join(format!(".{file_name}.ainote-bak"));
        let had_target = fs::rename(path, &backup).is_ok();
        match fs::rename(&temp, path) {
            Ok(()) => {
                if had_target {
                    let _ = fs::remove_file(&backup);
                }
                Ok(())
            }
            Err(err) => {
                if had_target {
                    let _ = fs::rename(&backup, path);
                }
                let _ = fs::remove_file(&temp);
                Err(format!("替换配置失败: {err}"))
            }
        }
    } else {
        Ok(())
    }
}
