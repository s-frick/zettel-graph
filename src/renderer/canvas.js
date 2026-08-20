// A1/A2 — 2D canvas renderer (Obsidian-style).
//
// OWNER: agent A. Implement against the facade contract in
// src/renderer/index.js, using the `force-graph` package (2D sibling of
// 3d-force-graph, already a dependency). Colour/size MUST come from
// ../styling.js — never re-derive them here.

import ForceGraph from 'force-graph';
import { nodeColor, nodeSize, linkColor, linkWidth, canvasBackground } from '../styling.js';

export function create2dRenderer(container, handlers = {}) {
  const el = document.createElement('div');
  el.className = 'zk-canvas';
  container.appendChild(el);

  const G = ForceGraph()(el)
    .backgroundColor(canvasBackground())
    .nodeId('id')
    .nodeLabel('title')
    .nodeColor(nodeColor)
    .nodeVal(nodeSize)
    .linkColor(linkColor)
    .linkWidth(linkWidth)
    .linkDirectionalArrowLength(3)
    .linkDirectionalArrowRelPos(1)
    .onNodeHover(handlers.onNodeHover || (() => {}))
    .onNodeClick(handlers.onNodeClick || (() => {}))
    .onBackgroundClick(handlers.onBackgroundClick || (() => {}));

  const onResize = () => G.width(el.clientWidth).height(el.clientHeight);
  window.addEventListener('resize', onResize);
  onResize();

  return {
    mode: '2d',
    element: el,
    setData: (g) => G.graphData(g),
    getData: () => G.graphData(),
    refresh: () => G.nodeColor(nodeColor).nodeVal(nodeSize).linkColor(linkColor).linkWidth(linkWidth),
    setBackground: (css) => G.backgroundColor(css),
    resize: onResize,
    zoomToFit: (ms = 600) => G.zoomToFit(ms, 40),
    setForces: (f) => {
      G.d3Force('charge')?.strength(f.charge);
      G.d3Force('link')?.distance(f.linkDistance).strength(f.linkStrength);
      G.d3ReheatSimulation();
    },
    focus: (node) => {
      if (!node || node.x == null) return;
      G.centerAt(node.x, node.y, 800);
      G.zoom(4, 800);
    },
    destroy() {
      window.removeEventListener('resize', onResize);
      G._destructor?.();
      el.remove();
    },
  };
}
