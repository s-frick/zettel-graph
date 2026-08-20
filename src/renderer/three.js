// 3D renderer (three.js / 3d-force-graph) behind the shared renderer facade.
// See src/renderer/index.js for the contract.

import ForceGraph3D from '3d-force-graph';
import { nodeColor, nodeSize, linkColor, linkWidth, canvasBackground } from '../styling.js';

export function create3dRenderer(container, handlers = {}) {
  const el = document.createElement('div');
  el.className = 'zk-canvas';
  container.appendChild(el);

  const G = ForceGraph3D()(el)
    .backgroundColor(canvasBackground())
    .nodeLabel('title')
    .nodeColor(nodeColor)
    .nodeVal(nodeSize)
    .nodeOpacity(0.9)
    .linkColor(linkColor)
    .linkWidth(linkWidth)
    .linkDirectionalArrowLength(3)
    .linkDirectionalArrowRelPos(1)
    .onNodeHover(handlers.onNodeHover || (() => {}))
    .onNodeClick(handlers.onNodeClick || (() => {}))
    .onBackgroundClick(handlers.onBackgroundClick || (() => {}));

  // Optional bloom glow. 3d-force-graph bundles three; with resolve.dedupe the
  // addon shares the renderer's THREE. Guard so a version mismatch never breaks
  // the graph itself.
  (async () => {
    try {
      const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
      const bloom = new UnrealBloomPass();
      bloom.strength = 0.7;
      bloom.radius = 0.7;
      bloom.threshold = 0.03;
      G.postProcessingComposer().addPass(bloom);
    } catch (err) {
      console.warn('[zettel-graph] bloom disabled:', err);
    }
  })();

  let pendingFit = false;
  G.onEngineStop(() => {
    if (!pendingFit) return;
    pendingFit = false;
    G.zoomToFit(400, 40);
  });
  el.addEventListener('pointerdown', () => { pendingFit = false; }, { passive: true });
  el.addEventListener('wheel', () => { pendingFit = false; }, { passive: true });

  const onResize = () => G.width(el.clientWidth).height(el.clientHeight);
  window.addEventListener('resize', onResize);
  onResize();

  return {
    mode: '3d',
    element: el,
    setData: (g) => G.graphData(g),
    getData: () => G.graphData(),
    refresh: () => G.nodeColor(nodeColor).nodeVal(nodeSize).linkColor(linkColor).linkWidth(linkWidth),
    setBackground: (css) => G.backgroundColor(css),
    resize: onResize,
    zoomToFit: (ms = 600) => {
      pendingFit = false;
      G.zoomToFit(ms, 40);
    },
    fitWhenSettled: () => { pendingFit = true; },
    setForces: (f) => {
      G.d3Force('charge')?.strength(f.charge);
      G.d3Force('link')?.distance(f.linkDistance).strength(f.linkStrength);
      const c = G.d3Force('center');
      if (c && c.strength) c.strength(f.centerStrength);
      G.d3ReheatSimulation();
    },
    focus(node) {
      if (!node || node.x == null) return;
      const dist = 120;
      const ratio = 1 + dist / (Math.hypot(node.x, node.y, node.z || 0) || 1);
      G.cameraPosition(
        { x: node.x * ratio, y: node.y * ratio, z: (node.z || 0) * ratio },
        node,
        1200,
      );
    },
    destroy() {
      window.removeEventListener('resize', onResize);
      G._destructor?.();
      el.remove();
    },
  };
}
