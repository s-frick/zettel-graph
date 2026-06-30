---
type: Concept
title: llm-wiki workflow
description: A three-layer workflow for maintaining an OKF bundle as a living, agent-tended wiki.
tags: [workflow, llm-wiki, agents]
resource: https://gist.github.com/s-frick/299bbaea1569f585d06543d66f6ba077
timestamp: 2026-06-30
---

# llm-wiki workflow

The llm-wiki style is how this [OKF](/concepts/okf.md) bundle is maintained. The
full conventions live in the bundle's `AGENTS.md` (a
[reserved file](/concepts/reserved-files.md)); this note summarizes them.

## Three layers

| Layer | Editable? |
| --- | --- |
| **Raw sources** (the codebase, docs) | read, never edit |
| **The wiki** (these notes) | created and maintained by the agent |
| **The schema doc** (`AGENTS.md`) | co-evolved with the user |

## Core operations

- **Ingest** — read a source, write a summary note, update `index.md`, link
  related notes, append a `log.md` entry.
- **Query** — read `index.md` first, drill into notes, answer with citations,
  file good answers back as new notes.
- **Lint** — find contradictions, stale claims, orphan notes, and missing
  cross-links.

## Navigation upkeep

Two [reserved files](/concepts/reserved-files.md) are kept current:

- `index.md` — catalog, one line per note, updated on every add/rename.
- `log.md` — append-only, newest first, one bolded-verb entry per change.

The agent generates and seeds these via [the init command](/components/init-command.md),
and the whole bundle is visualized with [the CLI](/components/cli.md).
