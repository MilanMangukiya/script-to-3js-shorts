#!/usr/bin/env node
// Local narration + word alignment + voice timeline. No network, no paid API.
//   node tools/narrate.mjs stories/<slug>.json [--speed 0.92] [--reuse] [--voice am_michael] [--out build/<review>/audio]
// 1) Kokoro-82M (ONNX, local cache) speaks each scene's exact narration text through tools/narrate-cached.py, at a
//    per-scene speed: explicit narration.performance.rate, else a text-aware prediction (tools/lib/rate-model.mjs) for
//    the scene's cadence target, then pacing_energy, then --speed.
// 2) faster-whisper (local, word timestamps) listens to the real audio; its words are aligned back to the script words
//    (tools/lib/align.mjs), so burned-in captions follow the actual synthesized speech.
// 3) Each clip is leveled to the same BS.1770 loudness and laid on the film timeline at its scene's narration.start_s;
//    the timeline gets one voice finishing chain (EQ, de-ess, compression; src/library/audio/voice.mjs) and a subtle
//    convolution room, and is written as build/<slug>/audio/narration.wav (48 kHz mono) for tools/soundtrack.mjs.
// --reuse checks source text, voice, model and speed. Explicit pauses are reapplied from untouched source clips;
// they edit quiet measured gaps and never accumulate across runs. Prose delivery notes are review guidance.
// Outputs: build/<slug>/audio/narration.json (+ narration/<scene>.wav, narration-raw.json, narration.wav).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readWav, writeWav } from './lib/wav.mjs';
import { sceneRecord } from './lib/align.mjs';
import { PERFORMANCE_VERSION, performancePlan, resolveOutputDir, outputChild, rawCacheMatches, performanceIdentity, prepareNarrationSource, applyPerformance } from './lib/performance.mjs';
import { VOICE_TARGET_LUFS, levelTo, voiceChain, addRoom } from '../src/library/audio/voice.mjs';
import { readVoiceProfile, VOICE_SPEC } from './lib/voice-profile.mjs';
import {assessCadence,assessNarrationQuality,nextCalibrationRate,readNarrationProvenance,provenanceEqual,cadencePolicy} from './lib/narration-quality.mjs';
import { DEFAULT_RATE_MODEL, checkRateModel, startingRate } from './lib/rate-model.mjs';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return dflt;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`--${name} needs a value`);
  return args[i + 1];
};
const storyFile = args[0];
if (!storyFile || storyFile.startsWith('--')) { console.error('Usage: node tools/narrate.mjs stories/<slug>.json [--speed 0.92] [--reuse] [--voice am_michael] [--out build/<review>/audio]'); process.exit(2); }
const story = JSON.parse(fs.readFileSync(path.resolve(storyFile), 'utf8'));
const slug = story.project.slug, D = story.project.duration_s;
const voiceProfile = readVoiceProfile(ROOT);
const voice = opt('voice', story.audio?.voice_id ?? voiceProfile.voice_id), baseSpeed = Number(opt('speed', '0.92'));
if (!VOICE_SPEC.test(voice)) throw new Error(`Voice must be a Kokoro id or a blend such as am_michael*0.7+am_onyx*0.3, got ${voice}`);
if (!Number.isFinite(D) || D <= 0 || !Array.isArray(story.scenes) || !story.scenes.length) throw new Error('Invalid story duration or scenes');
const plans = Object.fromEntries(story.scenes.map((sc) => {
  if (!/^S[0-9]{2}$/.test(sc.id)) throw new Error(`Invalid scene id: ${sc.id}`);
  return [sc.id, performancePlan(sc.narration, baseSpeed, voice === voiceProfile.voice_id ? voiceProfile.pacing_speed : undefined)];
}));
// Text-aware starting speeds (tools/lib/rate-model.mjs) for scenes without an explicit performance.rate: aim at the
// scene's cadence band (or its energy's target WPM), never slower than its fixed slot allows.
const rateModel = voiceProfile.rate_model ? checkRateModel(voiceProfile.rate_model) : DEFAULT_RATE_MODEL;
if (voice === rateModel.voice) for (const [i, sc] of story.scenes.entries()) {
  if (sc.narration.performance?.rate !== undefined) continue;
  const band = cadencePolicy(sc, i), words = sc.narration.text.split(/\s+/).filter(Boolean).length;
  const slot = Math.min(sc.narration.end_s, sc.end_s - 0.15) - sc.narration.start_s;
  const target = Math.min(band?.max_wpm ?? Infinity, Math.max(band?.target_wpm ?? voiceProfile.targets_wpm?.[sc.narration.pacing_energy] ?? 150, words * 60 / slot * 1.03));
  plans[sc.id].rate = startingRate(sc.narration.text, target, rateModel);
}
const speeds = Object.fromEntries(story.scenes.map((sc) => [sc.id, plans[sc.id].rate]));
const startingRates={...speeds};
for(const sc of story.scenes){const preflight=assessCadence(sc,1);if(!preflight.feasible)throw new Error(preflight.reason);}
const dir = resolveOutputDir(ROOT, opt('out', undefined), slug);
fs.mkdirSync(outputChild(dir, 'narration'), { recursive: true });
fs.mkdirSync(outputChild(dir, 'performance'), { recursive: true });
for (const sc of story.scenes) {
  outputChild(dir, `narration/${sc.id}.wav`);
  outputChild(dir, `performance/${sc.id}.wav`);
}

// ---- 1+2) synthesis and recognition (cached Kokoro ONNX + faster-whisper)
const rawFile = path.join(dir, 'narration-raw.json');
const cached = fs.existsSync(rawFile) ? JSON.parse(fs.readFileSync(rawFile, 'utf8')) : null;
const provenance=readNarrationProvenance(ROOT,{storyFile:path.resolve(storyFile)});
// Reuse previously measured rates only when the same starting plan/text/voice/runtime produced them.
if(args.includes('--reuse'))for(const sc of story.scenes){
  const rate=cached?.scenes?.find(r=>r.id===sc.id)?.speed;
  if(sc.narration.performance?.rate===undefined&&cached?.calibration_starting_rates?.[sc.id]===startingRates[sc.id]&&Number.isFinite(rate)&&rate>=.5&&rate<=1.2&&rawCacheMatches(cached,{scenes:[sc],voice,speeds:{[sc.id]:rate},dir,provenance})){speeds[sc.id]=rate;plans[sc.id].rate=rate;}
}
let raw,result,preparedClips;
const calibration=[];
for(let pass=1;pass<=4;pass++){
 const current=fs.existsSync(rawFile)?JSON.parse(fs.readFileSync(rawFile,'utf8')):null;
 const fresh=rawCacheMatches(current,{scenes:story.scenes,voice,speeds,dir,provenance});
 const recognitionFresh=fresh&&story.scenes.every(sc=>provenanceEqual(current.scenes.find(r=>r.id===sc.id)?.recognition_provenance,provenance.recognition));
 if((args.includes('--reuse')||pass>1)&&recognitionFresh)console.log('reusing verified source clips and recognition');
 else{
  const t0 = Date.now();
  const py = spawnSync(process.env.PYTHON ?? 'python', [path.join(ROOT, 'tools', 'narrate-cached.py'), path.resolve(storyFile), '--voice', voice, '--speed', String(baseSpeed), '--speeds', JSON.stringify(speeds), '--out', dir, ...((args.includes('--reuse')||pass>1) ? ['--reuse'] : [])],
    { stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8',PYTHONDONTWRITEBYTECODE:'1',HF_HUB_OFFLINE:'1' } });
  if (py.status !== 0) { console.error('narrate-cached.py failed'); process.exit(py.status ?? 1); }
  console.log(`prepared ${story.scenes.length} scene clips in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
 }
raw = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
if (!rawCacheMatches(raw, { scenes: story.scenes, voice, speeds, dir,provenance })) throw new Error('Narration source cache does not match requested text, voice, model/runtime provenance or speed');

// ---- alignment → narration.json (word times relative to each clip; src/entry.ts offsets them by narration.start_s)
result = { slug, engine: raw.engine, model: raw.model, voice: raw.voice, speed: baseSpeed,provenance:raw.provenance, aligner: raw.aligner, license: raw.license,
  performance: { version: PERFORMANCE_VERSION, identity: performanceIdentity({ engine: raw.engine, model: raw.model, voice: raw.voice,provenance,plans,text:story.scenes.map(s=>s.narration.text) }) }, scenes: [] };
preparedClips=[];
let words = 0, speech = 0;
const problems = [];
for (const sc of story.scenes) {
  const r = raw.scenes.find((x) => x.id === sc.id);
  if (!r || r.text !== sc.narration.text) { console.error(`${sc.id}: narration-raw.json does not match the storyboard text; run without --reuse`); process.exit(1); }
  const waveform = readWav(outputChild(dir, r.file));
  if (waveform.channels.length !== 1 || waveform.sampleRate !== r.sampleRate || Math.abs(waveform.channels[0].length / waveform.sampleRate - r.duration) > 1 / waveform.sampleRate + 1e-6) throw new Error(`${sc.id}: source WAV and cache metadata disagree`);
  const { samples: sourceSamples, source, leadingTrim } = prepareNarrationSource(r, waveform.channels[0], waveform.sampleRate, sc === story.scenes[0] ? sc.narration.start_s : undefined);
  const { record: aligned, exact, wordCount, matches,evidence } = sceneRecord(source);
  const { record, samples } = applyPerformance({ record: aligned, raw: source, matches, samples: sourceSamples, sampleRate: waveform.sampleRate, plan: plans[sc.id] });
  record.performance.leading_trim_s = leadingTrim;
  record.audible_start_s = sc.narration.start_s + samples.findIndex((x) => Math.abs(x) > .006) / waveform.sampleRate;
  record.speed = r.speed ?? raw.speed;
  record.source_file = r.file;
  record.file = `performance/${sc.id}.wav`;
  const quality=assessNarrationQuality({raw:source,record,samples,sampleRate:waveform.sampleRate,scene:sc,evidence});
  record.quality=quality;
  if(!quality.source.ok||!quality.timing.ok||!quality.recognition.lexical_ok||!quality.onset.ok)throw new Error(quality.reasons.join('\n'));
  preparedClips.push({record,samples,sampleRate:waveform.sampleRate,scene:sc});
  result.scenes.push(record);
  const end = sc.narration.start_s + record.duration_s;
  words += wordCount; speech += record.duration_s;
  console.log(`${sc.id} ${record.duration_s.toFixed(2)}s ${wordCount}w ${(wordCount / record.duration_s * 60).toFixed(0)}wpm speed ${record.speed} match ${exact}/${wordCount} | ends ${end.toFixed(2)}s of scene ${sc.start_s}-${sc.end_s}`);
  const limit = Math.min(sc.narration.end_s, sc.end_s - 0.15);
  if (sc === story.scenes[0] && record.audible_start_s > .08 + 1 / waveform.sampleRate) problems.push(`${sc.id}: audible hook starts at ${record.audible_start_s.toFixed(4)}s, after 0.08s`);
  if (!Number.isFinite(sc.narration.start_s) || !Number.isFinite(limit) || sc.narration.start_s < sc.start_s || end > limit + 1e-6) problems.push(`${sc.id}: speech ends at ${end.toFixed(3)}s, past narration/scene limit ${limit.toFixed(3)}s (scene reserves 0.15s)`);
  if(!quality.cadence.cadence_ok)problems.push(quality.reasons.join('; '));
}
console.log(`total ${words} words, ${speech.toFixed(1)}s of speech (${(words / speech * 60).toFixed(0)} wpm) in a ${D}s film`);
if (story.scenes[0].narration.start_s > 0.08) console.warn(`WARNING: S01 narration starts at ${story.scenes[0].narration.start_s}s (hook speech should start by 0.08s)`);
calibration.push({pass,scenes:preparedClips.map(({record})=>({id:record.id,rate:record.speed,...record.quality.cadence}))});
// Keep valid measured starting-plan provenance even if a later scene needs an editorial revision.
// Text, runtime and source hashes are still checked independently before these rates can be reused.
raw.calibration_starting_rates=startingRates;
fs.writeFileSync(rawFile,JSON.stringify(raw,null,2)+'\n');
if(!problems.length)break;
if(pass===4)throw new Error(`Measured narration cadence/fit did not converge in four passes:\n${problems.join('\n')}`);
for(const {record,scene} of preparedClips){
  const assessment=record.quality.cadence;
  if(assessment.cadence_ok&&assessment.fit_ok)continue;
  if(scene.narration.performance?.rate!==undefined)throw new Error(`${scene.id}: explicit performance.rate ${record.speed} is fixed; ${record.quality.reasons.join('; ')}. Revise the rate or approved timing explicitly`);
  const rate=nextCalibrationRate(record.speed,assessment);
  if(rate===null)throw new Error(`${scene.id}: supported rates 0.5-1.2 cannot satisfy measured cadence and the fixed scene slot`);
  speeds[scene.id]=rate;plans[scene.id].rate=rate;
}
}
result.calibration=calibration;
raw.calibration_starting_rates=startingRates;
fs.writeFileSync(rawFile,JSON.stringify(raw,null,2)+'\n');
for(const {record,samples,sampleRate} of preparedClips)writeWav(outputChild(dir,record.file),[samples],sampleRate);
// ---- 3) voice timeline: scene clips leveled to one loudness at narration.start_s, then the finishing chain and room,
//      peak -6 dBFS, 48 kHz mono. Gain, filters and the room add no delay, so caption timing is unchanged.
const sr = result.scenes[0].sample_rate, voiceTrack = new Float32Array(Math.ceil(D * sr));
const finishing = { version: 'voice-finish-v1', target_lufs: VOICE_TARGET_LUFS, room: { rt60_s: 0.3, mix: 0.1 }, scenes: [] };
for (const sc of story.scenes) {
  const rec = result.scenes.find((x) => x.id === sc.id);
  if (rec.sample_rate !== sr) throw new Error(`${sc.id}: narration sample rates differ`);
  const x = readWav(outputChild(dir, rec.file)).channels[0], level = levelTo(x, sr), at = Math.round(sc.narration.start_s * sr);
  const clip = x.subarray(0, Math.max(0, voiceTrack.length - at));
  for (let i = 0; i < clip.length; i++) voiceTrack[at + i] = clip[i] * level.gain;
  finishing.scenes.push({ id: sc.id, measured_lufs: +level.lufs.toFixed(2), gain_db: +level.gainDb.toFixed(2) });
}
const chainStats = {};
const finished = addRoom(voiceChain(voiceTrack, sr, chainStats), sr, { mix: finishing.room.mix, rt60: finishing.room.rt60_s });
let pk = 0; for (const v of finished) pk = Math.max(pk, Math.abs(v));
if (!Number.isFinite(pk) || pk === 0) throw new Error('Narration timeline contains no finite audible samples');
for (let i = 0; i < finished.length; i++) finished[i] *= 0.5 / pk;
finishing.de_ess_db = +chainStats.deEssDb.toFixed(2); finishing.compression_db = +chainStats.compressionDb.toFixed(2);
result.finishing = finishing;
const levels = finishing.scenes.map((x) => x.measured_lufs);
console.log(`voice finishing: scenes ${Math.min(...levels).toFixed(1)}..${Math.max(...levels).toFixed(1)} LUFS leveled to ${VOICE_TARGET_LUFS}; de-ess ${finishing.de_ess_db} dB, compression ${finishing.compression_db} dB mean reduction; room RT60 ${finishing.room.rt60_s}s`);
fs.writeFileSync(outputChild(dir, 'narration.json'), JSON.stringify(result, null, 2) + '\n');
const tmp = outputChild(dir, 'narration-timeline.wav'), out = outputChild(dir, 'narration.wav');
writeWav(tmp, [finished], sr);
const ff = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', tmp, '-af', 'aresample=48000', '-ar', '48000', '-ac', '1', '-t', String(D), out], { stdio: 'inherit' });
if (ff.status !== 0) { console.error('ffmpeg failed to write narration.wav'); process.exit(1); }
fs.rmSync(tmp, { force: true });
console.log(`wrote ${path.relative(ROOT, path.join(dir, 'narration.json'))} and ${path.relative(ROOT, out)} (${D}s, 48 kHz mono)`);
