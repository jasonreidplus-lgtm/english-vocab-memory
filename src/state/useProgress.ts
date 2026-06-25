import { useCallback, useEffect, useReducer } from 'react';
import {
  DAILY_GOAL,
  dayKey,
  defaultProgress,
  loadProgress,
  saveProgress,
  yesterdayKey,
} from './progress';
import { markWrongCard, gradeCard, gradeWithLog, isMastered, Rating } from '../lib/fsrs';
import type { Progress, Daily, WrongEntry, RevlogEntry } from '../types';
import type { Grade } from 'ts-fsrs';

const REVLOG_CAP = 5000; // 复习日志封顶，超出裁掉最旧(够画数月趋势)

/** finishLevel 载荷：一关结束后的结算数据 */
export interface FinishLevelPayload {
  group: number;
  correct: number;
  total?: number;
  stars: number;
  xpGain: number;
  wrongIds?: Array<number | string>;
  correctIds?: Array<number | string>;
}

export type Action =
  | { type: 'setTheme'; key: string }
  | { type: 'finishLevel'; payload: FinishLevelPayload }
  | { type: 'reviewGrade'; id: number | string; grade: Grade }
  | { type: 'addXp'; amount?: number }
  | { type: 'studyActivity'; words?: number }
  | { type: 'setGoal'; goal: number }
  | { type: 'setPref'; key: keyof Progress; value: Progress[keyof Progress] }
  | { type: 'markWrong'; ids?: Array<number | string> }
  | { type: 'resetAll' };

export function reducer(state: Progress, action: Action): Progress {
  switch (action.type) {
    case 'setTheme':
      return { ...state, themeKey: action.key };

    case 'finishLevel': {
      const { group, correct, total = 0, stars, xpGain, wrongIds = [], correctIds = [] } = action.payload;
      const prev = state.levels[group] || {};
      const firstClear = !(prev && prev.completed); // 首次通关才记「新学」
      const levels = {
        ...state.levels,
        [group]: {
          stars: Math.max(prev.stars || 0, stars),
          completed: true,
          bestScore: Math.max(prev.bestScore || 0, correct),
          attempts: (prev.attempts || 0) + 1,
        },
      };

      // 错词池：答错的进池(FSRS 今日到期)，本次答对的移出池(视为已掌握)
      const wrong: Record<string, WrongEntry> = { ...state.wrong };
      const ts = Date.now();
      const now = new Date(ts);
      for (const id of wrongIds) {
        const w: WrongEntry = wrong[id] || { miss: 0 };
        wrong[id] = { ...w, miss: (w.miss || 0) + 1, lastTs: ts, card: markWrongCard(w.card, now) };
      }
      // 答对：若该词本就在错词池里，按一次成功复习(Good)交给 FSRS 重排，达毕业(≥21天)才移出——
      // 与「间隔复习」一致，避免闯关蒙对一次就把仍需巩固的词永久移出。不写 revlog(那是专给自评复习的)。
      for (const id of correctIds) {
        const e = wrong[id];
        if (!e) continue; // 不在错词池 → 无需处理
        const card = gradeCard(e.card, Rating.Good, now);
        if (isMastered(card)) delete wrong[id];
        else wrong[id] = { ...e, card, lastTs: ts };
      }

      // 首次通关：本关词数计入「当日新学」(燃尽/配速曲线)
      const newHistory: Record<string, number> = { ...(state.newHistory || {}) };
      if (firstClear) {
        const today = dayKey();
        newHistory[today] = (newHistory[today] || 0) + total;
      }

      const passed = stars >= 1;
      const combo = passed ? state.combo + 1 : 0;

      return {
        ...state,
        levels,
        wrong,
        newHistory,
        xp: state.xp + xpGain,
        combo,
        bestCombo: Math.max(state.bestCombo || 0, combo),
        stats: {
          answered: ((state.stats && state.stats.answered) || 0) + total,
          correct: ((state.stats && state.stats.correct) || 0) + correct,
        },
      };
    }

    case 'reviewGrade': {
      // 间隔复习四档自评：用 FSRS 重排该词的卡；达长间隔(Review 态)即毕业移出错词本
      const e = state.wrong[action.id];
      if (!e) return state;
      const now = new Date();
      const { card, log } = gradeWithLog(e.card, action.grade, now);
      const wrong: Record<string, WrongEntry> = { ...state.wrong };
      if (isMastered(card)) {
        delete wrong[action.id]; // 已掌握 → 毕业移出
      } else {
        wrong[action.id] = {
          ...e,
          card,
          lastTs: now.getTime(),
          miss: action.grade === Rating.Again ? (e.miss || 0) + 1 : e.miss,
        };
      }
      // 记一条复习日志(供真实保持率/趋势)，封顶裁剪最旧
      const revlog = [...(state.revlog || []), { id: action.id, ...log } as RevlogEntry];
      if (revlog.length > REVLOG_CAP) revlog.splice(0, revlog.length - REVLOG_CAP);
      return { ...state, wrong, revlog };
    }

    case 'addXp':
      return { ...state, xp: state.xp + (action.amount || 0) };

    case 'studyActivity': {
      // 记录今日学习词数(打卡历史 + 连续打卡天数)
      const words = action.words || 0;
      const today = dayKey();
      const history: Record<string, number> = { ...(state.history || {}) };
      history[today] = (history[today] || 0) + words;
      // 裁剪：只保留最近约 200 天，避免 localStorage 随年累月无限增长(热力图仅回看 17 周)
      const hKeys = Object.keys(history);
      if (hKeys.length > 220) {
        for (const k of hKeys.sort().slice(0, hKeys.length - 200)) delete history[k];
      }
      const prev = state.daily;
      if (!prev || prev.date !== today) {
        const continued = prev && prev.date === yesterdayKey();
        return {
          ...state,
          history,
          daily: {
            date: today,
            count: words,
            streak: continued ? prev.streak + 1 : 1,
            goal: (prev && prev.goal) || DAILY_GOAL,
          },
        };
      }
      return { ...state, history, daily: { ...prev, count: prev.count + words } };
    }

    case 'setGoal': {
      const prev: Daily = state.daily || { date: dayKey(), count: 0, streak: 1, goal: DAILY_GOAL };
      return { ...state, daily: { ...prev, goal: action.goal } };
    }

    case 'setPref':
      return { ...state, [action.key]: action.value };

    case 'markWrong': {
      // 把若干词 id 加入错词池(真题精读「加入错词本」/学习卡「不认识」)，今日到期可复习
      const wrong: Record<string, WrongEntry> = { ...state.wrong };
      const ts = Date.now();
      const now = new Date(ts);
      for (const id of action.ids || []) {
        const w: WrongEntry = wrong[id] || { miss: 0 };
        wrong[id] = { ...w, miss: (w.miss || 0) + 1, lastTs: ts, card: markWrongCard(w.card, now) };
      }
      return { ...state, wrong };
    }

    case 'resetAll':
      return { ...defaultProgress(), themeKey: state.themeKey };

    default:
      return state;
  }
}

export function useProgress() {
  const [progress, dispatch] = useReducer(reducer, undefined, loadProgress);

  // 任何变更后持久化(刷新不丢)
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const setTheme = useCallback((key: string) => dispatch({ type: 'setTheme', key }), []);
  const finishLevel = useCallback((payload: FinishLevelPayload) => dispatch({ type: 'finishLevel', payload }), []);
  const reviewGrade = useCallback((id: number | string, grade: Grade) => dispatch({ type: 'reviewGrade', id, grade }), []);
  const addXp = useCallback((amount: number) => dispatch({ type: 'addXp', amount }), []);
  const recordStudy = useCallback((words: number) => dispatch({ type: 'studyActivity', words }), []);
  const setGoal = useCallback((goal: number) => dispatch({ type: 'setGoal', goal }), []);
  const setPref = useCallback(
    <K extends keyof Progress>(key: K, value: Progress[K]) => dispatch({ type: 'setPref', key, value }),
    []
  );
  const markWrong = useCallback(
    (ids: number | string | Array<number | string>) => dispatch({ type: 'markWrong', ids: Array.isArray(ids) ? ids : [ids] }),
    []
  );
  const resetAll = useCallback(() => dispatch({ type: 'resetAll' }), []);

  return {
    progress,
    setTheme,
    finishLevel,
    reviewGrade,
    addXp,
    recordStudy,
    setGoal,
    setPref,
    markWrong,
    resetAll,
  };
}
