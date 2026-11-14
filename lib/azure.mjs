// Azure AI Speech: pronunciation assessment (short-audio REST) and neural text-to-speech.
export const MAX_ASSESS_BYTES = 1_200_000; // ~37 s of 16 kHz mono 16-bit WAV; Azure allows 30 s for assessment
export const TTS_VOICE = 'en-US-AvaNeural';

const b64 = text => {
  const bytes = new TextEncoder().encode(text);
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const num = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

/** Score a 16 kHz mono WAV recording against the reference sentence. */
export async function assessPronunciation(wav, reference, { key, region, request = fetch }) {
  if (!key || !region) fail(503, '운영자가 Azure 음성 키를 연결해야 해요.');
  const params = { ReferenceText: reference, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive', EnableMiscue: 'True', EnableProsodyAssessment: 'True' };
  const response = await request(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', Accept: 'application/json', 'Pronunciation-Assessment': b64(JSON.stringify(params)) },
    body: wav, signal: AbortSignal.timeout(40000),
  });
  if (response.status === 401 || response.status === 403) fail(502, 'Azure 음성 키를 확인해 주세요.');
  if (response.status === 429) fail(429, 'Azure 무료 사용량을 넘었어요. 잠시 후 다시 시도해 주세요.');
  if (!response.ok) fail(502, '발음 평가에 실패했어요.');
  return cleanAssessment(await response.json());
}

/** Reduce Azure's detailed response to what the app shows. */
export function cleanAssessment(data) {
  if (data?.RecognitionStatus && data.RecognitionStatus !== 'Success') return { text: '', scores: null, words: [] };
  const best = data?.NBest?.[0];
  if (!best) return { text: '', scores: null, words: [] };
  const pa = best.PronunciationAssessment || best;
  const scores = { pron: num(pa.PronScore), accuracy: num(pa.AccuracyScore), fluency: num(pa.FluencyScore), completeness: num(pa.CompletenessScore), prosody: num(pa.ProsodyScore) };
  const words = (best.Words || []).slice(0, 80).map(w => {
    const wp = w.PronunciationAssessment || w;
    return {
      word: String(w.Word || '').slice(0, 60),
      accuracy: num(wp.AccuracyScore),
      error: typeof wp.ErrorType === 'string' ? wp.ErrorType : 'None',
      syllables: (w.Syllables || []).slice(0, 12).map(s => ({ grapheme: String(s.Grapheme || '').slice(0, 30), accuracy: num((s.PronunciationAssessment || s).AccuracyScore) })),
    };
  });
  return { text: String(best.Display || data.DisplayText || best.Lexical || '').slice(0, 500), scores, words };
}

const escapeXml = s => String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

/** Build SSML; pauses from the speaking guide become short breaks. */
export function buildSsml(text, { slow = false, pauses = [] } = {}) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const body = words.map((w, i) => escapeXml(w) + (pauses.includes(i) && i < words.length - 1 ? ' <break time="220ms"/>' : '')).join(' ');
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${TTS_VOICE}"><prosody rate="${slow ? '-40%' : '-5%'}">${body}</prosody></voice></speak>`;
}

export async function synthesize(text, options, { key, region, request = fetch }) {
  if (!key || !region) fail(503, '운영자가 Azure 음성 키를 연결해야 해요.');
  const response = await request(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'little-by-little' },
    body: buildSsml(text, options), signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401 || response.status === 403) fail(502, 'Azure 음성 키를 확인해 주세요.');
  if (response.status === 429) fail(429, 'Azure 음성 사용량이 많아요. 잠시 후 다시 시도해 주세요.');
  if (!response.ok) fail(502, '원어민 음성을 만들지 못했어요.');
  return new Uint8Array(await response.arrayBuffer());
}
