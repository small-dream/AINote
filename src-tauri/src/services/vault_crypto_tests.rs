use super::*;
use crate::domain::vault::{is_envelope, ENVELOPE_LINE_WIDTH};

/// 测试用低成本 KDF 参数：真实参数（64 MiB ×3）在单测里会拖慢整条流水线。
fn cheap_kdf() -> KdfParams {
    KdfParams {
        alg: KDF_ALG.to_string(),
        salt: b64_encode(&[7u8; SALT_LEN]),
        memory_kib: 8 * 1024,
        iterations: 1,
        parallelism: 1,
    }
}

fn master() -> Zeroizing<[u8; MASTER_KEY_LEN]> {
    Zeroizing::new([42u8; MASTER_KEY_LEN])
}

fn other_master() -> Zeroizing<[u8; MASTER_KEY_LEN]> {
    Zeroizing::new([43u8; MASTER_KEY_LEN])
}

#[test]
fn kdf_is_deterministic_and_salt_sensitive() {
    let params = cheap_kdf();
    let a = derive_kek("correct horse battery", &params).unwrap();
    let b = derive_kek("correct horse battery", &params).unwrap();
    assert_eq!(a.as_ref(), b.as_ref(), "同口令同盐必须得到同一 KEK");

    let other_pass = derive_kek("correct horse batterz", &params).unwrap();
    assert_ne!(a.as_ref(), other_pass.as_ref());

    let mut other_salt = cheap_kdf();
    other_salt.salt = b64_encode(&[9u8; SALT_LEN]);
    let salted = derive_kek("correct horse battery", &other_salt).unwrap();
    assert_ne!(a.as_ref(), salted.as_ref(), "换盐必须换 KEK");
}

#[test]
fn new_kdf_params_uses_default_strength_and_fresh_salt() {
    let first = new_kdf_params().unwrap();
    let second = new_kdf_params().unwrap();
    assert_eq!(first.memory_kib, ARGON2_M_KIB);
    assert_eq!(first.iterations, ARGON2_ITERATIONS);
    assert_eq!(first.alg, KDF_ALG);
    assert_ne!(first.salt, second.salt, "盐必须每次都随机");
}

#[test]
fn derive_kek_rejects_malformed_salt() {
    let mut broken = cheap_kdf();
    broken.salt = "not-base64!!".to_string();
    assert!(matches!(
        derive_kek("correct horse battery", &broken),
        Err(AppError::VaultInvalid(_))
    ));

    let mut short = cheap_kdf();
    short.salt = b64_encode(&[1u8; 4]);
    assert!(matches!(
        derive_kek("correct horse battery", &short),
        Err(AppError::VaultInvalid(_))
    ));
}

#[test]
fn wrap_and_unwrap_round_trip_with_correct_passphrase() {
    let kdf = cheap_kdf();
    let kek = derive_kek("correct horse battery", &kdf).unwrap();
    let wrapped = wrap_master_key(&kek, &master()).unwrap();
    assert_eq!(wrapped.alg, WRAP_ALG);
    assert_ne!(wrapped.ciphertext, b64_encode(&master()[..]));

    let unwrapped = unwrap_master_key(&kek, &wrapped).unwrap();
    assert_eq!(unwrapped.as_ref(), master().as_ref());
}

#[test]
fn unwrap_fails_for_wrong_passphrase_and_tampered_wrap() {
    let kdf = cheap_kdf();
    let wrapped = wrap_master_key(&derive_kek("correct horse battery", &kdf).unwrap(), &master())
        .unwrap();

    let wrong = derive_kek("correct horse batterz", &kdf).unwrap();
    assert!(matches!(
        unwrap_master_key(&wrong, &wrapped),
        Err(AppError::VaultUnlockFailed(_))
    ));

    let mut tampered = wrapped.clone();
    let mut raw = b64_decode(&tampered.ciphertext, "c").unwrap();
    raw[0] ^= 0x01;
    tampered.ciphertext = b64_encode(&raw);
    assert!(matches!(
        unwrap_master_key(&derive_kek("correct horse battery", &kdf).unwrap(), &tampered),
        Err(AppError::VaultUnlockFailed(_))
    ));
}

#[test]
fn note_round_trips_markdown_rich_text_and_edge_cases() {
    let master = master();
    for plain in [
        "# 标题\n\n正文 with **强调** 与 emoji 🎉\n",
        r#"{"type":"doc","content":[{"type":"paragraph"}]}"#,
        "",
    ] {
        let envelope = encrypt_note(&master, plain).unwrap();
        assert!(is_envelope(&envelope));
        assert_eq!(decrypt_note(&master, &envelope).unwrap(), plain);
    }
}

#[test]
fn note_encryption_is_deterministic_for_git_delta() {
    let master = master();
    let once = encrypt_note(&master, "# 同一篇笔记\n正文").unwrap();
    let twice = encrypt_note(&master, "# 同一篇笔记\n正文").unwrap();
    assert_eq!(once, twice, "同内容必须同密文，否则 Git 每次编辑整文件全变");

    let changed = encrypt_note(&master, "# 同一篇笔记\n正文改").unwrap();
    assert_ne!(once, changed);
}

#[test]
fn envelope_output_is_git_friendly() {
    let envelope = encrypt_note(&master(), &"正文".repeat(200)).unwrap();
    let mut lines = envelope.lines();
    assert_eq!(lines.next().unwrap(), "AINOTE-ENC-v1");
    assert!(envelope.ends_with('\n'));
    for line in envelope.lines().skip(1) {
        assert!(line.chars().count() <= ENVELOPE_LINE_WIDTH);
        assert!(line.chars().all(|c| !c.is_whitespace()));
    }
}

#[test]
fn decrypt_rejects_wrong_key_tampering_and_plain_text() {
    let master = master();
    let envelope = encrypt_note(&master, "机密正文").unwrap();

    assert!(matches!(
        decrypt_note(&other_master(), &envelope),
        Err(AppError::VaultCorrupt(_))
    ));
    assert!(matches!(
        decrypt_note(&master, "# 还没加密的笔记"),
        Err(AppError::VaultCorrupt(_))
    ));
    assert!(matches!(
        decrypt_note(&master, "AINOTE-ENC-v1\n"),
        Err(AppError::VaultCorrupt(_))
    ));

    let mut raw = b64_decode(&envelope_payload(&envelope).unwrap(), "c").unwrap();
    let last = raw.len() - 1;
    raw[last] ^= 0x01;
    let tampered = encode_envelope(&b64_encode(&raw));
    assert!(
        matches!(decrypt_note(&master, &tampered), Err(AppError::VaultCorrupt(_))),
        "篡改密文必须被 SIV 校验拒绝"
    );
}

#[test]
fn large_note_round_trips() {
    let master = master();
    let plain = "# 大文档\n".to_string() + &"段落内容 with mixed ASCII 与中文。\n".repeat(8_000);
    let envelope = encrypt_note(&master, &plain).unwrap();
    assert_eq!(decrypt_note(&master, &envelope).unwrap(), plain);
}

#[test]
fn master_key_is_random_each_time() {
    let first = new_master_key().unwrap();
    let second = new_master_key().unwrap();
    assert_ne!(first.as_ref(), second.as_ref());
}
