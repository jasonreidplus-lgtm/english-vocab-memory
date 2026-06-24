/* 广义词典(public/data/dict.json，由 scripts/build-dict.mjs 生成)运行期加载。
   仅在阅读类页面/查词/错词本解析时按需加载一次，模块级缓存；与考研核心词库合并使用。
   形态：{ "<小写词>": { t:中文释义, p?:音标, pos?:词性 } } */
import { candidates } from './annotate.js';
let _dict = null; // 已加载的原始对象
let _loading = null; // 进行中的 Promise

export function loadDict() {
  if (_dict) return Promise.resolve(_dict);
  if (_loading) return _loading;
  _loading = fetch(`${import.meta.env.BASE_URL}data/dict.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((d) => {
      _dict = d && typeof d === 'object' ? d : {};
      return _dict;
    })
    .catch(() => {
      _dict = {};
      return _dict;
    });
  return _loading;
}

// 已加载的词典(未加载则 null)
export function dictData() {
  return _dict;
}

// 把词典命中包装成与考研词条同构的对象(供 annotate/WordPopup/错词本复用)
export function dictEntry(word) {
  const w = String(word || '').toLowerCase();
  const e = _dict && _dict[w];
  if (!e) return null;
  return { id: 'd:' + w, word: w, base_meaning: e.t, phonetic: e.p || '', pos: e.pos || '', _dict: true };
}

// 点任意词时解析：先考研核心库、再广义词典(含词形还原)，都没有则返回「未收录」占位
export function resolveTap(raw, lookup) {
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
