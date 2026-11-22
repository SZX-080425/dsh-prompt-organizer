# Prompt Organizer · 提示词整理器

> 把一堆零碎、矛盾、说不清的需求，整理成**一段能直接用的提示词**或**一份能开工的项目计划书**。

DeepSeek Harness 插件。它不替你写代码，它负责在你和代码之间补上最容易被跳过的那一步：**把想法变成可执行的任务描述**。

[English](README.en.md) · [MIT](LICENSE)

---

## 它解决什么问题

你是这样提需求的：

```
帮我做个记账的小工具
要能在手机上用
最好能自动识别截图里的账单
数据别丢
下周要用
```

直接丢给 agent，它只能猜。猜错方向，你要在几百行代码之后才发现。

装上这个插件后，同样一段话会变成：

```
项目类型：Web 应用（置信度：高）
目标：做一个能在手机上使用的记账工具，支持自动识别账单截图
已确认的决策：
- 第一版成功标准 → 核心流程能跑通
- 数据存储 → 本地文件或浏览器存储
- 需要登录吗 → 不需要登录
技术栈：TypeScript、React、Vite
待确认问题：（0）
联网调研：3 条（IndexedDB 容量限制、移动端图片上传压缩方案……）

→ 输出：prompt-organizer/记账工具-20261122-1750.md
```

其中的提问、调研、成文都由插件完成，你只需要点选项、看一眼结果。

## 工作流

```
凌乱输入 ──① 结构化简报──② 联网调研──③ 向你提问──④ 成文/开工──> 可执行任务
             (判定类型/抽目标)   (官方文档/最佳实践)   (关键决策)      (提示词/计划书)
```

1. **brief** — `prompt_organizer_brief` 拆句、去重、判定项目类型（12 类）、提取技术信号和缺口，并生成检索词；
2. **research** — 插件通过 `ctx.web` 直接联网搜索，把带来源的结论写进简报（不可用时退回 `web_search` 工具）；
3. **interview** — 通过 DSH 的提问卡片问你 3-4 个真正会改变架构的问题（数据放哪、要不要登录、部署在哪……），答案并入简报；
4. **compose** — `prompt_organizer_compose` 产出三种成品之一：
   - `prompt`：一段自包含、可直接粘贴到新会话的提示词；
   - `plan`：带需求、方案、执行计划、验收标准、风险的项目计划书；
   - `execute`：计划书 + 立刻开始实现的交接（agent 直接建 todo 开工）。

## 安装

**方式一：插件市场 / 本地目录（推荐）**

在 DSH 的 **设置 → 插件 → 添加插件** 里选择本仓库目录。

**方式二：命令行**

```bash
git clone https://github.com/SZX-080425/dsh-prompt-organizer.git
dsh plugin --profile desktop add "link:/absolute/path/to/dsh-prompt-organizer"
```

安装后新开一个会话即可生效（插件行、技能 `prompt-organizer`、两个工具、以及一段系统提示片段会被注册）。

## 使用

直接用自然语言，不需要记命令：

```
帮我把这些零碎的想法整理成提示词：<一段凌乱的描述>
```

```
把这些需求写成一份开发计划书，然后直接开始做
```

模型会加载 `prompt-organizer` 技能，依次调用两个工具，中途弹出问题卡片。

成品默认写到工作区的 `prompt-organizer/<标题>-<时间>.md`，简报 JSON 存放在 `~/.dsh/prompt-organizer/briefs/`。

## 工具

| 工具 | 作用 | 关键参数 |
| --- | --- | --- |
| `prompt_organizer_brief` | 凌乱输入 → 结构化简报（类型、目标、缺口、检索词、调研、决策） | `text`（必填，原文照搬）、`project_hint`、`language`、`interview`、`research` |
| `prompt_organizer_compose` | 简报 → 提示词 / 计划书 / 开工交接，并写入 Markdown 文件 | `mode`、`title`、`goal`、`project_type`、`requirements`、`stack`、`research`、`acceptance`、`plan`、`output_path` 等 |

支持的项目类型：DSH 插件、Web 应用、接口服务、命令行工具、库/SDK、桌面应用、数据工具、AI/Agent、游戏、文档内容、自动化脚本，以及通用兜底。

## 配置

写在 profile 的 `cordis.patch.yml` 里，覆盖 `prompt-organizer` 行：

```yaml
- id: prompt-organizer
  config:
    promptSection: true   # 是否注入一段系统提示片段（默认 true）
    interview: true       # brief 默认是否弹出提问（默认 true）
    research: true        # brief 默认是否联网搜索（默认 true）
    saveBriefs: true      # 是否把简报 JSON 存到 ~/.dsh/prompt-organizer（默认 true）
    stateDir: ""          # 简报目录，默认 ~/.dsh/prompt-organizer
    outputDir: ""         # 成品目录，默认 <工作区>/prompt-organizer
    maxQuestions: 4       # 最多问几个问题（1-6）
    maxSearchQueries: 3   # 最多用几条检索词（1-5）
```

## 设计边界

- **不调用额外模型**：所有判断由当前会话的模型完成，插件只负责结构、提问、检索与落盘；因此不会产生额外 token 账单。
- **搜索是尽力而为**：没有可用搜索 provider 时，简报会返回检索词并提示模型改用 `web_search`，不会编造结论。
- **提问依赖 DSH 提问界面**：headless 或子 agent 里无法弹窗，插件会把未决问题交回给模型，让它一次性转达。
- **调研结论有出处**：每条调研都带 URL；没有出处的事实只能以 `[assumed]` 标注。
- **计划书是文档不是合同**：真正开工时仍以你的确认为准（除非你选了 `execute`）。

## 目录结构

```
lib/index.js            插件入口：技能、提示片段、两个工具
lib/core/taxonomy.js    12 类项目、提问库、检索词
lib/core/brief.js       简报构建、答案合并、模型可读渲染
lib/core/compose.js     提示词 / 计划书渲染
lib/core/storage.js     路径与落盘
skill/prompt-organizer.md  技能正文（四阶段工作流）
locale/{en,zh}.json     插件市场显示名与描述
docs/                   详情页图
test/                   纯函数单元测试
```

## 开发

```bash
node --test test/
node --check lib/index.js
```

## License

[MIT](LICENSE)
