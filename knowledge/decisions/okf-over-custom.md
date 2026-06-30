---
type: Decision
title: OKF over a custom format
description: Adopt the Open Knowledge Format rather than inventing a bespoke note/graph schema.
tags: [decision, okf, format]
resource: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
timestamp: 2026-06-30
---

# OKF over a custom format

The project visualizes [OKF](/concepts/okf.md) bundles rather than a homegrown
note format.

## Decision

Use OKF as-is: markdown + YAML frontmatter, `type` the only required field,
[path-as-id](/decisions/path-as-id.md), and [links-as-edges](/concepts/links-as-edges.md).

## Why

- **Interop.** OKF is an open spec, so bundles work with other OKF tooling, not
  just this visualizer.
- **Minimal schema.** Requiring only `type` keeps authoring nearly frictionless
  while still giving the graph its colour grouping (see
  [frontmatter type required](/gotchas/frontmatter-type-required.md)).
- **Plain files.** Notes are ordinary markdown — editable by hand, by agents, and
  diffable in git, which suits the [llm-wiki workflow](/concepts/llm-wiki.md).

## Consequence

We inherit OKF's conventions wholesale, including [reserved files](/concepts/reserved-files.md)
and [ghost nodes](/concepts/ghost-nodes.md). [The parser](/components/okf-parser.md)
is a faithful implementation of the spec rather than a custom dialect.
