import { useCallback, useEffect, useReducer } from 'react';
import {
  DAILY_GOAL,
  dayKey,
  defaultProgress,
  loadProgress,
  saveProgress,
  yesterdayKey,
} from './progress.js';

function reducer(state, action) {
  switch (action.type) {
    case 'setTheme':
      return { ...state, themeKey: action.key };

    case 'finishLevel': {
      const { group, correct, stars, xpGain, wrongIds = [], correctIds = [] } = action.payload;
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

      // 错词池：答错的进池(累计 miss)，本次答对的移出池(视为已掌握)
      const wrong = { ...state.wrong };
      const ts = Date.now();
      for (const id of wrongIds) {
        const w = wrong[id] || { miss: 0 };
        wrong[id] = { miss: w.miss + 1, lastTs: ts };
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
      };
    }

    case 'reviewComplete': {
      // 错词复习：答对的移出池，答错的累计 miss；只加 XP，不计关卡通关
      const { wrongIds = [], correctIds = [], xpGain = 0 } = action.payload;
      const wrong = { ...state.wrong };
      const ts = Date.now();
      for (const id of correctIds) {
        if (wrong[id]) delete wrong[id];
      }
      for (const id of wrongIds) {
        const w = wrong[id] || { miss: 0 };
        wrong[id] = { miss: w.miss + 1, lastTs: ts };
      }
      return { ...state, wrong, xp: state.xp + xpGain };
    }

    case 'addXp':
      return { ...state, xp: state.xp + (action.amount || 0) };

    case 'studyActivity': {
      // 记录今日学习词数，并维护连续打卡天数
      const words = action.words || 0;
      const today = dayKey();
      const prev = state.daily;
      if (!prev || prev.date !== today) {
        const continued = prev && prev.date === yesterdayKey();
        return {
          ...state,
          daily: {
            date: today,
            count: words,
            streak: continued ? prev.streak + 1 : 1,
            goal: (prev && prev.goal) || DAILY_GOAL,
          },
        };
      }
      return { ...state, daily: { ...prev, count: prev.count + words } };
    }

    case 'setGoal': {
      const prev = state.daily || { date: dayKey(), count: 0, streak: 1, goal: DAILY_GOAL };
      return { ...state, daily: { ...prev, goal: action.goal } };
    }

    case 'setPref':
      return { ...state, [action.key]: action.value };

    case 'markWrong': {
      // 把若干词 id 加入错词池(如真题精读里「加入错词本」)
      const wrong = { ...state.wrong };
      const ts = Date.now();
      for (const id of action.ids || []) {
        const w = wrong[id] || { miss: 0 };
        wrong[id] = { miss: w.miss + 1, lastTs: ts };
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

  const setTheme = useCallback((key) => dispatch({ type: 'setTheme', key }), []);
  const finishLevel = useCallback((payload) => dispatch({ type: 'finishLevel', payload }), []);
  const reviewComplete = useCallback((payload) => dispatch({ type: 'reviewComplete', payload }), []);
  const addXp = useCallback((amount) => dispatch({ type: 'addXp', amount }), []);
  const recordStudy = useCallback((words) => dispatch({ type: 'studyActivity', words }), []);
  const setGoal = useCallback((goal) => dispatch({ type: 'setGoal', goal }), []);
  const setPref = useCallback((key, value) => dispatch({ type: 'setPref', key, value }), []);
  const markWrong = useCallback(
    (ids) => dispatch({ type: 'markWrong', ids: Array.isArray(ids) ? ids : [ids] }),
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
