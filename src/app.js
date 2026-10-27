// 오타지도 · 화면 동작
// 3차시까지: 세 화면의 배치와 전환, 제시 문장 표시, 경과 시간과 진행,
//            글자별 맞음/틀림 색칠, 키 입력 시각 기록과 자모별 입력 시간.
// 편집 거리로 오류 쌍을 뽑는 일은 4차시에 붙인다.

import { judge, recordKeyTimes, keyDurations, averageByJamo } from './typing.js';
import { decomposeToKeys } from './hangul.js';
import { diffKeys, trackErrors, missingErrors, countErrorPairs, countByType,
         countByKey, accuracy, TYPE_LABEL } from './diff.js';
import { isJamo } from './hangul.js';
import { keyboardLayout } from './keyboard.js';
import { pickWeakJamo, buildPracticeSentence } from './practice.js';
import { WORDS } from './words.js';
import { saveSession, loadSessions, loadCumulativeErrors } from './db.js';

// 기본 진단용 문장. 한 문장 안에 여러 자모가 골고루 들어가도록 골랐다.
const SENTENCES = [
  '교실에서 며칠 동안 효율을 높였다',
  '왼쪽 창가에 앉아 책을 읽는 습관',
  '넓은 운동장을 가로질러 뛰어갔다',
  '희망찬 목소리로 인사를 건네었다',
  '값싼 물건보다 튼튼한 것을 골랐다',
];

// ── 화면 전환 ────────────────────────────────────────────
// 화면을 html 파일 3개로 나누지 않고 한 페이지에 두고 hidden 으로 바꾼다.
// 페이지가 넘어가면 연습 중 모은 데이터가 전부 사라지기 때문이다.
const screens = {
  practice: document.getElementById('screen-practice'),
  result:   document.getElementById('screen-result'),
  record:   document.getElementById('screen-record'),
};

function show(name) {
  // 연습 화면을 떠나면 시계를 멈춘다.
  // 완료 버튼에만 걸어 두면 '기록 보기'로 나갔을 때 시계가 계속 돌아간다.
  if (name !== 'practice') stopTimer();
  for (const [key, el] of Object.entries(screens)) el.hidden = (key !== name);
  if (name === 'record') loadRecordScreen();
}

// ── 연습 화면 ────────────────────────────────────────────
const targetEl   = document.getElementById('target-text');
const inputEl    = document.getElementById('typing-input');
const elapsedEl  = document.getElementById('elapsed');
const progressEl = document.getElementById('progress');
const doneBtn    = document.getElementById('btn-done');

const sentenceNoEl = document.getElementById('sentence-no');

// 한 번 연습할 때 치는 문장 수. 한 문장만 치면 자모가 몇 개 안 나와
// 취약 자모를 가릴 만큼 표본이 모이지 않는다.
const SENTENCES_PER_ROUND = 5;

let targetChars = [];   // 지금 문장을 글자 단위로 쪼갠 배열
let startedAt   = null; // 지금 재고 있는 구간의 시작 시각 (멈춰 있으면 null)
let elapsedMs   = 0;    // 앞서 재 둔 시간의 합 (라운드 전체)
let timerId     = null;
let keyTimes    = [];   // 키가 화면에 나타난 시각 (문장마다 새로 시작)
let typedKeys   = [];   // 지금 문장에서 친 내용을 키 단위로 쪼갠 것
let seenErrors  = new Map();  // 이 문장에서 본 오타. 고쳐도 기록은 남는다

// 이번 라운드에서 모은 것들. 문장을 넘길 때마다 쌓인다.
let round = null;

// sentences 를 주면 그 문장들로, 안 주면 기본 문장을 섞어서 라운드를 연다.
// 맞춤 연습 문장으로 바로 연습할 때 지정해서 쓴다.
function newRound(sentences = null) {
  // 문장 순서를 섞어서 매번 같은 순서로 나오지 않게 한다.
  const shuffled = [...SENTENCES].sort(() => Math.random() - 0.5);
  round = {
    sentences: sentences ?? shuffled.slice(0, SENTENCES_PER_ROUND),
    index: 0,
    ops: [],              // 오타 연산 (고쳐서 지운 것까지 포함)
    durations: [],        // 키마다 걸린 시간
    texts: [],            // 문장마다 { target, typed } — 데이터베이스에 그대로 담는다
    targetKeyCount: 0,
    typedKeyCount: 0,
  };
}

const roundFinished = () => round !== null && round.index >= round.sentences.length;

// 제시 문장을 글자마다 span 하나씩으로 그린다.
// 통째로 넣으면 3차시에 '틀린 글자만' 색칠할 수 없다.
// 여기서 만든 span 의 순서는 hangul.js 의 charIndex 와 그대로 짝이 맞는다.
function renderTarget(text) {
  targetChars = [...text];          // 코드포인트 단위로 쪼갠다
  targetEl.textContent = '';
  for (const ch of targetChars) {
    const span = document.createElement('span');
    span.className = 'ch';
    span.textContent = ch;
    targetEl.appendChild(span);
  }
}

// 제시 문장의 글자마다 맞음/치는 중/틀림 색을 입힌다.
// 판정은 typing.js 가 값으로만 하고, 여기서는 그 결과를 화면에 옮기기만 한다.
function paintTarget() {
  const { states, extra } = judge(targetChars.join(''), inputEl.value);
  const spans = targetEl.children;
  states.forEach((state, i) => { spans[i].className = `ch ${state}`; });

  // 제시 문장보다 많이 친 글자는 칠할 자리가 없으므로 입력창 쪽에 표시한다.
  inputEl.classList.toggle('is-over', extra > 0);
}

// 한/영 전환을 안 하고 치면 'rysldptj' 같은 글자가 들어온다.
// 통계에서 걸러 내기만 하면 '왜 오타가 안 잡히지?' 하고 더 헷갈리므로,
// 치는 중에 바로 알려 준다. 한두 글자는 지나가고 세 글자부터 띄운다.
function checkInputMode() {
  document.getElementById('ime-warning').hidden = countNotHangul(inputEl.value) < 3;
}

function updateProgress() {
  progressEl.textContent = `${[...inputEl.value].length} / ${targetChars.length}`;
  sentenceNoEl.textContent = `${round.index + 1} / ${round.sentences.length}`;
}

function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

// 연습 시간은 '재고 있는 구간들의 합' 으로 센다.
// 시작 시각 하나만 두고 빼면, 기록 화면에 머문 시간까지 연습 시간에 들어간다.
function currentElapsed() {
  return elapsedMs + (startedAt === null ? 0 : performance.now() - startedAt);
}

// 타이머는 문장이 뜬 순간이 아니라 첫 글자를 친 순간부터 센다.
// 이미 재고 있으면 아무 일도 하지 않으므로, 이어서 칠 때 그대로 다시 불러도 된다.
function startTimer() {
  if (startedAt !== null) return;
  startedAt = performance.now();
  timerId = setInterval(() => {
    elapsedEl.textContent = formatTime(currentElapsed());
  }, 200);
}

function stopTimer() {
  // 지금까지 잰 만큼을 합에 더하고 구간을 닫는다.
  if (startedAt !== null) {
    elapsedMs += performance.now() - startedAt;
    startedAt = null;
  }
  clearInterval(timerId);
  timerId = null;
}

// 지금 차례의 문장을 화면에 올린다. 시계는 건드리지 않는다.
// 문장이 바뀌어도 연습 시간은 계속 흘러야 하기 때문이다.
function loadSentence() {
  keyTimes = [];        // 자모 입력 시간은 문장마다 새로 잰다
  typedKeys = [];
  seenErrors = new Map();
  renderTarget(round.sentences[round.index]);
  inputEl.value = '';
  inputEl.classList.remove('is-over');
  document.getElementById('ime-warning').hidden = true;
  updateProgress();
  paintTarget();
  inputEl.focus();
}

// 입력에 한글 아닌 글자가 몇 개나 섞였는지 센다. 한/영 전환 여부를 가리는 잣대다.
function countNotHangul(text) {
  return decomposeToKeys(text).filter(k => k.trim() !== '' && !isJamo(k)).length;
}

// 지금 문장에서 나온 결과를 라운드에 쌓는다.
//
// 한/영 전환을 안 하고 친 문장은 통째로 뺀다.
// 자모 하나하나만 걸러서는 모자란다. 영문으로 치면 제시 문장과 아예 어긋나서
// 치지도 않은 뒷부분이 전부 '빠뜨림' 으로 쌓이고, 그 자모들이 취약 자모로
// 뽑혀 엉뚱한 맞춤 연습 문장이 만들어진다.
function collectSentence() {
  if (countNotHangul(inputEl.value) >= 3) return;

  const targetKeys = decomposeToKeys(targetChars.join(''));
  const inputKeys  = decomposeToKeys(inputEl.value);

  // 치는 동안 본 오타(고쳐서 사라진 것 포함) + 끝내 빠뜨린 자모.
  // 빠뜨림은 치는 도중에는 '아직 안 친 뒷부분' 과 구별할 수 없어 여기서 센다.
  round.ops.push(...seenErrors.values(), ...missingErrors(targetKeys, inputKeys));
  round.durations.push(...keyDurations(typedKeys, keyTimes));
  round.targetKeyCount += targetKeys.length;
  round.typedKeyCount  += inputKeys.length;
  round.texts.push({ target: targetChars.join(''), typed: inputEl.value });
}

// 새 연습을 시작한다. 문장을 새로 뽑고 입력과 시계를 초기화한다.
function startPractice(sentences = null) {
  stopTimer();
  startedAt = null;
  elapsedMs = 0;
  newRound(sentences);
  loadSentence();
  elapsedEl.textContent = '00:00';
  show('practice');
}

// 엔터를 눌렀을 때. 지금 문장을 접고 다음 문장으로 넘어간다.
// 마지막 문장이었으면 결과 화면으로 간다.
function nextSentence() {
  collectSentence();
  round.index += 1;

  if (roundFinished()) showRoundResult();
  else loadSentence();
}

inputEl.addEventListener('input', () => {
  startTimer();
  // 벽시계 시각이 아니라 '연습이 실제로 흐른 시간' 을 넘긴다.
  // 기록 화면을 보고 오면 그동안 시계가 멈춰 있으므로, 자리 비운 시간이
  // 다음 자모의 입력 시간에 섞이지 않는다.
  typedKeys = recordKeyTimes(inputEl.value, keyTimes, currentElapsed());

  // 오타를 내면 보통 지우고 다시 친다. 최종 입력만 보면 흔적이 없어 '오타 0곳'이
  // 된다. 그래서 칠 때마다 맞춰 보고 본 적 없는 오타를 적어 둔다.
  // 한 번이라도 틀렸으면 기록이 남으므로 그 뒤에 어떻게 고치든 상관없다.
  if (countNotHangul(inputEl.value) < 3) {
    trackErrors(seenErrors, decomposeToKeys(targetChars.join('')), typedKeys);
  }

  paintTarget();
  updateProgress();
  checkInputMode();
});

// 엔터로 다음 문장. textarea 라서 그냥 두면 줄바꿈이 들어간다.
inputEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.isComposing) return;   // 조합 중 엔터는 글자 확정용이다
  e.preventDefault();
  nextSentence();
});

// 자모별 입력 시간을 콘솔에 찍는다.
// 5차시에는 이 값을 결과 화면의 '입력이 느린 자모' 칸에 그대로 넣는다.
function logKeyTimings(ranked) {
  if (ranked.length === 0) { console.log('입력이 없어 잴 것이 없습니다.'); return; }

  console.log(`─── 자모별 평균 입력 시간 · 느린 순 (키 ${round.typedKeyCount}개) ───`);
  // 표와 글줄을 둘 다 찍는다. 표는 보기 좋고, 글줄은 어디서든 그대로 읽힌다.
  ranked.forEach(({ key, avg, count }, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${key}  평균 ${Math.round(avg)}ms  (${count}회)`);
  });
  console.table(ranked.map(({ key, avg, count }) => ({
    자모: key, '평균(ms)': Math.round(avg), 횟수: count,
  })));
}

// 결과 화면의 '입력이 느린 자모' 칸을 채운다.
// 틀리지는 않았지만 유독 오래 걸리는 자모를 찾는 것이 목적이라,
// 오타 분석(4차시)과는 별개로 지금 값만으로도 채울 수 있다.
function renderSlowJamo(ranked) {
  const list = document.getElementById('slow-list');
  list.textContent = '';

  if (ranked.length === 0) {
    list.classList.add('is-empty');
    const li = document.createElement('li');
    li.textContent = '입력이 없어 잴 것이 없습니다';
    list.appendChild(li);
    return;
  }

  list.classList.remove('is-empty');
  ranked.slice(0, 5).forEach(({ key, avg, count }, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="pair">${i + 1}. ${key}</span>`
                 + `<span class="count">평균 ${Math.round(avg)}ms`
                 + (count > 1 ? ` · ${count}회` : '') + `</span>`;
    list.appendChild(li);
  });
}

// ── 결과 화면 · 오타 분석 (4차시) ────────────────────────

// 어느 자모를 어느 자모로 잘못 쳤는지, 그리고 그게 어떤 실수인지 보여 준다.
function renderErrorPairs(pairs) {
  const list = document.getElementById('error-list');
  list.textContent = '';

  if (pairs.length === 0) {
    list.classList.add('is-empty');
    const li = document.createElement('li');
    li.textContent = '교체 오타가 없습니다';
    list.appendChild(li);
    return;
  }

  list.classList.remove('is-empty');
  pairs.slice(0, 5).forEach(({ from, to, count, category }, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="pair">${i + 1}. ${from} <em>→</em> ${to}</span>`
                 + `<span class="count">${count}회 · ${TYPE_LABEL[category]}</span>`;
    list.appendChild(li);
  });
}

// 자판 히트맵. 많이 틀린 키일수록 진하게 칠한다.
//
// 4차시에 만든 자판 좌표를 그대로 그림으로 옮긴다. 자판 모양 그대로 보여 줘야
// '오른손 가운데 줄에서 실수가 몰린다' 같은 것이 한눈에 들어온다.
function renderHeatmap(tally) {
  const box = document.getElementById('heatmap');
  box.textContent = '';

  const rows = keyboardLayout();
  const worst = Math.max(1, ...tally.values());   // 가장 많이 틀린 키를 기준으로 삼는다

  const KEY = 30, GAP = 3, PAD = 4;
  const width  = PAD * 2 + 10 * (KEY + GAP);
  const height = PAD * 2 + 3 * (KEY + GAP);

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'keyboard-map');

  for (const row of rows) {
    for (const { jamo, shifted, row: r, col } of row) {
      const count = tally.get(jamo) ?? 0;
      const withShift = shifted ? (tally.get(shifted) ?? 0) : 0;
      const total = count + withShift;   // Shift 로 치는 자모도 같은 키다

      const g = document.createElementNS(ns, 'g');
      const x = PAD + col * (KEY + GAP);
      const y = PAD + r * (KEY + GAP);

      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', x); rect.setAttribute('y', y);
      rect.setAttribute('width', KEY); rect.setAttribute('height', KEY);
      rect.setAttribute('rx', 5);
      rect.setAttribute('class', total > 0 ? 'key key-hot' : 'key');
      // 가장 많이 틀린 키를 1 로 두고 비율만큼 진하게. 0.15 는 바닥값이다.
      if (total > 0) rect.setAttribute('fill-opacity', (0.15 + 0.85 * (total / worst)).toFixed(2));
      g.appendChild(rect);

      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', x + KEY / 2); text.setAttribute('y', y + KEY / 2 + 5);
      text.setAttribute('class', total > 0 ? 'key-label key-label-hot' : 'key-label');
      text.textContent = jamo;
      g.appendChild(text);

      if (total > 0) {
        const title = document.createElementNS(ns, 'title');
        title.textContent = `${jamo} ${total}회`;
        g.appendChild(title);
      }
      svg.appendChild(g);
    }
  }

  box.classList.toggle('is-empty', worst === 1 && tally.size === 0);
  box.appendChild(svg);
}

// 오타 유형별 비율. 한 번도 안 나온 유형도 0% 로 남겨 둬야 전체 그림이 보인다.
function renderTypes(types) {
  const list = document.getElementById('type-list');
  list.textContent = '';
  for (const { label, count, percent } of types) {
    const row = document.createElement('div');
    row.innerHTML = `<dt>${label}</dt>`
                  + `<dd>${count === 0 ? '–' : `${percent}% · ${count}회`}</dd>`;
    list.appendChild(row);
  }
}

// 취약 자모가 몰린 맞춤 연습 문장. 배낭 알고리즘이 고른 단어들이다.
let suggestedSentence = '';

function renderSuggestion(weakJamo, sentence) {
  const label = document.getElementById('weak-jamo');
  const textEl = document.getElementById('suggest-text');
  const btn = document.getElementById('btn-practice-suggest');

  suggestedSentence = sentence;
  label.textContent = weakJamo.length ? `취약 자모 ${weakJamo.join(' ')}` : '취약 자모';

  if (!sentence) {
    textEl.classList.add('is-empty');
    textEl.textContent = '오타가 없어 만들 문장이 없습니다';
    btn.disabled = true;
    return;
  }
  textEl.classList.remove('is-empty');
  textEl.textContent = sentence;
  btn.disabled = false;
}

// 맞춤 문장 하나만으로 짧게 한 라운드를 돈다.
document.getElementById('btn-practice-suggest').addEventListener('click', () => {
  if (suggestedSentence) startPractice([suggestedSentence]);
});

function renderSummary({ acc, cpm, errorCount, hasData }) {
  document.getElementById('sum-accuracy').textContent = hasData ? `${acc}%` : '–';
  document.getElementById('sum-cpm').textContent      = hasData ? cpm : '–';
  document.getElementById('sum-errors').textContent   = hasData ? errorCount : '–';
}

// 라운드 전체를 모아 결과 화면에 올린다.
//
// 치다 만 문장은 담지 않는다. 엔터로 접은 문장만 센다.
// 반쯤 치다 만 문장을 넣으면 아직 치지 않은 뒷부분이 전부 '빠뜨림' 으로
// 쌓여서 통계가 망가진다. (안 친 문장 하나로 빠뜨림 39회가 잡힌 적이 있다.)
function showRoundResult() {
  round.index = round.sentences.length;
  stopTimer();

  // 자모별 입력 시간 (3차시)
  const ranked = averageByJamo(round.durations);
  logKeyTimings(ranked);
  renderSlowJamo(ranked);

  // 오류 쌍과 오타 유형 (4차시)
  // 비교는 글자가 아니라 키 단위로 했다. '값'을 '갑'으로 쳤을 때
  // 'ㅄ을 ㅂ으로 교체'가 아니라 'ㅅ을 빠뜨림'으로 잡혀야 하기 때문이다.
  const ops = round.ops;
  const errorPairs = countErrorPairs(ops);
  renderErrorPairs(errorPairs);
  renderTypes(countByType(ops));
  const errorTally = countByKey(ops);
  renderHeatmap(errorTally);

  // 취약 자모를 정하고, 그 자모가 몰린 문장을 배낭 알고리즘으로 만든다 (5차시)
  const weak = pickWeakJamo(errorTally, ranked, 3);
  renderSuggestion(weak, buildPracticeSentence(WORDS, weak, 20).text);

  const minutes = currentElapsed() / 60000;
  renderSummary({
    hasData: round.targetKeyCount > 0,
    acc: accuracy(round.targetKeyCount, ops.length),
    cpm: minutes > 0 ? Math.round(round.typedKeyCount / minutes) : 0,
    errorCount: ops.length,
  });

  logErrors(ops);
  show('result');

  // 기록을 데이터베이스에 담는다 (7차시).
  // 저장이 늦거나 실패해도 결과 화면은 이미 떠 있어야 하므로 기다리지 않는다.
  saveRound(errorPairs, ranked);
}

// 한 라운드의 결과를 Supabase 에 저장한다.
// 저장은 네트워크를 타는 일이라 실패할 수 있다. 실패해도 화면은 그대로 두고
// 무슨 일이 있었는지만 알려 준다. 연습 결과를 못 보는 쪽이 더 나쁘기 때문이다.
async function saveRound(errorPairs, jamoTimes) {
  const stateEl = document.getElementById('save-state');
  if (round.targetKeyCount === 0) { stateEl.textContent = ''; return; }

  stateEl.className = 'save-state';
  stateEl.textContent = '저장 중…';

  try {
    await saveSession({
      accuracy: accuracy(round.targetKeyCount, round.ops.length),
      cpm: Number(document.getElementById('sum-cpm').textContent) || 0,
      errorCount: round.ops.length,
      elapsedMs: currentElapsed(),
      sentences: round.texts,
      suggested: suggestedSentence,
      errorPairs,
      jamoTimes,
    });
    stateEl.className = 'save-state is-saved';
    stateEl.textContent = '기록 저장됨';
  } catch (e) {
    console.error('기록 저장 실패:', e);
    stateEl.className = 'save-state is-failed';
    stateEl.textContent = '기록 저장 실패 (연습 결과는 그대로 보입니다)';
  }
}

doneBtn.addEventListener('click', showRoundResult);

// 계획서 4차시 목표: 오류 쌍과 유형이 출력되는 것까지 확인
function logErrors(ops) {
  console.log(`─── 오타 ${ops.length}곳 ───`);
  for (const op of ops) {
    console.log(`  ${op.from ?? '-'} → ${op.to ?? '-'}   ${TYPE_LABEL[op.category]}`);
  }
}

// 치던 연습을 그대로 이어서 한다. 문장도 입력도 그대로 두고 화면만 되돌린다.
function resumePractice() {
  show('practice');
  // 치던 중이었으면 시계도 다시 간다.
  // 키 입력 시각은 경과 시간으로 재고 있어서 따로 보정할 것이 없다.
  if (inputEl.value !== '') startTimer();
  inputEl.focus();
}

// 기록 화면에서 연습으로 돌아올 때.
// 라운드가 아직 안 끝났으면 치던 자리에서 이어서, 끝났으면 새 라운드로.
function goPractice() {
  if (round === null || roundFinished()) startPractice();
  else resumePractice();
}

// ── 화면 이동 버튼 ───────────────────────────────────────
// data-go 속성에 목적지 이름을 적어 두고 한 곳에서 처리한다.
// 같은 '연습 화면' 으로 가더라도 버튼마다 뜻이 다르다.
//   practice      기록을 잠깐 보고 돌아오는 길  -> 치던 내용을 살린다
//   practice-new  연습을 끝내고 새로 시작하는 길 -> 새 문장을 뽑는다
for (const btn of document.querySelectorAll('[data-go]')) {
  btn.addEventListener('click', () => {
    const to = btn.dataset.go;
    if (to === 'practice-new') startPractice();
    else if (to === 'practice') goPractice();
    else show(to);
  });
}

// ── 시작 ─────────────────────────────────────────────────
startPractice();

// ─────────────────────────────────────────────────────────────
// 기록 화면 그리기
//
// 실제 기록은 7~8차시에 Supabase 에서 불러온다.
// 지금은 아래 예시 데이터로 그려서 배치를 확인한다.
// 그리는 함수는 그대로 두고 데이터만 바꿔 끼우면 되도록 나눠 두었다.
// ─────────────────────────────────────────────────────────────

// ── 꺾은선 그래프 ────────────────────────────────────────
// 라이브러리 없이 SVG 를 직접 만든다.
// 정확도 값(예: 82%)을 그림 위의 y 좌표로 바꾸는 것이 핵심이다.
function renderAccuracyChart(values) {
  const box = document.getElementById('accuracy-chart');
  box.textContent = '';
  if (values.length === 0) { box.classList.add('is-empty'); box.textContent = '아직 기록이 없습니다'; return; }

  const W = 460, H = 170;                 // 그림 안에서 쓸 좌표계 크기
  const PAD = { top: 12, right: 12, bottom: 26, left: 34 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // 세로축 범위. 아래끝을 50 으로 고정하면 정확도가 50 미만일 때
  // 점이 그림 밖으로 나가 버린다. 가장 낮은 값보다 아래에서 시작하도록 내린다.
  const MAX = 100;
  const MIN = Math.min(50, Math.floor(Math.min(...values) / 10) * 10);
  // 값 -> y 좌표. 값이 클수록 위로 가야 하므로 위아래를 뒤집는다.
  const toY = (v) => PAD.top + innerH * (1 - (v - MIN) / (MAX - MIN));
  // 회차 번호 -> x 좌표. 점이 하나뿐이면 나눗셈이 0 이 되므로 가운데 둔다.
  const toX = (i) => values.length === 1
    ? PAD.left + innerW / 2
    : PAD.left + innerW * (i / (values.length - 1));

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'line-chart');

  const add = (tag, attrs, text) => {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text !== undefined) el.textContent = text;
    svg.appendChild(el);
    return el;
  };

  // 가로 격자선과 세로축 눈금
  for (const v of [MIN, (MIN + MAX) / 2, MAX]) {
    add('line', { x1: PAD.left, y1: toY(v), x2: W - PAD.right, y2: toY(v), class: 'grid' });
    add('text', { x: PAD.left - 6, y: toY(v) + 4, class: 'tick tick-y' }, `${v}`);
  }

  // 값을 이은 선
  add('polyline', { class: 'line', points: values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ') });

  // 각 회차의 점과 가로축 눈금
  values.forEach((v, i) => {
    add('circle', { cx: toX(i), cy: toY(v), r: 3.5, class: 'dot' });
    add('text', { x: toX(i), y: H - 8, class: 'tick tick-x' }, `${i + 1}`);
  });

  box.appendChild(svg);
}

// ── 누적 취약 자모 ───────────────────────────────────────
function renderWeakPairs(pairs) {
  const list = document.getElementById('cumulative-list');
  list.textContent = '';
  list.classList.toggle('is-empty', pairs.length === 0);
  if (pairs.length === 0) {
    const li = document.createElement('li');
    li.textContent = '아직 쌓인 오타가 없습니다';
    list.appendChild(li);
    return;
  }
  for (const [from, to, count] of pairs.slice(0, 8)) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="pair">${from} <em>→</em> ${to}</span><span class="count">${count} 회</span>`;
    list.appendChild(li);
  }
}

// ── 연습 기록 ────────────────────────────────────────────
function renderHistory(rows) {
  const list = document.getElementById('history-list');
  list.textContent = '';
  list.classList.toggle('is-empty', rows.length === 0);
  if (rows.length === 0) {
    const li = document.createElement('li');
    li.textContent = '아직 연습 기록이 없습니다';
    list.appendChild(li);
    return;
  }
  for (const { date, accuracy, cpm } of rows) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="date">${date}</span>`
                 + `<span class="meta">정확도 ${accuracy}% · 분당 ${cpm}타</span>`;
    list.appendChild(li);
  }
}

// 기록 화면을 열 때마다 데이터베이스에서 새로 읽어 온다 (8차시).
// 연습을 마치고 바로 들어와도 방금 것이 보이게 하려는 것이다.
async function loadRecordScreen() {
  const chartBox = document.getElementById('accuracy-chart');
  chartBox.classList.add('is-empty');
  chartBox.textContent = '불러오는 중…';

  try {
    const [sessions, errors] = await Promise.all([loadSessions(20), loadCumulativeErrors()]);

    // 불러올 때는 최근 것이 먼저 오므로, 그래프는 오래된 순으로 뒤집어 그린다.
    renderAccuracyChart([...sessions].reverse().map(s => s.accuracy));
    renderWeakPairs(errors.map(e => [e.from, e.to ?? '-', e.count]));
    renderHistory(sessions.map(s => ({
      date: formatDate(s.created_at),
      accuracy: s.accuracy,
      cpm: s.cpm,
    })));
  } catch (e) {
    console.error('기록 불러오기 실패:', e);
    chartBox.classList.add('is-empty');
    chartBox.textContent = '기록을 불러오지 못했습니다';
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
