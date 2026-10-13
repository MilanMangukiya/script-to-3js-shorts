import {SR,NOTE,rng,stereo,mixStereo,mixMono,pad,tone,noise,filter,shape,envAR,automate,dB,smooth,crackle} from '../../library/audio/synth.mjs';
/** Original calm C minor / Ab ambient score with restrained wind, ice and UV textures. */
export function buildSoundtrack(D){
  const music=stereo(D),sfx=stereo(D),random=rng(1090235);
  const chords=[[0,11.5,['C2','G2','Eb3','G3']],[11.5,27,['Ab1','Eb2','C3','G3']],[27,42.5,['F2','C3','Ab3']],[42.5,57.5,['C2','G2','D3','Eb3']],[57.5,D,['Ab2','Eb3','G3','C4']]];
  chords.forEach(([a,b,notes],i)=>mixStereo(music,pad({freqs:notes.map(NOTE),dur:b-a+2,attack:2,release:2.5,bright:.7,detune:4,seed:10+i}),a,.24));
  for(const [t,n] of [[.6,'G4'],[4.8,'Eb5'],[8.4,'C5'],[12.2,'G4'],[19.8,'Ab4'],[27.5,'F4'],[35,'C5'],[43,'Eb5'],[51,'G5'],[58,'C5'],[61,'G4']])mixMono(music,shape(tone(3,NOTE(n)),u=>Math.exp(-u*1.5)*(1-Math.exp(-u*45))),t,.025,Math.sin(t)*.3);
  const window=(a,b,t)=>smooth(a,a+.5,t)*(1-smooth(b-.5,b,t));
  const air=filter(filter(noise(Math.ceil(D*SR),random,'pink'),'highpass',240),'lowpass',2100);
  for(let i=0;i<air.length;i++){const t=i/SR;air[i]*=(window(4.5,8.2,t)*.24+window(23.3,34.5,t)*.35+window(34.5,42.5,t)*.18)*( .8+.2*Math.sin(t*.7));}
  mixMono(sfx,air,0,dB(-24),-.15);
  const ice=crackle(3.7,8,random,{lo:350,hi:2200});mixMono(sfx,ice,23.3,dB(-30),.2);
  mixMono(sfx,shape(tone(2.8,t=>60-8*t),t=>envAR(t,2.8,.8,1.2)),.8,dB(-28));
  for(let i=0;i<6;i++)mixMono(sfx,shape(tone(.7,1400+i*190),t=>envAR(t,.7,.05,.5)),51.2+i*.6,dB(-34),i%2?.2:-.2);
  automate(music,t=>smooth(0,1,t)*(1-smooth(D-.8,D,t)));
  return {music,sfx};
}
