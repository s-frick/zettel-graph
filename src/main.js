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
  if (!selectedNodeId) return base;
  if (node.id === selectedNodeId) return '#ffcc00';
  if (neighborIds.has(node.id)) return base;
  return 'rgba(150,150,150,0.2)';
}

function linkColorFn(link) {
  const sid = link.source.id ?? link.source;
  const tid = link.target.id ?? link.target;
  if (!selectedNodeId) return 'rgba(180,180,180,0.5)';
  if (sid === selectedNodeId || tid === selectedNodeId) return '#ffcc00';
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
