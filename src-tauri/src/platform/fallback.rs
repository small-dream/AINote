//! 非 Android 平台桩：应用内安装与原生打开链接仅 Android 可用。

use crate::domain::error::AppError;

fn unavailable() -> AppError {
    AppError::UpdateInstall("当前平台不支持应用内安装".into())
}

pub fn can_request_installs() -> Result<bool, AppError> {
    Err(unavailable())
}

pub fn open_install_settings() -> Result<(), AppError> {
    Err(unavailable())
}

pub fn install_apk(_path: &str) -> Result<(), AppError> {
    Err(unavailable())
}
