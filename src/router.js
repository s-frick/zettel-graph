// URL-hash <-> state sync, so any view/filter/selection is a shareable link.
// Example: #view=graph&mode=2d&color=folder&node=knowledge/gotchas/x.md
//
// Shared infrastructure. Panels that add persistable state register a codec
// here rather than touching location.hash themselves.

import { state, setState } from './state.js';

const codecs = [
  { key: 'view', read: () => state.view, write: (v) => ({ view: v }) },
  { key: 'mode', read: () => state.renderMode, write: (v) => ({ renderMode: v === '2d' ? '2d' : '3d' }) },
  { key: 'color', read: () => state.colorBy, write: (v) => ({ colorBy: v }) },
  { key: 'theme', read: () => state.theme, write: (v) => ({ theme: v === 'light' ? 'light' : 'dark' }) },
  { key: 'node', read: () => state.selectedId || '', write: (v) => ({ selectedId: v || null }) },
];

/** Register an extra hash param. `write` returns a state patch. */
export function registerHashParam(codec) {
  codecs.push(codec);
}

let applying = false;

export function applyHashToState() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const patch = {};
  for (const c of codecs) {
    const raw = params.get(c.key);
    if (raw != null) Object.assign(patch, c.write(decodeURIComponent(raw)));
  }
  if (Object.keys(patch).length) {
    applying = true;
    setState(patch);
    applying = false;
  }
}

export function syncStateToHash() {
  if (applying) return;
  const params = new URLSearchParams();
  for (const c of codecs) {
    const v = c.read();
    if (v) params.set(c.key, encodeURIComponent(v));
  }
  const next = '#' + params.toString();
  if (next !== location.hash) history.replaceState(null, '', next);
}

export function startRouter() {
  applyHashToState();
  window.addEventListener('hashchange', applyHashToState);
}
