// Central UI state + a minimal pub/sub bus.
//
// Every module reads from `state` and mutates it ONLY through `setState`, which
// emits the changed keys. Renderers, views and panels subscribe to the keys they
// care about. This keeps the modules decoupled: nothing imports another panel.
//
// Ownership note: this file is shared infrastructure. Add fields here, but keep
// feature logic in the owning module (src/panels/*, src/views/*, src/model/*).

const listeners = new Set();

/** @typedef {'graph'|'hierarchy'|'matrix'|'lint'} ViewId */

export const state = {
  // ---- data (set by main.js after each load) ----
  /** Raw graph.json payload: { nodes, links }. */
  raw: { nodes: [], links: [] },
  /** Derived model from src/model/graph.js (adjacency, degree, …). */
  model: null,

  // ---- view routing ----
  /** @type {ViewId} */
  view: 'graph',
  /** Renderer mode for the `graph` view. @type {'2d'|'3d'} */
  renderMode: '3d',
  /** Light/dark chrome for canvas + panels. @type {'dark'|'light'} */
  theme: 'dark',

  /**
   * True once the first graph is loaded and every panel has applied its
   * persisted/hash state. Panels that need a settled app (rather than a settled
   * DOM) hang off this rather than guessing with timers.
   */
  ready: false,

  /** Zen reading mode for the detail drawer: note gets the screen, rest fades. */
  zen: false,

  // ---- selection / hover ----
  selectedId: null,
  hoverId: null,
  /** Neighbours of selectedId at depth 1 (maintained by main.js). */
  neighborIds: new Set(),

  // ---- search (owned by src/panels/search.js) ----
  search: { active: false, query: '', matchIds: new Set() },

  // ---- filters (owned by src/panels/filters.js — A5) ----
  filters: {
    /** null = no restriction; otherwise only these values pass. @type {Set<string>|null} */
    types: null,
    tags: null,
    folders: null,
    bundles: null,
    showGhosts: true,
    showOrphans: true,
    /** Inject tag pseudo-nodes into the graph (B5). */
    showTagNodes: false,
  },

  // ---- forces (owned by src/panels/forces.js — A3) ----
  forces: {
    charge: -120,
    linkDistance: 40,
    linkStrength: 1,
    centerStrength: 1,
  },

  // ---- local graph (owned by src/panels/local-graph.js — A4) ----
  localGraph: { enabled: false, depth: 1 },

  // ---- timeline (owned by src/panels/timeline.js — B4) ----
  timeline: {
    enabled: false,
    /** ISO date string; nodes newer than this are hidden while enabled. */
    cursor: null,
    /** Colour nodes by age instead of by `colorBy`. */
    colorByAge: false,
  },

  // ---- colouring (B6 adds 'cluster') ----
  /** @type {'type'|'folder'|'bundle'|'cluster'} */
  colorBy: 'type',
};

/**
 * Subscribe to state changes.
 * @param {(keys: Set<string>, state: object) => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Shallow-merge `patch` into state and notify subscribers with the touched
 * top-level keys. Nested objects (filters, forces, …) are merged one level deep
 * so callers can do `setState({ filters: { showGhosts: false } })`.
 */
export function setState(patch) {
  const keys = new Set();
  for (const [k, v] of Object.entries(patch)) {
    const cur = state[k];
    if (cur && typeof cur === 'object' && !Array.isArray(cur) && !(cur instanceof Set) &&
        v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Set)) {
      state[k] = { ...cur, ...v };
    } else {
      state[k] = v;
    }
    keys.add(k);
  }
  emit(keys);
  return state;
}

/** Notify subscribers without changing state (used after in-place mutations). */
export function emit(keys) {
  const set = keys instanceof Set ? keys : new Set([].concat(keys));
  for (const fn of listeners) {
    try {
      fn(set, state);
    } catch (err) {
      console.error('[zettel-graph] subscriber failed:', err);
    }
  }
}
