import * as THREE from 'three';
import {type FilmDefinition} from '../../library/render/FilmPipeline';
import {renderEditorialHud} from '../../library/overlay/Labels';
import {StreetStage,OpenStage,EchoStage} from './stages';
import {T} from './timeline';
import story from '../../../stories/everyone-claps-at-once.json';
export async function createFilm(ctx:{renderer:THREE.WebGLRenderer;base:string}):Promise<FilmDefinition>{
 const street=new StreetStage(ctx.renderer),open=new OpenStage(ctx.renderer),echo=new EchoStage(ctx.renderer),stages=[street,street,street,street,street,open,echo,echo];
 return{shots:Object.fromEntries(story.scenes.flatMap((sc,i)=>sc.shots.map(sh=>[`${sc.id}/${sh.id}`,{stage:stages[i],post:{exposure:1,bloomStrength:.1,bloomThreshold:1.2,vignette:.1,grain:.003,saturation:1.04,contrast:1.02}}]))),overlay(o){
  const i=Number(o.shot.sceneId.slice(1))-1,t=o.time_s,elapsed=Math.max(0,Math.min(1000/343,(t-T.travel)*.5));
  const hud=[{label:'CLAPS PER PERSON',value:'1',sub:'8.3 BILLION PEOPLE • ONE INSTANT'},
   {label:'HANDS MEETING',value:'16.6 BILLION',sub:'SAME GLOBAL CLAP'},
   {label:'SPEED OF SOUND',value:'343 m/s',sub:'AIR NEAR 20°C • SLOW MOTION'},
   {label:'ELAPSED SINCE CLAP',value:`${elapsed.toFixed(2)} s`,sub:'SAME PULSE • 1 KM PATH • 0.5x'},
   {label:t<T.arrival?'ELAPSED SINCE CLAP':'SELECTED PULSE ARRIVES',value:`${elapsed.toFixed(2)} s`,sub:'1 KM PATH • SAME CLAP • 0.5x'},
   {label:'EACH DISTANCE DOUBLING',value:'−6 dB',sub:'ISOLATED SOURCE • NO REFLECTIONS'},
   {label:'WALL ROUND TRIP',value:'0.175 s',sub:'60 M PATH • SAME CLAP'},
   {label:'HUMAN CLAPS EACH',value:'STILL 1',sub:'THE WALL SUPPLIES THE ENCORE'}][i];
  renderEditorialHud(o.ctx,{...hud,x:90,y:240,valueSize:hud.value.length>10?84:104,labelSize:24,tracking:.12,alpha:o.alpha});
 }};
}
