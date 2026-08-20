// Top-right toolbar: view switcher, 2D/3D toggle, theme toggle, colour-by.
// Mounted by main.js (not part of the panel registry — it drives view routing).

import { state, setState } from '../state.js';
import { VIEW_ORDER, VIEW_FACTORIES } from '../views/index.js';
import { el } from '../ui/dom.js';

const LABELS = { graph: 'Graph', hierarchy: 'Hierarchy', matrix: 'Matrix', lint: 'Health' };

export function createToolbar() {
  const bar = el('div.zk-toolbar');

  const viewBtns = VIEW_ORDER.map((id) =>
    el('button.zk-tab', { 'data-view': id, text: LABELS[id] || id, onclick: () => setState({ view: id }) }),
  );
  const modeBtn = el('button.zk-tab.zk-mode', { onclick: () => setState({ renderMode: state.renderMode === '3d' ? '2d' : '3d' }) });
  const themeBtn = el('button.zk-tab', { title: 'toggle theme', text: '◐', onclick: () => setState({ theme: state.theme === 'dark' ? 'light' : 'dark' }) });

  const colorSel = el('select.zk-select', {
    onchange: (e) => setState({ colorBy: e.target.value }),
  });
  for (const [v, label] of [['type', 'colour: type'], ['folder', 'colour: folder'], ['bundle', 'colour: bundle'], ['cluster', 'colour: cluster']]) {
    colorSel.append(el('option', { value: v, text: label }));
  }

  bar.append(el('div.zk-tabs', {}, ...viewBtns), modeBtn, colorSel, themeBtn);

  function render() {
    for (const b of viewBtns) b.classList.toggle('active', b.dataset.view === state.view);
    modeBtn.textContent = state.renderMode === '3d' ? '3D' : '2D';
    modeBtn.title = `switch to ${state.renderMode === '3d' ? '2D' : '3D'} (press 2/3)`;
    modeBtn.style.display = state.view === 'graph' ? '' : 'none';
    colorSel.value = state.colorBy;
  }

  return {
    id: 'toolbar',
    element: bar,
    render,
    mount(root) {
      root.appendChild(bar);
      render();
    },
  };
}

export { VIEW_FACTORIES };
