import fs from 'node:fs';
import { SR,NOTE,rng,pad,tone,noise,filter,shape,envAR,smooth,createStereoBuffer,mixIn,applyPreImpactVacuum } from '../../library/audio/synth.mjs';
const T=JSON.parse(fs.readFileSync(new URL('./timeline.json',import.meta.url),'utf8'));
const current=b=>({sampleRate:b.sr,length:b.L.length,left:b.L,right:b.R});
/** Original nocturnal discovery score: a search, an energy setback and a controlled night. */
export function buildSoundtrack(D,story){
 const music=createStereoBuffer(D),sfx=createStereoBuffer(D),random=rng(82371);
 const chords=[['E3','B3','G4'],['C3','G3','D4'],['A2','E3','B3'],['D3','A3','F4'],['B2','F3','A3'],['G3','B3','D4'],['A2','E3','G4'],['E3','B3','G4']];
 story.scenes.forEach((sc,i)=>mixIn(music,current(pad({freqs:chords[i].map(NOTE),dur:sc.end_s-sc.start_s+.55,attack:i?.35:.025,release:.55,detune:1.8,bright:.8,harmonics:2,seed:702+i})),sc.start_s,.19));
 const pluck=(note,d=.55)=>{
  const b=new Float32Array(Math.ceil(d*SR)),f=NOTE(note);
  for(const [r,g]of[[1,1],[2,.19],[3,.055]]){const x=tone(d,f*r);for(let i=0;i<b.length;i++){const t=i/SR;b[i]+=x[i]*g*(1-Math.exp(-t*400))*Math.exp(-t*(7+r))*(1-smooth(d-.04,d,t));}}
  return b;
 };
 const motif=[[.04,'E5'],[1.8,'B4'],[3.4,'G4'],[5.7,'D5'],[8.2,'E5'],[10.2,'B4'],[12,'A4'],[13.6,'E5'],[15.1,'B4'],[18.6,'F5'],[20.7,'A4'],[22.4,'D5'],[24.2,'B4'],[26.9,'F4'],[29.2,'G4'],[31.3,'B4'],[33.3,'D5'],[35.2,'A4'],[38.6,'E5'],[40.7,'E5'],[43,'B4'],[45.4,'G4'],[47.2,'E5']];
 motif.forEach(([at,n],i)=>mixIn(music,pluck(n),at,.12,Math.sin(i*1.2)*.2));
 // Motion pulse belongs to the finite drive, with no survival countdown.
 for(let at=11.25;at<15.8;at+=.8)mixIn(music,pluck('A3',.28),at,.075,-.1);
 const air=filter(noise(Math.ceil(D*SR),random,'pink'),'lowpass',650);
 for(let i=0;i<air.length;i++){const t=i/SR;air[i]*=t>=34.5&&t<40.5?.014:.006;}mixIn(music,air,0,1);
 const click=(at,g=.08,p=0)=>mixIn(sfx,shape(filter(noise(Math.ceil(.06*SR),random,'white'),'bandpass',2200,1),t=>Math.exp(-t*110)),at,g,p);
 click(T.openingPress,.09,-.35);click(T.closingPress,.09,-.35);
 for(const[a,b]of[[T.open0,T.open1],[T.close0,T.close1]]){
  const d=b-a,x=filter(noise(Math.ceil(d*SR),random,'pink'),'bandpass',420,.7);
  for(let i=0;i<x.length;i++){const t=i/SR;x[i]*=envAR(t,d,.08,.14)*.055;}mixIn(sfx,x,a,1,-.25);click(b,.07,-.25);
 }
 const motor=(a,b,g)=>{
  const d=b-a,x=tone(d,94),n=filter(noise(Math.ceil(d*SR),random,'pink'),'lowpass',480);
  for(let i=0;i<x.length;i++){const t=i/SR,env=smooth(0,.3,t)*(1-smooth(d-.8,d,t));x[i]=(x[i]*.022+n[i]*.055)*env;}mixIn(sfx,x,a,g,.05);click(b,.055,.1);
 };
 motor(T.road0,T.road1,1);motor(T.arrival0,T.arrival1,.8);
 mixIn(sfx,pluck('D6',.85),T.heatReveal,.10);
 click(T.porchOn,.07,.3);mixIn(sfx,pluck('B5',.5),T.porchOn+.10,.06,.3);
 for(const sc of story.scenes)for(const cue of sc.audio_cues??[])if(cue.kind==='silence')applyPreImpactVacuum(sfx,{at_s:cue.at_s,duration_s:cue.duration_s,duckDb:cue.relative_db??-24});
 for(let i=0;i<music.length;i++){const t=i/SR,g=smooth(0,.02,t)*(1-smooth(D-.18,D,t));music.left[i]*=g;music.right[i]*=g;sfx.left[i]*=g;sfx.right[i]*=g;}
 return{music,sfx};
}
