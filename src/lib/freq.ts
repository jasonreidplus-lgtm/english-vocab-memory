/* 真题库词频：预计算的 public/data/freq.json（{词目: 次数}，由 scripts/build-freq.mjs 生成）。
   运行期直接查表，给阅读高亮词/闯关词标「出现次数」+ 分档颜色：1 灰 / 2-4 黄 / 5-7 红 / 8+ 黑。 */
import type { Lookup, Word } from '../types';
import { candidates } from './annotate';
import { dictData } from './dict';

// 规范词目：优先考研核心词原型；其次词典中最短候选(把屈折形归并到原型)。与 build-freq.mjs 同逻辑。
export function lemmaKey(token: string, lookup?: Lookup): string | null {
  const cs = candidates(token);
  for (const c of cs) {
    const hit = lookup && lookup.get(c);
    if (hit) return String(hit.word || c).toLowerCase();
  }
  const d = dictData();
  if (d) {
    let best: string | null = null;
    for (const c of cs) if (d[c] && (best === null || c.length < best.length)) best = c;
    if (best) return best;
  }
  return null;
}

let _freq: Map<string, number> | null = null;
let _loading: Promise<Map<string, number>> | null = null;
export function loadFreq(): Promise<Map<string, number>> {
  if (_freq) return Promise.resolve(_freq);
  if (_loading) return _loading;
  _loading = fetch(`${import.meta.env.BASE_URL}data/freq.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, number>>) : ({} as Record<string, number>)))
    .then((o: Record<string, number>) => {
      _freq = new Map(Object.entries(o || {}));
      return _freq;
    })
    .catch(() => {
      _freq = new Map();
      return _freq;
    });
  return _loading;
}

export function freqOf(freq: Map<string, number> | null, token: string, lookup: Lookup): number {
  if (!freq) return 0;
  const k = lemmaKey(token, lookup);
  return k ? freq.get(k) || 0 : 0;
}

// 高亮门槛：真题词频 ≥ 此值的最高频基础词(the/time/world/even/turn…)不再高亮，只保留可点查，减少噪声。调大=高亮更多，调小=更克制。
export const HL_FREQ_CAP = 8;
/** 是否作为「重点词」高亮：考研核心词(非广义词典词) 且 真题词频未达最高频档(否则太常见、徒增视觉噪声) */
export function isKeyHit(w: Word | null, token: string, lookup: Lookup, freq: Map<string, number> | null): boolean {
  if (!w || w._dict) return false;
  return freqOf(freq, token, lookup) < HL_FREQ_CAP;
}
export const freqLabel = (n: number): string => (n >= 8 ? '8+' : String(n));
export const freqClass = (n: number): string =>
  n >= 8 ? 'fq-black' : n >= 5 ? 'fq-red' : n >= 2 ? 'fq-yellow' : n >= 1 ? 'fq-gray' : '';
