# AINote 富文本字符级样式实施方案（字体 / 字号 / 字体颜色 / 文本高亮）

> 版本：v1.2 · 状态：M1 已交付（v0.54 前「未发布」章节）；M2 经 2026-09-24 复核**暂缓**（理由见 §4.1、决策见 §10）· 维护：产品与前端协作
> 上游：`docs/RICHTEXT_FORMATTING_EVAL.md`（可行性、证据链与风险）；关联 `docs/PRD.md` P1-11、`docs/EDITOR_EXPERIENCE_PLAN.md` §5、`docs/CODING_STANDARDS.md` §3 / §5.2
> 本方案确定「做成什么样」与「分几步做」；实现 PR 必须同步 `docs/PRD.md`。

## 1. 目标与产品取舍（行业参照）

目标：让富文本笔记具备**可被 Git 长期承载、在 8 套阅读主题与双端下都可读**的字符级强调能力，而不是把桌面出版的自由度搬进笔记。

| 参照 | 借鉴 | 不照搬 |
|---|---|---|
| Notion | 固定调色板（文字色 / 背景色两套并列，各约 10 档）；字体族是「正文档位」只有 3 档；字号是相对档位；同一色名在亮 / 暗下自动取不同值 | 块级背景色、自由拖拽、块级私有数据模型 |
| Apple Notes | **单一「Aa」入口**收敛全部文本样式，高亮只给少量档位 | 其富文本存储格式（AINote 保持 `.ainote` = TipTap JSON） |
| Obsidian | `==高亮==` 语法（与 Bear 同为事实标准）；主题用 CSS 变量统一供给 | 颜色靠社区 CSS / 插件实现 —— 会与 CSP 和 8 套主题的对比度要求正面冲突 |
| 飞书 / 语雀 / Slack | 语义色板 + 浅色高亮底（低饱和、不刺眼） | 在线协作、评论浮层 |
| Ulysses / iA Writer | 「排版层与内容层分离」的克制：写作工具不做字符颜色 | ——（本项作为**反面依据**，用于否决块级样式） |
| Google Docs / Word | 仅借鉴其快捷键与撤销粒度 | **任意字体 / 任意 px 字号 / 任意 hex 颜色**：与「Git 即数据库」的数据纯净、8 套主题、双端一致三项同时冲突 |

## 2. 行业共识 → 本项目约束映射

| 行业共识 | 在本项目的落点 |
|---|---|
| 调色板优于取色器 | 颜色 5 档语义色 + 重置；高亮 5 档；不提供取色器 |
| 颜色是**语义名**而非色值，主题切换由系统映射 | 落盘 `color: "danger"`；渲染走由各主题 token 派生的 `--note-fg-*`，无需逐主题声明色值（派生公式见 §3.3） |
| 字号是相对档位，不写死绝对值 | 4 档以 `em` 表达，用户调「排版偏好 → 正文字号」时全文仍整体跟随 |
| 字体族是正文档位（≤3 档） | 无衬线 / 衬线 / 等宽，直接复用既有 `--note-body-font-*` token，**不引入平台分支** |
| 入口收敛为单一面板，高频动作进选区浮层 | 工具栏「Aa」面板放全部四组；气泡菜单只放高亮与颜色 |
| 外部内容不得污染本笔记样式 | 粘贴按自有 `class` 解析，外部 `span[style]` 一律不认（§3.4） |

## 3. 方案定稿

### 3.1 取值表（四组，含 class 与 i18n key）

| 组 | 档位 | class | i18n key |
|---|---|---|---|
| 字体 | 无衬线 / 衬线 / 等宽 | `rt-font-sans` / `rt-font-serif` / `rt-font-mono` | `richtext.fontSans` / `fontSerif` / `fontMono` |
| 字号 | 小 0.875em / 正文 1em / 大 1.25em / 特大 1.5em | `rt-size-sm` / `rt-size-base` / `rt-size-lg` / `rt-size-xl` | `richtext.sizeSm` / `sizeBase` / `sizeLg` / `sizeXl` |
| 颜色 | 强调 / 成功 / 警告 / 危险 / 次要 + 重置（5 档，无紫 / 青） | `rt-fg-accent` / `-success` / `-warning` / `-danger` / `-muted` | `richtext.colorAccent` … `colorReset` |
| 高亮 | 黄 / 绿 / 蓝 / 粉 / 灰 + 清除 | `rt-mark-yellow` / `-green` / `-blue` / `-pink` / `-gray` | `richtext.markYellow` … `markClear` |

档位数量是本方案的「可裁剪参数」：增减档位必须同步本表、`textStyles.ts` 白名单、CSS token 与 i18n，四处缺一即视为未完成。

### 3.2 数据形状与落盘

```json
{
  "type": "text",
  "text": "关键结论",
  "marks": [
    { "type": "fgStyle",   "attrs": { "color": "danger" } },
    { "type": "sizeStyle", "attrs": { "size": "lg" } },
    { "type": "markStyle", "attrs": { "mark": "yellow" } }
  ]
}
```

- 属性值为枚举字符串，非法值在 `parseHTML` 与读取侧一律回退默认（与 `parseRichTextContent`、`typography.store` 的既有兜底风格一致）。
- 值等于默认档时不写 attr、不写 mark，避免 `.ainote` JSON 里堆 `"size":"base"` 这类噪音。
- 旧 `.ainote`（无 marks）与旧版本客户端不受影响；被新版本写过的笔记再被旧版本打开编辑会丢样式，**由 Git 历史兜底**（不额外做兼容层，但需在 CHANGELOG 提示）。

### 3.3 渲染与主题映射

mark 的 `renderHTML` 只输出 `class`，绝不输出 `style`（`docs/RICHTEXT_FORMATTING_EVAL.md` §4.1 的 CSP 约束，且用单测固化）。

取值全部由既有语义 token **派生**，不新增逐主题色值。两组公式已按 `docs/CODING_STANDARDS.md` §3 的 4.5:1 阈值做过双引擎实测：

| class | 取值 | 实测（8 套主题 × 5 档 = 40 组） |
|---|---|---|
| `rt-fg-*`（5 档） | `color-mix(in oklab, var(--note-<语义色>) 78%, var(--note-ink))` | 最低 **4.87**，40/40 通过 |
| `rt-mark-*`（5 档） | 底色 `color-mix(in oklab, var(--note-<语义色>) 30%, transparent)` 叠在 `--note-bg` 上，文字仍为 `--note-ink` | 最低 **6.61**，40/40 通过 |

为什么文字色必须派生而不能直接复用：直接使用 `--note-accent` / `--note-success` / `--note-warning` 时，40 组里有 **6 组低于 4.5:1**（forest 的强调 / 成功 / 警告 = 4.18 / 4.18 / 4.11，solar 的强调 / 成功 / 警告 = 4.27 / 3.79 / 4.32）——这些 token 是按 UI 强调色（按钮、边框、图标）调的，不是正文文字色。按 78% 混入正文色后全部通过，且颜色观感仍保留语义（红仍是红）。实测同时确认：混合比例 85% 仍有 1 组不达标（solar 成功 = 4.47），故 **78% 是该公式的下限安全值**，不得随手调高。

实测环境与结论一致性：chromium 与 webkit 两引擎结果差异 < 0.05（例：高亮 30% 档最低值 6.61 / 6.59），可跨端复用同一组公式。高亮的透明度在 25% / 30% / 35% 三档均通过，取 **30%**（观感与对比度的折中）。

`color-mix()` 需 WebView 支持（Safari 16.2+ / Chromium 111+，两引擎实测均支持），并保留常量兜底色（`@supports not (color: color-mix(in oklab, red, blue))` 分支），避免老 WebView 上高亮消失。

打印 / PDF：`src/features/export/export.css` 的导出作用域内重定义同一批变量为浅色基线值，保证暗色主题下选的高亮在 A4 浅色打印页仍可读。

### 3.4 交互与跨端

- 工具栏新增一个「Aa」按钮，展开单一面板承载四组样式（沿用 `ToolbarPopover` 的 portal 方案，规避 `overflow-x-auto` 裁剪）；原「标题级别」选择器不动。
- 气泡菜单只加**高亮**与**颜色**两项；沿用「H4–H6 不上气泡菜单」的既有取舍，避免移动端选区浮层超宽。
- 移动端：面板走底部抽屉形态，触控目标 ≥36px（`docs/CODING_STANDARDS.md` §5.3），支持无 hover、软键盘收起后重定位；桌面与移动共用同一套 class 与 token，**不引入平台分支**。
- 新增快捷键仅一个：高亮 `Mod+Shift+H`；下发前需在 `useEditorExtensions.ts` 的既有 keymap 里核对无冲突。
- 斜杠命令沿用现有 `SlashCommand` 机制补「高亮」一项，不新增命令体系。

## 4. Markdown 互通分级与 M2 暂缓

评估结论是「导出必然丢样式」。逐项复核后，**高亮在语法层面存在一条互通路径**，其余三项没有：

| 样式 | `.ainote` 内 | `.md` 互通 | 机制 |
|---|---|---|---|
| **高亮** | mark | 计划双向（**M2，暂缓**） | `==文本==`：Obsidian / Bear 的事实标准；本项目已有两处现成挂点（见下） |
| 颜色 | mark | 单向丢失 | 进转换损失清单 |
| 字号 | mark | 单向丢失 | 同上 |
| 字体 | mark | 单向丢失 | 同上 |

### 4.1 M2 暂缓的理由（2026-09-24 复核）

原方案把高亮互通列为「M2」（见 v1.1 的 §5），复核后决定**暂缓**。理由如下：

1. **M2 实质是给默认用户新增一门语法，而非给富文本搭桥**。新建笔记的默认类型是 Markdown（`src/features/note/hooks/useNewNoteForm.ts:21`），因此 `==` 会出现在绝大多数用户每天输入的 `.md` 源文件里。
2. **`==` 与程序员笔记的日常写法歧义面极大**。`==` 是 `=` 的重复，`if (a == b)`、`x == y`、赋值比较随手就写；Obsidian 靠「`==` 两侧不得有空格」规避歧义，而这条硬规则恰好与程序员笔记两侧带空格的书写习惯相撞（`a == b` 会被拒，`a==b` 会被吞）。对比之下，`[[双链]]` 与 `#标签` 有明确的非空字符集边界（见 `markdownMarks.ts` 的 `matchTag` / `matchWikiLink`），天然无歧义。
3. **两处渲染判定需要新建一套对齐机制**。软渲染侧已有 `codeIndex` / `mathRanges` / `createRangeIndex` 排除代码与数学区间（`src/features/note/softRender/utils/plan.ts:53`），但预览侧 `markdownPipeline.ts` 没有等价机制；不补则同一份 `.md` 在编辑区与预览区表现不一致。
4. **路线图 M2 的交付范围里没有它**。`docs/ROADMAP.md` §5 的 M2 六大项（编辑器能力收口、性能、快速捕捉、模板与日记流、搜索增强、版本掌控）与退出标准均未包含字符样式；现在做等于挤占路线图工期。
5. **富文本侧的高亮已可用，暂缓不损失既有能力**。M1 已交付 `.ainote` 内的 5 档高亮，唯一放弃的是跨格式往返。

**触发重启的条件**（任一满足再做，且优先走缩范围路线）：

- 出现真实用户诉求：有用户把 Obsidian / Bear 导出的 `==高亮==` 笔记导入 AINote 并要求正确渲染。
- `.md` 与 `.ainote` 之间的类型转换被高频使用，且用户明确反馈「高亮在转换后丢失」是阻塞项。

**若重启，建议缩范围为只读互通**：`.md` 里已有的 `==x==` 在预览与软渲染中正确显示为高亮，编辑器不主动插入、不自动转义。此举规避写入侧的歧义与转义复杂度，成本约为完整 M2 的 1/3。完整 M2 的四条链路方案保留在本节下方，作为重启时的实施依据。

### 4.2 完整 M2 的实现挂点（重启时使用）

全部是既有模式，不新增机制：

1. 富文本侧（读）：在 `markdownMarks.ts` 追加 `registerHighlightMarkdown()`，与既有 `registerWikiLinkMarkdown` / `registerTagMarkdown` 同构 —— markdown-it 内联规则产出 `<mark class="rt-mark-*">`，由 mark 的 `parseHTML` 接收。
2. 富文本侧（写）：mark 的 markdown 序列化输出 `==…==`（各档高亮在 Markdown 侧统一降级为「有/无高亮」，色档不跨格式保留）。
3. 软渲染编辑器：在 `softRender/utils/plan.ts` 追加 `planHighlightMarks()`，复用 `addWikiLink` 的 `hides`（隐藏 `==`）+ `marks`（`cm-sr-highlight`）模式，并在 `softrender.css` 配色。
4. Markdown 预览：在 `markdownPipeline.ts` 追加 `remarkHighlight`，产出 `data-highlight` 属性并由 `markdown-body` 样式渲染（纯 CSS，不引入 HTML 透传，`skipHtml` 取舍不变）。

实现注记：`==` 与既有两个自定义 mark 的序列化方向**相反**。`WikiLink` / `TagMark` 把 `[[…]]`、`#标签` 的标记字符保留在文本节点里，故 `serialize` 的 `open` / `close` 为空且 `escape: false`；高亮则要求正文干净（文本不含 `==`），标记由 `serialize` 的 `open: "=="` / `close: "=="` 在导出时包裹，`parse` 侧用内联规则把 `==…==` 转成带 `data-highlight` 的 `<mark>`。两处方向不同不可互相复制。

若四条链路完成，高亮将是唯一能在 `.md` 与 `.ainote` 之间无损往返的字符样式；当前其余三项（颜色 / 字号 / 字体）在笔记类型转换时已显式提示损失。

## 5. 里程碑与退出标准

### M1：字符样式核心（`.ainote` 闭环）
四个 mark + 白名单纯函数 + token + 「Aa」面板 + 气泡菜单两项 + 转换损失提示 + 单测。

退出标准：新建富文本笔记可设/取消四组样式；落盘 JSON 只含枚举 attr；`renderHTML` 只出 class；§3.3 两组公式在 8 套主题 × 5 档共 80 组上对比度均 ≥4.5:1（由单测断言，见 §7）；切换笔记、撤销重做、图片/表格共存时样式不串位。

### M2：Markdown 高亮互通（**暂缓**）

`==…==` 四条链路（富文本读写、软渲染、预览）+ 转换损失清单文案定稿。复核后暂缓，理由与重启条件见 §4.1；实施依据保留在 §4.2。

退出标准（重启后适用）：`.md` 写 `==重点==` 与 `.ainote` 设黄高亮互相转换后语义不丢；`.ainote → .md` 时颜色/字号/字体在转换对话框中被逐项列为损失；导出 Markdown 不残留任何 HTML 标签。

### M3：打磨与跨端
打印 / PDF 浅色映射、快捷键、斜杠命令、移动端底部抽屉、可访问性走查。

退出标准：PDF 导出中暗色主题下设的高亮仍可读；移动端（含窄屏 375px）面板无越界、触控目标合规；键盘可完成四组样式的设置与清除。

## 6. 影响面、文件清单与文档义务

影响面：`shared`（编辑器与工具栏双端共用）。Rust 零改动（`rich_text.rs` 只读 `text` 与 `attrs.level`）。

```text
新增（M1 已交付，实际落地文件名以 PR 为准）
  src/features/richtext/extensions/formatMarks.ts        # 4 个 mark（<120 行）
  src/features/richtext/utils/textStyles.ts              # 枚举 / class / 校验纯函数（<90 行）
  src/features/richtext/utils/textStyleCommands.ts       # 四组 toggle 命令
  src/features/richtext/components/TextStylePanel.tsx    # 「Aa」面板（<180 行）
  src/features/richtext/components/TextStyleOptions.tsx  # 面板分组渲染
  src/features/richtext/components/SwatchGrid.tsx        # 色板与高亮格（<90 行）
改动（M1）
  extensions.ts / RichTextToolbar.tsx / RichTextBubbleMenu.tsx
  utils/conversionLoss.ts（新增「内联样式」损失项）、rich-text.css
  src/i18n/messages.ts（28 个新 key，中英双语）、e2e/richtext-flow.spec.ts
改动（M2，暂缓；重启时再落）
  utils/markdownMarks.ts（高亮 inline 规则）
  src/features/note/utils/markdownPipeline.ts（remarkHighlight）
  src/features/note/softRender/utils/plan.ts（== 的 hides + marks）
  softrender.css / src/features/export/export.css
```

需同步文档：`docs/PRD.md`（P1-11 扩展为「字符级样式」并写明边界）、`docs/EDITOR_EXPERIENCE_PLAN.md` §5.1（新增「文档属性 vs 视图属性」一类）、`docs/CHANGELOG.md`。

## 7. 测试义务

1. `textStyles.ts` 纯函数：枚举 → class、非法值回退、默认值不写 attr。
2. 调色板断言（同时守护 token 覆盖率与对比度）：解析 `src/styles/markdown-themes.css` 与 `src/styles/tokens.css` 的各主题 `--note-*` 值，按 §3.3 的 78% / 30% 公式复算文字色与高亮底，断言 8 套主题 × 5 档全部 ≥4.5:1，并断言最低值不低于实测基线（文字色 4.87、高亮 6.61）。任一主题漏配 token、或后续有人调高混合比例把对比度拉低，此用例即失败。
3. mark 单测：`renderHTML` **只出 class 不出 style**（CSP 回归护栏）、`parseHTML` 忽略外部 `span[style]`。
4. ~~高亮往返~~（M2 暂缓，随 M2 重启）：`==x==` ↔ mark ↔ `==x==` 三向断言；`.md` 导出不残留 HTML 标签。M1 已交付的替代护栏是「`.ainote → .md` 导出剥离字符样式且不残留 HTML」。
5. `conversionLoss` + i18n：颜色 / 字号 / 字体被识别为损失项并展示。
6. `toolbarCommands`：四组动作的 `isActive` 与 `run`。
7. e2e：选中文字 → 设高亮与颜色 → 落盘 JSON 断言；桌面与移动视口各一遍。（Markdown 侧 `==` 软渲染与预览断言属 M2，暂缓。）

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 生产壳内联 `style` 是否被 CSP 拦截尚未实测 | 已执行最小验证（Playwright chromium + webkit）：追加 nonce 后行内 `style` 属性被拦截，A 路线出局，结论见评估文档 §4.1；残余待办是安装包冒烟确认 Tauri 确实追加 nonce |
| `color-mix()` 在部分 WebView 版本不可用 | 已提供常量兜底色 + `@supports` 分支，纳入 M1 验收 |
| 新增 mark 改变既有笔记的 `.ainote` 序列化结果 | 默认档不写 attr；对既有笔记做一次「打开—保存—diff 为空」的回归 e2e |
| 高亮与既有标签 / 双链 mark 叠加渲染 | M1 验收覆盖「高亮 + 双链 + 标签」同段落共存 |
| 自由取值被后续需求重新提出 | 评估文档 §9 已列「明确不做」，变更需走 PRD |

## 9. 明确不做 / 暂缓

- 任意 hex / 任意 px / 任意字体名（`docs/RICHTEXT_FORMATTING_EVAL.md` §4 四处失守）。
- Markdown 笔记的颜色 / 字号 / 字体（会污染 `.md` 源文件与可移植性）。
- Markdown 笔记的高亮 `==…==`（**暂缓而非否决**：语义无歧义问题以外的成本过高，重启条件见 §4.1；M1 交付的 `.ainote` 高亮不受影响）。
- 块级与段落级样式（背景块、行高、对齐、缩进）——属排版层，与阅读偏好正面冲突，需单独评估。
- 下划线、上标下标、分栏、首字下沉等无 Markdown 语义的样式（本次不进入范围）。
- 笔记自带主题 / 自定义 CSS（属于 `docs/PRD.md` P2-3 范畴）。

## 10. 决策记录

已确认（2026-09-24）：

1. **颜色取 5 档**：强调 / 成功 / 警告 / 危险 / 次要 + 重置；紫、青不做（省下 16 行逐主题色值与两档维护成本）。
2. **字号只做相对倍率**：不提供改变段落默认大小的能力，避免与「设置 → 排版偏好」的正文字号打架。
3. **`==高亮==` 互通（M2）暂缓**（2026-09-24 复核，取代原「按 M2 实施」的决定）：`==` 与程序员笔记的日常写法歧义面大、预览侧需新建排除机制、路线图 M2 交付范围不含此项。重启条件与缩范围方案见 §4.1；四条链路方案保留在 §4.2，重启时可直接施工。
4. **CSP 最小验证已执行**：结论为内联 `style` 在生产壳被拦截，A 路线出局（方法、矩阵与残余不确定性见 `docs/RICHTEXT_FORMATTING_EVAL.md` §4.1）。

已交付（2026-09-24）：

- **M1 字符样式核心**：提交 `b5ef262 feat(richtext): 富文本支持字体、字号、颜色与高亮`（24 文件 / 1551 行）。四组样式落 `.ainote` 枚举 mark、渲染只出 class、5 档高亮与 5 档颜色对比度护栏全绿。

M1 收尾时修掉的既有缺陷：新增字符样式 mark 后 `.md` 序列化会转义 `[[双链]]` 与 `#标签`。根因是 `prosemirror-markdown` 只按 mark 集合中 **rank 最大**的 mark 决定是否转义文本，而 rank 由 extension `config.priority` 降序决定、与注册顺序无关；自有 mark 现固定 `priority: 1100`（高于 WikiLink / TagMark 的 1000），并已加回归护栏。

实施阶段待办（不阻塞开工）：

- 高亮快捷键 `Mod+Shift+H` 需在 `useEditorExtensions.ts` 的既有 keymap 与各平台实测中核对冲突。
- 安装包冒烟时顺带确认「Tauri 确实向 `style-src` 追加 nonce」，把结论回填评估文档 §4.1。
- 实施 PR 需同步 `docs/PRD.md`（P1-11 扩为字符级样式）、`docs/EDITOR_EXPERIENCE_PLAN.md` §5.1（文档属性 vs 视图属性）。
