---
type: Component
title: Browser app
description: The 3D ForceGraph client that renders nodes, panels, legend, and live-reloads on edit.
tags: [frontend, force-graph, ui]
resource: src/main.js
timestamp: 2026-06-30
---

# Browser app

`src/main.js` is the client that visualizes the graph produced by the
[OKF parser](/components/okf-parser.md). It fetches `/graph.json` (served by the
[Vite config](/components/vite-config.md)) and renders it with `ForceGraph3D`.

## Rendering

- `ForceGraph3D()` mounted on `#3d-graph`, black background.
- **Colour by type**: `.nodeAutoColorBy('type')` — node colour is driven by the
  frontmatter `type` (see [frontmatter type required](/gotchas/frontmatter-type-required.md)).
- **Node size**: `.nodeVal` returns 1 for [ghost nodes](/concepts/ghost-nodes.md),
  4 otherwise — ghosts render smaller/fainter.
- Directional arrows mark edge direction (see [links-as-edges](/concepts/links-as-edges.md)).
- Optional `UnrealBloomPass` glow, dynamically imported and guarded so a THREE
  version mismatch never breaks the graph.

## Interaction

| Element | Behaviour |
| --- | --- |
| Hover preview | floating panel near cursor; renders markdown body (capped) |
| Click detail | side panel with full body, resource link, close button |
| Selection highlight | selected node yellow, neighbours kept, rest dimmed |
| Type legend | swatch per `type` (resolved lazily after colour assignment) |
| Close | `Esc`/`q`/`Q` or background click |

Bodies are rendered with `marked`, syntax-highlighted with `highlight.js`;
frontmatter and leading H1 are stripped before render. Ghost nodes show
"not yet written".

## Hot reload

When `import.meta.hot` is present it listens for the custom `okf:update` HMR
event and re-runs `loadGraph()` — the live-reload loop set up by the
[Vite config](/components/vite-config.md) and motivated by
[the Vite/HMR decision](/decisions/vite-hmr.md).
