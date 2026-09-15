use std::cmp::Ordering;

use serde::{Deserialize, Serialize};

use crate::domain::error::AppError;

pub const TASK_SCHEMA_VERSION: u32 = 3;

/// Todo 看板的落盘结构；`schemaVersion` 供后续规则演进使用。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskBoard {
    pub schema_version: u32,
    #[serde(default)]
    pub tasks: Vec<TaskItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskItem {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    pub done: bool,
    pub priority: TaskPriority,
    /// 截止时间：`YYYY-MM-DD`（当天结束前）或 `YYYY-MM-DDTHH:mm`（本地具体时刻）
    #[serde(default, alias = "dueDate")]
    pub due_at: Option<String>,
    pub remind_at: Option<String>,
    pub sort_order: u32,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

/// 兼容旧版 todos.json：缺失 description 回退空文本，并统一升级 schemaVersion。
pub fn normalize_board(mut board: TaskBoard) -> TaskBoard {
    board.schema_version = TASK_SCHEMA_VERSION;
    board
}

/// 优先级序列化为小写字符串，与前端 TS 字面量类型保持一致。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskPriority {
    #[default]
    None,
    Low,
    Medium,
    High,
}

/// 当前本地时间的 RFC3339 字符串；取不到本地时区时回退 UTC，保证总能落盘。
pub fn now_rfc3339() -> String {
    time::OffsetDateTime::now_local()
        .unwrap_or_else(|_| time::OffsetDateTime::now_utc())
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

/// 生成实体 id：毫秒时间戳 + 随机数，避免引入 uuid 依赖且同毫秒内不冲突。
pub fn new_task_id() -> String {
    let millis = time::OffsetDateTime::now_utc().unix_timestamp_nanos() / 1_000_000;
    let mut bytes = [0u8; 4];
    let random = match getrandom::getrandom(&mut bytes) {
        Ok(()) => u32::from_le_bytes(bytes),
        Err(_) => (time::OffsetDateTime::now_utc().unix_timestamp_nanos() >> 8) as u32,
    };
    format!("{millis:x}-{random:x}")
}

/// 标题/名称统一校验：trim 后非空，返回归一化后的值。
pub fn require_non_blank(value: &str, message: &str) -> Result<String, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::TaskInvalid(message.to_string()));
    }
    Ok(trimmed.to_string())
}

/// 提醒时间必须搭配截止时间，否则系统通知无法落地。
pub fn validate_reminder(
    due_at: &Option<String>,
    remind_at: &Option<String>,
) -> Result<(), AppError> {
    if remind_at.is_some() && due_at.is_none() {
        return Err(AppError::TaskInvalid("提醒时间需要搭配截止时间".to_string()));
    }
    Ok(())
}

/// 截止时间只接受 `YYYY-MM-DD`（当天结束前）与 `YYYY-MM-DDTHH:mm`（本地具体时刻）两种形态。
pub fn validate_due_at(due_at: &Option<String>) -> Result<(), AppError> {
    let Some(value) = due_at else { return Ok(()) };
    if is_due_date(value) || is_due_datetime(value) {
        return Ok(());
    }
    Err(AppError::TaskInvalid(format!("截止时间格式无效：{value}")))
}

fn is_due_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7) || byte.is_ascii_digit())
}

fn is_due_datetime(value: &str) -> bool {
    let Some((date, time)) = value.split_once('T') else {
        return false;
    };
    if !is_due_date(date) || time.len() != 5 || time.as_bytes()[2] != b':' {
        return false;
    }
    let (hour, minute) = (&time[0..2], &time[3..5]);
    let (Ok(hour), Ok(minute)) = (hour.parse::<u8>(), minute.parse::<u8>()) else {
        return false;
    };
    hour < 24 && minute < 60
}

/// 纯函数：切换完成状态并维护 completed_at / updated_at。
pub fn toggle_task(item: &mut TaskItem, now: &str) {
    item.done = !item.done;
    item.completed_at = item.done.then(|| now.to_string());
    item.updated_at = now.to_string();
}

fn priority_rank(priority: &TaskPriority) -> u8 {
    match priority {
        TaskPriority::High => 3,
        TaskPriority::Medium => 2,
        TaskPriority::Low => 1,
        TaskPriority::None => 0,
    }
}

/// 纯函数：看板排序——未完成在前 → 截止日期升序（无日期排后）→ 优先级高在前 → 创建时间升序。
pub fn sort_tasks(tasks: &mut [TaskItem]) {
    tasks.sort_by(|a, b| {
        a.done
            .cmp(&b.done)
            .then_with(|| compare_due_at(&a.due_at, &b.due_at))
            .then_with(|| priority_rank(&b.priority).cmp(&priority_rank(&a.priority)))
            .then_with(|| a.created_at.cmp(&b.created_at))
    });
}

fn compare_due_at(a: &Option<String>, b: &Option<String>) -> Ordering {
    match (a, b) {
        (Some(x), Some(y)) => due_sort_key(x).cmp(&due_sort_key(y)),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => Ordering::Equal,
    }
}

/// 排序键：先比日期，再比时刻；只到天的截止视为当天结束前，排在同日任何具体时刻之后。
fn due_sort_key(value: &str) -> (&str, &str) {
    match value.split_once('T') {
        Some((date, time)) => (date, time),
        None => (value, "99:99"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(id: &str, done: bool, due: Option<&str>, priority: TaskPriority, created: &str) -> TaskItem {
        TaskItem {
            id: id.to_string(),
            title: id.to_string(),
            description: String::new(),
            done,
            priority,
            due_at: due.map(str::to_string),
            remind_at: None,
            sort_order: 0,
            created_at: created.to_string(),
            updated_at: created.to_string(),
            completed_at: None,
        }
    }

    #[test]
    fn require_non_blank_trims_and_rejects_empty() {
        assert_eq!(require_non_blank("  买菜  ", "不能为空").unwrap(), "买菜");
        assert!(require_non_blank("   ", "不能为空").is_err());
    }

    #[test]
    fn reminder_requires_due_date() {
        assert!(validate_reminder(&Some("2026-09-20".into()), &Some("2026-09-20T09:00:00+08:00".into())).is_ok());
        assert!(validate_reminder(&None, &None).is_ok());
        assert!(validate_reminder(&None, &Some("2026-09-20T09:00:00+08:00".into())).is_err());
    }

    #[test]
    fn due_at_accepts_date_and_local_datetime_only() {
        assert!(validate_due_at(&None).is_ok());
        assert!(validate_due_at(&Some("2026-09-20".into())).is_ok());
        assert!(validate_due_at(&Some("2026-09-20T18:30".into())).is_ok());
        assert!(validate_due_at(&Some("2026-09-20T00:00".into())).is_ok());
        assert!(validate_due_at(&Some("2026-09-20 18:30".into())).is_err());
        assert!(validate_due_at(&Some("2026-09-20T24:00".into())).is_err());
        assert!(validate_due_at(&Some("2026-09-20T18:75".into())).is_err());
        assert!(validate_due_at(&Some("2026-9-2".into())).is_err());
    }

    #[test]
    fn same_day_datetime_sorts_after_date_only() {
        let mut tasks = vec![
            task("datetime", false, Some("2026-09-20T09:00"), TaskPriority::None, "2026-09-01T00:00:00Z"),
            task("date-only", false, Some("2026-09-20"), TaskPriority::None, "2026-09-01T00:00:00Z"),
            task("next-day", false, Some("2026-09-21"), TaskPriority::None, "2026-09-01T00:00:00Z"),
        ];
        sort_tasks(&mut tasks);
        let ids: Vec<&str> = tasks.iter().map(|t| t.id.as_str()).collect();
        assert_eq!(ids, vec!["datetime", "date-only", "next-day"]);
    }

    #[test]
    fn toggle_flips_done_and_maintains_timestamps() {
        let mut item = task("t1", false, None, TaskPriority::None, "2026-09-15T08:00:00+08:00");
        toggle_task(&mut item, "2026-09-15T09:00:00+08:00");
        assert!(item.done);
        assert_eq!(item.completed_at.as_deref(), Some("2026-09-15T09:00:00+08:00"));
        assert_eq!(item.updated_at, "2026-09-15T09:00:00+08:00");

        toggle_task(&mut item, "2026-09-15T10:00:00+08:00");
        assert!(!item.done);
        assert!(item.completed_at.is_none());
        assert_eq!(item.updated_at, "2026-09-15T10:00:00+08:00");
    }

    #[test]
    fn sort_orders_open_first_then_due_then_priority_then_created() {
        let mut tasks = vec![
            task("done-old", true, Some("2026-09-01"), TaskPriority::High, "2026-09-01T00:00:00Z"),
            task("no-due", false, None, TaskPriority::High, "2026-09-01T00:00:00Z"),
            task("due-late", false, Some("2026-09-30"), TaskPriority::High, "2026-09-01T00:00:00Z"),
            task("due-early-low", false, Some("2026-09-10"), TaskPriority::Low, "2026-09-01T00:00:00Z"),
            task("due-early-high-new", false, Some("2026-09-10"), TaskPriority::High, "2026-09-02T00:00:00Z"),
            task("due-early-high-old", false, Some("2026-09-10"), TaskPriority::High, "2026-09-01T00:00:00Z"),
        ];
        sort_tasks(&mut tasks);
        let ids: Vec<&str> = tasks.iter().map(|t| t.id.as_str()).collect();
        assert_eq!(
            ids,
            vec![
                "due-early-high-old",
                "due-early-high-new",
                "due-early-low",
                "due-late",
                "no-due",
                "done-old"
            ]
        );
    }

    #[test]
    fn generated_ids_are_unique_and_hex_shaped() {
        let first = new_task_id();
        let second = new_task_id();
        assert_ne!(first, second);
        let (millis, random) = first.split_once('-').expect("id 应包含分隔符");
        assert!(u64::from_str_radix(millis, 16).is_ok());
        assert!(u32::from_str_radix(random, 16).is_ok());
    }

    #[test]
    fn priority_serializes_lowercase() {
        assert_eq!(serde_json::to_string(&TaskPriority::None).unwrap(), "\"none\"");
        assert_eq!(serde_json::to_string(&TaskPriority::High).unwrap(), "\"high\"");
        assert_eq!(
            serde_json::from_str::<TaskPriority>("\"medium\"").unwrap(),
            TaskPriority::Medium
        );
    }
}
