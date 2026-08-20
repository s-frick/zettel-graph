// B3 — adjacency-matrix view.
//
// OWNER: agent B3. Contract: return { id, label, mount(container), update(keys),
// unmount() }. Render an N×N matrix (canvas is fine above ~150 nodes) from
// visibleGraph(state.model, state), rows/cols sorted by folder so block
// structure is visible. Cell colour from ../styling.js. Hovering a cell should
// set state.hoverId; clicking should set state.selectedId.

export function createMatrixView() {
  return {
    id: 'matrix',
    label: 'Matrix',
    mount(container) {
      container.innerHTML = '<div class="zk-view-placeholder">Matrix view — not implemented</div>';
    },
    update() {},
    unmount() {},
  };
}
