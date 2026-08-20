// B4 — timeline scrubber over frontmatter `timestamp`.
//
// OWNER: agent B4. Contract: return { id, mount(root) }. A bottom bar with a
// date slider + play/pause that animates graph growth by setting
// state.timeline.cursor (ISO YYYY-MM-DD); visibleGraph() already hides newer
// nodes while state.timeline.enabled is true. Also expose the "colour by age"
// toggle — call setAgeRange(min, max) from ../styling.js once per model so the
// ramp spans the real date range. Show a histogram of notes per month.

export function createTimelinePanel() {
  return { id: 'timeline', mount() {} };
}
