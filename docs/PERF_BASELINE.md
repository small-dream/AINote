# 性能基准（M1-E4-T3）

> 手动运行、只记录数字，不把机器差异写死进 CI 阻断。用于回答两个问题：
> ① 当前版本是否满足大仓库可用性阈值；② 本次改动是否让关键链路明显变慢。

## 如何运行

```bash
pnpm perf:baseline
```

- Rust 部分：`cargo test perf_baseline -- --ignored --nocapture`（debug 构建，用于同机对比）。
- 前端部分：`vitest run --mode perf src/features/note/softRender/perf.test.ts`（输出 5000 行解析与软渲染计划耗时）。
- 需要绝对性能数字时用 release 构建：`cargo test --release perf_baseline -- --ignored --nocapture`。

## 基准环境（2026-09-10）

| 项目 | 值 |
|---|---|
| 设备 | Apple M4 Pro |
| 内存 | 24 GB |
| 系统 | macOS 26.6.2 (25G83) |
| Rust | 1.96.0 |
| Node.js | v26.7.0 |
| pnpm | 10.33.0 |
| 构建 | debug（`cargo test` 默认） |

## 基线结果

### Rust

| 基准 | 场景 | 耗时 | 阈值 | 结论 |
|---|---|---|---|---|
| `search_1000` | 1000 篇笔记全文搜索 | 33.3 ms | < 100 ms | ✅ |
| `first_wiki_index_1000` | 1000 篇首次构建 Wiki 索引 | 38.0 ms | < 100 ms | ✅ |
| `tree_1000_notes` | 1000 篇目录树构建 | 5.3 ms | < 100 ms | ✅ |
| `write_read_5000_lines` | 5000 行笔记写入 + 读取 | 0.4 ms | < 200 ms | ✅ |
| `batch_import_1000` | 批量导入 1000 篇 | 156.2 ms | < 1000 ms | ✅ |
| `asset_import_20mb` | 导入 20 MB 附件 | 3.9 ms | < 500 ms | ✅ |
| `sync_status_300_commits` | 300 提交仓库同步状态查询 | 11.4 ms | < 200 ms | ✅ |

### 前端

| 基准 | 场景 | 耗时 | 阈值 | 结论 |
|---|---|---|---|---|
| `softrender_parse_5000_lines` | 5000 行 Markdown → Lezer 语法树 | 16.0 ms | < 100 ms | ✅ |
| `softrender_plan_5000_lines` | 5000 行 → 软渲染计划（marks/hides/widgets） | 9.4 ms | < 100 ms | ✅ |

### 手动验收项

| 项目 | 场景 | 阈值 | 测量方式 |
|---|---|---|---|
| 冷启动到可编辑 | 已克隆仓库，二次启动 | < 2 s | 手动：`pnpm desktop:run` 或安装包启动，秒表 / 录屏逐帧 |
| 1000 篇目录交互 | 展开、滚动、切换笔记 | < 100 ms 感知延迟 | 手动：真实仓库操作，主观 + DevTools Performance |

## 回归判断

1. **先看阈值**：任一硬阈值超标即视为回归，需定位到具体基准。
2. **再看同机对比**：与上表同机重跑，耗时回退 > 20% 记为可疑，连续 3 次取中位数确认。
3. **区分构建模式**：上表为 debug；release 数字通常更低，禁止跨模式比较。
4. **记录归档**：每次重要改动后在本文件追加一行「日期 / 版本 / 关键数字」，不做 CI 阻断。

## 已知限制

- debug 构建包含未优化代码与调试符号，绝对值仅用于同机回归，不作为发布验收。
- 冷启动与目录交互依赖真实仓库与人工操作，未纳入自动化基准。
- 基准在空载机器上运行；后台负载会显著影响数字，重跑前请先静默机器。

## 记录

| 日期 | 版本 | 关键数字 | 备注 |
|---|---|---|---|
| 2026-09-10 | v0.24.12+ | search_1000 33.3 ms · tree_1000 5.3 ms · asset_20mb 3.9 ms · sync_status 11.4 ms · softrender 16.0+9.4 ms | 首次建立基线（M1-E4-T3） |
