/* ============================================================
   真题阅读「关卡库」数据层。三个来源合并(新→旧)：
   1) 用户自己导入的文章(本机 localStorage，不上传)；
   2) 内置真题：public/data/passages.json —— 由 scripts/build-passages.mjs
      从 data-src/拆句_JSONL 生成(2010-2020 共 44 篇)，标 demo 不可删；
   3) 2 篇自写示例文章(对标真题难度，带逐句翻译)。
   版权：内置真题原文仅供本人备考自用，请勿公开分发。
   ============================================================ */

const KEY = 'wordquest:passages';

// —— 自写示例文章(原创，非真题，带逐句翻译) ——
const DEMO = [
  {
    id: 'demo-automation',
    title: '示例 · 自动化与就业',
    demo: true,
    sents: [
      { en: 'The rapid advance of automation has rekindled an old anxiety: that machines will eventually render human labor obsolete.', cn: '自动化的迅猛发展重新点燃了一种古老的忧虑——机器终将使人类劳动变得多余。' },
      { en: 'Optimists counter that every technological revolution has ultimately created more jobs than it destroyed.', cn: '乐观者反驳说，每一次技术革命最终创造的岗位都多于它所摧毁的。' },
      { en: 'Yet critics caution that this time the transition may prove far more abrupt and unevenly distributed.', cn: '然而批评者告诫说，这一次的转变可能要剧烈得多，而且分布极不均衡。' },
      { en: 'Whether society can adapt will depend less on the technology itself than on the policies that govern it.', cn: '社会能否适应，与其说取决于技术本身，不如说取决于规制它的政策。' },
    ],
  },
  {
    id: 'demo-education',
    title: '示例 · 教育与机会',
    demo: true,
    sents: [
      { en: 'Access to quality education has long been regarded as the most reliable ladder of social mobility.', cn: '获得优质教育长期以来被视为社会流动最可靠的阶梯。' },
      { en: 'In practice, however, the children of affluent families enjoy advantages that are difficult to offset.', cn: '然而在现实中，富裕家庭的孩子享有难以抵消的优势。' },
      { en: 'Reformers contend that genuine equality requires far more than merely opening the doors of elite institutions.', cn: '改革者主张，真正的平等所需的，远不止是敞开精英院校的大门。' },
      { en: 'Unless the underlying disparities are addressed, the promise of meritocracy will remain largely illusory.', cn: '若不解决根本性的差距，精英择优的承诺将在很大程度上沦为幻象。' },
    ],
  },
];

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}
function write(o) {
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* 本机存储不可用则静默 */
  }
}

// 把英文段落粗切成句子
export function splitEn(text) {
  return (String(text || '').match(/[^.!?]+[.!?]+(?=\s|$)/g) || [])
    .map((s) => s.trim())
    .filter((s) => s.replace(/[^a-z]/gi, '').length >= 15);
}
function splitCn(text) {
  return (String(text || '').match(/[^。！？]+[。！？]+/g) || []).map((s) => s.trim());
}
// 由 en(+可选 cn) 生成逐句 { en, cn? }；中英句数一致才逐句配翻译
function makeSents(en, cn) {
  const enS = splitEn(en);
  const cnS = cn ? splitCn(cn) : [];
  const aligned = cnS.length === enS.length;
  return enS.map((e, i) => ({ en: e, cn: aligned ? cnS[i] : undefined }));
}

// —— 内置真题关卡(由 scripts/build-passages.mjs 生成 → public/data/passages.json) ——
//    与 vocab.json / sentences.json 同样从 public/data 取，仅取一次并缓存。
let _builtin = null;
async function fetchBuiltin() {
  if (_builtin) return _builtin;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/passages.json`, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    _builtin = Array.isArray(data) ? data : [];
    return _builtin;
  } catch {
    return []; // 不缓存失败，下次(如导入后刷新)仍可重试
  }
}

// 读取全部关卡：用户导入(新→旧) + 内置真题 + 自写示例；附 studied 标记
export async function loadPassages() {
  const { imported = [], studied = {} } = read();
  const builtin = await fetchBuiltin();
  const userP = imported.map((p) => ({
    id: p.id,
    title: p.title,
    sents: makeSents(p.en, p.cn),
    studied: !!studied[p.id],
  }));
  // 内置真题标 demo:true → 不可误删，复用现有「内置篇目」逻辑
  const builtinP = builtin.map((p) => ({
    id: p.id,
    title: p.title,
    sents: p.sents,
    demo: true,
    studied: !!studied[p.id],
  }));
  const demoP = DEMO.map((p) => ({ ...p, studied: !!studied[p.id] }));
  return [...userP, ...builtinP, ...demoP];
}

export function addPassage(title, en, cn) {
  const o = read();
  o.imported = o.imported || [];
  const id = 'u' + Date.now();
  o.imported.unshift({ id, title: (title || '').trim() || '未命名真题', en: String(en || ''), cn: String(cn || '') });
  write(o);
  return id;
}

// 批量解析：用「# 标题」(或 ===标题===、2020 Text 1 这种行)分隔多篇文章。
// 文章内部的空行会保留(段落不被拆开)；没有任何标题行时整体当作一篇。
export function parseBulk(text) {
  const t = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!t) return [];
  const lines = t.split('\n');
  const isHeader = (ln) =>
    /^\s*#/.test(ln) ||
    /^\s*={2,}/.test(ln) ||
    /^\s*【.+】\s*$/.test(ln) ||
    /^\s*(?:19|20)\d{2}.{0,8}(?:text|阅读|passage)\s*\d/i.test(ln);
  const clean = (ln) => ln.replace(/^[\s#=【]+|[\s=】]+$/g, '').trim();
  const heads = [];
  lines.forEach((ln, i) => isHeader(ln) && heads.push(i));
  if (!heads.length) return [{ title: '导入真题', en: t }];
  const out = [];
  for (let h = 0; h < heads.length; h++) {
    const start = heads[h];
    const end = h + 1 < heads.length ? heads[h + 1] : lines.length;
    const title = clean(lines[start]) || `导入 ${h + 1}`;
    const en = lines.slice(start + 1, end).join('\n').trim();
    if (en.replace(/[^a-z]/gi, '').length >= 30) out.push({ title, en });
  }
  return out;
}

export function addPassagesBulk(items) {
  const o = read();
  o.imported = o.imported || [];
  let n = 0;
  for (const it of items || []) {
    o.imported.unshift({
      id: 'u' + Date.now() + '-' + n,
      title: (it.title || '').trim() || '未命名真题',
      en: String(it.en || ''),
      cn: String(it.cn || ''),
    });
    n++;
  }
  write(o);
  return n;
}

export function removePassage(id) {
  const o = read();
  o.imported = (o.imported || []).filter((p) => p.id !== id);
  if (o.studied) delete o.studied[id];
  write(o);
}

export function markStudied(id) {
  const o = read();
  o.studied = o.studied || {};
  o.studied[id] = true;
  write(o);
}
