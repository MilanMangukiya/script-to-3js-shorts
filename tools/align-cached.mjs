import fs from 'node:fs';import path from 'node:path';
import {sceneRecord} from './lib/align.mjs';
const slug=process.argv[2],dir=path.join('build',slug,'audio'),raw=JSON.parse(fs.readFileSync(path.join(dir,'narration-raw.json'),'utf8'));
const result={...raw,scenes:raw.scenes.map(sc=>{const {record,exact,wordCount}=sceneRecord(sc);console.log(`${sc.id}: ${exact}/${wordCount} words recognized, ${sc.duration.toFixed(2)}s`);return record;})};
const story=JSON.parse(fs.readFileSync(path.join('stories',slug+'.json'),'utf8'));
if(process.argv.includes('--preview')){for(const sc of story.scenes)if(!result.scenes.some(n=>n.id===sc.id))result.scenes.push({id:sc.id,words:[]});result.preview_only=true;}
else if(result.scenes.length!==story.scenes.length)throw new Error('Narration is incomplete; wait for the cached runner to finish.');
fs.writeFileSync(path.join(dir,'narration.json'),JSON.stringify(result,null,2)+'\n');
