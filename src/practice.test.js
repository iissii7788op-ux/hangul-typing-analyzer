// 맞춤 연습 문장 테스트. 실행: node src/practice.test.js
import {
  pickWeakJamo, wordValue, buildPracticeSentence, charCount,
  attachJosa, parseTemplate, fillTemplate, buildPracticeSet,
} from './practice.js';
import { decomposeToKeys } from './hangul.js';
import { WORDS } from './words.js';
import { SENTENCES } from './sentences.js';
import { TEMPLATES, CATEGORIES } from './templates.js';

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

// ── 5) 조사 붙이기 ────────────────────────────────────
console.log('\n[조사]');
check('받침 있으면 을', attachJosa('바람', '을/를'), '바람을');
check('받침 없으면 를', attachJosa('하늘가', '을/를'), '하늘가를');
check('받침 있으면 과', attachJosa('친구들', '과/와'), '친구들과');
check('받침 없으면 와', attachJosa('친구', '과/와'), '친구와');
check('받침 있으면 으로', attachJosa('운동장', '으로/로'), '운동장으로');
check('ㄹ 받침은 로', attachJosa('연필', '으로/로'), '연필로');
check('받침 없으면 로', attachJosa('바다', '으로/로'), '바다로');

// ── 6) 틀 채우기: 그룹 배낭 ──────────────────────────────
console.log('\n[그룹 배낭]');
check('틀 나누기', parseTemplate('{사람:과/와} {장소:에서} 놀았다'), [
  { slot: '사람', suffix: '과/와' }, { fixed: ' ' },
  { slot: '장소', suffix: '에서' }, { fixed: ' 놀았다' },
]);

const 범주 = {
  사람: ['동생', '형', '할머니'],
  장소: ['공원', '여행지', '교실'],
};
const 틀 = '{사람:과/와} {장소:에서} 놀았다';

const f = fillTemplate(틀, 범주, ['ㅕ'], 22);
check('ㅕ 가 든 단어로 빈칸을 채운다', f.text, '형과 여행지에서 놀았다');
check('빈칸마다 하나씩', f.words.length, 2);

// 글자 수 제한이 빠듯하면 짧은 단어로 바꿔야 한다
const 빠듯 = fillTemplate(틀, 범주, ['ㅕ'], 9);
checkTrue('글자 수 제한을 지킨다', 빠듯 && charCount(빠듯.text) <= 9, `-> "${빠듯?.text}"`);
check('빠듯하면 여행지를 포기한다', 빠듯.words, ['형', '공원']);

check('빈칸에 넣을 단어가 없으면 null', fillTemplate('{없는범주} 놀았다', 범주, ['ㅕ']), null);
check('틀 자체가 제한보다 길면 null', fillTemplate(틀, 범주, ['ㅕ'], 3), null);

// 틀에 원래 있는 자모(놀았다의 ㅆ)도 가치에 들어간다
check('틀 고정 부분도 가치에 센다', fillTemplate(틀, 범주, ['ㅆ']).value, 1);

// ── 7) 문장 묶음 고르기 ──────────────────────────────────
console.log('\n[문장 배낭]');
const 문장들 = [
  '여름 여행에서 별을 보았다',   // ㅕ 4
  '하늘이 맑고 푸르다',          // ㅕ 0
  '며칠 동안 편지를 썼다',       // ㅕ 3
];
const 묶음 = buildPracticeSet(문장들, [틀], 범주, ['ㅕ'], { maxChars: 30, templateChars: 22 });
checkTrue('글자 수 제한을 지킨다',
          charCount(묶음.sentences.join('')) <= 30, `-> ${JSON.stringify(묶음.sentences)}`);
checkTrue('취약 자모 없는 문장은 안 고른다', !묶음.sentences.includes('하늘이 맑고 푸르다'));

// 틀 세 개가 모두 '여행지' 를 고르려 한다. 같은 단어를 쓴 틀 문장은 함께 담지 않는다.
const 틀셋 = ['{장소:에서} 놀았다', '{장소:에} 갔다', '{사람:과/와} 걸었다'];
const 틀묶음 = buildPracticeSet([], 틀셋, 범주, ['ㅕ'], { maxChars: 40 });
checkTrue('틀 문장은 두 개까지', 틀묶음.sentences.length <= 2, `-> ${JSON.stringify(틀묶음.sentences)}`);
checkTrue('틀 문장끼리 같은 단어를 쓰지 않는다',
          틀묶음.sentences.filter(s => s.includes('여행지')).length <= 1);
check('취약 자모가 없으면 빈 묶음', buildPracticeSet(문장들, [틀], 범주, []).sentences, []);

// ── 8) 실제 문장 120개와 틀 16개로 ───────────────────────
console.log('\n[실제 문장과 틀]');

const 없는범주 = TEMPLATES.flatMap(t => parseTemplate(t).filter(p => p.slot && !CATEGORIES[p.slot]).map(p => p.slot));
check('틀의 빈칸 범주가 모두 있다', 없는범주, []);
checkTrue('틀마다 22자 안에서 채워진다',
          TEMPLATES.every(t => fillTemplate(t, CATEGORIES, ['ㅏ'], 22)),
          `-> ${TEMPLATES.filter(t => !fillTemplate(t, CATEGORIES, ['ㅏ'], 22)).join(', ')}`);
check('같은 문장이 두 번 들어 있지 않다', SENTENCES.length, new Set(SENTENCES).size);

for (const 취약 of [['ㄹ', 'ㅏ', 'ㄴ'], ['ㅕ', 'ㅡ', 'ㅆ'], ['ㅃ', 'ㅉ', 'ㄸ'], ['ㅠ', 'ㅑ', 'ㅖ']]) {
  const 묶 = buildPracticeSet(SENTENCES, TEMPLATES, CATEGORIES, 취약);
  checkTrue(`${취약.join('')}: 50자 안에서 문장 2개 이상`,
            묶.sentences.length >= 2 && charCount(묶.sentences.join('')) <= 50,
            `-> ${묶.sentences.join(' / ')}`);
}

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);
