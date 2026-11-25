use std::fs;
use std::io::Read;
use std::path::Path;

use git2::{DiffOptions, ObjectType, Repository, Tree};

use crate::domain::error::AppError;
use crate::domain::history::{DiffLine, DiffLineKind};
use crate::domain::vault::ENVELOPE_MAGIC;
use crate::domain::working_diff::WorkingDiff;

use super::git2_backend::{blob_is_envelope, open, to_git};

/// 单次 diff 的显示上限：超过后截断并如实告知，避免大文件把前端卡死。
const MAX_LINES: usize = 4_000;
const MAX_TEXT_BYTES: usize = 512 * 1024;
/// 单行上限：压缩过的单行文件（如长 JSON）不能让一行撑爆滚动区。
const MAX_LINE_CHARS: usize = 2_000;
/// libgit2 把超过该体积的文件按二进制处理，避免读取超大附件内容。
const MAX_BLOB_BYTES: i64 = 2 * 1024 * 1024;
/// 判定信封只需读取首行；限制预读字节数，避免对超大二进制文件做无界读取。
const ENVELOPE_PREFIX_BYTES: usize = 64;

/// 待提交文件相对 HEAD 的 diff（`HEAD` 树 → 工作区，含已暂存与未暂存改动）。
///
/// 与 `changed_files` 的变更集保持一致：未跟踪的新文件设置 `include_untracked` 后也会出现。
/// 加密笔记与二进制文件不返回正文，只返回标记，前端给明确提示。
pub fn working_diff(repo_path: &str, file: &str) -> Result<WorkingDiff, AppError> {
    let repo = open(repo_path)?;
    let head_tree = head_tree(&repo)?;
    if is_encrypted(repo_path, &repo, head_tree.as_ref(), file)? {
        return Ok(WorkingDiff {
            path: file.to_string(),
            lines: Vec::new(),
            binary: false,
            encrypted: true,
            truncated: false,
        });
    }

    let worktree = Path::new(repo_path).join(file);
    if head_tree
        .as_ref()
        .and_then(|tree| tree.get_path(Path::new(file)).ok())
        .is_none()
    {
        // HEAD 中不存在：新增文件（含未跟踪与空仓库）。libgit2 的 tree→workdir
        // 在带 pathspec 时不产出未跟踪文件，这里直接按「空文件 → 当前内容」生成。
        return added_file_diff(file, &worktree, &repo);
    }

    let mut opts = DiffOptions::new();
    opts.pathspec(file)
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false)
        .max_size(MAX_BLOB_BYTES);
    let diff = repo
        .diff_tree_to_workdir(head_tree.as_ref(), Some(&mut opts))
        .map_err(to_git)?;
    let collected = collect_diff_lines(diff)?;
    Ok(WorkingDiff {
        path: file.to_string(),
        lines: collected.lines,
        binary: collected.binary,
        encrypted: false,
        truncated: collected.truncated,
    })
}

/// 新增文件：逐行标记为 Added。超过体积上限时只读前一段并标记截断；
/// 二进制判定沿用 git 的经验规则（前 8000 字节出现 NUL）。
fn added_file_diff(file: &str, path: &Path, repo: &Repository) -> Result<WorkingDiff, AppError> {
    let empty = || WorkingDiff {
        path: file.to_string(),
        lines: Vec::new(),
        binary: false,
        encrypted: false,
        truncated: false,
    };
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return Ok(empty());
    };
    if repo.status_should_ignore(Path::new(file)).unwrap_or(false) {
        return Ok(empty());
    }
    // 符号链接只展示链接目标（与 git 对 symlink 的表示一致），绝不跟随到仓库外读取内容。
    if metadata.file_type().is_symlink() {
        let target = fs::read_link(path)
            .map_err(|err| AppError::io_context("读取符号链接失败", path, err))?;
        return Ok(WorkingDiff {
            path: file.to_string(),
            lines: vec![DiffLine {
                kind: DiffLineKind::Added,
                text: target.to_string_lossy().into_owned(),
            }],
            binary: false,
            encrypted: false,
            truncated: false,
        });
    }
    if !metadata.is_file() {
        return Ok(empty());
    }
    let too_large = metadata.len() > MAX_BLOB_BYTES as u64;
    let mut buffer = Vec::new();
    fs::File::open(path)
        .and_then(|file| file.take(MAX_BLOB_BYTES as u64).read_to_end(&mut buffer))
        .map_err(|err| AppError::io_context("读取文件失败", path, err))?;
    if buffer.iter().take(8_000).any(|byte| *byte == 0) {
        return Ok(WorkingDiff {
            binary: true,
            ..empty()
        });
    }
    let text = String::from_utf8_lossy(&buffer);
    let collected = added_lines(&text, too_large);
    Ok(WorkingDiff {
        path: file.to_string(),
        lines: collected.lines,
        binary: false,
        encrypted: false,
        truncated: collected.truncated,
    })
}

fn added_lines(text: &str, too_large: bool) -> CollectedDiff {
    let mut lines = Vec::new();
    let mut truncated = too_large;
    let mut text_bytes = 0usize;
    let mut parts: Vec<&str> = text.split('\n').collect();
    if text.ends_with('\n') {
        parts.pop();
    }
    for part in parts {
        if lines.len() >= MAX_LINES || text_bytes >= MAX_TEXT_BYTES {
            truncated = true;
            break;
        }
        let trimmed = part.trim_end_matches('\r');
        let clamped = clamp_line(trimmed);
        if clamped != trimmed {
            truncated = true;
        }
        text_bytes += clamped.len();
        lines.push(DiffLine {
            kind: DiffLineKind::Added,
            text: clamped,
        });
    }
    CollectedDiff {
        lines,
        binary: false,
        truncated,
    }
}

/// HEAD 树；unborn HEAD（空仓库）返回 None，此时全部文件按新增处理。
fn head_tree(repo: &Repository) -> Result<Option<Tree<'_>>, AppError> {
    match repo.head() {
        Ok(head) => Ok(Some(head.peel_to_tree().map_err(to_git)?)),
        Err(_) => Ok(None),
    }
}

/// 工作区或 HEAD 侧是否为加密信封：两侧任一为信封就不展示正文。
/// 工作区路径存在时以工作区为准（用户可能已解密成明文，此时应正常展示 diff）。
fn is_encrypted(
    repo_path: &str,
    repo: &Repository,
    head_tree: Option<&Tree<'_>>,
    file: &str,
) -> Result<bool, AppError> {
    let worktree = Path::new(repo_path).join(file);
    if worktree.is_file() {
        return Ok(file_starts_with_envelope(&worktree));
    }
    let Some(entry) = head_tree.and_then(|tree| tree.get_path(Path::new(file)).ok()) else {
        return Ok(false);
    };
    if entry.kind() != Some(ObjectType::Blob) {
        return Ok(false);
    }
    blob_is_envelope(repo, entry.id())
}

/// 只读首行判断信封，预读上限固定，避免超大文件无界读取。
fn file_starts_with_envelope(path: &Path) -> bool {
    let Ok(mut file) = fs::File::open(path) else {
        return false;
    };
    let mut prefix = vec![0u8; ENVELOPE_PREFIX_BYTES];
    let read = file.read(&mut prefix).unwrap_or(0);
    prefix.truncate(read);
    starts_with_envelope(&prefix)
}

/// 首行必须恰好是信封 magic：magic 后紧接换行 / 回车或文件结束。
/// 复用 domain 的 magic 常量，但只比较字节，避免对二进制内容做 UTF-8 转换。
fn starts_with_envelope(bytes: &[u8]) -> bool {
    let magic = ENVELOPE_MAGIC.as_bytes();
    if !bytes.starts_with(magic) {
        return false;
    }
    match bytes.get(magic.len()) {
        None | Some(b'\n') => true,
        // 信封以 `\n` 结尾；容忍 CRLF，但裸 `\r` 不算换行（与 str::lines 的口径一致）。
        Some(b'\r') => matches!(bytes.get(magic.len() + 1), None | Some(b'\n')),
        Some(_) => false,
    }
}

struct CollectedDiff {
    lines: Vec<DiffLine>,
    binary: bool,
    truncated: bool,
}

fn collect_diff_lines(diff: git2::Diff) -> Result<CollectedDiff, AppError> {
    let mut lines = Vec::new();
    // 多个回调共享标志：file / binary / line 回调同时存在，用 Cell 避免重复可变借用。
    let binary = std::cell::Cell::new(false);
    let truncated = std::cell::Cell::new(false);
    let text_bytes = std::cell::Cell::new(0usize);
    diff.foreach(
        &mut |delta, _progress| {
            if delta.flags().is_binary() {
                binary.set(true);
            }
            true
        },
        Some(&mut |_delta, _binary| {
            binary.set(true);
            true
        }),
        Some(&mut |_delta, _hunk| true),
        Some(&mut |_delta, _hunk, line| {
            if lines.len() >= MAX_LINES || text_bytes.get() >= MAX_TEXT_BYTES {
                // 继续遍历但不收集：返回 false 会让 libgit2 以 GIT_EUSER 中断，
                // 被 git2 当成错误；diff 体积已被 max_size 限住，跳过剩余行即可。
                truncated.set(true);
                return true;
            }
            let kind = match line.origin() {
                '+' => DiffLineKind::Added,
                '-' => DiffLineKind::Removed,
                _ => DiffLineKind::Context,
            };
            let raw = String::from_utf8_lossy(line.content());
            let trimmed = raw.trim_end_matches(['\r', '\n']);
            let text = clamp_line(trimmed);
            if text != trimmed {
                truncated.set(true);
            }
            text_bytes.set(text_bytes.get() + text.len());
            lines.push(DiffLine { kind, text });
            true
        }),
    )
    .map_err(to_git)?;
    Ok(CollectedDiff {
        lines,
        binary: binary.get(),
        truncated: truncated.get(),
    })
}

/// 超长单行按字符截断，避免 `String::truncate` 落在 UTF-8 边界之外。
fn clamp_line(text: &str) -> String {
    if text.chars().count() <= MAX_LINE_CHARS {
        return text.to_string();
    }
    let clipped: String = text.chars().take(MAX_LINE_CHARS).collect();
    format!("{clipped}…")
}

#[cfg(test)]
#[path = "git2_working_tests.rs"]
mod git2_working_tests;
