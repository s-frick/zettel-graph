// The node-link view. Owns a renderer instance (2D or 3D) and keeps it in sync
// with the shared state. Everything visual comes from ../styling.js.

import { state, setState } from '../state.js';
import { visibleGraph, neighborsWithin } from '../model/graph.js';
import { createRenderer } from '../renderer/index.js';
import { canvasBackground, nodeSize } from '../styling.js';

export function createGraphView() {
  let host = null;
  let renderer = null;
  let currentMode = null;
  let pendingFocus = null;

  async function ensureRenderer() {
    if (renderer && currentMode === state.renderMode) return renderer;
    const positions = renderer ? capturePositions(renderer) : null;
    renderer?.destroy();
    currentMode = state.renderMode;
    renderer = await createRenderer(currentMode, host, {
      onNodeHover: (node) => setState({ hoverId: node ? node.id : null }),
      onNodeClick: (node) => node && select(node.id),
      onBackgroundClick: () => select(null),
    });
    renderer.setForces(state.forces);
    pushData(positions);
    // Switching 2D<->3D starts a fresh layout, so it earns a fit of its own.
    if (state.ready) renderer.fitWhenSettled();
    return renderer;
  }

  function capturePositions(r) {
    const map = new Map();
    for (const n of r.getData().nodes || []) map.set(n.id, { x: n.x, y: n.y, z: n.z });
    return map;
  }

  function select(id) {
    setState({
      selectedId: id,
      neighborIds: id && state.model ? neighborsWithin(state.model, id, 1) : new Set(),
    });
  }

  function pushData(seed) {
    if (!renderer) return;
    const g = visibleGraph(state.model, state);
    // Carry positions over so a re-filter doesn't re-explode the layout.
    if (seed) {
      for (const n of g.nodes) {
        const p = seed.get(n.id);
        if (p && p.x != null) Object.assign(n, p);
      }
    }
    renderer.setData({
      // Biggest first: both the visible canvas and force-graph's pick buffer
      // paint in array order, so drawing small nodes last keeps them on top and
      // stops a hub's (deliberately generous) hit area from swallowing them.
      nodes: g.nodes.map((n) => ({ ...n })).sort((a, b) => nodeSize(b) - nodeSize(a)),
      links: g.links.map((l) => ({ ...l })),
    });
    if (pendingFocus) {
      const target = renderer.getData().nodes.find((n) => n.id === pendingFocus);
      pendingFocus = null;
      if (target) setTimeout(() => renderer.focus(target), 350);
    }
  }

  return {
    id: 'graph',
    label: 'Graph',

    async mount(container) {
      host = container;
      await ensureRenderer();
    },

    async update(keys) {
      if (keys.has('renderMode')) {
        await ensureRenderer();
        return;
      }
      if (!renderer) return;
      if (keys.has('model') || keys.has('filters') || keys.has('localGraph') || keys.has('timeline')) {
        pushData(capturePositions(renderer));
      }
      // The app signals readiness once every panel has applied its initial
      // state; that is the first moment a fit is worth attempting.
      if (keys.has('ready') && state.ready) renderer.fitWhenSettled();
      if (keys.has('forces')) renderer.setForces(state.forces);
      if (keys.has('theme')) renderer.setBackground(canvasBackground());
      renderer.refresh();
    },

    /** Called by the search panel to fly to a node (works in both modes). */
    focusNode(id) {
      if (!renderer) return;
      const node = renderer.getData().nodes.find((n) => n.id === id);
      if (node) renderer.focus(node);
      else pendingFocus = id;
    },

    /** Toolbar "fit" button and the f key. */
    fit(ms = 600) {
      renderer?.zoomToFit(ms);
    },

    unmount() {
      renderer?.destroy();
      renderer = null;
      currentMode = null;
    },
  };
}
