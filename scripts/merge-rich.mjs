/* 把 data-src/rich-done/*.json 的富字段并入 vocab.json(按 id，仅新词 id>4533)。
   完事再跑 node scripts/split-vocab.cjs 重生成分组文件。 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VOCAB = path.join(ROOT, 'public', 'data', 'vocab.json');
const DONE = path.join(ROOT, 'data-src', 'rich-done');

const records = JSON.parse(readFileSync(VOCAB, 'utf8'));
const rich = {};
let files = 0;
for (const f of readdirSync(DONE).filter((f) => f.endsWith('.json'))) {
  Object.assign(rich, JSON.parse(readFileSync(path.join(DONE, f), 'utf8')));
  files++;
}

let updated = 0;
const missing = [];
let withExample = 0;
for (const r of records) {
  if (r.id <= 4533) continue;
  const e = rich[r.id] || rich[String(r.id)];
  if (!e) { missing.push(r.id); continue; }
  r.roots = e.roots || '';
  r.examples = Array.isArray(e.examples) ? e.examples : [];
  r.confusions = e.confusions || '';
  r.exam_tip = e.exam_tip || '';
  r.mnemonic = e.mnemonic || '';
  if (r.examples.length) withExample++;
  updated++;
}

writeFileSync(VOCAB, JSON.stringify(records));
console.log(`合并 ${files} 块 → 更新 ${updated} 词(含例句 ${withExample})；缺失 ${missing.length}${missing.length ? ': ' + missing.slice(0, 12).join(',') : ''}`);
const s = records.find((r) => r.id === 4534);
if (s) console.log('样例 4534:', JSON.stringify({ word: s.word, examples: s.examples, exam_tip: s.exam_tip, confusions: s.confusions }).slice(0, 240));
