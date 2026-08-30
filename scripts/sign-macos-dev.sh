#!/usr/bin/env bash
# 给 dev 二进制做 ad-hoc 签名，减少 macOS 对未签名 app 访问钥匙串时的反复弹框。
# 用法：pnpm desktop:sign  （需在编译后运行；每次重新编译后需重跑一次）
set -euo pipefail

BIN="${1:-src-tauri/target/debug/mynote-core}"
if [ ! -f "$BIN" ]; then
  echo "未找到二进制: $BIN（请先编译）"
  exit 1
fi

codesign --force --sign - "$BIN"
echo "已签名: $BIN"
codesign -dv "$BIN" 2>&1 | sed -n '1,3p'
