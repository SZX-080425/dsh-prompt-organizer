/**
 * Prompt Organizer — DSH bundle Host plugin.
 *
 * Registers one skill (`prompt-organizer`), one short system-prompt section,
 * and two tools that do the deterministic work:
 *   - `prompt_organizer_brief`  : notes → structured brief (+ optional web research and interview)
 *   - `prompt_organizer_compose`: brief → paste-ready prompt / project plan / build handoff
 *
 * The model keeps the judgment; the plugin owns shape, persistence, and the
 * question + search round trips.
 * @module dsh-prompt-organizer
 */

import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyAnswers, buildBrief, renderBrief } from './core/brief.js'
import { buildDocument, detectLanguage } from './core/compose.js'
import { fileStamp, resolveOutputDir, resolveStateDir, timestampId, writeTextFile, expandHome } from './core/storage.js'
import { projectTypeLabel } from './core/taxonomy.js'
import { isRecord, shorten, slugify } from './core/text.js'

const SKILL_NAME = 'prompt-organizer'
const SKILL_URL = new URL('../skill/prompt-organizer.md', import.meta.url)

const SKILL_DESCRIPTION = 'Turn rough, fragmented, contradictory project notes into one effective prompt or project plan: structure a brief, research the web, ask the decisive questions, then compose. Use when the user pastes messy requirements or asks to organize a prompt, write a project plan, or start building from a vague idea.'

const SECTION_TEXT = [
  '## Prompt organizer',
  'When the user hands over fragmented, contradictory, or unfinished requirements for something they want built, do not improvise. Load the `prompt-organizer` skill and run its brief → research → interview → compose flow before writing code.',
].join('\n')

const BRIEF_NEXT = "Next: fold the answers into decisions, add any research you still need (the findings above are already usable), then call prompt_organizer_compose with mode 'prompt', 'plan', or 'execute'."

/** Bundle configuration with defaults; unknown keys are ignored. */
function normalizeConfig(config) {
  const value = isRecord(config) ? config : {}
  return {
    promptSection: value.promptSection !== false,
    interview: value.interview !== false,
    research: value.research !== false,
    saveBriefs: value.saveBriefs !== false,
    stateDir: typeof value.stateDir === 'string' ? value.stateDir : '',
    outputDir: typeof value.outputDir === 'string' ? value.outputDir : '',
    maxQuestions: Number.isInteger(value.maxQuestions) && value.maxQuestions > 0 && value.maxQuestions <= 6 ? value.maxQuestions : 4,
    maxSearchQueries: Number.isInteger(value.maxSearchQueries) && value.maxSearchQueries > 0 && value.maxSearchQueries <= 5 ? value.maxSearchQueries : 3,
  }
}

/**
 * Read one optional Cordis service without failing activation.
 * @param {object} ctx - plugin context.
 * @param {string} name - service name.
 * @returns {any} the service or undefined.
 */
function readService(ctx, name) {
  try {
    return ctx[name] ?? undefined
  } catch {
    return undefined
  }
}

/**
 * Bind an optional service into a store held by the tools.
 *
 * Cordis refuses property access for services a plugin did not inject, so an
 * optional dependency needs its own injected scope: the callback runs when the
 * service appears and its cleanup clears the stored reference when it leaves.
 * @param {object} ctx - plugin context.
 * @param {string} name - service name.
 * @param {Record<string, any>} store - shared holder read at tool execution time.
 * @returns {void}
 */
function bindOptional(ctx, name, store) {
  try {
    ctx.inject([name], (scope) => {
      const service = scope[name]
      store[name] = service
      scope.effect(() => () => {
        if (store[name] === service) store[name] = undefined
      })
    })
  } catch (error) {
    warn(ctx, `prompt-organizer: optional service "${name}" is unavailable (${errorMessage(error)})`)
  }
}

/**
 * Logger-safe warning.
 * @param {object} ctx - plugin context.
 * @param {string} message - text.
 * @returns {void}
 */
function warn(ctx, message) {
  try {
    const logger = readService(ctx, 'logger')
    if (logger !== undefined && typeof logger.warn === 'function') logger.warn(message)
    else console.warn(message)
  } catch {
    /* logging must never break activation */
  }
}

/**
 * Normalize an unknown thrown value.
 * @param {unknown} error - failure.
 * @returns {string} message.
 */
function errorMessage(error) {
  if (error instanceof Error) return error.message
  return String(error ?? 'unknown error')
}

/**
 * Ask the user the open decisions through the question surface, when present.
 * @param {Record<string, any>} optional - bound optional services.
 * @param {object} exec - tool execution context.
 * @param {Array<object>} questions - localized questions.
 * @returns {Promise<{answers: Array<object>, error: string}>} answers or a reason.
 */
async function askQuestions(optional, exec, questions) {
  const service = optional.userQuestions
  if (service === undefined || typeof service.ask !== 'function') {
    return { answers: [], error: 'no interactive question surface in this deployment; relay the open questions to the user instead' }
  }
  try {
    const result = await service.ask({
      questions,
      ...(exec.agent === undefined ? {} : { agent: exec.agent }),
      signal: exec.signal,
    })
    return { answers: Array.isArray(result?.answers) ? result.answers : [], error: '' }
  } catch (error) {
    return { answers: [], error: `the user did not answer (${errorMessage(error)})` }
  }
}

/**
 * Combine the caller's cancellation with a soft deadline.
 * @param {AbortSignal|undefined} signal - caller signal.
 * @param {number} milliseconds - budget.
 * @returns {AbortSignal|undefined} combined signal.
 */
function withDeadline(signal, milliseconds) {
  try {
    if (typeof AbortSignal.timeout !== 'function') return signal
    const deadline = AbortSignal.timeout(milliseconds)
    if (signal !== undefined && typeof AbortSignal.any === 'function') return AbortSignal.any([signal, deadline])
    return signal ?? deadline
  } catch {
    return signal
  }
}

/**
 * Display a host name for a URL that has no title.
 * @param {string} url - source URL.
 * @returns {string} short label.
 */
function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return shorten(url, 40)
  }
}

/**
 * Search the web for the brief's queries.
 * @param {Record<string, any>} optional - bound optional services.
 * @param {string[]} queries - search queries.
 * @param {AbortSignal|undefined} signal - caller cancellation.
 * @returns {Promise<{findings: Array<object>, note: string}>} findings and a note.
 */
async function runResearch(optional, queries, signal) {
  const web = optional.web
  if (web === undefined || typeof web.search !== 'function') {
    return { findings: [], note: 'web search is not mounted in this deployment; run web_search yourself with the queries below' }
  }
  const findings = []
  const seen = new Set()
  const failures = []
  for (const query of queries) {
    if (signal?.aborted === true) break
    try {
      const result = await web.search({ query, maxResults: 3 }, withDeadline(signal, 20000))
      const sources = Array.isArray(result?.sources) ? result.sources : []
      for (const source of sources.slice(0, 3)) {
        const url = typeof source?.url === 'string' ? source.url : ''
        if (url === '' || seen.has(url)) continue
        seen.add(url)
        findings.push({
          title: shorten(typeof source.title === 'string' && source.title !== '' ? source.title : hostOf(url), 100),
          url,
          snippet: shorten(source.snippet ?? source.summary ?? '', 220),
          query,
        })
        if (findings.length >= 6) break
      }
    } catch (error) {
      failures.push(`${query}: ${errorMessage(error)}`)
    }
    if (findings.length >= 6) break
  }
  let note = ''
  if (findings.length === 0) {
    note = failures.length > 0
      ? `web search returned nothing usable (${shorten(failures[0], 160)}); run web_search yourself`
      : 'web search returned no results; run web_search yourself with different queries'
  }
  return { findings, note }
}

/**
 * Resolve the session working directory for output files.
 * @param {Record<string, any>} optional - bound optional services.
 * @param {object} exec - tool execution context.
 * @returns {Promise<string>} absolute directory.
 */
async function resolveCwd(optional, exec) {
  const service = optional.workingDirectory
  if (service !== undefined && typeof service.ensure === 'function' && exec.agent !== undefined) {
    try {
      const directory = await service.ensure(exec.agent, exec.signal)
      if (typeof directory === 'string' && directory.trim() !== '') return directory
    } catch {
      /* fall through to the agent hints and the home directory */
    }
  }
  const agent = exec.agent
  const candidates = [agent?.cwd, agent?.workingDirectory, agent?.session?.header?.cwd, agent?.session?.header?.directory]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate !== '' && path.isAbsolute(candidate)) return candidate
  }
  return os.homedir()
}

/** Output schema shared by both tools: a rendered block plus structured facts. */
const BRIEF_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    text: { type: 'string' },
    brief_id: { type: 'string' },
    saved_path: { type: 'string' },
    project_type: { type: 'string' },
    project_type_label: { type: 'string' },
    confidence: { type: 'string' },
    goal: { type: 'string' },
    fragment_count: { type: 'integer' },
    decision_count: { type: 'integer' },
    open_question_count: { type: 'integer' },
    research_count: { type: 'integer' },
    interview_note: { type: 'string' },
    research_note: { type: 'string' },
    next: { type: 'string' },
  },
  required: ['text'],
}

const COMPOSE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    text: { type: 'string' },
    path: { type: 'string' },
    mode: { type: 'string' },
    title: { type: 'string' },
    language: { type: 'string' },
    kickoff: { type: 'string' },
    sections: { type: 'array', items: { type: 'string' } },
    next: { type: 'string' },
  },
  required: ['text'],
}

/**
 * Render one canonical value as a single text block.
 * @param {unknown} _args - validated arguments, unused.
 * @param {unknown} value - canonical value.
 * @returns {Array<{type: 'text', text: string}>} content blocks.
 */
function renderText(_args, value) {
  const text = isRecord(value) && typeof value.text === 'string' ? value.text : JSON.stringify(value)
  return [{ type: 'text', text }]
}

/**
 * Activate the plugin.
 * @param {object} ctx - Cordis plugin context.
 * @param {object} [config] - bundle row config.
 * @returns {void}
 */
export function apply(ctx, config = {}) {
  const settings = normalizeConfig(config)
  const stateDir = resolveStateDir(settings.stateDir)
  const optional = {}
  for (const name of ['web', 'userQuestions', 'workingDirectory']) bindOptional(ctx, name, optional)

  if (settings.promptSection) {
    ctx.systemPrompt.section({ name: 'plugin:prompt-organizer', order: 8100, text: SECTION_TEXT })
  }

  let skillBody = ''
  try {
    skillBody = readFileSync(SKILL_URL, 'utf8')
  } catch (error) {
    warn(ctx, `prompt-organizer: cannot read the bundled skill body (${errorMessage(error)})`)
  }
  if (skillBody !== '') {
    ctx.skills.register({
      name: SKILL_NAME,
      description: SKILL_DESCRIPTION,
      whenToUse: 'The user pastes scattered or contradictory requirements, asks to "整理提示词", "写个开发计划", or says to just start building from a vague idea.',
      content: skillBody,
      source: 'runtime',
      resourceBase: { kind: 'directory', path: path.dirname(fileURLToPath(SKILL_URL)) },
    })
  }

  ctx.tools.register({
    name: 'prompt_organizer_brief',
    description: 'Turn raw, fragmented project notes into one structured brief: derived goal, project type with alternatives, technical signals, the decisions still open, web research, and search queries. Call this first whenever the user dumps rough requirements; it can ask the user the open decisions and search the web for you. Then research, then call prompt_organizer_compose.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        text: {
          type: 'string',
          description: 'The user’s notes exactly as written, every fragment included. Do not clean, merge, or summarize before passing.',
        },
        project_hint: {
          type: 'string',
          description: 'Project type or stack the user already named, such as "DSH plugin" or "React dashboard". Omit when the notes name none.',
        },
        language: {
          type: 'string',
          enum: ['zh', 'en'],
          description: 'Language for questions and the final document. Defaults to the language of the notes.',
        },
        interview: {
          type: 'boolean',
          description: 'Ask the user the open decisions now and merge the answers. Defaults to the bundle setting (on). Set false for headless or subagent runs.',
        },
        research: {
          type: 'boolean',
          description: 'Search the web for the generated queries and include the findings. Defaults to the bundle setting (on).',
        },
      },
      required: ['text'],
    },
    output: { schema: BRIEF_OUTPUT_SCHEMA, render: renderText },
    async execute(rawArgs, exec) {
      const args = isRecord(rawArgs) ? rawArgs : {}
      const text = typeof args.text === 'string' ? args.text : ''
      if (text.trim() === '') {
        throw new Error('prompt_organizer_brief needs non-empty `text`: pass the user’s raw notes verbatim.')
      }
      const locale = detectLanguage(typeof args.language === 'string' ? args.language : '', text)
      const brief = buildBrief({
        text,
        projectHint: typeof args.project_hint === 'string' ? args.project_hint : '',
        locale,
        id: timestampId(),
      })
      const interview = args.interview === undefined ? settings.interview : args.interview === true
      const research = args.research === undefined ? settings.research : args.research === true

      let researchNote = brief.researchNote
      if (research) {
        const found = await runResearch(optional, brief.searchQueries.slice(0, settings.maxSearchQueries), exec.signal)
        brief.research = found.findings
        researchNote = found.note
      }
      let interviewNote = ''
      if (interview) {
        if (brief.questions.length === 0) {
          interviewNote = 'no open decisions were detected; the brief is ready to compose'
        } else {
          const pending = brief.questions.slice(0, settings.maxQuestions)
          const asked = await askQuestions(optional, exec, pending)
          if (asked.error !== '') {
            interviewNote = asked.error
          } else {
            applyAnswers(brief, asked.answers)
            interviewNote = `asked ${pending.length} question(s), ${asked.answers.length} answered`
          }
        }
      }

      let savedPath = ''
      if (settings.saveBriefs) {
        try {
          savedPath = writeTextFile(path.join(stateDir, 'briefs', `${brief.id}.json`), `${JSON.stringify(brief, null, 2)}\n`)
        } catch (error) {
          savedPath = ''
          researchNote = [researchNote, `could not save the brief (${errorMessage(error)})`].filter(Boolean).join('; ')
        }
      }

      const lines = [renderBrief(brief), '']
      if (interviewNote !== '') lines.push(`Interview: ${interviewNote}`)
      if (researchNote !== '') lines.push(`Research note: ${researchNote}`)
      if (savedPath !== '') lines.push(`Brief saved: ${savedPath}`)
      lines.push('', BRIEF_NEXT)

      return {
        text: lines.join('\n'),
        brief_id: brief.id,
        saved_path: savedPath,
        project_type: brief.projectType.id,
        project_type_label: brief.projectType.label,
        confidence: brief.projectType.confidence,
        goal: brief.goal,
        fragment_count: brief.fragments.length,
        decision_count: brief.decisions.length,
        open_question_count: brief.questions.length,
        research_count: brief.research.length,
        interview_note: interviewNote,
        research_note: researchNote,
        next: BRIEF_NEXT,
      }
    },
  })

  ctx.tools.register({
    name: 'prompt_organizer_compose',
    description: 'Compose the finished deliverable from a brief: mode "prompt" writes one paste-ready prompt, "plan" writes a reviewable project plan, "execute" writes the plan and hands it back for immediate implementation. Writes a Markdown file and returns its path plus the kickoff prompt.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        mode: {
          type: 'string',
          enum: ['prompt', 'plan', 'execute'],
          description: 'Deliverable: "prompt" for one paste-ready prompt, "plan" for a project plan to review, "execute" to also start building immediately.',
        },
        title: {
          type: 'string',
          description: 'Short human title for the project, taken from the user’s own words when possible.',
        },
        goal: {
          type: 'string',
          description: 'One or two sentences stating what the project accomplishes and for whom.',
        },
        project_type: {
          type: 'string',
          description: 'Project type id from the brief, such as "web-app", "dsh-plugin", "cli-tool", or "ai-agent".',
        },
        language: {
          type: 'string',
          enum: ['zh', 'en'],
          description: 'Document language. Defaults to the language of title and goal.',
        },
        requirements: {
          type: 'array',
          items: { type: 'string' },
          description: 'Concrete must-have requirements, one testable sentence each, 4-8 items.',
        },
        nice_to_have: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional capabilities that are explicitly not required for version one.',
        },
        out_of_scope: {
          type: 'array',
          items: { type: 'string' },
          description: 'What this version deliberately will not do.',
        },
        stack: {
          type: 'array',
          items: { type: 'string' },
          description: 'Named technologies with versions only when verified; leave empty to let the implementer choose.',
        },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Environment, performance, compatibility, licensing, or data constraints.',
        },
        research: {
          type: 'array',
          items: { type: 'string' },
          description: 'Research findings as "takeaway — url", one per item.',
        },
        acceptance: {
          type: 'array',
          items: { type: 'string' },
          description: 'How the result will be checked, mirroring the requirements.',
        },
        plan: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ordered implementation steps, from scaffold to verification.',
        },
        risks: {
          type: 'array',
          items: { type: 'string' },
          description: 'Known risks and the intended mitigation.',
        },
        assumptions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Defaults chosen where the user did not decide, marked as assumptions.',
        },
        output_path: {
          type: 'string',
          description: 'Where to write the document, absolute or relative to the workspace. Defaults to prompt-organizer/<slug>-<stamp>.md in the workspace.',
        },
      },
      required: ['mode', 'title'],
    },
    output: { schema: COMPOSE_OUTPUT_SCHEMA, render: renderText },
    async execute(rawArgs, exec) {
      const args = isRecord(rawArgs) ? rawArgs : {}
      const document = buildDocument({ ...args, project_type: typeof args.project_type === 'string' ? args.project_type : '' })
      const cwd = await resolveCwd(optional, exec)
      const requested = typeof args.output_path === 'string' ? args.output_path.trim() : ''
      const filePath = requested !== ''
        ? path.resolve(cwd, expandHome(requested))
        : path.join(resolveOutputDir(cwd, settings.outputDir), `${slugify(document.title)}-${fileStamp()}.md`)
      writeTextFile(filePath, document.markdown)

      const next = document.mode === 'execute'
        ? 'Handoff complete. Start now: create a todo list from the plan, then implement and verify it. Do not ask for confirmation.'
        : document.mode === 'plan'
          ? 'Show the plan path and the key decisions, then ask whether to start building now (mode "execute").'
          : 'Show the prompt and the file path, then ask whether to start building now (mode "execute") or adjust it.'

      const typeLabel = projectTypeLabel(typeof args.project_type === 'string' ? args.project_type : '', document.language)
      const lines = [
        `Wrote ${filePath}`,
        `Mode: ${document.mode} · Language: ${document.language} · Type: ${typeLabel} · Sections: ${document.sections.join(', ')}`,
        '',
        '--- kickoff prompt ---',
        document.kickoff,
        '',
        next,
      ]

      return {
        text: lines.join('\n'),
        path: filePath,
        mode: document.mode,
        title: document.title,
        language: document.language,
        kickoff: document.kickoff,
        sections: document.sections,
        next,
      }
    },
  })
}

/** Cordis plugin name. */
export const name = 'prompt-organizer'
/** Services required by this plugin. */
export const inject = ['tools', 'skills', 'systemPrompt']
