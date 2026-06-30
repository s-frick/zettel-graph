#!/usr/bin/env node
// zettel-graph CLI: visualize an OKF bundle in 3D, with hot-reload.
//
//   zettel-graph [dev] [dir]           start dev server (default; hot-reload)
//   zettel-graph build [dir] -o out    build static site into out/ (default dist/)
//   zettel-graph graph [dir] -o file   emit graph.json (stdout if no -o)
//   zettel-graph init [dir]            scaffold an OKF bundle + agent guide
//
// [dir] defaults to the current directory (init defaults to ./knowledge). The
// Vite root is pinned to this package so the client app is served from the
// install location, while the content bundle is whatever directory you point at
// (exported as OKF_BUNDLE).
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
      `  zettel-graph [dev] [dir]           dev server with hot-reload (default)\n` +
      `  zettel-graph build [dir] -o out    static site (default: dist/)\n` +
      `  zettel-graph graph [dir] -o file   emit graph.json (stdout if no -o)\n` +
      `  zettel-graph init [dir]            scaffold an OKF bundle + agent guide\n\n` +
      `Arguments:\n` +
      `  dir    OKF bundle directory (default: current dir; init: ./knowledge)\n` +
      `  -o     output path (build dir, or graph.json file)\n` +
      `  -p     dev server port\n` +
      `  -f     init: overwrite existing files\n` +
      `  -h     show this help\n`,
  );
}

let cmd = 'dev';
let dir = null;
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
  } else if (i === 0 && COMMANDS.has(a)) {
    cmd = a;
  } else if (dir === null) {
    dir = a;
  } else {
    console.error(`unexpected argument: ${a}`);
    usage();
    process.exit(1);
  }
}

// init creates the bundle, so it runs before the existence check below.
if (cmd === 'init') {
  const { runInit } = await import('../src/init.js');
  const target = dir ?? 'knowledge';
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

const bundle = resolve(process.cwd(), dir ?? '.');
if (!fs.existsSync(bundle)) {
  console.error(`bundle directory not found: ${bundle}`);
  process.exit(1);
}
process.env.OKF_BUNDLE = bundle;

if (cmd === 'graph') {
  const { buildGraph } = await import('../src/okf.js');
  const graph = buildGraph(bundle);
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
