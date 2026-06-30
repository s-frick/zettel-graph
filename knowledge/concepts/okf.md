---
type: Concept
title: Open Knowledge Format
description: A directory of markdown-plus-frontmatter notes that form a graph, where files are nodes and links are edges.
tags: [okf, format, core]
resource: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
timestamp: 2026-06-30
---

# Open Knowledge Format

OKF (Open Knowledge Format) is the data model this whole project visualizes. A
bundle is a directory of markdown files; the structure *is* a graph.

## Core rules

- **Note = markdown + YAML frontmatter.** The only required field is `type` (see
  [frontmatter type required](/gotchas/frontmatter-type-required.md)); `title`,
  `description`, `tags`, `resource`, `timestamp` are recommended.
- **Path-as-id.** A note's identity is its bundle-relative path without `.md`
  — see [the path-as-id decision](/decisions/path-as-id.md).
- **Links-as-edges.** Markdown links between `.md` files are directed, untyped
  edges — see [links as edges](/concepts/links-as-edges.md).
- **Ghost nodes.** A link to a not-yet-written note renders as a faint
  placeholder — see [ghost nodes](/concepts/ghost-nodes.md).
- **Reserved files.** `index.md`/`log.md` are navigation; `AGENTS.md`,
  `CLAUDE.md`, `README.md` are excluded — see [reserved files](/concepts/reserved-files.md).

## In this project

[The OKF parser](/components/okf-parser.md) implements these rules. This bundle
is maintained in the [llm-wiki workflow](/concepts/llm-wiki.md). The choice to
adopt OKF rather than invent a format is recorded in
[OKF over custom](/decisions/okf-over-custom.md).
