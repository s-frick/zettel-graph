---
type: Concept
title: Open Knowledge Format
description: Markdown + YAML frontmatter convention for portable knowledge bundles.
tags: [okf, format, markdown]
resource: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
timestamp: 2026-06-30
---

# Open Knowledge Format

OKF stores knowledge as a directory of markdown files. Each file carries YAML
frontmatter with a required `type` and recommended `title`, `description`,
`tags`, `resource`, and `timestamp`. Markdown links between files are directed,
untyped edges.

`index.md` and `log.md` are reserved navigation files — they are not nodes.

The [parser](/components/parser.md) turns an OKF bundle into a
[force-directed graph](/concepts/force-directed-graph.md).
