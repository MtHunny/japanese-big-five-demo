import { isAnswer, scoreAnswers } from './scoring.mjs';

export const STORAGE_KEY = 'big-five-demo:in-progress:v1';
export const TRANSITION_MS = 280;
const emptyAnswers = () => Array(50).fill(null);

// 連続して回答した途中データのみ受け入れる。完了データ・破損データから結果を復元しない。
export function isSavedSession(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.answers) || value.answers.length !== 50) return false;
  let answered = 0;
  let foundEmpty = false;
  for (const answer of value.answers) {
    if (answer === null) foundEmpty = true;
    else if (!isAnswer(answer) || foundEmpty) return false;
    else answered += 1;
  }
  return answered > 0 && answered < 50 && Number.isInteger(value.currentIndex)
    && value.currentIndex >= 0 && value.currentIndex <= answered;
}

export class AssessmentSession {
  constructor({ storage, schedule = (callback, delay) => setTimeout(callback, delay), onChange = () => {} } = {}) {
    this.storage = storage;
    this.schedule = schedule;
    this.onChange = onChange;
    this.screen = 'start';
    this.answers = emptyAnswers();
    this.currentIndex = 0;
    this.results = null;
    this.locked = false;
    this.storageNotice = '';
    this.saved = this.readSaved();
  }

  readSaved() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw === null) return null;
      let parsed;
      try { parsed = JSON.parse(raw); } catch { /* 下で破損データを削除 */ }
      if (isSavedSession(parsed)) return parsed;
      this.removeSaved();
    } catch {
      this.storageNotice = 'このブラウザでは途中回答を読み込めません。回答はできますが、再読み込みや画面を閉じると続きから再開できない場合があります。';
    }
    return null;
  }

  persist(nextIndex = this.currentIndex) {
    const value = { version: 1, answers: [...this.answers], currentIndex: nextIndex };
    this.saved = this.answers.some(isAnswer) ? value : null;
    if (!this.saved) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      this.storageNotice = '途中回答をブラウザに保存できません。この画面では続けられますが、再読み込みや画面を閉じると回答が失われる場合があります。';
    }
  }

  removeSaved() {
    this.saved = null;
    try {
      this.storage.removeItem(STORAGE_KEY);
    } catch {
      this.storageNotice = '途中回答の保存データを削除できませんでした。このサイトのデータをブラウザの設定から削除してください。';
    }
  }

  startFresh() {
    if (this.locked) return false;
    this.removeSaved();
    this.answers = emptyAnswers();
    this.currentIndex = 0;
    this.results = null;
    this.screen = 'question';
    this.onChange();
    return true;
  }

  resume() {
    if (this.locked || !isSavedSession(this.saved)) return false;
    this.answers = [...this.saved.answers];
    this.currentIndex = this.saved.currentIndex;
    this.results = null;
    this.screen = 'question';
    this.onChange();
    return true;
  }

  answer(value) {
    if (this.screen !== 'question' || this.locked || !isAnswer(value)) return false;
    this.locked = true;
    this.answers[this.currentIndex] = value;
    const complete = this.answers.every(isAnswer);
    if (complete) {
      this.results = scoreAnswers(this.answers);
      this.removeSaved();
    } else {
      this.persist(Math.min(this.currentIndex + 1, 49));
    }
    this.onChange();
    this.schedule(() => {
      if (complete) {
        this.screen = 'result';
        this.answers = emptyAnswers();
      } else {
        this.currentIndex += 1;
      }
      this.locked = false;
      this.onChange();
    }, TRANSITION_MS);
    return true;
  }

  back() {
    if (this.screen !== 'question' || this.locked || this.currentIndex === 0) return false;
    this.currentIndex -= 1;
    this.persist();
    this.onChange();
    return true;
  }

  pause() {
    if (this.screen !== 'question' || this.locked) return false;
    this.persist();
    this.screen = 'start';
    this.onChange();
    return true;
  }

  returnToStart() {
    if (this.locked) return false;
    this.results = null;
    this.answers = emptyAnswers();
    this.currentIndex = 0;
    this.screen = 'start';
    this.onChange();
    return true;
  }
}
