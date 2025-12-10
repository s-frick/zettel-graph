import { UnrealBloomPass } from  'https://esm.sh/three/examples/jsm/postprocessing/UnrealBloomPass.js';


const Graph = new ForceGraph3D(document.getElementById('3d-graph'))
  .backgroundColor('#000003')
  .jsonUrl('./graph.json')
  .nodeLabel('title')
  .nodeAutoColorBy('tags')
  .onNodeHover(handleNodeHover)
  .onNodeClick(handleNodeClick)
  .onBackgroundClick(closeDetailPanel)
;

const postProcessingComposer = Graph.postProcessingComposer();
const normalBloomPass = new UnrealBloomPass();
normalBloomPass.strength = 0.8;
normalBloomPass.radius   = 0.7;
normalBloomPass.threshold = 0.03;
normalBloomPass.enabled = true;

const highlightBloomPass = new UnrealBloomPass();
highlightBloomPass.strength = 0.9;   // nur on top
highlightBloomPass.radius   = 0.9;   // etwas weitläufiger
highlightBloomPass.threshold = 0.03;
highlightBloomPass.enabled = false;

postProcessingComposer.addPass(normalBloomPass);
postProcessingComposer.addPass(highlightBloomPass);

console.log(postProcessingComposer.passes);

let previewsize = 240;
// Preview-Element einmalig anlegen
const nodePreview = document.createElement('div');
nodePreview.className = 'node-preview';
document.body.appendChild(nodePreview);

// Detail-Element (Klick) einmalig anlegen
const nodeDetail = document.createElement('div');
nodeDetail.className = 'node-detail';
nodeDetail.opacity = 0;
document.body.appendChild(nodeDetail);

document.addEventListener('keydown', e => {
  if (e.key === 'Q') closeDetailPanel();
});

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safe(str, fallback = '') {
  return (str == null) ? fallback : String(str);
}
function stripFrontmatter(markdown = '') {
  return markdown.replace(/^---[\s\S]*?\n---\s*/m, '');
}
function stripLeadingH1(md = '') {
  return md.replace(/^#\s+.*\n+/, '').replace(/^\s+/, '');
}
function buildPreviewHtml(node) {
  const title = node.title || node.id;
  const tags = Array.isArray(node.tags) ? node.tags : [];
  const tagLine = tags.length ? tags.map(t => `#${t}`).join(' ') : '';

  // Quelle: raw oder summary
  const markdownSrc = node.raw || node.summary || '';

  // Frontmatter rausfiltern
  let md = stripFrontmatter(markdownSrc);
  md = stripLeadingH1(md);

  // optional: Kürzen fürs Preview
  const maxChars = previewsize;
  if (md.length > maxChars) {
    md = md.slice(0, maxChars) + '\n\n…';
  }

  // Markdown → HTML
  const rendered = marked.parse(md);

  return `
    <div class="node-preview-title">${title}</div>
    <div class="node-preview-tags">${tagLine}</div>
    <div class="node-preview-divider" />
    <div class="node-preview-body">${rendered}</div>
  `;
}

function handleNodeHover(node, prev) {
  if (!node) {
    nodePreview.style.opacity = 0;
    return;
  }

  nodePreview.innerHTML = buildPreviewHtml(node);
  nodePreview.style.opacity = 1;
}
let mouseX = 0;
let mouseY = 0;

document.getElementById('3d-graph').addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  nodePreview.style.left = mouseX + 20 + 'px';
  nodePreview.style.top  = mouseY + 20 + 'px';
  nodePreview.style.right = ''; // rechte Position deaktivieren
});

// ---------- Detail-Panel (Klick) ----------

function buildDetailHtml(node) {
  const title = node.title || node.id;
  const tags  = Array.isArray(node.tags) ? node.tags : [];
  const tagLine = tags.length ? tags.map(t => `#${t}`).join(' ') : '';

  let md = node.raw || node.summary || '';

  md = stripFrontmatter(md);
  md = stripLeadingH1(md);

  // hier kein oder weniger aggressives Kürzen, ist ja "Full View"
  const maxChars = 8000;
  if (md.length > maxChars) {
    md = md.slice(0, maxChars) + '\n\n…';
  }

  const rendered = marked.parse(md);

  return `
    <button class="node-detail-close" onclick="closeDetailPanel()">✕</button>
    <div class="node-detail-title">${title}</div>
    <div class="node-detail-tags">${tagLine}</div>
    <hr class="node-detail-divider" />
    <div class="node-detail-body">${rendered}</div>
  `;
}

function openDetailPanel(node) {
  previewsize = 120;
  nodeDetail.innerHTML = buildDetailHtml(node);
  nodeDetail.classList.add('open');

  highlightBloomPass.enabled = true;
}

function closeDetailPanel() {
  previewsize = 240;
  nodeDetail.classList.remove('open');
  nodeDetail.innerHTML = '';
  updateSelection(null);

  highlightBloomPass.enabled = false;

}

function handleNodeClick(node, event) {
  console.log('click', node)
  if (!node) return;

  updateSelection(node);
  openDetailPanel(node);
}

let selectedNodeId = null;
let neighborIds = new Set();

function computeNeighbors(centerId) {
  const neighbors = new Set();
  const data = Graph.graphData();
  if (!data || !data.links) return neighbors;

  data.links.forEach(link => {
    const sid = link.source.id || link.source;
    const tid = link.target.id || link.target;

    if (sid === centerId) neighbors.add(tid);
    if (tid === centerId) neighbors.add(sid);
  });

  return neighbors;
}

function nodeColorFn(node) {
  // Basisfarbe aus autoColorBy('group')
  const base = node.color || '#999';

  if (!selectedNodeId) {
    return base;
  }

  if (node.id === selectedNodeId) {
    return '#ffcc00'; // ausgewählt: gold
  }

  if (neighborIds.has(node.id)) {
    return base; // Nachbarn normal farbig
  }

  // weit entfernte Nodes abdunkeln
  return 'rgba(150,150,150,0.2)';
}

function linkColorFn(link) {
  if (!selectedNodeId) {
    return 'rgba(180,180,180,0.6)';
  }

  const sid = link.source.id || link.source;
  const tid = link.target.id || link.target;

  if (sid === selectedNodeId || tid === selectedNodeId) {
    return '#ffcc00'; // Links vom selected Node
  }

  return 'rgba(150,150,150,0.15)';
}

function linkWidthFn(link) {
  if (!selectedNodeId) return 1;

  const sid = link.source.id || link.source;
  const tid = link.target.id || link.target;

  return (sid === selectedNodeId || tid === selectedNodeId) ? 2 : 0.5;
}

function updateSelection(node) {
  if (!node) {
    selectedNodeId = null;
    neighborIds = new Set();
  } else {
    selectedNodeId = node.id;
    neighborIds = computeNeighbors(node.id);
  }

  // Re-render mit neuen Farb-/Width-Funktionen
  Graph
    .nodeColor(nodeColorFn)
    .linkColor(linkColorFn)
    .linkWidth(linkWidthFn);

}


