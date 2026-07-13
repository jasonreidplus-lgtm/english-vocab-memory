/* 在全部文档定稿后运行，记录资料库内每个最终文件（校验表自身除外）的 SHA256。 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(HERE, 'SHA256校验值.csv');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'tmp' ? [] : walk(full);
    return [full];
  });
}

const csv = (value) => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const rows = walk(ROOT)
  .filter((file) => path.resolve(file) !== path.resolve(OUT))
  .sort((a, b) => a.localeCompare(b, 'zh-CN'))
  .map((file) => {
    const data = readFileSync(file);
    return [
      path.relative(ROOT, file).split(path.sep).join('/'),
      statSync(file).size,
      createHash('sha256').update(data).digest('hex'),
    ];
  });

const lines = [['相对路径', '文件大小（字节）', 'SHA256'], ...rows].map((row) => row.map(csv).join(','));
writeFileSync(OUT, `﻿${lines.join('\r\n')}\r\n`, 'utf8');
console.log(`SHA256校验值.csv：${rows.length} 个最终文件`);
