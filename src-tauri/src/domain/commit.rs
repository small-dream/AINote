use super::sync::{ChangedFile, ChangedFileStatus};

/// 手动 / 同步前自动提交的 commit message 生成（纯函数）。
/// 规则：subject = `chore: <时间> · 更新 N 个文件`，body 列出每个文件的变更类型与路径；
/// 无变更文件时返回空字符串（调用方不应执行提交）。
///
/// 时间格式由调用方注入（如 `2026-09-10 14:30`），保证 domain 层零外部依赖。
pub fn build_commit_message(files: &[ChangedFile], timestamp: &str) -> String {
    if files.is_empty() {
        return String::new();
    }
    let mut lines: Vec<String> = Vec::with_capacity(files.len() + 2);
    lines.push(format!("chore: {timestamp} · 更新 {} 个文件", files.len()));
    lines.push(String::new());
    for file in files {
        lines.push(format!("{} {}", status_letter(file.status), file.path));
    }
    lines.join("\n")
}

fn status_letter(status: ChangedFileStatus) -> &'static str {
    match status {
        ChangedFileStatus::Added => "A",
        ChangedFileStatus::Modified => "M",
        ChangedFileStatus::Deleted => "D",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(path: &str, status: ChangedFileStatus) -> ChangedFile {
        ChangedFile {
            path: path.into(),
            status,
        }
    }

    #[test]
    fn empty_files_yield_empty_message() {
        assert_eq!(build_commit_message(&[], "2026-09-10 14:30"), "");
    }

    #[test]
    fn single_modified_file_has_subject_and_body() {
        let files = vec![file("daily/2026-09-10.md", ChangedFileStatus::Modified)];
        let message = build_commit_message(&files, "2026-09-10 14:30");
        assert_eq!(
            message,
            "chore: 2026-09-10 14:30 · 更新 1 个文件\n\nM daily/2026-09-10.md"
        );
    }

    #[test]
    fn mixed_statuses_are_kept_in_given_order() {
        let files = vec![
            file("a.md", ChangedFileStatus::Modified),
            file("new.md", ChangedFileStatus::Added),
            file("old.md", ChangedFileStatus::Deleted),
        ];
        let message = build_commit_message(&files, "2026-09-10 14:30");
        assert_eq!(
            message,
            "chore: 2026-09-10 14:30 · 更新 3 个文件\n\nM a.md\nA new.md\nD old.md"
        );
    }
}
