import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply } from '../lib/index.js'

/**
 * Build a minimal Cordis-like context that records registrations and answers
 * optional service injection the way the real registry does (callback runs
 * immediately, effects are collected but not disposed).
 * @param {{tmp: string, answerFirst?: boolean}} options - harness options.
 * @returns {{ctx: object, registered: object}} fake context and its records.
 */
function harness(options) {
  const registered = { tools: [], skills: [], section: undefined }
  const web = {
    calls: [],
    async search(request) {
      web.calls.push(request.query)
      return {
        sources: [
          { url: 'https://example.com/a', title: 'IndexedDB limits', snippet: 'Quota and eviction rules' },
          { url: 'https://example.com/b' },
        ],
        truncated: false,
      }
    },
  }
  const userQuestions = {
    asked: 0,
    async ask({ questions }) {
      userQuestions.asked += 1
      return {
        answers: questions.slice(0, 1).map(question => ({ id: question.id, selected: [question.options[0].label] })),
      }
    },
  }
  const workingDirectory = { ensure: async () => options.tmp }
  const ctx = {
    logger: { warn() {} },
    systemPrompt: { section: value => { registered.section = value } },
    skills: { register: value => { registered.skills.push(value) } },
    tools: { register: value => { registered.tools.push(value) } },
    inject(dependencies, callback) {
      const scope = { effect: execute => execute() }
      for (const dependency of dependencies) {
        if (dependency === 'web') scope.web = web
        else if (dependency === 'userQuestions') scope.userQuestions = userQuestions
        else if (dependency === 'workingDirectory') scope.workingDirectory = workingDirectory
      }
      callback(scope)
    },
  }
  return { ctx, registered, web, userQuestions, workingDirectory }
}

function executeContext() {
  return { agent: {}, signal: new AbortController().signal }
}

test('apply registers the skill, the prompt section, and both tools', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'po-test-'))
  const { ctx, registered } = harness({ tmp })
  apply(ctx, { stateDir: path.join(tmp, 'state'), outputDir: path.join(tmp, 'out') })

  assert.equal(registered.tools.length, 2)
  assert.deepEqual(registered.tools.map(tool => tool.name), ['prompt_organizer_brief', 'prompt_organizer_compose'])
  assert.equal(registered.skills.length, 1)
  assert.equal(registered.skills[0].name, 'prompt-organizer')
  assert.ok(registered.skills[0].content.includes('Prompt Organizer'))
  assert.ok(registered.section.text.includes('prompt-organizer'))
  assert.equal(registered.section.order, 8100)
  for (const tool of registered.tools) {
    assert.equal(typeof tool.execute, 'function')
    assert.equal(typeof tool.output.render, 'function')
    assert.ok(tool.output.schema)
    assert.ok(tool.parameters.properties)
  }
  rmSync(tmp, { recursive: true, force: true })
})

test('brief tool researches, interviews, saves, and renders', async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'po-test-'))
  const { ctx, registered, web, userQuestions } = harness({ tmp })
  apply(ctx, { stateDir: path.join(tmp, 'state'), outputDir: path.join(tmp, 'out') })
  const brief = registered.tools[0]

  const value = await brief.execute(
    { text: '帮我做一个记账工具\n要能在手机上用\n数据别丢\n导出 excel', language: 'zh' },
    executeContext(),
  )
  assert.equal(typeof value.text, 'string')
  assert.ok(value.text.includes('项目类型'))
  assert.ok(web.calls.length >= 1, 'web search ran')
  assert.equal(value.research_count, 2)
  assert.equal(userQuestions.asked, 1)
  assert.equal(value.decision_count, 1)
  assert.ok(value.open_question_count < 4)
  assert.ok(value.saved_path.endsWith('.json'))
  const saved = JSON.parse(readFileSync(value.saved_path, 'utf8'))
  assert.equal(saved.decisions.length, 1)
  assert.equal(saved.research.length, 2)
  rmSync(tmp, { recursive: true, force: true })
})

test('brief tool works without optional services', async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'po-test-'))
  const registered = { tools: [], skills: [], section: undefined }
  const ctx = {
    logger: { warn() {} },
    systemPrompt: { section: value => { registered.section = value } },
    skills: { register: value => { registered.skills.push(value) } },
    tools: { register: value => { registered.tools.push(value) } },
    inject() {},
  }
  apply(ctx, { stateDir: path.join(tmp, 'state'), saveBriefs: false })
  const value = await registered.tools[0].execute({ text: '做一个命令行工具', interview: false }, executeContext())
  assert.equal(value.interview_note, '')
  assert.equal(value.research_count, 0)
  assert.ok(value.research_note.includes('web search is not mounted'))
  rmSync(tmp, { recursive: true, force: true })
})

test('compose tool writes a plan and returns the kickoff', async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'po-test-'))
  const { ctx, registered } = harness({ tmp })
  apply(ctx, { stateDir: path.join(tmp, 'state'), outputDir: path.join(tmp, 'out') })
  const compose = registered.tools[1]

  const value = await compose.execute(
    {
      mode: 'execute',
      title: '记账工具',
      goal: '做一个手机上用的记账工具',
      project_type: 'web-app',
      requirements: ['记录一笔支出', '按月汇总'],
      acceptance: ['能新增一条记录'],
      language: 'zh',
    },
    executeContext(),
  )
  assert.ok(value.path.endsWith('.md'))
  const document = readFileSync(value.path, 'utf8')
  assert.ok(document.startsWith('# 记账工具'))
  assert.ok(document.includes('## 验收标准'))
  assert.ok(value.kickoff.includes('记录一笔支出'))
  assert.ok(value.next.includes('Start now'))
  assert.equal(value.mode, 'execute')
  rmSync(tmp, { recursive: true, force: true })
})

test('brief tool rejects empty text', async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'po-test-'))
  const { ctx, registered } = harness({ tmp })
  apply(ctx, { stateDir: path.join(tmp, 'state') })
  await assert.rejects(() => registered.tools[0].execute({ text: '   ' }, executeContext()), /non-empty `text`/u)
  rmSync(tmp, { recursive: true, force: true })
})
