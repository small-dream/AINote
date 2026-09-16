//! 笔记正文读写唯一入口（E3）：信封判定与解密只在这里发生。
//!
//! 为什么必须收口：搜索、wiki 索引、列表取标题、AI 检索上下文原先各自 `read_to_string`，
//! 任何一处漏掉都会表现为「搜不到 / 标题变乱码 / 把密文喂给 AI」。

use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::vault::is_envelope;
use crate::repositories::{note_files, vault_files};
use crate::services::{vault_crypto, vault_service};

/// 扫描类读取的结果：是否加密 + 明文（加密且锁定/损坏时为 None）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NoteRead {
    pub encrypted: bool,
    pub text: Option<String>,
}

impl NoteRead {
    fn plain(text: String) -> Self {
        Self {
            encrypted: false,
            text: Some(text),
        }
    }

    /// 加密但当前不可读（未解锁或密文损坏）。
    pub fn is_locked(&self) -> bool {
        self.encrypted && self.text.is_none()
    }

    /// 读取失败（IO）时的占位：列表等场景只降级为「无标题」，不中断整仓扫描。
    pub fn unreadable() -> Self {
        Self {
            encrypted: false,
            text: None,
        }
    }
}

/// 读取一篇笔记（列表 / 搜索 / wiki / AI 上下文 / 打开笔记共用）。
///
/// - 明文笔记：直接返回原文。
/// - 加密笔记 + 已解锁：返回解密后的明文。
/// - 加密笔记 + 未解锁：`text: None`，调用方决定「跳过」还是「提示解锁」。
/// - 加密笔记但密文损坏/被篡改：返回 `VAULT_9005`（扫描类调用方自行容错跳过，
///   打开单篇时必须让用户看到，否则会永远显示为「需要解锁」）。
pub fn read_file(root: &Path, file: &Path) -> Result<NoteRead, AppError> {
    let raw = read_raw(root, file)?;
    if !is_envelope(&raw) {
        return Ok(NoteRead::plain(raw));
    }
    match vault_service::session_master(root) {
        Ok(master) => Ok(NoteRead {
            encrypted: true,
            text: Some(vault_crypto::decrypt_note(&master, &raw)?),
        }),
        Err(AppError::VaultLocked(_)) => Ok(NoteRead {
            encrypted: true,
            text: None,
        }),
        Err(err) => Err(err),
    }
}

/// 写入笔记：目标文件已是信封时继续以密文落盘（保持加密态），否则写明文。
/// 加密笔记在锁定态写入会被拒（`VAULT_9001`），避免把密文覆盖成明文或被静默改写。
pub fn write_text(root: &Path, rel: &str, content: &str) -> Result<(), AppError> {
    let file = root.join(note_files::validate_rel_path(rel)?);
    let payload = if vault_files::is_envelope_file(&file) {
        encrypt_text(root, content)?
    } else {
        content.to_string()
    };
    note_files::write_note(root, rel, &payload)
}

/// 按当前会话主密钥加密一段正文（转换笔记类型、加密单篇笔记时复用）。
pub fn encrypt_text(root: &Path, plain: &str) -> Result<String, AppError> {
    let master = vault_service::session_master(root)?;
    vault_crypto::encrypt_note(&master, plain)
}

/// 该文件是否处于加密态（只看首行）。
pub fn is_encrypted_file(file: &Path) -> bool {
    vault_files::is_envelope_file(file)
}

fn read_raw(root: &Path, file: &Path) -> Result<String, AppError> {
    // 复用仓库相对路径校验（含隐藏段/路径穿越防御）与 NoteNotFound 语义。
    note_files::read_note(root, &rel_of(root, file))
}

fn rel_of(root: &Path, file: &Path) -> String {
    file.strip_prefix(root)
        .map(|rel| rel.to_string_lossy().into_owned())
        .unwrap_or_else(|_| file.to_string_lossy().into_owned())
}

#[cfg(test)]
#[path = "note_content_tests.rs"]
mod note_content_tests;
