// B6 — community detection (cluster colouring).
//
// OWNER: agent B6. Called once per model build from src/model/graph.js.
// Contract: assign a stable `cluster` string to every node, in place, and set
// `model.clusters` to a sorted [clusterId, count][] facet (like model.types) so
// the legend and filter panel can list them. Must be deterministic — no
// Math.random(), no Date.now() — otherwise colours flip on every hot-reload.
//
// Algorithm: Louvain modularity optimisation over the undirected, unweighted
// link graph. Determinism comes from a sorted node ordering plus a fixed-seed
// PRNG for the visiting order, so identical input always yields identical ids.

const ISOLATED = '(isolated)';
const FALLBACK = 'c0';
const SEED = 0x5eed1e; // fixed: the visiting order must not vary between runs

export function assignClusters(model) {
  try {
    cluster(model);
  } catch (err) {
    // The model build is on the critical path — degrade to one cluster rather
    // than taking the whole app down.
    console.warn('[clusters] community detection failed, falling back', err);
    for (const n of model.nodes) n.cluster = FALLBACK;
    model.clusters = model.nodes.length ? [[FALLBACK, model.nodes.length]] : [];
  }
}

function cluster(model) {
  // Sorted ids give every downstream tie-break a stable frame of reference.
  const ids = model.nodes.map((n) => n.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const active = ids.filter((id) => (model.adjacency.get(id) || EMPTY).size > 0);
  const index = new Map(active.map((id, i) => [id, i]));

  const graph = baseGraph(model, active, index);
  const membership = louvain(graph);
  const label = nameClusters(model, active, membership);

  for (const n of model.nodes) {
    const i = index.get(n.id);
    n.cluster = i === undefined ? ISOLATED : label.get(membership[i]);
  }
  model.clusters = facet(model.nodes);
}

const EMPTY = new Set();

/** Level-0 graph: undirected, unweighted, deduped, self-loops dropped. */
function baseGraph(model, active, index) {
  const n = active.length;
  const adj = Array.from({ length: n }, () => []);
  const k = new Float64Array(n);
  const self = new Float64Array(n);
  let m = 0;

  for (let i = 0; i < n; i++) {
    // adjacency is already the undirected union of in/out edges, so each
    // neighbour appears once and each pair is seen twice (i<j filters it).
    for (const nb of model.adjacency.get(active[i]) || EMPTY) {
      const j = index.get(nb);
      if (j === undefined || j <= i) continue;
      adj[i].push(j, 1);
      adj[j].push(i, 1);
      k[i] += 1;
      k[j] += 1;
      m += 1;
    }
  }
  return { n, adj, k, self, m };
}

/** Repeated local-moving + aggregation until modularity stops improving. */
function louvain(graph) {
  let g = graph;
  // Maps original node -> community at the current level.
  let membership = new Int32Array(g.n).map((_, i) => i);
  if (!g.m) return membership;

  for (let level = 0; level < 20; level++) {
    const local = localMoving(g);
    if (!local.moved) break;
    const { labels, count } = renumber(local.community);
    for (let i = 0; i < membership.length; i++) membership[i] = labels[membership[i]];
    if (count === g.n) break; // nothing collapsed — no further gain possible
    g = aggregate(g, labels, count);
  }
  return membership;
}

/** Phase 1: greedily move nodes into the neighbouring community that gains most. */
function localMoving(g) {
  const community = new Int32Array(g.n).map((_, i) => i);
  const tot = new Float64Array(g.n);
  for (let i = 0; i < g.n; i++) tot[i] = g.k[i] + 2 * g.self[i];

  const order = shuffled(g.n, SEED);
  const twoM = 2 * g.m;
  const weights = new Float64Array(g.n);
  const touched = [];
  let moved = false;

  for (let pass = 0; pass < 50; pass++) {
    let passMoved = false;
    for (const i of order) {
      const cur = community[i];
      const ki = g.k[i] + 2 * g.self[i];

      touched.length = 0;
      const nbrs = g.adj[i];
      for (let p = 0; p < nbrs.length; p += 2) {
        const c = community[nbrs[p]];
        if (weights[c] === 0) touched.push(c);
        weights[c] += nbrs[p + 1];
      }
      if (weights[cur] === 0) touched.push(cur);

      tot[cur] -= ki;
      let best = cur;
      let bestGain = weights[cur] - (tot[cur] * ki) / twoM;
      // Ascending community ids keep ties resolved the same way every run.
      for (const c of touched.sort(numeric)) {
        if (c === cur) continue;
        const gain = weights[c] - (tot[c] * ki) / twoM;
        if (gain > bestGain + 1e-12) {
          bestGain = gain;
          best = c;
        }
      }
      tot[best] += ki;
      community[i] = best;
      if (best !== cur) {
        moved = true;
        passMoved = true;
      }
      for (const c of touched) weights[c] = 0;
    }
    if (!passMoved) break;
  }
  return { community, moved };
}

const numeric = (a, b) => a - b;

/**
 * Compact community labels to 0..count-1 in order of first appearance and
 * return them per node index (not per raw label), which is what both the
 * membership remap and the aggregation step index by.
 */
function renumber(community) {
  const seen = new Int32Array(community.length).fill(-1);
  const labels = new Int32Array(community.length);
  let count = 0;
  for (let i = 0; i < community.length; i++) {
    const raw = community[i];
    if (seen[raw] === -1) seen[raw] = count++;
    labels[i] = seen[raw];
  }
  return { labels, count };
}

/** Phase 2: collapse each community into a single weighted super-node. */
function aggregate(g, labels, count) {
  const acc = Array.from({ length: count }, () => new Map());
  const self = new Float64Array(count);
  const k = new Float64Array(count);

  for (let i = 0; i < g.n; i++) {
    const ci = labels[i];
    self[ci] += g.self[i];
    const nbrs = g.adj[i];
    for (let p = 0; p < nbrs.length; p += 2) {
      const j = nbrs[p];
      const w = nbrs[p + 1];
      const cj = labels[j];
      if (ci === cj) {
        if (i < j) self[ci] += w; // each internal pair is stored twice
      } else {
        // Cross edges are stored at both endpoints, so this fills both
        // directions of the aggregated adjacency exactly once each.
        acc[ci].set(cj, (acc[ci].get(cj) || 0) + w);
      }
    }
  }

  const adj = Array.from({ length: count }, () => []);
  for (let c = 0; c < count; c++) {
    for (const [d, w] of [...acc[c].entries()].sort((a, b) => a[0] - b[0])) {
      adj[c].push(d, w);
      k[c] += w;
    }
  }
  // Total weight = internal weight + half the (doubly stored) cross weight.
  let m = 0;
  for (let c = 0; c < count; c++) m += self[c] + k[c] / 2;
  return { n: count, adj, k, self, m };
}

/** Deterministic visiting order: sorted indices shuffled by a seeded PRNG. */
function shuffled(n, seed) {
  const order = Array.from({ length: n }, (_, i) => i);
  const rand = mulberry32(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = order[i];
    order[i] = order[j];
    order[j] = t;
  }
  return order;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Human-readable ids: each cluster is named after the folder of its
 * highest-degree member, so the legend stays recognisable across reloads.
 */
function nameClusters(model, active, membership) {
  const members = new Map();
  for (let i = 0; i < active.length; i++) {
    const c = membership[i];
    if (!members.has(c)) members.set(c, []);
    members.get(c).push(active[i]);
  }

  // Largest first, then by hub id — both are input-derived, hence stable.
  const ordered = [...members.entries()].sort((a, b) => b[1].length - a[1].length || cmp(a[1][0], b[1][0]));
  const used = new Map();
  const label = new Map();

  for (const [c, ids] of ordered) {
    let hub = ids[0];
    for (const id of ids) {
      const d = model.degree.get(id) || 0;
      // ids are pre-sorted, so ">" keeps the alphabetically first on a tie.
      if (d > (model.degree.get(hub) || 0)) hub = id;
    }
    const base = leaf(model.byId.get(hub)) || 'cluster';
    const seen = (used.get(base) || 0) + 1;
    used.set(base, seen);
    label.set(c, seen === 1 ? base : `${base}-${seen}`);
  }
  return label;
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Last path segment of a node's folder: `knowledge/gotchas` -> `gotchas`. */
function leaf(node) {
  const folder = (node && node.folder) || '';
  if (!folder) return 'root';
  return folder.slice(folder.lastIndexOf('/') + 1) || 'root';
}

function facet(nodes) {
  const counts = new Map();
  for (const n of nodes) counts.set(n.cluster, (counts.get(n.cluster) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
