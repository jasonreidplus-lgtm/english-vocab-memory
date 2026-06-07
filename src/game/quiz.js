/* ============================================================
   闯关题目生成 —— 数据驱动，与画风完全无关。
   每关随机混合三种题型：
     ① choice 英选中：给单词，选正确释义(4 选 1)
     ② cn2en  中选英：给释义，选正确单词(4 选 1)
     ③ spell  拼写  ：给释义+音标，用键盘拼出单词
   ============================================================ */
import { shuffle } from '../lib/shuffle.js';

const OPTION_COUNT = 4;
const QUESTION_TYPES = ['choice', 'cn2en', 'spell'];

function uniq(arr) {
  return [...new Set(arr)];
}

// 为某个词挑 3 个干扰项：优先同关其它词，其次全局词库。field 决定取释义还是单词。
function pickDistractors(word, levelWords, globalPool, field) {
  const correct = word[field];
  const sameLevel = levelWords.filter((w) => w.id !== word.id).map((w) => w[field]);
  const global = globalPool.map((w) => w[field]);
  const candidates = uniq([...shuffle(sameLevel), ...shuffle(global)]).filter(
    (m) => m && m !== correct
  );
  return candidates.slice(0, OPTION_COUNT - 1);
}

// 让三种题型尽量均匀并打散
function assignTypes(n) {
  const types = [];
  for (let i = 0; i < n; i++) types.push(QUESTION_TYPES[i % QUESTION_TYPES.length]);
  return shuffle(types);
}

function optionsQuestion(w, levelWords, globalPool, field) {
  const distractors = pickDistractors(w, levelWords, globalPool, field);
  return shuffle(uniq([w[field], ...distractors]));
}

export function buildQuiz(levelWords, globalPool) {
  const words = shuffle(levelWords); // 题目顺序也打散
  const types = assignTypes(words.length);

  return words.map((w, i) => {
    const type = types[i];
    const base = { id: w.id, w, type };
    if (type === 'choice') {
      return { ...base, answer: w.base_meaning, options: optionsQuestion(w, levelWords, globalPool, 'base_meaning') };
    }
    if (type === 'cn2en') {
      return { ...base, answer: w.word, options: optionsQuestion(w, levelWords, globalPool, 'word') };
    }
    // spell
    return { ...base, answer: w.word };
  });
}

// 拼写判定：忽略大小写、首尾空格、首尾标点，折叠多余空格
export function checkSpelling(input, answer) {
  const norm = (s) =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  return norm(input) === norm(answer);
}

// 取释义的“首要义项”——选择题选项太长时只显示第一段，保持可扫读
export function shortMeaning(s, max = 16) {
  const str = String(s || '').trim();
  if (str.length <= max) return str;
  const parts = str.split(/[；;]/);
  let out = parts[0].trim();
  for (let i = 1; i < parts.length && out.length < max - 2; i++) {
    out += '；' + parts[i].trim();
  }
  if (out.length < str.length) out = out.slice(0, Math.max(max, out.length)) + '…';
  return out;
}

// 结算汇总(纯函数)：把每题答对与否汇总成结果
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
