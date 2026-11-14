export const MAX_AUDIO_BYTES=2*1024*1024;
const formats={'audio/webm':'webm','audio/mp4':'mp4','audio/ogg':'ogg','audio/wav':'wav','audio/mpeg':'mp3'};
export function audioType(value){const type=String(value||'').split(';')[0].trim().toLowerCase();if(!formats[type])throw Object.assign(Error('지원하지 않는 녹음 형식이에요.'),{status:415});return type}
export async function transcribeAudio(bytes,type,{apiKey,request=fetch}={}){
 type=audioType(type);
 if(!bytes.byteLength||bytes.byteLength>MAX_AUDIO_BYTES)throw Object.assign(Error('녹음은 2MB 이내로 보내 주세요.'),{status:413});
 if(!apiKey)throw Object.assign(Error('운영자가 AI 키를 연결해야 해요.'),{status:503});
 const form=new FormData();form.append('file',new Blob([bytes],{type}),`answer.${formats[type]}`);
 form.append('model','gpt-4o-transcribe');form.append('language','en');form.append('response_format','json');
 let response;
 try{response=await request('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form,signal:AbortSignal.timeout(45000)})}
 catch{throw Object.assign(Error('음성 인식 서버에 연결하지 못했어요. 다시 시도해 주세요.'),{status:502})}
 if(!response.ok)throw Object.assign(Error('음성 인식 요청에 실패했어요. API 키·크레딧·사용 한도를 확인해 주세요.'),{status:502});
 let data;try{data=await response.json()}catch{throw Object.assign(Error('음성 인식 응답을 읽지 못했어요.'),{status:502})}
 if(typeof data.text!=='string'||data.text.length>5000)throw Object.assign(Error('음성 인식 응답이 올바르지 않아요.'),{status:502});
 return {text:data.text.trim()};
}
