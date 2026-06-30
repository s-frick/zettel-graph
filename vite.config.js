import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import chokidar from 'chokidar';
import { buildGraph } from './src/okf.js';

// OKF bundle to visualize. The CLI (bin/cli.js) sets OKF_BUNDLE to the
// directory passed on the command line. Falls back to the bundled examples/
// sample for `npm run dev` while developing on this repo.
const BUNDLE = process.env.OKF_BUNDLE
  ? resolve(process.cwd(), process.env.OKF_BUNDLE)
  : resolve(import.meta.dirname, 'examples');

// Builds graph.json on the fly in dev (fresh per request) and emits it as a
// static asset for production builds. Watches the bundle and pushes a custom
// HMR event so the browser refetches without a full reload.
function okfPlugin() {
  return {
    name: 'okf-graph',
    configureServer(server) {
      server.middlewares.use('/graph.json', (_req, res) => {
        try {
          const graph = buildGraph(BUNDLE);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(graph));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      server.config.logger.info(`[okf] watching bundle: ${BUNDLE}`);
      const watcher = chokidar.watch(BUNDLE, { ignoreInitial: true });
      const notify = (file) => {
        server.config.logger.info(`[okf] change: ${file}`);
        server.ws.send({ type: 'custom', event: 'okf:update' });
      };
      watcher.on('add', notify).on('change', notify).on('unlink', notify);
      server.httpServer?.on('close', () => watcher.close());
    },
    // Production build: emit dist/graph.json next to index.html.
    generateBundle() {
      const graph = buildGraph(BUNDLE);
      this.emitFile({ type: 'asset', fileName: 'graph.json', source: JSON.stringify(graph) });
    },
  };
}

export default defineConfig({
  plugins: [okfPlugin()],
  // 3d-force-graph bundles three; force a single instance so the bloom
  // post-processing pass (three/addons) shares the renderer's THREE.
  resolve: { dedupe: ['three'] },
});
