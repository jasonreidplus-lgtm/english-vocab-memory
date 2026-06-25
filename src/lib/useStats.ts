import { useMemo } from 'react';
import { computeStats } from './stats';
import type { StatsResult } from './stats';
import type { Progress, Summary } from '../types';

/** 记忆化统计：progress 变化(学习/复习)即重算 → 图表随行为更新。rangeDays 控制趋势/活动窗口。 */
export function useStats(progress: Progress, summary: Summary, rangeDays = 30): StatsResult {
  return useMemo(() => computeStats(progress, summary, { rangeDays }), [progress, summary, rangeDays]);
}
