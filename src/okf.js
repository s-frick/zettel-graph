// OKF (Open Knowledge Format) bundle -> force-graph {nodes, links}.
//
// Spec: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
//   - Each non-reserved .md file is a node; `id` = bundle-relative posix path.
//   - Markdown links to .md files are directed, untyped edges.
//   - `index.md` / `log.md` are reserved navigation files, not nodes.
//   - Links to not-yet-written targets are tolerated -> rendered as ghost nodes.
//   - Node grouping/colour comes from the required frontmatter `type`.
//
// Several sibling bundles can be loaded at once (`buildGraph([a, b])`). Ids are
// then relative to the deepest common ancestor of the inputs, so cross-bundle
// `../../other-bundle/note.md` links normalise into real ids instead of
// escaping the root. A single bundle keeps unprefixed, bundle-relative ids.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

// Files that are never concept nodes:
//   - index.md / log.md: OKF-reserved navigation files (spec §6–7).
//   - AGENTS.md / CLAUDE.md: agent/schema-layer docs (llm-wiki), not knowledge.
//   - README.md: bundle docs, not a concept.
const NON_NODES = new Set(['index.md', 'log.md', 'AGENTS.md', 'CLAUDE.md', 'README.md']);
// Dependency/build dirs are full of unrelated .md (READMEs); never treat them
// as part of the bundle. `archive/` holds retired notes that would otherwise
// dominate a planning graph. Dotfiles (e.g. .git) are skipped separately.
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', 'vendor', 'archive']);
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

// id = posix path relative to the graph root (stable across platforms).
function toId(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

// Deepest directory containing every input bundle. Falls back to the
// filesystem root when the bundles live on unrelated paths.
function commonAncestor(dirs) {
  const parts = dirs.map((d) => d.split(path.sep));
  const shared = [];
  for (let i = 0; i < parts[0].length; i++) {
    const seg = parts[0][i];
    if (!parts.every((p) => p[i] === seg)) break;
    shared.push(seg);
  }
  return shared.join(path.sep) || path.sep;
}

// Minimal glob -> RegExp: `**` spans directories, `*`/`?` stay inside one
// segment. Deliberately tiny — --exclude takes plain directory names far more
// often than real globs, and a dependency for that would be overkill.
function globToRegExp(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        i++;
        if (pattern[i + 1] === '/') {
          i++;
          out += '(?:.*/)?';
        } else {
          out += '.*';
        }
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') {
      out += '[^/]';
    } else {
      out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

// Patterns are matched against root-relative ids. Every ancestor prefix is
// tested too, so naming a directory drops the whole subtree below it.
function makeExcluder(patterns, root) {
  const normalized = patterns
    .map((p) => String(p).trim())
    .filter(Boolean)
    .map((p) => (path.isAbsolute(p) ? toId(root, path.resolve(p)) : p))
    .map((p) => p.replace(/^\.\//, '').replace(/\/+$/, ''));
  if (!normalized.length) return () => false;
  const res = normalized.map(globToRegExp);
  return (id) => {
    const parts = id.split('/');
    for (let i = 1; i <= parts.length; i++) {
      if (res.some((r) => r.test(parts.slice(0, i).join('/')))) return true;
    }
    return false;
  };
}

// Resolve an OKF markdown link target to a root-relative node id, or null if it
// is not an in-graph .md link. `prefix` is the source node's bundle prefix
// ('' for a single bundle) and anchors bundle-absolute `/`-links.
function resolveLink(href, fromId, prefix = '') {
  const clean = href.split(/[?#]/)[0].trim();
  // Skip external links: scheme (https:, mailto:) or protocol-relative (//host).
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith('//')) return null;
  if (!clean.endsWith('.md')) return null;
  if (clean.startsWith('/')) {
    const rel = clean.replace(/^\/+/, ''); // bundle-relative
    return prefix ? path.posix.join(prefix, rel) : rel;
  }
  const fromDir = path.posix.dirname(fromId);
  return path.posix.normalize(path.posix.join(fromDir, clean)); // relative
}

function firstParagraph(content) {
  const body = content.replace(/^#\s+.*\n+/, '');
  const m = body.match(/^\s*([^\n#][\s\S]*?)(?=\n\n|$)/);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

// YAML turns an unquoted `timestamp: 2026-06-30` into a JS Date, so the field's
// type depended on whether the graph had been through JSON.stringify yet: the
// browser saw an ISO string, any direct Node consumer saw a Date whose
// String() is "Tue Jun 30 …" — and every date comparison in the app slices the
// first 10 chars. Pin it to a plain YYYY-MM-DD string here instead.
function normalizeTimestamp(ts) {
  if (!ts) return null;
  if (ts instanceof Date) {
    return Number.isNaN(ts.getTime()) ? null : ts.toISOString().slice(0, 10);
  }
  const s = String(ts).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : s;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
}

/**
 * @param {string|string[]} bundleDirs one or more OKF bundle directories
 * @param {{exclude?: string[]}} [options] glob/directory patterns to skip
 */
export function buildGraph(bundleDirs, options = {}) {
  const dirs = (Array.isArray(bundleDirs) ? bundleDirs : [bundleDirs]).map((d) => path.resolve(d));
  // One bundle keeps its own root, so ids stay unprefixed and everything
  // written against the single-bundle behaviour keeps working.
  const root = dirs.length === 1 ? dirs[0] : commonAncestor(dirs);
  const isExcluded = makeExcluder(options.exclude || [], root);
  const bundles = dirs.map((dir) => ({
    dir,
    prefix: toId(root, dir), // '' in single-bundle mode
    name: toId(root, dir) || path.basename(dir),
  }));

  // Which bundle an id belongs to. This membership test is what keeps links
  // into ordinary repo files (../../backend/docs/x.md) out of the graph.
  const bundleOf = (id) => {
    if (id === '..' || id.startsWith('../')) return null; // escaped the root
    for (const b of bundles) {
      if (!b.prefix) return b; // single bundle: the root IS the bundle
      if (id === b.prefix || id.startsWith(`${b.prefix}/`)) return b;
    }
    return null;
  };

  const nodes = new Map();
  const bodies = new Map();
  const prefixes = new Map(); // node id -> bundle prefix, anchors `/`-links

  // Pass 1: nodes. Bundles may overlap (nested dirs), so dedupe on id.
  const warnings = [];
  for (const bundle of bundles) {
    for (const file of walk(bundle.dir)) {
      if (NON_NODES.has(path.basename(file))) continue;
      const id = toId(root, file);
      if (nodes.has(id) || isExcluded(id)) continue;
      const raw = fs.readFileSync(file, 'utf8');
      // A single note with broken YAML must never take the whole bundle down;
      // fall back to treating the file as body-only and surface a warning.
      let fm = {};
      let content = raw;
      let invalid = false;
      try {
        ({ data: fm, content } = matter(raw));
      } catch (err) {
        warnings.push({ id, message: String(err.message).split('\n')[0] });
        content = raw.replace(/^---[\s\S]*?\n---\s*/m, '');
        invalid = true;
      }
      bodies.set(id, content);
      prefixes.set(id, bundle.prefix);
      const h1 = content.match(/^#\s+(.*)$/m);
      nodes.set(id, {
        id,
        title: fm.title || (h1 && h1[1].trim()) || path.basename(id, '.md'),
        type: fm.type || 'Unknown',
        tags: normalizeTags(fm.tags),
        summary: fm.description || firstParagraph(content),
        resource: fm.resource || null,
        timestamp: normalizeTimestamp(fm.timestamp),
        bundle: bundle.name,
        raw,
        ghost: false,
        invalidFrontmatter: invalid,
      });
    }
  }

  // Pass 2: links (directed, deduped). Unknown targets inside a bundle become
  // ghost nodes; targets outside every bundle are dropped, not ghosted.
  const links = [];
  const seen = new Set();
  for (const [id, content] of bodies) {
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(content)) !== null) {
      const target = resolveLink(m[1], id, prefixes.get(id));
      if (!target || target === id) continue;
      if (NON_NODES.has(path.basename(target))) continue;
      const owner = bundleOf(target);
      if (!owner || isExcluded(target)) continue;
      if (!nodes.has(target)) {
        nodes.set(target, {
          id: target,
          title: path.basename(target, '.md'),
          type: '_missing',
          tags: [],
          summary: '(not yet written)',
          resource: null,
          timestamp: null,
          bundle: owner.name,
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

  for (const w of warnings) console.warn(`[okf] invalid frontmatter in ${w.id}: ${w.message}`);

  return { nodes: [...nodes.values()], links, warnings };
}
