// Narration helpers shared by tools/narrate.mjs (local CPU) and tools/narrate-kaggle.mjs (Kaggle GPU), so both
// produce identical trimming, word alignment and narration.json scene records.

export const norm = (w) => w.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']/g, '');

export function trimSilence(x, sr, thr = 0.006, padS = 0.05) {
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < thr) a++;
  while (b > a && Math.abs(x[b]) < thr) b--;
  a = Math.max(0, a - Math.round(padS * sr)); b = Math.min(x.length - 1, b + Math.round(padS * 2 * sr));
  return x.slice(a, b + 1);
}

const subCost = (a, b) => (a === b ? 0 : (a[0] === b[0] ? 0.6 : 1));

/** Ordered alignment; matches contains a recognized index only for an exact script-word match. */
export function wordAlignment(scriptWords, heard, duration) {
  if (!Number.isFinite(duration) || duration < 0) throw new Error('Invalid narration clip duration');
  const S = scriptWords.map(norm), H = heard.map((h) => norm(h.text));
  const n = S.length, m = H.length;
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 0; i <= n; i++) D[i][0] = i;
  for (let j = 0; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    D[i][j] = Math.min(D[i - 1][j - 1] + subCost(S[i - 1], H[j - 1]), D[i - 1][j] + 1, D[i][j - 1] + 1);
  }
  const times = new Array(n).fill(null), matches = new Array(n).fill(null);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (D[i][j] === D[i - 1][j - 1] + subCost(S[i - 1], H[j - 1])) {
      const h = heard[j - 1];
      if (Number.isFinite(h.start) && Number.isFinite(h.end)) times[i - 1] = [h.start, h.end];
      if (S[i - 1] && S[i - 1] === H[j - 1] && times[i - 1]) matches[i - 1] = j - 1;
      i--; j--;
    }
    else if (D[i][j] === D[i - 1][j] + 1) i--;
    else j--;
  }
  // Interpolate unmatched runs proportionally to word length.
  let k = 0;
  while (k < n) {
    if (times[k]) { k++; continue; }
    let e = k; while (e < n && !times[e]) e++;
    const t0 = k > 0 ? times[k - 1][1] : 0, t1 = e < n ? times[e][0] : duration;
    const total = scriptWords.slice(k, e).reduce((s, w) => s + w.length + 1, 0);
    let acc = 0;
    for (let q = k; q < e; q++) { const a = t0 + (t1 - t0) * acc / total; acc += scriptWords[q].length + 1; times[q] = [a, t0 + (t1 - t0) * acc / total]; }
    k = e;
  }
  // Monotonic, non-overlapping, inside the clip.
  for (let q = 0; q < n; q++) {
    times[q][0] = Math.min(duration, Math.max(q ? times[q - 1][0] + 0.02 : 0, times[q][0]));
    times[q][1] = Math.min(duration, Math.max(times[q][0] + 0.05, times[q][1]));
    if (q) times[q - 1][1] = Math.min(times[q - 1][1], times[q][0]);
  }
  return { times, matches, exact: matches.filter((x) => x !== null).length };
}

/** Align script words to recognized words; unmatched script words are interpolated. */
export function alignWords(scriptWords, heard, duration) { return wordAlignment(scriptWords, heard, duration).times; }

/**
 * One narration.json scene record from a clip's text, duration and recognized words ({ text, start, end } in
 * seconds); also returns how many script words were heard exactly, for the progress log.
 */
export function sceneRecord({ id, text, file, sampleRate, duration, heardText, heard }) {
  const scriptWords = text.split(/\s+/).filter(Boolean);
  const { times, matches, exact } = wordAlignment(scriptWords, heard, duration);
  const record = {
    id, text, file, sample_rate: sampleRate, duration_s: +duration.toFixed(6), heard: heardText.trim(),
    words: scriptWords.map((w, q) => ({ text: w, start_s: +times[q][0].toFixed(6), end_s: +times[q][1].toFixed(6) })),
  };
  return { record, exact, wordCount: scriptWords.length, matches };
}
