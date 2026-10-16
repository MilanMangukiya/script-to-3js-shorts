import {SR,NOTE,rng,pad,tone,noise,filter,shape,envAR,smooth,createStereoBuffer,mixIn,applyPreImpactVacuum} from '../../library/audio/synth.mjs';
const current=b=>({sampleRate:b.sr,length:b.L.length,left:b.L,right:b.R});
export function buildSoundtrack(D,story){
 const music=createStereoBuffer(D),sfx=createStereoBuffer(D),random=rng(20265);
 const pluck=(n,d=.25)=>shape(tone(d,NOTE(n)),t=>(1-Math.exp(-t*400))*Math.exp(-t*18)*(1-smooth(d-.03,d,t)));
 const chords=[['E3','B3','G4'],['D3','A3','E4'],['G3','D4','A4'],['C3','G3','E4'],['A2','E3','C4'],['D3','A3','F4'],['B2','F3','A3'],['E3','B3','G4']];
 story.scenes.forEach((sc,i)=>{mixIn(music,current(pad({freqs:chords[i].map(NOTE),dur:sc.end_s-sc.start_s+.3,attack:.03,release:.30,detune:1.1,bright:.6,harmonics:2,seed:100+i})),sc.start_s,.12);for(let t=sc.start_s+.02,n=0;t<sc.end_s;t+=.42,n++)mixIn(music,pluck(['E5','B4','G5','D5'][n%4]),t,n%2?.045:.065,Math.sin(n)*.15);});
 const click=(t,g=.06)=>mixIn(sfx,shape(filter(noise(Math.ceil(.05*SR),random,'white'),'bandpass',1800,1.1),u=>Math.exp(-u*115)),t,g);
 const at=(a,b,s)=>a+(b-a)*s/4.9;
 [at(11.4,17.6,.65),at(11.4,17.6,2.85),at(30,36.2,2.2),at(30,36.2,3.45),at(36.2,49,2.75)].forEach(t=>click(t));
 click(24,.035);mixIn(sfx,shape(tone(.25,u=>450+u*1300),u=>envAR(u,.25,.01,.2)),28.2,.035,.3);
 const sms=at(30,36.2,3.6);mixIn(sfx,pluck('E6',.24),sms,.045);mixIn(sfx,pluck('B5',.25),sms+.13,.035);
 const room=filter(noise(Math.ceil(D*SR),random,'pink'),'lowpass',400);mixIn(music,room,0,.003);
 for(const sc of story.scenes)for(const cue of sc.audio_cues??[])if(cue.kind==='silence')applyPreImpactVacuum(sfx,{at_s:cue.at_s,duration_s:cue.duration_s,duckDb:cue.relative_db??-24});
 for(let i=0;i<music.length;i++){const t=i/SR,g=smooth(0,.02,t)*(1-smooth(D-.15,D,t));music.left[i]*=g;music.right[i]*=g;sfx.left[i]*=g;sfx.right[i]*=g;}
 return{music,sfx};
}
