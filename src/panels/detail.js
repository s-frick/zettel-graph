// Right-hand detail panel: full note body, metadata and backlinks.

import { state, setState, subscribe } from '../state.js';
import { renderBody, applySyntaxHighlighting, metaLine } from '../markdown.js';
import { escapeHtml, el } from '../ui/dom.js';

export function createDetailPanel() {
  const node = el('div.node-detail');

  function backlinksHtml(n) {
    const inbound = [...(state.model?.inbound.get(n.id) || [])];
    if (!inbound.length) return '';
    const rows = inbound
      .map((id) => state.model.byId.get(id))
      .filter(Boolean)
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      .map((s) => `<li><a href="#" data-goto="${escapeHtml(s.id)}">${escapeHtml(s.title || s.id)}</a></li>`)
      .join('');
    return `<div class="node-detail-backlinks"><h4>${inbound.length} backlink${
      inbound.length === 1 ? '' : 's'
    }</h4><ul>${rows}</ul></div>`;
  }

  function render() {
    const n = state.selectedId && state.model ? state.model.byId.get(state.selectedId) : null;
    if (!n) {
      node.classList.remove('open');
      node.innerHTML = '';
      return;
    }
    const resource = n.resource
      ? `<div class="node-detail-resource"><a href="${escapeHtml(n.resource)}" target="_blank" rel="noreferrer">${escapeHtml(n.resource)}</a></div>`
      : '';
    node.innerHTML = `
      <button class="node-detail-close" title="close (esc)">✕</button>
      <div class="node-detail-title">${escapeHtml(n.title || n.id)}</div>
      <div class="node-detail-path">${escapeHtml(n.id)}</div>
      <div class="node-detail-tags">${escapeHtml(metaLine(n))}</div>
      ${resource}
      <hr class="node-detail-divider" />
      <div class="node-detail-body">${n.ghost ? '<em>not yet written</em>' : renderBody(n, 20000)}</div>
      ${backlinksHtml(n)}`;
    node.querySelector('.node-detail-close').addEventListener('click', () => setState({ selectedId: null, neighborIds: new Set() }));
    applySyntaxHighlighting(node);
    node.classList.add('open');
  }

  return {
    id: 'detail',
    mount(root) {
      root.appendChild(node);
      node.addEventListener('click', (e) => {
        const a = e.target.closest('[data-goto]');
        if (!a) return;
        e.preventDefault();
        setState({ selectedId: a.dataset.goto });
      });
      subscribe((keys) => {
        if (keys.has('selectedId') || keys.has('model')) render();
      });
    },
  };
}
