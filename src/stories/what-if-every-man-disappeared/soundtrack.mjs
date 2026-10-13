import {SR,NOTE,rng,stereo,mixStereo,mixMono,pad,tone,noise,filter,shape,envAR,automate,smooth,dB} from '../../library/audio/synth.mjs';
/** Original restrained ambient score and wholly synthesized illustrative environmental sounds. */
export function buildSoundtrack(duration){const music=stereo(duration),sfx=stereo(duration),random=rng(4075);
 for(const [at,dur,notes] of [[0,11,['D2','A2','D3','F3']],[10,9,['Bb2','F3','A3']],[18,9,['G2','D3','F3']],[26,10,['D2','A2','E3','F3']],[35,8,['Bb2','F3','C4']],[42,8,['G2','D3','A3']],[49,9,['F2','C3','A3']],[57,10,['Bb2','F3','A3']],[66,9,['D2','A2','D3','F3','E4']]])mixStereo(music,pad({freqs:notes.map(NOTE),dur,attack:2,release:2.2,bright:1.2,detune:4,seed:at+19}),at,.23);
 for(const [at,n] of [[6.7,'A4'],[19,'D4'],[35.7,'F4'],[49.1,'C5'],[54.5,'A4'],[66.8,'D4'],[71.8,'E4']])mixMono(music,shape(tone(3,NOTE(n)),t=>Math.exp(-t*1.8)*(1-Math.exp(-t*70))),at,.038,.1);
 const traffic=filter(noise(Math.ceil(duration*SR),random,'pink'),'lowpass',450),air=filter(noise(Math.ceil(duration*SR),random,'pink'),'highpass',1600);
 for(let i=0;i<traffic.length;i++){const t=i/SR;let g=t<6.7?.06*(1-.84*smooth(.6,2.2,t)):t>=11.9&&t<18.7?.038*(1-.9*smooth(13.7,17,t)):t>=18.7&&t<25.8?.022*(1-.5*smooth(20,23,t)):t>=35.5&&t<42.3?.03*(1-.84*smooth(35.8,38.6,t)):t>=69.4?.04*smooth(69.4,73.5,t):.002;
  traffic[i]*=g;air[i]*=t<6.7||t>65.8?.005:t>42.3&&t<48.6?.003:0;
 }mixMono(sfx,traffic,0);mixMono(sfx,air,0,1,.18);
 for(const at of [1.2,1.45,1.7]){const x=shape(filter(noise(Math.ceil(.35*SR),random),'lowpass',1300),t=>Math.exp(-t*27));mixMono(sfx,x,at,.034,at-1.5);}
 // Stylized bird calls, not species recordings or measured acoustic evidence.
 for(const at of [43.15,44.3,46.6,68.2,72.1]){const x=new Float32Array(.43*SR);for(let i=0;i<x.length;i++){const t=i/SR;x[i]=Math.sin(2*Math.PI*(2950*t+560*t*t+10*Math.sin(t*35)))*envAR(t,.43,.025,.07)*(.6+.4*Math.sin(t*35));}mixMono(sfx,x,at,.015,.25);}
 automate(music,t=>smooth(0,.25,t)*(1-.65*smooth(73.1,75,t)));return {music,sfx};}
