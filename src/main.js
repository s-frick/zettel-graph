// Entry point: load graph.json, build the model, mount the active view and all
// panels, and route state changes to both.
//
// Shared infrastructure — feature work belongs in src/views/* or src/panels/*.

import './styles/index.css';
import 'highlight.js/styles/github-dark.css';

import { state, setState, subscribe } from './state.js';
import { buildModel } from './model/graph.js';
import { loadEmbeddings } from './model/semantic.js';
import { setAgeRange } from './styling.js';
import { VIEW_FACTORIES } from './views/index.js';
import { createPanels } from './panels/index.js';
import { createToolbar } from './panels/toolbar.js';
import { startRouter, syncStateToHash } from './router.js';

const root = document.getElementById('app') || document.body;
const viewHost = document.createElement('div');
viewHost.className = 'zk-view-host';
root.appendChild(viewHost);

const overlayHost = document.createElement('div');
overlayHost.className = 'zk-overlays';
root.appendChild(overlayHost);

// ---------- views ----------
const views = new Map();
let active = null;

async function mountView(id) {
  if (active?.id === id) return;
  active?.unmount?.();
  viewHost.innerHTML = '';
  if (!views.has(id)) views.set(id, VIEW_FACTORIES[id]());
  active = views.get(id);
  await active.mount(viewHost);
  await active.update?.(new Set(['model', 'filters', 'forces', 'theme']));
}

// ---------- panels ----------
const toolbar = createToolbar({ onFit: () => views.get('graph')?.fit() });
toolbar.mount(overlayHost);

const panels = createPanels({
  onGoto: (id) => {
    if (state.view !== 'graph') setState({ view: 'graph' });
    // Defer so a view switch has mounted before we fly the camera.
    setTimeout(() => views.get('graph')?.focusNode?.(id), 60);
  },
});
for (const p of panels) p.mount(overlayHost);

// ---------- data ----------
async function loadGraph() {
  const res = await fetch('graph.json', { cache: 'no-store' });
  const raw = await res.json();
  const model = buildModel(raw);
  const stamps = model.nodes.map((n) => n.timestamp && String(n.timestamp).slice(0, 10)).filter(Boolean).sort();
  setAgeRange(stamps[0], stamps[stamps.length - 1]);
  setState({ raw, model });
  // Fire-and-forget: the first load may take a while (model download +
  // embedding pass); panels pick it up via the 'semantic' emit when ready.
  loadEmbeddings();
}

// ---------- wiring ----------
subscribe(async (keys) => {
  if (keys.has('view')) await mountView(state.view);
  else await active?.update?.(keys);
  if (keys.has('theme')) document.documentElement.dataset.theme = state.theme;
  if (keys.has('view')) document.documentElement.dataset.view = state.view;
  toolbar.render();
  syncStateToHash();
});

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === 'Escape' || e.key === 'q') {
    // Escape backs out one layer at a time: zen first, then the selection.
    if (state.zen) setState({ zen: false });
    else setState({ selectedId: null, neighborIds: new Set() });
  } else if (e.key === 'z') setState({ zen: !state.zen });
  else if (e.key === '2') setState({ renderMode: '2d' });
  else if (e.key === '3') setState({ renderMode: '3d' });
  else if (e.key === 'g') setState({ view: 'graph' });
  else if (e.key === 'h') setState({ view: 'hierarchy' });
  else if (e.key === 'm') setState({ view: 'matrix' });
  else if (e.key === 'l') setState({ view: 'lint' });
  else if (e.key === 'f' && state.view === 'graph') views.get('graph')?.fit();
});

(async function boot() {
  startRouter();
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.view = state.view;
  await mountView(state.view);
  await loadGraph();
  // Everything that reads persisted or hash state has applied it by now, so
  // anything waiting on a settled app (the initial graph fit) can go ahead.
  setState({ ready: true });
})();

if (import.meta.hot) {
  import.meta.hot.on('okf:update', loadGraph);
}
