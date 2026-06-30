---
type: Concept
title: Links as edges
description: A markdown link from one note to another .md file is a directed, untyped graph edge.
tags: [okf, links, graph]
resource: src/okf.js
timestamp: 2026-06-30
---

# Links as edges

In [OKF](/concepts/okf.md), there is no separate edge file. Any markdown link
from one note to another `.md` file *is* an edge.

## Properties

- **Directed.** The edge points from the linking note to its target;
  [the browser app](/components/browser-app.md) draws an arrow at the target end.
- **Untyped.** The link itself carries no relationship label. Describe the *kind*
  of relationship in the surrounding prose, not in the link text or URL.
- **Deduped.** [The parser](/components/okf-parser.md) collapses repeated links
  between the same pair into a single edge; self-links and links to
  [reserved files](/concepts/reserved-files.md) are dropped.

## Authoring guidance

Prefer **bundle-relative** links (`/components/okf-parser.md`) so they survive
file moves — see [path-as-id](/decisions/path-as-id.md) and the
[link-resolution gotcha](/gotchas/link-resolution.md). A link to a file that does
not exist yet becomes a [ghost node](/concepts/ghost-nodes.md), which doubles as
a TODO list.
