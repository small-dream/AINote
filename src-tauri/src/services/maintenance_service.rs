use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::maintenance::{IntegrityReport, IssueSeverity};
use crate::repositories::repo_maintenance::RepoMaintenanceBackend;

/// 用例：执行仓库完整性检查，并把问题列表汇总为报告。
pub fn check<B: RepoMaintenanceBackend>(
    backend: &B,
    repo_path: &Path,
) -> Result<IntegrityReport, AppError> {
    let issues = backend.check_integrity(repo_path)?;
    let ok = !issues.iter().any(|item| item.severity == IssueSeverity::Error);
    Ok(IntegrityReport { ok, issues })
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;
    use crate::domain::maintenance::issue;

    struct MockMaintenance {
        issues: Vec<crate::domain::maintenance::IntegrityIssue>,
    }

    impl RepoMaintenanceBackend for MockMaintenance {
        fn check_integrity(
            &self,
            _repo_path: &Path,
        ) -> Result<Vec<crate::domain::maintenance::IntegrityIssue>, AppError> {
            Ok(self.issues.clone())
        }
    }

    fn check_with(issues: Vec<crate::domain::maintenance::IntegrityIssue>) -> IntegrityReport {
        check(&MockMaintenance { issues }, Path::new("/tmp/repo")).unwrap()
    }

    #[test]
    fn healthy_report_has_no_issues() {
        let report = check_with(vec![]);
        assert!(report.ok);
        assert!(report.issues.is_empty());
    }

    #[test]
    fn warning_keeps_report_ok() {
        let report = check_with(vec![issue("REPO_3104", "missing origin", "re-add origin")]);
        assert!(report.ok);
        assert_eq!(report.issues.len(), 1);
    }

    #[test]
    fn error_marks_report_not_ok() {
        let report = check_with(vec![issue("REPO_3102", "corrupt object", "restore")]);
        assert!(!report.ok);
    }
}
