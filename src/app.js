// 오타지도 · 화면 동작
// 2차시 범위: 세 화면의 배치와 전환, 제시 문장 표시, 경과 시간과 진행 표시까지.
// 오답 색칠과 키 입력 시각 기록은 3차시, 편집 거리 분석은 4차시에 붙인다.

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
}

// ── 연습 화면 ────────────────────────────────────────────
const targetEl   = document.getElementById('target-text');
const inputEl    = document.getElementById('typing-input');
const elapsedEl  = document.getElementById('elapsed');
const progressEl = document.getElementById('progress');
const doneBtn    = document.getElementById('btn-done');

let targetChars = [];   // 제시 문장을 글자 단위로 쪼갠 배열
let startedAt   = null; // 첫 글자를 친 시각
let timerId     = null;

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

function updateProgress() {
  progressEl.textContent = `${[...inputEl.value].length} / ${targetChars.length}`;
}

function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

// 타이머는 문장이 뜬 순간이 아니라 첫 글자를 친 순간부터 센다.
function startTimerIfNeeded() {
  if (startedAt !== null) return;
  startedAt = Date.now();
  timerId = setInterval(() => {
    elapsedEl.textContent = formatTime(Date.now() - startedAt);
  }, 200);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

// 새 연습을 시작한다. 문장을 새로 뽑고 입력과 시계를 초기화한다.
function startPractice() {
  stopTimer();
  startedAt = null;
  renderTarget(SENTENCES[Math.floor(Math.random() * SENTENCES.length)]);
  inputEl.value = '';
  elapsedEl.textContent = '00:00';
  updateProgress();
  show('practice');
  inputEl.focus();
}

inputEl.addEventListener('input', () => {
  startTimerIfNeeded();
  updateProgress();
});

doneBtn.addEventListener('click', () => {
  stopTimer();
  show('result');   // 결과 계산은 4~5차시에 붙인다
});

// ── 화면 이동 버튼 ───────────────────────────────────────
// data-go 속성에 목적지 이름을 적어 두고 한 곳에서 처리한다.
for (const btn of document.querySelectorAll('[data-go]')) {
  btn.addEventListener('click', () => {
    const to = btn.dataset.go;
    if (to === 'practice') startPractice();   // 연습으로 돌아갈 때는 새 문장으로
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

const SAMPLE_RECORD = {
  accuracy:   [82, 86, 84, 90, 93, 91, 96],           // 회차별 정확도(%)
  weakPairs:  [['ㅓ','ㅛ',31], ['ㄴ','ㅇ',15], ['ㅅ','ㅆ',9], ['ㅐ','ㅔ',6]],
  history:    [
    { date: '9월 8일', accuracy: 96, cpm: 312 },
    { date: '9월 7일', accuracy: 91, cpm: 298 },
    { date: '9월 5일', accuracy: 93, cpm: 305 },
    { date: '9월 3일', accuracy: 90, cpm: 287 },
  ],
};

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
  for (const [from, to, count] of pairs) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="pair">${from} <em>→</em> ${to}</span><span class="count">${count} 회</span>`;
    list.appendChild(li);
  }
}

// ── 연습 기록 ────────────────────────────────────────────
function renderHistory(rows) {
  const list = document.getElementById('history-list');
  list.textContent = '';
  for (const { date, accuracy, cpm } of rows) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="date">${date}</span>`
                 + `<span class="meta">정확도 ${accuracy}% · 분당 ${cpm}타</span>`;
    list.appendChild(li);
  }
}

renderAccuracyChart(SAMPLE_RECORD.accuracy);
renderWeakPairs(SAMPLE_RECORD.weakPairs);
renderHistory(SAMPLE_RECORD.history);
