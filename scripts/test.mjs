/* 纯函数单测（无需框架，node 直接跑）：node scripts/test.mjs
   覆盖 game/quiz.js 与 lib/shuffle.js 的核心逻辑。 */
import assert from 'node:assert';
import { checkSpelling, shortMeaning, tallyResult, buildQuiz } from '../src/game/quiz.js';
import { shuffle, sample } from '../src/lib/shuffle.js';

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ✓', name);
  } catch (e) {
    fail++;
    console.log('  ✗', name, '\n      ', e.message);
  }
}

console.log('checkSpelling:');
t('精确匹配', () => assert.equal(checkSpelling('abandon', 'abandon'), true));
t('忽略大小写', () => assert.equal(checkSpelling('Abandon', 'abandon'), true));
t('忽略首尾空格', () => assert.equal(checkSpelling('  abandon  ', 'abandon'), true));
t('忽略尾部标点', () => assert.equal(checkSpelling('abandon.', 'abandon'), true));
t('折叠中间空格(短语)', () => assert.equal(checkSpelling('new   paragraph', 'new paragraph'), true));
t('拒绝错拼', () => assert.equal(checkSpelling('abandun', 'abandon'), false));

console.log('shortMeaning:');
t('短释义原样返回', () => assert.equal(shortMeaning('放弃'), '放弃'));
t('长释义截到首义', () => {
  const full = '智力的；聪明的；理智的；知识分子；凭理智做事者';
  const s = shortMeaning(full);
  assert.ok(s.length < full.length, '应被截短');
  assert.ok(s.startsWith('智力的'), '应保留首义');
});

console.log('tallyResult:');
t('正确统计对错与 id', () => {
  const qs = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const r = tallyResult(qs, [true, false, true]);
  assert.equal(r.correct, 2);
  assert.equal(r.total, 3);
  assert.deepEqual(r.wrongIds, [2]);
  assert.deepEqual(r.correctIds, [1, 3]);
});

console.log('buildQuiz:');
const words = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  word: 'word' + i,
  base_meaning: '释义' + i,
  phonetic: '/p/',
  pos: 'n.',
}));
t('每词一题', () => assert.equal(buildQuiz(words, words).length, 10));
t('题型合法', () =>
  assert.ok(buildQuiz(words, words).every((q) => ['choice', 'cn2en', 'spell'].includes(q.type))));
t('选择题含正确项且不超 4 项', () => {
  const q = buildQuiz(words, words).find((x) => x.type === 'choice');
  if (q) {
    assert.ok(q.options.includes(q.answer), '选项应含答案');
    assert.ok(q.options.length >= 1 && q.options.length <= 4);
    assert.equal(new Set(q.options).size, q.options.length, '选项不应重复');
  }
});
t('混合多种题型', () => {
  const types = new Set(buildQuiz(words, words).map((q) => q.type));
  assert.ok(types.size >= 2, '应至少两种题型');
});
t('每题挂上对应词条', () =>
  assert.ok(buildQuiz(words, words).every((q) => q.w && q.id === q.w.id)));

console.log('shuffle:');
t('洗牌保留全部元素', () => {
  const a = [1, 2, 3, 4, 5];
  const s = shuffle(a);
  assert.deepEqual([...s].sort((x, y) => x - y), [1, 2, 3, 4, 5]);
  assert.equal(a.length, 5, '不应改动原数组');
});
t('sample 取 n 个', () => assert.equal(sample([1, 2, 3, 4, 5], 3).length, 3));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
