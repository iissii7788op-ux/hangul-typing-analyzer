// 편집 거리와 오타 유형 테스트. 실행: node src/diff.test.js
//
// 계획서에 적은 대로, 정답을 아는 짧은 예시부터 확인하고 긴 문장으로 넘어간다.
import { decomposeToKeys } from './hangul.js';
import { diffKeys, openDiff, createErrorTracker,
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

check('정확도 — 10개 중 2개 틀림', accuracy(10, 10, 2), 80);
check('정확도 — 다 맞음',          accuracy(10, 10, 0), 100);
check('정확도 — 입력 없음',        accuracy(0, 0, 0), 0);

// 제시보다 길게 쳤을 때. 제시(10)만 분모로 잡으면 0% 가 되어 버린다.
// 긴 쪽(20)을 분모로 삼으면 '스무 번 눌러 열 번 맞았다' 는 뜻이 그대로 나온다.
check('정확도 — 제시보다 길게 침', accuracy(10, 20, 10), 50);
check('정확도 — 덜 쳤을 때',       accuracy(10, 4, 6), 40);

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

// ── 치는 동안의 오타 추적 ─────────────────────────────────
//
// 지워질 때만 판정하고, 문장을 마칠 때 최종 입력을 한 번 더 견준다.
// 지난번 문제(로→루 가 세 번 세어짐)와 이번 문제(ㅂ 하나 빠뜨렸더니 뒤가 전부 덧침)가
// 둘 다 다시 생기지 않는지 함께 확인한다.
console.log('\n[끝이 열린 정렬]');

const 쓰기 = ops => ops.map(o =>
  o.type === DELETE    ? `빠뜨림(${o.from})` :
  o.type === INSERT    ? `덧침(${o.to})` :
  o.type === TRANSPOSE ? `자리바꿈(${o.from}${o.to})` : `${o.from}>${o.to}`);

// 아직 치지 않은 뒷부분은 빠뜨림이 아니다
check('안 친 뒷부분은 셈에 넣지 않는다',
      쓰기(openDiff(decomposeToKeys('값싼 물건'), decomposeToKeys('값싼')).ops), []);
check('어디까지 쳤는지 스스로 고른다',
      openDiff(decomposeToKeys('값싼 물건'), decomposeToKeys('값싼')).reached,
      decomposeToKeys('값싼').length);
// 입력 길이로 잘랐을 때는 빠뜨린 뒤로 짝이 한 칸씩 밀렸다
check('빠뜨린 뒤에도 짝이 밀리지 않는다',
      쓰기(openDiff(decomposeToKeys('가방 운동장'), decomposeToKeys('가ㅏㅇ 운')).ops), ['빠뜨림(ㅂ)']);

console.log('\n[따라 치기 — 고쳐도 남고, 하나는 하나로]');

// 한글 조합 중간 상태도 키로 쪼개면 최종 키열의 앞부분이다.
// 그냥 쳐 나가는 구간은 키를 하나씩 늘려서 앱이 받는 입력을 흉내 낸다.
const 키씩   = text => { const k = decomposeToKeys(text); return k.map((_, i) => k.slice(0, i + 1)); };
const 이어서 = (from, text) => { const k = decomposeToKeys(text); return k.slice(from).map((_, i) => k.slice(0, from + i + 1)); };
const 단계   = texts => texts.map(decomposeToKeys);

function 따라치기(제시, 입력들, opts) {
  const tracker = createErrorTracker(decomposeToKeys(제시));
  for (const 입력 of 입력들) tracker.update(입력);
  return tracker.finish(입력들.at(-1), opts);
}
const 결과 = (제시, 입력들, opts) => 쓰기(따라치기(제시, 입력들, opts).ops);

// 친구가 알려 준 경우. 예전에는 13곳(덧침 11)으로 잡혔다.
check('"가ㅏㅇ 운동장" — ㅂ 하나 빠뜨림',
      결과('가방 운동장', 키씩('가ㅏㅇ 운동장')), ['빠뜨림(ㅂ)']);
check('긴 문장 앞에서 빠뜨려도 하나 (예전 35곳)',
      결과('가방 운동장을 가로질러 뛰어갔다', 키씩('가ㅏㅇ 운동장을 가로질러 뛰어갔다')), ['빠뜨림(ㅂ)']);

// 지난번 문제. 정렬이 흔들려 ㅓ>ㅜ, ㅡ>ㅜ, ㅗ>ㅜ 로 세 번 적힌 적이 있다.
check('로→루 오타 하나는 하나로',
      결과('희망찬 목소리로 인사를', 키씩('희망찬 목소리루 인사를')), ['ㅗ>ㅜ']);

check('자모 하나 더 침 (예전 2곳)',
      결과('가방 운동장', 키씩('가방ㅁ 운동장')), ['덧침(ㅁ)']);

// 지우고 고친 경우 — 어떤 길로 고쳐도 기록이 남아야 한다
check('오타 → 백스페이스로 지우고 고침',
      결과('값싼', 단계(['값', '값ㅆ', '값씨', '값ㅆ', '값싸', '값싼'])), ['ㅏ>ㅣ']);
check('오타 → 덮어써서 고침 (길이가 그대로)',
      결과('값싼', 단계(['값', '값씨', '값싸', '값싼'])), ['ㅏ>ㅣ']);
check('오타 → 조합이 이어지며 고침 (길이가 늘어남)',
      결과('값싼', 단계(['값', '값ㅆ', '값씨', '값씬', '값싼'])), ['ㅏ>ㅣ']);
check('빠뜨렸다 알아채고 바로 고침',
      결과('가방', 단계(['ㄱ', '가', '가ㅏ', '가', '갑', '가바', '가방'])), ['빠뜨림(ㅂ)']);
check('빠뜨리고 더 친 뒤 한꺼번에 지우고 고침',
      결과('가방 운동장', [...키씩('가ㅏㅇ 운'), decomposeToKeys('가'), ...이어서(2, '가방 운동장')]),
      ['빠뜨림(ㅂ)']);
check('오타 내고 더 친 뒤 한꺼번에 지우고 고침',
      결과('값싼 물건', [...키씩('값씬 무'), decomposeToKeys('값'), ...이어서(4, '값싼 물건')]),
      ['ㅏ>ㅣ']);

// 같은 자리에서 같은 실수를 되풀이해도 한 번으로 센다
check('같은 오타를 두 번 내고 고쳐도 한 번',
      결과('값싼', 단계(['값씨', '값ㅆ', '값씨', '값ㅆ', '값싼'])), ['ㅏ>ㅣ']);

// 오탐이 없어야 한다
check('맞게만 치면 오타 없음',
      결과('값싼', 단계(['ㄱ', '가', '갑', '값', '값ㅆ', '값싸', '값싼'])), []);
check('맞게 치다 지우고 다시 쳐도 오타 없음',
      결과('값싼 물건', [...키씩('값싼 물'), decomposeToKeys('값'), ...이어서(4, '값싼 물건')]), []);

// 고치지 않고 남겨 둔 오타는 문장을 마칠 때 센다
check('고치지 않은 오타는 끝에서 센다',
      결과('값싼', 키씩('값씬')), ['ㅏ>ㅣ']);
check('엔터로 마쳤는데 끝을 덜 쳤으면 빠뜨림',
      결과('값싼', 키씩('값싸')), ['빠뜨림(ㄴ)']);

console.log('\n[그만하고 결과 보기 — 치다 만 문장]');
const 치다만 = 따라치기('가방 운동장을 가로질러', 키씩('가ㅏㅇ 운동'), { partial: true });
check('치다 만 문장도 빠뜨림 하나만', 쓰기(치다만.ops), ['빠뜨림(ㅂ)']);
check('어디까지 친 것으로 보는지 (정확도 분모)',
      치다만.targetLength, decomposeToKeys('가방 운동').length);

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);
