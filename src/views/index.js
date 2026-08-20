// View registry. Views are mutually exclusive and own the main canvas area.
// Panels (search, detail, filters, …) live on top and are registered separately.

import { createGraphView } from './graph.js';
import { createHierarchyView } from './hierarchy.js';
import { createMatrixView } from './matrix.js';
import { createLintView } from './lint.js';

export const VIEW_FACTORIES = {
  graph: createGraphView,
  hierarchy: createHierarchyView,
  matrix: createMatrixView,
  lint: createLintView,
};

export const VIEW_ORDER = ['graph', 'hierarchy', 'matrix', 'lint'];
