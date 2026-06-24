/* 真题库词频：预计算的 public/data/freq.json（{词目: 次数}，由 scripts/build-freq.mjs 生成）。
   运行期直接查表，给阅读高亮词/闯关词标「出现次数」+ 分档颜色：1 灰 / 2-4 黄 / 5-7 红 / 8+ 黑。 */
import { candidates } from './annotate.js';
import { dictData } from './dict.js';

// 规范词目：优先考研核心词原型；其次词典中最短候选(把屈折形归并到原型)。与 build-freq.mjs 同逻辑。
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
export function loadFreq() {
  if (_freq) return Promise.resolve(_freq);
  if (_loading) return _loading;
  _loading = fetch(`${import.meta.env.BASE_URL}data/freq.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((o) => {
      _freq = new Map(Object.entries(o || {}));
      return _freq;
    })
    .catch(() => {
      _freq = new Map();
      return _freq;
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
