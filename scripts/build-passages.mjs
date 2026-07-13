/* 合并英语一、英语二逐句语料为 public/data/passages.json。
   英语一保留既有 ky-YYYY-tN ID，避免破坏已保存的阅读完成记录；
   英语二使用 ky-e2-YYYY-tN，并以 exam 字段严格分库。 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const OUT = path.join(OUT_DIR, 'passages.json');

const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i);

const SOURCES = [
  {
    exam: 'english1',
    label: '英语一',
    src: path.join(ROOT, 'data-src', '拆句_JSONL'),
    trans: path.join(ROOT, 'data-src', 'translations'),
    analyses: path.join(ROOT, 'data-src', 'analyses'),
    expectedYears: [...range(2010, 2020), 2022, 2023],
    recordId: /^\d{4}-T[1-4]-P\d+-S\d+$/,
  },
  {
    exam: 'english2',
    label: '英语二',
    src: path.join(ROOT, 'data-src', '英语二', '拆句_JSONL'),
    trans: path.join(ROOT, 'data-src', '英语二', 'translations'),
    analyses: path.join(ROOT, 'data-src', '英语二', 'analyses'),
    expectedYears: range(2010, 2026),
    recordId: /^E2-\d{4}-T[1-4]-P\d+-S\d+$/,
  },
];

const normalizeQuotes = (s) =>
  String(s)
    .replace(/[“”„″]/g, '"')
    .replace(/[‘’‛′]/g, "'");

function readJsonMap(dir, label) {
  const out = {};
  if (!existsSync(dir)) throw new Error(`${label}目录缺失：${path.relative(ROOT, dir)}`);
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json')).sort();
  if (!files.length) throw new Error(`${label}目录没有 JSON：${path.relative(ROOT, dir)}`);
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(path.join(dir, file), 'utf8').replace(/^﻿/, ''));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error(`${label}不是对象：${path.relative(ROOT, path.join(dir, file))}`);
    }
    for (const [id, value] of Object.entries(parsed)) {
      if (Object.hasOwn(out, id)) throw new Error(`${label}句子 ID 重复：${id}`);
      out[id] = value;
    }
  }
  return out;
}

const passages = [];
let lineCount = 0;
const allRecordIds = new Set();

for (const source of SOURCES) {
  if (!existsSync(source.src)) {
    throw new Error(`${source.label}语料目录缺失：${path.relative(ROOT, source.src)}`);
  }
  const files = readdirSync(source.src).filter((f) => f.toLowerCase().endsWith('.jsonl')).sort();
  if (!files.length) throw new Error(`${source.label}语料目录没有 JSONL`);
  const trans = readJsonMap(source.trans, `${source.label}译文`);
  const analyses = readJsonMap(source.analyses, `${source.label}长难句`);
  const groups = new Map();
  const sourceRecordIds = new Set();

  for (const file of files) {
    const raw = readFileSync(path.join(source.src, file), 'utf8').replace(/^﻿/, '');
    raw.split(/\r?\n/).forEach((line, index) => {
      const value = line.trim();
      if (!value) return;
      lineCount++;
      let rec;
      try {
        rec = JSON.parse(value);
      } catch (error) {
        throw new Error(`JSON 解析失败 ${file}:${index + 1} -> ${error.message}`);
      }
      if (!rec || typeof rec.en !== 'string' || !rec.en.trim()) throw new Error(`缺少 en 字段 ${file}:${index + 1}`);
      if (typeof rec.id !== 'string' || !source.recordId.test(rec.id)) throw new Error(`句子 ID 格式错误 ${file}:${index + 1} -> ${rec.id}`);
      if (sourceRecordIds.has(rec.id) || allRecordIds.has(rec.id)) throw new Error(`句子 ID 重复：${rec.id}`);
      const year = Number(rec.year);
      const text = Number(rec.text);
      if (!Number.isInteger(year) || !source.expectedYears.includes(year) || !Number.isInteger(text) || text < 1 || text > 4) {
        throw new Error(`年份/Text 超出预期 ${file}:${index + 1} -> ${year}/Text ${text}`);
      }
      sourceRecordIds.add(rec.id);
      allRecordIds.add(rec.id);
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

  const expectedPairs = source.expectedYears.flatMap((year) => [1, 2, 3, 4].map((text) => `${year}-${text}`));
  const actualPairs = [...groups.keys()].sort();
  const missingPairs = expectedPairs.filter((key) => !groups.has(key));
  const extraPairs = actualPairs.filter((key) => !expectedPairs.includes(key));
  if (missingPairs.length || extraPairs.length) {
    throw new Error(`${source.label}篇目分布异常；缺失=${missingPairs.join(',') || '无'}；多余=${extraPairs.join(',') || '无'}`);
  }
  const missingTranslations = [...sourceRecordIds].filter((id) => typeof trans[id] !== 'string' || !trans[id].trim());
  const orphanTranslations = Object.keys(trans).filter((id) => !sourceRecordIds.has(id));
  const orphanAnalyses = Object.keys(analyses).filter((id) => !sourceRecordIds.has(id));
  if (missingTranslations.length || orphanTranslations.length || orphanAnalyses.length) {
    throw new Error(
      `${source.label}映射异常；缺译=${missingTranslations.length}，孤立译文=${orphanTranslations.length}，孤立拆解=${orphanAnalyses.length}`,
    );
  }

  for (const { year, text, records } of [...groups.values()].sort((a, b) => a.year - b.year || a.text - b.text)) {
    records.sort((a, b) => a.paragraph - b.paragraph || a.sentence - b.sentence);
    const analysisCount = records.filter((record) => analyses[record.id]).length;
    if (analysisCount !== 3) throw new Error(`${source.label} ${year} Text ${text} 长难句数量应为 3，实际 ${analysisCount}`);
    passages.push({
      id: source.exam === 'english2' ? `ky-e2-${year}-t${text}` : `ky-${year}-t${text}`,
      exam: source.exam,
      title: `${year} ${source.label} Text ${text}`,
      year,
      text,
      sents: records.map((record) => {
        const sentence = { en: record.en };
        if (trans[record.id]) sentence.cn = trans[record.id];
        if (analyses[record.id]) sentence.analysis = analyses[record.id];
        return sentence;
      }),
    });
  }
}

passages.sort((a, b) => a.exam.localeCompare(b.exam) || a.year - b.year || a.text - b.text);
const ids = passages.map((p) => p.id);
if (new Set(ids).size !== ids.length) throw new Error('篇目 ID 重复');

const sentTotal = passages.reduce((n, p) => n + p.sents.length, 0);
const cnTotal = passages.reduce((n, p) => n + p.sents.filter((s) => s.cn).length, 0);
const anaTotal = passages.reduce((n, p) => n + p.sents.filter((s) => s.analysis).length, 0);
const byExam = Object.fromEntries(
  SOURCES.map((source) => {
    const list = passages.filter((p) => p.exam === source.exam);
    return [source.exam, `${list.length}篇/${list.reduce((n, p) => n + p.sents.length, 0)}句`];
  }),
);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(passages));
console.log(
  `passages.json: ${passages.length}篇 / ${sentTotal}句 / ${cnTotal}句有译文 / ${anaTotal}句有拆解` +
    ` (${Object.entries(byExam).map(([k, v]) => `${k}=${v}`).join(', ')})` +
    ` / 读取${lineCount}行 / 0 行异常`,
);
console.log(`-> ${path.relative(ROOT, OUT)}`);
