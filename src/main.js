import ForceGraph3D from '3d-force-graph';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import './style.css';

const el = document.getElementById('3d-graph');

const Graph = ForceGraph3D()(el)
  .backgroundColor('#000003')
  .nodeLabel('title')
  .nodeAutoColorBy('type')
  .nodeVal((n) => (n.ghost ? 1 : 4))
  .nodeOpacity(0.9)
  .linkDirectionalArrowLength(3)
  .linkDirectionalArrowRelPos(1)
  .onNodeHover(handleNodeHover)
  .onNodeClick(handleNodeClick)
  .onBackgroundClick(closeDetailPanel);

// Optional bloom glow. 3d-force-graph bundles three; with resolve.dedupe the
// addon shares the renderer's THREE. Guard so a version mismatch never breaks
// the graph itself.
(async () => {
  try {
    const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
    const bloom = new UnrealBloomPass();
    bloom.strength = 0.7;
    bloom.radius = 0.7;
    bloom.threshold = 0.03;
    Graph.postProcessingComposer().addPass(bloom);
  } catch (err) {
    console.warn('[okf] bloom disabled:', err);
  }
})();

// ---------- data + hot-reload ----------
async function loadGraph() {
  const res = await fetch('/graph.json', { cache: 'no-store' });
  const data = await res.json();
  Graph.graphData(data);
  buildLegend(data.nodes);
  // Re-run an active search against the fresh data so highlights survive a
  // hot-reload (the matched node objects are replaced when graphData is set).
  if (searchActive) runSearch(searchInput.value);
}
loadGraph();

if (import.meta.hot) {
  import.meta.hot.on('okf:update', loadGraph);
}

// ---------- panels ----------
let previewsize = 240;
const nodePreview = document.createElement('div');
nodePreview.className = 'node-preview';
document.body.appendChild(nodePreview);

const nodeDetail = document.createElement('div');
nodeDetail.className = 'node-detail';
document.body.appendChild(nodeDetail);

const legend = document.createElement('div');
legend.className = 'legend';
document.body.appendChild(legend);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'q' || e.key === 'Q') closeDetailPanel();
});

el.addEventListener('mousemove', (e) => {
  nodePreview.style.left = e.clientX + 20 + 'px';
  nodePreview.style.top = e.clientY + 20 + 'px';
});

function stripFrontmatter(md = '') {
  return md.replace(/^---[\s\S]*?\n---\s*/m, '');
}
function stripLeadingH1(md = '') {
  return md.replace(/^#\s+.*\n+/, '').replace(/^\s+/, '');
}

function renderBody(node, maxChars) {
  let md = stripFrontmatter(node.raw || node.summary || '');
  md = stripLeadingH1(md);
  if (md.length > maxChars) md = md.slice(0, maxChars) + '\n\n…';
  return marked.parse(md);
}

function metaLine(node) {
  const parts = [];
  if (node.type && node.type !== '_missing') parts.push(node.type);
  parts.push(...(node.tags || []).map((t) => `#${t}`));
  return parts.join('  ·  ');
}

function buildPreviewHtml(node) {
  return `
    <div class="node-preview-title">${node.title || node.id}</div>
    <div class="node-preview-tags">${metaLine(node)}</div>
    <hr class="node-preview-divider" />
    <div class="node-preview-body">${node.ghost ? '<em>not yet written</em>' : renderBody(node, previewsize)}</div>
  `;
}

function buildDetailHtml(node) {
  const resource = node.resource
    ? `<div class="node-detail-resource"><a href="${node.resource}" target="_blank" rel="noreferrer">${node.resource}</a></div>`
    : '';
  return `
    <button class="node-detail-close" id="detail-close">✕</button>
    <div class="node-detail-title">${node.title || node.id}</div>
    <div class="node-detail-tags">${metaLine(node)}</div>
    ${resource}
    <hr class="node-detail-divider" />
    <div class="node-detail-body">${node.ghost ? '<em>not yet written</em>' : renderBody(node, 8000)}</div>
  `;
}

function applySyntaxHighlighting(container) {
  container.querySelectorAll('pre code').forEach((block) => {
    delete block.dataset.highlighted;
    hljs.highlightElement(block);
  });
}

function handleNodeHover(node) {
  if (!node) {
    nodePreview.style.opacity = 0;
    return;
  }
  nodePreview.innerHTML = buildPreviewHtml(node);
  applySyntaxHighlighting(nodePreview);
  nodePreview.style.opacity = 1;
}

function openDetailPanel(node) {
  previewsize = 120;
  nodeDetail.innerHTML = buildDetailHtml(node);
  document.getElementById('detail-close').addEventListener('click', closeDetailPanel);
  applySyntaxHighlighting(nodeDetail);
  nodeDetail.classList.add('open');
}

function closeDetailPanel() {
  previewsize = 240;
  nodeDetail.classList.remove('open');
  nodeDetail.innerHTML = '';
  updateSelection(null);
}

function handleNodeClick(node) {
  if (!node) return;
  updateSelection(node);
  openDetailPanel(node);
}

// ---------- selection highlight ----------
let selectedNodeId = null;
let neighborIds = new Set();

// Search state (read by the colour accessors below).
let searchActive = false;
let searchMatchIds = new Set();

function computeNeighbors(centerId) {
  const out = new Set();
  const { links } = Graph.graphData();
  for (const link of links || []) {
    const sid = link.source.id ?? link.source;
    const tid = link.target.id ?? link.target;
    if (sid === centerId) out.add(tid);
    if (tid === centerId) out.add(sid);
  }
  return out;
}

function nodeColorFn(node) {
  const base = node.color || '#999';
  if (node.id === selectedNodeId) return '#ffcc00';
  if (searchActive && !searchMatchIds.has(node.id)) return 'rgba(140,140,140,0.08)';
  if (!selectedNodeId) return base;
  if (neighborIds.has(node.id)) return base;
  return 'rgba(150,150,150,0.2)';
}

function linkColorFn(link) {
  const sid = link.source.id ?? link.source;
  const tid = link.target.id ?? link.target;
  if (selectedNodeId && (sid === selectedNodeId || tid === selectedNodeId)) return '#ffcc00';
  if (searchActive) {
    return searchMatchIds.has(sid) && searchMatchIds.has(tid)
      ? 'rgba(200,200,200,0.55)'
      : 'rgba(140,140,140,0.04)';
  }
  if (!selectedNodeId) return 'rgba(180,180,180,0.5)';
  return 'rgba(150,150,150,0.12)';
}

function linkWidthFn(link) {
  if (!selectedNodeId) return 1;
  const sid = link.source.id ?? link.source;
  const tid = link.target.id ?? link.target;
  return sid === selectedNodeId || tid === selectedNodeId ? 2 : 0.5;
}

function updateSelection(node) {
  if (!node) {
    selectedNodeId = null;
    neighborIds = new Set();
  } else {
    selectedNodeId = node.id;
    neighborIds = computeNeighbors(node.id);
  }
  Graph.nodeColor(nodeColorFn).linkColor(linkColorFn).linkWidth(linkWidthFn);
}

// ---------- legend (auto colours by type) ----------
function buildLegend(nodes) {
  const byType = new Map();
  for (const n of nodes) {
    if (!byType.has(n.type)) byType.set(n.type, n.color || '#999');
  }
  // node.color is assigned by nodeAutoColorBy after a tick; resolve lazily.
  setTimeout(() => {
    const data = Graph.graphData().nodes;
    const colors = new Map();
    for (const n of data) if (!colors.has(n.type)) colors.set(n.type, n.color || '#999');
    legend.innerHTML =
      '<div class="legend-title">type</div>' +
      [...colors.entries()]
        .map(
          ([type, color]) =>
            `<div class="legend-row"><span class="legend-dot" style="background:${color}"></span>${
              type === '_missing' ? 'missing' : type
            }</div>`,
        )
        .join('');
  }, 400);
}

// ---------- search ----------
const searchBox = document.createElement('div');
searchBox.className = 'search-box';
searchBox.innerHTML = `
  <input class="search-input" type="text" placeholder="Search notes…  ( / )" spellcheck="false" />
  <div class="search-results"></div>
`;
document.body.appendChild(searchBox);
const searchInput = searchBox.querySelector('.search-input');
const searchResults = searchBox.querySelector('.search-results');

const MAX_ROWS = 50;
let searchHits = []; // ranked match nodes
let activeHitIndex = -1; // keyboard-highlighted row

function escapeHtml(s = '') {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function typeLabel(node) {
  return node.type === '_missing' ? 'missing' : node.type;
}

function searchHaystack(node) {
  return [node.title, node.id, typeLabel(node), (node.tags || []).join(' '), node.summary, node.raw]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

// Score a node against every query token; 0 means "not a match". Every token
// must appear somewhere (AND search); title/tag/type hits rank above body hits.
function scoreNode(node, tokens) {
  const title = (node.title || '').toLowerCase();
  const tags = (node.tags || []).map((t) => t.toLowerCase());
  const type = (node.type || '').toLowerCase();
  const hay = searchHaystack(node);
  let score = 0;
  for (const tok of tokens) {
    if (!hay.includes(tok)) return 0;
    if (title.startsWith(tok)) score += 100;
    else if (title.includes(tok)) score += 50;
    else if (tags.some((t) => t.includes(tok))) score += 20;
    else if (type.includes(tok)) score += 15;
    else score += 5; // body-only match
  }
  return score;
}

function runSearch(query) {
  const tokens = (query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    clearSearch();
    return;
  }
  const { nodes } = Graph.graphData();
  searchHits = nodes
    .map((n) => ({ n, s: scoreNode(n, tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (a.n.title || '').localeCompare(b.n.title || ''))
    .map((x) => x.n);

  searchActive = true;
  searchMatchIds = new Set(searchHits.map((n) => n.id));
  activeHitIndex = searchHits.length ? 0 : -1;
  Graph.nodeColor(nodeColorFn).linkColor(linkColorFn).linkWidth(linkWidthFn);
  renderResults();
}

function renderResults() {
  if (!searchActive) {
    searchResults.classList.remove('open');
    searchResults.innerHTML = '';
    return;
  }
  if (!searchHits.length) {
    searchResults.innerHTML = '<div class="search-empty">No matches</div>';
    searchResults.classList.add('open');
    return;
  }
  const n = searchHits.length;
  const rows = searchHits
    .slice(0, MAX_ROWS)
    .map(
      (node, i) =>
        `<div class="search-row${i === activeHitIndex ? ' active' : ''}" data-id="${escapeHtml(
          node.id,
        )}"><span class="search-row-title">${escapeHtml(
          node.title || node.id,
        )}</span><span class="search-row-type">${escapeHtml(typeLabel(node))}</span></div>`,
    )
    .join('');
  const more = n > MAX_ROWS ? `<div class="search-empty">+${n - MAX_ROWS} more…</div>` : '';
  searchResults.innerHTML =
    `<div class="search-count">${n} match${n === 1 ? '' : 'es'}</div>` + rows + more;
  searchResults.classList.add('open');
  searchResults.querySelector('.search-row.active')?.scrollIntoView({ block: 'nearest' });
}

function clearSearch() {
  searchActive = false;
  searchHits = [];
  searchMatchIds = new Set();
  activeHitIndex = -1;
  renderResults();
  Graph.nodeColor(nodeColorFn).linkColor(linkColorFn).linkWidth(linkWidthFn);
}

// Fly the camera to sit `dist` units out from the node, looking at it.
function focusNode(node) {
  if (!node || node.x == null) return;
  const dist = 120;
  const ratio = 1 + dist / Math.hypot(node.x, node.y, node.z || 0);
  Graph.cameraPosition(
    { x: node.x * ratio, y: node.y * ratio, z: (node.z || 0) * ratio },
    node,
    1200,
  );
}

function setActiveHit(i) {
  activeHitIndex = i;
  renderResults();
}

// Commit to a result: highlight it, fly there, and open its detail panel.
function gotoHit(i) {
  if (i < 0 || i >= searchHits.length) return;
  activeHitIndex = i;
  const node = searchHits[i];
  renderResults();
  focusNode(node);
  updateSelection(node);
  openDetailPanel(node);
}

searchInput.addEventListener('input', (e) => runSearch(e.target.value));

searchInput.addEventListener('keydown', (e) => {
  // Keep graph-global shortcuts (Esc/q) from firing while typing.
  e.stopPropagation();
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (searchHits.length) setActiveHit(Math.min(activeHitIndex + 1, searchHits.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (searchHits.length) setActiveHit(Math.max(activeHitIndex - 1, 0));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    gotoHit(activeHitIndex >= 0 ? activeHitIndex : 0);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    if (searchInput.value) {
      searchInput.value = '';
      clearSearch();
    } else {
      searchInput.blur();
    }
  }
});

searchResults.addEventListener('click', (e) => {
  const row = e.target.closest('.search-row');
  if (!row) return;
  const idx = searchHits.findIndex((n) => n.id === row.dataset.id);
  if (idx >= 0) gotoHit(idx);
});

// Global: `/` or Cmd/Ctrl-K focuses the search box.
document.addEventListener('keydown', (e) => {
  if (e.target === searchInput) return;
  if (e.key === '/' || ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K'))) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});
