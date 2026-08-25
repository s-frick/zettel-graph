// Top-left search box. Ranks nodes, dims non-matches via state.search, and
// flies the graph view to a committed hit.
//
// Hybrid ranking: lexical matches render instantly; when embeddings are
// available (dev server), semantically similar notes that the tokens missed
// are appended below them, marked with ≈.

import { state, setState, subscribe } from '../state.js';
import { semanticAvailable, queryScores } from '../model/semantic.js';
import { typeLabel } from '../markdown.js';
import { escapeHtml, el } from '../ui/dom.js';

const MAX_ROWS = 50;

export function createSearchPanel({ onGoto }) {
  const box = el('div.search-box', {
    html: `<input class="search-input" type="text" placeholder="Search notes…  ( / )" spellcheck="false" />
           <div class="search-results"></div>`,
  });
  const input = box.querySelector('.search-input');
  const results = box.querySelector('.search-results');
  let hits = [];
  let activeIndex = -1;
  let semIds = new Set(); // ids appended by the semantic pass (render badge)
  let semTimer = null;
  let semToken = 0;
  // Query↔note cosines run lower than note↔note ones on MiniLM; 0.25 keeps
  // paraphrased queries ("make page updates faster" → hot-reload) matching.
  const SEM_MIN_SCORE = 0.25;
  const SEM_MAX_EXTRA = 10;

  const haystack = (n) =>
    [n.title, n.id, typeLabel(n), (n.tags || []).join(' '), n.summary, n.raw]
      .filter(Boolean).join('\n').toLowerCase();

  // Every token must appear (AND); title/tag/type hits outrank body hits.
  function score(n, tokens) {
    const title = (n.title || '').toLowerCase();
    const tags = (n.tags || []).map((t) => t.toLowerCase());
    const type = (n.type || '').toLowerCase();
    const hay = haystack(n);
    let s = 0;
    for (const tok of tokens) {
      if (!hay.includes(tok)) return 0;
      if (title.startsWith(tok)) s += 100;
      else if (title.includes(tok)) s += 50;
      else if (tags.some((t) => t.includes(tok))) s += 20;
      else if (type.includes(tok)) s += 15;
      else s += 5;
    }
    return s;
  }

  function run(query) {
    const tokens = (query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length || !state.model) return clear();
    semIds = new Set();
    hits = state.model.nodes
      .map((n) => ({ n, s: score(n, tokens) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || (a.n.title || '').localeCompare(b.n.title || ''))
      .map((x) => x.n);
    activeIndex = hits.length ? 0 : -1;
    setState({ search: { active: true, query, matchIds: new Set(hits.map((n) => n.id)) } });
    render();
    scheduleSemantic(query.trim());
  }

  // Debounced so we embed the settled query, not every keystroke.
  function scheduleSemantic(query) {
    clearTimeout(semTimer);
    if (!semanticAvailable()) return;
    semTimer = setTimeout(() => runSemantic(query), 250);
  }

  async function runSemantic(query) {
    const token = ++semToken;
    const scores = await queryScores(query);
    // Stale response, or the query was cleared/changed meanwhile: drop it.
    if (!scores || token !== semToken || !state.search.active) return;
    const have = new Set(hits.map((n) => n.id));
    const extra = state.model.nodes
      .filter((n) => !n.ghost && !have.has(n.id) && (scores.get(n.id) || 0) >= SEM_MIN_SCORE)
      .sort((a, b) => scores.get(b.id) - scores.get(a.id))
      .slice(0, SEM_MAX_EXTRA);
    if (!extra.length) return;
    semIds = new Set(extra.map((n) => n.id));
    if (activeIndex === -1) activeIndex = 0;
    hits = [...hits, ...extra];
    setState({ search: { matchIds: new Set(hits.map((n) => n.id)) } });
    render();
  }

  function clear() {
    hits = [];
    activeIndex = -1;
    semIds = new Set();
    semToken++;
    clearTimeout(semTimer);
    setState({ search: { active: false, query: '', matchIds: new Set() } });
    render();
  }

  function render() {
    if (!state.search.active) {
      results.classList.remove('open');
      results.innerHTML = '';
      return;
    }
    if (!hits.length) {
      results.innerHTML = '<div class="search-empty">No matches</div>';
      results.classList.add('open');
      return;
    }
    const rows = hits.slice(0, MAX_ROWS).map((n, i) =>
      `<div class="search-row${i === activeIndex ? ' active' : ''}" data-id="${escapeHtml(n.id)}">
         <span class="search-row-title">${semIds.has(n.id) ? '<span class="search-row-sem" title="semantic match">≈</span> ' : ''}${escapeHtml(n.title || n.id)}</span>
         <span class="search-row-type">${escapeHtml(typeLabel(n))}</span>
       </div>`).join('');
    const more = hits.length > MAX_ROWS ? `<div class="search-empty">+${hits.length - MAX_ROWS} more…</div>` : '';
    results.innerHTML = `<div class="search-count">${hits.length} match${hits.length === 1 ? '' : 'es'}</div>${rows}${more}`;
    results.classList.add('open');
    results.querySelector('.search-row.active')?.scrollIntoView({ block: 'nearest' });
  }

  function goto(i) {
    if (i < 0 || i >= hits.length) return;
    activeIndex = i;
    render();
    setState({ selectedId: hits[i].id });
    onGoto?.(hits[i].id);
  }

  return {
    id: 'search',
    mount(root) {
      root.appendChild(box);
      input.addEventListener('input', (e) => run(e.target.value));
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'ArrowDown') { e.preventDefault(); if (hits.length) { activeIndex = Math.min(activeIndex + 1, hits.length - 1); render(); } }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (hits.length) { activeIndex = Math.max(activeIndex - 1, 0); render(); } }
        else if (e.key === 'Enter') { e.preventDefault(); goto(activeIndex >= 0 ? activeIndex : 0); }
        else if (e.key === 'Escape') {
          e.preventDefault();
          if (input.value) { input.value = ''; clear(); } else input.blur();
        }
      });
      results.addEventListener('click', (e) => {
        const row = e.target.closest('.search-row');
        if (!row) return;
        const idx = hits.findIndex((n) => n.id === row.dataset.id);
        if (idx >= 0) goto(idx);
      });
      document.addEventListener('keydown', (e) => {
        if (e.target === input) return;
        if (e.key === '/' || ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K'))) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      });
      // Re-run after hot-reload (fresh data) or once embeddings finish loading.
      subscribe((keys) => {
        if ((keys.has('model') || keys.has('semantic')) && state.search.active) run(input.value);
      });
    },
  };
}
