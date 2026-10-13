import {SR,NOTE,rng,stereo,mixStereo,mixMono,pad,tone,noise,filter,shape,envAR,automate,dB,smooth} from '../../library/audio/synth.mjs';
/** Original D-minor documentary music and physical Foley synthesized without sampled media. */
export function buildSoundtrack(D){
 const music=stereo(D),sfx=stereo(D),r=rng(820300);
 [[0,11.5,['D2','A2','F3']],[11.5,26,['Bb1','F2','D3','A3']],[26,41.5,['G2','D3','F3']],[41.5,57.5,['D2','A2','E3','F3']],[57.5,D,['Bb2','F3','A3','D4']]].forEach(([a,b,ns],i)=>mixStereo(music,pad({freqs:ns.map(NOTE),dur:b-a+1.5,attack:1.4,release:2,bright:.6,detune:3,seed:91+i}),a,.25));
 for(let i=0;i<24;i++){const t=.4+i*2.6;mixMono(music,shape(tone(1.6,NOTE(['D4','A4','F4','E4'][i%4])),u=>Math.exp(-u*3)*(1-Math.exp(-u*60))),t,.04,Math.sin(i)*.22);}
 const thud=(t,g)=>{mixMono(sfx,shape(tone(1.25,u=>78-25*u),u=>envAR(u,1.25,.008,.95)*Math.exp(-u*3)),t,dB(g));mixMono(sfx,shape(filter(noise(Math.round(SR*1.8),r,'pink'),'lowpass',900),u=>envAR(u,1.8,.008,1.5)),t,dB(g-7));};
 thud(2.595,-16);thud(21.82,-20);
 const city=filter(filter(noise(Math.ceil(SR*D),r,'pink'),'highpass',180),'lowpass',1800);
 for(let i=0;i<city.length;i++){const t=i/SR;const active=t<4.5?1:t>19.5&&t<29.5?.65:t>33.5&&t<47?.6:t>60?1:0;city[i]*=active*(.8+.2*Math.sin(t*.8));}
 mixMono(sfx,city,0,dB(-35),-.1);
 const roar=shape(filter(noise(Math.round(3*SR),r,'pink'),'lowpass',2000),u=>envAR(u,3,.1,2.2));mixMono(sfx,roar,2.62,dB(-29));mixMono(sfx,roar,22.7,dB(-31));
 for(const t of [44.7,45.5])mixMono(sfx,shape(tone(.35,220),u=>envAR(u,.35,.03,.08)),t,dB(-38),.2);
 automate(music,t=>smooth(0,.5,t)*(1-smooth(D-.8,D,t))*(1-.45*smooth(2.1,2.3,t)*(1-smooth(2.55,2.7,t))));
 return {music,sfx};
}
