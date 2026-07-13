/*
 * 从 pfoocc/201_204_kaoyan 的 204(英语二) LaTeX 源中提取 Reading Part A。
 * 输出沿用 E:\英语阅读\阅读资料 的分层模式：阅读文章、拆句 Markdown、拆句 JSONL、答案索引。
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, '..');
const SRC = path.join(
  LIB,
  '04_待核对资料',
  '补充文本源',
  'pfoocc_201_204_kaoyan_main',
  '201_204_kaoyan-main',
  '204',
);
const OUT = path.join(LIB, '06_阅读加工');
const ARTICLE_DIR = path.join(OUT, '阅读文章');
const MD_DIR = path.join(OUT, '拆句_Markdown');
const JSONL_DIR = path.join(OUT, '拆句_JSONL');
const ANSWER_DIR = path.join(OUT, '答案索引');

for (const d of [ARTICLE_DIR, MD_DIR, JSONL_DIR, ANSWER_DIR]) mkdirSync(d, { recursive: true });

const ABBR = [
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'St', 'vs', 'etc', 'Inc', 'Ltd', 'Co', 'No', 'Vol',
  'U.S', 'U.K', 'U.N', 'e.g', 'i.e', 'a.m', 'p.m',
];

function cleanTex(raw) {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\\([%$&#_{}])/g, '$1')
    .replace(/``/g, '"')
    .replace(/''/g, '"')
    .replace(/~/g, ' ')
    .replace(/\\(?:emph|textit|textbf|uline)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+(?:\[[^\]]*\])?/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/[“”„″]/g, '"')
    .replace(/[‘’‛′]/g, "'")
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?=[A-Za-z])/g, '$1 ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function splitSentences(text) {
  let t = ` ${text} `;
  ABBR.forEach((a, k) => {
    t = t.replace(new RegExp(`\\b${a.replace(/\./g, '\\\\.')}\\.`, 'g'), `${a}<D${k}>`);
  });
  t = t.replace(/\b([A-Z])\.(?=\s[A-Z])/g, '$1<DI>');
  const parts = t.match(/[^.!?]+[.!?]+["']*(?=\s|$)/g) || [t];
  return parts
    .map((s) => s
      .replace(/<D(\d+)>/g, (_, k) => `${ABBR[Number(k)]}.`)
      .replace(/<DI>/g, '.')
      .replace(/^['"]\s+/, '')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim())
    .filter((s) => s.replace(/[^a-z]/gi, '').length >= 15);
}

const years = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^20\d{2}$/.test(d.name))
  .map((d) => Number(d.name))
  .filter((y) => y >= 2010)
  .sort((a, b) => a - b);

const answerRows = ['年份,篇目,答案'];
let passageCount = 0;
let sentenceCount = 0;

for (const year of years) {
  for (let text = 1; text <= 4; text++) {
    const articlePath = path.join(SRC, String(year), 'read', `articles${text}.tex`);
    const answerPath = path.join(SRC, String(year), 'read', `read${text}_answer.tex`);
    let raw;
    try {
      raw = readFileSync(articlePath, 'utf8').replace(/^\uFEFF/, '').trim();
    } catch {
      continue;
    }

    const paragraphs = raw
      .split(/\n\s*\n+/)
      .map(cleanTex)
      .filter((p) => p.replace(/[^a-z]/gi, '').length >= 30);
    const records = [];
    for (let p = 0; p < paragraphs.length; p++) {
      const sents = splitSentences(paragraphs[p]);
      sents.forEach((en, s) => records.push({
        id: `E2-${year}-T${text}-P${p + 1}-S${s + 1}`,
        exam: 'english2',
        year,
        text,
        paragraph: p + 1,
        sentence: s + 1,
        en,
      }));
    }

    const title = `${year} 英语二 Text ${text}`;
    writeFileSync(
      path.join(ARTICLE_DIR, `${year}-Text${text}.md`),
      `## ${title}\n\n${paragraphs.join('\n\n')}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(MD_DIR, `${year}-Text${text}.md`),
      `## ${title}\n\n${records.map((r) => `- ${r.id}  ${r.en}`).join('\n')}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(JSONL_DIR, `${year}-Text${text}.jsonl`),
      `${records.map((r) => JSON.stringify(r)).join('\n')}\n`,
      'utf8',
    );

    try {
      const answerRaw = readFileSync(answerPath, 'utf8');
      const m = answerRaw.match(/read-\d+-\[([A-D,\s]+)\]/i);
      answerRows.push(`${year},Text ${text},"${m ? m[1].replace(/"/g, '""') : ''}"`);
    } catch {
      answerRows.push(`${year},Text ${text},`);
    }

    passageCount++;
    sentenceCount += records.length;
  }
}

writeFileSync(path.join(ANSWER_DIR, '阅读答案索引.csv'), `${answerRows.join('\n')}\n`, 'utf8');
console.log(`英语二阅读：${years[0]}-${years.at(-1)} / ${passageCount} 篇 / ${sentenceCount} 句`);
