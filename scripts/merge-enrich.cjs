/* 把 scripts/enrich.json 里的人工增强(助记/词根)按 word 合并进 public/data/vocab.json。
   - mnemonic：有就写入(覆盖旧助记)
   - roots：仅当该词当前 roots 为空时才填(不覆盖数据集真实词根)
   只动 mnemonic / roots 两个字段，绝不碰 word/phonetic/base_meaning。可反复运行(幂等)。 */
const fs = require('fs');

const vocab = JSON.parse(fs.readFileSync('public/data/vocab.json', 'utf8'));
// 合并所有 scripts/enrich*.json（enrich.json, enrich-002.json, ...），便于分批补充
const files = fs.readdirSync('scripts').filter((f) => /^enrich.*\.json$/.test(f)).sort();
const enrich = {};
for (const f of files) Object.assign(enrich, JSON.parse(fs.readFileSync('scripts/' + f, 'utf8')));
console.log('合并 enrich 文件:', files.join(', '));
const norm = (s) => String(s || '').toLowerCase().trim();
const map = new Map(Object.entries(enrich).map(([k, v]) => [norm(k), v]));

let mUpd = 0;
let rUpd = 0;
for (const w of vocab) {
  const e = map.get(norm(w.word));
  if (!e) continue;
  if (e.mnemonic && e.mnemonic.trim() && w.mnemonic !== e.mnemonic) {
    w.mnemonic = e.mnemonic.trim();
    mUpd++;
  }
  if (e.roots && e.roots.trim() && (!w.roots || !w.roots.trim())) {
    w.roots = e.roots.trim();
    rUpd++;
  }
}
fs.writeFileSync('public/data/vocab.json', JSON.stringify(vocab, null, 1));

const matched = [...map.keys()].filter((k) => vocab.some((w) => norm(w.word) === k));
const unmatched = [...map.keys()].filter((k) => !vocab.some((w) => norm(w.word) === k));
console.log(`enrich 条目: ${map.size} | 命中词库: ${matched.length} | 写入助记: ${mUpd} | 补词根: ${rUpd}`);
if (unmatched.length) console.log('未在词库中(跳过):', unmatched.join(', '));
