# AINote Markdown 编辑与预览体验优化计划

> 版本：v0.1 · 状态：P1 实现中 · 维护：产品与前端协作
>
> 本文档是编辑器与 Markdown 预览的专项路线图。它补充 `docs/PRD.md` 的产品目标，实施时仍须遵守 `docs/ARCHITECTURE.md` 与 `docs/CODING_STANDARDS.md` 的分层、文件规模、错误处理和测试约束。

## 1. 目标与产品取舍

### 1.1 目标

AINote 的核心体验目标是：用户打开一篇笔记后，可以立即、稳定、无干扰地输入 Markdown；预览能够快速且准确地表达最终文档；所有内容仍以普通 Markdown 文件保存，能够被 Git 审计、迁移和恢复。

### 1.2 竞品取舍

| 竞品 | 借鉴 | 不照搬 |
|---|---|---|
| Obsidian | 大纲、双链补全、反向链接、快捷命令、专注写作 | 不引入插件优先或私有 Block 数据模型 |
| Typora | 阅读感、所见即所得般的排版连续性、低干扰工具栏 | MVP 仍保留 Markdown 源码编辑，不做富文本覆盖编辑 |
| VS Code | CodeMirror 可实现的编辑可靠性：查找替换、快捷键、输入规则、状态反馈 | 不引入 Monaco 的体积和复杂度 |
| GitHub Markdown | GFM 表格、任务列表、代码块、链接语义和安全边界 | 不把 GitHub CSS 直接当作 AINote 设计系统 |
| Notion | 空间层级、响应式布局、渐进式操作 | 不牺牲文件可迁移性换取私有数据结构 |

最终方向：**Obsidian 的知识导航 + Typora 的阅读感 + VS Code 的编辑可靠性**，并坚持“Markdown 文件就是数据”的差异化定位。

## 2. 当前基线（v0.3）

### 2.1 已有能力

- `@uiw/react-codemirror` + CodeMirror 6，使用 Markdown/GFM 语法解析和主题扩展。
- 编辑、预览、左右分栏三种模式；分栏支持拖拽调整，默认 50/50。
- 编辑器与预览按 Markdown 行号双向同步滚动。
- 30 秒防抖自动保存，手动保存和 Git 检查点已接入。
- 格式工具栏支持粗体、斜体、删除线、行内代码、标题、列表、任务列表、链接、图片、代码块、表格和分割线。
- 图片导入到仓库 `assets/`，预览可渲染本地资产；`[[双链]]` 可点击跳转。
- Git 版本历史、Diff、恢复、全文搜索、标签索引和回收站已存在。
- Markdown 原始 HTML 默认不解析，预览具备基础 XSS 防护边界。

### 2.2 现有代码入口

| 区域 | 文件 | 职责 |
|---|---|---|
| 编辑器组装 | `src/features/note/components/NoteEditor.tsx` | 组装编辑器、工具栏、预览、面板和模式 |
| Markdown 预览 | `src/features/note/components/MarkdownPreview.tsx` | `react-markdown` + `remark-gfm`，图片和双链转换 |
| 保存编排 | `src/features/note/hooks/useNoteEditor.ts` | 读取草稿、dirty、30 秒防抖和 flush |
| 编辑器扩展 | `src/features/note/hooks/useEditorExtensions.ts` | Markdown、GFM、快捷键、主题和活动格式 |
| 同步滚动 | `src/features/note/hooks/useSyncScroll.ts` | DOM 锚点收集、双向滚动和 MutationObserver |
| 预览样式 | `src/styles/index.css` | `.markdown-body` 基础排版 |
| 设计 Token | `src/styles/tokens.css` | 亮色/暗色主题变量 |

### 2.3 关键缺口与风险

1. **保存状态可靠性**：`useNoteEditor` 在 mutation 成功前就清除 dirty；写入失败时用户可能误以为内容已保存。
2. **切换笔记安全性**：`flush()` 当前为同步触发的 void API，切换笔记无法等待写入完成。
3. **多仓库缓存隔离**：笔记内容 query key 目前只含 path，多个仓库出现同路径时存在缓存串读风险。
4. **错误呈现方式**：读取错误会替换整个编辑区，缺少保留草稿、重试和恢复动作。
5. **编辑器基础能力不足**：查找/替换、撤销重做、括号匹配、自动闭合、列表续写、长行换行和更丰富的输入规则尚未显式配置。
6. **预览能力偏基础**：暂无代码高亮、复制代码、Frontmatter/Properties、Callout、数学公式、Mermaid、脚注和图片加载状态。
7. **预览性能**：每次渲染都会在组件内创建 `components` 映射并解析 Markdown；大文档时缺少 Worker/增量策略。
8. **同步滚动稳定性**：只观察 DOM mutation，图片、字体和代码高亮完成后的尺寸变化可能导致锚点偏移。
9. **导航不足**：没有当前笔记大纲、标题跳转、`[[`/`#` 补全和带上下文的反向链接。
10. **小窗口体验**：固定侧栏和三栏布局在窄窗口、触控设备上会压缩编辑区域；分割线也缺少键盘调节语义。

## 3. 优先级与里程碑

### P0：可靠输入与保存（已完成首版）

目标：任何输入都不丢，用户始终知道内容是否已落盘。

- [x] 将保存流程建模为 `clean → dirty → saving → clean`，失败进入 `saveError` 并保留 dirty。
- [x] `flush()` 改为返回 `Promise<void>`；切换笔记前等待 flush 完成。
- [x] 保存失败时在编辑器工具栏内联展示错误和“重试”，不替换编辑器内容。
- [ ] 本地文件保存与 Git commit 解耦：本地保存接近即时，Git 仍遵循 5 分钟空闲批量提交策略。（现有 Git 提交策略保持不变，进一步拆分留待后续 PR）
- [x] query key 改为包含 `repoPath`，并补充保存队列与多仓库隔离逻辑。
- [x] 增加连续输入、切换笔记和保存失败测试；离线/网络恢复场景沿用同步层测试，后续补充端到端覆盖。

验收：保存失败后 dirty 状态 100% 保留；切换笔记前最后一次输入可恢复；无冲突场景下编辑体验不等待 Git 网络操作。

### P0：编辑器基础能力（核心首版已完成）

目标：达到 VS Code/Obsidian 的日常 Markdown 输入效率。

- [x] 显式加入 CodeMirror `history`、`search`、`closeBrackets`、`bracketMatching`、`indentOnInput`、`lineWrapping` 等扩展。
- [x] 支持 Cmd/Ctrl+F 查找、查找替换、撤销/重做和 Escape 关闭搜索面板。
- [x] Markdown 输入规则首版：无序/有序/任务列表续写，空列表项回车退出列表。（引用续写、代码围栏和更完整缩进策略留待后续 input rules PR）
- 粘贴多行文本时保持缩进；粘贴图片继续走资产导入管线。
- 统一命令注册表，工具栏、快捷键、命令面板复用同一命令定义。
- 工具栏分为高频操作和“更多”菜单；增加撤销、重做、查找、专注模式、字数/行列状态。
- 窄宽度下工具栏横向滚动或折叠；按钮命中区不小于 32px（移动端不小于 44px）。

验收：常用编辑动作均可键盘完成；5000 行文档输入无明显卡顿；工具栏在 900px 宽度下不溢出。

### P1：预览渲染平台（第一批已完成）

目标：预览结果接近 GitHub Markdown 的完整度，同时保持阅读舒适。

实施顺序：

1. [x] 代码块语法高亮、语言标签和一键复制。
2. [x] 标题锚点、表格容器横向滚动、外部链接安全属性。
3. [x] Frontmatter/Properties 展示：读取文档顶部 YAML，展示标量与简单数组字段；复杂对象不参与展示/索引。
4. [x] Callout（note、tip、warning、danger）统一 AST 转换和主题样式。
5. [x] 数学公式（块级和行内），使用 `remark-math` + `rehype-katex`，样式随预览主题加载。
6. [x] Mermaid 图表，渲染失败时显示源代码和错误原因；启用 Mermaid strict 安全级别。
7. [x] 图片懒加载、加载失败状态和路径提示。

本批实现使用 `rehype-highlight` + `highlight.js`，标题锚点、代码复制、表格滚动和图片加载状态已接入 `MarkdownPreview`。当前阶段新增 `remark-frontmatter` + `yaml`，并通过 `remarkCallouts` / `remarkRemoveFrontmatter` 建立统一转换入口；原始 HTML 仍默认不解析。

建议管线：

```text
Markdown 源文
  → 统一解析 AST
  → 安全过滤与扩展转换
  → 预览组件
  → 大纲 / 同步滚动 / 反向链接共用 AST
```

安全要求：继续默认不解析原始 HTML；若未来开放 HTML，必须显式使用 `rehype-raw` 与 `rehype-sanitize`，并补充危险协议、事件属性和 SVG 场景测试。

### P1：导航与知识流（约 1 周）

- [x] 新增当前笔记大纲（H1–H6）和标题快速跳转。
- [x] 输入 `[[` 时显示笔记目标补全；输入 `#` 时显示标签补全。
- [x] 未解析双链使用明确但克制的视觉状态。
- [x] 反向链接展示来源标题、上下文片段和跳转入口。
- [x] 预览标题、双链和图片点击后保留回到原编辑位置的能力。
- [x] 保存每篇笔记的编辑/预览模式、滚动位置和分栏比例。
- [x] 扩展 Cmd/Ctrl+K：打开笔记、切换模式、插入 Callout、保存版本；查找替换与专注模式沿用现有入口，后续补齐统一命令注册。

### P1：同步滚动、响应式与性能（1–2 周）

- [x] `MutationObserver + ResizeObserver` 同时维护锚点。
- [x] 滚动处理通过 `requestAnimationFrame` 节流，避免双向回声和高频布局读取（测试环境保留同步回退）。
- 连续文本也生成稳定锚点；优先使用 AST 行号而非脆弱的 DOM 推断。
- 分割线支持键盘左右调整，并提供 `aria-valuemin/max/now`。
- ≥1200px 默认可选分栏；900–1199px 保留分栏但降低默认密度；<900px 自动切换单栏模式。
- 解析、语法高亮和大文档预览迁移到 Worker 或可取消任务；编辑输入与预览渲染解耦。
- 以 1,000 篇笔记目录和 5,000 行单篇文档建立性能基准。

## 4. 推荐的前端拆分

遵循“View → Hooks/Queries → api/”方向，最终让 `NoteEditor.tsx` 只负责组装：

```text
src/features/note/
├── components/
│   ├── EditorSurface.tsx       # CodeMirror 视图
│   ├── PreviewSurface.tsx      # 预览视图
│   ├── NoteOutline.tsx         # 大纲与标题跳转
│   ├── EditorStatusBar.tsx     # 保存、字数、行列和错误
│   └── MoreFormatMenu.tsx      # 低频 Markdown 操作
├── hooks/
│   ├── useNoteSaveQueue.ts     # 保存状态机与 flush
│   ├── useMarkdownDocument.ts   # AST/Worker 生命周期
│   ├── useEditorCommands.ts     # 命令注册与快捷键
│   └── useEditorPreferences.ts # 模式、滚动和分栏比例
├── utils/
│   ├── markdownPipeline.ts      # 纯 AST 转换
│   ├── outline.ts               # 标题树与 slug
│   ├── scrollAnchors.ts         # 行号/尺寸映射
│   └── editorMetrics.ts         # 字数、行列和阅读统计
└── workers/
    └── markdown.worker.ts
```

每个新增纯函数必须同时提供单元测试；Hook 使用 `vi.mock('@/api')` 隔离 IPC；涉及 Rust 的 AST/文件能力则在 Service 层注入 Mock Repository。

## 5. 视觉与交互规范

### 编辑区

- 正文编辑区域保持最大可读宽度，代码和长行可独立横向滚动。
- 当前行、选区、光标和未保存状态使用 Token 化语义色；避免大面积高饱和背景。
- 工具栏只保留当前任务需要的控件，低频功能渐进式出现。
- 支持专注模式：隐藏侧栏和低频工具，仅保留文档标题、保存状态和退出入口。

### 预览区

- 正文行长控制在 65–75ch，标题层级采用稳定的 1.125–1.2 比例。
- 代码、表格、引用和 Callout 使用独立背景层，但不堆叠卡片和装饰性阴影。
- 暗色主题下确保正文、占位符、代码和链接均满足 WCAG AA 对比度。
- 图片、图表和表格必须有加载中、成功和失败三种状态。

### 状态与可访问性

- 所有交互控件具备 default、hover、focus、active、disabled、loading、error 状态。
- 编辑/分栏/预览改为标准 `tablist`/`tab`/`tabpanel` 语义，键盘可用左右箭头切换。
- 分割线提供可读的当前比例和键盘增减能力。
- 自动保存、保存失败、离线和同步状态使用 `role="status"` 或 `aria-live`，不依赖颜色单独表达。
- 遵守 `prefers-reduced-motion`，动画只表达状态变化，时长控制在 150–250ms。

## 6. 验收指标

### 体验指标

- 普通笔记输入到预览更新 P95 < 120ms。
- 5,000 行 Markdown 输入、滚动、查找无明显卡顿。
- 本地保存失败时 dirty 状态 100% 保留，重试成功后才转为 clean。
- 切换笔记、窗口关闭或应用退出前，不丢失最后一次输入。
- 图片、字体、代码高亮完成后，同步滚动偏差不超过一个可视块。
- 1,000 篇笔记下目录树与搜索交互 < 100ms。
- ≥900px 窗口下编辑区不出现横向溢出；移动端主要操作命中区 ≥44px。

### 工程门禁

- `pnpm build && pnpm test && pnpm lint` 全部通过。
- Rust 改动额外执行 `cargo test`。
- `lib/`、`utils/`、AST/滚动/格式化等纯函数覆盖率 ≥ 90%。
- 新增 Markdown 扩展必须有正常、边界、恶意输入和暗色主题测试。
- 不得在组件中直接调用 `invoke()`；不得将 Git 或文件 IO 放入前端。

## 7. 交付顺序与依赖

```text
P0 保存可靠性
  ↓
P0 编辑器基础能力
  ↓
P1 Markdown 预览平台 ──┐
  ↓                    ├→ P1 性能与同步滚动
P1 导航与知识流 ────────┘
```

建议每个里程碑拆成可独立回滚的小 PR：

1. `fix(note): harden save state and flush`
2. `feat(note): add editor interaction extensions`
3. `feat(note): build markdown preview pipeline`
4. `feat(note): add outline and link completion`
5. `perf(note): stabilize preview anchors and responsive split`

每个 PR 合并前同步更新本文件的完成状态，并在 PRD/架构发生业务规则或分层变化时同步更新对应活文档。

## 8. 设计决策记录

- **继续使用 CodeMirror 6**：已满足模块化、Markdown 解析和 Tauri WebView 体积要求；当前缺口主要是扩展配置，而非编辑器内核替换。
- **继续使用普通 Markdown 文件**：预览能力通过 AST 扩展提升，不引入私有 Block 数据格式。
- **本地保存优先于 Git 提交**：编辑器的“已保存”表示内容已写入本地文件；Git commit/push 是独立的版本化与同步反馈。
- **预览默认安全**：不解析原始 HTML；所有未来扩展先定义安全边界，再实现视觉能力。
- **性能以可感知延迟为准**：优先保证输入线程和滚动线程流畅，再考虑更复杂的渲染效果。
