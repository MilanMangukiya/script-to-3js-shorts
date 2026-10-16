import { type FilmDefinition, type Stage } from '../../library/render/FilmPipeline';
import { loadEarthTextures } from '../../library/planet/Earth';
import { renderShotHudTelemetry } from '../../library/overlay/Labels';
import { BedroomStage, GlobeStage, RouteStage } from './stages';
import story from '../../../stories/sun-locked-earth.json';
import { T } from './timeline';
export async function createFilm(ctx:{renderer:import('three').WebGLRenderer;base:string}):Promise<FilmDefinition>{
  const globe=new GlobeStage(await loadEarthTextures(ctx.base,4)),room=new BedroomStage(ctx.renderer),route=new RouteStage(ctx.renderer);
  const stages:Stage[]=[room,globe,route,globe,route,route,route,room];
  return {shots:Object.fromEntries(story.scenes.flatMap((s,i)=>s.shots.map(sh=>[`${s.id}/${sh.id}`,{stage:sh.id==='SH02'?route:stages[i],post:{exposure:1,bloomStrength:.12,bloomThreshold:1.25,vignette:.16,grain:.003,saturation:1.02,contrast:1.01}}]))),overlay(o){
    const spec=story.scenes.find(s=>s.id===o.shot.sceneId)!.shots.find(sh=>sh.id===o.shot.shotId)!;let telemetry=spec.hud_telemetry;
    if(o.shot.sceneId==='S04')telemetry={...telemetry,timer_label:o.time_s<T.heatReveal?'NIGHT SIDE':'HEAT CAN CROSS',metric_label:'SUN AT BOUNDARY'};
    if(['S03','S05','S06','S07'].includes(o.shot.sceneId)){const v=o.shot.sceneId==='S05'?0:route.sunAltitude;telemetry={...telemetry,start_value:v,end_value:v};}
    renderShotHudTelemetry(o.ctx,{x:90,y:240,telemetry,time_s:o.time_s,shotStart_s:o.shot.start_s,shotEnd_s:o.shot.end_s,alpha:o.alpha});
  }};
}
