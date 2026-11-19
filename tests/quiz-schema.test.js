import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepsFor, isValidAnswers, toggleMulti, labelFor, QUESTIONS, ASSEMBLY } from '../public/js/quiz-schema.js';

const base = { need: 'build', purpose: ['gaming'], parts: ['gpu'], budget: 'lt3', timing: 'now', delivery: 'pickup' };

test('stepsFor: ветка комплектующих и ветка периферии', () => {
  assert.deepEqual(stepsFor({ need: 'build' }), ['need', 'purpose', 'parts', 'budget', 'timing', 'delivery']);
  assert.deepEqual(stepsFor({ need: 'peripherals' }), ['need', 'purpose', 'peripherals', 'budget', 'timing', 'delivery']);
  assert.equal(stepsFor({}).length, 6);
});

test('isValidAnswers: корректные ответы', () => {
  const r = isValidAnswers(base);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, base);
});

test('isValidAnswers: неизвестный ID, пустой массив, повторы', () => {
  assert.deepEqual(isValidAnswers({ ...base, need: 'rocket' }).errors, ['answers.need']);
  assert.deepEqual(isValidAnswers({ ...base, purpose: [] }).errors, ['answers.purpose']);
  assert.deepEqual(isValidAnswers({ ...base, purpose: ['gaming', 'gaming'] }).errors, ['answers.purpose']);
  assert.deepEqual(isValidAnswers({ ...base, parts: ['gpu', 'mouse'] }).errors, ['answers.parts']);
});

test('isValidAnswers: исключающий вариант нельзя совмещать', () => {
  assert.deepEqual(isValidAnswers({ ...base, parts: ['gpu', 'unsure'] }).errors, ['answers.parts']);
  assert.equal(isValidAnswers({ ...base, parts: ['unsure'] }).ok, true);
});

test('isValidAnswers: чужая ветка отбрасывается, своя обязательна', () => {
  const r = isValidAnswers({ ...base, need: 'peripherals', peripherals: ['mouse'] });
  assert.equal(r.ok, true);
  assert.equal(r.value.parts, undefined);
  assert.deepEqual(isValidAnswers({ ...base, need: 'peripherals' }).errors, ['answers.peripherals']);
});

test('isValidAnswers: город обязателен для доставки в регион', () => {
  assert.deepEqual(isValidAnswers({ ...base, delivery: 'region' }).errors, ['answers.city']);
  assert.deepEqual(isValidAnswers({ ...base, delivery: 'region', city: 'A' }).errors, ['answers.city']);
  const r = isValidAnswers({ ...base, delivery: 'region', city: '  Самарканд  ' });
  assert.equal(r.ok, true);
  assert.equal(r.value.city, 'Самарканд');
  assert.equal(isValidAnswers({ ...base, city: 'Бухара' }).value.city, undefined);
});

test('isValidAnswers: мусор на входе', () => {
  assert.equal(isValidAnswers(null).ok, false);
  assert.equal(isValidAnswers([]).ok, false);
  assert.equal(isValidAnswers({ ...base, budget: ['lt3'] }).ok, false);
});

test('toggleMulti: исключающие варианты снимают остальные и наоборот', () => {
  assert.deepEqual(toggleMulti('parts', ['gpu', 'cpu'], 'unsure'), ['unsure']);
  assert.deepEqual(toggleMulti('parts', ['unsure'], 'gpu'), ['gpu']);
  assert.deepEqual(toggleMulti('parts', ['gpu'], 'gpu'), []);
  assert.deepEqual(toggleMulti('purpose', ['gaming'], 'work'), ['gaming', 'work']);
});

test('labelFor и чертёж совпадают со схемой', () => {
  assert.equal(labelFor('budget', '15_25'), '15–25 млн сум');
  for (const p of ASSEMBLY) assert.ok(QUESTIONS.parts.options[p.id], p.id);
  assert.deepEqual(ASSEMBLY.map((p) => p.pos), [1, 2, 3, 4, 5, 6, 7, 8]);
});
