# AINote — 加密笔记方案（威胁模型与实施计划）

> 版本：v0.1 · 状态：待评审 · 维护：架构师
> 关联：`docs/PRD.md` §2（P2-4）、`docs/ROADMAP.md` §M5、`docs/ARCHITECTURE.md` §5、`docs/CODING_STANDARDS.md` §5.1/§5.2

## 0. 范围决策（已确认）

| # | 决策 | 含义 |
|---|---|---|
| ① | 防线只针对**远端仓库** | GitHub 网页、第三方 Git 客户端、拿到仓库的协作者/泄露的仓库都读不到正文。本机不作为防护目标、不做额外承诺（桌面端密钥不落盘是决策 ⑤ 的附带收益，不算需求） |
| ② | **只加密正文** | 文件名、目录结构、提交时间、作者、文件数量保持明文 |
| ③ | **加密笔记不提供 AI 能力** | 加密笔记不参与 AI 写作、问答与全库检索上下文 |
| ④ | **加密笔记不提供版本历史** | Diff 与「恢复此版本」都不提供：笔记级版本历史面板对加密笔记整体关闭，Repo Git Graph 中选中加密笔记文件时也不展示内容对比与回滚。因此 Rust 侧完全不实现「解密历史 blob」的链路 |
| ⑤ | **桌面端不提供「记住口令」** | VaultKey 只活在进程内存里，应用退出/重启后必须重新输入口令，不写入系统钥匙串、不落盘 |
| ⑥ | **不做恢复码** | 口令是唯一凭证，遗忘即数据永久不可恢复；配套做建库时的强度校验与不可逆确认 |

术语更正：本方案是**远端静态加密 + 客户端解密**，不是严格意义的端到端加密（没有第二个参与方）。PRD P2-4 的措辞应同步调整为「加密笔记」。

## 1. 需求与验收标准

一句话需求：仓库里的加密笔记正文在 Git 远端不可读，只有在 AINote 客户端输入口令解锁后才能查看与编辑。

- 加密后 `cat` / `git show` / GitHub 网页 / 第三方 Git 客户端均只能看到信封文本。
- 解锁后，编辑、搜索、双链、导出 PDF 与未加密笔记行为一致；版本历史（Diff / 恢复此版本）按决策 ④ 对加密笔记整体不提供。
- 加密笔记的版本历史入口不可用：命令层直接拒绝，不返回密文内容、也不返回可点击的回滚按钮。
- 明确接受的产品取舍：加密笔记放弃「Git 版本回溯」这条核心能力（回滚需在外部 Git 客户端对密文操作，本应用不提供）。
- 锁定态下任何命令都读不到明文（一律返回 `VAULT_9001`），不接受「先返回密文由前端判断」。
- 加密笔记的 AI 入口全部不可用，Rust 侧二次拦截。
- 明文与加密笔记可以共存于同一仓库（混合仓库是默认形态）。
- 桌面端进程退出后密钥即失效：重启应用必须先输入口令，且没有任何绕过途径。

## 2. 威胁模型

**受保护**

| 资产 | 防护对象 |
|---|---|
| 笔记正文 | 远端仓库（含网页浏览、`git clone` 后的第三方客户端）、协作者、仓库泄露 |

**明确不保护**

| 资产 | 原因 |
|---|---|
| 本机文件系统 | 笔记文件本身是密文，且桌面端 VaultKey 不落盘（决策 ⑤）：**能读配置目录的本地进程拿不到 VaultKey**，这是相对既有凭证存储（`ARCHITECTURE.md` §5：Token 与密钥同目录）更高的一档；解锁期间的内存明文仍不在防护范围内 |
| 文件名 / 目录 / 提交元数据 | 决策 ②；想彻底隐藏需引入加密索引层，代价约为当前方案 3 倍 |
| 附件（`assets/`） | 本次范围外；引用明文的加密笔记存在内容泄漏风险，需在文档与 UI 明示 |
| `.ainote/todos.json` / `favorites.json` | 本次范围外 |

**不承诺**

- 不溯及历史：启用加密前已提交的明文会永久留在 Git 对象与远端缓存（含 fork / PR 引用）中。建库或启用引导必须写明：**要彻底干净只能用新仓库**。
- 不做 Git 历史重写，不做团队共享密钥分发。
- 口令遗忘即不可恢复，且没有恢复码（决策 ⑥）——建库引导必须让用户明确知晓。

## 3. 数据格式

### 3.1 仓库密钥文件 `.ainote/vault.json`

```json
{
  "schemaVersion": 1,
  "kdf": { "alg": "argon2id", "salt": "<base64 16B>", "mKiB": 65536, "iterations": 3, "parallelism": 1 },
  "wrap": { "alg": "aes-256-gcm", "nonce": "<base64 12B>", "ciphertext": "<base64 48B>" }
}
```

- 该文件随 Git 同步、**可以公开**：机密性完全取决于口令强度。
- 主密钥 VaultKey（32B，CSPRNG 生成）只用于笔记正文加密；改口令只重新封装 `wrap` 字段，**不改写任何笔记文件**。

### 3.2 笔记信封（加密后文件的实际内容）

```text
AINOTE-ENC-v1
<base64(AES-256-SIV 密文)，76 列折行>
```

- 算法：**AES-256-SIV（RFC 5297，RustCrypto `aes-siv`）确定性加密**。
  - 理由：相同明文产出相同密文，Git blob 不变 → 保留 delta 压缩，diff 仍有「行级变化」。若用 GCM + 随机 nonce，每次编辑整文件字节全变，仓库体积与 diff 体验双输。
  - 代价（须写入文档）：泄露「两份内容相同」「内容未变」这一事实；本场景无频率分析面，接受。
  - AD（associated data）固定为 `ainote.note.v1`，**不绑定路径** → 移动/重命名无需重新加密。
- 首行即 magic，`is_envelope()` 只需读首行判断。
- **扩展名与 `NoteKind` 保持不变**（`.md` / `.ainote`），文件树、收藏、wiki 的路径逻辑零改动。
- 富文本笔记的 TipTap JSON 按整文件加密，规则与 Markdown 完全一致。

## 4. 会话与密钥生命周期

### 4.1 解锁

口令 → Argon2id → KEK → 解封 VaultKey → 存入 Rust 侧 `VaultSession`（`Zeroizing<[u8;32]>`，进程内存，Mutex 保护）。前端只拿得到 `locked / unlocked` 状态，**永远拿不到密钥或明文口令**（AGENTS.md 安全红线）。

### 4.2 锁定

锁定 = 清空 `VaultSession`。桌面端锁定时机：**启动即锁定**（必须先解锁才能看加密笔记）、手动锁定、可选空闲自动锁定、可选窗口隐藏到托盘时锁定。

由于桌面端不保存密钥（决策 ⑤），空闲自动锁定**默认关闭**——否则用户每隔几分钟就要重新输入口令。空闲时长若开启，默认 30 分钟起，最短不得低于 10 分钟。

### 4.3 口令是唯一凭证（决策 ⑤ + ⑥）

- **桌面端不提供「记住口令」**：不写系统钥匙串、不落盘；`VaultKey` 只在 `VaultSession` 内存中存活，应用退出、重启、崩溃后一律失效。
- **移动端沿用系统钥匙串**（iOS Keychain / Android Keystore）：软键盘输入长口令的体验代价过高，且沙盒外的进程本就无法读取应用私有存储；平台边界收敛在 `platform/` 与 `keyring` 插件既有接缝上。
- **不做恢复码**：口令遗忘 = 数据永久不可恢复，没有后门、没有客服重置。

由此产生的必做配套：

1. **口令强度校验**：`.ainote/vault.json` 可公开，安全性完全取决于口令强度，必须挡住离线暴力破解。规则：≥ 12 字符、拒绝与邮箱/用户名/仓库名高度相同的口令、建库时给出强度提示；这是唯一的防线，不做「弱口令但允许」的降级。
2. **建库确认**：改口令入口（`change_passphrase`）保留，且必须用旧口令验证；建库对话框需二次输入口令，并强制勾选「我已了解：忘记口令后任何人都无法恢复这些笔记」。

## 5. 改造清单

### 5.1 新增（Rust，遵循「新增优于修改」）

| 文件 | 职责 |
|---|---|
| `domain/vault.rs` | 信封常量与纯函数（`is_envelope` / `encode_envelope` / `decode_envelope`）、`VaultFile` DTO、`VaultStatus`、错误码 `VAULT_9xxx` |
| `repositories/vault_files.rs` | `.ainote/vault.json` 原子读写（比照 `task_files.rs` 的 schemaVersion + 原子写模式） |
| `services/vault_crypto.rs` | Argon2id KDF、SIV 封装/解封、正文加解密（纯函数，覆盖率 ≥ 90%） |
| `services/vault_service.rs` | `status` / `create` / `unlock` / `lock` / `change_passphrase` / `set_note_encryption` + `VaultSession` |
| `commands/vault/*.rs` | 六个命令，一命令一文件；注册到 `commands/mod.rs` 与 `src-tauri/src/lib.rs` 的 `generate_handler!` |
| `services/note_content.rs` | **内容读写唯一入口** `read_text` / `write_text`（判信封 + 会话解密 + 加密写入） |

### 5.2 改造（Rust，全部收口到 `note_content`）

| 位置 | 改动 |
|---|---|
| `repositories/note_files.rs:23` / `:32` | 读写走 `note_content`；`move_note` 保持字节操作；`convert_note` 需解密后重加密 |
| `services/note_service.rs:116` `to_meta` | 标题：锁定或解密失败时回退文件名，单篇失败不得中断列表 |
| `services/search_service.rs:22` | 走 `read_text`；锁定笔记静默跳过 |
| `services/wiki_service.rs:14` | 同上 |
| `services/ai_service.rs:205` `retrieve_context` | 只取非加密笔记，加密笔记永不进 AI 上下文 |
| `git_backend::file_history` / `file_diff` / `restore_file` | 三者对加密笔记一律直接返回领域错误（`VAULT_9003`「该笔记已加密，不提供版本历史」）：既不下发密文 diff，也不新增「解密历史 blob」的解密路径，更不提供回滚入口 |
| `repositories/git2_history.rs` | 全仓 `repo_history` 保持原样（提交元数据与文件名本来就是明文）；仅在上层对加密笔记文件屏蔽单文件对比与恢复 |
| `services/sync_service.rs` 冲突流程 | 加密笔记降级为「保留本地 / 使用远端」二选一（三栏行级合并对密文无意义） |
| `trash_service` / `restore_service` / `backup_service` | 字节级拷贝天然保持密文，补测试确认不落明文 |

### 5.3 前端

- `api/types.ts` + `api/note.api.ts`：新增 `NoteMeta.encrypted`、`NoteContent.locked`；新增 `api/vault.api.ts`。
- `queries/vault.queries.ts`：vault 状态属服务端态，走 TanStack Query（`CODING_STANDARDS.md` §2：禁止 Zustand/useState 镜像）。
- 新增 `features/vault/`：解锁门 Overlay、设置页分类（`settingsSections.tsx` 增 `vault`）、笔记右键/工具栏「加密此笔记 / 解密此笔记」、锁定态只读遮罩、目录树与标签页的锁标记。
- `features/vault/` 建库对话框：口令强度校验 + 二次输入 + 不可恢复确认勾选；桌面端不渲染「记住口令」选项（`src/platform/` 判定，桌面恒为 false）。
- `features/ai/*`：加密笔记禁用全部 AI 入口（写作 / 问答 / 建议）并说明原因。
- `features/history/*`：加密笔记的历史入口整体隐藏（含 Diff 与「恢复此版本」），打开时显示「已加密，不提供版本历史」的静态说明；Repo Git Graph 中选中加密笔记文件时同样只显示该说明，不渲染对比与回滚按钮。
- `i18n/messages.ts` 新增双语文案；`api/error.ts` 映射 `VAULT_9xxx`。

### 5.4 依赖

新增 `argon2`、`aes-siv`、`base64`、`zeroize`（一律最新稳定版）；复用已有 `getrandom` / `sha2` / `aes-gcm` / `tauri-plugin-keyring-store`。

## 6. 降级与边界行为

| 场景 | 行为 |
|---|---|
| 锁定态打开加密笔记 | 编辑器只读 + 解锁提示；导出 PDF / 打印禁用 |
| 锁定态搜索 / 双链 | 加密笔记不进结果，解锁后自动重取 |
| 加密笔记的版本历史（笔记面板 + Repo Git Graph 单文件视图） | 整体不提供：Diff 与「恢复此版本」都没有入口，只显示静态说明；不因查看历史而解密任何旧版本，也不存在「回滚到加密前明文再写回」的路径 |
| 全仓 Git Graph 提交列表 | 保留：提交元数据与文件名本就是明文（决策 ②），只屏蔽加密笔记的单文件对比与回滚 |
| 提交与同步 | 密文照常进 Git；commit message 仍是明文路径列表（符合决策 ②） |
| Git 冲突 | 加密笔记二选一；明文笔记保持原有三栏合并 |
| 草稿未落盘时锁定 | 先 flush 保存队列再锁定，失败则留在解锁态并提示 |
| 桌面端退出 / 重启 | 密钥随进程消失，必须重新输入口令；无「记住口令」开关 |
| 移动端 | 口令解锁 + 系统钥匙串（可免输入）；不承诺后台自动解锁 |
| 口令遗忘 | 无恢复码、无重置途径，数据不可恢复（UI 必须提前告知） |
| 日志与诊断包 | 正文、口令与密钥永不进日志；沿用现有脱敏管线 |

## 7. 交付阶段与退出标准

| 阶段 | 内容 |
|---|---|
| E1 | 密钥与信封：`vault_crypto` / `vault_files` + 单测（含向量与篡改检测） |
| E2 | 会话与命令：解锁/锁定/状态 + 前端解锁门 + 口令强度校验与建库确认 + `VAULT_9xxx` 错误域 |
| E3 | 内容层收口：5 个读取点改造 + 标题回退 + 搜索/双链跳过锁定笔记 |
| E4 | 逐篇开关：加密/解密此笔记、混合仓库、回收站与备份验证 |
| E5 | 边界降级：AI 禁用、冲突二选一、版本历史入口整体关闭、锁定时机（桌面默认仅启动锁定 + 手动）、双端验证 |

每阶段按 `CODING_STANDARDS.md` §5.2 的 `shared` 门禁验证：`pnpm build && pnpm test && pnpm lint`、`cargo test`、`pnpm test:e2e`、桌面冒烟、Android release 构建检查（`pnpm android:build`）。

工作量估算：E1–E3 约 1.5 周，E4–E5 约 1.5 周，合计 **2.5–3 周**（单人，含测试与双端验证）。

## 8. 文档同步义务

- `docs/PRD.md`：P2-4 状态更新为「已评估，方案见本文档」，并按需登记 P1 级需求条目（业务规则：密钥存储、锁定行为、AI 禁用、混合仓库共存）。
- `docs/ARCHITECTURE.md`：§5 增「加密笔记」运行时段落（信封格式、会话、`note_content` 收口点）。
- `docs/PRIVACY.md`：增密钥存储位置与威胁模型说明。
- `docs/ROADMAP.md`：更新 M5 条目与优先级评分。
- `AGENTS.md`：安全红线补充「笔记正文密文格式与 VaultKey 存储位置」。

## 9. 明确不做（本方案范围外）

- 文件名 / 目录 / 提交元数据加密（决策 ②）。
- 附件与 `todos.json` / `favorites.json` 加密。
- 加密笔记的任何 AI 能力（决策 ③）。
- 加密笔记的版本历史（决策 ④）：Diff 与「恢复此版本」都不实现，也不实现针对历史 blob 的解密链路。
- 桌面端「记住口令」/ 系统钥匙串免输入（决策 ⑤）。
- 恢复码、托管式密钥找回、客服重置（决策 ⑥）。
- 跨用户密钥分发、团队共享密钥、GPG 收件人式多设备封装。
- Git 历史重写与已提交明文清理。
- 整仓强制加密模式（只提供逐篇开关，避免把老仓库变成不可读黑箱）。

## 10. 实现进度

### 已完成（E1 + E2 后端 + E3 后端）

| 阶段 | 交付物 |
|---|---|
| E1 | `domain/vault.rs`（信封格式与纯校验）、`repositories/vault_files.rs`（`.ainote/vault.json` 原子读写）、`services/vault_crypto.rs`（Argon2id + AES-256-SIV + 主密钥封装） |
| E2 后端 | `services/vault_service.rs`（会话状态机：status / create / unlock / lock / change_passphrase）、`commands/vault/{status,create,unlock,lock,change_passphrase}.rs` 并注册到 `lib.rs` |
| E3 后端 | `services/note_content.rs`（正文读写唯一入口）、5 处读取点改造（`note_files` / `note_service::to_meta` / `search_service` / `wiki_service` / `ai_service::retrieve_context`）、`NoteMeta.encrypted` 与 `NoteContent.locked` |
| 前端契约 | `src/api/types.ts` 同步两个 DTO 字段与 `VaultState` / `VaultStatus`，测试夹具对齐 |
| 测试 | 新增 37 个 Rust 测试（含 `encrypted_notes_drill` 跨模块演练：解锁可读 / 锁定不可读 / 搜索与 wiki 跳过 / AI 上下文排除 / 类型转换保持密文） |

验证结果：`cargo test` 335 passed、`pnpm build` / `pnpm test`（1011 passed）/ `pnpm lint` / `pnpm test:e2e`（74 passed）全绿，无编译警告。

### 实现期收敛的设计细节

- **错误码落地为五档**：`VAULT_9001` 未解锁、`VAULT_9002` 解锁失败（口令错误与文件损坏不区分）、`VAULT_9003` 不提供版本历史、`VAULT_9004` 输入/配置非法、`VAULT_9005` 密文损坏或被篡改。
- **读取语义**：唯一入口 `note_content::read_file`。锁定态返回 `text: None`（扫描类调用方静默跳过，打开单篇时前端渲染解锁遮罩）；**密文损坏返回 `VAULT_9005`**，避免「坏文件被永远显示为需要解锁」。
- **写入语义**：目标文件已是信封时继续以密文落盘；锁定态写入直接拒绝，杜绝「锁定期间把加密笔记覆盖成明文」。
- **类型转换**：`.md ↔ .ainote` 转换时若源笔记是加密态，新笔记先加密再落盘。
- **AI 边界**：加密笔记在**解锁态也不进入**全库检索上下文（决策 ③ 的后端兜底）；编辑器侧的 AI 入口需由前端禁用（E5）。
- **确定性加密已验证**：同内容同密文（Git delta 友好），换密钥/换内容/篡改均被 SIV 校验拒绝。

### 待实现

| 阶段 | 剩余内容 |
|---|---|
| 体验补强 | 目录树 / 标签页的加密锁标记（需要 `TreeNode` 带上加密标记或前端与笔记列表联表）；Repo Git Graph 单文件视图的错误文案本地化（当前显示后端消息） |
| 测试补强 | 逐篇开关的 e2e 用例（mock 需要模拟信封读写） |
| 已知遗留 | `src-tauri/src/config/logging.rs:24` 的 `unused_mut` 警告（先于本次改动存在，未在本次范围内修改） |

### 门禁执行结果（本次改动）

| 门禁 | 结果 |
|---|---|
| `cargo test` | 339 passed（无新增警告） |
| `pnpm build` / `pnpm lint` | 通过 |
| `pnpm test` | 1030 passed |
| `pnpm test:e2e` | 77 passed |
| Android release 构建（`pnpm android:build`） | 通过，产出 `app-universal-release.apk` 与 `.aab` |
| 桌面 release 编译（`pnpm desktop:build`） | 通过，产出 `target/release/ainote-core` |
| 桌面 GUI 冒烟 | 未执行（本次为无人值守环境，无可交互桌面会话）；交互路径由 e2e 的 `?e2e` mock 用例覆盖 |

### E2 / E3 前端（已完成）

| 交付物 | 说明 |
|---|---|
| `src/api/vault.api.ts` + `src/api/index.ts` | 五个命令的类型安全封装；口令只在此处透传 |
| `src/queries/vault.queries.ts` | 状态查询 + 四个 mutation；解锁/锁定后一次性失效 `[vault]` `[note-content]` `[notes]` `[wiki]` `[search]` |
| `src/features/vault/hooks/useVaultSettings.ts` | 设置页编排：仓库状态走 Query，口令不缓存、不持久化 |
| `src/features/vault/components/*` | `VaultSettings`（状态 + 建库/解锁/已解锁三态）、`VaultCreateCard`（强度校验 + 二次输入 + 不可恢复确认）、`VaultUnlockCard`、`VaultUnlockedCard`（锁定前先 flush 草稿，失败则留在解锁态）、`VaultChangePassphraseForm`、`VaultPolicyNotes`、`VaultLockedNote` |
| `src/features/vault/utils/*` | `passphrase`（与 Rust 同口径的强度规则与判定顺序）、`errorText`（`VAULT_9xxx` → 本地化文案）、`repoName` |
| 编辑器接线 | `useNoteEditor` 暴露 `locked`，`NoteEditorSupport::editorPlaceholder` 统一处理空态 / 加载失败 / 锁定态占位，锁定笔记不挂载编辑器 |
| 设置入口 | `SettingsTab` 新增 `vault`，`settingsSections` 注册「加密笔记」分类（图标 Lock） |
| i18n | 新增 30 个中文键与对应英文（含状态、表单校验、边界说明、错误码文案） |
| e2e | `src/e2e/vault.ts` mock 命令；`e2e/vault-flow.spec.ts` 三个用例（建库→锁定、口令不达标/口令错误、边界说明可见） |

### E4 / E5（已完成）

| 项 | 实现 |
|---|---|
| E4 逐篇开关（后端） | `note_service::set_note_encryption` + 命令 `vault_set_note_encryption`：已处于目标状态时幂等；未建库返回「请先在设置中启用」（`VAULT_9004`）；锁定态返回 `VAULT_9001`；解密同样需要解锁 |
| E4 逐篇开关（前端） | 编辑器「⋯」菜单新增「加密此笔记 / 解密此笔记」，仅在仓库解锁时出现；成功后 toast 提示并失效 `[vault] [note-content] [notes] [wiki] [search] [sync]` |
| E5 AI 关闭 | `NoteContent.encrypted` 下发到前端 → 工具栏 AI 按钮进入禁用态并用 tooltip 说明原因（解锁态也禁用，与决策③一致） |
| E5 冲突降级 | 冲突面板检测到信封内容后不再渲染三栏：`EncryptedMergePane` 只给「保留本地 / 保留远端」，选定后**原样写回**该侧密文（新增 `resolveWithSide`，绕开异步 setState 读到旧值的问题） |
| E5 版本历史关闭 | 后端 `file_history` / `file_diff` / `restore_file` 一律返回 `VAULT_9003` 且不触达 Git 层；前端工具栏历史按钮禁用并说明原因；目录树入口路径改为 toast 说明（不再打开空面板） |
| E5 锁定时机 | 由设计天然满足：主密钥只存在于进程内存、会话按仓库绑定，因此「启动即锁定」无需额外代码；未实现空闲自动锁定（决策⑤ 下会强制频繁输入口令，默认不做） |
