/* ============================================================
   真题语境标注引擎：把一段英文切词、还原词形、命中词库即标注。
   纯规则去屈折 + 小不规则表，离线、毫秒级，不依赖任何 NLP 库。
   只读词库、不改任何字段（守数据只读铁律）。
   ============================================================ */

import type { Word, Seg, Lookup, DictData } from '../types';

// 高频不规则变化（规则法覆盖不到的）
const IRREG: Record<string, string> = {
  went: 'go', gone: 'go', better: 'good', best: 'good', worse: 'bad', worst: 'bad',
  children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth',
  taught: 'teach', bought: 'buy', brought: 'bring', thought: 'think', sought: 'seek',
  fought: 'fight', meant: 'mean', held: 'hold', kept: 'keep', felt: 'feel',
  built: 'build', sent: 'send', spent: 'spend', lost: 'lose', made: 'make',
  found: 'find', told: 'tell', led: 'lead', became: 'become', begun: 'begin',
  began: 'begin', drawn: 'draw', grown: 'grow', given: 'give', taken: 'take',
  shown: 'show', written: 'write', risen: 'rise', driven: 'drive', chosen: 'choose',
  arose: 'arise', arisen: 'arise', bore: 'bear', borne: 'bear', drew: 'draw',
};

// 把一个 token 还原成若干候选基本形（只要命中词库就算）。token 集合有限 → 记忆化，长文/逐句精读复用命中率极高。
const _candCache = new Map<string, string[]>();
export function candidates(raw: string): string[] {
  const w = String(raw || '').toLowerCase().replace(/[^a-z'-]/g, '');
  if (!w) return [];
  const cached = _candCache.get(w);
  if (cached) return cached;
  const set = new Set([w]);
  const add = (s: string) => s && s.length >= 3 && set.add(s);
  if (IRREG[w]) add(IRREG[w]);
  // 复数 / 三单
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ves')) { add(w.slice(0, -3) + 'f'); add(w.slice(0, -3) + 'fe'); }
  if (w.endsWith('es')) add(w.slice(0, -2));
  if (w.endsWith('s')) add(w.slice(0, -1));
  // 过去式 / 分词 / 动名词
  if (w.endsWith('ied')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ed')) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (w.endsWith('ing')) { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); }
  if (/([bcdfghjklmnpqrstvwz])\1(ed|ing)$/.test(w)) add(w.replace(/([a-z])\1(ed|ing)$/, '$1'));
  // 比较级 / 最高级
  if (w.endsWith('iest')) add(w.slice(0, -4) + 'y');
  if (w.endsWith('ier')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('est')) add(w.slice(0, -3));
  if (w.endsWith('er')) add(w.slice(0, -2));
  // 副词
  if (w.endsWith('ally')) add(w.slice(0, -4));
  if (w.endsWith('ily')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ly')) add(w.slice(0, -2));
  // 名词 / 形容词派生
  if (w.endsWith('ity')) { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); }
  if (w.endsWith('ment')) add(w.slice(0, -4));
  if (w.endsWith('ness')) add(w.slice(0, -4));
  if (w.endsWith('ions')) add(w.slice(0, -4) + 'e');
  if (w.endsWith('tion')) { add(w.slice(0, -4) + 'te'); add(w.slice(0, -3) + 'e'); add(w.slice(0, -4)); }
  if (w.endsWith('sion')) { add(w.slice(0, -4) + 'd'); add(w.slice(0, -4) + 'de'); }
  if (w.endsWith('ance') || w.endsWith('ence')) { add(w.slice(0, -4) + 'e'); add(w.slice(0, -4)); }
  if (w.endsWith('ive')) { add(w.slice(0, -3) + 'e'); add(w.slice(0, -3)); }
  if (w.endsWith('ous')) { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); }
  if (w.endsWith('al')) { add(w.slice(0, -2)); add(w.slice(0, -2) + 'e'); }
  if (w.endsWith('ic')) { add(w.slice(0, -2)); add(w.slice(0, -2) + 'e'); }
  if (w.endsWith('able') || w.endsWith('ible')) { add(w.slice(0, -4)); add(w.slice(0, -4) + 'e'); }
  if (w.endsWith('ization') || w.endsWith('isation')) { add(w.slice(0, -7) + 'e'); add(w.slice(0, -7)); }
  if (w.endsWith('ize') || w.endsWith('ise')) { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); }
  const out = [...set];
  if (_candCache.size > 6000) _candCache.clear(); // 简单上限，防无限增长
  _candCache.set(w, out);
  return out;
}

// 由词库构建「小写词 → 词条」查找表。按 words 数组引用缓存(allReady 稳定)，避免每屏重复遍历 ~4500 词。
const _lookupCache = new WeakMap<Word[], Lookup>();
export function buildLookup(words: Word[]): Lookup {
  if (!words) return new Map();
  const cached = _lookupCache.get(words);
  if (cached) return cached;
  const m: Lookup = new Map();
  for (const w of words) {
    const k = w && w.word && w.word.toLowerCase();
    if (k && !m.has(k)) m.set(k, w);
  }
  _lookupCache.set(words, m);
  return m;
}

// 纯功能词：可点查但不作为「考研词」高亮/计数(否则广义词典会让整句全亮)
const STOP = new Set(
  ('a an the of to in on at for and or but nor so yet if as by with from into onto upon over under above below out off up down about i you he she we they me him her us them my your his their our its it this that these those am is are was were be been being do does did done have has had having will would shall should can could may might must not no never only also too very more most much many few some any all both each either neither such other others own same here there then than thus when where which while who whom whose why how what because before after again against between among through during without within across around')
    .split(/\s+/)
);
const isStop = (tok: string) => STOP.has(String(tok).toLowerCase().replace(/[^a-z'-]/g, ''));

// tok 先查考研核心词库，未命中再查广义词典(dict 为可选的 {词:{t,p,pos}})；功能词不计为词条
export function matchToken(tok: string, lookup: Lookup, dict?: DictData): Word | null {
  if (isStop(tok)) return null; // 功能词(the/of/we/and/to/which…)一律不作为考研词高亮/计数——即使它们恰好被收进了核心词库
  for (const c of candidates(tok)) {
    const hit = lookup.get(c);
    if (hit) return hit;
  }
  if (dict) {
    for (const c of candidates(tok)) {
      const e = dict[c];
      if (e) return { id: 'd:' + c, word: c, base_meaning: e.t, phonetic: e.p || '', pos: e.pos || '', _dict: true };
    }
  }
  return null;
}

// 把整段文本切成片段：{ t: 原文片段, w: 命中的词条或 null }
// 连字符视为分隔符(intellectual-property → 两个可匹配词)；保留所有空白/标点，拼回即原文。
export function annotate(text: string, lookup: Lookup, dict?: DictData): Seg[] {
  const out: Seg[] = [];
  const parts = String(text || '').split(/([A-Za-z]+(?:'[A-Za-z]+)*)/);
  for (const p of parts) {
    if (!p) continue;
    if (/^[A-Za-z]/.test(p)) out.push({ t: p, w: matchToken(p, lookup, dict) });
    else out.push({ t: p, w: null });
  }
  return out;
}

// 命中的不同考研词个数
export function countUnique(segs: Seg[]): number {
  return new Set((segs || []).filter((s) => s.w).map((s) => (s.w as Word).word)).size;
}
