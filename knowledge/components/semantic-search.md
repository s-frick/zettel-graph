---
type: Component
title: Semantic search
description: Local MiniLM embeddings power semantic query search, related-notes suggestions, and hybrid search results.
tags: [search, embeddings, ml, frontend]
resource: src/embeddings.js
timestamp: 2026-08-22
---

# Semantic search

Embedding-based search and related-notes suggestions layered on top of the
lexical search in the [browser app](/components/browser-app.md). Fully local —
no API key.

## Server side — `src/embeddings.js`

- Embeds each non-[ghost](/concepts/ghost-nodes.md) note with
  `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers` (dtype `q8`, CPU).
- Embedded text = title + type + tags + summary + first 1500 body chars.
- Vectors are L2-normalised, so cosine similarity = dot product.
- Disk cache at `~/.cache/zettel-graph/embeddings-cache.json`, keyed by
  `sha1(model + text)` — hot-reload only re-embeds changed notes.
- Graceful degradation: a missing dependency or model failure returns
  `{ available: false }` and the client falls back to lexical search.

## Serving — Vite

The [Vite config](/components/vite-config.md) serves `/embeddings.json` and
`/api/embed?q=` in dev; `build` emits `dist/embeddings.json`. `/api/embed`
exists only in dev, so **static builds keep related notes but lose semantic
query search**.

## Client side

- `src/model/semantic.js` loads `embeddings.json`, exposes `relatedTo(id)` and
  `queryScores(query)`, and emits a `semantic` state event when loaded.
- `src/panels/search.js` does hybrid search: lexical results appear instantly;
  semantically similar extras are appended after a 250ms debounce, marked `≈`,
  with cosine threshold 0.25 — see
  [the MiniLM query-cosine gotcha](/gotchas/minilm-query-cosine.md).
- `src/panels/detail.js` shows a "Related notes" section: top-5 by cosine
  ≥ 0.35; entries with no existing [link edge](/concepts/links-as-edges.md) are
  flagged "not linked", doubling as link suggestions.
