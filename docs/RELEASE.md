# AINote Release 发布步骤与规范

本流程参考 AISwitch 的发布设计：先创建唯一 Draft Release，再由 macOS（仅 Apple Silicon）、Linux、Windows 并行上传安装包和 updater 签名清单，全部成功后才公开 Release。AINote 暂不提供 Intel macOS 安装包。

## 一次性配置

1. 在本地生成 Tauri updater 密钥：`pnpm tauri signer generate -w ~/.config/ainote/ainote.key`。私钥只保存于密码管理器，不得提交仓库。
2. 将私钥内容配置到 GitHub 仓库 `Settings → Secrets and variables → Actions`：
   - `TAURI_SIGNING_PRIVATE_KEY`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. 将生成的 `.pub` 内容写入 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`。公钥可以提交；私钥和密码绝不进入日志、Issue 或 Release。
4. 确认仓库 Actions 允许 `contents: write`，并启用 GitHub Releases。

## 发布步骤

1. 从 `main` 创建发布 PR，更新 `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 三处版本，并更新变更日志。
2. 本地执行 `pnpm build && pnpm test && pnpm lint && (cd src-tauri && cargo test)`。
3. 创建并推送 SemVer 标签：`git tag vMAJOR.MINOR.PATCH && git push origin vMAJOR.MINOR.PATCH`。标签必须与三处版本完全一致。
4. GitHub Actions 自动校验版本，创建/复用同标签 Draft Release，并执行 Apple Silicon macOS、Linux、Windows 构建。不要手动上传未签名或未校验的安装包。
5. 检查所有矩阵任务成功，确认 Release 包含 `latest.json` 及各平台 `.app.tar.gz`、`.AppImage`、`.deb`、`.msi`/`.exe` 资产；再由 `publish-release` 自动公开 Release。
6. 在干净环境安装每个平台包，启动 AINote，进入「设置 → 软件更新」，验证能发现新版本、下载、安装并自动重启。

## macOS 安装提示

GitHub 提供的 macOS DMG 仅面向 Apple Silicon（Apple 芯片）Mac，且未使用 Apple Developer ID 签名与公证。首次打开时，macOS 可能提示“无法验证开发者”或“应用已损坏”，这是系统的 Gatekeeper 安全提示，不代表安装包下载不完整。

安装步骤：

1. 将 `AINote.app` 拖入“应用程序”目录。
2. 若双击仍提示“应用已损坏”，打开“终端”执行：

   ```bash
   xattr -cr /Applications/AINote.app
   ```

3. 回到“应用程序”目录，右键 AINote.app，选择“打开”，并在系统提示中确认。

也可以在“系统设置 → 隐私与安全性”中点击“仍要打开”。请确认下载来源为本项目 GitHub Releases，并只对你信任的安装包执行上述命令。

## 版本、签名与回滚规范

- 版本遵循 SemVer（`MAJOR.MINOR.PATCH`）；破坏性配置或数据迁移升级 MAJOR，向后兼容功能升级 MINOR，缺陷修复升级 PATCH。
- `latest.json` 由 Tauri CLI 生成并使用 updater 私钥签名；客户端只接受匹配 `pubkey` 的资产，禁止关闭签名校验。
- 发布失败时 Draft Release 保持草稿，修复后可重新运行同一标签；不得删除并复用不同版本的标签。
- 发现严重问题时，先将 Release 标记为 pre-release 或撤回资产，再发布修复版本。不要重写已经公开的标签或签名资产。
- 更新失败不应影响本地笔记数据；客户端保留当前版本，用户可继续离线编辑和同步。

## CI 门禁

- `pnpm release:check <tag>`：校验标签与三处版本一致。
- `pnpm build`、`pnpm test`、`pnpm lint`、`cargo test` 全部通过后才允许合并发布 PR。
- 任何 Secret 泄漏、签名失败、资产缺平台或 updater 清单缺失，均视为发布失败并阻止公开 Release。
