# Log

Chronological record, newest first. Date headings `YYYY-MM-DD`.

## 2026-08-22

**Creation** `components/semantic-search.md` — documented the new semantic search + related notes feature: local MiniLM embeddings (`src/embeddings.js`, q8/CPU, sha1-keyed disk cache), Vite serving of `/embeddings.json` and dev-only `/api/embed`, client `semantic.js` model, hybrid search in `search.js`, and the related-notes/link-suggestions section in `detail.js`.

**Creation** `gotchas/minilm-query-cosine.md` — query↔note cosines on MiniLM run lower than note↔note, hence separate thresholds (0.25 search vs 0.35 related notes).

## 2026-06-30

**Update** Documented the new in-graph search box in `components/browser-app.md` (new "Search" section): full-text token-AND matching over title/id/type/tags/summary/body, ranked results dropdown, match dimming via the existing colour accessors, keyboard nav (`/`, Cmd/Ctrl-K, arrows, Enter, Esc), and query persistence across hot reload.

**Creation** Populated the starter graph during first-run setup: 17 notes across components (5), concepts (5), decisions (4), and gotchas (3), documenting the zettel-graph codebase and OKF/llm-wiki conventions. Rewrote `index.md` to catalog them and removed the example-note entry.

**Creation** Bundle initialized with `zettel-graph init`.
