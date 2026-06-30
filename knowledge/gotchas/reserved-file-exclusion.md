---
type: Gotcha
title: Reserved-file exclusion
description: index/log/AGENTS/CLAUDE/README markdown files never become nodes, so they cannot hold knowledge.
tags: [gotcha, reserved, navigation]
resource: src/okf.js
timestamp: 2026-06-30
---

# Reserved-file exclusion

The [reserved filenames](/concepts/reserved-files.md) — `index.md`, `log.md`,
`AGENTS.md`, `CLAUDE.md`, `README.md` — are excluded from the graph by
`NON_NODES` in [the parser](/components/okf-parser.md). This bites in two ways.

## Consequence 1 — you cannot make a node with these names

Any note you write under one of these basenames simply will not appear in the
graph, no matter its frontmatter. If you want a real knowledge node, name the
file something else (e.g. `concepts/overview.md`, not `README.md`).

## Consequence 2 — edges *to* them are dropped too

In pass 2 the parser skips any link whose target basename is reserved
(`if (NON_NODES.has(path.basename(target))) continue;`). So linking from a note
to `/index.md` creates **no** edge and **no** ghost node — the link is invisible
to the graph. This is deliberate: it lets `index.md`/`log.md` link freely as
navigation without cluttering the graph.

## Note

Exclusion is by **basename anywhere in the bundle** — a `README.md` in a
subdirectory is excluded just like the root one. Keep genuine
[knowledge notes](/concepts/okf.md) out of these names; reserve the names for
navigation and docs.
