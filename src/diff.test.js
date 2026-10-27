// 편집 거리와 오타 유형 테스트. 실행: node src/diff.test.js
//
// 계획서에 적은 대로, 정답을 아는 짧은 예시부터 확인하고 긴 문장으로 넘어간다.
import { decomposeToKeys } from './hangul.js';
import { diffKeys, trackErrors, missingErrors,
         countErrorPairs, countByKey, countByType, accuracy,
         SUBSTITUTE, DELETE, INSERT, TRANSPOSE,
         NEIGHBOR, DISTANT, MISSING, EXTRA, SWAP } from './diff.js';

let pass = 0, total = 0;
function check(label, actual, expected) {
  total++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}\n        ${a}${ok ? '' : `\n  기대: ${e}`}`);
}

function checkTrue(label, cond, info = '') {
  total++;
  if (cond) pass++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${info ? `  ${info}` : ''}`);
}

// 글자로 주면 키 단위로 쪼개서 비교한다 (실제 서비스가 하는 방식 그대로)
const diff = (target, typed) => diffKeys(decomposeToKeys(target), decomposeToKeys(typed));
// 보기 좋게 '무엇을 무엇으로, 어떤 유형' 만 뽑는다
const brief = (r) => r.ops.map(o => `${o.from ?? '-'}>${o.to ?? '-'}:${o.category}`);

// ── 1) 짧은 예시 다섯 개 ─────────────────────────────────
console.log('[짧은 예시]');

check('맞게 침 "안녕"/"안녕" 거리', diff('안녕', '안녕').distance, 0);
check('맞게 침 — 연산 없음',        brief(diff('안녕', '안녕')), []);

// 계획서에 적은 예시. ㅕ(U) 를 ㅛ(Y) 로 친 것은 바로 옆 키다.
check('"안녕" -> "안뇽" 거리',  diff('안녕', '안뇽').distance, 1);
check('"안녕" -> "안뇽" 연산',  brief(diff('안녕', '안뇽')), [`ㅕ>ㅛ:${NEIGHBOR}`]);

// 받침을 빼먹은 경우
check('"안녕" -> "아녕"', brief(diff('안녕', '아녕')), [`ㄴ>-:${MISSING}`]);

// 겹받침의 뒷자모를 빠뜨린 경우 (1차시 키 단위 분해가 여기서 쓰인다)
check('"값" -> "갑"', brief(diff('값', '갑')), [`ㅅ>-:${MISSING}`]);

// 없는 자모를 더 친 경우
check('"가" -> "강"', brief(diff('가', '강')), [`->ㅇ:${EXTRA}`]);

// ── 2) 자리바꿈 ──────────────────────────────────────────
console.log('\n[자리바꿈]');
// 두 자모의 순서가 뒤바뀐 것은 교체 2번이 아니라 자리바꿈 1번으로 센다.
check('ㄱㅏ -> ㅏㄱ 거리', diffKeys(['ㄱ','ㅏ'], ['ㅏ','ㄱ']).distance, 1);
check('ㄱㅏ -> ㅏㄱ 유형',
      diffKeys(['ㄱ','ㅏ'], ['ㅏ','ㄱ']).ops.map(o => o.category), [SWAP]);

// ── 3) 옆 키 오타와 원거리 오타 ──────────────────────────
console.log('\n[교체는 자판 거리로 갈린다]');
check('ㅕ -> ㅛ 는 옆 키',
      diffKeys(['ㅕ'], ['ㅛ']).ops.map(o => o.category), [NEIGHBOR]);
check('ㅕ -> ㅋ 은 원거리',
      diffKeys(['ㅕ'], ['ㅋ']).ops.map(o => o.category), [DISTANT]);
check('ㅂ -> ㅣ 는 원거리',
      diffKeys(['ㅂ'], ['ㅣ']).ops.map(o => o.category), [DISTANT]);

// ── 4) 같은 거리를 주는 길이 여럿일 때 ───────────────────
console.log('\n[길이 여럿일 때는 교체를 먼저 집는다]');
// ㄱ -> ㄴ 은 '교체 1번' 으로도, '빠뜨림 + 덧침 2번' 으로도 설명되지만
// 편집 횟수가 적은 교체가 뽑혀야 한다. 타자 오타는 대개 하나를 잘못 누른 것이다.
check('ㄱ -> ㄴ 은 교체 한 번',
      diffKeys(['ㄱ'], ['ㄴ']).ops.map(o => o.type), [SUBSTITUTE]);

// ── 5) 긴 문장 ───────────────────────────────────────────
console.log('\n[긴 문장]');
const r = diff('값싼 물건보다', '값싼 물건부다');   // '보'를 '부'로 (ㅗ -> ㅜ)
check('오류 쌍', countErrorPairs(r.ops).map(p => `${p.from}>${p.to}x${p.count}`), ['ㅗ>ㅜx1']);

// 같은 오타를 두 번 내면 횟수가 쌓여야 한다
const r2 = diff('여여', '요요');
check('같은 오타 두 번', countErrorPairs(r2.ops).map(p => `${p.from}>${p.to}x${p.count}`), ['ㅕ>ㅛx2']);

// ── 6) 유형별 비율과 정확도 ──────────────────────────────
console.log('\n[집계]');
const mixed = diffKeys(['ㅕ','ㄱ','ㅏ','ㅅ'], ['ㅛ','ㅏ','ㅅ']);   // 옆 키 1 + 빠뜨림 1
check('유형별 개수',
      countByType(mixed.ops).filter(t => t.count > 0).map(t => `${t.label}:${t.count}`),
      ['옆 키 오타:1', '빠뜨림:1']);
check('유형별 비율 합', countByType(mixed.ops).reduce((s, t) => s + t.percent, 0), 100);

check('정확도 — 10개 중 2개 틀림', accuracy(10, 2), 80);
check('정확도 — 다 맞음',          accuracy(10, 0), 100);
check('정확도 — 입력 없음',        accuracy(0, 0), 0);

// ── 한/영 전환을 안 하고 친 경우 ─────────────────────────
console.log('\n[한글이 아닌 글자가 섞였을 때]');

// '교실' 을 영문 상태로 치면 ryslf 가 들어온다.
// 손가락은 제 자리를 눌렀으니 자판 실수가 아니다. 자모 통계에 넣으면 안 된다.
const 영문입력 = diffKeys(decomposeToKeys('교실'), [...'ryslf']);

check('자모 오답 순위에서 빠진다', countErrorPairs(영문입력.ops), []);
check('히트맵 집계에서도 빠진다', [...countByKey(영문입력.ops).keys()], []);

// 그래도 틀린 것은 맞으므로 오타 개수에는 남는다
checkTrue('오타 개수에는 남는다', 영문입력.ops.length > 0,
          `-> ${영문입력.ops.length}곳`);

// 한글끼리 틀린 것은 그대로 집계되어야 한다
check('한글 오타는 그대로 집계',
      countErrorPairs(diffKeys(decomposeToKeys('여'), decomposeToKeys('요')).ops)
        .map(p => `${p.from}>${p.to}`),
      ['ㅕ>ㅛ']);

// ── 치는 내내 오타를 기록하기 ─────────────────────────────
console.log('\n[고쳐도 오타가 남는가]');

const 값싼 = decomposeToKeys('값싼');

// 값씨 로 잘못 쳤다가 고치는 여러 경로. 어떤 길로 고쳐도 오타는 남아야 한다.
function 쳐보기(단계들) {
  const seen = new Map();
  for (const 단계 of 단계들) trackErrors(seen, 값싼, decomposeToKeys(단계));
  return [...seen.values()].map(o => `${o.from}>${o.to}`);
}

check('백스페이스로 지우고 다시 (길이가 줄어듦)',
      쳐보기(['값', '값ㅆ', '값씨', '값ㅆ', '값싸', '값싼']), ['ㅏ>ㅣ']);

check('덮어써서 고침 (길이가 그대로)',
      쳐보기(['값', '값씨', '값싸', '값싼']), ['ㅏ>ㅣ']);

check('조합이 이어지며 고쳐짐 (길이가 늘어남)',
      쳐보기(['값', '값ㅆ', '값씨', '값씬', '값싼']), ['ㅏ>ㅣ']);

check('맞게만 치면 오타 없음',
      쳐보기(['값', '값ㅆ', '값싸', '값싼']), []);

// 같은 자리에서 같은 실수를 되풀이해도 한 번으로 센다
check('같은 오타를 반복해도 한 번',
      쳐보기(['값씨', '값ㅆ', '값씨', '값ㅆ', '값싼']), ['ㅏ>ㅣ']);

// 치는 도중에는 아직 안 친 뒷부분이 빠뜨림으로 보이므로 적지 않는다
check('안 친 뒷부분은 오타가 아니다', 쳐보기(['값']), []);

// 한글은 맞게 치는 동안 늘 제시의 앞부분이 된다(1차시 키 단위 분해 덕분).
// 겹받침과 복합 모음이 섞여도 중간 상태가 오타로 잡히면 안 된다.
check('겹받침을 거쳐도 오탐 없음',
      쳐보기(['ㄱ', '가', '갑', '값', '값ㅆ', '값싸', '값싼']), []);

// 빠뜨림은 문장을 다 치고 나서 센다
// 오타 하나는 하나로만 세어야 한다.
// 글자를 칠 때마다 정렬이 흔들려 같은 오타가 여러 번 쌓이던 적이 있다.
const 한문장 = decomposeToKeys('희망찬 목소리로');
const 친것 = '희망찬 목소리루';
const seen한번 = new Map();
for (let i = 1; i <= 친것.length; i++) {
  trackErrors(seen한번, 한문장, decomposeToKeys(친것.slice(0, i)));
}
check('오타 하나는 한 번만 센다',
      [...seen한번.values()].map(o => `${o.from}>${o.to}`), ['ㅗ>ㅜ']);

check('끝내 빠뜨린 자모는 따로 센다',
      missingErrors(값싼, decomposeToKeys('갑싼')).map(o => o.from), ['ㅅ']);

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);
