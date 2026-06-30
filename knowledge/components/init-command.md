---
type: Component
title: init command
description: Scaffolds a new OKF bundle with an agent guide, seeded index/log, and a starter note.
tags: [scaffold, init]
resource: src/init.js
timestamp: 2026-06-30
---

# init command

`src/init.js` exports `runInit({ dir, force, today })`, invoked by
[the CLI](/components/cli.md) for `zettel-graph init`. It writes the starting
files of a new [OKF](/concepts/okf.md) bundle.

## Files written

| File | Purpose |
| --- | --- |
| `AGENTS.md` | the agent-facing guide to OKF + the [llm-wiki workflow](/concepts/llm-wiki.md) (the authority doc) |
| `index.md` | seeded catalog — a [reserved navigation file](/concepts/reserved-files.md) |
| `log.md` | seeded append-only log — also reserved |
| `concepts/example-note.md` | a starter note that links to a ghost to demo [ghost nodes](/concepts/ghost-nodes.md) |

## Behaviour

- Creates the bundle root (and `concepts/`) with `mkdirSync({ recursive: true })`.
- **Never overwrites**: an existing file is `skipped` unless `force` (the `-f`
  flag) is set; each file is reported as `created` or `skipped`.
- The generated `AGENTS.md` ships a **passive policy block** — the agent runs a
  first-run setup with the user (topics to track, autonomy levels). This bundle
  is the result of that setup having been completed.
