import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import * as grading from '../grade.js';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*\n/,'');
function fixture(){
 const listeners={},elements=new Map();
 function element(key){if(!elements.has(key))elements.set(key,{addEventListener(){},firstChild:{textContent:''},value:'',textContent:'',innerHTML:'',classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},reset(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(key)}
 const document={querySelector:element,querySelectorAll:()=>[],addEventListener(type,handler){(listeners[type]??=[]).push(handler)}};
 const saved=[];const context={...grading,document,window:{STUDY_CONFIG:{staticOnly:true},addEventListener(){},scrollTo(){}},localStorage:{getItem:()=>null,setItem:(key,value)=>saved.push(JSON.parse(value))},crypto:webcrypto,location:{hash:'',hostname:'localhost'},URLSearchParams,Intl,Date,AbortSignal,structuredClone,setTimeout:()=>0,clearTimeout(){},fetch(){assert.fail('No automatic AI requests')}};
 vm.createContext(context);vm.runInContext(source,context);
 return {context,element,saved,run:code=>vm.runInContext(code,context),async fire(type,target){for(const fn of listeners[type]||[])await fn({target,preventDefault(){}})}};
}
test('opens on notebook and saves paired input into the due review queue',async()=>{
 const f=fixture();assert.match(f.element('#content').innerHTML,/quick-expression-form/);
 await f.fire('input',{id:'quick-english',value:'  I am curious.  ',dataset:{}});
 await f.fire('input',{id:'quick-meaning',value:'  나는 궁금해.  ',dataset:{}});
 await f.fire('submit',{id:'quick-expression-form'});
 assert.equal(f.saved.at(-1).notes[0].english,'I am curious.');
 assert.equal(f.saved.at(-1).notes[0].meaning,'나는 궁금해.');
 assert.equal(f.saved.at(-1).notes[0].due,f.run('dayKey()'));
 f.run("navigate('review')");assert.match(f.element('#content').innerHTML,/type-answer/);assert.doesNotMatch(f.element('#content').innerHTML,/mic-big|say-answer/);
});
test('empty pairs and duplicate expressions are not saved',async()=>{
 const f=fixture();f.run("quickDraft={english:'Hi',meaning:'  '}");
 await f.fire('submit',{id:'quick-expression-form'});assert.equal(f.saved.length,0);
 f.run("quickDraft={english:'i came here by van.',meaning:'밴으로 왔어'}");
 await f.fire('submit',{id:'quick-expression-form'});assert.equal(f.saved.length,0);
});
test('draft survives navigation and legacy pages lead to notebook',()=>{
 const f=fixture();f.run("quickDraft={english:'Keep this',meaning:'보관'};navigate('review');navigate('talk')");
 assert.match(f.element('#content').innerHTML,/Keep this/);assert.match(f.element('#content').innerHTML,/보관/);
});
test('recommended sentence opens editable English and Korean fields',async()=>{
 const f=fixture();f.run("vocabularyResult={expressions:[{english:'I am curious.',meaning:'나는 궁금해.'}]}");
 const button={dataset:{exampleUse:'0'},matches:()=>false};await f.fire('click',{closest:()=>button});
 assert.equal(f.element('#english').value,'I am curious.');assert.equal(f.element('#meaning').value,'나는 궁금해.');assert.equal(f.element('#add-dialog').open,true);assert.equal(f.saved.length,0);
});
