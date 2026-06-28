/* 补全词义(#11)：
   1) 释义被截断(结尾「…」，源于早期扩充 48 字上限)的词 → 用 dict.json(ECDICT 完整释义)回填
   2) 缺词性(pos)的词 → 从释义里的词性前缀(n./vt./a. …)推断补上
   只动这两类，其余词不碰。改完 vocab.json 后会提示跑 split-vocab 重建索引/分组。
   用法：node scripts/complete-meanings.mjs */
import fs from 'fs';

const VOCAB = 'public/data/vocab.json';
const vocab = JSON.parse(fs.readFileSync(VOCAB, 'utf8'));
const dict = JSON.parse(fs.readFileSync('public/data/dict.json', 'utf8'));

const POSMAP = {
  'n.': 'n.', 'pl.': 'n.', 'vt.': 'v.', 'vi.': 'v.', 'v.': 'v.', 'aux.': 'aux.',
  'a.': 'adj.', 'adj.': 'adj.', 'ad.': 'adv.', 'adv.': 'adv.', 'prep.': 'prep.',
  'conj.': 'conj.', 'pron.': 'pron.', 'int.': 'int.', 'interj.': 'int.', 'intj.': 'int.',
  'num.': 'num.', 'art.': 'art.',
};

// 去重义项：同一词里完全相同的「；」义项段 / 段内「，」义项只保留首次出现(只删完全相同项，安全)
function dedupeMeaning(bm) {
  const groups = String(bm || '').split('；').map((s) => s.trim()).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (let g of groups) {
    const parts = g.split('，').map((s) => s.trim()).filter(Boolean);
    g = [...new Set(parts)].join('，');
    if (g && !seen.has(g)) { seen.add(g); out.push(g); }
  }
  return out.join('；');
}

// 从含词性前缀的文本(n. …；vt. …)提取规范化词性，去重保序，用 / 连接
function posFrom(text) {
  const found = [];
  for (const m of String(text || '').matchAll(/(?:^|[；;])\s*([a-zA-Z]+\.)/g)) {
    const mapped = POSMAP[m[1].toLowerCase()];
    if (mapped && !found.includes(mapped)) found.push(mapped);
  }
  return found.join('/');
}

// 清洗 ECDICT 释义：去 \r、去 [医][计] 之类学科标签、英文逗号/分号转中文、收尾整理
function cleanMeaning(t) {
  return String(t || '')
    .replace(/[\r\n]/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s*,\s*/g, '，')
    .replace(/\s*;\s*/g, '；')
    .replace(/；\s+/g, '；')
    .replace(/，+/g, '，')
    .replace(/；+/g, '；')
    .replace(/，；/g, '；')
    .replace(/^[，；\s]+|[，；\s]+$/g, '')
    .trim();
}

let fixedMeaning = 0, fixedPos = 0, missDict = 0;
const samples = [];
for (const w of vocab) {
  const bm = (w.base_meaning || '').trim();
  const truncated = /…$/.test(bm) || /\.\.\.$/.test(bm);
  if (truncated) {
    const e = dict[String(w.word).toLowerCase()];
    const full = e ? cleanMeaning(e.t) : '';
    if (full && full.length >= bm.length - 1) {
      if (samples.length < 8) samples.push(`${w.word}\n  旧: ${bm}\n  新: ${full}`);
      w.base_meaning = full;
      fixedMeaning++;
      if (!w.pos) { const p = posFrom(e.t); if (p) { w.pos = p; fixedPos++; } }
    } else {
      missDict++;
    }
  }
  if (!w.pos) {
    const p = posFrom(w.base_meaning) || posFrom((dict[String(w.word).toLowerCase()] || {}).t);
    if (p) { w.pos = p; fixedPos++; }
  }
}

// 去重义项段(对全部词)
let dedup = 0;
const dedupSamples = [];
for (const w of vocab) {
  const before = w.base_meaning;
  const after = dedupeMeaning(before);
  if (after && after !== before) {
    if (dedupSamples.length < 6) dedupSamples.push(`${w.word}\n  旧: ${before}\n  新: ${after}`);
    w.base_meaning = after;
    dedup++;
  }
}

fs.writeFileSync(VOCAB, JSON.stringify(vocab));
console.log(`补全释义(截断回填): ${fixedMeaning} 词 | 补词性: ${fixedPos} 词 | 截断但 dict 无对应: ${missDict} 词 | 去重义项: ${dedup} 词`);
console.log('\n回填样例:\n' + samples.join('\n\n'));
console.log('\n去重样例:\n' + dedupSamples.join('\n\n'));
console.log('\n已写回 vocab.json。请接着跑: node scripts/split-vocab.cjs');
