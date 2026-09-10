//! 本地度量事件与聚合（纯逻辑，无 IO）。
//!
//! 只记录**事件名 + 时间 + 平台 + 版本**：不含笔记内容、路径、Token、API Key 或远端 URL。
//! 事件白名单 [`METRIC_EVENTS`] 是唯一入口，新增事件必须在此登记（防止埋点范围蔓延）。

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// 允许采集的事件白名单（与 `docs/ROADMAP.md` §3 的漏斗环节一一对应）。
pub const METRIC_EVENTS: [&str; 7] = [
    "app_launched",
    "repo_bound",
    "note_created",
    "sync_succeeded",
    "sync_failed",
    "ai_action_confirmed",
    "update_checked",
];

/// 每日明细保留天数（滚动窗口）；8 周足够算 D30 留存与周活跃，且不会无限增长。
pub const DAILY_WINDOW_DAYS: usize = 56;

/// 默认统计窗口：近 7 天（周活跃 / 同步成功率）。
pub const WEEK_WINDOW_DAYS: usize = 7;

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetricEvent {
    AppLaunched,
    RepoBound,
    NoteCreated,
    SyncSucceeded,
    SyncFailed,
    AiActionConfirmed,
    UpdateChecked,
}

impl MetricEvent {
    pub fn as_str(self) -> &'static str {
        match self {
            MetricEvent::AppLaunched => "app_launched",
            MetricEvent::RepoBound => "repo_bound",
            MetricEvent::NoteCreated => "note_created",
            MetricEvent::SyncSucceeded => "sync_succeeded",
            MetricEvent::SyncFailed => "sync_failed",
            MetricEvent::AiActionConfirmed => "ai_action_confirmed",
            MetricEvent::UpdateChecked => "update_checked",
        }
    }

    /// 解析事件名；不在白名单内返回 None（调用方应忽略并记日志，不写入任何内容）。
    pub fn parse(value: &str) -> Option<Self> {
        Self::all().into_iter().find(|event| event.as_str() == value)
    }

    fn all() -> [Self; METRIC_EVENTS.len()] {
        [
            MetricEvent::AppLaunched,
            MetricEvent::RepoBound,
            MetricEvent::NoteCreated,
            MetricEvent::SyncSucceeded,
            MetricEvent::SyncFailed,
            MetricEvent::AiActionConfirmed,
            MetricEvent::UpdateChecked,
        ]
    }
}

/// 本机指标快照：`metrics.json` 的结构即此类型。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricsSnapshot {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub platform: String,
    #[serde(default)]
    pub app_version: String,
    #[serde(default)]
    pub updated_at: String,
    /// 事件名 → 累计次数
    #[serde(default)]
    pub totals: BTreeMap<String, u64>,
    /// ISO 日期（`YYYY-MM-DD`）→ 当天事件计数；BTreeMap 的键序即时间序
    #[serde(default)]
    pub daily: BTreeMap<String, BTreeMap<String, u64>>,
    /// 事件名 → 首次发生时间（RFC3339），用于漏斗「首次绑定 / 首次创建」
    #[serde(default)]
    pub first_seen: BTreeMap<String, String>,
}

fn default_schema_version() -> u32 {
    SCHEMA_VERSION
}

impl MetricsSnapshot {
    pub fn new(platform: &str, app_version: &str) -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            platform: platform.to_string(),
            app_version: app_version.to_string(),
            updated_at: String::new(),
            totals: BTreeMap::new(),
            daily: BTreeMap::new(),
            first_seen: BTreeMap::new(),
        }
    }

    /// 累加一次事件（纯函数，不落盘）。
    pub fn record(&mut self, event: MetricEvent, day: &str, timestamp: &str) {
        let name = event.as_str();
        *self.totals.entry(name.to_string()).or_insert(0) += 1;
        *self
            .daily
            .entry(day.to_string())
            .or_default()
            .entry(name.to_string())
            .or_insert(0) += 1;
        self.first_seen
            .entry(name.to_string())
            .or_insert_with(|| timestamp.to_string());
        self.updated_at = timestamp.to_string();
    }

    /// 只保留最近 `keep_days` 天的明细（按 ISO 日期字典序裁剪最旧的天）。
    pub fn prune_daily(&mut self, keep_days: usize) {
        while self.daily.len() > keep_days {
            let Some(oldest) = self.daily.keys().next().cloned() else {
                break;
            };
            self.daily.remove(&oldest);
        }
    }

    pub fn total(&self, event: MetricEvent) -> u64 {
        self.totals.get(event.as_str()).copied().unwrap_or(0)
    }

    /// 近 `days` 天里有过事件的天数（周活跃天数的原始口径）。
    pub fn active_days(&self, days: usize) -> usize {
        self.window(days)
            .filter(|day| day.values().any(|count| *count > 0))
            .count()
    }

    /// 近 `days` 天的同步成功率；没有样本时返回 None（不制造 0% 假象）。
    pub fn sync_success_rate(&self, days: usize) -> Option<f64> {
        let mut succeeded = 0_u64;
        let mut failed = 0_u64;
        for day in self.window(days) {
            succeeded += count_of(day, "sync_succeeded");
            failed += count_of(day, "sync_failed");
        }
        let attempts = succeeded + failed;
        if attempts == 0 {
            return None;
        }
        Some(succeeded as f64 / attempts as f64)
    }

    /// 交给前端的视图：白名单事件全部列出（缺省为 0），便于漏斗稳定渲染。
    pub fn to_dto(&self) -> MetricsDto {
        MetricsDto {
            platform: self.platform.clone(),
            app_version: self.app_version.clone(),
            updated_at: self.updated_at.clone(),
            totals: METRIC_EVENTS
                .iter()
                .map(|name| MetricsTotalDto {
                    event: (*name).to_string(),
                    count: self.totals.get(*name).copied().unwrap_or(0),
                    first_seen: self.first_seen.get(*name).cloned(),
                })
                .collect(),
            active_days: self.active_days(WEEK_WINDOW_DAYS),
            sync_success_rate: self.sync_success_rate(WEEK_WINDOW_DAYS),
        }
    }

    fn window(&self, days: usize) -> impl Iterator<Item = &BTreeMap<String, u64>> {
        let skip = self.daily.len().saturating_sub(days);
        self.daily.values().skip(skip)
    }
}

fn count_of(day: &BTreeMap<String, u64>, event: &str) -> u64 {
    day.get(event).copied().unwrap_or(0)
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricsTotalDto {
    pub event: String,
    pub count: u64,
    pub first_seen: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricsDto {
    pub platform: String,
    pub app_version: String,
    pub updated_at: String,
    pub totals: Vec<MetricsTotalDto>,
    /// 近 7 天有过事件的天数
    pub active_days: usize,
    /// 近 7 天同步成功率（0.0–1.0）；无样本为 null
    pub sync_success_rate: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn recorded(entries: &[(&str, MetricEvent)]) -> MetricsSnapshot {
        let mut snapshot = MetricsSnapshot::new("macos", "0.25.0");
        for (day, event) in entries {
            snapshot.record(*event, day, &format!("{day}T10:00:00Z"));
        }
        snapshot
    }

    #[test]
    fn event_names_round_trip_and_reject_unknown() {
        for name in METRIC_EVENTS {
            let event = MetricEvent::parse(name).expect("白名单事件应可解析");
            assert_eq!(event.as_str(), name);
        }
        assert!(MetricEvent::parse("note_content").is_none());
        assert!(MetricEvent::parse("").is_none());
    }

    #[test]
    fn record_accumulates_totals_daily_and_first_seen() {
        let snapshot = recorded(&[
            ("2026-09-08", MetricEvent::SyncSucceeded),
            ("2026-09-08", MetricEvent::SyncSucceeded),
            ("2026-09-09", MetricEvent::SyncSucceeded),
        ]);
        assert_eq!(snapshot.total(MetricEvent::SyncSucceeded), 3);
        assert_eq!(snapshot.daily["2026-09-08"]["sync_succeeded"], 2);
        assert_eq!(
            snapshot.first_seen["sync_succeeded"],
            "2026-09-08T10:00:00Z"
        );
        assert_eq!(snapshot.updated_at, "2026-09-09T10:00:00Z");
        assert_eq!(snapshot.total(MetricEvent::NoteCreated), 0);
    }

    #[test]
    fn record_never_stores_paths_or_content() {
        let snapshot = recorded(&[("2026-09-09", MetricEvent::NoteCreated)]);
        let json = serde_json::to_string(&snapshot).expect("快照应可序列化");
        assert!(json.contains("note_created"));
        for sensitive in [".md", "/Users/", "ghp_", "sk-", "repoUrl", "title"] {
            assert!(!json.contains(sensitive), "不应出现敏感字段: {sensitive}");
        }
    }

    #[test]
    fn prune_daily_keeps_most_recent_days() {
        let mut snapshot = recorded(&[
            ("2026-09-01", MetricEvent::AppLaunched),
            ("2026-09-02", MetricEvent::AppLaunched),
            ("2026-09-03", MetricEvent::AppLaunched),
        ]);
        snapshot.prune_daily(2);
        assert_eq!(
            snapshot.daily.keys().cloned().collect::<Vec<_>>(),
            vec!["2026-09-02".to_string(), "2026-09-03".to_string()]
        );
        // 累计计数不受窗口裁剪影响（漏斗口径按累计 + 窗口分别取值）
        assert_eq!(snapshot.total(MetricEvent::AppLaunched), 3);
    }

    #[test]
    fn prune_daily_is_noop_within_window() {
        let mut snapshot = recorded(&[("2026-09-09", MetricEvent::AppLaunched)]);
        snapshot.prune_daily(DAILY_WINDOW_DAYS);
        assert_eq!(snapshot.daily.len(), 1);
    }

    #[test]
    fn active_days_counts_only_window() {
        let snapshot = recorded(&[
            ("2026-08-01", MetricEvent::AppLaunched),
            ("2026-09-04", MetricEvent::AppLaunched),
            ("2026-09-05", MetricEvent::NoteCreated),
            ("2026-09-06", MetricEvent::SyncSucceeded),
        ]);
        assert_eq!(snapshot.active_days(3), 3);
        assert_eq!(snapshot.active_days(2), 2);
    }

    #[test]
    fn sync_success_rate_uses_recent_window() {
        let snapshot = recorded(&[
            ("2026-09-04", MetricEvent::SyncSucceeded),
            ("2026-09-05", MetricEvent::SyncSucceeded),
            ("2026-09-05", MetricEvent::SyncFailed),
            ("2026-09-05", MetricEvent::SyncFailed),
        ]);
        // 全窗口：2 成功 / 4 次尝试
        assert_eq!(snapshot.sync_success_rate(7), Some(0.5));
        assert_eq!(snapshot.sync_success_rate(30), Some(0.5));
        // 只取最近 1 天：1 成功 / 3 次尝试
        assert_eq!(snapshot.sync_success_rate(1), Some(1.0 / 3.0));
    }

    #[test]
    fn sync_success_rate_is_none_without_samples() {
        let snapshot = recorded(&[("2026-09-05", MetricEvent::AppLaunched)]);
        assert_eq!(snapshot.sync_success_rate(7), None);
        assert_eq!(MetricsSnapshot::new("macos", "0.25.0").sync_success_rate(7), None);
    }

    #[test]
    fn dto_lists_whitelist_events_in_order() {
        let snapshot = recorded(&[("2026-09-09", MetricEvent::RepoBound)]);
        let dto = snapshot.to_dto();
        assert_eq!(
            dto.totals.iter().map(|item| item.event.clone()).collect::<Vec<_>>(),
            METRIC_EVENTS.to_vec()
        );
        assert_eq!(dto.totals[1].count, 1);
        assert_eq!(dto.totals[1].first_seen.as_deref(), Some("2026-09-09T10:00:00Z"));
        assert_eq!(dto.active_days, 1);
        assert_eq!(dto.platform, "macos");
    }

    #[test]
    fn snapshot_deserializes_with_missing_fields() {
        let snapshot: MetricsSnapshot =
            serde_json::from_str(r#"{"totals":{"note_created":2}}"#).expect("缺字段应可反序列化");
        assert_eq!(snapshot.schema_version, SCHEMA_VERSION);
        assert_eq!(snapshot.total(MetricEvent::NoteCreated), 2);
        assert!(snapshot.daily.is_empty());
    }
}
