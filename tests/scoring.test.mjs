import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from '../js/questions.mjs';
import { FACTORS, scoreAnswers, validateScale } from '../js/scoring.mjs';

const totals = (answers) => scoreAnswers(answers).map(({ score }) => score);

test('日本語50項目があり、全項目がちょうど1因子・各因子10項目に対応する', () => {
  assert.equal(QUESTIONS.length, 50);
  assert.ok(QUESTIONS.every((text) => typeof text === 'string' && text.length > 0));
  assert.equal(validateScale(FACTORS, QUESTIONS.length), true);
  assert.deepEqual(FACTORS.map(({ name }) => name), ['外向性', '協調性', '誠実性', '情緒安定性（神経症傾向の反転）', '開放性']);
  assert.deepEqual(FACTORS.map((factor) => factor.positive.length + factor.negative.length), [10, 10, 10, 10, 10]);
  const items = FACTORS.flatMap((factor) => [...factor.positive, ...factor.negative]).sort((a, b) => a - b);
  assert.deepEqual(items, Array.from({ length: 50 }, (_, index) => index + 1));
});

for (const [value, expected] of [
  [3, [30, 30, 30, 30, 30]],
  [5, [30, 34, 34, 18, 38]],
  [1, [30, 26, 26, 42, 22]],
]) {
  test(`全項目${value}の期待得点`, () => {
    const answers = Array(50).fill(value);
    const original = [...answers];
    assert.deepEqual(totals(answers), expected);
    assert.deepEqual(answers, original, '採点は入力配列を変更しない');
  });
}

// キーは仕様から独立に列挙し、採点モジュール自身から期待値を作らない。
const positiveItems = [1, 11, 21, 31, 41, 7, 17, 27, 37, 42, 47, 3, 13, 23, 33, 43, 48, 9, 19, 5, 15, 25, 35, 40, 45, 50];
test('全因子で正方向5・逆方向1なら50点、逆の組み合わせなら10点', () => {
  const maximum = Array.from({ length: 50 }, (_, index) => positiveItems.includes(index + 1) ? 5 : 1);
  assert.deepEqual(totals(maximum), [50, 50, 50, 50, 50]);
  assert.deepEqual(totals(maximum.map((answer) => 6 - answer)), [10, 10, 10, 10, 10]);
});

test('各項目の変化は対応する1因子に、正しい向きでのみ反映される', () => {
  for (let index = 0; index < 50; index += 1) {
    const answers = Array(50).fill(3);
    answers[index] = 4;
    const result = totals(answers);
    assert.equal(result.filter((score) => score !== 30).length, 1);
    const factor = FACTORS.findIndex((entry) => [...entry.positive, ...entry.negative].includes(index + 1));
    assert.equal(result[factor], positiveItems.includes(index + 1) ? 31 : 29);
  }
});

test('未回答・不正値・件数違い・疎配列では採点を確定しない', () => {
  for (const invalid of [null, undefined, 0, 6, -1, 1.5, '3', true, NaN, Infinity, {}, []]) {
    const answers = Array(50).fill(3);
    answers[24] = invalid;
    assert.throws(() => scoreAnswers(answers));
  }
  for (const invalid of [null, {}, '3', Array(49).fill(3), Array(51).fill(3), Array(50)]) {
    assert.throws(() => scoreAnswers(invalid));
  }
});

test('キーの重複・因子の項目数違い・範囲外番号を検出する', () => {
  const copy = () => FACTORS.map((factor) => ({ ...factor, positive: [...factor.positive], negative: [...factor.negative] }));
  const duplicate = copy();
  duplicate[0].positive[0] = 7;
  assert.throws(() => validateScale(duplicate));
  const missing = copy();
  missing[0].negative.pop();
  assert.throws(() => validateScale(missing));
  const outOfRange = copy();
  outOfRange[0].positive[0] = 51;
  assert.throws(() => validateScale(outOfRange));
  assert.throws(() => validateScale(FACTORS, 49));
  assert.throws(() => validateScale(FACTORS.slice(1)));
});
