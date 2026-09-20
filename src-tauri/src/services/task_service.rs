use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::task::{self, now_rfc3339, sort_tasks, TaskBoard, TaskItem, TaskPriority};
use crate::repositories::task_files;

/// 所有写用例统一走「读 → 改 → 原子写回」，避免各用例重复半写保护逻辑。
fn mutate_board<T>(
    root: &Path,
    mutate: impl FnOnce(&mut TaskBoard) -> Result<T, AppError>,
) -> Result<T, AppError> {
    let mut board = task_files::load(root)?;
    let result = mutate(&mut board)?;
    task_files::save(root, &board)?;
    Ok(result)
}

/// 与 `mutate_board` 相同，但允许用例声明「本次没有任何实际变更」，此时不落盘。
/// 内容一致的写入若照样刷新文件，工作区会凭空多出一次变更（多端同步时表现为无意义的合并冲突）。
fn mutate_board_if_changed<T>(
    root: &Path,
    mutate: impl FnOnce(&mut TaskBoard) -> Result<(T, bool), AppError>,
) -> Result<T, AppError> {
    let mut board = task_files::load(root)?;
    let (result, changed) = mutate(&mut board)?;
    if changed {
        task_files::save(root, &board)?;
    }
    Ok(result)
}

/// 用例：读取看板并按展示规则排序任务。
pub fn board(root: &Path) -> Result<TaskBoard, AppError> {
    let mut board = task_files::load(root)?;
    sort_tasks(&mut board.tasks);
    Ok(board)
}

/// 用例：新建任务，排在现有任务末尾。
pub fn create_task(
    root: &Path,
    title: &str,
    description: Option<String>,
    due_at: Option<String>,
    priority: TaskPriority,
    remind_at: Option<String>,
) -> Result<TaskItem, AppError> {
    let title = task::require_non_blank(title, "任务标题不能为空")?;
    task::validate_due_at(&due_at)?;
    task::validate_reminder(&due_at, &remind_at)?;
    mutate_board(root, |board| {
        let sort_order = board
            .tasks
            .iter()
            .map(|item| item.sort_order)
            .max()
            .map_or(0, |max| max + 1);
        let now = now_rfc3339();
        let item = TaskItem {
            id: task::new_task_id(),
            title,
            description: description.unwrap_or_default(),
            done: false,
            priority,
            due_at,
            remind_at,
            sort_order,
            created_at: now.clone(),
            updated_at: now,
            completed_at: None,
        };
        board.tasks.push(item.clone());
        Ok(item)
    })
}

/// 用例：全量更新任务可编辑字段（前端总是回传完整编辑态），内容确有变化时才刷新 updated_at 并落盘。
#[allow(clippy::too_many_arguments)]
pub fn update_task(
    root: &Path,
    task_id: &str,
    title: &str,
    description: Option<String>,
    due_at: Option<String>,
    priority: TaskPriority,
    remind_at: Option<String>,
) -> Result<TaskItem, AppError> {
    let title = task::require_non_blank(title, "任务标题不能为空")?;
    task::validate_due_at(&due_at)?;
    task::validate_reminder(&due_at, &remind_at)?;
    let description = description.unwrap_or_default();
    mutate_board_if_changed(root, |board| {
        let item = board
            .tasks
            .iter_mut()
            .find(|item| item.id == task_id)
            .ok_or_else(|| AppError::TaskNotFound(task_id.to_string()))?;
        // 提交内容与现状完全一致时不推进 updated_at：前端「失焦即保存」会原样回传整份草稿，
        // 若照样刷新时间戳，todos.json 会凭空产生一次工作区变更，多端同步时变成毫无意义的合并冲突。
        if item.title == title
            && item.description == description
            && item.due_at == due_at
            && item.priority == priority
            && item.remind_at == remind_at
        {
            return Ok((item.clone(), false));
        }
        item.title = title;
        item.description = description;
        item.due_at = due_at;
        item.priority = priority;
        item.remind_at = remind_at;
        item.updated_at = now_rfc3339();
        Ok((item.clone(), true))
    })
}

/// 用例：切换任务完成状态。
pub fn toggle_task(root: &Path, task_id: &str) -> Result<TaskItem, AppError> {
    mutate_board(root, |board| {
        let item = board
            .tasks
            .iter_mut()
            .find(|item| item.id == task_id)
            .ok_or_else(|| AppError::TaskNotFound(task_id.to_string()))?;
        task::toggle_task(item, &now_rfc3339());
        Ok(item.clone())
    })
}

/// 用例：删除任务；任务不存在时按幂等成功处理。
pub fn delete_task(root: &Path, task_id: &str) -> Result<(), AppError> {
    mutate_board(root, |board| {
        board.tasks.retain(|item| item.id != task_id);
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn create_task_validates_title_and_reminder() {
        let root = setup();
        assert!(matches!(
            create_task(root.path(), "  ", None, None, TaskPriority::None, None),
            Err(AppError::TaskInvalid(_))
        ));
        assert!(matches!(
            create_task(root.path(), "x", None, None, TaskPriority::None, Some("2026-09-20T09:00:00+08:00".into())),
            Err(AppError::TaskInvalid(_))
        ));
        assert!(matches!(
            create_task(root.path(), "x", None, Some("2026-09-20 18:00".into()), TaskPriority::None, None),
            Err(AppError::TaskInvalid(_))
        ));

        let item = create_task(
            root.path(),
            "写周报",
            Some("包含本周三项交付进展".into()),
            Some("2026-09-20".into()),
            TaskPriority::High,
            Some("2026-09-20T09:00:00+08:00".into()),
        )
        .unwrap();
        assert_eq!(item.sort_order, 0);
        assert!(!item.done);
        assert_eq!(item.title, "写周报");

        let second = create_task(root.path(), "回邮件", None, None, TaskPriority::Low, None).unwrap();
        assert_eq!(second.sort_order, 1);
    }

    #[test]
    fn create_task_accepts_due_datetime_with_minutes() {
        let root = setup();
        let item = create_task(
            root.path(),
            "交周报",
            None,
            Some("2026-09-20T18:30".into()),
            TaskPriority::Medium,
            None,
        )
        .unwrap();
        assert_eq!(item.due_at.as_deref(), Some("2026-09-20T18:30"));
        assert_eq!(board(root.path()).unwrap().tasks[0].due_at.as_deref(), Some("2026-09-20T18:30"));
    }

    #[test]
    fn update_task_replaces_editable_fields() {
        let root = setup();
        let item = create_task(root.path(), "旧标题", None, None, TaskPriority::None, None).unwrap();

        let updated = update_task(
            root.path(),
            &item.id,
            "新标题",
            Some("新详情".into()),
            Some("2026-10-01".into()),
            TaskPriority::Medium,
            None,
        )
        .unwrap();
        assert_eq!(updated.title, "新标题");
        assert_eq!(updated.description, "新详情");
        assert_eq!(updated.due_at.as_deref(), Some("2026-10-01"));
        assert_eq!(updated.priority, TaskPriority::Medium);

        assert!(matches!(
            update_task(root.path(), "missing", "x", None, None, TaskPriority::None, None),
            Err(AppError::TaskNotFound(_))
        ));
    }

    #[test]
    fn update_task_does_not_touch_file_when_nothing_changed() {
        let root = setup();
        let item = create_task(
            root.path(),
            "写周报",
            Some("三条".into()),
            Some("2026-09-21".into()),
            TaskPriority::High,
            None,
        )
        .unwrap();
        let file = root.path().join(".ainote/todos.json");
        let before = fs::read_to_string(&file).unwrap();
        let before_mtime = fs::metadata(&file).unwrap().modified().unwrap();

        // 原样回传整份草稿（前端「失焦即保存」的真实入参）不得产生任何落盘行为
        let updated = update_task(
            root.path(),
            &item.id,
            "写周报",
            Some("三条".into()),
            Some("2026-09-21".into()),
            TaskPriority::High,
            None,
        )
        .unwrap();

        assert_eq!(updated.updated_at, item.updated_at);
        assert_eq!(fs::read_to_string(&file).unwrap(), before);
        assert_eq!(fs::metadata(&file).unwrap().modified().unwrap(), before_mtime);
    }

    #[test]
    fn update_task_still_bumps_updated_at_on_real_change() {
        let root = setup();
        let item = create_task(root.path(), "写周报", None, None, TaskPriority::None, None).unwrap();

        let updated = update_task(root.path(), &item.id, "写周报", Some("三条".into()), None, TaskPriority::None, None).unwrap();

        assert_eq!(updated.description, "三条");
        assert_ne!(updated.updated_at, item.updated_at);
    }

    #[test]
    fn toggle_task_flips_done_state() {
        let root = setup();
        let item = create_task(root.path(), "t", None, None, TaskPriority::None, None).unwrap();

        let done = toggle_task(root.path(), &item.id).unwrap();
        assert!(done.done);
        assert!(done.completed_at.is_some());

        let reopened = toggle_task(root.path(), &item.id).unwrap();
        assert!(!reopened.done);
        assert!(reopened.completed_at.is_none());

        assert!(matches!(
            toggle_task(root.path(), "missing"),
            Err(AppError::TaskNotFound(_))
        ));
    }

    #[test]
    fn delete_task_is_idempotent() {
        let root = setup();
        let item = create_task(root.path(), "t", None, None, TaskPriority::None, None).unwrap();
        delete_task(root.path(), &item.id).unwrap();
        delete_task(root.path(), &item.id).unwrap();
        assert!(board(root.path()).unwrap().tasks.is_empty());
    }
}
