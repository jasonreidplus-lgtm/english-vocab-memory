import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '06_阅读加工');
const SRC = path.join(ROOT, '拆句_JSONL');
const TRANS = path.join(ROOT, 'translations');
const ANALYSES = path.join(ROOT, 'analyses');

const files = readdirSync(SRC).filter((f) => /^20\d{2}-Text[1-4]\.jsonl$/.test(f)).sort();
const allIds = new Set();
const issues = [];
let sentences = 0;
let translated = 0;
let analysed = 0;

for (const file of files) {
  const base = file.replace(/\.jsonl$/, '');
  const fileMatch = base.match(/^(20\d{2})-Text([1-4])$/);
  const fileYear = Number(fileMatch?.[1]);
  const fileText = Number(fileMatch?.[2]);
  const records = readFileSync(path.join(SRC, file), 'utf8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { issues.push(`${file}:${index + 1} JSON错误 ${error.message}`); return null; }
    })
    .filter(Boolean);
  const transPath = path.join(TRANS, `${base}.json`);
  const anaPath = path.join(ANALYSES, `${base}.json`);
  let trans = {};
  let analyses = {};
  try { trans = JSON.parse(readFileSync(transPath, 'utf8').replace(/^﻿/, '')); }
  catch (error) { issues.push(`${base} 翻译文件缺失或损坏: ${error.message}`); }
  try { analyses = JSON.parse(readFileSync(anaPath, 'utf8').replace(/^﻿/, '')); }
  catch (error) { issues.push(`${base} 分析文件缺失或损坏: ${error.message}`); }

  const ids = records.map((r) => r.id);
  if (records.length < 10 || records.length > 30) issues.push(`${file} 句数异常: ${records.length}`);
  const passageEnglish = records.map((record) => record.en).join(' ');
  const wordCount = passageEnglish.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length || 0;
  if (wordCount < 300 || wordCount > 550) issues.push(`${file} 词数异常: ${wordCount}`);
  if ((passageEnglish.match(/"/g)?.length || 0) % 2 !== 0) issues.push(`${file} 英文双引号不成对`);
  records.forEach((record, index) => {
    sentences++;
    const expected = `E2-${record.year}-T${record.text}-P1-S${index + 1}`;
    if (record.id !== expected) issues.push(`${file} ID不连续: ${record.id} != ${expected}`);
    if (allIds.has(record.id)) issues.push(`重复ID: ${record.id}`);
    allIds.add(record.id);
    if (record.exam !== 'english2') issues.push(`${record.id} exam字段错误: ${record.exam}`);
    if (record.year !== fileYear || record.text !== fileText) issues.push(`${record.id} 年份或Text字段与文件名不符`);
    if (record.paragraph !== 1 || record.sentence !== index + 1) issues.push(`${record.id} paragraph/sentence字段不连续`);
    if (typeof trans[record.id] !== 'string' || !trans[record.id].trim()) issues.push(`${record.id} 缺译文`);
    else translated++;
    if (/[\u4e00-\u9fff]/.test(record.en)) issues.push(`${record.id} 英文含中文OCR字符`);
    if (/[A-Za-z]\d+[A-Za-z]/.test(record.en)) issues.push(`${record.id} 含可疑字母数字混排`);
    if (/\uFFFD/.test(record.en)) issues.push(`${record.id} 含替换字符`);
    const withoutSuspendedHyphen = record.en.replace(/\b(?:short|medium|long)-\s+(?:to|and|or)\s+/gi, '');
    if (/\b[A-Za-z]{2,}-\s+[a-z]/.test(withoutSuspendedHyphen)) issues.push(`${record.id} 含可疑PDF断行连字符`);
    if (/[A-Za-z]\s{2,}[A-Za-z]/.test(record.en)) issues.push(`${record.id} 含可疑多余空格`);
    if (!/[.!?]["']?$/.test(record.en.trim())) issues.push(`${record.id} 句末标点异常`);
  });

  for (const key of Object.keys(trans)) if (!ids.includes(key)) issues.push(`${base} 多余译文键: ${key}`);
  const analysisKeys = Object.keys(analyses);
  if (analysisKeys.length !== 3) issues.push(`${base} 长难句数量=${analysisKeys.length}，应为3`);
  for (const key of analysisKeys) {
    if (!ids.includes(key)) issues.push(`${base} 分析引用不存在: ${key}`);
    const value = analyses[key];
    if (!value || typeof value.trunk !== 'string' || !value.trunk.trim()) issues.push(`${key} 缺主干`);
    if (!Array.isArray(value?.structure) || !value.structure.length) issues.push(`${key} 缺结构树`);
    if (typeof value?.logic !== 'string' || !value.logic.trim()) issues.push(`${key} 缺逻辑说明`);
    if (!Array.isArray(value?.notes) || !value.notes.length) issues.push(`${key} 缺考点提示`);
    analysed++;
  }
}

const years = [...new Set(files.map((f) => Number(f.slice(0, 4))))];
if (files.length !== 68) issues.push(`篇目文件数=${files.length}，应为68`);
const expectedYears = Array.from({ length: 17 }, (_, index) => 2010 + index);
if (JSON.stringify(years) !== JSON.stringify(expectedYears)) issues.push(`年份覆盖异常: ${years.join(',')}`);
for (const year of expectedYears) {
  if (files.filter((file) => file.startsWith(`${year}-`)).length !== 4) issues.push(`${year} 年不是4篇`);
}
console.log(JSON.stringify({ files: files.length, years, sentences, translated, analysed, issues: issues.length }, null, 2));
if (issues.length) {
  console.error(issues.slice(0, 200).join('\n'));
  if (issues.length > 200) console.error(`...另有 ${issues.length - 200} 项`);
  process.exit(1);
}
