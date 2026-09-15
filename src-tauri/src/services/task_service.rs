use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::task::{
    self, now_rfc3339, sort_tasks, TaskBoard, TaskItem, TaskList, TaskPriority,
};
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

/// 用例：读取看板并按展示规则排序任务。
pub fn board(root: &Path) -> Result<TaskBoard, AppError> {
    let mut board = task_files::load(root)?;
    sort_tasks(&mut board.tasks);
    Ok(board)
}

/// 用例：新建清单，排在现有清单末尾。
pub fn create_list(root: &Path, name: &str) -> Result<TaskList, AppError> {
    let name = task::require_non_blank(name, "清单名称不能为空")?;
    mutate_board(root, |board| {
        let sort_order = board.lists.iter().map(|list| list.sort_order).max().map_or(0, |max| max + 1);
        let list = TaskList {
            id: task::new_task_id(),
            name,
            sort_order,
            created_at: now_rfc3339(),
        };
        board.lists.push(list.clone());
        Ok(list)
    })
}

/// 用例：重命名清单。
pub fn rename_list(root: &Path, list_id: &str, name: &str) -> Result<(), AppError> {
    let name = task::require_non_blank(name, "清单名称不能为空")?;
    mutate_board(root, |board| {
        let list = board
            .lists
            .iter_mut()
            .find(|list| list.id == list_id)
            .ok_or_else(|| AppError::TaskListNotFound(list_id.to_string()))?;
        list.name = name;
        Ok(())
    })
}

/// 用例：删除清单并级联删除其下任务；清单不存在时按幂等成功处理。
pub fn delete_list(root: &Path, list_id: &str) -> Result<(), AppError> {
    mutate_board(root, |board| {
        board.lists.retain(|list| list.id != list_id);
        board.tasks.retain(|item| item.list_id != list_id);
        Ok(())
    })
}

/// 用例：在指定清单下新建任务，排在该清单末尾。
pub fn create_task(
    root: &Path,
    list_id: &str,
    title: &str,
    due_date: Option<String>,
    priority: TaskPriority,
    remind_at: Option<String>,
) -> Result<TaskItem, AppError> {
    let title = task::require_non_blank(title, "任务标题不能为空")?;
    task::validate_reminder(&due_date, &remind_at)?;
    mutate_board(root, |board| {
        if !board.lists.iter().any(|list| list.id == list_id) {
            return Err(AppError::TaskListNotFound(list_id.to_string()));
        }
        let sort_order = board
            .tasks
            .iter()
            .filter(|item| item.list_id == list_id)
            .map(|item| item.sort_order)
            .max()
            .map_or(0, |max| max + 1);
        let now = now_rfc3339();
        let item = TaskItem {
            id: task::new_task_id(),
            list_id: list_id.to_string(),
            title,
            done: false,
            priority,
            due_date,
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

/// 用例：全量更新任务可编辑字段（前端总是回传完整编辑态），并刷新 updated_at。
#[allow(clippy::too_many_arguments)]
pub fn update_task(
    root: &Path,
    task_id: &str,
    title: &str,
    list_id: &str,
    due_date: Option<String>,
    priority: TaskPriority,
    remind_at: Option<String>,
) -> Result<TaskItem, AppError> {
    let title = task::require_non_blank(title, "任务标题不能为空")?;
    task::validate_reminder(&due_date, &remind_at)?;
    mutate_board(root, |board| {
        if !board.lists.iter().any(|list| list.id == list_id) {
            return Err(AppError::TaskListNotFound(list_id.to_string()));
        }
        let item = board
            .tasks
            .iter_mut()
            .find(|item| item.id == task_id)
            .ok_or_else(|| AppError::TaskNotFound(task_id.to_string()))?;
        item.title = title;
        item.list_id = list_id.to_string();
        item.due_date = due_date;
        item.priority = priority;
        item.remind_at = remind_at;
        item.updated_at = now_rfc3339();
        Ok(item.clone())
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

    fn setup() -> (tempfile::TempDir, TaskList) {
        let root = tempfile::tempdir().unwrap();
        let list = create_list(root.path(), " 收件箱 ").unwrap();
        (root, list)
    }

    #[test]
    fn create_list_trims_name_and_rejects_blank() {
        let (root, list) = setup();
        assert_eq!(list.name, "收件箱");
        assert!(matches!(
            create_list(root.path(), "  "),
            Err(AppError::TaskInvalid(_))
        ));
    }

    #[test]
    fn rename_list_requires_existing_list() {
        let (root, list) = setup();
        rename_list(root.path(), &list.id, "工作").unwrap();
        assert_eq!(board(root.path()).unwrap().lists[0].name, "工作");
        assert!(matches!(
            rename_list(root.path(), "missing", "x"),
            Err(AppError::TaskListNotFound(_))
        ));
    }

    #[test]
    fn create_task_validates_list_title_and_reminder() {
        let (root, list) = setup();
        assert!(matches!(
            create_task(root.path(), "missing", "x", None, TaskPriority::None, None),
            Err(AppError::TaskListNotFound(_))
        ));
        assert!(matches!(
            create_task(root.path(), &list.id, "  ", None, TaskPriority::None, None),
            Err(AppError::TaskInvalid(_))
        ));
        assert!(matches!(
            create_task(root.path(), &list.id, "x", None, TaskPriority::None, Some("2026-09-20T09:00:00+08:00".into())),
            Err(AppError::TaskInvalid(_))
        ));

        let item = create_task(
            root.path(),
            &list.id,
            "写周报",
            Some("2026-09-20".into()),
            TaskPriority::High,
            Some("2026-09-20T09:00:00+08:00".into()),
        )
        .unwrap();
        assert_eq!(item.sort_order, 0);
        assert!(!item.done);

        let second = create_task(root.path(), &list.id, "回邮件", None, TaskPriority::Low, None).unwrap();
        assert_eq!(second.sort_order, 1);
    }

    #[test]
    fn update_task_replaces_editable_fields() {
        let (root, list) = setup();
        let other = create_list(root.path(), "工作").unwrap();
        let item = create_task(root.path(), &list.id, "旧标题", None, TaskPriority::None, None).unwrap();

        let updated = update_task(
            root.path(),
            &item.id,
            "新标题",
            &other.id,
            Some("2026-10-01".into()),
            TaskPriority::Medium,
            None,
        )
        .unwrap();
        assert_eq!(updated.title, "新标题");
        assert_eq!(updated.list_id, other.id);
        assert_eq!(updated.due_date.as_deref(), Some("2026-10-01"));
        assert_eq!(updated.priority, TaskPriority::Medium);

        assert!(matches!(
            update_task(root.path(), "missing", "x", &list.id, None, TaskPriority::None, None),
            Err(AppError::TaskNotFound(_))
        ));
    }

    #[test]
    fn toggle_task_flips_done_state() {
        let (root, list) = setup();
        let item = create_task(root.path(), &list.id, "t", None, TaskPriority::None, None).unwrap();

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
    fn delete_list_cascades_tasks() {
        let (root, list) = setup();
        let keep = create_list(root.path(), "保留").unwrap();
        create_task(root.path(), &list.id, "将被级联", None, TaskPriority::None, None).unwrap();
        create_task(root.path(), &keep.id, "应保留", None, TaskPriority::None, None).unwrap();

        delete_list(root.path(), &list.id).unwrap();
        let board = board(root.path()).unwrap();
        assert_eq!(board.lists.len(), 1);
        assert_eq!(board.tasks.len(), 1);
        assert_eq!(board.tasks[0].title, "应保留");
    }

    #[test]
    fn delete_task_is_idempotent() {
        let (root, list) = setup();
        let item = create_task(root.path(), &list.id, "t", None, TaskPriority::None, None).unwrap();
        delete_task(root.path(), &item.id).unwrap();
        delete_task(root.path(), &item.id).unwrap();
        assert!(board(root.path()).unwrap().tasks.is_empty());
    }
}
