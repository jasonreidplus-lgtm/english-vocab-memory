/* ============================================================
   build-vocab.cjs —— 把 kajweb/dict 的考研词表(百词斩数据，JSONL)
   转成本项目的数据契约，输出 public/data/vocab.json。

   仅做字段映射，不改写任何 word / phonetic / 释义本身。供个人学习使用。
   数据来源：https://github.com/kajweb/dict （book/ 下的 KaoYan_*.zip）

   用法（重新生成 / 换更大的词表时）：
     1) 下载并解压某个考研词表，例如：
        curl -sL "https://raw.githubusercontent.com/kajweb/dict/master/book/1521164654696_KaoYan_2.zip" -o kaoyan.zip
        powershell Expand-Archive kaoyan.zip -DestinationPath kaoyan -Force   # 或 unzip kaoyan.zip
     2) 运行：node scripts/build-vocab.cjs <解压出的 KaoYan_2.json 路径>
     不传路径则默认读 ./KaoYan_2.json
   ============================================================ */
const fs = require('fs');
const path = require('path');

const src = process.argv[2] || 'KaoYan_2.json';
const outPath = path.join('public', 'data', 'vocab.json');

const lines = fs.readFileSync(src, 'utf8').split('\n').filter((l) => l.trim());

const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').trim();
const cleanPhone = (p) => {
  const s = strip(p).replace(/'/g, 'ˈ');
  return s ? `/${s}/` : '';
};
const posDot = (p) => (p ? p.replace(/\.*$/, '.') : '');

const out = [];
lines.forEach((line, i) => {
  let rec;
  try {
    rec = JSON.parse(line);
  } catch {
    return;
  }
  const head = rec.headWord;
  const c = rec.content && rec.content.word && rec.content.word.content;
  if (!head || !c) return;

  const trans = c.trans || [];
  const pos = [...new Set(trans.map((t) => t.pos).filter(Boolean))].map(posDot).join('/');
  const base_meaning = trans.map((t) => strip(t.tranCn)).filter(Boolean).join('；');
  const phonetic = cleanPhone(c.usphone || c.ukphone || c.phone);

  const examples = (((c.sentence || {}).sentences) || [])
    .slice(0, 2)
    .map((s) => ({ en: strip(s.sContent), cn: strip(s.sCn) }))
    .filter((e) => e.en);

  const roots = strip(c.remMethod && c.remMethod.val);

  let confusions = '';
  if (c.relWord && c.relWord.rels) {
    const items = [];
    c.relWord.rels.forEach((r) =>
      (r.words || []).forEach((w) => {
        if (w.hwd) items.push(`${w.hwd}（${strip(w.tran)}）`);
      })
    );
    if (items.length) confusions = '同根词：' + items.slice(0, 5).join('，');
  }

  let exam_tip = '';
  if (c.phrase && c.phrase.phrases) {
    const ph = c.phrase.phrases
      .slice(0, 3)
      .map((p) => `${strip(p.pContent)} ${strip(p.pCn)}`.trim())
      .filter(Boolean);
    if (ph.length) exam_tip = '常考短语：' + ph.join('；');
  }

  out.push({
    id: i + 1,
    group: Math.floor(i / 10) + 1,
    word: head,
    phonetic,
    base_meaning,
    pos,
    roots,
    examples,
    confusions,
    exam_tip,
    mnemonic: '',
    status: 'done',
  });
});

fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(`written ${out.length} words, ${Math.ceil(out.length / 10)} groups -> ${outPath}`);
