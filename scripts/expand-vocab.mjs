/* 把 vocab.json 从 4533 扩到 5500：补全 ECDICT 考研(ky)缺词 + 高频考试词补足。
   - 仅「追加」新词(id 4534.., group=ceil(id/10))，不动现有词条 → 用户进度不受影响。
   - 新词字段：word/phonetic/base_meaning/pos 来自 ECDICT(清洗)，rich 字段留空，status=done。
   默认 dry-run 只打印；加 --write 才写回 vocab.json。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = 5500;
const WRITE = process.argv.includes('--write');
const VOCAB = path.join(ROOT, 'public', 'data', 'vocab.json');
const SRC = path.join(ROOT, 'data-src', '_ecdict.csv');

const records = JSON.parse(readFileSync(VOCAB, 'utf8'));
const have = new Set(records.map((r) => String(r.word || '').toLowerCase()));
const need = TARGET - records.length;
if (need <= 0) { console.log('已达/超过目标，无需扩展'); process.exit(0); }

// 清洗 ECDICT 中文释义 → { meaning, pos }
const POS_LEAD = /^((?:(?:n|vt|vi|v|adj|adv|prep|conj|pron|art|num|int|aux|abbr)\.\s*)+)/i;
function clean(translation) {
  const lines = String(translation).replace(/\\n/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  const posSet = [];
  const parts = [];
  for (let line of lines) {
    const m = line.match(POS_LEAD);
    if (m) {
      (m[1].match(/(n|vt|vi|v|adj|adv|prep|conj|pron|art|num|int|aux|abbr)\./gi) || []).forEach((mk) => {
        const p = mk.toLowerCase();
        if (!posSet.includes(p)) posSet.push(p);
      });
      line = line.slice(m[0].length).trim();
    }
    line = line.replace(/\[[^\]]*\]/g, '').trim(); // 去 [计][医] 类标记
    if (line) parts.push(line);
  }
  const toks = parts.join('，').split(/[，,；;、]/).map((s) => s.trim()).filter(Boolean);
  const uniq = [];
  for (const t of toks) if (!uniq.includes(t)) uniq.push(t);
  let meaning = '';
  for (const t of uniq) {
    if (meaning.length + t.length + 1 > 48) { meaning += '…'; break; }
    meaning += (meaning ? '，' : '') + t;
  }
  return { meaning, pos: posSet.slice(0, 3).join('/') };
}

// 解析 ECDICT，收集候选(ky 优先；其余考试词按词频补足)
const ky = [];
const pad = [];
const EXAM = /(^|\s)(cet6|cet4|gre|toefl|ielts|gk)(\s|$)/;
{
  const text = readFileSync(SRC, 'utf8');
  let row = [], field = '', inQ = false, header = null, col = {};
  const handle = (r) => {
    if (!header) { header = r.map((h) => h.trim().toLowerCase()); col = Object.fromEntries(header.map((h, i) => [h, i])); return; }
    const word = (r[col.word] || '').trim();
    if (!word || !/^[A-Za-z][A-Za-z'-]*$/.test(word)) return;
    const lw = word.toLowerCase();
    if (have.has(lw)) return;
    const tr = (r[col.translation] || '').trim();
    if (!tr) return;
    const tag = r[col.tag] || '';
    const frq = parseInt(r[col.frq] || '0', 10) || 999999;
    const isKy = /(^|\s)ky(\s|$)/.test(tag);
    if (!isKy && !EXAM.test(tag)) return;
    const { meaning, pos } = clean(tr);
    if (!meaning) return;
    const entry = { word: lw, phonetic: (r[col.phonetic] || '').trim(), meaning, pos, frq };
    (isKy ? ky : pad).push(entry);
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); handle(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); handle(row); }
}

// ky 全收(按词频排序，常用在前)；不足部分用 pad 按词频补
ky.sort((a, b) => a.frq - b.frq);
pad.sort((a, b) => a.frq - b.frq);
const chosen = [...ky];
const seen = new Set(ky.map((e) => e.word));
for (const e of pad) {
  if (chosen.length >= need) break;
  if (!seen.has(e.word)) { seen.add(e.word); chosen.push(e); }
}
const add = chosen.slice(0, need);

console.log(`现有 ${records.length} → 目标 ${TARGET}，需新增 ${need}`);
console.log(`候选：ky=${ky.length}，pad(考试高频)=${pad.length}；实际选用 ky=${Math.min(ky.length, need)} + pad=${Math.max(0, need - ky.length)}`);
console.log('\n样例(前 12)：');
add.slice(0, 12).forEach((e) => console.log(`  ${e.word}  ${e.pos || '-'}  ${e.phonetic || ''}  ${e.meaning}`));
console.log('\n样例(末 6)：');
add.slice(-6).forEach((e) => console.log(`  ${e.word}  ${e.pos || '-'}  ${e.meaning}`));
const noPos = add.filter((e) => !e.pos).length;
console.log(`\n无词性的: ${noPos}；无音标的: ${add.filter((e) => !e.phonetic).length}`);

if (!WRITE) { console.log('\n(dry-run，未写入。加 --write 应用)'); process.exit(0); }

let id = records.length; // 末 id = 长度(因 id 从 1 连续)
for (const e of add) {
  id += 1;
  records.push({
    id, group: Math.ceil(id / 10),
    word: e.word, phonetic: e.phonetic, base_meaning: e.meaning, pos: e.pos,
    roots: '', examples: [], confusions: '', exam_tip: '', mnemonic: '', status: 'done',
  });
}
writeFileSync(VOCAB, JSON.stringify(records));
console.log(`\n✓ 已写入 ${records.length} 词 → public/data/vocab.json（group 1~${Math.ceil(id / 10)}）`);
