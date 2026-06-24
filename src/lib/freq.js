/* 真题库词频：统计每个高亮词目在 44 篇真题(public/data/passages.json)里的总出现次数，
   词形还原后合并(companies=company、went=go)。供阅读页给高亮词标注「次数」数字+分档颜色。
   分档：1 灰 / 2-4 黄 / 5-7 红 / 8+ 黑。 */
import { annotate, candidates } from './annotate.js';
import { dictData } from './dict.js';
import { fetchBuiltin } from './passages.js';

// 规范词目：优先考研核心词原型；其次取词典中最短的候选，把屈折形归并到原型
export function lemmaKey(token, lookup) {
  const cs = candidates(token);
  for (const c of cs) {
    const hit = lookup && lookup.get(c);
    if (hit) return String(hit.word || c).toLowerCase();
  }
  const d = dictData();
  if (d) {
    let best = null;
    for (const c of cs) if (d[c] && (best === null || c.length < best.length)) best = c;
    if (best) return best;
  }
  return null;
}

let _freq = null;
let _loading = null;
// 统计一次并缓存。词典就绪后调用(否则词典词漏计)。
export function loadFreq(lookup) {
  if (_freq) return Promise.resolve(_freq);
  if (_loading) return _loading;
  _loading = fetchBuiltin().then((passages) => {
    const dict = dictData();
    const m = new Map();
    for (const p of passages || []) {
      for (const s of p.sents || []) {
        for (const seg of annotate(s.en, lookup, dict)) {
          if (!seg.w) continue; // 只统计高亮词(功能词已被排除)
          const k = lemmaKey(seg.t, lookup);
          if (k) m.set(k, (m.get(k) || 0) + 1);
        }
      }
    }
    _freq = m;
    return m;
  });
  return _loading;
}

export function freqOf(freq, token, lookup) {
  if (!freq) return 0;
  const k = lemmaKey(token, lookup);
  return k ? freq.get(k) || 0 : 0;
}
export const freqLabel = (n) => (n >= 8 ? '8+' : String(n));
export const freqClass = (n) =>
  n >= 8 ? 'fq-black' : n >= 5 ? 'fq-red' : n >= 2 ? 'fq-yellow' : n >= 1 ? 'fq-gray' : '';
