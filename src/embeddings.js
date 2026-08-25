// Semantic embeddings for OKF notes (node-side).
//
// Embeds every real (non-ghost) note with a small local sentence-transformer
// (all-MiniLM-L6-v2 via @huggingface/transformers — runs on CPU, no API key).
// Vectors are L2-normalised, so cosine similarity is a plain dot product on
// the client. Results are cached on disk keyed by a content hash, so a
// hot-reload only re-embeds the notes that actually changed.
//
// Everything degrades gracefully: if the dependency is missing or the model
// fails to load, `embedNotes`/`embedQuery` return null and the client falls
// back to lexical search.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const CACHE_DIR = path.join(os.homedir(), '.cache', 'zettel-graph');
const CACHE_FILE = path.join(CACHE_DIR, 'embeddings-cache.json');
// Titles + summaries carry most of the signal; the body tail rarely adds more
// than it costs, and MiniLM truncates at 256 tokens anyway.
const MAX_BODY_CHARS = 1500;

let extractorPromise = null;
let failed = false;

async function getExtractor() {
  if (failed) return null;
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = path.join(CACHE_DIR, 'models');
      return pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' });
    })().catch((err) => {
      failed = true;
      console.warn(
        `[okf] semantic search disabled (${String(err.message).split('\n')[0]}).\n` +
          `      npm install @huggingface/transformers to enable it.`,
      );
      return null;
    });
  }
  return extractorPromise;
}

function noteText(n) {
  const body = String(n.raw || '')
    .replace(/^---[\s\S]*?\n---\s*/m, '') // frontmatter is metadata, not prose
    .slice(0, MAX_BODY_CHARS);
  return [n.title, n.type, (n.tags || []).join(' '), n.summary, body]
    .filter(Boolean)
    .join('\n');
}

const hashOf = (text) => crypto.createHash('sha1').update(MODEL_ID + '\n' + text).digest('hex');

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch (err) {
    console.warn(`[okf] could not persist embedding cache: ${err.message}`);
  }
}

const round = (v) => Array.from(v, (x) => Math.round(x * 1e4) / 1e4);

/**
 * Embed every non-ghost node. Returns the payload served as embeddings.json:
 * `{ available, model, dim, vectors: { id: number[] } }`, or an
 * `{ available: false }` stub when the model is unavailable.
 */
export async function embedNotes(nodes) {
  const extractor = await getExtractor();
  if (!extractor) return { available: false };

  const cache = loadCache();
  const vectors = {};
  const todo = [];
  for (const n of nodes) {
    if (n.ghost) continue;
    const text = noteText(n);
    const key = hashOf(text);
    if (cache[key]) vectors[n.id] = cache[key];
    else todo.push({ id: n.id, key, text });
  }

  if (todo.length) {
    console.error(`[okf] embedding ${todo.length} note(s)…`);
    // Batch keeps peak memory bounded on large bundles.
    const BATCH = 16;
    for (let i = 0; i < todo.length; i += BATCH) {
      const batch = todo.slice(i, i + BATCH);
      const out = await extractor(batch.map((t) => t.text), { pooling: 'mean', normalize: true });
      const [, dim] = out.dims;
      batch.forEach((t, j) => {
        const vec = round(out.data.slice(j * dim, (j + 1) * dim));
        vectors[t.id] = vec;
        cache[t.key] = vec;
      });
    }
    saveCache(cache);
  }

  const dim = Object.values(vectors)[0]?.length ?? 0;
  return { available: true, model: MODEL_ID, dim, vectors };
}

/** Embed a free-text search query; null when the model is unavailable. */
export async function embedQuery(text) {
  const extractor = await getExtractor();
  if (!extractor) return null;
  const out = await extractor([text], { pooling: 'mean', normalize: true });
  return round(out.data);
}
