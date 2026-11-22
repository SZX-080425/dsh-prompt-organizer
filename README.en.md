# Prompt Organizer

> Turns a pile of fragmented, contradictory, half-finished notes into **one prompt you can actually use** or **a project plan you can actually build from**.

A DeepSeek Harness plugin. It does not write the code for you; it fills the step everyone skips: **turning an idea into an executable task description**.

[中文](README.md) · [MIT](LICENSE)

---

## The problem

This is how requirements usually arrive:

```
make me a little expense tracker
needs to work on my phone
ideally reads receipts from screenshots
don't lose the data
need it next week
```

Hand that to an agent and it guesses. You discover the wrong guess hundreds of lines later.

With this plugin installed, the same notes become:

```
Project type: Web app (confidence: high)
Goal: a mobile-friendly expense tracker that reads receipt screenshots
Resolved decisions:
- Definition of done → the core flow works
- Storage → local files or browser storage
- Sign-in → not needed
Stack: TypeScript, React, Vite
Open decisions: (0)
Research: 3 findings (IndexedDB limits, mobile image downscaling …)

→ wrote prompt-organizer/expense-tracker-20261122-1750.md
```

The questions, the research, and the write-up are the plugin's job. You click options and read the result.

## How it works

```
messy notes ──① brief──② web research──③ interview──④ compose/build──> executable task
              (type/goal)  (docs/practice)   (decisions)   (prompt/plan)
```

1. **brief** — `prompt_organizer_brief` splits, de-duplicates, classifies the project (12 types), extracts technical signals and gaps, and generates search queries.
2. **research** — the plugin searches through `ctx.web` and records findings with sources; when no provider is mounted it falls back to the `web_search` tool.
3. **interview** — asks 3-4 questions that actually change the architecture (storage, auth, deployment …) through the DSH question cards, then merges the answers.
4. **compose** — `prompt_organizer_compose` emits one of three deliverables:
   - `prompt`: a self-contained prompt you can paste into a fresh session;
   - `plan`: requirements, approach, plan, acceptance criteria, risks;
   - `execute`: the plan plus a build handoff — the agent creates todos and starts.

## Install

**Plugins UI (recommended)** — **Settings → Plugins → Add plugin**, pick this directory.

**CLI**

```bash
git clone https://github.com/SZX-080425/dsh-prompt-organizer.git
dsh plugin --profile desktop add "link:/absolute/path/to/dsh-prompt-organizer"
```

Open a new session. The plugin row, the `prompt-organizer` skill, both tools, and a short system-prompt section are registered.

## Use

Just talk:

```
Turn these scattered notes into a prompt: <messy description>
```

```
Write this up as a development plan, then start building it
```

The model loads the `prompt-organizer` skill, calls the two tools, and shows question cards along the way.

Deliverables default to `<workspace>/prompt-organizer/<title>-<stamp>.md`; briefs are kept in `~/.dsh/prompt-organizer/briefs/`.

## Tools

| Tool | Purpose | Main parameters |
| --- | --- | --- |
| `prompt_organizer_brief` | messy notes → structured brief (type, goal, gaps, queries, research, decisions) | `text` (required, verbatim), `project_hint`, `language`, `interview`, `research` |
| `prompt_organizer_compose` | brief → prompt / plan / build handoff, written to Markdown | `mode`, `title`, `goal`, `project_type`, `requirements`, `stack`, `research`, `acceptance`, `plan`, `output_path` … |

Project types: DSH plugin, web app, API service, CLI tool, library/SDK, desktop app, data tool, AI/agent, game, document/content, automation script, and a general fallback.

## Configuration

Override the `prompt-organizer` row in the profile's `cordis.patch.yml`:

```yaml
- id: prompt-organizer
  config:
    promptSection: true   # inject the routing hint (default true)
    interview: true       # brief asks the user by default (default true)
    research: true        # brief searches the web by default (default true)
    saveBriefs: true      # persist brief JSON under ~/.dsh/prompt-organizer (default true)
    stateDir: ""          # briefs directory
    outputDir: ""         # deliverable directory, default <workspace>/prompt-organizer
    maxQuestions: 4       # 1-6
    maxSearchQueries: 3   # 1-5
```

## Boundaries

- **No extra model calls.** The session model does the judgment; the plugin owns shape, questions, search, and files. No surprise token bill.
- **Search is best effort.** Without a usable search provider the brief returns queries for the model to run; it never invents findings.
- **Asking needs a question surface.** In headless or subagent runs the open questions come back to the model to relay in one batch.
- **Research carries sources.** Every finding has a URL; anything unverified must be marked `[assumed]`.
- **The plan is a document, not a contract.** Building starts only when you say so — unless you chose `execute`.

## Layout

```
lib/index.js            plugin entry: skill, prompt section, two tools
lib/core/taxonomy.js    12 project types, question bank, queries
lib/core/brief.js       brief construction, answer merge, model-facing render
lib/core/compose.js     prompt / plan rendering
lib/core/storage.js     paths and file writes
skill/prompt-organizer.md   the four-phase workflow the model follows
locale/{en,zh}.json     marketplace title and description
docs/                   detail-page illustration
test/                   pure-function unit tests
```

## Development

```bash
node --test test/
node --check lib/index.js
```

## License

[MIT](LICENSE)
