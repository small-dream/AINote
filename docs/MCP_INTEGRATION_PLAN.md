# AINote MCP 集成方案（外部 AI Agent 操作笔记）

> 版本：v0.1 · 状态：已实现（未发布）· 维护：MCP 集成
> 本文是 AINote 作为 **MCP 服务端** 的设计与验收记录；内置 AI 问答仍按 `docs/AI_PRODUCT_DESIGN.md` 运行，不改造为 MCP 客户端。

## 1. 目标与范围

- 让 Claude Desktop、Cursor、Claude Code 等支持 MCP 的 Agent 通过标准协议读取、新建、写入和修改当前活动仓库的 Markdown 笔记。
- 服务只在本机回环地址监听，必须携带 Bearer Token；默认关闭，由用户在「设置 → MCP 集成」显式启用。
- 写入立即落盘，不自动创建 Git 提交；版本化仍由用户手动提交或一键同步兜底。
- 仅桌面端提供入站服务；Android / iOS 不监听、不展示入口，共享代码保持可编译。

**明确不做**：MCP 客户端、stdio 传输、删除/移动/重命名笔记、富文本 `.ainote` 写入、附件导入、Git 提交工具、资源订阅、OAuth、远程网络访问。

## 2. 协议支持

端点：`POST http://127.0.0.1:<port>/mcp`，默认端口 `39471`，只返回单个 JSON 响应（不返回 SSE 流）。

| 代际 | 版本 | 行为 |
|---|---|---|
| Modern | `2026-07-28` | 无 `initialize`；每个请求在 `params._meta` 携带 `io.modelcontextprotocol/protocolVersion` 与 `clientCapabilities`；支持 `server/discover`；结果带 `resultType: "complete"` 与 `_meta.serverInfo` |
| Legacy | `2025-11-25` / `2025-06-18` / `2025-03-26` | 支持 `initialize` / `notifications/initialized` / `ping`；不签发、不校验 `Mcp-Session-Id` |

- 只声明 `tools` 能力；不实现 resources/prompts/subscriptions/sampling/elicitation。
- `server/discover` 返回 `supportedVersions`、`capabilities.tools`、`serverInfo`、`instructions`、`ttlMs`、`cacheScope: private`。
- 通知返回 `202`；`GET`/`DELETE` 返回 `405`；未知路径 `404`。
- 版本不支持返回 `400` + `-32022`（`data.supported` / `data.requested`）；`MCP-Protocol-Version` 与 body 不一致返回 `400` + `-32020`。
- 为兼容早期客户端，`Mcp-Method` / `Mcp-Name` 存在时校验一致性，不强制要求发送。

参考：[MCP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)、[Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)、[Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)、[Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)。

## 3. 安全模型

- 绑定 `127.0.0.1`，绝不监听 `0.0.0.0`；端口限制 `1024..=65535`。
- Token：32 字节随机数 Base64URL，前缀 `ainote_mcp_`，存 `SecureStore`（桌面 AES-256-GCM 文件，0600）；`ainote.json` 只存开关与端口。
- 每个请求校验 `Authorization: Bearer <token>`；常量时间比较；缺失/错误返回 `401`。
- `Origin` 存在且不是本机同端口地址 → `403`；`Host` 必须是回环地址 → 防 DNS rebinding。
- body 上限 `2 MB`；非 JSON Content-Type → `415`；非法 UTF-8/JSON → `400`；不支持批量 JSON-RPC。
- 请求串行处理；单请求 panic 被 `catch_unwind` 捕获并返回 `-32603`，服务线程不退出。
- 日志只记录方法、工具名、耗时、错误码；Token、笔记正文、绝对路径不落日志。

## 4. 工具契约

| 工具 | 读写 | 关键参数 | 说明 |
|---|---|---|---|
| `list_notes` | 读 | `directory?`、`limit?`、`offset?` | 列出活动仓库笔记元数据，支持目录前缀与分页 |
| `read_note` | 读 | `path` | 返回全文、`revision`、标题、类型、更新时间、加密/锁定状态 |
| `search_notes` | 读 | `query`、`limit?` | 复用全文搜索，返回路径/标题/片段/行号 |
| `create_note` | 写 | `path?`、`title?`、`content?`、`directory?` | 显式路径已存在则失败；无路径时由标题生成唯一文件名 |
| `update_note` | 写 | `path`、`content`、`expectedRevision?` | 整篇覆盖已有 `.md` |
| `append_note` | 写 | `path`、`content`、`expectedRevision?` | 需要时补换行后追加到文末 |
| `patch_note` | 写 | `path`、`oldText`、`newText`、`expectedRevision?`、`replaceAll?` | 精确片段替换；0 处匹配 / 多处歧义返回错误 |

- 写工具只接受 `.md`；路径经 `validate_rel_path` 与符号链接防御；拒绝绝对路径、`..`、隐藏段。
- 正文上限 1 MB；路径 ≤ 512 字符；`oldText` ≤ 100 KB。
- `revision = sha256(明文正文)`；`expectedRevision` 不匹配返回 `MCP_REVISION_CONFLICT`，不覆盖。
- 工具错误以 `isError: true` + `CODE: message` 返回；协议错误用 JSON-RPC error。

## 5. 数据完整性与 UI 协同

- 写工具执行前检查 `DraftState`：编辑器有未落盘草稿 → `MCP_EDITOR_DIRTY`，提示用户先保存。
- 写工具获取 `RepoWriteLock`，与同步/提交/拉取互斥；占用中 → `MCP_WRITE_BUSY`。
- 创建使用 `create_new` 独占写入，已存在映射为 `MCP_NOTE_EXISTS`，不静默覆盖。
- 加密笔记锁定态 → `MCP_VAULT_LOCKED`；解锁后经现有 `note_content` 写回仍为密文。
- 写入成功后广播 `mcp:notes-changed`；前端合并 300ms 内的多次写入，失效工作区查询并在无脏草稿时请求编辑器重载。
- 不自动提交 Git；文件进入现有自动保存与同步前兜底提交链路。

## 6. 生命周期

- 启动时若 `ainote.json` 中 `mcp.enabled=true`，自动恢复监听；失败只记录 `lastError`，不阻断应用启动。
- 首次启用生成 Token，并在本次返回值中一次性下发 `issuedToken` + 客户端配置 JSON；关闭后前端不再持有明文。
- 再次启用沿用 SecureStore 中 Token；Token 丢失/损坏时重新生成。
- 轮换 Token 无需重启，运行中的请求读取共享 `RwLock<String>`，旧 Token 立即失效。
- 停用只停止监听，不删除 Token；退出应用时显式关闭服务线程。

客户端配置示例（Token 由设置页在生成/轮换时一次性给出）：

```json
{
  "mcpServers": {
    "ainote": {
      "url": "http://127.0.0.1:39471/mcp",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    }
  }
}
```

Cursor 使用 `url` + `headers` 即可；若某个客户端要求显式传输类型，可在条目中补 `"type": "http"`。

### 6.1 一键写入客户端配置

设置页提供「一键写入客户端」，由 Rust 直接读取 SecureStore 中的 Token 并写入本机客户端配置；前端不接触 Token 明文，也不需要用户手工复制。

| 客户端 | 配置位置 | 容器键 / 条目 |
|---|---|---|
| Claude Code | `~/.claude.json` | `mcpServers.ainote`：`{type:"http", url, headers}` |
| Claude Desktop | Windows `%APPDATA%\Claude\claude_desktop_config.json`；macOS `~/Library/Application Support/Claude/...`；Linux `$XDG_CONFIG_HOME/Claude/...` | `mcpServers.ainote`：`{url, headers}` |
| Cursor | `~/.cursor/mcp.json` | `mcpServers.ainote`：`{url, headers}` |
| VS Code | `Code/User/mcp.json`（用户配置） | `servers.ainote`：`{type:"http", url, headers}` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json`，回退 `~/.codeium/mcp_config.json` | `mcpServers.ainote`：`{serverUrl, headers}` |
| Cline | `~/.cline/data/settings/cline_mcp_settings.json` 或 VS Code / Cursor 的 `globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` | `mcpServers.ainote`：`{type:"streamableHttp", url, headers, disabled:false, autoApprove:[]}` |

写入规则：

- 只替换 `ainote` 一个条目，保留同一文件中的其他服务器与顶层字段。
- 先读取并解析；文件不是合法 JSON 时**不覆盖**，在设置页显示具体原因。
- 采用临时文件 + rename 原子写；Unix 下保留原文件权限。
- 轮换 Token 或修改端口后，自动更新所有已配置客户端；失败项在设置页提示，不阻断轮换本身。
- 客户端配置文件会包含 Token 明文，设置页明确提示「仅本人可读」；写入后需重启对应客户端。
- 移动端不提供该能力。

## 7. 验收

1. 启用后外部客户端可完成 `tools/list` 与 7 个工具调用；创建/修改后 AINote 列表、目录树与编辑器刷新。
2. 旧 revision 写入返回冲突且原文不变；编辑器有草稿时写入被拒绝。
3. 加密笔记锁定态拒绝、解锁后可读写且磁盘仍为密文。
4. 轮换 Token 后旧 Token 401；错误 Origin 403；未带 Token 401。
5. 端口占用返回可读错误；重启应用后自动恢复；停用后连接被拒绝。
6. 一键写入后对应客户端能在重启后看到 `ainote` 工具；文件中原有其他服务器条目保持不变。
7. 客户端配置为非法 JSON 时写入被拒绝且原文件不变；轮换 Token / 改端口后已写入客户端自动更新。
8. 日志/诊断包无 Token、正文与绝对路径。
9. 门禁：`pnpm build && pnpm test && pnpm lint` 与 `cargo test` 全绿。

## 8. 影响面

- **Desktop Impact**：设置页新增「MCP 集成」；新增本地 HTTP 监听、Token 安全存储、写锁/草稿守卫复用、UI 变更事件。
- **Mobile Impact**：无入站服务与设置入口；共享类型/i18n/API 客户端可编译，Rust 侧为 stub。
- **范围外**：不做 MCP 客户端、stdio、删除/移动、富文本写入、自动提交。
