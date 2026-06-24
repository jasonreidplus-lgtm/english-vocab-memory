/* 由 ECDICT(data-src/_ecdict.csv, MIT) 生成精简广义词典 public/data/dict.json。
   收录规则：有中文释义，且(① 带考试/词频标签或在词频表内 ② 或出现在内置真题里)。
   产物：{ "<小写词>": { t:中文释义, p:音标, pos:词性 } }，供阅读页高亮+点查、错词本、查词复用。
   先 `npm run fetch:dict`(或手动下载) 拿到 _ecdict.csv，再 `node scripts/build-dict.mjs`。 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { candidates } from '../src/lib/annotate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data-src', '_ecdict.csv');
const OUT = path.join(ROOT, 'public', 'data', 'dict.json');

if (!existsSync(SRC)) {
  console.error(`缺少 ${path.relative(ROOT, SRC)}。先下载 ECDICT：\n  Invoke-WebRequest https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv -OutFile data-src/_ecdict.csv`);
  process.exit(1);
}

// —— 收集内置真题里出现的词(及其词形还原候选)，强制收录，确保真题全覆盖 ——
const passages = JSON.parse(readFileSync(path.join(ROOT, 'public', 'data', 'passages.json'), 'utf8'));
const forceWords = new Set();
for (const p of passages) {
  for (const s of p.sents || []) {
    for (const m of String(s.en).match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || []) {
      const lw = m.toLowerCase();
      forceWords.add(lw);
      for (const c of candidates(lw)) forceWords.add(c);
      for (const part of lw.split('-')) if (part) forceWords.add(part); // 连字符各段
    }
  }
}

// —— 逐行解析 CSV(处理引号内逗号/换行/转义)，每行回调，避免整表驻留内存 ——
const text = readFileSync(SRC, 'utf8');
function forEachRow(t, cb) {
  let row = [], field = '', inQ = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); cb(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); cb(row); }
}

const cleanT = (s) =>
  String(s || '').replace(/\\n/g, '；').replace(/\s*\n\s*/g, '；').replace(/\s+/g, ' ').trim().slice(0, 64);

let header = null;
let col = {};
let scanned = 0;
const dict = {};

forEachRow(text, (row) => {
  if (!header) {
    header = row.map((h) => h.trim().toLowerCase());
    col = Object.fromEntries(header.map((h, i) => [h, i]));
    return;
  }
  scanned++;
  const word = (row[col.word] || '').trim();
  if (!word || !/^[A-Za-z][A-Za-z'-]*$/.test(word)) return; // 只要纯英文词(去掉词组/带空格条目)
  const translation = cleanT(row[col.translation]);
  if (!translation) return;
  const lw = word.toLowerCase();
  if (dict[lw]) return; // 同词取首条(ECDICT 已按主形在前)

  const tag = (row[col.tag] || '').trim();
  const bnc = parseInt(row[col.bnc] || '0', 10) || 0;
  const frq = parseInt(row[col.frq] || '0', 10) || 0;
  const keep = tag || bnc > 0 || frq > 0 || forceWords.has(lw);
  if (!keep) return;

  const entry = { t: translation };
  const p = (row[col.phonetic] || '').trim();
  if (p) entry.p = p;
  const pos = (row[col.pos] || '').trim().replace(/\s+/g, '');
  if (pos) entry.pos = pos;
  dict[lw] = entry;
});

const json = JSON.stringify(dict);
writeFileSync(OUT, json);
console.log(`扫描 ${scanned} 条 → 收录 ${Object.keys(dict).length} 词`);
console.log(`dict.json: ${(Buffer.byteLength(json) / 1024 / 1024).toFixed(2)} MB → ${path.relative(ROOT, OUT)}`);
console.log(`(真题强制收录候选 ${forceWords.size} 个)`);
