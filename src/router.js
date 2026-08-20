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
  // Several codecs write into the same nested key (e.g. every facet writes
  // `filters`), so a flat Object.assign would let the last one win. Merge one
  // level deep, matching setState's own merge semantics.
  const patch = {};
  for (const c of codecs) {
    const raw = params.get(c.key);
    if (raw == null) continue;
    for (const [k, v] of Object.entries(c.write(raw))) {
      const isPlain = (o) => o && typeof o === 'object' && !Array.isArray(o) && !(o instanceof Set);
      patch[k] = isPlain(patch[k]) && isPlain(v) ? { ...patch[k], ...v } : v;
    }
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
    if (v) params.set(c.key, v);
  }
  const next = '#' + params.toString();
  if (next !== location.hash) history.replaceState(null, '', next);
}

export function startRouter() {
  applyHashToState();
  window.addEventListener('hashchange', applyHashToState);
}
