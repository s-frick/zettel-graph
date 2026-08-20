// A5 — filter panel: type / tag / folder / bundle checkboxes plus the
// ghost/orphan/tag-node toggles and the colour-by selector.
//
// OWNER: agent A5. Contract: return { id, mount(root) }. Write to
// state.filters (Set or null per facet — null means "no restriction") and
// state.colorBy via setState. Facet lists come from state.model.types /
// .tags / .folders / .bundles / .clusters (already sorted by count).
// Reflect state changes back into the checkboxes so the legend shortcut and
// this panel stay in sync. Persist to the URL hash (see src/router.js).

export function createFiltersPanel() {
  return { id: 'filters', mount() {} };
}
