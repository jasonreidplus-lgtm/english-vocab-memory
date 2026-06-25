/* ============================================================
   闯关题目生成：数据驱动，与画风无关。
   每关随机混合两种题型：
     1. choice 英选中：给单词，选正确释义
     2. cn2en  中选英：给释义，选正确单词
   ============================================================ */
import { shuffle } from '../lib/shuffle';
import type { Word, Question, QuizType } from '../types';

/** 用于出题/找干扰项的字段：均为 Word 上的字符串字段。 */
type QuizField = 'word' | 'base_meaning';

const OPTION_COUNT = 4;
const QUESTION_TYPES: QuizType[] = ['choice', 'cn2en'];

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function pickDistractors(
  word: Word,
  levelWords: Word[],
  globalPool: Word[],
  field: QuizField
): string[] {
  const correct = word[field];
  const sameLevel = levelWords.filter((w) => w.id !== word.id).map((w) => w[field]);
  const global = globalPool.map((w) => w[field]);
  const candidates = uniq([...shuffle(sameLevel), ...shuffle(global)]).filter(
    (m) => m && m !== correct
  );
  return candidates.slice(0, OPTION_COUNT - 1);
}

function assignTypes(n: number): QuizType[] {
  const types: QuizType[] = [];
  for (let i = 0; i < n; i++) types.push(QUESTION_TYPES[i % QUESTION_TYPES.length]);
  return shuffle(types);
}

function optionsQuestion(
  w: Word,
  levelWords: Word[],
  globalPool: Word[],
  field: QuizField
): string[] {
  const distractors = pickDistractors(w, levelWords, globalPool, field);
  return shuffle(uniq([w[field], ...distractors]));
}

export function buildQuiz(levelWords: Word[], globalPool: Word[]): Question[] {
  const words = shuffle(levelWords);
  const types = assignTypes(words.length);

  return words.map((w, i) => {
    const type = types[i];
    const base = { id: w.id, w, type };
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
