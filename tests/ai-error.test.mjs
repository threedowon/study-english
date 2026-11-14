import test from 'node:test';
import assert from 'node:assert/strict';
import {aiError} from '../lib/ai-error.mjs';
import {transcribeAudio} from '../lib/transcription.mjs';
const response=(status,code,type)=>new Response(JSON.stringify({error:{code,type,message:'private upstream details'}}),{status});
test('API quota, traffic limits, credentials and service errors stay distinct',async()=>{
 for(const [status,code,type,expected] of [
  [429,'credit_balance_exhausted',null,/크레딧 잔액이 소진/],
  [429,'insufficient_quota',null,/Billing과 Limits/],
  [429,null,'insufficient_quota',/Billing과 Limits/],
  [429,'organization_usage_limit_exceeded',null,/지출 또는 사용 한도/],
  [429,'rate_limit_exceeded',null,/일시적으로 요청을 제한/],
  [401,null,null,/키를 인증하지 못/],
  [403,null,null,/권한/],
  [404,'model_not_found',null,/권한/],
  [503,null,null,/서버에 일시적인 문제/],
 ]){
  const error=await aiError(response(status,code,type));
  assert.match(error.message,expected);assert.doesNotMatch(error.message,/private upstream/);
 }
});
test('malformed upstream error never leaks response body or claims quota exhaustion',async()=>{
 const error=await aiError(new Response('private <html>failure</html>',{status:502}));
 assert.match(error.message,/서버에 일시적인 문제/);assert.doesNotMatch(error.message,/private|잔액|한도/);
});
test('audio transcription reports quota accurately through the shared handler',async()=>{
 await assert.rejects(transcribeAudio(new Uint8Array([1,2]),'audio/mp4',{apiKey:'test-only',request:async()=>response(429,'insufficient_quota')}),/Billing과 Limits/);
 await assert.rejects(transcribeAudio(new Uint8Array([1,2]),'audio/mp4',{apiKey:'test-only',request:async()=>response(401,'invalid_api_key')}),/키를 인증하지 못/);
});
