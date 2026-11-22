/**
 * Brief construction: turn raw notes plus optional interview answers into one
 * structured object that the model can research and compose from.
 * @module prompt-organizer/brief
 */

import { deriveGoal, detectProjectTypes, detectTech, buildQuestions, buildSearchQueries, projectTypeLabel, suggestStack } from './taxonomy.js'
import { shorten, splitFragments } from './text.js'

/** Labels for model-facing brief text. */
const COPY = {
  zh: {
    type: '项目类型',
    confidence: '置信度',
    alternatives: '其他候选类型',
    goal: '目标',
    fragments: '片段数',
    signals: '技术信号',
    stack: '建议技术栈',
    answered: '已确认的决策',
    open: '待确认问题',
    findings: '联网调研结果',
    noFindings: '（本次没有可用的调研结果）',
    queries: '建议检索词',
    researchError: '调研说明',
    next: '下一步',
    options: '选项',
    skipped: '未回答',
  },
  en: {
    type: 'Project type',
    confidence: 'Confidence',
    alternatives: 'Other candidate types',
    goal: 'Goal',
    fragments: 'Fragments',
    signals: 'Technical signals',
    stack: 'Suggested stack',
    answered: 'Resolved decisions',
    open: 'Open decisions',
    findings: 'Web research',
    noFindings: '(no research results available)',
    queries: 'Suggested queries',
    researchError: 'Research note',
    next: 'Next',
    options: 'Options',
    skipped: 'skipped',
  },
}

/**
 * Build the structured brief.
 * @param {{text: string, projectHint?: string, locale?: 'zh'|'en', id: string, now?: Date}} input - raw inputs.
 * @returns {object} brief value.
 */
export function buildBrief(input) {
  const locale = input.locale === 'en' ? 'en' : 'zh'
  const fragments = splitFragments(input.text)
  const goal = deriveGoal(fragments)
  const detection = detectProjectTypes(input.text, input.projectHint)
  const typeId = detection.primary.id
  const tech = detectTech(input.text)
  const questions = buildQuestions(typeId, locale)
  const searchQueries = buildSearchQueries({ typeId, goal, tech, locale })
  const stack = suggestStack(typeId, tech)
  const assumptions = []
  if (typeId === '') assumptions.push(locale === 'en' ? 'Project type was not recognized; treated as general.' : '未能识别项目类型，按通用项目处理。')
  if (tech.length === 0) assumptions.push(locale === 'en' ? 'No technology was named; suggested stack is a default.' : '没有指定技术栈，使用默认建议。')

  return {
    version: 1,
    id: input.id,
    createdAt: (input.now ?? new Date()).toISOString(),
    locale,
    goal,
    fragments,
    projectType: {
      id: typeId,
      label: projectTypeLabel(typeId, locale),
      confidence: detection.confidence,
      score: detection.primary.score,
      matched: detection.primary.matched.filter(entry => entry !== 'hint'),
      alternatives: detection.alternatives.map(entry => ({
        id: entry.id,
        label: projectTypeLabel(entry.id, locale),
        score: entry.score,
      })),
    },
    tech,
    stack,
    assumptions,
    questions,
    searchQueries,
    decisions: [],
    research: [],
    researchNote: '',
  }
}

/**
 * Merge interview answers into the brief.
 * @param {object} brief - the brief to update in place.
 * @param {Array<{id: string, selected: string[], custom?: string}>} answers - answers from the question service.
 * @returns {{answered: number, decisions: Array<{id: string, question: string, answer: string}>}} merge summary.
 */
export function applyAnswers(brief, answers) {
  const list = Array.isArray(answers) ? answers : []
  const applied = []
  for (const answer of list) {
    if (!answer || typeof answer.id !== 'string') continue
    const index = brief.questions.findIndex(question => question.id === answer.id)
    if (index < 0) continue
    const question = brief.questions[index]
    const selected = Array.isArray(answer.selected) ? answer.selected.filter(entry => typeof entry === 'string' && entry !== '') : []
    const custom = typeof answer.custom === 'string' ? answer.custom.trim() : ''
    const parts = [...selected]
    if (custom !== '') parts.push(custom)
    if (parts.length === 0) continue
    const decision = { id: question.id, question: question.question, answer: parts.join(' / ') }
    brief.decisions.push(decision)
    brief.questions.splice(index, 1)
    applied.push(decision)
  }
  return { answered: applied.length, decisions: applied }
}

/**
 * Render the brief for the model: compact, bounded, and shaped like a checklist.
 * @param {object} brief - built brief, possibly enriched by answers and research.
 * @param {{maxFindings?: number, maxQueries?: number}} [options] - bounds.
 * @returns {string} markdown-ish text.
 */
export function renderBrief(brief, options = {}) {
  const copy = COPY[brief.locale] ?? COPY.en
  const maxFindings = options.maxFindings ?? 6
  const lines = []
  lines.push(`${copy.type}: ${brief.projectType.label} (${copy.confidence}: ${brief.projectType.confidence})`)
  if (brief.projectType.alternatives.length > 0) {
    lines.push(`${copy.alternatives}: ${brief.projectType.alternatives.map(entry => entry.label).join(', ')}`)
  }
  lines.push(`${copy.goal}: ${brief.goal === '' ? '—' : brief.goal}`)
  lines.push(`${copy.fragments}: ${brief.fragments.length}`)
  if (brief.tech.length > 0) lines.push(`${copy.signals}: ${brief.tech.join(', ')}`)
  if (brief.stack.length > 0) lines.push(`${copy.stack}: ${brief.stack.join(', ')}`)
  if (brief.assumptions.length > 0) {
    for (const assumption of brief.assumptions) lines.push(`- ${assumption}`)
  }

  if (brief.decisions.length > 0) {
    lines.push('', `${copy.answered} (${brief.decisions.length}):`)
    for (const decision of brief.decisions) lines.push(`- ${decision.question} → ${decision.answer}`)
  }
  if (brief.questions.length > 0) {
    lines.push('', `${copy.open} (${brief.questions.length}):`)
    for (const question of brief.questions) {
      const choices = question.options.map(entry => entry.label).join(' / ')
      lines.push(`- ${question.question} [${copy.options}: ${choices}]`)
    }
  }

  if (brief.research.length > 0) {
    lines.push('', `${copy.findings} (${brief.research.length}):`)
    for (const finding of brief.research.slice(0, maxFindings)) {
      lines.push(`- ${finding.title} — ${finding.url}`)
      if (finding.snippet) lines.push(`  ${shorten(finding.snippet, 160)}`)
    }
  } else {
    lines.push('', `${copy.findings}: ${copy.noFindings}`)
  }
  if (brief.researchNote !== '') lines.push(`${copy.researchError}: ${shorten(brief.researchNote, 200)}`)

  lines.push('', `${copy.queries}:`)
  for (const query of brief.searchQueries.slice(0, options.maxQueries ?? 5)) lines.push(`- ${query}`)
  return lines.join('\n')
}
