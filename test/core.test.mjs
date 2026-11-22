import assert from 'node:assert/strict'
import test from 'node:test'

import { applyAnswers, buildBrief, renderBrief } from '../lib/core/brief.js'
import { buildDocument, detectLanguage } from '../lib/core/compose.js'
import { fileStamp, resolveOutputDir, resolveStateDir, timestampId } from '../lib/core/storage.js'
import { buildQuestions, buildSearchQueries, detectProjectTypes, detectTech } from '../lib/core/taxonomy.js'
import { slugify, splitFragments, uniqueStrings } from '../lib/core/text.js'

test('splitFragments splits, strips list markers, and de-duplicates', () => {
  const fragments = splitFragments('做一个博客\n- 要好看\n1. 要好看\n支持评论。还要深色模式')
  assert.deepEqual(fragments, ['做一个博客', '要好看', '支持评论', '还要深色模式'])
})

test('splitFragments keeps dotted technology names intact', () => {
  assert.deepEqual(splitFragments('用 React.js 做前端'), ['用 React.js 做前端'])
})

test('slugify produces a filesystem-safe slug', () => {
  assert.equal(slugify('我的 Prompt 工具!!'), '我的-prompt-工具')
  assert.equal(slugify('   '), 'prompt')
})

test('uniqueStrings trims and removes case-insensitive duplicates', () => {
  assert.deepEqual(uniqueStrings([' A ', 'a', 'B', '']), ['A', 'B'])
})

test('detectProjectTypes recognizes a DSH plugin from messy notes', () => {
  const result = detectProjectTypes('帮我做一个DSH插件，注册一个新的工具', '')
  assert.equal(result.primary.id, 'dsh-plugin')
  assert.ok(result.primary.score >= 2)
  assert.ok(['high', 'medium'].includes(result.confidence))
})

test('detectProjectTypes lets an explicit hint win', () => {
  const result = detectProjectTypes('做个东西，能跑就行', '命令行工具')
  assert.equal(result.primary.id, 'cli-tool')
})

test('detectTech finds named technologies only', () => {
  assert.deepEqual(detectTech('用 React 和 Vite，后端 Python'), ['React', 'Vite', 'Python'])
  assert.deepEqual(detectTech('做一个记账工具'), [])
})

test('buildQuestions returns four localized decisions with options', () => {
  const questions = buildQuestions('web-app', 'zh')
  assert.equal(questions.length, 4)
  assert.equal(questions[0].id, 'scope')
  assert.ok(questions[0].question.includes('第一版'))
  assert.ok(questions[0].options.length >= 3)
  assert.ok(questions[0].options.every(option => typeof option.label === 'string' && option.label.length > 0))
})

test('buildQuestions falls back to general slots for an unknown type', () => {
  const questions = buildQuestions('unknown-type', 'en')
  assert.equal(questions[0].id, 'scope')
  assert.ok(questions[0].question.includes('first version'))
})

test('buildSearchQueries keeps type-specific queries', () => {
  const queries = buildSearchQueries({ typeId: 'dsh-plugin', goal: '做一个 DSH 插件', tech: [], locale: 'zh' })
  assert.ok(queries.some(query => query.includes('DeepSeek Harness')))
  assert.ok(queries.length <= 5)
  assert.equal(new Set(queries).size, queries.length)
})

test('buildBrief produces a complete brief', () => {
  const brief = buildBrief({
    text: '帮我做一个记账工具\n要能在手机上用\n数据别丢',
    locale: 'zh',
    id: 'po-test',
  })
  assert.equal(brief.id, 'po-test')
  assert.equal(brief.projectType.id, 'web-app')
  assert.ok(brief.goal.length > 0)
  assert.equal(brief.fragments.length, 3)
  assert.ok(brief.questions.length >= 3)
  assert.ok(brief.searchQueries.length >= 2)
  assert.ok(brief.stack.length > 0)
})

test('applyAnswers moves answered questions into decisions', () => {
  const brief = buildBrief({ text: '做一个博客，要好看', locale: 'zh', id: 'po-test' })
  const before = brief.questions.length
  const merged = applyAnswers(brief, [{ id: 'scope', selected: ['核心流程能跑通'], custom: '移动端优先' }])
  assert.equal(merged.answered, 1)
  assert.equal(brief.questions.length, before - 1)
  assert.equal(brief.decisions[0].id, 'scope')
  assert.ok(brief.decisions[0].answer.includes('移动端优先'))
})

test('renderBrief surfaces decisions, gaps, and queries', () => {
  const brief = buildBrief({ text: '做一个记账工具，数据别丢', locale: 'zh', id: 'po-test' })
  applyAnswers(brief, [{ id: 'scope', selected: ['核心流程能跑通'] }])
  brief.research = [{ title: 'IndexedDB 容量', url: 'https://example.com/a', snippet: '容量与清理策略' }]
  const text = renderBrief(brief)
  assert.ok(text.includes('已确认的决策'))
  assert.ok(text.includes('IndexedDB 容量'))
  assert.ok(text.includes('建议检索词'))
})

test('detectLanguage prefers explicit, otherwise inspects content', () => {
  assert.equal(detectLanguage('en', '中文内容'), 'en')
  assert.equal(detectLanguage('', '中文内容'), 'zh')
  assert.equal(detectLanguage('', 'english only'), 'en')
})

test('buildDocument in prompt mode keeps the kickoff and requirements', () => {
  const document = buildDocument({
    mode: 'prompt',
    title: '记账工具',
    goal: '做一个手机上用的记账工具',
    project_type: 'web-app',
    requirements: ['记录一笔支出', '按月份查看汇总'],
    language: 'zh',
  })
  assert.equal(document.mode, 'prompt')
  assert.equal(document.language, 'zh')
  assert.ok(document.markdown.includes('# 记账工具'))
  assert.ok(document.markdown.includes('可直接粘贴的启动提示词'))
  assert.ok(document.kickoff.includes('记录一笔支出'))
  assert.ok(document.sections.includes('已包含的需求'))
})

test('buildDocument plan mode adds acceptance, risks, and DSH constraints', () => {
  const document = buildDocument({
    mode: 'plan',
    title: 'Whale notes plugin',
    goal: 'A DSH plugin that summarizes notes',
    project_type: 'dsh-plugin',
    requirements: ['Register one tool'],
    acceptance: ['The tool appears in a new session'],
    risks: ['Slots change between releases'],
    plan: ['Scaffold the bundle'],
    language: 'zh',
  })
  assert.equal(document.language, 'zh')
  assert.ok(document.markdown.includes('## 验收标准'))
  assert.ok(document.markdown.includes('## 风险与对策'))
  assert.ok(document.markdown.includes('## DSH 插件约束'))
  assert.ok(document.kickoff.includes('install_bundle'))
})

test('buildDocument switches to English and execute mode', () => {
  const document = buildDocument({
    mode: 'execute',
    title: 'Notes tool',
    goal: 'A small notes tool',
    project_type: 'cli-tool',
    requirements: ['Add a note'],
    language: 'en',
  })
  assert.equal(document.mode, 'execute')
  assert.equal(document.language, 'en')
  assert.ok(document.markdown.includes('Ready-to-paste prompt'))
  assert.ok(document.kickoff.includes('senior engineer'))
})

test('storage paths stay inside the configured locations', () => {
  assert.ok(resolveStateDir('').endsWith('prompt-organizer'))
  assert.ok(resolveOutputDir('/work', '').replace(/\\/gu, '/').endsWith('/work/prompt-organizer'))
  assert.match(timestampId(new Date('2026-11-22T17:50:13')), /^po-20261122-175013-[a-z0-9]{4}$/u)
  assert.match(fileStamp(new Date('2026-11-22T17:50:13')), /^20261122-1750$/u)
})
