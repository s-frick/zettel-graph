---
type: Component
title: Parser
description: Walks an OKF bundle and emits a {nodes, links} graph.
tags: [parser, okf]
resource: src/okf.js
timestamp: 2026-06-30
---

# Parser

`src/okf.js` walks the bundle, reads frontmatter with gray-matter, and emits a
`{nodes, links}` graph. Each non-reserved `.md` file becomes a node whose `id`
is its bundle-relative path; every markdown link becomes a directed edge. Links
to files that do not exist yet become ghost nodes.

Implements the [Open Knowledge Format](/concepts/open-knowledge-format.md).
