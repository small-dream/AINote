# AINote 代码审查报告（全仓）

> 审查日期：2026-09-10 · 审查基线：`main @ f62e266`（v0.26.0，工作区干净）
> 审查范围：`src/`（449 个 TS/TSX 文件，28,678 行）+ `src-tauri/src/`（151 个 Rust 文件，12,409 行）+ `e2e/` + `docs/`
> 审查方法：自动化门禁 → 人工精读关键链路 → 三方交叉验证（文档 ↔ 实现 ↔ 测试）
> 结论：**整体工程质量高，架构约束真实落地，可继续迭代**。发现 **1 项 P1、4 项 P2、7 项 P3**，无 P0（无阻断级缺陷）。

## 0. 结论速览

| ID | 严重度 | 问题 | 影响面 | 建议动作 |
|---|---|---|---|---|
| P1-1 | P1 | 离开编辑上下文时未统一 flush 草稿（关闭窗口 / 切换仓库） | desktop + mobile | 关闭确认与切仓前先 `flush()`，并把「草稿未落盘」纳入拦截条件 |
| P2-1 | P2 | AI 流式生成的「取消」无效，请求继续跑并回填结果 | shared | 引入请求序号/取消标志，取消后丢弃后续增量 |
| P2-2 | P2 | Tauri 未配置 CSP（`csp: null`） | desktop + mobile | 设定最小 CSP，回归富文本/PDF/Mermaid |
| P2-3 | P2 | 预览视图外链未走 `openExternal`，与编辑区行为不一致 | shared | 统一经 `open_external` 打开，补充双端实测 |
| P2-4 | P2 | `docs/ARCHITECTURE.md` 提交策略段落与 PRD / 实现冲突 | docs | 按 PRD 重写该段（自动提交已移除） |
| P3-1 | P3 | `RepoManager` 两个对话框 key 同时为 `"none"`（React 重复 key） | desktop | key 加前缀区分 |
| P3-2 | P3 | `git_pull` 单独调用时 fast-forward 会强制覆盖未提交改动 | desktop + mobile | pull 前校验工作区是否干净，或去掉 `force` |
| P3-3 | P3 | `open_external` 返回 `Result<(), String>`，违反错误铁律 | shared | 改为 `AppErrorDto` |
| P3-4 | P3 | 自动保存「防抖」语义与文档/测试描述不一致 | shared | 明确预期并在测试中固化 |
| P3-5 | P3 | 自动保存触发全量 query 失效 | shared | 收敛失效范围 |
| P3-6 | P3 | Clippy 5 条告警未清零 | Rust | 逐条修复或显式 allow |
| P3-7 | P3 | 个别文件贴近/超出规范行数口径，文档口径需明确 | docs | 统一「行数」定义并复核 |

## 1. 审查方法与门禁结果

### 1.1 自动化门禁（全部实测，非引用文档）

| 门禁 | 命令 | 结果 |
|---|---|---|
| 静态检查 | `pnpm lint` | ✅ 通过（0 error / 0 warning） |
| 类型 + 构建 | `pnpm build` | ✅ 通过（`tsc --noEmit` + vite build） |
| 前端单测 | `pnpm test` | ✅ 132 文件通过 / 1 跳过；706 用例通过 / 1 跳过 |
| 端到端 | `pnpm test:e2e` | ✅ 38 用例通过（16.9s，chromium） |
| Rust 单测 | `cargo test` | ✅ 235 通过 / 6 ignored（manual baseline）；集成 2 通过 |
| Rust 静态检查 | `cargo clippy --all-targets` | ⚠️ 5 条 warning，0 error |

### 1.2 人工精读覆盖

已逐行精读：分层边界（`lib.rs` / `commands/**` / `src/api/**`）、同步链路
（`services/sync_service.rs`、`services/retry.rs`、`repositories/git2_remote.rs`、
`repositories/git2_backend.rs`）、文件与路径安全（`note_files.rs`、`trash_files.rs`、
`backup_files.rs`、`restore_files.rs`、`asset_files.rs`）、凭证与隐私
（`auth_store.rs`、`secure_store.rs`、`ai_store.rs`、`config/logging.rs`、
`services/metrics_service.rs`、`diagnostics_service.rs`）、编辑器保存链路
（`useNoteEditor.ts`、`useNoteSaveQueue.ts`、`useNoteReload.ts`、`useCloseGuard.ts`）、
AI 链路（`useAiWrite.ts`、`useAskAi.ts`、`useAiSuggest.ts`、`repositories/llm.rs`）、
渲染与安全（`MarkdownPreview.tsx`、`mermaidRender.ts`、`softRender/*`）、
状态与查询（`ui.store.ts`、`session.store.ts`、`queries/**`）、平台层（`src/platform/**`）。

交叉核对：`package.json` / `tauri.conf.json` / `Cargo.toml` 版本一致（0.26.0）；
74 个注册项与 74 个唯一命令定义一一对应（`print_current_page` 另有一个桌面/非桌面的 `cfg` 分支），
无漏注册、无冗余注册；前端 `src/api/**` 调用的命令全部存在于后端。

## 2. 总体评价

| 维度 | 评价 | 关键依据 |
|---|---|---|
| 分层与依赖方向 | 优 | 组件无法直接 `invoke`（ESLint `no-restricted-imports` 强制）；Service 只依赖 `GitBackend` trait；`components/` 未 import `features/` |
| 错误处理 | 优 | 全量 Command 返回 `AppErrorDto`（仅 1 处例外，见 P3-3）；`git2` 错误在 Repository 边界转换；前端 `api/client.ts` 统一反序列化、Query 层全局兜底 |
| 安全 | 良 | 路径穿越防御完整且有单测；备份解压防 zip-slip / 符号链接 / 压缩炸弹；凭证桌面 AES-256-GCM + `0600`、移动走 keyring，前端只拿 `hasKey`；日志统一脱敏并有测试。扣分项：CSP 未配置（P2-2） |
| 测试义务 | 优 | 706 前端 + 237 Rust + 38 E2E；含故障恢复演练（`recovery_drill.rs`）与性能基线（`perf_baseline.rs`）；Mock 注入（`MockGitBackend` / `vi.mock('@/api')`）到位 |
| 文档同步 | 中 | PRD/CODING_STANDARDS 与实现一致；`ARCHITECTURE.md` 存在 1 处过期段落（P2-4）；自动保存语义描述与实现有偏差（P3-4） |
| 跨端保护 | 优 | 桌面壳/移动壳目录隔离，平台判定收敛在 `src/platform/`；共享 Hook 与 Query 无平台分支；E2E 覆盖窄屏路径 |

值得保留的实践（建议后续 PR 继续沿用）：

1. `domain/` 纯逻辑与测试同文件，纯函数可测性极高（如 `domain/commit.rs`、`repositories/retry.rs`）。
2. 失败定位模型（`SyncFailure` → `stage` / `files` / `hint`）把「哪一步失败、哪个文件、该怎么办」显式结构化，前后端共用一套语义。
3. 重试边界明确：只有幂等的 `pull` 进入退避重试，`push` 永不自动重试，并有测试守住。
4. 隐私承诺有实现的对应物：事件白名单、`metrics_enabled` 开关、导出内容白名单、日志脱敏规则均可在代码中逐条对应。

## 3. 发现的问题

### P1-1 离开编辑上下文时未统一 flush 草稿，存在静默丢稿窗口

**现象**：编辑器草稿保存在 React 内存中，3 秒防抖后才写盘。关闭窗口与切换仓库两条路径都不会先 flush，而窗口关闭的拦截条件只判断 Git 是否干净。

**证据**：

- `src/features/note/hooks/useNoteEditor.ts:9`：`AUTOSAVE_DEBOUNCE_MS = 3_000`。
- `src/features/note/hooks/useNoteEditor.ts:44-56`：仅在 `visibilitychange` / `pagehide` 中「尽力」flush，`void flush()` 不等待完成。
- `src/features/close-guard/hooks/useCloseGuard.ts:29-31`：`confirm` 直接 `confirmClose()`，没有任何 flush。
- `src-tauri/src/lib.rs:44-56`：拦截条件 = `has_uncommitted(path)`；`src-tauri/src/commands/close_guard.rs:27-28`：`should_intercept = !allow_close && has_uncommitted`。
- `src/features/settings/hooks/useRepoManager.ts:47,56,63` 与 `useRepoRestore.ts:16`：`switchRepo(path)` 直接切换，工作区按 `workspaceEpoch` 整页重挂载（`src/app/router.tsx`），编辑器卸载、内存草稿丢失。

**影响**：最近一次防抖窗口内（≤3 秒）的输入可能丢失且无提示。更糟的两种情形：① 工作区此前已被提交/同步（Git 干净），关闭窗口**完全不弹确认框**，用户以为一切已保存；② 上一次自动保存失败（`dirty` 仍为 true）时，整段未落盘内容会随编辑器卸载丢失。对照 —— 切换笔记这条路径是正确实现（`src/pages/workspace/index.tsx:23` 先 `await editorRef.current?.flush()`），说明这是覆盖不全，而非设计取舍。

**建议**：

1. `useCloseGuard` 的关闭确认流程改为「先 `flush()`，成功后再 `confirmClose()`」，失败则提示并留在应用内。
2. 切换仓库 / 恢复备份前同样先 flush（可复用 `editorRef`）。
3. 视需要在 `useNoteSaveQueue` 暴露 `hasPendingDraft`，让 Rust 的拦截条件从「Git 有未提交」升级为「Git 有未提交 **或** 前端有未落盘草稿」。

**验证方式**：桌面端输入后立刻 `Cmd+W`（分别在不提交、已提交两种状态下），确认是否弹确认框、重开后内容是否完整；移动端验证切仓路径。建议补一条 E2E：输入 → 未满 3s → 触发关闭请求 → 断言 `update_note` 已被调用。

### P2-1 AI 流式生成的「取消」无效，且请求无法中止

**现象**：流式生成过程中点击「取消」只会把预览置空，对话框不会关闭（因为 `loading` 仍为 true），后续增量会重新把内容填回，最终仍显示完整结果。

**证据**：

- `src/features/ai/hooks/useAiWrite.ts:45`：`(delta) => setPreview((prev) => (prev ?? "") + delta)`；`:62`/`:64`：`cancel` 只执行 `setPreview(null)`。
- `src/features/ai/components/AiWriteControls.tsx:25`：`open={ai.preview !== null || ai.loading}`（取消后仍为 true）；`:33`：`onCancel={ai.cancel}`，而 `AiPreviewDialog` 的取消按钮在 loading 期间可点（仅确认按钮 `disabled={loading}`）。
- `src/features/ai/hooks/useAiSuggest.ts:32,35,41`：同类问题，`close()` 之后 `.then((full) => setText(full))` 仍会回填文本。
- Rust 侧无取消通道：`src-tauri/src/commands/ai/generate_stream.rs` 通过 `blocking::run` 阻塞至读完 SSE，无取消标志。

**影响**：用户以为取消了生成，实际请求继续消耗 token 与带宽，结果还会自己长回来；如果用户此时点确认，会把「已取消」的内容写入笔记。

**建议**：在 `useAiWrite`/`useAiSuggest` 引入 `requestIdRef`（或 `cancelledRef`），取消后忽略后续 delta 与最终 `full`；如需真正中止网络请求，给命令加取消标志（`AtomicBool` + Channel 轮询）并在 UI 上区分「停止生成」。至少在修复前把按钮语义改为「关闭预览」，避免误导。

**验证方式**：单元测试 —— mock 一个可控的流式 Promise，`cancel()` 后再发 delta，断言 `preview` 保持为 null。

### P2-2 Tauri 未配置 CSP

**现象**：`src-tauri/tauri.conf.json:25` 为 `"csp": null`，即不注入任何内容安全策略。

**证据**：`tauri.conf.json:23-26`；应用内存在的 HTML 注入面包括 `src/features/export/components/PdfExportOverlay.tsx:70`（`dangerouslySetInnerHTML` 注入 TipTap 序列化 HTML）、`src/features/note/components/MermaidBlock.tsx:21` 与 `src/features/note/softRender/utils/mermaidRender.ts:20`（把 Mermaid SVG 写入 `innerHTML`）。

**影响**：当前 Markdown 渲染不解析原始 HTML（react-markdown 未启用 `rehype-raw`），Mermaid 也是 `securityLevel: "strict"`，因此**当前不可利用**；但缺少 CSP 意味着一旦未来引入新渲染管线或依赖出现净化绕过，注入点可直接执行脚本，而 WebView 与 IPC 同源，风险会放大到「可调用任意 Command」。这与项目「安全红线」的定位不匹配。

**建议**：设定最小 CSP，例如 `default-src 'self'; img-src 'self' asset: data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ipc: http://ipc.localhost`，并按需放开 Mermaid/KaTeX/高亮所需的资源；随后回归：预览、软渲染、Mermaid、KaTeX、PDF 导出、图片（`asset:`/data-uri）。

**验证方式**：配置后跑 `pnpm build && pnpm test && pnpm test:e2e`，再在桌面壳手动过一遍上述渲染面（CSP 违规会在 DevTools 控制台报错）。

### P2-3 预览视图的外链未走 `openExternal`，与编辑区行为不一致

**现象**：编辑区（软渲染）点击外链走 `open_external` 命令，预览视图渲染的却是一个 `target="_blank"` 的原生链接。

**证据**：

- `src/features/note/softRender/plugin.ts:217`：`openExternal(href)`；`src-tauri/src/commands/app.rs`：仅放行 `http/https`。
- `src/features/note/components/MarkdownPreview.tsx:173`：`<a href={href} target="_blank" rel="noreferrer" {...props}>`。
- `src/features/update/components/UpdateReleaseNotes.tsx:10`：同样的 `target="_blank"` 写法。
- Tauri 默认不注册新窗口处理器（`tauri-2.11.5/src/webview/mod.rs` 中 `n: None`），wry 的 UIDelegate 在未设置 handler 时返回 `nil`（`wry-0.55.1/src/wkwebview/class/wry_web_view_ui_delegate.rs:266`），即 macOS 上 `target="_blank"` 请求会被丢弃。

**影响**：macOS 桌面壳中，预览模式点击外链大概率「没反应」（移动端 WebView 行为又可能不同），跨端体验不一致；同时也绕过了 `open_external` 的协议白名单。

**建议**：预览与更新说明中的外链统一改为「拦截点击 → `openExternal(href)`」，与编辑区保持同一入口；改动后按跨端门禁各验证一次（`Desktop Impact` / `Mobile Impact` 均需实测）。

**验证方式**：桌面端在预览模式点击 `https://` 外链（应打开系统浏览器）、点击非 http(s) 协议（应被拒绝且不崩溃）；移动端各验一次。

### P2-4 架构文档的提交策略段落与 PRD / 实现冲突

**现象**：`docs/ARCHITECTURE.md:178`「批量提交与推送」仍描述已被移除的自动提交策略。

**证据**：

- 过期描述：`useSync` 观察未提交变更后启动「默认 15 分钟空闲计时器」→ `note: auto commit`；「新建笔记保留即时 `note: create <path>` 提交」；手动保存生成 `note: checkpoint`。
- 现行规则：`docs/PRD.md:112`「不再有任何自动 commit——移除空闲 15 分钟自动提交与新建/导入/转换的即时提交」，subject 为 `chore: <YYYY-MM-DD HH:mm> · 更新 N 个文件`；`docs/CODING_STANDARDS.md` §6 同口径。
- 实现：`src-tauri/src/domain/commit.rs`（`build_commit_message`）与 `src/features/commit/utils/message.ts` 均生成 `chore: … · 更新 N 个文件`；代码中已无 15 分钟计时器与 `note: auto commit`（仅 `src/stores/workspace-activity.store.ts:8` 残留一句过期注释）。

**影响**：架构文档是「首要事实来源」之一，此处会误导后续开发者按已废弃策略实现或评审。

**建议**：按 PRD 重写该段（手动提交为主 + 同步前兜底提交 + `note: resolve conflict`），并顺手清理 `workspace-activity.store.ts:8` 的过期注释。此项属于「文档同步义务」，建议与代码修复同 PR。

### P3-1 `RepoManager` 中两个对话框 key 同时为 `"none"`

**现象**：E2E 运行期间控制台反复出现 `Encountered two children with the same key, none`。

**证据**：`src/features/settings/components/RepoManager.tsx:77-78` —— `<RenameRepoDialog key={props.renaming?.id ?? "none"}>` 与 `<RemoveRepoDialog key={props.removing?.id ?? "none"}>` 是同级兄弟节点，空闲时两个 key 都是 `"none"`。对照 `src/pages/workspace/WorkspaceLayout.tsx:100-101` 使用了 `move:` / `rename:` 前缀，是正确写法。

**影响**：当前两端都渲染为空，实际表现无异常；但违反 React 的 key 唯一性约定，官方明确「行为不受支持」，且污染 E2E 控制台（会掩盖真实告警）。

**建议**：改为 `` key={`rename:${props.renaming?.id ?? "none"}`} `` 与 `` key={`remove:${props.removing?.id ?? "none"}`} ``。

### P3-2 `git_pull` 单独调用时 fast-forward 会强制覆盖未提交改动

**现象**：`fast_forward` 使用 `CheckoutBuilder::force()`，会把工作区改动直接覆盖为远端版本。

**证据**：`src-tauri/src/repositories/git2_remote.rs:95`；命令层 `src-tauri/src/commands/git/pull.rs:11-16` 直接暴露给前端，`src/api/sync.api.ts:21` 已导出 `pull`。

**影响**：当前无调用点（UI 只走 `sync_now`，而它先 `commit` 再 `pull`，工作区必然干净），因此**暂无实际数据丢失**；但该 IPC 对前端完全开放，属于潜伏的数据丢失入口，后续谁接入「下拉即拉取」就会踩中。

**建议**：pull 前校验 `has_uncommitted` 并拒绝（返回可操作错误），或在 fast-forward 时改用非强制 checkout、遇到本地修改即报冲突；同时决定 `pull`/`push` 这两个无 UI 入口的命令是接入还是标注为契约保留（`GitBackend::fetch` 已有 `#[allow(dead_code)]` 注释的先例）。

### P3-3 `open_external` 违反「Command 一律返回 `AppErrorDto`」

**证据**：`src-tauri/src/commands/app.rs:6`：`pub fn open_external(url: String) -> Result<(), String>`，是本仓库唯一返回 `String` 错误的 Command（其余 73 个均为 `AppErrorDto`）。

**影响**：字符串错误到前端后无法被 `isAppError` 识别，`src/api/client.ts` 会兜底包装为 `UNKNOWN_9001 / kind: unknown`，用户看到笼统的「未知错误」，诊断包的错误码统计也会被污染。

**建议**：改为 `Result<(), AppErrorDto>`，协议不合法时返回带明确 `code` 的领域错误（如 `IO_5xxx` 或新增 `IO_` 子码）。

### P3-4 自动保存的「防抖」语义与文档、测试描述不一致

**现象**：连续输入时计时器不会重置 —— 保存发生在「首次变更后 3 秒」，而非「停止输入 3 秒后」。

**证据**：`src/features/note/hooks/useNoteSaveQueue.ts:41-44` 的 effect 依赖为 `[debounceMs, dirty, isLoaded, notePath, saveDraft]`；`saveDraft` 经 `useCallback` 稳定，连续输入时 `dirty` 保持 `true` 不变，因此 effect 不重跑、计时器不重置。文档与测试却按「停止输入」描述（`docs/PRD.md:112`、`docs/ARCHITECTURE.md:195`、`e2e/core-flows.spec.ts:73`）；单测 `useNoteSaveQueue.test.tsx` 传入的是静态 `draft`，覆盖不到连续输入场景。

**影响**：行为上更偏向「持续输入时每 ~3 秒落盘一次」，对数据安全其实更有利，但可观测语义与文档不符（例如用户期望「还在打字就不写盘」）。风险主要在于后续维护者按错误心智模型改代码。

**建议**：二选一并固化 —— ① 保持现状，把文档/测试措辞改为「变更后 3 秒落盘（最长 3 秒延迟）」；② 若要真正的停止输入语义，把 effect 依赖改为 `draft`（配 `useRef` 去重）并补一条「连续输入不提前保存」的单测。

### P3-5 每次自动保存都触发全量 query 失效

**证据**：`src/queries/note.queries.ts:82-88`（`useUpdateNoteMutation.onSuccess`）每次保存都失效 `["notes"]`、`["wiki"]`、`["sync"]`。

**影响**：`["sync"]` 始终有活跃订阅（导航轨），因此每次自动保存都会多打一次 `sync_status`（真实 git status）；若用户当时停在「最近 / 标签 / 笔记列表」页签，`["notes"]`/`["wiki"]` 也会被立即重取 —— 二者在后端都是**全仓扫描**（`list_notes` 会读取并解析每个文件；`wiki_index` 同理）。在 1000 篇笔记的仓库上，这会形成持续的 IO 抖动。

**建议**：内容已由 `setQueryData` 精确更新，列表类只需要「标记为过期」而非立即重取（用 `invalidateQueries({ refetchType: 'none' })` 或调大 `staleTime`），或对自动保存路径做节流；`["sync"]` 可依赖已有的 15 秒 `refetchInterval` 而非每次保存触发。

### P3-6 Clippy 5 条告警未清零

证据（`cargo clippy --all-targets`）：

| 位置 | 告警 |
|---|---|
| `src/domain/rich_text.rs:4` | `empty line after doc comment` |
| `src/domain/ai.rs:12` | `derivable_impls`（`Default for AiProvider` 可直接 derive） |
| `src/repositories/trash_files.rs:35` | `unnecessary_sort_by`（建议 `sort_by_key` + `Reverse`） |
| `src/repositories/git2_graph_tests.rs:56` | `needless_lifetimes`（测试代码） |
| `src/repositories/git2_maintenance.rs:227` | `permissions_set_readonly_false`（测试辅助函数 `corrupt_first_object`，Unix 上语义为 world-writable） |

**影响**：均为 style 级，无功能风险（`CODING_STANDARDS` 声明「能机器强制的规则一律进 Clippy」，因此不宜长期挂红）。

**建议**：前 3 条直接修复；测试中的 2 条可修复或用带理由的 `#[allow(...)]` 定点豁免。

### P3-7 行数口径与文档阈值不一致

**证据**：

- `src-tauri/src/commands/metrics.rs` 共 84 行，超出 `CODING_STANDARDS.md` §0「`commands/` 单文件预期 < 80 行」。
- Rust 侧非测试代码最长：`domain/metrics.rs` 295 行、`domain/ai_settings.rs` 268 行（Rust 全仓非测试代码均在 300 行以内，合规但接近上限）。
- 前端 `src/e2e/backend.ts` 308 行、`src/api/types.ts` 305 行，原始行数超 300，但 ESLint `max-lines` 因配置了 `skipBlankLines`/`skipComments` 而通过。

**影响**：无功能影响，但「≤300 行」在不同文档/工具下的口径不同，容易在评审中产生无谓争议。

**建议**：在 `CODING_STANDARDS.md` §0 明确「行数按非空非注释行计（ESLint 口径）」，并把 Rust 阈值写成同样口径的脚本化检查（或至少在评审清单中列出当前 Top 5）。

## 4. 规范符合性核对

| 规范条目 | 结论 | 证据 |
|---|---|---|
| 前端禁止直接 `invoke()`，唯一边界 `src/api/` | ✅ 合规 | `rg 'invoke\(' src --glob '!src/api/**'` 无命中；ESLint `no-restricted-imports` 已配置 |
| `components/` 不得 import `features/` | ✅ 合规 | `src/components/` 下无 `@/features` 引用 |
| Service 只依赖 `GitBackend` trait | ✅ 合规 | `services/sync_service.rs`、`repo_service.rs` 等均泛型化；`git2` 类型仅出现在 `repositories/` |
| 单文件/函数/复杂度硬指标 | ✅ 合规 | ESLint `max-lines` / `max-lines-per-function` / `complexity` 均配置为 error 且通过 |
| 禁 `any`、TS strict | ✅ 合规 | `tsconfig.json` 全开（含 `exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`）；无 `any` 使用 |
| Rust Command 返回 `AppErrorDto` | ⚠️ 1 处例外 | `commands/app.rs:6`（见 P3-3） |
| 错误码规范 `<域>_<序号>` | ✅ 合规 | `domain/error.rs` 定义 NOTE/AUTH/REPO/SYNC/GIT/IO/AI 域；前端 `api/error.ts` 结构一致 |
| 服务端状态用 Query、全局 UI 态用 Zustand | ✅ 合规 | `queries/**` 为唯一数据源；`stores/**` 仅存 UI/会话/偏好，无 `useState` 镜像服务端数据 |
| Markdown 渲染 sanitize | ✅ 合规 | `MarkdownPreview` 不启用 `rehype-raw`；Mermaid `securityLevel: "strict"` |
| Token/Key 不入前端、不落盘 | ✅ 合规 | `secure_store.rs` / `auth_store.rs`；`ai_store::dto()` 仅回传 `hasKey`；日志经 `logging::redact` |
| 跨端目录隔离 | ✅ 合规 | 桌面壳 `src/pages/workspace/`、移动壳 `src/features/mobile-shell/`，无互相 import；平台判定集中在 `src/platform/` |
| 文档同步义务 | ⚠️ 1 处过期 | `docs/ARCHITECTURE.md:178`（见 P2-4） |

## 5. 性能与体积观察（非缺陷，供后续排期）

1. **软渲染的重算粒度**：`softRender/plugin.ts` 的 `StateField.update` 在 `tr.selection` 变化时也会整篇重算 decoration，并用 `ensureSyntaxTree(state, doc.length)` 保障整棵语法树。项目自有基线（`docs/PERF_BASELINE.md`）测得 5000 行解析 16.0 ms、计划 9.4 ms，属可接受范围；但「按住方向键连续移动光标」会以每键 ~10 ms 的量级重算，大笔记下值得实测输入延迟，必要时按可视区间裁剪。
2. **产物体积**：`pnpm build` 输出主包 `index-*.js` 1,375 kB（gzip 443 kB），并有 671 kB 的 `extensions`、435 kB 的 `cytoscape`（Mermaid 依赖）；另观察到两个近同尺寸的 `katex` chunk（259 kB × 2），建议确认是否为重复打包。Mermaid/KaTeX 已按需动态 import，可继续把编辑器（CodeMirror + TipTap）与预览管线做成路由级/视图级懒加载。
3. **大仓库下的自动保存开销**：见 P3-5。

## 6. 跨端影响声明

本次交付为**纯文档新增**（`docs/CODE_REVIEW_2026-09-10.md`），不含代码改动。

- **Desktop Impact**：无（未改动桌面壳、命令或原生能力）。
- **Mobile Impact**：无（未改动移动壳、`src/platform/` 或移动专属路径）。
- 文中 P1-1 / P2-1 / P2-3 / P3-2 的建议修复属于 `shared` 影响面，落地时按 `CODING_STANDARDS.md` §5.2 走 `pnpm build && pnpm test && pnpm lint`（移动 UI 另加 `pnpm test:e2e`）与 `cargo test`，并在 PR 说明中分别写清双端验证结果。

## 7. 建议的修复顺序

1. **P1-1**：先把「离开编辑上下文必 flush」补全（关闭窗口、切换仓库、恢复备份），这是唯一涉及用户数据丢失的项。
2. **P2-1 / P2-3**：AI 取消语义与外链打开统一，都是用户可直接感知的交互缺陷。
3. **P2-4 / P3-3 / P3-1 / P3-6**：低成本、可同日完成的清理项（文档、错误类型、重复 key、Clippy）。
4. **P2-2**：CSP 需要回归面较广，单独排一个 PR，建议同时补一条「渲染面清单」到 `docs/CODING_STANDARDS.md` 的安全章节。
5. **P3-2 / P3-4 / P3-5 / P3-7**：属长期健康度项，可随 M2（编辑手感与日常循环）一并处理。

## 8. 修复记录（2026-09-10 落地）

上表 12 项已按 §7 顺序全部修复，未改动需求与产品行为，仅收敛缺陷、文档与安全配置。

| ID | 修复内容 | 关键改动 |
|---|---|---|
| P1-1 | 新增编辑器草稿登记表：关闭确认、切换仓库、恢复备份、绑定/新建仓库前统一 `flushPendingDrafts()`；失败则留在应用内并提示。Rust 关闭拦截条件扩展为「Git 未提交 **或** 前端有未落盘草稿」（新增 `set_draft_dirty` 命令 + `DraftState`） | `src/features/note/utils/draftRegistry.ts`、`useNoteEditor.ts`、`useCloseGuard.ts`、`useRepoManager.ts`、`useRepoRestore.ts`、`BindRepoForm.tsx`、`CreateRepoForm.tsx`、`src-tauri/src/commands/close_guard.rs`、`lib.rs` |
| P2-1 | 流式生成引入请求序号：取消/重新发起后旧增量与最终结果一律丢弃；预览框改为显式 `open` 状态，取消即关闭；标题/大纲建议同规则 | `useAiWrite.ts`、`useAiSuggest.ts`、`AiWriteControls.tsx`、`useAiWriteTypes.ts` |
| P2-2 | 配置最小 CSP（`script-src 'self'` + 构建期内联脚本 hash、`style-src` 允许运行时注入样式、`img-src` 覆盖 `asset:`/远端图、`connect-src` 覆盖 IPC），`devCsp` 单独放行 Vite HMR，禁止再改回 `null` | `src-tauri/tauri.conf.json`、`docs/CODING_STANDARDS.md` §4 |
| P2-3 | 预览与更新说明的外链统一经 `open_external` 打开（浏览器环境回退新标签页），并顺手消除 `node` 透传到 DOM 的隐式告警 | `src/platform/open-link.ts`、`MarkdownPreview.tsx`、`UpdateReleaseNotes.tsx` |
| P2-4 | 架构文档「提交策略」段落按 PRD/实现重写；同步修正新建/导入/转换/历史恢复的即时提交描述，以及三处过期代码注释 | `docs/ARCHITECTURE.md`、`docs/AI_PRODUCT_DESIGN.md`、`queries/note.queries.ts`、`queries/history.queries.ts`、`stores/workspace-activity.store.ts` |
| P3-1 | 两个对话框 key 加 `rename:` / `remove:` 前缀，E2E 控制台不再出现重复 key 告警 | `RepoManager.tsx` |
| P3-2 | 独立 pull 前校验工作区是否干净并给出可读错误；fast-forward 改为「先检出后移动引用」且不再 force，冲突时保留本地文件与分支原状 | `services/sync_service.rs`、`repositories/git2_remote.rs`（含真实 git2 回归测试） |
| P3-3 | `open_external` 改为返回结构化 `AppErrorDto`，并抽出可测的 URL 白名单纯函数 | `commands/app.rs` |
| P3-4 | 保持「变更后最长 3s 落盘」的实际行为（对数据安全更有利），统一 PRD/ARCHITECTURE/E2E 措辞，并补一条单测锁定语义 | `docs/PRD.md`、`docs/ARCHITECTURE.md`、`e2e/core-flows.spec.ts`、`useNoteSaveQueue.test.tsx` |
| P3-5 | 自动保存路径下 `[notes]`/`[wiki]` 只标记过期不立即重取（面板下次挂载/聚焦自刷新），`[sync]` 保持即时刷新 | `queries/note.queries.ts` |
| P3-6 | Clippy 5 条告警清零（doc comment、derive Default、sort_by_key、测试生命周期、Unix 权限写法） | `domain/rich_text.rs`、`domain/ai.rs`、`repositories/trash_files.rs`、`git2_graph_tests.rs`、`git2_maintenance.rs` |
| P3-7 | 统一行数口径（非空非注释行）；`commands/metrics.rs` 拆为 `metrics/mod.rs` + `metrics/export.rs`，两者均在 80 行内 | `docs/CODING_STANDARDS.md` §0、`src-tauri/src/commands/metrics/*` |

修复后复跑门禁（全部通过）：`pnpm lint` 0 问题；`pnpm build` 通过；`pnpm test` 722 passed | 1 skipped（新增 16 条）；`pnpm test:e2e` 38 passed（重复 key 告警归零）；`cargo test` 243 passed | 6 ignored（新增 6 条）；`cargo clippy --all-targets` 0 warning。

仍在门禁之外、需人工确认的一项：CSP 的生产策略已在源码层确认机制（`tauri-codegen` 构建期为内联脚本注入 `'sha256-…'`、CSP 以响应头下发），但**尚未在真实桌面/移动壳内做过渲染面冒烟**（预览、软渲染、Mermaid、KaTeX、PDF 导出、图片、AI 流式）。建议下次 `pnpm desktop:run` 时按此清单过一遍。

## 附录 A：验证命令与结果摘要

```bash
pnpm lint          # ✅ 0 error / 0 warning
pnpm build         # ✅ tsc --noEmit + vite build（仅 chunk 体积告警）
pnpm test          # ✅ 132 passed | 1 skipped；706 tests passed | 1 skipped
pnpm test:e2e      # ✅ 38 passed（chromium，16.9s）
cd src-tauri && cargo test    # ✅ 235 passed | 6 ignored；集成测试 2 passed
cd src-tauri && cargo clippy --all-targets   # ⚠️ 5 warnings / 0 errors
```

补充核对：命令定义与注册 74/74 对应；`src/api/**` 调用的命令在后端全部存在；三处版本号一致（`package.json` / `tauri.conf.json` / `Cargo.toml` = 0.26.0）。

## 附录 B：审查覆盖与未覆盖

**已覆盖**：分层与依赖边界、错误处理与错误码、路径与文件安全、备份/恢复/回收站、凭证与隐私实现、同步（commit/pull/push/冲突/重试）、诊断与日志脱敏、编辑器保存与关闭链路、AI 链路、Markdown 渲染与 Mermaid、状态管理与 Query 失效策略、平台层与移动壳、E2E 与单测覆盖情况、文档与实现一致性。

**未深入**：软渲染 `utils/plan*.ts` / `widgets/*` 的算法正确性逐行核对（仅审查了接口、性能与安全面）；TipTap 富文本扩展与 PDF 打印版式细节；`scripts/` 构建脚本与 CI 配置；iOS 目标（本次未做 iOS 构建验证）；`docs/M1_TRUST_PLAN.md` 中逐条任务的完成度核对。
