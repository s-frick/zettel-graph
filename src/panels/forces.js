// A3 — force-simulation controls (centre, repel, link distance, link strength).
//
// OWNER: agent A3. Contract: return { id, mount(root) }. Render a collapsible
// panel; each slider does setState({ forces: { … } }) — the graph view forwards
// state.forces to the active renderer, so nothing here touches a renderer.
// Use ../ui/dom.js `slider()` and a `.zk-panel` shell for consistent chrome.
// Persist values to localStorage under 'zk:forces' and restore on mount.

import { state, setState, subscribe } from '../state.js';
import { el, slider } from '../ui/dom.js';

const STORAGE_KEY = 'zk:forces';

// Snapshot the values state.js ships with, so "reset" never drifts from them.
const DEFAULTS = { ...state.forces };

const SPECS = [
  { key: 'charge', label: 'repulsion', min: -400, max: 0, step: 5 },
  { key: 'linkDistance', label: 'link distance', min: 5, max: 200, step: 1 },
  { key: 'linkStrength', label: 'link strength', min: 0, max: 2, step: 0.05 },
  { key: 'centerStrength', label: 'centre', min: 0, max: 1, step: 0.05 },
];

/** Only keep known numeric keys — stored JSON is user-editable and may be stale. */
function sanitize(raw) {
  const out = {};
  for (const { key } of SPECS) {
    const v = Number(raw?.[key]);
    if (Number.isFinite(v)) out[key] = v;
  }
  return out;
}

function load() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return {};
  }
}

function save(forces) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitize(forces)));
  } catch {
    // Private mode / quota — persistence is a nicety, never a hard failure.
  }
}

export function createForcesPanel() {
  const node = el('div.zk-forces');
  const toggle = el('button.zk-forces-toggle', { type: 'button', title: 'force simulation', text: '⚙ forces' });
  const body = el('div.zk-panel.zk-forces-body');
  const rows = new Map();

  for (const spec of SPECS) {
    // Integer steps read better without a trailing ".00" than fractional ones.
    const format = spec.step < 1 ? (v) => Number(v).toFixed(2) : (v) => String(Math.round(v));
    const row = slider({
      ...spec,
      value: state.forces[spec.key],
      format,
      onInput: (v) => {
        setState({ forces: { [spec.key]: v } });
        save(state.forces);
      },
    });
    rows.set(spec.key, row);
    body.append(row);
  }

  body.append(
    el('button.zk-forces-reset', {
      type: 'button',
      text: 'reset to defaults',
      onclick: () => {
        setState({ forces: { ...DEFAULTS } });
        save(state.forces);
      },
    }),
  );

  node.append(toggle, body);

  /** Mirror state into the sliders — covers reset, restore and hash-driven changes. */
  function syncSliders() {
    for (const [key, row] of rows) row.setValue(state.forces[key]);
  }

  function syncVisibility() {
    // Forces only exist in the graph view; hiding beats showing dead controls.
    node.style.display = state.view === 'graph' ? '' : 'none';
  }

  return {
    id: 'forces',
    mount(root) {
      root.appendChild(node);

      toggle.addEventListener('click', () => {
        const open = node.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      toggle.setAttribute('aria-expanded', 'false');

      // Restore through setState so the renderer picks the values up too.
      const stored = load();
      if (Object.keys(stored).length) setState({ forces: stored });
      syncSliders();
      syncVisibility();

      subscribe((keys) => {
        if (keys.has('forces')) syncSliders();
        if (keys.has('view')) syncVisibility();
      });
    },
  };
}
