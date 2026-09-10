# 安装与故障排查

> 覆盖：安装被拦截、自动更新失败、同步失败、凭证失效、磁盘不足。
> 每个场景按「现象 → 原因 → 操作步骤」组织，命令可直接复制执行。

## 0. 当前签名状态（先读这一段）

| 平台 | 安装包签名 | 说明 |
|---|---|---|
| macOS | ❌ 未签名 / 未公证 | 首次打开需手动放行，见 §1.1 |
| Windows | ❌ 未代码签名 | SmartScreen 会提示，见 §1.2 |
| Linux | 产物未签名 | AppImage / deb / rpm 直接运行，见 §1.3 |
| Android | ✅ 已签名 | APK / AAB 由发布密钥签名 |

**这不是缺陷。** Apple Developer ID 公证与 Windows 代码签名涉及证书采购，已排入 **M1.5**；M1 阶段通过本文档提供透明的放行步骤。正式签名上线后，本文档中的放行步骤会被移除或标注为「历史版本」。

## 1. 安装被拦截

### 1.1 macOS：提示「应用已损坏」或「无法验证开发者」

**原因**：安装包未做 Apple 公证，Gatekeeper 会拦截来自互联网的未签名应用。

**操作步骤**

1. 把 `AINote.app` 拖入 `/Applications`。
2. 打开「终端」，执行：

   ```bash
   xattr -cr /Applications/AINote.app
   ```

3. 再次打开应用；若仍被拦截，执行下面命令查看具体拦截原因：

   ```bash
   spctl -a -vv /Applications/AINote.app
   ```

4. 临时放行（仅在你确认安装包来自官方 Release 时使用）：

   ```bash
   sudo spctl --add --label "AINote" /Applications/AINote.app
   ```

   > 如需撤销放行：`sudo spctl --remove --label "AINote" /Applications/AINote.app`

**更稳妥的替代方案**：右键点击 `AINote.app` → 「打开」→ 在弹窗中再次点「打开」。这只会为该应用建立一次例外，不会关闭整机安全策略。

### 1.2 Windows：SmartScreen 提示「Windows 已保护你的电脑」

**原因**：安装包未做代码签名，SmartScreen 无法验证发布者。

**操作步骤**

1. 确认安装包来自官方 Release：`https://github.com/small-dream/AINote/releases/latest`。
2. 点击提示框中的「更多信息」→「仍要运行」。
3. 若被企业策略完全拦截，用 PowerShell 查看文件来源与哈希：

   ```powershell
   Get-Item .\AINote_*_x64-setup.exe | Select-Object Name, Length, LastWriteTime
   Get-FileHash .\AINote_*_x64-setup.exe -Algorithm SHA256
   ```

4. 与 Release 页面附带的 `SHA256SUMS` 对比（见 §6）。

### 1.3 Linux：AppImage 无法执行 / 缺少 FUSE

**现象**：双击无反应，或提示 `AppImages require FUSE to run`。

**操作步骤**

```bash
chmod +x AINote_*.AppImage
./AINote_*.AppImage
```

缺少 FUSE 时（常见于容器或精简发行版）：

```bash
./AINote_*.AppImage --appimage-extract-and-run
```

`deb` / `rpm` 安装失败时，先用包管理器检查依赖：

```bash
sudo apt install -f          # Debian / Ubuntu
sudo dnf install -y ./AINote-*.rpm   # Fedora
```

## 2. 自动更新失败

**现象**：设置 → 软件更新 提示「检查更新失败」或「安装失败」。

**原因**：网络 / 代理不可达、Release 资源缺失、更新包签名校验失败。

**操作步骤**

1. 确认网络与代理：浏览器能打开 `https://github.com/small-dream/AINote/releases/latest`。
2. 在设置 → 软件更新中重试；更新器只接受带签名的更新包，校验失败会自动拒绝。
3. 仍失败时手动下载对应平台安装包覆盖安装，笔记仓库不受影响。
4. 收集诊断包（§5）并在 Issue 中附上错误提示。

### 2.1 Android：应用内只提示新版本，安装需手动完成

**现象**：Android 上启动后顶部出现「发现新版本 x.y.z」提示，或在「设置 → 软件更新」看到新版本。

**原因**：Android 走 GitHub APK 分发（仅提示、不静默下载安装），因此应用内不会自动下载或安装。

**操作步骤**

1. 点提示条或设置页的「前往 Release 页面下载」，在浏览器打开对应 Release。
2. 下载 APK 后直接覆盖安装；笔记仓库、登录凭证与本地偏好都不受影响。
3. 不想被同一版本反复提醒时，点提示条右侧的「忽略此版本」；等出现更新版本时会再次提示。
4. 无网络或接口不可用时应用不会报错打断使用；此时「设置 → 软件更新」会显示「无法检查更新，请检查网络后重试」，联网后点「检查更新」即可。

## 3. 同步失败

**现象**：同步按钮报错或状态栏显示「同步失败」。

AINote 已按错误类型给出可操作提示：

| 错误码 | 含义 | 操作 |
|---|---|---|
| `SYNC_4002` | 网络不可达 / 超时 | 检查网络或代理后重试；离线可继续编辑 |
| `SYNC_4003` | 凭证失效 | 重新登录 GitHub（见 §4） |
| `SYNC_4004` | 远端拒绝 | 检查仓库权限、分支保护；先拉取远端再推送 |
| `SYNC_4001` | 冲突 | 使用冲突处理界面选择保留本地 / 远端 |

**在终端自查当前仓库状态**（把路径替换成设置 → 仓库 中显示的本地路径）：

```bash
cd /path/to/your/notes
git status
git log --oneline -5
git remote -v
```

**只读完整性检查**：设置 → 仓库 → 「检查完整性」，会检查 Git 对象、索引冲突、`origin`、上游分支与磁盘权限，并给出修复建议。

## 4. 凭证失效

**现象**：提示「GitHub 凭证已失效，请重新登录」。

**原因**：Personal Access Token 过期、被撤销，或权限不足。

**操作步骤**

1. 打开 GitHub → Settings → Developer settings → Personal access tokens，新建一个具备 `repo` 权限的 Token。
2. 在 AINote 中退出登录并重新连接 GitHub。
3. Token 只保存在系统钥匙串，AINote 前端与日志都不会记录明文。

## 5. 磁盘不足

**现象**：保存、导入附件或同步时提示写入失败。

**操作步骤**

1. 查看磁盘剩余空间：

   ```bash
   df -h          # macOS / Linux
   ```

   ```powershell
   Get-PSDrive -PSProvider FileSystem   # Windows
   ```

2. 在 AINote 中查看占用：设置 → 仓库 → 本地占用；设置 → 诊断与反馈 → 日志占用。
3. 清理日志：设置 → 诊断与反馈 → 「清理日志」（只删除 AINote 自己的日志文件）。
4. 检查仓库内的大附件目录 `assets/`，按需手动清理或迁移。
5. 同步前建议先推送远端，避免本地空间不足导致提交失败。

## 6. 校验安装包（SHA256 / GPG）

官方 Release 会附带 `SHA256SUMS` 与 `SHA256SUMS.asc`。若你的版本没有这两个文件，说明它早于 `M1-E1-T3`，可暂时跳过本节的 GPG 校验，仅用 §6.1 的哈希对比。

### 6.1 计算并对比 SHA256

macOS / Linux：

```bash
shasum -a 256 AINote_*.dmg
sha256sum AINote_*.AppImage
```

Windows PowerShell：

```powershell
Get-FileHash .\AINote_*_x64-setup.exe -Algorithm SHA256
```

### 6.2 校验 GPG 签名

```bash
gpg --verify SHA256SUMS.asc SHA256SUMS
shasum -a 256 -c SHA256SUMS --ignore-missing
```

公钥指纹与获取方式见 Release 说明；首次校验前请通过独立渠道核对指纹。

## 7. 收集诊断信息

反馈问题前，请先导出诊断包：

1. 设置 → 诊断与反馈 → 「导出诊断包」，保存到本地。
2. 诊断包只含版本、平台、脱敏日志与计数摘要，**不含笔记正文、Token、API Key、完整路径或远端凭据**。
3. 在 GitHub Issue 中描述「现象 → 复现步骤 → 期望结果」，并附上诊断包。

日志目录以设置页显示为准，常见位置：

| 平台 | 日志目录 |
|---|---|
| macOS | `~/Library/Logs/dev.ainote.app/` |
| Windows | `%LOCALAPPDATA%\dev.ainote.app\logs\` |
| Linux | `~/.local/share/dev.ainote.app/logs/` |

## 8. 仍未解决？

- 搜索已有 Issue：`https://github.com/small-dream/AINote/issues`
- 新建 Issue 时附上诊断包与系统信息（系统版本、AINote 版本、复现步骤）。
- 安全漏洞请走私下报告：`https://github.com/small-dream/AINote/security/advisories/new`
