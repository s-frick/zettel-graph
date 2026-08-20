// A5 — filter panel: type / tag / folder / bundle checkboxes plus the
// ghost/orphan/tag-node toggles.
//
// OWNER: agent A5. Contract: return { id, mount(root) }. Write to
// state.filters (Set or null per facet — null means "no restriction") and
// state.colorBy via setState. Facet lists come from state.model.types /
// .tags / .folders / .bundles / .clusters (already sorted by count).
// Reflect state changes back into the checkboxes so the legend shortcut and
// this panel stay in sync. Persist to the URL hash (see src/router.js).

import { state, setState, subscribe } from '../state.js';
import { paletteColor } from '../styling.js';
import { el } from '../ui/dom.js';
import { registerHashParam } from '../router.js';

const FACETS = [
  { key: 'types', label: 'types' },
  { key: 'tags', label: 'tags' },
  { key: 'folders', label: 'folders' },
  { key: 'bundles', label: 'bundles' },
];

// Which facet the palette currently colours — only that one shows colour dots.
const FACET_BY_COLORBY = { type: 'types', folder: 'folders', bundle: 'bundles' };

const FLAGS = [
  { key: 'showGhosts', param: 'ghosts', label: 'ghost nodes' },
  { key: 'showOrphans', param: 'orphans', label: 'orphans' },
  { key: 'showTagNodes', param: 'tagnodes', label: 'tag nodes' },
];

// Snapshot the shipped flag defaults so "non-default" never drifts from them.
const FLAG_DEFAULTS = Object.fromEntries(FLAGS.map((f) => [f.key, state.filters[f.key]]));

// Lists get long (~100 tags), so offer an inline filter once a facet is big.
const SEARCH_THRESHOLD = 12;

// A facet restricted to nothing still is a restriction, but an empty value list
// would drop the param from the hash — mark that state explicitly instead.
const NONE_TOKEN = '!none';

/** All values a facet can take right now (null model = nothing known yet). */
function allValues(facetKey) {
  return new Set((state.model?.[facetKey] || []).map(([v]) => v));
}

/**
 * Write a facet, collapsing "everything ticked" to null. The legend shortcut
 * relies on that convention, and it keeps the URL hash free of noise.
 */
function setFacet(facetKey, values) {
  const all = allValues(facetKey);
  const next = values && values.size === all.size && all.size ? null : values;
  setState({ filters: { [facetKey]: next } });
}

// registerHashParam patches are merged with Object.assign, so two codecs both
// returning `{ filters: … }` would clobber each other. Accumulate one shared
// patch per apply pass and hand back the whole thing every time.
let pending = null;
function filtersPatch(key, value) {
  if (!pending) {
    // A facet missing from the hash means "no restriction" — start from clean.
    pending = { types: null, tags: null, folders: null, bundles: null };
    // Microtask: runs once applyHashToState' synchronous codec loop is done.
    queueMicrotask(() => { pending = null; });
  }
  pending[key] = value;
  return { filters: { ...pending } };
}

function registerHashParams() {
  for (const { key } of FACETS) {
    registerHashParam({
      key,
      read: () => {
        const set = state.filters[key];
        if (!set) return '';
        return set.size ? [...set].join(',') : NONE_TOKEN;
      },
      write: (raw) => filtersPatch(key, new Set(raw === NONE_TOKEN ? [] : raw.split(',').filter(Boolean))),
    });
  }
  for (const { key, param } of FLAGS) {
    registerHashParam({
      key: param,
      // Only non-default flags reach the hash, so a clean URL stays clean.
      read: () => (state.filters[key] === FLAG_DEFAULTS[key] ? '' : state.filters[key] ? '1' : '0'),
      write: (raw) => filtersPatch(key, raw === '1'),
    });
  }
}

/** One checkbox row: [x] ● label count. */
function facetRow(facetKey, value, count, onToggle) {
  const input = el('input', { type: 'checkbox' });
  input.checked = true;
  input.addEventListener('change', () => onToggle(value, input.checked));
  const dot = el('span.zk-filters-dot');
  const row = el('label.zk-filters-row', {},
    input,
    dot,
    el('span.zk-filters-label', { text: value, title: value }),
    el('span.zk-filters-count', { text: String(count) }));
  row.dataset.value = value;
  row.setChecked = (on) => { input.checked = on; };
  row.setDot = (on) => {
    // Colour only where it matches state.colorBy — elsewhere it would lie.
    dot.style.background = on ? paletteColor(value) : 'transparent';
    dot.style.borderColor = on ? 'transparent' : 'var(--zk-border-soft)';
  };
  return row;
}

/** A whole facet block: header, all/none/invert, optional search, row list. */
function facetBlock(spec) {
  const list = el('div.zk-filters-list');
  const search = el('input.zk-filters-search', { type: 'text', placeholder: `filter ${spec.label}…`, spellcheck: 'false' });
  const shortcut = (text, title, fn) =>
    el('button.zk-filters-shortcut', { type: 'button', text, title, onclick: fn });

  const head = el('div.zk-filters-head', {},
    el('span.zk-filters-facet', { text: spec.label }),
    shortcut('all', 'select all', () => setFacet(spec.key, null)),
    shortcut('none', 'select none', () => setFacet(spec.key, new Set())),
    shortcut('inv', 'invert selection', () => {
      const cur = state.filters[spec.key];
      setFacet(spec.key, cur ? new Set([...allValues(spec.key)].filter((v) => !cur.has(v))) : new Set());
    }));

  const node = el('div.zk-filters-group', {}, head, search, list);
  let rows = [];

  function onToggle(value, checked) {
    const cur = state.filters[spec.key];
    const next = cur ? new Set(cur) : allValues(spec.key);
    checked ? next.add(value) : next.delete(value);
    setFacet(spec.key, next);
  }

  function applyQuery() {
    const q = search.value.trim().toLowerCase();
    for (const row of rows) {
      row.style.display = !q || row.dataset.value.toLowerCase().includes(q) ? '' : 'none';
    }
  }
  search.addEventListener('input', applyQuery);
  // Typing must not reach the global view hotkeys ('g', 'm', …).
  search.addEventListener('keydown', (e) => e.stopPropagation());

  function rebuild() {
    const entries = state.model?.[spec.key] || [];
    rows = entries.map(([value, count]) => facetRow(spec.key, value, count, onToggle));
    list.replaceChildren(...rows);
    node.style.display = entries.length ? '' : 'none';
    search.style.display = entries.length > SEARCH_THRESHOLD ? '' : 'none';
    applyQuery();
    sync();
  }

  function sync() {
    const cur = state.filters[spec.key];
    const colored = FACET_BY_COLORBY[state.colorBy] === spec.key;
    for (const row of rows) {
      row.setChecked(!cur || cur.has(row.dataset.value));
      row.setDot(colored);
    }
    node.classList.toggle('active', !!cur);
  }

  return { node, rebuild, sync };
}

export function createFiltersPanel() {
  registerHashParams();

  const node = el('div.zk-filters');
  const toggle = el('button.zk-filters-toggle', { type: 'button', title: 'filters', text: '☰ filters' });
  const badge = el('span.zk-filters-badge');
  toggle.append(badge);
  const body = el('div.zk-panel.zk-filters-body');
  const blocks = FACETS.map(facetBlock);
  body.append(...blocks.map((b) => b.node));

  const flagRows = new Map();
  const flagBox = el('div.zk-filters-group.zk-filters-flags', {}, el('span.zk-filters-facet', { text: 'show' }));
  for (const flag of FLAGS) {
    const input = el('input', { type: 'checkbox' });
    input.checked = state.filters[flag.key];
    input.addEventListener('change', () => setState({ filters: { [flag.key]: input.checked } }));
    flagRows.set(flag.key, input);
    flagBox.append(el('label.zk-check', {}, input, el('span', { text: flag.label })));
  }
  body.append(flagBox);
  node.append(toggle, body);

  /** Mirror state into every control — legend clicks and hash changes land here. */
  function sync() {
    for (const b of blocks) b.sync();
    for (const [key, input] of flagRows) input.checked = state.filters[key];
    const active = FACETS.filter(({ key }) => state.filters[key]).length +
      FLAGS.filter(({ key }) => state.filters[key] !== FLAG_DEFAULTS[key]).length;
    badge.textContent = active ? String(active) : '';
    node.classList.toggle('filtered', active > 0);
  }

  return {
    id: 'filters',
    mount(root) {
      root.appendChild(node);

      toggle.addEventListener('click', () => {
        const open = node.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      toggle.setAttribute('aria-expanded', 'false');

      for (const b of blocks) b.rebuild();
      sync();

      subscribe((keys) => {
        if (keys.has('model')) for (const b of blocks) b.rebuild();
        if (keys.has('filters') || keys.has('colorBy') || keys.has('model')) sync();
      });
    },
  };
}
