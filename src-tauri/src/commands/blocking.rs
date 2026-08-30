use crate::domain::error::AppError;

pub async fn run<T>(
    task: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError>
where
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|e| AppError::Io(format!("后台任务失败: {e}")))?
}
