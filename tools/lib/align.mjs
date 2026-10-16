// Caption alignment uses verified recognition, including bounded numeric and compound normalization.
export const norm = w => w.toLowerCase().replace(/[\u2018\u2019']/g,"'").replace(/[^a-z0-9']/g,'');
export function trimSilence(x,sr,thr=.006,padS=.05) {
  let a=0,b=x.length-1;
  while(a<b&&Math.abs(x[a])<thr)a++;
  while(b>a&&Math.abs(x[b])<thr)b--;
  return x.slice(Math.max(0,a-Math.round(padS*sr)),Math.min(x.length,b+Math.round(padS*2*sr)+1));
}
const SMALL=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function cardinal(n) {
  if(n<20)return SMALL[n];
  if(n<100)return `${TENS[Math.floor(n/10)]}${n%10?` ${SMALL[n%10]}`:''}`;
  for(const [size,name] of [[1e12,'trillion'],[1e9,'billion'],[1e6,'million'],[1000,'thousand'],[100,'hundred']])if(n>=size)return `${cardinal(Math.floor(n/size))} ${name}${n%size?` ${cardinal(n%size)}`:''}`;
}
function lexicalParts(word,initials) {
  let value=word.replace(/[\u2018\u2019]/g,"'").replace(/(\d),(?=\d{3}(?:\D|$))/g,'$1').replace(/(^|\s)[-\u2212](?=\d)/g,'$1minus ');
  value=value.replace(/\b\d+(?:\.\d+)?%?/g,number=>{
    const percent=number.endsWith('%'),[whole,fraction]=number.replace('%','').split('.');
    if(!Number.isSafeInteger(Number(whole))||Number(whole)>=1e15)return number;
    return `${cardinal(Number(whole))}${fraction?` point ${[...fraction].map(n=>SMALL[Number(n)]).join(' ')}`:''}${percent?' percent':''}`;
  });
  return value.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean).flatMap(p=>initials.has(p)?[...p]:[p]);
}
export function assertRecognitionTiming(heard,duration,id='Narration') {
  if(!Number.isFinite(duration)||duration<=0||!Array.isArray(heard)||!heard.length)throw new Error(`${id}: empty or invalid recognition; refresh unprompted recognition and review source speech`);
  let previous=0;
  heard.forEach((h,i)=>{
    if(typeof h.text!=='string'||!h.text.trim()||!Number.isFinite(h.start)||!Number.isFinite(h.end)||h.start<0||h.end<=h.start||h.end>duration+1e-6||h.start<previous-1e-6)throw new Error(`${id}: recognized word ${i+1} has invalid, overlapping or out-of-range timing; refresh recognition rather than clamping captions`);
    previous=h.end;
  });
}
export function wordAlignment(scriptWords,heard,duration) {
  assertRecognitionTiming(heard,duration);
  const initials=new Set(scriptWords.filter(w=>/^[A-Z]{2,}[.,!?;:]?$/.test(w)).map(norm));
  const S=scriptWords.flatMap((text,index)=>lexicalParts(text,initials).map(part=>({part,index})));
  // Whisper can timestamp a written number as separate punctuation fragments ("8", ".3"
  // or "40", ",000"). Join only adjacent numeric fragments, without consulting the script.
  // The original recognition stays untouched; internal word times are derived across the span.
  const heardUnits=[];
  for(let index=0;index<heard.length;index++){
    const first=index,h=heard[index];
    let value=h.text.trim(),end=h.end;
    while(index+1<heard.length&&heard[index+1].start-end<=.12){
      const next=heard[index+1].text.trim();
      const thousands=/^\d{1,3}(?:,\d{3})*$/.test(value)&&/^,\d{3}[.!?;:]?$/.test(next);
      const decimal=/^\d+(?:,\d{3})*$/.test(value)&&/^\.\d+[%!?;:]?$/.test(next);
      if(!thousands&&!decimal)break;
      value+=next;end=heard[++index].end;
    }
    const parts=lexicalParts(value,initials),joined=index!==first;
    parts.forEach((part,q)=>heardUnits.push({part,index:first,endIndex:index,joined,
      start:h.start+(end-h.start)*q/parts.length,end:h.start+(end-h.start)*(q+1)/parts.length}));
  }
  // ASR sometimes joins two adjacent words ("Noon sun" -> "Noonsun"). Accept only an exact
  // character join of two complete script tokens into one complete recognized token. Its internal
  // caption boundary is derived from character proportions, never a measured pause boundary.
  const H=[];
  let si=0,hi=0;
  while(si<S.length&&hi<heardUnits.length){
    const s=S[si],h=heardUnits[hi];
    if(s.part===h.part){H.push(h);si++;hi++;continue;}
    const right=S[si+1];
    const completePair=right&&right.index===s.index+1&&(si===0||S[si-1].index!==s.index)&&(si+2===S.length||S[si+2].index!==right.index);
    const completeHeard=(hi===0||heardUnits[hi-1].index!==h.index)&&(hi+1===heardUnits.length||heardUnits[hi+1].index!==h.index);
    if(!completePair||!completeHeard||s.part+right.part!==h.part)break;
    const boundary=h.start+(h.end-h.start)*s.part.length/(s.part.length+right.part.length);
    H.push({...h,part:s.part,end:boundary,merged:true},{...h,part:right.part,start:boundary,merged:true});
    si+=2;hi++;
  }
  const mismatch=S.findIndex((s,i)=>s.part!==H[i]?.part);
  if(!S.length||mismatch>=0||S.length!==H.length||hi!==heardUnits.length)throw new Error(`Recognition does not match the exact script (expected: ${scriptWords.join(' ')}; heard: ${heard.map(h=>h.text).join(' ')}). Refresh unprompted recognition and review speech; unsupported words cannot be interpolated into verified captions`);
  const times=[],matches=[],evidence=[];
  for(let index=0;index<scriptWords.length;index++) {
    const positions=S.flatMap((s,i)=>s.index===index?[i]:[]),first=positions[0],last=positions.at(-1);
    if(first===undefined)throw new Error(`Script word ${index+1} has no spoken lexical content`);
    const left=H[first],right=H[last];
    times.push([left.start,right.end]);
    const oneToOne=left.index===right.index&&(first===0||H[first-1].index!==left.index)&&(last===H.length-1||H[last+1].index!==right.index);
    const exact=oneToOne&&!left.joined&&norm(scriptWords[index])===norm(heard[left.index].text);
    matches.push(exact?left.index:null);
    evidence.push({heard_start_index:left.index,heard_end_index:right.endIndex??right.index,type:exact?'exact':'normalized',derived:!oneToOne||!!left.joined||!!right.joined,...(left.joined||right.joined?{normalization:'split_numeric'}:left.merged||right.merged?{normalization:'adjacent_merge'}:{})});
  }
  return {times,matches,evidence,exact:matches.filter(x=>x!==null).length};
}
export function alignWords(scriptWords,heard,duration) {return wordAlignment(scriptWords,heard,duration).times;}
export function sceneRecord({id,text,file,sampleRate,duration,heardText,heard}) {
  const scriptWords=text.split(/\s+/).filter(Boolean);
  let alignment;
  try {alignment=wordAlignment(scriptWords,heard,duration);}catch(error){throw new Error(`${id}: ${error.message}`);}
  const {times,matches,exact,evidence}=alignment;
  const record={id,text,file,sample_rate:sampleRate,duration_s:+duration.toFixed(6),heard:heardText.trim(),
    words:scriptWords.map((w,q)=>({text:w,start_s:+times[q][0].toFixed(6),end_s:+times[q][1].toFixed(6)})),
    recognition:{lexical_ok:true,ordered_exact_words:exact,word_count:scriptWords.length,normalized_words:scriptWords.length-exact,evidence}};
  return {record,exact,wordCount:scriptWords.length,matches,evidence};
}
