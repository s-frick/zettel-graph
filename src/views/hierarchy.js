// B2 — folder-hierarchy view: the structural counterpart to the force layout.
//
// Two sub-modes render the SAME tree because "how is this bundle organised?"
// needs both an exact, scannable list (indented tree) and a proportional
// overview (sunburst). Expand/collapse and the sunburst drill-down live in this
// module rather than in state.js: they are view-local and must not trigger a
// global re-render of panels and renderers.

import { state, setState } from '../state.js';
import { visibleGraph, neighborsWithin } from '../model/graph.js';
import { baseColor, paletteColor, SELECT_COLOR } from '../styling.js';
import { el } from '../ui/dom.js';

// Keys that change what the tree shows. hoverId is deliberately absent — the
// preview panel handles hover, and re-rendering on it would fight the mouse.
const RERENDER_KEYS = ['model', 'filters', 'selectedId', 'timeline', 'localGraph', 'colorBy', 'theme'];

const TAU = Math.PI * 2;
const RINGS = 4; // depth cut-off; deeper folders are reachable by drilling in

export function createHierarchyView() {
  let headEl = null;
  let bodyEl = null;
  let mode = 'tree';
  /** Expanded directory paths — preserved across re-renders (req. 7). */
  const expanded = new Set();
  let seeded = false;
  let lastSelected = null;
  /** Sunburst drill-down root; '' = whole bundle set. */
  let focusPath = '';
  let centerEl = null;

  // ---------- tree model ----------

  /** Group visible nodes by their posix id into a directory tree. */
  function buildTree(nodes) {
    const root = { name: '', path: '', dir: true, kids: new Map(), count: 0 };
    for (const n of nodes) {
      // Tag pseudo-nodes (B5) are synthetic and have no place in the file tree.
      if (n.isTag) continue;
      const parts = String(n.id).split('/');
      let cur = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const path = parts.slice(0, i + 1).join('/');
        let next = cur.kids.get(parts[i]);
        if (!next) {
          next = { name: parts[i], path, dir: true, kids: new Map(), count: 0 };
          cur.kids.set(parts[i], next);
        }
        cur = next;
      }
      const leaf = parts[parts.length - 1];
      cur.kids.set(leaf, { name: leaf, path: n.id, dir: false, node: n, count: 1 });
    }
    finalize(root);
    return root;
  }

  /** Turn kid maps into sorted arrays and roll descendant counts upwards. */
  function finalize(dir) {
    const kids = [...dir.kids.values()];
    dir.kids = null;
    for (const k of kids) if (k.dir) finalize(k);
    kids.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
    dir.children = kids;
    dir.count = kids.reduce((sum, k) => sum + k.count, 0);
    return dir;
  }

  function findDir(root, path) {
    if (!path) return root;
    let cur = root;
    for (const part of path.split('/')) {
      const next = (cur.children || []).find((k) => k.dir && k.name === part);
      if (!next) return null;
      cur = next;
    }
    return cur;
  }

  /** Open every directory above `id` so the selection is actually visible. */
  function expandAncestors(id) {
    const parts = String(id).split('/');
    for (let i = 1; i < parts.length; i++) expanded.add(parts.slice(0, i).join('/'));
  }

  // ---------- selection ----------

  function select(id, jumpToGraph) {
    const patch = {
      selectedId: id,
      // Mirror the graph view so dimming/highlighting stays consistent.
      neighborIds: id && state.model ? neighborsWithin(state.model, id, 1) : new Set(),
    };
    if (jumpToGraph) patch.view = 'graph';
    setState(patch);
  }

  function hover(id) {
    if (state.hoverId !== id) setState({ hoverId: id });
  }

  // ---------- indented tree ----------

  function renderTree(root, selectionMoved) {
    const list = el('div.zk-h-tree');
    let selectedRow = null;

    const walk = (dir, depth) => {
      for (const kid of dir.children) {
        const row = kid.dir ? dirRow(kid, depth) : leafRow(kid, depth);
        list.append(row);
        if (!kid.dir && kid.path === state.selectedId) selectedRow = row;
        if (kid.dir && expanded.has(kid.path)) walk(kid, depth + 1);
      }
    };
    walk(root, 0);

    if (!root.children.length) {
      list.append(el('div.zk-view-placeholder', { text: 'No notes match the current filters' }));
    }
    bodyEl.append(list);
    // Only steal the scroll position when the selection came from elsewhere.
    if (selectionMoved && selectedRow) selectedRow.scrollIntoView({ block: 'nearest' });
  }

  function dirRow(dir, depth) {
    const open = expanded.has(dir.path);
    const row = el(
      'div.zk-h-row.zk-h-dir',
      {
        style: `padding-left:${0.4 + depth * 1.05}rem`,
        title: dir.path,
        onclick: () => {
          if (open) expanded.delete(dir.path);
          else expanded.add(dir.path);
          render(false);
        },
      },
      el('span.zk-h-caret', { text: open ? '▾' : '▸' }),
      el('span.zk-h-swatch', { style: `background:${paletteColor(dir.path)}` }),
      el('span.zk-h-name', { text: dir.name }),
      el('span.zk-h-count', { text: String(dir.count) }),
    );
    return row;
  }

  function leafRow(leaf, depth) {
    const n = leaf.node;
    const row = el(
      'div.zk-h-row.zk-h-leaf',
      {
        style: `padding-left:${0.4 + depth * 1.05}rem`,
        title: leaf.path,
        onclick: () => select(n.id, false),
        ondblclick: () => select(n.id, true),
        onmouseenter: () => hover(n.id),
        onmouseleave: () => hover(null),
      },
      el('span.zk-h-dot', { style: `background:${baseColor(n)}` }),
      el('span.zk-h-name', { text: n.title || leaf.name }),
      el('span.zk-h-type', { text: n.type === '_missing' ? 'ghost' : n.type || '' }),
      el('span.zk-h-degree', { title: 'links', text: String(n.degree || 0) }),
      el('button.zk-h-open', {
        title: 'Open in graph',
        text: '↗',
        onclick: (e) => {
          e.stopPropagation();
          select(n.id, true);
        },
      }),
    );
    if (n.id === state.selectedId) row.classList.add('is-selected');
    if (n.ghost) row.classList.add('is-ghost');
    return row;
  }

  // ---------- sunburst ----------

  // Hand-rolled polar geometry — no d3. Angles start at 12 o'clock.
  function polar(cx, cy, r, a) {
    return [cx + r * Math.cos(a - Math.PI / 2), cy + r * Math.sin(a - Math.PI / 2)];
  }

  function arcPath(cx, cy, r0, r1, a0, a1) {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = polar(cx, cy, r1, a0);
    const [x1, y1] = polar(cx, cy, r1, a1);
    const [x2, y2] = polar(cx, cy, r0, a1);
    const [x3, y3] = polar(cx, cy, r0, a0);
    return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}` +
      `L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
  }

  /** Flatten the tree into arcs, angle span proportional to descendant count. */
  function layout(dir, depth, a0, a1, out) {
    if (depth >= RINGS) return;
    let a = a0;
    const total = dir.count || 1;
    for (const kid of dir.children) {
      const span = (a1 - a0) * (kid.count / total);
      // Sub-pixel slivers cost DOM and can never be hit — drop them.
      if (span > 0.004) {
        out.push({ kid, depth, a0: a, a1: a + span });
        if (kid.dir) layout(kid, depth + 1, a, a + span, out);
      }
      a += span;
    }
  }

  function renderSunburst(root) {
    let focus = findDir(root, focusPath);
    // The focused folder can vanish when filters change — fall back to the top.
    if (!focus || !focus.count) {
      focus = root;
      focusPath = '';
    }
    const arcs = [];
    layout(focus, 0, 0, TAU, arcs);

    const size = 1000;
    const c = size / 2;
    const r0 = 110;
    const ring = (c - 30 - r0) / RINGS;

    const parts = [];
    for (const { kid, depth, a0, a1 } of arcs) {
      // Colour by folder (a leaf borrows its parent folder's hue) so a whole
      // directory reads as one wedge; depth only lightens it.
      const folder = kid.dir ? kid.path : kid.path.slice(0, kid.path.lastIndexOf('/'));
      const fill = paletteColor(folder || kid.path);
      const selected = !kid.dir && kid.path === state.selectedId;
      const d = arcPath(c, c, r0 + depth * ring, r0 + (depth + 1) * ring, a0, a1);
      parts.push(
        `<path class="zk-h-arc${selected ? ' is-selected' : ''}" d="${d}" fill="${fill}"` +
          ` fill-opacity="${(0.9 - depth * 0.16).toFixed(2)}"` +
          (selected ? ` stroke="${SELECT_COLOR}" stroke-width="4"` : '') +
          ` data-path="${escapeAttr(kid.path)}" data-dir="${kid.dir ? '1' : ''}"` +
          ` data-label="${escapeAttr(labelOf(kid))}"></path>`,
      );
      // Labels only where they fit; anything narrower is noise.
      if (depth < 2 && a1 - a0 > 0.16) {
        const mid = (a0 + a1) / 2;
        const [tx, ty] = polar(c, c, r0 + (depth + 0.5) * ring, mid);
        const deg = (mid * 180) / Math.PI - 90;
        const flip = mid > Math.PI ? 180 : 0;
        parts.push(
          `<text class="zk-h-arc-label" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}"` +
            ` transform="rotate(${(deg + flip).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})"` +
            `>${escapeAttr(clip(kid.dir ? kid.name : kid.node.title || kid.name, a1 - a0, ring))}</text>`,
        );
      }
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'zk-h-sun');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.innerHTML =
      `<circle class="zk-h-hub" cx="${c}" cy="${c}" r="${r0 - 6}" data-up="1"></circle>` + parts.join('');

    // One delegated listener set instead of one per arc — the bundle can have
    // hundreds of wedges.
    svg.addEventListener('mousemove', (e) => {
      const t = e.target.closest('[data-path]');
      hover(t && !t.dataset.dir ? t.dataset.path : null);
      setCenter(t ? t.dataset.label : defaultCenter(focus, root));
    });
    svg.addEventListener('mouseleave', () => {
      hover(null);
      setCenter(defaultCenter(focus, root));
    });
    svg.addEventListener('click', (e) => {
      if (e.target.dataset.up) {
        focusPath = focusPath.includes('/') ? focusPath.slice(0, focusPath.lastIndexOf('/')) : '';
        render(false);
        return;
      }
      const t = e.target.closest('[data-path]');
      if (!t) return;
      if (t.dataset.dir) {
        focusPath = t.dataset.path;
        render(false);
      } else {
        select(t.dataset.path, false);
      }
    });
    svg.addEventListener('dblclick', (e) => {
      const t = e.target.closest('[data-path]');
      if (t && !t.dataset.dir) select(t.dataset.path, true);
    });

    centerEl = el('div.zk-h-center', { text: defaultCenter(focus, root) });
    bodyEl.append(el('div.zk-h-sun-wrap', {}, svg, centerEl));
  }

  function setCenter(text) {
    if (centerEl) centerEl.textContent = text;
  }

  function defaultCenter(focus, root) {
    return focus === root ? `${root.count} notes` : `${focus.path} · ${focus.count}`;
  }

  function labelOf(kid) {
    return kid.dir ? `${kid.path} · ${kid.count}` : kid.node.title || kid.name;
  }

  /** Rough fit: how many chars survive at this arc length and ring depth. */
  function clip(text, span, ring) {
    const max = Math.max(3, Math.floor((span * ring * 2.2) / 9));
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function escapeAttr(s = '') {
    return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  // ---------- shell ----------

  function renderHead(root) {
    headEl.innerHTML = '';
    const seg = el('div.zk-h-seg');
    for (const [id, label] of [['tree', 'Tree'], ['sunburst', 'Sunburst']]) {
      const btn = el('button.zk-h-seg-btn', {
        text: label,
        onclick: () => {
          if (mode === id) return;
          mode = id;
          render(false);
        },
      });
      if (mode === id) btn.classList.add('active');
      seg.append(btn);
    }
    headEl.append(seg, el('span.zk-h-stats', { text: `${root.count} notes · ${countDirs(root)} folders` }));
  }

  function countDirs(dir) {
    return dir.children.reduce((sum, k) => sum + (k.dir ? 1 + countDirs(k) : 0), 0);
  }

  function render(selectionMoved) {
    if (!bodyEl) return;
    const root = buildTree(visibleGraph(state.model, state).nodes);
    // Seed once: open the outermost level so a fresh bundle isn't a blank list.
    if (!seeded && root.children.length) {
      for (const k of root.children) if (k.dir) expanded.add(k.path);
      seeded = true;
    }
    const scrollTop = bodyEl.scrollTop;
    bodyEl.innerHTML = '';
    centerEl = null;
    renderHead(root);
    if (mode === 'tree') renderTree(root, selectionMoved);
    else renderSunburst(root);
    if (mode === 'tree') bodyEl.scrollTop = scrollTop;
  }

  return {
    id: 'hierarchy',
    label: 'Hierarchy',

    mount(container) {
      headEl = el('div.zk-h-head');
      bodyEl = el('div.zk-h-body');
      container.innerHTML = '';
      container.append(el('div.zk-hierarchy', {}, headEl, bodyEl));
      lastSelected = state.selectedId;
      if (state.selectedId) expandAncestors(state.selectedId);
      render(true);
    },

    update(keys) {
      if (!RERENDER_KEYS.some((k) => keys.has(k))) return;
      const moved = state.selectedId !== lastSelected;
      if (moved) {
        lastSelected = state.selectedId;
        // Selection may come from search or the graph view — reveal it here.
        if (state.selectedId) expandAncestors(state.selectedId);
      }
      render(moved);
    },

    unmount() {
      headEl = null;
      bodyEl = null;
      centerEl = null;
    },
  };
}
