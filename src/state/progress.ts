/* ============================================================
   进度模型(纯函数 + 选择器)。持久化在 localStorage。
   存:已通关关卡 / 星级 / 累计 XP / 连胜 / 错词池 / 画风选择。
   ============================================================ */
import { DEFAULT_THEME } from '../config/themes';
import { isDue, isMastered } from '../lib/fsrs';
import type { Progress, LevelState, Summary, Level, WrongEntry } from '../types';

export const STORAGE_KEY = 'wordquest:v1';
export const DAILY_GOAL = 20; // 默认每日目标(词)

// 本地日期 key：YYYY-MM-DD
export function dayKey(d: Date | number = new Date()): string {
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}
export function yesterdayKey(d: Date | number = new Date()): string {
  const x = new Date(d);
  x.setDate(x.getDate() - 1);
  return dayKey(x);
}
export function addDaysKey(days: number, d: Date | number = new Date()): string {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return dayKey(x);
}

export function defaultProgress(): Progress {
  return {
    v: 1,
    themeKey: DEFAULT_THEME,
    xp: 0,
    combo: 0, // 连胜：连续通关数(本关 0 星会清零)
    bestCombo: 0,
    levels: {}, // { [group]: { stars, completed, bestScore, attempts } }
    cards: {}, // 全词建卡 { [wordId]: { card, miss, lastTs, lapseTs } }；miss>0 即错词
    daily: null, // { date, count, streak, goal } —— 每日目标 / 连续打卡
    history: {}, // { [YYYY-MM-DD]: 当日学习词数 } —— 打卡热力图
    newHistory: {}, // { [YYYY-MM-DD]: 当日新学(首次通关)词数 } —— 燃尽/配速
    revlog: [], // 复习日志(封顶裁剪) —— 真实保持率/趋势
    stats: { answered: 0, correct: 0 }, // 累计答题数 / 答对数 —— 正确率
    sound: true, // 音效朗读开关
    accent: 'us', // 发音口音 us | uk
    examDate: '2026-12-21', // 目标考试日(可在统计页修改)
  };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    // 浅合并，向后兼容字段新增
    const p: Progress = { ...defaultProgress(), ...parsed };
    if (!p.cards) p.cards = {};
    // 迁移：旧 wrong(错词池) 并入 cards(全词建卡新结构)，并入后清空 wrong
    if (parsed.wrong && Object.keys(parsed.wrong).length) {
      for (const [id, e] of Object.entries(parsed.wrong)) {
        if (e && !p.cards[id]) p.cards[id] = { ...e };
      }
    }
    p.wrong = undefined;
    return p;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* localStorage 不可用时静默降级 */
  }
}

// —— 评分 / 奖励：阈值用比例，题量多少都通用 ——
export function starsFor(correct: number, total: number): number {
  if (total <= 0) return 0;
  const r = correct / total;
  if (r >= 0.9) return 3;
  if (r >= 0.7) return 2;
  if (r >= 0.5) return 1;
  return 0;
}

export function xpFor(correct: number, stars: number): number {
  return correct * 10 + stars * 5;
}

// —— 关卡解锁状态计算 ——
// 返回与 levels 等长的数组，每项附带 state: done | unlocked | locked | pending
export function computeLevelStates(levels: Level[], progress: Progress): LevelState[] {
  let allowNext = true; // 下一个“已生成”关卡是否允许开启
  return levels.map((lv): LevelState => {
    if (!lv.ready) {
      return { ...lv, stars: 0, completed: false, state: 'pending', enterable: false };
    }
    const p = progress.levels[lv.group];
    const completed = !!(p && p.completed);
    const stars = (p && p.stars) || 0;
    let state: LevelState['state'];
    let enterable: boolean;
    if (completed) {
      state = 'done';
      enterable = true;
      allowNext = true;
    } else if (allowNext) {
      state = 'unlocked';
      enterable = true;
      allowNext = false; // 未通关前，挡住后续关卡
    } else {
      state = 'locked';
      enterable = false;
    }
    return { ...lv, stars, completed, state, enterable, bestScore: (p && p.bestScore) || 0 };
  });
}

// 找到“下一关该去哪”：当前关之后第一个可进入的关卡 group(没有则 null)
export function nextEnterableGroup(levelStates: LevelState[], currentGroup: number): number | null {
  const idx = levelStates.findIndex((l) => l.group === currentGroup);
  for (let i = idx + 1; i < levelStates.length; i++) {
    if (levelStates[i].ready) return levelStates[i].group;
  }
  return null;
}

// 汇总：通关数 / 总就绪关数 / 已收集错词数 / 已学单词数(已通关各关就绪词之和)
export function summarize(levels: Level[], progress: Progress): Summary {
  const readyCount = levels.filter((l) => l.ready).length;
  let clearedCount = 0;
  let learnedWords = 0;
  let totalWords = 0;
  const learnedIds = new Set<number | string>();
  for (const lv of levels) {
    if (lv.ready) totalWords += lv.readyCount || 0;
    const p = progress.levels[lv.group];
    if (p && p.completed) {
      clearedCount++;
      learnedWords += lv.readyCount || 0;
      for (const w of lv.readyWords || []) learnedIds.add(w.id);
    }
  }
  // 错词本规模：仍未掌握的错词(miss>0 且未到毕业间隔)
  let wrongCount = 0;
  for (const e of Object.values(progress.cards || {})) {
    if ((e.miss || 0) > 0 && !(e.card && isMastered(e.card))) wrongCount++;
  }
  return { readyCount, clearedCount, wrongCount, learnedWords, totalWords, totalGroups: levels.length, learnedIds };
}

// 已「完全学会」(掌握)的核心词数：有卡且间隔≥21天进入 Review 态。供段位/预估用
export function masteredCount(progress: Progress): number {
  let n = 0;
  for (const [id, e] of Object.entries(progress.cards || {})) {
    if (String(id).startsWith('d:')) continue;
    if (e.card && isMastered(e.card)) n++;
  }
  return n;
}

// —— 复习取词：今日复习(FSRS 到期) / 今日重温(今天失手) ——
// 新数据看 FSRS card.due；旧存档(无 card)回退看旧 due 日期；按到期早晚排序
function dueTs(e: WrongEntry | undefined): number {
  if (e?.card) return new Date(e.card.due).getTime();
  if (e?.due) return new Date(`${e.due}T00:00:00`).getTime();
  return 0; // 无任何排期信息 → 视为最早到期
}
/** 今日复习：FSRS 到期、且不是「今天刚失手」的词(后者归今日重温，避免重复) */
export function dueReviewIds(progress: Progress, now: Date = new Date()): string[] {
  const today = dayKey(now);
  return Object.entries(progress.cards || {})
    .filter(([, e]: [string, WrongEntry]) => {
      if (e?.lapseTs && dayKey(e.lapseTs) === today) return false; // 今天失手 → 走重温
      return e?.card ? isDue(e.card, now) : !e || !e.due || e.due <= today;
    })
    .sort((a, b) => dueTs(a[1]) - dueTs(b[1]))
    .map(([id]) => id);
}
/** 今日重温：今天答错/忘了、尚未攻克(记得/秒答会清 lapseTs)的词，不论 FSRS 排到哪天 */
export function relearnIds(progress: Progress, now: Date = new Date()): string[] {
  const today = dayKey(now);
  return Object.entries(progress.cards || {})
    .filter(([, e]: [string, WrongEntry]) => !!e?.lapseTs && dayKey(e.lapseTs) === today)
    .sort((a, b) => (a[1].lapseTs || 0) - (b[1].lapseTs || 0))
    .map(([id]) => id);
}

// 累计正确率(%)
export function accuracy(progress: Progress): number {
  const a = (progress.stats && progress.stats.answered) || 0;
  if (!a) return 0;
  return Math.round((((progress.stats && progress.stats.correct) || 0) / a) * 100);
}
