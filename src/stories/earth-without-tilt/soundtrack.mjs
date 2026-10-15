import fs from 'node:fs';
import {
  SR, NOTE, rng, pad, tone, noise, filter, shape, envAR, smooth,
  createStereoBuffer, mixIn, applyPreImpactVacuum,
} from '../../library/audio/synth.mjs';
const T = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url), 'utf8'));
const current = b => ({ sampleRate: b.sr, length: b.L.length, left: b.L, right: b.R });

/** Original curious, lightly comic score: a late dinner becomes a small astronomical discovery. */
export function buildSoundtrack(D, story) {
  const music = createStereoBuffer(D), sfx = createStereoBuffer(D), random = rng(71523);
  const chords = [['C3','G3','E4'],['A2','E3','B3'],['F3','C4','A4'],['D3','A3','F4'],
    ['E3','B3','G4'],['F3','C4','E4'],['G2','D3','A3'],['C3','G3','E4']];
  for (const [index, scene] of story.scenes.entries()) {
    const duration = scene.end_s - scene.start_s;
    mixIn(music, current(pad({ freqs: chords[index % chords.length].map(NOTE), dur: duration + .7,
      attack: index ? .45 : .035, release: .8, detune: 2.1, bright: 1.1, harmonics: 2, seed: 421 + index })), scene.start_s, .23);
  }
  // A restrained plucked motif, with room for each sentence and a reprise over the earlier dinner.
  const pluck = (note, length = .6) => {
    const out = new Float32Array(Math.ceil(length * SR)), f = NOTE(note);
    for (const [ratio, gain] of [[1,1],[2,.28],[3,.08]]) {
      const x = tone(length, f * ratio);
      for (let i=0;i<out.length;i++) {
        const u=i/SR;
        out[i] += x[i] * gain * (1-Math.exp(-u*350)) * Math.exp(-u*(6+ratio*2)) * (1-smooth(length-.05,length,u));
      }
    }
    return out;
  };
  const motif = [[.12,'C5'],[1.3,'E5'],[2.45,'G4'],[4.15,'A4'],[7.1,'E5'],[10.7,'F5'],[13.9,'A4'],
    [17.25,'D5'],[19.3,'A4'],[22.8,'E5'],[25.5,'B4'],[28.5,'F5'],[31.9,'C5'],[35.1,'G4'],[38.6,'D5'],
    [42.15,'C5'],[44.2,'E5'],[46.35,'G4'],[48.4,'C5'],[50.0,'E5'],[51.15,'G4']];
  for (const [i,[at,note]] of motif.entries()) mixIn(music,pluck(note),at,.13,Math.sin(i*1.4)*.25);
  // Outdoor air and grill sizzle stay in the duckable bed, never covering a reveal's silence.
  const air = filter(noise(Math.ceil(D*SR),random,'pink'),'lowpass',900);
  const sizzle = filter(noise(Math.ceil(D*SR),random,'white'),'bandpass',2600,.6);
  for(let i=0;i<air.length;i++) {
    const t=i/SR, patio=t<4 || t>=10.5&&t<17 || t>=42;
    air[i] *= .012;
    sizzle[i] *= patio ? .016*(.65+.35*Math.sin(t*2.2)**2) : 0;
  }
  mixIn(music,air,0,1); mixIn(music,sizzle,0,1,-.2);
  const click=(at,gain=.11,pan=0)=>{
    const transient=shape(filter(noise(Math.ceil(.045*SR),random,'white'),'bandpass',2500,1.4),u=>Math.exp(-u*140));
    mixIn(sfx,transient,at,gain,pan);
    mixIn(sfx,shape(tone(.08,280),u=>envAR(u,.08,.002,.06)),at,gain*.4,pan);
  };
  click(T.lanternSwitch,.13,-.2);
  click(T.monthFlip0,.075,.2); click(T.monthFlip1,.065,.2);
  // Discovery is a small glassy cue, not an invented impact or destruction sequence.
  mixIn(sfx,pluck('E6',1.0),T.primaryReveal,.14);
  click(T.clockMove0,.08,-.1); click(T.clockMove1,.095,-.1);
  click(T.clockFlipSwitch,.11,.15);
  mixIn(sfx,pluck('C6',.7),T.clockMove1+.10,.075,.1);
  for(const sc of story.scenes) for(const cue of sc.audio_cues??[]) {
    if(cue.kind==='silence') applyPreImpactVacuum(sfx,{at_s:cue.at_s,duration_s:cue.duration_s,duckDb:cue.relative_db??-24});
  }
  for(let i=0;i<music.length;i++) {
    const t=i/SR, fade=smooth(0,.025,t)*(1-smooth(D-.12,D,t));
    music.left[i]*=fade; music.right[i]*=fade; sfx.left[i]*=fade; sfx.right[i]*=fade;
  }
  return { music, sfx };
}
