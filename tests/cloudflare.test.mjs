import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../cloudflare/worker.mjs';
import {socialStore} from '../cloudflare/social.mjs';
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../cloudflare/migrations/0001_study.sql',import.meta.url),'utf8'));
 const wrap=(text,args=[])=>({bind(...args){return wrap(text,args)},async first(){return sql.prepare(text).get(...args)||null},async all(){return {results:sql.prepare(text).all(...args)}},async run(){const r=sql.prepare(text).run(...args);return {meta:{changes:Number(r.changes)}}}});
 return {prepare:wrap,async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}},close(){sql.close()}};
}
const envFor=DB=>({DB,FRONTEND_ORIGIN:'https://study.example.com',PASSWORD_PEPPER:'p'.repeat(64),SETUP_CODE:'s'.repeat(64)});
const signup={username:'owner',name:'Owner',password:'a secure password'};
test('D1 accounts require setup or one-use invite; sharing and versions stay isolated',async()=>{
 const db=database(),env=envFor(db),s=socialStore(db,env);
 try{
  await assert.rejects(s.register(signup),{status:403});
  const a=await s.register({...signup,setupCode:env.SETUP_CODE});
  assert.equal((await s.identify(a.token)).id,a.user.id);
  await assert.rejects(s.login({username:'owner',password:'wrong'}),{status:401});
  await assert.rejects(s.register({...signup,username:'guest'}),{status:403});
  const invitation=await s.invite(a.user.id);
  const b=await s.register({...signup,username:'guest',inviteToken:invitation.token});assert.equal(b.inviteAccepted,true);
  await assert.rejects(s.register({...signup,username:'third',inviteToken:invitation.token}),{status:410});
  const initial=await s.read(a.user.id);initial.data.notes=[{id:'one',english:'Hello',meaning:'안녕',due:'2026-11-14',shared:true},{id:'two',english:'Private',meaning:'비밀',due:'2026-11-14',shared:false}];
  await s.save(a.user.id,initial);await assert.rejects(s.save(a.user.id,initial),{status:409});
  const feed=(await s.social(b.user.id)).feed;assert.equal(feed.length,1);assert.equal(feed[0].due,undefined);
  assert.equal((await s.read(b.user.id)).data.notes.length,0);
  await s.copy(b.user.id,a.user.id,'one');assert.equal((await s.read(b.user.id)).data.notes[0].shared,false);
  await s.disconnect(a.user.id,b.user.id);assert.equal((await s.social(b.user.id)).feed.length,0);assert.equal(await s.aiEligible(b.user.id),false);
  await s.limit('test',1,86400000);await assert.rejects(socialStore(db,env).limit('test',1,86400000),{status:429});
  await s.logout(a.token);assert.equal(await s.identify(a.token),null);
 }finally{db.close()}
});
test('Worker routes enforce CORS, cookies, user guard and authenticated AI',async()=>{
 const db=database(),env=envFor(db);
 const req=(path,body,extra={})=>new Request('https://study.example.com'+path,{method:body?'POST':'GET',headers:{Origin:env.FRONTEND_ORIGIN,'Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await worker.fetch(req('/api/study'),env)).status,401);
  assert.equal((await worker.fetch(req('/api/organize',{text:'Hi'}),env)).status,401);
  assert.equal((await worker.fetch(req('/api/account/register',signup,{Origin:'https://evil.example'}),env)).status,403);
  const r=await worker.fetch(req('/api/account/register',{...signup,setupCode:env.SETUP_CODE}),env);assert.equal(r.status,200);
  const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);const {user}=await r.json();
  assert.equal((await worker.fetch(req('/api/study',{}, {Cookie:cookie}),env)).status,409);
  assert.equal((await worker.fetch(req('/api/study',undefined,{Cookie:cookie,'X-Study-User':user.id}),env)).status,200);
  assert.equal((await worker.fetch(req('/api/organize',{text:'Hi'},{Cookie:cookie,'X-Study-User':user.id}),env)).status,503);
  const pre=await worker.fetch(new Request('https://study.example.com/api/study',{method:'OPTIONS',headers:{Origin:env.FRONTEND_ORIGIN,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-study-user'}}),env);assert.equal(pre.status,204);
  const asset=await worker.fetch(new Request('https://study.example.com/'),{...env,ASSETS:{fetch:()=>new Response('website')}});assert.equal(await asset.text(),'website');
 }finally{db.close()}
});
test('Worker AI uses server secret, explicit calls and persistent cooldown',async()=>{
 const db=database(),env={...envFor(db),OPENAI_API_KEY:'test-only'},original=globalThis.fetch;
 try{
  const store=socialStore(db,env),a=await store.register({...signup,setupCode:env.SETUP_CODE});let calls=0;
  const result={summary:'복습',expressions:[{english:'Hello',meaning:'안녕',tip:'인사'}]};
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer test-only');const body=JSON.parse(options.body);assert.equal(body.store,false);return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]})};
  const req=()=>new Request('https://study.example.com/api/organize',{method:'POST',headers:{Origin:env.FRONTEND_ORIGIN,'Content-Type':'application/json',Cookie:`study_session=${a.token}`,'X-Study-User':a.user.id},body:JSON.stringify({text:'Hello'})});
  assert.deepEqual(await (await worker.fetch(req(),env)).json(),result);
  // Fill the current bucket to avoid a boundary-sensitive timing assertion.
  try{await store.limit('ai:cooldown:'+a.user.id,1,5000)}catch{}
  assert.equal((await worker.fetch(req(),env)).status,429);assert.equal(calls,1);
 }finally{globalThis.fetch=original;db.close()}
});
test('D1 registration accepts ten characters with symbols and rejects nine',async()=>{const db=database(),env=envFor(db),s=socialStore(db,env);try{await assert.rejects(s.register({...signup,password:'Ab1!xyz89',setupCode:env.SETUP_CODE}),{status:400});const a=await s.register({...signup,password:'Ab1!xyz890',setupCode:env.SETUP_CODE});assert.equal((await s.login({username:signup.username,password:'Ab1!xyz890'})).user.id,a.user.id)}finally{db.close()}});
