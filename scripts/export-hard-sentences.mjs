/* 从 data-src/拆句_JSONL/*.jsonl 里，按"句长 + 从属/关系词 + 标点复杂度"给每篇真题挑出
   最难的 N 句，产出 data-src/_hard-sentences.json（{ "<篇id>": [{id,en,words,score}] }）。
   作为"长难句拆解"的作者侧待办清单：按其中每个句子 id，去 data-src/analyses/ 写分析。
   用法：node scripts/export-hard-sentences.mjs [每篇句数N=3] [最少词数=24] */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'data-src', '拆句_JSONL');
const OUT = path.join(ROOT, 'data-src', '_hard-sentences.json');

const N = Number(process.argv[2]) || 3; // 每篇挑几句
const MIN_WORDS = Number(process.argv[3]) || 24; // 低于此词数不算长难句

// 从属连词 / 关系词 / 高频复杂结构标志：每个 +3 分
const SUBORD =
  /\b(which|that|who|whom|whose|where|when|why|because|although|though|whereas|while|unless|since|whether|if|before|after|so that|in order|however|moreover|furthermore|despite|rather than|not only|no more|as if|even if|provided)\b/gi;

function score(en) {
  const words = (en.trim().match(/\S+/g) || []).length;
  const sub = (en.match(SUBORD) || []).length;
  const commas = (en.match(/,/g) || []).length;
  const heavy = (en.match(/[;:—]|--/g) || []).length; // 分号/冒号/破折号：强分隔信号
  return { words, score: words + sub * 3 + commas * 2 + heavy * 5 };
}

const byPassage = new Map(); // "ky-YYYY-tN" -> [{id,en,words,score}]
for (const f of readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.jsonl'))) {
  const raw = readFileSync(path.join(SRC_DIR, f), 'utf8').replace(/^﻿/, '');
  for (const ln of raw.split(/\r?\n/)) {
    const s = ln.trim();
    if (!s) continue;
    let r;
    try {
      r = JSON.parse(s);
    } catch {
      continue;
    }
    if (!r || typeof r.en !== 'string' || !r.en.trim()) continue;
    const key = `ky-${Number(r.year)}-t${Number(r.text)}`;
    if (!byPassage.has(key)) byPassage.set(key, []);
    byPassage.get(key).push({ id: r.id, en: r.en.trim(), ...score(r.en) });
  }
}

const out = {};
let picked = 0;
for (const [key, sents] of [...byPassage.entries()].sort()) {
  const hard = sents
    .filter((s) => s.words >= MIN_WORDS)
    .sort((a, b) => b.score - a.score)
    .slice(0, N)
    .map(({ id, en, words, score }) => ({ id, en, words, score }));
  if (hard.length) {
    out[key] = hard;
    picked += hard.length;
  }
}

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`挑出 ${picked} 句（每篇≤${N}，≥${MIN_WORDS} 词）/ 共 ${byPassage.size} 篇 → ${path.relative(ROOT, OUT)}`);
