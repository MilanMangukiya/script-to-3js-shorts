// Fit real speech to authored narration windows, preserving pitch and scaling the actual word alignment.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';import {readWav} from './lib/wav.mjs';
const require=createRequire(import.meta.url),ffmpeg=require('ffmpeg-static'),slug=process.argv[2],dir=path.join('build',slug,'audio');
const story=JSON.parse(fs.readFileSync(path.join('stories',slug+'.json'),'utf8')),file=path.join(dir,'narration.json'),n=JSON.parse(fs.readFileSync(file,'utf8'));
for(const sc of story.scenes){const clip=n.scenes.find(c=>c.id===sc.id),target=sc.narration.end_s-sc.narration.start_s-.025;if(clip.duration_s<=target)continue;
 const rate=clip.duration_s/target,src=path.join(dir,clip.file),original=src.replace('.wav','.original.wav'),out=src.replace('.wav','.fitted.wav');if(!fs.existsSync(original))fs.copyFileSync(src,original);
 execFileSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-i',src,'-af',`atempo=${rate}`,'-ar',String(clip.sample_rate),out]);fs.renameSync(out,src);
 clip.words.forEach(w=>{w.start_s/=rate;w.end_s/=rate;});clip.duration_s=readWav(src).channels[0].length/clip.sample_rate;clip.tempo_adjustment=rate;console.log(sc.id,rate.toFixed(3),clip.duration_s.toFixed(3));
}fs.writeFileSync(file,JSON.stringify(n,null,2)+'\n');
