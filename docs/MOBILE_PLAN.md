# AINote 移动端实施计划

> 版本：v1.0 · 状态：实施基线 · 负责人：Tech Lead
> 
> 本文档是 P1-6 移动端工作的执行基线。实现范围、平台差异和验收门禁发生变化时，必须先更新本文档，并同步 `PRD.md`、`ARCHITECTURE.md` 或 `CODING_STANDARDS.md`。

## 1. 目标与原则

### 1.1 目标

在 iOS 和 Android 上交付可离线工作的 Git 原生 Markdown 笔记应用：用户可以登录 GitHub、在本地编辑笔记、提交版本，并在前台网络可用时同步到远端。

### 1.2 不变的核心原则

- 继续使用 Tauri 2 + React 19 + Rust，不维护第二套移动端业务前端。
- Git、文件 IO、网络请求和敏感凭证处理全部留在 Rust/原生层。
- 移动端仓库只存放在应用沙盒；不把桌面任意本地路径模型强行移植到手机。
- 本地数据优先：编辑和浏览不依赖网络，Push/Pull 失败不影响本地内容。
- 移动端首版只承诺前台同步，不把系统后台任务作为数据可靠性的前提。

## 2. 当前基线与可行性结论

- `src-tauri/src/lib.rs` 已使用 `tauri::mobile_entry_point`，Rust Core 具备移动入口。
- 已安装 `aarch64-apple-ios`、`aarch64-apple-ios-sim` 和 `aarch64-linux-android` Rust target。
- 当前开发机已安装 Xcode 26.2 和 `adb`；Android SDK、NDK、JDK、模拟器仍需在实施门禁中确认。
- `app_config_dir` 和 `app_data_dir` 已用于配置及仓库数据，适合移动端沙盒。
- 当前前端实际版本为 React 19；架构文档中旧的 React 18 描述必须同步修正。
- 当前 `auth_store` / `secure_store` 使用 AES-GCM 文件存储；移动端实施前必须抽象为系统安全存储，并完成旧数据迁移。

结论：业务层和 Git 层可复用，主要工作集中在移动壳、平台能力、安全存储、生命周期和触摸交互，方案可行。

## 3. 技术选型

| 能力 | 选型 | 约束 |
|---|---|---|
| 应用壳 | Tauri 2.11.x | 使用 `tauri ios init` / `tauri android init` 生成平台工程 |
| 前端 | React 19 + TypeScript strict + Tailwind CSS 4 | 与桌面共享 Query、Store、API 和领域组件 |
| 编辑器 | CodeMirror 6 + TipTap 3 | 共享 `.md` / `.ainote` 数据格式和保存链路 |
| Git | Rust `git2` 0.20 | 通过 iOS/Android release 交叉编译门禁 |
| GitHub 授权 | OAuth Device Flow，PAT 作为备用 | Token 不返回 JavaScript 层 |
| 安全存储 | `SecureStore` trait + 原生 Keychain/Keystore | 禁止新增明文凭证文件 |
| 文件选择 | 移动端原生 Picker | 选择结果转换为 bytes，复用 `import_asset_bytes` |
| 分享/导出 | 原生 Share Sheet | 移动端不依赖桌面打印命令 |
| 同步 | 启动/恢复前台/用户手动触发 | 不承诺进程被挂起后的后台 Push/Pull |
| 测试 | Vitest、RTL、Cargo、Playwright、Maestro/Appium | 模拟器和真机均覆盖关键流程 |

## 4. 产品范围

### 4.1 首版必须交付

- GitHub 登录、仓库列表、绑定已有仓库和创建仓库。
- 将远端仓库 clone 到应用沙盒，支持多仓库切换。
- 笔记树、创建/编辑/删除/移动、Markdown 和富文本。
- 3 秒防抖落盘、Git commit、手动同步和离线待同步状态。
- 启动及回到前台时检查远端更新。
- 搜索、标签、双链、收藏、最近和回收站。
- 附件选择、导入 `assets/` 和本地图片预览。
- 冲突时提供“保留本地/使用远端”二选一。
- 主题、语言、AI 基础能力使用现有业务实现。

### 4.2 首版明确不承诺

- 绑定手机文件系统中的任意本地 Git 路径。
- iOS/Android 进程被系统终止后的可靠后台同步。
- 移动端自动更新；通过 App Store / Google Play 分发。
- 桌面式打印对话框；PDF 导出改为分享或系统打印能力可用时再接入。
- 移动端完整三栏冲突合并器；首版使用单栏冲突处理。
- 无上限的大型仓库；需要磁盘不足、仓库大小和取消操作提示。

## 5. 架构方案

### 5.1 共享层

以下层不按平台复制：

```text
View -> Hooks/Queries -> src/api -> Tauri IPC -> commands
     -> services -> repositories -> domain
```

复用范围包括：

- `domain/` DTO、错误码、笔记类型和同步状态。
- `services/` 笔记、Git、搜索、wiki、收藏、回收站、AI 业务用例。
- `repositories/` `git2`、文件树、笔记文件和索引实现。
- `src/api/`、TanStack Query、Zustand、编辑器纯函数与现有单测。

### 5.2 平台适配层

新增平台适配边界，平台差异禁止扩散到业务组件：

```text
src/platform/
  capabilities.ts   # 平台能力声明
  lifecycle.ts      # 前台/暂停/恢复
  share.ts          # 系统分享
  filePicker.ts     # 选择文件并读取 bytes

src-tauri/src/platform/
  mod.rs
  secure_store.rs   # SecureStore 实现与 cfg 分发
  lifecycle.rs
  share.rs
```

Rust Command 保持统一 DTO。只有安全存储、Picker、分享、生命周期、返回键和窗口配置使用 `cfg(target_os)` 或原生插件。

### 5.3 数据与路径

```text
app_data_dir/notes/<repo-id>/   # Git 工作目录
app_config_dir/ainote.json      # 非敏感配置
系统 Keychain/Keystore          # GitHub Token、AI API Key
```

移动端仓库绑定以远端 URL 为主，clone 目标由 Rust 生成并校验。所有相对路径继续经过既有 `validate_rel_path`，禁止把用户提供的绝对路径直接传入文件操作。

### 5.4 移动工作区

- 紧凑屏幕使用“底部导航 -> 笔记列表 -> 编辑器详情”的单栏栈式导航。
- 文件树、历史、设置、AI、冲突处理使用全屏页面或 Bottom Sheet。
- 使用 `100dvh` 和 `safe-area-inset`，所有主要触摸目标不小于 44px。
- 不依赖 hover、右键、拖动分栏或精确鼠标操作。
- Android 返回键按“关闭弹层 -> 返回编辑器 -> 返回列表 -> 退出应用”处理。
- 桌面三栏布局保持不变，移动布局由 `features/mobile-shell` 编排。

## 6. 认证与安全

### 6.1 SecureStore

定义统一接口：

```rust
trait SecureStore {
    fn save(&self, key: &str, value: &str) -> Result<(), AppError>;
    fn read(&self, key: &str) -> Result<Option<String>, AppError>;
    fn delete(&self, key: &str) -> Result<(), AppError>;
}
```

- iOS 使用 Keychain，Android 使用 Keystore 保护的加密存储，桌面使用系统凭证库。
- Token/API Key 不进入 React state、Query cache、日志或 Command 返回值。
- 首次升级时迁移旧 AES-GCM 文件；迁移成功后删除旧凭证文件。
- `ainote.json` 只保存存在性标记、Provider ID、仓库注册表等非敏感信息。

### 6.2 GitHub 授权

默认使用 Device Flow：移动端打开系统浏览器，轮询授权结果，授权完成后由 Rust 直接保存 Token。PAT 仅作为高级用户备用入口。

## 7. 同步与生命周期

1. 首次进入工作区时读取本地仓库，不等待网络才能编辑。
2. 应用启动和回到前台时执行状态检查；有网络时再 fetch/pull。
3. 用户点击同步时执行“flush 编辑器 -> 汇总 commit -> pull -> push”。
4. 网络错误进入待同步状态，前台网络恢复时重试。
5. 应用暂停前尽力 flush 编辑器队列；本地文件写入使用临时文件 + rename。
6. 后台任务（Android WorkManager、iOS BGProcessingTask）只作为后续增强，不作为首版验收条件。

## 8. 分阶段计划与门禁

### 阶段 0：环境和文档门禁

- 生成 iOS/Android Tauri 工程。
- 确认 Android SDK、NDK、JDK、模拟器和签名环境。
- 通过 iOS Simulator、Android Emulator 的 Debug/Release 构建。
- 同步 PRD、ARCHITECTURE、CODING_STANDARDS。

### 阶段 1：平台能力

- 实现 SecureStore 和旧凭证迁移。
- 接入移动 Picker、Share Sheet、生命周期和返回键。
- 增加平台能力探测和统一错误码。

### 阶段 2：移动壳

- 新增 `features/mobile-shell`。
- 完成单栏导航、Bottom Sheet、safe-area、键盘避让和返回栈。
- 保证桌面布局无回归。

### 阶段 3：编辑器

- 验证 CodeMirror/TipTap 的输入法、选区、滚动、图片、表格和工具栏。
- 接入暂停前 flush 和恢复后重载策略。
- 对 Mermaid、KaTeX、lowlight、TipTap 保持动态加载。

### 阶段 4：仓库与同步

- 完成 clone、离线编辑、commit、前台恢复同步、冲突二选一。
- 验证仓库路径、磁盘不足、clone 中断和网络切换。
- 通过两端 release 交叉编译和真实 Git 远端测试。

### 阶段 5：功能补齐

- 搜索、wiki、收藏、最近、回收站、附件和 AI 面板。
- 逐项把桌面弹窗改为移动页面或 Sheet，不复制业务逻辑。

### 阶段 6：测试与发布

- 完成单元、Hook、页面和移动端黑盒测试。
- Android 输出签名 AAB，iOS 输出 Archive/TestFlight 包。
- 建立崩溃、同步失败、磁盘不足和凭证迁移的诊断信息。

## 9. 测试策略

### 9.1 自动化

- `pnpm build && pnpm test && pnpm lint`。
- `cargo test`，并执行 iOS/Android target 的 `cargo check --release`。
- Playwright 继续覆盖浏览器/Tauri IPC mock 的桌面流程。
- Maestro 或 Appium 覆盖移动端登录、创建、编辑、返回、离线、同步、附件和冲突。

### 9.2 真机矩阵

- iPhone：一款刘海屏小屏设备、一款大屏设备。
- Android：一款小屏低内存设备、一款主流大屏设备。
- 系统覆盖当前支持的最低版本和最新稳定版本。

### 9.3 性能门槛

- 已 clone 仓库冷启动到可编辑不超过 2 秒（目标设备）。
- 1,000 篇笔记列表和搜索交互保持在 100ms 级别。
- 20MB 附件导入不阻塞 UI，失败可重试。
- 应用切后台和恢复不丢失已确认保存内容。

## 10. 风险与应对

| 风险 | 应对 |
|---|---|
| libgit2/OpenSSL 交叉编译失败 | 阶段 0 先做 release 构建；必要时调整 TLS feature |
| iOS 后台执行受限 | 首版仅承诺前台恢复同步，本地保存优先 |
| 移动 WebView 输入行为差异 | 模拟器 + 真机覆盖输入法、选区和滚动 |
| 大仓库内存或磁盘压力 | 仓库大小提示、分阶段索引、可取消操作 |
| 凭证迁移失败 | 保留旧数据只读回退，迁移成功后再删除 |
| 移动 UI 条件分支失控 | 独立 mobile-shell，业务组件不判断平台 |

## 11. 完成定义

移动端功能只有在以下条件全部满足后才标记完成：

- iOS 和 Android Release 构建可安装并启动。
- GitHub 授权、clone、离线编辑、commit、前台同步闭环通过。
- Token/API Key 永不出现在前端状态和日志中。
- 应用暂停/恢复、软键盘、系统返回键和 safe-area 无明显交互错误。
- 移动端关键流程黑盒测试通过，桌面现有测试无回归。
- 本文档和三份活文档与实际实现一致。
