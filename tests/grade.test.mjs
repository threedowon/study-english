import {test} from 'node:test';
import assert from 'node:assert/strict';
import {grade,bestGrade,hint,nextInterval,parseBulk,tokens,PASS} from '../grade.js';
test('ignores case, punctuation and contractions',()=>{
 assert.equal(grade('I came here by van.','i came here by van').score,1);
 assert.equal(grade("I'm working on it.",'I am working on it').score,1);
 assert.equal(grade("It's up to you!",'it is up to you').score,1);
 assert.equal(grade("I can't go.",'I cannot go').score,1);
 assert.deepEqual(tokens('I have 2 cats'),['i','have','two','cats']);
});
test('partial answers score lower and mark missing words',()=>{
 const r=grade('I came here by van.','I came by van');
 assert.ok(r.score<PASS&&r.score>0.6);
 assert.deepEqual(r.words.map(w=>w.hit),[true,true,false,true,true]);
 assert.equal(grade('I came here by van.','').score,0);
});
test('picks the best recognizer alternative',()=>{
 const r=bestGrade('Let me sleep on it.',['let me sleep on eat','let me sleep on it']);
 assert.equal(r.score,1);assert.equal(r.said,'let me sleep on it');
});
test('tolerates one-letter slips on long words',()=>{assert.equal(grade('my favourite color','my favorite color').score,1)});
test('hint keeps first letters',()=>{assert.equal(hint("I came here."),'I c___ h___.')});
test('spaced intervals grow and reset',()=>{
 assert.equal(nextInterval(0,'good'),1);assert.equal(nextInterval(1,'good'),3);assert.equal(nextInterval(3,'good'),8);
 assert.equal(nextInterval(8,'again'),0);assert.equal(nextInterval(0,'easy'),4);assert.ok(nextInterval(80,'good')<=90);
});
test('bulk parser finds the Korean side in any order',()=>{
 const {items,skipped}=parseBulk("I came here by van. / 나는 밴을 타고 왔어\n너한테 달렸어 | It's up to you.\n- Let me sleep on it.\t생각해 볼게\nno korean here\n\n");
 assert.deepEqual(items,[{english:'I came here by van.',meaning:'나는 밴을 타고 왔어'},{english:"It's up to you.",meaning:'너한테 달렸어'},{english:'Let me sleep on it.',meaning:'생각해 볼게'}]);
 assert.deepEqual(skipped,['no korean here']);
});
