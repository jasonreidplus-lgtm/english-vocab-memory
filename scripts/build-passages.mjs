/* 把 data-src/拆句_JSONL/*.jsonl(真题逐句拆分语料) 合并成 public/data/passages.json。
   - 每个 YYYY-TextN 文件 → 一篇「真题阅读·闯关」关卡：{ id, title, year, text, sents:[{en,cn?}] }
   - 句子按 paragraph、sentence 升序；篇目按 year、text 升序。
   - 弯引号(""'')规范化为直引号，改善点词匹配与显示。
   - 译文：从 data-src/translations/*.json({ "<句子id>": "<中文译文>" }) 按 id 并入 cn。
   - 拆解：从 data-src/analyses/*.json({ "<句子id>": { trunk, structure?, logic?, notes? } }) 按 id 并入 analysis。
   - 该 passages.json 同时被「句子精读·句库」复用(flatten 取 sents)。
   覆盖/新增 data-src/拆句_JSONL/*.jsonl 或 data-src/translations/*.json 后，
   重跑 `node scripts/build-passages.mjs` 即可。 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'data-src', '拆句_JSONL');
const TRANS_DIR = path.join(ROOT, 'data-src', 'translations');
const ANALYSES_DIR = path.join(ROOT, 'data-src', 'analyses');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const OUT = path.join(OUT_DIR, 'passages.json');

// 弯引号 → 直引号(annotate 的分词正则只认直引号/连字符)
const normalizeQuotes = (s) =>
  String(s)
    .replace(/[“”„″]/g, '"')
    .replace(/[‘’‛′]/g, "'");

const files = readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.jsonl'));
if (!files.length) {
  console.error(`没有找到 .jsonl：${SRC_DIR}`);
  process.exit(1);
}

// 合并独立译文源(data-src/translations/*.json：{ "<句子id>": "<中文译文>" })
const trans = {};
try {
  for (const f of readdirSync(TRANS_DIR).filter((f) => f.toLowerCase().endsWith('.json'))) {
    Object.assign(trans, JSON.parse(readFileSync(path.join(TRANS_DIR, f), 'utf8')));
  }
} catch {
  /* 无 translations 目录则全部英文 */
}

// 合并长难句拆解(data-src/analyses/*.json：{ "<句子id>": { trunk, structure?, logic?, notes? } })
const analyses = {};
try {
  for (const f of readdirSync(ANALYSES_DIR).filter((f) => f.toLowerCase().endsWith('.json'))) {
    Object.assign(analyses, JSON.parse(readFileSync(path.join(ANALYSES_DIR, f), 'utf8')));
  }
} catch {
  /* 无 analyses 目录则无拆解 */
}

const groups = new Map(); // "year-text" -> { year, text, records:[] }
let lineCount = 0;
let badLines = 0;

for (const file of files) {
  const raw = readFileSync(path.join(SRC_DIR, file), 'utf8').replace(/^﻿/, '');
  const lines = raw.split(/\r?\n/);
  lines.forEach((ln, i) => {
    const s = ln.trim();
    if (!s) return;
    lineCount++;
    let rec;
    try {
      rec = JSON.parse(s);
    } catch (e) {
      badLines++;
      console.warn(`  ⚠ JSON 解析失败 ${file}:${i + 1} → ${e.message}`);
      return;
    }
    if (!rec || typeof rec.en !== 'string' || !rec.en.trim()) {
      badLines++;
      console.warn(`  ⚠ 缺少 en 字段 ${file}:${i + 1}`);
      return;
    }
    const year = Number(rec.year);
    const text = Number(rec.text);
    const key = `${year}-${text}`;
    if (!groups.has(key)) groups.set(key, { year, text, records: [] });
    groups.get(key).records.push({
      id: rec.id,
      paragraph: Number(rec.paragraph) || 0,
      sentence: Number(rec.sentence) || 0,
      en: normalizeQuotes(rec.en).trim(),
    });
  });
}

const passages = [...groups.values()]
  .sort((a, b) => a.year - b.year || a.text - b.text)
  .map(({ year, text, records }) => {
    records.sort((a, b) => a.paragraph - b.paragraph || a.sentence - b.sentence);
    return {
      id: `ky-${year}-t${text}`,
      title: `${year} 真题 Text ${text}`,
      year,
      text,
      sents: records.map((r) => {
        const out = { en: r.en };
        if (trans[r.id]) out.cn = trans[r.id];
        if (analyses[r.id]) out.analysis = analyses[r.id];
        return out;
      }),
    };
  });

const sentTotal = passages.reduce((n, p) => n + p.sents.length, 0);
const cnTotal = passages.reduce((n, p) => n + p.sents.filter((s) => s.cn).length, 0);
const anaTotal = passages.reduce((n, p) => n + p.sents.filter((s) => s.analysis).length, 0);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(passages));

console.log(
  `passages.json：${passages.length} 篇 / ${sentTotal} 句 / ${cnTotal} 句有译文 / ${anaTotal} 句有拆解` +
    `（读取 ${files.length} 文件 / ${lineCount} 行${badLines ? `，跳过 ${badLines} 行异常` : ''}）`
);
console.log(`→ ${path.relative(ROOT, OUT)}`);
