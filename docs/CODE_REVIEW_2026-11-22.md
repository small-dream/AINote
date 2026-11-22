# AINote 代码审查报告（v0.64.2 → v0.66.1 增量）

> 审查日期：2026-11-22 · 审查基线：`main @ 72effcf`（v0.66.1，工作区干净）
> 审查范围：`42e3529..72effcf` 的 17 个提交、52 个文件（+2446 / −401），覆盖窗口边界守卫（Rust）、软渲染脚注与表格内联（TS）、GitHub 版式对齐（CSS）、Mermaid 主题与打包壳 CSP
> 审查方法：逐 commit diff + 通读全部新增文件 + 三路并行深审（Rust / softRender / CSS）+ 临时用例实证（用后即删）+ remark-gfm / tao / tauri-utils 源码核对
> 结论：四道门禁全绿，架构分层与测试纪律保持良好。发现 **1 项 🔴 功能缺陷（窗口找回兜底失效）**、**10 项 🟡 缺陷**（集中在「并集包围盒 ≠ 真实桌面」建模与脚注全文扫描的上下文保护）、若干 🟢 建议；XSS 复核**无新增漏洞**。🔴/🟡 全部已于同日两轮修复完毕（§2.1 修复记录 + §4 第二轮修复记录），🟢 级已顺手清理 C5–C7/SF6，剩余待办见 §5。

## 0. 结论速览

| ID | 级别 | 问题 | 影响面 | 关键位置 | 状态 |
|---|---|---|---|---|---|
| R1 | 🔴 | 异尺寸多屏存在并集「死角」：窗口落入死角时 `has_usable_visibility` 判不可见 → 修复路径却用同一并集盒计算 → 调整为空，窗口**永久搁浅**且每次聚焦/唤回空转 | desktop（多屏异尺寸/错位排列） | `window_geometry.rs:67`、`window_bounds.rs:91` | ✅ 已修复 |
| R2 | 🟡 | 工作区物理宽 < `minWidth×scale` 时 `set_size` 被 OS 按最小尺寸抬回，校正永不收敛，且日志谎报「已校正」 | desktop（小屏/高 DPI/远程虚拟屏） | `window_geometry.rs:102`、`tauri.conf.json` minWidth 800 | ✅ 已修复 |
| R3 | 🟡 | `Resized` 事件里即时收缩窗口，与用户拖拽边缘调整互搏，拖拽全程抖动回弹 | desktop | `window_bounds.rs:26-28` | ✅ 已修复 |
| SF1 | 🟡 | 脚注引用全文正则扫描未保护图片 alt / 链接 URL / `\` 转义上下文：幽灵引用污染**全文档编号**并错误渲染 | desktop + mobile | `plan.ts:58`（保护区缺 linkRanges/Image/Escape）、`footnotes.ts:7` | ✅ 已修复 |
| SF2 | 🟡 | 引用块/列表项首行内的脚注定义不被识别（GitHub/remark-gfm 识别），迁移文本「功能失效」 | desktop + mobile | `footnotes.ts:5` | ✅ 已修复 |
| SF3 | 🟡 | 表格源码在编辑态显示 `[1]` 而源码是 `[^1]`，所见非所得（f18301f 同类缺陷复发） | desktop + mobile | `footnotes.ts` + `blocks.ts:196` | ✅ 已修复 |
| SF4 | 🟡 | 表格单元格内脚注引用不渲染（裸露原文）但编号照常计入 | desktop + mobile | `tableInline.ts:98-128` | ✅ 已修复 |
| SF5 | 🟡 | 链接文本内含脚注引用出现「半渲染」混合态（改动前是全源码，一致性反而更差） | desktop + mobile | `utils/inline.ts:92` | ✅ 已修复 |
| C1 | 🟡 | 软渲染有序列表：宽序号（lower-roman `viii.`、第 100 项 `100.`）把首行文字推出内容列，与软换行续行错位 | desktop + mobile | `softrender.css:183-186`、`243-246` | ✅ 已修复 |
| C2 | 🟡 | 列表项跨多源码行时续行不获 depth 类与缩进，写作态列表左缘断裂（实证） | desktop + mobile | `blocks.ts:152-159` | ✅ 已修复 |
| C3 | 🟡 | Callout 预览/软渲染两态内边距与标题字号不一致（0.5rem vs 0；16px vs 14.4px）；修复中发现多行 Callout 标题 `::before` 逐行重复渲染（C9，见 §3.1） | desktop + mobile | `index.css:506-517` vs `softrender.css:522-550` | ✅ 已修复 |

门禁基线（本机 Windows）：

| 门禁 | 结果 |
|---|---|
| `pnpm build` | ✅ 通过（chunk 体积告警为既有建议） |
| `pnpm test` | ✅ 261 文件 / 1624 用例（1 skipped 为既有 perf 项） |
| `pnpm lint` | ✅ 通过 |
| `cargo test` | ✅ 530 用例（6 ignored 为既有项） |
| `pnpm test:e2e` | ⚠️ 195/196：`code-block-ui.spec.ts:135`「短代码块编辑前后高度差 ≤1px」实测差 3px；**基线复核**：暂存全部修复改动后在干净 v0.66.1 工作区同样失败，属既有缺陷（该 spec 不在本次增量改动列表内），与 R1/SF1/SF3 修复无关，待跟进排查（怀疑方向：本区间 softrender.css/code-block.css 的代码块高度相关改动） |

---

## 1. Rust：窗口边界守卫（fd4e9ff）

新增 `platform/window_geometry.rs`（纯几何计算，266 行，8 个单测）+ `platform/window_bounds.rs`（Tauri 薄壳，132 行）+ lib/tray 接线。**架构与防腐化指标全部合格**：纯函数与副作用分层、`#[cfg(desktop)]` 守卫齐全、不触碰 domain/、无新外部依赖、文件/函数均不超限。

### R1 🔴 并集「死角」搁浅（实证 ✅）

`union_work_area` 返回所有显示器 work area 的**包围盒**，校正（`normalize`）与修复（`repair_if_unusable`）一律以它为合法范围。但异尺寸/错位排列的显示器会在盒内留下无任何显示器的「死角」。临时 rustc 程序实证：`A(0,0,1920,1080) + B(500,1080,1920,1080)`，窗口在 `(100,1500,300,200)`（B 屏左边界右侧、A 屏下方）→ `has_usable_visibility=false` 走修复路径 → `fit_frame_to_work_area` 用同一个并集盒计算 → **调整为空，返回 Ok(false) 什么都不做**。此后每次 Focused/Moved/托盘唤回重复空转，窗口永远回不来。

**修复方向**：修复路径不再用并集盒，而是把窗口强制夹进**单个真实 work area**——取与窗口重叠面积最大的显示器（无重叠则取主屏）；并集盒只保留给「尺寸不超桌面」的宽松判断。

**已修复（2026-11-22）**：`window_geometry.rs` 新增 `best_work_area`（重叠面积最大 → 切比雪夫距离最近 → 并列取先，跳过零尺寸工作区）+ `overlap_area` / `rect_distance` / `gap_axis` 纯函数；`window_bounds.rs` 的 `repair_if_unusable` 不再委托并集盒版 `normalize`，直接用 `best_work_area` 选出的真实工作区 `fit`；`set_size/set_position` 应用逻辑抽成 `apply_fit` 供两条路径复用。测试外移到 `window_geometry_tests.rs`（`#[path]` 接线，遵循 `git2_remote_tests.rs` 先例，主文件保持 214 行），新增 5 个死角/择区用例：上下错位双屏死角（并集校正为空 vs 真实工作区校正到位）、对角线排列取更近屏、重叠优先于距离、等距取先、零尺寸过滤。

### R2 🟡 最小尺寸无感知 + 虚假成功日志（实证 ✅）

`fit_frame_to_work_area` 的目标内尺寸可低至 1px，不知道 `tauri.conf.json` 的 `minWidth: 800`（已核实 tao-0.37.1 在 `WM_GETMINMAXINFO` 强制 `ptMinTrackSize`）。小屏 + 高 DPI（如 1024 宽 @150% → 最小物理宽 1200）时 `set_size` 永远被 OS 抬回，每轮事件都重演失败校正，且 `log_adjustment` 打出「已按当前显示器工作区校正」——**虚假成功**。

**修复方向**：目标尺寸下限钳到 `window.min_inner_size()`（或 conf 值 × scale）；回读 `set_size` 后实际尺寸确认生效才打 info，否则打 warn。

### R3 🟡 Resized 与用户拖拽互搏（实证 ✅）

`Moved/Focused` 路径刻意容忍用户把窗口部分移出屏幕，但 `Resized` 路径只要外框超并集盒就立刻 `set_size` 收缩——包括用户正在拖动窗口边缘的实时调整。模拟用户连续拖宽（1696→1896→2096），每步都被拉回 1496。

**修复方向**：尺寸收缩限制在启动/唤回/ScaleFactorChanged 等程序化时机；`Resized` 降级为与 `Moved` 相同的 `repair_if_unusable`，或拖拽结束后去抖校正一次。

### R4 🟢 `handle_window_event` 不过滤窗口 label

挂在全局 `on_window_event` 上，对任何窗口生效；当前只有 main 窗口所以无害，但将来加截图浮窗等会被静默强制收缩。**修复**：开头加 `if window.label() != MAIN_WINDOW_LABEL { return; }`。

### R5 🟢 `normalizing` 防重入标志实际不生效

tao 的 `set_size/set_position` 都是 post 到事件循环，回馈事件在标志清零后才送达，该标志从未拦到任何事件。目前不出事靠 `fit_frame_to_work_area` 幂等 + `PIXEL_TOLERANCE=1`（这点设计是对的）。**修复**：改注释如实说明「收敛靠幂等性」，或做成真抑制 + 连续无效果熔断（顺带缓解 R2）。

### R6 🟢 CSP 配置正确但缺注释

`dangerousDisableAssetCspModification: ["style-src"]` 是 5cb60ea 的**正确修复**（已核实 tauri-utils 2.10.2 语义）：Tauri 默认往 style-src 注入 `'sha256-…'` 哈希，而哈希的存在会让浏览器忽略 `'unsafe-inline'`，Mermaid 运行时注入的 `<style>` 因此被拦。禁用后 script-src 仍受 nonce 保护，**安全面无实质放宽**；Mermaid 侧另有 `securityLevel: "strict"`。**仅建议**：在 conf 或 docs 注明动机，防止后人误删复发。

### 核查无缺陷项

| 怀疑方向 | 结论 |
|---|---|
| 尺寸 vs 位置先后顺序 | 正确：先钳尺寸再 containment，`size > extent` 钉到左上角，一轮收敛 |
| 负坐标多屏 | 正确：i32/i64 + `clamp_i64_to_i32`，有测试 |
| 恢复时机 | window-state 插件在 `on_window_ready` 恢复且 StateFlags 只含 SIZE\|MAXIMIZED（不持久化位置），代码注释描述准确 |
| `work_area` 平台差异 | 三平台真实现（GetMonitorInfo / gdk / visibleFrame） |
| tray.rs 重排 | 无回归：tao 异步投递保证「先校正后可见」 |
| 移动端 | 无影响：全部 `#[cfg(desktop)]` |

---

## 2. softRender：脚注与表格内联（9f9a781 / ef8fc54）

新增 `footnotes.ts`（133 行 + 12 例）、`tableInline.ts`（194 行 + 6 例）、`mermaidTheme.ts`（99 行 + 4 例）。**主干语义扎实**：编号、续行、2 空格边界、`[^1](url)`、大小写不敏感均与 remark-gfm 逐项吻合；列表 `1/i/a`、`•/◦/▪` 顺序经外部证据确认与 GitHub 一致。风险集中在**组合边界**——planFootnotes 是全文正则扫描器，与语法树世界的保护区没有对齐。

### SF1 🟡 幽灵引用污染全局编号（实证 ✅，主会话已复核 `plan.ts:58`）

`planFootnotes` 的 protectedRanges 只有 `codeRanges + wikiRanges + mathRanges`，不含 `linkRanges`、Image、Escape（对比 `planMathAndAutolink` 是含 linkRanges 的）：

| 输入 | 软渲染实测 | GitHub 基准（remark-gfm 实测） |
|---|---|---|
| `![a [^q] b](u)` + 正常引用 `[^r]` | q=1, r=2，**全文编号错位** | r=1（alt 是纯字符串，不是引用） |
| `[x](https://e.com/[^y])` | URL 内 `[^y]` 计入编号 | 不计入 |
| `x \[^1] y` | 渲染成 `x [1] y` | 纯文本 `[^1]` |

**修复方向**：`linkRanges`、Image 节点范围并入保护区；`collectReferences` 跳过前一字符为 `\` 的匹配。一次改动可同时消解 SF1/SF3 的一半。

**已修复（2026-11-22）**：`planFootnotes` 改为接收 `FootnoteScanContext`（`footnotes.ts`）：Image 节点范围全保护（alt 是纯文本）；Link 范围保护 URL 内匹配、但引用恰从链接起点开始时放行（保住 `[^1](url)` 按脚注 + 文本，实测 Lezer 树确认）；Escape 范围覆盖 `[` 时视为字面文本（`\\[^1]` 的 Escape 只吃第一个 `\`，引用仍生效）。活动表格范围作为 `revealRanges` 传入：光标所在表格内的引用/定义**计入编号但保持源码**（SF3），表外编号不随光标移动漂移。`plan.ts` 用通用 `collectNodeRanges` 收集 Image/Escape/Table/Link 范围。新增 5 个测试（alt/URL/转义/双转义/活动表格）。

### SF2 🟡 容器内定义不识别（实证 ✅）

`DEFINITION_RE` 只认行首 0–3 空格。remark-gfm 把 `> [^1]: note` 与 `- [^1]: note` 都解析为 footnoteDefinition；软渲染实测 defs=[]，全文保持源码。**修复方向**：剥离去 `>`/列表标记前缀后匹配，或明确注释声明不支持范围。

### SF3 🟡 表格编辑态所见非所得（实证 ✅）

`| a [^1] b |` 光标放入表格（不在 ref 上）→ DOM 显示 `| a [1] b |`，源码仍是 `[^1]`。这正是 f18301f / c2c9575 / b8671d2 反复修的「渲染内容与源文本不一致」缺陷类；math/image 在表格内本就有同样老问题，本次 footnote 把触发面扩大到最常见标记。**修复方向**：`planTable` active 时把表格范围并入 planFootnotes（及 math/autolink）的保护区。

### SF4 🟡 表格 cell 内引用不渲染但计号（实证 ✅）

`tableInline.ts` 的 `appendNode` 无 footnote 处理，cell 裸露 `[^1]` 原文，但该引用参与全局编号——「表格里裸露原文、表格外却占了号」。wiki/图片/裸 autolink 同属此边界。**修复方向**：`renderTableInline` 至少把 `[^label]` 渲染成编号节点（编号由 TableWidget 侧传入）。

### SF5 🟡 链接文本含脚注的混合态（实证 ✅）

`[see [^1] end](url)` 的 Lezer 树根本不成 Link 节点；`inline.ts:92` 新增的 `^\[\^` 短路使 planLink 跳过 → DOM 显示 `[see [1] end](url)`——半渲染混合态，改动前反而是全源码。短路本意（`[^1](url)` 按脚注处理）是对的且有测试，但顺带伤了这一形态。**修复方向**：外层处于未渲染链接语法中时整段保持源码，宁可全不渲染。

### 次要项（🟢）

- **SF6** `isOpaque` 对不可解析颜色返回 true（`null !== 0`），未来主题用 `var()` 间接引用即触发错误配色注入；建议 parseColor 为 null 时返回 false。
- **SF7** 主题切换后已渲染 Mermaid 保持旧配色（沿袭旧行为，建议监听 surface 主题变化重渲染）。
- **SF8** `FootnoteDefWidget` 的 `label` 参数实际语义是序号，「无引用时退回原标签」注释不可达。
- **SF9** 表格 dirty 时点击相邻格，点击点光标丢失（落至格尾）；pendingFocus 携带 caret hint 可解。
- **SF10** 嵌套第 4+ 层有序列表不回退 decimal（GitHub 亦只定义两级，极边缘，可不改）。
- **SF11** plugin.ts 恰好 300 行踩 ESLint max-lines 上限（主会话已复核），下次再加逻辑前建议先拆分。
- `Decoration.mark({block: true})`（plugin.ts:69）为死配置，属存量，顺手清理即可。

### XSS 复核：无新增漏洞 ✅

`renderTableInline` 实测 `<img onerror>`、`<script>`、`javascript:` 链接：全部按文本节点输出、无元素创建；`javascript:` 只进 dataset，点击链路经 Rust `open_external` 的 http/https 白名单拦截。软渲染新路径全部 createElement/textContent，未走 innerHTML。

### 测试质量评估

footnotes 12 例边界覆盖好（含 `[^1](url)`、缩进代码块保护、2/4 空格边界），但**全是 plan 级断言、无一处 EditorView 渲染级**——SF1–SF5 全部漏网。tableWidget 12 例 happy path 完整，但新交互逻辑（rememberCaret→applyCaretHint）因 jsdom 缺 `caretRangeFromPoint` **零覆盖**，e2e 也只测静态渲染。建议补渲染级测试钩子。

---

## 3. CSS：GitHub 版式对齐（ff10708 / d5c723a / 4ac10ce / c047279）

无跨端泄漏、无 🔴。四个主题提交意图明确、注释翔实、e2e 与单测同步更新，整体是高质量的排版对齐。

### C1 🟡 宽序号推出内容列

`.cm-sr-number`（inline-block）超过 `min-width: 1.4em` 时向右生长：二级列表 roman `viii.`≈1.5em、顶级第 100 项 `100.` 时，首行文字被推离 2em 内容列，而软换行续行仍从 padding 边开始——同项两行左缘参差。**修复方向**：序号盒定宽（超宽截断/缩字号）或绝对定位标记列。

### C2 🟡 多源码行列表项续行断裂（实证 ✅）

`emitLineLayout` 只给 `ListMark` 所在行打 depth 类并隐藏缩进；`- a\n  b` 的续行既无 depth 类缩进空格也不隐藏——首行 2em、续行裸露第 0 列。列表项内容占多行源码在笔记里非常常见。**修复方向**：`planList` 对 item 覆盖的每一行 lineStart 追加同一 depth 类并隐藏行首缩进。

### C3 🟡 Callout 两态残差

预览 `padding: 0.5rem 1rem`、标题 16px；软渲染 `padding: 0 1em`、标题 14.4px。本次对齐迁移中唯一没对齐的块级元素（hr/blockquote/表格/列表均逐项对齐，唯 callout 漏了垂直方向）。**修复方向**：二选一统一。

### 次要项（🟢）

- **C4** 脚注区字号两态不一致（预览固定 12px 不随用户字号缩放，软渲染 0.75em 随动）；建议统一为 `0.75em` token。
- **C5** 死规则三处（已实读 mdast-util-to-hast 13.2.1 确认脚注区无 hr）：`markdown-themes.css:305`、`softrender.css:114`、`index.css:753`，建议删除。
- **C6** 过期注释/死兜底值：`export.css:15`、`mobile-shell/styles.css:163`、`rich-text.css:243`，只改注释不动行为。
- **C7** 富文本任务列表文字列与预览/软渲染仍差 0.25em（旧版差 1.15em，已大幅收窄，遗留残差）。
- **C8** README 截图早于 9f9a781 视觉改版，下个窗口重拍。

### 复核「不该改/无需改」（节选）

`:root` 硬编码 Primer Light + `[data-theme="dark"]` 块是有意设计且正确（dark 块 token 全齐，阅读主题容器级覆盖恒胜）；嵌套列表标记选择器与软渲染 depth 逻辑逐组合核对等价；软渲染标题间距代数与预览 margin 折叠逐情形核算相等；typography.store append-only、旧 localStorage 全兼容（实测 5 passed）；新增 `!important` 仅 Mermaid 必需的两处；code-block 悬停操作钮带 `@media (hover: none)` + `:focus-within` + `prefers-reduced-motion` 三重兜底，无移动端 hover 依赖。

---

## 4. 第二轮修复记录（R2–R6 / SF2·SF4·SF5·SF6 / C1–C7）

> 实施日期：2026-11-22（同日第二轮，基线 `3cdf77d`）。门禁：`pnpm build`/`test`（1656 用例）/`lint` 与 `cargo test`（536+4）全绿；e2e 195/196，唯一失败为 §0 表中记录的既有 `code-block-ui.spec.ts:135`，无新增回归。

- **R2**：`fit_frame_to_work_area` 增加 `min_inner` 参数（tauri 2.12 无最小尺寸 getter，按 tauri.conf.json 的 minWidth/minHeight × `scale_factor()` 向上取整推导，缺配置退回 1×1 旧行为）；工作区装不下最小尺寸时目标抬到 min_inner，窗口宁可超出工作区，不再请求会被 `WM_GETMINMAXINFO` 钳回的值。`apply_fit` 在 `set_size` 后回读 `inner_size`（已核实 runtime-wry 主线程内联同步执行，回读有效），被钳回就打 warn 并返回未生效，消除虚假成功日志。
- **R3**：`Resized` 并入 `Moved`/`Focused` 同一兜底分支（编译期共享 match 分支保证路由一致），完整校正只剩启动/托盘唤回/`ScaleFactorChanged` 三个程序化时机，不再与拖拽互搏。
- **R4**：`handle_window_event` 开头过滤非 main label。**R5**：`normalizing` 标志注释如实说明「收敛靠幂等 + PIXEL_TOLERANCE，标志只防同线程同步重入」。**R6**：tauri.conf.json 不支持注释（Cargo.lock 无 JSON5 依赖，编译期严格 JSON），CSP 动机改记入 `docs/TROUBLESHOOTING.md §11`。
- **SF2**：行首剥离可嵌套容器前缀（`>` 只吞一个空白，对齐 CommonMark）后按原正则匹配定义，marker 偏移换算回源坐标；容器内定义遇真空行终止、`>` 单独成行算容器内空行，均经 remark-gfm 实测对齐；跨真空行的容器多段定义不识别（注释声明边界 + 回归测试锁定）。
- **SF4**：编号通路 `footnoteNumbering`（从 plan 的 footnote-ref widget 反查 label→序号）→ plugin.ts → TableWidget（`footnoteKey` 参与 `eq()`，查号表变化强制重建）→ `renderTableInline` 把整体恰为 `[^label]` 的节点渲染成 `cm-sr-footnote-ref`；查不到号回退源码。SF3 的 reveal 语义保持不变。
- **SF5**：选择比「整段跳过」更贴 GitHub 的**计号不替换**：`insideRawLinkSyntax`（行内方括号深度扫描、转义感知）判定引用嵌在 Lezer 未成 Link 的 `[see [^1] end](u)` 语法里时不替换但照常计号，编号与 GitHub 一致，仅外层保持源码，消除混合态。
- **SF6**：`isOpaque` 改为 `alpha === 1`，不可解析颜色（`var()` 间接引用、命名色）与半透明一律回退默认页色，杜绝非法字符串注入 `edgeLabelBackground`。
- **C1**：`.cm-sr-number` 定宽 1.8em + `text-align: right`，文字列恒为 2em 与续行同列；超宽序号向左溢出（复刻 GitHub `list-style: outside` 生长方向）。
- **C2**：`emitLineLayout` 改收整个 item：mark 行之外的每个源码行打同 depth 类并隐藏行首空白；嵌套列表范围扩张到行首后整行跳过（防装饰重复）、行内/围栏代码范围相交时裁剪或跳过（防 replace 装饰重叠）。新增 3 例（缩进/懒续行、嵌套不重复、代码保护）。
- **C3 + C9（实施中发现）**：CM6 的 block 装饰按行展开成 span，导致多行 Callout 的 `::before` 标题**逐行重复渲染**（审查时漏掉的真实缺陷）；`planCalloutBlocks` 把标题类只打首行、呼吸位类打首/末行，`::before` 挂到 `.cm-sr-callout-title`，预览侧补 `::before` 字号 0.9em，两态统一。
- **C5/C6/C7**：三处死规则删除；三处过期注释/死兜底值修正；任务项文字列三态对齐 2.0em（含嵌套 `calc(2em-0.6em)→2em` 配套）。

---

## 5. 剩余待办

1. **C4** 🟢 脚注区字号/缩进两态统一（预览固定 12px 不随用户字号缩放 vs 软渲染 0.75em）。
2. **SF7** 🟢 主题切换后已渲染 Mermaid 保持旧配色（监听 surface 主题变化重渲染）。
3. **SF8/SF9** 🟢 FootnoteDefWidget 参数命名；表格 dirty 时跨格点击点光标丢失。
4. **e2e 既有失败** `code-block-ui.spec.ts:135`（短代码块编辑前后高度差 3px > 1px）：v0.66.1 基线即失败，怀疑方向为本区间代码块高度相关 CSS 改动，需排查。
5. **plugin.ts** 303 行踩线（ESLint 按 skip 空行/注释计合规），下次扩展前建议先拆分。
6. C8 README 截图重拍、SF10 第 4+ 层列表回退 decimal（GitHub 亦只定义两级，可不改）。
