/* 把 public/data/vocab.json 拆成「轻量索引」+「按 group 的富字段」，用于懒加载。
   - vocab-index.json：每词只留 id/group/word/phonetic/base_meaning/pos/status
     (足够渲染关卡网格、闯关出题、连连看、错词查找)
   - groups/g{N}.json：{ id: { roots, examples, confusions, exam_tip, mnemonic } }
     (进入“学习/浏览”时按需加载)
   vocab.json 仍是唯一可编辑数据源；覆盖它后跑 `node scripts/split-vocab.cjs` 即可。
   若不跑此脚本，app 会自动回退为整包加载 vocab.json(功能不受影响)。 */
const fs = require('fs');

const vocab = JSON.parse(fs.readFileSync('public/data/vocab.json', 'utf8'));

const index = vocab.map((w) => ({
  id: w.id,
  group: w.group,
  word: w.word,
  phonetic: w.phonetic,
  base_meaning: w.base_meaning,
  pos: w.pos,
  status: w.status,
}));
fs.writeFileSync('public/data/vocab-index.json', JSON.stringify(index));

const dir = 'public/data/groups';
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const byGroup = {};
for (const w of vocab) {
  (byGroup[w.group] = byGroup[w.group] || {})[w.id] = {
    roots: w.roots,
    examples: w.examples,
    confusions: w.confusions,
    exam_tip: w.exam_tip,
    mnemonic: w.mnemonic,
  };
}
let n = 0;
for (const g of Object.keys(byGroup)) {
  fs.writeFileSync(`${dir}/g${g}.json`, JSON.stringify(byGroup[g]));
  n++;
}
console.log(`index: ${index.length} words -> vocab-index.json | groups: ${n} files`);
