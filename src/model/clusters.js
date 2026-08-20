// B6 — community detection (cluster colouring).
//
// OWNER: agent B6. Called once per model build from src/model/graph.js.
// Contract: assign a stable `cluster` string to every node, in place, and set
// `model.clusters` to a sorted [clusterId, count][] facet (like model.types) so
// the legend and filter panel can list them. Must be deterministic — no
// Math.random(), no Date.now() — otherwise colours flip on every hot-reload.

export function assignClusters(model) {
  for (const n of model.nodes) n.cluster = n.cluster ?? 'c0';
  model.clusters = [['c0', model.nodes.length]];
}
