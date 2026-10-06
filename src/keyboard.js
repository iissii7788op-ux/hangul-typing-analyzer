// 두벌식 자판의 키 위치.
//
// 오타가 '옆 키를 잘못 누른 것' 인지 '엉뚱하게 먼 키를 누른 것' 인지 가르려면
// 자모가 자판 어디에 있는지 알아야 한다. ㅕ(U) 를 ㅛ(Y) 로 친 것은 바로 옆 키지만,
// ㅕ 를 ㅋ(Z) 로 친 것은 전혀 다른 실수다.

// 두벌식 자판을 줄 단위로 적는다. 쿼티 자판의 글쇠 순서 그대로다.
const ROWS = [
  ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'],   // QWERTYUIOP
  ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'],        // ASDFGHJKL
  ['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ'],                  // ZXCVBNM
];

// 실제 자판은 줄마다 조금씩 오른쪽으로 밀려 있다. 그 어긋남을 반영해야
// 대각선 방향 이웃까지 제대로 '옆 키' 로 잡힌다.
const ROW_OFFSET = [0, 0.25, 0.75];

// Shift 를 같이 누르는 자모는 기본 자모와 같은 자리에 있다.
const SHIFT_PAIR = {
  'ㅃ': 'ㅂ', 'ㅉ': 'ㅈ', 'ㄸ': 'ㄷ', 'ㄲ': 'ㄱ', 'ㅆ': 'ㅅ',
  'ㅒ': 'ㅐ', 'ㅖ': 'ㅔ',
};

// 자모 -> { row, col } 표를 만든다.
const POSITION = new Map();
ROWS.forEach((row, rowIndex) => {
  row.forEach((jamo, colIndex) => {
    POSITION.set(jamo, { row: rowIndex, col: colIndex + ROW_OFFSET[rowIndex] });
  });
});
for (const [shifted, base] of Object.entries(SHIFT_PAIR)) {
  POSITION.set(shifted, POSITION.get(base));
}

// 자판 위 위치를 돌려준다. 자판에 없는 글자(공백 등)는 null.
export function keyPosition(jamo) {
  return POSITION.get(jamo) ?? null;
}

// 두 자모의 자판 위 거리. 둘 중 하나라도 자판에 없으면 null.
// 바로 옆 키는 1, 대각선은 약 1.03~1.25 가 나온다.
export function keyDistance(a, b) {
  const p = keyPosition(a), q = keyPosition(b);
  if (!p || !q) return null;
  return Math.hypot(p.row - q.row, p.col - q.col);
}

// 손가락이 닿는 범위의 이웃인지. 상하좌우와 대각선까지를 '옆 키' 로 본다.
// 1.5 로 잡으면 줄이 어긋난 대각선 이웃까지 들어오고, 한 칸 건너뛴 키는 빠진다.
export const NEIGHBOR_LIMIT = 1.5;

export function isNeighborKey(a, b) {
  const d = keyDistance(a, b);
  return d !== null && d > 0 && d <= NEIGHBOR_LIMIT;
}
