// B1 — pure lint checks over the derived model.
//
// Contract: runLint(model) -> Array<{ id, label, description, severity, items }>
// where items are { id, title, detail } so the view can render + link them.
// Mirrors the "Lint" operation described in an OKF bundle's AGENTS.md §4.
//
// Deliberately pure: no DOM, no fetch, and no Date.now(). Determinism matters
// because the dev server re-runs this on every file save — a check whose result
// drifts with wall-clock time would make the dashboard flicker, and an archived
// bundle would report every note as stale.

const MONTHS_STALE = 6;

/** Ghost targets first: they are the bundle's TODO list, not a defect. */
export function runLint(model) {
  if (!model || !model.nodes) return [];
  const real = model.nodes.filter((n) => !n.ghost && !n.isTag);

  return [
    ghostsCheck(model),
    brokenFrontmatterCheck(real),
    missingTypeCheck(real),
    missingDescriptionCheck(real),
    orphansCheck(model, real),
    unreferencedCheck(model, real),
    missingTimestampCheck(real),
    staleCheck(real),
    hubsCheck(model, real),
  ];
}

// ---------- checks ----------

function ghostsCheck(model) {
  const items = model.nodes
    .filter((n) => n.ghost)
    .map((n) => {
      const refs = [...(model.inbound.get(n.id) || [])].sort();
      return {
        // No real note behind a ghost — the view links the referencing notes instead.
        id: null,
        title: n.id,
        detail: `${refs.length} note${refs.length === 1 ? '' : 's'} point here`,
        refs,
      };
    })
    .sort((a, b) => b.refs.length - a.refs.length || a.title.localeCompare(b.title));

  return check('ghosts', 'Ghost targets (TODO)', 'Linked notes that do not exist yet, ranked by how many notes reference them.', 'warn', items);
}

function brokenFrontmatterCheck(nodes) {
  const items = nodes
    .filter((n) => n.invalidFrontmatter)
    .map((n) => item(n, 'YAML frontmatter failed to parse — the note is treated as body-only'));
  return check('broken-frontmatter', 'Broken frontmatter', 'Notes whose YAML block could not be parsed.', 'error', items);
}

function missingTypeCheck(nodes) {
  const items = nodes
    .filter((n) => !n.type || n.type === 'Unknown')
    .map((n) => item(n, '`type` is the only required OKF field'));
  return check('missing-type', 'Missing type', 'Notes without a usable `type` — they cannot be grouped or coloured.', 'error', items);
}

function missingDescriptionCheck(nodes) {
  // node.summary falls back to the first paragraph, so the frontmatter key
  // itself has to be inspected on the raw source.
  const items = nodes
    .filter((n) => !frontmatterHas(n.raw, 'description'))
    .map((n) => item(n, 'no `description` — previews and index.md fall back to the first paragraph'));
  return check('missing-description', 'Missing description', 'Notes without a one-sentence `description` in frontmatter.', 'warn', items);
}

function missingTimestampCheck(nodes) {
  const items = nodes
    .filter((n) => !n.timestamp)
    .map((n) => item(n, 'no `timestamp` — excluded from timeline and staleness checks'));
  return check('missing-timestamp', 'Missing timestamp', 'Notes without a `timestamp` in frontmatter.', 'info', items);
}

function orphansCheck(model, nodes) {
  const items = nodes
    .filter((n) => (model.degree.get(n.id) || 0) === 0)
    .map((n) => item(n, 'no inbound and no outbound links'));
  return check('orphans', 'Orphans', 'Notes that neither link out nor are linked to — invisible in the graph.', 'warn', items);
}

function unreferencedCheck(model, nodes) {
  const items = nodes
    .filter((n) => (n.inDegree || 0) === 0 && (n.outDegree || 0) > 0)
    .map((n) => item(n, `dead end: links out to ${n.outDegree}, nothing links back`));
  return check('unreferenced', 'Unreferenced', 'Notes nobody points at, although they link elsewhere — usually a missing cross-link.', 'warn', items);
}

function staleCheck(nodes) {
  const dated = nodes.filter((n) => day(n.timestamp));
  // Relative to the newest note, not to today: an archived bundle is old as a
  // whole, but its notes are still consistent with each other.
  const newest = dated.reduce((max, n) => (day(n.timestamp) > max ? day(n.timestamp) : max), '');
  const cutoff = newest ? minusMonths(newest, MONTHS_STALE) : null;
  const items = cutoff
    ? dated
        .filter((n) => day(n.timestamp) < cutoff)
        .sort((a, b) => day(a.timestamp).localeCompare(day(b.timestamp)))
        .map((n) => item(n, `${day(n.timestamp)} — more than ${MONTHS_STALE} months behind the newest note (${newest})`))
    : [];
  return check('stale', 'Stale', `Notes older than ${MONTHS_STALE} months relative to the newest note in the bundle.`, 'warn', items);
}

function hubsCheck(model, nodes) {
  const degrees = nodes.map((n) => model.degree.get(n.id) || 0);
  const mean = degrees.reduce((a, b) => a + b, 0) / (degrees.length || 1);
  const variance = degrees.reduce((a, d) => a + (d - mean) ** 2, 0) / (degrees.length || 1);
  const threshold = mean + 2 * Math.sqrt(variance);
  const items = nodes
    .filter((n) => (model.degree.get(n.id) || 0) > threshold)
    .sort((a, b) => (model.degree.get(b.id) || 0) - (model.degree.get(a.id) || 0))
    .map((n) => item(n, `degree ${model.degree.get(n.id)} (mean ${mean.toFixed(1)}, threshold ${threshold.toFixed(1)}) — candidate for a split`));
  return check('hubs', 'Hubs', 'Unusually well-connected notes (degree above mean + 2σ) — often a note that should be split.', 'info', items);
}

// ---------- helpers ----------

function check(id, label, description, severity, items) {
  return { id, label, description, severity, items };
}

function item(node, detail) {
  return { id: node.id, title: node.title || node.id, detail };
}

/** Normalize a timestamp to `YYYY-MM-DD`, or '' if unusable. */
function day(ts) {
  if (!ts) return '';
  const s = ts instanceof Date ? ts.toISOString() : String(ts);
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
}

/** Date string arithmetic only — keeps the check independent of the clock. */
function minusMonths(isoDay, months) {
  const [y, m, d] = isoDay.split('-').map(Number);
  const total = y * 12 + (m - 1) - months;
  const yy = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${String(yy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Does the leading YAML block define `key` with a non-empty value? */
function frontmatterHas(raw, key) {
  if (!raw) return false;
  const m = String(raw).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return false;
  const re = new RegExp(`^${key}\\s*:\\s*(.*)$`, 'm');
  const hit = m[1].match(re);
  return !!hit && hit[1].trim() !== '';
}
