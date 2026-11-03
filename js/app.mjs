import { QUESTIONS } from './questions.mjs';
import { FACTORS, validateScale } from './scoring.mjs';
import { AssessmentSession } from './session.mjs';

validateScale(FACTORS, QUESTIONS.length);
const byId = (id) => document.getElementById(id);
const answerButtons = [...document.querySelectorAll('[data-value]')];
const screens = ['start', 'question', 'result'];
let previousView = '';
let displayedResults = null;
// localStorageへのアクセス自体が拒否されるブラウザでも、メモリ上では回答を続けられる。
const storage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};
const session = new AssessmentSession({ storage, onChange: render });

function renderResults() {
  if (displayedResults === session.results) return;
  displayedResults = session.results;
  const cards = session.results.map((result, index) => {
    const factor = FACTORS[index];
    const card = document.createElement('article');
    card.className = `result-card factor-${index}`;
    const heading = document.createElement('div');
    heading.className = 'factor-heading';
    const title = document.createElement('h2');
    title.textContent = result.name;
    const score = document.createElement('p');
    score.className = 'factor-score';
    const number = document.createElement('strong');
    number.textContent = result.score;
    score.append(number, ' / 50 点');
    heading.append(title, score);
    const meter = document.createElement('meter');
    meter.className = 'factor-meter';
    meter.min = 10;
    meter.max = 50;
    meter.value = result.score;
    meter.setAttribute('aria-label', `${result.name}：${result.score}点（10〜50点）`);
    meter.textContent = `${result.score}点`;
    const axis = document.createElement('div');
    axis.className = 'chart-axis';
    for (const tick of [10, 20, 30, 40, 50]) {
      const label = document.createElement('span');
      label.textContent = tick;
      axis.append(label);
    }
    const description = document.createElement('p');
    description.className = 'factor-description';
    description.textContent = factor.description;
    card.append(heading, meter, axis, description);
    return card;
  });
  byId('result-cards').replaceChildren(...cards);
}

function render() {
  for (const screen of screens) byId(`${screen}-screen`).hidden = screen !== session.screen;
  byId('storage-notice').hidden = !session.storageNotice;
  byId('storage-notice').textContent = session.storageNotice;
  if (session.screen === 'start') {
    byId('resume-panel').hidden = !session.saved;
    byId('start-button').textContent = session.saved ? '最初から回答' : '回答をはじめる →';
    byId('start-button').className = session.saved ? 'secondary-button' : 'primary-button';
    byId('start-button').disabled = false;
    if (session.saved) {
      const count = session.saved.answers.filter((value) => value !== null).length;
      byId('resume-description').textContent = `途中の回答があります（${count} / 50問 回答済み）。`;
    }
  } else if (session.screen === 'question') {
    const index = session.currentIndex;
    byId('question-progress').textContent = `${index + 1} / 50`;
    byId('progress').value = session.answers.filter((value) => value !== null).length;
    byId('question-number').textContent = `QUESTION ${String(index + 1).padStart(2, '0')}`;
    byId('question-title').textContent = QUESTIONS[index];
    for (const button of answerButtons) {
      button.disabled = session.locked;
      button.setAttribute('aria-pressed', String(Number(button.dataset.value) === session.answers[index]));
    }
    byId('back-button').disabled = index === 0 || session.locked;
    byId('pause-button').disabled = session.locked;
    byId('answer-feedback').textContent = session.locked ? '回答を選択しました' : '';
  } else {
    renderResults();
    byId('completion-note').textContent = session.storageNotice
      ? '結果はこの画面のメモリ上にのみ保持しています。再読み込みすると消えます。保存に関するお知らせもご確認ください。'
      : '途中回答の保存データは削除しました。結果は再読み込みすると消え、回答履歴は残りません。';
  }
  const view = `${session.screen}:${session.screen === 'question' ? session.currentIndex : ''}`;
  if (previousView && previousView !== view) {
    const title = byId(session.screen === 'question' ? 'question-title' : `${session.screen === 'start' ? 'start' : 'result'}-title`);
    title.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  previousView = view;
}

for (const button of answerButtons) {
  button.addEventListener('click', (event) => {
    // 押しっぱなしのキーリピートや、同じ位置へのダブルクリックを受け付けない。
    if (event.detail > 1) return;
    session.answer(Number(button.dataset.value));
  });
  button.addEventListener('keydown', (event) => {
    if (event.repeat) event.preventDefault();
  });
}
byId('start-button').addEventListener('click', () => session.startFresh());
byId('resume-button').addEventListener('click', () => session.resume());
byId('back-button').addEventListener('click', () => session.back());
byId('pause-button').addEventListener('click', () => session.pause());
byId('restart-button').addEventListener('click', () => session.returnToStart());
render();
