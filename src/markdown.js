// Markdown rendering for the preview/detail panels.

import { marked } from 'marked';
import hljs from 'highlight.js';
import { state } from './state.js';

export function stripFrontmatter(md = '') {
  return md.replace(/^---[\s\S]*?\n---\s*/m, '');
}

export function stripLeadingH1(md = '') {
  return md.replace(/^#\s+.*\n+/, '').replace(/^\s+/, '');
}

// Truncating mid-document can cut a fenced block in half, which makes marked
// swallow the rest of the note into one giant code block. Close the fence.
function balanceFences(md) {
  const fences = (md.match(/^```/gm) || []).length;
  return fences % 2 === 0 ? md : md + '\n```';
}

export function renderBody(node, maxChars) {
  let md = stripFrontmatter(node.raw || node.summary || '');
  md = stripLeadingH1(md);
  if (md.length > maxChars) md = balanceFences(md.slice(0, maxChars)) + '\n\n…';
  return marked.parse(md);
}

export function applySyntaxHighlighting(container) {
  // Mermaid sources are diagrams, not code samples — leave them to renderMermaid.
  container.querySelectorAll('pre code:not(.language-mermaid)').forEach((block) => {
    delete block.dataset.highlighted;
    hljs.highlightElement(block);
  });
}

// ---------- mermaid ----------
//
// The library is ~500 kB, so it is imported on first use and only when a note
// actually contains a diagram. Rendering is async and a note can be swapped out
// mid-flight, hence the token check before each DOM write.

let mermaidPromise = null;
let mermaidTheme = null;
let diagramSeq = 0;

function loadMermaid(theme) {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default);
  }
  return mermaidPromise.then((mermaid) => {
    // initialize() is cheap and idempotent; re-run it when the theme flips so
    // an already-loaded instance picks up the new colours.
    if (mermaidTheme !== theme) {
      mermaidTheme = theme;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: theme === 'light' ? 'default' : 'dark',
        fontFamily: 'system-ui, sans-serif',
      });
    }
    return mermaid;
  });
}

/**
 * Replace ```mermaid blocks inside `container` with rendered SVG.
 * Pass a `token` that changes whenever the container's content is replaced;
 * results arriving after a swap are discarded.
 */
export async function renderMermaid(container, token, isCurrent = () => true) {
  const blocks = [...container.querySelectorAll('pre > code.language-mermaid')];
  if (!blocks.length) return;

  // Show the source until the diagram arrives — better than an empty gap.
  const hosts = blocks.map((code) => {
    const host = document.createElement('div');
    host.className = 'zk-mermaid zk-mermaid-pending';
    host.textContent = 'rendering diagram…';
    host.dataset.src = code.textContent;
    code.parentElement.replaceWith(host);
    return host;
  });

  let mermaid;
  try {
    mermaid = await loadMermaid(state.theme);
  } catch (err) {
    for (const h of hosts) failDiagram(h, err);
    return;
  }
  if (!isCurrent(token)) return;

  for (const host of hosts) {
    try {
      const { svg } = await mermaid.render(`zk-diagram-${++diagramSeq}`, host.dataset.src);
      if (!isCurrent(token)) return;
      host.classList.remove('zk-mermaid-pending');
      host.innerHTML = svg;
    } catch (err) {
      failDiagram(host, err);
    }
  }
}

// A diagram with a syntax error must not hide the note's content — fall back to
// the source, which is what the author needs to see anyway.
function failDiagram(host, err) {
  host.classList.remove('zk-mermaid-pending');
  host.classList.add('zk-mermaid-failed');
  const msg = document.createElement('div');
  msg.className = 'zk-mermaid-error';
  msg.textContent = `diagram failed: ${String(err && err.message ? err.message : err).split('\n')[0]}`;
  const pre = document.createElement('pre');
  pre.textContent = host.dataset.src;
  host.replaceChildren(msg, pre);
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
