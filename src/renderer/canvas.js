// A1/A2 — 2D canvas renderer (Obsidian-style) behind the shared renderer
// facade. See src/renderer/index.js for the contract.
//
// Colour and size come exclusively from ../styling.js so a node looks identical
// in 2D, 3D and the table-ish views. Anything this file adds on top (hover
// dimming, halos, rings, labels) is alpha/stroke decoration only — it never
// re-derives a fill colour.

import ForceGraph from 'force-graph';
import { state } from '../state.js';
import { nodeColor, nodeSize, linkColor, linkWidth, canvasBackground, SELECT_COLOR } from '../styling.js';

// Zoom at which a degree-0 node reveals its label. Hubs divide this down, so a
// well-connected node stays labelled much further out (Obsidian behaviour).
const LABEL_ZOOM = 3.4;
// Width of the fade band below the threshold — avoids labels popping in.
const LABEL_FADE = 0.35;
const LABEL_PX = 12;

const DIM_ALPHA = 0.15;
// Radius, in *screen* pixels, within which a pointer still counts as being on a
// node. Bigger than most circles look, which is what makes small and ghost
// nodes grabbable at every zoom level.
const HIT_PX = 10;
// How far the pointer may travel between press and release and still count as a
// click rather than a pan.
const CLICK_SLOP_PX = 5;
const CURVATURE = 0.22;

export function create2dRenderer(container, handlers = {}) {
  const el = document.createElement('div');
  el.className = 'zk-canvas zk-canvas-2d';
  container.appendChild(el);

  let zoomK = 1;
  // A fit requested before the layout has settled. Panels restoring persisted
  // forces reheat the simulation, so "engine stopped" fires several times right
  // after boot — arming a one-shot is the only way to land on a stable layout.
  let pendingFit = false;
  // Adjacency of the *visible* graph — the model's adjacency does not know about
  // injected pseudo-nodes (tag nodes), so we derive it from the data we render.
  let neighbors = new Map();

  const isDimmed = (id) => {
    const h = state.hoverId;
    if (!h || h === id) return false;
    const near = neighbors.get(h);
    return !(near && near.has(id));
  };

  function labelAlpha(node) {
    const threshold = LABEL_ZOOM / (1 + Math.sqrt(node.degree || 0) / 3);
    if (zoomK >= threshold) return 1;
    if (zoomK <= threshold - LABEL_FADE) return 0;
    return (zoomK - (threshold - LABEL_FADE)) / LABEL_FADE;
  }

  const LABEL_FONT = 'system-ui, sans-serif';
  const labelColor = () => (state.theme === 'light' ? 'rgba(26,26,26,0.9)' : 'rgba(248,248,248,0.88)');

  function drawNode(node, ctx, globalScale) {
    const r = nodeSize(node);
    const color = nodeColor(node);
    const dimmed = isDimmed(node.id);
    const hovered = state.hoverId === node.id;

    ctx.save();
    if (dimmed) ctx.globalAlpha = DIM_ALPHA;

    // Halo first so it sits under the disc.
    if (hovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 2.1, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.18;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    if (node.ghost) {
      // Ghosts are unwritten notes: outline only, so they read as "not there yet".
      ctx.setLineDash([2 / globalScale, 2 / globalScale]);
      ctx.lineWidth = 1.2 / globalScale;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }

    if (node.id === state.selectedId) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 3 / globalScale, 0, 2 * Math.PI);
      ctx.lineWidth = 1.6 / globalScale;
      ctx.strokeStyle = SELECT_COLOR;
      ctx.stroke();
    }

    const alpha = hovered ? 1 : labelAlpha(node);
    if (alpha > 0.02) {
      const font = LABEL_PX / globalScale;
      ctx.font = `${font}px ${LABEL_FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = dimmed ? DIM_ALPHA : alpha;
      // Halo in the canvas colour keeps text readable over dense link bundles.
      ctx.lineWidth = 3 / globalScale;
      ctx.strokeStyle = canvasBackground();
      ctx.lineJoin = 'round';
      const label = node.title || node.id;
      const x = node.x + r + 3 / globalScale;
      ctx.strokeText(label, x, node.y);
      ctx.fillStyle = labelColor();
      ctx.fillText(label, x, node.y);
    }

    ctx.restore();
  }

  // --- picking -------------------------------------------------------------
  //
  // force-graph identifies the node under the pointer by painting every node in
  // a unique colour into an off-screen buffer and reading back the single pixel
  // under the cursor (canvas-color-tracker). That only works when the canvas
  // hands back exactly the byte values that were written. It does not here:
  // depending on the display colour profile, Chrome colour-manages the backing
  // store and getImageData returns values off by one per channel, which breaks
  // the tracker's checksum and makes lookup() return null. Measured on this
  // machine, 4 of 7 index colours failed the round trip and 129 of 141 nodes
  // were unreachable — no hover, no click — while the 3D view (raycasting, no
  // colour buffer) was fine.
  //
  // So we pick ourselves: nearest node in graph space within a screen-space
  // radius. Exact, independent of the GPU, and forgiving enough that a 3 px dot
  // is as easy to grab as a hub.

  /** Node under a client-space point, or null. */
  function hitTest(clientX, clientY) {
    const rect = el.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    if (px < 0 || py < 0 || px > rect.width || py > rect.height) return null;
    const { x, y } = G.screen2GraphCoords(px, py);
    const k = zoomK || 1;
    let best = null;
    let bestDist = Infinity;
    for (const node of G.graphData().nodes) {
      if (node.x == null) continue;
      const dist = Math.hypot(node.x - x, node.y - y);
      // Whichever is more generous: the drawn disc plus a little, or a flat
      // screen-space radius that survives being zoomed out.
      if (dist > Math.max(nodeSize(node) + 2, HIT_PX / k)) continue;
      // Nearest centre wins, so a small node sitting on a hub stays selectable.
      if (dist < bestDist) {
        bestDist = dist;
        best = node;
      }
    }
    return best;
  }

  let hovered = null;
  function setHover(node) {
    if (node === hovered) return;
    const prev = hovered;
    hovered = node;
    el.classList.toggle('zk-canvas-hover', !!node);
    handlers.onNodeHover?.(node, prev);
  }

  // Links keep force-graph's own drawing (curves + arrows); hover dimming is
  // applied as an alpha multiplier on the colour styling.js already decided.
  const dimLinkColor = (link) => {
    const css = linkColor(link);
    if (!state.hoverId) return css;
    const s = link.source && link.source.id != null ? link.source.id : link.source;
    const t = link.target && link.target.id != null ? link.target.id : link.target;
    const lit = s === state.hoverId || t === state.hoverId;
    return lit ? css : fadeCss(css, DIM_ALPHA);
  };

  const G = ForceGraph()(el)
    .backgroundColor(canvasBackground())
    .nodeId('id')
    .nodeLabel(() => '')
    .nodeVal(nodeSize)
    .nodeCanvasObject(drawNode)
    .linkColor(dimLinkColor)
    .linkWidth(linkWidth)
    .linkCurvature((l) => l.__curvature || 0)
    .linkDirectionalArrowLength(3.5)
    .linkDirectionalArrowRelPos(1)
    .linkDirectionalArrowColor(dimLinkColor)
    // Visuals depend on state (hover/selection/search) that changes outside the
    // simulation, so we cannot let force-graph pause its render loop.
    .autoPauseRedraw(false)
    // Hover, click and drag are ours (see "picking" above). Turning the built-in
    // pointer interaction off also stops force-graph maintaining the off-screen
    // colour buffer at all, which is a frame-time win on a dense graph.
    .enablePointerInteraction(false)
    .enableNodeDrag(false)
    .onZoom((t) => { zoomK = t.k; });

  G.onEngineStop(() => {
    if (!pendingFit) return;
    pendingFit = false;
    G.zoomToFit(400, 60);
  });
  // Touching the viewport yourself cancels a pending fit — nothing should yank
  // the camera away once you have started navigating.
  el.addEventListener('wheel', () => { pendingFit = false; }, { passive: true });

  // --- pointer layer --------------------------------------------------------
  // One press decides between three gestures: click a node, drag a node, pan the
  // background. The decision is made on pointerdown so d3-zoom can be told to
  // keep its hands off before it sees the event — hence the capture phase, as
  // its own listener sits on the canvas *below* this element.
  let press = null;

  el.addEventListener('pointerdown', (ev) => {
    pendingFit = false;
    if (ev.button !== 0) return;
    const node = hitTest(ev.clientX, ev.clientY);
    press = { x: ev.clientX, y: ev.clientY, node, moved: false };
    if (!node) return;
    // Panning must not fight a node drag.
    G.enablePanInteraction(false);
    // Only capture for a node drag: capturing a background press would retarget
    // the move events away from the canvas and break d3-zoom's panning.
    el.setPointerCapture?.(ev.pointerId);
    press.captured = ev.pointerId;
  }, { capture: true });

  el.addEventListener('pointermove', (ev) => {
    if (!press) {
      setHover(hitTest(ev.clientX, ev.clientY));
      return;
    }
    if (!press.moved && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > CLICK_SLOP_PX) {
      press.moved = true;
      if (press.node) {
        // Pin the node and keep the simulation warm so neighbours follow along.
        press.node.fx = press.node.x;
        press.node.fy = press.node.y;
        G.d3ReheatSimulation();
      }
    }
    if (!press.moved || !press.node) return;
    const rect = el.getBoundingClientRect();
    const p = G.screen2GraphCoords(ev.clientX - rect.left, ev.clientY - rect.top);
    press.node.fx = press.node.x = p.x;
    press.node.fy = press.node.y = p.y;
  });

  const endPress = (ev) => {
    if (!press) return;
    const { node, moved, captured } = press;
    press = null;
    if (captured != null) el.releasePointerCapture?.(captured);
    G.enablePanInteraction(true);
    if (node && moved) {
      // Release the pin — a dropped node rejoins the layout, as it did before.
      node.fx = undefined;
      node.fy = undefined;
      return;
    }
    if (moved) return; // a pan, not a click
    if (node) handlers.onNodeClick?.(node, ev);
    else handlers.onBackgroundClick?.(ev);
  };
  const cancelPress = () => {
    if (!press) return;
    if (press.captured != null) el.releasePointerCapture?.(press.captured);
    press = null;
    G.enablePanInteraction(true);
  };
  // On window, not on the element: a release outside the canvas must not strand
  // the pan lock.
  window.addEventListener('pointerup', endPress);
  window.addEventListener('pointercancel', cancelPress);
  el.addEventListener('pointerleave', () => { if (!press) setHover(null); });

  const onResize = () => G.width(el.clientWidth).height(el.clientHeight);
  const ro = new ResizeObserver(onResize);
  ro.observe(el);
  window.addEventListener('resize', onResize);
  // force-graph bakes devicePixelRatio into the backing store on size changes
  // only, so a monitor switch needs a forced re-size to stay crisp.
  const dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  const onDpr = () => {
    G.width(Math.max(1, el.clientWidth - 1)).height(Math.max(1, el.clientHeight - 1));
    onResize();
  };
  dprQuery.addEventListener?.('change', onDpr);
  onResize();

  return {
    mode: '2d',
    element: el,

    setData(g) {
      neighbors = buildNeighbors(g.links);
      applyCurvature(g.links);
      G.graphData(g);
      hovered = null;
    },
    getData: () => G.graphData(),

    // Accessors read styling.js live, so a repaint is all that is needed — but
    // re-setting them also invalidates force-graph's internal accessor caches.
    refresh: () => G.nodeVal(nodeSize).linkColor(dimLinkColor).linkWidth(linkWidth),

    setBackground: (css) => G.backgroundColor(css),
    resize: onResize,
    zoomToFit: (ms = 600) => {
      pendingFit = false; // an explicit fit wins over a queued one
      G.zoomToFit(ms, 60);
    },
    fitWhenSettled: () => { pendingFit = true; },

    setForces(f) {
      G.d3Force('charge')?.strength(f.charge);
      G.d3Force('link')?.distance(f.linkDistance).strength(f.linkStrength);
      const center = G.d3Force('center');
      if (center?.strength) center.strength(f.centerStrength);
      G.d3ReheatSimulation();
    },

    focus(node) {
      if (!node || node.x == null) return;
      G.centerAt(node.x, node.y, 700);
      G.zoom(Math.max(G.zoom(), 3), 700);
    },

    destroy() {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerup', endPress);
      window.removeEventListener('pointercancel', cancelPress);
      dprQuery.removeEventListener?.('change', onDpr);
      G._destructor?.();
      el.remove();
    },
  };
}

function buildNeighbors(links = []) {
  const map = new Map();
  const add = (a, b) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a).add(b);
  };
  for (const l of links) {
    const s = l.source && l.source.id != null ? l.source.id : l.source;
    const t = l.target && l.target.id != null ? l.target.id : l.target;
    add(s, t);
    add(t, s);
  }
  return map;
}

/**
 * Bow a link out whenever its reverse twin exists, otherwise A→B and B→A would
 * be painted on top of each other and one arrowhead would be invisible. The
 * sign is derived from the endpoint ids so both halves bend to opposite sides.
 */
function applyCurvature(links = []) {
  const seen = new Set();
  const key = (l) => {
    const s = l.source && l.source.id != null ? l.source.id : l.source;
    const t = l.target && l.target.id != null ? l.target.id : l.target;
    return [s, t];
  };
  for (const l of links) seen.add(key(l).join('\u0000'));
  for (const l of links) {
    const [s, t] = key(l);
    if (s === t) {
      l.__curvature = 0.5; // self-loop needs a visible arc
    } else if (seen.has(`${t}\u0000${s}`)) {
      l.__curvature = s < t ? CURVATURE : -CURVATURE;
    } else {
      l.__curvature = 0;
    }
  }
}

/** Multiply an rgb()/rgba()/#hex colour by `a` without touching its hue. */
function fadeCss(css, a) {
  if (typeof css !== 'string') return css;
  const rgba = css.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(',').map((p) => p.trim());
    const alpha = parts.length > 3 ? Number(parts[3]) : 1;
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha * a})`;
  }
  const hex = css.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  return css;
}
