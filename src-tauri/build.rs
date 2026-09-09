fn main() {
    require_android_openssl_stdio();
    tauri_build::build()
}

/// Android 的 vendored OpenSSL 默认启用 no-stdio，使 libgit2 无法读取 CA bundle。
/// 构建时必须通过 OPENSSL_SRC_PERL 指向包装脚本剥掉该选项，否则 HTTPS 校验会失败。
fn require_android_openssl_stdio() {
    println!("cargo:rerun-if-env-changed=OPENSSL_SRC_PERL");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("android") {
        return;
    }
    if std::env::var_os("OPENSSL_SRC_PERL").is_none() {
        panic!(
            "Android 构建必须设置 OPENSSL_SRC_PERL=scripts/openssl-src-perl-wrapper.sh，\
             否则 vendored OpenSSL 会启用 no-stdio 导致 HTTPS 证书校验失败；\
             请使用 pnpm android:build / pnpm android:dev"
        );
    }
}
