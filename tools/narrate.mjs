#!/usr/bin/env node
/**
 * tools/narrate.mjs — Local Voice Synthesis (Kokoro / Piper) & Whisper Word Alignment
 *
 * Usage: node tools/narrate.mjs stories/<slug>.json
 *
 * Upgraded for high-retention simulation pacing:
 * - Applies per-scene `pacing_energy` speed multipliers ("fast_hook" = 1.08x,
 *   "crisp_mechanism" = 1.05x, "steady_escalation" = 1.03x, "reflective_payoff" = 0.98x).
 * - Trims leading silence on Scene S01 so spoken audio begins within 50-80ms of frame 0.
 * - Aligns real synthesized audio word timestamps via local Whisper into
 *   `build/<slug>/audio/narration.json` and writes `build/<slug>/audio/narration.wav`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const PACING_SPEED_MAP = {
  fast_hook: 1.08,
  crisp_mechanism: 1.05,
  steady_escalation: 1.03,
  weighty_impact: 1.01,
  reflective_payoff: 0.98,
  loop_bridge: 1.02,
};

function resolveSceneSpeed(scene, index, targetWpm = 148) {
  if (scene.narration?.pacing_energy && PACING_SPEED_MAP[scene.narration.pacing_energy]) {
    return PACING_SPEED_MAP[scene.narration.pacing_energy];
  }
  const baseScale = Math.max(0.95, Math.min(1.12, targetWpm / 140));
  if (index === 0) return Math.max(1.06, baseScale * 1.04); // Hook scene briskness
  if (index <= 2) return Math.max(1.03, baseScale * 1.02);
  return baseScale;
}

function getWavDurationSeconds(wavPath, ffprobeBin = 'ffprobe') {
  const res = spawnSync(
    ffprobeBin,
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      wavPath,
    ],
    { encoding: 'utf8' }
  );
  const parsed = parseFloat((res.stdout || '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

async function main() {
  const argPath = process.argv[2];
  if (!argPath) {
    console.error('Usage: node tools/narrate.mjs stories/<slug>.json');
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const storyPath = path.isAbsolute(argPath)
    ? argPath
    : path.join(repoRoot, argPath);
  const storyboard = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
  const slug = storyboard.project.slug;
  const duration_s = storyboard.project.duration_s;
  const targetWpm = storyboard.audio?.narration_target_wpm ?? 148;

  const audioDir = path.join(repoRoot, 'build', slug, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });

  const ffmpegBin = ffmpegPath || 'ffmpeg';
  const sceneOutputs = [];

  for (let i = 0; i < storyboard.scenes.length; i++) {
    const scene = storyboard.scenes[i];
    const sceneId = scene.id;
    const text = scene.narration.text.trim();
    const speed = resolveSceneSpeed(scene, i, targetWpm);

    // Force S01 hook narration to start immediately at t <= 0.08s (zero dead air)
    const start_s =
      i === 0 ? Math.min(0.08, scene.narration.start_s ?? 0.05) : scene.narration.start_s;
    const window_s = scene.end_s - start_s;

    const rawSceneWav = path.join(audioDir, `${sceneId}_raw.wav`);
    const trimmedSceneWav = path.join(audioDir, `${sceneId}.wav`);

    // Invoke existing local TTS helper (scripts/tts_synthesize.py or kokoro CLI) if present
    const ttsScript = path.join(repoRoot, 'scripts', 'tts_synthesize.py');
    if (fs.existsSync(ttsScript)) {
      const ttsRes = spawnSync(
        'python',
        [
          ttsScript,
          '--text',
          text,
          '--voice',
          'am_michael',
          '--speed',
          String(speed.toFixed(2)),
          '--out',
          rawSceneWav,
        ],
        { stdio: 'inherit' }
      );
      if (ttsRes.status !== 0) process.exit(ttsRes.status ?? 1);

      // Strip leading and trailing silence so hook starts on frame 2
      spawnSync(
        ffmpegBin,
        [
          '-y',
          '-i',
          rawSceneWav,
          '-af',
          'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_duration=0.04:start_threshold=-45dB,areverse',
          '-ar',
          '48000',
          '-ac',
          '1',
          trimmedSceneWav,
        ],
        { stdio: 'ignore' }
      );
    }

    const actualDur = fs.existsSync(trimmedSceneWav)
      ? getWavDurationSeconds(trimmedSceneWav)
      : Math.min(window_s - 0.15, (text.split(/\s+/).length / (targetWpm * speed)) * 60);

    if (actualDur > window_s - 0.05) {
      console.warn(
        `[narrate] WARNING: ${sceneId} speech (${actualDur.toFixed(
          2
        )}s) is tight against window (${window_s.toFixed(2)}s).`
      );
    }

    // Align words via local Whisper helper if present, else proportional fallback
    const alignScript = path.join(repoRoot, 'scripts', 'whisper_align.py');
    let words = [];
    const wordsJsonPath = path.join(audioDir, `${sceneId}_words.json`);

    if (fs.existsSync(alignScript) && fs.existsSync(trimmedSceneWav)) {
      spawnSync(
        'python',
        [alignScript, '--audio', trimmedSceneWav, '--text', text, '--out', wordsJsonPath],
        { stdio: 'inherit' }
      );
      if (fs.existsSync(wordsJsonPath)) {
        const rawWords = JSON.parse(fs.readFileSync(wordsJsonPath, 'utf8'));
        words = rawWords.map((w) => ({
          word: w.word,
          start_s: Number((start_s + w.start_s).toFixed(3)),
          end_s: Number((start_s + w.end_s).toFixed(3)),
          sceneId,
        }));
      }
    }

    if (words.length === 0) {
      const tokens = text.split(/\s+/).filter(Boolean);
      const totalWeights = tokens.reduce((acc, tk) => acc + Math.max(2, tk.length), 0);
      let cursor = start_s;
      for (const tk of tokens) {
        const wDur = (Math.max(2, tk.length) / totalWeights) * actualDur;
        words.push({
          word: tk,
          start_s: Number(cursor.toFixed(3)),
          end_s: Number((cursor + wDur).toFixed(3)),
          sceneId,
        });
        cursor += wDur;
      }
    }

    sceneOutputs.push({
      id: sceneId,
      start_s,
      end_s: Number((start_s + actualDur).toFixed(3)),
      speed,
      text,
      wavPath: trimmedSceneWav,
      words,
      caption_emphasis: scene.caption_emphasis ?? [],
    });
  }

  // Assemble master narration.wav on the exact 0..duration_s timeline
  const existingClips = sceneOutputs.filter((s) => fs.existsSync(s.wavPath));
  const masterNarrationWav = path.join(audioDir, 'narration.wav');
  if (existingClips.length > 0) {
    const inputs = [];
    const delayFilters = [];
    const mixLabels = [];

    existingClips.forEach((sc, idx) => {
      inputs.push('-i', sc.wavPath);
      const delayMs = Math.max(0, Math.round(sc.start_s * 1000));
      delayFilters.push(`[${idx}:a]adelay=${delayMs}|${delayMs}[s${idx}]`);
      mixLabels.push(`[s${idx}]`);
    });

    const filterGraph = `${delayFilters.join(';')};${mixLabels.join(
      ''
    )}amix=inputs=${existingClips.length}:normalize=0,apad=whole_dur=${duration_s}[out]`;

    spawnSync(
      ffmpegBin,
      [
        '-y',
        ...inputs,
        '-filter_complex',
        filterGraph,
        '-map',
        '[out]',
        '-ar',
        '48000',
        '-ac',
        '1',
        '-t',
        String(duration_s),
        masterNarrationWav,
      ],
      { stdio: 'ignore' }
    );
  }

  const narrationManifest = {
    slug,
    duration_s,
    generated_at: new Date().toISOString(),
    scenes: sceneOutputs.map(({ wavPath, ...rest }) => rest),
    words: sceneOutputs.flatMap((s) => s.words),
  };

  const manifestPath = path.join(audioDir, 'narration.json');
  fs.writeFileSync(manifestPath, JSON.stringify(narrationManifest, null, 2));
  console.log(
    `[narrate] Wrote ${manifestPath} (${narrationManifest.words.length} timed words across ${sceneOutputs.length} scenes)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});