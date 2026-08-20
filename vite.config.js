import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import chokidar from 'chokidar';
import { buildGraph } from './src/okf.js';

// OKF bundles to visualize. The CLI (bin/cli.js) sets OKF_BUNDLE to a JSON
// array of the directories passed on the command line — JSON rather than a
// separator-joined string, because paths may contain `:` or spaces. A bare
// path is still accepted so a hand-set env var keeps working. Falls back to
// the bundled examples/ sample for `npm run dev` while developing on this repo.
function parseList(value, fallback) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('[')) return [trimmed];
  try {
    return JSON.parse(trimmed);
  } catch {
    return [trimmed];
  }
}

const BUNDLES = parseList(process.env.OKF_BUNDLE, [
  resolve(import.meta.dirname, 'examples'),
]).map((d) => resolve(process.cwd(), d));
const EXCLUDE = parseList(process.env.OKF_EXCLUDE, []);

// Builds graph.json on the fly in dev (fresh per request) and emits it as a
// static asset for production builds. Watches every configured bundle and
// pushes a custom HMR event so the browser refetches without a full reload.
function okfPlugin() {
  return {
    name: 'okf-graph',
    configureServer(server) {
      server.middlewares.use('/graph.json', (_req, res) => {
        try {
          const graph = buildGraph(BUNDLES, { exclude: EXCLUDE });
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(graph));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      server.config.logger.info(`[okf] watching bundle(s): ${BUNDLES.join(', ')}`);
      // chokidar accepts the whole list, so every bundle triggers hot-reload.
      const watcher = chokidar.watch(BUNDLES, { ignoreInitial: true });
      const notify = (file) => {
        server.config.logger.info(`[okf] change: ${file}`);
        server.ws.send({ type: 'custom', event: 'okf:update' });
      };
      watcher.on('add', notify).on('change', notify).on('unlink', notify);
      server.httpServer?.on('close', () => watcher.close());
    },
    // Production build: emit dist/graph.json next to index.html.
    generateBundle() {
      const graph = buildGraph(BUNDLES, { exclude: EXCLUDE });
      this.emitFile({ type: 'asset', fileName: 'graph.json', source: JSON.stringify(graph) });
    },
  };
}

export default defineConfig({
  plugins: [okfPlugin()],
  // Pin the SPA entry. When run via `npx`, the package root lives under
  // node_modules, where Vite's automatic HTML-entry glob is skipped — so
  // dependency pre-bundling would be disabled and CJS deps (3d-force-graph)
  // fail to import. An explicit entry bypasses that exclusion.
  optimizeDeps: { entries: ['index.html'] },
  // 3d-force-graph bundles three; force a single instance so the bloom
  // post-processing pass (three/addons) shares the renderer's THREE.
  resolve: { dedupe: ['three'] },
});
