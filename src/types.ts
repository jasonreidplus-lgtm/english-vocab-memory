/* 全局共用类型契约。各模块从这里 import，避免各造一套。 */
import type { ComponentType } from 'react';

export interface Example {
  en: string;
  cn: string;
}

/** 单词词条：核心词库(数字 id) / 广义词典词(id 形如 "d:word") / 未收录占位("x:..") 通用。 */
export interface Word {
  id: number | string;
  word: string;
  base_meaning: string;
  phonetic?: string;
  pos?: string;
  group?: number;
  status?: string;
  roots?: string;
  examples?: Example[];
  confusions?: string;
  exam_tip?: string;
  mnemonic?: string;
  _dict?: boolean; // 来自广义词典
  _missing?: boolean; // 词典也未收录
}

export interface Level {
  group: number;
  words: Word[];
  readyWords: Word[];
  ready: boolean;
  count: number;
  readyCount: number;
}

export type LevelStatus = 'done' | 'unlocked' | 'locked' | 'pending';
export interface LevelState extends Level {
  stars: number;
  completed: boolean;
  state: LevelStatus;
  enterable: boolean;
  bestScore?: number;
}

/** ts-fsrs Card 的可序列化形态(Date → ISO 字符串)，存进 localStorage */
export interface SerializedCard {
  due: string; // ISO，下次到期时间
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  state: number; // ts-fsrs State：0 New / 1 Learning / 2 Review / 3 Relearning
  last_review?: string; // ISO
}

/** 一个学过的词的记忆条目：FSRS 卡 + 失误统计。
   全词建卡后存进 Progress.cards(每个学过的词一张)；miss>0 即「错词」。 */
export interface WrongEntry {
  miss: number;
  lastTs?: number;
  lapseTs?: number; // 最近一次「未攻克的失误」时间戳：答错/忘了时置，记得/秒答时清。用于「今日重温」
  card?: SerializedCard; // FSRS 调度卡(间隔/到期/掌握度都由它决定)
  // —— 旧 Leitner 字段，仅用于旧存档兼容读取 ——
  box?: number;
  due?: string; // YYYY-MM-DD
}

/** 一条复习记录(自评复习写入)，供时序统计：真实保持率 / 趋势 / 活动 */
export interface RevlogEntry {
  id: number | string; // wordId
  t: number; // 复习时间戳(ms)
  r: number; // 评分 1-4 (Again/Hard/Good/Easy)
  st: number; // 复习前状态(ts-fsrs State；真实保持率只看 Review 态=2)
  s: number; // 复习后 stability(天)
}

export interface Daily {
  date: string;
  count: number;
  streak: number;
  goal: number;
}

export interface LevelProgress {
  stars: number;
  completed: boolean;
  bestScore: number;
  attempts: number;
}

export interface Stats {
  answered: number;
  correct: number;
}

export interface Progress {
  v: number;
  themeKey: string;
  xp: number;
  combo: number;
  bestCombo: number;
  levels: Record<string, LevelProgress>;
  cards: Record<string, WrongEntry>; // 每个学过的词一张 FSRS 卡(全词建卡)；miss>0 即错词
  wrong?: Record<string, WrongEntry>; // 旧字段：仅兼容旧存档/备份导入，加载时并入 cards
  daily: Daily | null;
  history: Record<string, number>;
  newHistory: Record<string, number>; // { day: 当日新学(首次通关)词数 } —— 燃尽/配速/学习曲线
  reviewHistory?: Record<string, number>; // { day: 当日复习次数 } —— 学习/复习分色柱
  timeHistory?: Record<string, number>; // { day: 当日学习时长(ms) } —— 学习时长统计
  revlog: RevlogEntry[]; // 复习日志(封顶裁剪)
  stats: Stats;
  sound: boolean;
  accent: 'us' | 'uk';
  examDate?: string; // 目标考试日(YYYY-MM-DD)，配速/燃尽用
  userNotes?: Record<string, string>; // 用户自定义记忆法 { wordId: 文本 }
}

export interface Summary {
  readyCount: number;
  clearedCount: number;
  wrongCount: number;
  learnedWords: number;
  totalWords: number;
  totalGroups: number;
  /** 已通关各关「就绪词」的 id 集合，用于统计页精确区分错词是否属于已学词 */
  learnedIds?: Set<number | string>;
}

/** 长难句拆解（作者侧按规则离线预生成，存进句子数据；运行时只读取展示） */
export interface SentenceAnalysis {
  trunk: string; // 主干（一句话，如 "S+V+O：…"）
  structure?: string[]; // 分层结构：每行一条(自带缩进/├└ 符号)
  logic?: string; // 逻辑关系（一句话）
  notes?: string[]; // 难点提示（要点：分隔点/易错结构/生词）
}

export interface Sentence {
  en: string;
  cn?: string;
  analysis?: SentenceAnalysis;
}

export interface Passage {
  id: string;
  title: string;
  sents: Sentence[];
  demo?: boolean;
  studied?: boolean;
  year?: number;
  text?: number;
}

export interface Theme {
  key: string;
  label: string;
  vars: Record<string, string>;
  Deco?: ComponentType;
  fontHref?: string;
}

export type QuizType = 'choice' | 'cn2en';
/** 选择题的一个选项：key=判分/匹配用主串(选义题=释义,选词题=单词)，en/cn 供答完后中英对照展示(#6) */
export interface QuizOption {
  key: string;
  en: string;
  cn: string;
}
export interface Question {
  id: number | string;
  w: Word;
  type: QuizType;
  answer: string; // 正确选项的 key
  options: QuizOption[];
}

/** annotate 切片：t=原文片段，w=命中的词条或 null */
export interface Seg {
  t: string;
  w: Word | null;
}

/** 广义词典原始结构 public/data/dict.json */
export type DictData = Record<string, { t: string; p?: string; pos?: string }>;

/** 词→小写词的查找表 */
export type Lookup = Map<string, Word>;
