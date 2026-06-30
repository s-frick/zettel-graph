---
type: Decision
title: Path as ID
description: A note's identity is its bundle-relative path, not its title.
tags: [decision, identity, okf]
resource: src/okf.js
timestamp: 2026-06-30
---

# Path as ID

A note's ID is its bundle-relative posix path without `.md`
(`concepts/okf.md` → `concepts/okf`), assigned by `toId` in
[the parser](/components/okf-parser.md). Identity is the path, not the
frontmatter `title`.

## Why

- **Title edits are free.** Renaming the human-readable title does not change the
  node's identity or break any [links](/concepts/links-as-edges.md) pointing at it.
- **Stable cross-links.** Bundle-relative `/` links target the path directly, so
  they resolve deterministically regardless of where the linking file sits.
- **Platform-stable.** `toId` joins path segments with `/`, so ids are identical
  on Windows and POSIX.

## Trade-offs

- **Moving a file changes its id.** Relocating `concepts/okf.md` breaks every
  inbound link unless they are updated — this is the core of the
  [link-resolution gotcha](/gotchas/link-resolution.md), and a broken link
  silently becomes a [ghost node](/concepts/ghost-nodes.md).
- Mitigation: prefer bundle-relative links and rename deliberately. See also
  [OKF over custom](/decisions/okf-over-custom.md) for why we accept OKF's
  path-based identity wholesale.
