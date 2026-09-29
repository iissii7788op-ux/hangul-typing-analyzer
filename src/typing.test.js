// 타이핑 판정 테스트. 실행: node src/typing.test.js
import { judge, recordKeyTimes, keyDurations, averageByJamo,
         OK, TYPING, BAD, NONE } from './typing.js';

let pass = 0, total = 0;

function check(label, actual, expected) {
  total++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}\n        ${a}${ok ? '' : `\n  기대: ${e}`}`);
}

const st = (target, typed) => judge(target, typed).states;

// ── 1) 기본 판정 ─────────────────────────────────────────
console.log('[기본 판정]');
check('"안녕" / 아무것도 안 침', st('안녕', ''),       [NONE, NONE]);
check('"안녕" / "안"',           st('안녕', '안'),     [OK, NONE]);
check('"안녕" / "안녕"',         st('안녕', '안녕'),   [OK, OK]);
check('"안녕" / "안뇽"',         st('안녕', '안뇽'),   [OK, BAD]);

// ── 2) 조합 중 (3차시의 핵심) ────────────────────────────
// 한글은 완성되기 전 중간 상태를 지나간다. 그때 빨갛게 칠하면 안 된다.
console.log('\n[조합 중 — 빨갛게 칠하면 안 되는 순간]');
check('"안" 치는 중 "ㅇ"',   st('안녕', 'ㅇ'),     [TYPING, NONE]);
check('"안" 치는 중 "아"',   st('안녕', '아'),     [TYPING, NONE]);
check('"녕" 치는 중 "안ㄴ"', st('안녕', '안ㄴ'),   [OK, TYPING]);
check('"녕" 치는 중 "안녀"', st('안녕', '안녀'),   [OK, TYPING]);
check('"값" 치는 중 "갑"',   st('값', '갑'),       [TYPING]);   // 겹받침도 중간을 지나간다

// ── 3) 조합 중이어도 틀린 경우 ───────────────────────────
console.log('\n[길에서 벗어난 경우]');
check('"안" 인데 "앋"',   st('안녕', '앋'),   [BAD, NONE]);
check('"안" 인데 "어"',   st('안녕', '어'),   [BAD, NONE]);
check('"녕" 인데 "안ㅁ"', st('안녕', '안ㅁ'), [OK, BAD]);

// 이미 지나간 글자는 조합이 끝났으므로 엄격하게 본다.
// "아녕" 은 '안' 에서 받침 ㄴ 을 빼먹은 것이지 조합 중이 아니다.
check('받침 빼먹고 넘어감 "아녕"', st('안녕', '아녕'), [BAD, OK]);

// ── 4) 너무 많이 친 경우 ─────────────────────────────────
console.log('\n[넘치게 친 경우]');
check('"안녕" / "안녕하세요" 의 넘친 글자 수',
      judge('안녕', '안녕하세요').extra, 3);

// ── 5) 키 입력 시각 기록 ─────────────────────────────────
console.log('\n[키 입력 시각 기록]');
const times = [];
recordKeyTimes('ㄱ',   times, 100);   // ㄱ
recordKeyTimes('가',   times, 250);   // ㅏ 추가
recordKeyTimes('강',   times, 600);   // ㅇ 추가
check('세 키의 시각', times, [100, 250, 600]);

const keys = recordKeyTimes('강', times, 600);
check('키 배열', keys, ['ㄱ', 'ㅏ', 'ㅇ']);
check('키마다 걸린 시간', keyDurations(keys, times),
      [{ key: 'ㅏ', ms: 150 }, { key: 'ㅇ', ms: 350 }]);

// 백스페이스로 지우면 기록도 같이 줄어야 한다
recordKeyTimes('가', times, 900);
check('지운 뒤 시각 개수', times.length, 2);

// ── 6) 자모별 평균 (느린 순) ─────────────────────────────
console.log('\n[자모별 평균 · 느린 순]');
check('평균과 횟수',
  averageByJamo([
    { key: 'ㅕ', ms: 200 }, { key: 'ㅕ', ms: 160 },
    { key: 'ㄱ', ms: 100 },
    { key: 'ㅄ', ms: 300 },
  ]),
  [{ key: 'ㅄ', count: 1, avg: 300 },
   { key: 'ㅕ', count: 2, avg: 180 },
   { key: 'ㄱ', count: 1, avg: 100 }]);


// 스페이스바도 키 입력이지만 자모가 아니므로 순위에서 빠져야 한다.
check('공백과 문장부호는 제외',
  averageByJamo([
    { key: ' ', ms: 900 },      // 스페이스바 — 제일 느리지만 자모가 아니다
    { key: '.', ms: 800 },      // 마침표
    { key: 'ㄱ', ms: 100 },
  ]).map(r => r.key),
  ['ㄱ']);


// ── 자리를 비웠다 돌아온 경우 ─────────────────────────────
console.log('\n[화면을 떠났다 돌아왔을 때]');

// 시각으로 '연습이 실제로 흐른 시간' 을 넘기면, 화면을 떠나 있던 동안은
// 시계가 멈춰 있으므로 그 시간이 아예 더해지지 않는다.
// ㄱ(100) ㅏ(250) 까지 치고 기록 화면에 30초 머물다 돌아와 ㅇ 을 친 상황.
const paused = [100, 250];
recordKeyTimes('강', paused, 400);        // 경과 시간 기준이라 30초는 빠져 있다
check('자리 비운 30초가 안 섞였나',
      keyDurations(['ㄱ','ㅏ','ㅇ'], paused),
      [{ key: 'ㅏ', ms: 150 }, { key: 'ㅇ', ms: 150 }]);

// 벽시계 시각을 그대로 넘겼다면 30초가 섞여 들어온다 (비교용)
const wallClock = [100, 250];
recordKeyTimes('강', wallClock, 30400);
check('벽시계를 쓰면 30초가 섞인다',
      keyDurations(['ㄱ','ㅏ','ㅇ'], wallClock)[1].ms,
      30150);

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);
