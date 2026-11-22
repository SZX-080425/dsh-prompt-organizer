/**
 * Project taxonomy: type detection, localized interview questions, and search
 * queries. Everything here is deterministic and offline; the model keeps the
 * authority to override any heuristic.
 * @module prompt-organizer/taxonomy
 */

/** @typedef {{zh: string, en: string}} Localized */

/** @type {(zh: string, en: string) => Localized} */
const L = (zh, en) => ({ zh, en })

/** @type {(zhLabel: string, enLabel: string, zhDescription: string, enDescription: string) => object} */
const option = (zhLabel, enLabel, zhDescription, enDescription) => ({
  label: L(zhLabel, enLabel),
  description: L(zhDescription, enDescription),
})

/**
 * Reusable interview decisions. A project type selects the three or four that
 * actually change its architecture; the first option is the default we
 * recommend when the user skips the question.
 * @type {Record<string, {header: Localized, question: Localized, multiSelect?: boolean, options: object[]}>}
 */
const SLOTS = {
  scope: {
    header: L('成功标准', 'Definition of done'),
    question: L('这个项目第一版做到什么程度，你就认为成功了？', 'What does a successful first version look like?'),
    options: [
      option('核心流程能跑通', 'The core flow works', '先做最小可用版本', 'Smallest usable version first'),
      option('有测试、可复现验证', 'Tested and verifiable', '关键行为都能验证', 'Key behavior has checks'),
      option('能上线给真实用户', 'Ship to real users', '含部署与错误处理', 'Includes deploy and error handling'),
      option('先出原型再决定', 'Prototype first', '只验证想法，不追完成度', 'Validate the idea only'),
    ],
  },
  core_flow: {
    header: L('核心功能', 'Core scope'),
    question: L('第一版必须包含哪些核心功能？', 'Which core capabilities must the first version include?'),
    multiSelect: true,
    options: [
      option('主流程（单条路径）', 'One main path', '跑通一条最短路径', 'Shortest happy path only'),
      option('增删改查', 'CRUD', '完整的数据管理', 'Full data management'),
      option('导入导出', 'Import and export', '数据进出通道', 'Data in and out'),
      option('搜索与筛选', 'Search and filter', '查找已有数据', 'Find existing data'),
    ],
  },
  storage: {
    header: L('数据存储', 'Storage'),
    question: L('数据存在哪里？', 'Where does the data live?'),
    options: [
      option('本地文件或浏览器存储', 'Local files or browser storage', '无需服务端，最省事', 'No server needed'),
      option('SQLite 单文件库', 'Single-file SQLite', '本地部署、易备份', 'Easy to deploy and back up'),
      option('服务端数据库', 'Server database', 'Postgres/MySQL，多用户', 'Multi-user, hosted'),
    ],
  },
  auth: {
    header: L('登录鉴权', 'Auth'),
    question: L('需要登录吗？', 'Does it need sign-in?'),
    options: [
      option('不需要登录', 'No sign-in', '单用户或内网使用', 'Single user or intranet'),
      option('简单账号密码', 'Username and password', '自己管用户表', 'Own user table'),
      option('第三方 / OAuth', 'Third-party / OAuth', '接 GitHub、微信等', 'GitHub, WeChat, etc.'),
    ],
  },
  deploy: {
    header: L('部署环境', 'Deployment'),
    question: L('最终跑在哪里？', 'Where will it run?'),
    options: [
      option('本地开发机', 'Local machine', '自己用，随开随关', 'Personal use'),
      option('内网服务器', 'Internal server', '团队内访问', 'Team access'),
      option('公网云主机 / 静态托管', 'Public cloud or static hosting', '真实用户可访问', 'Real users reach it'),
    ],
  },
  data_source: {
    header: L('数据来源', 'Data source'),
    question: L('数据从哪里来？', 'Where does the data come from?'),
    options: [
      option('本地文件（CSV/JSON/Excel）', 'Local files (CSV/JSON/Excel)', '直接读现有文件', 'Read existing files'),
      option('公开接口或网页抓取', 'Public API or scraping', '外部数据', 'External data'),
      option('内部数据库或已有系统', 'Internal database or existing system', '接已有数据源', 'Existing source'),
    ],
  },
  output: {
    header: L('产出形式', 'Output'),
    question: L('最终产出应该是什么形式？', 'What form should the output take?'),
    options: [
      option('终端文本输出', 'Terminal text', '直接打印结果', 'Print to stdout'),
      option('文件（Markdown/JSON/表格）', 'File (Markdown/JSON/sheet)', '落盘可复用', 'Written for reuse'),
      option('图表或可视化页面', 'Chart or visual page', '给人看的界面', 'A human-facing view'),
    ],
  },
  interface_scope: {
    header: L('接口范围', 'API scope'),
    question: L('对外接口范围大概多大？', 'How large is the public API surface?'),
    options: [
      option('少量接口（1-5 个）', 'A few endpoints (1-5)', '先满足一个调用方', 'One consumer first'),
      option('一组资源（增删改查）', 'A resource group (CRUD)', '标准 REST 形状', 'Standard REST shape'),
      option('多模块、多调用方', 'Multi-module, multi-consumer', '需要版本与权限设计', 'Needs versioning and permissions'),
    ],
  },
  interaction: {
    header: L('交互方式', 'Interaction'),
    question: L('命令行怎么用？', 'How is the command used?'),
    options: [
      option('一次性命令 + 参数', 'One-shot command with flags', '适合脚本调用', 'Easy to script'),
      option('交互式问答', 'Interactive prompts', '逐步引导用户', 'Guided step by step'),
      option('配置文件驱动', 'Config-file driven', '批量、可复现', 'Batch and reproducible'),
    ],
  },
  runtime: {
    header: L('运行时', 'Runtime'),
    question: L('用什么语言和运行时？', 'Which language and runtime?'),
    options: [
      option('Node.js + TypeScript', 'Node.js + TypeScript', '生态最大，DSH 同栈', 'Largest ecosystem, same as DSH'),
      option('Python', 'Python', '数据处理与脚本强', 'Strong for data and scripts'),
      option('其他（Rust/Go/…）', 'Other (Rust/Go/…)', '性能或分发优先', 'Performance or packaging'),
    ],
  },
  distribution: {
    header: L('分发方式', 'Distribution'),
    question: L('别人怎么安装和使用它？', 'How will others install it?'),
    options: [
      option('npm / PyPI 包', 'npm / PyPI package', '标准包管理器安装', 'Standard package manager'),
      option('单文件脚本或可执行文件', 'Single script or binary', '下载即用', 'Download and run'),
      option('仓库内直接使用', 'Used from the repo', '内部工具，不发布', 'Internal only'),
    ],
  },
  extension_point: {
    header: L('扩展点', 'Extension point'),
    question: L('插件主要扩展 DSH 的哪一部分？', 'Which part of DSH does the plugin extend?'),
    options: [
      option('工具（模型可调用）', 'Tools (model-callable)', '给 agent 新能力', 'New agent capability'),
      option('技能（可加载指令）', 'Skills (loadable instructions)', '提示词与流程知识', 'Prompt and workflow knowledge'),
      option('客户端界面（UI 插槽）', 'Client UI (slots)', '设置页或聊天卡片', 'Settings page or chat card'),
      option('组合与配置（bundle 补丁）', 'Composition (bundle patch)', '改变装配与默认值', 'Change wiring and defaults'),
    ],
  },
  trigger: {
    header: L('触发方式', 'Trigger'),
    question: L('希望它什么时候工作？', 'When should it run?'),
    options: [
      option('模型在合适时机主动调用', 'Model invokes it when relevant', '最省心', 'Least user effort'),
      option('用户显式命令或要求', 'User command or explicit request', '行为可预测', 'Predictable'),
      option('定时或事件触发', 'Schedule or event', '后台自动运行', 'Runs in the background'),
    ],
  },
  settings_page: {
    header: L('配置界面', 'Configuration'),
    question: L('需要设置页吗？', 'Does it need a settings page?'),
    options: [
      option('需要设置页', 'A settings page', '可视化的开关与参数', 'Visible switches and values'),
      option('只用配置文件', 'Config file only', '改 cordis.patch.yml 即可', 'Edit cordis.patch.yml'),
      option('不需要配置', 'No configuration', '开箱即用', 'Works out of the box'),
    ],
  },
  target_version: {
    header: L('目标版本', 'Target version'),
    question: L('插件要兼容哪个 DSH 版本？', 'Which DSH version should it target?'),
    options: [
      option('当前安装版本', 'The installed version', '最稳', 'Safest'),
      option('跟随最新发布', 'Latest release', '用新 API', 'Newest APIs'),
      option('不限定，尽量宽松', 'Version-agnostic', '跨版本兼容', 'Portable'),
    ],
  },
  model_provider: {
    header: L('模型来源', 'Model provider'),
    question: L('用哪个模型提供方？', 'Which model provider?'),
    options: [
      option('DeepSeek 官方 API', 'DeepSeek official API', '默认路线', 'The default route'),
      option('OpenAI 兼容接口', 'OpenAI-compatible endpoint', '可换供应商', 'Swap providers'),
      option('本地模型', 'Local model', '隐私优先，成本高', 'Private, heavier'),
    ],
  },
  retrieval: {
    header: L('检索增强', 'Retrieval'),
    question: L('需要接你自己的资料（RAG）吗？', 'Does it need retrieval over your own data?'),
    options: [
      option('不需要，靠模型知识', 'No, model knowledge is enough', '最简单', 'Simplest'),
      option('检索本地文档', 'Retrieve local documents', '把资料放进上下文', 'Documents in context'),
      option('检索在线数据', 'Retrieve live data', '实时外部信息', 'Live external data'),
    ],
  },
  budget: {
    header: L('成本与延迟', 'Cost and latency'),
    question: L('成本和延迟有什么硬约束？', 'Any hard cost or latency constraints?'),
    options: [
      option('响应要快（秒级）', 'Fast (seconds)', '少调用、少上下文', 'Fewer calls, less context'),
      option('成本优先', 'Cost first', '能省则省', 'Cheapest acceptable'),
      option('质量优先，不设限', 'Quality first', '效果最重要', 'Quality is the point'),
    ],
  },
  shell: {
    header: L('桌面壳', 'Desktop shell'),
    question: L('用什么桌面壳？', 'Which desktop shell?'),
    options: [
      option('Electron', 'Electron', '生态成熟、包大', 'Mature, heavy'),
      option('Tauri', 'Tauri', '体积小、需要 Rust', 'Small, needs Rust'),
      option('不打包，跑在浏览器里', 'No shell, browser only', '最省事', 'Least work'),
    ],
  },
  platform: {
    header: L('平台', 'Platform'),
    question: L('要支持哪些平台？', 'Which platforms must work?'),
    options: [
      option('只做 Windows', 'Windows only', '先解决自己的平台', 'Own platform first'),
      option('Windows + macOS', 'Windows and macOS', '桌面双平台', 'Both desktops'),
      option('跨平台 + 移动端', 'Cross-platform and mobile', '范围明显变大', 'Much larger scope'),
    ],
  },
  packaging: {
    header: L('打包', 'Packaging'),
    question: L('安装包做到什么程度？', 'How complete must packaging be?'),
    options: [
      option('能本地构建运行即可', 'Runs from source', '不追求安装包', 'No installer needed'),
      option('一个可下载的安装包', 'One downloadable installer', '双击安装', 'Double-click install'),
      option('自动更新 + 签名', 'Auto-update and signing', '发行级', 'Release grade'),
    ],
  },
  loop: {
    header: L('玩法循环', 'Game loop'),
    question: L('核心玩法循环是什么？', 'What is the core gameplay loop?'),
    options: [
      option('关卡推进', 'Level progression', '一关接一关', 'Level by level'),
      option('资源经营', 'Resource management', '积累与取舍', 'Accumulate and trade off'),
      option('解谜或叙事', 'Puzzle or narrative', '内容驱动', 'Content driven'),
    ],
  },
  art: {
    header: L('美术资源', 'Art'),
    question: L('美术资源怎么来？', 'Where does the art come from?'),
    options: [
      option('占位图形 / 几何风', 'Placeholder or geometric', '先验证玩法', 'Validate gameplay first'),
      option('开源素材', 'Open-source assets', '注意授权', 'Mind the license'),
      option('已有或外包素材', 'Existing or commissioned', '需要接入流程', 'Needs an asset pipeline'),
    ],
  },
  format: {
    header: L('交付格式', 'Format'),
    question: L('最终要什么格式的产出？', 'What format should the deliverable be?'),
    options: [
      option('Markdown 文档', 'Markdown', '好改、好接版本管理', 'Easy to edit and version'),
      option('Word / PPT / PDF', 'Word / PPT / PDF', '给人看的成品', 'Polished for readers'),
      option('网页或可交互页面', 'Web page', '能交互、能分享', 'Interactive and shareable'),
    ],
  },
  audience: {
    header: L('受众', 'Audience'),
    question: L('谁会用这个产出？', 'Who will consume it?'),
    options: [
      option('自己或团队内部', 'Me or my team', '不用过度包装', 'No polish needed'),
      option('客户或领导', 'Clients or leadership', '需要结论先行', 'Conclusion first'),
      option('公开读者', 'Public readers', '需要完整背景', 'Full context needed'),
    ],
  },
  schedule: {
    header: L('运行节奏', 'Cadence'),
    question: L('多久跑一次？', 'How often does it run?'),
    options: [
      option('手动触发', 'Manual', '需要时再跑', 'On demand'),
      option('每天定时', 'Daily', '固定时间更新', 'Fixed time each day'),
      option('持续 / 实时', 'Continuous or realtime', '常驻后台', 'Always running'),
    ],
  },
  environment: {
    header: L('运行环境', 'Environment'),
    question: L('脚本在哪里运行？', 'Where does the script run?'),
    options: [
      option('本机 Windows', 'Local Windows', '自己的电脑', 'Own machine'),
      option('服务器 / Linux', 'Server or Linux', '长期运行', 'Long-running'),
      option('CI 或容器里', 'CI or container', '自动化流水线', 'Automation pipeline'),
    ],
  },
  error_handling: {
    header: L('失败处理', 'Failure handling'),
    question: L('出错时应该怎么办？', 'What should happen on failure?'),
    options: [
      option('记录日志并继续', 'Log and continue', '不中断整体流程', 'Keep the batch going'),
      option('立即停止并报错', 'Stop immediately', '问题越早暴露越好', 'Surface it early'),
      option('重试几次再放弃', 'Retry then give up', '容忍瞬时故障', 'Tolerate transient faults'),
    ],
  },
  scale: {
    header: L('数据规模', 'Scale'),
    question: L('数据量大概多大？', 'How much data is involved?'),
    options: [
      option('很小（几千行以内）', 'Tiny (a few thousand rows)', '全量读进内存', 'Load it all'),
      option('中等（几百万行）', 'Medium (millions of rows)', '需要索引和分页', 'Needs indexes and paging'),
      option('很大，需要专门架构', 'Large, dedicated architecture', '先设计再写代码', 'Design before code'),
    ],
  },
}

/**
 * Supported project types. `slots` names the decisions worth asking about;
 * `stack` is a defensible default when the notes name no technology.
 * @type {Array<{id: string, label: Localized, keywords: string[], stack: string[], slots: string[]}>}
 */
export const PROJECT_TYPES = [
  {
    id: 'dsh-plugin',
    label: L('DSH 插件', 'DSH plugin'),
    keywords: ['dsh插件', 'dsh 插件', '插件', 'plugin', 'bundle', 'cordis', '技能', 'skill', 'mcp', '扩展', 'extension', '工具注册', 'deepseek harness', 'dsh'],
    stack: ['DeepSeek Harness bundle', 'ESM JavaScript', 'cordis.patch.yml'],
    slots: ['extension_point', 'trigger', 'settings_page', 'target_version'],
  },
  {
    id: 'web-app',
    label: L('Web 应用', 'Web app'),
    keywords: ['网页', '网站', '页面', '前端', '后台管理', '仪表盘', 'web', 'website', 'dashboard', '页面应用', '浏览器', '手机', '移动端', '小程序', 'h5', 'app'],
    stack: ['TypeScript', 'React', 'Vite'],
    slots: ['core_flow', 'storage', 'auth', 'deploy'],
  },
  {
    id: 'api-service',
    label: L('接口服务', 'API service'),
    keywords: ['接口', 'api', '后端', '服务端', '微服务', 'endpoint', 'rest', 'graphql'],
    stack: ['TypeScript', 'Fastify', 'SQLite'],
    slots: ['interface_scope', 'auth', 'storage', 'deploy'],
  },
  {
    id: 'cli-tool',
    label: L('命令行工具', 'CLI tool'),
    keywords: ['命令行', 'cli', '终端', '脚本工具', 'terminal', 'command line', '批处理'],
    stack: ['Node.js', 'TypeScript'],
    slots: ['interaction', 'runtime', 'distribution', 'error_handling'],
  },
  {
    id: 'library',
    label: L('库 / SDK', 'Library / SDK'),
    keywords: ['库', 'sdk', '包', '组件库', 'library', 'package', 'npm', 'pip'],
    stack: ['TypeScript', 'ESM'],
    slots: ['runtime', 'distribution', 'audience'],
  },
  {
    id: 'desktop-app',
    label: L('桌面应用', 'Desktop app'),
    keywords: ['桌面', '客户端', 'desktop', 'electron', 'tauri', 'window', '安装包'],
    stack: ['Tauri', 'TypeScript'],
    slots: ['shell', 'platform', 'packaging', 'core_flow'],
  },
  {
    id: 'data-tool',
    label: L('数据工具', 'Data tool'),
    keywords: ['数据分析', '爬虫', '抓取', '可视化', '报表', '统计', 'scrape', 'chart', 'data pipeline', 'dataset'],
    stack: ['Python', 'pandas'],
    slots: ['data_source', 'output', 'schedule', 'scale'],
  },
  {
    id: 'ai-agent',
    label: L('AI / Agent', 'AI / Agent'),
    keywords: ['ai', 'agent', '智能体', '大模型', 'llm', 'rag', '知识库', '提示词', 'prompt', 'chatbot', '对话'],
    stack: ['TypeScript', 'DeepSeek API'],
    slots: ['model_provider', 'retrieval', 'budget', 'error_handling'],
  },
  {
    id: 'game',
    label: L('游戏', 'Game'),
    keywords: ['游戏', 'game', '小游戏', 'unity', 'godot', '玩法'],
    stack: ['TypeScript', 'HTML5 Canvas'],
    slots: ['platform', 'loop', 'art'],
  },
  {
    id: 'doc-content',
    label: L('文档 / 内容', 'Document / content'),
    keywords: ['文档', '报告', 'ppt', '幻灯', '写作', '文章', '演讲', '方案', 'doc', 'report', 'slides', 'writing'],
    stack: ['Markdown'],
    slots: ['format', 'audience', 'output'],
  },
  {
    id: 'automation',
    label: L('自动化脚本', 'Automation script'),
    keywords: ['自动化', '脚本', '定时', '同步', '备份', 'automation', 'script', 'cron', 'backup'],
    stack: ['Python'],
    slots: ['environment', 'schedule', 'error_handling', 'output'],
  },
]

/** Fallback slot order when the notes match nothing specific. */
const GENERAL_SLOTS = ['core_flow', 'output', 'runtime']

/**
 * Technology names worth surfacing and searching for.
 * @type {Array<[string, RegExp]>}
 */
const TECH_SIGNALS = [
  ['React', /\breact(?:\.js)?\b/iu],
  ['Vue', /\bvue(?:\.js)?\b/iu],
  ['Svelte', /\bsvelte\b/iu],
  ['Next.js', /\bnext\.?js\b/iu],
  ['Nuxt', /\bnuxt\b/iu],
  ['Vite', /\bvite\b/iu],
  ['TypeScript', /\btypescript\b|\bts\b/iu],
  ['Node.js', /\bnode(?:\.js)?\b/iu],
  ['Python', /\bpython\b/iu],
  ['FastAPI', /\bfastapi\b/iu],
  ['Flask', /\bflask\b/iu],
  ['Django', /\bdjango\b/iu],
  ['Go', /\bgolang\b|(?<![\w-])go(?![\w-])/iu],
  ['Rust', /\brust\b/iu],
  ['Tauri', /\btauri\b/iu],
  ['Electron', /\belectron\b/iu],
  ['SQLite', /\bsqlite\b/iu],
  ['PostgreSQL', /\bpostgres(?:ql)?\b/iu],
  ['MySQL', /\bmysql\b/iu],
  ['Redis', /\bredis\b/iu],
  ['Docker', /\bdocker\b/iu],
  ['Tailwind CSS', /\btailwind\b/iu],
  ['DeepSeek', /\bdeepseek\b/iu],
  ['OpenAI', /\bopenai\b|\bgpt\b/iu],
  ['MCP', /\bmcp\b/iu],
  ['Flutter', /\bflutter\b/iu],
  ['React Native', /\breact native\b/iu],
  ['Unity', /\bunity\b/iu],
  ['Godot', /\bgodot\b/iu],
]

/** Intent verbs that mark a fragment as the goal rather than a constraint. */
const GOAL_VERBS = /(?:帮我|麻烦|请|我想|我要|想要|需要|做一个|做个|开发|实现|搭建|做一个|设计|写一个|生成|build|create|make|develop|implement|design|write|need|want)/iu

/** Leading filler stripped from a goal to form a searchable topic. */
const LEAD_FILLER = /^(?:帮我|麻烦你?|请|我(?:想|要|需要)?|能否|可以)?\s*(?:做一个?|做个|开发一个?|实现一个?|搭建一个?|设计一个?|写一个?|生成一个?|整理一个?|一个)?\s*/iu

/**
 * Resolve a localized label for one project type.
 * @param {string} id - project type id, or '' for general.
 * @param {'zh'|'en'} locale - output language.
 * @returns {string} human label.
 */
export function projectTypeLabel(id, locale = 'zh') {
  const type = PROJECT_TYPES.find(candidate => candidate.id === id)
  if (!type) return locale === 'en' ? 'General project' : '通用项目'
  return type.label[locale] ?? type.label.en
}

const ASCII_KEYWORD = /^[\x20-\x7e]+$/u

/**
 * Match one keyword: ASCII keywords need word boundaries so "ai" does not fire
 * inside "tailwind", while CJK keywords stay plain substrings.
 * @param {string} haystack - lowercased notes.
 * @param {string} keyword - keyword from the taxonomy.
 * @returns {boolean} whether the keyword appears as a word.
 */
function keywordMatches(haystack, keyword) {
  if (!ASCII_KEYWORD.test(keyword)) return haystack.includes(keyword)
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'iu').test(haystack)
}

/**
 * Score project types against the notes and an optional explicit hint.
 * @param {string} text - the raw notes.
 * @param {string} [hint] - a type or stack the user already named.
 * @returns {{primary: {id: string, score: number, matched: string[]}, alternatives: Array<{id: string, score: number}>, confidence: 'high'|'medium'|'low'}}
 */
export function detectProjectTypes(text, hint = '') {
  const haystack = String(text ?? '').toLocaleLowerCase()
  const hintText = String(hint ?? '').toLocaleLowerCase()
  const scored = []
  for (const type of PROJECT_TYPES) {
    let score = 0
    const matched = []
    for (const keyword of type.keywords) {
      if (!keywordMatches(haystack, keyword)) continue
      score += 1 + Math.min(keyword.length, 8) * 0.08
      matched.push(keyword)
    }
    if (hintText !== '') {
      const hintHit = [type.id, ...type.keywords, type.label.en.toLocaleLowerCase(), type.label.zh]
        .some(token => token !== '' && (hintText.includes(token.toLocaleLowerCase()) || token.toLocaleLowerCase().includes(hintText)))
      if (hintHit) {
        score += 4
        matched.push('hint')
      }
    }
    if (score > 0) scored.push({ id: type.id, score: Math.round(score * 100) / 100, matched })
  }
  scored.sort((left, right) => right.score - left.score)
  const primary = scored[0] ?? { id: '', score: 0, matched: [] }
  const confidence = primary.score >= 2.5 ? 'high' : primary.score >= 1 ? 'medium' : 'low'
  return { primary, alternatives: scored.slice(1, 4), confidence }
}

/**
 * Detect technology names mentioned in the notes.
 * @param {string} text - the raw notes.
 * @returns {string[]} technology names in a stable order.
 */
export function detectTech(text) {
  const haystack = String(text ?? '')
  const found = []
  for (const [name, pattern] of TECH_SIGNALS) {
    if (pattern.test(haystack)) found.push(name)
  }
  return found
}

/**
 * Choose the most goal-like fragment as the project objective.
 * @param {string[]} fragments - ordered fragments from the notes.
 * @returns {string} a short objective, or '' when nothing qualifies.
 */
export function deriveGoal(fragments) {
  const list = Array.isArray(fragments) ? fragments : []
  const verbHit = list.find(fragment => fragment.length >= 6 && GOAL_VERBS.test(fragment))
  const chosen = verbHit ?? list.find(fragment => fragment.length >= 6) ?? list[0] ?? ''
  return chosen.length > 140 ? `${chosen.slice(0, 140)}…` : chosen
}

/**
 * Strip lead-in filler so the objective becomes a usable search topic.
 * @param {string} goal - the derived objective.
 * @returns {string} topic text.
 */
export function deriveTopic(goal) {
  let topic = String(goal ?? '').trim()
  for (let index = 0; index < 2; index += 1) topic = topic.replace(LEAD_FILLER, '').trim()
  topic = topic.split(/[，。,.！!？?；;：:]/u)[0]?.trim() ?? ''
  return topic.length > 28 ? topic.slice(0, 28) : topic
}

/**
 * A defensible default stack when the notes name no technology.
 * @param {string} typeId - project type.
 * @param {string[]} tech - detected technologies.
 * @returns {string[]} stack entries.
 */
export function suggestStack(typeId, tech) {
  if (Array.isArray(tech) && tech.length > 0) return [...tech]
  const type = PROJECT_TYPES.find(candidate => candidate.id === typeId)
  return type ? [...type.stack] : []
}

/**
 * Build the localized interview for one project type.
 * @param {string} typeId - project type id.
 * @param {'zh'|'en'} locale - output language.
 * @param {number} [maximum] - question cap.
 * @returns {Array<{id: string, header: string, question: string, options: Array<{label: string, description: string}>, multi_select?: boolean}>}
 */
export function buildQuestions(typeId, locale = 'zh', maximum = 4) {
  const type = PROJECT_TYPES.find(candidate => candidate.id === typeId)
  const slotIds = ['scope', ...(type?.slots ?? GENERAL_SLOTS)]
  const questions = []
  for (const slotId of slotIds) {
    const slot = SLOTS[slotId]
    if (!slot) continue
    questions.push({
      id: slotId,
      header: slot.header[locale] ?? slot.header.en,
      question: slot.question[locale] ?? slot.question.en,
      options: slot.options.map(entry => ({
        label: entry.label[locale] ?? entry.label.en,
        description: entry.description[locale] ?? entry.description.en,
      })),
      ...slot.multiSelect === true ? { multiSelect: true } : {},
    })
    if (questions.length >= maximum) break
  }
  return questions
}

/** Extra queries per project type, in the right language. */
const TYPE_QUERIES = {
  'dsh-plugin': {
    zh: ['DeepSeek Harness 插件 开发 文档', 'dsh plugin bundle cordis.patch.yml 示例'],
    en: ['DeepSeek Harness plugin development docs', 'dsh plugin bundle cordis.patch.yml example'],
  },
  'web-app': {
    zh: ['Web 应用 技术选型 最佳实践', '前端 项目 目录结构 实践'],
    en: ['web app tech stack best practices', 'frontend project structure conventions'],
  },
  'api-service': {
    zh: ['REST API 设计 规范 最佳实践', '接口 鉴权 限流 设计'],
    en: ['REST API design best practices', 'API auth and rate limiting design'],
  },
  'cli-tool': {
    zh: ['命令行工具 设计 规范', 'CLI 用户体验 最佳实践'],
    en: ['CLI design guidelines', 'CLI user experience best practices'],
  },
  library: {
    zh: ['开源库 设计 原则', 'SDK 版本兼容 策略'],
    en: ['open-source library design principles', 'SDK versioning compatibility strategy'],
  },
  'desktop-app': {
    zh: ['Tauri Electron 对比 选型', '桌面应用 打包 发布'],
    en: ['Tauri vs Electron comparison', 'desktop app packaging and release'],
  },
  'data-tool': {
    zh: ['数据分析 流程 最佳实践', '数据清洗 可视化 方案'],
    en: ['data analysis pipeline best practices', 'data cleaning and visualization approach'],
  },
  'ai-agent': {
    zh: ['LLM Agent 架构 设计', 'RAG 检索增强 实现 方案'],
    en: ['LLM agent architecture design', 'RAG retrieval implementation approach'],
  },
  game: {
    zh: ['小游戏 玩法 设计', 'HTML5 游戏 开发 实践'],
    en: ['small game design fundamentals', 'HTML5 game development practices'],
  },
  'doc-content': {
    zh: ['技术文档 结构 写法', '方案文档 模板'],
    en: ['technical document structure', 'project proposal template'],
  },
  automation: {
    zh: ['自动化脚本 最佳实践', '定时任务 可靠性 设计'],
    en: ['automation script best practices', 'scheduled job reliability design'],
  },
}

/**
 * Build web search queries from the brief.
 * @param {{typeId: string, goal: string, tech: string[], locale: 'zh'|'en'}} input - brief facts.
 * @returns {string[]} up to five queries, most specific first.
 */
export function buildSearchQueries({ typeId, goal, tech, locale = 'zh' }) {
  const topic = deriveTopic(goal)
  const queries = []
  if (topic !== '') {
    queries.push(locale === 'en' ? `${topic} requirements and scope` : `${topic} 需求 范围 设计`)
  }
  for (const extra of TYPE_QUERIES[typeId]?.[locale] ?? []) queries.push(extra)
  if (Array.isArray(tech) && tech.length > 0) {
    queries.push(locale === 'en' ? `${tech[0]} official docs` : `${tech[0]} 官方文档`)
  }
  queries.push(locale === 'en' ? `${projectTypeLabel(typeId, 'en')} best practices 2026` : `${projectTypeLabel(typeId, 'zh')} 最佳实践 2026`)
  const seen = new Set()
  const output = []
  for (const query of queries) {
    const key = query.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(query)
    if (output.length >= 5) break
  }
  return output
}
