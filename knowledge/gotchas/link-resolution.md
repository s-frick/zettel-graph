---
type: Gotcha
title: Link resolution
description: How relative vs bundle-relative links resolve, and why plain relative links break when files move.
tags: [gotcha, links, parser]
resource: src/okf.js
timestamp: 2026-06-30
---

# Link resolution

`resolveLink(href, fromId)` in [the parser](/components/okf-parser.md) decides
where each [link](/concepts/links-as-edges.md) points. Getting this wrong leaks
accidental [ghost nodes](/concepts/ghost-nodes.md).

## What resolveLink does

1. Strip everything after `?` or `#`, then trim.
2. **Ignore** external links (a `scheme:` prefix or protocol-relative `//host`)
   and any href that does not end in `.md` — these produce no edge.
3. **Bundle-relative** (`href` starts with `/`): strip leading slashes →
   `components/okf-parser.md`. Resolved against the bundle root, independent of
   the linking file's location.
4. **Relative** (otherwise): `path.posix.normalize(join(dirname(fromId), href))`
   — resolved against the *linking file's* directory.

## The failure mode

A plain relative link like `../components/okf-parser.md` is computed from where
the *current* file lives. If either file moves, the computed target changes and
may no longer match any real note — the parser then silently mints a ghost node
instead of erroring.

Because [identity is the path](/decisions/path-as-id.md), this is easy to trigger
by reorganizing folders.

## Mitigation

Prefer **bundle-relative** `/` links: they are anchored to the root, so moving
the *linking* file never breaks them. Only moving the *target* does, and that
breaks any link style. When you see an unexpected faint node, check for a typo'd
or stale relative path — that is an accidental ghost, distinct from the
intentional ghosts described in [ghost nodes](/concepts/ghost-nodes.md).
