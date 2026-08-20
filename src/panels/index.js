// Panel registry. Panels are overlays that coexist with whichever view is
// active. Each exposes { id, mount(root) } and wires itself up via
// subscribe() from ../state.js.

import { createSearchPanel } from './search.js';
import { createPreviewPanel } from './preview.js';
import { createDetailPanel } from './detail.js';
import { createLegendPanel } from './legend.js';
import { createForcesPanel } from './forces.js';
import { createFiltersPanel } from './filters.js';
import { createLocalGraphPanel } from './local-graph.js';
import { createTimelinePanel } from './timeline.js';

export function createPanels({ onGoto }) {
  return [
    createSearchPanel({ onGoto }),
    createPreviewPanel(),
    createDetailPanel(),
    createLegendPanel(),
    createFiltersPanel(),
    createForcesPanel(),
    createLocalGraphPanel(),
    createTimelinePanel(),
  ];
}
