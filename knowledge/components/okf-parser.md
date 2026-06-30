---
type: Component
title: OKF parser
description: Walks a bundle directory and turns it into a force-graph {nodes, links} structure.
tags: [parser, okf, graph]
resource: src/okf.js
timestamp: 2026-06-30
---

# OKF parser

`src/okf.js` exports `buildGraph(bundleDir)`, the function that turns an
[OKF](/concepts/okf.md) bundle into the `{ nodes, links }` object the
[browser app](/components/browser-app.md) renders. It is the implementation
behind the [links-as-edges](/concepts/links-as-edges.md) and
[ghost-node](/concepts/ghost-nodes.md) concepts.

## What it does

1. **Walk.** Recurses the bundle (`walk`), collecting `.md` files. Skips
   dotfiles (`.git`) and the dependency/build dirs `node_modules`, `dist`,
   `build`, `vendor` (`IGNORE_DIRS`).
2. **Filter reserved files.** Drops `index.md`, `log.md`, `AGENTS.md`,
   `CLAUDE.md`, `README.md` (`NON_NODES`) — see [reserved files](/concepts/reserved-files.md).
3. **Pass 1 — nodes.** For each remaining file: parse YAML frontmatter with
   `gray-matter`, build a node whose `id` is the bundle-relative posix path
   (see [path-as-id](/decisions/path-as-id.md)).
4. **Pass 2 — links.** Scan each body with `LINK_RE` for markdown links;
   `resolveLink` maps each to a target id, deduped into directed edges.

## Node fields (pass 1)

| Field | Source |
| --- | --- |
| `id` | bundle-relative posix path (`toId`) |
| `title` | `fm.title`, else first H1, else basename |
| `type` | `fm.type`, else `'Unknown'` |
| `tags` | normalized list (`normalizeTags`) |
| `summary` | `fm.description`, else first paragraph |
| `resource` | `fm.resource` or `null` |
| `timestamp` | `fm.timestamp` or `null` |
| `ghost` | `false` |

See [frontmatter type required](/gotchas/frontmatter-type-required.md) for the
`type` fallback behaviour.

## Link resolution (pass 2)

`resolveLink(href, fromId)` strips `?`/`#`, ignores external (`scheme:` /
`//host`) and non-`.md` links, then:

- **Bundle-relative** (`/...`): strip leading slashes.
- **Relative**: normalize against the linking file's directory.

Links to non-existent targets create a `ghost` placeholder node
(`type: '_missing'`). Self-links and links to reserved files are dropped. See
[link resolution](/gotchas/link-resolution.md) for the failure modes.
