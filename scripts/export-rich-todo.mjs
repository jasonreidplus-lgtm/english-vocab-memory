/* 把待补富字段的新词(id>4533)导出成若干分块，交给并行子代理生成。
   产出 data-src/rich-todo/chunk-NN.json = [{id, word, base_meaning, pos}, ...] */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const records = JSON.parse(readFileSync(path.join(ROOT, 'public', 'data', 'vocab.json'), 'utf8'));
const todo = records
  .filter((r) => r.id > 4533)
  .map((r) => ({ id: r.id, word: r.word, base_meaning: r.base_meaning, pos: r.pos }));

const N = 16;
const TODO_DIR = path.join(ROOT, 'data-src', 'rich-todo');
mkdirSync(TODO_DIR, { recursive: true });
mkdirSync(path.join(ROOT, 'data-src', 'rich-done'), { recursive: true });

const per = Math.ceil(todo.length / N);
let chunks = 0;
for (let i = 0; i < N; i++) {
  const chunk = todo.slice(i * per, (i + 1) * per);
  if (!chunk.length) continue;
  writeFileSync(path.join(TODO_DIR, `chunk-${String(i).padStart(2, '0')}.json`), JSON.stringify(chunk));
  chunks++;
}
console.log(`待补 ${todo.length} 词 → ${chunks} 块(每块约 ${per})`);
