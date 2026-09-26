use serde::Serialize;

/// 丢弃本地改动的结果（git_discard_changes 返回）。
/// `restored` 为恢复到 HEAD 版本的已跟踪文件，`deleted` 为彻底删除的新增文件
/// （HEAD 中不存在、没有可恢复的历史版本），`skipped` 为复核时已不再是待提交变更的文件。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscardReport {
    pub restored: Vec<String>,
    pub deleted: Vec<String>,
    pub skipped: Vec<String>,
}

impl DiscardReport {
    /// 本次实际改动了几个文件（skipped 不计入）。
    pub fn changed_count(&self) -> usize {
        self.restored.len() + self.deleted.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn report_serializes_camel_case_and_counts_changes() {
        let report = DiscardReport {
            restored: vec!["a.md".into()],
            deleted: vec!["new.md".into()],
            skipped: vec!["gone.md".into()],
        };
        assert_eq!(report.changed_count(), 2);
        let json = serde_json::to_value(&report).unwrap();
        assert_eq!(json["restored"][0], "a.md");
        assert_eq!(json["deleted"][0], "new.md");
        assert_eq!(json["skipped"][0], "gone.md");
    }
}
