---
type: Concept
title: Ghost nodes
description: Links to not-yet-written notes render as faint placeholder nodes, acting as a visible TODO list.
tags: [okf, graph, todo]
resource: src/okf.js
timestamp: 2026-06-30
---

# Ghost nodes

When a note links to a `.md` file that does not exist in the bundle, the link is
still honoured: [the parser](/components/okf-parser.md) creates a placeholder
node rather than dropping the edge.

## How they are made

In pass 2, if a resolved link [target](/concepts/links-as-edges.md) is not
already a node, the parser inserts one with:

- `type: '_missing'`
- `title`: the basename
- `summary`: `(not yet written)`
- `ghost: true`

## How they look

[The browser app](/components/browser-app.md) renders ghosts smaller
(`nodeVal` 1 vs 4), labels their type as "missing" in the legend, and shows
"not yet written" in panels.

## Why they matter

Ghosts make gaps *visible*: they are effectively a TODO list drawn into the
graph. Write the linked note and the ghost turns into a real, coloured node.
Note the difference from the [link-resolution gotcha](/gotchas/link-resolution.md):
an *intended* ghost is useful, but an accidental ghost from a typo'd path is a
bug.
