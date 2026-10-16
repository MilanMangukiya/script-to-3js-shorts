import * as THREE from 'three';
import events from './timeline.json';
export const T = events;
export const unit = (x: number) => Math.max(0, Math.min(1, x));
export const ramp = (t: number, a: number, b: number) => { const u = unit((t-a)/(b-a)); return u*u*(3-2*u); };
/** Canonical fixed point before the shared rig's quantized environment-cache key. */
export function canonicalSun(v: THREE.Vector3): THREE.Vector3 {
  let n=v.clone().normalize(), prior='';
  for(let k=0;k<16;k++) { const a=n.toArray().map(x=>+x.toFixed(2)), key=a.join(','); n=new THREE.Vector3(...a as [number,number,number]).normalize(); if(key===prior)return n; prior=key; }
  throw new Error('Noncanonical sun');
}
export const localSun = (alt: number) => canonicalSun(new THREE.Vector3(0,Math.sin(alt*Math.PI/180),-Math.cos(alt*Math.PI/180)));
export const roadAltitude = (t:number) => 8*(1-ramp(t,T.road0,T.road1));
