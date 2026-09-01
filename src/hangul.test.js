// 자모 분해 확인 테스트. 실행: node src/hangul.test.js
import { decompose, decomposeToString, decomposeToKeysString } from './hangul.js';

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

console.log(`\n${pass}/${total} 통과`);

// ── 왜 키 단위가 필요한지 보여 주는 예시 ──────────────────────
console.log('\n─── "값"을 "갑"으로 잘못 쳤다면 ───');
console.log('자모 단위:', decomposeToString('값'), 'vs', decomposeToString('갑'),
            '  -> ㅄ 을 ㅂ 으로 교체 (자판에 없는 오타)');
console.log('키   단위:', decomposeToKeysString('값'), 'vs', decomposeToKeysString('갑'),
            '  -> ㅅ 을 빼먹음 (실제로 손가락이 한 일)');

process.exit(pass === total ? 0 : 1);
