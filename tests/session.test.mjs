import test from 'node:test';
import assert from 'node:assert/strict';
import { AssessmentSession, STORAGE_KEY, TRANSITION_MS, isSavedSession } from '../js/session.mjs';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

function setup(storage = memoryStorage()) {
  const tasks = [];
  const session = new AssessmentSession({
    storage,
    schedule(callback, delay) {
      assert.equal(delay, TRANSITION_MS);
      tasks.push(callback);
    },
  });
  return { session, storage, tasks, flush: () => tasks.splice(0).forEach((callback) => callback()) };
}

test('標準タイマーでも選択表示後に次問へ進む', async () => {
  let onAdvance;
  const advanced = new Promise((resolve) => { onAdvance = resolve; });
  const session = new AssessmentSession({
    storage: memoryStorage(),
    onChange() {
      if (session.currentIndex === 1) onAdvance();
    },
  });
  session.startFresh();
  session.answer(3);
  assert.equal(session.locked, true);
  await advanced;
  assert.equal(session.currentIndex, 1);
  assert.equal(session.locked, false);
});

test('選択直後に保存し、短い選択表示中は二重回答と遷移を防ぐ', () => {
  const { session, storage, tasks, flush } = setup();
  session.startFresh();
  assert.equal(session.back(), false);
  assert.equal(session.answer(4), true);
  assert.equal(session.currentIndex, 0);
  assert.equal(session.answers[0], 4);
  assert.equal(session.locked, true);
  assert.equal(session.answer(1), false);
  assert.equal(session.back(), false);
  assert.equal(session.pause(), false);
  assert.equal(session.startFresh(), false);
  assert.equal(session.returnToStart(), false);
  assert.equal(session.resume(), false);
  assert.equal(tasks.length, 1);
  const saved = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(saved.currentIndex, 1);
  assert.equal(saved.answers[0], 4);
  flush();
  assert.equal(session.currentIndex, 1);
  assert.equal(session.locked, false);
});

test('再読み込み後は開始画面で途中回答を提示し、続きから再開する', () => {
  const first = setup();
  first.session.startFresh();
  first.session.answer(2);
  // 選択表示中にページを閉じた場合も次問から再開。
  const second = setup(first.storage);
  assert.equal(second.session.screen, 'start');
  assert.equal(second.session.saved.answers[0], 2);
  assert.equal(second.session.results, null);
  assert.equal(second.session.resume(), true);
  assert.equal(second.session.currentIndex, 1);
  assert.equal(second.session.answers[0], 2);
});

test('戻って回答を修正し、中断・再訪しても修正値と表示位置が残る', () => {
  const first = setup();
  first.session.startFresh();
  first.session.answer(2);
  first.flush();
  first.session.answer(3);
  first.flush();
  first.session.back();
  first.session.back();
  assert.equal(first.session.answers[0], 2);
  first.session.answer(5);
  first.flush();
  assert.equal(first.session.currentIndex, 1);
  assert.equal(first.session.answers[1], 3);
  first.session.pause();
  assert.equal(first.session.screen, 'start');
  const second = setup(first.storage);
  second.session.resume();
  assert.equal(second.session.currentIndex, 1);
  assert.equal(second.session.answers[0], 5);
  assert.equal(second.session.answers[1], 3);
  assert.equal(second.session.results, null);
});

test('途中回答があっても最初から開始できる', () => {
  const { session, storage, flush } = setup();
  session.startFresh();
  session.answer(5);
  flush();
  session.pause();
  session.startFresh();
  assert.equal(session.currentIndex, 0);
  assert.ok(session.answers.every((answer) => answer === null));
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(session.saved, null);
});

test('完了時に途中保存のみを削除し、結果はメモリ上に保持、再読み込みで消える', () => {
  const { session, storage, flush } = setup();
  storage.setItem('other-app', 'keep');
  session.startFresh();
  for (let index = 0; index < 49; index += 1) {
    assert.equal(session.answer(3), true);
    flush();
    assert.equal(session.results, null);
  }
  assert.notEqual(storage.getItem(STORAGE_KEY), null);
  session.answer(3);
  assert.equal(storage.getItem(STORAGE_KEY), null, '最後の回答直後に削除');
  assert.equal(storage.getItem('other-app'), 'keep');
  assert.equal(session.answer(1), false);
  flush();
  assert.equal(session.screen, 'result');
  assert.equal(session.answer(1), false);
  assert.deepEqual(session.results.map(({ score }) => score), [30, 30, 30, 30, 30]);
  assert.ok(session.answers.every((answer) => answer === null));
  const reloaded = setup(storage).session;
  assert.equal(reloaded.screen, 'start');
  assert.equal(reloaded.results, null);
  assert.equal(reloaded.saved, null);
  session.returnToStart();
  assert.equal(session.results, null);
});

test('不正な値・開始前・完了後の回答は受理しない', () => {
  const { session, tasks, storage } = setup();
  assert.equal(session.answer(3), false);
  assert.equal(session.resume(), false);
  session.startFresh();
  for (const value of [null, undefined, '3', 0, 6, 2.5, NaN, true]) {
    assert.equal(session.answer(value), false);
  }
  assert.equal(session.results, null);
  assert.equal(session.currentIndex, 0);
  assert.equal(tasks.length, 0);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('破損・旧形式・完了済みの保存データを結果として採用しない', () => {
  const answers = [3, ...Array(49).fill(null)];
  const valid = { version: 1, answers, currentIndex: 1 };
  assert.equal(isSavedSession(valid), true);
  const invalid = [
    '{broken', 'null',
    JSON.stringify({ ...valid, version: 2 }),
    JSON.stringify({ ...valid, currentIndex: 2 }),
    JSON.stringify({ ...valid, currentIndex: -1 }),
    JSON.stringify({ ...valid, currentIndex: 0.5 }),
    JSON.stringify({ ...valid, answers: Array(50).fill(3) }),
    JSON.stringify({ ...valid, answers: Array(50).fill(null) }),
    JSON.stringify({ ...valid, answers: [null, 3, ...Array(48).fill(null)] }),
    JSON.stringify({ ...valid, answers: ['3', ...Array(49).fill(null)] }),
    JSON.stringify({ ...valid, answers: answers.slice(1) }),
  ];
  for (const raw of invalid) {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    const { session } = setup(storage);
    assert.equal(session.saved, null);
    assert.equal(session.results, null);
    assert.equal(storage.getItem(STORAGE_KEY), null);
  }
});

test('保存容量超過やアクセス拒否でも回答でき、保存失敗を通知する', () => {
  const blocked = () => { throw new Error('storage unavailable'); };
  const { session, flush } = setup({ getItem: blocked, setItem: blocked, removeItem: blocked });
  assert.notEqual(session.storageNotice, '');
  session.startFresh();
  for (let index = 0; index < 50; index += 1) {
    assert.equal(session.answer(3), true);
    flush();
  }
  assert.equal(session.screen, 'result');
  assert.deepEqual(session.results.map(({ score }) => score), [30, 30, 30, 30, 30]);
  assert.match(session.storageNotice, /削除できません/);
});
