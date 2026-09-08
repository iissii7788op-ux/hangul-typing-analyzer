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
