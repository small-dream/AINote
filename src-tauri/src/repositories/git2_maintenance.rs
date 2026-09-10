use std::fs;
use std::path::Path;

use git2::Repository;

use crate::domain::error::AppError;
use crate::domain::maintenance::{issue, IntegrityIssue};

use super::repo_maintenance::RepoMaintenanceBackend;

/// 仓库维护的 libgit2 实现；所有检查均为只读，不写入仓库。
pub struct Git2Maintenance;

impl RepoMaintenanceBackend for Git2Maintenance {
    fn check_integrity(&self, repo_path: &Path) -> Result<Vec<IntegrityIssue>, AppError> {
        if !repo_path.is_dir() {
            return Err(AppError::InvalidPath(format!(
                "repository not found: {}",
                repo_path.display()
            )));
        }
        let mut issues = Vec::new();
        let repo = match Repository::open(repo_path) {
            Ok(repo) => repo,
            Err(err) => {
                issues.push(issue(
                    "REPO_3101",
                    format!("无法打开 Git 仓库：{}", err.message()),
                    "确认仓库目录存在且 .git 未被删除；必要时从备份恢复。",
                ));
                return Ok(issues);
            }
        };
        check_objects(&repo, &mut issues);
        check_index(&repo, &mut issues);
        check_origin(&repo, &mut issues);
        check_upstream(&repo, &mut issues);
        check_permissions(repo_path, &mut issues);
        Ok(issues)
    }
}

/// 逐个读取对象数据库中的对象；损坏 / 缺失对象会被 libgit2 报错。
fn check_objects(repo: &Repository, issues: &mut Vec<IntegrityIssue>) {
    let odb = match repo.odb() {
        Ok(odb) => odb,
        Err(err) => {
            issues.push(issue(
                "REPO_3102",
                format!("无法读取对象数据库：{}", err.message()),
                "从备份恢复仓库，或重新克隆远端。",
            ));
            return;
        }
    };
    let mut corrupt: Option<String> = None;
    let walk = odb.foreach(|oid| match odb.read(*oid) {
        Ok(_) => true,
        Err(err) => {
            corrupt = Some(format!("{oid}：{}", err.message()));
            false
        }
    });
    if let Some(detail) = corrupt {
        issues.push(issue(
            "REPO_3102",
            format!("Git 对象损坏或缺失（{detail}）"),
            "从备份恢复，或删除本地仓库后重新克隆；请先备份未同步的笔记。",
        ));
    } else if let Err(err) = walk {
        issues.push(issue(
            "REPO_3102",
            format!("遍历 Git 对象失败：{}", err.message()),
            "从备份恢复，或删除本地仓库后重新克隆；请先备份未同步的笔记。",
        ));
    }
}

/// 索引可读且无未解决冲突。
fn check_index(repo: &Repository, issues: &mut Vec<IntegrityIssue>) {
    match repo.index() {
        Err(err) => issues.push(issue(
            "REPO_3103",
            format!("无法读取 Git 索引：{}", err.message()),
            "删除 .git/index 后重新打开仓库；未提交的改动请先备份。",
        )),
        Ok(index) if index.has_conflicts() => issues.push(issue(
            "REPO_3103",
            "Git 索引中存在未解决的冲突",
            "打开同步冲突处理完成合并，或重新拉取远端后再检查。",
        )),
        Ok(_) => {}
    }
}

/// 是否配置了 origin 远端。
fn check_origin(repo: &Repository, issues: &mut Vec<IntegrityIssue>) {
    if repo.find_remote("origin").is_err() {
        issues.push(issue(
            "REPO_3104",
            "未配置 origin 远端，无法同步到 GitHub",
            "在设置中重新绑定 GitHub 仓库，或执行 git remote add origin <url>。",
        ));
    }
}

/// 当前分支是否已提交并设置了上游。
fn check_upstream(repo: &Repository, issues: &mut Vec<IntegrityIssue>) {
    let head = match repo.head() {
        Ok(head) => head,
        Err(_) => {
            issues.push(issue(
                "REPO_3105",
                "仓库尚无提交，当前分支还没有上游",
                "创建第一篇笔记并同步后，上游会自动建立。",
            ));
            return;
        }
    };
    let Some(branch) = head.shorthand() else {
        return;
    };
    let refname = format!("refs/heads/{branch}");
    if repo.branch_upstream_name(&refname).is_err() {
        issues.push(issue(
            "REPO_3105",
            format!("当前分支 {branch} 没有上游分支"),
            "执行一次同步；或在终端执行 git push -u origin <branch>。",
        ));
    }
}

/// 仓库目录与 .git 目录是否可写（按权限位判断，不实际写入）。
fn check_permissions(repo_path: &Path, issues: &mut Vec<IntegrityIssue>) {
    check_writable(&repo_path.join(".git"), "REPO_3107", ".git 目录", issues);
    check_writable(repo_path, "REPO_3106", "仓库目录", issues);
}

fn check_writable(path: &Path, code: &str, label: &str, issues: &mut Vec<IntegrityIssue>) {
    match fs::metadata(path) {
        Ok(meta) if meta.permissions().readonly() => issues.push(issue(
            code,
            format!("{label}不可写：{}", path.display()),
            "检查文件权限或磁盘挂载状态；修复后再同步。",
        )),
        Ok(_) => {}
        Err(err) => issues.push(issue(
            code,
            format!("无法访问{label}：{err}"),
            "确认目录存在且当前用户有访问权限。",
        )),
    }
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use git2::IndexAddOption;
    use tempfile::tempdir;

    use super::*;

    fn init_repo(path: &Path) {
        let repo = Repository::init(path).unwrap();
        {
            let mut config = repo.config().unwrap();
            config.set_str("user.name", "AINote").unwrap();
            config.set_str("user.email", "ainote@localhost").unwrap();
        }
        fs::write(path.join("note.md"), "hello").unwrap();
        let mut index = repo.index().unwrap();
        index.add_all(["*"], IndexAddOption::DEFAULT, None).unwrap();
        index.write().unwrap();
        let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
        let sig = repo.signature().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[]).unwrap();
    }

    fn codes(issues: &[IntegrityIssue]) -> Vec<String> {
        issues.iter().map(|item| item.code.clone()).collect()
    }

    #[test]
    fn healthy_repo_without_origin_reports_no_error() {
        let tmp = tempdir().unwrap();
        init_repo(tmp.path());

        let issues = Git2Maintenance.check_integrity(tmp.path()).unwrap();
        assert!(!issues.iter().any(|item| item.severity == crate::domain::maintenance::IssueSeverity::Error));
        assert!(codes(&issues).contains(&"REPO_3104".to_string()));
    }

    #[test]
    fn reports_missing_origin_as_warning() {
        let tmp = tempdir().unwrap();
        init_repo(tmp.path());

        let issues = Git2Maintenance.check_integrity(tmp.path()).unwrap();
        let origin = issues.iter().find(|item| item.code == "REPO_3104").unwrap();
        assert_eq!(origin.severity, crate::domain::maintenance::IssueSeverity::Warning);
        assert!(!origin.fix_hint.is_empty());
    }

    #[test]
    fn detects_corrupted_loose_object() {
        let tmp = tempdir().unwrap();
        init_repo(tmp.path());
        corrupt_first_object(tmp.path());

        let issues = Git2Maintenance.check_integrity(tmp.path()).unwrap();
        let corrupt = issues.iter().find(|item| item.code == "REPO_3102").unwrap();
        assert_eq!(corrupt.severity, crate::domain::maintenance::IssueSeverity::Error);
        assert!(!corrupt.fix_hint.is_empty());
    }

    fn corrupt_first_object(repo_path: &Path) {
        let objects = repo_path.join(".git/objects");
        for entry in fs::read_dir(&objects).unwrap().flatten() {
            if !entry.path().is_dir() {
                continue;
            }
            for inner in fs::read_dir(entry.path()).unwrap().flatten() {
                let path = inner.path();
                if path.is_file() {
                    let mut perms = fs::metadata(&path).unwrap().permissions();
                    perms.set_readonly(false);
                    fs::set_permissions(&path, perms).unwrap();
                    let mut file = fs::File::create(&path).unwrap();
                    file.write_all(b"not a valid zlib object").unwrap();
                    return;
                }
            }
        }
        panic!("no loose object found to corrupt");
    }
}
