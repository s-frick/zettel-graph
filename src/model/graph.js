// Derived graph model: adjacency, degrees, folder/bundle facets, and the
// filtered "visible" subgraph every view renders from.
//
// Shared infrastructure — read by all views/panels. Feature-specific derivations
// live in sibling modules (tags.js for B5, clusters.js for B6) and are wired in
// here through explicit hooks so those agents never edit this file.

import { augmentWithTagNodes } from './tags.js';
import { assignClusters } from './clusters.js';

/** Bundle prefix of an id: `knowledge/gotchas/x.md` -> `knowledge`. */
export function bundleOf(id) {
  const i = id.indexOf('/');
  return i === -1 ? '' : id.slice(0, i);
}

/** Directory of an id: `knowledge/gotchas/x.md` -> `knowledge/gotchas`. */
export function folderOf(id) {
  const i = id.lastIndexOf('/');
  return i === -1 ? '' : id.slice(0, i);
}

const idOf = (endpoint) => (endpoint && endpoint.id != null ? endpoint.id : endpoint);
export { idOf };

/**
 * Build the derived model from a raw { nodes, links } payload.
 * The returned object is treated as immutable by consumers.
 */
export function buildModel(raw) {
  const nodes = (raw.nodes || []).map((n) => ({
    ...n,
    bundle: n.bundle ?? bundleOf(n.id),
    folder: n.folder ?? folderOf(n.id),
  }));
  const links = (raw.links || []).map((l) => ({ source: idOf(l.source), target: idOf(l.target) }));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outbound = new Map(nodes.map((n) => [n.id, new Set()]));
  const inbound = new Map(nodes.map((n) => [n.id, new Set()]));

  for (const { source, target } of links) {
    if (!outbound.has(source)) outbound.set(source, new Set());
    if (!inbound.has(target)) inbound.set(target, new Set());
    outbound.get(source).add(target);
    inbound.get(target).add(source);
  }

  const adjacency = new Map();
  for (const n of nodes) {
    const set = new Set([...(outbound.get(n.id) || []), ...(inbound.get(n.id) || [])]);
    adjacency.set(n.id, set);
  }

  const degree = new Map(nodes.map((n) => [n.id, adjacency.get(n.id).size]));
  for (const n of nodes) {
    n.degree = degree.get(n.id) || 0;
    n.inDegree = (inbound.get(n.id) || new Set()).size;
    n.outDegree = (outbound.get(n.id) || new Set()).size;
  }

  const model = {
    nodes,
    links,
    byId,
    adjacency,
    inbound,
    outbound,
    degree,
    types: facet(nodes, (n) => n.type),
    folders: facet(nodes, (n) => n.folder),
    bundles: facet(nodes, (n) => n.bundle),
    tags: facetMulti(nodes, (n) => n.tags || []),
  };

  // B6 hook: writes `node.cluster` (string) in place. No-op until implemented.
  assignClusters(model);

  return model;
}

function facet(nodes, pick) {
  const counts = new Map();
  for (const n of nodes) {
    const v = pick(n);
    if (v == null || v === '') continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function facetMulti(nodes, pick) {
  const counts = new Map();
  for (const n of nodes) {
    for (const v of pick(n)) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Ids reachable from `startId` within `depth` hops (undirected), incl. start. */
export function neighborsWithin(model, startId, depth = 1) {
  const seen = new Set([startId]);
  let frontier = [startId];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const id of frontier) {
      for (const nb of model.adjacency.get(id) || []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return seen;
}

/** Nodes with no inbound AND no outbound edge. */
export function orphanIds(model) {
  return model.nodes.filter((n) => (model.degree.get(n.id) || 0) === 0).map((n) => n.id);
}

/**
 * Apply state (filters, local-graph, timeline) to the model and return the
 * subgraph every view should render. Pure — never mutates the model.
 */
export function visibleGraph(model, state) {
  if (!model) return { nodes: [], links: [] };
  const f = state.filters;
  const keep = new Set();

  for (const n of model.nodes) {
    if (n.ghost && !f.showGhosts) continue;
    if (f.types && !f.types.has(n.type)) continue;
    if (f.bundles && !f.bundles.has(n.bundle)) continue;
    if (f.folders && !f.folders.has(n.folder)) continue;
    if (f.tags && !(n.tags || []).some((t) => f.tags.has(t))) continue;
    if (!f.showOrphans && (model.degree.get(n.id) || 0) === 0) continue;
    if (state.timeline.enabled && state.timeline.cursor && n.timestamp &&
        String(n.timestamp).slice(0, 10) > state.timeline.cursor) continue;
    keep.add(n.id);
  }

  // Local-graph mode narrows to a neighbourhood of the selection (A4).
  if (state.localGraph.enabled && state.selectedId) {
    const near = neighborsWithin(model, state.selectedId, state.localGraph.depth);
    for (const id of [...keep]) if (!near.has(id)) keep.delete(id);
  }

  let nodes = model.nodes.filter((n) => keep.has(n.id));
  let links = model.links.filter((l) => keep.has(l.source) && keep.has(l.target));

  // B5 hook: optionally inject tag pseudo-nodes + node→tag edges.
  if (f.showTagNodes) ({ nodes, links } = augmentWithTagNodes(nodes, links));

  return { nodes, links };
}
