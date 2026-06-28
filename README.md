# Synara

Synara 是一款本地优先的桌面应用，通过 **OpenCode 原生 SDK** 在同一工作区中完成 AI 编程协作。

它将聊天、终端、浏览器预览、diff、分支与 OpenCode 会话整合到一个专注的界面中，无需在多个窗口之间来回切换。

![Synara 应用界面：并行 agent 会话、终端输出与项目导航](assets/prod/readme-screenshot.jpeg)

## 功能概览

- **单一 Provider**：仅集成 OpenCode 原生 SDK，无多 provider 切换或 handoff。
- **并行工作**：在同一窗口中跨项目、会话与隔离 Git worktree 并行推进任务。
- **统一视图**：分屏聊天、终端、浏览器预览与 agent 输出同屏可见。
- **Git 工作流**：在应用内查看 diff、创建分支、提交、推送并打开 PR。
- **本地优先**：聊天、项目与历史记录保存在本机；会话流量直连 OpenCode，不经过 Synara 云端。

## 使用方式

> [!WARNING]
> 需要先安装并授权 [OpenCode CLI](https://opencode.ai/docs/)，会话才能正常工作。

从 [Releases 页面](https://github.com/Emanuele-web04/Synara/releases) 安装桌面应用，或访问 [trysynara.com](https://www.trysynara.com/)。

也可以在项目早期阶段本地运行：

```sh
bun install
bun run dev
```

## 隐私

Synara 作为本机工作区层运行，没有 Synara 云端托管你的仓库、聊天或项目历史。

OpenCode 仍会收到会话所需的提示词、文件片段、diff、终端输出或工具结果，但该流量直接发往你所配置的 OpenCode 环境，而非经由独立的 Synara 托管工作区。

## 说明

Synara 仍处于早期阶段，可能存在 bug、体验粗糙与快速迭代的内部实现。

欢迎提交聚焦的 issue 与 PR，尤其是 bug 修复、可靠性改进与小型维护性改动。

## 参与贡献

提交 issue 或 PR 前请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

需要帮助？加入 [Discord](https://discord.gg/jn4EGJjrvv)。

## 起源

Synara 最初 fork 自 [T3Code](https://github.com/pingdotgg/t3code)，此后已发展为独立产品，拥有自有品牌、打包与发布体系、OpenCode 原生集成、桌面端行为与产品方向。

本仓库在 Synara 之上做了 OpenCode-only 与中文 UI 等改造。维护、合并上游功能或 cherry-pick 时，见 **[docs/upstreams.md](./docs/upstreams.md)**（第一上游 Synara，第二上游 T3Code，含 remote 配置与冲突处理原则）。
