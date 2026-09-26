# AINote 富文本字符级样式评估（字体 / 字号 / 字体颜色 / 文本高亮）

> 版本：v1.2 · 状态：评估结论（已转化为方案，见 `docs/RICHTEXT_FORMATTING_PLAN.md`；§4.1 已实测确认）· 维护：产品与前端协作
> 关联：`docs/PRD.md` P1-11、`docs/EDITOR_EXPERIENCE_PLAN.md` §5、`docs/CODING_STANDARDS.md` §3 / §5.2
> 本文档只回答「能不能做、做成什么样、代价是什么」，不改变任何既有规范；实现前需先按 §10 完成产品决策并同步 PRD。

## 0. 结论摘要

需求可行，且主要落在前端（Rust 零改动），但**不建议做成「自由排版」**（任意字体名 / 任意 px 字号 / 任意 hex 颜色）。理由集中在 §4：CSP、8 套阅读主题的对比度、Markdown 导出与打印四条链路都会因「自由值」而失守。

推荐形态：**语义化字符样式**。

| 维度 | 建议范围 | 落盘方式 |
|---|---|---|
| 字体 | 3 档：无衬线 / 衬线 / 等宽（复用 `--note-body-font-*`） | 枚举 attr + class |
| 字号 | 4 档：小 / 正文 / 大 / 特大（相对倍率 `em`） | 枚举 attr + class |
| 颜色 | 5 档语义色（强调 / 成功 / 警告 / 危险 / 次要）+ 重置 | 枚举 attr + class，由主题 token 派生 |
| 高亮 | 5 档（黄 / 绿 / 蓝 / 粉 / 灰），低饱和底 + 主题派生色 | 枚举 attr + class |

其余结论：

- 能力为**富文本（`.ainote`）专属**，Markdown 笔记不支持字符级样式（§4.3）。
- `.ainote → .md` 导出必然丢样式，必须新增到转换损失清单并给出 i18n 文案（§4.3）。
- 影响面判定为 `shared`，按 `docs/CODING_STANDARDS.md` §5.2 走全部门禁（§6）。
- 工期约 2.5–4 人日（含单测与 e2e，不含双端真机走查）。

## 1. 现状基线

| 环节 | 现状 | 位置 |
|---|---|---|
| 富文本编辑器 | TipTap 3 + StarterKit + 表格 / 任务列表 / 图片 / 双链 / 标签 / 斜杠命令 | `src/features/richtext/utils/extensions.ts` |
| 存储 | `.ainote` = 单行 TipTap JSON，`onUpdate` 直接 `JSON.stringify` | `src/features/richtext/hooks/useRichTextEditor.ts` |
| 工具栏 | 标题选择器 + 行内（粗/斜/删/码）+ 链接 + 块级 + 插入 + 撤销重做 + 主题 | `src/features/richtext/components/RichTextToolbar.tsx`（114 行） |
| 气泡菜单 | 粗/斜/删/码 + H1–H3 + 引用 + 三种列表 + 链接 | `src/features/richtext/components/RichTextBubbleMenu.tsx`（78 行） |
| 主题 | 8 套阅读主题，语义 token（`--note-ink` / `--note-accent` / `--note-success/warning/danger` …） | `src/styles/markdown-themes.css`、`src/features/note/utils/noteThemes.ts` |
| 排版偏好 | 字号 / 行高 / 阅读宽度 / 字体族均为**视图偏好**，只进 localStorage | `src/stores/typography.store.ts` |
| Markdown 导出 | `editor.storage.markdown.getMarkdown()` | `src/features/richtext/utils/markdownConversion.ts` |
| PDF 导出 | JSON → `getHTML()` → `sanitizeRichTextHtml`（只剥离非法 `href`/`src`） | `src/features/export/utils/richTextHtml.ts` |
| 搜索 / 标题 | Rust 侧遍历 JSON 的 `text` 节点取纯文本与首个标题 | `src-tauri/src/domain/rich_text.rs` |

前三类能力（行内格式、块级结构、主题）都已具备，缺的正是**字符级样式**这一层。

## 2. 关键冲突：样式归属的边界

AINote 现有三类「样式」各有明确归属，字符级样式会引入第四类，必须先划界（建议写入 `docs/EDITOR_EXPERIENCE_PLAN.md` §5.1）：

| 类别 | 归属 | 是否写入文件 | 例子 |
|---|---|---|---|
| 应用主题 | 全局 UI 态（Zustand + localStorage） | 否 | 亮色 / 暗色 / 跟随系统 |
| 阅读主题 + 排版偏好 | 视图偏好（localStorage） | 否（既有取舍：`.md` / `.ainote` 数据保持纯净） | 经典 / 夜航、字号 15、行高 1.7 |
| **字符级样式（本次）** | **文档属性** | **是，写进 `.ainote`** | 这段字是红色、大一号、黄底 |
| 块级结构（已有） | 文档属性 | 是 | 标题级别、列表、表格 |

含意：字符级样式一旦落盘，就与阅读主题产生**叠加关系**——同一段红色文字会出现在 8 套主题下，其中 4 套是暗色主题。这是本需求最大的技术风险来源，也是 §4.2 要求「语义色」而非「绝对色值」的原因。

## 3. 两条实现路线

### A. 官方扩展直用（`@tiptap/extension-text-style` + `@tiptap/extension-highlight`）

`TextStyle` / `Color` / `FontFamily` / `FontSize` 均以**内联 `style` 属性**渲染（已核对 `@tiptap/extension-text-style@3.31.3` 的 `renderHTML`：`{ style: "color: …" }`），`Highlight` 同理。落盘为自由字符串（任意 hex、任意 `font-family`、任意 `px`）。

- 优点：代码最少，官方维护。
- 致命点：与 CSP、暗色主题、粘贴收敛、打印四条约束全部冲突（§4.1–§4.5），且随意值会破坏 token 体系。

### B. 自定义枚举 mark + class + token（推荐）

自写 4 个小 mark（字体 / 字号 / 颜色 / 高亮），每个只接受白名单枚举，`renderHTML` 输出 `class`（如 `rt-color-danger rt-size-lg`），数值全部由 `rich-text.css` 里的 note token 提供。

- 优点：天然规避 §4.1 CSP 与 §4.5 粘贴污染；§4.2 对比度与 §4.4 打印映射只要维护一份 token 表；属性值可枚举校验，脏数据可兜底。
- 代价：新增约 4 个 mark 文件 + 1 份调色板纯函数 + CSS token；不依赖官方扩展（依赖 +0）。

两条路线不是「省事 vs 麻烦」，而是「省下的代码会在四个约束上各还一次债」。评估结论选 **B**；若坚持 A，则必须额外实现「值白名单 + `parseHTML` 白名单校验 + 打印映射表 + 粘贴过滤」，实际工作量反超 B。

## 4. 五个硬约束（含证据）

### 4.1 CSP：内联 `style` 在生产壳里会被拦截（已实测确认，A 路线的致命点）

**实测方法**（可复现）：用 Playwright 的 chromium 与 webkit 两个引擎（分别代表 WebView2 / Android WebView 与 macOS / iOS 的 WKWebView）加载一个页面，用响应头下发 CSP——策略严格照抄 `src-tauri/tauri.conf.json` 的 `app.security.csp`，并在其后追加 `'nonce-abc123'` 以模拟生产壳注入 nonce 的行为——再读取元素的计算样式：

| 被测对象 | dev 策略（无 nonce） | 生产壳策略（追加 nonce 后） |
|---|---|---|
| 内联 `style` 属性（A 路线的做法） | 生效 | **被拦截，颜色回退** |
| `class` + 外链 CSS（B 路线的做法） | 生效 | **生效** |
| 运行时注入 `<style>`（无 nonce） | 生效 | 被拦截 |
| 运行时注入 `<style>`（带 nonce） | 生效 | 生效 |

两个引擎结果完全一致。结论：生产壳把 nonce 追加进 `style-src` 后，`'unsafe-inline'` 对**行内属性**不再生效，A 路线的颜色 / 字号 / 字体在安装包里会整体失效、dev 下却完全正常——正是 `docs/CODING_STANDARDS.md` §4 已经踩过的那类「只在安装包里出现、dev 无法复现」的故障。B 路线输出 `class`，样式来自打包进应用的静态 CSS，不受影响。

残余不确定性只剩一条：「Tauri 是否确实追加 nonce」。该条由 `src/platform/csp-nonce.ts` 的既有修复反证（CodeMirror 曾因同一机制只在安装包里塌陷），建议下次安装包冒烟时顺带确认一次即可。

### 4.2 暗色主题与对比度

`docs/CODING_STANDARDS.md` §3 要求：暗色下正文与辅助文字对比度不低于 4.5:1，且新增面板必须覆盖应用亮色 + 暗色阅读主题等 4 种组合。自由颜色意味着 8 套主题 × 任意色值，无法人工保证；用户在亮色主题里选的深红，切到夜航主题后会变成不可读的暗块。

语义色方案把「颜色」定义为主题 token，每套主题各给一份适配值：对比度只需在 8 套主题 × N 档上验证一次，且**可写成单测断言**。实测还发现一个必须提前处理的问题：**既有语义 token 不能直接当正文字色**——8 套主题 × 5 档共 40 组里有 6 组低于 4.5:1（forest 的强调 / 成功 / 警告、solar 的强调 / 成功 / 警告，最低 3.79 = solar 成功），因为这些 token 是按 UI 强调色（按钮、边框、图标）调的。解法与实测数据见 `docs/RICHTEXT_FORMATTING_PLAN.md` §3.3。

### 4.3 Markdown 导出必然丢样式

两条证据：

1. `tiptap-markdown` 的序列化器对**没有 markdown spec 的 mark 返回 `null`**（`node_modules/tiptap-markdown/dist/tiptap-markdown.es.js:769` 与同名 `serializeMark` 方法），即未知 mark 在导出链路上被**静默丢弃**，不会报错。字符级样式不属于 Markdown 语义，导出 `.md` 后必然消失。
2. 「用内联 HTML 兜底」走不通：`MarkdownPreview` 未启用 `rehype-raw`，而 `react-markdown` 的 `skipHtml` 默认为 `false`（`node_modules/react-markdown/lib/index.js:70`、`:360`），raw HTML 节点会被当作**纯文本渲染**。于是导出的 `<span style="…">红色</span>` 在 Markdown 预览与软渲染编辑器里会显示为一串源码，比丢样式更糟，也与 `docs/EDITOR_EXPERIENCE_PLAN.md` §2.2「原始 HTML 仍默认不解析」的既有取舍直接冲突。

结论：接受丢失，但必须**显式声明**——在 `src/features/richtext/utils/conversionLoss.ts` 新增损失项（如 `inlineStyle`，文案「字体 / 字号 / 颜色 / 高亮样式」）并同步 i18n 与 `ConvertNoteDialog` 测试，避免用户静默丢格式。

### 4.4 PDF / 打印需要独立浅色映射

`richTextJsonToHtml` 的 sanitize 只剥离非法 `href` / `src`，样式属性原样进入打印页（`src/features/export/utils/richTextHtml.ts:33`）。打印为 A4 **浅色**排版，因此暗色主题下选的高亮 / 文字色必须映射到浅色可打印版本。B 路线只需在 `.pdf-export` 作用域内重定义一份调色板 token；A 路线则需在导出时逐节点改写内联样式。

### 4.5 外部粘贴会污染内容格式

`Markdown.configure({ transformPastedText: true })` 已开启（`src/features/richtext/utils/extensions.ts`）。若采用官方 `TextStyle`，其默认 `parseHTML` 命中 `span[style]`，从 Word / Notion / 网页粘贴会**自动带入外部字体、字号与颜色**并落盘，用户随后无从解释为什么这段字变了。B 路线只按自有 `class` 解析，外部样式自然不匹配；建议同时补一条粘贴剥离规则与用例。

## 5. 推荐方案细节（B 路线）

### 5.1 数据形状

```json
{
  "type": "text",
  "text": "重点句",
  "marks": [
    { "type": "colorStyle", "attrs": { "color": "danger" } },
    { "type": "sizeStyle", "attrs": { "size": "lg" } }
  ]
}
```

枚举 attr 而非自由值：非法值在 `parseHTML` / 读取侧一律回退默认（与 `parseRichTextContent`、`typography.store` 的既有兜底风格一致）。

### 5.2 字号用相对倍率

内容里的字号若存绝对 `px`，会覆盖用户在设置 → 排版偏好里调的正文字号，出现「我把字号调到 17，这篇笔记还是这么大」的失控感。建议 4 档存相对倍率（如 `0.875em / 1em / 1.25em / 1.5em`），阅读偏好仍然生效。这一点需产品确认（§10）。

### 5.3 建议的文件清单（含 300 行 / 220 行预算）

```text
src/features/richtext/extensions/formatMarks.ts       # 4 个 mark 定义（<120 行）
src/features/richtext/utils/formatPalette.ts          # 枚举 → class / label 纯函数（<80 行）
src/features/richtext/components/TextStylePicker.tsx  # 字体/字号/颜色/高亮选择器（<160 行）
src/features/richtext/components/ColorSwatch.tsx      # 色板按钮（<80 行）
src/features/richtext/rich-text.css                   # 追加 class → token 映射
src/styles/markdown-themes.css                        # 8 套主题各补一份调色板 token
src/features/export/export.css                        # 打印用浅色调色板覆盖
```

改动既有文件：`extensions.ts`（注册 mark）、`RichTextToolbar.tsx`（插入选择器，仍在 220 行内）、`RichTextBubbleMenu.tsx`、`toolbarCommands.ts`、`conversionLoss.ts`、`src/i18n/messages.ts`（约 12 个新 key）。

### 5.4 交互与跨端

- 工具栏新增 1 个「文本样式」入口（字体 / 字号 / 颜色 / 高亮同面板），避免再塞 4 个常驻按钮；`overflow-x-auto` 已是既有容器，沙盒宽度有限。
- 气泡菜单只放**高亮**与**颜色**两个高频动作，保持选区浮层在移动端不超宽（沿用 H4–H6 不上气泡菜单的既有取舍）。
- 移动端：触控目标 ≥36px（`docs/MOBILE_PLAN.md`、`docs/CODING_STANDARDS.md` §5.3），选择器面板需支持无 hover 与软键盘收起后的重定位；沿用 `ToolbarPopover` 的 portal 方案。
- 字体族只给「无衬线 / 衬线 / 等宽」三档 → **无平台分支**，不需要新增 `src/platform/` 能力。若后续要放开到具体字体名（楷体 / 苹方 / 思源），必须先按 §5.1 的跨端规范收敛到 `src/platform/`，并评估 WebFont 打包体积（首屏体积已是明确约束，见 `docs/ARCHITECTURE.md` §233）。

## 6. 影响面与文档义务

| 项 | 判定 |
|---|---|
| 影响面 | `shared`（富文本编辑器与工具栏在桌面 / 移动共用；经 `NoteEditorSupport.tsx` 路由） |
| Rust | 零改动。`rich_text.rs::collect_text` 按 `type == "text"` 取文本、`first_heading` 读 `attrs.level`，text 节点新增 `marks` 不影响二者 |
| 新依赖 | 无（B 路线）；A 路线需 +`@tiptap/extension-text-style`、`@tiptap/extension-highlight`（项目当前 `^3.30.6`，最新 3.31.3） |
| 需同步文档 | `docs/PRD.md`（P1-11 范围扩展为「字符级样式」并声明边界）、`docs/EDITOR_EXPERIENCE_PLAN.md` §5.1（文档属性 vs 视图属性）、`docs/ARCHITECTURE.md`（若走 A 路线需记录新依赖） |
| Git 影响 | `.ainote` 为单行 JSON，样式变更与文本变更混在同一行——本就非行式 diff，不新增问题，但版本历史里会看到整行变更 |
| 搜索 | 无功能影响（索引走 `plain_text`），但属性值不进索引，用户搜不到「红色」 |

验证门禁（`shared`）：`pnpm build && pnpm test && pnpm lint && pnpm test:e2e`，另需桌面冒烟 + Android release 构建检查；提交说明写明 `Desktop Impact` / `Mobile Impact`。

## 7. 测试义务

按 `docs/CODING_STANDARDS.md` §5，必须同时交付：

1. `formatPalette` 纯函数单测：枚举 → class 映射、非法 attr 回退、调色板 token 与 8 套主题的覆盖率断言（缺 token 即失败）。
2. mark 单测：`renderHTML` 输出 class 而非 `style`（防止回归到 CSP 高危写法）、`parseHTML` 对非法 class 不产生 attr。
3. `toolbarCommands` 单测：四个动作的 `isActive`（光标落在带样式文本上时正确高亮）与 `run`。
4. `markdownConversion` 单测：断言带字符样式的文档导出 Markdown 后**样式被丢弃且不残留 HTML**（把 §4.3 的结论固化为回归护栏）。
5. `conversionLoss` + i18n 单测：新增损失项被正确识别与展示。
6. e2e（`e2e/richtext-flow.spec.ts` 扩展）：选中文字 → 设高亮 → 断言落盘 JSON 含 `marks`；桌面与移动视口各跑一遍。

## 8. 工程量估算

| 工作项 | 估算 |
|---|---|
| mark + 调色板 + CSS token（8 套主题 + 打印） | 0.5–1 人日 |
| 工具栏 / 气泡菜单选择器与交互（含移动端尺寸） | 0.5–1 人日 |
| 转换损失、i18n、导出映射 | 0.5 人日 |
| 单测 + e2e + 跨端走查与门禁 | 1–1.5 人日 |
| 合计 | **2.5–4 人日** |

## 9. 明确不做

- 任意 hex 颜色、任意 `px` 字号、任意 `font-family` 名（§4.1–§4.5 四处失守）。
- Markdown 笔记的字符级样式（会污染 `.md` 源码与可移植性，与「Git 即数据库」定位冲突）。
- 段落级 / 块级样式（背景块、行高、对齐、缩进）——属于排版层，且与阅读偏好正面冲突，需单独评估。
- 笔记自带主题 / 自定义 CSS（`docs/PRD.md` P2-3 范畴，不在本需求内）。
- 样式持久化模板（把一段样式存成可复用预设）；「格式刷」已于 2026-09-26 交付，见 `docs/RICHTEXT_FORMATTING_PLAN.md` §3.5。

## 10. 待产品决策

1. 颜色是有限档位，还是追加「自定义色 + 每主题自动生成暗色变体」？后者需给出对比度算法与验证方式。（**已决策：5 档，见 `docs/RICHTEXT_FORMATTING_PLAN.md` §10**）
2. 字号是否允许改变段落默认大小（影响阅读偏好的一致性），还是仅相对倍率？（**已决策：仅相对倍率**）
3. Markdown 笔记遇到带样式的 `.md`（例如他人导出的内联 HTML）时：按现状显示为源码文本，还是新增只读净化渲染？（后者是安全面更大的独立需求，需先更新 PRD 与 sanitize 方案。）
4. 是否接受「导出 Markdown 丢样式」作为长期取舍（**已决策：接受，四项均以转换损失提示显式告知**。原计划让高亮经 `==…==` 双向互通，2026-09-24 复核后**暂缓**——`==` 与程序员笔记日常写法歧义面大、预览侧需新建排除机制、路线图 M2 交付范围不含此项；重启条件见 `docs/RICHTEXT_FORMATTING_PLAN.md` §4.1）。
