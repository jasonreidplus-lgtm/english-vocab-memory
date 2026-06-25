/* 广义词典(public/data/dict.json，由 scripts/build-dict.mjs 生成)运行期加载。
   仅在阅读类页面/查词/错词本解析时按需加载一次，模块级缓存；与考研核心词库合并使用。
   形态：{ "<小写词>": { t:中文释义, p?:音标, pos?:词性 } } */
import type { Word, Lookup, DictData } from '../types';
import { candidates } from './annotate';
let _dict: DictData | null = null; // 已加载的原始对象
let _loading: Promise<DictData> | null = null; // 进行中的 Promise

export function loadDict(): Promise<DictData> {
  if (_dict) return Promise.resolve(_dict);
  if (_loading) return _loading;
  _loading = fetch(`${import.meta.env.BASE_URL}data/dict.json`)
    .then((r) => (r.ok ? (r.json() as Promise<DictData>) : ({} as DictData)))
    .then((d): DictData => {
      _dict = d && typeof d === 'object' ? d : {};
      return _dict;
    })
    .catch((): DictData => {
      _dict = {};
      return _dict;
    });
  return _loading;
}

// 已加载的词典(未加载则 null)
export function dictData(): DictData | null {
  return _dict;
}

// 词典是否正在加载(点词时显示「词典加载中」而非误判「未收录」)
export const isDictLoading = (): boolean => !!_loading && !_dict;

// 把词典命中包装成与考研词条同构的对象(供 annotate/WordPopup/错词本复用)
export function dictEntry(word: string): Word | null {
  const w = String(word || '').toLowerCase();
  const e = _dict && _dict[w];
  if (!e) return null;
  return { id: 'd:' + w, word: w, base_meaning: e.t, phonetic: e.p || '', pos: e.pos || '', _dict: true };
}

// 点任意词时解析：先考研核心库、再广义词典(含词形还原)，都没有则返回「未收录」占位
export function resolveTap(raw: string, lookup: Lookup): Word {
  for (const c of candidates(raw)) {
    const hit = lookup && lookup.get(c);
    if (hit) return hit;
  }
  for (const c of candidates(raw)) {
    const e = dictEntry(c);
    if (e) return e;
  }
  const w = String(raw || '').toLowerCase();
  return { id: 'x:' + w, word: w, base_meaning: '（词典未收录该词）', _dict: true, _missing: true };
}
