// 1차시 확인용 테스트. 실행: node src/hangul.test.js
import { decompose, decomposeToString } from './hangul.js';

// [입력, 기대하는 결과] 목록
const cases = [
  ['안녕', 'ㅇㅏㄴㄴㅕㅇ'],   // 계획서에 적은 1차시 목표
  ['가', 'ㄱㅏ'],             // 받침 없는 글자
  ['값', 'ㄱㅏㅄ'],           // 겹받침
  ['한글', 'ㅎㅏㄴㄱㅡㄹ'],
  ['타자 연습', 'ㅌㅏㅈㅏ ㅇㅕㄴㅅㅡㅂ'], // 공백은 그대로 통과
  ['ok?', 'ok?'],             // 한글이 아니면 그대로
];

let pass = 0;
for (const [input, expected] of cases) {
  const actual = decomposeToString(input);
  const ok = actual === expected;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  "${input}" -> "${actual}"${ok ? '' : `  (기대: "${expected}")`}`);
}

console.log(`\n${pass}/${cases.length} 통과`);
console.log('배열 형태:', decompose('안녕'));

process.exit(pass === cases.length ? 0 : 1);
