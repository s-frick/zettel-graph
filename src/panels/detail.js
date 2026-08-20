// Right-hand detail drawer: full note body, metadata, backlinks — plus a zen
// mode that gives the note the whole screen and fades everything else out.

import { state, setState, subscribe } from '../state.js';
import { renderBody, applySyntaxHighlighting, renderMermaid, metaLine } from '../markdown.js';
import { escapeHtml, el } from '../ui/dom.js';

export function createDetailPanel() {
  const node = el('div.node-detail');
  // Clicking outside the drawer leaves zen mode; it also dims the rest of the UI.
  const backdrop = el('div.zk-zen-backdrop', { onclick: () => setState({ zen: false }) });

  // Bumped on every render so an async mermaid pass can tell whether the note
  // it was rendering is still the one on screen.
  let renderToken = 0;

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
    renderToken++;
    if (!n) {
      node.classList.remove('open');
      node.innerHTML = '';
      return;
    }
    const resource = n.resource
      ? `<div class="node-detail-resource"><a href="${escapeHtml(n.resource)}" target="_blank" rel="noreferrer">${escapeHtml(n.resource)}</a></div>`
      : '';
    node.innerHTML = `
      <div class="node-detail-actions">
        <button class="node-detail-btn" data-act="zen" title="zen mode (z)">${state.zen ? '⤡' : '⤢'}</button>
        <button class="node-detail-btn" data-act="close" title="close (esc)">✕</button>
      </div>
      <div class="node-detail-title">${escapeHtml(n.title || n.id)}</div>
      <div class="node-detail-path">${escapeHtml(n.id)}</div>
      <div class="node-detail-tags">${escapeHtml(metaLine(n))}</div>
      ${resource}
      <hr class="node-detail-divider" />
      <div class="node-detail-body">${n.ghost ? '<em>not yet written</em>' : renderBody(n, 20000)}</div>
      ${backlinksHtml(n)}`;
    applySyntaxHighlighting(node);
    const token = renderToken;
    renderMermaid(node, token, (t) => t === renderToken);
    node.classList.add('open');
    node.scrollTop = 0;
  }

  return {
    id: 'detail',
    mount(root) {
      root.appendChild(backdrop);
      root.appendChild(node);

      node.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (btn) {
          if (btn.dataset.act === 'close') setState({ selectedId: null, neighborIds: new Set(), zen: false });
          else setState({ zen: !state.zen });
          return;
        }
        const a = e.target.closest('[data-goto]');
        if (!a) return;
        e.preventDefault();
        setState({ selectedId: a.dataset.goto });
      });

      subscribe((keys) => {
        // Theme changes must re-render: mermaid bakes its colours into the SVG.
        if (keys.has('selectedId') || keys.has('model') || keys.has('theme')) render();
        if (keys.has('zen')) {
          node.classList.toggle('zen', state.zen);
          document.documentElement.toggleAttribute('data-zen', state.zen && !!state.selectedId);
          const btn = node.querySelector('[data-act="zen"]');
          if (btn) btn.textContent = state.zen ? '⤡' : '⤢';
        }
        // Leaving the note behind must not leave the screen dimmed.
        if (keys.has('selectedId') && !state.selectedId && state.zen) setState({ zen: false });
      });
    },
  };
}
