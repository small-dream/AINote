use super::*;

const APK_URL: &str =
    "https://github.com/small-dream/AINote/releases/download/v0.26.2/AINote-v0.26.2-android-arm64.apk";

#[test]
fn allows_only_official_release_apk_urls() {
    assert!(apk_download_url_allowed(APK_URL));
    assert!(!apk_download_url_allowed(
        "https://evil.example.com/AINote-v0.26.2-android-arm64.apk"
    ));
    assert!(!apk_download_url_allowed(
        "https://github.com/small-dream/AINote/releases/download/v0.26.2/AINote.exe"
    ));
    assert!(!apk_download_url_allowed("http://github.com/small-dream/AINote/releases/download/v0.26.2/x.apk"));
}

#[test]
fn allows_only_official_sha256_urls() {
    assert!(sha256_url_allowed(&format!("{APK_URL}.sha256")));
    assert!(!sha256_url_allowed(APK_URL));
    assert!(!sha256_url_allowed(
        "https://github.com/other/repo/releases/download/v1/x.apk.sha256"
    ));
}

#[test]
fn parses_standard_sha256_file() {
    let hash = "a".repeat(64);
    assert_eq!(
        parse_sha256_file(&format!("{hash}  AINote-v0.26.2-android-arm64.apk\n")),
        Some(hash.clone())
    );
    assert_eq!(parse_sha256_file(&hash.to_uppercase()), Some(hash));
    assert_eq!(parse_sha256_file("not-a-hash  file.apk"), None);
    assert_eq!(parse_sha256_file(""), None);
}

#[test]
fn sha256_hex_matches_known_digest() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("sample.bin");
    fs::write(&file, b"ainote").unwrap();
    assert_eq!(
        sha256_hex(&file).unwrap(),
        "be7c83a93906d566901d96ea2e20dc1cfe1bc18df2a8aef6a03d348e1e1021ce"
    );
}

#[test]
fn install_path_requires_updates_dir_and_apk_name() {
    let dir = Path::new("/cache/updates");
    assert!(install_path_allowed(dir, &dir.join("ainote-0.27.0.apk")));
    assert!(!install_path_allowed(dir, &dir.join("evil.apk")));
    assert!(!install_path_allowed(dir, &dir.join("ainote-0.27.0.apk.part")));
    assert!(!install_path_allowed(dir, Path::new("/etc/ainote-0.27.0.apk")));
    assert!(!install_path_allowed(
        dir,
        &dir.join("sub").join("ainote-0.27.0.apk")
    ));
}

#[test]
fn apk_file_name_accepts_semver_like_versions() {
    assert_eq!(apk_file_name("0.27.0").unwrap(), "ainote-0.27.0.apk");
    assert_eq!(apk_file_name("1.0-beta.2").unwrap(), "ainote-1.0-beta.2.apk");
}

/// 版本号拼路径前必须拒绝路径分隔符与空白等字符，防穿越出 updates 目录。
#[test]
fn apk_file_name_rejects_path_injection() {
    for bad in ["../evil", "1.0/x", "1.0\\x", "1 0", "1.0;rm", ""] {
        assert!(
            matches!(apk_file_name(bad), Err(AppError::UpdateDownload(_))),
            "非法版本号应被拒绝: {bad:?}"
        );
    }
}

/// 临时文件名必须带任务序号且保留 `.part` 后缀：取消后重下时新旧任务各写各的文件，
/// 并保证下次下载的残留清理仍能识别它。
#[test]
fn part_file_name_is_task_scoped_and_cleanable() {
    let first = part_file_name(&apk_file_name("0.27.0").unwrap(), 1);
    let second = part_file_name(&apk_file_name("0.27.0").unwrap(), 2);
    assert_eq!(first, "ainote-0.27.0.apk.1.part");
    assert_ne!(first, second);
    assert!(first.ends_with(".part"));
    // 最终安装包（无序号）仍是 `install_update` 唯一接受的命名
    assert!(install_path_allowed(
        Path::new("/cache/updates"),
        Path::new("/cache/updates/ainote-0.27.0.apk")
    ));
    assert!(!install_path_allowed(
        Path::new("/cache/updates"),
        Path::new("/cache/updates/ainote-0.27.0.apk.1.part")
    ));
}

#[test]
fn clear_stale_files_removes_apks_and_any_part_leftover() {
    let dir = tempfile::tempdir().unwrap();
    let keep = dir.path().join("keep.txt");
    let stale_apk = dir.path().join("ainote-0.26.0.apk");
    let stale_part = dir.path().join("ainote-0.27.0.apk.1.part");
    for path in [&keep, &stale_apk, &stale_part] {
        fs::write(path, b"x").unwrap();
    }

    clear_stale_files(dir.path());

    assert!(keep.exists());
    assert!(!stale_apk.exists(), "历史安装包应被清理");
    assert!(!stale_part.exists(), "残留临时文件应被清理");
}
