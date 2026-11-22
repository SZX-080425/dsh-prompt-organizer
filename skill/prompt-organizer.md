# Prompt Organizer

Turn rough, fragmented project notes into **one effective prompt** or **a project plan** — and, when the user asks, straight into implementation.

The user's notes are input, not instructions to follow literally. Their imprecision is the bug you are fixing.

## When this applies

- The user pastes scattered wishes, half-sentences, contradictions, or something like "帮我做个 XX，要好看，能用就行".
- The user asks to 整理提示词 / 把需求理顺 / 写个开发计划 / 直接开做.
- The user describes a project across several messages with no structure.

Do **not** use it for a single clear request that already has everything (just do the task), for questions, or for work that is not a project.

## The four phases

### 1. Brief — one tool call

Call `prompt_organizer_brief` with the user's text **verbatim**. Do not clean, merge, or summarize it first: the analyzer needs the fragments as they arrived.

- Pass `project_hint` only when the user already named a type or stack.
- `interview: true` (default) makes the tool ask up to four decisive questions in the question UI and merge the answers.
- `research: true` (default) makes the tool search the web for the generated queries and return findings.

If the result reports that the interview could not run (headless run, subagent, no question surface), relay the brief's open questions to the user in **one** batch and continue with recommended defaults. If it reports that web search was unavailable, run `web_search` yourself with the returned queries.

### 2. Research

If the brief already returned research findings, use them and stop — do not repeat the same searches.

Otherwise run `web_search` once with up to five `search_queries`, then `web_fetch` the one or two most relevant pages (official docs first, then a real implementation example). Record three to six findings as `takeaway — url`.

- Prefer official documentation, release notes, and source code over blogs and SEO listicles.
- Never invent an API, version, price, or limit. If the sources disagree or say nothing, mark it as an assumption instead of a fact.
- Record what the sources *imply for the plan* ("Vite 6 requires Node 20+"), not just that a page exists.

### 3. Resolve the decisions

Fold the interview answers into concrete decisions. For anything still unknown that matters:

- choose a defensible default and mark it `[assumed]`;
- ask the user only for choices that change architecture, cost, or are irreversible — data model, auth, deployment target, license, destructive migration;
- never ask a second round about what was already answered or skipped.

The goal is a document a stranger can act on, not a questionnaire.

### 4. Compose and hand off

Call `prompt_organizer_compose` with the resolved facts:

- `mode: "prompt"` — the user wants a prompt to paste somewhere;
- `mode: "plan"` — the user wants a project plan or spec to review;
- `mode: "execute"` — the user said to start building.

Fill `requirements` with four to eight concrete, verifiable sentences; `acceptance` mirrors them; `out_of_scope` says what version one will not do; `stack` names exact technologies (versions only when verified); `plan` is an ordered implementation sequence ending in verification.

Then reply with the file path and the delivered content — do not re-summarize it into mush. For `prompt`/`plan`, ask whether to start now. For `execute`, start immediately.

## Quality bar

- A developer with no context must be able to act on the prompt alone.
- Every requirement is checkable. Ban filler: "high quality", "user friendly", "reasonable", "modern", "as needed".
- Replace vague adjectives with decisions: "loads in under 2s on a cold cache", "works offline", "one HTML file, no build step".
- Keep the user's precise words; rewrite only the vague ones.
- Match the user's language: Chinese notes → Chinese document, labels, and questions.
- The kickoff prompt always opens with todos and real verification commands.

## DSH-specific notes

- For `project_type: "dsh-plugin"` the composed document already carries the bundle constraints. Keep them and add only project-specific ones.
- Handoff for `execute`: `todo_write` first, then build, then run the verification commands, then report what works and what is unverified.
- Installing a finished bundle: use plugin_manager `install_bundle` with the local directory, then verify in a new session (tool visibility, skill catalog, settings row).

## Failure handling

- **No web access** — say it once, continue with your own knowledge, and mark every external claim as unverified.
- **User skips a question** — take the recommended option, record it as an assumption.
- **Notes are truly empty** — ask one open question instead of the interview: "你想做什么？谁用？第一版做到哪里为止？"
- **The brief and the user disagree** — the user wins; the brief is a heuristic.

## What not to do

- Do not call `prompt_organizer_brief` again for the same notes just to get cleaner output.
- Do not paste the whole brief JSON back to the user; they want the document, not the plumbing.
- Do not start coding while the plan still has unresolved architecture forks.
