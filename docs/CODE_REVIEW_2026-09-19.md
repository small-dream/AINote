# AINote 代码审查报告（全仓）

> 审查日期：2026-09-19 · 审查基线：`main @ c9cc263`（v0.48.0，工作区干净）
> 审查范围：`src/`（615 个 TS/TSX 文件，约 43,000 行）+ `src-tauri/src/`（197 个 Rust 文件，约 18,300 行）
> 审查方法：12 路并行分区审查（api/queries、note、settings/update、todo/wiki、richtext/ai、sync/file-tree/vault、小 feature 合集、壳与地基、Rust commands/services、Rust repositories/domain、安全专项、架构合规专项）+ 自动化门禁实测
> 结论：**整体工程质量高，防腐指标出色（`any`/`@ts-ignore`/TODO 零出现，分层铁律零违规）**。发现 **10 项 🔴、40+ 项 🟡**。主要风险集中在两类：①「远端/后台写盘后与编辑器陈旧草稿互相覆盖」的数据丢失链路（多处复发）；②「仓库内容不可信」威胁模型在符号链接、回收站、批量冲突解决上的缺口。
>
> **修复进展（2026-09-19）**：✅ R1（符号链接穿越）、R6（批量冲突信封守卫）、R7（删文件夹丢非笔记文件，改为拒绝删除并报 `REPO_3002`）已修复并配回归测试，已提交（`2359019`）。✅ R2（写盘后草稿覆盖家族：同步/冲突解决/恢复前 flush + 统一失效面 + 无脏草稿时编辑器重载信号）、R3（自动保存停摆：保存后 dirty 仍为 true 时重新武装防抖）、R4（移动/重命名前先 flush，flush 支持显式内容消除 rAF 时序赌博）已修复并配回归测试，`pnpm build/test/lint` 与 25 条相关 e2e 全绿。✅ R8（ESLint glob 改 `@tauri-apps/**` 并显式豁免 src/platform/，reminderRuntime 通知调用下沉至 platform 层）、R9（close-guard confirmClose 失败后 finally 复位可重试）、R10（全部 Git 写命令统一 RepoWriteLock 互斥；更新下载/备份改 acquire/release 语义，新增 UPDATE_7004/REPO_3003）已修复并配回归测试，`cargo test` 391 passed。至此 10 项 🔴 全部修复，其余 🟡 待处理。

## 0. 结论速览（🔴 严重问题）

| ID | 问题 | 影响面 | 关键位置 |
|---|---|---|---|
| R1 | 符号链接穿越：clone 恶意仓库可读取本地任意文件并经 AI 问答外泄；目录链接可致遍历无限递归栈溢出 | desktop + mobile | `note_files.rs:9`、`file_storage.rs:28`、`file_tree.rs:28`、`trash_files.rs:171` |
| R2 | 写盘后草稿覆盖家族：同步/冲突解决/git-graph 恢复/历史恢复后，编辑器陈旧草稿静默覆盖新内容 | shared | `sync.queries.ts:53-58,70-76,92-100`、`useRepoGraph.ts:31-42`、`useFileHistory.ts:24-35` |
| R3 | 连续输入时自动保存静默停摆（保存期间继续输入则定时器不再武装），崩溃即丢稿 | shared | `useNoteSaveQueue.ts:41-45` |
| R4 | 移动/重命名当前打开的脏笔记：先 move 后 flush，旧路径文件复活、笔记分叉成两份 | shared | `MoveNoteDialog.tsx:36`、`RenameNoteDialog.tsx:27` |
| R5 | AI「整文优化 + 有选区」把整篇文档替换进选区，文档自我复制 | shared | `useAiWrite.ts:40-45` |
| R6 | 批量冲突解决（保留本地/远端）绕过加密信封守卫，可把加密笔记以明文推送远端历史 | shared | `git2_remote.rs:142-160` |
| R7 | 删除文件夹把目录内非笔记文件（图片/PDF/附件）永久物理删除，不进回收站 | desktop + mobile | `trash_files.rs:77-93` |
| R8 | ESLint 分层铁律机器强制失效（glob `*` 不跨 `/`），已有实际绕道 | 工程门禁 | `eslint.config.js:30`、`reminderRuntime.ts:1-9` |
| R9 | close-guard 确认失败后 `closing` 不复位，永远无法优雅退出，只能强杀进程 | desktop | `useCloseGuard.ts:32-44` |
| R10 | Git 写操作并发互斥缺口：pull/push/commit/resolve 可并发打同一仓库；更新下载/备份"单任务"守卫名不副实 | shared | `commands/git/*`、`update.rs:50`、`backup.rs:48` |

门禁基线：`pnpm build` ✅ · `pnpm test`（188 文件 / 1096 用例）✅ · `pnpm lint` ✅ · `cargo test` ✅

---

## 1. 🔴 严重问题详情

### R1. 符号链接穿越：恶意仓库可读取并外泄本地任意文件

`note_files.rs:9` 的 `validate_rel_path` 只做词法校验（拒绝 `..`、绝对路径、隐藏段），**不检查路径中任何一段是否为符号链接**；`file_storage.rs:28`、`file_tree.rs:28`、`trash_files.rs:171` 递归遍历时 `is_dir()`/`is_note_file()` 均跟随符号链接。

攻击链：用户「绑定远端仓库」clone 攻击者控制的仓库，其中含 `leak.md -> ~/.ssh/id_rsa`（git 默认按 symlink 检出）：

1. 用户打开该「笔记」，`read_note` 跟随链接读出任意本地文件明文并显示；
2. AI 仓库范围问答（`ai_service.rs:201-205` → `search_notes`）把内容**注入 LLM 请求发送到远端服务商**——静默数据外泄链；
3. 指向祖先目录的目录符号链接使 `build_node`/`walk` 无限递归（栈溢出 DoS）；
4. `move_note`/`write_note` 经由目录符号链接可写到仓库外。

佐证矛盾点：`backup_files.rs:55`、`restore_files.rs:118`、`repo_size.rs` 已显式跳过/检测符号链接，说明团队已知此威胁，但笔记读写主链路漏了。

**修复**：遍历处改用 `symlink_metadata` 并跳过 `file_type().is_symlink()`；读写前对 `root.join(rel)` 做 `canonicalize()` 并断言结果仍以 canonical root 为前缀。补符号链接穿越单测（`repo_size.rs:60` 有范式可复用）。

### R2. 「写盘后草稿覆盖」家族——同一病根多处复发

病根：磁盘内容被非编辑器路径改写后，`useNoteReload`（`useNoteReload.ts:26-43`）只在路径切换/locked 翻转时重载，编辑器草稿不重载，3s 防抖自动保存把旧草稿写回。

- **同步/冲突解决后失效面不全**：`sync.queries.ts:53-58,70-76,92-100` 的 onSuccess 只失效 `["sync"]`、`["notes"]`、`["tasks"]`，**没有失效 `note-content`/`tree`/`wiki`/`favorites`/`history`/`changed-files`**。pull 把当前打开的笔记在磁盘上改掉后，缓存与草稿都停留在旧内容，下一次击键触发自动保存（`useUpdateNoteMutation` 还会用旧内容 `setQueryData` 回写缓存，`note.queries.ts:88-91`），远端合并进来的内容被**静默覆盖**。远端版本虽在 Git 历史可找回，但用户无感知。
- **git-graph 恢复当前打开的笔记**：`useRepoGraph.ts:31-42` 恢复成功后只失效 history 查询，没有 HistoryPanel 的 `reloadEpoch` 强制重载机制；恢复本身不产生提交，用户毫无察觉。
- **HistoryPanel 恢复前不 flush**：`useFileHistory.ts:24-35` 直接 `restore.mutate`，与 3s 防抖自动保存存在竞态；对比 `useCloseGuard.ts:37`、`BindRepoForm.tsx:36` 都明确「先 `flushPendingDrafts()` 再做破坏性操作」。

**修复**：写盘前先 flush、成功后失效全工作区缓存 + 给编辑器 reload 信号（复用 `reloadToken`/`reloadEpoch` 机制，或对「无脏草稿」场景允许数据驱动重载）。建议收敛一个 `invalidateWorkspaceQueries()` 共享 helper 定义「工作区写入后该失效什么」。

### R3. 连续输入场景下自动保存静默停摆（数据丢失窗口）

`useNoteSaveQueue.ts:41-45`：防抖 effect 依赖 `[debounceMs, dirty, isLoaded, notePath, saveDraft]`。持续输入时 `dirty` 恒为 true（同值触发 React bailout），定时器只在首次变更后触发一次。若保存 in-flight 期间用户又敲了键（`:35` 守卫跳过 `setDirty(false)`），`dirty` 保持 true 且**没有任何机制重新武装定时器**——之后这篇笔记的自动保存彻底停止，直到手动 flush/切笔记/切后台。与 `useNoteEditor.ts:9` 注释承诺的「连续输入期间同样会落盘」直接矛盾；现有测试只验证了「计时器不重置」，未覆盖「保存完成时 draft 已前进」分支。

**修复**：保存完成后若 `dirty` 仍为 true，重新调度下一轮防抖（`.then` 里 draft 不匹配时显式 `setTimeout`，或把 `saving` 翻转纳入 effect 依赖），并补对应单测。

### R4. 移动/重命名「当前打开的脏笔记」会把草稿写回旧路径，复活已移走的文件

链路：`MoveNoteDialog.tsx:36`/`RenameNoteDialog.tsx:27` 的 `move.mutate` 成功后 `onMoved(to)` → `handleSelect(to)` → `await editorRef.current?.flush()`。此时 `currentNotePath` 仍是旧路径，而文件已被 move 走；`flush()` 对旧路径调 `noteApi.update`，Rust 侧 `write_note`（`note_files.rs:32-38`）对不存在的路径 `create_dir_all` + `fs::write`——在旧路径重建文件，内容为最新草稿；新路径保留旧内容。结果同一篇笔记出现两份分叉副本。触发条件：笔记 dirty（3s 防抖窗口内编辑过，或此前保存失败）。

对比：`useNoteTitle.ts:44-48` 的标题改名路径是**先 flush 再 rename**（正确顺序），对话框路径顺序反了。另外 `useNoteTitle.ts:45` 用 `requestAnimationFrame` 赌 React 状态落盘时序，并发渲染下可能输掉时序，触发同类复活。

**修复**：对话框在调用 move mutation **之前**先 `await flush()`（把 flush 注入对话框，或把移动编排收拢到持有 editorRef 的层）；`useMoveNoteMutation.onSuccess`（`note.queries.ts:126-133`）应清理旧路径 `note-content` 缓存。

### R5. AI「整文优化 + 有选区」时把整篇文档塞进选区替换，内容自我复制

`useAiWrite.ts:40-45`：`AI_DOCUMENT_ACTIONS`（prompts.ts:9）包含 `optimize`，所以**有选区时点「优化」**：source 取整篇 `fullText`，但 `documentAction=false` → confirm 走 `applyToMarkdownEditor`/`applyToTipTapEditor` 把「优化后的整篇文档」替换到**当前选区**——结果是 选区前文 + 整篇优化稿 + 选区后文。预览按钮文案显示「替换」，用户无法察觉实际替换范围。Markdown/富文本两个宿主都中招，此路径无测试。

**修复**：二选一——optimize 有选区时用 `sel.text` + 选区替换（语义改为「优化选中段落」），或统一走 `onApplyFull` 全文档替换；补「有选区 + optimize」测试。

### R6. 批量冲突解决（保留本地/远端）没有加密信封守卫，可把加密笔记静默降级为明文并推送

`git2_remote.rs:142-160`：`resolve_conflict_file`（:205 起）精心实现了 `reject_plaintext_over_envelope`，注释明确「命令层可被直接 invoke，不能信任前端已隐藏三栏合并」；但同一文件里 ours/theirs 整体解决的 `resolve_conflicts` 没有任何信封判定：checkout use_ours/use_theirs 后直接 `add_path` + merge commit。场景：远端把笔记加密（theirs=信封）、本地仍是明文（ours），用户点「保留本地」→ 明文覆盖信封、提交、随后同步推送到 GitHub——**加密内容以明文形式永久进入远端历史**。

**修复**：`resolve_conflicts` 逐冲突文件复用 `path_is_encrypted` 判定，任一侧是信封而选中侧不是信封时拒绝。

### R7. 删除文件夹会把非笔记文件永久删除，不进回收站

`trash_files.rs:77-93`：`soft_delete_folder` 只把 `.md`/`.ainote` 移入 `.trash`（`walk_notes` 仅收集 `is_note_file`），随后 `fs::remove_dir_all(&dir)` 把目录里其余一切（图片、PDF、子目录隐藏文件等）直接物理删除，不可恢复。仓库就是普通 Git 仓库，用户完全可能在笔记目录里放插图或附件。违反「软删除 = 可恢复」的 P0 数据安全语义。

**修复**：删除前扫描目录内全部条目，存在非笔记文件时拒绝删除（报 REPO 错误并列出文件），或把非笔记文件也一并收进回收站。

### R8. ESLint 分层边界规则因 glob 错误完全失效，已存在实际绕道

`eslint.config.js:30`（及 44、62、73 行同样写法）：pattern 为 `"@tauri-apps/api*"`。ESLint `no-restricted-imports` 用 minimatch 匹配，`*` 不跨越 `/`（已用仓库内 minimatch@10.2.6 实测）：`@tauri-apps/api` 拦截 ✓，但 `@tauri-apps/api/core`、`@tauri-apps/api/window`、`@tauri-apps/plugin-*` 全部放行 ✗。「Tauri IPC 只允许在 `src/api/`」的机器强制形同虚设。

已有实际违规：

- `src/features/todo/hooks/reminderRuntime.ts:1-9` 直接 import `@tauri-apps/plugin-notification`（`sendNotification`/`cancel`/`pending` 均为 IPC），绕过 api/ 层，且与 `@/platform/reminders` 形成「一半走平台层、一半直连插件」的混合状态；
- `src/platform/reminders.ts:33` 动态 import `@tauri-apps/api/window`——架构允许平台差异收敛到 `src/platform/`，但 lint 规则未豁免该目录，规则与约定脱节。

**修复**：glob 改 `@tauri-apps/api/**` + `@tauri-apps/plugin-*`（或直接 `@tauri-apps/**`）；明确 `src/platform/` 豁免并写进规则；通知调用下沉为 `src/api/notification.api.ts` 或 `src/platform/`。

### R9. close-guard 确认按钮「一次性死亡」：confirmClose 失败后永远无法优雅退出

`useCloseGuard.ts:32-44`：`closing.current = true` 后，若 `flushPendingDrafts()` 成功但 `confirmClose()` 失败，`closing.current` 不复位（只有 flush 失败路径在 `:39` 复位）。此后 confirm 永远提前 return，弹窗取消再触发也无效——用户只剩强制杀进程。

**修复**：复位放进 `finally`，或 confirmClose 失败时同样 `closing.current = false`。

### R10. Git 写操作互斥只覆盖了 sync 与 reset；下载/备份「单任务」守卫名不副实

- `SyncRetryState` 只被 `sync_now` 和 `reset_repo_history` 使用。同步进行中点手动提交/推送/解决冲突，或笔记类型转换的自动 `commit_pending` 与 sync 的 `commit_all` 并发，都落到同一 `.git`：git2 靠 index.lock 报错兜底，表现为偶发 `GIT_4001` 假错误；两个 `commit_all` 交错可能把语义无关的变更打进同一提交。涉及 `commands/git/pull.rs`、`push.rs`、`commit.rs`、`resolve.rs`、`resolve_file.rs`、`note/convert.rs:24`。
- `update.rs:50-52`、`repo/backup.rs:48-50` 的 `UpdateDownloadState::set()`/`BackupState::set()` 是无条件覆盖，不像 `SyncRetryState::acquire` 那样拒绝重入。两个并发下载共享同一 `app_cache_dir/updates`：后启动者的 `clear_stale_files` 会删掉前者正在写入的 `.part`；先完成者的 `set(None)` 会把后者的取消标志清掉，`cancel_update_download` 对仍在下载的任务失效。

**修复**：所有会写 index/refs 的命令统一走 acquire/release（或抽 RepoLock），读操作放行；`set` 改成「占用即报错」语义（SYNC_4005 式 Busy 错误），释放时校验 flag 归属。

---

## 2. 🟡 中等问题（按主题归并）

### 2.1 凭证与关键文件写入

- **凭证文件「先写后 chmod」存在 0644 窗口，且写入非原子**：`secure_store.rs:91-99`、`auth_store/desktop.rs:128-136`。新建文件短暂窗口内同机其他用户可读；崩溃留半截 `auth.key`/`{name}.key` 将导致**所有**已存凭证永久不可解密。仓库已有现成范式：`vault_files.rs:41` 的「临时文件 → sync_all → rename → 目录 fsync」四步原子写。修复：`OpenOptions::new().mode(0o600)` 建文件 + tmp/rename。
- **同类非原子写 + 无自愈**：`ai.json`（`ai_store.rs:50-56`，损坏后 AI 配置整体不可用）、`ainote.json`（`config/mod.rs:76-79`，解析失败全链路瘫痪，建议坏文件改名 `.bak` 回退默认）、回收站 manifest（`trash_files.rs:26-32`，崩溃后回收站永久锁死）、`metrics.json`（`metrics_service.rs:82`）。
- **凭证损坏误分类为可重试 IO 错误**：`secure_store.rs:56-58`（解密失败 → IO_5001 `retriable=true`）、`auth_store/mobile.rs:22-36`（keyring 全部错误 → Io）。对比 `desktop.rs:61` 解密失败正确映射 Auth。后果：前端「可自动重试」重试永远失败。
- **口令/Token 以普通 `String` 过 IPC 且不零化**：`commands/vault/*.rs`、`auth/save_token.rs`。主密钥已用 `Zeroizing`，口令 String 在堆上留存至 GC。建议 `Zeroizing<String>` 贯通 Command → Service。
- **回收站 id 碰撞丢数据**：`trash_files.rs:209-212`（秒级时间戳 + fnv1a(路径)），同秒同路径二次删除互相覆盖，manifest 出现同 id 死条目。修复：加随机分量（`domain::task::new_task_id` 有毫秒+getrandom 范式）。
- **任务/收藏/指标「读-改-写」跨线程无锁**：`task_service.rs:8-16`、`note_favorite_service.rs:35-39`、`metrics_service.rs:59-65`。原子 rename 只保证单次写不撕裂，不解决两个 blocking 线程同时 load→mutate→save 的丢失更新。建议按仓库路径分桶的进程内 Mutex。

### 2.2 同步 / 冲突 UI

- **任务类 mutation 失败弹两次相同 toast**：`task.queries.ts:26` 的 `onError: reportToastError` 与全局 `MutationCache.onError`（`providers.tsx:11-16`）重复触发，`toast.store.ts` 不去重。删掉前者即可。
- **解决当前文件后页签高亮丢失**：`useConflictMerge.ts:57` 正文用 `Math.min(current, len-1)` 钳位，但页签高亮（`ConflictMergeHeader.tsx:66`）用原始索引。解决列表末项后无任何页签高亮。
- **同会话合并编辑残留可覆盖新冲突初始内容**：`useConflictMerge.ts:56-63` `edits` 以 path 为 key 只增不删；收尾 push 失败后再次同步拉出同路径新冲突时显示残留旧稿。resolveFile 成功后应删除对应 `edits[path]`。
- **`useUpdateNoteMutation` 缓存回写缺字段**：`note.queries.ts:88-91` 无缓存时写入缺 `kind`/`locked`/`encrypted` 的 `NoteContent`（测试已固化此行为）。建议无缓存时跳过 `setQueryData`。
- **`errorActionOf` 无视后端 hint，与其注释自相矛盾**：`error.ts:61-72` 只按 code 硬编码映射，toast 链路与同步面板可能给出两个不同的建议动作。
- **笔记 CRUD 后 `["search"]` 等派生缓存不失效，各域口径不一**：`note.queries.ts:48-56,103-113,128-135`、`trash.queries.ts:18-26`、`tree.queries.ts:38-45` 均不失效 `["search"]`，而 `vault.queries.ts:27-32` 却失效了。已长出三种「标准」，收敛到共享 helper。
- **`useCommitPendingMutation`/`useSyncNowMutation` 不失效 `["changed-files"]`**：提交面板在提交后仍开着时短暂显示「已提交的文件仍待提交」。
- **`useStartupSync` 无测试**：「每仓库只启动一次」、离线上线切换、`retry:false` 等真实逻辑零覆盖。

### 2.3 wiki / 标签一致性

- **带目录的双链创建后永远无法解析**：`wiki.ts:171` 的 `wikiCreatePath("daily/计划")` 保留目录生成 `daily/计划.md`（测试已固化），但 `resolveWikiTarget`（:57）只按标题/文件名忽略目录匹配。用户点「创建」后链接仍显示「未创建」，再次点击会重复创建同路径笔记。两者必须对齐并补回归测试。
- **标签提取/渲染三套实现互不认同代码块**：`MarkdownPreview.tsx:203` 的 `transformWikiLinks` 作用于原始全文，代码块里的 `[[x]]` 被改写污染；`tagContent.ts:58` 的 `extractMarkdownTags` 对全文正则扫描，代码块和 frontmatter 里的 `#tag` 被算作标签；而预览插件 `markdownTags.ts:17` 刻意跳过 code，后端 `extract_tags` 又是字节级全文扫描。同一篇笔记三处口径不一致。
- **富文本标签「前缀遮蔽」bug**：`tagContent.ts:88-94` `richTextHasTag` 用 `includes("#work")` 判断，已有 `#worklog` 时 `work` 静默加不上；移除路径却用带边界正则，两边口径不对称。
- **`removeTagFromMarkdown` 缺前置边界会腐蚀内容**：`tagContent.ts:32-35` 会把 `##tag` 删成 `#`，代码块里的 `#tag` 也会被删。
- **IME 组合期内 Enter 误提交**：`TaskCreateDialog.tsx:52`、`TaskEditor.tsx:43`、`WikiPanel.tsx:105-110` 均未检查 `event.nativeEvent.isComposing`（全仓 grep 零守卫）。中文用户拼音选词按 Enter 会直接创建任务/提交标签——对主打中文解析的应用是高频误触。
- **`useWikiPanel.handleCreate` 未捕获 Promise 拒绝**：创建失败无 toast 无 catch，unhandled rejection。
- **TodoPanel 行内编辑器随外部更新重挂载丢草稿**：`TodoPanel.tsx:49` key 为 `${task.id}:${task.updatedAt}`，外部看板变化触发 refetch 即重置未提交草稿并抢焦点；桌面版 `TodoWorkspace.tsx:56` 只用 `task.id`，策略不一致。

### 2.4 richtext / AI

- **`useRichTextAssets` effect 依赖逐渲染变身份的 mutation 对象**（`useRichTextAssets.ts:64,110`）：编辑器每按键重挂 Tauri 拖放监听，且 54-58 行异步注销竞态导致 OS 级监听永久泄漏，积累后一次拖放触发多次导入。修复：deps 改为稳定的 `mutate` 引用，`.then` 里检查「是否已 cleanup」。
- **`useAskAi` 缺请求失效机制**（`useAskAi.ts:39-50`）：流式途中 reset 后，在途请求完成仍把旧回答追加进已清空的对话；catch 不清 `streaming`，失败后残缺气泡永驻 pending。
- **损坏 `.ainote` 静默替换为空文档**（`richText.ts:4-14`）：用户看到空白敲一个字即把空文档写回，原始内容丢失。应解析失败时进入只读/警告态。
- **TagMark 输入规则与索引层 tag 定义不一致**（`extensions/tag.ts:40`）：`abc#def` 被视觉高亮为标签但 Rust 索引不收录，「看得见但索引不到」的假标签。
- **写作类 prompt 无长度上限**（`prompts.ts:48-50`）：review/optimize/compose 直接塞整篇全文，长笔记触发 token 上限或输出截断后被用户确认替换整文档。
- **AI 菜单点「问答」不关闭菜单弹层**（`AiWriteControls.tsx:23`）：`openAskAi` 不联动 `ai.closeMenu()`，Modal 遮挡在 Ask AI 侧栏之上。
- **编辑器内单击 `[[双链]]`/`#tag` 即跳转**（`RichTextEditor.tsx:75-86`）：建议 Ctrl/Cmd+click 才跳转，对齐 Typora/Obsidian。
- **`translate` 目标语言硬编码简体中文**（`prompts.ts:17`），与 i18n locale 无关。

### 2.5 settings / update

- **iOS 设置页「软件更新」走入桌面 updater 通道必然失败**：`UpdateSettings.tsx:10` 分流条件是 `isAndroidApp()`，但 updater 插件只在桌面注册（`lib.rs:67-70` `#[cfg(desktop)]`）。iOS 上检查更新必然抛错。条件应改 `isMobileApp()`，iOS 展示「前往 App Store」或隐藏。
- **APK 缺 sha256 资产时「立即安装」静默无响应**：`useMobileUpdate.ts:49` 要求 `apkUrl && apkSha256Url` 同时存在否则直接 return，但 `MobileUpdateDialog.tsx:86`、`MobileUpdateSettings.tsx:111` 只判 `apkUrl` 就渲染按钮。UI 判断应与 hook 对齐。
- **仓库大小查询键不含仓库路径**：`useRepoSize.ts:8` 固定 `["repos", "size"]`，切仓 30s 内展示旧仓库数据。
- **设置页 Esc 与 Modal Esc 叠加**：`SettingsView.tsx:22-27` 与 `Modal.tsx:23-28` 互不感知，按一次 Esc 连弹窗带设置页全关。
- **AI 设置保存失败提示硬编码中文**：`useAiSettingsDraft.ts:80`，en-US 用户看到中文。
- **移动端检查失败抹掉已知版本号**：`useMobileUpdate.ts:28` catch 分支 `currentVersion: null`，瞬时网络抖动让「当前版本」变 "—"。
- **`window.confirm` 用在共享设置组件，移动端不可靠**：`SupportSettings.tsx:32`、`MetricsActions.tsx:28`，Tauri Android WebView 对 JS 对话框支持差。改用应用内 Modal。
- **`useAiSettingsDraft` 草稿编排逻辑无单测**（级联删模型/清理 defaultModelId），属核心业务逻辑。
- **空 key 草稿静默清除已保存 API Key**：`useAiSettingsDraft.ts:77` + `ai.api.ts:9`（空串=清除），用户删空再保存无任何提示。

### 2.6 Rust services / repositories 杂项

- **`restore_service` 直接依赖具体 git2 类型**（`restore_service.rs:11,53`），违反「Service 只依赖 trait」，完整性检查无法 Mock。同层 `maintenance_service.rs:8` 已有泛型正确示范。
- **APK 下载 `version` 参数未校验即拼入文件路径**（`update_service.rs:88-89`）：`ainote-` 前缀与 `install_path_allowed` 兜底使其暂不可利用，但属纵深防御缺口。校验 `^[0-9A-Za-z.\-]+$`。
- **clone 失败残留目录，重试积累 `-2`/`-3` 孤儿**（`repo_service.rs:31-40` + `bind.rs:33`）：clone 失败时 `remove_dir_all(&dest)` 兜底。
- **扫描类用例容错粒度不一致**：`note_service.rs:189-191`、`search_service.rs:48-53` 对「读内容失败」做了降级，但同文件 metadata 失败 `?` 传播导致整个列表/搜索报错，与函数内注释矛盾。
- **Android JNI 桥异常泄漏**：`android_bridge.rs:25-27` `with_jni` 中 `f` 提前返回时跳过 `check_exception`，留下未清除的 pending exception，后续 JNI 调用行为未定义。
- **`useRichTextDropListener` 之外的前端问题**：`EditorToolbar.tsx` raw 233 行超组件上限；`useNoteEncryption` 在 `NoteEditor.tsx:71` 与 `NoteEditorSupport.tsx:76` 实例化两次，两个入口可并发触发加密 mutation；滚动持久化每次 scroll 同步 `JSON.stringify + localStorage.setItem` 无节流。
- **softRender 每次光标移动全量重算**（`softRender/plugin.ts:38-41,54`）：任何 selection/doc 变化都 `doc.toString()` + 全文档 plan，长笔记下每次方向键 O(n)；`!tr.docChanged` 且光标未跨块时可复用上次 plan。

### 2.7 安全横向

- **CSP `img-src` 放开 `https: http:`**（`tauri.conf.json:25`）：恶意笔记 `![](https://evil.com/track)` 形成追踪像素；一旦未来出现 XSS，`img-src` 成为绕过 `connect-src` 的外泄通道。建议默认拦截/代理远程图片，至少砍掉 `http:`。
- **AI Provider `http://` 明文发送 API Key**：`ai_settings.rs:136` 只校验 `http(s)://` 前缀，`llm.rs:46,74,106` 无条件附加 `Bearer`。建议 `http://` 仅允许 loopback（兼容 Ollama）。
- **Git 远端 URL 未限制 scheme**：`bind.rs:17` + `repo_service.rs:25`，`http://github.com/...` 会以 Basic Auth 明文发送 token。凭证非空时强制 `https://`。
- **asset 协议未配 scope + 绝对路径放行**：`tauri.conf.json` 无 `app.security.assetProtocol` 配置，`asset.ts:36` 对 `/` 开头的绝对路径直接放行。当前「碰巧安全」（协议未启用），启用即任意本地文件读取。显式声明 scope 并拒绝绝对路径。
- **PDF 导出 sanitize 只做协议过滤**（`richTextHtml.ts:33` → `PdfExportOverlay.tsx:70` `dangerouslySetInnerHTML`）：目前安全靠 ProseMirror schema 丢弃未知属性兜底，属隐式依赖。换 DOMPurify 白名单把防御做实。
- **AI 回答气泡允许渲染远程图片**（`AskAiPanel.tsx:143`）：AI/服务商可在回答中嵌追踪 URL，建议禁用 `img` 组件。

### 2.8 规范漂移与工程门禁

- **行数超标**：`src/api/types.ts` 384（有效 242，纯 DTO 聚合）；Rust 8 个文件 raw 超 300（`sync_service.rs` 534、`metrics.rs` 466、`note_service.rs` 391、`error.rs` 378、`trash_files.rs` 324、`ai_settings.rs` 310、`git2_remote.rs` 305、`metrics_service.rs` 302），超标部分几乎全是内联测试。需在 CODING_STANDARDS 明确「内联测试是否计入 300 行」，或按既有 `*_tests.rs` 惯例拆出。
- **`commands/` 5 个文件超 <80 行规范**：`git/sync.rs` 165、`support/settings.rs` 138、`close_guard.rs` 112、`update.rs` 101、`repo/backup.rs` 94。
- **`WorkspaceNavRail.tsx` 209 行违反 pages 层定位**：ARCHITECTURE 规定 `pages/` 只做组装 <50 行，该文件实为完整业务组件，还绕过了 `**/components/**` 的 220 行组件规则（规则按目录生效）。下沉到 `src/features/`。
- **错误码域漂移**：`GIT_4001` 占用规范划给 SYNC 的 4xxx 段且 `GIT` 不在域清单；`AI_6xxx`/`UPDATE_7xxx`/`VAULT_9xxx` 同样未登记。更新 CODING_STANDARDS §4 或归入既有域。
- **圈复杂度声称由 Clippy `cognitive_complexity` 强制，但仓库无 `clippy.toml`**，CI 也未见对应配置——Rust 侧复杂度实际无机器强制。
- **死代码约 400 行**：`note/components/NoteList.tsx`（146 行，全仓无 import）、`NewNoteDialog.tsx` + `useNewNoteForm.ts`（仅测试引用）、`template.ts:36 uniqueDateNotePath`、`softRender/utils/highlight.ts:54 isLanguageSupported`。

### 2.9 测试缺口（违反「核心业务逻辑必须交付单测」）

| 文件 | 缺测内容 |
|---|---|
| `features/note/hooks/useNoteEditor.ts` | 草稿登记、Cmd+S、visibilitychange flush 编排中枢 |
| `features/note/hooks/useNoteConversion.ts` | 有损转换入口；且 :46-60 `await flush()` 无 catch，失败无任何反馈 |
| `features/note/hooks/useNoteSaveQueue.ts` | 🔴R3 的「保存完成时 draft 已前进」分支 |
| `features/sync/hooks/useStartupSync.ts` | 每仓库一次、离线切换、retry:false |
| `features/settings/hooks/useAiSettingsDraft.ts` | removeProvider 级联删模型等草稿编排 |
| `features/update/utils/desktopUpdateFlow.ts` | 桌面更新状态机（移动端对应物有测试，桌面零覆盖） |
| `features/git-graph/hooks/useRepoGraph.ts` | 选择派生 + 恢复编排 |
| `features/auth/hooks/useLogin.ts`、`features/repo/` 三表单组件 | 凭证校验/保存/flush 顺序/错误分支 |
| `features/wiki/utils/wiki.ts`（`transformWikiLinks`/`decodeWikiHref`）、`tagContent.ts`（`removeTagFromContent`/`contentHasTag`） | 双链渲染核心转换与标签删除——恰是 bug 事发地 |
| `stores/reminderAlert.store.ts`、`stores/command-palette.store.ts`、`hooks/useLongPressContextMenu.ts` | 去重截断、环形索引、长按定时器 |
| `features/vault/utils/errorText.ts`、`features/ai/utils/editorAdapters.ts`、`features/richtext/utils/toolbarCommands.ts` | 纯函数，最易测 |

---

## 3. 🔵 建议（择要）

- `errorActionOf` 先映射后端 `hint` 再回退 code 映射（与自身注释对齐）。
- barrel 导出与深路径 import 混用：`@/api` barrel 缺多个导出，全仓 114+ 处直接 `from "@/api/types"`，两头不靠，择一统一。
- `useDeleteNoteMutation`/`useDeleteFolderMutation` 的 `onMutate` 里 `cancelQueries` 无配套乐观更新，纯冗余。
- `ai.api.ts` 的 `streamRequest` 无取消机制；`update.api.ts`/`release.api.ts` 抛裸 `new Error("UPDATE_INSTALL_UNAVAILABLE")` 哨兵字符串。
- softRender `plugin.ts:5,218` 直接调 `@/api` 的 `openExternal` 而非平台层 `openExternalLink`，非 Tauri 运行时失败且无反馈；`tableWidget.ts:168` 手写 `zh ? ... : ...` 绕过 i18n 且切语言不更新，模块级 `pendingFocus` 可变全局是隐患。
- `NoteEditorSupport.tsx` 杂货铺文件，`NoteEditorContent` 参数达 35 个，prop drilling 影响可读性。
- `format.ts:29-34` `BLOCK_PREFIX` 只认 `- ` 和 `\d+. `，`* `/`+ `/`1) ` 列表 toggle 会叠双重前缀。
- `MermaidBlock.tsx` 与 `mermaidRender.ts` 各自维护一份 mermaid 懒加载且主题检测不一致；`useMarkdownContextMenu.ts:43` 用已废弃的 `document.execCommand`。
- 行级挑选无法追加空行且无反馈（`merge.ts:8`）；`deriveSyncHeader` 在 `resolving` 时按钮文案误用「同步中」；`useTreeContextMenu.copy` 无 clipboard 时也显示「已复制」。
- vault 建库/改口令表单未用 `<form>` 包裹回车不提交；`VaultCreateCard.tsx:23` 逗号表达式清空函数；`VaultSettings` 查询失败无重试入口。
- `TreeNodes.tsx:113-120` 每个目录行渲染一套 CreateMenu（2N 个隐藏 file input 常驻 DOM + 递归无 memo），大仓库全树重渲染。
- `file-tree/utils/path.ts:6-9` 前端 `normalizeFolderPath` 不拦 `..`，全靠后端报错，体验可前置。
- `reminderRuntime.ts:125,185` `sendNotification` 浮空 Promise 无 `.catch`；`task.ts:236` TIME_RULES 认不出「明天18:30开会」无空格写法；`markdownTags.ts:30` 切分吞掉标签前空格。
- `useMobileEditorView.ts:17-30` 连续切笔记堆积 pushState 记录、popstate 监听常驻；`MobileWorkspaceShell.tsx` 列表模式标题硬编码且 `MOBILE_LIST_TITLES` 成死代码。
- `LoginForm.tsx:120` 裸 `window.open` 缺 noopener；`useLogin.ts` 保存成功后 token 仍留在 state；密码框建议 `autoComplete="off"`。
- `ErrorFallback.tsx:51` `window.location.assign("/workspace")` 在 Tauri 生产（browser router + 文件服务）有 404 风险。
- `asset.ts:23-30` 图片 alt 用未消毒原始文件名，含 `]` 生成破损 Markdown；`diagnostics.ts:23-24` FENCE_RE 不允许缩进围栏、IMAGE_REF_RE 对含 `)` 的 URL 截断误报；`richTextHtml.ts:21` TipTap JSON 解析失败静默返回空白 PDF。
- `Tooltip.tsx:17` right 放置下 `center`/`end` class 相同，`align="end"` 为死 API；`Modal.tsx:47,51` 固定 `id="ainote-modal-title"` 多实例重复 id，用 `useId()`；`ui.store.ts` 296 行贴线且 `isLocalStorageAvailable` 与 typography.store 重复；`i18n/messages.ts` 单文件 72KB 建议按域拆分。
- `WorkspaceSidebar.tsx` 事实上的双壳共享组件寄居桌面壳目录，建议上移到中立位置或注释标明。
- `useAnchoredLayer.ts:94` 限高后自然高度永不再测量，值得注释标明假设；`ShellSwitcher.tsx` 文件名与导出组件不一致，`MobileWorkspaceContent.tsx:14` 硬编码 `sidebarWidth={320}`。
- Rust：`note_files.rs:32-38` `write_note` 截断式写，最高频写入值得 tmp+rename 同等待遇；`task.rs:102` `is_due_date` 只校验字符形态放行 `2026-99-99`；`task.rs:55` domain 直接用 `time`/`getrandom` 与「时间注入」自家口径不一致；`llm.rs:58-136` 流式/非流式约 40 行重复可抽助手；`vault_files.rs:69-94` Windows rename 回退分支实为死代码（std 用 MoveFileExW 覆盖）；`git2_rewrite.rs:205` 备份目录名净化后可能碰撞（加 hash 后缀）；`sync_service.rs:176` 与 `:201` 两条冲突解决路径 push 行为不对称，若是设计意图应注释说明；`close_guard.rs:52` 在关闭事件线程上同步 `git status`，大仓库可能卡数百毫秒；`lib.rs:24` `run()` 168 行主要是 `generate_handler!` 样板，建议拆分或规范豁免；`backup_files.rs:165`/`restore_files.rs:177` 逐字节重复的 `hex()` 可收敛。
- 依赖成熟度：`tiptap-markdown ^0.9.0`（0.x 非官方桥接）与 `tauri-plugin-keyring-store 0.2.0`（第三方 crate 经手移动端凭证），建议锁定精确版本并纳入依赖审计。
- `clickDebug.ts:17,45` 生产 webview console 输出调试信息，建议仅 debug 构建启用。
- `recovery_drill.rs:43-56` 用只读权限模拟写失败，root 运行的 CI 容器中权限位不生效会假失败。

---

## 4. 亮点（值得保持的范式）

- **凭证红线完全合规**：`AuthStatusDto`/`AiSettingsDto` 只暴露 `has_token`/`has_key`，token 全程不出 Rust 边界；`bind.rs:18` 先 `strip_userinfo` 防凭证写入 `.git/config`；错误统一过 `redact`（ghp_/github_pat_/sk-/Bearer/URL userinfo 均有测试锁定）。
- **日志脱敏是基础设施而非补丁**：`config/logging.rs` 格式化层统一脱敏 + 前端长度截断 + 诊断包导出二次脱敏，全部有测试。
- **加密实现教科书级**：Argon2id + AES-256-GCM 封装 + AES-SIV 确定性加密 + HKDF 域分隔 + zeroize，解锁失败统一口径防口令探测；`resolve_conflict_file` 在命令层强制防明文覆盖信封（不信任前端 UI 状态）。
- **`client.ts` 错误边界干净彻底**：全仓唯一 invoke 点 + `isAppError` 守卫 + `toUnknownError` 兜底。
- **数据丢失防御体系整体周密**：`draftRegistry` 关窗统一 flush、`isLoaded()` 守卫、locked 翻转处理，均配针对性单测。
- **冲突收尾 push 防循环**：ref 记录「本次确实解决过冲突」只推一次、失败不自动重试，有测试。
- **vault 口令卫生**：口令只存局部 useState、成功即清空、前端无任何口令缓存；前端强度校验与 Rust 同口径。
- **三个 drill 用真实 git 仓库跑端到端**（恢复/加密/性能基线），有效性强于 mock 堆砌；`vault_files::save` 四步持久化 + 崩溃窗口测试是范本。
- **mobile-shell 移动约束系统化**：safe-area、`--kb-inset`、iOS 16px 防缩放、Android 返回键栈，注释说明「为什么」；`back-navigation.ts` 处理器栈连连接中竞态都处理了。
- **i18n 编译期强制双语键位一致**（`Record<keyof typeof zhCN, string>`，实测 806/806 对齐），零运行时成本。
- **测试文化**：Rust 75/197 文件带内联测试且有 `*_tests.rs` 拆分惯例；前端 188 测试文件测行为不测快照；`wiki.test.ts` 索引版 vs 线性扫描版等价性测试是很好的性能防护网。

## 5. 建议行动顺序

1. **本周（安全与不可逆丢失）**：R1（symlink）、R6（明文覆盖信封）、R7（删目录丢文件）。
2. **本周（用户可感知丢稿）**：R3（自动保存停摆）、R4（改名分叉）、R2（草稿覆盖家族）。
3. **下个迭代（工程门禁与并发）**：R8（lint 失效）、R9（close-guard）、R10（Git 互斥）+ 凭证/配置原子写家族（§2.1）。
4. **持续**：wiki/标签口径对齐（§2.3）、IME 守卫、测试缺口补齐（§2.9）、规范漂移文档化（行数口径、错误码域、clippy 配置）。

---

*本报告由 12 路并行分区审查合并去重而成，审查代理逐文件通读了全部源码；🔴 项均有文件:行号与触发场景，可按 §5 顺序直接立项修复。*
