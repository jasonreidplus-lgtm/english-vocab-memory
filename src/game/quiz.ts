/* ============================================================
   闯关题目生成：数据驱动，与画风无关。
   每关随机混合两种题型：
     1. choice 英选中：给单词，选正确释义
     2. cn2en  中选英：给释义，选正确单词
   ============================================================ */
import { shuffle } from '../lib/shuffle';
import type { Word, Question, QuizType, QuizOption } from '../types';

/** 用于出题/找干扰项的字段：均为 Word 上的字符串字段。 */
type QuizField = 'word' | 'base_meaning';

const OPTION_COUNT = 4;
const QUESTION_TYPES: QuizType[] = ['choice', 'cn2en'];

/** 选干扰词：按目标字段去重(本关优先、再全局)，返回来源 Word(保留中英对照，#6 用) */
function pickDistractorWords(
  word: Word,
  levelWords: Word[],
  globalPool: Word[],
  field: QuizField
): Word[] {
  const seen = new Set<string>([String(word[field])]);
  const out: Word[] = [];
  for (const w of [...shuffle(levelWords.filter((x) => x.id !== word.id)), ...shuffle(globalPool)]) {
    const v = w[field];
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(w);
    if (out.length >= OPTION_COUNT - 1) break;
  }
  return out;
}

function assignTypes(n: number): QuizType[] {
  const types: QuizType[] = [];
  for (let i = 0; i < n; i++) types.push(QUESTION_TYPES[i % QUESTION_TYPES.length]);
  return shuffle(types);
}

/** 一个 Word → 选项：key 为该题型的判分主串，en/cn 始终带上供答完对照 */
function toOption(w: Word, type: QuizType): QuizOption {
  return { key: type === 'choice' ? w.base_meaning : w.word, en: w.word, cn: w.base_meaning };
}

function optionsFor(w: Word, levelWords: Word[], globalPool: Word[], type: QuizType): QuizOption[] {
  const field: QuizField = type === 'choice' ? 'base_meaning' : 'word';
  const words = [w, ...pickDistractorWords(w, levelWords, globalPool, field)];
  return shuffle(words.map((x) => toOption(x, type)));
}

export function buildQuiz(levelWords: Word[], globalPool: Word[]): Question[] {
  const words = shuffle(levelWords);
  const types = assignTypes(words.length);

  return words.map((w, i) => {
    const type = types[i];
    return {
      id: w.id,
      w,
      type,
      answer: type === 'choice' ? w.base_meaning : w.word,
      options: optionsFor(w, levelWords, globalPool, type),
    };
  });
}

export function shortMeaning(s: string | null | undefined, max = 16): string {
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

export interface TallyResult {
  correct: number;
  total: number;
  wrongIds: Array<number | string>;
  correctIds: Array<number | string>;
}

export function tallyResult(
  questions: Question[],
  answersCorrect: boolean[]
): TallyResult {
  const total = questions.length;
  let correct = 0;
  const wrongIds: Array<number | string> = [];
  const correctIds: Array<number | string> = [];
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
