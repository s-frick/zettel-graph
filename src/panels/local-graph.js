// A4 — local graph: the selected note's neighbourhood at depth 1–3.
//
// OWNER: agent A4. Contract: return { id, mount(root) }. Two parts:
//   1) a small always-on inset panel rendering the neighbourhood with its own
//      2D renderer instance (createRenderer('2d', …) from ../renderer/index.js),
//   2) a depth slider + an "isolate in main view" toggle that flips
//      state.localGraph.enabled — the main graph view already narrows itself
//      via visibleGraph() when that is on.
// Use neighborsWithin(state.model, id, depth) from ../model/graph.js.

import { state, setState, subscribe } from '../state.js';
import { neighborsWithin, visibleGraph } from '../model/graph.js';
import { createRenderer } from '../renderer/index.js';
import { canvasBackground } from '../styling.js';
import { el, slider, checkbox } from '../ui/dom.js';

const STORE_KEY = 'zk:localGraph';

export function createLocalGraphPanel() {
  let renderer = null;
  // In-flight createRenderer(): a burst of state changes must not boot two canvases.
  let booting = null;
  let collapsed = restoreCollapsed();

  const host = el('div.local-graph-canvas');
  const hint = el('div.local-graph-hint', { text: 'select a note' });
  const caret = el('span.local-graph-caret', { text: '▾' });

  const depthRow = slider({
    label: 'depth',
    min: 1,
    max: 3,
    value: state.localGraph.depth,
    onInput: (v) => setState({ localGraph: { depth: v } }),
  });
  const isolateRow = checkbox({
    label: 'isolate in main view',
    checked: state.localGraph.enabled,
    // The graph view narrows itself through visibleGraph() — only flip the flag.
    onChange: (on) => setState({ localGraph: { enabled: on } }),
  });

  const header = el(
    'div.local-graph-header',
    { onclick: () => setCollapsed(!collapsed) },
    el('span.zk-panel-title', { text: 'local graph' }),
    caret,
  );
  const body = el(
    'div.local-graph-body',
    {},
    host,
    hint,
    el('div.local-graph-controls', {}, depthRow, isolateRow),
  );
  const node = el('div.local-graph.zk-panel', {}, header, body);

  function setCollapsed(v) {
    collapsed = v;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ collapsed }));
    } catch { /* private mode — collapse state is not worth failing over */ }
    sync();
  }

  /** Neighbourhood of the selection, intersected with what the filters allow. */
  function subgraph() {
    const m = state.model;
    const near = neighborsWithin(m, state.selectedId, state.localGraph.depth);
    const visible = new Set(visibleGraph(m, state).nodes.map((n) => n.id));
    // The selection itself always stays, even when a filter would hide it.
    const keep = new Set([...near].filter((id) => visible.has(id) || id === state.selectedId));
    return {
      // Copy: the renderer mutates nodes/links with simulation positions.
      nodes: m.nodes.filter((n) => keep.has(n.id)).map((n) => ({ ...n })),
      links: m.links.filter((l) => keep.has(l.source) && keep.has(l.target)).map((l) => ({ ...l })),
    };
  }

  async function ensureRenderer() {
    if (renderer) return renderer;
    if (!booting) {
      booting = createRenderer('2d', host, {
        onNodeClick: (n) => n && select(n.id),
      })
        .then((r) => {
          // A collapse may have raced the dynamic import — drop the instance.
          if (collapsed || state.view !== 'graph') {
            r.destroy();
            return null;
          }
          renderer = r;
          r.setBackground(canvasBackground());
          r.setForces(state.forces);
          return r;
        })
        .finally(() => { booting = null; });
    }
    return booting;
  }

  function destroyRenderer() {
    renderer?.destroy();
    renderer = null;
  }

  // Mirrors the main view's selection semantics so styling.js dims consistently.
  function select(id) {
    setState({
      selectedId: id,
      neighborIds: id && state.model ? neighborsWithin(state.model, id, 1) : new Set(),
    });
  }

  function pushData(r) {
    if (!r) return;
    r.setData(subgraph());
    r.resize();
    // Let the simulation settle a beat before framing the neighbourhood.
    setTimeout(() => r === renderer && r.zoomToFit(400), 300);
  }

  function sync() {
    const onGraph = state.view === 'graph';
    const ready = !!(state.selectedId && state.model);
    node.classList.toggle('hidden', !onGraph);
    node.classList.toggle('collapsed', collapsed);
    // The detail panel owns the right edge whenever something is selected.
    node.classList.toggle('shifted', ready);
    caret.textContent = collapsed ? '▸' : '▾';
    host.style.display = ready ? '' : 'none';
    hint.style.display = ready ? 'none' : '';
    depthRow.setValue(state.localGraph.depth);
    isolateRow.setChecked(state.localGraph.enabled);

    // Lazy: no second canvas context until the panel actually shows a graph.
    if (!onGraph || collapsed || !ready) {
      destroyRenderer();
      return;
    }
    ensureRenderer().then(pushData);
  }

  return {
    id: 'localGraph',
    mount(root) {
      root.appendChild(node);
      // The panel is user-resizable; the renderer only listens to window resizes.
      new ResizeObserver(() => renderer?.resize()).observe(node);
      subscribe((keys) => {
        if (keys.has('theme')) renderer?.setBackground(canvasBackground());
        if (keys.has('forces')) renderer?.setForces(state.forces);
        if (keys.has('selectedId') || keys.has('localGraph') || keys.has('model') ||
            keys.has('filters') || keys.has('view') || keys.has('timeline')) {
          sync();
        } else {
          renderer?.refresh();
        }
      });
      sync();
    },
  };
}

function restoreCollapsed() {
  try {
    return !!JSON.parse(localStorage.getItem(STORE_KEY) || '{}').collapsed;
  } catch {
    return false;
  }
}
