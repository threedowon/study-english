import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import * as grading from '../grade.js';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*\n/,'');
function fixture(){
 const listeners={},elements=new Map();
 function element(key){if(!elements.has(key))elements.set(key,{querySelector:selector=>element(key+' '+selector),addEventListener(){},firstChild:{textContent:''},value:'',textContent:'',innerHTML:'',classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},reset(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(key)}
 const document={querySelector:key=>key==='dialog[open]'?null:element(key),querySelectorAll:()=>[],addEventListener(type,handler){(listeners[type]??=[]).push(handler)}};
 const saved=[];const context={...grading,document,window:{STUDY_CONFIG:{staticOnly:true},addEventListener(){},scrollTo(){}},localStorage:{getItem:()=>null,setItem:(key,value)=>saved.push(JSON.parse(value))},crypto:webcrypto,location:{hash:'',hostname:'localhost'},URLSearchParams,URL,Blob,AbortController,Intl,Date,AbortSignal,structuredClone,setTimeout:()=>0,clearTimeout(){},fetch(){assert.fail('No automatic AI requests')}};
 vm.createContext(context);vm.runInContext(source,context);
 return {context,element,saved,run:code=>vm.runInContext(code,context),async dispatch(type,event){for(const fn of listeners[type]||[])await fn(event)},async fire(type,target){for(const fn of listeners[type]||[])await fn({target,preventDefault(){}})}};
}
test('notebook saves paired input into the due review queue',async()=>{
 const f=fixture();f.run("navigate('notes')");assert.match(f.element('#content').innerHTML,/quick-expression-form/);
 await f.fire('input',{id:'quick-english',value:'  I am curious.  ',dataset:{}});
 await f.fire('input',{id:'quick-meaning',value:'  나는 궁금해.  ',dataset:{}});
 await f.fire('submit',{id:'quick-expression-form'});
 assert.equal(f.saved.at(-1).notes[0].english,'I am curious.');
 assert.equal(f.saved.at(-1).notes[0].meaning,'나는 궁금해.');
 assert.equal(f.saved.at(-1).notes[0].due,f.run('dayKey()'));
 f.run("navigate('review')");assert.match(f.element('#content').innerHTML,/type-answer/);assert.match(f.element('#content').innerHTML,/id="say-answer"/);
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

test('home opens with progress, weekly reviews and invitation access; recording stays in notebook',()=>{
 const f=fixture();const html=f.element('#content').innerHTML;
 assert.match(html,/연속 복습/);assert.match(html,/이번 주의 작은 꾸준함/);
 assert.doesNotMatch(html,/bottom-banner/);
 assert.match(html,/data-page="notes">오늘 배운 표현 기록하기/);
 assert.doesNotMatch(html,/data-page="talk"|data-page="lesson"|quick-expression-form/);
 f.run("state.history=[{date:dayKey()}];render()");
 assert.match(f.element('#content').innerHTML,/<b>1일<\/b>/);
 assert.match(f.element('#content').innerHTML,/1 \/ 5개 완료/);
 f.run("navigate('notes')");assert.match(f.element('#content').innerHTML,/vocabulary-form/);
});


function recordingFixture({deferPermission=false}={}){
 const f=fixture();let stopped=0,uploads=0,resolvePermission,rec;
 const stream={getTracks:()=>[{stop(){stopped++}}]};
 const permission=deferPermission?new Promise(resolve=>{resolvePermission=resolve}):Promise.resolve(stream);
 f.context.navigator={mediaDevices:{getUserMedia:()=>permission}};
 class Recorder{
  static isTypeSupported(type){return type==='audio/mp4'}
  constructor(s,options){this.state='inactive';this.mimeType=options.mimeType;rec=this}
  start(){this.state='recording'}
  stop(){this.state='inactive';this.ondataavailable({data:new Blob(['fake audio'],{type:this.mimeType})});this.onstop()}
 }
 f.context.window.MediaRecorder=Recorder;f.context.MediaRecorder=Recorder;
 f.context.fetch=async(url,options)=>{uploads++;assert.equal(url,'/api/transcribe');assert.equal(options.headers['X-Study-User'],'owner');assert.equal(options.body.type,'audio/mp4');return {ok:true,json:async()=>({text:'I came here by van.'})}};
 f.run("currentUser={id:'owner',name:'Owner'};navigate('review')");
 return {...f,get rec(){return rec},get stopped(){return stopped},get uploads(){return uploads},resolvePermission:()=>resolvePermission(stream)};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('holding records locally; release stops microphone and uploads exactly once',async()=>{
 const f=recordingFixture();await f.run("startHoldAnswer('pointer:1')");
 assert.equal(f.rec.state,'recording');assert.equal(f.uploads,0);
 f.run("holdSession.started-=1000;releaseHoldAnswer('pointer:1')");
 assert.ok(f.stopped>0);
 f.run("releaseHoldAnswer('pointer:1')");await settle();
 assert.equal(f.uploads,1);assert.match(f.element('#content').innerHTML,/정답이에요!/);
 assert.match(f.element('#content').innerHTML,/내 녹음 다시 듣기/);
});
test('release before microphone permission resolves never starts recording or uploads',async()=>{
 const f=recordingFixture({deferPermission:true});const pending=f.run("startHoldAnswer('pointer:1')");
 f.run("releaseHoldAnswer('pointer:1')");f.resolvePermission();await pending;
 assert.equal(f.rec,undefined);assert.ok(f.stopped>0);assert.equal(f.uploads,0);
});
test('cancel and navigating away stop tracks without uploading',async()=>{
 for(const action of ["releaseHoldAnswer('pointer:1',true)","navigate('notes')"]){
  const f=recordingFixture();await f.run("startHoldAnswer('pointer:1')");f.run(action);await settle();
  assert.ok(f.stopped>0);assert.equal(f.uploads,0);assert.equal(f.run('holdSession'),null);
 }
});
test('a quick tap does not upload, and unrelated pointer release does not stop recording',async()=>{
 const f=recordingFixture();await f.run("startHoldAnswer('pointer:1')");
 f.run("releaseHoldAnswer('pointer:2')");assert.equal(f.rec.state,'recording');
 f.run("releaseHoldAnswer('pointer:1')");await settle();assert.equal(f.uploads,0);
});
test('permission denial shows an explanation without grading',async()=>{
 const f=recordingFixture();f.context.navigator.mediaDevices.getUserMedia=async()=>{throw Object.assign(Error(),{name:'NotAllowedError'})};
 await f.run("startHoldAnswer('pointer:1')");
 assert.match(f.element('#content').innerHTML,/마이크 권한이 필요해요/);assert.equal(f.run('attempt'),null);assert.equal(f.uploads,0);
});

test('tapping the microphone starts recording and tapping again submits once',async()=>{
 const f=recordingFixture();const button={id:'say-answer',dataset:{},matches:()=>false};const target={closest:()=>button};
 await f.dispatch('click',{target,preventDefault(){}});await settle();
 assert.equal(f.rec.state,'recording');assert.equal(f.uploads,0);f.run('holdSession.started-=1000');
 await f.dispatch('click',{target,preventDefault(){}});await settle();
 assert.equal(f.uploads,1);assert.equal(f.run('holdSession'),null);
});
test('Space toggles recording on and off and ignores key repeats',async()=>{
 const f=recordingFixture();const target={closest:()=>null};
 const event={target,code:'Space',key:' ',preventDefault(){}};
 await f.dispatch('keydown',event);await settle();
 const first=f.rec;await f.dispatch('keydown',{...event,repeat:true});assert.equal(f.rec,first);assert.equal(f.rec.state,'recording');
 f.run('holdSession.started-=1000');await f.dispatch('keydown',event);await settle();assert.equal(f.uploads,1);
});
test('cancel button discards the recording without uploading',async()=>{
 const f=recordingFixture();await f.run("startHoldAnswer('tap')");
 await f.dispatch('click',{target:{closest:()=>({id:'cancel-answer',dataset:{},matches:()=>false})},preventDefault(){}});await settle();
 assert.ok(f.stopped>0);assert.equal(f.uploads,0);assert.equal(f.run('holdSession'),null);
});
test('review hides the answer as word bars without an eye button',()=>{
 const f=fixture();f.run("navigate('review')");
 const html=f.element('#content').innerHTML;
 assert.match(html,/word-bar/);assert.doesNotMatch(html,/영어로는|peek-answer/);
});

test('preparing microphone closes the stream without recording or uploading',async()=>{
 const f=recordingFixture();await f.run('prepareMicrophone()');
 assert.ok(f.stopped>0);assert.equal(f.rec,undefined);assert.equal(f.uploads,0);
 assert.equal(f.run('micReady'),true);assert.equal(f.run('micPreparing'),false);
 assert.doesNotMatch(f.element('#content').innerHTML,/id="prepare-mic"/);
});
test('hold status preserves microphone button children',async()=>{
 const f=recordingFixture();const button=f.element('#say-answer');
 button.innerHTML='<span class="mic-symbol"></span><span class="mic-label"></span>';
 const before=button.innerHTML;await f.run("startHoldAnswer('pointer:1')");
 assert.equal(button.innerHTML,before);
 assert.match(button.querySelector('.mic-label').textContent,/녹음 중/);
 f.run("releaseHoldAnswer('pointer:1',true)");
});


test('notebook omits category controls and per-note sharing, while editor still opens',()=>{
 const f=fixture();f.run("navigate('notes')");
 const html=f.element('#content').innerHTML;
 assert.doesNotMatch(html,/id="filter"|note-meta|data-share-note/);
 assert.match(html,/data-edit=/);assert.match(html,/data-delete=/);
 f.run("openAdd('',state.notes[0])");
 assert.equal(f.element('#add-dialog').open,true);
 assert.equal(f.element('#english').value,'I came here by van.');
 f.run("navigate('review')");
 assert.doesNotMatch(f.element('#content').innerHTML,/여행|샘플/);
 assert.match(f.element('#content').innerHTML,/class="ui-icon"/);
});
test('pronunciation scores colour words and show score chips on the result',()=>{
 const f=fixture();f.run("navigate('review')");
 const pron={text:'I came here by van.',scores:{pron:82,accuracy:85,fluency:90,completeness:100,prosody:76},words:[
  {word:'i',accuracy:98,error:'None',syllables:[{grapheme:'i',accuracy:98}]},
  {word:'came',accuracy:70,error:'None',syllables:[{grapheme:'came',accuracy:70}]},
  {word:'here',accuracy:45,error:'Mispronunciation',syllables:[]},
  {word:'by',accuracy:90,error:'None',syllables:[]},
  {word:'van',accuracy:88,error:'None',syllables:[]}]};
 f.run(`submitAnswer(['I came here by van.'],${JSON.stringify(pron)})`);
 const html=f.element('#content').innerHTML;
 assert.match(html,/Good!/);assert.match(html,/발음 82점/);assert.match(html,/score-chips/);
 assert.match(html,/word-say fair[^>]*>came/);assert.match(html,/word-say poor[^>]*>here/);assert.match(html,/word-say good[^>]*>van\./);
});
