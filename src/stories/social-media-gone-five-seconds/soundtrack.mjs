import fs from 'node:fs';
import { SR,NOTE,rng,pad,tone,noise,filter,shape,envAR,smooth,createStereoBuffer,mixIn,applyPreImpactVacuum } from '../../library/audio/synth.mjs';
const T=JSON.parse(fs.readFileSync(new URL('./timeline.json',import.meta.url),'utf8'));
const current=b=>({sampleRate:b.sr,length:b.L.length,left:b.L,right:b.R});
/** Original small comic thriller; digital attention yields to a real supported rescue. */
export function buildSoundtrack(D,story){
 const music=createStereoBuffer(D),sfx=createStereoBuffer(D),random=rng(96221);
 const chords=[['D3','A3','E4'],['C3','G3','D4'],['A2','E3','G4'],['B2','F3','A3'],['F3','C4','A4'],['G3','B3','D4'],['A2','E3','B3'],['D3','A3','F4']];
 story.scenes.forEach((sc,i)=>mixIn(music,current(pad({freqs:chords[i].map(NOTE),dur:sc.end_s-sc.start_s+.6,attack:i?.3:.02,release:.6,detune:1.5,bright:.65,harmonics:2,seed:521+i})),sc.start_s,.17));
 const pluck=(n,d=.45)=>{const b=new Float32Array(Math.ceil(d*SR));for(const[r,g]of[[1,1],[2,.18],[3,.05]]){const x=tone(d,NOTE(n)*r);for(let i=0;i<b.length;i++){const t=i/SR;b[i]+=x[i]*g*(1-Math.exp(-t*450))*Math.exp(-t*(8+r))*(1-smooth(d-.04,d,t));}}return b;};
 const motif=[[.03,'D5'],[.42,'A5'],[.80,'E5'],[3.7,'A4'],[5.8,'C5'],[8.7,'G4'],[10.2,'D5'],[12.5,'E5'],[14.6,'A4'],[17.2,'B4'],[19.1,'F4'],[20.3,'A4'],[21.5,'B4'],[22.6,'F5'],[T.catch+.1,'A5'],[26.2,'F5'],[28.2,'C5'],[30,'G4'],[32.2,'B4'],[34.4,'D5'],[T.restored+.05,'E5'],[40.4,'B4'],[42.2,'D5'],[45.1,'A4'],[47.2,'D5']];
 motif.forEach(([at,n],i)=>mixIn(music,pluck(n),at,.105,Math.sin(i*.9)*.2));
 const room=filter(noise(Math.ceil(D*SR),random,'pink'),'lowpass',550);for(let i=0;i<room.length;i++)room[i]*=.005;mixIn(music,room,0,1);
 const tick=(at,g=.08,p=0)=>{mixIn(sfx,shape(filter(noise(Math.ceil(.045*SR),random,'white'),'bandpass',2200,1.2),t=>Math.exp(-t*135)),at,g,p);mixIn(sfx,shape(tone(.065,380),t=>envAR(t,.065,.001,.05)),at,g*.28,p);};
 for(const at of [.6,T.cameraOn-.05,T.smsOn-.05,T.retry0])tick(at,.075,-.15);
 // Scrape is localized to the visible sliding inserts, not an eighteen-second foreground drone.
 for(const[a,b]of[[3.6,5.35],[17,T.edge]]){const d=b-a,x=filter(noise(Math.ceil(d*SR),random,'pink'),'bandpass',900,.6);for(let i=0;i<x.length;i++)x[i]*=.045*envAR(i/SR,d,.10,.18);mixIn(sfx,x,a,1,.3);}
 tick(T.grip,.045,.3);mixIn(sfx,pluck('F6',.60),T.catch,.095,.25);
 tick(T.cupDown,.10,.2);mixIn(sfx,shape(tone(.12,640),t=>Math.exp(-t*35)),T.cupDown,.018,.2);
 // A restrained device return, rather than a global alarm or an invented notification flood.
 mixIn(sfx,pluck('D6',.35),T.restored,.075,-.15);mixIn(sfx,pluck('A5',.35),T.restored+.12,.055,-.15);
 tick(T.phoneDown1,.105,-.15);
 for(const sc of story.scenes)for(const cue of sc.audio_cues??[])if(cue.kind==='silence')applyPreImpactVacuum(sfx,{at_s:cue.at_s,duration_s:cue.duration_s,duckDb:cue.relative_db??-24});
 for(let i=0;i<music.length;i++){const t=i/SR,g=smooth(0,.02,t)*(1-smooth(D-.15,D,t));music.left[i]*=g;music.right[i]*=g;sfx.left[i]*=g;sfx.right[i]*=g;}
 return{music,sfx};
}
