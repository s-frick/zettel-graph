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

// A tag carried by a single visible note would add a leaf node and no
// information — it groups nothing. Two is the smallest count that clusters.
export const MIN_TAGGED_NOTES = 2;

/**
 * Inject one pseudo-node per shared tag plus a note -> tag edge per usage.
 * Pure: inputs are references into the shared model, so nodes are cloned and
 * fresh arrays are returned.
 */
export function augmentWithTagNodes(nodes, links) {
  const noteIds = new Set(nodes.map((n) => n.id));

  // Which visible notes carry each tag (Set: a note listing a tag twice must
  // not inflate the count or produce a duplicate edge).
  const taggedBy = new Map();
  for (const n of nodes) {
    if (n.isTag) continue; // never build tags-of-tags if we are called twice
    for (const t of n.tags || []) {
      if (!t) continue;
      let set = taggedBy.get(t);
      if (!set) taggedBy.set(t, (set = new Set()));
      set.add(n.id);
    }
  }

  const tagNodes = [];
  const tagLinks = [];
  for (const [name, ids] of taggedBy) {
    if (ids.size < MIN_TAGGED_NOTES) continue;
    const id = TAG_PREFIX + name;
    // A real note whose id happens to look like `tag:foo` would silently
    // swallow every edge we add — skip the tag rather than corrupt the graph.
    if (noteIds.has(id)) continue;
    tagNodes.push({
      id,
      title: '#' + name,
      type: '_tag',
      isTag: true,
      tags: [],
      summary: `${ids.size} notes`,
      ghost: false,
      degree: ids.size,
    });
    for (const noteId of ids) tagLinks.push({ source: noteId, target: id });
  }

  // Degree drives nodeSize(); notes keep their model-wide degree and gain the
  // tag edges we just added, so sizes stay comparable to the untagged view.
  const extra = new Map();
  for (const l of tagLinks) extra.set(l.source, (extra.get(l.source) || 0) + 1);

  const outNodes = nodes.map((n) =>
    extra.has(n.id) ? { ...n, degree: (n.degree || 0) + extra.get(n.id) } : { ...n });

  return { nodes: outNodes.concat(tagNodes), links: links.concat(tagLinks) };
}
