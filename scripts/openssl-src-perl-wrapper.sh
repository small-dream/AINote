#!/usr/bin/env bash
# openssl-src 在 Android 上固定给 OpenSSL Configure 传 no-stdio，使 BIO_new_file
# 变成空实现，libgit2 无法读取 CA bundle。此包装脚本剥掉该选项，由构建入口通过
# OPENSSL_SRC_PERL 注入；详见 src-tauri/src/repositories/ca_bundle.rs。
set -eo pipefail

args=()
for arg in "$@"; do
  if [[ "$arg" != "no-stdio" ]]; then
    args+=("$arg")
  fi
done

exec perl "${args[@]}"
