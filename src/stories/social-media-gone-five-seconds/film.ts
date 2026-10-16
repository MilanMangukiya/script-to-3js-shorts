import { type FilmDefinition } from '../../library/render/FilmPipeline';
import { renderShotHudTelemetry } from '../../library/overlay/Labels';
import { CafeStage } from './stage';
import { T,outageSeconds } from './timeline';
import story from '../../../stories/social-media-gone-five-seconds.json';
export async function createFilm(ctx:{renderer:import('three').WebGLRenderer;base:string}):Promise<FilmDefinition>{
 const stage=new CafeStage(ctx.renderer);return {shots:Object.fromEntries(story.scenes.flatMap(s=>s.shots.map(sh=>[`${s.id}/${sh.id}`,{stage,post:{exposure:1,bloomStrength:.10,bloomThreshold:1.3,vignette:.15,grain:.003,saturation:1.04,contrast:1.01}}]))),overlay(o){
  const v=outageSeconds(o.time_s),spec=story.scenes.find(s=>s.id===o.shot.sceneId)!.shots.find(sh=>sh.id===o.shot.shotId)!;
  const telemetry={...spec.hud_telemetry,timer_label:o.time_s<T.outageOn?'POSTING / 2026':`2026 / ${o.time_s<T.restored?'GONE':'RESTORED'} ${v.toFixed(2)} s`,metric_label:'OUTAGE LIMIT',start_value:5,end_value:5};
  renderShotHudTelemetry(o.ctx,{x:90,y:240,telemetry,time_s:o.time_s,shotStart_s:o.shot.start_s,shotEnd_s:o.shot.end_s,alpha:o.alpha});
 }};
}
