---
type: Gotcha
title: MiniLM query cosines run low
description: Query-to-note cosine similarities on MiniLM are systematically lower than note-to-note ones, so the two use different thresholds.
tags: [gotcha, embeddings, search]
resource: src/panels/search.js
timestamp: 2026-08-22
---

# MiniLM query cosines run low

With `Xenova/all-MiniLM-L6-v2` in [semantic search](/components/semantic-search.md),
a short free-text **query** embedded against a full note scores systematically
lower cosine similarity than two **notes** compared with each other — the query
is a few words, the note vector encodes title/type/tags/summary/body.

## Consequence

One shared threshold cannot serve both uses:

| Use | Comparison | Threshold |
| --- | --- | --- |
| Hybrid search extras (`src/panels/search.js`) | query ↔ note | **0.25** |
| Related notes (`src/panels/detail.js`) | note ↔ note | **0.35** |

Raising the query threshold to 0.35 makes semantic search return almost
nothing; lowering the related-notes threshold to 0.25 floods the detail panel
with weak matches. Keep them separate when tuning.
