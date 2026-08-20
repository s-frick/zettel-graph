// Markdown rendering for the preview/detail panels.

import { marked } from 'marked';
import hljs from 'highlight.js';

export function stripFrontmatter(md = '') {
  return md.replace(/^---[\s\S]*?\n---\s*/m, '');
}

export function stripLeadingH1(md = '') {
  return md.replace(/^#\s+.*\n+/, '').replace(/^\s+/, '');
}

export function renderBody(node, maxChars) {
  let md = stripFrontmatter(node.raw || node.summary || '');
  md = stripLeadingH1(md);
  if (md.length > maxChars) md = md.slice(0, maxChars) + '\n\n…';
  return marked.parse(md);
}

export function applySyntaxHighlighting(container) {
  container.querySelectorAll('pre code').forEach((block) => {
    delete block.dataset.highlighted;
    hljs.highlightElement(block);
  });
}

export function typeLabel(node) {
  if (node.type === '_missing') return 'missing';
  if (node.type === '_tag') return 'tag';
  return node.type;
}

export function metaLine(node) {
  const parts = [];
  if (node.type && node.type !== '_missing') parts.push(typeLabel(node));
  parts.push(...(node.tags || []).map((t) => `#${t}`));
  return parts.join('  ·  ');
}
