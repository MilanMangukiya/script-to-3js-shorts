import { SR, NOTE, rng, stereo, mixStereo, mixMono, pad, tone, noise, filter, shape, envAR, automate, reverb, dB } from '../../library/audio/synth.mjs';

/** Original E-minor ambient score, surf, frost and deep-water textures. */
export function buildSoundtrack(duration) {
  const music=stereo(duration),sfx=stereo(duration),random=rng(198723);
  const chords=[
    [0,7,['E2','B2','E3','G3','B3']],[6,7,['C3','G3','E4','G4']],[13,7,['G2','D3','G3','B3']],[20,8,['E2','B2','E3','G3']],
    [28,10,['C3','G3','B3','E4']],[38,8,['A2','E3','A3','C4']],[46,8,['G2','D3','G3','B3']],[53,9,['E2','B2','D3','G3']],
    [62,8,['C3','G3','B3','E4']],[69,5,['E2','B2','E3','G#3','B3']]
  ];
  for(const [at,dur,notes] of chords)mixStereo(music,pad({freqs:notes.map(NOTE),dur,attack:1.8,release:2.2,bright:1.4,detune:5,seed:Math.round(at)+4}),at,.26);
  for(const [at,n] of [[2,'E5'],[10.2,'B4'],[17,'G5'],[24,'E4'],[31,'B4'],[45,'E5'],[58,'G4'],[66,'B5'],[71.8,'E5']]){
    const x=tone(2.2,NOTE(n));mixMono(music,shape(x,t=>Math.exp(-t*2.2)*(1-Math.exp(-t*100))),at,.055,(at%3-1)*.25);
  }
  const sea=filter(noise(Math.ceil(duration*SR),random,'pink'),'lowpass',550);
  const low=filter(noise(Math.ceil(duration*SR),random,'brown'),'lowpass',160);
  for(let i=0;i<sea.length;i++){const t=i/SR,coast=t<4.2||t>68.8||t>11.7&&t<19.1||t>37.5&&t<45;
    sea[i]*=coast?.05*(.4+.6*Math.pow(.5+.5*Math.sin(t*1.1),2)):0;
    low[i]*=t>52.5&&t<60.9?.015:0;
  }
  mixMono(sfx,sea,0,1,-.12);mixMono(sfx,low,0,1,0);
  for(const [at,dur] of [[.7,1.4],[9.9,1.2],[61.7,3.1],[65.5,2.8]]){
    const x=filter(noise(Math.ceil(dur*SR),random,'white'),'highpass',1900);
    mixMono(sfx,shape(x,t=>Math.sin(Math.PI*t/dur)**2),at,dB(-28),.25);
  }
  automate(music,t=>t>72?1-(t-72)/2:1);
  return {music,sfx};
}
