// B2 — folder-hierarchy view (indented tree and/or sunburst).
//
// OWNER: agent B2. Contract: return { id, label, mount(container), update(keys),
// unmount() }. Build the tree from node ids (`bundle/folder/file.md`) via
// ../model/graph.js helpers; take colours from ../styling.js (baseColor) so it
// matches the graph view. Read the visible subgraph with visibleGraph(state.model, state)
// so filters apply here too. Clicking a leaf must call setState({ selectedId }).

export function createHierarchyView() {
  return {
    id: 'hierarchy',
    label: 'Hierarchy',
    mount(container) {
      container.innerHTML = '<div class="zk-view-placeholder">Hierarchy view — not implemented</div>';
    },
    update() {},
    unmount() {},
  };
}
