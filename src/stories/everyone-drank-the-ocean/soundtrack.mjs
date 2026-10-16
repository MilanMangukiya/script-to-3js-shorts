import fs from 'node:fs';
import {SR,NOTE,rng,pad,tone,noise,filter,shape,envAR,smooth,createStereoBuffer,mixIn,applyPreImpactVacuum} from '../../library/audio/synth.mjs';
const current=b=>({sampleRate:b.sr,length:b.L.length,left:b.L,right:b.R});
export function buildSoundtrack(D,story){
 const music=createStereoBuffer(D),sfx=createStereoBuffer(D),random=rng(83001);
 const pluck=(n,d=.38)=>shape(tone(d,NOTE(n)),t=>(1-Math.exp(-t*500))*Math.exp(-t*11)*(1-smooth(d-.03,d,t)));
 const chords=[['D3','A3','E4'],['G3','B3','D4'],['A2','E3','G4'],['B2','F3','A3'],['C3','G3','E4'],['A2','E3','B3'],['G3','D4','A4'],['D3','A3','F4']];
 story.scenes.forEach((sc,i)=>{mixIn(music,current(pad({freqs:chords[i].map(NOTE),dur:sc.end_s-sc.start_s+.4,attack:.03,release:.4,detune:1.3,bright:.6,harmonics:2,seed:830+i})),sc.start_s,.15);for(let t=sc.start_s+.02,j=0;t<sc.end_s;t+=.56,j++)mixIn(music,pluck(['D5','A4','E5','F5'][j%4]),t,j%2?.055:.075,Math.sin(j*.8)*.2);});
 const air=filter(noise(Math.ceil(D*SR),random,'pink'),'lowpass',600);for(let i=0;i<air.length;i++)air[i]*=.008*(.8+.2*Math.sin(i/SR*.7));mixIn(music,air,0,1);
 // Quiet intake bubbles belong to the finite shared drink, not to a planet-draining vortex.
 for(let t=.85;t<9.4;t+=.38){const d=.12;mixIn(sfx,shape(tone(d,u=>210+u*1300),u=>envAR(u,d,.015,.08)),t,.04,Math.sin(t)*.2);}
 const contact=at=>mixIn(sfx,shape(filter(noise(Math.ceil(.08*SR),random,'white'),'bandpass',1300,.7),u=>Math.exp(-u*70)),at,.09);
 contact(.3);contact(37.5);contact(39);
 const water=filter(noise(Math.ceil(1.900000*SR),random,'pink'),'bandpass',700,.8);for(let i=0;i<water.length;i++)water[i]*=.025*envAR(i/SR,1.900000,.2,.3);mixIn(sfx,water,11.5,1);
 let reveal=20.5;try{const n=JSON.parse(fs.readFileSync(new URL('../../../build/everyone-drank-the-ocean/audio/narration.json',import.meta.url),'utf8'));const sc=n.scenes.find(x=>x.id==='S04'),word=sc.words.find(x=>x.text.toLowerCase()==='twenty');if(word)reveal=story.scenes[3].start_s+word.start_s;}catch{}
 mixIn(sfx,pluck('D6',.55),reveal,.18,-.1);mixIn(sfx,pluck('A5',.45),reveal+.18,.10,.1);
 for(const at of [23.6,27.5,29.6,32.4])mixIn(sfx,pluck('G4',.3),at,.075);
 for(const sc of story.scenes)for(const cue of sc.audio_cues??[])if(cue.kind==='silence')applyPreImpactVacuum(sfx,{at_s:cue.at_s,duration_s:cue.duration_s,duckDb:cue.relative_db??-24});
 for(let i=0;i<music.length;i++){const t=i/SR,g=smooth(0,.02,t)*(1-smooth(D-.15,D,t));music.left[i]*=g;music.right[i]*=g;sfx.left[i]*=g;sfx.right[i]*=g;}
 return{music,sfx};
}
