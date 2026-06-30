---
type: Component
title: CLI
description: The zettel-graph command-line entrypoint that dispatches dev/build/graph/init.
tags: [cli, entrypoint]
resource: bin/cli.js
timestamp: 2026-06-30
---

# CLI

`bin/cli.js` is the `zettel-graph` executable. It parses argv, resolves the
bundle directory, and dispatches to one of four commands. It embodies the
[CLI-first decision](/decisions/cli-first.md).

## Commands

| Command | Action |
| --- | --- |
| `dev` (default) | start the Vite dev server with hot-reload |
| `build` | static site build into `-o` dir (default `dist/`) |
| `graph` | call [the parser](/components/okf-parser.md) and emit `graph.json` (stdout if no `-o`) |
| `init` | scaffold a bundle via [the init command](/components/init-command.md) |

## Flags

- `-p` / `--port` — dev server port
- `-o` / `--out` — output path (build dir or graph file)
- `-f` / `--force` — `init`: overwrite existing files
- `-h` / `--help` — usage

## Behaviour

- `dir` defaults to the current working directory (`init` defaults to
  `knowledge`).
- **Vite root is pinned to the package** (`PKG_ROOT`) so the client app is
  served from the install location, while the content bundle is exported as the
  `OKF_BUNDLE` env var that the [Vite config](/components/vite-config.md) reads.
- `init` runs before the bundle existence check (it creates the dir); all other
  commands error out if the bundle directory is missing.
