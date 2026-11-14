import {bestGrade,hint,nextInterval,parseBulk,parseShared,PASS,CLOSE} from './grade.js';
const STATIC_ONLY=window.STUDY_CONFIG?.staticOnly===true;
const API_BASE=(window.STUDY_CONFIG?.apiBase||'').replace(/\/$/,'');
const apiURL=path=>API_BASE+path;
const KEY='little-english-v1';
const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const addDays=(days)=>{const date=new Date();date.setDate(date.getDate()+days);return dayKey(date)};
const samples=[['I came here by van.','나는 밴을 타고 여기까지 왔어.','여행'],['a little by little','조금씩, 천천히 → little by little','일상'],["I'm working on a new project.",'새로운 프로젝트를 작업하고 있어.','작업과 취미']].map((x,i)=>({id:`sample-${i}`,english:i===1?'little by little':x[0],meaning:i===1?'조금씩, 천천히':x[1],category:x[2],due:dayKey(),interval:0,sample:true,created:Date.now()-i}));
let state={notes:samples,history:[],goal:5,voiceURI:'',speechRate:1};let storageAvailable=true;
try{const raw=JSON.parse(localStorage.getItem(KEY));if(raw&&Array.isArray(raw.notes)&&Array.isArray(raw.history))state={...state,...raw};}catch{storageAvailable=false;}
let quickDraft={english:'',meaning:''},vocabularyQuery='',vocabularyResult=null,vocabularyBusy=false,vocabularyError='';
let page='home',search='',reviewId=null,revealed=false,reviewed=0,recognition=null,topic='일상',draft='',listening=false;
const $=(q)=>document.querySelector(q);
const ICONS={
 home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
 notes:'<path d="M2 5h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/><path d="M22 5h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
 review:'<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/>',
 friends:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
 speaker:'<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
 edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
 bookmark:'<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 crown:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
 book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
 download:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 chevron:'<path d="m9 6 6 6-6 6"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>',
 arrowUp:'<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
 eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 eyeOff:'<path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/>',
 mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0"/><path d="M12 17v4"/>',
 check:'<path d="M20 6 9 17l-5-5"/>',
 retry:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
 arrowRight:'<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
 turtle:'<path d="M4 14a8 6 0 0 1 16 0v1H4z"/><path d="M20 14h2l-1-3"/><path d="M6 15v3M18 15v3M9 9l3 5 3-5"/>',
 bulb:'<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
};
const ui=(name,cls='')=>`<svg class="ui-icon${cls?' '+cls:''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`;
const ago=n=>{const d=Math.floor((Date.now()-(Number(n.created)||Date.now()))/864e5);return d<=0?'오늘 저장':`${d}일 전`};

const esc=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const due=()=>state.notes.filter(n=>n.due<=dayKey());
const todayReviews=()=>state.history.filter(h=>h.date===dayKey()).length;
function persist(){if(currentUser){queueSave();return}try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageAvailable=false;toast('브라우저 저장 공간을 사용할 수 없어요. 이번 화면에서만 기록됩니다.');}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),3500)}
function streak(){const dates=new Set(state.history.map(h=>h.date));let d=new Date(),count=0;if(!dates.has(dayKey(d)))d.setDate(d.getDate()-1);while(dates.has(dayKey(d))){count++;d.setDate(d.getDate()-1)}return count}
function navigate(next){if(!['home','notes','review','together','settings'].includes(next))next='notes';if(next==='together'&&currentUser)refreshSocial();stopRecording(true);if(recognition)recognition.stop();stopAnswer();resetCard();later=[];page=next;reviewId=null;revealed=false;reviewed=0;render();window.scrollTo({top:0,behavior:'smooth'})}
function rows(notes){return notes.length?notes.map(n=>page==='notes'?`<article class="note-row swipe" data-row="${esc(n.id)}"><div class="note-body"><h3 lang="en">${esc(n.english)}</h3><p>${n.meaning?esc(n.meaning):'<em class="warn">한글 뜻을 추가해 주세요</em>'}</p></div><button class="row-toggle" data-row-toggle="${esc(n.id)}" aria-label="표현 메뉴 열기" aria-expanded="false">${ui('chevron')}</button><div class="row-tray" aria-hidden="true"><button class="tray-btn" data-speak="${esc(n.id)}" aria-label="표현 듣기" tabindex="-1">${ui('speaker')}</button><button class="tray-btn" data-edit="${esc(n.id)}" aria-label="표현 수정" tabindex="-1">${ui('edit')}</button><button class="tray-btn danger" data-delete="${esc(n.id)}" aria-label="표현 삭제" tabindex="-1">${ui('trash')}</button></div></article>`:`<article class="note-row"><div class="note-actions"><button class="icon-btn" data-speak="${esc(n.id)}" aria-label="표현 듣기">${ui('speaker')}</button></div><div class="note-body"><h3 lang="en">${esc(n.english)}</h3><p>${n.meaning?esc(n.meaning):'<em class="warn">한글 뜻을 추가해 주세요</em>'}</p></div></article>`).join(''):'<div class="empty">아직 저장한 표현이 없어요.<br>헤이링에서 배운 문장을 담아 보세요.</div>'}
// Notebook rows: tap the green arrow or swipe left to reveal listen / edit / delete.
function setRowOpen(row,open){if(!row)return;document.querySelectorAll('.note-row.open').forEach(r=>{if(r!==row){r.classList.remove('open');r.querySelector('.row-toggle')?.setAttribute('aria-expanded','false');r.querySelector('.row-tray')?.setAttribute('aria-hidden','true');r.querySelectorAll('.tray-btn').forEach(b=>b.tabIndex=-1)}});row.classList.toggle('open',open);row.querySelector('.row-toggle')?.setAttribute('aria-expanded',String(open));row.querySelector('.row-tray')?.setAttribute('aria-hidden',String(!open));row.querySelectorAll('.tray-btn').forEach(b=>b.tabIndex=open?0:-1)}
document.addEventListener('click',e=>{const t=e.target.closest?.('[data-row-toggle]');if(t&&t.dataset?.rowToggle){const row=t.closest?.('.note-row');if(row?.classList)setRowOpen(row,!row.classList.contains('open'));return}if(!e.target.closest?.('.note-row'))document.querySelectorAll('.note-row.open').forEach(r=>setRowOpen(r,false))});
let swipe=null;
document.addEventListener('pointerdown',e=>{const row=e.target.closest?.('.note-row.swipe');if(!row||e.target.closest('button')||e.pointerType==='mouse')return;swipe={row,x:e.clientX,y:e.clientY}});
document.addEventListener('pointerup',e=>{if(!swipe)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.5)setRowOpen(swipe.row,dx<0);swipe=null});
document.addEventListener('pointercancel',()=>{swipe=null});
function week(){const start=new Date();start.setDate(start.getDate()-((start.getDay()+6)%7));const dates=new Set(state.history.map(h=>h.date));return ['월','화','수','목','금','토','일'].map((label,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const key=dayKey(d),done=dates.has(key);return `<div class="day ${done?'done':''} ${key===dayKey()?'today':''}">${label}<span>${done?'✓':d.getDate()}</span></div>`}).join('')}
function home(){const count=due().length,done=todayReviews(),goal=Number(state.goal)||5,pct=Math.min(100,Math.round(done/goal*100)),len=282.7;return `<section class="card mission"><div class="gauge"><svg viewBox="0 0 220 122" aria-hidden="true"><defs><linearGradient id="gauge-grad" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#5b7cff"/><stop offset="1" stop-color="#b47cf5"/></linearGradient></defs><path class="gauge-track" d="M20 112A90 90 0 0 1 200 112"/><path class="gauge-fill" d="M20 112A90 90 0 0 1 200 112" stroke-dasharray="${len}" stroke-dashoffset="${(len*(1-pct/100)).toFixed(1)}"/></svg><div class="gauge-center"><span class="spark">✦</span><strong>오늘의 미션</strong><span class="gauge-pct">${pct}%</span></div></div><p class="mission-meta">${done} / ${goal}개 완료 · <b>${streak()}일</b> 연속 복습</p><button class="pill primary block" data-page="review">${count?`복습 시작 · ${count}개`:'오늘 복습 완료!'}</button><button class="pill ghost block" data-page="notes">오늘 배운 표현 기록하기</button></section><section class="card week-card"><h2 class="card-title">이번 주의 작은 꾸준함</h2><div class="days">${week()}</div></section><section class="block-section"><div class="section-title"><h2>최근 표현</h2><button class="link" data-page="notes">모두 보기 ${ui('chevron')}</button></div><div class="notes-list">${rows(state.notes.slice(0,3))}</div></section>`}
function notes(){const list=state.notes.filter(n=>`${n.english} ${n.meaning}`.toLowerCase().includes(search.toLowerCase()));return `<form class="card compose" id="quick-expression-form"><h2 class="card-title">새 표현 담기</h2><div class="field"><label for="quick-english">영어</label><textarea id="quick-english" required maxlength="1000" rows="2" lang="en" placeholder="I came here by van.">${esc(quickDraft.english)}</textarea></div><div class="field"><label for="quick-meaning">한글 뜻</label><textarea id="quick-meaning" required maxlength="1000" rows="2" lang="ko" placeholder="나는 밴을 타고 여기까지 왔어.">${esc(quickDraft.meaning)}</textarea></div><div class="compose-actions"><button class="pill primary" type="submit">${ui('bookmark')}저장</button></div></form>
<section class="block-section" id="saved-expressions"><div class="section-title"><h2>저장한 표현 <small>${state.notes.length}</small></h2></div><label class="search">${ui('search')}<input id="search" aria-label="저장한 표현 검색" placeholder="영어나 뜻으로 찾기" value="${esc(search)}"></label><div class="notes-list">${rows(list)}</div></section>
<section class="card vocabulary-panel" id="word-lookup"><h2 class="card-title">${ui('bulb')}모르는 단어 찾기</h2><form id="vocabulary-form" class="vocabulary-search"><label class="sr-only" for="vocabulary-query">찾을 영어 단어 또는 표현</label><input id="vocabulary-query" maxlength="100" required value="${esc(vocabularyQuery)}" placeholder="figure out, curious…" ${vocabularyBusy?'disabled':''}><button class="pill" ${vocabularyBusy?'disabled':''}>${vocabularyBusy?'찾는 중…':'찾기'}</button></form><p class="helper" role="status">${esc(vocabularyError)}</p>${vocabularyResult?`<div class="vocabulary-result"><h3 lang="en">${esc(vocabularyResult.query)}</h3><p class="summary">${esc(vocabularyResult.summary)}</p>${vocabularyResult.expressions.map((x,i)=>`<article class="example-card"><p class="ex-en" lang="en">${esc(x.english)}</p><p class="ex-ko">${esc(x.meaning)}</p>${x.tip?`<small>${esc(x.tip)}</small>`:''}<div class="example-actions"><button class="icon-btn" data-example-listen="${i}" aria-label="${i+1}번 예문 듣기">${ui('speaker')}</button><button class="pill sm" data-example-use="${i}">${ui('bookmark')}저장</button></div></article>`).join('')}<p class="helper">AI 설명은 틀릴 수 있어요.</p></div>`:''}</section>`}
const prompts={'일상':['How was your day?','오늘 기억에 남는 순간을 한 문장으로 이야기해 보세요.'],'여행':['Where would you like to go?','가고 싶은 곳이나 최근 여행에 대해 이야기해 보세요.'],'작업과 취미':['What are you working on lately?','만들고 있는 작품이나 요즘 즐기는 취미를 소개해 보세요.'],'자유 대화':["What's on your mind?",'어떤 이야기든 좋아요. 떠오르는 생각을 말해 보세요.']};
function review(){return reviewPage()}
function settings(){return `<form class="card settings-card" id="settings-form"><h2 class="card-title">하루 복습 목표</h2><div class="inline-row"><select id="goal" aria-label="하루 복습 목표">${[3,5,10,15].map(n=>`<option value="${n}" ${Number(state.goal)===n?'selected':''}>${n}개</option>`).join('')}</select><button class="pill primary">저장</button></div></form><section class="card settings-card"><h2 class="card-title">영어 목소리</h2><label for="voice">목소리</label><select id="voice">${voiceOptions()}</select><label for="speech-rate">속도</label><select id="speech-rate">${[.8,.9,1,1.1].map(rate=>`<option value="${rate}" ${Number(state.speechRate)===rate?'selected':''}>${rate}배${rate===1?' · 기본':''}</option>`).join('')}</select><button type="button" class="pill" id="preview-voice">${ui('speaker')}미리 듣기</button></section><section class="card settings-card"><h2 class="card-title">기록 보관</h2><p class="helper">${currentUser?'내 계정에 저장돼요.':'이 브라우저에만 저장돼요. 가끔 파일로 백업해 두세요.'}</p><button type="button" class="pill" id="export">${ui('download')}기록 다운로드</button></section>${currentUser?`<section class="card settings-card"><h2 class="card-title">이 브라우저에서 공부했던 기록</h2><p class="helper">로그인 전에 이 브라우저에 저장한 표현을 내 계정으로 가져와요.</p><button type="button" class="pill" id="import-local">기존 기록 가져오기</button></section>`:''}<button class="pill ghost block" data-page="together">${ui('friends')}${currentUser?esc(currentUser.name)+' · 계정과 친구':'로그인 · 친구 초대'}</button>`}
function render(){if(accountLoading){$('#content').innerHTML='<div class="empty">불러오는 중이에요…</div>';return}if(recorder)stopRecording(true);const labels={home:'오늘의 영어',notes:'표현 노트',review:'복습',settings:'설정',together:'함께 공부',talk:'말하기',lesson:'헤이링'};const set=(q,v)=>{const el=$(q);if(el)el.textContent=v};set('#page-label',labels[page]);set('#streak-count',String(streak()));set('#avatar',(currentUser?.name||'나').slice(0,1));set('#account-label',currentUser?`${currentUser.name} · ${syncStatus}`:'로그인');set('#nav-count',String(state.notes.length));const dueDot=$('#nav-due');if(dueDot)dueDot.hidden=!due().length;document.querySelectorAll('.nav').forEach(el=>{el.classList.toggle('active',el.dataset.page===page);if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});if(document.body)document.body.dataset.page=page;$('#content').innerHTML=({home,notes,review,settings,together})[page]();}
function openAdd(text='',note=null){if(recognition)recognition.stop();stopAnswer();$('#expression-form').reset();editingId=note?.id||null;$('#english').value=note?.english??text;$('#meaning').value=note?.meaning??'';$('#add-title').textContent=note?'표현 고치기':'기억하고 싶은 표현';$('#add-submit').firstChild.textContent=note?'수정 내용 저장하기 ':'내 표현으로 저장하기 ';$('#add-dialog').showModal();if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{for(const id of ['#english','#meaning'])fitField($(id))});(note&&!note.meaning?$('#meaning'):$('#english')).focus()}
function englishVoices(){
  if(!('speechSynthesis' in window))return [];
  const score=v=>(/natural|premium|enhanced|neural/i.test(v.name)?100:0)+(/Google|Samantha|Daniel/i.test(v.name)?20:0)+(v.lang==='en-US'?5:0);
  return speechSynthesis.getVoices().filter(v=>/^en(?:-|_)/i.test(v.lang)).sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name));
}
function voiceOptions(){const voices=englishVoices();return `<option value="">자동 선택${voices.length?' · '+esc(voices[0].name):' · 브라우저 기본 음성'}</option>`+voices.map(v=>`<option value="${esc(v.voiceURI)}" ${state.voiceURI===v.voiceURI?'selected':''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}
// ---- native voice (Azure neural TTS) with on-device cache; falls back to the browser voice ----
const ttsMemory=new Map();let ttsAudio=null,ttsSeq=0;
function wavBytes(samples,rate){const buf=new ArrayBuffer(44+samples.length*2),v=new DataView(buf),w=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i))};w(0,'RIFF');v.setUint32(4,36+samples.length*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++){const x=Math.max(-1,Math.min(1,samples[i]));v.setInt16(44+i*2,x<0?x*0x8000:x*0x7fff,true)}return new Uint8Array(buf)}
async function toWav16k(blob){const AC=window.AudioContext||window.webkitAudioContext,OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!AC||!OAC)throw Error('wav');const ctx=new AC();try{const decoded=await ctx.decodeAudioData(await blob.arrayBuffer());const frames=Math.max(1,Math.ceil(decoded.duration*16000));const off=new OAC(1,frames,16000);const src=off.createBufferSource();src.buffer=decoded;src.connect(off.destination);src.start();const out=await off.startRendering();return new Blob([wavBytes(out.getChannelData(0),16000)],{type:'audio/wav'})}finally{ctx.close?.().catch?.(()=>{})}}
function ttsElement(){if(!ttsAudio){ttsAudio=new Audio();ttsAudio.preload='auto'}return ttsAudio}
const canUseAzureVoice=()=>apiAzure&&!STATIC_ONLY&&!!currentUser&&typeof Audio==='function';
async function azureAudioURL(text,slow,pauses){
 const key=`${slow?'s75':'n'}|${text}`;if(ttsMemory.has(key))return ttsMemory.get(key);
 const cacheKey=`${location.origin}/__tts/${encodeURIComponent(key)}`;let blob=null;
 try{const cache=await caches.open('tts-v1');const hit=await cache.match(cacheKey);if(hit)blob=await hit.blob()}catch{}
 if(!blob){const response=await fetch(apiURL('/api/tts'),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Study-User':currentUser.id},body:JSON.stringify({text,slow,pauses}),signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('tts');blob=await response.blob();try{const cache=await caches.open('tts-v1');await cache.put(cacheKey,new Response(blob,{headers:{'Content-Type':'audio/mpeg'}}))}catch{}}
 const url=URL.createObjectURL(blob);ttsMemory.set(key,url);return url;
}
function playEnglish(text,options={}){
 if(!canUseAzureVoice())return playBrowserVoice(text,options);
 const slow=(Number(options.rate)||Number(state.speechRate)||1)<.8;const note=state.notes.find(n=>n.english===text);const pauses=note?.guide?.for===text?note.guide.words.map((w,i)=>w.pause?i:-1).filter(i=>i>=0):[];
 if('speechSynthesis' in window)speechSynthesis.cancel();
 const audio=ttsElement(),seq=++ttsSeq;audio.pause();
 // Start playback inside the tap so iOS keeps the element unlocked for the async load.
 if(!audio.dataset.unlocked){audio.src=URL.createObjectURL(new Blob([wavBytes(new Float32Array(160),16000)],{type:'audio/wav'}));audio.play().catch(()=>{});audio.dataset.unlocked='1'}
 azureAudioURL(text,slow,pauses).then(url=>{if(seq!==ttsSeq)return;audio.src=url;audio.currentTime=0;return audio.play()}).catch(()=>{if(seq===ttsSeq)playBrowserVoice(text,options)});
}
function playBrowserVoice(text,{voiceURI=state.voiceURI,rate=state.speechRate}={}){
  if(!('speechSynthesis' in window))return toast('이 브라우저에서는 음성 재생을 지원하지 않아요.');
  speechSynthesis.cancel();
  const voices=englishVoices(),voice=voices.find(v=>v.voiceURI===voiceURI)||voices[0];
  const utterance=new SpeechSynthesisUtterance(text);
  if(voice)utterance.voice=voice;
  utterance.lang=voice?.lang||'en-US';
  utterance.rate=Math.max(.5,Math.min(1.2,Number(rate)||1));
  utterance.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))toast('음성을 재생하지 못했어요. 다른 목소리를 선택해 주세요.')};
  speechSynthesis.speak(utterance);
}
function speak(id){const note=state.notes.find(n=>n.id===id);if(note)playEnglish(note.english)}

function microphone(){const API=window.SpeechRecognition||window.webkitSpeechRecognition;if(!API)return toast('음성 입력은 Chrome 등 지원 브라우저에서 사용해 주세요. 직접 입력도 가능해요.');if(listening){recognition.stop();return}recognition=new API();recognition.lang='en-US';recognition.interimResults=false;recognition.continuous=false;recognition.onstart=()=>{listening=true;if($('#mic'))$('#mic').textContent='■ 입력 마치기';if($('#speech-status'))$('#speech-status').textContent='듣고 있어요. 영어로 편하게 말해 보세요.';};recognition.onresult=e=>{draft=[draft,e.results[0][0].transcript].filter(Boolean).join(' ');if($('#draft'))$('#draft').value=draft;};recognition.onerror=e=>toast(e.error==='not-allowed'?'마이크 권한이 필요해요. 브라우저 설정에서 허용해 주세요.':'음성을 인식하지 못했어요. 다시 시도하거나 직접 입력해 주세요.');recognition.onend=()=>{listening=false;recognition=null;if($('#mic'))$('#mic').textContent='♩ 음성으로 입력';if($('#speech-status'))$('#speech-status').textContent='입력이 끝났어요. 문장을 확인하고 표현 노트에 담아보세요.';};try{recognition.start()}catch{toast('마이크를 시작할 수 없어요. 직접 입력해 주세요.')}}
document.addEventListener('click',e=>{const target=e.target.closest('button,a');if(!target)return;if(target.dataset.page){navigate(target.dataset.page);return}if(target.matches('[data-add]'))openAdd();if(target.dataset.speak)speak(target.dataset.speak);if(target.dataset.delete){state.notes=state.notes.filter(n=>n.id!==target.dataset.delete);persist();render();toast('표현을 삭제했어요.')}if(target.dataset.topic){topic=target.dataset.topic;if(recognition)recognition.stop();render()}if(target.id==='close-dialog')$('#add-dialog').close();if(target.id==='mic')microphone();if(target.id==='save-draft'){draft=$('#draft').value;if(!draft.trim())return toast('먼저 한 문장을 말하거나 입력해 주세요.');openAdd(draft)}if(target.id==='reveal'){stopAnswer();revealed=true;render()}if(target.dataset.rate)rate(target.dataset.rate);if(target.id==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`little-english-${dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('기록을 파일로 저장했어요.')}});
document.addEventListener('input',e=>{if(e.target.id==='draft')draft=e.target.value;if(e.target.id==='search'){const pos=e.target.selectionStart;search=e.target.value;render();$('#search').focus();$('#search').setSelectionRange(pos,pos)}});
$('#expression-form').addEventListener('submit',e=>{e.preventDefault();const english=$('#english').value.trim(),meaning=$('#meaning').value.trim(),category='';if(!english||!meaning)return;const editing=editingId&&state.notes.find(n=>n.id===editingId);if(editing){Object.assign(editing,{english,meaning,category,sample:false});editingId=null;persist();$('#add-dialog').close();render();toast('표현을 고쳤어요. 복습 일정은 그대로예요.');return}if(state.notes.some(n=>n.english.trim().toLowerCase()===english.toLowerCase()))return toast('이미 노트에 있는 표현이에요.');state.notes.unshift({id:crypto.randomUUID(),english,meaning,category,due:dayKey(),interval:0,sample:false,created:Date.now()});persist();$('#add-dialog').close();if(page==='talk')draft='';render();toast(storageAvailable?'표현을 저장했어요. 오늘 복습에서 다시 만나요!':'이번 화면에 저장했어요. 브라우저 영구 저장은 사용할 수 없어요.');});
document.addEventListener('submit',e=>{if(e.target.id==='settings-form'){e.preventDefault();state.goal=Number($('#goal').value);persist();toast('나만의 복습 목표를 저장했어요.')}});
window.addEventListener('focus',()=>{if(!$('#add-dialog').open&&!listening&&!recorder&&['home','settings'].includes(page))render()});


document.addEventListener('change',e=>{
  if(e.target.id==='voice'){state.voiceURI=e.target.value;persist();}
  if(e.target.id==='speech-rate'){state.speechRate=Number(e.target.value);persist();}
});
document.addEventListener('click',e=>{if(e.target.closest('#preview-voice'))playEnglish("Hey Yewon! How was your day? Let's practice a little English together.")});
if('speechSynthesis' in window){
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener('voiceschanged',()=>{if($('#voice'))$('#voice').innerHTML=voiceOptions()});
}

// ---- Speaking review: Korean prompt only, answer by voice (or typing), graded in the browser ----
let answerNotice='',answerDraft='',answerAudioURL='',holdSession=null,micReady=false,micPreparing=false,peek=false;
let attempt=null,hinted=false,tries=0,answerRec=null,answerFor=null,later=[],editingId=null;
const SpeechAPI=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
function resetCard(){answerNotice='';answerDraft='';if(answerAudioURL){URL.revokeObjectURL(answerAudioURL);answerAudioURL=''}attempt=null;hinted=false;peek=false;tries=0;revealed=false}
function reviewQueue(){const list=due();const back=later.map(id=>list.find(n=>n.id===id)).filter(Boolean);return [...list.filter(n=>!later.includes(n.id)),...back]}
function currentCard(){const q=reviewQueue();const card=q.find(n=>n.id===reviewId)||q[0];if(card&&card.id!==reviewId){reviewId=card.id;resetCard()}return card}
function intervalLabel(days){return days===0?'오늘 다시':days===1?'내일':days<30?`${days}일 후`:`${Math.round(days/30*10)/10}개월 후`}
function suggested(){return attempt&&attempt.score>=PASS?'good':'again'}
function highlighted(words){return words.map(w=>`<button type="button" class="word-say ${w.hit===undefined?'':w.hit?'hit':'miss'}" data-say-word="${esc(w.text)}">${esc(w.text)}</button>`).join(' ')}
const autoRating=()=>attempt&&attempt.score>=0.8&&(!attempt.pron?.scores?.pron||attempt.pron.scores.pron>=60)?'good':'again';
const tone=a=>a==null?'':a>=80?'good':a>=60?'fair':'poor';
function pronHTML(english,pron){
 const display=english.split(/\s+/).filter(Boolean),spoken=(pron.words||[]).filter(w=>w.error!=='Insertion');
 if(spoken.length!==display.length)return highlighted(display.map(text=>({text})));
 return display.map((text,i)=>{const w=spoken[i],letters=text.replace(/[^A-Za-z0-9']/g,'');
  if(w.error==='Omission')return `<button type="button" class="word-say omit" data-say-word="${esc(text)}">${esc(text)}</button>`;
  const sy=w.syllables||[],joined=sy.map(x=>x.grapheme).join('');
  let inner=esc(text);
  if(sy.length>1&&joined.toLowerCase()===letters.toLowerCase()){let pos=0,html='',rest=text;const start=text.search(/[A-Za-z0-9']/);html=esc(text.slice(0,Math.max(0,start)));pos=Math.max(0,start);
   for(const x of sy){html+=`<span class="${tone(x.accuracy)}">${esc(text.slice(pos,pos+x.grapheme.length))}</span>`;pos+=x.grapheme.length}inner=html+esc(text.slice(pos))}
  return `<button type="button" class="word-say ${sy.length>1&&joined.toLowerCase()===letters.toLowerCase()?'':tone(w.accuracy)}" data-say-word="${esc(text)}" title="정확도 ${w.accuracy??'-'}">${inner}</button>`}).join(' ');
}
function guideHTML(g){if(!g)return '';const arrow={rise:'↗',fall:'↘','rise-fall':'↗↘'}[g.intonation]||'';return `<div class="say-guide"><p class="guide-line" lang="en">${g.words.map((w,i)=>`<span class="gw ${w.focus?'focus':''}">${w.syllables.map((sy,k)=>k===w.stress?`<b>${esc(sy)}</b>`:esc(sy)).join('<i>·</i>')}</span>${w.link&&i<g.words.length-1?'<span class="link">‿</span>':''}${w.pause?'<span class="pause">|</span>':''}`).join(' ')} <span class="tone">${arrow}</span></p>${g.tip&&/[가-힣]/.test(g.tip)&&!/[\u3040-\u30ff\u4e00-\u9fff]/.test(g.tip)?`<p class="guide-tip">${esc(g.tip)}</p>`:''}</div>`}
let guideBusy=new Set();
const koreanText=t=>/[가-힣]/.test(t)&&!/[\u3040-\u30ff\u4e00-\u9fff]/.test(t);
const guideOK=n=>!!n?.guide&&n.guide.for===n.english&&(!n.guide.tip||koreanText(n.guide.tip));
async function ensureGuide(note){
 if(!note||guideOK(note)||STATIC_ONLY||!currentUser||apiConfigured===false||guideBusy.has(note.id))return;
 guideBusy.add(note.id);const owner=currentUser.id;
 try{const response=await fetch(apiURL('/api/guide'),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Study-User':owner},body:JSON.stringify({text:note.english}),signal:AbortSignal.timeout(50000)});
  const data=await response.json();if(!response.ok||currentUser?.id!==owner)return;
  note.guide={...data,for:note.english};persist();if(page==='review'&&reviewId===note.id&&revealed)render();
 }catch{}finally{guideBusy.delete(note.id)}
}
function reviewPage(){
 const current=currentCard();const left=reviewQueue().length;
 const head=`<div class="review-top"><button class="icon-btn close-review" data-page="home" aria-label="복습 닫기">${ui('x')}</button><div class="bar"><span style="width:${Math.round(reviewed/Math.max(1,reviewed+left)*100)}%"></span></div><span class="review-count">${left?`${left}개 남음`:'완료'}</span></div>`;
 if(!current)return `${head}<section class="card done-card"><span class="done-badge">${ui('crown')}</span><h2>${state.notes.length?'오늘 복습 끝!':'첫 표현을 담아볼까요?'}</h2><p class="helper">${state.notes.length?'내일 다시 만나요.':'표현을 저장하면 여기서 말하며 복습해요.'}</p><button class="pill primary block" data-page="notes">${ui('bookmark')}새 표현 담기</button></section>`;
 const listening=holdSession?.noteId===current.id&&holdSession.phase==='recording';
 const processing=holdSession?.noteId===current.id&&holdSession.phase==='processing';
 const prompt=current.meaning?esc(current.meaning):`<span class="helper">한글 뜻이 비어 있어요. 힌트를 보고 말해보세요.</span>`;
 const showHint=!current.meaning&&!revealed?`<p class="hint-line">${esc(hint(current.english))}</p>`:'';
 let body;
 if(!revealed){
  const feedback=attempt?`<div class="attempt ${attempt.score>=CLOSE?'close':'far'}"><strong>${attempt.score>=CLOSE?'거의 다 왔어요!':'아쉬워요, 한 번 더!'}</strong> <span>${Math.round(attempt.score*100)}% 일치 · ${tries}번째 시도</span><p>내 답변: “${esc(attempt.said||'(인식된 말 없음)')}”</p></div>`:'';
  const elapsed=listening&&holdSession.started?Math.min(30,(Date.now()-holdSession.started)/1000):0;
  const tip=holdSession?.noteId===current.id?(listening?'다 말했으면 ↑ 를 눌러 보내세요':processing?'듣고 있어요…':'마이크 연결 중…'):attempt?'다시 말해볼까요?':'문장을 만들어보세요';
  body=`${showHint}${feedback}<div class="voice-panel"><span class="speak-tip" ${listening?'hidden':''}>${tip}</span><div class="voice-wave ${listening?'on':''}" id="voice-wave" aria-hidden="true">${'<i></i>'.repeat(28)}</div><div class="control-row"><button type="button" class="ctrl cancel" id="cancel-answer" aria-label="녹음 취소" ${listening?'':'hidden'}>${ui('x')}</button><button type="button" class="mic-big ${listening?'on':''} ${processing?'busy':''}" id="say-answer" aria-label="${listening?'녹음 보내기':'눌러서 영어로 말하기'}" aria-pressed="${!!listening}" ${processing?'disabled':''}><span class="mic-symbol" aria-hidden="true">${listening?`<svg class="ring" viewBox="0 0 100 100"><circle class="ring-track" cx="50" cy="50" r="46"/><circle class="ring-fill" cx="50" cy="50" r="46" style="animation-delay:-${elapsed.toFixed(1)}s"/></svg>${ui('arrowUp')}`:processing?'<span class="spinner"></span>':ui('mic')}</span><span class="mic-label">${processing?'음성을 인식하고 있어요…':listening?'녹음 중 · ↑ 를 눌러 보내기':'눌러서 말하기'}</span><small class="mic-caption">${listening?'최대 30초':''}</small></button><span class="ctrl spacer" aria-hidden="true"></span></div><p class="heard" id="heard" aria-live="polite">${esc(answerDraft)}</p><p class="helper" id="answer-notice" role="status">${esc(answerNotice)}</p></div><form id="type-answer" class="type-answer"><input id="typed" value="${esc(answerDraft)}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="말하기 어려울 땐 직접 입력" aria-label="직접 입력해서 맞추기"><button class="pill primary sm check-btn" aria-label="확인">${ui('check')}</button></form><button class="link give-up" id="reveal">모르겠어요 · 정답 보기</button>`;
 }else{
  const passed=attempt&&attempt.score>=PASS;
  const options=[['again','다시 볼래요'],['good','기억나요'],['easy','쉬워요']];
  const pick=suggested();
  if(!(guideOK(current)))ensureGuide(current);
  body=`${attempt?`<p class="said"><span>내 답변</span>${esc(attempt.said)}</p>`:''}<div class="listen-row"><button class="pill listen" data-speak="${esc(current.id)}" aria-label="원어민 발음 듣기">${ui('speaker')}원어민</button><button class="pill listen" data-speak-slow="${esc(current.id)}" aria-label="천천히 듣기">${ui('turtle')}천천히</button><button class="pill listen" id="play-mine" ${answerAudioURL?'':'disabled'} aria-label="내 녹음 다시 듣기">${ui('speaker')}나</button>${answerAudioURL?`<audio id="my-audio" src="${esc(answerAudioURL)}" preload="auto"></audio>`:''}</div><div class="next-row"><span class="ctrl spacer" aria-hidden="true"></span><button class="round-btn retry" id="retry-card" aria-label="다시 말해보기">${ui('retry')}</button><button class="round-btn next" id="next-card" aria-label="다음 표현 (${autoRating()==='good'?'기억나요':'오늘 다시'})">${ui('arrowRight')}</button></div>`;
 }
 const words=current.english.split(/\s+/).filter(Boolean),hits=attempt?attempt.words.map(w=>w.hit):[];
 const bars=revealed?'':`<div class="word-bars ${peek?'peeking':''}" aria-label="영어 정답 ${words.length}단어">${words.map((w,i)=>peek?`<span class="word-peek" lang="en">${esc(w)}</span>`:`<span class="word-chunk">${(w.match(/^[^A-Za-z0-9]+/)||[''])[0]?`<span class="punct">${esc(w.match(/^[^A-Za-z0-9]+/)[0])}</span>`:''}<span class="word-bar ${hits[i]?'hit':''}" style="width:${Math.min(150,Math.max(12,w.replace(/[^A-Za-z0-9]/g,'').length*12))}px"></span>${(w.match(/[^A-Za-z0-9]+$/)||[''])[0]?`<span class="punct">${esc(w.match(/[^A-Za-z0-9]+$/)[0])}</span>`:''}</span>`).join('')}</div>`;
 const passedNow=revealed&&attempt&&attempt.score>=PASS;
 const ps=attempt?.pron?.scores;const pct=revealed&&attempt?(ps?.pron??Math.round(attempt.score*100)):0,word=!attempt?'Answer':pct>=90?'Great!':pct>=75?'Good!':'Try<br>Again';
 const verdict=revealed?`<div class="verdict-arc ${attempt?(pct>=75?'pass':'retry'):'shown'}"><svg viewBox="0 0 200 110" aria-hidden="true"><defs><linearGradient id="arc-grad" x1="0" x2="1"><stop offset="0" stop-color="#e8fbe9"/><stop offset=".55" stop-color="#8be37b"/><stop offset="1" stop-color="#3fe2a8"/></linearGradient></defs><path class="arc-track" d="M18 102A82 82 0 0 1 182 102"/><path class="arc-fill" d="M18 102A82 82 0 0 1 182 102" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100-pct}"/></svg><strong>${word}</strong></div><p class="verdict-sub">${ps?`${passedNow?'정답이에요! · ':''}발음 ${ps.pron??'-'}점`:passedNow?`정답이에요! · ${pct}% 일치`:attempt?`${pct}% 일치 · 빨간 단어를 다시 연습해 보세요`:'정답을 확인해 보세요'}</p>${ps?`<div class="score-chips"><span>정확도 <b>${ps.accuracy??'-'}</b></span><span>유창성 <b>${ps.fluency??'-'}</b></span>${ps.prosody!=null?`<span>억양·리듬 <b>${ps.prosody}</b></span>`:''}</div>`:''}`:'';
 const stage=revealed?`<div class="speak-stage result-stage">${verdict}<p class="answer-en ${current.english.length>36?'long':''}" lang="en">${attempt?.pron?.scores?pronHTML(current.english,attempt.pron):highlighted(attempt?attempt.words:current.english.split(/\s+/).filter(Boolean).map(text=>({text})))}</p><p class="prompt-sub">${prompt}</p>${guideOK(current)?guideHTML(current.guide):(!STATIC_ONLY&&currentUser&&apiConfigured!==false?'<p class="guide-loading">말하는 법 불러오는 중…</p>':'')}</div>`:`<div class="speak-stage"><button class="listen-btn" data-speak="${esc(current.id)}" aria-label="영어 문장 듣기">${ui('speaker')}</button>${bars}<h2 class="prompt-ko">${prompt}</h2></div>`;
 return `${head}<section class="review-card">${stage}${body}</section>`;
}
function stopAnswer(){
 const session=holdSession;if(!session)return;
 session.cancelled=true;session.released=true;holdSession=null;clearTimeout(session.timer);try{session.audioCtx?.close()}catch{}session.controller?.abort();
 if(session.recorder?.state==='recording')try{session.recorder.stop()}catch{}
 session.stream?.getTracks().forEach(track=>track.stop());
}
function submitAnswer(alternatives,pron=null){
 const note=state.notes.find(n=>n.id===reviewId);if(!note||revealed)return;
 tries++;attempt=bestGrade(note.english,alternatives.filter(Boolean));if(pron?.scores)attempt.pron=pron;
 if(attempt.score>=PASS){revealed=true;render();playEnglish(note.english)}else render();
}
function setAnswerNotice(text){
 answerNotice=text;const el=$('#answer-notice');if(el)el.textContent=text;
}
function updateHoldButton(text,pressed=false){
 const button=$('#say-answer');if(!button)return;
 const label=button.querySelector('.mic-label');if(label)label.textContent=text;
 
 const caption=button.querySelector('.mic-caption');if(caption)caption.textContent=pressed?'위로 밀면 취소':'손을 떼면 완료 · 최대 30초';
 button.classList.toggle('on',pressed);button.setAttribute('aria-pressed',String(pressed));
}
async function prepareMicrophone(){
 if(micPreparing||holdSession)return;
 if(!currentUser){setAnswerNotice('마이크 복습은 로그인 후 사용할 수 있어요. 위쪽 로그인 버튼을 눌러 주세요.');return}
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setAnswerNotice('Safari나 Chrome에서 사이트를 직접 열어 주세요.');return}
 micPreparing=true;const owner=currentUser.id;render();
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  stream.getTracks().forEach(track=>track.stop());micReady=true;
  if(page==='review'&&currentUser?.id===owner)setAnswerNotice('준비됐어요. 아래 버튼을 꾹 누르고 말한 뒤 손을 떼세요.');
 }catch{if(page==='review')setAnswerNotice('마이크 권한을 허용한 뒤 다시 준비 버튼을 눌러 주세요.')}
 finally{micPreparing=false;if(page==='review')render()}
}
async function startHoldAnswer(input,button){
 if(holdSession||micPreparing||revealed||page!=='review')return;
 if(!currentUser){setAnswerNotice('OpenAI 음성 인식은 로그인 후 사용할 수 있어요. 위쪽 로그인 버튼을 눌러 주세요.');return}
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setAnswerNotice('이 브라우저에서 녹음할 수 없어요. Safari나 Chrome에서 사이트를 직접 열어 주세요.');return}
 const note=currentCard();if(!note)return;
 if('speechSynthesis' in window)speechSynthesis.cancel();
 if(answerAudioURL){URL.revokeObjectURL(answerAudioURL);answerAudioURL=''}
 answerDraft='';const heard=$('#heard');if(heard)heard.textContent='';const typed=$('#typed');if(typed)typed.value='';
 const session={input,noteId:note.id,owner:currentUser.id,phase:'permission',released:false,cancelled:false,chunks:[]};
 holdSession=session;setAnswerNotice('');
 updateHoldButton('마이크 연결 중…');
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
  if(holdSession!==session||session.released||session.cancelled){stream.getTracks().forEach(track=>track.stop());return}
  session.stream=stream;micReady=true;
  const type=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
  const rec=new MediaRecorder(stream,{...(type?{mimeType:type}:{}),audioBitsPerSecond:64000});session.recorder=rec;
  rec.ondataavailable=e=>{if(e.data.size)session.chunks.push(e.data)};
  rec.onerror=()=>{if(holdSession!==session)return;stopAnswer();setAnswerNotice('녹음을 완료하지 못했어요. 다시 누르고 말해 주세요.');render()};
  rec.onstop=()=>finishHoldAnswer(session);
  rec.start();session.phase='recording';session.started=Date.now();
  session.timer=setTimeout(()=>releaseHoldAnswer(session.input),30000);
  answerNotice='';updateHoldButton('● 녹음 중 · ↑ 를 눌러 보내기',true);render();startMeter(session);
 }catch(error){
  if(holdSession!==session)return;stopAnswer();
  setAnswerNotice(error.name==='NotAllowedError'?'마이크 권한이 필요해요. 브라우저에서 허용한 뒤 다시 눌러 주세요.':'마이크를 켜지 못했어요. 입력 장치 연결을 확인해 주세요.');render();
 }
}
function releaseHoldAnswer(input,cancel=false){
 const session=holdSession;if(!session||session.input!==input||session.released)return;
 session.released=true;clearTimeout(session.timer);
 if(cancel||session.cancelIntent||session.phase==='permission'){
  stopAnswer();setAnswerNotice((cancel||session.cancelIntent)?'녹음을 취소했어요.':'마이크 권한을 허용한 뒤 다시 눌러 주세요.');render();return;
 }
 if(session.phase!=='recording')return;
 session.phase='processing';session.duration=Date.now()-session.started;
 updateHoldButton('음성을 인식하고 있어요…');setAnswerNotice('');
 if(session.recorder.state==='recording')session.recorder.stop();
 session.stream.getTracks().forEach(track=>track.stop());
}
async function finishHoldAnswer(session){
 session.stream?.getTracks().forEach(track=>track.stop());
 if(holdSession!==session||session.cancelled)return;
 const active=()=>holdSession===session&&page==='review'&&reviewId===session.noteId&&currentUser?.id===session.owner;
 const blob=new Blob(session.chunks,{type:session.recorder.mimeType||session.chunks[0]?.type||'audio/webm'});
 if(!session.released||session.duration<250||!blob.size||blob.size>2*1024*1024){
  holdSession=null;setAnswerNotice(blob.size>2*1024*1024?'녹음이 너무 커요. 더 짧게 말해 주세요.':'녹음이 너무 짧아요. 한 문장을 말한 뒤 ↑ 를 눌러 주세요.');render();return;
 }
 answerAudioURL=URL.createObjectURL(blob);session.controller=new AbortController();session.timer=setTimeout(()=>session.controller.abort(),50000);
 render();
 try{
  const note=state.notes.find(n=>n.id===session.noteId);
  if(apiAzure&&note){
   let assessed=null;
   try{const wav=await toWav16k(blob);const r=await fetch(apiURL('/api/assess?text='+encodeURIComponent(note.english)),{method:'POST',credentials:'include',headers:{'Content-Type':'audio/wav','X-Study-User':session.owner},body:wav,signal:session.controller.signal});const data=await r.json().catch(()=>null);if(r.ok&&data)assessed=data;else if(r.status===429&&data?.error)toast(data.error)}catch(error){if(error.name==='AbortError')throw error}
   if(assessed&&assessed.text){if(!active())return;holdSession=null;answerDraft=assessed.text.trim();answerNotice='';submitAnswer([answerDraft],assessed);return}
  }
  const response=await fetch(apiURL('/api/transcribe'),{method:'POST',credentials:'include',headers:{'Content-Type':blob.type,'X-Study-User':session.owner},body:blob,signal:session.controller.signal});
  let result;try{result=await response.json()}catch{throw Error('음성 인식 서버에 연결하지 못했어요.')}
  if(!response.ok)throw Error(result.error||'음성 인식에 실패했어요.');
  if(!active())return;
  holdSession=null;answerDraft=typeof result.text==='string'?result.text.trim():'';
  if(!answerDraft){setAnswerNotice('인식된 말이 없어요. 내 녹음을 듣고 다시 시도해 주세요.');render();return}
  answerNotice='';submitAnswer([answerDraft]);
 }catch(error){
  if(!active())return;holdSession=null;
  setAnswerNotice(error.name==='AbortError'?'음성 인식 시간이 초과됐어요. 다시 시도해 주세요.':error.message);render();
 }finally{clearTimeout(session.timer)}
}
function startMeter(session){
 try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC||!session.stream)return;
  const ctx=new AC(),analyser=ctx.createAnalyser();analyser.fftSize=512;ctx.createMediaStreamSource(session.stream).connect(analyser);session.audioCtx=ctx;
  const data=new Uint8Array(analyser.fftSize);let last=0;session.levels=[];
  const tick=t=>{if(holdSession!==session||session.phase!=='recording'){ctx.close().catch(()=>{});return}
   if(t-last>70){last=t;analyser.getByteTimeDomainData(data);let sum=0;for(const v of data){const d=(v-128)/128;sum+=d*d}
    session.levels.push(Math.min(1,Math.sqrt(sum/data.length)*5));if(session.levels.length>28)session.levels.shift();
    const bars=document.querySelectorAll('#voice-wave i'),offset=bars.length-session.levels.length;session.levels.forEach((l,i)=>{const bar=bars[offset+i];if(bar)bar.style.height=`${4+Math.round(l*24)}px`})}
   requestAnimationFrame(tick)};requestAnimationFrame(tick);
 }catch{}
}
function toggleAnswer(){
 if(!holdSession)return startHoldAnswer('tap');
 if(holdSession.phase==='recording')return releaseHoldAnswer(holdSession.input);
 if(holdSession.phase==='permission')return releaseHoldAnswer(holdSession.input,true);
}
document.addEventListener('click',e=>{
 const b=e.target.closest('#say-answer,#cancel-answer,#peek-answer,#play-mine,#retry-card,#next-card,[data-say-word],[data-speak-slow]');if(!b)return;
 e.preventDefault();
 if(b.id==='say-answer')toggleAnswer();
 if(b.id==='cancel-answer'&&holdSession)releaseHoldAnswer(holdSession.input,true);
 if(b.id==='peek-answer'){peek=!peek;if(peek)hinted=true;render()}
 if(b.id==='retry-card'){attempt=null;revealed=false;answerDraft='';answerNotice='';render()}
 if(b.id==='next-card')rate(autoRating());
 if(b.dataset?.sayWord)playEnglish(b.dataset.sayWord.replace(/[^A-Za-z0-9' -]/g,''));
 if(b.dataset?.speakSlow){const n=state.notes.find(x=>x.id===b.dataset.speakSlow);if(n)playEnglish(n.english,{rate:.75})}
 if(b.id==='play-mine'){if('speechSynthesis' in window)speechSynthesis.cancel();const audio=$('#my-audio');if(audio){audio.currentTime=0;audio.play().catch(()=>toast('녹음을 재생하지 못했어요.'))}}
});
document.addEventListener('keydown',e=>{
 if(page!=='review'||revealed||e.repeat||e.metaKey||e.ctrlKey||e.altKey||document.querySelector('dialog[open]'))return;
 if(e.code==='Space'&&!e.target.closest('input,textarea,select,button')){e.preventDefault();toggleAnswer()}
});
window.addEventListener('blur',()=>{if(holdSession&&!holdSession.released){stopAnswer();answerNotice='녹음이 취소됐어요. 다시 눌러 말해 주세요.';if(page==='review')render()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopAnswer();if(page==='review'){answerNotice='화면을 나가 녹음을 취소했어요.';render()}}});
window.addEventListener('pagehide',()=>stopAnswer());
function rate(r){
 const note=state.notes.find(n=>n.id===reviewId);if(!note||!revealed)return;
 note.interval=nextInterval(note.interval,r);note.due=r==='again'?dayKey():addDays(note.interval);
 state.history.push({date:dayKey(),noteId:note.id,result:r,...(attempt?{score:attempt.score}:{})});
 later=later.filter(id=>id!==note.id);if(r==='again')later.push(note.id);
 reviewed++;reviewId=null;resetCard();persist();render();
}
function openBulk(){stopAnswer();if($('#add-dialog').open)$('#add-dialog').close();$('#bulk-form').reset();updateBulkPreview();$('#bulk-dialog').showModal();$('#bulk-text').focus()}
function updateBulkPreview(){const {items,skipped}=parseBulk($('#bulk-text').value);const dup=items.filter(x=>state.notes.some(n=>n.english.trim().toLowerCase()===x.english.toLowerCase())).length;$('#bulk-preview').innerHTML=items.length||skipped.length?`<strong>${items.length}개 인식</strong>${dup?` · 이미 있는 ${dup}개는 건너뛰어요`:''}${skipped.length?` · 형식이 맞지 않는 ${skipped.length}줄: <em>${esc(skipped.slice(0,2).join(' / '))}${skipped.length>2?' …':''}</em>`:''}<ul>${items.slice(0,4).map(x=>`<li><b>${esc(x.meaning)}</b> → ${esc(x.english)}</li>`).join('')}${items.length>4?'<li>…</li>':''}</ul>`:'한 줄에 하나씩, 영어와 한글 사이에 / 또는 | 또는 탭을 넣어 주세요.'}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='prepare-mic')prepareMicrophone();
 if(b.id==='show-hint'){hinted=true;render()}
 if(b.dataset.edit){const note=state.notes.find(n=>n.id===b.dataset.edit);if(note)openAdd('',note)}
 if(b.matches('[data-bulk]'))openBulk();
 if(b.id==='close-bulk')$('#bulk-dialog').close();
});
document.addEventListener('submit',e=>{
 if(e.target.id==='type-answer'){e.preventDefault();const text=$('#typed').value.trim();if(!text)return toast('영어 문장을 입력해 주세요.');stopAnswer();submitAnswer([text])}
});
$('#bulk-text').addEventListener('input',updateBulkPreview);
$('#bulk-form').addEventListener('submit',e=>{
 e.preventDefault();const {items}=parseBulk($('#bulk-text').value);const category='';let count=0;
 for(const x of items){if(state.notes.some(n=>n.english.trim().toLowerCase()===x.english.toLowerCase()))continue;state.notes.unshift({id:crypto.randomUUID(),english:x.english,meaning:x.meaning,category,source:'헤이링',due:dayKey(),interval:0,sample:false,created:Date.now()+count});count++}
 if(!count)return toast('새로 저장할 표현이 없어요. 형식을 확인해 주세요.');
 persist();$('#bulk-dialog').close();render();toast(`${count}개 표현을 오늘의 복습에 추가했어요.`);
});
document.addEventListener('keydown',e=>{
 if(page!=='review'||e.metaKey||e.ctrlKey||e.altKey||document.querySelector('dialog[open]'))return;
 if(e.target.closest('input,textarea,select,button'))return;
 if(e.key==='Enter'&&revealed){e.preventDefault();rate(autoRating())}
 else if(revealed&&(e.key==='r'||e.key==='R')){attempt=null;revealed=false;answerDraft='';render()}
});

let lessonDraft='',lessonResult=null,organizing=false,lessonError='',selectedExpressions=new Set(),apiConfigured=null,apiAzure=false;
let recorder=null,recordingStream=null,recordingURL='',recordingTimer=null,recordingStarting=false,recordingGeneration=0;
function recorderPanel(){return `<section class="editor recording-panel"><strong>내 목소리로 연습하기</strong><p class="helper">최대 60초 녹음 후 다시 들어보세요. 서버로 전송되지 않아요.<br>자동 발음 평가는 아직 지원하지 않아요. 화면을 나가면 녹음은 삭제돼요.</p><button class="button" id="record-audio">${recorder?'■ 녹음 마치기':'● 녹음 시작'}</button><span id="record-state" class="helper" role="status"></span><div id="record-playback">${recordingURL?`<audio controls src="${recordingURL}" aria-label="내 녹음 다시 듣기"></audio><a class="text-btn" href="${recordingURL}" download="english-practice.webm">녹음 다운로드</a>`:''}</div></section>`}
function saveLesson(){if(!lessonDraft.trim())return false;state.lessons??=[];if(!state.lessons.some(x=>x.text===lessonDraft))state.lessons.unshift({id:crypto.randomUUID(),date:dayKey(),text:lessonDraft});persist();return true}
async function organizeLesson(){
 if(STATIC_ONLY)return toast('현재는 화면 미리보기예요. AI 정리는 계정 서버 연결 후 사용할 수 있어요.');
 if(organizing)return;if(!lessonDraft.trim())return toast('학습 내용을 먼저 붙여넣어 주세요.');
 organizing=true;lessonError='';if(page==='lesson')render();
 try{const response=await fetch(apiURL('/api/organize'),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',...(currentUser?{'X-Study-User':currentUser.id}:{})},body:JSON.stringify({text:lessonDraft}),signal:AbortSignal.timeout(50000)});const data=await response.json();if(!response.ok)throw Error(data.error||'AI 정리를 완료하지 못했어요.');lessonResult=data;selectedExpressions=new Set(data.expressions.map((_,i)=>i));saveLesson();}
 catch(e){lessonError=e.name==='TimeoutError'?'응답 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.':e.message;}
 finally{organizing=false;if(page==='lesson')render();else toast(lessonError||'헤이링 복습 표현 정리가 끝났어요.')}
}
function stopRecording(clear=false){
 if(clear)recordingGeneration++;
 clearTimeout(recordingTimer);
 if(recorder&&recorder.state!=='inactive')recorder.stop();
 recordingStream?.getTracks().forEach(t=>t.stop());recordingStream=null;recorder=null;
 if(clear){if(recordingURL)URL.revokeObjectURL(recordingURL);recordingURL='';}
}
async function startRecording(){
 if(recorder){stopRecording();return}if(recordingStarting)return;
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return toast('이 브라우저에서는 녹음을 지원하지 않아요. Chrome에서 열어 주세요.');
 if(recognition)recognition.stop();if('speechSynthesis' in window)speechSynthesis.cancel();
 const generation=++recordingGeneration;recordingStarting=true;
 try{
 const stream=await navigator.mediaDevices.getUserMedia({audio:true});
 if(generation!==recordingGeneration){stream.getTracks().forEach(t=>t.stop());return}
 recordingStream=stream;const chunks=[];const instance=new MediaRecorder(stream);recorder=instance;
 instance.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
 instance.onstop=()=>{stream.getTracks().forEach(t=>t.stop());if(generation!==recordingGeneration)return;if(recordingURL)URL.revokeObjectURL(recordingURL);recordingURL=URL.createObjectURL(new Blob(chunks,{type:instance.mimeType}));recorder=null;recordingStream=null;const box=$('#record-playback');if(box){box.innerHTML=`<audio controls src="${recordingURL}" aria-label="내 녹음 다시 듣기"></audio><a class="text-btn" href="${recordingURL}" download="english-practice.${instance.mimeType.includes('mp4')?'m4a':'webm'}">녹음 다운로드</a>`;$('#record-audio').textContent='● 다시 녹음';$('#record-state').textContent='녹음 완료';}};
 instance.onerror=()=>{stopRecording(true);toast('녹음을 완료하지 못했어요. 다시 시도해 주세요.');if($('#record-audio'))$('#record-audio').textContent='● 녹음 시작';};
 instance.start();$('#record-audio').textContent='■ 녹음 마치기';$('#record-state').textContent=' 녹음 중 · 60초 뒤 자동 종료';recordingTimer=setTimeout(()=>stopRecording(),60000);
 }catch{recordingStream?.getTracks().forEach(t=>t.stop());recordingStream=null;recorder=null;toast('마이크 권한과 연결 상태를 확인해 주세요.');}finally{recordingStarting=false}
}
document.addEventListener('input',e=>{if(e.target.id==='lesson-input')lessonDraft=e.target.value;const field=e.target.dataset.lessonField;if(['english','meaning'].includes(field)){const expression=lessonResult?.expressions[Number(e.target.dataset.index)];if(expression)expression[field]=e.target.value}});
document.addEventListener('change',e=>{if(e.target.matches('[data-expression]')){const i=Number(e.target.dataset.expression);if(e.target.checked)selectedExpressions.add(i);else selectedExpressions.delete(i)}});
document.addEventListener('click',e=>{
 const button=e.target.closest('button');if(!button)return;
 if(button.id==='record-audio')startRecording();
 if(button.id==='organize-lesson')organizeLesson();
 if(button.id==='save-lesson'){if(saveLesson()){render();toast('학습 메모를 저장했어요.')}else toast('학습 내용을 먼저 입력해 주세요.');}
 if(button.id==='save-expressions'){
 if(!lessonResult||!selectedExpressions.size)return toast('저장할 표현을 선택해 주세요.');
 for(const i of selectedExpressions){const x=lessonResult.expressions[i];if(!x.english.trim()||!x.meaning.trim()){toast('선택한 표현의 영어와 한글 뜻을 모두 입력해 주세요.');document.getElementById(`lesson-${!x.english.trim()?'english':'meaning'}-${i}`)?.focus();return}}
 for(const i of selectedExpressions){const x=lessonResult.expressions[i];x.english=x.english.trim();x.meaning=x.meaning.trim()}
 let count=0;for(const i of selectedExpressions){const x=lessonResult.expressions[i];if(state.notes.some(n=>n.english.toLowerCase()===x.english.toLowerCase()))continue;state.notes.unshift({id:crypto.randomUUID(),english:x.english,meaning:x.meaning,tip:x.tip,category:'자유 대화',source:'헤이링',due:dayKey(),interval:0,created:Date.now(),sample:false});count++}
 persist();toast(count?`${count}개 표현을 오늘의 복습에 추가했어요.`:'새로 저장할 표현을 선택해 주세요. 이미 저장한 표현은 제외돼요.');render();
 }
});
window.addEventListener('pagehide',()=>stopRecording(true));
if(!STATIC_ONLY)fetch(apiURL('/api/status'),{credentials:'include'}).then(r=>r.ok?r.json():null).then(data=>{if(data){apiConfigured=data.configured;apiAzure=data.azure===true;if(page==='lesson'&&!organizing&&!recorder)render()}}).catch(()=>{});

let accountLoading=true,currentUser=null,studyVersion=0,syncStatus='저장됨',saveChain=Promise.resolve(),saveBlocked=false,accountBusy=false;
let accountMode='login';
let socialData={people:[],feed:[],invites:[]},socialError='',inviteLink='',pendingInvite=new URLSearchParams(location.hash.slice(1)).get('invite')||'';
// Keep invitation bearer tokens out of HTTP requests and browser history.
if(pendingInvite)history.replaceState(null,'',location.pathname+location.search);
async function api(path,body,expectedUser=currentUser?.id){if(STATIC_ONLY)throw Error('계정 서버 연결 전에는 사용할 수 없어요.');const response=await fetch(apiURL(path),{credentials:'include',method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(expectedUser?{'X-Study-User':expectedUser}:{})},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await response.json()}catch{throw Error('계정 서버에 연결할 수 없어요. 서버 연결 설정을 확인해 주세요.')}if(!response.ok)throw Object.assign(new Error(data.error||'요청을 처리하지 못했어요.'),{status:response.status});return data}
function updateAccountStatus(){if($('#account-label'))$('#account-label').textContent=currentUser?`${currentUser.name} · ${syncStatus}`:'로그인 · 초대'}
function queueSave(){
 const snapshot=structuredClone(state),owner=currentUser.id;
 syncStatus='저장 중';updateAccountStatus();
 saveChain=saveChain.then(async()=>{
  if(!currentUser||owner!==currentUser.id||saveBlocked)return;
  try{const result=await api('/api/study',{data:snapshot,version:studyVersion});studyVersion=result.version;syncStatus='저장됨';}
  catch(e){saveBlocked=true;syncStatus='저장 실패';toast(e.message);}
  updateAccountStatus();
 });
}
async function loadStudy(){const result=await api('/api/study');state={notes:[],history:[],lessons:[],goal:5,speechRate:1,voiceURI:'',...result.data};studyVersion=result.version;saveBlocked=false;syncStatus='저장됨'}
async function refreshSocial(){try{socialData=await api('/api/social');socialError=''}catch(e){socialError=e.message}if(page==='together')render()}
function together(){
 const auth=`<div class="sharing-intro"><h1>함께 공부</h1></div>`;
 if(STATIC_ONLY)return `${auth}<section class="editor"><h2>온라인 계정 서버 연결 준비 중</h2><p>현재는 웹 화면만 배포된 상태예요. 로그인·초대·기기 간 동기화·AI 정리는 아직 사용할 수 없어요.</p><p class="helper">지금 입력하는 표현은 이 브라우저에만 저장돼요. 학습 설정에서 파일로 백업할 수 있어요.</p></section>`;
 if(!currentUser)return `${auth}<div class="sharing-grid"><form class="editor" id="account-form" data-action="${accountMode}"><h2>${accountMode==='register'?'새 공부 계정 만들기':pendingInvite?'공부 친구가 초대했어요':'나의 공부 공간에 로그인'}</h2><p class="helper">${pendingInvite?'로그인한 다음 초대를 수락하면 연결돼요.':''}</p><label for="account-username">아이디</label><input id="account-username" name="username" required pattern="[-a-z0-9_]{3,32}" autocomplete="username" placeholder="영문 소문자·숫자 3~32자"><label for="account-password">비밀번호</label><input id="account-password" name="password" type="password" required maxlength="128" autocomplete="${accountMode==='register'?'new-password':'current-password'}" ${accountMode==='register'?'minlength="10" placeholder="특수문자 포함 10자 이상"':''}>${accountMode==='register'?'<label for="account-name">이름</label><input id="account-name" name="name" required maxlength="40" autocomplete="nickname" placeholder="친구에게 보일 이름">':''}${accountMode==='register'&&(API_BASE||window.STUDY_CONFIG?.cloudAccounts)&&!pendingInvite?'<details><summary>운영자 최초 가입</summary><label for="setup-code">설정 코드</label><input id="setup-code" name="setupCode" type="password" autocomplete="off"><p class="helper">처음 가입하는 운영자는 Cloudflare의 SETUP_CODE 값을 입력하세요. 이후 친구는 초대 링크로 가입해요.</p></details>':''}<div class="editor-actions"><button class="button primary" type="submit" ${accountBusy?'disabled':''}>${accountMode==='register'?'가입하고 시작하기':'로그인'}</button><button class="button" type="button" id="switch-account-mode" ${accountBusy?'disabled':''}>${accountMode==='register'?'기존 계정으로 로그인':'새 계정 만들기'}</button></div><p role="status" id="account-error" class="helper">${esc(socialError)}</p></form></div>`;
 return `${auth}<div class="account-strip"><span><strong>${esc(currentUser.name)}</strong> · @${esc(currentUser.username)}</span><span>${esc(syncStatus)}</span><button class="text-btn" id="logout-account">로그아웃</button></div>${saveBlocked?`<section class="editor"><h3>저장하지 못한 기록이 있어요</h3><p class="helper">현재 기록을 먼저 다운로드하세요. 최신 기록을 불러오면 현재 화면의 미저장 변경은 교체됩니다.</p><button class="button" id="export">현재 기록 다운로드</button><button class="button" id="reload-study">서버의 최신 기록 불러오기</button></section>`:''}${pendingInvite?`<section class="editor invite-accept"><h2>함께 공부할까요?</h2><p>수락하면 서로 ‘함께 보기’로 지정한 기록을 볼 수 있어요.</p><button class="button primary" id="accept-invite">초대 수락하기</button><button class="text-btn" id="dismiss-invite">나중에</button></section>`:''}<div class="sharing-grid"><section class="editor"><span class="eyebrow">INVITE A STUDY FRIEND</span><h2>함께 공부하기</h2><p class="helper">초대 링크는 24시간 동안 유효하고 한 사람만 사용할 수 있어요. 원하는 사람에게만 보내 주세요.</p><button class="button primary" id="create-invite">초대 링크 만들기 ＋</button>${inviteLink?`<label for="invite-url" style="margin-top:18px">초대 링크</label><input id="invite-url" readonly value="${esc(inviteLink)}"><button class="text-btn" id="copy-invite">링크 복사</button>`:''}${/^(localhost|127\.0\.0\.1)$/.test(location.hostname)?'<p class="helper">현재는 내 컴퓨터의 테스트 주소예요. 다른 기기에서 초대를 받으려면 온라인 배포가 먼저 필요해요.</p>':''}${socialData.invites.map(x=>`<div class="connection-row"><span>대기 중인 초대 · ${new Date(x.expires).toLocaleString('ko-KR')} 만료</span><button class="text-btn" data-revoke="${esc(x.id)}">취소</button></div>`).join('')}</section><section class="editor"><span class="eyebrow">MY STUDY FRIENDS</span><h2>연결된 친구 <small>${socialData.people.length}</small></h2>${socialData.people.map(p=>`<div class="connection-row"><span><strong>${esc(p.name)}</strong><small>@${esc(p.username)}</small></span><button class="text-btn" data-disconnect="${esc(p.id)}">연결 해제</button></div>`).join('')||'<p class="helper">아직 연결된 친구가 없어요. 첫 초대를 보내보세요.</p>'}<p class="helper">연결을 해제하면 서로의 공유 기록에 더 이상 접근할 수 없어요. 이미 내 복습에 담은 사본은 남아요.</p></section></div><section class="editor share-picker"><h2>내가 나눌 표현</h2><p class="helper">공유를 켠 표현만 연결된 친구에게 보여요.</p>${state.notes.map(n=>`<article class="share-choice"><div><h3>${esc(n.english)}</h3><p>${esc(n.meaning)}</p></div><button class="button share-toggle ${n.shared?'selected':''}" data-share-note="${esc(n.id)}" aria-pressed="${n.shared===true}" aria-label="${esc(n.english)} 공유">${n.shared?'✓ 공유 중':'공유하기'}</button></article>`).join('')||'<p class="helper">표현 노트에 첫 문장을 남겨보세요.</p>'}</section><section class="editor"><div class="section-title"><h2>친구가 나눈 표현과 이야기</h2><button class="text-btn" id="refresh-social">새로고침 ↻</button></div><p class="helper">고른 표현만 연결된 친구에게 보여요. 친구의 표현을 내 복습에 담을 수도 있어요.</p>${socialData.feed.map(x=>`<article class="shared-card"><span class="eyebrow">${esc(x.ownerName)} · ${x.kind==='notes'?'표현':'학습 메모'}</span>${x.kind==='notes'?`<h3>${esc(x.english)}</h3><p>${esc(x.meaning)}</p><button class="button" data-copy-shared="${esc(x.id)}" data-owner="${esc(x.ownerId)}">내 복습에 담기 ＋</button>`:`<p style="white-space:pre-wrap">${esc(x.text)}</p>`}</article>`).join('')||'<div class="empty">아직 공유한 기록이 없어요.<br>마음에 드는 표현부터 하나 나눠보세요.</div>'}</section><p role="status" class="helper">${esc(socialError)}</p>`;
}
document.addEventListener('submit',async e=>{
 if(e.target.id!=='account-form')return;e.preventDefault();if(accountBusy)return;
 const body={...Object.fromEntries(new FormData(e.target)),inviteToken:pendingInvite};const form=e.target;const action=form.dataset.action==='register'?'register':'login';accountBusy=true;socialError='';for(const button of form.querySelectorAll('button'))button.disabled=true;form.querySelector('[role=status]').textContent='처리 중이에요…';
 try{const result=await api(`/api/account/${action}`,body);if(result.inviteAccepted)pendingInvite='';const study=await api('/api/study',undefined,result.user.id);currentUser=result.user;state=study.data;studyVersion=study.version;saveBlocked=false;syncStatus='저장됨';lessonDraft='';lessonResult=null;draft='';quickDraft={english:'',meaning:''};vocabularyResult=null;vocabularyQuery='';vocabularyError='';await refreshSocial();}
 catch(error){socialError=error.message;}finally{accountBusy=false;if(currentUser)render();else if(form.isConnected){form.querySelector('[role=status]').textContent=socialError;for(const button of form.querySelectorAll('button'))button.disabled=false;}}
});
document.addEventListener('click',async e=>{
 const button=e.target.closest('button');if(!button)return;
 const action=button.id;
 if(action==='switch-account-mode'){if(accountBusy)return;accountMode=accountMode==='login'?'register':'login';socialError='';render();return}
 const share=button.dataset.shareNote||button.dataset.shareLesson;
 if(share){if(!currentUser){toast('공유하려면 먼저 로그인하세요.');navigate('together');return}const items=button.dataset.shareNote?state.notes:state.lessons;const item=items.find(x=>x.id===share);if(item){item.shared=!item.shared;persist();render();toast(item.shared?'연결된 친구에게 공유해요.':'나만 볼 수 있도록 바꿨어요.');}return}
 const relevant=['create-invite','copy-invite','accept-invite','dismiss-invite','refresh-social','logout-account','import-local','reload-study'].includes(action)||button.dataset.revoke||button.dataset.disconnect||button.dataset.copyShared;
 if(!relevant||accountBusy)return;
 if(action==='copy-invite'){try{await navigator.clipboard.writeText(inviteLink);toast('초대 링크를 복사했어요.')}catch{$('#invite-url').select();toast('선택된 링크를 복사해 주세요.')}return}
 if(action==='dismiss-invite'){pendingInvite='';render();return}
 if(!currentUser)return;
 if(organizing||vocabularyBusy||holdSession){toast('AI 요청이 끝난 뒤 다시 시도해 주세요.');return}
 accountBusy=true;
 try{
 await saveChain;
 if(action==='logout-account'){
  if(saveBlocked&&!confirm('미저장 변경이 있어요. 먼저 설정에서 기록을 다운로드하는 것이 좋아요. 저장하지 않고 로그아웃할까요?'))return;
  try{await api('/api/account/logout',{})}catch(error){if(error.status!==401)throw error;}stopRecording(true);currentUser=null;socialData={people:[],feed:[],invites:[]};inviteLink='';lessonResult=null;lessonDraft='';draft='';quickDraft={english:'',meaning:''};vocabularyResult=null;vocabularyQuery='';vocabularyError='';state={notes:samples,history:[],lessons:[],goal:5,speechRate:1,voiceURI:''};try{const old=JSON.parse(localStorage.getItem(KEY));if(old)state=old}catch{};render();return;
 }
 if(action==='reload-study'){if(!confirm('현재 미저장 변경을 서버의 최신 기록으로 바꿀까요? 먼저 기록을 다운로드해 주세요.'))return;await loadStudy();}
 if(action==='create-invite'){const invite=await api('/api/social/invite',{});inviteLink=`${location.origin}${location.pathname}#invite=${encodeURIComponent(invite.token)}`;}
 if(action==='accept-invite'){const result=await api('/api/social/accept',{token:pendingInvite});pendingInvite='';toast(`${result.name}님과 연결됐어요.`);}
 if(button.dataset.revoke){await api('/api/social/revoke',{id:button.dataset.revoke});inviteLink='';}
 if(button.dataset.disconnect){if(!confirm('연결을 해제하면 서로의 공유 기록에 접근할 수 없어요. 해제할까요?'))return;await api('/api/social/disconnect',{id:button.dataset.disconnect});}
 if(button.dataset.copyShared){if(saveBlocked)throw Error('저장 오류를 먼저 해결해 주세요.');await api('/api/social/copy',{ownerId:button.dataset.owner,id:button.dataset.copyShared});await loadStudy();toast('내 복습에 담았어요.');}
 if(action==='import-local'){
  if(saveBlocked)throw Error('저장 오류를 먼저 해결해 주세요.');const old=JSON.parse(localStorage.getItem(KEY)||'null');if(!old)throw Error('가져올 기존 기록이 없어요.');let count=0;
  for(const kind of ['notes','lessons']){state[kind]??=[];for(const item of old[kind]||[]){if(item.sample||state[kind].some(x=>x.id===item.id))continue;state[kind].push({...item,shared:false});count++}}
  for(const item of old.history||[]){if(!state.history.some(x=>JSON.stringify(x)===JSON.stringify(item)))state.history.push(item)}persist();await saveChain;toast(saveBlocked?'기록 저장에 실패했어요.':`${count}개 기록을 가져왔어요.`);
 }
 socialError='';await refreshSocial();
 }catch(error){socialError=error.message;toast(error.message)}finally{accountBusy=false;if(page==='together'||page==='settings')render()}
});
async function startAccount(){
 if(STATIC_ONLY){accountLoading=false;apiConfigured=false;page=pendingInvite?'together':page;render();return}
 try{const {user}=await api('/api/account');if(user){const result=await api('/api/study',undefined,user.id);currentUser=user;state=result.data;studyVersion=result.version;}}
 catch{/* Existing offline notebook remains usable when the server is unavailable. */}
 accountLoading=false;if(pendingInvite)page='together';render();if(currentUser&&page==='together')refreshSocial();
}
// Text arriving from an iOS Shortcut (#add=…) or the Android share sheet (?share_text=…).
const incomingShare=(()=>{const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.slice(1));const text=h.get('add')||[q.get('share_title'),q.get('share_text')].filter(Boolean).join('\n');if(!text)return null;history.replaceState(null,'',location.pathname+(h.get('invite')?`#invite=${encodeURIComponent(h.get('invite'))}`:''));return parseShared(text)})();
if(incomingShare){page='notes';}
// Let text fields grow with their content (long Korean meanings / long sentences).
function fitField(el){if(!el||el.tagName!=='TEXTAREA')return;el.style.height='auto';el.style.height=Math.min(el.scrollHeight+2,260)+'px'}
document.addEventListener('input',e=>fitField(e.target));
const fitDialog=()=>{for(const id of ['#english','#meaning'])fitField($(id))};
$('#add-dialog').addEventListener?.('focusin',fitDialog);
render();startAccount();
if(incomingShare){openAdd(incomingShare.english);$('#meaning').value=incomingShare.meaning;toast(incomingShare.english&&incomingShare.meaning?'캡처에서 표현을 가져왔어요. 확인하고 저장해 주세요.':'일부만 읽었어요. 비어 있는 칸을 채워 주세요.')}

document.addEventListener('input',e=>{
 if(e.target.id==='quick-english')quickDraft.english=e.target.value;
 if(e.target.id==='quick-meaning')quickDraft.meaning=e.target.value;
 if(e.target.id==='vocabulary-query')vocabularyQuery=e.target.value;
});
document.addEventListener('submit',async e=>{
 if(e.target.id==='quick-expression-form'){
  e.preventDefault();const english=quickDraft.english.trim(),meaning=quickDraft.meaning.trim();
  if(!english||!meaning)return toast('영어 표현과 한글 뜻을 모두 입력해 주세요.');
  if(state.notes.some(n=>n.english.trim().toLowerCase()===english.toLowerCase()))return toast('이미 저장한 표현이에요. 목록에서 수정할 수 있어요.');
  state.notes.unshift({id:crypto.randomUUID(),english,meaning,category:'자유 대화',due:dayKey(),interval:0,sample:false,created:Date.now()});
  quickDraft={english:'',meaning:''};persist();render();$('#quick-english')?.focus();toast('표현을 저장했어요. 오늘의 복습에 추가됐어요.');return;
 }
 if(e.target.id!=='vocabulary-form')return;
 e.preventDefault();if(vocabularyBusy)return;
 const query=vocabularyQuery.trim();if(!query)return;
 if(!currentUser){toast('단어 검색은 로그인 후 사용할 수 있어요.');navigate('together');return}
 const owner=currentUser.id;vocabularyBusy=true;vocabularyError='';vocabularyResult=null;render();
 try{
  const response=await fetch(apiURL('/api/vocabulary'),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Study-User':owner},body:JSON.stringify({text:query}),signal:AbortSignal.timeout(50000)});
  let result;try{result=await response.json()}catch{throw Error('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')}
  if(!response.ok)throw Error(result.error||'단어를 찾지 못했어요.');
  if(currentUser?.id!==owner)return;
  vocabularyResult={...result,query};
 }catch(error){if(currentUser?.id===owner)vocabularyError=error.name==='TimeoutError'?'응답이 늦어지고 있어요. 다시 시도해 주세요.':error.message}
 finally{vocabularyBusy=false;if(page==='notes')render()}
});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.exampleListen!==undefined){const x=vocabularyResult?.expressions[Number(b.dataset.exampleListen)];if(x)playEnglish(x.english)}
 if(b.dataset.exampleUse!==undefined){const x=vocabularyResult?.expressions[Number(b.dataset.exampleUse)];if(!x)return;openAdd(x.english);$('#meaning').value=x.meaning;}
});
