# zettel-graph

A 3D force-directed visualizer for [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
(Open Knowledge Format) bundles, with hot-reload while you edit.

Point it at a directory of markdown files with YAML frontmatter. It walks the
bundle, turns each non-reserved `.md` file into a node and every markdown link
into a directed edge, colours nodes by their frontmatter `type`, and renders an
interactive 3D graph. Edit a file and the graph updates live.

https://github.com/user-attachments/assets/08ea4ab3-85b7-475e-9e07-4cd586a56045

## Usage

No install — run it straight from npm:

```sh
npx zettel-graph ./my-notes      # dev server with hot-reload
```

Open the printed URL. Hover a node for a preview, click for the full page,
`Esc`/`q` or click the background to close.

```sh
npx zettel-graph                 # visualize the current directory
npx zettel-graph build ./notes -o site   # static site in site/ (+ site/graph.json)
npx zettel-graph graph ./notes -o g.json  # just emit the graph JSON
```

`dir` defaults to the current directory. Try the bundled sample with
`npx zettel-graph examples`.

### Start a new bundle

New to OKF? Scaffold a bundle and an agent guide in one command:

```sh
npx zettel-graph init            # creates ./knowledge
npx zettel-graph init docs       # or any directory you name
```

This writes `<dir>/AGENTS.md` — an agent-facing guide to OKF, the
[llm-wiki](https://gist.github.com/s-frick/299bbaea1569f585d06543d66f6ba077)
workflow, and this tool — plus seeded `index.md` and `log.md` and a starter
note. Visualize it with `npx zettel-graph <dir>`. Existing files are never
overwritten (use `-f` to force).

The guide ships **passive by default** and carries a **policy block** the agent
sets up _with you_ on first run: which topics to track, and how autonomous it
should be (`off` / `suggest` / `auto`) about capturing new knowledge and
maintaining existing notes — links, stale notes, revisions. Destructive actions
always need your confirmation.

The `AGENTS.md` is read automatically by agents that pick up the nearest
`AGENTS.md` (Codex, Cursor, OpenCode, Gemini, …). For Claude Code, add
`See @<dir>/AGENTS.md for the knowledge bundle.` to your root `CLAUDE.md` — the
agent offers to wire this up during first-run setup.

### Commands

| Command                  | What it does                                          |
| ------------------------ | ----------------------------------------------------- |
| `dev [dir]`              | Vite dev server with hot-reload (default command)     |
| `build [dir] -o out`     | Static site into `out/` (default `dist/`)             |
| `graph [dir] -o file`    | Write `graph.json` (stdout if no `-o`)                |
| `init [dir]`             | Scaffold an OKF bundle + agent guide (default `./knowledge`) |
| `-p <port>`              | Dev server port                                       |
| `-f`                     | `init`: overwrite existing files                      |

## OKF bundle format

Each `.md` file is a node; its `id` is the bundle-relative path. Frontmatter:

```yaml
---
type: Concept # required — drives node colour
title: Open Knowledge Format # recommended
description: One-line summary. # recommended
tags: [okf, format] # recommended
resource: src/okf.js # optional — pointer to the underlying asset
timestamp: 2026-06-30 # optional
---
```

- **Links** are markdown links to other `.md` files — directed, untyped edges.
  Use bundle-relative links (`[Parser](/components/parser.md)`) for stability,
  or relative ones (`[Parser](../components/parser.md)`).
- **Reserved files**: `index.md` and `log.md` are navigation, not nodes.
  `AGENTS.md`, `CLAUDE.md` and `README.md` are also excluded (docs, not knowledge).
- **Ghost nodes**: links to files that do not exist yet render as faint
  placeholder nodes — a visible prompt to fill the gap.

See [`examples/`](./examples) for a small, typed sample bundle.

## How it works

- `src/okf.js` — bundle → `{nodes, links}` (the parser).
- `src/main.js` — the browser app (ForceGraph3D, hover/detail panels, selection
  highlight, type legend, hot-reload).
- `vite.config.js` — dev server builds `graph.json` on the fly, watches the
  bundle (chokidar) and pushes an `okf:update` HMR event; build emits
  `dist/graph.json`.
- `bin/cli.js` — pins the Vite root to the package and points it at your bundle.

## Development

```sh
npm install
npm run dev      # visualize examples/ with hot-reload
npm run build    # static build of examples/
npm run graph    # emit examples/ graph JSON
```

## License

MIT — see [LICENSE](./LICENSE).
