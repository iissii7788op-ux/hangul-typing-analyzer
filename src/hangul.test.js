// 자모 분해 확인 테스트. 실행: node src/hangul.test.js
import { decompose, decomposeToString, decomposeToKeysString,
         decomposeDetailed, decomposeToKeysDetailed } from './hangul.js';

let pass = 0, total = 0;

function check(label, actual, expected) {
  total++;
  const ok = actual === expected;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} -> "${actual}"${ok ? '' : `  (기대: "${expected}")`}`);
}

// ── 1) 자모 단위 분해 (유니코드 기준) ─────────────────────────
console.log('[자모 단위]');
[
  ['안녕', 'ㅇㅏㄴㄴㅕㅇ'],          // 1차시 목표
  ['가', 'ㄱㅏ'],                    // 받침 없는 글자
  ['값', 'ㄱㅏㅄ'],                  // 겹받침이 한 덩어리로 나온다
  ['한글', 'ㅎㅏㄴㄱㅡㄹ'],
  ['타자 연습', 'ㅌㅏㅈㅏ ㅇㅕㄴㅅㅡㅂ'], // 공백은 그대로 통과
  ['ok?', 'ok?'],                    // 한글이 아니면 그대로
].forEach(([input, expected]) => check(`"${input}"`, decomposeToString(input), expected));

// ── 2) 키 단위 분해 (두벌식 자판 기준) ────────────────────────
console.log('\n[키 단위]');
[
  ['값', 'ㄱㅏㅂㅅ'],        // 겹받침 ㅄ -> ㅂ + ㅅ
  ['닭', 'ㄷㅏㄹㄱ'],        // 겹받침 ㄺ -> ㄹ + ㄱ
  ['왜', 'ㅇㅗㅐ'],          // 복합모음 ㅙ -> ㅗ + ㅐ, 여기서 멈춰야 한다
  ['의사', 'ㅇㅡㅣㅅㅏ'],    // 복합모음 ㅢ -> ㅡ + ㅣ
  ['뷁', 'ㅂㅜㅔㄹㄱ'],      // 복합모음 + 겹받침 동시에
  ['안녕', 'ㅇㅏㄴㄴㅕㅇ'],  // 쪼갤 게 없으면 자모 단위와 같아야 한다
].forEach(([input, expected]) => check(`"${input}"`, decomposeToKeysString(input), expected));

// ── 3) 함정: 쪼개면 안 되는 것들 ──────────────────────────────
console.log('\n[쪼개면 안 되는 것]');
[
  ['개', 'ㄱㅐ'],    // ㅐ 는 ㅏ+ㅣ 가 아니라 독립된 한 키
  ['네', 'ㄴㅔ'],    // ㅔ 도 마찬가지
  ['얘', 'ㅇㅒ'],    // ㅒ 는 Shift+o 한 키
  ['꽃', 'ㄲㅗㅊ'],  // 쌍자음은 Shift 조합이지만 키는 하나
  ['있다', 'ㅇㅣㅆㄷㅏ'],
].forEach(([input, expected]) => check(`"${input}"`, decomposeToKeysString(input), expected));

// ── 4) 글자 위치 꼬리표 ───────────────────────────────────────
console.log('\n[글자 위치 꼬리표]');

// '값' 은 키 4개로 펴지지만 모두 원문 0번 글자에서 나와야 한다.
const gaps = decomposeToKeysDetailed('값');
check('"값" 키 목록', gaps.map(k => k.key).join(''), 'ㄱㅏㅂㅅ');
check('"값" 글자번호', gaps.map(k => k.charIndex).join(''), '0000');
check('"값" 역할', gaps.map(k => k.role).join(','), 'cho,jung,jong,jong');
check('"값" 겹받침표시', gaps.map(k => k.fromComplex ? 'Y' : 'N').join(''), 'NNYY');

// 글자마다 칸 수가 달라도(가=2칸, 값=4칸) 번호는 정확히 따라가야 한다.
check('"가값" 글자번호', decomposeToKeysDetailed('가값').map(k => k.charIndex).join(''), '001111');
check('"안녕" 글자번호', decomposeDetailed('안녕').map(k => k.charIndex).join(''), '000111');
check('"타자 연습" 글자번호', decomposeDetailed('타자 연습').map(k => k.charIndex).join(''), '00112333444');

// 오류가 난 키에서 원문 글자를 되찾을 수 있어야 한다 (3차시 색칠에 필요).
const text = '안녕하세요';
const third = decomposeToKeysDetailed(text)[2];   // 3번째 키 = '안'의 받침 ㄴ
check('3번째 키가 속한 글자', [...text][third.charIndex], '안');

console.log(`\n${pass}/${total} 통과`);

// ── 왜 키 단위가 필요한지 보여 주는 예시 ──────────────────────
console.log('\n─── "값"을 "갑"으로 잘못 쳤다면 ───');
console.log('자모 단위:', decomposeToString('값'), 'vs', decomposeToString('갑'),
            '  -> ㅄ 을 ㅂ 으로 교체 (자판에 없는 오타)');
console.log('키   단위:', decomposeToKeysString('값'), 'vs', decomposeToKeysString('갑'),
            '  -> ㅅ 을 빼먹음 (실제로 손가락이 한 일)');

process.exit(pass === total ? 0 : 1);
