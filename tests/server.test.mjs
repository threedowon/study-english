import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHandler} from '../server.mjs';
async function invoke(handler,{url='/api/organize',method='POST',origin='http://127.0.0.1:5173',body=JSON.stringify({text:'I came here by van.'}),host='127.0.0.1:5173',headers={}}={}){
 const req=Readable.from([body]);Object.assign(req,{url,method,headers:{host,origin,'content-type':'application/json',...headers}});
 const res={status:200,headers:{},writeHead(s,h){this.status=s;Object.assign(this.headers,h)},setHeader(k,v){this.headers[k]=v},end(body){this.body=body}};
 await handler(req,res);return res;
}
test('missing key does not call upstream',async()=>{const r=await invoke(createHandler({apiKey:'',request:()=>assert.fail()}));assert.equal(r.status,503)});
test('rejects cross-origin requests',async()=>{const r=await invoke(createHandler({apiKey:'test',request:()=>assert.fail()}),{origin:'https://other.example'});assert.equal(r.status,403)});
test('rejects oversized text before API call',async()=>{const r=await invoke(createHandler({apiKey:'test',request:()=>assert.fail()}),{body:JSON.stringify({text:'a'.repeat(8001)})});assert.equal(r.status,400)});
test('extracts structured results, limits output and disables storage',async()=>{const result={summary:'교통수단 표현',expressions:[{english:'by van',meaning:'밴으로',tip:'교통수단 앞에 by'}]};let calls=0;const handler=createHandler({apiKey:'test',request:async(url,options)=>{calls++;const b=JSON.parse(options.body);assert.equal(b.store,false);assert.equal(b.max_output_tokens,1800);assert.equal(b.text.format.type,'json_schema');return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]})}}});assert.deepEqual(JSON.parse((await invoke(handler)).body),result);assert.equal((await invoke(handler)).status,429);assert.equal(calls,1)});
test('upstream auth errors do not leak credentials or upstream body',async()=>{const r=await invoke(createHandler({apiKey:'secret-test',request:async()=>({ok:false,status:401})}));assert.equal(r.status,502);assert.ok(!r.body.includes('secret-test'))});
test('env files are not served',async()=>{const r=await invoke(createHandler(),{url:'/.env.local',method:'GET'});assert.equal(r.status,404)});

test('only configured frontend can send credentialed requests',async()=>{const h=createHandler({appOrigin:'https://api.3dowon.com',frontendOrigin:'https://english.3dowon.com'});const r=await invoke(h,{url:'/api/status',method:'GET',host:'api.3dowon.com',origin:'https://english.3dowon.com'});assert.equal(r.status,200);assert.equal(r.headers['Access-Control-Allow-Origin'],'https://english.3dowon.com');assert.equal(r.headers['Access-Control-Allow-Credentials'],'true');const bad=await invoke(h,{url:'/api/status',method:'GET',host:'api.3dowon.com',origin:'https://evil.example'});assert.equal(bad.status,403);assert.equal(bad.headers['Access-Control-Allow-Origin'],undefined)});
test('preflight allows only application request headers',async()=>{const h=createHandler({appOrigin:'https://api.3dowon.com',frontendOrigin:'https://english.3dowon.com'});const input={method:'OPTIONS',host:'api.3dowon.com',origin:'https://english.3dowon.com',headers:{'access-control-request-method':'POST','access-control-request-headers':'content-type,x-study-user'}};assert.equal((await invoke(h,input)).status,204);input.headers['access-control-request-headers']='authorization';assert.equal((await invoke(h,input)).status,403)});
