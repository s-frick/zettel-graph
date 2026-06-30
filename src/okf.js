// OKF (Open Knowledge Format) bundle -> force-graph {nodes, links}.
//
// Spec: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
//   - Each non-reserved .md file is a node; `id` = bundle-relative posix path.
//   - Markdown links to .md files are directed, untyped edges.
//   - `index.md` / `log.md` are reserved navigation files, not nodes.
//   - Links to not-yet-written targets are tolerated -> rendered as ghost nodes.
//   - Node grouping/colour comes from the required frontmatter `type`.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

// Files that are never concept nodes:
//   - index.md / log.md: OKF-reserved navigation files (spec §6–7).
//   - AGENTS.md / CLAUDE.md: agent/schema-layer docs (llm-wiki), not knowledge.
//   - README.md: bundle docs, not a concept.
const NON_NODES = new Set(['index.md', 'log.md', 'AGENTS.md', 'CLAUDE.md', 'README.md']);
// Dependency/build dirs are full of unrelated .md (READMEs); never treat them
// as part of the bundle. Dotfiles (e.g. .git) are skipped separately.
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', 'vendor']);
const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory() && IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

// id = posix path relative to the bundle root (stable across platforms).
function toId(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

// Resolve an OKF markdown link target to a node id, or null if not a .md link.
function resolveLink(href, fromId) {
  const clean = href.split(/[?#]/)[0].trim();
  // Skip external links: scheme (https:, mailto:) or protocol-relative (//host).
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith('//')) return null;
  if (!clean.endsWith('.md')) return null;
  if (clean.startsWith('/')) return clean.replace(/^\/+/, ''); // bundle-relative
  const fromDir = path.posix.dirname(fromId);
  return path.posix.normalize(path.posix.join(fromDir, clean)); // relative
}

function firstParagraph(content) {
  const body = content.replace(/^#\s+.*\n+/, '');
  const m = body.match(/^\s*([^\n#][\s\S]*?)(?=\n\n|$)/);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
}

export function buildGraph(bundleDir) {
  const root = path.resolve(bundleDir);
  const files = walk(root).filter((f) => !NON_NODES.has(path.basename(f)));

  const nodes = new Map();
  const bodies = new Map();

  // Pass 1: nodes.
  for (const file of files) {
    const id = toId(root, file);
    const raw = fs.readFileSync(file, 'utf8');
    const { data: fm, content } = matter(raw);
    bodies.set(id, content);
    const h1 = content.match(/^#\s+(.*)$/m);
    nodes.set(id, {
      id,
      title: fm.title || (h1 && h1[1].trim()) || path.basename(id, '.md'),
      type: fm.type || 'Unknown',
      tags: normalizeTags(fm.tags),
      summary: fm.description || firstParagraph(content),
      resource: fm.resource || null,
      timestamp: fm.timestamp || null,
      raw,
      ghost: false,
    });
  }

  // Pass 2: links (directed, deduped). Unknown targets become ghost nodes.
  const links = [];
  const seen = new Set();
  for (const [id, content] of bodies) {
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(content)) !== null) {
      const target = resolveLink(m[1], id);
      if (!target || target === id) continue;
      if (NON_NODES.has(path.basename(target))) continue;
      if (!nodes.has(target)) {
        nodes.set(target, {
          id: target,
          title: path.basename(target, '.md'),
          type: '_missing',
          tags: [],
          summary: '(not yet written)',
          resource: null,
          timestamp: null,
          raw: '',
          ghost: true,
        });
      }
      const key = `${id} ${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source: id, target });
    }
  }

  return { nodes: [...nodes.values()], links };
}
