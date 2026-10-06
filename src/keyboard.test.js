// 자판 좌표 테스트. 실행: node src/keyboard.test.js
import { keyPosition, keyDistance, isNeighborKey } from './keyboard.js';

let pass = 0, total = 0;
function check(label, actual, expected) {
  total++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} -> ${JSON.stringify(actual)}${ok ? '' : `  (기대: ${JSON.stringify(expected)})`}`);
}

console.log('[자리 찾기]');
check('ㅂ 은 첫 줄 맨 왼쪽', keyPosition('ㅂ'), { row: 0, col: 0 });
check('ㅆ 은 ㅅ 과 같은 자리', keyPosition('ㅆ'), keyPosition('ㅅ'));
check('ㄲ 은 ㄱ 과 같은 자리', keyPosition('ㄲ'), keyPosition('ㄱ'));
check('공백은 자판에 없다', keyPosition(' '), null);

console.log('\n[옆 키 판정]');
// 계획서에 적은 예시: ㅕ 를 ㅛ 로 친 오타는 바로 옆 키다 (U 와 Y)
check('ㅕ 와 ㅛ 는 옆 키', isNeighborKey('ㅕ', 'ㅛ'), true);
check('ㅏ 와 ㅣ 는 옆 키', isNeighborKey('ㅏ', 'ㅣ'), true);
check('ㄴ 과 ㅇ 은 옆 키', isNeighborKey('ㄴ', 'ㅇ'), true);
check('ㅈ 과 ㄴ 은 옆 키(대각선)', isNeighborKey('ㅈ', 'ㄴ'), true);
check('ㅂ 과 ㅔ 는 멀다', isNeighborKey('ㅂ', 'ㅔ'), false);
check('ㅕ 와 ㅋ 은 멀다', isNeighborKey('ㅕ', 'ㅋ'), false);
check('같은 키끼리는 옆 키가 아니다', isNeighborKey('ㅅ', 'ㅆ'), false);
check('공백과는 잴 수 없다', isNeighborKey('ㅅ', ' '), false);

console.log('\n[거리]');
check('바로 옆은 1', keyDistance('ㅂ', 'ㅈ'), 1);
check('자판 밖은 null', keyDistance('ㅅ', ' '), null);

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);
