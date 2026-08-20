// Bottom-left legend. Rows are clickable: a click toggles that category in
// state.filters (the filter panel — A5 — owns the richer UI, this is the shortcut).

import { state, setState, subscribe } from '../state.js';
import { paletteColor } from '../styling.js';
import { escapeHtml, el } from '../ui/dom.js';

const FACET_BY_COLORBY = { type: 'types', folder: 'folders', bundle: 'bundles', cluster: 'clusters' };

export function createLegendPanel() {
  const node = el('div.legend');

  function render() {
    const m = state.model;
    if (!m) return;
    const facetKey = FACET_BY_COLORBY[state.colorBy] || 'types';
    const entries = m[facetKey] || [];
    const activeSet = state.filters[facetKey === 'clusters' ? 'types' : facetKey];
    node.innerHTML =
      `<div class="legend-title">${escapeHtml(state.colorBy)}</div>` +
      entries
        .map(([key, count]) => {
          const on = !activeSet || activeSet.has(key);
          const label = key === '_missing' ? 'missing' : key;
          return `<div class="legend-row${on ? '' : ' off'}" data-key="${escapeHtml(key)}">
            <span class="legend-dot" style="background:${paletteColor(key)}"></span>
            <span class="legend-label">${escapeHtml(label)}</span>
            <span class="legend-count">${count}</span>
          </div>`;
        })
        .join('');
  }

  return {
    id: 'legend',
    mount(root) {
      root.appendChild(node);
      node.addEventListener('click', (e) => {
        const row = e.target.closest('.legend-row');
        if (!row) return;
        const facetKey = FACET_BY_COLORBY[state.colorBy] || 'types';
        if (facetKey === 'clusters') return;
        const all = new Set((state.model[facetKey] || []).map(([k]) => k));
        const cur = state.filters[facetKey] ? new Set(state.filters[facetKey]) : new Set(all);
        const key = row.dataset.key;
        cur.has(key) ? cur.delete(key) : cur.add(key);
        setState({ filters: { [facetKey]: cur.size === all.size ? null : cur } });
      });
      subscribe((keys) => {
        if (keys.has('model') || keys.has('colorBy') || keys.has('filters')) render();
      });
    },
  };
}
