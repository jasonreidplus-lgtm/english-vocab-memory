/* 从已逐句校订的 JSONL 生成便于阅读的 Markdown，并同步到应用数据源。
   此脚本只处理 06_阅读加工 与项目 data-src/英语二，不触碰英语一数据。 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY = path.resolve(HERE, '..');
const WORKSPACE = path.resolve(LIBRARY, '..');
const READING = path.join(LIBRARY, '06_阅读加工');
const SRC = path.join(READING, '拆句_JSONL');
const TRANS = path.join(READING, 'translations');
const ANALYSES = path.join(READING, 'analyses');
const ARTICLES = path.join(READING, '阅读文章');
const HAND = path.join(READING, '手译版_Markdown');
const MARKDOWN = path.join(READING, '拆句_Markdown');
const LONG = path.join(READING, '长难句_Markdown');
const APP_ROOT = path.join(WORKSPACE, 'data-src', '英语二');

const files = readdirSync(SRC)
  .filter((name) => /^20\d{2}-Text[1-4]\.jsonl$/.test(name))
  .sort();

if (files.length !== 68) {
  throw new Error(`应有 2010—2026 共 68 篇，实际找到 ${files.length} 篇`);
}

for (const dir of [ARTICLES, HAND, MARKDOWN, LONG, APP_ROOT]) mkdirSync(dir, { recursive: true });
for (const child of ['拆句_JSONL', 'translations', 'analyses']) {
  mkdirSync(path.join(APP_ROOT, child), { recursive: true });
}

let sentenceTotal = 0;
let analysisTotal = 0;

for (const file of files) {
  const base = file.replace(/\.jsonl$/, '');
  const records = readFileSync(path.join(SRC, file), 'utf8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const translationPath = path.join(TRANS, `${base}.json`);
  const analysisPath = path.join(ANALYSES, `${base}.json`);
  if (!existsSync(translationPath) || !existsSync(analysisPath)) {
    throw new Error(`${base} 缺少翻译或长难句分析`);
  }
  const translations = JSON.parse(readFileSync(translationPath, 'utf8').replace(/^﻿/, ''));
  const analyses = JSON.parse(readFileSync(analysisPath, 'utf8').replace(/^﻿/, ''));
  if (records.some((record) => !translations[record.id])) throw new Error(`${base} 存在缺失译文`);
  if (Object.keys(analyses).length !== 3) throw new Error(`${base} 长难句分析不是 3 条`);

  const { year, text } = records[0];
  const article = [
    `# ${year} 年考研英语二阅读 Text ${text}`,
    '',
    records.map((record) => record.en).join(' '),
    '',
    '> 来源：对应年份考研英语二真题 PDF；仅供个人学习与研究。',
    '',
  ].join('\n');
  writeFileSync(path.join(ARTICLES, `${base}.md`), article, 'utf8');

  const hand = [`# ${year} 年考研英语二阅读 Text ${text} · 逐句手译`, ''];
  records.forEach((record, index) => {
    hand.push(`## ${index + 1}`, '', record.en, '', `**译文：** ${translations[record.id]}`, '');
  });
  hand.push('> 译文为个人学习整理，不冒充考试机构标准答案。', '');
  writeFileSync(path.join(HAND, `${base}.md`), `${hand.join('\n')}\n`, 'utf8');

  const split = [`# ${year} 年考研英语二阅读 Text ${text} · 逐句精读`, ''];
  const long = [`# ${year} 年考研英语二阅读 Text ${text} · 长难句`, ''];
  records.forEach((record, index) => {
    split.push(`## ${index + 1}. ${record.id}`, '', record.en, '', `**译文：** ${translations[record.id]}`, '');
    const analysis = analyses[record.id];
    if (analysis) {
      analysisTotal++;
      split.push(
        '**长难句拆解：**',
        '',
        `- 主干：${analysis.trunk}`,
        `- 逻辑：${analysis.logic || '见结构层次。'}`,
        '- 结构：',
        ...analysis.structure.map((item) => `  - ${item}`),
        '- 考点：',
        ...analysis.notes.map((item) => `  - ${item}`),
        '',
      );
      long.push(
        `## ${record.id}`,
        '',
        record.en,
        '',
        `**译文：** ${translations[record.id]}`,
        '',
        `**主干：** ${analysis.trunk}`,
        '',
        `**逻辑：** ${analysis.logic || '见结构层次。'}`,
        '',
        '**结构：**',
        '',
        ...analysis.structure.map((item) => `- ${item}`),
        '',
        '**考点：**',
        '',
        ...analysis.notes.map((item) => `- ${item}`),
        '',
      );
    }
  });
  writeFileSync(path.join(MARKDOWN, `${base}.md`), `${split.join('\n')}\n`, 'utf8');
  writeFileSync(path.join(LONG, `${base}.md`), `${long.join('\n')}\n`, 'utf8');

  copyFileSync(path.join(SRC, file), path.join(APP_ROOT, '拆句_JSONL', file));
  copyFileSync(translationPath, path.join(APP_ROOT, 'translations', `${base}.json`));
  copyFileSync(analysisPath, path.join(APP_ROOT, 'analyses', `${base}.json`));
  sentenceTotal += records.length;
}

console.log(`已生成并同步：${files.length} 篇 / ${sentenceTotal} 句 / ${analysisTotal} 条长难句拆解`);
