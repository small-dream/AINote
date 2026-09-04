# AINote — 编码规范与防腐化指南 (CODING_STANDARDS)

> 版本：v0.1 · 状态：已确认 · 维护：Tech Lead
> 本文档为活文档，是所有代码（人类或 AI 编写）的强制约束。能机器强制的规则一律进 ESLint / Clippy，不靠自觉。

## 0. 硬指标（机器强制）

| 指标 | 上限 | 强制方式 |
|---|---|---|
| 单文件行数 | ≤ 300 行（组件 ≤ 220 行） | ESLint `max-lines` |
| 单函数行数 | ≤ 60 行 | ESLint `max-lines-per-function` |
| 圈复杂度 | ≤ 12 | ESLint `complexity` / Clippy `cognitive_complexity` |
| TypeScript | `strict: true`，禁 `any` | `tsconfig` + `@typescript-eslint/no-explicit-any` |
| 分支结构 | > 3 分支的 if-else/switch 必须重构 | Review + `complexity` 规则 |

> Rust 文件同样遵守 300 行上限；`commands/` 单文件预期 < 80 行。

## 1. 文件与函数拆分指南

### React 组件三段式拆分（超 220 行组件的固定手术刀法）

1. **View Component**：只接 props、只渲染。除数据订阅 Hook 外无逻辑。
2. **Custom Hook**（`features/x/hooks/useXxx.ts`）：状态、副作用、API 调用全部上移。
3. **Pure Utils**（`features/x/utils/` 或 `lib/`）：数据转换、格式化抽成纯函数——纯函数最易测试、AI 最不易写错。

```text
NoteEditor.tsx (渲染, <220行)
  └─ useNoteEditor.ts (状态/防抖/保存编排, <120行)
       └─ utils/markdown.ts (纯函数: 提取标题/wiki-link 解析等)
```

### 「新增优于修改」原则

- 新功能 = `features/` 下新目录 + `commands/` 下新文件。
- 任何改动若以修改既有文件为主、新增文件为辅，必须在提交说明中解释理由。
- 超过 3 个分支的分支逻辑，重构为策略表 `Record<Type, Handler>`（TS）或 `match` + 独立函数（Rust）。

## 2. 状态管理与数据流规范

| 状态类别 | 归属 | 例子 | 铁律 |
|---|---|---|---|
| 服务端/Git 状态 | TanStack Query (`queries/`) | 笔记列表、仓库状态、提交历史 | 唯一权威来源，禁止 `useState` 镜像 |
| 全局 UI 状态 | Zustand (`stores/`) | 当前笔记 ID、侧栏折叠、主题 | 只放跨页面共享的 UI 态 |
| 局部状态 | 组件内 `useState` | 输入草稿、弹窗开关 | 默认选项，能局部不全局 |
| 编辑器瞬态 | CodeMirror 内部态 | 光标、选区 | 绝不入 React 状态，用 ref 桥接 |

数据流单向：`IPC → Query 缓存 → Hook → View`。
写操作走 `mutation → invalidate → 自动重取`；禁止手写「更新后手动同步多份状态」。

## 3. 异常处理与边界防御

### 统一错误结构（`src-tauri/src/domain/error.rs`）

```text
AppError { code: "SYNC_4013", kind: Conflict, message: "...", retriable: true }
错误码规范: <域>_<序号>  →  NOTE_1xxx, AUTH_2xxx, REPO_3xxx, SYNC_4xxx, GIT_4xxx, IO_5xxx, AI_6xxx
```

### 边界拦截点只有两处

1. **Rust 侧**：所有 Command 返回 `Result<T, AppError>`。Repository 边界用 `thiserror` 把 `git2::Error` / IO 错误转换为领域错误，**原始错误绝不泄漏到前端**。
2. **前端侧**：`api/client.ts` 统一反序列化 `AppError`；Query/mutation 的 `onError` 全局兜底 → Toast + 结构化日志。组件内只处理需要 UI 特化响应的错误（如冲突弹窗）。

### 输入防御

- IPC 入参 Rust 侧 `serde` 反序列化 + 显式校验（路径合法性、长度上限）。
- 前端用户输入在 Hook 层校验。
- Markdown 渲染强制 sanitize（防 XSS），不信任编辑器产出的任何内容。

## 4. 测试友好性

- **依赖注入**：Rust Service 依赖 `trait GitBackend`，测试注入 Mock；前端 Hook 依赖 `api/` 接口，测试用 `vi.mock('@/api')` 替换。
- **纯函数优先**：`lib/`、`utils/`、`domain/` 下的函数必须无副作用、无 IO，单测覆盖率 ≥ 90%。
- **AI 强制测试义务**：实现核心业务逻辑（Service 用例、纯函数 utils、数据转换）时必须同时交付对应单元测试；UI 组件只要求关键交互集成测试，不追求快照覆盖。
- **测试金字塔**：纯函数单测（多）→ Hook/Service 逻辑测试（中）→ 页面级冒烟（少）。

## 5. Git 提交规范

- Commit message：`type(scope): summary`，type ∈ `feat | fix | refactor | test | docs | chore`。
- 应用内自动生成的笔记提交：`note: <action> <path>`。
- 禁止提交：密钥/Token、构建产物、`node_modules/`、本地仓库数据目录。

## 6. 文档同步义务

修改了以下任一内容，必须同 PR 更新对应文档：

- 需求/业务规则 → `docs/PRD.md`
- 选型/分层/目录结构/依赖方向 → `docs/ARCHITECTURE.md`
- 编码规则/指标阈值 → `docs/CODING_STANDARDS.md`（即本文档）
