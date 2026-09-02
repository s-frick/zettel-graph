// Browser-safe resolution of OKF markdown links to graph node ids. This mirrors
// the parser's bundle-relative semantics without importing node:path into the UI.

function normalize(path) {
  const out = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

export function resolveInternalLink(href, fromId, ids) {
  const raw = String(href || '').trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return null;

  const [withoutAnchor, anchor = ''] = raw.split('#', 2);
  const clean = withoutAnchor.split('?')[0];
  if (!clean.endsWith('.md')) return null;

  let candidates;
  if (clean.startsWith('/')) {
    const relative = normalize(clean.replace(/^\/+/, ''));
    candidates = [relative];

    // In a multi-bundle graph ids carry a bundle prefix. Try each ancestor of
    // the source id, nearest the graph root first, until an existing node wins.
    const sourceParts = fromId.split('/');
    for (let i = 1; i < sourceParts.length - 1; i++) {
      candidates.push(normalize(`${sourceParts.slice(0, i).join('/')}/${relative}`));
    }
  } else {
    const directory = fromId.includes('/') ? fromId.slice(0, fromId.lastIndexOf('/')) : '';
    candidates = [normalize(`${directory}/${clean}`)];
  }

  const id = candidates.find((candidate) => ids.has(candidate));
  return id ? { id, anchor } : null;
}

export function wireInternalLinks(container, fromId, model) {
  if (!container || !model) return;
  const ids = new Set(model.byId.keys());
  for (const link of container.querySelectorAll('.node-detail-body a[href]')) {
    const target = resolveInternalLink(link.getAttribute('href'), fromId, ids);
    if (!target) continue;
    link.href = '#';
    link.dataset.goto = target.id;
    if (target.anchor) link.dataset.anchor = target.anchor;
  }
}
