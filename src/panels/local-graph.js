// A4 — local graph: the selected note's neighbourhood at depth 1–3.
//
// OWNER: agent A4. Contract: return { id, mount(root) }. Two parts:
//   1) a small always-on inset panel rendering the neighbourhood with its own
//      2D renderer instance (createRenderer('2d', …) from ../renderer/index.js),
//   2) a depth slider + an "isolate in main view" toggle that flips
//      state.localGraph.enabled — the main graph view already narrows itself
//      via visibleGraph() when that is on.
// Use neighborsWithin(state.model, id, depth) from ../model/graph.js.

export function createLocalGraphPanel() {
  return { id: 'localGraph', mount() {} };
}
