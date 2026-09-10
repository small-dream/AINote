# AINote — M1「信任与分发」可执行任务清单

> 版本：v1.1 · 更新日期：2026-09-10 · 基线版本：v0.24.12 · 维护：PM
>
> 本文档是 `docs/ROADMAP.md` 中 **M1（v0.25）** 的执行拆解，回答「具体做什么、先做哪一步、怎么算做完」。
> 需求范围以 `docs/PRD.md` 为准；架构与编码约束以 `docs/ARCHITECTURE.md`、`docs/CODING_STANDARDS.md` 为准。
> 任务状态在提交代码时同步更新，未完成项不得在 PR 描述中标记为完成。

> **v1.1 范围调整（2026-09-10）**：代码签名 / 证书 / 应用商店相关任务当前阶段**不启动、不占 M1 工期**，统一移入 **M1.5（v0.25.x 签名与分发）** 待预算批准后执行。M1 聚焦「可诊断 + 可恢复 + 同步可靠 + 度量地基」，以及零成本的发布校验（GPG + `SHA256SUMS`）、Android 应用内更新提示与分发排查文档。受影响任务：`M1-E1-T1`、`M1-E1-T2`、`M1-E1-T4`（均标 🧊 暂缓）。

---

## 0. 使用方式

- **任务 ID**：`M1-<Epic>-<序号>`，全局唯一，PR 标题建议带 ID，例如 `feat(support): M1-E2-T3 导出诊断包`。
- **状态**：`📋 待开始` · `🚧 进行中` · `🔍 待验收` · `✅ 已完成` · `🧊 阻塞`。
- **规模**：`S ≤1 人日` · `M 2–3 人日` · `L 4–5 人日` · `XL >5 人日（必须先拆）`。
- **完成定义**：任务卡内「验收标准」全部满足 + 「测试义务」通过 + 文档同步。
- **跨端铁律**：每个任务必须标注 `Desktop Impact` / `Mobile Impact`，并在两端至少验证一次。

---

## 1. M1 目标与退出标准

**目标**：让用户敢安装、敢长期托管数据；出问题时能定位、能恢复。

**退出标准（发布 v0.25 前必须全部满足）**

- [ ] 发布产物均提供 `SHA256SUMS` + GPG 签名校验；未签名平台（macOS / Windows）的安装限制在 `docs/TROUBLESHOOTING.md` 明示，并给出一键校验与放行引导（证书类签名见 M1.5）。
- [ ] 断网 / 崩溃 / 误删三类故障演练全部通过，且不丢数据。
- [ ] 无冲突同步成功率 ≥ 99%，P0 数据丢失缺陷 = 0。
- [ ] 任一崩溃可定位到版本与堆栈；诊断包经审计不含敏感信息。
- [ ] 1000 篇笔记 / 5000 行单篇 / 20MB 附件场景性能达到护栏。
- [ ] opt-in 指标可采集，漏斗指标可读取；默认不采集笔记内容。

---

## 2. Day 0 决策点（阻塞项，先做）

> 这些不是代码任务，但会阻塞后续实现，必须在 Wave 0 内给出结论。

| ID | 决策点 | 选项 | 建议 | 影响任务 |
|---|---|---|---|---|
| D1 | Windows 代码签名方案 | SignPath Foundation（开源免费）/ Azure Trusted Signing / OV 证书 / EV 证书 | **🧊 暂缓到 M1.5**：证书类签名当前阶段不启动。已调研结论备查：优先 SignPath Foundation（MIT + 公开仓库可申请，审批不保证），未通过转 Azure Trusted Signing（≈$10/月、CI 友好） | M1.5-E1-T2 |
| D2 | 崩溃上报方案 | 本地日志 + 手动反馈 / Sentry 等第三方 / 自建上报 | **M1 先做本地日志 + 手动诊断包**，远程上报作为 M1b，需先出隐私说明 | M1-E2-T4 |
| D3 | Android 分发方式 | Google Play / 仅 GitHub APK + 应用内更新提示 / 两者 | **✅ 已确认（2026-09-10）**：仅 GitHub APK + 应用内更新提示（只提示、不静默下载安装），Play 上架排入 M4 | M1-E1-T5 |
| D4 | 度量采集边界 | 仅本地 / 本地 + opt-in 远程 | **本地计数默认开启（不含内容），远程默认关闭、显式同意** | M1-E5-T1/T2 |
| D5 | iOS 发布节奏 | M1 只做 TestFlight / M1 直接上架 | **🧊 暂缓到 M1.5 / M4**：真机签名依赖 Apple 账号，当前阶段不启动 | M1.5-E1-T4 |

**M1 内需要（零成本，Day 0 启动）**

- [ ] 生成发布签名 GPG key（用于 `SHA256SUMS.asc`），公钥随 Release 发布。
- [ ] 确认 GitHub Release 发布权限与 CI Secret 存放、轮换策略（不得进入日志）。

**M1.5 待启动清单（🧊 当前阶段不申请、不采购）**

- [ ] Apple Developer Program 账号与 Team ID（$99/年）。
- [ ] Developer ID Application 证书（macOS 签名 + 公证，含在会员内）。
- [ ] Windows 代码签名证书或 Azure Trusted Signing 订阅（SignPath 免费优先）。

**证书与分发预算速查（🧊 M1.5 备查，当前阶段不决策；2026-09 报价，最终以官方为准）**

| 平台 | 方案 | 费用 | 说明 |
|---|---|---|---|
| macOS | Apple Developer Program | $99/年 | Developer ID 证书 + 公证均包含，无额外费用；不买只能 ad-hoc 签名，用户会被 Gatekeeper 拦 |
| Windows | SignPath Foundation | 免费 | 面向符合条件的 OSI 开源项目（MIT + 公开仓库可申请），审批不保证，需预留申请周期 |
| Windows | Azure Trusted Signing | ≈$9.99/月（≈$120/年） | 云签名，GitHub Actions 友好，无需硬件 token |
| Windows | OV 证书 | $129–300/年 | SSL.com 约 $129/年、Certum 约 €139/年、国内约 ¥1200/年；SmartScreen 信誉需累积 |
| Windows | EV 证书 | $349–400+/年 | 2024 年后不再即时绕过 SmartScreen，性价比下降 |
| Linux | GPG + SHA256SUMS | 免费 | 自建发布校验，无证书费用 |
| Android | Google Play 开发者账号 | $25 一次性 | 仅上架需要；只发 GitHub APK 则免费 |
| iOS | Apple Developer Program | 已含 | 与 macOS 共用同一 $99/年会员，不额外收费 |

**预算结论（仅供 M1.5 决策参考）**：最省路径约 **$99/年**（SignPath 免费 + Apple 会员）；稳妥付费路径约 **$219/年**（Apple + Azure Trusted Signing）。M1 当前阶段**不产生证书费用**。

---

## 3. 任务总览

| ID | Epic | 任务 | 平台 | 依赖 | 规模 | 状态 |
|---|---|---|---|---|---|---|
| M1-E1-T1 | 🧊 M1.5 | macOS Developer ID 签名 + 公证 | desktop | Apple 证书 | L | 🧊 |
| M1-E1-T2 | 🧊 M1.5 | Windows 代码签名 | desktop | D1 | M | 🧊 |
| M1-E1-T3 | 签名与分发 | Linux 产物校验与签名（GPG，零成本） | desktop | GPG key | S | 📋 |
| M1-E1-T4 | 🧊 M1.5 | iOS TestFlight 内测通道 | mobile | D5、Apple 账号 | L | 🧊 |
| M1-E1-T5 | 签名与分发 | Android 应用内更新提示 | mobile | D3 | M | ✅ |
| M1-E1-T6 | 分发支持 | 分发与排查文档 | shared | — | S | ✅ |
| M1-E2-T1 | 可诊断性 | Rust 结构化本地日志 | shared | — | M | ✅ |
| M1-E2-T2 | 可诊断性 | 前端错误边界与全局错误日志 | shared | M1-E2-T1 | M | ✅ |
| M1-E2-T3 | 可诊断性 | 诊断包导出命令 | shared | M1-E2-T1 | M | ✅ |
| M1-E2-T4 | 可诊断性 | opt-in 崩溃/同步失败上报 | shared | D2 | L | 🧊 |
| M1-E2-T5 | 可诊断性 | 设置页「诊断与反馈」 | shared | T2、T3 | M | ✅ |
| M1-E3-T1 | 数据安全 | 仓库完整性检查 | shared | — | M | ✅ |
| M1-E3-T2 | 数据安全 | 整库备份 / 导出 | shared | — | M | ✅ |
| M1-E3-T3 | 数据安全 | 从备份恢复 | shared | T2 | M | ✅ |
| M1-E3-T4 | 数据安全 | 故障恢复演练与自动化 | shared | T1–T3 | M | ✅ |
| M1-E3-T5 | 数据安全 | 可恢复 UI 收口 | shared | T1–T3 | M | ✅ |
| M1-E4-T1 | 同步可靠性 | 同步错误分类与可读提示 | shared | — | M | ✅ |
| M1-E4-T2 | 同步可靠性 | 幂等操作重试策略 | shared | T1 | M | ✅ |
| M1-E4-T3 | 同步可靠性 | 大仓库性能基准 | shared | — | M | ✅ |
| M1-E4-T4 | 同步可靠性 | 同步失败定位到阶段/文件 | shared | T1 | M | ✅ |
| M1-E5-T1 | 度量地基 | 本地事件计数 | shared | D4 | M | 📋 |
| M1-E5-T2 | 度量地基 | 同意页与开关 | shared | D4 | M | 📋 |
| M1-E5-T3 | 度量地基 | 指标导出与漏斗视图 | shared | T1、T2 | S | 📋 |

**M1 范围**：23 个任务中 20 个在范围内，3 个（`E1-T1` / `E1-T2` / `E1-T4`）🧊 暂缓到 M1.5。

**M1a 最小信任发布切分线**（若时间受限，先发这一组，其余顺延到 v0.25.x）：
`E1-T3` `E1-T6` `E2-T1` `E2-T3` `E2-T5` `E3-T1` `E3-T2` `E3-T3` `E4-T1` `E4-T4`

---

## 4. 详细任务卡

### Epic E1：平台签名与分发

> 当前阶段仅执行 `E1-T3`（GPG 校验，零成本）、`E1-T5`（Android 更新提示）、`E1-T6`（分发排查文档）。
> `E1-T1` / `E1-T2` / `E1-T4` 因涉及证书采购与外部账号，🧊 暂缓到 **M1.5**，本阶段不投入、不排期。

#### M1-E1-T1 macOS Developer ID 签名 + 公证（L，🧊 暂缓至 M1.5）

- **背景**：当前 `src-tauri/tauri.conf.json` 中 `bundle.macOS.signingIdentity` 为 `"-"`（ad-hoc），CI 未配置 Apple 证书，用户需手动 `xattr -cr`。
- **交付物**
  - CI 注入 Developer ID 证书，Tauri 构建走正式签名 + 公证 + stapler。
  - 新增 Secrets：`APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_ID`、`APPLE_PASSWORD`（App 专用密码）、`APPLE_TEAM_ID`。
  - 构建后自动执行 `spctl -a -vv` 与 `xcrun stapler validate`，失败即阻断发布。
  - 更新 `docs/RELEASE.md` 与 `README.md`：移除或降级 `xattr` 教程。
- **改动范围**：`.github/workflows/release.yml`、`src-tauri/tauri.conf.json`、`docs/RELEASE.md`、`README.md`。
- **验收标准**
  - 干净 macOS 机器下载 `.dmg` 首启无「无法验证开发者 / 应用已损坏」。
  - `spctl -a -vv AINote.app` 返回 accepted；`stapler validate` 通过。
  - updater 自动更新后签名仍有效。
- **测试义务**：发布流水线增加签名/公证断言；在干净环境做一次安装 + 自动更新验证。
- **跨端影响**：`Desktop Impact`：有；`Mobile Impact`：无。
- **风险**：证书申请周期长；公证 CI 耗时增加（可接受，仅发布时触发）。

#### M1-E1-T2 Windows 代码签名（M，🧊 暂缓至 M1.5）

- **背景**：当前 Windows 安装包未签名，首启触发 SmartScreen。
- **交付物**
  - 按 D1 选定方案接入 `tauri-action` 或独立 `signtool` 步骤。
  - 构建后 `signtool verify /pa` 校验并阻断失败发布。
  - 更新 `docs/RELEASE.md` 的 Windows 说明。
- **验收标准**
  - 干净 Windows 机器首启无「未知发布者」硬阻断；若为 OV 证书，需在文档中说明信誉累积期与用户引导。
  - 安装包属性显示正确发布者名称。
- **测试义务**：发布流水线签名校验；干净环境安装 + 自动更新验证。
- **跨端影响**：`Desktop Impact`：有；`Mobile Impact`：无。

#### M1-E1-T3 Linux 产物校验与签名（S）

- **交付物**
  - Release 产出 `SHA256SUMS`，并用 GPG 生成 `SHA256SUMS.asc`。
  - `docs/RELEASE.md` 增加校验步骤（`sha256sum -c` / `gpg --verify`）。
  - 公钥发布方式说明（写入 README 或 RELEASE）。
- **验收标准**：`AppImage` / `.deb` / `.rpm` 均可通过校验；篡改任一字节后校验失败。
- **测试义务**：CI 中生成并验证校验和；文档命令可在干净 Linux 执行。
- **跨端影响**：`Desktop Impact`：有；`Mobile Impact`：无。

#### M1-E1-T4 iOS TestFlight 内测通道（L，🧊 暂缓至 M1.5，与 M4 共享）

- **背景**：`docs/MOBILE_PLAN.md` §2.1 记录 iOS 完整 Archive 仍缺 libgit2 的 zlib/iconv 链接配置，真机签名需 Apple Development Team。
- **交付物**
  - 修复 iOS 交叉编译链接配置，完成 `tauri ios build` / Xcode Archive。
  - 建立 TestFlight 上传流水线或半自动脚本。
  - 内测说明文档：安装步骤、已知限制（无后台同步、无自动更新）。
- **验收标准**
  - TestFlight 内测用户可安装并启动。
  - 核心闭环在真机通过：GitHub 授权 → clone → 离线编辑 → commit → 前台同步。
  - Token / API Key 不出现在前端状态与日志。
- **测试义务**：至少 1 台真机 + 1 台模拟器；移动端关键流程黑盒测试。
- **跨端影响**：`Desktop Impact`：无；`Mobile Impact`：有。
- **依赖**：Apple Developer 账号、D5 决策。

#### M1-E1-T5 Android 应用内更新提示（M）

- **背景**：Android 已有签名 APK/AAB，但用户无法在应用内感知新版本。
- **交付物**
  - 应用启动/设置页检查 GitHub Release 最新版本（复用 `features/update` 的版本比较纯函数）。
  - 有新版本时展示提示 + 跳转 Release 页面；不做静默下载安装（M1 范围）。
  - 版本比较与降级保护纯函数 + 单测。
- **验收标准**：有新版本时提示准确；无网络/接口失败时静默降级不打扰；不误报当前版本。
- **测试义务**：纯函数单测覆盖 `1.2.3 < 1.2.10`、预发布版本、当前版本。
- **跨端影响**：`Desktop Impact`：无（桌面已有 updater）；`Mobile Impact`：有。
- **实现备注（2026-09-10）**：
  - 版本比较落在 `src/features/update/utils/version.ts`（纯函数）：`parseVersion`（容忍 `v` 前缀与 `+build` 元数据）、`compareVersions`（缺段补 0、正式版 > 同号预发布版、数字标识符 < 字母）、`isNewerVersion`（**严格大于**，任一无法解析返回 false——宁可漏报不误报）。
  - 数据源走 GitHub Releases API（`src/api/release.api.ts` 的 `releaseApi.fetchLatestRelease`，与 `getVersion()` 并发取回；`tag_name` 归一化去掉 `v` 前缀，`html_url` 缺失时按 tag 兜底拼接）。**不接 updater 插件**：`capabilities/mobile.json` 只有 `core:default`，移动端也没有 `plugin-process` 依赖。
  - 平台判定抽到 `src/platform/runtime.ts` 的 `isAndroidApp()`（`back-navigation.ts` 改为从该文件导入并继续对外导出，行为不变）：只有 Android 壳才自动检查，桌面壳不受影响。
  - `useMobileUpdate` + `useMobileUpdateStore`（`zustand`）收敛检查状态，提示条与设置页共用一份结果并发去重；请求失败一律静默降级为 `failed`，不弹错、不打扰。「忽略此版本」按版本号持久化到 localStorage，出现更新的版本时会重新提示。
  - UI 两处：移动壳顶部的 `MobileUpdateBanner`（新版本提示 + 「前往 Release 页面下载」+ 忽略）与设置页 `MobileUpdateSettings`；`UpdateSettings` 现在按平台分流，顺带修掉「Android 上渲染桌面 updater 面板必然检查失败」的问题。
  - 验证：`version.test.ts` 14 项（含 `1.2.3 < 1.2.10`、预发布、同版本/降级不误报、非法输入）；`useMobileUpdate` 6 项 + `MobileUpdateBanner` 5 项；e2e 新增 `e2e/mobile-update.spec.ts` 5 条（430px + Android UA：有新版本提示并跳转、忽略后不再提示、已最新只在设置页说明、接口不可用静默降级、桌面壳不显示移动提示），IPC mock 补 `plugin:app|version` / `open_external` 并置位 `isTauri`。真机验证缺口：本机 `adb devices` 为空，移动端 UI 以窄屏 e2e + RTL 替代。

#### M1-E1-T6 分发与排查文档（S）

- **交付物**
  - 新增 `docs/TROUBLESHOOTING.md`：安装被拦截（未签名平台校验与放行）、自动更新失败、同步失败、凭证失效、磁盘不足。
  - README 安装章节指向该文档；三平台各给出可执行命令。
  - 明确声明「当前阶段未做证书签名，正式签名见 M1.5」，避免用户误解为缺陷。
- **验收标准**：每个故障场景有「现象 → 原因 → 操作步骤」；命令可直接复制执行。
- **测试义务**：文档命令在干净环境验证（至少 macOS + Windows），未签名放行步骤需实测。
- **跨端影响**：`shared`。
- **实现备注（2026-09-10）**：新增 `docs/TROUBLESHOOTING.md`（安装拦截 / 更新失败 / 同步失败 / 凭证失效 / 磁盘不足 + SHA256·GPG 校验 + 诊断包收集），README 安装章节指向该文档；明确声明当前未做证书签名、正式签名在 M1.5。macOS 命令（`xattr` / `spctl` / `shasum`）已在本机验证可用；Windows SmartScreen 与 Linux FUSE 命令待干净环境实测，并入 Wave 4 发布门禁。

---

### Epic E2：可诊断性

#### M1-E2-T1 Rust 结构化本地日志（M）

- **背景**：当前无日志插件（`src-tauri/Cargo.toml` 仅 `tauri` / `git2` / `ureq` 等），线上问题无法回溯。
- **交付物**
  - 接入结构化日志（推荐 `tauri-plugin-log` 或 `tracing` + 文件 appender），输出到 `app_log_dir`。
  - 日志分级、按天轮转、保留上限（如 7 天 / 20MB），可在设置页清理。
  - 统一脱敏函数：Token、API Key、Authorization、绝对路径、仓库远端 URL 凭据。
  - 关键链路埋点：启动、仓库绑定、同步各阶段、保存失败、AI 请求失败。
- **改动范围**：`src-tauri/Cargo.toml`、`src-tauri/src/lib.rs`、新增 `src-tauri/src/config/logging.rs` 或 `services/logging_service.rs`。
- **验收标准**
  - 日志默认本地、可定位到时间/模块/错误码。
  - 脱敏函数单测覆盖 Token/Key/路径/URL 四类；日志中搜索不到明文敏感串。
  - 日志写入失败不影响主流程。
- **测试义务**：脱敏纯函数覆盖率 ≥ 90%；tempdir 写入与轮转测试；`cargo test` 通过。
- **跨端影响**：`Desktop Impact`：有；`Mobile Impact`：有（移动端日志路径为沙盒）。
- **实现备注（2026-09-10）**：采用 `tauri-plugin-log` 2.9.1，输出 `app_log_dir/ainote.log`（macOS 实测 `~/Library/Logs/dev.ainote.app/ainote.log`）；单文件 5MB、保留最近 4 个（约 20MB）；全局 format 统一脱敏，`regex` 规则覆盖 Token / API Key / Authorization / URL 凭据 / 用户目录；启动、仓库绑定、同步 commit/pull/push、保存失败、AI 请求失败已埋点。设置页清理入口与 UI 归 `M1-E2-T5`。

#### M1-E2-T2 前端错误边界与全局错误日志（M）

- **交付物**
  - React `ErrorBoundary`：渲染崩溃显示可恢复界面（重试 / 复制诊断信息 / 返回工作区）。
  - 捕获 `window.onerror`、`unhandledrejection`，经 `src/api/` 写入本地日志。
  - 组件不得直接 `invoke()`，统一走 `src/api/support.api.ts`。
- **改动范围**：`src/app/`、新增 `src/features/support/`、`src/api/support.api.ts`。
- **验收标准**：抛错组件被边界捕获且应用不白屏；错误信息写入日志且脱敏；用户可一键复制诊断信息。
- **测试义务**：RTL 渲染抛错显示 fallback；mock `@/api` 断言上报调用；单文件 ≤ 300 行。
- **跨端影响**：`shared`。

#### M1-E2-T3 诊断包导出命令（M）

- **交付物**
  - 新增 Rust command `export_diagnostics`，返回 `Result<DiagnosticsExportDto, AppErrorDto>`。
  - 打包内容：应用版本、平台、架构、最近日志（脱敏）、配置摘要（脱敏）、当前仓库同步状态、仓库大小、最近错误码统计。
  - **禁止**包含：笔记正文、Token、API Key、完整用户路径、远端 URL 中的凭据。
  - 前端提供「导出诊断包」按钮，保存到用户选择路径。
- **改动范围**：新增 `src-tauri/src/commands/support/export.rs`、`services/diagnostics_service.rs`、`repositories/diagnostics_files.rs`；`src/api/support.api.ts`、`src/features/support/`；`src-tauri/src/lib.rs` 注册命令。
- **验收标准**
  - 诊断包可解压，含 `manifest.json`；离线可生成。
  - 用敏感串扫描脚本验证包内不含 Token/Key/笔记内容。
  - 单仓库 1000 篇笔记时生成时间 < 5s。
- **测试义务**：脱敏纯函数 ≥ 90%；命令返回 `AppErrorDto`；集成测试校验 zip 结构与内容白名单。
- **跨端影响**：`shared`。
- **实现备注（2026-09-10）**：`zip` 4.6.1 + `tauri-plugin-dialog` 2.7.3；包内固定三件套 `manifest.json` / `summary.json` / `logs/ainote.log`（最近 256KB），日志写入前再做一次兜底脱敏；`summary.json` 只含计数、布尔与错误码统计（`SYNC_4002` 等），不含路径 / URL / 正文；集成测试解压扫描敏感串。前端按钮为可复用组件，已挂在崩溃 fallback，设置页入口归 `M1-E2-T5`。

#### M1-E2-T4 opt-in 崩溃/同步失败上报（L，🧊 待 D2 决策）

- **交付物（分两阶段）**
  - **M1a（建议先做）**：本地记录 + 用户手动把诊断包附到 GitHub Issue。
  - **M1b（需 D2 决策）**：opt-in 远程上报，含同意页、隐私说明、可关闭、可删除本地队列。
- **验收标准**：默认关闭；开启前有明确说明；关闭后不再发送且清理队列；上报内容不含笔记内容与凭证。
- **测试义务**：同意状态持久化测试；关闭后发送函数不被调用；脱敏断言。
- **跨端影响**：`shared`。
- **注意**：若 D2 选择第三方 SDK，必须先完成隐私影响评估并更新 `docs/PRD.md` 安全红线。

#### M1-E2-T5 设置页「诊断与反馈」（M）

- **交付物**
  - 设置导航新增「诊断与反馈」：日志开关、日志目录、清理日志、导出诊断包、上报同意开关（若启用）、隐私说明链接。
  - 移动端适配为单栏页面，不复制业务逻辑。
- **改动范围**：`src/features/settings/components/SupportSettings.tsx`、`SettingsNav.tsx`、`SettingsView.tsx`、`src/i18n/messages.ts`。
- **验收标准**：桌面三栏与移动单栏均可用；键盘可达；状态有 `aria-live` 反馈。
- **测试义务**：组件交互测试；移动端至少 1 次人工验证。
- **跨端影响**：`Desktop Impact`：有；`Mobile Impact`：有。
- **实现备注（2026-09-10）**：新增 `SupportSettings` + `useSupportInfo`（TanStack Query，IPC 只经 `src/api/support.api.ts`）；新增 `support_info` / `set_logging_enabled` / `clear_logs` 三个命令，`clear_logs` 只删日志目录内 `ainote*` 的 `.log` / `.log.bak` 并返回释放字节数；开关持久化到 `AppConfig` 并即时调整 `log::set_max_level`；清理走 `window.confirm` 二次确认，状态区 `role="status" aria-live="polite"`；移动端沿用 `settings.css` 断点单栏，无重复业务逻辑；隐私说明链接到 README「隐私与诊断数据」。组件测试 6 项覆盖加载 / 开关 / 清理 / 复制 / 隐私链接 / 失败重试。

---

### Epic E3：数据安全与可恢复性

#### M1-E3-T1 仓库完整性检查（M）

- **背景**：用户把长期数据托管给 AINote，当前无任何完整性自检能力。
- **交付物**
  - 新增 `RepoMaintenanceBackend` trait（接口隔离，避免继续膨胀 `GitBackend`）+ `git2_maintenance.rs` 实现。
  - 检查项：Git 对象完整性（`Repository::fsck`）、工作区/索引一致性、`origin` 配置、当前分支上游、磁盘可写、`.git` 目录权限。
  - 返回 `IntegrityReport { ok, issues: [{ code, severity, message, fixHint }] }`；严重度 `info | warning | error`。
  - 设置页「仓库」增加「检查完整性」入口，展示问题与修复建议。
- **改动范围**：新增 `src-tauri/src/domain/maintenance.rs`、`repositories/repo_maintenance.rs`、`repositories/git2_maintenance.rs`、`services/maintenance_service.rs`、`commands/repo/integrity.rs`；`src/api/repo.api.ts`、`src/features/settings/components/RepoIntegrityCard.tsx`。
- **验收标准**
  - 健康仓库返回 `ok: true`；人为损坏 `.git/objects` 后能报出 error 且给出修复建议。
  - 检查过程只读，不改动仓库。
- **测试义务**：Mock trait 单测；tempdir 损坏仓库集成测试；严重度映射纯函数 ≥ 90%。
- **跨端影响**：`shared`。
- **实现备注（2026-09-10）**：git2 0.20 未导出 `Repository::fsck`，改为遍历 ODB 并逐个 `read` 校验对象（损坏 / 缺失即报 `REPO_3102`），同样保持只读；其余检查覆盖索引冲突、`origin`、上游分支、仓库目录与 `.git` 可写位。错误码 `REPO_3101`~`REPO_3107`，严重度映射为 `domain::maintenance::severity_for` 纯函数；设置页「仓库」新增 `RepoIntegrityCard`（`aria-live` 结果区，warning/info 不判定失败）。测试：Rust 9 项（含损坏 loose object 集成测试）、前端 4 项。

#### M1-E3-T2 整库备份 / 导出（M）

- **交付物**
  - 新增 command `export_repo_backup`：将工作区 + `.git` 打包为 zip，并写入 `manifest.json`（schemaVersion、appVersion、repoName、createdAt、文件数、总大小、sha256）。
  - 排除规则：默认包含全部内容；可选排除 `assets/` 大文件（需在 UI 明示）。
  - 支持进度反馈与取消（走 blocking command 模式）。
- **改动范围**：新增 `commands/repo/backup.rs`、`services/backup_service.rs`、`repositories/backup_files.rs`；`src/api/repo.api.ts`、`src/features/settings/components/`。
- **验收标准**
  - 1000 篇笔记仓库导出可完成，包内结构完整，`manifest.json` 校验通过。
  - 导出失败不修改原仓库；磁盘不足有可读提示。
- **测试义务**：manifest 生成纯函数单测；tempdir 往返导出/解压测试。
- **跨端影响**：`shared`。
- **实现备注（2026-09-10）**：包内结构为 `repo/<仓库相对路径>`（含 `.git/`）+ 根 `manifest.json`（最后写入），`repo/` 前缀避免与仓库内同名文件冲突；`sha256` 按写入顺序对「条目名 + 长度 + 内容」哈希，恢复端可校验；进度经 Tauri Channel 下发（scanning / writing），取消走 `BackupState` 中的 `AtomicBool`，取消或失败会删除半成品 zip；`assets/` 排除为 UI 可选项并在卡片明示。新增 `sha2` 0.11；Rust 7 项测试（含往返解压与取消）、前端 5 项。

#### M1-E3-T3 从备份恢复（M）

- **交付物**
  - 新增 command `restore_repo_backup`：校验 manifest + sha256 → 解压到临时目录 → 完整性检查 → 移入 `notes_dir` 并注册为仓库。
  - 安全防护：zip slip（`../` 路径穿越）、超大文件、符号链接、已存在目标冲突。
- **验收标准**
  - 正常备份可完整恢复，笔记内容与 Git 历史一致。
  - 恶意 zip（路径穿越 / 校验不符 / 缺 manifest）被拒绝且不落盘。
- **测试义务**：恶意 zip 拒绝测试；损坏 sha256 拒绝测试；往返恢复集成测试。
- **跨端影响**：`shared`。
- **实现备注（2026-09-10）**：恢复流程 = 校验 manifest（schemaVersion）→ 按导出顺序重算 sha256 → 拒绝路径穿越 / 绝对路径 / 盘符 / 符号链接 / 超限条目 → 解压到 `notes_dir/.restore-<ts>` → `Git2Maintenance` 完整性检查（有 error 即中止）→ 原子 `rename` 到 `notes_dir/<仓库名>`；仓库名做安全化（限字母数字 / `-` / `_`），目标目录已存在直接报错，失败清理临时目录。单条 512 MiB、整体 16 GiB 上限防压缩炸弹。Rust 往返 / 篡改 / 恶意路径测试 + 前端 3 项。

#### M1-E3-T4 故障恢复演练与自动化（M）

- **交付物**
  - 新增 `docs/INCIDENT_RECOVERY.md`：断网、崩溃、误删、仓库损坏、凭证失效、磁盘不足六类场景的恢复步骤。
  - 至少 3 类场景的自动化集成/E2E 测试（断网同步、保存失败恢复、备份恢复）。
  - 发布前演练清单，纳入 `docs/RELEASE.md`。
- **验收标准**：每类场景有明确「用户操作 → 预期结果」；自动化测试可重复通过。
- **测试义务**：`pnpm test:e2e` 或 Rust 集成测试覆盖；演练记录归档到 PR 描述。
- **跨端影响**：`shared`。
- **实现备注（2026-09-10）**：新增 `docs/INCIDENT_RECOVERY.md`（六类场景「现象 → 用户操作 → 预期结果」）；自动化演练落在 `src-tauri/src/recovery_drill.rs`，3 条可重复运行的用例：保存失败保留原内容并可重试、误删从回收站恢复、仓库对象损坏 → 完整性检查报警 → 从备份恢复 → 复检健康；新增 `pnpm test:drills`；发布前演练清单并入 `docs/RELEASE.md`。断网 / 崩溃 / 凭证 / 磁盘四类仍为手动演练（见清单）。

#### M1-E3-T5 可恢复 UI 收口（M）

- **交付物**
  - 保存失败：保留 dirty、内联重试、不替换编辑区内容（收口既有实现）。
  - 同步失败：展示失败阶段 + 原因 + 重试 + 导出诊断包入口。
  - 删除：明确提示进入回收站 + 恢复入口。
  - 冲突：保留三栏合并，同时提供「导出冲突文件」兜底。
- **验收标准**：三类失败均有明确下一步动作；不出现只有错误码、无操作建议的界面。
- **测试义务**：RTL 覆盖三类失败态；移动端人工验证。
- **跨端影响**：`Desktop Impact`：有；`Mobile Impact`：有。
- **实现备注（2026-09-10）**：
  - 同步失败：新增纯函数 `deriveSyncFailure`（`src/features/sync/utils/status.ts`）把错误码映射为「阶段 + 原因 + 建议动作 + 是否可重试」，`SYNC_4004 → 推送`、`SYNC_4002/4003 → 拉取·推送`、本地 `GIT_* / IO_* / NOTE_* → 本地提交`；新增 `SyncFailureBanner` / `SyncFailureNotice`（`shared`，桌面与移动共用），凭证失效时主按钮为「重新登录」并直达设置页账户分区，其余为「重试同步」；横幅恒带「导出诊断包」入口。桌面把同步编排上提到 `WorkspaceLayout` 的 `DesktopContent`，导航轨与横幅共享同一实例（否则失败态只留在按钮实例里不可见），失败时导航按钮转为危险色并显示「同步失败」。启动同步失败仍由全局错误中心（toast，含本地化建议）承担，阶段化收敛留给 M1-E4-T4。
  - 保存失败：`useNoteSaveQueue` 的 `AppError` 一路传到 `EditorToolbar`（新增 `saveErrorCode`），错误行改为「原因 + 建议 + 重试保存」两行，建议由纯函数 `saveFailureHintKey` 给出（IO 类指向磁盘与权限，其余指向重试与诊断包）；dirty 不回滚、不替换编辑区内容（既有行为，回归用例在 `useNoteSaveQueue.test.tsx` 与 `EditorToolbar.test.tsx`）。
  - 删除：确认框补「恢复入口：侧边栏「回收站」」与内联「打开回收站」按钮，点击后直接切到回收站面板（桌面侧边栏 / 移动标签页共用同一 `sidebarTab`）。
  - 冲突：三栏合并头部新增「导出冲突文件」兜底，新增 Rust 命令 `export_conflicts`（`services/conflict_export_service.rs` 构建条目 + 复用 zip 写入），包内为 `local/<路径>` 与 `remote/<路径>` 两侧内容，拒绝绝对路径与 `..`。
  - 清理：删除长期未被引用的 `src/features/sync/components/SyncBar.tsx`（桌面同步状态早已由 `WorkspaceNavRail` 承担），避免两套同步状态界面分叉。
  - 验证：单测新增 `status.test.ts`（阶段推断 / 建议映射）、`SyncFailureNotice.test.tsx`、`EditorToolbar.test.tsx`（保存失败）、`DeleteConfirmDialog.test.tsx`、`ConflictMergeDialog.test.tsx`（导出兜底）、`saveFailure.test.ts`、`MobileWorkspaceShell.test.tsx`（移动壳失败横幅）、Rust `conflict_export_service` 4 项；新增 `e2e/recoverable-ui.spec.ts` 4 条真实前端流程（同步失败 / 冲突导出 / 删除恢复入口 / 窄屏移动壳）。**移动端人工验证未完成**：当前环境无 Android 设备或模拟器（`adb devices` 为空），已完成的是窄屏移动单栏壳的真实前端 e2e 与移动壳 RTL；真机验证步骤见 `docs/INCIDENT_RECOVERY.md`，建议发布前在 Android 设备上复查一遍同步失败横幅与回收站入口。

---

### Epic E4：同步可靠性

#### M1-E4-T1 同步错误分类与可读提示（M）

- **背景**：当前 `AppError::Git` 统一映射为 `GIT_4001`（`retriable: true`），网络中断、凭证失效、远端拒绝无法区分。
- **交付物**
  - 新增错误变体与错误码：`SYNC_4002` 网络/超时（可重试）、`SYNC_4003` 凭证失效（需重新登录）、`SYNC_4004` 远端拒绝/权限不足（不可重试）。
  - 在 Repository 边界根据 libgit2 error class/code 映射，不泄漏原始错误。
  - 前端 `src/api/error.ts` 扩展 `ErrorKind`，i18n 提供可操作文案。
- **改动范围**：`src-tauri/src/domain/error.rs`、新增 `repositories/git2_error.rs`、`repositories/git2_remote.rs`、`src/api/error.ts`、`src/i18n/messages.ts`、`src/stores/toast.store.ts`。
- **验收标准**：三类错误可被前端区分；凭证失效引导重新登录；网络错误提示可重试。
- **测试义务**：`error.rs` 映射单测；`git2_remote` 错误分类单测；前端错误处理测试。
- **跨端影响**：`shared`。

#### M1-E4-T2 幂等操作重试策略（M）

- **交付物**
  - 纯函数退避策略（指数 + 抖动 + 上限），仅用于 `fetch` / `pull` / `ls_remote` 等幂等操作。
  - `push` 不自动重试（避免非幂等风险），失败后由用户显式重试。
  - 前端展示「重试中（n/3）」，可取消。
- **改动范围**：新增 `src-tauri/src/services/retry.rs`（纯函数）、`services/sync_service.rs`、`src/features/sync/hooks/useSync.ts`。
- **验收标准**：首次失败后自动重试并成功；重试上限后给出明确失败原因；不重复推送。
- **测试义务**：退避纯函数单测；Mock backend 模拟失败后成功；前端重试态测试。
- **跨端影响**：`shared`。
- **实现备注（2026-09-10）**：
  - 退避策略落在新增的 `src-tauri/src/services/retry.rs`：`backoff_ms`（指数 + 封顶）、`jittered_ms`（±比例抖动，随机系数由调用方传入以保持纯函数）、`delay_ms`、`should_retry`，以及可注入「等待 / 进度回调 / 取消标志」的 `with_retry`。默认策略为 3 次重试、0.5s 起、8s 封顶、±25% 抖动（合计等待约 3.5s）。
  - 只有 `AppError::SyncNetwork` 进入自动重试：凭证失效（要重新登录）、远端拒绝（要用户决策）、冲突与本地错误一律快速失败。重试只包在幂等的拉取阶段（`sync_service::pull_stage`）；`push` 不进入重试路径，且拉取最终失败时直接返回、不会推送（单测断言 `recorded` 中没有 `push`）。
  - 进度经 Tauri Channel 下发 `SyncProgressDto`；新增 `cancel_sync_retry` 命令与 `SyncRetryState` 取消标志。取消只结束退避等待、不再发起新尝试，保留最后一次的原始错误交由用户显式重试（不中断已发出的网络请求）。
  - 前端新增全局 `useSyncRetryStore` 收敛手动同步、启动同步与命令面板三条入口的进度（各自 mutation 实例无法共享，之前失败态/进度会丢）；`SyncRetryBanner` 展示「重试中（n/m）+ 预计等待秒数」并提供「取消重试」，原 `SyncFailureNotice` 更名为 `SyncNotice`（重试态优先于失败态）。
  - 顺带修掉一个重复推送隐患：`useStartupSync` 原先用 react-query 的 `retry` 重放整条 `sync_now`（commit → pull → push），现改为 `retry: false`，重试只发生在 Rust 侧的幂等拉取阶段。
  - 验证：Rust 新增 `retry` 7 项纯函数/编排单测与 2 项 `sync_service` 重试单测（前两次网络失败后成功；持续失败时共 4 次拉取且不推送）；前端新增 `SyncNotice` 重试态、`sync-retry.store`、`sync.queries` 进度写入与结算清空用例；e2e 新增「重试中（n/m）可取消」1 条（IPC mock 支持模拟 Channel 进度与取消）。

#### M1-E4-T3 大仓库性能基准（M）

- **背景**：`src-tauri/src/perf_baseline.rs` 已有 1000 篇搜索/索引、5000 行读写、1000 篇导入基准，但缺附件、目录树与软渲染链路。
- **交付物**
  - 扩展基准：20MB 附件导入、1000 篇目录树构建、5000 行软渲染解析、同步状态查询。
  - 输出 `docs/PERF_BASELINE.md`：设备信息、每项耗时、阈值与回归判断方式。
  - 保持 `pnpm perf:baseline` 手动运行，不把机器差异写死进 CI 阻断。
- **验收标准**：基准可重复运行；1000 篇搜索/目录交互 < 100ms；冷启动到可编辑 < 2s（已克隆仓库）。
- **测试义务**：基准脚本自检；结果记录归档。
- **跨端影响**：`shared`。
- **实现备注（2026-09-10）**：Rust 基准扩到 7 项（新增 20MB 附件导入、1000 篇目录树、300 提交同步状态）；前端新增 `softRender/perf.test.ts`（`--mode perf` 门控，正常 `pnpm test` 跳过），测 5000 行 Lezer 解析 + 软渲染计划；`pnpm perf:baseline` 串联 Rust 与前端；新增 `docs/PERF_BASELINE.md` 记录设备、数字、阈值与回归判断。首次基线：search_1000 33.3ms、tree_1000 5.3ms、asset_20mb 3.9ms、sync_status 11.4ms、softrender 16.0+9.4ms（debug，Apple M4 Pro）。

#### M1-E4-T4 同步失败定位到阶段/文件（M）

- **交付物**
  - 同步结果 DTO 增加 `stage`（commit / pull / push）、`files?`、`hint`。
  - 前端同步失败面板展示阶段与可操作建议。
- **改动范围**：`src-tauri/src/domain/sync.rs`、`commands/git/sync.rs`、`src/features/sync/`。
- **验收标准**：能区分「本地提交失败 / 拉取失败 / 推送失败」；失败文件可定位。
- **测试义务**：DTO 序列化测试；前端失败态测试。
- **跨端影响**：`shared`。
- **实现备注（2026-09-10）**：
  - DTO 侧在 `domain/sync.rs` 新增 `SyncStage`（`commit` / `pull` / `push`），`AppErrorDto` 增加三个**可选**字段：`stage`、`files`（`Vec<String>`，空则不序列化）、`hint`（可操作建议码）；新增 builder `AppErrorDto::with_sync_context(...)`，非同步错误不受影响（`From<AppError>` 保持三字段为空）。`hint` 取值 `relogin` / `checkPermission` / `resolveConflicts` / `retry`。
  - `services/sync_service.rs` 的 `sync()` 改为返回 `Result<SyncStatus, SyncFailure>`：commit / pull / push 三段各自 `map_err` 归因，统一经 `stage_failure(...)` 打日志并携带阶段与文件（拉取冲突时用 `conflict_paths()` 列出具体文件，未完成合并同样归因到 `Pull` 并带文件）。
  - `commands/git/sync.rs` 的 `sync_now` 不再走 `commands::blocking::run`（该封装会把 `SyncFailure` 压平成普通错误），改为 `tauri::async_runtime::spawn_blocking` 后经 `sync_failure_dto(...)` 转成带上下文的 `AppErrorDto`，前端因此能拿到阶段与文件。
  - 前端 `deriveSyncFailure` 优先采用后端 `stage`/`hint`，缺失时回落到原有的错误码推断（兼容旧数据）；失败横幅新增「失败文件（n）」列表，超过 5 条折叠为「另有 n 个未显示」，路径为仓库相对路径，桌面与移动共用同一 `shared` 组件。
  - 验证：Rust 新增 `SyncStage` 序列化 / 未知 stage 容错 2 项 + `sync_service` 阶段归因 5 项（提交失败、拉取冲突带文件、未完成合并带文件、网络失败、推送拒绝带 hint），全量 200 项通过；前端 `status` / `SyncNotice` 新增 8 项（stage/hint 优先级、文件透传与折叠）；e2e 新增 2 条真实前端用例（桌面 1440px「拉取阶段 + 冲突文件」、窄屏 430px「本地提交阶段 + 文件」）。

---

### Epic E5：度量地基

#### M1-E5-T1 本地事件计数（M）

- **交付物**
  - 新增 `metrics_service.rs`：本地 JSON 计数，覆盖 `app_launched`、`repo_bound`、`note_created`、`sync_succeeded`、`sync_failed`、`ai_action_confirmed`、`update_checked` 等事件。
  - 只记录事件名、时间戳、平台、版本；**不记录**笔记内容、路径、Token、Key、远端 URL。
  - 提供读取与清空命令。
- **改动范围**：新增 `services/metrics_service.rs`、`commands/metrics.rs`、`src/api/metrics.api.ts`；`src-tauri/src/lib.rs` 注册。
- **验收标准**：计数可持久化、可清空；进程重启后保留；不含敏感字段。
- **测试义务**：累加/滚动窗口纯函数 ≥ 90%；持久化往返测试。
- **跨端影响**：`shared`。

#### M1-E5-T2 同意页与开关（M）

- **交付物**
  - 首次运行或首次打开设置时展示本地计数说明（默认本地开启、远程关闭）。
  - 远程上报（若 D2 启用）必须显式同意，可随时关闭并删除队列。
  - 新增 `docs/PRIVACY.md`：采集范围、存储位置、关闭方式、删除方式。
- **验收标准**：默认不采集笔记内容；关闭开关后停止写入；隐私文档与实际行为一致。
- **测试义务**：同意状态持久化测试；关闭后写入函数不被调用。
- **跨端影响**：`shared`。

#### M1-E5-T3 指标导出与漏斗视图（S）

- **交付物**
  - 设置页展示本机漏斗：安装 → 绑定仓库 → 首篇笔记 → 周活跃天数 → 同步成功率。
  - 支持导出 JSON / CSV（用户主动操作）。
- **验收标准**：指标定义与 `docs/ROADMAP.md` §3 一致；导出文件可读且不含敏感信息。
- **测试义务**：漏斗计算纯函数单测。
- **跨端影响**：`shared`。

---

## 5. 执行波次

> 以「无外部依赖先启动、可并行则并行」为原则；每波结束做一次小复盘。
> 🧊 证书类任务不进入任何波次，统一在 M1.5 启动。

### Wave 0 — 无依赖启动（第 0–3 天）

- [ ] 确认 D2 / D3 / D4 决策（D1、D5 已暂缓）。
- [ ] 生成发布签名 GPG key，公钥发布方式定稿。
- [ ] 评审日志与脱敏方案（M1-E2-T1），确定日志库与轮转策略。
- [x] 启动性能基准扩展（M1-E4-T3，无外部依赖，可先跑）。
- [x] 建立 `docs/TROUBLESHOOTING.md` 骨架（M1-E1-T6）。

### Wave 1 — 可诊断性地基（第 1–2 周）

- [x] M1-E2-T1 Rust 本地日志 + 脱敏。
- [x] M1-E2-T2 前端错误边界与全局错误日志。
- [x] M1-E4-T1 同步错误分类与可读提示（无外部依赖，提前）。
- [x] M1-E4-T3 性能基准扩展。

### Wave 2 — 诊断、备份与恢复（第 2–4 周）

- [x] M1-E2-T3 诊断包导出。
- [x] M1-E2-T5 设置页「诊断与反馈」。
- [x] M1-E3-T1 仓库完整性检查。
- [x] M1-E3-T2 整库备份 / 导出。
- [x] M1-E3-T3 从备份恢复。
- [x] M1-E3-T4 故障恢复演练与自动化。

### Wave 3 — 同步可靠性、度量与分发（第 4–5 周）

- [x] M1-E4-T2 幂等重试策略。
- [x] M1-E4-T4 同步失败定位。
- [ ] M1-E5-T1 / T2 / T3 度量地基。
- [ ] M1-E1-T3 Linux 产物校验与签名（GPG）。
- [x] M1-E1-T5 Android 应用内更新提示。

### Wave 4 — 收口与发布（第 5–6 周）

- [x] M1-E3-T5 可恢复 UI 收口。
- [ ] M1-E1-T6 分发与排查文档定稿。
- [ ] 全量门禁 + 三平台安装验证（未签名平台按文档放行）+ 故障演练 + 发布 v0.25。

### M1.5 — 签名与分发（🧊 暂缓，预算批准后启动）

- [ ] M1-E1-T1 macOS Developer ID 签名 + 公证。
- [ ] M1-E1-T2 Windows 代码签名（SignPath / Azure Trusted Signing）。
- [ ] M1-E1-T4 iOS TestFlight 内测通道。
- [ ] 移除 `docs/TROUBLESHOOTING.md` 中未签名平台的放行引导（改为签名后直达安装）。

---

## 6. 每个任务的完成定义（DoD）

- **代码**
  - 新增功能优先新目录 / 新文件：`src/features/support/`、`src-tauri/src/commands/support/`、`src-tauri/src/commands/repo/` 新文件。
  - 单文件 ≤ 300 行，React 组件 ≤ 220 行，单函数 ≤ 60 行，圈复杂度 ≤ 12。
  - 禁 `any`；组件不得直接 `invoke()`；Rust Command 返回 `Result<T, AppErrorDto>`。
  - Service 只依赖 trait，不依赖 `git2` 具体类型。
- **测试**
  - 核心业务逻辑与纯函数必须有单测；`lib/` / `utils/` / `domain/` 覆盖率 ≥ 90%。
  - 前端用 `vi.mock('@/api')` 隔离 IPC；Rust 注入 Mock backend。
  - 新增/修改命令必须有 Rust 单测或集成测试。
- **验证**
  - `pnpm build && pnpm test && pnpm lint` 全绿。
  - Rust 改动执行 `cargo test`（必要时 `cargo check --release` 交叉目标）。
  - 跨端任务桌面与移动各验证一次。
- **文档**
  - 同步更新 `docs/ROADMAP.md` 状态、`docs/RELEASE.md`（发布相关）、`docs/CHANGELOG.md`（用户可见变更）。
  - 需求/架构变化同步 `docs/PRD.md` / `docs/ARCHITECTURE.md`。

---

## 7. 发布 v0.25 门禁

- [ ] M1 退出标准 6 项全部满足。
- [ ] 三平台干净环境安装 + 自动更新验证通过（macOS / Windows 未签名场景按 `docs/TROUBLESHOOTING.md` 放行步骤实测）。
- [ ] 所有 Release 产物提供 `SHA256SUMS` + `SHA256SUMS.asc`，校验命令可在干净环境执行。
- [ ] 故障恢复演练 6 类场景记录归档。
- [ ] 诊断包脱敏审计通过（敏感串扫描为 0）。
- [ ] 同步成功率与性能基准达标。
- [ ] 无 P0 数据丢失缺陷。
- [ ] `docs/RELEASE.md` 发布步骤更新，`docs/CHANGELOG.md` 补齐。
- [ ] 版本号三处一致（`package.json` / `tauri.conf.json` / `Cargo.toml`），`pnpm release:check` 通过。
- [ ] 发布说明明确标注「当前阶段未做证书签名，M1.5 承接」，不暗示已签名。

---

## 8. 风险登记

| 风险 | 概率 | 影响 | 应对 | 负责任务 |
|---|---|---|---|---|
| 未签名安装体验差，下载转化受损 | 高 | 中 | `docs/TROUBLESHOOTING.md` 提供校验与放行步骤；发布说明明确；M1.5 优先解决 | E1-T6 |
| 🧊 证书申请周期（M1.5 风险，不占 M1 工期） | 中 | 高 | 预算批准后立即启动；M1 不受影响 | M1.5-E1-T1/T2 |
| 🧊 OV 证书 SmartScreen 信誉累积慢 | 中 | 中 | M1.5 优先 SignPath / Azure Trusted Signing | M1.5-E1-T2 |
| 🧊 iOS libgit2 链接问题反复 | 高 | 中 | M1.5 只承诺 TestFlight；与 M4 共享排查 | M1.5-E1-T4 |
| 诊断包误包含敏感信息 | 低 | 高 | 白名单生成 + 敏感串扫描 + 审计门禁 | E2-T3 |
| 远程上报引发隐私质疑 | 中 | 高 | 默认关闭、显式同意、隐私文档；必要时 M1 只做本地 | E2-T4 |
| 备份/恢复引入数据风险 | 低 | 高 | 恢复前校验 + 临时目录 + 完整性检查 + 往返测试 | E3-T2/T3 |
| 度量埋点范围蔓延 | 中 | 中 | 只采集第 3 节定义的指标，新增事件需评审 | E5-T1 |
| 任务过多导致 M1 延期 | 高 | 中 | 严格执行 M1a 切分线，其余顺延 v0.25.x | 全部 |

---

## 9. 进度看板

| 任务 | 状态 | PR | 备注 |
|---|---|---|---|
| M1-E1-T1 macOS 签名 + 公证 | 🧊 | | M1.5，等预算批准 |
| M1-E1-T2 Windows 代码签名 | 🧊 | | M1.5，等预算批准 |
| M1-E1-T3 Linux 校验与签名 | 📋 | | 等 GPG key |
| M1-E1-T4 iOS TestFlight | 🧊 | | M1.5，等 Apple 账号 |
| M1-E1-T5 Android 更新提示 | ✅ | | GitHub Release 检查 + 版本比较纯函数（降级保护）；只提示不静默安装，可忽略该版本 |
| M1-E1-T6 分发与排查文档 | ✅ | | TROUBLESHOOTING.md + README 入口；Windows/Linux 命令待实测 |
| M1-E2-T1 Rust 本地日志 | ✅ | | tauri-plugin-log 2.9.1 + 全局脱敏；设置页清理归 E2-T5 |
| M1-E2-T2 前端错误边界 | ✅ | | ErrorBoundary + window 级捕获，经 support.api.ts 上报 |
| M1-E2-T3 诊断包导出 | ✅ | | zip + 保存对话框；包内白名单 + 脱敏扫描 |
| M1-E2-T4 opt-in 上报 | 🧊 | | 等 D2 |
| M1-E2-T5 诊断与反馈设置页 | ✅ | | 日志开关 / 目录 / 清理 + 诊断包导出 + 隐私说明；移动端单栏 |
| M1-E3-T1 仓库完整性检查 | ✅ | | ODB 只读校验 + 索引/远端/权限；REPO_3101~3107 |
| M1-E3-T2 整库备份 | ✅ | | repo/ 前缀 + manifest.sha256；Channel 进度 + 可取消 |
| M1-E3-T3 从备份恢复 | ✅ | | 校验 sha256 + 防穿越/符号链接 + 完整性检查 + 原子落盘 |
| M1-E3-T4 故障恢复演练 | ✅ | | INCIDENT_RECOVERY.md + 3 条自动化演练 + RELEASE 清单 |
| M1-E3-T5 可恢复 UI | ✅ | | 同步失败横幅（阶段/原因/重试/诊断包）+ 保存失败建议 + 删除恢复入口 + 冲突导出；新增 export_conflicts |
| M1-E4-T1 同步错误分类 | ✅ | | SYNC_4002/4003/4004 + 前端 i18n 可操作提示 |
| M1-E4-T2 幂等重试 | ✅ | | 幂等拉取退避重试（3 次 / 0.5s 起 / 8s 封顶 / ±25% 抖动）+ Channel 进度 + 可取消；push 不重试 |
| M1-E4-T3 性能基准 | ✅ | | 7 项 Rust + 5000 行软渲染；docs/PERF_BASELINE.md |
| M1-E4-T4 同步失败定位 | ✅ | | `SyncStage` + `AppErrorDto.stage/files/hint` 由后端归因下发；前端展示失败文件（>5 折叠）并优先采用后端 stage/hint |
| M1-E5-T1 本地事件计数 | 📋 | | 等 D4 |
| M1-E5-T2 同意页与开关 | 📋 | | 等 D4 |
| M1-E5-T3 指标导出与漏斗 | 📋 | | |

---

## 10. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-09-10 | v1.12：D3 确认（仅 GitHub APK + 应用内更新提示）并交付 M1-E1-T5（移动端启动/设置页检查 GitHub Release，新版本提示 + 跳转下载页；无网络静默降级，不误报当前版本） | PM |
| 2026-09-10 | v1.11：M1-E4-T4 交付（同步失败定位：`AppErrorDto` 携带 `stage` / `files` / `hint`，`sync_now` 保留原始错误上下文；前端失败横幅展示可定位的失败文件并优先采用后端阶段与建议） | PM |
| 2026-09-10 | v1.10：M1-E4-T2 交付（幂等拉取自动重试 + 重试进度 / 取消；push 不自动重试，移除整条 sync_now 的前端重试） | PM |
| 2026-09-10 | v1.9：M1-E3-T5 交付（可恢复 UI 收口：同步失败横幅 + 保存失败建议 + 删除恢复入口 + 冲突导出兜底；新增 `export_conflicts` 与 4 条真实前端 e2e） | PM |
| 2026-09-10 | v1.8：M1-E3-T4 交付（故障恢复手册 + 3 条自动化演练 + 发布前演练清单） | PM |
| 2026-09-10 | v1.7：M1-E3-T3 交付（从备份恢复：校验 + 安全解压 + 完整性检查 + 注册仓库） | PM |
| 2026-09-10 | v1.6：M1-E3-T2 交付（整库备份导出：zip + manifest.sha256 + 进度/取消） | PM |
| 2026-09-10 | v1.5：M1-E1-T6 交付（docs/TROUBLESHOOTING.md + README 安装章节入口） | PM |
| 2026-09-10 | v1.4：M1-E3-T1 交付（仓库完整性检查：RepoMaintenanceBackend + git2 只读实现 + 设置页卡片） | PM |
| 2026-09-10 | v1.3：M1-E4-T3 交付（附件 / 目录树 / 同步状态 / 软渲染基准 + docs/PERF_BASELINE.md） | PM |
| 2026-09-10 | v1.2：M1-E2-T5 交付（设置页诊断与反馈：日志开关 / 目录 / 清理 + 诊断包导出 + 隐私说明）；README 增补「隐私与诊断数据」 | PM |
| 2026-09-10 | v1.1：证书 / 签名类任务（E1-T1/T2/T4）暂缓至 M1.5，M1 聚焦可诊断、可恢复、同步可靠与度量；重排 Wave 0–4 与发布门禁；M1-E4-T1 交付（SYNC_4002/4003/4004 + 前端可操作提示）；M1-E2-T1 交付（结构化日志 + 全局脱敏）；M1-E2-T2 交付（错误边界 + window 级错误上报）；M1-E2-T3 交付（诊断包导出 + 脱敏扫描） | PM |
| 2026-09-10 | 初版：按 ROADMAP M1 拆解为 23 个可执行任务，补充 Day 0 决策点、波次、DoD 与风险登记 | PM |
