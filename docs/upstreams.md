# 上游项目与同步策略

本仓库是 **Synara 的 fork**，在 Synara 之上做了 **OpenCode-only 单 provider** 与 **中文 UI** 等定向改造。日常维护需要同时理解两层上游关系，才能正确 merge、cherry-pick 或手工移植 UI / 架构代码。

## 分支模型

```text
T3Code (pingdotgg/t3code)              ← 第二上游：祖项目 / 底层架构来源
        │ fork
        ▼
Synara (Emanuele-web04/synara)         ← 第一上游：upstream/main
        │ fork
        ▼
chyax98/synara (origin)
        │
        ├── main              ← 跟踪 upstream/main，用于向上游提 PR
        └── opencode/master   ← OpenCode-only + 中文 UI + 个人 fork 改造
```

| 分支              | 跟踪对象        | 用途                                                         |
| ----------------- | --------------- | ------------------------------------------------------------ |
| **`main`**        | `upstream/main` | 与官方 Synara 保持对齐；从该分支切 feature 分支向上游开 PR   |
| **`opencode/master`** | 本地 fork 线 | 日常开发、中文 UI、OpenCode-only 约束；定期 `merge main` 吸收上游 |

**日常开发在 `opencode/master`；要给上游贡献时从 `main` 切分支。**

## 项目谱系

```text
T3Code (pingdotgg/t3code)          ← 第二上游：祖项目 / 底层架构来源
        │ fork
        ▼
Synara (Emanuele-web04/synara)     ← 第一上游：直接上游 / 日常同步对象
        │ fork + OpenCode-only + 中文 UI
        ▼
本仓库 (opencode/master)
```

| 层级         | 仓库                                               | 角色                                                                                          |
| ------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **第一上游** | [Synara](https://github.com/Emanuele-web04/synara) | 产品功能、UI 迭代、release、OpenCode 集成方向；**优先从这里合**                               |
| **第二上游** | [T3Code](https://github.com/pingdotgg/t3code)      | 更底层的 server 模块化、协议、CI/release 骨架；**仅在 Synara 尚未吸收或需要追底层架构时参考** |

README「起源」段与此一致：Synara 从 T3Code fork 后已独立发展，但代码库仍保留大量 `T3CODE_*` 命名与 T3code 风格 server 结构。见 [`docs/server-architecture-migration.md`](./server-architecture-migration.md)。

## Git Remote 配置

当前本机配置：

```sh
git remote -v
# origin    https://github.com/chyax98/synara.git
# upstream  https://github.com/Emanuele-web04/synara.git
```

建议添加第二上游 remote（一次性）：

```sh
git remote add t3code https://github.com/pingdotgg/t3code.git
git fetch t3code
```

| Remote     | 指向              | 用途                                           |
| ---------- | ----------------- | ---------------------------------------------- |
| `origin`   | chyax98/synara    | 推送 `main`、`opencode/master`                 |
| `upstream` | Emanuele-web04/synara | `git fetch upstream`、同步 `main`          |
| `t3code`   | pingdotgg/t3code  | 对照底层架构、cherry-pick 尚未进入 Synara 的改动 |

## 本 fork 相对上游的固定差异

合并任何上游变更前，先假定以下差异**不会**自动兼容，需要人工决策：

### 架构 / 产品方向（故意删掉或锁死）

- **单 provider**：`ProviderKind` 仅 `opencode`；无 provider 切换、handoff、多 runtime 注册表。
- **已删除模块**（勿从上游原样带回）：
  - `apps/server/src/orchestration/handoff.ts`
  - `apps/server/src/providerUsage`
  - `packages/effect-acp`
  - `apps/web/src/whatsNew`
  - 多 provider runtime（Codex / Claude / Cursor / Gemini / Grok / Kilo / Pi 等）
- **AppSettings v2**（`synara:app-settings:v2`）：已去掉各 legacy provider 路径字段；见 `apps/web/src/appSettings.ts`。
- **中文 UI**：部分文案已本地化；合并 Synara 英文改动时优先保留中文。

### 仍与 T3Code 共享的部分

- Server 入口与 WebSocket 协议形状（`wsServer.ts`、`packages/contracts`）
- `T3CODE_*` 环境变量（dev runner、终端托管等）——脚本层已用 `SYNARA_*` 封装，见 `scripts/dev-local.sh`
- Release / desktop 打包骨架（见 [`docs/release.md`](./release.md)）

静态校验脚本会在合并后快速暴露架构偏离：

```sh
bun run test:capabilities
# 或
bash scripts/test-capabilities.sh
```

其中 `scripts/verify-opencode-native.ts` 与 `scripts/check-opencode-remnants.ts` 专门守卫 OpenCode-only 约束。

## 从哪个上游拿什么

### 优先：Synara (`upstream`)

适合 **整段 merge** 或 **按 commit cherry-pick** 的场景：

| 类型          | 示例                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| UI / UX       | 右侧 dock 资源管理器、transcript 滚动、sidebar、composer、disclosure 动效 |
| 产品功能      | 桌面行为、通知、设置项、explorer、diff / git 面板                         |
| OpenCode 路径 | provider 发现、compact / queue、orchestration 投影                        |
| 缺陷修复      | 任何不依赖「恢复第二 provider」的 fix                                     |

**同步上游到 `main`，再合入 fork：**

```sh
git fetch upstream
git checkout main
git merge upstream/main

git checkout opencode/master
git merge main
# 解决冲突后
bun run test:capabilities
bun fmt && bun lint && bun typecheck && bun run test
```

**Cherry-pick 单个 Synara PR/commit 到 fork：**

```sh
git fetch upstream
git checkout opencode/master
git cherry-pick <commit-sha>
```

## 向上游 Synara 提 PR

`main` 已与 `upstream/main` 对齐，适合作为贡献基线：

```sh
git fetch upstream
git checkout main
git merge upstream/main

git checkout -b feat/my-upstream-fix main
# 实现改动，或从 opencode/master cherry-pick 可上游化的 commit
git push origin feat/my-upstream-fix
```

在 GitHub 上对 **Emanuele-web04/synara** 开 PR（base: `main`）。

注意：

- 只提交**不依赖 OpenCode-only 裁剪**、**不含中文 UI 专属改动**的 commit。
- 多 provider、handoff 等上游仍保留的能力不要删掉。
- PR 合并后：`git fetch upstream && git checkout main && git merge upstream/main`，再 `git checkout opencode/master && git merge main`。

冲突时原则：

1. **保留 OpenCode-only**——丢弃多 provider 注册、handoff、provider 切换 UI。
2. **保留中文**——Synara 新增英文字符串时改为中文或走 i18n（若后续引入）。
3. **优先采用 Synara 的 transcript / scroll / reliability fix**——见 AGENTS.md Transcript Performance Guardrails。
4. **UI 动效** 必须复用 `apps/web/src/lib/disclosureMotion.ts`，不要带入上游的一次性 transition。

### 次要：T3Code (`t3code`)

仅在以下情况参考或 cherry-pick：

| 类型                  | 示例                                                                   |
| --------------------- | ---------------------------------------------------------------------- |
| Server 模块化         | `apps/server/src/http.ts` 拆分、`orchestration/` / `persistence/` 边界 |
| 协议 / contracts 清理 | `packages/contracts` 拆分、WS 方法表整理                               |
| CI / devex            | workflow、release 脚本（需改品牌为 Synara）                            |
| 性能 / 可靠性         | 与 provider 种类无关的 wsServer、SQLite、重连逻辑                      |

**不要**从 T3Code 直接合并：

- 多 provider UI 与设置
- `effect-acp`、handoff、provider usage 仪表板
- 与 Synara 产品方向冲突的桌面 / 品牌逻辑

T3Code 变更往往还需再过一层 Synara 的消化；**默认等 Synara 合并后再从 Synara 拿**，可减少双倍冲突。

对照两个上游同一文件：

```sh
git fetch upstream t3code
git diff upstream/main t3code/main -- apps/server/src/wsServer.ts
git log --oneline upstream/main..t3code/main -- apps/server/
```

## 推荐同步节奏

1. **定期**（例如每个 Synara release tag）：`main` 合并 `upstream/main`，再 `opencode/master` 合并 `main`。
2. **按需**：对单个修复 `git cherry-pick <sha>` 到 `opencode/master`，在 commit message 里注明来源 PR。
3. **手工移植**：大改 UI 或架构时，在 upstream 查实现，在 `opencode/master` 用 OpenCode-only 约束重写，比硬 merge 更省冲突。
4. **T3Code**：仅当 Synara 长期未跟进的 server 架构项阻塞你时再直接 pick；pick 后更新 [`docs/server-architecture-migration.md`](./server-architecture-migration.md) 的进度备注。

## 当前同步快照（维护者更新）

| 项                                   | 状态                                                          |
| ------------------------------------ | ------------------------------------------------------------- |
| 第一上游最新 tag                     | `v0.3.6`（`f1aa6295`）                                        |
| `main` 相对 `upstream/main`          | 0 ahead, 0 behind（2026-07-01 重组后对齐）                    |
| `opencode/master` 分叉点             | 在 `upstream/main` 之上叠加 39 个 fork commit（至 `787d7865`） |
| 分支重组                             | `main` → 上游跟踪线；fork 工作迁至 `opencode/master`          |

更新合并后请改上表日期与 commit，便于下次判断从哪条基线继续。

## 合并后检查清单

```sh
# 1. 架构守卫
bun run test:capabilities

# 2. 全量质量门（发版前）
bun fmt && bun lint && bun typecheck && bun run test

# 3. 本地冒烟（需实例时）
./scripts/dev-local.sh --restart
# 浏览器打开 http://localhost:5733
# 资源管理器、发消息、右侧 dock、compact/queue 场景
```

## 相关文档

- [`README.md`](../README.md) — 产品定位与起源
- [`docs/server-architecture-migration.md`](./server-architecture-migration.md) — T3code → 模块化 server 迁移清单
- [`docs/release.md`](./release.md) — 发布流程（Synara 品牌，T3Code 架构同源）
- [`AGENTS.md`](../AGENTS.md) — Agent 开发约束与 transcript 规则
- `scripts/dev-local.sh` — 单实例本地开发
- `scripts/test-capabilities.sh` — 合并后快速能力探测
