// B4 — timeline scrubber over frontmatter `timestamp`.
//
// OWNER: agent B4. Contract: return { id, mount(root) }. A bottom bar with a
// date slider + play/pause that animates graph growth by setting
// state.timeline.cursor (ISO YYYY-MM-DD); visibleGraph() already hides newer
// nodes while state.timeline.enabled is true. Also expose the "colour by age"
// toggle — main.js calls setAgeRange(min, max) once per load, so the ramp
// already spans the real date range. Show a histogram of notes per month.

import { state, setState, subscribe } from '../state.js';
import { el, checkbox } from '../ui/dom.js';

// One animation step per month; slow enough to read, fast enough to feel alive.
const STEP_MS = 600;

/** Frontmatter stamps may be Date objects or ISO strings — normalise to a day. */
const dayOf = (ts) => String(ts).slice(0, 10);

/** Last day of a `YYYY-MM` bucket, so a cursor on that month includes all of it. */
function monthEnd(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Every month between the first and last stamp, gaps included, plus counts. */
function buildMonths(nodes) {
  const stamps = (nodes || []).map((n) => n.timestamp && dayOf(n.timestamp)).filter(Boolean).sort();
  if (!stamps.length) return [];
  const counts = new Map();
  for (const s of stamps) {
    const key = s.slice(0, 7);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const [y0, m0] = stamps[0].slice(0, 7).split('-').map(Number);
  const [y1, m1] = stamps[stamps.length - 1].slice(0, 7).split('-').map(Number);
  const out = [];
  for (let i = y0 * 12 + (m0 - 1); i <= y1 * 12 + (m1 - 1); i++) {
    const key = `${String(Math.floor(i / 12)).padStart(4, '0')}-${String((i % 12) + 1).padStart(2, '0')}`;
    out.push({ key, count: counts.get(key) || 0 });
  }
  return out;
}

export function createTimelinePanel() {
  const node = el('div.zk-timeline');
  const toggle = el('button.zk-timeline-toggle', { type: 'button', title: 'timeline scrubber', text: '⏱ timeline' });
  const body = el('div.zk-panel.zk-timeline-body');

  const chart = el('div.zk-timeline-chart', { role: 'group', 'aria-label': 'notes per month' });
  const dateLabel = el('span.zk-timeline-date', { text: '—' });
  const playBtn = el('button.zk-timeline-play', { type: 'button', text: '▶', title: 'play' });
  const range = el('input.zk-timeline-range', { type: 'range', min: 0, max: 0, step: 1, value: 0 });

  const enabledBox = checkbox({
    label: 'enabled',
    checked: state.timeline.enabled,
    onChange: (v) => setState({ timeline: { enabled: v } }),
  });
  const ageBox = checkbox({
    label: 'colour by age',
    checked: state.timeline.colorByAge,
    onChange: (v) => setState({ timeline: { colorByAge: v } }),
  });

  body.append(
    chart,
    el('div.zk-timeline-controls', {}, playBtn, range, dateLabel),
    el('div.zk-timeline-opts', {}, enabledBox, ageBox),
  );
  node.append(toggle, body);

  let months = [];
  let raf = 0;
  let lastFrame = 0;
  let acc = 0;

  /** Index of the month the cursor sits in; last month when unset/out of range. */
  function cursorIndex() {
    const cur = state.timeline.cursor;
    if (!cur || !months.length) return Math.max(0, months.length - 1);
    const key = cur.slice(0, 7);
    const i = months.findIndex((m) => m.key === key);
    return i === -1 ? months.length - 1 : i;
  }

  function setCursorTo(index) {
    if (!months.length) return;
    const i = Math.min(months.length - 1, Math.max(0, index));
    setState({ timeline: { cursor: monthEnd(months[i].key) } });
  }

  // Hand-drawn SVG: bars share the panel width, height is sqrt-scaled so a
  // single busy month does not flatten every other one into nothing.
  function renderChart() {
    if (!months.length) {
      chart.innerHTML = '<div class="zk-timeline-empty">no timestamps</div>';
      return;
    }
    const W = 100;
    const H = 28;
    const max = Math.max(...months.map((m) => m.count), 1);
    const bw = W / months.length;
    const active = cursorIndex();
    const bars = months
      .map((m, i) => {
        const h = m.count ? Math.max(1.5, (Math.sqrt(m.count) / Math.sqrt(max)) * H) : 0.6;
        const cls = i <= active ? 'zk-bar on' : 'zk-bar';
        return `<rect class="${cls}" data-index="${i}" x="${(i * bw).toFixed(3)}" y="${(H - h).toFixed(3)}"
          width="${Math.max(bw - 0.15, 0.2).toFixed(3)}" height="${h.toFixed(3)}"><title>${m.key}: ${m.count}</title></rect>`;
      })
      .join('');
    chart.innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="zk-timeline-svg">${bars}</svg>`;
  }

  function syncControls() {
    range.max = String(Math.max(0, months.length - 1));
    range.value = String(cursorIndex());
    dateLabel.textContent = state.timeline.cursor || '—';
    node.classList.toggle('inactive', !state.timeline.enabled);
    enabledBox.setChecked(state.timeline.enabled);
    ageBox.setChecked(state.timeline.colorByAge);
    playBtn.textContent = raf ? '❚❚' : '▶';
    playBtn.title = raf ? 'pause' : 'play';
  }

  function refresh() {
    renderChart();
    syncControls();
  }

  // Hot-reload replaces the model; keep the user where they were if the new
  // range still contains that month, otherwise fall back to "show everything".
  function rebuild() {
    months = buildMonths(state.model?.nodes);
    const cur = state.timeline.cursor;
    const stillValid = cur && months.some((m) => m.key === cur.slice(0, 7));
    if (months.length && !stillValid) setCursorTo(months.length - 1);
    else refresh();
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
    acc = 0;
    syncControls();
  }

  // rAF's timestamp argument is the animation clock — no Date.now() anywhere.
  function frame(t) {
    if (lastFrame) acc += t - lastFrame;
    lastFrame = t;
    while (acc >= STEP_MS) {
      acc -= STEP_MS;
      const i = cursorIndex();
      if (i >= months.length - 1) {
        stop();
        return;
      }
      setCursorTo(i + 1);
    }
    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (!months.length || raf) return;
    // Playing a hidden cursor looks broken, so turn the filter on with it.
    if (!state.timeline.enabled) setState({ timeline: { enabled: true } });
    // Restart from the beginning once the playhead has reached the end.
    if (cursorIndex() >= months.length - 1) setCursorTo(0);
    raf = requestAnimationFrame(frame);
    syncControls();
  }

  return {
    id: 'timeline',
    mount(root) {
      root.appendChild(node);

      toggle.addEventListener('click', () => {
        const open = node.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
        if (!open) stop();
      });
      toggle.setAttribute('aria-expanded', 'false');

      playBtn.addEventListener('click', () => (raf ? stop() : play()));
      range.addEventListener('input', () => {
        stop();
        setCursorTo(Number(range.value));
      });
      chart.addEventListener('click', (e) => {
        const bar = e.target.closest('[data-index]');
        if (!bar) return;
        stop();
        setCursorTo(Number(bar.dataset.index));
      });

      subscribe((keys) => {
        if (keys.has('model')) rebuild();
        else if (keys.has('timeline')) refresh();
      });

      refresh();
    },
  };
}
