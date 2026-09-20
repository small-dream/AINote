# AINote — 设备级快速解锁方案（P0）

> 版本：v0.1 · 状态：已实现（macOS / iOS / Android）· 维护：架构师
> 关联：`docs/ENCRYPTED_NOTES_PLAN.md`（加密笔记）、`docs/ARCHITECTURE.md` §5、`docs/PRIVACY.md`

## 0. 一句话需求

输入过一次仓库口令后，用户可以授权「本机用设备级身份验证（Touch ID / Face ID / 指纹 / 设备密码）直接解锁加密笔记」，此后不必重复输入长口令；口令始终保留为唯一的兜底与恢复凭证。

覆盖顺序：**macOS → iOS → Android**（P0）；Windows / Linux 明确不在本次范围（能力探测返回「不支持」，UI 不出现入口）。

## 1. 与既有决策的关系（修订决策 ⑤）

`ENCRYPTED_NOTES_PLAN.md` 决策 ⑤ 原文：**桌面端不提供「记住口令」**，VaultKey 只活在进程内存。

本次修订为：

| 原决策 | 修订后 |
|---|---|
| 桌面端一律不落盘密钥 | 默认仍不落盘；用户**显式开启**设备级快速解锁后，才把仓库主密钥写入**平台安全存储**，且该条目脱离仓库、不随 Git 同步、不跨设备 |
| 移动端可借系统钥匙串免输入 | 移动端同样改为「显式开启 + 生物识别/设备凭证门禁」，不再无条件免输入 |

结论：**快速解锁是可选能力，默认关闭；关闭态与修订前完全一致。**

## 2. 威胁模型变化（必须如实记录）

开启快速解锁后，本机新增如下事实：

- 仓库主密钥存在于平台安全存储（macOS 登录钥匙串 / iOS Keychain / Android Keystore）；**能读该存储的本地进程即可拿到主密钥**，这条防线从「仅进程内存」降为「与 GitHub Token 同一档」。
- 远端仓库、GitHub 网页、第三方 Git 客户端的防护**不变**：`vault.json` 与笔记密文都不含任何设备信息。

各平台的实际强度（同一功能、不同档位，必须写进用户可见说明）：

| 平台 | 存储 | 门禁 | 强度 |
|---|---|---|---|
| iOS | Keychain 通用密码，`kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` + `kSecAccessControlUserPresence` | 系统在读取条目时强制生物识别/设备密码 | 强（硬件绑定，条目不可导出） |
| Android ≥ 9 | Keystore AES 密钥（`setUserAuthenticationRequired(true)`、`setInvalidatedByBiometricEnrollment(true)`）+ 密文写应用私有目录 | `BiometricPrompt(CryptoObject)`：API 30+ 允许生物识别或设备凭证 | 强（密钥不出 TEE/StrongBox） |
| macOS | 登录钥匙串通用密码条目 | 读取后必须通过 `LAContext.evaluatePolicy(.deviceOwnerAuthentication)`（Touch ID 或登录密码） | 中（应用级门禁；未签名构建无法使用带访问控制的钥匙串条目，见 §3） |

macOS 的降级是**实测约束**，不是取舍：

```text
# 本仓库 ad-hoc 签名（tauri.conf.json → bundle.macOS.signingIdentity = "-"）下的实测结果
dp-ac     (kSecUseDataProtectionKeychain + kSecAttrAccessControl): -34018 缺少授权
dp-plain  (kSecUseDataProtectionKeychain):                          -34018 缺少授权
legacy-ac (登录钥匙串 + kSecAttrAccessControl):                     -34018 缺少授权
legacy-plain (登录钥匙串):                                           0 成功
```

带访问控制的钥匙串条目需要开发者签名 + `keychain-access-groups` 授权。代码已按「先尝试带访问控制的条目，失败则回退登录钥匙串 + LAContext 门禁」实现，等 M1.5 完成签名后**无需改代码即可自动升级到硬件门禁**。

## 3. 数据与流程

### 3.1 设备条目（永不同步）

- 条目名：`dev.ainote.app.quickunlock` + `vault-<repo 路径哈希前 16 位>`（同一台机器多仓库互不干扰）。
- 内容：`{"version":1,"vaultFingerprint":"<sha256(wrap.ciphertext) 前 32 hex>","master":"<base64 32B>"}`。
- 设备侧的「是否已开启」标记写在应用配置目录 `quick-unlock/<account>.json`（0600、原子写、不随仓库同步）：状态查询因此**永不触发系统认证弹窗**。
- `vaultFingerprint` 绑定当前 `vault.json` 的 `wrap.ciphertext`：改口令、重建密钥库后指纹变化 → 旧条目自动失效并清除，不存在「用旧密钥打开新笔记」的窗口。

### 3.2 开启 / 关闭 / 解锁

1. **开启**：必须在**已解锁**状态下（主密钥在内存中）→ 系统认证一次 → 写入设备条目；失败即不落盘。
2. **关闭**：删除设备条目与标记，立即回到「每次输入口令」。
3. **解锁**：锁定态点击「用 Touch ID 解锁」→ 系统认证 → 读条目 → 校验指纹 → 建立会话；过程中**不经过口令**。
4. **兜底**：任何一步失败（条目失效、指纹变更、认证取消、用户取消）都只提示，口令输入始终可用；认证取消不显示红色错误。
5. **联动**：建库（新主密钥）清除旧条目；改口令后若已开启则用新指纹重新封装；仓库未启用快速解锁时以上步骤全部跳过。

## 4. 接口

| 层 | 内容 |
|---|---|
| 命令 | `vault_quick_unlock_enable` / `vault_quick_unlock_disable` / `vault_unlock_with_device` |
| 状态 | `vault_status` 增加 `quickUnlockSupported` / `quickUnlockEnabled` / `quickUnlockKind`（`touchId` / `faceId` / `opticId` / `biometric` / `deviceCredential` / `null`） |
| 错误码 | `VAULT_9006` 快速解锁不可用（未开启或条目已失效，需用口令重新解锁并重新开启）；`VAULT_9007` 设备认证被取消（前端静默）；`VAULT_9008` 设备认证失败（可重试或用口令） |
| 平台层 | `platform/quick_unlock`：`DeviceKeyStore` trait（`support` / `store` / `load` / `delete`）+ macOS(iOS) / Android / 不支持 三套实现；服务层只依赖 trait，测试注入 mock |

## 5. 前端交互

- **解锁态（设置页 / 已解锁卡片）**：新增「设备级快速解锁」开关；开启后展示当前设备认证方式（Touch ID / Face ID / 指纹 / 设备密码）与「密钥存放在系统安全存储」的说明。
- **锁定态（设置页 / 全局解锁弹层 / 笔记内嵌解锁卡片）**：已开启时把「用 Touch ID 解锁」放在口令输入之前作为主操作，并且**解锁界面一出现就自动触发一次系统认证**（`useVaultAutoUnlock`），用户不必先点按钮；口令输入保留为兜底。
- **自动触发的闸门**（`stores/vault-unlock.store.ts`，纯 UI 态不落盘）：
  1. 用户主动点「立即锁定」→ **抑制**自动触发，否则弹窗会当场把刚锁上的仓库解开；按钮仍可手动解锁；
  2. 用户取消系统认证（`VAULT_9007`）→ 本次锁定周期内**不再自动重复弹窗**，按钮仍可重试；
  3. 用户重新表达解锁意图（点开加密笔记 / 打开导航轨或移动端解锁入口）或发生**被动锁定**（启动、切仓库、空闲自动锁定）→ 闸门重新放开，下一次解锁界面出现时自动弹；
  4. 多个解锁界面同时挂载（设置页 + 笔记遮罩 + 解锁弹层）时，`consumeAuto()` 原子取用保证**只弹一次**。
- **不支持**：`quickUnlockSupported = false` 时完全不渲染该入口（Windows / Linux / Android < 9）。
- 关闭后立即回到纯口令流程；`VAULT_9007` 不渲染错误文本。
- **认证失败后的口令入口**：口令输入框在所有解锁界面**始终与设备按钮同屏**；设备认证失败（`VAULT_9008`）或条目失效（`VAULT_9006`）时焦点自动移进口令输入框，文案也直接指向「在下方输入仓库口令」，用户不必再找入口。
- **系统弹窗自身的兜底**：macOS 用 `LAContext.deviceOwnerAuthentication`（Touch ID 或登录密码）、iOS 用 `kSecAccessControlUserPresence`（Face ID / Touch ID 或设备密码）、Android 10+ 用 `BIOMETRIC_STRONG | DEVICE_CREDENTIAL`，系统弹窗内自带「使用密码 / 图案」入口；**Android 9（API 28）** 的平台 `BiometricPrompt` 只支持生物识别，此时唯一的兜底就是应用内的仓库口令。

## 6. 明确不做

- Windows（凭据管理器）/ Linux（Secret Service）的等价实现：本次仅保留 trait 接缝，`support()` 返回 false。
- 跨设备共享快速解锁：条目**永不**随 Git 同步，每台设备各自开启。
- 用快速解锁替代口令：口令始终是唯一的恢复凭证，不存在「只用生物识别」的仓库。
- Android < 9（API 27 及以下）：平台 BiometricPrompt/CryptoObject 不可用，直接标记不支持。
- macOS 未签名构建下的硬件级条目绑定（见 §2），等 M1.5 签名落地后自动生效。

## 7. 验证

| 门禁 | 覆盖 |
|---|---|
| `cargo test` | 记录编解码与指纹校验、服务层 enable/disable/unlock 全流程（mock 存储）、失效与取消分支、状态查询不触发认证 |
| `pnpm test` | 开关组件、解锁卡片设备按钮、错误码文案映射（含取消静默） |
| `pnpm test:e2e` | e2e mock 模拟支持设备快速解锁的仓库：开启 → 锁定 → 设备解锁 → 关闭 |
| 交叉编译 | `cargo check --target aarch64-apple-ios`（iOS 钥匙串 + 访问控制路径）与 `cargo check --target aarch64-linux-android`（JNI 桥） |
| 桌面冒烟 | macOS 本机跑通「开启 → 锁定 → Touch ID 解锁」，确认弹窗文案与取消行为 |

## 9. 交付记录

| 项 | 结果 |
|---|---|
| `cargo test` | 425 passed（新增 25 个：领域载荷 / 标记、仓库标记文件、用例开关 / 失效 / 取消 / 瞬时失败分支、平台协议解析、Apple 错误码映射，其中 1 个真机钥匙串用例默认 ignore） |
| `pnpm build` / `pnpm lint` | 通过 |
| `pnpm test` | 1164 passed（新增 `VaultQuickUnlockCard`、`VaultUnlockCard`、`quickUnlock` 纯函数用例） |
| `pnpm test:e2e` | vault-flow 8 passed（新增「开启 → 锁定 → 用 Touch ID 解锁 → 关闭」与「点开加密笔记时自动弹设备认证，无需先点按钮」） |
| `pnpm android:build` | 通过（`app-universal-release.apk` / `.aab`，Kotlin `QuickUnlock.kt` 参与编译） |
| `pnpm desktop:build` | 通过（release 可执行文件，Apple 框架链接正常） |
| macOS 真机钥匙串往返 | 通过（`cargo test -- --ignored apple_keychain`：写入 → 读回 → 删除，含 -34018 回退路径；该用例默认 ignore，因为它会写真实钥匙串） |
| macOS 认证弹窗人工冒烟 | 未在本次无人值守环境执行（会弹出系统 Touch ID 界面）；`load()` 的 LAContext 分支由错误码映射单测与 `support()` 探测覆盖，首次使用建议人工确认一次 |

## 8. 文档同步义务

- `docs/ENCRYPTED_NOTES_PLAN.md`：决策 ⑤ 修订 + 指向本文档。
- `docs/PRD.md`：P2-4 加密笔记补充「设备级快速解锁」业务规则并登记 P0 条目。
- `docs/ARCHITECTURE.md`：§5 增设备密钥存储与平台接缝说明。
- `docs/PRIVACY.md`：增设备条目位置、门禁方式与关闭方式。
- `docs/ROADMAP.md`：登记本次 P0。
- `AGENTS.md`：安全红线补充「设备快速解锁条目」的存续边界。
