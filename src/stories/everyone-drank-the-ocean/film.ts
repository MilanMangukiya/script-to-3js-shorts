import * as THREE from 'three';
import {type FilmDefinition} from '../../library/render/FilmPipeline';
import {renderEditorialHud} from '../../library/overlay/Labels';
import {CoastStage,PoolStage,TankStage} from './stages';
import {N,T,DROP_NM,MM_EACH_L,FULL_EACH_L,intake,ramp} from './timeline';
import story from '../../../stories/everyone-drank-the-ocean.json';
export async function createFilm(ctx:{renderer:THREE.WebGLRenderer;base:string}):Promise<FilmDefinition>{
 const coast=new CoastStage(ctx.renderer),pools=new PoolStage(ctx.renderer),small=new TankStage(ctx.renderer),big=new TankStage(ctx.renderer,true),stages=[coast,coast,pools,coast,small,big,coast,coast];
 return{shots:Object.fromEntries(story.scenes.flatMap((sc,i)=>sc.shots.map(sh=>[`${sc.id}/${sh.id}`,{stage:stages[i],post:{exposure:1,bloomStrength:.12,bloomThreshold:1.2,vignette:.12,grain:.003,saturation:1.05,contrast:1.02}}]))),overlay(o){
  const i=Number(o.shot.sceneId.slice(1))-1,t=o.time_s,fmt=(x:number)=>Math.round(x).toLocaleString('en-US');
  const hud=[
   {label:'PEOPLE DRINKING',value:'8.3 BILLION',sub:'ONE LITER PER PERSON'},
   {label:'WATER TAKEN TOGETHER',value:`${(N*intake(t)/1e9).toFixed(1)} BILLION L`,sub:'8.3 BILLION PEOPLE x 1 L'},
   {label:'POOL EQUIVALENTS',value:fmt(3320*ramp(t,T.pool0,T.pool1)),sub:'EACH POOL: 50 x 25 x 2 M'},
   t<T.meanReveal?{label:'WATER TAKEN TOGETHER',value:'8.3 BILLION L',sub:'SPREAD OVER THE OCEAN'}:{label:'AVERAGE SEA LEVEL DROP',value:'23 nm',sub:'AFTER ONE LITER EACH'},
   {label:t<T.small1?'PERSONAL TANK FILL':'FOR ONE MILLIMETER LOWER',value:`${fmt(Math.round(MM_EACH_L*ramp(t,T.small0,T.small1)/100)*100)} L`,sub:t<T.small1?'TARGET: 43,600 L FOR 1 mm':'REQUIRED FROM EACH PERSON'},
   {label:'TO EMPTY THE OCEAN',value:'161 BILLION L',sub:'REQUIRED FROM EACH PERSON'},
   {label:'SEAWATER SALT BY MASS',value:'ABOUT 3.5%',sub:'THE HUMAN BOTTLENECK'},
   {label:'AVERAGE SEA LEVEL DROP',value:'23 nm',sub:'8.3 BILLION ONE-LITER DRINKS'}
  ][i];
  renderEditorialHud(o.ctx,{x:90,y:240,...hud,valueSize:hud.value.length>11?82:104,labelSize:25,tracking:.18,alpha:o.alpha});
 }};
}
