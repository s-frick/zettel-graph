// Preview-Element einmalig anlegen
const nodePreview = document.createElement('div');
nodePreview.className = 'node-preview';
document.body.appendChild(nodePreview);

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPreviewHtml(node) {
  const title = node.title || node.id;
  const tags = Array.isArray(node.tags) ? node.tags : [];
  const tagLine = tags.length ? tags.map(t => `#${t}`).join(' ') : '';

  const src = node.raw || node.summary || '';
  const maxChars = 400;
  let excerpt = src.slice(0, maxChars).trim();
  if (src.length > maxChars) {
    excerpt += '\n…';
  }

  return `
    <div class="node-preview-title">${escapeHtml(title)}</div>
    <div class="node-preview-tags">${escapeHtml(tagLine)}</div>
    <div class="node-preview-body">${escapeHtml(excerpt)}</div>
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

const Graph = new ForceGraph3D(document.getElementById('3d-graph'))
    .jsonUrl('./graph.json')
    .nodeLabel('title')
    .nodeAutoColorBy('tags')
    .onNodeHover(handleNodeHover)
;
