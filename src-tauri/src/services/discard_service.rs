use std::collections::BTreeSet;
use std::path::{Component, Path};

use crate::domain::discard::DiscardReport;
use crate::domain::error::AppError;
use crate::repositories::git_backend::GitBackend;

/// 用例：丢弃选中路径的本地改动 —— HEAD 中存在则恢复到该版本，否则（新增）删除工作区文件。
///
/// 写操作，不涉及网络。执行前做两件防御：
/// 1. 合并进行中直接拒绝（`SYNC_4006`）：checkout 会破坏 merge 状态，先让用户解决冲突；
/// 2. 重新读取待提交变更做复核，只处理确实是 dirty 的路径，其余进 `skipped`——
///    面板列表可能已过期（外部同步、别的窗口提交），不复核会误删已提交的内容。
pub fn discard<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    files: &[String],
) -> Result<DiscardReport, AppError> {
    let paths = normalize_paths(files)?;
    if paths.is_empty() {
        return Ok(DiscardReport::default());
    }
    let path = repo_path.to_string_lossy();
    if backend.is_merging(&path)? {
        return Err(AppError::DiscardBlocked(
            "存在未解决的合并冲突，请先解决冲突后再丢弃改动".into(),
        ));
    }
    let dirty: BTreeSet<String> = backend
        .changed_files(&path)?
        .into_iter()
        .map(|file| file.path)
        .collect();
    let (targets, skipped): (Vec<String>, Vec<String>) =
        paths.into_iter().partition(|file| dirty.contains(file));
    if targets.is_empty() {
        return Ok(DiscardReport {
            restored: Vec::new(),
            deleted: Vec::new(),
            skipped,
        });
    }
    let mut report = backend.discard_working(&path, &targets)?;
    report.skipped = skipped;
    Ok(report)
}

/// 校验 + 去重 + 排序，保证调用顺序确定（BTreeSet 同时完成去重与字典序）。
fn normalize_paths(files: &[String]) -> Result<Vec<String>, AppError> {
    let mut paths = BTreeSet::new();
    for file in files {
        paths.insert(validate_repo_rel_path(file)?);
    }
    Ok(paths.into_iter().collect())
}

/// 仓库相对路径校验（比笔记路径宽松）：允许 `.ainote/`、`.trash/`、`.gitignore`
/// 这类隐藏路径（它们同样是待提交变更），但拒绝绝对路径、`..`、`.` 段与首段 `.git`
/// ——写进 `.git/` 会破坏仓库，宁可拒绝。
fn validate_repo_rel_path(rel: &str) -> Result<String, AppError> {
    let invalid = || AppError::InvalidPath(rel.to_string());
    if rel.is_empty() || Path::new(rel).is_absolute() {
        return Err(invalid());
    }
    for (index, component) in Path::new(rel).components().enumerate() {
        match component {
            Component::Normal(seg) if index == 0 && seg == ".git" => return Err(invalid()),
            Component::Normal(_) => {}
            _ => return Err(invalid()),
        }
    }
    Ok(rel.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    use crate::domain::sync::{ChangedFile, ChangedFileStatus};
    use crate::repositories::git_backend::MockGitBackend;

    fn root() -> PathBuf {
        PathBuf::from("/repo")
    }

    fn dirty(path: &str) -> ChangedFile {
        ChangedFile {
            path: path.into(),
            status: ChangedFileStatus::Modified,
        }
    }

    #[test]
    fn discards_only_dirty_paths_and_reports_skipped() {
        let mock = MockGitBackend {
            changed: vec![dirty("a.md"), dirty("b.md")],
            ..Default::default()
        };
        let report = discard(
            &mock,
            &root(),
            &["b.md".into(), "gone.md".into(), "a.md".into()],
        )
        .unwrap();

        assert_eq!(report.restored, vec!["a.md", "b.md"], "按路径排序后传给 Repository");
        assert_eq!(report.skipped, vec!["gone.md"], "已不是变更的路径只记录不执行");
        assert_eq!(
            mock.recorded(),
            vec!["changed_files", "discard:a.md,b.md"],
            "复核后才触达 Repository，且只传复核通过的路径"
        );
    }

    #[test]
    fn skips_everything_when_nothing_is_dirty_anymore() {
        let mock = MockGitBackend::default();
        let report = discard(&mock, &root(), &["a.md".into()]).unwrap();

        assert_eq!(report, DiscardReport {
            restored: Vec::new(),
            deleted: Vec::new(),
            skipped: vec!["a.md".into()],
        });
        assert_eq!(mock.recorded(), vec!["changed_files"], "无 dirty 路径时不执行丢弃");
    }

    #[test]
    fn merging_repository_is_rejected_before_any_write() {
        let mock = MockGitBackend {
            merging: true,
            changed: vec![dirty("a.md")],
            ..Default::default()
        };
        let err = discard(&mock, &root(), &["a.md".into()]).unwrap_err();

        assert!(matches!(err, AppError::DiscardBlocked(_)));
        assert!(mock.recorded().is_empty(), "拒绝时不读状态、不写工作区");
    }

    #[test]
    fn empty_selection_is_a_no_op() {
        let mock = MockGitBackend::default();
        assert_eq!(discard(&mock, &root(), &[]).unwrap().changed_count(), 0);
        assert!(mock.recorded().is_empty());
    }

    #[test]
    fn added_files_are_reported_as_deleted() {
        let mock = MockGitBackend {
            changed: vec![dirty("new.md")],
            discard_as_deleted: vec!["new.md".into()],
            ..Default::default()
        };
        let report = discard(&mock, &root(), &["new.md".into()]).unwrap();

        assert_eq!(report.deleted, vec!["new.md"]);
        assert!(report.restored.is_empty());
    }

    #[test]
    fn propagates_repository_failure() {
        let mock = MockGitBackend {
            changed: vec![dirty("a.md")],
            discard_fails: true,
            ..Default::default()
        };
        assert!(matches!(
            discard(&mock, &root(), &["a.md".into()]).unwrap_err(),
            AppError::Io(_)
        ));
    }

    #[test]
    fn hidden_paths_are_allowed_but_git_dir_and_traversal_are_not() {
        let mock = MockGitBackend {
            changed: vec![dirty(".ainote/todos.json"), dirty(".gitignore")],
            ..Default::default()
        };
        let report = discard(
            &mock,
            &root(),
            &[".ainote/todos.json".into(), ".gitignore".into(), ".gitignore".into()],
        )
        .unwrap();
        assert_eq!(
            report.restored,
            vec![".ainote/todos.json", ".gitignore"],
            "隐藏路径合法且去重"
        );

        for bad in ["../evil.md", ".git/config", "", "/etc/passwd"] {
            let mock = MockGitBackend::default();
            assert!(
                matches!(
                    discard(&mock, &root(), &[bad.into()]),
                    Err(AppError::InvalidPath(_))
                ),
                "{bad} 必须被拒绝"
            );
            assert!(mock.recorded().is_empty());
        }
    }
}
