// B3 — adjacency-matrix view.
//
// For dense clusters a matrix beats any force layout: with rows/cols grouped by
// folder, block structure along the diagonal shows whether the folder tree
// matches the real link topology. Rendered on a canvas because a real bundle is
// ~150 nodes = ~22k cells, and that many DOM nodes would stall every redraw.

import { state, setState } from '../state.js';
import { visibleGraph, idOf } from '../model/graph.js';
import { baseColor, canvasBackground, SELECT_COLOR } from '../styling.js';
import { el, slider, escapeHtml } from '../ui/dom.js';

const ORDERS = [
  { id: 'folder', label: 'Folder' },
  { id: 'degree', label: 'Degree' },
  { id: 'type', label: 'Type' },
  { id: 'alpha', label: 'A-Z' },
];

const GROUP_W = 15; // rotated group-label strip on the far left
const LABEL_W = 190; // group strip + truncated row labels
const TOP_H = 16; // column swatch strip — the only handle columns get
const FONT = 'system-ui, sans-serif';

export function createMatrixView() {
  let host = null;
  let canvas = null;
  let ctx = null;
  let tip = null;
  let scroll = null;
  let empty = null;

  let order = 'folder';
  let cell = 11;
  let layout = null; // { nodes, index, edges, groups, degree }
  let hover = null; // { row, col }
  let frame = 0;

  // ---------- layout ----------

  const titleOf = (n) => n.title || n.id;

  /** Group key per order mode; null means "no grouping" (degree / alphabetical). */
  function groupKey(n) {
    if (order === 'folder') return n.folder || '(root)';
    if (order === 'type') return n.type || 'Unknown';
    return null;
  }

  function buildLayout() {
    const g = visibleGraph(state.model, state);
    const nodes = g.nodes.slice();

    // Degree is recomputed from the *visible* links rather than taken from the
    // model, so the ordering reflects what the user is actually looking at.
    const degree = new Map(nodes.map((n) => [n.id, 0]));
    const edges = new Set();
    for (const l of g.links) {
      const s = idOf(l.source);
      const t = idOf(l.target);
      if (!degree.has(s) || !degree.has(t)) continue;
      edges.add(s + ' ' + t);
      degree.set(s, degree.get(s) + 1);
      degree.set(t, degree.get(t) + 1);
    }

    const byTitle = (a, b) => titleOf(a).localeCompare(titleOf(b));
    if (order === 'degree') nodes.sort((a, b) => (degree.get(b.id) - degree.get(a.id)) || byTitle(a, b));
    else if (order === 'alpha') nodes.sort(byTitle);
    else nodes.sort((a, b) => groupKey(a).localeCompare(groupKey(b)) || byTitle(a, b));

    // Contiguous runs of one group key — separators and labels hang off these.
    const groups = [];
    if (order === 'folder' || order === 'type') {
      for (let i = 0; i < nodes.length; i++) {
        const key = groupKey(nodes[i]);
        const last = groups[groups.length - 1];
        if (last && last.key === key) last.end = i + 1;
        else groups.push({ key, start: i, end: i + 1 });
      }
    }

    layout = { nodes, index: new Map(nodes.map((n, i) => [n.id, i])), edges, groups, degree };
  }

  const has = (a, b) => layout.edges.has(a + ' ' + b);

  // ---------- sizing ----------

  function resize() {
    if (!canvas || !layout) return;
    const n = layout.nodes.length;
    const w = LABEL_W + n * cell + 1;
    const h = TOP_H + n * cell + 1;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // devicePixelRatio can change when the window moves to another monitor, so the
  // backing store is rebuilt on every resize, not only on cell-size changes.
  function onResize() {
    resize();
    schedule();
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  }

  // ---------- drawing ----------

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function truncate(text, max) {
    if (ctx.measureText(text).width <= max) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '...').width > max) s = s.slice(0, -1);
    return s + '...';
  }

  function draw() {
    if (!ctx || !layout) return;
    const { nodes } = layout;
    const n = nodes.length;
    if (!n) return;
    const text = cssVar('--zk-text', '#f8f8f8');
    const dim = cssVar('--zk-text-dim', 'rgba(248,248,248,0.55)');
    const grid = cssVar('--zk-border-soft', 'rgba(255,255,255,0.25)');
    const wash = state.theme === 'light' ? 'rgba(0,0,0,' : 'rgba(255,255,255,';
    const x0 = LABEL_W;
    const y0 = TOP_H;

    ctx.fillStyle = canvasBackground();
    ctx.fillRect(0, 0, x0 + n * cell + 1, y0 + n * cell + 1);

    // Diagonal band: an anchor for the eye, never a real edge.
    ctx.fillStyle = wash + '0.07)';
    for (let i = 0; i < n; i++) ctx.fillRect(x0 + i * cell, y0 + i * cell, cell, cell);

    // Cells. Row = source, column = target, so the upper triangle is outbound
    // and the lower one inbound — direction reads without any arrowheads.
    for (let r = 0; r < n; r++) {
      const src = nodes[r];
      const color = baseColor(src);
      for (let c = 0; c < n; c++) {
        if (r === c || !has(src.id, nodes[c].id)) continue;
        const x = x0 + c * cell;
        const y = y0 + r * cell;
        ctx.fillStyle = color;
        ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        // Reciprocal pairs get an accent ring so they pop out of the field.
        if (cell >= 6 && has(nodes[c].id, src.id)) {
          ctx.strokeStyle = SELECT_COLOR;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
        }
      }
    }

    // Group separators run across the whole field in both directions.
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const grp of layout.groups) {
      if (!grp.start) continue;
      const p = grp.start * cell + 0.5;
      ctx.moveTo(x0 + p, y0);
      ctx.lineTo(x0 + p, y0 + n * cell);
      ctx.moveTo(0, y0 + p);
      ctx.lineTo(x0 + n * cell, y0 + p);
    }
    ctx.stroke();

    const band = (i, fill) => {
      ctx.fillStyle = fill;
      ctx.fillRect(0, y0 + i * cell, x0 + n * cell, cell);
      ctx.fillRect(x0 + i * cell, 0, cell, y0 + n * cell);
    };
    // Selection stays lit while hovering elsewhere; hover is the transient layer.
    if (state.selectedId != null && layout.index.has(state.selectedId)) {
      band(layout.index.get(state.selectedId), 'rgba(255,204,0,0.16)');
    }
    if (hover) {
      band(hover.row, wash + '0.12)');
      band(hover.col, wash + '0.12)');
    }

    // Columns get a colour tick only: rotated labels are unreadable at 150
    // nodes, so the tooltip names the column instead.
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = baseColor(nodes[i]);
      ctx.fillRect(x0 + i * cell + 0.5, y0 - 6, cell - 1, 5);
    }

    ctx.font = Math.min(11, Math.max(7, cell - 1)) + 'px ' + FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    if (cell >= 7) {
      const max = LABEL_W - GROUP_W - 12;
      for (let i = 0; i < n; i++) {
        const node = nodes[i];
        ctx.fillStyle = node.id === state.selectedId ? SELECT_COLOR
          : hover && hover.row === i ? text : dim;
        ctx.fillText(truncate(titleOf(node), max), GROUP_W + 6, y0 + i * cell + cell / 2);
      }
    }

    // Rotated group labels, but only where the run is tall enough to read.
    ctx.textAlign = 'center';
    for (const grp of layout.groups) {
      const h = (grp.end - grp.start) * cell;
      if (h < 28) continue;
      ctx.save();
      ctx.translate(GROUP_W - 4, y0 + grp.start * cell + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = text;
      ctx.fillText(truncate(shortGroup(grp.key), h - 8), 0, 0);
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }

  function shortGroup(key) {
    const i = key.lastIndexOf('/');
    return i === -1 ? key : key.slice(i + 1);
  }

  // ---------- interaction ----------

  function cellAt(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const n = layout.nodes.length;
    const col = Math.floor((x - LABEL_W) / cell);
    const row = Math.floor((y - TOP_H) / cell);
    return {
      row: row >= 0 && row < n ? row : -1,
      col: col >= 0 && col < n ? col : -1,
      inLabels: x < LABEL_W,
      inHeader: y < TOP_H,
    };
  }

  function onMove(ev) {
    if (!layout || !layout.nodes.length) return;
    const p = cellAt(ev);
    if (p.row < 0 || p.col < 0) {
      onLeave();
      return;
    }
    if (!hover || hover.row !== p.row || hover.col !== p.col) {
      hover = { row: p.row, col: p.col };
      schedule();
    }
    const src = layout.nodes[p.row];
    const dst = layout.nodes[p.col];
    const rel = has(src.id, dst.id) ? 'links to' : has(dst.id, src.id) ? 'reverse link only' : 'no link';
    tip.innerHTML = '<b>' + escapeHtml(titleOf(src)) + '</b> &rarr; <b>' + escapeHtml(titleOf(dst)) +
      '</b><span class="zk-matrix-tip-meta">' + rel + '</span>';
    tip.hidden = false;
    const box = host.getBoundingClientRect();
    tip.style.left = ev.clientX - box.left + 14 + 'px';
    tip.style.top = ev.clientY - box.top + 14 + 'px';
    // Feed the shared preview panel, which keys off the row (= source) node.
    if (state.hoverId !== src.id) setState({ hoverId: src.id });
  }

  function onLeave() {
    if (tip) tip.hidden = true;
    if (hover) {
      hover = null;
      schedule();
    }
    if (state.hoverId != null) setState({ hoverId: null });
  }

  function onClick(ev) {
    if (!layout || !layout.nodes.length) return;
    const p = cellAt(ev);
    // The label gutter selects its row, the top strip its column, a cell its source.
    const i = p.inLabels ? p.row : p.inHeader ? p.col : p.row;
    if (i < 0) return;
    setState({ selectedId: layout.nodes[i].id });
  }

  // ---------- controls ----------

  function controls() {
    const seg = el('div.zk-matrix-seg');
    const buttons = [];
    for (const o of ORDERS) {
      const b = el('button.zk-matrix-segbtn', {
        type: 'button',
        text: o.label,
        onclick: () => {
          if (order === o.id) return;
          order = o.id;
          for (const [btn, def] of buttons) btn.classList.toggle('active', def.id === order);
          rebuild();
        },
      });
      if (o.id === order) b.classList.add('active');
      seg.append(b);
      buttons.push([b, o]);
    }

    const zoom = slider({
      label: 'Cell size',
      min: 4,
      max: 28,
      value: cell,
      format: (v) => v + 'px',
      onInput: (v) => {
        cell = v;
        resize();
        schedule();
      },
    });

    return el('div.zk-matrix-controls.zk-panel', {},
      el('div.zk-panel-title', { text: 'Adjacency matrix' }), seg, zoom);
  }

  function rebuild() {
    buildLayout();
    hover = null;
    const n = layout.nodes.length;
    empty.hidden = n > 0;
    scroll.hidden = n === 0;
    resize();
    schedule();
  }

  return {
    id: 'matrix',
    label: 'Matrix',

    mount(container) {
      host = el('div.zk-matrix');
      canvas = el('canvas.zk-matrix-canvas');
      tip = el('div.zk-matrix-tip', { hidden: '' });
      scroll = el('div.zk-matrix-scroll', {}, canvas);
      empty = el('div.zk-view-placeholder.zk-matrix-empty', {
        text: 'No nodes match the current filters',
        hidden: '',
      });
      host.append(scroll, empty, controls(), tip);
      container.append(host);

      canvas.addEventListener('mousemove', onMove);
      canvas.addEventListener('mouseleave', onLeave);
      canvas.addEventListener('click', onClick);
      window.addEventListener('resize', onResize);

      rebuild();
    },

    update(keys) {
      if (!host) return;
      // Anything that changes which nodes/links exist forces a re-sort; the rest
      // (selection, theme, search dimming) is a plain repaint.
      if (keys.has('model') || keys.has('filters') || keys.has('localGraph') ||
          keys.has('timeline') || keys.has('colorBy')) rebuild();
      else schedule();
    },

    unmount() {
      canvas?.removeEventListener('mousemove', onMove);
      canvas?.removeEventListener('mouseleave', onLeave);
      canvas?.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      host?.remove();
      host = canvas = ctx = tip = scroll = empty = null;
      layout = null;
      hover = null;
    },
  };
}
