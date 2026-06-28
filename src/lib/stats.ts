/* 学习统计：纯函数指标计算。输入 progress + summary + 配置 → 输出所有指标。
   与 UI / 存储解耦，方便复用与心算核对。口径按本应用「闯关 + 全词建卡」模型接地：
   - 掌握分档：未学 / 已掌握(间隔≥21天) / 熟悉(7~21天) / 学习中——每个学过的词都带 FSRS 卡，按 stability/掌握态分
   - 保持率：对已复习过(state≠New)的卡算 current / 考试日 / 真实保持率(来自 revlog)
   - 配速/燃尽：走通关覆盖(每个词都算)，actual 速率取近 7 日「新学」均值，故随行为变化 */
import { retrievability, isMastered, State } from './fsrs';
import type { Progress, Summary, SerializedCard, RevlogEntry } from '../types';

export const FSRS_TARGET = 0.9; // ts-fsrs 默认目标保持率
export const DEFAULT_EXAM_DATE = '2026-12-21';
const DAY = 86_400_000;
const FAMILIAR_DAYS = 7; // stability ≥ 7 天 → 熟悉
const MASTERED_DAYS = 21; // ≥ 21 天 → 掌握(错词到此即毕业移出)
export const LEECH_LAPSES = 5; // lapses ≥ 5 → 困难词
const FUTURE_DAYS = 30;

export type Tier = 'unseen' | 'learning' | 'familiar' | 'solid';
export const TIER_ORDER: Tier[] = ['solid', 'familiar', 'learning', 'unseen'];
export const TIER_META: Record<Tier, { label: string; color: string }> = {
  solid: { label: '已掌握', color: 'var(--good)' },
  familiar: { label: '熟悉', color: 'var(--accent)' },
  learning: { label: '学习中', color: '#e0892b' },
  unseen: { label: '未学', color: 'var(--line-strong)' },
};

/** 错词卡是否处于「学习中」档(New/Learning/Relearning 或 stability < 7 天) */
export function isLearningTier(card: SerializedCard): boolean {
  const st = card.stability || 0;
  return card.state === State.New || card.state === State.Learning || card.state === State.Relearning || st < FAMILIAR_DAYS;
}

/** PDF 导出筛选维度 */
export type ExportFilter = 'wrong-all' | 'leech' | 'learning' | 'familiar' | 'due' | 'learned-all';

export interface HistBucket { label: string; count: number; }
export interface TrendPoint { label: string; reviews: number; trueRet: number | null; }
export interface DayPoint { key: string; count: number; }
export interface DualDay { label: string; learn: number; review: number; cum: number; } // 每日新学/复习/累计学习

export interface StatsResult {
  now: Date;
  examDate: Date;
  coverage: { learned: number; total: number; pct: number };
  pace: {
    daysToExam: number;
    remaining: number;
    neededPerDay: number;
    actualPerDay: number;
    onTrack: boolean;
    finishMs: number | null;
    willFinishBeforeExam: boolean;
    deficit: number; // 按当前速率到考试日预计还差多少词(0=在轨道上)
  };
  mastery: { tiers: Record<Tier, number>; matureCoverage: number; leech: number };
  retention: {
    current: number | null;
    atExam: number | null;
    trueRet: number | null;
    target: number;
    reviewedCount: number; // 参与 current/atExam 的错词卡数
    sampleSize: number; // 参与 trueRet 的复习次数
  };
  futureDue: { days: number[]; overdue: number };
  stabilityHist: HistBucket[];
  trend: TrendPoint[];
  activity: DayPoint[];
  dual: DualDay[]; // 每日「新学/复习」分色柱 + 累计学习曲线
}

export interface StatsOpts { now?: Date; rangeDays?: number; }

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function pad(n: number): string { return String(n).padStart(2, '0'); }
function dayKeyOf(ms: number): string { const x = new Date(ms); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; }
function mdLabel(ms: number): string { const x = new Date(ms); return `${x.getMonth() + 1}/${x.getDate()}`; }
function avg(ns: number[]): number { return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0; }

// 近 days 天「新学」日均(随近期行为变化)
function recentRate(h: Record<string, number> | undefined, now: Date, days: number): number {
  if (!h) return 0;
  const t0 = startOfDay(now).getTime();
  let s = 0;
  for (let i = 0; i < days; i++) s += h[dayKeyOf(t0 - i * DAY)] || 0;
  return s / days;
}

const STAB_BUCKETS: Array<[number, number, string]> = [
  [0, 1, '<1天'],
  [1, 3, '1-3天'],
  [3, 7, '3-7天'],
  [7, 14, '1-2周'],
  [14, 30, '2-4周'],
  [30, Infinity, '>30天'],
];
function histogram(stabs: number[]): HistBucket[] {
  return STAB_BUCKETS.map(([lo, hi, label]) => ({ label, count: stabs.filter((s) => s >= lo && s < hi).length }));
}

function reviewTrend(revlog: RevlogEntry[], now: Date, rangeDays: number): TrendPoint[] {
  const weeks = Math.max(1, Math.min(26, Math.ceil(rangeDays / 7)));
  const end = startOfDay(now).getTime() + DAY; // 含今天
  const out: TrendPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const hi = end - w * 7 * DAY;
    const lo = hi - 7 * DAY;
    const inWk = revlog.filter((r) => r.t >= lo && r.t < hi);
    const rev = inWk.filter((r) => r.st === State.Review);
    out.push({
      label: mdLabel(lo),
      reviews: inWk.length,
      trueRet: rev.length ? rev.filter((r) => r.r !== 1).length / rev.length : null,
    });
  }
  return out;
}

function activitySeries(h: Record<string, number> | undefined, now: Date, days: number): DayPoint[] {
  const t0 = startOfDay(now).getTime();
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKeyOf(t0 - i * DAY);
    out.push({ key: k, count: (h && h[k]) || 0 });
  }
  return out;
}

// 每日「新学(柱A) + 复习(柱B)」+ 累计学习(曲线)。累计含窗口前的历史新学，曲线连续
function dualSeries(nh: Record<string, number> | undefined, rh: Record<string, number> | undefined, now: Date, days: number): DualDay[] {
  const t0 = startOfDay(now).getTime();
  const winStart = t0 - (days - 1) * DAY;
  let cum = 0;
  if (nh) for (const k in nh) { const t = new Date(`${k}T00:00:00`).getTime(); if (!Number.isNaN(t) && t < winStart) cum += nh[k] || 0; }
  const out: DualDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ms = t0 - i * DAY;
    const k = dayKeyOf(ms);
    const learn = (nh && nh[k]) || 0;
    const review = (rh && rh[k]) || 0;
    cum += learn;
    out.push({ label: mdLabel(ms), learn, review, cum });
  }
  return out;
}

export function computeStats(progress: Progress, summary: Summary, opts: StatsOpts = {}): StatsResult {
  const now = opts.now ?? new Date();
  const rangeDays = opts.rangeDays ?? 30;
  let exam = startOfDay(new Date(progress.examDate || DEFAULT_EXAM_DATE));
  if (Number.isNaN(exam.getTime())) exam = startOfDay(new Date(DEFAULT_EXAM_DATE)); // 非法考试日兜底，避免 pace 出现 NaN
  const cardEntries = progress.cards || {};
  const cards: SerializedCard[] = Object.values(cardEntries)
    .map((e) => e.card)
    .filter((c): c is SerializedCard => !!c);

  // —— 覆盖 ——
  const total = summary.totalWords || 0;
  const learned = summary.learnedWords || 0;
  const coverage = { learned, total, pct: total ? learned / total : 0 };

  // —— 配速 / 燃尽 ——
  const daysToExam = Math.max(0, Math.round((exam.getTime() - startOfDay(now).getTime()) / DAY));
  const remaining = Math.max(0, total - learned);
  const neededPerDay = daysToExam > 0 ? remaining / daysToExam : remaining;
  const actualPerDay = recentRate(progress.newHistory, now, 7);
  const projDays = actualPerDay > 0 ? Math.ceil(remaining / actualPerDay) : Infinity;
  const finishMs = Number.isFinite(projDays) ? startOfDay(now).getTime() + projDays * DAY : null;
  const willFinishBeforeExam = finishMs != null && finishMs <= exam.getTime();
  const onTrack = remaining === 0 || actualPerDay + 1e-9 >= neededPerDay;
  const deficit = Math.max(0, Math.round((neededPerDay - actualPerDay) * daysToExam));
  const pace = { daysToExam, remaining, neededPerDay, actualPerDay, onTrack, finishMs, willFinishBeforeExam, deficit };

  // —— 掌握分档(全词建卡：按每张核心卡的真实 FSRS 状态分) ——
  // 只统计考研核心词宇宙(排除广义词典 d: 词)。已掌握=间隔≥21天进 Review 态；熟悉=7~21天；学习中=新/学习/<7天。
  let learning = 0;
  let familiar = 0;
  let solid = 0;
  let leech = 0;
  let coreStudied = 0; // 词库内(非 d:)有卡的词数
  for (const [id, e] of Object.entries(cardEntries)) {
    const c = e.card;
    if (!c || String(id).startsWith('d:')) continue; // 无卡 / 广义词典词不计入词库分档
    coreStudied++;
    if ((c.lapses || 0) >= LEECH_LAPSES) leech++;
    if (isMastered(c)) solid++;
    else if (isLearningTier(c)) learning++;
    else familiar++; // 7~21 天归熟悉
  }
  const seen = Math.min(total, coreStudied); // 已接触过的核心词
  const unseen = Math.max(0, total - seen);
  const tiers: Record<Tier, number> = { solid, familiar, learning, unseen };
  const mastery = { tiers, matureCoverage: total ? solid / total : 0, leech };

  // —— 保持率(错词卡) ——
  const reviewed = cards.filter((c) => c.state !== State.New);
  const current = reviewed.length ? avg(reviewed.map((c) => retrievability(c, now))) : null;
  const atExam = reviewed.length ? avg(reviewed.map((c) => retrievability(c, exam))) : null;
  const revlog = progress.revlog || [];
  const reviewEntries = revlog.filter((r) => r.st === State.Review);
  const trueRet = reviewEntries.length ? reviewEntries.filter((r) => r.r !== 1).length / reviewEntries.length : null;
  const retention = {
    current,
    atExam,
    trueRet,
    target: FSRS_TARGET,
    reviewedCount: reviewed.length,
    sampleSize: reviewEntries.length,
  };

  // —— 未来到期(错词复习债) ——
  const days = new Array<number>(FUTURE_DAYS).fill(0);
  let overdue = 0;
  const today0 = startOfDay(now).getTime();
  for (const c of cards) {
    const idx = Math.round((startOfDay(new Date(c.due)).getTime() - today0) / DAY);
    if (idx < 0) overdue++;
    else if (idx < FUTURE_DAYS) days[idx]++;
  }
  const futureDue = { days, overdue };

  return {
    now,
    examDate: exam,
    coverage,
    pace,
    mastery,
    retention,
    futureDue,
    stabilityHist: histogram(cards.map((c) => c.stability || 0)),
    trend: reviewTrend(revlog, now, rangeDays),
    activity: activitySeries(progress.history, now, rangeDays),
    dual: dualSeries(progress.newHistory, progress.reviewHistory, now, rangeDays),
  };
}

// —— 智能学完预估(前向模拟：复习挤占每日精力，结合 FSRS 间隔，非线性外推) ——
export interface EstimateResult {
  remainingNew: number; // 还剩多少新词没学
  capacity: number; // 每日可处理量(=每日目标，含复习)
  learnDays: number | null; // 学完所有新词(天)；null=超出上限
  masterDays: number | null; // 全部「完全学会」(天)
  learnFinishMs: number | null;
  masterFinishMs: number | null;
}
const GOOD_STEPS = [1, 3, 7, 16, 35]; // Good 路径近似间隔(天)；survived≥21(=35) 即掌握
/** 每日把「每日目标」当作总精力额度：先清当天到期复习，剩余额度学新词；每学/复习一次按 FSRS 间隔排下次。 */
export function estimateCompletion(progress: Progress, summary: Summary, opts: StatsOpts = {}): EstimateResult {
  const now = opts.now ?? new Date();
  const today0 = startOfDay(now).getTime();
  const total = summary.totalWords || 0;
  const capacity = Math.max(1, (progress.daily && progress.daily.goal) || 20);
  const cards = progress.cards || {};
  const queue = new Map<number, number[]>(); // dayOffset -> [stepIdx]：该日到期复习(stepIdx=对应间隔下标)
  let alive = 0;
  const push = (off: number, idx: number) => { const a = queue.get(off); if (a) a.push(idx); else queue.set(off, [idx]); alive++; };
  const stepFromStability = (s: number) => { let i = 0; while (i < GOOD_STEPS.length - 1 && GOOD_STEPS[i] < s) i++; return i; };
  let coreStudied = 0;
  for (const [id, e] of Object.entries(cards)) {
    if (String(id).startsWith('d:')) continue;
    const c = e.card; if (!c) continue;
    coreStudied++;
    if (isMastered(c)) continue; // 已掌握不再排复习
    const off = Math.max(0, Math.round((startOfDay(new Date(c.due)).getTime() - today0) / DAY));
    push(off, stepFromStability(c.stability || 0));
  }
  const remainingNew0 = Math.max(0, total - coreStudied);
  let remainingNew = remainingNew0;
  let learnDays: number | null = remainingNew0 === 0 ? 0 : null;
  const MAX = 3650;
  let day = 0;
  while ((remainingNew > 0 || alive > 0) && day <= MAX) {
    let slots = capacity;
    const due = queue.get(day);
    if (due) {
      queue.delete(day);
      alive -= due.length;
      let p = 0;
      for (; p < due.length && slots > 0; p++, slots--) {
        const idx = due[p];
        if (GOOD_STEPS[Math.min(idx, GOOD_STEPS.length - 1)] >= 21) continue; // 撑过≥21天 → 掌握，不再排
        const ni = Math.min(idx + 1, GOOD_STEPS.length - 1);
        push(day + GOOD_STEPS[ni], ni);
      }
      for (let k = p; k < due.length; k++) push(day + 1, due[k]); // 当天没做完的复习滚到明天
    }
    const newToday = Math.min(remainingNew, slots);
    remainingNew -= newToday;
    for (let k = 0; k < newToday; k++) push(day + GOOD_STEPS[0], 0); // 新学的词排第一次复习
    day++;
    if (remainingNew === 0 && learnDays === null) learnDays = day;
  }
  const masterDays = remainingNew === 0 && alive === 0 && day <= MAX ? day : null;
  return {
    remainingNew: remainingNew0,
    capacity,
    learnDays,
    masterDays,
    learnFinishMs: learnDays != null ? today0 + learnDays * DAY : null,
    masterFinishMs: masterDays != null ? today0 + masterDays * DAY : null,
  };
}
