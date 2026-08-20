// B1 — pure lint checks over the derived model. OWNER: agent B1.
//
// Contract: runLint(model) -> Array<{ id, label, description, severity, items }>
// where items are { id, title, detail } so the view can render + link them.
// Checks to implement (mirrors knowledge/AGENTS.md §4):
//   orphans, ghost targets ranked by inbound count, notes missing `description`,
//   notes missing `type`, stale notes (timestamp older than N months),
//   notes absent from index.md, dead relative links.

export function runLint() {
  return [];
}
