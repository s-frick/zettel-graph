// Shared visual language: one palette and one set of colour/size rules used by
// BOTH renderers (2D + 3D) and by the hierarchy/matrix/lint views, so a node is
// the same colour everywhere.
//
// Shared infrastructure — do not fork these rules inside a view.

import { state } from './state.js';

// Categorical palette (12 hues, tuned for a dark canvas but legible on light).
const PALETTE = [
  '#7aa2f7', '#f7768e', '#9ece6a', '#e0af68', '#bb9af7', '#7dcfff',
  '#ff9e64', '#73daca', '#c0caf5', '#f7b5ca', '#a6da95', '#eed49f',
];
const GHOST_COLOR = '#5a6273';
const TAG_COLOR = '#c8a2ff';
const SELECT_COLOR = '#ffcc00';

const colorCache = new Map();

/** Stable colour for a categorical key (same key -> same hue across reloads). */
export function paletteColor(key) {
  if (key == null || key === '') return '#8a8a8a';
  if (key === '_missing') return GHOST_COLOR;
  if (key === '_tag') return TAG_COLOR;
  if (colorCache.has(key)) return colorCache.get(key);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const c = PALETTE[h % PALETTE.length];
  colorCache.set(key, c);
  return c;
}

/** The categorical key a node is coloured by, per `state.colorBy`. */
export function colorKey(node) {
  if (node.ghost) return '_missing';
  if (node.isTag) return '_tag';
  switch (state.colorBy) {
    case 'folder': return node.folder || '';
    case 'bundle': return node.bundle || '';
    case 'cluster': return node.cluster || '';
    default: return node.type || 'Unknown';
  }
}

/** Undimmed base colour — used by legends, matrix cells and tree rows. */
export function baseColor(node) {
  if (state.timeline.colorByAge) return ageColor(node);
  return paletteColor(colorKey(node));
}

// Blue (old) -> yellow (new) ramp over the timeline's date range.
let ageRange = null;
export function setAgeRange(minIso, maxIso) {
  ageRange = minIso && maxIso && minIso !== maxIso ? [minIso, maxIso] : null;
}
function ageColor(node) {
  if (!ageRange || !node.timestamp) return '#6b7280';
  const [lo, hi] = ageRange.map((d) => Date.parse(d));
  const t = Math.min(1, Math.max(0, (Date.parse(String(node.timestamp).slice(0, 10)) - lo) / (hi - lo)));
  const mix = (a, b) => Math.round(a + (b - a) * t);
  return `rgb(${mix(58, 240)},${mix(110, 200)},${mix(200, 80)})`;
}

const DIM_NODE = 'rgba(150,150,150,0.12)';
const DIM_NODE_SEARCH = 'rgba(140,140,140,0.06)';

/**
 * Final node colour, incorporating selection and search dimming.
 * Both renderers call exactly this.
 */
export function nodeColor(node) {
  if (node.id === state.selectedId) return SELECT_COLOR;
  if (state.search.active && !state.search.matchIds.has(node.id)) return DIM_NODE_SEARCH;
  const base = baseColor(node);
  if (!state.selectedId) return base;
  return state.neighborIds.has(node.id) ? base : DIM_NODE;
}

/** Radius-ish size, scaled by degree so hubs read as hubs. */
export function nodeSize(node) {
  if (node.ghost) return 1.5;
  // Tag nodes carry their note count as degree — scale them like real hubs but
  // a touch smaller, so a 20-note tag reads as big without drowning the notes.
  if (node.isTag) return 2 + Math.sqrt(node.degree || 0) * 1.2;
  return 3 + Math.sqrt(node.degree || 0) * 1.6;
}

export function linkEndpoints(link) {
  const s = link.source && link.source.id != null ? link.source.id : link.source;
  const t = link.target && link.target.id != null ? link.target.id : link.target;
  return [s, t];
}

export function linkColor(link) {
  const [s, t] = linkEndpoints(link);
  if (state.selectedId && (s === state.selectedId || t === state.selectedId)) return SELECT_COLOR;
  if (state.search.active) {
    return state.search.matchIds.has(s) && state.search.matchIds.has(t)
      ? 'rgba(200,200,200,0.55)'
      : 'rgba(140,140,140,0.04)';
  }
  if (!state.selectedId) return 'rgba(180,180,180,0.35)';
  return 'rgba(150,150,150,0.1)';
}

export function linkWidth(link) {
  if (!state.selectedId) return 1;
  const [s, t] = linkEndpoints(link);
  return s === state.selectedId || t === state.selectedId ? 2.5 : 0.5;
}

/** Background for the canvas, theme-aware. */
export function canvasBackground() {
  return state.theme === 'light' ? '#f7f7f5' : '#000003';
}

export { SELECT_COLOR, GHOST_COLOR };
