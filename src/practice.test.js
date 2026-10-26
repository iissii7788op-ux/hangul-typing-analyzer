// 맞춤 연습 문장 테스트. 실행: node src/practice.test.js
import { pickWeakJamo, wordValue, buildPracticeSentence } from './practice.js';
import { decomposeToKeys } from './hangul.js';
import { WORDS } from './words.js';

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

// ── 1) 취약 자모 고르기 ──────────────────────────────────
console.log('[취약 자모]');

// 오타가 난 자모가 가장 앞에 와야 한다
check('오타가 많은 자모가 1순위',
      pickWeakJamo(new Map([['ㅕ', 5], ['ㄱ', 1]]), [], 2), ['ㅕ', 'ㄱ']);

// 오타가 없으면 느린 자모를 본다
check('오타가 없으면 느린 자모',
      pickWeakJamo(new Map(), [{ key: 'ㅄ', avg: 400 }, { key: 'ㄱ', avg: 100 }], 2),
      ['ㅄ', 'ㄱ']);

// 오타 한 번(10점)이 느림 500ms(10점)와 맞먹는다
check('오타와 느림을 함께 본다',
      pickWeakJamo(new Map([['ㄱ', 1]]), [{ key: 'ㅎ', avg: 600 }], 2), ['ㅎ', 'ㄱ']);

// ── 2) 단어의 가치 ───────────────────────────────────────
console.log('\n[단어에 취약 자모가 몇 개나]');
check('"여행" 에 든 ㅕ 개수', wordValue('여행', ['ㅕ']), 1);
check('"며칠" 과 ㅕ', wordValue('며칠', ['ㅕ']), 1);
check('"값" 에 든 ㅂ,ㅅ', wordValue('값', ['ㅂ', 'ㅅ']), 2);   // 겹받침이 두 키로 쪼개진다
check('없으면 0', wordValue('하늘', ['ㅕ']), 0);

// ── 3) 배낭으로 문장 만들기 ──────────────────────────────
console.log('\n[배낭 알고리즘]');

const 짧은목록 = ['여행', '하늘', '며칠', '구름', '연필'];

const r = buildPracticeSentence(짧은목록, ['ㅕ'], 6);
checkTrue('글자 수 제한을 지킨다',
          [...r.text.replace(/ /g, '')].length <= 6, `-> "${r.text}"`);
checkTrue('취약 자모가 없는 단어는 안 고른다',
          !r.picked.includes('하늘') && !r.picked.includes('구름'), `-> ${JSON.stringify(r.picked)}`);
checkTrue('같은 단어를 두 번 쓰지 않는다',
          new Set(r.picked).size === r.picked.length, `-> ${JSON.stringify(r.picked)}`);

// 자리가 넉넉하면 ㅕ 가 든 단어를 더 담아야 한다
const 넉넉 = buildPracticeSentence(짧은목록, ['ㅕ'], 20);
checkTrue('자리가 넉넉하면 더 많이 담는다',
          넉넉.picked.length >= r.picked.length, `-> ${JSON.stringify(넉넉.picked)}`);

// 취약 자모가 없으면 만들 것이 없다
check('취약 자모가 없으면 빈 문장', buildPracticeSentence(짧은목록, [], 20).text, '');

// ── 4) 실제 단어 목록으로 ────────────────────────────────
console.log('\n[실제 단어 목록 160개]');

const 실전 = buildPracticeSentence(WORDS, ['ㅕ', 'ㅛ'], 20);
checkTrue('문장이 만들어진다', 실전.text.length > 0, `-> "${실전.text}"`);
checkTrue('글자 수 20 이내',
          [...실전.text.replace(/ /g, '')].length <= 20,
          `-> ${[...실전.text.replace(/ /g,'')].length}자`);

// 고른 단어에는 모두 취약 자모가 들어 있어야 한다
const 모두포함 = 실전.picked.every(w => {
  const keys = decomposeToKeys(w);
  return keys.includes('ㅕ') || keys.includes('ㅛ');
});
checkTrue('고른 단어마다 취약 자모가 들어 있다', 모두포함, `-> ${JSON.stringify(실전.picked)}`);

// 겹받침 자모로도 문장이 나와야 한다
const 겹받침 = buildPracticeSentence(WORDS, ['ㄺ', 'ㄹ', 'ㄱ'], 16);
checkTrue('겹받침 자모로도 만들어진다', 겹받침.text.length > 0, `-> "${겹받침.text}"`);

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);
