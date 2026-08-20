// B5 — tag pseudo-nodes.
//
// OWNER: agent B5. Called from src/model/graph.js `visibleGraph` when
// `state.filters.showTagNodes` is on. Must stay pure: never mutate the inputs.
//
// Contract:
//   augmentWithTagNodes(nodes, links) -> { nodes, links }
// Tag nodes must use id `tag:<name>`, `type: '_tag'`, `isTag: true` and a
// `title` of `#<name>` so styling/legend/search treat them distinctly.

export const TAG_PREFIX = 'tag:';

export function augmentWithTagNodes(nodes, links) {
  return { nodes, links }; // not implemented yet
}
