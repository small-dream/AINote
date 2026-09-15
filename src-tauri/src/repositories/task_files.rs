use std::fs;
use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::task::{normalize_board, TaskBoard, TASK_SCHEMA_VERSION};

pub const TASKS_FILE: &str = ".ainote/todos.json";

/// Repository 边界：读取 Todo 看板；缺失文件视为空看板。
pub fn load(root: &Path) -> Result<TaskBoard, AppError> {
    let path = root.join(TASKS_FILE);
    if !path.is_file() {
        return Ok(TaskBoard {
            schema_version: TASK_SCHEMA_VERSION,
            tasks: Vec::new(),
        });
    }

    let raw = fs::read_to_string(path)?;
    let board: TaskBoard = serde_json::from_str(&raw)
        .map_err(|error| AppError::Repo(format!("invalid task board: {error}")))?;
    Ok(normalize_board(board))
}

/// Repository 边界：原子写入 Todo 看板，避免半写状态破坏 JSON。
pub fn save(root: &Path, board: &TaskBoard) -> Result<(), AppError> {
    let path = root.join(TASKS_FILE);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temporary = path.with_extension("tmp");
    let serialized = serde_json::to_vec_pretty(board)
        .map_err(|error| AppError::Repo(format!("serialize task board failed: {error}")))?;
    fs::write(&temporary, serialized)?;
    fs::rename(&temporary, &path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_treats_missing_board_as_empty() {
        let root = tempfile::tempdir().unwrap();
        let board = load(root.path()).unwrap();
        assert!(board.tasks.is_empty());
        assert_eq!(board.schema_version, TASK_SCHEMA_VERSION);
    }

    #[test]
    fn load_upgrades_legacy_schema_version() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join(TASKS_FILE);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, r#"{"schemaVersion":1,"tasks":[]}"#).unwrap();

        let board = load(root.path()).unwrap();
        assert_eq!(board.schema_version, TASK_SCHEMA_VERSION);
    }

    #[test]
    fn load_ignores_removed_lists_field() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join(TASKS_FILE);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(
            &path,
            r#"{"schemaVersion":2,"lists":[{"id":"l1","name":"工作","sortOrder":0,"createdAt":"2026-09-01T00:00:00Z"}],"tasks":[{"id":"t1","listId":"l1","title":"写周报","done":false,"priority":"high","dueDate":null,"remindAt":null,"sortOrder":0,"createdAt":"2026-09-01T00:00:00Z","updatedAt":"2026-09-01T00:00:00Z","completedAt":null}]}"#,
        )
        .unwrap();

        let board = load(root.path()).unwrap();
        assert_eq!(board.schema_version, TASK_SCHEMA_VERSION);
        assert_eq!(board.tasks.len(), 1);
        assert_eq!(board.tasks[0].title, "写周报");
    }

    #[test]
    fn save_and_load_round_trips_board() {
        let root = tempfile::tempdir().unwrap();
        let board = TaskBoard {
            schema_version: TASK_SCHEMA_VERSION,
            tasks: Vec::new(),
        };
        save(root.path(), &board).unwrap();
        let loaded = load(root.path()).unwrap();
        assert!(loaded.tasks.is_empty());
        assert_eq!(loaded.schema_version, TASK_SCHEMA_VERSION);
    }
}
