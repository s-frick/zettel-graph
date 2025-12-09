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
}

function closeDetailPanel() {
  previewsize = 240;
  nodeDetail.classList.remove('open');
  nodeDetail.innerHTML = '';
}

function handleNodeClick(node, event) {
  console.log('click', node)
  if (!node) return;

  openDetailPanel(node);
  // Falls du das Panel per CSS initial versteckst, könntest du hier z.B.:
  // nodeDetail.style.display = 'block';
}


const Graph = new ForceGraph3D(document.getElementById('3d-graph'))
    .jsonUrl('./graph.json')
    .nodeLabel('title')
    .nodeAutoColorBy('tags')
    .onNodeHover(handleNodeHover)
    .onNodeClick(handleNodeClick)
;
