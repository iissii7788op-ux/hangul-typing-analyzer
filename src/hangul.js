// 한글 자모 분해 모듈
// 완성형 한글(가~힣)을 초성/중성/종성으로 쪼갠다.

// 한글 완성자가 시작하는 유니코드 값 ('가')과 끝나는 값 ('힣')
const BASE = 0xAC00;
const LAST = 0xD7A3;

// 중성은 21개, 종성은 28개(받침 없음 포함) -> 한 초성이 차지하는 칸 수는 21*28
const JUNG_COUNT = 21;
const JONG_COUNT = 28;

// 유니코드 순서 그대로 나열한 표. 위 계산으로 나온 '번호'를 실제 글자로 바꿀 때 쓴다.
export const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
export const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
// 0번은 '받침 없음'이라 빈 문자열이다.
export const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

// 글자 하나가 완성형 한글인지 확인한다.
export function isHangulSyllable(ch) {
  const code = ch.codePointAt(0);
  return code >= BASE && code <= LAST;
}

// 글자 하나를 [초성, 중성, 종성] 배열로 쪼갠다. 받침이 없으면 2칸만 돌려준다.
// 한글이 아니면(공백, 영어, 문장부호) 그 글자를 그대로 담은 1칸짜리 배열을 돌려준다.
export function decomposeChar(ch) {
  if (!isHangulSyllable(ch)) return [ch];

  const offset = ch.codePointAt(0) - BASE;

  const jongIndex = offset % JONG_COUNT;
  const jungIndex = Math.floor(offset / JONG_COUNT) % JUNG_COUNT;
  const choIndex  = Math.floor(offset / JONG_COUNT / JUNG_COUNT);

  const result = [CHO[choIndex], JUNG[jungIndex]];
  if (jongIndex !== 0) result.push(JONG[jongIndex]);
  return result;
}

// 문장 전체를 자모 하나하나가 순서대로 들어있는 배열로 편다.
// 나중에 편집 거리(DP)로 비교할 때 이 '자모 배열'이 기본 단위가 된다.
export function decompose(text) {
  const out = [];
  for (const ch of text) out.push(...decomposeChar(ch));
  return out;
}

// 눈으로 확인하기 좋게 문자열로 붙여서 돌려준다.
export function decomposeToString(text) {
  return decompose(text).join('');
}

// ─────────────────────────────────────────────────────────────
// 여기부터: 자모 단위를 '두벌식 자판 키 단위'로 한 번 더 쪼갠다.
//
// 유니코드가 세는 단위와 손가락이 누르는 단위는 다르다.
// 유니코드는 'ㅄ'을 완성된 종성 하나로 보지만, 두벌식 자판에 'ㅄ' 키는 없다.
// 실제로는 ㅂ 키와 ㅅ 키를 차례로 누른다.
//
// 이 구분이 중요한 이유:
//   '값'을 '갑'으로 잘못 쳤을 때
//     자모 단위 -> ㅄ 을 ㅂ 으로 '교체'했다   (자판에 없는 오타 통계가 쌓인다)
//     키 단위   -> ㅅ 을 빼먹었다 '삭제'      (실제로 손가락이 한 일)
// ─────────────────────────────────────────────────────────────

// 겹받침 11개. 값에 없는 종성(ㄱ, ㄴ, ㄹ...)은 원래 한 키라 표에 넣지 않는다.
export const COMPLEX_JONG = {
  'ㄳ': ['ㄱ','ㅅ'], 'ㄵ': ['ㄴ','ㅈ'], 'ㄶ': ['ㄴ','ㅎ'],
  'ㄺ': ['ㄹ','ㄱ'], 'ㄻ': ['ㄹ','ㅁ'], 'ㄼ': ['ㄹ','ㅂ'], 'ㄽ': ['ㄹ','ㅅ'],
  'ㄾ': ['ㄹ','ㅌ'], 'ㄿ': ['ㄹ','ㅍ'], 'ㅀ': ['ㄹ','ㅎ'], 'ㅄ': ['ㅂ','ㅅ'],
};

// 복합 모음 7개.
// 주의: ㅐ ㅔ ㅒ ㅖ 는 모양이 ㅏ+ㅣ 처럼 생겼어도 두벌식에서는 각각 독립된 키다.
//       (o, p, Shift+o, Shift+p) 그래서 이 표에 넣지 않는다.
export const COMPLEX_JUNG = {
  'ㅘ': ['ㅗ','ㅏ'], 'ㅙ': ['ㅗ','ㅐ'], 'ㅚ': ['ㅗ','ㅣ'],
  'ㅝ': ['ㅜ','ㅓ'], 'ㅞ': ['ㅜ','ㅔ'], 'ㅟ': ['ㅜ','ㅣ'], 'ㅢ': ['ㅡ','ㅣ'],
};

// 자모 하나를 실제로 눌러야 하는 키 배열로 바꾼다.
// 표에 있으면 두 키로, 없으면 그대로 한 키로 돌려준다.
// 표를 '한 번만' 적용하는 것이 핵심이다. 재귀로 계속 쪼개면
// ㅙ -> ㅗ + ㅐ 까지는 맞지만 거기서 ㅐ -> ㅏ + ㅣ 로 더 쪼개져 틀린 결과가 된다.
export function toKeys(jamo) {
  return COMPLEX_JONG[jamo] ?? COMPLEX_JUNG[jamo] ?? [jamo];
}

// 문장을 '실제로 누르는 키' 순서대로 편다.
// 편집 거리(DP)와 자판 거리 계산은 이 배열을 기준으로 해야 실제 타이핑과 일치한다.
export function decomposeToKeys(text) {
  const out = [];
  for (const jamo of decompose(text)) out.push(...toKeys(jamo));
  return out;
}

// 눈으로 확인하기 좋게 문자열로 붙여서 돌려준다.
export function decomposeToKeysString(text) {
  return decomposeToKeys(text).join('');
}

// ─────────────────────────────────────────────────────────────
// 여기부터: 각 자모/키가 '원래 몇 번째 글자에서 나왔는지' 꼬리표를 붙인다.
//
// 위의 decompose 계열은 자모를 한 줄로 펴기만 해서, 오류를 찾아도
// 그게 원문의 몇 번째 글자였는지 되돌릴 수 없다.
// 3차시의 '틀린 글자 색칠'과 5차시의 히트맵에는 이 정보가 필요하다.
//
// 받침이 없을 때 종성 자리를 빈칸으로 채워 3칸 고정으로 만드는 방법도 있지만
// 그렇게 하면 '가'->'갈' 오타가 삽입이 아니라 '빈칸->ㄹ 교체'로 잡혀서
// 오타 유형 분류가 망가진다. 게다가 키 단위에서는 겹받침 때문에
// 글자당 칸 수가 2~4개로 달라져 고정 길이가 성립하지도 않는다.
// 그래서 길이를 고정하는 대신 꼬리표를 붙인다.
// ─────────────────────────────────────────────────────────────

// 자모마다 { jamo, charIndex, role } 을 붙여서 돌려준다.
// charIndex 는 원문에서 몇 번째 글자인지(0부터), role 은 초성/중성/종성 구분이다.
// 주의: charIndex 는 코드포인트 순번이라, 원문 글자를 꺼낼 때는
//       text[i] 가 아니라 [...text][charIndex] 로 접근해야 안전하다.
export function decomposeDetailed(text) {
  const out = [];
  let charIndex = 0;
  for (const ch of text) {
    if (!isHangulSyllable(ch)) {
      out.push({ jamo: ch, charIndex, role: 'other' });
    } else {
      const [cho, jung, jong] = decomposeChar(ch);
      out.push({ jamo: cho, charIndex, role: 'cho' });
      out.push({ jamo: jung, charIndex, role: 'jung' });
      // 받침이 없으면 decomposeChar 가 2칸만 주므로 jong 은 undefined 가 된다.
      if (jong) out.push({ jamo: jong, charIndex, role: 'jong' });
    }
    charIndex++;
  }
  return out;
}

// 키 단위로 펴면서 꼬리표를 유지한다.
// 겹받침/복합모음이 두 키로 쪼개지면 두 키가 같은 charIndex 와 role 을 물려받고,
// fromComplex 로 '원래 한 자모였다'는 표시를 남긴다.
export function decomposeToKeysDetailed(text) {
  const out = [];
  for (const { jamo, charIndex, role } of decomposeDetailed(text)) {
    const keys = toKeys(jamo);
    for (const key of keys) {
      out.push({ key, charIndex, role, fromComplex: keys.length > 1 });
    }
  }
  return out;
}
