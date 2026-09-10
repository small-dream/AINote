# AINote 代码评审报告（第二轮 · 全项目综合评审）

> 评审日期：2026-09-10 · 评审基线：`main @ f62e266`（v0.26.0，工作区干净）
> 评审范围：`src/` 前端 + `src-tauri/src/` Rust 后端 + `e2e/` + 文档一致性
> 评审侧重点：架构与规范合规 / 健壮性与安全 / 测试覆盖 / 性能与代码异味
> 评审方法：5 路并行专项评审 + 关键发现逐条人工复核（复核发现 2 条误报，已在文中剔除并说明）
> 与第一轮报告（`CODE_REVIEW_2026-09-10.md`）的关系：第一轮 12 项发现已全部修复并**复核确认落地**（抽查 CSP 配置、`open_external` 错误类型、对话框 key、关闭守卫 flush 均已在代码中生效）；本轮为全新发现，无重复项。
> 结论：**整体工程质量保持高位，无 P0**；发现 **1 项 P1、5 项 P2、9 项 P3**。

## 0. 结论速览

| ID | 严重度 | 问题 | 影响面 | 建议动作 |
|---|---|---|---|---|
| P1-1 | P1 | 桌面端 GitHub Token 实际为「AES-GCM 文件 + 同目录密钥」落盘，与文档红线「只存系统钥匙串」不符 | desktop | 桌面端接入系统钥匙串，或修订文档红线并写明威胁模型 |
| P2-1 | P2 | 富文本 PDF 导出链路存在 `javascript:` href XSS 缝隙（TipTap JSON 解析不校验协议） | shared | `richTextJsonToHtml` 产出后按协议白名单过滤 href/src |
| P2-2 | P2 | 同步流程无仓库级并发互斥，多入口可同时触发对同一仓库的 Git 操作 | shared | Rust 侧加 per-repo 互斥，重入返回「同步进行中」 |
| P2-3 | P2 | 分栏/预览模式下每次击键全量重跑 Markdown 渲染管线（remark + 高亮 + KaTeX） | shared | 预览内容做 200–300ms 防抖 |
| P2-4 | P2 | KaTeX 在产物中被重复打包（3 个 JS chunk，约 256KB × 2 冗余） | desktop + mobile | `manualChunks` 固定单一 katex chunk，预览侧复用懒加载 |
| P2-5 | P2 | 测试义务缺口：`src/queries/` 90% 无测试、核心 Zustand store 半数无测试、auth 链路服务层无单测 | shared | 按 §4 清单补测 |
| P3-1 | P3 | 桌面工作区直接 import 移动壳，字面违反「双壳不得互相 import」 | shared | 壳选择上移到组装层，或在规范中明确此例外 |
| P3-2 | P3 | 文档宣称「ESLint 已强制」的边界（components→features、双壳互 import、组件 ≤220 行）实际无规则覆盖 | shared | 补齐 eslint overrides 或修正文档措辞 |
| P3-3 | P3 | `WikiPanel.tsx` 221 行超「组件 ≤220 行」上限，且打开期间每次渲染重算 O(n²) 反链 | shared | 三段式拆分 + `useMemo` + 名称索引预建 |
| P3-4 | P3 | Git 文件历史遍历对每个提交两次全量读取 blob 内容做比较 | desktop + mobile | 改为比较 tree entry 的 ObjectId，零内容读取 |
| P3-5 | P3 | 软渲染 decoration 在光标移动（未改文档）时也全文档重规划 | shared | selection-only 变化走增量重算 |
| P3-6 | P3 | `conflicts_export.rs` Command 直接编排 Repository 承载业务逻辑 | Rust | 编排下沉为 Service 用例 |
| P3-7 | P3 | IO/git2 错误消息丢失路径上下文或原文透传本机绝对路径到前端 | Rust | Repository 边界补路径上下文 + 消息脱敏 |
| P3-8 | P3 | 调试探针测试 `src/ls_check.test.ts` 残留（无断言，纯 console.log） | 前端 | 删除 |
| P3-9 | P3 | 路由无代码分割，主 chunk 1.37MB（react-markdown 经 AskAiPanel 静态进主包） | shared | 路由级 `React.lazy` + AskAiPanel 按需加载 |

## 1. 门禁与测试现状（实测）

| 维度 | 数据 |
|---|---|
| 前端单测 | 132 个测试文件 / 707 用例（706 通过 + 1 跳过 perf 基线），`pnpm test` 全绿 |
| Rust 单测 | 241 lib 测试（235 通过 + 6 个 `#[ignore]` 手动性能基线）+ 2 集成测试，`cargo test` 全绿 |
| E2E | 7 个 spec / 38 用例（Playwright + mock 后端约 40 个命令处理器） |
| ESLint 硬指标 | `max-lines` 300 / `max-lines-per-function` 60 / `complexity` 12 / `no-explicit-any` 全部入配且全绿 |
| TODO/FIXME/HACK | 全仓扫描 **0 条真实遗留** |
| git 历史密钥 | 全量 `git log -p -G` 扫描（`ghp_`/`github_pat_`/`sk-`/`AKIA`/私钥头）仅命中测试 fixture 假 token |

## 2. 架构与规范合规

合规项（抽查验证成立）：

- **IPC 边界干净**：`invoke()` 仅出现在 `src/api/client.ts` 与 e2e mock；`@tauri-apps/plugin-*` 也收敛在 api 层。
- **依赖方向单向**：`components/` → `features/` 零引用；Rust 侧 `domain/` 零外部依赖，`git2` 类型严格收敛在 `repositories/git2_*.rs`，Service 一律 `GitBackend` trait 泛型注入。
- **状态分层**：服务端状态全部走 TanStack Query（`queries/` 一领域一文件），无 `useState` 镜像服务端数据；Zustand store 48 处订阅全部使用选择器。
- **平台差异收敛**：UA 判断唯一在 `src/platform/runtime.ts:5`；阻塞 IO 统一走 `commands/blocking.rs` 的 `spawn_blocking`。
- **生产代码 `unwrap/expect/panic!` 极少**：仅 14 处，全部为常量正则、受不变量保护或 Tauri 官方惯例，无高风险点。

发现的问题：

### P3-1 桌面工作区直接 import 移动壳

- 位置：`src/pages/workspace/WorkspaceLayout.tsx:14`（`:42` 按 `useIsMobileViewport()` 切换双壳）
- 依据：`CODING_STANDARDS.md` §5.1 / `ARCHITECTURE.md` §3「两个壳不得互相 import」。反向（mobile-shell → pages/workspace）已验证干净；这是功能必需的壳选择点，但按字面规则应收敛到路由/组装层。
- 建议：壳选择上移到 `app/router.tsx` 或独立 `ShellSwitcher`；或在规范中明确「工作区入口允许单向组装移动壳」的例外。

### P3-2 文档宣称的机器强制与实际 ESLint 配置不符

- 位置：`eslint.config.js:20-24`（`no-restricted-imports` 只限制 `@tauri-apps/api*`）
- 缺口：① `components/` 禁止 import `features/`（AGENTS.md 称「ESLint 已强制」）无规则；② 双壳互 import 无规则；③ 「组件 ≤220 行」无规则（全局只有 300）。当前代码经 grep 验证无违规实例，但边界靠自觉，与「能机器强制的规则一律进 ESLint」的原则相悖。
- 建议：为 `src/components/**` 加禁止 `@/features/*` 的 overrides；为双壳互 import 加 patterns 限制；对 `**/components/**/*.tsx` 加 `max-lines: 220`。

### P3-6 `conflicts_export.rs` Command 承载业务逻辑

- 位置：`src-tauri/src/commands/git/conflicts_export.rs:10,23-37` —— Command 闭包内直接编排 `list_conflicts` → `build_entries` → `diagnostics_files::write_zip` → 手工组装 DTO，违反「Command 只做参数反序列化、调用 Service、错误映射」。
- 建议：整体下沉为 `conflict_export_service::export(...)`，Command 只保留对话框交互与错误映射。

其他低严重度架构观察（不入表）：

- 约 15 个 command 文件各自实例化 `Git2Backend`（如 `commands/git/sync.rs:11,45`），具体类型散布 Controller 层；建议在 `lib.rs` 统一构造经 tauri state 注入。
- `services/ai_service.rs:205`、`services/note_service.rs:116` Service 层直接 `std::fs` 读文件，绕过 Repository。
- Rust 5 个文件总行数超 300（`sync_service.rs` 483 / `domain/metrics.rs` 466 / `trash_files.rs` 312 / `ai_settings.rs` 310 / `metrics_service.rs` 302），超标部分几乎全为内联测试；建议统一采用 `#[path = "x_tests.rs"]` 外置模式（仓库已有先例），`domain/metrics.rs` 生产代码 295 行已贴近上限建议优先拆分。

## 3. 健壮性与安全

安全基线（核查通过）：Token 不进入前端 IPC 返回值（`auth_status` 只回 `has_token` 布尔）；git 凭证走 `x-access-token` 回调不拼 URL；日志统一脱敏且有测试；路径穿越防御（`note_files.rs:8-20`）有专项测试；`open_external` 限定 http/https；无 `std::process::Command`、无 eval；capabilities 最小化。

### P1-1 桌面端 Token 存储与文档红线不符（已人工复核确认）

- 位置：`src-tauri/src/services/auth_store.rs:14-17, 53-65`（桌面分支）、`src-tauri/src/services/secure_store.rs:29-40`（AI Key 同模式）
- 证据：桌面端（macOS/Windows/Linux）主存储为 AES-256-GCM 加密文件写入 `app_config_dir`，**加密密钥（`auth.key`）与密文（`auth.token`）同目录**；keyring 插件虽注册但只有 iOS/Android 分支使用（`:160-191`）。
- 矛盾点：AGENTS.md 红线「GitHub Token 只存系统钥匙串（keyring）…绝不落盘」、`ARCHITECTURE.md` §1/§5 称「旧 AES-GCM 文件仅用于一次性迁移」，与实际实现不符。实际安全等级等同混淆存储：任何能读配置目录的本地进程即可解密，仅 `0600` 权限缓解。
- 建议：二选一——① 桌面端接入系统钥匙串（`keyring` crate 或复用 keyring 插件），保留 AES-GCM 文件仅作迁移路径；② 修订文档红线措辞并显式记录威胁模型。AI API Key 同理。

### P2-1 富文本 PDF 导出链路 XSS 缝隙

- 位置：`src/features/export/components/PdfExportOverlay.tsx:70`（`dangerouslySetInnerHTML`）+ `src/features/export/utils/richTextHtml.ts:9-24`
- 机理：`.ainote` 为 TipTap JSON，经 `JSON.parse` 走 ProseMirror JSON 解析——TipTap v3 Link 的 `isAllowedUri` 协议白名单只在 `parseHTML` 生效，**JSON 解析路径不校验 href**。被污染的仓库（多端同步进入的恶意 `.ainote`）可携带 `href: "javascript:..."`，导出预览中点击即在 Tauri WebView 上下文执行脚本，可触达全部 IPC Command。因需用户点击且 ProseMirror schema 会丢弃 `onclick` 类属性，缝隙收敛于链接 href，评 P2 而非 P1。
- 建议：`richTextJsonToHtml` 产出后按协议白名单过滤 `href`/`src`；富文本编辑器内链接点击统一走 `openExternal` 白名单。

### P2-2 同步无并发互斥

- 位置：`src-tauri/src/commands/git/sync.rs:38-82`、`src/features/sync/hooks/useStartupSync.ts:12-22`、`src/queries/sync.queries.ts:47-57`
- 证据：Rust 侧无仓库级锁，`sync_now` 每次直接 `spawn_blocking` 操作仓库；前端 `useStartupSync` 与 `useSyncNowMutation` 是两个独立 mutation 实例，`isPending` 互不共享，启动同步/导航轨/命令面板/移动端入口可并发触发。`SyncRetryState`（sync.rs:19）只保留最后一个 cancel flag，先到任务结束时的无条件 `set(None)`（sync.rs:71）会清掉仍在运行的另一次同步的取消标志。
- 影响：git index.lock 使后到操作报错而非损坏数据，但用户会看到偶发 lock 冲突错误，且取消语义有竞态。
- 建议：Rust 侧加 per-repo 互斥（`Mutex<()>` state 或防重入 AtomicBool，重入返回「同步进行中」）；或前端收敛为单一共享 mutation。

其他低严重度健壮性观察：

- `useLogin.ts:8` token 进 React state（表单场景难避免，不持久化，风险低；可改 `useRef` 更严格符合 §5.3）。
- `useWorkspaceActions.ts:40-55` 批量导入 `mutateAsync` 未 try/catch，`Promise.all` 一单失败即整体 reject，已成功文件无汇总反馈。
- `commands/repo/bind.rs:15` 绑定 URL 未拒绝内嵌凭证，`https://token@host/...` 会明文写入 app config 与 `.git/config`（日志已脱敏、落盘未处理）。
- `services/note_service.rs:116` `read_to_string(...).unwrap_or_default()` 静默吞错，文件损坏时列表静默回退为文件名标题且无日志。
- `domain/error.rs:93` `AppError::Git` 标记 `retriable: true`，本地 git 错误多数非瞬时，建议改 false 或拆分子类（当前仅 pull 网络错误实际自动重试，暂无危害）。
- `domain/error.rs:7` 注释引用「CODING_STANDARDS 第 3 节」，实际规范在 §4（文档引用漂移）。

### P3-7 错误消息上下文丢失 / 原文透传

- `domain/error.rs:113-117` `From<std::io::Error>` 仅保留 `err.to_string()`，前端收到 `io error: No such file or directory` 不含文件路径；建议在 Repository 边界 `map_err` 补路径。
- `repositories/git2_backend.rs:17-19`、`git2_error.rs:77-85` 的 `err.message()` 原文可能含本机绝对路径，直接进 `AppErrorDto.message` 送到前端 UI（日志侧已有 `redact`，错误消息侧没有）；建议过一遍路径脱敏。

### 误报剔除说明（评审纪律记录）

本轮评审中发现 2 条与第一轮修复记录冲突的指控，经人工逐条复核确认为**误报**，未计入发现：

1. 「`tauri.conf.json` CSP 为 null」——实际已配置完整最小 CSP（`tauri.conf.json:25`，第一轮 P2-2 修复已生效）。
2. 「`open_external` 返回 `Result<(), String>`」——实际已返回 `Result<(), AppErrorDto>`（`commands/app.rs:13`，第一轮 P3-3 修复已生效）。

## 4. 测试覆盖

测试模式合规性（抽查通过）：前端 39 个测试文件使用 `vi.mock('@/api')` 隔离 IPC（`vi.hoisted` 标准模式）；Rust `MockGitBackend`（`repositories/git_backend.rs:53`）被 history/maintenance/repo/sync 四个 Service 注入；`tests/auth_store.rs:6-22` 显式断言 token 字节不明文落盘；6 个性能基线用例带 `#[ignore]` 理由。

### P2-5 测试缺口清单（按业务重要性排序）

| 缺口 | 位置 | 说明 |
|---|---|---|
| queries 层 90% 无测试 | `src/queries/`（10 个文件仅 `sync.queries.test.tsx`） | mutation 缓存失效编排是业务规则（如 wiki 索引失效），属应测范畴；`sync.queries.test.tsx` 已提供现成模式 |
| 核心 store 半数无测试 | `session.store.ts:25-33`（`switchRepo`/`workspaceEpoch` 多仓库切换关键不变量）、`toast.store.ts:27-35`（容量截断+计时）、`command-palette.store.ts`、`workspace-activity.store.ts`、`aiModel.store.ts` | 纯 store 最易测，优先补 session/toast |
| wiki 预览标签插件无测试 | `features/wiki/utils/markdownTags.ts`（`TAG_PATTERN` 正则 + AST 变换） | 行内 `#标签` 边界（中文标点、code 排除）是典型易回归纯函数 |
| softRender 部分模块无直接测试 | `widgets/block.ts`、`widgets/inline.ts`、`utils/highlight.ts`（lowlight 异步加载失败静默）、`utils/mermaidRender.ts` | plan 层纯函数已间接覆盖；优先补 `highlight.ts` 懒加载/回退 |
| Rust auth 链路服务层无单测 | `services/auth_service.rs`（AUTH_2001/2002 映射）、`services/github_api.rs`（`map_http` 状态码→错误域） | 现有 `tests/auth_store.rs` 只覆盖加密落盘/删除 |
| 桌面更新 hook 无测试 | `useUpdate.ts`（105 行）无测试，移动端 counterpart `useMobileUpdate.test.ts` 存在，双端保护不对称 | 补测或说明取舍 |

### P3-8 调试探针测试残留

- 位置：`src/ls_check.test.ts:1-14` —— 全文只有 `console.log` 探针（localStorage 环境探测），无任何断言。已人工复核确认。建议删除。

E2E 覆盖偏科（建议性）：现有 38 用例集中在导航布局/手动提交/Git graph/隐私指标/崩溃恢复/移动更新；AI 写作、富文本编辑器、wiki 双链、回收站、导出 PDF、设置页均无 e2e；最核心的「输入→防抖→落盘→提交」链路无端到端用例。

## 5. 性能与代码异味

### P2-3 分栏/预览模式每次击键全量重渲染

- 链路：`useNoteEditor.ts:58-62`（每击键 `setDraft`）→ `MarkdownEditorSurface.tsx:87` → `MarkdownPreview.tsx:152,179-186`（`useMemo(parseMarkdownDocument)` + ReactMarkdown 全量重解析 remarkGfm + remarkMath + rehypeHighlight + rehypeKatex，`transformWikiLinks` 每次渲染全字符串正则替换）。
- 影响：分栏模式下大文档（几十 KB+）每击键 = 全量 remark 解析 + 高亮 + KaTeX 遍历，主线程负担随文档线性增长。
- 建议：预览内容做 200–300ms 防抖（与 3s 落盘防抖解耦）。

### P2-4 KaTeX 重复打包（已人工复核确认）

- 证据：`dist/assets/` 中存在 3 个 katex JS chunk——`katex-DhON-x74.js`（258KB，经 `MarkdownPreview.tsx:9` 的 `rehype-katex` 静态引入）、`katex-CiJ_n4H9.js`（259KB，经 `softRender/utils/math.ts:43` 动态 `import("katex")`）、`katex.min-*.js`。两个完整实现 hash 不同，同时使用编辑器公式与预览的用户加载/解析两份。
- 建议：`manualChunks` 把 katex 固定到单一共享 chunk；或预览侧复用 `math.ts` 的懒加载句柄（ARCHITECTURE §5 宣称的懒加载目前只覆盖了编辑器侧）。

### P3-4 Git 文件历史全量读取 blob 比较（已人工复核确认）

- 位置：`src-tauri/src/repositories/git2_history.rs:88,91-98` —— `commit_changed_file` 把目标文件在两个树中的完整内容读入 `Vec<u8>` 再比较。1000 提交 × 100KB 笔记 ≈ 200MB 无谓 IO/分配。
- 建议：`tree.get_path(...).map(|e| e.id())` 直接比较 ObjectId，零内容读取，语义等价。

### P3-5 软渲染光标移动全量重规划

- 位置：`softRender/plugin.ts:38-41`（`tr.selection` 变化即全量 `computeDecorations`）、`:53-58`（`state.doc.toString()` 全文档拷贝）、`utils/plan.ts:51-61`（全树 walk + 两次全文 `matchAll`）
- 说明：`ranges.ts` 的二分索引解决了区间查询 O(n²)，但未解决「每次全量重规划」本身；大文档下按住方向键每键 ~O(n) 分配。项目已有 `perf.test.ts` 基线（5000 行解析 16ms），属知情的技术债。
- 建议：selection-only 变化只重算光标命中的保护区相关 decoration，或按视口/块分区缓存 plan。

### P3-3 WikiPanel 超限 + O(n²) 反链（已人工复核确认）

- 位置：`src/features/wiki/components/WikiPanel.tsx`（221 行，超组件 220 上限）；`:42` `findBacklinks(notes, path)` 无 `useMemo`；`wiki.ts:68-73` 每个 note 的每个 link 调 `resolveWikiTarget`（`:57-65` 两次线性 `find`）。
- 影响：面板打开时编辑区击键（`draft` prop 变化）触发整个面板重渲染并重算 O(n²) 反链；大仓库（数千笔记）每击键数万次字符串比较。
- 建议：`notes` 变化时预建 `Map<lowercaseName, path>` 索引（O(n)）；面板内 `useMemo([notes, path])`；组件按三段式拆分。

### 其他低严重度性能/异味观察

- 列表无虚拟化无 memo：`NoteList.tsx:90-99`、`GitGraphPanel.tsx:97-113`、`TreeNodes.tsx:24-45`（当前数据量级可接受，大列表建议虚拟滚动或 `React.memo`）。
- `search_service.rs:37,62` Markdown 分支 `content.clone()` + `to_lowercase()` 两次全文拷贝，建议改 `Cow<str>`。
- `note_service.rs:116` `list_notes` 为提取标题读取每篇笔记全文，建议只读 frontmatter 区前几 KB。
- P3-9 路由无代码分割：`app/router.tsx:2-3` 静态导入两页面，主 chunk 1.37MB（react-markdown 经 `NoteEditorSupport.tsx` → `AskAiPanel.tsx:4` 静态进主包）；建议路由级 `React.lazy`。
- 重复代码：`trash_files.rs:153-166 walk_notes` 与 `file_storage.rs:22-35 walk` 几乎逐行相同；`NoteList.tsx:149-153` 与 `RecentPanel.tsx:134` 日期格式化重复。

## 6. 做得好的地方（建议延续）

1. **测试金字塔真实落地**：707 前端 + 243 Rust + 38 E2E 实测全绿；性能敏感纯函数有专测与 perf 基线；凭证安全有反向断言集成测试。
2. **同步重试边界严谨**：只对幂等的 pull 退避重试、push 永不自动重试，并有单测守住（`sync_stops_before_push_when_pull_keeps_failing`）。
3. **自动保存失效策略有性能意识**：`note.queries.ts:82-88` 对全仓扫描型查询用 `refetchType: "none"` 只标记过期，附解释性注释。
4. **日志脱敏「默认开启、统一收口、带测试」**，前端上报日志也经同一层（`config/logging.rs:61-84`）。
5. **懒加载覆盖良好**：设置页/历史面板/PDF 导出/富文本/冲突弹窗/Git Graph 均 `React.lazy`；mermaid/katex（编辑器侧）动态 import。
6. **Android 信任链处理细致**：`ca_bundle.rs` 原子写入 + `OnceLock` 幂等 + 兜底根证书 + 单测。
7. **零 TODO/FIXME 遗留**，技术债均以测试基线或注释显式管理。

## 7. 建议修复顺序

1. **P1-1**：桌面端凭证存储与文档红线对齐（钥匙串接入或文档修订），这是唯一涉及安全红线一致性的项。
2. **P2-1 / P2-2**：导出链路 XSS 过滤与同步互斥，均为用户可感知或安全相关缺陷，改动面小。
3. **P2-5**：补测试缺口（queries 失效矩阵、session.store、markdownTags），随下一个 feature PR 捎带。
4. **P2-3 / P2-4 / P3-4 / P3-5**：编辑器与 Git 历史性能项，建议配合 `docs/PERF_BASELINE.md` 先补大文档/大仓库基线数据再动手。
5. **P3-1 / P3-2 / P3-6 / P3-7 / P3-8**：规范对齐与清理项，低成本可同日完成。

## 8. 跨端影响声明

本次交付为**纯文档新增**（`docs/CODE_REVIEW_2026-09-10_R2.md`），不含代码改动。

- **Desktop Impact**：无。
- **Mobile Impact**：无。
- 文中 P1-1（desktop）、P2-1/P2-2/P2-3（shared）等建议修复落地时，按 `CODING_STANDARDS.md` §5.2 执行双端验证门禁，并在 PR 说明中写清 `Desktop Impact` / `Mobile Impact`。

## 9. 修复记录（2026-09-10 落地）

除明确缓修的 P3-5 外，其余 14 项已全部修复。验证门禁：`pnpm build` ✅（主 chunk 1,376 kB → 314 kB）；`pnpm lint` ✅ 0 问题（含新增 3 条边界规则与组件 220 行规则）；`pnpm test` ✅ 141 文件 778 通过 / 1 跳过；`pnpm test:e2e` ✅ 38 通过（含移动窄屏壳用例）；`cargo test` ✅ 253 + 2 集成通过 / 6 ignored；`cargo clippy --all-targets` ✅ 0 warning。

| ID | 修复内容 | 关键改动 |
|---|---|---|
| P1-1 | **决策：维持文件存储**，文档与实现对齐。AGENTS.md 安全红线、ARCHITECTURE §1/§5、PRD、TROUBLESHOOTING、INCIDENT_RECOVERY 改为如实描述（桌面 AES-256-GCM 加密落盘 + 0600 / 移动端系统钥匙串）并补威胁模型（本地攻击者可读配置目录即可解密，缓解依赖 OS 目录权限） | `AGENTS.md`、`docs/ARCHITECTURE.md`、`docs/PRD.md`、`docs/TROUBLESHOOTING.md`、`docs/INCIDENT_RECOVERY.md` |
| P2-1 | `richTextJsonToHtml` 产出统一过新增纯函数 `sanitizeRichTextHtml`：URL 归一化判定协议（覆盖大小写/实体编码/控制字符混淆），href 白名单 http/https/mailto、src 白名单含 `asset:`，其余剥离属性；未新增依赖 | `features/export/utils/richTextHtml.ts` +6 测试 |
| P2-2 | `SyncRetryState` 改为以仓库路径为键的锁表：`acquire` 重入返回新错误 `SyncBusy`（SYNC_4005，「同步进行中」），`release` 用 `Arc::ptr_eq` 只清自己的 flag；`cancel_sync_retry` 语义改为取消全部进行中任务（IPC 签名不变）；修复 join 失败跳过清理的隐患 | `commands/git/sync.rs`、`domain/error.rs` +4 测试 |
| P2-3 | 预览内容加 250ms 时间防抖（新共享 hook `useDebouncedValue`，与 3s 落盘防抖解耦），split/preview 两模式一处生效 | `src/hooks/useDebouncedValue.ts`、`MarkdownEditorSurface.tsx` +4 测试 |
| P2-4 | `vite.config.ts` `manualChunks`（函数形式）把 `node_modules/katex/` 固定为单一 chunk：dist 中 katex 实现从 2 份（259+258 kB）收敛为 1 份 | `vite.config.ts` |
| P2-5 | 新增 40 个测试用例：note/wiki/trash queries 失效矩阵（含 `refetchType:"none"` 精确断言）、session.store（switchRepo/workspaceEpoch 不变量）、toast.store（容量截断/计时）、markdownTags（中文标点/code 排除等边界） | 6 个新测试文件 |
| P3-1 | 壳选择上移组装层：新增 `app/ShellSwitcher.tsx` + `app/MobileWorkspaceContent.tsx`，`WorkspaceLayout` 回归纯桌面壳；+2 测试 | `src/app/`、`pages/workspace/` |
| P3-2 | ESLint 补齐机器强制：`components/` 禁 `@/features/**`、双壳互禁、`**/components/**/*.tsx` max-lines 220 | `eslint.config.js` |
| P3-3 | WikiPanel 三段式拆分（221→194 行）：新增 `useWikiPanel` hook 与 `WikiNameIndex` 索引（`buildWikiNameIndex` O(n) 预建，索引版 resolve/findBacklinks/backlinkContexts 与原线性版逐输入等价有测试锁定）；反链计算 `useMemo([notes, nameIndex, path])`，击键不再触发重算 | `features/wiki/` +5 测试 |
| P3-4 | `commit_changed_file` 改为比较 tree entry ObjectId，删除 blob 全量读取 | `repositories/git2_history.rs` |
| P3-5 | **缓修**：软渲染 selection-only 全量重规划需先补大文档基线数据再定方案（见 §7 第 4 条），随 M2 编辑手感一并处理 | — |
| P3-6 | 冲突导出编排下沉 `conflict_export_service::export`，Command 只留对话框交互与错误映射 | `services/conflict_export_service.rs`、`commands/git/conflicts_export.rs` +2 测试 |
| P3-7 | Repository 边界 IO 错误附路径上下文（`AppError::io_context`）；`to_git`/`to_sync` 的 git2 消息过 `redact` 脱敏 | `domain/error.rs`、`note_files.rs`、`trash_files.rs`、`diagnostics_files.rs`、`git2_backend.rs`、`git2_error.rs` +4 测试 |
| P3-8 | 删除 `src/ls_check.test.ts` 探针 | — |
| P3-9 | 路由级 `React.lazy` + Suspense（Setup/Workspace 独立 chunk），AskAiPanel 首次打开懒加载 | `app/router.tsx`、`NoteEditorSupport.tsx` |

顺手修复（评审低严重度观察项）：`AppError::Git` retriable 改 false；`note_service` 列表读取失败记 `log::warn!`；`bind_repo` 剥离 URL userinfo 防凭证落盘（`strip_userinfo` 纯函数 +2 测试）；`error.rs` 注释引用漂移修正。

补测试过程中发现的源码缺口一并修复：`useDeleteNoteMutation`/`useMoveNoteMutation`/`useConvertNoteMutation`/`useImportNoteMutation` 的 `onSuccess` 补 `["wiki"]` 索引失效（被删/移动笔记的反链与标签此前会残留在 wiki 索引中直到下次挂载），ARCHITECTURE §5 相关描述同步更新，失效矩阵已被测试锁定。

**跨端影响声明**：本轮改动影响面为 `shared`（含 Rust Command 行为变更：`sync_now` 重入新增 SYNC_4005；`cancel_sync_retry` 语义变为取消全部进行中任务，前端无需改动）。

- Desktop Impact：E2E（chromium 桌面视口）38 用例全绿；真实桌面壳冒烟（预览防抖、PDF 导出、同步重入提示）建议下次 `pnpm desktop:run` 过一遍。
- Mobile Impact：E2E 窄屏用例（含移动单栏壳）全绿；ShellSwitcher 移动分支有单测；Android 真机构建验证未执行。
