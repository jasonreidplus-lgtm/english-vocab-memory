/* 纯函数单测，无需框架：node scripts/test.mjs */
import assert from 'node:assert';
import { shortMeaning, tallyResult, buildQuiz } from '../src/game/quiz.js';
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
    console.log('  ✗', name, '\n     ', e.message);
  }
}

console.log('shortMeaning:');
t('短释义原样返回', () => assert.equal(shortMeaning('放弃'), '放弃'));
t('长释义截到首义', () => {
  const full = '智力的；聪明的；理智的；知识分子，凭理智做事者';
  const s = shortMeaning(full);
  assert.ok(s.length < full.length, '应该被截短');
  assert.ok(s.startsWith('智力的'), '应该保留首义');
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
t('题型只包含两种选择题', () =>
  assert.ok(buildQuiz(words, words).every((q) => ['choice', 'cn2en'].includes(q.type))));
t('选择题含正确项且不超 4 项', () => {
  const questions = buildQuiz(words, words);
  for (const q of questions) {
    assert.ok(q.options.includes(q.answer), '选项应该包含答案');
    assert.ok(q.options.length >= 1 && q.options.length <= 4);
    assert.equal(new Set(q.options).size, q.options.length, '选项不应该重复');
  }
});
t('混合两种题型', () => {
  const types = new Set(buildQuiz(words, words).map((q) => q.type));
  assert.deepEqual(types, new Set(['choice', 'cn2en']));
});
t('每题挂上对应词条', () =>
  assert.ok(buildQuiz(words, words).every((q) => q.w && q.id === q.w.id)));

console.log('shuffle:');
t('洗牌保留全部元素', () => {
  const a = [1, 2, 3, 4, 5];
  const s = shuffle(a);
  assert.deepEqual([...s].sort((x, y) => x - y), [1, 2, 3, 4, 5]);
  assert.equal(a.length, 5, '不应该改动原数组');
});
t('sample 取 n 个', () => assert.equal(sample([1, 2, 3, 4, 5], 3).length, 3));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
