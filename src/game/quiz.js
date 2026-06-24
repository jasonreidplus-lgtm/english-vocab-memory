/* ============================================================
   闯关题目生成：数据驱动，与画风无关。
   随机混合题型：
     1. choice 英选中：给单词，选正确释义
     2. cn2en  中选英：给释义，选正确单词
     3. spell  拼写  ：给释义，键入单词(opts.spelling 开启时混入，无选项)
   ============================================================ */
import { shuffle } from '../lib/shuffle.js';

const OPTION_COUNT = 4;
const QUESTION_TYPES = ['choice', 'cn2en'];

function uniq(arr) {
  return [...new Set(arr)];
}

function pickDistractors(word, levelWords, globalPool, field) {
  const correct = word[field];
  const sameLevel = levelWords.filter((w) => w.id !== word.id).map((w) => w[field]);
  const global = globalPool.map((w) => w[field]);
  const candidates = uniq([...shuffle(sameLevel), ...shuffle(global)]).filter(
    (m) => m && m !== correct
  );
  return candidates.slice(0, OPTION_COUNT - 1);
}

function assignTypes(n, types) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(types[i % types.length]);
  return shuffle(out);
}

function optionsQuestion(w, levelWords, globalPool, field) {
  const distractors = pickDistractors(w, levelWords, globalPool, field);
  return shuffle(uniq([w[field], ...distractors]));
}

export function buildQuiz(levelWords, globalPool, opts = {}) {
  const typePool = opts.spelling ? [...QUESTION_TYPES, 'spell'] : QUESTION_TYPES;
  const words = shuffle(levelWords);
  const types = assignTypes(words.length, typePool);

  return words.map((w, i) => {
    const type = types[i];
    const base = { id: w.id, w, type };
    if (type === 'spell') {
      return { ...base, answer: w.word }; // 看释义拼单词，无选项
    }
    if (type === 'choice') {
      return {
        ...base,
        answer: w.base_meaning,
        options: optionsQuestion(w, levelWords, globalPool, 'base_meaning'),
      };
    }
    return {
      ...base,
      answer: w.word,
      options: optionsQuestion(w, levelWords, globalPool, 'word'),
    };
  });
}

// 拼写题提示：首字母 + 其余字母用下划线占位(连字符/空格原样保留)
export function spellHint(word) {
  return String(word || '')
    .split('')
    .map((ch, i) => (i === 0 ? ch : /[a-zA-Z]/.test(ch) ? '_' : ch))
    .join(' ');
}

export function shortMeaning(s, max = 16) {
  const str = String(s || '').trim();
  if (str.length <= max) return str;

  const parts = str.split(/[；;，,]/).map((p) => p.trim()).filter(Boolean);
  let out = parts[0] || str.slice(0, max);
  for (let i = 1; i < parts.length && out.length < max - 2; i++) {
    out += '；' + parts[i];
  }
  if (out.length < str.length) out = out.slice(0, Math.max(max, out.length)) + '…';
  return out;
}

export function tallyResult(questions, answersCorrect) {
  const total = questions.length;
  let correct = 0;
  const wrongIds = [];
  const correctIds = [];
  questions.forEach((q, i) => {
    if (answersCorrect[i]) {
      correct++;
      correctIds.push(q.id);
    } else {
      wrongIds.push(q.id);
    }
  });
  return { correct, total, wrongIds, correctIds };
}
