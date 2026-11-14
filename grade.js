// Speaking-answer grading for review cards. Pure functions: no DOM, no network.
const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const WHOLE = {
  "can't": 'can not', cannot: 'can not', "won't": 'will not', "shan't": 'shall not', "ain't": 'is not',
  "let's": 'let us', "it's": 'it is', "that's": 'that is', "what's": 'what is', "there's": 'there is',
  "here's": 'here is', "he's": 'he is', "she's": 'she is', "who's": 'who is', "where's": 'where is',
  "how's": 'how is', "i'm": 'i am', gonna: 'going to', wanna: 'want to', gotta: 'got to',
  ok: 'okay', 'o.k.': 'okay', alright: 'all right', '&': 'and',
};
const SUFFIX = [["n't", ' not'], ["'re", ' are'], ["'ll", ' will'], ["'ve", ' have'], ["'d", ' would'], ["'m", ' am']];

/** Lower-case, unify apostrophes, expand contractions and small numbers, drop punctuation. */
export function tokens(text) {
  const words = String(text ?? '').toLowerCase().replace(/[‘’`´]/g, "'").replace(/[^a-z0-9'&.\s-]/g, ' ').replace(/-/g, ' ').split(/\s+/);
  const out = [];
  for (let word of words) {
    word = word.replace(/^[.']+|[.']+$/g, '');
    if (!word) continue;
    if (WHOLE[word]) { out.push(...WHOLE[word].split(' ')); continue; }
    const suffix = SUFFIX.find(([s]) => word.endsWith(s) && word.length > s.length);
    if (suffix) { out.push(...(word.slice(0, -suffix[0].length) + suffix[1]).split(' ')); continue; }
    if (/^\d+$/.test(word) && Number(word) <= 20) { out.push(NUMBERS[Number(word)]); continue; }
    word = word.replace(/\./g, '').replace(/'s$/, 's').replace(/'/g, '');
    if (word) out.push(word);
  }
  return out;
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}
// Speech recognisers often slip one letter on longer words (e.g. "colour"/"color").
const close = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && distance(a, b) <= 1);

/**
 * Compare what was said with the expected answer.
 * Returns {score 0..1, words:[{text, hit}]} where words follow the expected answer's original spelling.
 */
export function grade(expected, said) {
  const display = String(expected ?? '').split(/\s+/).filter(Boolean);
  // Map each normalised token back to the display word it came from.
  const target = [], owner = [];
  display.forEach((word, i) => { for (const t of tokens(word)) { target.push(t); owner.push(i); } });
  const spoken = tokens(said);
  if (!target.length) return { score: 0, words: display.map(text => ({ text, hit: false })) };
  const n = target.length, m = spoken.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    lcs[i][j] = close(target[i], spoken[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const hitToken = new Array(n).fill(false);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (close(target[i], spoken[j])) { hitToken[i] = true; i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  const common = lcs[0][0];
  const score = m ? (2 * common) / (n + m) : 0;
  const words = display.map((text, i) => {
    const mine = owner.map((o, k) => o === i ? hitToken[k] : null).filter(x => x !== null);
    return { text, hit: mine.length === 0 || mine.every(Boolean) };
  });
  return { score: Math.round(score * 100) / 100, words };
}

/** Best result across several recogniser alternatives. */
export function bestGrade(expected, alternatives) {
  let best = { score: -1 };
  for (const said of alternatives.length ? alternatives : ['']) {
    const result = grade(expected, said);
    if (result.score > best.score) best = { ...result, said };
  }
  return best;
}
/** First-letter hint: "I came here." -> "I c___ h___." */
export function hint(text) {
  return String(text ?? '').replace(/[A-Za-z]+/g, w => w[0] + '_'.repeat(w.length - 1));
}

export const PASS = 0.9;
export const CLOSE = 0.6;

/** Spaced-repetition step. interval is in days; 0 = new or relearning. */
export function nextInterval(interval, rating) {
  const current = Number(interval) || 0;
  if (rating === 'again') return 0;
  if (rating === 'easy') return current ? Math.min(Math.round(current * 3.5), 120) : 4;
  return current ? Math.min(Math.max(current + 1, Math.round(current * 2.5)), 90) : 1;
}

/** Split pasted lines like "I came here by van. / 나는 밴을 타고 왔어" into pairs. Hangul side becomes the meaning. */
export function parseBulk(text) {
  const items = [], skipped = [];
  const hangul = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, '');
    if (!line) continue;
    const parts = line.split(/\t|\s*\|\s*|\s+\/\s+|\s+=\s+|\s+[-–—]\s+/).map(x => x.trim()).filter(Boolean);
    if (parts.length < 2) { skipped.push(raw.trim()); continue; }
    const k = parts.findIndex(p => hangul.test(p));
    if (k === -1) { skipped.push(raw.trim()); continue; }
    const meaning = parts[k], english = parts.filter((_, i) => i !== k).join(' ');
    if (!english || hangul.test(english)) { skipped.push(raw.trim()); continue; }
    items.push({ english, meaning });
  }
  return { items, skipped };
}

const UI_WORDS = /^(try again|try|again|great!?|good!?|perfect!?|원어민|나|연습하기|연습|복습하기|패러프레이징|이렇게 말할 수도 있어요|이렇게 패러프레이징 했어요|영어로는\??|문장을 만들어보세요|haze)$/i;
/** Turn shared or OCR'd text (e.g. a Heyring screenshot) into an English/Korean pair for the add dialog. */
export function parseShared(text) {
  const hangul = /[가-힣]/;
  const lines = String(text ?? '').split(/\r?\n|\s{3,}/).map(l => l.trim()).filter(Boolean)
    .filter(l => !UI_WORDS.test(l) && !/^[\d\s:.%·|/-]+$/.test(l) && l.length > 1);
  const latin = lines.filter(l => !hangul.test(l) && /[A-Za-z]{2,}/.test(l));
  const multi = latin.filter(l => l.split(/\s+/).length >= 2);
  const english = multi.length ? multi : latin.slice(0, 1);
  const korean = lines.filter(l => hangul.test(l) && !/[A-Za-z]{3,}/.test(l));
  const pair = parseBulk(lines.join('\n')).items[0];
  if (!english.length && !korean.length && pair) return pair;
  return { english: english.join(' ').replace(/\s+/g, ' ').trim(), meaning: korean.join(' ').replace(/\s+/g, ' ').trim() };
}
