// 맞춤 연습 문장 테스트. 실행: node src/practice.test.js
import {
  pickWeakJamo, wordValue, buildPracticeSentence, charCount,
  attachJosa, parseTemplate, fillTemplate, buildPracticeSet,
  cumulativeWeakJamo, CUSTOM_UNLOCK_SESSIONS, nextCustomSet, RECENT_ROUNDS,
  recentRoundsFromSessions,
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

// ── 9) 맞춤 훈련 모드: 누적 기록과 지난 문장 빼기 ─────────────
console.log('\n[맞춤 훈련]');

// 여러 회차에 흩어진 같은 자모의 오류는 합쳐서 센다
check('회차별 오류를 자모별로 합친다',
      cumulativeWeakJamo([
        { from: 'ㅕ', count: 2 }, { from: 'ㄱ', count: 3 }, { from: 'ㅕ', count: 2 },
      ], [], 2),
      ['ㅕ', 'ㄱ']);
check('느린 자모도 함께 본다',
      cumulativeWeakJamo([{ from: 'ㄱ', count: 1 }], [{ key: 'ㅎ', avg: 600 }], 2), ['ㅎ', 'ㄱ']);
check('기록이 없으면 취약 자모도 없다', cumulativeWeakJamo([], [], 3), []);
checkTrue('3판이 쌓여야 열린다', CUSTOM_UNLOCK_SESSIONS === 3);

const 첫판 = buildPracticeSet(SENTENCES, TEMPLATES, CATEGORIES, ['ㅕ', 'ㅡ', 'ㅆ'], { maxChars: 80 });
const 둘째판 = buildPracticeSet(SENTENCES, TEMPLATES, CATEGORIES, ['ㅕ', 'ㅡ', 'ㅆ'],
                              { maxChars: 80, exclude: 첫판.sentences });
checkTrue('맞춤 라운드는 80자 안에서 4문장 이상',
          첫판.sentences.length >= 4 && charCount(첫판.sentences.join('')) <= 80,
          `-> ${첫판.sentences.length}문장`);
checkTrue('지난 라운드 문장은 다시 나오지 않는다',
          둘째판.sentences.length > 0 && 둘째판.sentences.every(s => !첫판.sentences.includes(s)),
          `-> ${둘째판.sentences.join(' / ')}`);

// ── 10) 같은 문장이 번갈아 되풀이되지 않게 ───────────────────
console.log('\n[최근 라운드 빼기]');

// 취약 자모가 그대로인 채로 맞춤 라운드를 연달아 연다. 앱이 하는 일과 같다.
function 연달아(weak, 횟수, 문장들 = SENTENCES, 틀들 = TEMPLATES, 범주 = CATEGORIES) {
  let recent = []; const 라운드들 = [];
  for (let i = 0; i < 횟수; i++) {
    const r = nextCustomSet(문장들, 틀들, 범주, weak, recent, { maxChars: 80 });
    라운드들.push(r.set.sentences); recent = r.recentRounds;
  }
  return { 라운드들, recent };
}
const 세트키 = r => [...r].sort().join('|');
const 취약 = ['ㅗ', 'ㄹ', 'ㅏ'];

// 바로 앞 라운드만 뺐더니 두 세트가 번갈아 나왔다(8라운드 중 서로 다른 세트 2개).
const 여덟 = 연달아(취약, 8).라운드들;
checkTrue('8라운드에 서로 다른 세트가 4개 이상 (예전에는 2개)',
          new Set(여덟.map(세트키)).size >= RECENT_ROUNDS + 1,
          `-> ${new Set(여덟.map(세트키)).size}개`);
checkTrue('한 문장은 최근 라운드 수만큼 쉬었다가 다시 나온다',
          여덟.every((r, i) => 여덟.slice(Math.max(0, i - RECENT_ROUNDS), i)
                                  .every(앞 => r.every(s => !앞.includes(s)))));
checkTrue('두 라운드 전 세트가 그대로 돌아오지 않는다 (번갈아 반복 방지)',
          세트키(여덟[2]) !== 세트키(여덟[0]) && 세트키(여덟[3]) !== 세트키(여덟[1]));

// 처음 라운드는 아무것도 안 뺀 것과 같아야 한다 (몰림이 떨어지지 않는다)
check('첫 라운드는 예전과 같은 문장',
      연달아(취약, 1).라운드들[0],
      buildPracticeSet(SENTENCES, TEMPLATES, CATEGORIES, 취약, { maxChars: 80 }).sentences);

checkTrue('기억하는 라운드는 최근 몇 개뿐이다 (끝없이 쌓이지 않는다)',
          연달아(취약, 10).recent.length === RECENT_ROUNDS, `-> ${연달아(취약, 10).recent.length}개`);

// 후보가 바닥나면 빼지 않고 다시 고르며, 기억도 새로 시작한다
const 작은문장 = ['형은 요리를 했다', '여동생이 여행을 갔다', '효도를 했다'];
const 작은 = 연달아(['ㅕ', 'ㅛ'], 4, 작은문장, [], {});
checkTrue('후보가 바닥나도 문장은 계속 나온다',
          작은.라운드들.every(r => r.length > 0), `-> ${작은.라운드들.map(r => r.length)}`);
checkTrue('바닥나면 기억을 비우고 다시 시작한다',
          작은.recent.length >= 1 && 작은.recent.length <= RECENT_ROUNDS);

// 취약 자모가 없으면 문장도 없고, 그 빈 라운드를 기억하지는 않는다
const 없음 = nextCustomSet(SENTENCES, TEMPLATES, CATEGORIES, [], [['지난 문장']], { maxChars: 80 });
check('취약 자모가 없으면 빈 라운드', 없음.set.sentences, []);
check('빈 라운드는 기억하지 않는다', 없음.recentRounds, [['지난 문장']]);

// ── 11) 새로고침해도 최근 라운드를 DB 기록에서 되살린다 ──────
console.log('\n[DB 기록에서 최근 맞춤 라운드 되살리기]');

// DB 에는 라운드마다 [{ target, typed }] 꼴로 문장이 저장된다. 최신 기록이 앞에 온다.
const 기록 = 문장들 => ({ sentences: 문장들.map(target => ({ target, typed: target })) });
const 기본문장 = ['기본 하나', '기본 둘', '기본 셋'];

// 맞춤 라운드와 기본 진단 라운드가 섞여 저장된 모양 (최신이 앞)
const 섞인기록 = [
  기록(기본문장),                    // 최신: 기본 진단
  기록(['맞춤 D1', '맞춤 D2']),      // 맞춤
  기록(기본문장),                    // 기본 진단
  기록(['맞춤 C1', '맞춤 C2']),      // 맞춤
  기록(['맞춤 B1']),                 // 맞춤
  기록(['맞춤 A1', '맞춤 A2']),      // 맞춤 (3개를 넘는다)
];

const 되살림 = recentRoundsFromSessions(섞인기록, 기본문장);
check('기본 진단은 건너뛰고 최근 맞춤 라운드만 담는다',
      되살림, [['맞춤 B1'], ['맞춤 C1', '맞춤 C2'], ['맞춤 D1', '맞춤 D2']]);
check('오래된 것이 앞에 온다 (nextCustomSet 이 기대하는 순서)',
      되살림.map(r => r[0]), ['맞춤 B1', '맞춤 C1', '맞춤 D1']);
check('기억하는 개수를 넘으면 가장 최근 것만', 되살림.length, RECENT_ROUNDS);
check('기본 진단만 있으면 빈 목록', recentRoundsFromSessions([기록(기본문장), 기록(기본문장)], 기본문장), []);
check('기록이 없으면 빈 목록', recentRoundsFromSessions([], 기본문장), []);

// 저장된 모양이 깨져 있어도 앱이 죽지 않는다 (null, 문자열, 문장 없는 줄)
check('깨진 기록은 건너뛴다',
      recentRoundsFromSessions([
        { sentences: null }, { sentences: '문자열' }, { sentences: [] }, {},
        { sentences: [{ typed: 'target 없음' }, null, { target: '' }] },
        기록(['맞춤 정상']),
      ], 기본문장),
      [['맞춤 정상']]);

// 가장 중요한 것: 새로고침한 뒤 첫 맞춤 라운드가 이전에 한 라운드와 겹치지 않아야 한다.
// 라운드를 세 번 열고 저장한 것처럼 기록을 만든 뒤, 기억이 사라진 새 페이지에서 이어 본다.
const 새로고침 = (() => {
  const 취약자모 = ['ㅗ', 'ㄹ', 'ㅏ'];
  let recent = []; const 저장된 = [];                // 저장된 기록: 최신이 앞
  for (let i = 0; i < 3; i++) {
    const r = nextCustomSet(SENTENCES, TEMPLATES, CATEGORIES, 취약자모, recent, { maxChars: 80 });
    recent = r.recentRounds; 저장된.unshift(기록(r.set.sentences));
  }
  // 새로고침: 기억(recent)은 사라지고 DB 기록만 남는다
  const 잃어버린뒤 = nextCustomSet(SENTENCES, TEMPLATES, CATEGORIES, 취약자모, [], { maxChars: 80 });
  const 되살린 = recentRoundsFromSessions(저장된, ['기본'], RECENT_ROUNDS);
  const 이어서 = nextCustomSet(SENTENCES, TEMPLATES, CATEGORIES, 취약자모, 되살린, { maxChars: 80 });
  const 예전문장 = 저장된.flatMap(x => x.sentences.map(t => t.target));
  return { 겹침없이: 이어서.set.sentences.every(t => !예전문장.includes(t)),
           기억없이는겹침: 잃어버린뒤.set.sentences.some(t => 예전문장.includes(t)),
           문장수: 이어서.set.sentences.length };
})();
checkTrue('기억을 잃으면 예전 문장이 그대로 나온다 (고치기 전의 문제)', 새로고침.기억없이는겹침);
checkTrue('DB 기록으로 되살리면 새로고침 뒤에도 겹치지 않는다', 새로고침.겹침없이,
          `-> ${새로고침.문장수}문장`);

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);
