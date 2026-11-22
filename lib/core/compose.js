/**
 * Document composition: assemble the structured brief into one effective
 * prompt (mode `prompt`) or a reviewable project plan (modes `plan`/`execute`).
 * @module prompt-organizer/compose
 */

import { isCjkText, shorten, uniqueStrings } from './text.js'
import { projectTypeLabel } from './taxonomy.js'

/** Static labels. */
const T = {
  zh: {
    goal: '目标',
    context: '背景与假设',
    stack: '技术栈',
    requirements: '需求',
    must: '必须完成',
    nice: '可选',
    out: '明确不做（Out of scope）',
    constraints: '工程约束',
    research: '调研结论（含来源）',
    plan: '执行计划',
    risks: '风险与对策',
    acceptance: '验收标准',
    dsh: 'DSH 插件约束',
    kickoff: '可直接粘贴的启动提示词',
    included: '已包含的需求',
    meta: 'Prompt Organizer',
    mode: { prompt: '提示词', plan: '项目计划书', execute: '计划书 + 直接开工' },
    empty: '（待补充）',
  },
  en: {
    goal: 'Goal',
    context: 'Context and assumptions',
    stack: 'Stack',
    requirements: 'Requirements',
    must: 'Must have',
    nice: 'Nice to have',
    out: 'Out of scope',
    constraints: 'Engineering constraints',
    research: 'Research (with sources)',
    plan: 'Plan',
    risks: 'Risks',
    acceptance: 'Acceptance criteria',
    dsh: 'DSH plugin constraints',
    kickoff: 'Ready-to-paste prompt',
    included: 'Requirements included',
    meta: 'Prompt Organizer',
    mode: { prompt: 'prompt', plan: 'project plan', execute: 'project plan, build now' },
    empty: '(to be filled in)',
  },
}

/** Constraints that make a DSH plugin deliverable actually installable. */
const DSH_CONSTRAINTS = {
  zh: [
    '以 bundle 形式交付：package.json 声明 `dsh.bundle.patch`，`cordis.patch.yml` 用 `insert` 挂载插件行，`name` 与包名一致。',
    '宿主代码用 ESM，导出 `apply(ctx, config)`；工具用 `ctx.tools.register`，技能用 `ctx.skills.register`，提示词片段用 `ctx.systemPrompt.section`。',
    '本地目录安装：用 plugin_manager 的 `install_bundle` 安装，安装后在新会话验证工具、技能与设置页显示。',
    '提供 `locale/en.json` 与 `locale/zh.json` 的 `meta.title` / `meta.description`、`icon.svg`、`docs` 详情文档。',
    '只 import Node 内置模块或纯类型，避免捆绑依赖导致的解析失败。',
  ],
  en: [
    'Ship a bundle: `package.json` declares `dsh.bundle.patch`, `cordis.patch.yml` inserts the plugin row, and `name` matches the package name.',
    'Host code is ESM exporting `apply(ctx, config)`; register tools with `ctx.tools.register`, skills with `ctx.skills.register`, prompt text with `ctx.systemPrompt.section`.',
    'Install from the local directory with plugin_manager `install_bundle`, then verify tools, skill, and settings display in a new session.',
    'Provide `locale/en.json` and `locale/zh.json` `meta.title` / `meta.description`, an `icon.svg`, and a `docs` detail document.',
    'Import only Node builtins or types; avoid bundled dependencies that fail to resolve.',
  ],
}

/**
 * Pick the output language from an explicit value or the content itself.
 * @param {unknown} explicit - declared language.
 * @param {string} sample - text to inspect.
 * @returns {'zh'|'en'} locale.
 */
export function detectLanguage(explicit, sample) {
  if (explicit === 'zh' || explicit === 'en') return explicit
  return isCjkText(sample) ? 'zh' : 'en'
}

/**
 * Coerce a string or array into a clean string list.
 * @param {unknown} value - candidate.
 * @returns {string[]} list.
 */
function list(value) {
  if (Array.isArray(value)) return uniqueStrings(value)
  if (typeof value === 'string' && value.trim() !== '') return uniqueStrings([value])
  return []
}

/**
 * Build a checkbox block.
 * @param {string[]} items - entries.
 * @returns {string[]} markdown lines.
 */
function checkboxes(items) {
  return items.map(item => `- [ ] ${item}`)
}

/**
 * Build the paste-ready prompt.
 * @param {object} input - normalized composition input.
 * @param {'zh'|'en'} locale - output language.
 * @returns {string} prompt text.
 */
export function buildKickoff(input, locale) {
  const copy = T[locale]
  const lines = []
  if (locale === 'zh') {
    lines.push('你是资深开发工程师。请按下面的项目说明直接开始实现，不需要再向我确认方向；只有会改变架构、成本或不可逆结果的问题才停下来问我，并且一次问清。')
    lines.push('')
    lines.push(`【项目】${input.title}`)
    lines.push(`【目标】${input.goal || copy.empty}`)
    lines.push(`【类型】${input.typeLabel}`)
    lines.push(`【技术栈】${input.stack.length > 0 ? input.stack.join('、') : '未指定：按目标环境选择最稳妥、依赖最少的方案，并说明理由'}`)
    if (input.requirements.length > 0) {
      lines.push('【必须完成】')
      input.requirements.forEach((item, index) => lines.push(`${index + 1}. ${item}`))
    }
    if (input.niceToHave.length > 0) {
      lines.push('【可选】')
      for (const item of input.niceToHave) lines.push(`- ${item}`)
    }
    if (input.outOfScope.length > 0) {
      lines.push('【明确不做】')
      for (const item of input.outOfScope) lines.push(`- ${item}`)
    }
    if (input.constraints.length > 0) {
      lines.push('【工程约束】')
      for (const item of input.constraints) lines.push(`- ${item}`)
    }
    if (input.research.length > 0) {
      lines.push('【调研结论】')
      for (const item of input.research) lines.push(`- ${item}`)
    }
    if (input.acceptance.length > 0) {
      lines.push('【验收标准】')
      for (const item of input.acceptance) lines.push(`- ${item}`)
    }
    if (input.isDshPlugin) {
      lines.push('【DSH 插件约束】')
      for (const item of DSH_CONSTRAINTS.zh) lines.push(`- ${item}`)
    }
    lines.push('')
    lines.push('执行要求：')
    lines.push('1. 先列出 3-6 条 todo，然后立刻开始实现，不要只给方案。')
    lines.push('2. 每完成一步用真实命令验证（构建 / 测试 / 运行），并贴出验证结果。')
    lines.push('3. 不留占位实现、不写“后续补充”；缺信息时按合理默认推进，并标注假设。')
    lines.push('4. 全部完成后汇报：做了什么、怎么运行、验证结果、剩余风险。')
  } else {
    lines.push('You are a senior engineer. Build the project described below now; do not ask me to confirm the direction. Stop and ask only for decisions that change architecture, cost, or are irreversible, and ask them all at once.')
    lines.push('')
    lines.push(`Project: ${input.title}`)
    lines.push(`Goal: ${input.goal || copy.empty}`)
    lines.push(`Type: ${input.typeLabel}`)
    lines.push(`Stack: ${input.stack.length > 0 ? input.stack.join(', ') : 'unspecified — choose the most reliable, least dependent option for the target environment and explain why'}`)
    if (input.requirements.length > 0) {
      lines.push('Must have:')
      input.requirements.forEach((item, index) => lines.push(`${index + 1}. ${item}`))
    }
    if (input.niceToHave.length > 0) {
      lines.push('Nice to have:')
      for (const item of input.niceToHave) lines.push(`- ${item}`)
    }
    if (input.outOfScope.length > 0) {
      lines.push('Out of scope:')
      for (const item of input.outOfScope) lines.push(`- ${item}`)
    }
    if (input.constraints.length > 0) {
      lines.push('Constraints:')
      for (const item of input.constraints) lines.push(`- ${item}`)
    }
    if (input.research.length > 0) {
      lines.push('Research:')
      for (const item of input.research) lines.push(`- ${item}`)
    }
    if (input.acceptance.length > 0) {
      lines.push('Acceptance criteria:')
      for (const item of input.acceptance) lines.push(`- ${item}`)
    }
    if (input.isDshPlugin) {
      lines.push('DSH plugin constraints:')
      for (const item of DSH_CONSTRAINTS.en) lines.push(`- ${item}`)
    }
    lines.push('')
    lines.push('Working rules:')
    lines.push('1. Start with 3-6 todos, then implement immediately; do not stop at a proposal.')
    lines.push('2. Verify every step with a real command (build / test / run) and show the result.')
    lines.push('3. No placeholder implementations and no "to be added later"; choose a defensible default and mark the assumption.')
    lines.push('4. When done, report what was built, how to run it, verification results, and remaining risks.')
  }
  return lines.join('\n')
}

/**
 * Compose one document for the requested mode.
 * @param {object} input - raw tool arguments.
 * @returns {{title: string, mode: 'prompt'|'plan'|'execute', language: 'zh'|'en', markdown: string, kickoff: string, sections: string[], outputName: string}}
 */
export function buildDocument(input) {
  const mode = input.mode === 'plan' || input.mode === 'execute' ? input.mode : 'prompt'
  const titleSource = typeof input.title === 'string' && input.title.trim() !== '' ? input.title.trim() : ''
  const goal = typeof input.goal === 'string' ? input.goal.trim() : ''
  const locale = detectLanguage(input.language, [titleSource, goal, ...(Array.isArray(input.requirements) ? input.requirements : [])].join(' '))
  const copy = T[locale]
  const requirements = list(input.requirements)
  const niceToHave = list(input.nice_to_have)
  const outOfScope = list(input.out_of_scope)
  const stack = list(input.stack)
  const constraints = list(input.constraints)
  const research = list(input.research)
  const acceptance = list(input.acceptance)
  const plan = list(input.plan)
  const risks = list(input.risks)
  const assumptions = list(input.assumptions)
  const typeLabel = projectTypeLabel(input.project_type ?? '', locale)
  const isDshPlugin = input.project_type === 'dsh-plugin'
  const title = titleSource === '' ? (goal === '' ? (locale === 'en' ? 'Untitled project' : '未命名项目') : shorten(goal, 40)) : titleSource

  const normalized = { title, goal, typeLabel, requirements, niceToHave, outOfScope, stack, constraints, research, acceptance, plan, risks, assumptions, isDshPlugin }
  const kickoff = buildKickoff(normalized, locale)

  const blocks = []
  if (mode === 'prompt') {
    blocks.push({ heading: copy.kickoff, content: ['```text', kickoff, '```'] })
    if (requirements.length > 0) blocks.push({ heading: copy.included, content: checkboxes(requirements) })
    if (research.length > 0) blocks.push({ heading: copy.research, content: research.map(item => `- ${item}`) })
  } else {
    blocks.push({ heading: copy.goal, content: [goal === '' ? copy.empty : goal] })
    if (assumptions.length > 0) blocks.push({ heading: copy.context, content: assumptions.map(item => `- ${item}`) })
    if (stack.length > 0) blocks.push({ heading: copy.stack, content: stack.map(item => `- ${item}`) })
    const requirementLines = []
    if (requirements.length > 0) requirementLines.push(`### ${copy.must}`, '', ...checkboxes(requirements), '')
    if (niceToHave.length > 0) requirementLines.push(`### ${copy.nice}`, '', ...niceToHave.map(item => `- ${item}`), '')
    if (outOfScope.length > 0) requirementLines.push(`### ${copy.out}`, '', ...outOfScope.map(item => `- ${item}`), '')
    if (requirementLines.length > 0) blocks.push({ heading: copy.requirements, content: requirementLines })
    if (constraints.length > 0) blocks.push({ heading: copy.constraints, content: constraints.map(item => `- ${item}`) })
    if (research.length > 0) blocks.push({ heading: copy.research, content: research.map(item => `- ${item}`) })
    if (plan.length > 0) blocks.push({ heading: copy.plan, content: plan.map((item, index) => `${index + 1}. ${item}`) })
    if (risks.length > 0) blocks.push({ heading: copy.risks, content: risks.map(item => `- ${item}`) })
    if (acceptance.length > 0) blocks.push({ heading: copy.acceptance, content: checkboxes(acceptance) })
    if (isDshPlugin) blocks.push({ heading: copy.dsh, content: DSH_CONSTRAINTS[locale].map(item => `- ${item}`) })
    blocks.push({ heading: copy.kickoff, content: ['```text', kickoff, '```'] })
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const meta = [copy.meta, stamp, typeLabel, copy.mode[mode]].join(' · ')
  const markdown = [`# ${title}`, '', `> ${meta}`, '', ...blocks.flatMap(block => [`## ${block.heading}`, '', ...block.content, ''])]
  const outputName = title
  return {
    title,
    mode,
    language: locale,
    kickoff,
    sections: blocks.map(block => block.heading),
    outputName,
    markdown: `${markdown.join('\n').replace(/\n{3,}/gu, '\n\n').trimEnd()}\n`,
  }
}
