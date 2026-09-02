import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveInternalLink, wireInternalLinks } from '../src/internal-links.js';

test('resolves bundle-absolute markdown links to graph node ids', () => {
  const ids = new Set([
    'criteria/opportunity-review-list.md',
    'opportunities/field-sales/order-snap.md',
  ]);

  assert.deepEqual(
    resolveInternalLink(
      '/opportunities/field-sales/order-snap.md',
      'criteria/opportunity-review-list.md',
      ids,
    ),
    { id: 'opportunities/field-sales/order-snap.md', anchor: '' },
  );
});

test('preserves anchors while resolving internal markdown links', () => {
  const ids = new Set(['research/scan.md']);

  assert.deepEqual(resolveInternalLink('/research/scan.md#findings', 'index.md', ids), {
    id: 'research/scan.md',
    anchor: 'findings',
  });
});

test('leaves external and unknown links alone', () => {
  const ids = new Set(['components/browser-app.md']);

  assert.equal(resolveInternalLink('https://example.com/note.md', 'index.md', ids), null);
  assert.equal(resolveInternalLink('/missing.md', 'index.md', ids), null);
});

test('wires rendered markdown links into the detail-panel navigation', () => {
  const link = {
    href: '/opportunities/field-sales/order-snap.md',
    dataset: {},
    getAttribute(name) {
      return name === 'href' ? this.href : null;
    },
  };
  const container = {
    querySelectorAll(selector) {
      assert.equal(selector, '.node-detail-body a[href]');
      return [link];
    },
  };
  const model = {
    byId: new Map([
      ['criteria/opportunity-review-list.md', {}],
      ['opportunities/field-sales/order-snap.md', {}],
    ]),
  };

  wireInternalLinks(container, 'criteria/opportunity-review-list.md', model);

  assert.equal(link.href, '#');
  assert.equal(link.dataset.goto, 'opportunities/field-sales/order-snap.md');
});
