// B1 — health / lint dashboard.
//
// OWNER: agent B1. Contract: return { id, label, mount(container), update(keys),
// unmount() }. Compute checks in ../lint.js (pure, testable) and render them
// here. Clicking a finding must setState({ selectedId, view: 'graph' }).

export function createLintView() {
  return {
    id: 'lint',
    label: 'Health',
    mount(container) {
      container.innerHTML = '<div class="zk-view-placeholder">Health view — not implemented</div>';
    },
    update() {},
    unmount() {},
  };
}
