/* 预计算真题库词频 → public/data/freq.json（{词目: 次数}）。
   依据 44 篇真题(passages.json)，用考研核心词库(vocab.json)+广义词典(dict.json)做词形还原合并。
   运行期(阅读/闯关)直接查表，免去逐句标注与加载大词典。
   数据(vocab/passages/dict)变更后重跑：node scripts/build-freq.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { annotate, buildLookup, candidates } from '../src/lib/annotate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

const vocab = rd('public/data/vocab.json');
const ready = vocab.filter((w) => w && w.status === 'done' && w.word);
const lookup = buildLookup(ready);
let dict = {};
try { dict = rd('public/data/dict.json'); } catch { /* 无词典则仅核心词 */ }
const passages = rd('public/data/passages.json');

// 与 src/lib/freq.js 的 lemmaKey 同逻辑：优先核心词原型，其次词典最短候选
function lemmaKey(token) {
  const cs = candidates(token);
  for (const c of cs) {
    const hit = lookup.get(c);
    if (hit) return String(hit.word || c).toLowerCase();
  }
  let best = null;
  for (const c of cs) if (dict[c] && (best === null || c.length < best.length)) best = c;
  return best || null;
}

const m = {};
let hits = 0;
for (const p of passages) {
  for (const s of p.sents || []) {
    for (const seg of annotate(s.en, lookup, dict)) {
      if (!seg.w) continue; // 只统计高亮词(功能词已排除)
      const k = lemmaKey(seg.t);
      if (k) { m[k] = (m[k] || 0) + 1; hits++; }
    }
  }
}

const json = JSON.stringify(m);
writeFileSync(path.join(ROOT, 'public', 'data', 'freq.json'), json);
console.log(`freq.json: ${Object.keys(m).length} 词目 / ${hits} 次命中 / ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
