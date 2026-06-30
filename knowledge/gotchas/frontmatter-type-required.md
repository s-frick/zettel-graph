---
type: Gotcha
title: Frontmatter type required
description: type is the only required frontmatter field; it drives node colour, and a missing type falls back to "Unknown".
tags: [gotcha, frontmatter, type]
resource: src/okf.js
timestamp: 2026-06-30
---

# Frontmatter type required

In [OKF](/concepts/okf.md) `type` is the single required frontmatter field, and
it is the one that visibly matters.

## What the parser actually does

[The parser](/components/okf-parser.md) reads `fm.type` and falls back to the
string `'Unknown'` when it is missing or empty:

```js
type: fm.type || 'Unknown',
```

So a note with no `type` is **not** dropped — it becomes a node typed `Unknown`.
That is the failure mode: the file still renders, just in the wrong (catch-all)
group.

## Why it matters

`type` drives node colour: [the browser app](/components/browser-app.md) uses
`.nodeAutoColorBy('type')` and builds the legend from distinct types. So:

- Untyped notes all collapse into one `Unknown` colour, losing visual grouping.
- Inconsistent type spellings (`Concept` vs `concept`) split into separate
  colours/legend rows.

The reserved value `_missing` is used internally for [ghost nodes](/concepts/ghost-nodes.md)
and shown as "missing" in the legend — don't use it yourself. Always set a
deliberate, consistently-spelled `type` on every real note.
