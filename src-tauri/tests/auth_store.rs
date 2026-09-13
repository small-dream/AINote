//! 桌面端凭证存储集成测试：按平台分文件加密落盘，历史文件向后兼容。

use std::fs;

use ainote_core_lib::{AuthStore, HostingProvider};
use tempfile::tempdir;

#[test]
fn token_round_trips_without_plaintext_on_disk() {
    let dir = tempdir().expect("temp dir");
    let store = AuthStore::new(dir.path().to_path_buf());

    store
        .save_token(HostingProvider::GitHub, "ghp_test_token")
        .expect("save token");

    let token_bytes = fs::read(dir.path().join("auth.github.token")).expect("read token file");
    assert!(!token_bytes
        .windows("ghp_test_token".len())
        .any(|w| w == b"ghp_test_token"));
    assert_eq!(
        store.read_token(HostingProvider::GitHub).expect("read token"),
        "ghp_test_token"
    );
    assert!(store.has_token(HostingProvider::GitHub).expect("token status"));
}

#[test]
fn providers_keep_independent_tokens() {
    let dir = tempdir().expect("temp dir");
    let store = AuthStore::new(dir.path().to_path_buf());

    store.save_token(HostingProvider::GitHub, "ghp_a").unwrap();
    store.save_token(HostingProvider::Gitee, "gitee_b").unwrap();

    assert_eq!(store.read_token(HostingProvider::GitHub).unwrap(), "ghp_a");
    assert_eq!(store.read_token(HostingProvider::Gitee).unwrap(), "gitee_b");

    store.delete_token(HostingProvider::Gitee).unwrap();
    assert!(!store.has_token(HostingProvider::Gitee).unwrap());
    assert!(
        store.has_token(HostingProvider::GitHub).unwrap(),
        "断开一个平台不得影响另一个平台"
    );
    assert!(dir.path().join("auth.github.token").exists());
}

#[test]
fn legacy_github_token_file_is_migrated() {
    let dir = tempdir().expect("temp dir");
    let store = AuthStore::new(dir.path().to_path_buf());

    // 模拟升级前的布局：单一文件 auth.token 承载 GitHub 令牌。
    store.save_token(HostingProvider::GitHub, "ghp_legacy").unwrap();
    let legacy = dir.path().join("auth.token");
    fs::rename(dir.path().join("auth.github.token"), &legacy).unwrap();

    assert_eq!(
        store.read_token(HostingProvider::GitHub).unwrap(),
        "ghp_legacy",
        "老用户升级后必须仍能读取历史凭证"
    );

    store.save_token(HostingProvider::GitHub, "ghp_new").unwrap();
    assert!(!legacy.exists(), "迁移到新位置后应清理历史文件");
    assert_eq!(store.read_token(HostingProvider::GitHub).unwrap(), "ghp_new");
}

#[test]
fn delete_all_clears_every_token_and_shared_key() {
    let dir = tempdir().expect("temp dir");
    let store = AuthStore::new(dir.path().to_path_buf());

    store.save_token(HostingProvider::GitHub, "ghp_a").unwrap();
    store.save_token(HostingProvider::Gitee, "gitee_b").unwrap();
    store.delete_all().unwrap();

    assert!(!dir.path().join("auth.github.token").exists());
    assert!(!dir.path().join("auth.gitee.token").exists());
    assert!(!dir.path().join("auth.key").exists());
    assert!(!store.has_token(HostingProvider::GitHub).unwrap());
    assert!(!store.has_token(HostingProvider::Gitee).unwrap());
}
