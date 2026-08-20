// Floating hover preview. Follows the cursor, reads state.hoverId.

import { state, subscribe } from '../state.js';
import { renderBody, applySyntaxHighlighting, metaLine } from '../markdown.js';
import { escapeHtml, el } from '../ui/dom.js';

export function createPreviewPanel() {
  const node = el('div.node-preview');
  let size = 240;

  function render() {
    const n = state.hoverId && state.model ? state.model.byId.get(state.hoverId) : null;
    if (!n) {
      node.style.opacity = 0;
      return;
    }
    node.innerHTML = `
      <div class="node-preview-title">${escapeHtml(n.title || n.id)}</div>
      <div class="node-preview-tags">${escapeHtml(metaLine(n))}</div>
      <hr class="node-preview-divider" />
      <div class="node-preview-body">${n.ghost ? '<em>not yet written</em>' : renderBody(n, size)}</div>`;
    applySyntaxHighlighting(node);
    node.style.opacity = 1;
  }

  return {
    id: 'preview',
    mount(root) {
      root.appendChild(node);
      document.addEventListener('mousemove', (e) => {
        node.style.left = e.clientX + 20 + 'px';
        node.style.top = e.clientY + 20 + 'px';
      });
      subscribe((keys) => {
        // Shrink the preview while the detail panel is open, as before.
        if (keys.has('selectedId')) size = state.selectedId ? 120 : 240;
        if (keys.has('hoverId') || keys.has('model')) render();
      });
    },
  };
}
