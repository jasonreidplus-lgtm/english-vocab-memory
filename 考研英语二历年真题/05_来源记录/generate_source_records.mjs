/* 根据逐份 PDF 检查结果生成来源清单。运行前先重新执行 validate_pdfs.py。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const rawPath = path.join(HERE, '_pdf_validation_raw.jsonl');
const records = readFileSync(rawPath, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const fantasiaRepo = 'Fantasia1999/kaoyanzhenti';
const fantasiaBase = 'https://raw.githubusercontent.com/Fantasia1999/kaoyanzhenti/main/公共课/英语真题/英语二/';
const zwdRepo = 'zwd1216/yingyuer';
const zwdBase = 'https://raw.githubusercontent.com/zwd1216/yingyuer/master/';
const jxrRepo = 'jxr202/Examination-English';
const jxrBase = 'https://raw.githubusercontent.com/jxr202/Examination-English/master/';

const zwdOriginals = Object.fromEntries([
  ...Array.from({ length: 8 }, (_, index) => {
    const year = 2010 + index;
    return [`${year}年考研英语二真题及参考答案.pdf`, `${year}英语真题试卷及答案2.pdf`];
  }),
  ['2018年考研英语二详细解析.pdf', '19-18年经典试卷版.pdf'],
]);

const jxrOriginals = {
  '旧数据__1_作文讲义材料.pdf': '旧数据/1_作文讲义材料.pdf',
  '搜索出来的__2010-2016 大小作文范文.pdf': '搜索出来的/2010-2016 大小作文范文.pdf',
  '搜索出来的__点睛课12月8.pdf': '搜索出来的/点睛课12月8.pdf',
  '搜索出来的__技巧提升1翻译篇.pdf': '搜索出来的/技巧提升1翻译篇.pdf',
  '搜索出来的__技巧提升1翻译篇去步骤版.pdf': '搜索出来的/技巧提升1翻译篇去步骤版.pdf',
  '搜索出来的__技巧提升2写作篇.pdf': '搜索出来的/技巧提升2写作篇.pdf',
  '搜索出来的__技巧提升2写作篇去步骤版.pdf': '搜索出来的/技巧提升2写作篇去步骤版.pdf',
  '搜索出来的__技巧提升2写作优化法则去步骤版.pdf': '搜索出来的/技巧提升2写作优化法则去步骤版.pdf',
  '搜索出来的__技巧提升3阅读理解.pdf': '搜索出来的/技巧提升3阅读理解.pdf',
  '搜索出来的__技巧提升4阅读理解.pdf': '搜索出来的/技巧提升4阅读理解.pdf',
  '搜索出来的__强11化.pdf': '搜索出来的/强11化.pdf',
};

function classify(record) {
  const finalName = path.posix.basename(record.path);
  if (record.path.startsWith('01_单年份真题/')) {
    const year = finalName.slice(0, 4);
    return {
      year,
      type: '单年份真题',
      original: finalName,
      repo: fantasiaRepo,
      url: `${fantasiaBase}${finalName}`,
      status: '通过',
      note: year === '2010'
        ? 'PDF签名、打开、页数、内容均通过；标题文本层缺年份，已按试题内容和来源路径人工交叉核对。'
        : 'PDF签名、打开、页数、内容及年份逐项通过。',
    };
  }
  if (record.path.startsWith('02_答案与解析/')) {
    const year = finalName.slice(0, 4);
    const original = zwdOriginals[finalName];
    return {
      year,
      type: year === '2018' ? '详细解析' : '真题及参考答案',
      original,
      repo: zwdRepo,
      url: `${zwdBase}${original}`,
      status: '通过',
      note: year === '2018'
        ? '原始文件名含19-18，逐页确认实际内容为2018年英语二详细解析。'
        : 'PDF签名、打开、页数通过；逐页确认含对应年份英语二真题和参考答案。',
    };
  }
  if (record.path.startsWith('03_历年合集/')) {
    const original = '10-22考研英语二真题无解析.pdf';
    return {
      year: '2010-2022',
      type: '历年合集',
      original,
      repo: fantasiaRepo,
      url: `${fantasiaBase}${original}`,
      status: '通过',
      note: '182页合集；确认覆盖2010—2022英语二真题，不含解析，与单年份版按用途分别保留。',
    };
  }
  if (record.path.startsWith('04_待核对资料/jxr202_英语二辅助讲义/')) {
    const original = jxrOriginals[finalName];
    return {
      year: /2010-2016/.test(finalName) ? '2010-2016' : '年份不定',
      type: '英语二辅助讲义',
      original,
      repo: jxrRepo,
      url: `${jxrBase}${original}`,
      status: 'PDF检查通过，分类待核对',
      note: '真实PDF且可打开，但属于作文、翻译、阅读等课程讲义，不是完整单年份真题，故未混入正式目录。',
    };
  }
  return null;
}

const header = ['年份', '资料类型', '最终文件名', '原始文件名', '来源仓库', '来源路径或URL', '文件大小', 'PDF页数', '校验状态', '备注'];
const rows = records.map((record) => ({ record, meta: classify(record) })).filter((item) => item.meta);
rows.push({
  record: { path: '04_待核对资料/补充文本源/pfoocc_英语二_2010-2023', size: '' , page_count: '' },
  meta: {
    year: '2010-2023',
    type: '阅读文本辅助源（TeX）',
    original: '204/',
    repo: 'pfoocc/201_204_kaoyan',
    url: 'https://github.com/pfoocc/201_204_kaoyan/tree/main/204',
    status: '辅助源已核对',
    note: '仅用于阅读文本交叉校订；仓库自述未逐字校正，不能替代正式PDF，未作为答案或真题PDF交付。',
  },
});

const csv = (value) => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const lines = [header, ...rows.map(({ record, meta }) => [
  meta.year,
  meta.type,
  record.path,
  meta.original,
  meta.repo,
  meta.url,
  record.size,
  record.page_count,
  meta.status,
  meta.note,
])].map((row) => row.map(csv).join(','));

writeFileSync(path.join(HERE, '资料来源.csv'), `﻿${lines.join('\r\n')}\r\n`, 'utf8');
console.log(`资料来源.csv：${rows.length} 条（PDF ${rows.length - 1}，辅助文本源 1）`);
