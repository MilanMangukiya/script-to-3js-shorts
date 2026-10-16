import test from 'node:test';
import assert from 'node:assert/strict';
import {wordAlignment} from './align.mjs';
const heard=words=>words.map((text,i)=>({text,start:i*.2,end:(i+1)*.2}));
test('split decimal and thousands preserve value, raw spans and derived evidence',()=>{
 for(const [script,recognized] of [
  ['eight point three billion liters',['8','.3','billion','liters']],
  ['over forty thousand liters',['over','40',',000','liters']],
  ['one million two hundred thirty four thousand five hundred sixty seven',['1',',234',',567']],
 ]){
  const raw=heard(recognized),before=JSON.stringify(raw),a=wordAlignment(script.split(' '),raw,raw.at(-1).end);
  assert.equal(JSON.stringify(raw),before);
  assert.equal(a.times.length,script.split(' ').length);
  a.times.forEach(([s,e],i)=>{assert.ok(e>s);if(i)assert.ok(s>=a.times[i-1][1]-1e-9);});
  assert.ok(a.evidence.some(e=>e.normalization==='split_numeric'&&e.derived&&e.heard_end_index>e.heard_start_index));
 }
});
test('numeric normalization cannot conceal a wrong quantity, missing decimal or unit',()=>{
 for(const [script,recognized] of [
  ['eight point three',['8','.4']],['eight three',['8','.3']],
  ['forty thousand',['40',',001']],['eight point three liters',['8','.3','leaders']],
 ])assert.throws(()=>wordAlignment(script.split(' '),heard(recognized),recognized.length*.2),/does not match/);
});
test('a currency sign stands for the spoken word dollars, after any scale word',()=>{
 for(const [script,recognized] of [
  ['you have eighty-one dollars.',['you','have','$81.']],
  ['only worth five thousand dollars.',['only','worth','$5,000.']],
  ['worth forty thousand dollars',['worth','$40',',000']],
  ['turned down one million dollars for',['turned','down','$1','million','for']],
  ['over five million dollars, and',['over','$5','million,','and']],
 ]){
  const a=wordAlignment(script.split(' '),heard(recognized),recognized.length*.2);
  assert.equal(a.times.length,script.split(' ').length);
  a.times.forEach(([s,e],i)=>{assert.ok(e>s);if(i)assert.ok(s>=a.times[i-1][1]-1e-9);});
  assert.ok(a.evidence.some(e=>e.derived&&(e.normalization==='currency'||e.normalization==='split_numeric')));
 }
});
test('a currency sign cannot conceal a different unit, amount or a missing dollars',()=>{
 for(const [script,recognized] of [
  ['eighty-one cents',['$81']],['eighty-two dollars',['$81']],['eighty-one',['$81']],
  ['one million',['$1','million']],['a million dollars',['$1','million']],['eighty-one dollars',['$81','dollars']],
 ])assert.throws(()=>wordAlignment(script.split(' '),heard(recognized),recognized.length*.2),/does not match/);
});
test('a compound may be heard joined or split, but only as exact complete words',()=>{
 for(const [script,recognized] of [
  ['would have fit in a briefcase.',['would','have','fit','in','a','brief','case.']],
  ['the noon sun',['the','noonsun']],
 ]){
  const a=wordAlignment(script.split(' '),heard(recognized),recognized.length*.2);
  assert.equal(a.times.length,script.split(' ').length);
  a.times.forEach(([s,e],i)=>{assert.ok(e>s);if(i)assert.ok(s>=a.times[i-1][1]-1e-9);});
  assert.ok(a.evidence.some(e=>e.normalization==='adjacent_merge'));
 }
 for(const [script,recognized] of [
  ['a briefcase',['a','brief','cases']],['a briefcase',['a','brie','case']],['a brief',['a','brief','case']],
 ])assert.throws(()=>wordAlignment(script.split(' '),heard(recognized),recognized.length*.2),/does not match/);
});
test('separate numbers, distant fragments and punctuation remain separate',()=>{
 const exact=wordAlignment(['eight','three'],heard(['8','3']),.4);
 assert.equal(exact.times.length,2);
 assert.throws(()=>wordAlignment(['eight','point','three'],[{text:'8.',start:0,end:.2},{text:'.3',start:.2,end:.4}],.4),/does not match/);
 assert.throws(()=>wordAlignment(['eight','point','three'],[{text:'8',start:0,end:.2},{text:'.3',start:.5,end:.7}],.7),/does not match/);
});
