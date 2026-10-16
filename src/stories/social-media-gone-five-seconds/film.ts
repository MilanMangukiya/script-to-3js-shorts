import { type FilmDefinition } from '../../library/render/FilmPipeline';
import { renderShotHudTelemetry } from '../../library/overlay/Labels';
import { ReactionStage } from './stage';
import { type City,cities,names,localSeconds } from './timeline';
import story from '../../../stories/social-media-gone-five-seconds.json';
export async function createFilm(ctx:{renderer:import('three').WebGLRenderer;base:string}):Promise<FilmDefinition>{
 const stages=new Map<City,ReactionStage>();for(const city of new Set(cities))stages.set(city,new ReactionStage(city,ctx.renderer));
 return{shots:Object.fromEntries(story.scenes.flatMap((s,i)=>s.shots.map(sh=>[`${s.id}/${sh.id}`,{stage:stages.get(cities[i])!,post:{exposure:1,bloomStrength:.10,bloomThreshold:1.3,vignette:.13,grain:.003,saturation:1.04,contrast:1.01}}]))),overlay(o){
  const i=story.scenes.findIndex(s=>s.id===o.shot.sceneId),city=cities[i],sh=story.scenes[i].shots.find(s=>s.id===o.shot.shotId)!;
  const value=localSeconds(city,o.time_s);const telemetry={...sh.hud_telemetry,timer_label:`${names[city]} / ${value.toFixed(2)} s / 2026`,metric_label:'SAME WINDOW',start_value:5,end_value:5,unit:'s'};
  renderShotHudTelemetry(o.ctx,{x:90,y:240,telemetry,time_s:o.time_s,shotStart_s:o.shot.start_s,shotEnd_s:o.shot.end_s,alpha:o.alpha});
 }};
}
