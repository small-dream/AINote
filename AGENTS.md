# AGENTS.md — MyNote 项目协作指南

> 本文件是所有 AI Agent / 开发者在本仓库工作的**首要约束**。
> 详细规范见 `docs/` 三份活文档，冲突时以更具体的文档为准。

## 项目概述

MyNote 是「Git 即数据库」的跨平台 Markdown 笔记软件：笔记 = Git 仓库内的 `.md` 文件，同步走 Git 协议，远端托管在 GitHub。

- 前端：React 19 + TypeScript (strict) + Vite 8 + Tailwind CSS 4
- 后端/原生层：Rust + Tauri 2（Git 操作走 `git2`，凭证存系统钥匙串）
- 包管理器：**pnpm**（禁止混用 npm/yarn），依赖一律使用最新稳定版

## 必读的活文档（先读文档再动手）

| 文档 | 内容 |
|---|---|
| `docs/PRD.md` | 需求、User Story 优先级（P0/P1/P2）、业务规则 |
| `docs/ARCHITECTURE.md` | 技术选型、分层架构、目录结构、依赖方向 |
| `docs/CODING_STANDARDS.md` | 编码硬指标、状态管理、错误处理、测试义务 |

修改需求/架构/规范时，必须同 PR 更新对应文档。

## 常用命令

```bash
pnpm desktop:run      # 开发模式运行桌面应用（tauri dev）
pnpm desktop:build    # 编译 Release 可执行文件（不打安装包，快速验证）
pnpm desktop:bundle   # 编译并产出平台安装包
pnpm build            # 前端构建（tsc --noEmit + vite build）
pnpm test             # 前端单测（vitest run）
pnpm lint             # 静态检查（eslint）
cargo test            # Rust 单测（在 src-tauri/ 下执行）
```

**完成任何代码改动后，必须通过**：`pnpm build && pnpm test && pnpm lint` 和 `cargo test`（改了 Rust 时）。

## 架构铁律（违反 = 返工）

### 分层与依赖方向（单向）

```text
View → Hooks/Queries → api/ → IPC → commands → services → repositories → domain
```

- 前端组件**禁止**直接 `invoke()`，唯一跨边界点是 `src/api/`（ESLint 已强制）。
- `components/`（通用组件）不得 import `features/`。
- Rust `domain/` 零外部依赖；Service 只依赖 `GitBackend` trait，不依赖 `git2` 具体类型。

### 防腐化硬指标（ESLint/Review 强制）

- 单文件 ≤ 200 行（React 组件 ≤ 150 行），单函数 ≤ 40 行，圈复杂度 ≤ 8。
- 禁 `any`，TS `strict` 全开。
- **新增优于修改**：新功能 = `src/features/` 新目录 + `src-tauri/src/commands/` 新文件。
- 组件超限时按三段式拆分：View Component + Custom Hook + Pure Utils（见 CODING_STANDARDS §1）。

### 状态管理边界

- 服务端/Git 状态 → TanStack Query（唯一权威来源，禁止 `useState` 镜像）
- 全局 UI 态 → Zustand；局部态 → `useState`；编辑器瞬态 → CodeMirror 内部态

### 错误处理

- Rust Command 一律返回 `Result<T, AppErrorDto>`；原始 `git2::Error`/IO 错误在 Repository 边界转换，**不泄漏到前端**。
- 错误码规范：`<域>_<序号>`（NOTE_1xxx / AUTH_2xxx / REPO_3xxx / SYNC_4xxx / IO_5xxx），定义在 `domain/error.rs`。
- 前端只在 `api/client.ts` 统一反序列化错误；组件只处理需要 UI 特化响应的错误。

## 测试义务

- 核心业务逻辑（Service 用例、纯函数 utils、数据转换）**必须同时交付单元测试**。
- `lib/`、`utils/`、`domain/` 纯函数覆盖率 ≥ 90%。
- 前端测试用 `vi.mock('@/api')` 隔离 IPC；Rust 测试注入 Mock `GitBackend`。

## 安全红线

- GitHub Token 只存系统钥匙串（`keyring`），前端永远拿不到明文，绝不落盘、绝不提交。
- Markdown 渲染必须 sanitize（防 XSS）。
- 禁止提交：密钥、构建产物、`node_modules/`、本地笔记仓库数据目录（`local-repos/`）。

## Git 提交规范

- 代码提交：`type(scope): summary`，type ∈ `feat | fix | refactor | test | docs | chore`。
- 应用内自动生成的笔记提交：`note: <action> <path>`。
