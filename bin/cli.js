#!/usr/bin/env node
// zettel-graph CLI: visualize an OKF bundle in 3D, with hot-reload.
//
//   zettel-graph [dev] [dir...]           start dev server (default; hot-reload)
//   zettel-graph build [dir...] -o out    build static site into out/ (default dist/)
//   zettel-graph graph [dir...] -o file   emit graph.json (stdout if no -o)
//   zettel-graph init [dir]               scaffold an OKF bundle + agent guide
//
// [dir] defaults to the current directory (init defaults to ./knowledge).
// Several bundles can be passed at once; their notes then share one graph and
// cross-bundle relative links resolve into real edges. The Vite root is pinned
// to this package so the client app is served from the install location, while
// the content bundles are whatever directories you point at (exported as
// OKF_BUNDLE, a JSON array so paths with separators/spaces survive).
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = resolve(PKG_ROOT, 'vite.config.js');
const COMMANDS = new Set(['dev', 'build', 'graph', 'init']);

function usage() {
  process.stderr.write(
    `zettel-graph — 3D OKF knowledge-graph visualizer\n\n` +
      `Usage:\n` +
      `  zettel-graph [dev] [dir...]           dev server with hot-reload (default)\n` +
      `  zettel-graph build [dir...] -o out    static site (default: dist/)\n` +
      `  zettel-graph graph [dir...] -o file   emit graph.json (stdout if no -o)\n` +
      `  zettel-graph init [dir]               scaffold an OKF bundle + agent guide\n\n` +
      `Arguments:\n` +
      `  dir        OKF bundle directory (default: current dir; init: ./knowledge).\n` +
      `             Pass several to merge sibling bundles into one graph; ids then\n` +
      `             become relative to their common parent (e.g. knowledge/x.md).\n` +
      `  --exclude  glob or directory to skip, relative to the graph root\n` +
      `             (repeatable; node_modules/dist/build/vendor/archive are always skipped)\n` +
      `  -o         output path (build dir, or graph.json file)\n` +
      `  -p         dev server port\n` +
      `  -f         init: overwrite existing files\n` +
      `  -h         show this help\n`,
  );
}

let cmd = 'dev';
const dirs = [];
const exclude = [];
let out = null;
let port = null;
let force = false;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-h' || a === '--help') {
    usage();
    process.exit(0);
  } else if (a === '-f' || a === '--force') {
    force = true;
  } else if (a === '-o' || a === '--out') {
    out = argv[++i];
  } else if (a === '-p' || a === '--port') {
    port = Number(argv[++i]);
  } else if (a === '-x' || a === '--exclude') {
    exclude.push(argv[++i]);
  } else if (i === 0 && COMMANDS.has(a)) {
    cmd = a;
  } else if (a.startsWith('-')) {
    console.error(`unexpected argument: ${a}`);
    usage();
    process.exit(1);
  } else {
    dirs.push(a);
  }
}

// init creates the bundle, so it runs before the existence check below.
if (cmd === 'init') {
  const { runInit } = await import('../src/init.js');
  const target = dirs[0] ?? 'knowledge';
  const today = new Date().toISOString().slice(0, 10);
  const { root, created, skipped } = runInit({ dir: target, force, today });
  for (const f of created) console.error(`  created  ${f}`);
  for (const f of skipped) console.error(`  skipped  ${f} (exists; -f to overwrite)`);
  console.error(`\nOKF bundle ready at ${root}`);
  console.error(`\nNext:`);
  console.error(`  • Visualize:  npx zettel-graph ${target}`);
  console.error(`  • Point your agent at ${target}/AGENTS.md — it runs a short first-run`);
  console.error(`    setup with you: pick topics to track, autonomy levels, wire root config.`);
  process.exit(0);
}

const bundles = (dirs.length ? dirs : ['.']).map((d) => resolve(process.cwd(), d));
for (const bundle of bundles) {
  if (!fs.existsSync(bundle)) {
    console.error(`bundle directory not found: ${bundle}`);
    process.exit(1);
  }
}
// JSON rather than a path-separator-joined string: bundle paths may contain
// anything the filesystem allows, including `:` and spaces.
process.env.OKF_BUNDLE = JSON.stringify(bundles);
if (exclude.length) process.env.OKF_EXCLUDE = JSON.stringify(exclude);

if (cmd === 'graph') {
  const { buildGraph } = await import('../src/okf.js');
  const graph = buildGraph(bundles, { exclude });
  const json = JSON.stringify(graph, null, 2);
  if (out) {
    fs.writeFileSync(out, json);
    console.error(`wrote ${out}: ${graph.nodes.length} nodes, ${graph.links.length} links`);
  } else {
    process.stdout.write(json + '\n');
  }
} else if (cmd === 'build') {
  const { build } = await import('vite');
  await build({
    root: PKG_ROOT,
    configFile: CONFIG,
    build: { outDir: resolve(process.cwd(), out ?? 'dist'), emptyOutDir: true },
  });
} else {
  const { createServer } = await import('vite');
  const server = await createServer({
    root: PKG_ROOT,
    configFile: CONFIG,
    server: port ? { port } : {},
  });
  await server.listen();
  server.printUrls();
}
