// Client side of semantic search: loads embeddings.json, answers
// "what is similar to this note?" and "how similar is each note to this
// query?" via cosine similarity (vectors are normalised, so a dot product).
//
// Availability is dynamic: embeddings.json may report { available: false }
// (dependency missing) and /api/embed only exists on the dev server. Callers
// treat every function here as best-effort and fall back to lexical behaviour.

import { emit } from '../state.js';

let vectors = null; // Map<id, Float32Array> | null while unavailable

export const semanticAvailable = () => vectors !== null && vectors.size > 0;

/** Fetch embeddings.json (again after hot-reload); emits 'semantic' when done. */
export async function loadEmbeddings() {
  try {
    const res = await fetch('embeddings.json', { cache: 'no-store' });
    const data = await res.json();
    vectors = data.available
      ? new Map(Object.entries(data.vectors).map(([id, v]) => [id, Float32Array.from(v)]))
      : null;
  } catch {
    vectors = null;
  }
  emit('semantic');
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Top-k notes most similar to `id` (excluding itself).
 * @returns {{id: string, score: number}[]}
 */
export function relatedTo(id, k = 5, minScore = 0.35) {
  const v = vectors?.get(id);
  if (!v) return [];
  const out = [];
  for (const [other, w] of vectors) {
    if (other === id) continue;
    const score = dot(v, w);
    if (score >= minScore) out.push({ id: other, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}

/**
 * Score every note against a free-text query via the dev server's /api/embed.
 * Resolves to Map<id, cosine> or null (unavailable / static build / error).
 */
export async function queryScores(query) {
  if (!semanticAvailable()) return null;
  try {
    const res = await fetch(`/api/embed?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const { vector } = await res.json();
    if (!vector) return null;
    const q = Float32Array.from(vector);
    const scores = new Map();
    for (const [id, v] of vectors) scores.set(id, dot(q, v));
    return scores;
  } catch {
    return null;
  }
}
