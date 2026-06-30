// `zettel-graph init`: scaffold an OKF knowledge bundle plus an agent-facing
// guide (AGENTS.md) that teaches any coding agent how to read/write the bundle
// in the llm-wiki style and how to visualize it.
//
// Existing files are never overwritten unless `force` is set; each file is
// reported as created or skipped so the caller can print a summary.
import fs from 'node:fs';
import path from 'node:path';

function agentsDoc(dir) {
  return `# Knowledge bundle — agent guide

This directory is an **OKF (Open Knowledge Format)** knowledge bundle, maintained
in the **llm-wiki** style. If you are an AI agent (Claude, Codex, Cursor, OpenCode,
Gemini, …) working in here, follow the rules below whenever you read, create, or
update notes. **Your behavior is governed by the Policy block in §1 — read it
first and obey it.**

## 0. First run — set this up with the user

The Policy below ships empty/passive on purpose. The first time you act on this
bundle, walk the user through these steps, then write their answers into §1:

1. **Propose topics to track.** Read the surrounding project (README, directory
   layout, existing docs/code) and suggest 3–6 concrete topic areas worth
   capturing — e.g. architecture-decisions, domain-concepts, apis, components,
   integrations, data-models, runbooks, gotchas, or anything project-specific.
   Let the user pick/edit, then write the result into \`policy.track\`.
2. **Confirm autonomy.** For \`capture\` and each \`maintenance\` concern, confirm the
   level (\`off\` / \`suggest\` / \`auto\`). Explain the defaults; change per the user.
3. **Wire it project-wide.** \`capture\` only fires across the repo if a root
   \`AGENTS.md\`/\`CLAUDE.md\` points here. Offer to append:
   \`> This project keeps an OKF knowledge graph in \\\`${dir}/\\\`. Follow @${dir}/AGENTS.md and apply its policy proactively as you work.\`
4. **Starter note.** Ask whether to keep \`concepts/example-note.md\` as a template
   or delete it, then act.

## 1. Policy — what you do automatically

\`\`\`yaml
policy:
  # WHICH topics to track. Empty = track nothing until the user agrees a list (§0).
  track: []
    # candidate values: architecture-decisions, domain-concepts, apis,
    # components, integrations, data-models, runbooks, gotchas, …

  # How proactive you are about NEW knowledge you notice that matches \`track\`.
  capture: suggest   # off = only when explicitly asked
                     # suggest = point it out and ask before writing
                     # auto = write/update the note yourself, then report it

  # Ongoing upkeep of EXISTING notes.
  maintenance:
    links:  auto      # keep markdown links + ghost nodes consistent (additive)
    stale:  suggest   # detect outdated notes (off | suggest | auto-FLAG only)
    revise: suggest   # rewrite notes on new insight (off | suggest | auto)
\`\`\`

**Level semantics:** \`off\` = never act unprompted. \`suggest\` = surface it and ask
first. \`auto\` = act, then report what you did.

**Safety invariant — overrides any \`auto\`:** destructive or lossy actions ALWAYS
need explicit human confirmation. \`stale: auto\` means auto-*flag* (mark / log),
never auto-delete. \`revise: auto\` is allowed only when nothing is lost; if a
rewrite would drop content, ask first. Deleting or overwriting a note is never
automatic.

With \`track: []\`, \`capture\` has nothing to match, so the bundle stays passive
until §0 is done — that is intentional.

## 2. Execution — stay out of the way

Knowledge-graph work is **secondary** to whatever the user is actually doing.
Never pollute the main session or interrupt their task with it.

- **Prefer a subagent.** When your runtime can spawn one (e.g. Claude Code's
  Task/Agent tool), do the graph work there — reading the bundle, drafting notes,
  updating \`index.md\`/\`log.md\` — and return only a short summary to the main
  thread. Keeps the main context clean.
- **Otherwise, defer to a natural boundary.** If you can't use a subagent, or the
  user is mid-task on something else, do NOT break their flow. Wait until the
  current unit of work is finished, then do the graph work in one batch. Waiting
  also gives you the *complete* picture, so you record the right conclusions
  instead of half-formed ones captured mid-change.
- **Report briefly.** Afterwards, summarize in 1–2 lines what changed (which
  notes, plus index/log). Don't narrate the process.
- **Honor the policy levels (§1).** \`suggest\` still means ask first — but raise it
  at the boundary, not in the middle of the user's task.

## 3. What OKF is

- Every note is a markdown file with **YAML frontmatter**. The only **required**
  field is \`type\` (non-empty string) — it groups and colors nodes in the graph
  (e.g. \`Concept\`, \`Component\`, \`Person\`, \`Decision\`). No central registry; pick
  descriptive, self-explanatory types.
- Recommended fields: \`title\`, \`description\` (one sentence), \`tags\` (list),
  \`resource\` (canonical URI of the underlying asset), \`timestamp\` (ISO 8601).
- A note's **ID is its bundle-relative path** without \`.md\`
  (\`concepts/parser.md\` → \`concepts/parser\`). Identity is the path, not the title.
- **Links are edges.** A markdown link to another \`.md\` file is a directed,
  untyped relationship; describe the *kind* of relationship in the surrounding
  prose, not the link.
  - Prefer **bundle-relative** links that start with \`/\`:
    \`[the parser](/components/parser.md)\` — stable when files move. Plain relative
    links (\`./other.md\`) also work.
  - A link to a not-yet-written note is fine: it shows up as a faded **ghost**
    node and is effectively your TODO list.
- **Reserved files** (never concept nodes): \`index.md\`, \`log.md\`. Also excluded
  from the graph: \`AGENTS.md\`, \`CLAUDE.md\`, \`README.md\`.
- Favor structural markdown — headings, lists, tables, code blocks — over long
  prose. Conventional section headings: \`# Schema\`, \`# Examples\`, \`# Citations\`.

### Note template

\`\`\`markdown
---
type: Concept
title: Short human-readable name
description: One-sentence summary used in previews and the index.
tags: [topic, subtopic]
timestamp: YYYY-MM-DD
---

# Short human-readable name

Body text. Link related notes inline: see [the parser](/components/parser.md).
\`\`\`

## 4. The llm-wiki workflow

Three layers: **raw sources** (immutable — read, never edit), **this wiki** (the
notes you create and maintain), and **this schema doc** (the conventions, which you
co-evolve with the user). Core operations:

- **Ingest** a new source: read it, discuss key takeaways with the user, write a
  summary note, update \`index.md\`, update related notes, append a \`log.md\` entry.
- **Query**: read \`index.md\` first, drill into the relevant notes, answer with
  citations. File good answers back into the wiki as new notes.
- **Lint** (periodic health-check): look for contradictions, stale claims, orphan
  notes (no inbound links), important concepts that lack a note, and missing
  cross-links.

### \`index.md\` — keep it current

Catalog of the bundle: one line per note (\`* [Title](/path.md) — description\`),
grouped by category. Update it **on every note you add or rename**.

### \`log.md\` — append-only

Newest first. Date headings \`YYYY-MM-DD\`. One entry per change, leading with a
verb in bold: \`**Creation**\`, \`**Update**\`, \`**Deprecation**\`.

## 5. Visualize the graph

\`\`\`sh
npx zettel-graph ${dir}
\`\`\`

Opens a 3D force-directed view with live hot-reload — edit a note and the graph
updates. Ghost (unwritten) nodes show what is still missing.

---
*Generated by \`zettel-graph init\`. This doc is yours — edit and evolve it.*
`;
}

function indexDoc() {
  return `# Index

Catalog of this knowledge bundle. One line per note; update on every add or rename.

## Concepts

* [Example note](/concepts/example-note.md) — starter note created by \`zettel-graph init\`.
`;
}

function logDoc(today) {
  return `# Log

Chronological record, newest first. Date headings \`YYYY-MM-DD\`.

## ${today}

**Creation** Bundle initialized with \`zettel-graph init\`.
`;
}

function starterDoc(today) {
  return `---
type: Concept
title: Example note
description: Starter OKF note created by \`zettel-graph init\`. Keep as a template or delete it.
tags: [example, starter]
timestamp: ${today}
---

# Example note

A starter note so your graph has a first node. Replace it with real knowledge, or
delete it.

This note links to [another note](/concepts/another.md) that does not exist yet —
notice it appears as a faded **ghost** node in the graph. That is how OKF surfaces
gaps: write the linked note and the ghost turns solid.

Create notes as \`.md\` files with frontmatter (see \`AGENTS.md\`), and connect them
with bundle-relative markdown links.
`;
}

// Scaffold the bundle. Returns { root, created[], skipped[] }.
export function runInit({ dir, force = false, today }) {
  const root = path.resolve(process.cwd(), dir);
  const files = [
    ['AGENTS.md', agentsDoc(dir)],
    ['index.md', indexDoc()],
    ['log.md', logDoc(today)],
    [path.join('concepts', 'example-note.md'), starterDoc(today)],
  ];

  fs.mkdirSync(root, { recursive: true });
  const created = [];
  const skipped = [];
  for (const [rel, content] of files) {
    const full = path.join(root, rel);
    if (fs.existsSync(full) && !force) {
      skipped.push(rel);
      continue;
    }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    created.push(rel);
  }
  return { root, created, skipped };
}
