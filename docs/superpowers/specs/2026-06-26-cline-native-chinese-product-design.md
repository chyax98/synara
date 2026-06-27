# Synara → Cline 原生中文产品 · 设计文档

**日期**: 2026-06-26
**状态**: 待批准
**作者**: brainstorming 会话产出

---

## 1. 目标

把 Synara 从一个 Codex-first 的多 provider AI 编程桌面应用,改造为一个**基于 Cline SDK 原生内核的中文单 provider 产品**,保留 Synara 的壳(UI、终端、diff、分支、kanban 等交互外壳),内核整体替换为 Cline。

**一句话目标**: 用 Synara 的壳 + Cline 的原生引擎,做一个中文的、支持子智能体和插件生态的 AI 编程桌面应用。

---

## 2. 决策记录与理由

| 决策            | 选择                            | 理由                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 内核            | **Cline SDK** (`@cline/core`)   | Pi Extension 的 subagent/widget 在 Synara Web 壳无法正确渲染(设计为 TUI Ink 组件,与 React DOM 不兼容,实测乱码)。Cline 多 agent 是 SDK 一等公民,plugin 为运行时层(UI 由宿主掌控)。Cline 引擎久经实战,是可导入 coding agent SDK 中综合能力最强的,无更优替代。 |
| 执行方式        | **全量 big-bang,一次性**        | 用户明确:不需要中间可用,只要最终可用。删 provider / 换 Cline / 汉化一次性完成。                                                                                                                                                                             |
| 编排引擎        | **保留** (provider-agnostic)    | ProviderService / orchestration decider-projector-reactor / 持久化是通用引擎,不是"多 provider 抽象"。保留它作为 Cline↔UI 的粘合层。                                                                                                                         |
| handoff         | **删除**                        | Pi-only/Cline-only 下跨 provider 转交无意义。                                                                                                                                                                                                               |
| contracts 收窄  | **激进**                        | `ProviderKind`→单一值,`ModelSelection`→单一 variant,删静态模型目录。                                                                                                                                                                                        |
| 账户级用量      | **删除**                        | Cline 无云端账户用量仪表盘概念。会话内 token 用量由 ClineAdapter 产出,独立路径,不受影响。                                                                                                                                                                   |
| What's New 模块 | **删除**                        | 用户不需要更新日志模块。                                                                                                                                                                                                                                    |
| 国际化          | **直接写死中文**,不搭 i18n 框架 | 无英文用户刚需,避免 1000+ key 抽离的双语 catalog 维护成本。                                                                                                                                                                                                 |
| 日期/数字       | **统一 zh-CN**                  | 中文界面下避免美式格式突兀。                                                                                                                                                                                                                                |
| LLM 输出        | **不翻译**                      | 运行时内容,保留原文。                                                                                                                                                                                                                                       |

---

## 3. 目标架构

```
┌──────────────────────────────────────────────────────────┐
│  Synara 壳 (apps/web, 中文 UI, 日期 zh-CN)                 │
│  React + Vite                                             │
│  新增: 插件 UI 渲染协议 + 子智能体(team)UI                │
└────────────────────────┬─────────────────────────────────┘
                         │ WebSocket (ProviderRuntimeEvent)
┌────────────────────────▼─────────────────────────────────┐
│  编排引擎 (保留, provider-agnostic)                        │
│  ProviderService → orchestration decider/projector/        │
│  reactor → SQLite 持久化 → 统一事件流                      │
│  ProviderKind 收窄为单一字面量                              │
└────────────────────────┬─────────────────────────────────┘
                         │ registry.getByProvider()
┌────────────────────────▼─────────────────────────────────┐
│  ClineAdapter (新建, 唯一 adapter)                         │
│  - 基于 ClineCore (内置编码工具 + session 持久化)           │
│  - 翻译 CoreSessionEvent(agent_event payload) →            │
│    ProviderRuntimeEvent (区分 chunk, 不当文本 delta)         │
│  - 协调 Cline 持久化与 Synara 持久化                        │
│  - 插件 UI 协议桥接                                         │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  @cline/core                                               │
│  MCP + 多agent(AgentTeam) + hooks + 插件(skills/rules/    │
│  workflows) + 多 provider                                  │
└──────────────────────────────────────────────────────────┘
```

---

## 4. 关键接口契约

### 4.1 ClineAdapter 实现的 shape(复用现有 ProviderAdapterShape)

ClineAdapter 必须满足现有 `ProviderAdapterShape`(apps/server/src/provider/Services/ProviderAdapter.ts),这样编排引擎无需改动即可路由。

**API 表面选择**: Cline SDK 有两个 API 表面(由 cline-sdk skill 的决策树明确):

- `Agent`(`@cline/agents`):轻量、内存内、浏览器兼容,**无内置工具**、无持久化 —— ❌ 不适合。
- **`ClineCore`(`@cline/core`)**:完整运行时,**内置文件/bash/搜索工具**、session 持久化、config 发现 —— ✅ **采用**。

选用 `ClineCore` 的根本原因:它自带编码工具(read_file/write_to_file/replace_in_file/execute_command/search_files/list_files),ClineAdapter **无需自己装配工具**。这与 PiAdapter 需从 SDK 装配工具的模式不同,反而更简单。

核心方法映射(以 ClineCore API 为准,实现时读 `references/clinecore/api.md` 核对):

| ProviderAdapterShape 方法         | ClineCore / RuntimeHost 对应                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `startSession(input)`             | `clineCore.startSession(config, prompt)` 或 `runtimeHost.startSession({config, prompt, interactive:false})` |
| `sendTurn(input)`                 | `runtimeHost.sendSession({sessionId, prompt, delivery:"queue"})`                                            |
| `steerTurn(input)`                | `runtimeHost.sendSession({..., delivery:"steer"})`                                                          |
| `interruptTurn(threadId, turnId)` | ClineCore 中断 API(读 `references/clinecore/api.md` 确认方法名)                                             |
| `stopSession(input)`              | `clineCore.dispose()`(skill Critical Rule #6:用完必调 dispose 清理资源)                                     |
| `streamEvents`                    | `clineCore.subscribe(handler)` → `CoreSessionEvent` → 翻译为 ProviderRuntimeEvent                           |

**Spike 前置**: W2 起步时先写最小 ClineCore spike(startSession + 单事件订阅 + 一次 sendSession),验证实际 API 形状再展开。

### 4.2 事件翻译层(ClineAdapter 核心)

ClineCore 产出 `CoreSessionEvent`(`@cline/shared` 定义)。**根据 cline-sdk skill 的 Critical Rule #7**(这是关键修正):

- 用 `clineCore.subscribe()` 得 `CoreSessionEvent`。
- 用户可见文本/推理/工具活动,从 **`"agent_event"` payload** 渲染:`content_start` / `content_update` / `content_end` / `done`。
- **`"chunk"` 事件是原始传输块(`{stream, chunk, ts}`),不可当文本 delta 用** —— 这是易踩的坑,翻译层必须区分。

映射表(以 agent_event payload 为源):

| ClineCore (agent_event payload)                     | Synara ProviderRuntimeEvent                    |
| --------------------------------------------------- | ---------------------------------------------- |
| session 启动                                        | `session.started` + `thread.started`           |
| turn 开始 (content_start, role:assistant)           | `turn.started`                                 |
| `content_update` 文本流                             | `content.delta` (streamKind: "assistant_text") |
| `content_update` 推理流                             | `content.delta` (streamKind: "reasoning_text") |
| 工具调用开始                                        | `item.started` (itemType 按工具映射)           |
| 工具调用结束                                        | `item.completed`                               |
| 子智能体启动 (SubAgentStartContext, 配合 TeamEvent) | `item.started` (itemType: "subagent") **新增** |
| 子智能体结束 / TeamEvent 进度                       | `item.completed` (subagent) + team 进度事件    |
| `done`                                              | `turn.completed`                               |
| token 用量 (SessionUsageSummary)                    | `thread.token-usage.updated`                   |

工具 itemType 映射(沿用 PiAdapter 已建立的映射):`read_file`→read,`write_to_file`/`replace_in_file`→edit,`execute_command`→command_execution,`search_files`/`list_files`→search/listFiles,MCP 工具→dynamic_tool_call。

**这是整个重构工程量最大、风险最高的部分。** 翻译层要处理:`chunk` vs `agent_event` 区分、多 agent/team 事件折叠到单线程 turn 模型、流式缓冲、工具状态机、错误分类。实现时必读 `references/events/REFERENCE.md` 与 `references/multi-agent/REFERENCE.md`。

### 4.3 插件 UI 渲染协议(新增)

Cline plugin 是运行时层,不带 UI。要在 Synara 壳里定义一套"插件如何声明并渲染 UI"的协议。**根据 cline-sdk skill 的 Critical Rule #8/#9**(关键修正):

- ClineCore 的 `extensions` 是 `AgentPlugin`(含 `manifest` + `setup(api, ctx)` + 可选 `hooks`),**与 Agent 的 `plugins` 不可混用**。
- **Plugin skill 是文件式的,非注册式**:插件以 `<package>/skills/<name>/SKILL.md` 形式分发,host 自动发现并暴露为 `/slash-command`,**没有 `registerSkill()`**。ClineAdapter 翻译这些为 Synara 的 `ProviderSkillDescriptor`。
- **配置式子智能体**:`.cline/agents/*.yaml` 文件,启用 `enableSpawnAgent` 后加载成 `subagent_<name>` 工具。**这是子智能体 UI 的接入点** —— 前端读此目录即可列出可用的子 agent。

**协议形态**(实现阶段细化,读 `references/plugins/REFERENCE.md`):

- ClineAdapter 把 Cline 插件(`loadAgentPluginFromPath` / `listPluginTools` 产出)映射为 Synara 的 `ProviderPluginDescriptor` / `ProviderSkillDescriptor`。
- 插件**交互式 UI**(确认/选择/输入)映射到 Cline `ToolApprovalRequest` / Synara 现有 pending user-input 流。
- 插件**富 UI 面板**:新增轻量"插件面板描述"通道,插件产出结构化 JSON(类型+数据),前端用通用渲染器(表格/卡片/markdown)渲染。**不支持插件自由画 React**,只支持受控结构化面板。

### 4.4 持久化协调

两套持久化需要协调:

- **Synara**: SQLite(state.sqlite),orchestration projector 写入线程/消息/活动。
- **Cline**: `SqliteSessionStore` + `SessionVersioningService`(checkpoint)。

**策略**: Synara 的 SQLite 作为**权威历史**(用户看到的线程/消息),Cline 的 session store 作为**运行时游标**(resume/agent 内部状态)。ClineAdapter 在 `startSession` 时用 Synara 传来的 resumeCursor 恢复 Cline session,resumeCursor 存 Cline 的 sessionId/manifestPath。这与 PiAdapter 当前用 Pi `SessionManager` 文件做游标的模式一致。

---

## 5. 删除清单

### 5.1 Server (apps/server/src)

- `provider/Services/{Claude,Codex,Cursor,Gemini,Grok,Kilo,OpenCode,Pi}Adapter.ts` — 删 7 个,保留目录结构
- `provider/Layers/{Claude,Codex,Cursor,Gemini,Grok,OpenCode,Pi}Adapter.ts` — 删 7 个 Layer 实现
- `codexAppServerManager.ts` + `.test.ts` — codex 专属
- `codexErrorClassification.ts`、`codexGeneratedImages.ts`、`codexHomePaths.ts`、`codexProcessEnv.ts`、`codexCliVersion.ts` — codex 专属
- `provider/acp/` 整个目录 — Cursor/Grok 的 ACP 传输
- `provider/geminiAcpProbe.ts`、`geminiValue.ts`、`opencodeRuntime.ts`、`cursorSkillsDiscovery.ts`、`piTurnFailure.ts` — provider 专属
- `provider/providerMaintenance.ts` — 检查是否 provider-specific,若否则留
- `providerUsage/` 整个目录 — 账户级用量
- `orchestration/handoff.ts` + decider 中 `thread.handoff.create` 命令处理 + `ProviderCommandReactor` handoff bootstrap 注入
- DB migration: 评估 `handoff_json` 列是否需新 migration 清理(不删旧 migration,可能加一个 drop)

### 5.2 Web (apps/web/src)

- `whatsNew/` 整个目录 — 更新日志模块
- `lib/threadHandoff.ts`、`hooks/useThreadHandoff.ts`、ChatView/Sidebar 中的 handoff 调用点
- `cursorModelVariants.ts` — cursor 专属
- provider picker(`ProviderModelPicker`、`session-logic.ts` 的 `PROVIDER_OPTIONS`、`providerOrdering.ts`)收窄为单一 Cline provider
- per-provider switch 分支(`composerProviderRegistry.tsx` 的 `getProviderStateFromCapabilities`、`useProviderModelCatalog.ts` 的 8 路模型查询)

### 5.3 Contracts (packages/contracts/src)

- `orchestration.ts`: `ProviderKind` → `Schema.Literal("cline")`(单值);删 7 个非 Cline `*ModelSelection`,`ModelSelection` → 单一 `ClineModelSelection`;`DEFAULT_PROVIDER_KIND = "cline"`。**命名说明**: provider 字面量用 `"cline"`(而非 `"pi"` 或保留 `"codex"`),因内核已是 Cline。新建 `ClineModelSelection` / `ClineModelOptions` / `ClineStartOptions` 取代旧的 Pi/Codex 版本
- `model.ts`: 删 `MODEL_OPTIONS_BY_PROVIDER` 中非 Cline 条目;Cline 模型运行时发现,静态目录可为空或最小
- `providerDiscovery.ts`: `ProviderDiscoveryKind` → 单值
- handoff 相关 schema(`ThreadHandoff`、`ThreadHandoffCreateCommand`)删除

**注意**: 旧的 SQLite 数据里存有 `codex`/`claudeAgent` 等 provider 字面量。收窄后读取旧数据会校验失败。**策略**: provider 字段读取时做一次规范化(旧值 → "cline"),或加 migration 回填。实现阶段定。

---

## 6. 汉化策略

**方式**: 直接修改源码中的英文字符串为中文。不引入 i18n 库,不抽 key。

**范围**(约 1000-1500 字符串,删 What's New 后约 700-1000):

- 所有 UI chrome: 按钮、菜单、标签、设置项、通知、对话框、占位符、空状态文案
- Git 操作面板、分支工具栏、kanban
- 快捷键说明表、slash 命令描述
- server 侧面向用户的活动标签(如 "Command run"、"File change")

**不翻译**:

- LLM/agent 输出(ChatMarkdown 渲染的运行时内容)
- diff、终端输出、代码、文件路径
- 专有名词(provider 名、model slug、命令名)
- 错误堆栈的技术细节

**复数处理**: 中文无复数变化。`packages/shared/src/text.ts` 的 `pluralize()` 及 37 处调用点,改为直接中文(如 `删除 ${count} 个线程`,无需单复数分支)。

**日期/数字格式**: 把 `Intl.DateTimeFormat(undefined, ...)` / `toLocaleString()` 统一改为显式 `"zh-CN"` locale。热点:`timestampFormat.ts`、`profileFormatting.ts`、`BranchToolbarBranchSelector.tsx`、`lib/rateLimits.ts` 等。

---

## 7. 执行顺序(全量 big-bang)

用户要求一次性完成,不保证中间可用。但为保证可定位性,内部按依赖顺序推进(不分阶段交付,只是工作顺序):

**W1. Contracts 收窄(上游,先做)**
`ProviderKind`→`cline`、`ModelSelection` 塌缩、删静态模型目录。此步会让整个项目产生大量类型错误,**这些错误就是后续清理的导航图**。

**W2. Server 删除 + ClineAdapter 新建(并行)**

- 删 7 adapter + codex 子系统 + ACP + providerUsage + handoff
- 先写最小 ClineCore spike(startSession + 单事件订阅 + 一次 sendSession)验证 API,再展开
- 新建 `ClineAdapter`(Services + Layers):基于 **ClineCore**(非 Agent),事件翻译(chunk vs agent_event 区分) + 持久化协调
- `ProviderAdapterRegistry` 只注册 ClineAdapter
- `runtimeLayer.ts` 只装配 ClineAdapter

**W3. Web 清死代码 + provider UI 收窄(并行)**

- 删 whatsNew、handoff UI、cursor 专属
- provider picker 单选化、per-provider switch 收窄
- 顺 W1 的类型错误清理

**W4. Cline 新增 UI**

- 子智能体(team)UI:`AgentTeam` 的成员/任务/进度渲染
- 插件 UI 渲染协议落地

**W5. 汉化 + 日期格式**

- 全 UI 写死中文
- 日期/数字 zh-CN
- pluralize 清理

**W6. 最终验证**
`bun install`(装 @cline/core 等)+ `bun fmt` + `bun lint` + `bun typecheck` + `bun run dev` 跑通。

**期间项目持续处于编译失败状态,直到 W6。** 这是用户接受的。

---

## 8. 风险与对策

| 风险                                                  | 对策                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Cline @cline/core API 在 0.0.x,可能有 breaking change | 锁定具体版本(@cline/core@0.0.51),实现阶段以实际 API 为准;翻译层隔离 Cline 类型,便于跟随升级         |
| 事件翻译层复杂(多 agent/team 折叠到单 turn)           | 先实现单 agent 直通路径(team 数=1),子智能体 UI 作为增强后置;翻译层充分测试                          |
| 两套持久化冲突                                        | Synara SQLite 为权威历史,Cline session store 为运行时游标,resumeCursor 桥接;参考 PiAdapter 现有模式 |
| 旧 SQLite 数据 provider 字段不匹配                    | provider 字段读取规范化或 migration 回填                                                            |
| big-bang 期间长时间不可用、错误难定位                 | 内部仍按 W1-W6 顺序推进(虽不分阶段交付);每完成一个 W 做一次局部编译检查缩小错误范围                 |
| @cline/core 实际 API 与本文档假设不符                 | W2 开始时先写一个最小 ClineAdapter spike(startSession + 单事件订阅),验证 API 形状后再展开           |

---

## 9. 不在本期范围(YAGNI)

- 英文支持 / 多语言切换(无刚需)
- 插件自由画 React(受控结构化面板即可)
- handoff/fork 增强(已删 handoff)
- What's New 模块重建(已删)
- 账户级用量仪表盘(已删,Cline 无此概念)

---

## 10. 成功标准

1. `bun run dev` 启动,前端为全中文界面,日期 zh-CN 格式。
2. 能用 Cline 内核发起会话、收发消息、流式输出、工具调用正确渲染。
3. 子智能体(team)在前端有可见的成员/进度展示。
4. 至少一个 Cline 插件(skill/rule)能被发现并在 UI 中呈现。
5. 代码库中无 codex/claude/cursor/gemini/grok/kilo/opencode/pi 的 provider adapter 残留(类型与文件)。
6. `bun fmt` / `bun lint` / `bun typecheck` / `bun run test` 通过。

---

## 11. 参考资料(Cline SDK 权威知识来源)

本 spec 第 4 节的 API 选择与事件/插件机制,基于 **cline-sdk skill**(GitHub: `cline/sdk-skill`,skill 路径 `skill/cline-sdk/SKILL.md`)的权威文档,而非纯类型推断。实现 ClineAdapter 时按需读取其 references:

| 任务                         | 读取                                           |
| ---------------------------- | ---------------------------------------------- |
| ClineCore 完整 API           | `references/clinecore/REFERENCE.md` → `api.md` |
| 事件流(chunk vs agent_event) | `references/events/REFERENCE.md`               |
| 工具创建/内置工具            | `references/tools/REFERENCE.md`                |
| 插件/扩展/钩子               | `references/plugins/REFERENCE.md`              |
| 子智能体/团队                | `references/multi-agent/REFERENCE.md`          |
| LLM provider 配置            | `references/providers/REFERENCE.md`            |
| 生产部署/可观测              | `references/production/REFERENCE.md`           |

获取方式: `https://raw.githubusercontent.com/cline/sdk-skill/HEAD/skill/cline-sdk/references/<dir>/<file>.md`

**关键决策修正记录**(来自 skill,推翻了纯类型推断的误区):

1. 用 **ClineCore** 而非 `Agent` —— ClineCore 自带内置编码工具与持久化,Agent 无。
2. 事件从 **`agent_event` payload** 渲染,**`chunk` 不是文本 delta**。
3. 插件 skill 是**文件式**(SKILL.md 自动发现),非注册式;配置式子智能体是 `.cline/agents/*.yaml`。
