/* 纯函数单测，用 tsx 跑 TS 源：npm test (= tsx scripts/test.mjs) */
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { shortMeaning, tallyResult, buildQuiz } from '../src/game/quiz';
import { shuffle, sample } from '../src/lib/shuffle';
import { emptyCard, gradeCard, markWrongCard, isMastered, isDue, previewDays, intervalLabel, Rating } from '../src/lib/fsrs';
import { computeStats } from '../src/lib/stats';
import { starsFor, xpFor, summarize, dueReviewIds, dayKey, computeLevelStates, nextEnterableGroup } from '../src/state/progress';
import { splitEnSentences } from '../src/lib/text';
import { reducer } from '../src/state/useProgress';
import { choosePdfWebMethod, makePdfFileName, pdfSaveInstructions, sanitizePdfDocumentName } from '../src/lib/pdfSave';
import {
  PDF_SC_FALLBACK_CODEPOINTS,
  generateVocabularyPdfBlob,
  generateVocabularyPdfBytes,
  pdfColumnsFor,
  pdfFontNameForCharacter,
  pdfPageCount,
  sanitizePdfText,
} from '../src/lib/pdfDocument';

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ✓', name);
  } catch (e) {
    fail++;
    console.log('  ✗', name, '\n     ', e.message);
  }
}

async function ta(name, fn) {
  try {
    await fn();
    pass++;
    console.log('  ✓', name);
  } catch (e) {
    fail++;
    console.log('  ✗', name, '\n     ', e.message);
  }
}

const NOW = new Date('2026-06-25T00:00:00Z');
// 构造一张「已掌握」卡(Review 态、间隔≥21天、带 last_review 以便算保持率)
const masteredCard = () => ({
  due: new Date(NOW.getTime() + 35 * 864e5).toISOString(),
  stability: 35, difficulty: 5, elapsed_days: 1, scheduled_days: 35,
  reps: 5, lapses: 0, learning_steps: 0, state: 2,
  last_review: new Date(NOW.getTime() - 5 * 864e5).toISOString(),
});

console.log('shortMeaning:');
t('短释义原样返回', () => assert.equal(shortMeaning('放弃'), '放弃'));
t('长释义截到首义', () => {
  const full = '智力的；聪明的；理智的；知识分子，凭理智做事者';
  const s = shortMeaning(full);
  assert.ok(s.length < full.length);
  assert.ok(s.startsWith('智力的'));
});

console.log('tallyResult:');
t('正确统计对错与 id', () => {
  const r = tallyResult([{ id: 1 }, { id: 2 }, { id: 3 }], [true, false, true]);
  assert.equal(r.correct, 2);
  assert.equal(r.total, 3);
  assert.deepEqual(r.wrongIds, [2]);
  assert.deepEqual(r.correctIds, [1, 3]);
});

console.log('buildQuiz:');
const words = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, word: 'word' + i, base_meaning: '释义' + i, phonetic: '/p/', pos: 'n.' }));
t('每词一题', () => assert.equal(buildQuiz(words, words).length, 10));
t('题型只含 choice/cn2en', () => assert.ok(buildQuiz(words, words).every((q) => ['choice', 'cn2en'].includes(q.type))));
t('选择题含正确项且 ≤4 不重复', () => {
  for (const q of buildQuiz(words, words)) {
    assert.ok(q.options.some((o) => o.key === q.answer)); // 选项现为 {key,en,cn}，含正确项
    assert.ok(q.options.length >= 1 && q.options.length <= 4);
    assert.equal(new Set(q.options.map((o) => o.key)).size, q.options.length); // key 不重复
    for (const o of q.options) assert.ok(o.en && o.cn); // 每项都带中英(供答完对照 #6)
  }
});

console.log('shuffle:');
t('洗牌保留全部元素且不改原数组', () => {
  const a = [1, 2, 3, 4, 5];
  assert.deepEqual([...shuffle(a)].sort((x, y) => x - y), [1, 2, 3, 4, 5]);
  assert.equal(a.length, 5);
});
t('sample 取 n 个', () => assert.equal(sample([1, 2, 3, 4, 5], 3).length, 3));

console.log('scoring (starsFor/xpFor):');
t('星级按比例', () => {
  assert.equal(starsFor(9, 10), 3);
  assert.equal(starsFor(7, 10), 2);
  assert.equal(starsFor(5, 10), 1);
  assert.equal(starsFor(4, 10), 0);
  assert.equal(starsFor(0, 0), 0);
});
t('XP = 对数*10 + 星*5', () => assert.equal(xpFor(10, 3), 115));

console.log('FSRS (fsrs.ts):');
t('新卡：New 态、今日到期', () => {
  const c = emptyCard(NOW);
  assert.equal(c.state, 0);
  assert.ok(isDue(c, NOW));
});
t('新卡四档下次间隔 = 1/2/3/8 天', () => {
  const p = previewDays(undefined, NOW);
  assert.equal(p[Rating.Again], 1);
  assert.equal(p[Rating.Hard], 2);
  assert.equal(p[Rating.Good], 3);
  assert.equal(p[Rating.Easy], 8);
});
t('Good 评分 → Review 态、约 3 天', () => {
  const c = gradeCard(undefined, Rating.Good, NOW);
  assert.equal(c.state, 2);
  assert.equal(c.scheduled_days, 3);
  assert.ok(!isDue(c, NOW));
});
t('markWrongCard(无卡) → 今日到期', () => assert.ok(isDue(markWrongCard(undefined, NOW), NOW)));
t('isMastered：Review 且间隔≥21 天', () => {
  assert.equal(isMastered({ state: 2, scheduled_days: 30, stability: 30 }), true);
  assert.equal(isMastered({ state: 2, scheduled_days: 10, stability: 10 }), false);
  assert.equal(isMastered({ state: 0, scheduled_days: 30, stability: 30 }), false);
});
t('intervalLabel', () => {
  assert.equal(intervalLabel(0), '<1天');
  assert.equal(intervalLabel(3), '3 天');
  assert.ok(intervalLabel(60).includes('个月'));
  assert.ok(intervalLabel(800).includes('年'));
});

console.log('progress selectors:');
const levels = [
  { group: 1, ready: true, readyCount: 10, words: [], readyWords: [], count: 10 },
  { group: 2, ready: true, readyCount: 10, words: [], readyWords: [], count: 10 },
];
t('summarize 覆盖/已学', () => {
  const prog = baseProgress({ levels: { 1: { completed: true, stars: 3, bestScore: 9, attempts: 1 } } });
  const s = summarize(levels, prog);
  assert.equal(s.totalWords, 20);
  assert.equal(s.learnedWords, 10);
  assert.equal(s.clearedCount, 1);
});
t('dueReviewIds：到期才出', () => {
  const due = markWrongCard(undefined, NOW); // 今日到期
  const future = gradeCard(undefined, Rating.Easy, NOW); // +8 天
  const prog = baseProgress({ cards: { 5: { miss: 1, card: due }, 6: { miss: 1, card: future } } });
  const ids = dueReviewIds(prog, NOW);
  assert.ok(ids.includes('5'));
  assert.ok(!ids.includes('6'));
});

console.log('stats (computeStats):');
t('覆盖/分布/到期 基本正确(已掌握卡)', () => {
  const cards = {};
  for (let i = 1; i <= 10; i++) cards[i] = { miss: 0, card: masteredCard() }; // 10 张已掌握
  const prog = baseProgress({ levels: { 1: { completed: true, stars: 3, bestScore: 9, attempts: 1 } }, cards, stats: { answered: 10, correct: 8 } });
  const summary = { readyCount: 2, clearedCount: 1, wrongCount: 0, learnedWords: 10, totalWords: 5500, totalGroups: 2 };
  const s = computeStats(prog, summary, { now: NOW });
  assert.equal(s.coverage.learned, 10);
  assert.equal(s.coverage.total, 5500);
  assert.equal(s.mastery.tiers.solid, 10);   // 全词建卡：掌握=isMastered
  assert.equal(s.mastery.tiers.unseen, 5490); // 5500 - 10 已建卡
  assert.ok(s.retention.current !== null);    // 已复习过的卡 → 有保持率
  assert.equal(s.futureDue.days.length, 30);
  assert.ok(s.pace.daysToExam > 0);
});
t('新学/错词卡 → 学习中档(未达掌握)', () => {
  const c = gradeCard(undefined, Rating.Good, NOW); // 低 stability → 学习中
  const prog = baseProgress({ levels: { 1: { completed: true, stars: 3, bestScore: 9, attempts: 1 } }, cards: { 5: { miss: 1, card: c } } });
  const summary = { readyCount: 2, clearedCount: 1, wrongCount: 1, learnedWords: 10, totalWords: 5500, totalGroups: 2 };
  const s = computeStats(prog, summary, { now: NOW });
  assert.equal(s.mastery.tiers.learning, 1);  // 该卡 stability 低 → 学习中
  assert.equal(s.mastery.tiers.solid, 0);     // 未达 21 天 → 未掌握
  assert.equal(s.mastery.tiers.unseen, 5499); // 5500 - 1 已建卡
  assert.ok(s.retention.current !== null);
});

console.log('stats 掌握分档(全词建卡):');
t('未掌握卡计入「学习中」，不计入「已掌握」', () => {
  const cards = { 1: { miss: 0, card: masteredCard() }, 999: { miss: 1, card: gradeCard(undefined, Rating.Good, NOW) } };
  const prog = baseProgress({ levels: { 1: { completed: true, stars: 3, bestScore: 9, attempts: 1 } }, cards });
  const summary = { readyCount: 2, clearedCount: 1, wrongCount: 1, learnedWords: 10, totalWords: 5500, totalGroups: 2 };
  const s = computeStats(prog, summary, { now: NOW });
  assert.equal(s.mastery.tiers.solid, 1);     // 仅 1 张已掌握
  assert.equal(s.mastery.tiers.learning, 1);  // 999 学习中
  assert.equal(s.mastery.tiers.unseen, 5498); // 5500 - 2 已建卡
});
t('广义词典 d: 词不计入词库分档', () => {
  const c = gradeCard(undefined, Rating.Good, NOW);
  const prog = baseProgress({ levels: { 1: { completed: true, stars: 3, bestScore: 9, attempts: 1 } }, cards: { 'd:foo': { miss: 1, card: c } } });
  const summary = { readyCount: 2, clearedCount: 1, wrongCount: 1, learnedWords: 10, totalWords: 5500, totalGroups: 2 };
  const s = computeStats(prog, summary, { now: NOW });
  assert.equal(s.mastery.tiers.learning, 0);  // d: 词被排除
  assert.equal(s.mastery.tiers.solid, 0);
  assert.equal(s.mastery.tiers.unseen, 5500); // d: 不算已接触
});

console.log('finishLevel 全词建卡(答对/答错都建卡):');
t('答对已在卡池的词→不删，按 FSRS 重排(Good)', () => {
  const due = markWrongCard(undefined, NOW); // 词5在池、今日到期
  const state = baseProgress({ cards: { 5: { miss: 1, lapseTs: NOW.getTime(), card: due } } });
  const next = reducer(state, { type: 'finishLevel', payload: { group: 1, correct: 1, total: 1, stars: 3, xpGain: 35, wrongIds: [], correctIds: [5] } });
  assert.ok(next.cards[5], '答对一次不应移除该卡');
  assert.ok(next.cards[5].card.scheduled_days >= 1, '应被 FSRS 排到未来(Good)');
  assert.equal(next.cards[5].lapseTs, undefined, '答对应清除「今日重温」标记');
});
t('答对不在卡池的词→也建卡(全词建卡)', () => {
  const next = reducer(baseProgress({}), { type: 'finishLevel', payload: { group: 1, correct: 1, total: 1, stars: 3, xpGain: 35, wrongIds: [], correctIds: [7] } });
  assert.ok(next.cards[7] && next.cards[7].card, '答对的新词也应建卡');
  assert.equal(next.cards[7].miss || 0, 0); // 答对无失误
});
t('答错→建卡(New 态/今日到期)并标记今日重温', () => {
  const next = reducer(baseProgress({}), { type: 'finishLevel', payload: { group: 1, correct: 0, total: 1, stars: 0, xpGain: 0, wrongIds: [9], correctIds: [] } });
  assert.ok(next.cards[9] && next.cards[9].card, '答错应建卡且有 FSRS 卡');
  assert.equal(next.cards[9].card.state, 0); // New = 今日到期
  assert.equal(next.cards[9].miss, 1);
  assert.ok(next.cards[9].lapseTs, '答错应置 lapseTs(进今日重温)');
});
t('0 星失败不通关、不解锁、不计首次新学', () => {
  const today = dayKey();
  const next = reducer(baseProgress({}), { type: 'finishLevel', payload: { group: 1, correct: 4, total: 10, stars: 0, xpGain: 40, wrongIds: [1], correctIds: [2] } });
  assert.equal(next.levels[1].completed, false);
  assert.equal(next.levels[1].attempts, 1);
  assert.equal(next.newHistory[today] || 0, 0);
  const states = computeLevelStates(levels, next);
  assert.equal(states[0].state, 'unlocked');
  assert.equal(states[1].state, 'locked');
});

console.log('手动生词按天记录:');
t('主动记入按本地日期去重，重复点击不虚增 miss', () => {
  const today = dayKey();
  const once = reducer(baseProgress({}), { type: 'markWrong', ids: [5, 5, 'd:context'] });
  assert.deepEqual(once.savedWordHistory[today], ['5', 'd:context']);
  assert.equal(once.cards[5].miss, 1);
  const twice = reducer(once, { type: 'markWrong', ids: [5] });
  assert.equal(twice.cards[5].miss, 1);
  assert.deepEqual(twice.savedWordHistory[today], ['5', 'd:context']);
});

console.log('阅读切句:');
t('末句没有句号也不会被丢弃', () => {
  const s = splitEnSentences('This is the first complete sentence. This final sentence has no punctuation');
  assert.equal(s.length, 2);
  assert.equal(s[1], 'This final sentence has no punctuation');
});

t('下一关选择不会越过锁定状态', () => {
  const states = computeLevelStates(levels, baseProgress({}));
  assert.equal(nextEnterableGroup(states, 1), null);
});

t('复习评分立即结算 XP 和今日词次', () => {
  const today = dayKey();
  const card = markWrongCard(undefined, NOW);
  const next = reducer(baseProgress({ cards: { 5: { miss: 1, card } } }), { type: 'reviewGrade', id: 5, grade: Rating.Good });
  assert.equal(next.xp, 2);
  assert.equal(next.history[today], 1);
  assert.equal(next.reviewHistory[today], 1);
});

t('新用户先改每日目标，首次学习仍从连续 1 天开始', () => {
  const goalSet = reducer(baseProgress({}), { type: 'setGoal', goal: 30 });
  assert.equal(goalSet.daily.streak, 0);
  const studied = reducer(goalSet, { type: 'studyActivity', words: 1 });
  assert.equal(studied.daily.streak, 1);
  assert.equal(studied.daily.count, 1);
});

console.log('真题阅读双分库:');
const passageData = JSON.parse(readFileSync(new URL('../public/data/passages.json', import.meta.url), 'utf8'));
t('篇目 ID 唯一且英语一/二都存在', () => {
  const ids = passageData.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(passageData.some((p) => p.exam === 'english1'));
  assert.ok(passageData.some((p) => p.exam === 'english2'));
});
t('英语一保留既有 52 个完成记录 ID', () => {
  const expectedYears = [...Array.from({ length: 11 }, (_, i) => 2010 + i), 2022, 2023];
  const expectedIds = expectedYears.flatMap((year) => [1, 2, 3, 4].map((text) => `ky-${year}-t${text}`));
  const actualIds = passageData.filter((p) => p.exam === 'english1').map((p) => p.id);
  assert.deepEqual(actualIds, expectedIds);
});
t('英语二 2010-2026 共 68 篇且逐句译文完整', () => {
  const english2 = passageData.filter((p) => p.exam === 'english2');
  assert.equal(english2.length, 68);
  assert.deepEqual([...new Set(english2.map((p) => p.year))], Array.from({ length: 17 }, (_, i) => 2010 + i));
  for (const year of Array.from({ length: 17 }, (_, i) => 2010 + i)) {
    const yearly = english2.filter((p) => p.year === year);
    assert.deepEqual(yearly.map((p) => p.text), [1, 2, 3, 4]);
    assert.deepEqual(yearly.map((p) => p.id), [1, 2, 3, 4].map((text) => `ky-e2-${year}-t${text}`));
  }
  assert.ok(english2.every((p) => p.sents.length > 0 && p.sents.every((s) => s.cn)));
});
t('exam 与内置篇目 ID 严格对应，英语一逐句译文完整', () => {
  assert.ok(passageData.every((p) => p.exam === 'english2' ? p.id.startsWith('ky-e2-') : /^ky-\d{4}-t[1-4]$/.test(p.id)));
  const english1 = passageData.filter((p) => p.exam === 'english1');
  assert.equal(english1.length, 52);
  assert.ok(english1.every((p) => p.sents.length > 0 && p.sents.every((s) => s.cn)));
});
t('英语二每篇正好 3 个长难句拆解', () => {
  const english2 = passageData.filter((p) => p.exam === 'english2');
  assert.ok(english2.every((p) => p.sents.filter((s) => s.analysis).length === 3));
});

console.log('跨平台 PDF 保存:');
t('导出标题会清理跨平台非法文件名字符', () => {
  assert.equal(sanitizePdfDocumentName('  2026/错词:*?"<>|.pdf  '), '2026-错词');
  assert.equal(sanitizePdfDocumentName('CON'), '_CON');
  assert.equal(sanitizePdfDocumentName('...'), '考研词关');
  assert.equal(makePdfFileName('每日生词.pdf'), '每日生词.pdf');
});
t('电脑、Android、iPhone/iPad、移动浏览器均说明直接生成 PDF', () => {
  for (const platform of ['desktop-web', 'android-native', 'ios-web', 'mobile-web']) {
    const help = pdfSaveInstructions(platform);
    assert.match(help, /PDF/);
    assert.match(help, /直接生成/);
    assert.doesNotMatch(help, /打印/);
  }
});
t('Web 保存能力按电脑选择器、移动分享、真实下载依次降级', () => {
  assert.equal(choosePdfWebMethod('desktop-web', { filePicker: true, shareFiles: true }), 'file-picker');
  assert.equal(choosePdfWebMethod('ios-web', { filePicker: false, shareFiles: true }), 'share');
  assert.equal(choosePdfWebMethod('mobile-web', { filePicker: false, shareFiles: false }), 'download');
  assert.equal(choosePdfWebMethod('desktop-web', { filePicker: false, shareFiles: false }), 'download');
});
t('PDF 分页和栏数覆盖 0/1/30/31/100 边界', () => {
  assert.equal(pdfPageCount(0, 30), 0);
  assert.equal(pdfPageCount(1, 30), 1);
  assert.equal(pdfPageCount(30, 30), 1);
  assert.equal(pdfPageCount(31, 30), 2);
  assert.equal(pdfPageCount(100, 100), 1);
  assert.deepEqual([20, 30, 50, 100].map(pdfColumnsFor), [2, 3, 4, 5]);
});
t('PDF 文本清理控制符但保留中文和 IPA', () => {
  assert.equal(sanitizePdfText('  影响\u0000  /ɪnfluəns/  '), '影响 /ɪnfluəns/');
});
t('PDF 字体按实际 cmap 回退，构建清单无运行时缺字', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/fonts/pdf/font-subset-manifest.json', import.meta.url), 'utf8'));
  const manifestFallback = manifest.scFallbackCodepoints.map((value) => Number.parseInt(value.slice(2), 16));
  assert.deepEqual(manifestFallback, [...PDF_SC_FALLBACK_CODEPOINTS]);
  assert.deepEqual(manifest.runtimeMissingCodepoints, []);
  assert.equal(pdfFontNameForCharacter('A'), 'WordQuestSans');
  assert.equal(pdfFontNameForCharacter('│'), 'WordQuestSansSC');
  assert.equal(pdfFontNameForCharacter('①'), 'WordQuestSansSC');
  assert.equal(pdfFontNameForCharacter('中'), 'WordQuestSansSC');
});
await ta('真实 PDF 可解析、两页、含中文/IPA 且文件头正确', async () => {
  const fontNames = ['WordQuestSansSC-Regular.ttf', 'WordQuestSans-Regular.ttf', 'WordQuestSans-Bold.ttf'];
  const vfs = Object.fromEntries(fontNames.map((name) => [
    name,
    readFileSync(new URL(`../public/fonts/pdf/${name}`, import.meta.url)).toString('base64'),
  ]));
  const vocab = JSON.parse(readFileSync(new URL('../public/data/vocab-index.json', import.meta.url), 'utf8')).slice(0, 31);
  vocab[0] = { ...vocab[0], word: 'influence', phonetic: '/ˈɪnfluəns/', pos: 'n./v.', base_meaning: '影响；势力；│肢；有影响的人或事' };
  const bytes = await generateVocabularyPdfBytes({ title: '每日生词 · 解析验收', words: vocab, perPage: 30 }, vfs);
  assert.equal(new TextDecoder('ascii').decode(bytes.subarray(0, 5)), '%PDF-');
  assert.ok(bytes.length > 50_000);
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  try {
    assert.equal(pdf.numPages, 2);
    let extracted = '';
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const content = await (await pdf.getPage(pageNo)).getTextContent();
      extracted += content.items.map((item) => 'str' in item ? item.str : '').join(' ');
    }
    const compact = extracted.replace(/\s+/g, '');
    assert.match(compact, /每日生词/);
    assert.match(compact, /influence/);
    assert.match(compact, /ɪnfluəns/);
    assert.match(compact, /影响/);
    assert.match(compact, /│肢/);
  } finally {
    await pdf.destroy();
  }
});

await ta('多页连续生成时页数、全局序号与末词不丢失', async () => {
  const fontNames = ['WordQuestSansSC-Regular.ttf', 'WordQuestSans-Regular.ttf', 'WordQuestSans-Bold.ttf'];
  const vfs = Object.fromEntries(fontNames.map((name) => [
    name,
    readFileSync(new URL(`../public/fonts/pdf/${name}`, import.meta.url)).toString('base64'),
  ]));
  const words = Array.from({ length: 301 }, (_, index) => ({
    id: index + 1,
    word: `batchword${index + 1}`,
    phonetic: '/test/',
    pos: 'n.',
    base_meaning: `多页释义${index + 1}`,
  }));
  const blob = await generateVocabularyPdfBlob({ title: '多页连续验收', words, perPage: 30 }, vfs);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(new TextDecoder('ascii').decode(bytes.subarray(0, 5)), '%PDF-');
  const pdf = await getDocument({ data: bytes }).promise;
  try {
    assert.equal(pdf.numPages, 11);
    const lastPage = await (await pdf.getPage(pdf.numPages)).getTextContent();
    const compact = lastPage.items.map((item) => 'str' in item ? item.str : '').join('').replace(/\s+/g, '');
    assert.match(compact, /301\.batchword301/);
    assert.match(compact, /多页释义301/);
  } finally {
    await pdf.destroy();
  }
});

await ta('离开导出页后可取消尚未开始的 PDF 生成', async () => {
  const fontNames = ['WordQuestSansSC-Regular.ttf', 'WordQuestSans-Regular.ttf', 'WordQuestSans-Bold.ttf'];
  const vfs = Object.fromEntries(fontNames.map((name) => [
    name,
    readFileSync(new URL(`../public/fonts/pdf/${name}`, import.meta.url)).toString('base64'),
  ]));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    generateVocabularyPdfBlob({
      title: '取消验收',
      words: [{ id: 1, word: 'cancel', phonetic: '/ˈkænsəl/', pos: 'v.', base_meaning: '取消' }],
      perPage: 30,
      signal: controller.signal,
    }, vfs),
    (error) => error?.name === 'AbortError',
  );
});

t('PWA 安装阶段明确预缓存 PDF 动态分包和三套字体', () => {
  const workerSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const viteSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(viteSource, /manifest:\s*['"]asset-manifest\.json['"]/);
  assert.match(workerSource, /precachePdfExporter/);
  assert.match(workerSource, /src\/lib\/pdfDocument\.ts/);
  assert.equal((workerSource.match(/WordQuestSans(?:SC)?-(?:Regular|Bold)\.ttf/g) || []).length, 3);
});

t('导出主流程已彻底移除打印 API，Android 使用创建文档选择器', () => {
  const saveSource = readFileSync(new URL('../src/lib/pdfSave.ts', import.meta.url), 'utf8');
  const viewSource = readFileSync(new URL('../src/screens/PrintView.tsx', import.meta.url), 'utf8');
  const androidSource = readFileSync(new URL('../android/app/src/main/java/com/wordquest/kaoyan/NativePdfSavePlugin.java', import.meta.url), 'utf8');
  assert.doesNotMatch(saveSource + viewSource, /window\.print\s*\(/);
  assert.doesNotMatch(androidSource, /PrintManager|\.print\s*\(/);
  assert.doesNotMatch(androidSource, /call\.getLong\s*\(/);
  assert.match(androidSource, /ACTION_CREATE_DOCUMENT/);
  assert.match(androidSource, /application\/pdf/);
  assert.match(androidSource, /instanceof Number/);
  assert.match(androidSource, /MAX_BASE64_CHARS/);
  assert.match(androidSource, /AtomicBoolean/);
  assert.match(androidSource, /openOutputStream\(target, "rwt"\)/);
  assert.match(androidSource, /DocumentsContract\.deleteDocument/);
  assert.match(viewSource, /disabled=\{saving \|\| generating\}/);
  assert.equal(existsSync(new URL('../src/lib/nativePrint.ts', import.meta.url)), false);
  assert.equal(existsSync(new URL('../android/app/src/main/java/com/wordquest/kaoyan/NativePrintPlugin.java', import.meta.url)), false);
});

function baseProgress(over) {
  return {
    v: 1, themeKey: 'mo', xp: 0, combo: 0, bestCombo: 0,
    levels: {}, cards: {}, daily: null, history: {}, newHistory: {}, reviewHistory: {}, timeHistory: {}, savedWordHistory: {},
    revlog: [], stats: { answered: 0, correct: 0 }, sound: true, accent: 'us', examDate: '2026-12-21', userNotes: {},
    ...over,
  };
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
