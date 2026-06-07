/* ============================================================
   进度模型(纯函数 + 选择器)。持久化在 localStorage。
   存:已通关关卡 / 星级 / 累计 XP / 连胜 / 错词池 / 画风选择。
   ============================================================ */
import { DEFAULT_THEME } from '../config/themes.jsx';

export const STORAGE_KEY = 'wordquest:v1';
export const DAILY_GOAL = 20; // 默认每日目标(词)

// 本地日期 key：YYYY-MM-DD
export function dayKey(d = new Date()) {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}
export function yesterdayKey(d = new Date()) {
  const x = new Date(d);
  x.setDate(x.getDate() - 1);
  return dayKey(x);
}

export function defaultProgress() {
  return {
    v: 1,
    themeKey: DEFAULT_THEME,
    xp: 0,
    combo: 0, // 连胜：连续通关数(本关 0 星会清零)
    bestCombo: 0,
    levels: {}, // { [group]: { stars, completed, bestScore, attempts } }
    wrong: {}, // 错词池 { [wordId]: { miss, lastTs } }
    daily: null, // { date, count, streak, goal } —— 每日目标 / 连续打卡
    sound: true, // 音效朗读开关
    accent: 'us', // 发音口音 us | uk
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    // 浅合并，向后兼容字段新增
    return { ...defaultProgress(), ...parsed };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* localStorage 不可用时静默降级 */
  }
}

// —— 评分 / 奖励：阈值用比例，题量多少都通用 ——
export function starsFor(correct, total) {
  if (total <= 0) return 0;
  const r = correct / total;
  if (r >= 0.9) return 3;
  if (r >= 0.7) return 2;
  if (r >= 0.5) return 1;
  return 0;
}

export function xpFor(correct, stars) {
  return correct * 10 + stars * 5;
}

// —— 关卡解锁状态计算 ——
// 返回与 levels 等长的数组，每项附带 state: done | unlocked | locked | pending
export function computeLevelStates(levels, progress) {
  let allowNext = true; // 下一个“已生成”关卡是否允许开启
  return levels.map((lv) => {
    if (!lv.ready) {
      return { ...lv, stars: 0, completed: false, state: 'pending', enterable: false };
    }
    const p = progress.levels[lv.group];
    const completed = !!(p && p.completed);
    const stars = (p && p.stars) || 0;
    let state;
    let enterable;
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
export function nextEnterableGroup(levelStates, currentGroup) {
  const idx = levelStates.findIndex((l) => l.group === currentGroup);
  for (let i = idx + 1; i < levelStates.length; i++) {
    if (levelStates[i].ready) return levelStates[i].group;
  }
  return null;
}

// 汇总：通关数 / 总就绪关数 / 已收集错词数
export function summarize(levels, progress) {
  const readyCount = levels.filter((l) => l.ready).length;
  const clearedCount = Object.values(progress.levels).filter((l) => l && l.completed).length;
  const wrongCount = Object.keys(progress.wrong || {}).length;
  return { readyCount, clearedCount, wrongCount, totalGroups: levels.length };
}
