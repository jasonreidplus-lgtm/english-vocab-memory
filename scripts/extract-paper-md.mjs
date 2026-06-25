/* 从 MinerU 导出的整卷 markdown 抽取「Section II Reading · Part A」的 Text 1-4 阅读原文，
   切句后写成 data-src/拆句_JSONL/{year}-Text{n}.jsonl(与既有 2010-2020 同构)。
   只取阅读 Text 1-4，不含完形/新题型/翻译/写作/答案解析。
   用法: node scripts/extract-paper-md.mjs <year> <整卷md路径> */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [, , yearArg, mdPath] = process.argv;
if (!yearArg || !mdPath) {
  console.error('用法: node scripts/extract-paper-md.mjs <year> <整卷md路径>');
  process.exit(1);
}
const year = Number(yearArg);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data-src', '拆句_JSONL');

const lines = readFileSync(mdPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/);

// 取每个 "# Text N" 首次出现(阅读原文区)；答案解析区若重复出现则忽略
const starts = [];
const seen = new Set();
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^#\s*Text\s*([1-4])\b/i);
  if (!m) continue;
  const n = Number(m[1]);
  if (seen.has(n)) break; // 编号重复 = 进入解析区，停
  seen.add(n);
  starts.push({ n, line: i });
  if (starts.length === 4) break;
}
if (starts.length < 4) console.warn(`⚠ 只定位到 ${starts.length} 个 Text，请核对 md 结构`);

// 阅读区结束行(下一个 Section / Part B / 参考答案)
let stopLine = lines.length;
const lastText = starts.length ? starts[starts.length - 1].line : 0;
for (let i = lastText + 1; i < lines.length; i++) {
  if (/^#\s*Part\s*B\b/i.test(lines[i]) || /^#\s*Section\s+III/i.test(lines[i]) || /参考答案|答案及解析/.test(lines[i])) {
    stopLine = i;
    break;
  }
}

// $..$ 内的 LaTeX → 纯文本(\mathrm{B+}→B+，去命令/花括号/上下标/空格)
const mathToText = (x) =>
  x
    .replace(/\\%/g, '%')
    .replace(/\\(?:mathrm|mathbf|mathit|mathsf|text|textbf|textit|operatorname|rm|bf|it)\s*\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}^_]/g, '')
    .replace(/\s+/g, '');

const cleanLine = (s) =>
  s
    .replace(/!\[\]\([^)]*\)/g, ' ') // 图片
    .replace(/\$\s*([^$]*?)\s*\$/g, (_, x) => mathToText(x)) // $..$ 数学/LaTeX
    .replace(/\\%/g, '%')
    .replace(/\.{3,}/g, '…') // 省略号统一，避免被当句末
    .replace(/([A-Za-z,.;:])(“)/g, '$1 $2') // 开引号前补空格(OCR 粘连)
    .replace(/(”)([A-Za-z])/g, '$1 $2') // 闭引号后补空格
    .replace(/[“”„″]/g, '"')
    .replace(/[‘’‛′]/g, "'")
    .replace(/([,;])(?=[A-Za-z])/g, '$1 ') // 逗号/分号后补空格(数字不动)
    .replace(/\s+/g, ' ')
    .trim();

function extractPassage(startLine, endLine) {
  const buf = [];
  for (let i = startLine + 1; i < endLine; i++) {
    const ln = lines[i];
    if (/^#\s/.test(ln)) break; // 下一标题
    if (/^\s*\d{1,2}[.．]/.test(ln)) break; // 第一道题(21./26./...，含 "21.According" 无空格)
    if (/^\s*\[[A-D]\]/.test(ln)) break; // 选项
    const c = cleanLine(ln);
    if (c) buf.push(c);
  }
  return buf.join(' ').replace(/\s+/g, ' ').trim();
}

// —— 切句(带常见缩写保护，避免 U.S. / Mr. 误切) ——
const ABBR = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'St', 'vs', 'etc', 'Inc', 'Ltd', 'Co', 'No', 'Vol', 'U.S', 'U.K', 'U.N', 'e.g', 'i.e', 'a.m', 'p.m'];
function splitSentences(text) {
  let t = ` ${text} `;
  ABBR.forEach((a, k) => {
    t = t.replace(new RegExp(`\\b${a.replace(/\./g, '\\.')}\\.`, 'g'), `${a}<D${k}>`);
  });
  t = t.replace(/\b([A-Z])\.(?=\s[A-Z])/g, '$1<DI>'); // 单字母首字母缩写 J. K.
  const parts = t.match(/[^.!?]+[.!?]+["']*(?=\s|$)/g) || [t];
  return parts
    .map((s) =>
      s
        .replace(/<D(\d+)>/g, (_, k) => `${ABBR[Number(k)]}.`)
        .replace(/<DI>/g, '.')
        .replace(/^["']\s+/, '') // 去行首游离引号
        .replace(/\s+([,.;:!?])/g, '$1') // 去标点前空格
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((s) => s.replace(/[^a-z]/gi, '').length >= 15);
}

mkdirSync(OUT_DIR, { recursive: true });
let grand = 0;
const parts = [];
starts.forEach((t, idx) => {
  const end = idx + 1 < starts.length ? starts[idx + 1].line : stopLine;
  const sents = splitSentences(extractPassage(t.line, end));
  const recs = sents.map((en, i) => ({ id: `${year}-T${t.n}-P1-S${i + 1}`, year, text: t.n, paragraph: 1, sentence: i + 1, en }));
  writeFileSync(path.join(OUT_DIR, `${year}-Text${t.n}.jsonl`), recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
  grand += recs.length;
  parts.push(`Text${t.n}:${recs.length}`);
});
console.log(`${year} → ${parts.join(' / ')}  共 ${grand} 句`);
