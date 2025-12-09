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
  const maxChars = 1200;
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

const Graph = new ForceGraph3D(document.getElementById('3d-graph'))
    .jsonUrl('./graph.json')
    .nodeLabel('title')
    .nodeAutoColorBy('tags')
    .onNodeHover(handleNodeHover)
;
