//! 本地度量存储：app config dir 下的 `metrics.json`（明文，仅事件计数与时间）。
//!
//! 写入内容只有事件名 / 日期 / 时间戳 / 平台 / 版本；埋点失败一律降级为 debug 日志，
//! 绝不影响同步、保存等主流程。

use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::domain::error::AppError;
use crate::domain::metrics::{MetricEvent, MetricsDto, MetricsSnapshot, DAILY_WINDOW_DAYS};
use crate::domain::metrics::MetricsExportDto;

const METRICS_FILE: &str = "metrics.json";

const DATE_FORMAT: &[time::format_description::FormatItem<'_>] =
    time::macros::format_description!("[year]-[month]-[day]");

pub struct MetricsStore {
    path: PathBuf,
    platform: String,
    app_version: String,
}

impl MetricsStore {
    pub fn from_app(app: &AppHandle) -> Result<Self, AppError> {
        let dir = app
            .path()
            .app_config_dir()
            .map_err(|err| AppError::Io(err.to_string()))?;
        fs::create_dir_all(&dir)?;
        Ok(Self::at(dir.join(METRICS_FILE)))
    }

    /// 指定文件路径构造（测试用）；平台与版本取自编译期常量。
    pub fn at(path: PathBuf) -> Self {
        Self {
            path,
            platform: std::env::consts::OS.to_string(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }

    /// 读取快照；文件不存在或字段缺失时返回空快照（不报错，保证埋点永不阻断启动）。
    pub fn snapshot(&self) -> Result<MetricsSnapshot, AppError> {
        if !self.path.is_file() {
            return Ok(MetricsSnapshot::new(&self.platform, &self.app_version));
        }
        let raw = fs::read_to_string(&self.path)?;
        let mut snapshot: MetricsSnapshot =
            serde_json::from_str(&raw).map_err(|err| AppError::Io(err.to_string()))?;
        snapshot.platform = self.platform.clone();
        snapshot.app_version = self.app_version.clone();
        Ok(snapshot)
    }

    /// 累加一次事件并立即落盘（读 → 改 → 写；文件极小，无需增量方案）。
    pub fn record(&self, event: MetricEvent) -> Result<(), AppError> {
        let mut snapshot = self.snapshot()?;
        let now = now_local();
        snapshot.record(event, &format_date(now), &format_timestamp(now));
        snapshot.prune_daily(DAILY_WINDOW_DAYS);
        self.save(&snapshot)
    }

    /// 清空本机指标：删除文件，下次读取回到空快照。
    pub fn clear(&self) -> Result<(), AppError> {
        if self.path.is_file() {
            fs::remove_file(&self.path)?;
        }
        Ok(())
    }

    pub fn dto(&self, enabled: bool) -> Result<MetricsDto, AppError> {
        Ok(self.snapshot()?.to_dto(enabled))
    }

    fn save(&self, snapshot: &MetricsSnapshot) -> Result<(), AppError> {
        let raw =
            serde_json::to_string_pretty(snapshot).map_err(|err| AppError::Io(err.to_string()))?;
        fs::write(&self.path, raw)?;
        Ok(())
    }
}

/// 按开关写入：关闭时直接返回、不落盘——「关闭后停止写入」的唯一入口。
pub fn record_if_enabled(
    store: &MetricsStore,
    enabled: bool,
    event: MetricEvent,
) -> Result<(), AppError> {
    if !enabled {
        return Ok(());
    }
    store.record(event)
}

/// 尽力而为地记录事件（command / 启动钩子用）：先查开关，失败只写 debug 日志，不打断业务。
pub fn record_best_effort(app: &AppHandle, event: MetricEvent) {
    let enabled = crate::config::metrics_enabled(app).unwrap_or(true);
    let result =
        MetricsStore::from_app(app).and_then(|store| record_if_enabled(&store, enabled, event));
    if let Err(error) = result {
        log::debug!(target: "ainote::metrics", "记录指标失败 event={} error={error}", event.as_str());
    }
}

/// 导出格式（用户在前端选择）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetricsFormat {
    Json,
    Csv,
}

impl MetricsFormat {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "json" => Some(Self::Json),
            "csv" => Some(Self::Csv),
            _ => None,
        }
    }

    pub fn extension(self) -> &'static str {
        match self {
            Self::Json => "json",
            Self::Csv => "csv",
        }
    }

    pub fn filter_name(self) -> &'static str {
        match self {
            Self::Json => "JSON",
            Self::Csv => "CSV",
        }
    }

    pub fn extensions(self) -> &'static [&'static str] {
        match self {
            Self::Json => &["json"],
            Self::Csv => &["csv"],
        }
    }
}

/// 把本机指标写入 `dest`：内容只来自快照（白名单计数 + 平台与版本），不会带出敏感信息。
pub fn export(
    store: &MetricsStore,
    dest: &Path,
    format: MetricsFormat,
    enabled: bool,
) -> Result<MetricsExportDto, AppError> {
    let snapshot = store.snapshot()?;
    let content = match format {
        MetricsFormat::Json => snapshot
            .to_json(enabled)
            .map_err(|err| AppError::Io(err.to_string()))?,
        MetricsFormat::Csv => snapshot.to_csv(enabled),
    };
    fs::write(dest, &content)?;
    Ok(MetricsExportDto {
        path: dest.to_string_lossy().into_owned(),
        bytes: content.len() as u64,
    })
}

fn now_local() -> time::OffsetDateTime {
    time::OffsetDateTime::now_local().unwrap_or_else(|_| time::OffsetDateTime::now_utc())
}

fn format_date(now: time::OffsetDateTime) -> String {
    now.format(DATE_FORMAT)
        .unwrap_or_else(|_| "unknown-date".to_string())
}

fn format_timestamp(now: time::OffsetDateTime) -> String {
    now.to_offset(time::UtcOffset::UTC)
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "unknown-time".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> (tempfile::TempDir, MetricsStore) {
        let dir = tempfile::tempdir().expect("临时目录");
        let store = MetricsStore::at(dir.path().join(METRICS_FILE));
        (dir, store)
    }

    #[test]
    fn records_and_persists_across_reopen() {
        let (dir, store) = store();
        store.record(MetricEvent::AppLaunched).expect("记录启动");
        store.record(MetricEvent::NoteCreated).expect("记录创建");
        store.record(MetricEvent::NoteCreated).expect("记录创建");

        let reopened = MetricsStore::at(dir.path().join(METRICS_FILE));
        let snapshot = reopened.snapshot().expect("重开读取");
        assert_eq!(snapshot.total(MetricEvent::NoteCreated), 2);
        assert_eq!(snapshot.total(MetricEvent::AppLaunched), 1);
    }

    #[test]
    fn snapshot_is_empty_without_file() {
        let (_dir, store) = store();
        let snapshot = store.snapshot().expect("空快照");
        assert_eq!(snapshot.total(MetricEvent::AppLaunched), 0);
        assert_eq!(snapshot.platform, std::env::consts::OS);
        assert_eq!(snapshot.app_version, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn clear_removes_previous_counts() {
        let (_dir, store) = store();
        store.record(MetricEvent::SyncSucceeded).expect("记录同步");
        store.clear().expect("清空");
        assert_eq!(store.dto(true).expect("清空后读取").totals[3].count, 0);
    }

    #[test]
    fn dto_reports_window_metrics() {
        let (_dir, store) = store();
        store.record(MetricEvent::SyncSucceeded).expect("成功");
        store.record(MetricEvent::SyncFailed).expect("失败");
        let dto = store.dto(true).expect("读取 DTO");
        assert_eq!(dto.active_days, 1);
        assert_eq!(dto.sync_success_rate, Some(0.5));
        assert!(dto
            .totals
            .iter()
            .any(|item| item.event == "note_created" && item.count == 0));
    }

    #[test]
    fn persisted_file_contains_no_sensitive_keys() {
        let (dir, store) = store();
        store.record(MetricEvent::RepoBound).expect("记录绑定");
        let raw = fs::read_to_string(dir.path().join(METRICS_FILE)).expect("读取文件");
        for sensitive in ["token", "apiKey", "repoUrl", "path", "content", "title"] {
            assert!(!raw.contains(sensitive), "不应出现敏感字段: {sensitive}");
        }
        assert!(raw.contains("repo_bound"));
    }

    #[test]
    fn disabled_switch_writes_nothing() {
        let (dir, store) = store();
        record_if_enabled(&store, false, MetricEvent::AppLaunched).expect("关闭时静默成功");
        assert!(
            !dir.path().join(METRICS_FILE).exists(),
            "关闭后不应创建任何文件"
        );
        assert_eq!(
            store.snapshot().expect("读取").total(MetricEvent::AppLaunched),
            0
        );

        record_if_enabled(&store, true, MetricEvent::AppLaunched).expect("开启后写入");
        assert_eq!(
            store.snapshot().expect("读取").total(MetricEvent::AppLaunched),
            1
        );
    }

    #[test]
    fn dto_reports_switch_state() {
        let (_dir, store) = store();
        assert!(!store.dto(false).expect("读取 DTO").enabled);
        assert!(store.dto(true).expect("读取 DTO").enabled);
    }

    #[test]
    fn export_writes_json_and_csv_files() {
        let (dir, store) = store();
        store.record(MetricEvent::RepoBound).expect("记录绑定");

        let json = export(&store, &dir.path().join("metrics.json"), MetricsFormat::Json, true)
            .expect("导出 JSON");
        assert!(json.bytes > 0);
        let json_text = fs::read_to_string(&json.path).expect("读取 JSON");
        assert!(json_text.contains("\"repo_bound\": 1"));

        let csv = export(&store, &dir.path().join("metrics.csv"), MetricsFormat::Csv, true)
            .expect("导出 CSV");
        let csv_text = fs::read_to_string(&csv.path).expect("读取 CSV");
        assert!(csv_text.contains("repo_bound,1,"));
        assert!(csv_text.contains("platform,"));
    }

    #[test]
    fn export_format_parsing_and_extensions() {
        assert_eq!(MetricsFormat::parse("json"), Some(MetricsFormat::Json));
        assert_eq!(MetricsFormat::parse("csv"), Some(MetricsFormat::Csv));
        assert_eq!(MetricsFormat::parse("xlsx"), None);
        assert_eq!(MetricsFormat::Json.extension(), "json");
        assert_eq!(MetricsFormat::Csv.extensions(), &["csv"]);
        assert_eq!(MetricsFormat::Json.filter_name(), "JSON");
    }
}
