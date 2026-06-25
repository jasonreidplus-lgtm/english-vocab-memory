import { useCallback, useEffect, useReducer } from 'react';
import {
  DAILY_GOAL,
  SRS_INTERVALS,
  addDaysKey,
  dayKey,
  defaultProgress,
  loadProgress,
  saveProgress,
  yesterdayKey,
} from './progress';
import type { Progress, Daily, WrongEntry } from '../types';

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

/** reviewComplete 载荷：间隔复习一轮结束后的结算数据 */
export interface ReviewCompletePayload {
  wrongIds?: Array<number | string>;
  correctIds?: Array<number | string>;
  xpGain?: number;
  total?: number;
  correct?: number;
}

export type Action =
  | { type: 'setTheme'; key: string }
  | { type: 'finishLevel'; payload: FinishLevelPayload }
  | { type: 'reviewComplete'; payload: ReviewCompletePayload }
  | { type: 'addXp'; amount?: number }
  | { type: 'studyActivity'; words?: number }
  | { type: 'setGoal'; goal: number }
  | { type: 'setPref'; key: keyof Progress; value: Progress[keyof Progress] }
  | { type: 'markWrong'; ids?: Array<number | string> }
  | { type: 'resetAll' };

function reducer(state: Progress, action: Action): Progress {
  switch (action.type) {
    case 'setTheme':
      return { ...state, themeKey: action.key };

    case 'finishLevel': {
      const { group, correct, total = 0, stars, xpGain, wrongIds = [], correctIds = [] } = action.payload;
      const prev = state.levels[group] || {};
      const levels = {
        ...state.levels,
        [group]: {
          stars: Math.max(prev.stars || 0, stars),
          completed: true,
          bestScore: Math.max(prev.bestScore || 0, correct),
          attempts: (prev.attempts || 0) + 1,
        },
      };

      // 错词池：答错的进池(回到第 1 级、今日到期)，本次答对的移出池(视为已掌握)
      const wrong: Record<string, WrongEntry> = { ...state.wrong };
      const ts = Date.now();
      const today = dayKey();
      for (const id of wrongIds) {
        const w = wrong[id] || { miss: 0 };
        wrong[id] = { miss: (w.miss || 0) + 1, lastTs: ts, box: 0, due: today };
      }
      for (const id of correctIds) {
        if (wrong[id]) delete wrong[id];
      }

      const passed = stars >= 1;
      const combo = passed ? state.combo + 1 : 0;

      return {
        ...state,
        levels,
        wrong,
        xp: state.xp + xpGain,
        combo,
        bestCombo: Math.max(state.bestCombo || 0, combo),
        stats: {
          answered: ((state.stats && state.stats.answered) || 0) + total,
          correct: ((state.stats && state.stats.correct) || 0) + correct,
        },
      };
    }

    case 'reviewComplete': {
      // 间隔复习：答对的升级(到顶即毕业移出)，答错的回到第 1 级；只加 XP，不计关卡通关
      const { wrongIds = [], correctIds = [], xpGain = 0, total = 0, correct = 0 } = action.payload;
      const wrong: Record<string, WrongEntry> = { ...state.wrong };
      const ts = Date.now();
      for (const id of correctIds) {
        const e = wrong[id];
        if (!e) continue;
        const b = e.box || 0;
        if (b >= SRS_INTERVALS.length) {
          delete wrong[id]; // 走完最长间隔(15天)后再答对 → 毕业移出错词本
        } else {
          // 用「当前级」的间隔安排下次复习再升级：新词(box0)首次答对=1天后，逐级 1→2→4→7→15
          wrong[id] = { ...e, box: b + 1, due: addDaysKey(SRS_INTERVALS[b]), lastTs: ts };
        }
      }
      for (const id of wrongIds) {
        const e = wrong[id] || { miss: 0 };
        wrong[id] = { ...e, miss: (e.miss || 0) + 1, box: 0, due: addDaysKey(SRS_INTERVALS[0]), lastTs: ts };
      }
      return {
        ...state,
        wrong,
        xp: state.xp + xpGain,
        stats: {
          answered: ((state.stats && state.stats.answered) || 0) + total,
          correct: ((state.stats && state.stats.correct) || 0) + correct,
        },
      };
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
      const today = dayKey();
      for (const id of action.ids || []) {
        const w = wrong[id] || { miss: 0 };
        wrong[id] = { ...w, miss: (w.miss || 0) + 1, lastTs: ts, box: 0, due: today };
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
  const reviewComplete = useCallback((payload: ReviewCompletePayload) => dispatch({ type: 'reviewComplete', payload }), []);
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
    reviewComplete,
    addXp,
    recordStudy,
    setGoal,
    setPref,
    markWrong,
    resetAll,
  };
}
