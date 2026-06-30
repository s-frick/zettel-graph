---
type: Concept
title: Reserved files
description: Certain filenames are navigation or docs, never graph nodes, and are excluded from the bundle.
tags: [okf, navigation]
resource: src/okf.js
timestamp: 2026-06-30
---

# Reserved files

Not every `.md` file in a bundle becomes a [node](/concepts/okf.md). A fixed set
of filenames is reserved.

## The set (`NON_NODES`)

| File | Role |
| --- | --- |
| `index.md` | OKF navigation — the bundle catalog |
| `log.md` | OKF navigation — the append-only change log |
| `AGENTS.md` | agent/schema-layer guide (the llm-wiki authority doc) |
| `CLAUDE.md` | agent docs |
| `README.md` | bundle docs |

[The parser](/components/okf-parser.md) filters these out of the node list, and
also refuses to create an edge *to* any of them. So `index.md` and `log.md` can
link freely to notes without polluting the graph with navigation nodes.

## Related

- The two navigation files are central to the [llm-wiki workflow](/concepts/llm-wiki.md).
- See the [reserved-file-exclusion gotcha](/gotchas/reserved-file-exclusion.md)
  for the consequence: you cannot make a knowledge node named `index.md`.
