const enc=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
export const digest=async x=>hex(await crypto.subtle.digest('SHA-256',enc.encode(x)));
export const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
export const empty=()=>({notes:[],history:[],lessons:[],goal:5,speechRate:1,voiceURI:''});
async function passwordHash(password,salt,pepper){
 const secret=await crypto.subtle.importKey('raw',enc.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const input=await crypto.subtle.sign('HMAC',secret,enc.encode(password));
 const key=await crypto.subtle.importKey('raw',input,'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:100000},key,256));
}
const equal=(a,b)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0};
export function socialStore(db,env){
 const stmt=(sql,...args)=>db.prepare(sql).bind(...args);
 const user=id=>stmt('SELECT id,username,name FROM users WHERE id=?',id).first();
 const requireUser=async id=>{if(!id||!await user(id))fail(401,'로그인이 필요해요.')};
 const service={
 async limit(key,max,windowMs){const bucket=Math.floor(Date.now()/windowMs);const row=await stmt(`INSERT INTO limits(key,bucket,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET bucket=excluded.bucket,count=CASE WHEN limits.bucket=excluded.bucket THEN limits.count+1 ELSE 1 END RETURNING count`,key,bucket).first();if(row.count>max){let message='사용 횟수 한도에 도달했어요. 잠시 후 다시 시도해 주세요.';if(key.startsWith('ai:cooldown:'))message='연속 요청을 잠시 쉬어 주세요. 5초 뒤 다시 시도할 수 있어요.';else if(key.startsWith('ai:')){const reset=new Date((bucket+1)*windowMs).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'});message=(key==='ai:global'?'공부방 전체':'내 계정')+'의 하루 AI 요청 '+max+'회 한도에 도달했어요. 다음 한국 시간 '+reset+'에 초기화돼요. OpenAI 잔액 부족과는 별개예요.'}fail(429,message)}},
 async identify(raw){if(!raw||raw.length>100)return null;return stmt('SELECT u.id,u.username,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.digest=? AND s.expires>?',await digest(raw),Date.now()).first()},
 async register({username,name,password,setupCode,inviteToken}){
  if(!env.PASSWORD_PEPPER||env.PASSWORD_PEPPER.length<32)fail(503,'서버 비밀 설정이 필요해요.');
  if(typeof username!=='string'||!/^[-a-z0-9_]{3,32}$/.test(username))fail(400,'아이디는 영문 소문자·숫자·밑줄·하이픈 3~32자로 입력하세요.');
  if(typeof name!=='string'||!name.trim()||name.length>40)fail(400,'이름은 1~40자로 입력하세요.');
  if(typeof password!=='string'||password.length<10||password.length>128)fail(400,'비밀번호는 10~128자로 입력하세요.');
  const owner=await stmt("SELECT value FROM settings WHERE key='owner'").first();
  let invitation=null;
  if(!owner){if(!env.SETUP_CODE||env.SETUP_CODE.length<32||!equal(String(setupCode||''),env.SETUP_CODE))fail(403,'최초 가입에는 운영자 설정 코드가 필요해요.');}
  else {if(typeof inviteToken!=='string'||inviteToken.length>100)fail(403,'초대 링크를 통해 가입해 주세요.');invitation=await stmt('SELECT * FROM invites WHERE digest=? AND expires>? AND accepted_by IS NULL AND revoked=0',await digest(inviteToken),Date.now()).first();if(!invitation)fail(410,'만료되었거나 사용한 초대예요.');}
  if((await stmt('SELECT count(*) AS n FROM users').first()).n>=20)fail(403,'개인 공부방은 최대 20개 계정까지 가입할 수 있어요.');
  if(await stmt('SELECT id FROM users WHERE username=?',username).first())fail(409,'이미 사용 중인 아이디예요.');
  const id=crypto.randomUUID(),salt=random(),stored=`pbkdf2-sha256:100000:${salt}:${await passwordHash(password,salt,env.PASSWORD_PEPPER)}`;
  // Invitation races are prevented inside the atomic batch by conditional INSERT.
  const insert=invitation?stmt('INSERT INTO users SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM invites WHERE id=? AND accepted_by IS NULL AND revoked=0 AND expires>?)',id,username,name.trim(),stored,Date.now(),invitation.id,Date.now()):stmt('INSERT INTO users VALUES(?,?,?,?,?)',id,username,name.trim(),stored,Date.now());
  const commands=[insert,stmt('INSERT INTO study SELECT ?,?,0 WHERE EXISTS(SELECT 1 FROM users WHERE id=?)',id,JSON.stringify(empty()),id)];
  if(invitation)commands.push(stmt('UPDATE invites SET accepted_by=? WHERE id=? AND accepted_by IS NULL AND EXISTS(SELECT 1 FROM users WHERE id=?)',id,invitation.id,id));
  else commands.push(stmt("INSERT OR IGNORE INTO settings(key,value) VALUES('owner',?)",id));
  const results=await db.batch(commands);if(!results[0].meta.changes)fail(410,'이미 사용된 초대예요.');
  return {...await service.session(id),inviteAccepted:!!invitation};
 },
 async login({username,password}){
  if(!env.PASSWORD_PEPPER)fail(503,'서버 비밀 설정이 필요해요.');
  if(typeof username!=='string'||username.length>32||typeof password!=='string'||password.length>128)fail(401,'아이디 또는 비밀번호를 확인해 주세요.');
  await service.limit('login:'+await digest(username),10,900000);
  const row=await stmt('SELECT * FROM users WHERE username=?',username).first();
  const parts=row?.password.split(':');const salt=parts?.[2]||'missing';
  const actual=await passwordHash(password,salt,env.PASSWORD_PEPPER);
  if(!row||!equal(actual,parts[3]))fail(401,'아이디 또는 비밀번호를 확인해 주세요.');
  return service.session(row.id);
 },
 async session(id){const token=random();await db.batch([stmt('DELETE FROM sessions WHERE expires<?',Date.now()),stmt('INSERT INTO sessions VALUES(?,?,?)',await digest(token),id,Date.now()+604800000)]);return {token,user:await user(id)}},
 async logout(raw){await stmt('DELETE FROM sessions WHERE digest=?',await digest(raw||'')).run();return {ok:true}},
 async read(id){await requireUser(id);const row=await stmt('SELECT data,version FROM study WHERE user_id=?',id).first();return {data:JSON.parse(row.data),version:row.version}},
 async save(id,{data,version}){
  await requireUser(id);
  if(!Number.isSafeInteger(version)||!data||!Array.isArray(data.notes)||!Array.isArray(data.history)||!Array.isArray(data.lessons??[])||data.notes.length>2000||(data.lessons||[]).length>200||data.history.length>10000||enc.encode(JSON.stringify(data)).length>500000)fail(400,'계정 기록은 500KB, 표현 2,000개·메모 200개까지 저장할 수 있어요. 오래된 기록을 백업해 주세요.');
  const ids=new Set();for(const [kind,items] of [['notes',data.notes],['lessons',data.lessons||[]]])for(const x of items){if(!x||typeof x.id!=='string'||x.id.length>100||ids.has(x.id))fail(400,'기록 식별자가 올바르지 않아요.');ids.add(x.id);if(kind==='notes'&&(typeof x.english!=='string'||typeof x.meaning!=='string'||typeof x.due!=='string'))fail(400,'표현 형식을 확인해 주세요.');if(kind==='lessons'&&typeof x.text!=='string')fail(400,'메모 형식을 확인해 주세요.');}
  const r=await stmt('UPDATE study SET data=?,version=version+1 WHERE user_id=? AND version=?',JSON.stringify(data),id,version).run();if(!r.meta.changes)fail(409,'다른 기기에서 기록이 바뀌었어요. 현재 기록을 다운로드한 뒤 최신 기록을 불러와 주세요.');return {version:version+1};
 },
 async invite(id){await requireUser(id);if(!await service.aiEligible(id))fail(403,'운영자의 공부방에 연결된 계정만 초대할 수 있어요.');await service.limit('invite:'+id,10,86400000);const active=await stmt('SELECT count(*) AS n FROM invites WHERE owner_id=? AND expires>? AND revoked=0 AND accepted_by IS NULL',id,Date.now()).first();if(active.n>=5)fail(429,'대기 중인 초대는 최대 5개예요.');const token=random(),inviteId=crypto.randomUUID(),expires=Date.now()+86400000;await stmt('INSERT INTO invites(id,digest,owner_id,expires) VALUES(?,?,?,?)',inviteId,await digest(token),id,expires).run();return {id:inviteId,token,expires}},
 async accept(id,token){await requireUser(id);if(typeof token!=='string'||token.length>100)fail(400,'초대 링크를 확인해 주세요.');const row=await stmt('SELECT i.id,i.owner_id,u.name FROM invites i JOIN users u ON u.id=i.owner_id WHERE i.digest=? AND i.accepted_by IS NULL AND i.revoked=0 AND i.expires>?',await digest(token),Date.now()).first();if(!row)fail(410,'만료되었거나 사용된 초대예요.');if(row.owner_id===id)fail(400,'자신의 초대는 수락할 수 없어요.');const r=await stmt('UPDATE invites SET accepted_by=? WHERE id=? AND accepted_by IS NULL AND revoked=0 AND expires>?',id,row.id,Date.now()).run();if(!r.meta.changes)fail(410,'이미 사용된 초대예요.');return {name:row.name}},
 async revoke(id,inviteId){await requireUser(id);await stmt('UPDATE invites SET revoked=1 WHERE id=? AND owner_id=?',inviteId,id).run();return {ok:true}},
 async disconnect(id,other){await requireUser(id);if(typeof other!=='string')fail(400,'연결 정보를 확인해 주세요.');const [a,b]=[id,other].sort();await db.batch([stmt('DELETE FROM connections WHERE a=? AND b=?',a,b),stmt('UPDATE invites SET revoked=1 WHERE (owner_id=? AND accepted_by=?) OR (owner_id=? AND accepted_by=?)',id,other,other,id)]);return {ok:true}},
 async social(id){await requireUser(id);const rows=(await stmt('SELECT u.id,u.username,u.name,s.data FROM connections c JOIN users u ON u.id=CASE WHEN c.a=? THEN c.b ELSE c.a END JOIN study s ON s.user_id=u.id WHERE c.a=? OR c.b=?',id,id,id).all()).results;const feed=[];for(const person of rows){const data=JSON.parse(person.data);for(const kind of ['notes','lessons'])for(const x of data[kind]||[])if(x.shared===true)feed.push({id:x.id,ownerId:person.id,ownerName:person.name,kind,...(kind==='notes'?{english:x.english,meaning:x.meaning,category:x.category}:{text:x.text,date:x.date})});}return {people:rows.map(({id,username,name})=>({id,username,name})),feed,invites:(await stmt('SELECT id,expires FROM invites WHERE owner_id=? AND expires>? AND accepted_by IS NULL AND revoked=0',id,Date.now()).all()).results}},
 async copy(id,owner,noteId){const item=(await service.social(id)).feed.find(x=>x.ownerId===owner&&x.id===noteId&&x.kind==='notes');if(!item)fail(404,'더 이상 공유 중인 표현이 아니에요.');const current=await service.read(id);if(current.data.notes.some(x=>x.english.toLowerCase()===item.english.toLowerCase()))fail(409,'이미 저장한 표현이에요.');current.data.notes.unshift({id:crypto.randomUUID(),english:item.english,meaning:item.meaning,category:item.category||'자유 대화',due:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),interval:0,created:Date.now(),shared:false,source:'함께 공부'});return service.save(id,current)},
 async aiEligible(id){return !!await stmt(`WITH RECURSIVE reachable(id) AS (SELECT value FROM settings WHERE key='owner' UNION SELECT CASE WHEN c.a=r.id THEN c.b ELSE c.a END FROM connections c JOIN reachable r ON c.a=r.id OR c.b=r.id) SELECT id FROM reachable WHERE id=?`,id).first()}
 };return service;
}
