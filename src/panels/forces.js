// A3 — force-simulation controls (centre, repel, link distance, link strength).
//
// OWNER: agent A3. Contract: return { id, mount(root) }. Render a collapsible
// panel; each slider does setState({ forces: { … } }) — the graph view forwards
// state.forces to the active renderer, so nothing here touches a renderer.
// Use ../ui/dom.js `slider()` and a `.zk-panel` shell for consistent chrome.
// Persist values to localStorage under 'zk:forces' and restore on mount.

export function createForcesPanel() {
  return { id: 'forces', mount() {} };
}
