import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf("document.addEventListener('submit',async e=>{");
const end=source.indexOf("document.addEventListener('click',async e=>{",start);
function fixture(action){
 const status={textContent:''},buttons=[{disabled:false},{disabled:false}];
 const values={username:'testuser',password:'TenChars!0',name:'Test',setupCode:'setup-value'};
 const form={id:'account-form',dataset:{action},isConnected:true,querySelector:()=>status,querySelectorAll:()=>buttons};
 const calls=[];const context={document:{addEventListener(type,handler){context.handler=handler}},FormData:class{constructor(){return Object.entries(values)}},accountBusy:false,socialError:'',pendingInvite:'',currentUser:null,render(){assert.fail('Failed submission must not replace form')},api:async(path,body)=>{calls.push({path,body});throw Error('설정 코드를 확인해 주세요.')}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 return {context,form,values,status,buttons,calls};
}
test('registration uses explicit screen mode even when Enter has no submitter',async()=>{const f=fixture('register');await f.context.handler({target:f.form,preventDefault(){}});assert.equal(f.calls[0].path,'/api/account/register');assert.equal(f.calls[0].body.password,'TenChars!0');assert.equal(f.status.textContent,'설정 코드를 확인해 주세요.');assert.equal(f.values.setupCode,'setup-value');assert.ok(f.buttons.every(x=>!x.disabled));assert.equal(f.context.accountBusy,false)});
test('login screen keeps Enter as login regardless of submitter metadata',async()=>{const f=fixture('login');await f.context.handler({target:f.form,submitter:{value:'register'},preventDefault(){}});assert.equal(f.calls[0].path,'/api/account/login')});
