/* 纯函数单测，用 tsx 跑 TS 源：npm test (= tsx scripts/test.mjs) */
import assert from 'node:assert';
import { shortMeaning, tallyResult, buildQuiz } from '../src/game/quiz';
import { shuffle, sample } from '../src/lib/shuffle';
import { emptyCard, gradeCard, markWrongCard, isMastered, isDue, previewDays, intervalLabel, Rating } from '../src/lib/fsrs';
import { computeStats } from '../src/lib/stats';
import { starsFor, xpFor, summarize, dueReviewIds } from '../src/state/progress';
import { reducer } from '../src/state/useProgress';

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

function baseProgress(over) {
  return {
    v: 1, themeKey: 'mo', xp: 0, combo: 0, bestCombo: 0,
    levels: {}, cards: {}, daily: null, history: {}, newHistory: {}, reviewHistory: {}, timeHistory: {},
    revlog: [], stats: { answered: 0, correct: 0 }, sound: true, accent: 'us', examDate: '2026-12-21', userNotes: {},
    ...over,
  };
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
