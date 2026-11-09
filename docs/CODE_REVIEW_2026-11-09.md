# AINote 代码审查报告（v0.62.0 → v0.64.1 增量）

> 审查日期：2026-11-09 · 审查基线：`main @ 3a1c174`（v0.64.1，工作区干净）
> 审查范围：`a8f4721..3a1c174` 的 87 个文件（+4614 / −249），覆盖桌面端 PDF / Word 导入、软渲染代码块卡片化、启动同步改为只拉取
> 审查方法：逐文件阅读 + 门禁实测（`pnpm build` / `pnpm test` / `pnpm lint` / `cargo test`）+ 临时用例实证（用后即删）+ `@lezer/markdown` 语法树范围实测
> 结论：整体结构清晰、原子落盘与失败回滚扎实、e2e 覆盖到位。发现 **2 项 🔴 功能缺陷（均造成静默内容损失）**、**2 项 🟡 Windows 平台缺陷**、**2 项 🟡 细节缺陷**；另有 6 项复核后判定「不该改」，理由见 §2。

## 0. 结论速览

| ID | 级别 | 问题 | 影响面 | 关键位置 | 状态 |
|---|---|---|---|---|---|
| F1 | 🔴 | `cleanMarkdown` 对整篇 Markdown 跑正则清洗，连围栏代码块一起改：`<script>` 会吞掉整块内容、连续空行被压掉、行尾空格被删 | 桌面（Word 导入） | `utils/markdown.ts:108-123` | ✅ 已修复 |
| F2 | 🔴 | PDF 去重复页眉页脚时按行重组页面，把 `\n\n` 段落分隔吃掉——带页眉页脚的多页 PDF 每页塌成一个大段落 | 桌面（PDF 导入） | `utils/pdfText.ts:124-147` | ✅ 已修复 |
| F3 | 🟡 | 仓库相对路径在 Windows 上产出 `\`，前端 `getDirectoryPath` / `splitPath` 只认 `/`：树里打开的笔记标题框显示 `docs\a.md`、移动/重命名默认目录变成仓库根；`cargo test` 15 项失败中 13 项同源 | shared（桌面 Windows 明显） | `note_service.rs:196`、`file_tree.rs:64`、`path.ts:20-28` 等 | ✅ 已修复 |
| F4 | 🟡 | `selectNoteImport` 的 `oneAtATime` 不在 `DocumentImportErrorCode` 里，被硬映射成 `unsupported` 错误码但配 `oneAtATime` 文案 | 桌面 | `useWorkspaceActions.ts:64` | ✅ 已修复 |
| F5 | 🟡 | 编辑态代码块底部 footer 由 30px 变 12px（`is-empty`）时不通知 CodeMirror 重新测量，高度表会失真 | desktop + mobile | `editCodeBlockScrollbarMetrics.ts:25` | ✅ 已修复 |
| F6 | 🟡 | 2 个 `resolve_conflicts_*` 测试依赖开发者全局 `core.autocrlf`：全局开 autocrlf 的机器上必然失败 | 工程门禁 | `git2_remote_tests.rs:288` | ✅ 已修复 |

门禁基线（本机 Windows）：

| 门禁 | 结果 |
|---|---|
| `pnpm build` | ✅ 通过（`dist/pdfjs/{cmaps,standard_fonts}` 正确产出） |
| `pnpm test` | ✅ 258 文件 / 1579 用例 |
| `pnpm lint` | ✅ 通过 |
| `cargo test` | ❌ 500 passed / 15 failed（13 项路径分隔符 + 2 项 CRLF + 新用例 1 项计入路径分隔符） |

---

## 1. 问题详情

### F1 🔴 Word 导入会破坏围栏代码块内容

`convert.ts:68` 的 `htmlToMarkdown` = `cleanMarkdown(turndown(html))`，而 `cleanMarkdown`（`markdown.ts:108-119`）对**已经生成好的 Markdown 全文**做字符串正则清洗，围栏代码块也在清洗范围内。临时用例实证：

| Word 里的代码块 | 导入结果 | 问题 |
|---|---|---|
| `<script>alert(1)</script>` | ```` ```\n\n``` ```` | 整块内容被 `/<script[\s\S]*?<\/script>/` 抹掉 |
| `a() {}\n\n\nreturn 1;` | `a() {}\n\nreturn 1;` | `/\n{3,}/` 把两个空行压成一个 |
| `line1   \nline2` | `line1\nline2` | `/[ \t]+\n/` 删掉行尾空格 |

预览对话框展示的也是清洗后的文本，用户无法察觉。安全清洗（去 script/style/iframe/注释）只在**代码块之外**才需要。

**修复**：先按行切成「围栏内 / 围栏外」片段，只清洗围栏外片段，再原样拼回；围栏内只做 CRLF→LF。围栏识别需支持 ``` 与 ~~~、开闭围栏长度匹配。

### F2 🔴 PDF 段落结构在去页眉页脚时丢失

`pageTextFromItems` 用 `\n\n` 表示段落分隔，`dedupeRepeatedMargins` 却 `split("\n") → filter(Boolean) → join("\n")`，把段内空行整体吃掉。实证：

```
输入：第 1 页\n标题\n段落一第一行\n段落一第二行\n\n段落二\n共 2 页
输出：段落一第一行\n段落一第二行\n段落二        ← 段落二被并进上一段
```

Markdown 里单换行等于空格，于是**每页正文在最终笔记里变成一个大段落**。触发条件是「≥60% 页面在前 2 / 后 2 行有重复内容」——即带页眉页脚的普通 PDF，正是最常见的形态。

**修复**：页面保留为「行数组（含空行）」，去重只把命中的边界行置空，重组时保留空行并收敛 3 个以上连续换行；页内候选行全部被删时仍回退原页面（保住现有测试语义）。

### F3 🟡 Windows 仓库相对路径混用 `\`

`note_service.rs:196`、`file_tree.rs:64-68`、`search_service.rs:33`、`wiki_service.rs:28`、`asset_files.rs:54`、`wiki_mention_service.rs:161-165`、`note_content.rs:112-116`、`note_files.rs:124` 全部直接 `strip_prefix(...).to_string_lossy()`，Windows 上得到 `docs\a.md`；而前端 `features/file-tree/utils/path.ts` 的 `getDirectoryPath` / `splitPath` / `joinPath` 只认 `/`。后果：

- 从树里打开的笔记，`notePath` 是 `docs\a.md` → 标题输入框显示 `docs\a.md`（`useNoteTitle.ts:26`）；
- `getDirectoryPath` 返回 `""` → 移动 / 重命名对话框默认目录变成仓库根（`MoveNoteDialog.tsx:27`、`RenameNoteDialog.tsx:59`）；
- 同一仓库里「新建 / 导入」产出的路径可能是 `docs/a.md`，从树里打开又是 `docs\a.md`，同一文件两种 id。

`cargo test` 15 项失败里 13 项是这个根因（含本次新增的 `document_import_service.rs:180`）。`backup_files.rs:82-93` 已经有一份「按 component 拼 `/`」的正确实现，说明团队已有约定，只是没铺开。

**修复**：新增 `domain/path.rs::to_slash(&Path) -> String`，在上述所有出口统一调用；`backup_files` 改为复用；`favorite_files` 读取时把历史 `\` 路径迁移成 `/`（否则老收藏在 Windows 上会静默消失）。前端 `path.ts` 三个纯函数做分隔符归一，防止任何残余 `\`（MCP、历史 localStorage）再次触发同一故障。

### F4 🟡 导入错误码与文案不一致

`selectNoteImport` 返回 `{kind:"invalid", code:"oneAtATime"}`，而 `DocumentImportErrorCode` 没有这个值，于是 `useWorkspaceActions.ts:64` 用 `oneAtATime → unsupported` 硬映射：错误码说「格式不支持」，文案说「一次只能导入一个」。任何按 `code` 分支的处理（提示、重试、埋点）都会走错。

**修复**：把 `oneAtATime` 纳入 `DocumentImportErrorCode`，对话框 `ERROR_KEYS` 补一条映射，删掉硬映射。

### F5 🟡 编辑态代码块高度变化未通知 CodeMirror

`editCodeBlockScrollbarMetrics.ts:25` 依据是否横向溢出给 footer 切 `is-empty`，CSS 让 footer 在 30px / 12px 之间切换（`softrender.css`），但没有 `view.requestMeasure()`。首次挂载没问题（`toDOM` 内同步执行后才测量），但「输入到产生横向溢出」会让块高度变化而高度表不更新，后续点击 / 滚动落点可能偏移。

**修复**：`applyCodeBlockScrollbar` 返回 `is-empty` 是否翻转，翻转且 DOM 已挂载时调用 `view.requestMeasure()`；`toDOM` 阶段的首次调用（未挂载）不触发。

### F6 🟡 冲突解决测试依赖全局 git 配置

`git2_remote_tests.rs:288` 直接 `git2::Repository::init`，随后 `checkout_index` 写工作区；开发者全局 `core.autocrlf=true` 时读回 `local\r\n`，断言 `"local\n"` 失败（本机 2 项）。测试应按机器无关的方式固定仓库配置。

**修复**：测试夹具里显式 `core.autocrlf=false`（只改测试，不改产品行为）。

---

## 2. 复核后判定「不改」的问题

| 初判 | 复核结论 |
|---|---|
| 启动拉取失败静默 | **不成立**。`app/providers.tsx:12-17` 的全局 `MutationCache.onError` 已对所有 mutation 失败弹 toast，`useStartupSync` 的 pull 失败会可见。仅提示语是后端中文串，与全仓错误提示口径一致。 |
| 混选（`a.md` + `a.txt`）整批拒绝 | **刻意契约**。`selection.test.ts:35` 明确断言该行为，`accept` 也已限制；改成「跳过不支持项」属于改需求，不在本次修复范围。 |
| 文档导入图片一次性过 IPC | 真实风险，但需改协议（分批 / raw body / Channel），影响面大且无法在缺少真机网络条件时验证，另立专项。 |
| `scannedPdf` 警告在纯扫描件上不可达 | 无功能错误：纯扫描件走 `empty` 错误提示，`warningScanned` 只在「部分页扫描」时出现，文案重叠但行为正确。 |
| 编辑态滚动条 MutationObserver 覆盖整个 contentDOM | 性能优化项，需要性能基线与重复测量，另立专项；本次只做 F5（正确性）。 |
| 引用块 / 列表内嵌套围栏的 block widget 落在行中间 | 视觉细节，需要 CodeMirror 侧方案（BlockWrapper 或行内 header），风险高于收益，另立专项。 |

---

## 3. 修复计划

### 3.1 批次与顺序

按「数据正确性 → 平台一致性 → 细节」排序，每项独立可回滚：

1. **F1**（前端，纯函数 + 单测）— 无外部依赖。
2. **F2**（前端，纯函数 + 单测）— 无外部依赖。
3. **F3**（Rust `domain` 新增纯函数 + 全部出口；前端 `path.ts` 防御 + 单测）— 依赖 F1/F2 不冲突，可并行。
4. **F4**（前端类型 / 文案 / hook）。
5. **F5**（前端编辑器，单文件小改，依赖 e2e 回归）。
6. **F6**（Rust 测试夹具）。

### 3.2 逐项改动清单

| 项 | 改动 | 新增/更新测试 |
|---|---|---|
| F1 | `utils/markdown.ts`：抽出 `splitFencedSegments`（按行切分、支持 ``` / ~~~ 开围栏与长度匹配的闭围栏），`htmlToMarkdown` 改为「CRLF 归一 → 切分 → 只清洗围栏外片段 → 接缝收紧 → trim」；新增 `fencedBlock` 在源码含 ``` 时加长围栏 | `markdown.test.ts`：代码块内 `<script>` 原样保留、连续空行保留、行尾空格保留、围栏外 script/style 仍被移除、加长围栏、正文 `~~~` 不误判 |
| F2 | `utils/pdfText.ts`：`dedupeRepeatedMargins` 改为保留空行结构，仅清空命中行；页内候选全命中时回退原页面 | `pdfText.test.ts`：段落分隔保留、页眉页脚仍移除、原 6 条用例全部保持通过 |
| F3 | 新增 `domain/path.rs::to_slash`；13 处路径产出点统一归一（含 `backup_files` 复用、`favorite_files::load` 读取时迁移历史路径）；前端 `path.ts` 三函数归一分隔符、`getNoteFileName` 改用 `splitPath` | `domain/path.rs` 单测（Windows 风格输入 → `/`）；`path.test.ts` / `note/utils/path.test.ts` 补反斜杠用例；既有 13 条 Windows 失败用例转为通过 |
| F4 | `types.ts` 错误码联合类型加 `oneAtATime`；`DocumentImportDialog` 的 `ERROR_KEYS` 补映射；`useWorkspaceActions` 删硬映射 | `useDocumentImport` / 对话框现有测试不涉及；`selection.test.ts` 不变（选择结果语义未改） |
| F5 | `editCodeBlockScrollbarMetrics.ts` 返回翻转标志；`editCodeBlockScrollbar.ts` 在已挂载时 `requestMeasure()` | 无单测（依赖 DOM 高度）；靠既有 e2e `code-block-ui.spec.ts` 回归 |
| F6 | `git2_remote_tests.rs` 夹具设 `core.autocrlf=false` | 本机 2 条用例转通过 |

### 3.3 风险控制规则

- 只改与缺陷直接相关的代码；不改 `codeBlockPointer.ts`、`codeBlockPlan.ts`、`plugin.ts` 的交互逻辑（本次审查未发现回归，改动风险高于收益）。
- 全部对外行为变更必须落在测试里；纯函数先写用例再改实现。
- Rust 侧只做字符串归一，不改变任何路径校验、原子写入、回滚、符号链接防御逻辑。
- 不新增依赖，不改 IPC 协议，不动 `tauri.conf.json`。
- 收尾门禁：`pnpm build && pnpm test && pnpm lint` + `cargo test`，四条全绿才算完成。

### 3.4 验收标准

1. `pnpm build` / `pnpm test` / `pnpm lint` 通过。
2. `cargo test` 在 Windows 上 **0 failed**（含 F3 修好的 13 项与 F6 修好的 2 项）。
3. F1/F2 有对应的回归单测，且用「修复前会失败」的用例证明有效。
4. 桌面端软渲染代码块交互无回归：`e2e/code-block-ui.spec.ts` / `code-block-selection.spec.ts` 相关断言保持通过。
5. `docs/ARCHITECTURE.md` 补一条「仓库相对路径统一 `/`」的约定（架构不变量）。

### 3.5 交付后仍待专项

- 文档导入图片过 IPC 的批量/流式方案（配合 80MB 总量上限复核）。
- 编辑态代码块 observer 收敛与性能基线。
- 引用块 / 列表内嵌套围栏的卡片形态。

---

## 4. 执行结果（2026-11-09 修复批次）

### 4.1 门禁

| 门禁 | 修复前 | 修复后 |
|---|---|---|
| `pnpm build` | ✅ | ✅（`tsc --noEmit` + vite build） |
| `pnpm test` | ✅ 258 文件 / 1579 用例 | ✅ 258 文件 / **1590** 用例（+11） |
| `pnpm lint` | ✅ | ✅ |
| `cargo test --lib` | ❌ 500 passed / **15 failed** | ✅ **518 passed / 0 failed**（另有 6 ignored） |
| `pnpm test:e2e code-block-*` | — | 13/14 通过；1 项 3px 高度断言为既有失败（A/B 基线同样失败，见 §4.4） |

### 4.2 逐项实现与证据

- **F1**：`htmlToMarkdown` 改为「CRLF 归一 → 按围栏切分 → 只清洗围栏外片段 → 接缝收紧 → trim」；新增 `fencedBlock`，源码里出现 ``` 时自动加长围栏（否则代码块会在自己的内容处提前闭合，属同类内容损失）。新增 6 条用例，覆盖代码块内 `<script>` 存活、连续空行/行尾空格保留、正文清洗不回退、加长围栏、正文 `~~~` 不误判、块前后间距。
- **F2**：`dedupeRepeatedMargins` 改为「行数组保留空行 + 只清空命中边界行」，页内候选全命中时仍回退原文；新增 2 条用例（段落分隔保留、`assemblePdfMarkdown` 输出），原有 6 条语义用例全部保持通过。
- **F3**：新增 `domain/path.rs::to_slash`（3 条单测），13 处路径产出点统一归一（`to_meta`、`file_tree::rel_path`、`search_service`、`wiki_service`、`wiki_mention_service`、`asset_files`、`trash_files`×2、`note_content`、`note_files::unique_note_path`、`document_import_service`、`backup_files`、`favorite_files::load`、`note_favorite_service`）；`favorite_files` 读取时迁移历史 `\` 路径（不在读操作写盘）；前端 `path.ts` 三个函数兜底分隔符、`getNoteFileName` 改用 `splitPath`（顺带去掉 `slice` 偏移的脆弱实现）；ARCHITECTURE 增加「仓库相对路径约定」。
- **F4**：`oneAtATime` 进入 `DocumentImportErrorCode`，对话框 `ERROR_KEYS` 补齐，删除硬映射。
- **F5**：`applyCodeBlockScrollbar` 返回高度是否翻转，`refresh` 在「已挂载 + 翻转」时 `requestMeasure()`；`toDOM` 阶段不触发。
- **F6**：测试夹具新增 `init_repo`，显式 `core.autocrlf=false`。

### 4.3 未修的 6 项

见 §2，均已给出不修理由与替代专项；本次未改动 `codeBlockPointer.ts` / `codeBlockPlan.ts` / `plugin.ts` 的交互逻辑与任何 IPC / 配置。

### 4.4 遗留观察

- 13 项路径分隔符失败与 2 项 CRLF 失败在修复前是**历史遗留**（与本轮功能无因果关系，但违反 `AGENTS.md` 的完成门禁，会让真实回归淹没在噪声里）。
- 前端 `localStorage` 里的历史 `recent notes` / `editor preferences` 键仍带 `\`，属易失 UI 状态，未做迁移（打开后会自然重建）。
- E2E：`code-block-ui.spec.ts` 的「短代码块编辑态保持渲染高度」在本机失败（渲染态与编辑态高度差 3px，断言要求 ≤1px）。用 `git stash` 回到修复前基线复跑**同样 3px 失败**，属 Windows 字体度量敏感的既有断言，不是本批次回归；未改动该断言（放宽阈值会削弱测试意图），留待跨平台基线统一处理。
- E2E：首轮并行跑时「移动窄屏聚焦代码块不自动换行」出现过一次 `footer-track` 未渲染的抖动，单独复跑 3/3 与整套复跑均通过，判定为 React 微任务渲染 + 首轮冷启动的偶发竞态，与 F5 改动无关（F5 只增加 `requestMeasure()`，不移除任何 DOM）。
