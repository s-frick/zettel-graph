# Index

Catalog of this knowledge bundle. One line per note; update on every add or rename.

## Components

* [OKF parser](/components/okf-parser.md) — Walks a bundle directory and turns it into a force-graph {nodes, links} structure.
* [Browser app](/components/browser-app.md) — The 3D ForceGraph client that renders nodes, panels, legend, and live-reloads on edit.
* [CLI](/components/cli.md) — The zettel-graph command-line entrypoint that dispatches dev/build/graph/init.
* [init command](/components/init-command.md) — Scaffolds a new OKF bundle with an agent guide, seeded index/log, and a starter note.
* [Vite config](/components/vite-config.md) — Dev server that builds graph.json on the fly, watches the bundle, and pushes HMR updates.
* [Semantic search](/components/semantic-search.md) — Local MiniLM embeddings power semantic query search, related-notes suggestions, and hybrid search results.

## Concepts

* [Open Knowledge Format](/concepts/okf.md) — A directory of markdown-plus-frontmatter notes that form a graph, where files are nodes and links are edges.
* [Links as edges](/concepts/links-as-edges.md) — A markdown link from one note to another .md file is a directed, untyped graph edge.
* [Ghost nodes](/concepts/ghost-nodes.md) — Links to not-yet-written notes render as faint placeholder nodes, acting as a visible TODO list.
* [Reserved files](/concepts/reserved-files.md) — Certain filenames are navigation or docs, never graph nodes, and are excluded from the bundle.
* [llm-wiki workflow](/concepts/llm-wiki.md) — A three-layer workflow for maintaining an OKF bundle as a living, agent-tended wiki.

## Decisions

* [Path as ID](/decisions/path-as-id.md) — A note's identity is its bundle-relative path, not its title.
* [Vite + HMR for live reload](/decisions/vite-hmr.md) — Use Vite plus chokidar to hot-reload the graph as notes are edited, building graph.json on the fly.
* [CLI-first, zero-install](/decisions/cli-first.md) — Ship as an npx-runnable CLI that points at any directory, so there is nothing to install or configure.
* [OKF over a custom format](/decisions/okf-over-custom.md) — Adopt the Open Knowledge Format rather than inventing a bespoke note/graph schema.

## Gotchas

* [Link resolution](/gotchas/link-resolution.md) — How relative vs bundle-relative links resolve, and why plain relative links break when files move.
* [Reserved-file exclusion](/gotchas/reserved-file-exclusion.md) — index/log/AGENTS/CLAUDE/README markdown files never become nodes, so they cannot hold knowledge.
* [Frontmatter type required](/gotchas/frontmatter-type-required.md) — type is the only required frontmatter field; it drives node colour, and a missing type falls back to "Unknown".
* [MiniLM query cosines run low](/gotchas/minilm-query-cosine.md) — Query-to-note cosine similarities on MiniLM are systematically lower than note-to-note ones, so the two use different thresholds.
