---
type: Concept
title: Force-directed graph
description: Layout that positions nodes via simulated attraction and repulsion.
tags: [graph, layout, visualization]
resource: https://github.com/vasturiano/3d-force-graph
timestamp: 2026-06-30
---

# Force-directed graph

Nodes repel each other while links pull connected nodes together; the
simulation settles into a layout that surfaces clusters and structure.
zettel-graph renders this in 3D with `3d-force-graph` / three.js and colours
each node by its frontmatter `type`.

Built from an [OKF](/concepts/open-knowledge-format.md) bundle by the
[CLI](/components/cli.md).
