/* FSRS 间隔复习内核(基于 ts-fsrs)。错词本里每个词存一张 SerializedCard，
   到期判定 / 四档评分 / 下次间隔预览都走这里。关掉短期学习步(enable_short_term:false)，
   让每次复习只评一次、按「天」重排，契合每日复习的使用习惯。 */
import { createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs';
import type { Card, Grade } from 'ts-fsrs';
import type { SerializedCard } from '../types';

const scheduler = fsrs(generatorParameters({ enable_short_term: false }));

/** 四档评分(Again/Hard/Good/Easy = 1/2/3/4)，顺序固定供 UI 遍历 */
export const GRADES: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

/** 间隔 ≥ 此天数且进入 Review 态 → 视为已掌握，移出错词本(沿用旧「毕业」体验) */
const GRADUATE_INTERVAL_DAYS = 21;

const MS_PER_DAY = 86_400_000;

function deserialize(s: SerializedCard): Card {
  return {
    ...s,
    due: new Date(s.due),
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  } as Card;
}

function serialize(c: Card): SerializedCard {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    learning_steps: c.learning_steps,
    state: c.state,
    last_review: c.last_review ? c.last_review.toISOString() : undefined,
  };
}

const toCard = (card: SerializedCard | undefined, now: Date): Card =>
  card ? deserialize(card) : createEmptyCard(now);

/** 新建空卡(默认今日到期、New 态) */
export function emptyCard(now: Date = new Date()): SerializedCard {
  return serialize(createEmptyCard(now));
}

/** 按某一档评分，返回重排后的卡 */
export function gradeCard(card: SerializedCard | undefined, grade: Grade, now: Date = new Date()): SerializedCard {
  return serialize(scheduler.next(toCard(card, now), now, grade).card);
}

/** 标记为「答错/不认识」：无卡→新建今日到期；有卡→按 Again 失忆重排 */
export function markWrongCard(card: SerializedCard | undefined, now: Date = new Date()): SerializedCard {
  if (!card) return emptyCard(now); // 新错词：今日就该复习
  return gradeCard(card, Rating.Again, now);
}

/** 是否到期(到期或已过期) */
export function isDue(card: SerializedCard | undefined, now: Date = new Date()): boolean {
  if (!card) return false;
  return new Date(card.due).getTime() <= now.getTime();
}

/** 是否已掌握(可移出错词本) */
export function isMastered(card: SerializedCard): boolean {
  return card.state === State.Review && card.scheduled_days >= GRADUATE_INTERVAL_DAYS;
}

/** 四档下次间隔(天)，用于按钮预览 */
export function previewDays(card: SerializedCard | undefined, now: Date = new Date()): Record<Grade, number> {
  const rec = scheduler.repeat(toCard(card, now), now);
  const out = {} as Record<Grade, number>;
  for (const g of GRADES) {
    out[g] = Math.max(0, Math.round((rec[g].card.due.getTime() - now.getTime()) / MS_PER_DAY));
  }
  return out;
}

/** 天数 → 中文短标签 */
export function intervalLabel(days: number): string {
  if (days <= 0) return '<1天';
  if (days < 30) return `${days} 天`;
  if (days < 365) return `${Math.round(days / 30)} 个月`;
  const y = days / 365;
  return `${y < 2 ? y.toFixed(1) : Math.round(y)} 年`;
}

export { Rating };
