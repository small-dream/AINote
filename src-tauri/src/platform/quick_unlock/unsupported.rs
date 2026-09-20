//! Windows / Linux 及未覆盖平台：明确不支持设备级快速解锁。
//!
//! 不做「用凭据管理器 / Secret Service 存主密钥」的降级：那既没有设备级门禁，
//! 又把主密钥放进一个用户无法在应用内关闭的位置。

use crate::domain::error::AppError;
use crate::platform::quick_unlock::{DeviceKeyStore, DeviceSupport};

pub(super) struct UnsupportedDeviceKeyStore;

impl UnsupportedDeviceKeyStore {
    pub(super) fn new() -> Self {
        Self
    }
}

fn unavailable(action: &str) -> AppError {
    AppError::VaultQuickUnlockUnavailable(format!(
        "当前系统不支持设备级快速解锁（{action}），请使用仓库口令解锁"
    ))
}

impl DeviceKeyStore for UnsupportedDeviceKeyStore {
    fn support(&self) -> DeviceSupport {
        DeviceSupport::unavailable()
    }

    fn store(&self, _account: &str, _payload: &str) -> Result<(), AppError> {
        Err(unavailable("写入"))
    }

    fn load(&self, _account: &str, _reason: &str) -> Result<String, AppError> {
        Err(unavailable("读取"))
    }

    fn delete(&self, _account: &str) -> Result<(), AppError> {
        Ok(())
    }
}
