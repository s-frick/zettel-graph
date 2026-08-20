// B1 — health / lint dashboard. Renders the pure checks from ../lint.js as a
// scrollable list of collapsible cards, one per check.
//
// The dashboard is a jumping-off point, never a dead end: every finding links
// back into the graph view so the user can see the note in context.

import { state, setState } from '../state.js';
import { runLint } from '../lint.js';
import { el } from '../ui/dom.js';

const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 };

export function createLintView() {
  let host = null;
  // Collapse state survives re-runs so a file save does not fold open cards.
  const collapsed = new Set();

  function goTo(id) {
    if (!id) return;
    setState({ selectedId: id, view: 'graph' });
  }

  function renderItem(it) {
    const detail = el('div.zk-lint-item-detail', { text: it.detail || '' });
    // Ghost findings have no node behind them; the referencing notes are the
    // only thing worth clicking, so they become the actionable targets.
    if (it.refs) {
      const refs = el('div.zk-lint-refs');
      for (const ref of it.refs) {
        refs.append(el('button.zk-lint-ref', { type: 'button', text: ref, onClick: () => goTo(ref) }));
      }
      return el('li.zk-lint-item.zk-lint-item-static', {},
        el('div.zk-lint-item-title', { text: it.title }), detail, refs);
    }
    return el('li.zk-lint-item', {},
      el('button.zk-lint-item-btn', { type: 'button', onClick: () => goTo(it.id) },
        el('span.zk-lint-item-title', { text: it.title }),
        el('span.zk-lint-item-id', { text: it.id || '' }),
        detail));
  }

  function renderCard(check) {
    const open = !collapsed.has(check.id);
    const head = el('button.zk-lint-card-head', {
      type: 'button',
      'aria-expanded': String(open),
      onClick: () => {
        if (collapsed.has(check.id)) collapsed.delete(check.id);
        else collapsed.add(check.id);
        render();
      },
    },
      el('span.zk-lint-caret', { text: open ? '▾' : '▸' }),
      el('span.zk-lint-card-title', { text: check.label }),
      el('span.zk-lint-count', { text: String(check.items.length) }));

    const body = el('div.zk-lint-card-body', {},
      el('p.zk-lint-card-desc', { text: check.description }));
    if (!check.items.length) {
      // Show the card anyway — a green "nothing here" is information too.
      body.append(el('div.zk-lint-empty', { text: 'no findings' }));
    } else {
      const list = el('ul.zk-lint-items');
      for (const it of check.items) list.append(renderItem(it));
      body.append(list);
    }

    const card = el(`section.zk-lint-card.zk-sev-${check.severity}`, { 'data-check': check.id }, head);
    if (open) card.append(body);
    return card;
  }

  function render() {
    if (!host) return;
    const checks = runLint(state.model).slice().sort((a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
    // Ghosts stay pinned to the top regardless of severity: they are the TODO list.
    checks.sort((a, b) => (b.id === 'ghosts') - (a.id === 'ghosts'));

    host.innerHTML = '';
    const wrap = el('div.zk-lint');
    wrap.append(el('header.zk-lint-head', {},
      el('h2.zk-lint-title', { text: 'Bundle health' }),
      el('span.zk-lint-subtitle', {
        text: state.model ? `${state.model.nodes.length} nodes · ${state.model.links.length} links` : 'no bundle loaded',
      })));

    const summary = el('div.zk-lint-summary');
    for (const c of checks) {
      summary.append(el(`button.zk-lint-stat.zk-sev-${c.severity}`, {
        type: 'button',
        title: c.description,
        // Scrolling beats collapsing here: the card keeps whatever state it had.
        onClick: () => wrap.querySelector(`[data-check="${c.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      },
        el('span.zk-lint-stat-value', { text: String(c.items.length) }),
        el('span.zk-lint-stat-label', { text: c.label })));
    }
    wrap.append(summary);

    const cards = el('div.zk-lint-cards');
    for (const c of checks) cards.append(renderCard(c));
    wrap.append(cards);
    host.append(wrap);
  }

  return {
    id: 'lint',
    label: 'Health',

    mount(container) {
      host = container;
      render();
    },

    update(keys) {
      if (keys.has('model')) render();
    },

    unmount() {
      if (host) host.innerHTML = '';
      host = null;
    },
  };
}
