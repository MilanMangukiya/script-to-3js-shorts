import path from 'node:path';
import {spawnSync} from 'node:child_process';
// Caption-timing checks shared by the renderer's audiovisual preview: every captioned word must have finite,
// ordered, non-overlapping times inside its clip, so burned-in captions follow the real speech.
export function assertCaptionTiming(record) {
  const words = record?.words, duration = record?.duration_s;
  if (!Array.isArray(words) || !words.length) throw new Error(`${record?.id}: no caption words`);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`${record.id}: invalid clip duration`);
  let previousEnd = 0;
  for (const [index, word] of words.entries()) {
    const { start_s: start, end_s: end } = word;
    if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error(`${record.id}: word ${index + 1} has non-finite timing`);
    if (start < 0 || end > duration + 1e-6 || end <= start) throw new Error(`${record.id}: word ${index + 1} (${word.text}) lies outside its clip or has no positive duration`);
    if (start < previousEnd - 1e-6) throw new Error(`${record.id}: word ${index + 1} (${word.text}) overlaps the previous word`);
    previousEnd = end;
  }
}

/** The contract supplies bands for the opening and reflective payoff, not every energy label. */
export function cadencePolicy(scene,sceneIndex=0) {
  if(scene.id==='S01'||scene.start_s<25||(scene.id===undefined&&sceneIndex===0))return {min_wpm:148,max_wpm:160,target_wpm:154,reason:'opening first 25 seconds'};
  if(scene.narration?.pacing_energy==='reflective_payoff')return {min_wpm:125,max_wpm:135,target_wpm:130,reason:'reflective payoff'};
  return null;
}
export function assessCadence(scene,duration_s,{band=cadencePolicy(scene),wordCount}={}) {
  const word_count=wordCount??scene.narration.text.split(/\s+/).filter(Boolean).length;
  const available_s=Math.min(scene.narration.end_s,scene.end_s-.15)-scene.narration.start_s;
  const required_wpm=word_count*60/available_s,wpm=word_count*60/duration_s;
  const feasible=Number.isFinite(available_s)&&available_s>0&&(!band||required_wpm<=band.max_wpm+1e-6);
  const overrun_s=Math.max(0,duration_s-available_s);
  const cadence_ok=!band||(wpm>=band.min_wpm-1e-6&&wpm<=band.max_wpm+1e-6);
  const fit_ok=Number.isFinite(duration_s)&&duration_s>0&&overrun_s<=1e-6;
  return {word_count,wpm,available_s,required_wpm,overrun_s,band,cadence_ok,fit_ok,feasible,
    reason:!feasible?`${scene.id}: ${word_count} words need at least ${(word_count*60/(band?.max_wpm??required_wpm)).toFixed(3)}s but the fixed narration/scene slot permits ${available_s.toFixed(3)}s; revise the approved timing or text`:null};
}
export function nextCalibrationRate(rate,assessment) {
  if(!assessment.feasible)return null;
  const {band,required_wpm,wpm}=assessment;
  const target=band?Math.min(band.max_wpm,Math.max(band.target_wpm,required_wpm*1.002)):required_wpm*1.015;
  const next=+Math.max(.5,Math.min(1.2,rate*target/wpm)).toFixed(4);
  return Number.isFinite(next)&&Math.abs(next-rate)>=.0001?next:null;
}
export function assessNarrationQuality({raw,record,samples,sampleRate,scene,evidence,band=cadencePolicy(scene)}) {
  const reasons=[];
  let timing_ok=true;
  try{assertCaptionTiming(record);}catch(error){timing_ok=false;reasons.push(error.message);}
  const recognition=record.recognition??{lexical_ok:false};
  if(!recognition.lexical_ok)reasons.push(`${record.id}: recognition does not verify the exact script`);
  let peak=0,finite=true,full_scale_samples=0;
  for(const value of samples){finite&&=Number.isFinite(value);peak=Math.max(peak,Math.abs(value));if(Math.abs(value)>=32767/32768)full_scale_samples++;}
  const source={finite,peak,full_scale_samples,ok:finite&&peak>0&&peak<=10**(-1/20)+2/32768&&full_scale_samples===0,measurement:raw?.source_measurement??null};
  if(!source.ok)reasons.push(`${record.id}: source speech needs finite, nonempty samples with -1 dBFS headroom before PCM conversion`);
  const cadence=assessCadence(scene,record.duration_s,{band});
  if(!cadence.feasible)reasons.push(cadence.reason);
  else if(!cadence.cadence_ok||!cadence.fit_ok)reasons.push(`${record.id}: measured ${cadence.wpm.toFixed(1)} WPM${band?`, required ${band.min_wpm}-${band.max_wpm}`:''}; duration ${record.duration_s.toFixed(3)}s versus ${cadence.available_s.toFixed(3)}s slot`);
  const audible=samples.findIndex(value=>Math.abs(value)>.006),audible_start_s=scene.narration.start_s+audible/sampleRate;
  const onset={audible_start_s,ok:audible>=0&&(scene.id!=='S01'||audible_start_s<=.08+1/sampleRate)};
  if(!onset.ok)reasons.push(`${record.id}: audible hook must begin by 0.08s`);
  return {ok:reasons.length===0,reasons,recognition,timing:{ok:timing_ok},source,cadence,onset};
}
const stable=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]))):value;
export const provenanceEqual=(a,b)=>!!a&&!!b&&JSON.stringify(stable(a))===JSON.stringify(stable(b));
/** Probe actual files/runtime before any Node cache shortcut, without loading the speech models. */
export function readNarrationProvenance(root,{python=process.env.PYTHON??'python',deps,storyFile}={}) {
  const args=[path.join(root,'tools/narrate-cached.py'),...(storyFile?[storyFile]:[]),'--fingerprint',...(deps?['--deps',deps]:[])];
  const result=spawnSync(python,args,{encoding:'utf8',maxBuffer:8*1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1',HF_HUB_OFFLINE:'1'}});
  if(result.error||result.status!==0)throw new Error(`Cannot verify local narration provenance: ${result.error?.message??result.stderr}`);
  return JSON.parse(result.stdout);
}
