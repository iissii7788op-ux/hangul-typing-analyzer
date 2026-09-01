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
