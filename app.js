import {bestGrade,hint,nextInterval,parseBulk,PASS,CLOSE} from './grade.js';
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
let page='notes',search='',filter='전체',reviewId=null,revealed=false,reviewed=0,recognition=null,topic='일상',draft='',listening=false;
const $=(q)=>document.querySelector(q);
const esc=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const due=()=>state.notes.filter(n=>n.due<=dayKey());
const todayReviews=()=>state.history.filter(h=>h.date===dayKey()).length;
function persist(){if(currentUser){queueSave();return}try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageAvailable=false;toast('브라우저 저장 공간을 사용할 수 없어요. 이번 화면에서만 기록됩니다.');}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),3500)}
function streak(){const dates=new Set(state.history.map(h=>h.date));let d=new Date(),count=0;if(!dates.has(dayKey(d)))d.setDate(d.getDate()-1);while(dates.has(dayKey(d))){count++;d.setDate(d.getDate()-1)}return count}
function navigate(next){if(!['notes','review','together','settings'].includes(next))next='notes';if(next==='together'&&currentUser)refreshSocial();stopRecording(true);if(recognition)recognition.stop();stopAnswer();resetCard();later=[];page=next;reviewId=null;revealed=false;reviewed=0;render();window.scrollTo({top:0,behavior:'smooth'})}
function rows(notes){return notes.length?notes.map(n=>`<article class="note-row"><span class="note-icon">${n.english.trim().includes(' ')?'❞':'Aa'}</span><div class="note-body"><h3>${esc(n.english)}</h3><p>${n.meaning?esc(n.meaning):'<em class="warn">한글 뜻이 없어 복습에서 힌트로 나와요 · ✎로 추가</em>'}</p></div><span class="note-meta">${n.sample?'샘플 · ':''}${esc(n.category)}</span><button class="icon-btn" data-speak="${esc(n.id)}" aria-label="표현 듣기">♬</button>${page==='notes'?`<button class="icon-btn" data-edit="${esc(n.id)}" aria-label="표현 수정">✎</button><button class="text-btn" data-share-note="${esc(n.id)}" aria-pressed="${n.shared===true}">${n.shared?'함께 보기':'나만 보기'}</button><button class="icon-btn" data-delete="${esc(n.id)}" aria-label="표현 삭제">×</button>`:''}</article>`).join(''):'<div class="empty">아직 표현이 없어요.<br>오늘 말하고 싶은 한 문장을 남겨보세요.</div>'}
function week(){const start=new Date();start.setDate(start.getDate()-((start.getDay()+6)%7));const dates=new Set(state.history.map(h=>h.date));return ['월','화','수','목','금','토','일'].map((label,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const key=dayKey(d),done=dates.has(key);return `<div class="day ${done?'done':''} ${key===dayKey()?'today':''}">${label}<span>${done?'✓':d.getDate()}</span></div>`}).join('')}
function notes(){const list=state.notes.filter(n=>(filter==='전체'||n.category===filter)&&`${n.english} ${n.meaning}`.toLowerCase().includes(search.toLowerCase()));return `<div class="page-head"><div><span class="eyebrow">MY ENGLISH NOTEBOOK</span><h1>표현 노트</h1><p>영어와 한글 뜻을 적고, 내일 다시 기억해 봐요.</p></div><button class="button primary" data-page="review">복습하기 · ${due().length}개 →</button></div>
<form class="editor" id="quick-expression-form"><h2>기억하고 싶은 표현</h2><div class="expression-fields"><div><label for="quick-english">영어 표현</label><textarea id="quick-english" required maxlength="1000" rows="3" lang="en" placeholder="I came here by van.">${esc(quickDraft.english)}</textarea></div><div><label for="quick-meaning">한글 뜻</label><textarea id="quick-meaning" required maxlength="1000" rows="3" lang="ko" placeholder="나는 밴을 타고 여기까지 왔어.">${esc(quickDraft.meaning)}</textarea></div></div><div class="editor-actions"><button class="button primary" type="submit">저장하고 복습에 추가 ＋</button><button class="text-btn" type="button" data-bulk>여러 개 붙여넣기</button></div></form>
<section class="editor vocabulary-panel"><h2>모르는 단어 찾아보기</h2><p class="helper">뜻과 짧은 예문을 함께 알아보고, 문장으로 기억해요.</p><form id="vocabulary-form" class="vocabulary-search"><label class="sr-only" for="vocabulary-query">찾을 영어 단어 또는 표현</label><input id="vocabulary-query" maxlength="100" required value="${esc(vocabularyQuery)}" placeholder="예: figure out, curious" ${vocabularyBusy?'disabled':''}><button class="button" ${vocabularyBusy?'disabled':''}>${vocabularyBusy?'찾는 중…':'뜻 · 예문 찾기'}</button></form><p class="helper">AI가 뜻과 예문을 만들어 줘요. 로그인 후 사용할 수 있으며, 검색할 때 API 사용량이 발생해요.</p><p class="helper" role="status">${esc(vocabularyError)}</p>${vocabularyResult?`<div class="vocabulary-result"><h3>${esc(vocabularyResult.query)}</h3><p style="white-space:pre-wrap">${esc(vocabularyResult.summary)}</p><p class="helper">외우기 좋은 예문 · 저장 전에 영어와 한글을 수정할 수 있어요.</p>${vocabularyResult.expressions.map((x,i)=>`<article class="example-card"><p lang="en"><strong>${esc(x.english)}</strong></p><p>${esc(x.meaning)}</p><small>${esc(x.tip)}</small><div class="editor-actions"><button class="text-btn" data-example-listen="${i}" aria-label="${i+1}번 예문 듣기">♬ 듣기</button><button class="button" data-example-use="${i}">이 문장으로 외우기 ＋</button></div></article>`).join('')}<small class="helper">AI 설명은 틀릴 수 있어요. 문맥에 맞는 뜻인지 확인해 주세요.</small></div>`:''}</section>
<div class="section-title"><h2>저장한 표현 <small>${state.notes.length}개</small></h2></div><div class="toolbar"><input id="search" aria-label="저장한 표현 검색" placeholder="저장한 영어, 뜻으로 찾아보기" value="${esc(search)}"><select id="filter" aria-label="주제 필터">${['전체','일상','여행','작업과 취미','자유 대화'].map(x=>`<option ${filter===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="notes-list">${rows(list)}</div><p class="helper">${currentUser?'내 계정에 저장돼요. 함께 보기를 켠 표현만 친구에게 공유돼요.':'지금은 이 브라우저에 저장돼요. 다른 기기에서도 보려면 로그인하세요.'}</p>`}
const prompts={'일상':['How was your day?','오늘 기억에 남는 순간을 한 문장으로 이야기해 보세요.'],'여행':['Where would you like to go?','가고 싶은 곳이나 최근 여행에 대해 이야기해 보세요.'],'작업과 취미':['What are you working on lately?','만들고 있는 작품이나 요즘 즐기는 취미를 소개해 보세요.'],'자유 대화':["What's on your mind?",'어떤 이야기든 좋아요. 떠오르는 생각을 말해 보세요.']};
function review(){return reviewPage()}
function settings(){return `<div class="page-head"><div><span class="eyebrow">YOUR OWN PACE</span><h1>나만의 학습 속도</h1></div></div><form class="settings-card" id="settings-form"><h2>매일 조금씩</h2><p>부담 없이 꾸준히 이어갈 수 있는 목표를 정해요.</p><label for="goal">하루 복습 목표</label><select id="goal">${[3,5,10,15].map(n=>`<option value="${n}" ${Number(state.goal)===n?'selected':''}>${n}개</option>`).join('')}</select><button class="button primary" style="margin-top:20px">목표 저장하기</button><p>홈 화면에서 오늘 복습할 표현과 진행 상황을 안내해요. 사이트를 닫았을 때의 알림은 아직 지원하지 않아요.</p><hr style="border:0;border-top:1px solid var(--line);margin:24px 0"><h3>나에게 편한 영어 목소리</h3><p>기기에 설치된 영어 음성 중에서 골라 들어보세요. 목소리 품질과 목록은 브라우저와 기기에 따라 달라요.</p><label for="voice">영어 목소리</label><select id="voice">${voiceOptions()}</select><label for="speech-rate">말하기 속도</label><select id="speech-rate">${[.8,.9,1,1.1].map(rate=>`<option value="${rate}" ${Number(state.speechRate)===rate?'selected':''}>${rate}배${rate===1?' · 기본':''}</option>`).join('')}</select><button type="button" class="button" id="preview-voice" style="margin-top:16px">♬ 목소리 미리 듣기</button><p>목소리와 속도를 바꾸면 자동으로 저장돼요. AI 음성은 아직 연결되지 않았어요.</p><hr style="border:0;border-top:1px solid var(--line);margin:24px 0"><h3>나의 기록 보관하기</h3><p>${currentUser?'현재 기록은 로그인한 계정의 서버 저장소에 저장돼요. 파일로도 백업할 수 있어요.':'현재 기록은 이 기기의 브라우저에 저장돼요. 브라우저 데이터를 지우면 기록도 삭제되니, 파일로 백업해 두세요.'}</p><button type="button" class="button" id="export">기록 다운로드 ↓</button></form>`}
function render(){if(accountLoading){$('#content').innerHTML='<div class="empty">나의 공부 공간을 불러오는 중이에요…</div>';return}if(recorder)stopRecording(true);const labels={home:'오늘의 영어',talk:'말하기 연습',notes:'나의 표현 노트',review:'오늘의 복습',settings:'학습 설정',lesson:'헤이링 복습',together:'함께 공부'};$('#page-label').textContent=labels[page];const profile=document.querySelector('.profile strong');if(profile)profile.textContent=currentUser?`${currentUser.name}님의 영어 공간`:'나의 영어 공간';$('#account-label').textContent=currentUser?`${currentUser.name} · ${syncStatus}`:'로그인 · 초대';$('#nav-count').textContent=state.notes.length;$('#nav-due').hidden=!due().length;document.querySelectorAll('.nav').forEach(el=>{el.classList.toggle('active',el.dataset.page===page);if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});$('#date').textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date());$('#content').innerHTML=({notes,review,settings,together})[page]();}
function openAdd(text='',note=null){if(recognition)recognition.stop();stopAnswer();$('#expression-form').reset();editingId=note?.id||null;$('#english').value=note?.english??text;$('#meaning').value=note?.meaning??'';$('#category').value=note?.category||topic;$('#add-title').textContent=note?'표현 고치기':'기억하고 싶은 표현';$('#add-submit').firstChild.textContent=note?'수정 내용 저장하기 ':'내 표현으로 저장하기 ';$('#add-dialog').showModal();(note&&!note.meaning?$('#meaning'):$('#english')).focus()}
function englishVoices(){
  if(!('speechSynthesis' in window))return [];
  const score=v=>(/natural|premium|enhanced|neural/i.test(v.name)?100:0)+(/Google|Samantha|Daniel/i.test(v.name)?20:0)+(v.lang==='en-US'?5:0);
  return speechSynthesis.getVoices().filter(v=>/^en(?:-|_)/i.test(v.lang)).sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name));
}
function voiceOptions(){const voices=englishVoices();return `<option value="">자동 선택${voices.length?' · '+esc(voices[0].name):' · 브라우저 기본 음성'}</option>`+voices.map(v=>`<option value="${esc(v.voiceURI)}" ${state.voiceURI===v.voiceURI?'selected':''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}
function playEnglish(text,{voiceURI=state.voiceURI,rate=state.speechRate}={}){
  if(!('speechSynthesis' in window))return toast('이 브라우저에서는 음성 재생을 지원하지 않아요.');
  speechSynthesis.cancel();
  const voices=englishVoices(),voice=voices.find(v=>v.voiceURI===voiceURI)||voices[0];
  const utterance=new SpeechSynthesisUtterance(text);
  if(voice)utterance.voice=voice;
  utterance.lang=voice?.lang||'en-US';
  utterance.rate=Math.max(.75,Math.min(1.2,Number(rate)||1));
  utterance.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))toast('음성을 재생하지 못했어요. 다른 목소리를 선택해 주세요.')};
  speechSynthesis.speak(utterance);
}
function speak(id){const note=state.notes.find(n=>n.id===id);if(note)playEnglish(note.english)}

function microphone(){const API=window.SpeechRecognition||window.webkitSpeechRecognition;if(!API)return toast('음성 입력은 Chrome 등 지원 브라우저에서 사용해 주세요. 직접 입력도 가능해요.');if(listening){recognition.stop();return}recognition=new API();recognition.lang='en-US';recognition.interimResults=false;recognition.continuous=false;recognition.onstart=()=>{listening=true;if($('#mic'))$('#mic').textContent='■ 입력 마치기';if($('#speech-status'))$('#speech-status').textContent='듣고 있어요. 영어로 편하게 말해 보세요.';};recognition.onresult=e=>{draft=[draft,e.results[0][0].transcript].filter(Boolean).join(' ');if($('#draft'))$('#draft').value=draft;};recognition.onerror=e=>toast(e.error==='not-allowed'?'마이크 권한이 필요해요. 브라우저 설정에서 허용해 주세요.':'음성을 인식하지 못했어요. 다시 시도하거나 직접 입력해 주세요.');recognition.onend=()=>{listening=false;recognition=null;if($('#mic'))$('#mic').textContent='♩ 음성으로 입력';if($('#speech-status'))$('#speech-status').textContent='입력이 끝났어요. 문장을 확인하고 표현 노트에 담아보세요.';};try{recognition.start()}catch{toast('마이크를 시작할 수 없어요. 직접 입력해 주세요.')}}
document.addEventListener('click',e=>{const target=e.target.closest('button,a');if(!target)return;if(target.dataset.page){navigate(target.dataset.page);return}if(target.matches('[data-add]'))openAdd();if(target.dataset.speak)speak(target.dataset.speak);if(target.dataset.delete){state.notes=state.notes.filter(n=>n.id!==target.dataset.delete);persist();render();toast('표현을 삭제했어요.')}if(target.dataset.topic){topic=target.dataset.topic;if(recognition)recognition.stop();render()}if(target.id==='close-dialog')$('#add-dialog').close();if(target.id==='mic')microphone();if(target.id==='save-draft'){draft=$('#draft').value;if(!draft.trim())return toast('먼저 한 문장을 말하거나 입력해 주세요.');openAdd(draft)}if(target.id==='reveal'){stopAnswer();revealed=true;render()}if(target.dataset.rate)rate(target.dataset.rate);if(target.id==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`little-english-${dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('기록을 파일로 저장했어요.')}});
document.addEventListener('input',e=>{if(e.target.id==='draft')draft=e.target.value;if(e.target.id==='search'){const pos=e.target.selectionStart;search=e.target.value;render();$('#search').focus();$('#search').setSelectionRange(pos,pos)}});
document.addEventListener('change',e=>{if(e.target.id==='filter'){filter=e.target.value;render()}});
$('#expression-form').addEventListener('submit',e=>{e.preventDefault();const english=$('#english').value.trim(),meaning=$('#meaning').value.trim(),category=$('#category').value;if(!english||!meaning)return;const editing=editingId&&state.notes.find(n=>n.id===editingId);if(editing){Object.assign(editing,{english,meaning,category,sample:false});editingId=null;persist();$('#add-dialog').close();render();toast('표현을 고쳤어요. 복습 일정은 그대로예요.');return}if(state.notes.some(n=>n.english.trim().toLowerCase()===english.toLowerCase()))return toast('이미 노트에 있는 표현이에요.');state.notes.unshift({id:crypto.randomUUID(),english,meaning,category,due:dayKey(),interval:0,sample:false,created:Date.now()});persist();$('#add-dialog').close();if(page==='talk')draft='';render();toast(storageAvailable?'표현을 저장했어요. 오늘 복습에서 다시 만나요!':'이번 화면에 저장했어요. 브라우저 영구 저장은 사용할 수 없어요.');});
document.addEventListener('submit',e=>{if(e.target.id==='settings-form'){e.preventDefault();state.goal=Number($('#goal').value);persist();toast('나만의 복습 목표를 저장했어요.')}});
window.addEventListener('focus',()=>{if(!$('#add-dialog').open&&!listening&&!recorder&&['settings'].includes(page))render()});


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
let attempt=null,hinted=false,tries=0,answerRec=null,answerFor=null,later=[],editingId=null;
const SpeechAPI=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
function resetCard(){attempt=null;hinted=false;tries=0;revealed=false}
function reviewQueue(){const list=due();const back=later.map(id=>list.find(n=>n.id===id)).filter(Boolean);return [...list.filter(n=>!later.includes(n.id)),...back]}
function currentCard(){const q=reviewQueue();const card=q.find(n=>n.id===reviewId)||q[0];if(card&&card.id!==reviewId){reviewId=card.id;resetCard()}return card}
function intervalLabel(days){return days===0?'오늘 다시':days===1?'내일':days<30?`${days}일 후`:`${Math.round(days/30*10)/10}개월 후`}
function suggested(){return attempt&&attempt.score>=PASS?'good':'again'}
function highlighted(words){return words.map(w=>`<span class="${w.hit?'hit':'miss'}">${esc(w.text)}</span>`).join(' ')}
function reviewPage(){
 const current=currentCard();const left=reviewQueue().length;
 const head=`<div class="page-head"><div><span class="eyebrow">SAY IT IN ENGLISH</span><h1>오늘의 복습</h1><p>한글 뜻을 보고 영어 표현을 떠올려 보세요. ${reviewed?`이번에 ${reviewed}개 완료 · `:''}${left}개 남았어요.</p></div></div>`;
 if(!current)return `${head}<section class="review-card"><span style="font-size:50px">✳</span><h2>${state.notes.length?'오늘의 표현을 모두 만났어요!':'첫 표현을 담아볼까요?'}</h2><p class="helper">${state.notes.length?'작은 반복이 쌓여 내 영어가 돼요. 내일 다시 만나요.':'헤이링에서 배운 표현을 저장하면 이곳에서 복습할 수 있어요.'}</p><button class="button primary" data-add>새 표현 담기 ＋</button> <button class="button" data-bulk>여러 개 붙여넣기</button><br><button class="text-btn" data-page="notes">표현 노트로 돌아가기</button></section>`;
 const listening=answerRec&&answerFor===current.id;
 const prompt=current.meaning?esc(current.meaning):`<span class="helper">한글 뜻이 비어 있어요. 힌트를 보고 말해보세요.</span>`;
 const showHint=(hinted||!current.meaning)&&!revealed?`<p class="hint-line">${esc(hint(current.english))}</p>`:'';
 let body;
 if(!revealed){
  const feedback=attempt?`<div class="attempt ${attempt.score>=CLOSE?'close':'far'}"><strong>${attempt.score>=CLOSE?'거의 다 왔어요!':'아쉬워요, 한 번 더!'}</strong> <span>${Math.round(attempt.score*100)}% 일치 · ${tries}번째 시도</span><p>내가 쓴 문장: “${esc(attempt.said||'(인식된 말 없음)')}”</p></div>`:'';
  body=`${showHint}${feedback}<div class="review-tools">${!hinted&&current.meaning?'<button class="text-btn" id="show-hint">첫 글자 힌트</button>':''}<button class="text-btn" id="reveal">모르겠어요 · 정답 보기</button></div><form id="type-answer" class="type-answer"><input id="typed" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="영어로 적어보세요" aria-label="직접 입력해서 맞추기"><button class="button">확인</button></form><p class="helper keys">단축키 · Space 정답 보기 · Enter 다음</p>`;
 }else{
  const passed=attempt&&attempt.score>=PASS;
  const options=[['again','다시 볼래요'],['good','기억나요'],['easy','쉬워요']];
  const pick=suggested();
  body=`<div class="verdict ${passed?'pass':'fail'}">${passed?`정답이에요! ✓ <small>${Math.round(attempt.score*100)}% 일치</small>`:attempt?'정답과 비교해 보세요':'정답은 이거예요'}</div><div class="review-answer">${attempt?highlighted(attempt.words):esc(current.english)} <button class="icon-btn" data-speak="${esc(current.id)}" aria-label="정답 듣기">♬</button></div>${attempt?`<p class="helper">내가 쓴 문장: “${esc(attempt.said)}”${passed?'':' · 빨간 밑줄은 빠졌거나 다르게 쓴 단어예요.'}</p>`:''}${current.tip?`<p class="helper tip">💡 ${esc(current.tip)}</p>`:''}<div class="review-actions">${options.map(([r,label],i)=>`<button class="button ${r===pick?'primary':''}" data-rate="${r}">${label}<small>${i+1} · ${intervalLabel(nextInterval(current.interval,r))}</small></button>`).join('')}</div>`;
 }
 return `${head}<section class="review-card"><span class="pill">${esc(current.category)}${current.sample?' · 샘플':''}${current.source?` · ${esc(current.source)}`:''}</span><p class="helper">이 말을 영어로 하면?</p><h2 class="prompt-ko">${prompt}</h2>${body}</section>`;
}
function stopAnswer(){if(answerRec){const r=answerRec;answerRec=null;answerFor=null;try{r.abort()}catch{}}}
function submitAnswer(alternatives){
 const note=state.notes.find(n=>n.id===reviewId);if(!note||revealed)return;
 tries++;attempt=bestGrade(note.english,alternatives.filter(Boolean));
 if(attempt.score>=PASS){revealed=true;render();playEnglish(note.english)}else render();
}
function listenAnswer(){
 const API=SpeechAPI();
 if(!API){toast('이 브라우저는 음성 인식을 지원하지 않아요. Chrome·Safari에서 열거나 아래에 직접 입력해 주세요.');$('#typed')?.focus();return}
 if(answerRec){try{answerRec.stop()}catch{}return}
 if(recognition)recognition.stop();if('speechSynthesis' in window)speechSynthesis.cancel();
 const note=currentCard();if(!note)return;
 const rec=new API();rec.lang='en-US';rec.interimResults=true;rec.continuous=false;rec.maxAlternatives=5;
 let alternatives=[],failed=false;
 answerRec=rec;answerFor=note.id;
 rec.onresult=e=>{const results=Array.from(e.results);const text=results.map(r=>r[0].transcript).join(' ');const el=$('#heard');if(el)el.textContent=text;
  if(results.every(r=>r.isFinal)){const prefix=results.slice(0,-1).map(r=>r[0].transcript).join(' ');alternatives=Array.from(results.at(-1)).map(a=>`${prefix} ${a.transcript}`.trim())}};
 rec.onerror=e=>{failed=true;if(e.error==='aborted')return;toast(e.error==='not-allowed'||e.error==='service-not-allowed'?'마이크 권한이 필요해요. 주소창의 자물쇠 아이콘에서 허용해 주세요.':e.error==='no-speech'?'아무 말도 들리지 않았어요. 다시 눌러서 말해 주세요.':e.error==='network'?'음성 인식 서버에 연결하지 못했어요. 인터넷 연결을 확인하거나 직접 입력해 주세요.':'음성을 인식하지 못했어요. 다시 시도하거나 직접 입력해 주세요.')};
 rec.onend=()=>{if(answerRec!==rec)return;answerRec=null;answerFor=null;if(page!=='review'||reviewId!==note.id)return;if(alternatives.length)submitAnswer(alternatives);else{if(!failed)toast('잘 듣지 못했어요. 다시 눌러서 말해 주세요.');render()}};
 try{rec.start();render()}catch{answerRec=null;answerFor=null;toast('마이크를 시작할 수 없어요. 직접 입력해 주세요.')}
}
function rate(r){
 const note=state.notes.find(n=>n.id===reviewId);if(!note||!revealed)return;
 note.interval=nextInterval(note.interval,r);note.due=r==='again'?dayKey():addDays(note.interval);
 state.history.push({date:dayKey(),noteId:note.id,result:r,...(attempt?{score:attempt.score}:{})});
 later=later.filter(id=>id!==note.id);if(r==='again')later.push(note.id);
 reviewed++;reviewId=null;resetCard();persist();render();
}
function openBulk(){stopAnswer();if($('#add-dialog').open)$('#add-dialog').close();$('#bulk-form').reset();$('#bulk-category').value=topic;updateBulkPreview();$('#bulk-dialog').showModal();$('#bulk-text').focus()}
function updateBulkPreview(){const {items,skipped}=parseBulk($('#bulk-text').value);const dup=items.filter(x=>state.notes.some(n=>n.english.trim().toLowerCase()===x.english.toLowerCase())).length;$('#bulk-preview').innerHTML=items.length||skipped.length?`<strong>${items.length}개 인식</strong>${dup?` · 이미 있는 ${dup}개는 건너뛰어요`:''}${skipped.length?` · 형식이 맞지 않는 ${skipped.length}줄: <em>${esc(skipped.slice(0,2).join(' / '))}${skipped.length>2?' …':''}</em>`:''}<ul>${items.slice(0,4).map(x=>`<li><b>${esc(x.meaning)}</b> → ${esc(x.english)}</li>`).join('')}${items.length>4?'<li>…</li>':''}</ul>`:'한 줄에 하나씩, 영어와 한글 사이에 / 또는 | 또는 탭을 넣어 주세요.'}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='say-answer')listenAnswer();
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
 e.preventDefault();const {items}=parseBulk($('#bulk-text').value);const category=$('#bulk-category').value;let count=0;
 for(const x of items){if(state.notes.some(n=>n.english.trim().toLowerCase()===x.english.toLowerCase()))continue;state.notes.unshift({id:crypto.randomUUID(),english:x.english,meaning:x.meaning,category,source:'헤이링',due:dayKey(),interval:0,sample:false,created:Date.now()+count});count++}
 if(!count)return toast('새로 저장할 표현이 없어요. 형식을 확인해 주세요.');
 persist();$('#bulk-dialog').close();render();toast(`${count}개 표현을 오늘의 복습에 추가했어요.`);
});
document.addEventListener('keydown',e=>{
 if(page!=='review'||e.metaKey||e.ctrlKey||e.altKey||document.querySelector('dialog[open]'))return;
 if(e.target.closest('input,textarea,select,button'))return;
 if(e.code==='Space'&&!revealed&&currentCard()){e.preventDefault();stopAnswer();revealed=true;render()}
 else if(e.key==='Enter'&&revealed){e.preventDefault();rate(suggested())}
 else if(revealed&&['1','2','3'].includes(e.key))rate(['again','good','easy'][Number(e.key)-1]);
});

let lessonDraft='',lessonResult=null,organizing=false,lessonError='',selectedExpressions=new Set(),apiConfigured=null;
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
if(!STATIC_ONLY)fetch(apiURL('/api/status'),{credentials:'include'}).then(r=>r.ok?r.json():null).then(data=>{if(data){apiConfigured=data.configured;if(page==='lesson'&&!organizing&&!recorder)render()}}).catch(()=>{});

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
 const auth=`<div class="sharing-intro"><span class="eyebrow">BETTER, TOGETHER</span><h1>내 영어를 나누는 작은 공간</h1><p>초대한 사람과 표현을 나누고, 복습은 나의 속도로.</p><div class="sharing-steps"><span>① 내 계정 만들기</span><span>② 초대 링크 보내기</span><span>③ 공유할 기록 고르기</span></div></div>`;
 if(STATIC_ONLY)return `${auth}<section class="editor"><h2>온라인 계정 서버 연결 준비 중</h2><p>현재는 웹 화면만 배포된 상태예요. 로그인·초대·기기 간 동기화·AI 정리는 아직 사용할 수 없어요.</p><p class="helper">지금 입력하는 표현은 이 브라우저에만 저장돼요. 학습 설정에서 파일로 백업할 수 있어요.</p></section>`;
 if(!currentUser)return `${auth}<div class="sharing-grid"><form class="editor" id="account-form" data-action="${accountMode}"><h2>${accountMode==='register'?'새 공부 계정 만들기':pendingInvite?'공부 친구가 초대했어요':'나의 공부 공간에 로그인'}</h2><p class="helper">${pendingInvite?'로그인한 다음 초대를 수락하면 연결돼요.':'같은 기기에서도 계정마다 기록과 복습 일정이 분리돼요.'}</p><label for="account-username">아이디</label><input id="account-username" name="username" required pattern="[-a-z0-9_]{3,32}" autocomplete="username" placeholder="영문 소문자·숫자 3~32자"><label for="account-password">비밀번호</label><input id="account-password" name="password" type="password" required maxlength="128" autocomplete="${accountMode==='register'?'new-password':'current-password'}" ${accountMode==='register'?'minlength="10"':''}>${accountMode==='register'?'<label for="account-name">이름</label><input id="account-name" name="name" required maxlength="40" autocomplete="nickname" placeholder="친구에게 보일 이름">':''}${accountMode==='register'&&(API_BASE||window.STUDY_CONFIG?.cloudAccounts)&&!pendingInvite?'<details open><summary>운영자 최초 가입</summary><label for="setup-code">설정 코드</label><input id="setup-code" name="setupCode" type="password" autocomplete="off"><p class="helper">처음 가입하는 운영자는 Cloudflare의 SETUP_CODE 값을 입력하세요. 이후 친구는 초대 링크로 가입해요.</p></details>':''}<div class="editor-actions"><button class="button primary" type="submit" ${accountBusy?'disabled':''}>${accountMode==='register'?'가입하고 시작하기':'로그인'}</button><button class="button" type="button" id="switch-account-mode" ${accountBusy?'disabled':''}>${accountMode==='register'?'기존 계정으로 로그인':'새 계정 만들기'}</button></div><p class="helper">새 비밀번호는 특수문자를 포함해 10~128자로 만들 수 있어요. 현재 비밀번호 재설정 기능은 없어요.</p><p role="status" id="account-error" class="helper">${esc(socialError)}</p></form><section class="editor"><span class="eyebrow">YOUR PRIVATE CORNER</span><h2>공유는 내가 고르는 만큼</h2><p>새 기록은 나만 보기로 시작해요.<br>함께 보기로 바꾸면 연결된 친구만 볼 수 있어요.<br>복습 일정과 음성 녹음은 공유하지 않아요.</p><p class="helper">기존 브라우저 기록은 로그인 후 직접 가져올 수 있어요.</p></section></div>`;
 return `${auth}<div class="account-strip"><span><strong>${esc(currentUser.name)}</strong> · @${esc(currentUser.username)}</span><span>${esc(syncStatus)}</span><button class="text-btn" id="logout-account">로그아웃</button></div>${saveBlocked?`<section class="editor"><h3>저장하지 못한 기록이 있어요</h3><p class="helper">현재 기록을 먼저 다운로드하세요. 최신 기록을 불러오면 현재 화면의 미저장 변경은 교체됩니다.</p><button class="button" id="export">현재 기록 다운로드</button><button class="button" id="reload-study">서버의 최신 기록 불러오기</button></section>`:''}${pendingInvite?`<section class="editor invite-accept"><h2>함께 공부할까요?</h2><p>수락하면 서로 ‘함께 보기’로 지정한 기록을 볼 수 있어요.</p><button class="button primary" id="accept-invite">초대 수락하기</button><button class="text-btn" id="dismiss-invite">나중에</button></section>`:''}<div class="sharing-grid"><section class="editor"><span class="eyebrow">INVITE A STUDY FRIEND</span><h2>함께 공부하기</h2><p class="helper">초대 링크는 24시간 동안 유효하고 한 사람만 사용할 수 있어요. 원하는 사람에게만 보내 주세요.</p><button class="button primary" id="create-invite">초대 링크 만들기 ＋</button>${inviteLink?`<label for="invite-url" style="margin-top:18px">초대 링크</label><input id="invite-url" readonly value="${esc(inviteLink)}"><button class="text-btn" id="copy-invite">링크 복사</button>`:''}${/^(localhost|127\.0\.0\.1)$/.test(location.hostname)?'<p class="helper">현재는 내 컴퓨터의 테스트 주소예요. 다른 기기에서 초대를 받으려면 온라인 배포가 먼저 필요해요.</p>':''}${socialData.invites.map(x=>`<div class="connection-row"><span>대기 중인 초대 · ${new Date(x.expires).toLocaleString('ko-KR')} 만료</span><button class="text-btn" data-revoke="${esc(x.id)}">취소</button></div>`).join('')}</section><section class="editor"><span class="eyebrow">MY STUDY FRIENDS</span><h2>연결된 친구 <small>${socialData.people.length}</small></h2>${socialData.people.map(p=>`<div class="connection-row"><span><strong>${esc(p.name)}</strong><small>@${esc(p.username)}</small></span><button class="text-btn" data-disconnect="${esc(p.id)}">연결 해제</button></div>`).join('')||'<p class="helper">아직 연결된 친구가 없어요. 첫 초대를 보내보세요.</p>'}<p class="helper">연결을 해제하면 서로의 공유 기록에 더 이상 접근할 수 없어요. 이미 내 복습에 담은 사본은 남아요.</p></section></div><section class="editor"><div class="section-title"><h2>친구가 나눈 표현과 이야기</h2><button class="text-btn" id="refresh-social">새로고침 ↻</button></div><p class="helper">내 노트의 ‘나만 보기’를 눌러 공유를 켤 수 있어요. 함께 보기 기록은 연결된 모든 친구에게 보여요.</p>${socialData.feed.map(x=>`<article class="shared-card"><span class="eyebrow">${esc(x.ownerName)} · ${x.kind==='notes'?'표현':'학습 메모'}</span>${x.kind==='notes'?`<h3>${esc(x.english)}</h3><p>${esc(x.meaning)}</p><button class="button" data-copy-shared="${esc(x.id)}" data-owner="${esc(x.ownerId)}">내 복습에 담기 ＋</button>`:`<p style="white-space:pre-wrap">${esc(x.text)}</p>`}</article>`).join('')||'<div class="empty">아직 공유한 기록이 없어요.<br>마음에 드는 표현부터 하나 나눠보세요.</div>'}</section><section class="editor"><h3>이 브라우저에서 공부했던 기록</h3><p class="helper">이전에 로그인 없이 저장한 기록을 내 계정으로 가져와요. 가져온 기록은 모두 나만 보기로 시작해요.</p><button class="button" id="import-local">기존 기록 가져오기</button></section><p role="status" class="helper">${esc(socialError)}</p>`;
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
 if(organizing||vocabularyBusy){toast('AI 요청이 끝난 뒤 다시 시도해 주세요.');return}
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
 }catch(error){socialError=error.message;toast(error.message)}finally{accountBusy=false;if(page==='together')render()}
});
async function startAccount(){
 if(STATIC_ONLY){accountLoading=false;apiConfigured=false;page=pendingInvite?'together':page;render();return}
 try{const {user}=await api('/api/account');if(user){const result=await api('/api/study',undefined,user.id);currentUser=user;state=result.data;studyVersion=result.version;}}
 catch{/* Existing offline notebook remains usable when the server is unavailable. */}
 accountLoading=false;if(pendingInvite)page='together';render();if(currentUser&&page==='together')refreshSocial();
}
render();startAccount();

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
 if(b.dataset.exampleUse!==undefined){const x=vocabularyResult?.expressions[Number(b.dataset.exampleUse)];if(!x)return;openAdd(x.english);$('#meaning').value=x.meaning;$('#category').value='자유 대화';}
});
