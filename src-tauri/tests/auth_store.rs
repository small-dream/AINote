use std::fs;

use mynote_core_lib::AuthStore;
use tempfile::tempdir;

#[test]
fn token_round_trips_without_plaintext_on_disk() {
    let dir = tempdir().expect("temp dir");
    let store = AuthStore::new(dir.path().to_path_buf());

    store.save_token("ghp_test_token").expect("save token");

    let token_bytes = fs::read(dir.path().join("auth.token")).expect("read token file");
    assert!(!token_bytes
        .windows("ghp_test_token".len())
        .any(|w| w == b"ghp_test_token"));
    assert_eq!(store.read_token().expect("read token"), "ghp_test_token");
    assert!(store.has_token().expect("token status"));
}

#[test]
fn delete_token_clears_local_files() {
    let dir = tempdir().expect("temp dir");
    let store = AuthStore::new(dir.path().to_path_buf());

    store.save_token("ghp_test_token").expect("save token");
    store.delete_token().expect("delete token");

    assert!(!dir.path().join("auth.token").exists());
    assert!(!dir.path().join("auth.key").exists());
    assert!(!store.has_token().expect("token status"));
}
