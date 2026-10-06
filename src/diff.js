// 제시한 자모열과 실제로 친 자모열을 맞춰 보고, 어디서 어떻게 틀렸는지 뽑아낸다.
//
// 편집 거리는 '최소 몇 번 고치면 같아지는가' 라는 숫자만 알려 준다.
// 우리에게 필요한 건 숫자가 아니라 '어느 자모를 어느 자모로 잘못 쳤는가' 다.
// 그래서 표를 채운 뒤 거꾸로 되짚어(역추적) 연산 하나하나를 복원한다.

import { isNeighborKey } from './keyboard.js';

// 편집 연산 네 가지
export const SUBSTITUTE = 'substitute';  // 다른 자모를 눌렀다
export const DELETE     = 'delete';      // 쳐야 할 자모를 빠뜨렸다
export const INSERT     = 'insert';      // 없는 자모를 더 쳤다
export const TRANSPOSE  = 'transpose';   // 두 자모의 순서가 뒤바뀌었다

// 화면에 보여 줄 오타 유형. 교체는 자판 거리로 둘로 나뉜다.
export const NEIGHBOR = 'neighbor';  // 옆 키 오타
export const DISTANT  = 'distant';   // 원거리 오타
export const MISSING  = 'missing';   // 빠뜨림
export const EXTRA    = 'extra';     // 덧침
export const SWAP     = 'swap';      // 자리바꿈

export const TYPE_LABEL = {
  [NEIGHBOR]: '옆 키 오타',
  [DISTANT]:  '원거리 오타',
  [MISSING]:  '빠뜨림',
  [EXTRA]:    '덧침',
  [SWAP]:     '자리바꿈',
};

// 편집 거리 표를 채운다.
//
// d[i][j] = 제시 앞 i개를 입력 앞 j개로 바꾸는 데 드는 최소 편집 횟수.
// 완전탐색이면 자리마다 '교체/빠뜨림/덧침' 갈래가 생겨 경우의 수가 폭발하지만,
// 표는 칸 하나를 한 번만 채우고 그 값을 계속 다시 쓴다. (40자면 1경 가지 -> 1681칸)
function buildTable(target, typed) {
  const n = target.length, m = typed.length;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  // 한쪽이 비어 있으면 나머지를 전부 지우거나 전부 넣는 수밖에 없다.
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = target[i - 1] === typed[j - 1];
      d[i][j] = Math.min(
        d[i - 1][j - 1] + (same ? 0 : 1),  // 그대로 두거나 교체
        d[i - 1][j] + 1,                   // 제시 자모를 빠뜨림
        d[i][j - 1] + 1,                   // 없는 자모를 더 침
      );
      // 바로 앞 두 자모의 순서가 뒤바뀐 경우는 한 번으로 친다.
      if (i > 1 && j > 1 &&
          target[i - 1] === typed[j - 2] && target[i - 2] === typed[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d;
}

// 표를 거꾸로 되짚어 편집 연산을 복원한다.
//
// 같은 편집 횟수를 주는 길이 여러 개일 때가 있다. 그때 무엇으로 기록할지
// 정해 두지 않으면 오타 통계가 실제와 다르게 쌓인다.
//
// 예: ㅕㄱㅏㅅ 을 ㅛㅏㅅ 으로 쳤다면 두 가지로 설명된다. 둘 다 2번이다.
//   A. ㅕ 를 ㅛ 로 잘못 치고(옆 키) ㄱ 을 빠뜨렸다
//   B. ㅕ 를 빠뜨리고 ㄱ 을 ㅛ 로 잘못 쳤다(먼 키)
// 손가락이 실제로 한 일은 A 쪽이 훨씬 그럴듯하다. 타자에서는 옆 키를 잘못
// 누르는 실수가 압도적으로 흔하고, 멀리 떨어진 키를 누르는 일은 드물기 때문이다.
//
// 그래서 순서를 이렇게 정한다.
//   1. 자리바꿈 — 두 자모를 한 번으로 묶으므로 가장 먼저 본다
//   2. 옆 키 교체 — 가장 흔한 실수라 바로 인정한다
//   3. 빠뜨림 / 덧침
//   4. 먼 키 교체 — 다른 설명이 없을 때만 남는다
function traceBack(d, target, typed) {
  const ops = [];
  let i = target.length, j = typed.length;

  while (i > 0 || j > 0) {
    // 맞게 친 자리는 그냥 지나간다
    if (i > 0 && j > 0 && target[i - 1] === typed[j - 1] && d[i][j] === d[i - 1][j - 1]) {
      i--; j--; continue;
    }
    // 자리바꿈
    if (i > 1 && j > 1 &&
        target[i - 1] === typed[j - 2] && target[i - 2] === typed[j - 1] &&
        d[i][j] === d[i - 2][j - 2] + 1) {
      ops.push({ type: TRANSPOSE, from: target[i - 2], to: target[i - 1],
                 targetIndex: i - 2, typedIndex: j - 2 });
      i -= 2; j -= 2; continue;
    }
    // 교체. 옆 키 실수면 바로 인정하고, 먼 키 실수는 다른 설명이 없을 때만 받는다.
    const canSubstitute = i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1;
    if (canSubstitute) {
      const neighborMiss = isNeighborKey(target[i - 1], typed[j - 1]);
      const otherWayExists = (i > 0 && d[i][j] === d[i - 1][j] + 1)
                          || (j > 0 && d[i][j] === d[i][j - 1] + 1);
      if (neighborMiss || !otherWayExists) {
        ops.push({ type: SUBSTITUTE, from: target[i - 1], to: typed[j - 1],
                   targetIndex: i - 1, typedIndex: j - 1 });
        i--; j--; continue;
      }
    }
    // 빠뜨림 (제시에는 있는데 입력에 없다)
    if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ type: DELETE, from: target[i - 1], to: null,
                 targetIndex: i - 1, typedIndex: j });
      i--; continue;
    }
    // 덧침 (입력에만 있다)
    ops.push({ type: INSERT, from: null, to: typed[j - 1],
               targetIndex: i, typedIndex: j - 1 });
    j--;
  }

  return ops.reverse();   // 되짚어 왔으므로 뒤집어서 친 순서대로 돌려준다
}

// 편집 연산 하나를 화면에 보여 줄 오타 유형으로 바꾼다.
// 교체는 자판에서 두 키가 이웃인지에 따라 둘로 갈린다.
export function classify(op) {
  if (op.type === SUBSTITUTE) return isNeighborKey(op.from, op.to) ? NEIGHBOR : DISTANT;
  if (op.type === DELETE)     return MISSING;
  if (op.type === INSERT)     return EXTRA;
  return SWAP;
}

// 제시 자모열과 입력 자모열을 비교해 편집 거리와 연산 목록을 돌려준다.
export function diffKeys(target, typed) {
  const d = buildTable(target, typed);
  const ops = traceBack(d, target, typed).map(op => ({ ...op, category: classify(op) }));
  return { distance: d[target.length][typed.length], ops };
}

// ── 집계 ─────────────────────────────────────────────────

// 어느 자모를 어느 자모로 잘못 쳤는지 세어 많은 순으로 돌려준다.
// 교체만 센다. 빠뜨림과 덧침은 '쌍' 이 아니라서 순위에 넣으면 뜻이 흐려진다.
export function countErrorPairs(ops) {
  const tally = new Map();
  for (const op of ops) {
    if (op.type !== SUBSTITUTE) continue;
    const key = `${op.from}>${op.to}`;
    const cur = tally.get(key) ?? { from: op.from, to: op.to, count: 0, category: op.category };
    cur.count += 1;
    tally.set(key, cur);
  }
  return [...tally.values()].sort((a, b) => b.count - a.count);
}

// 오타 유형별 개수와 비율.
export function countByType(ops) {
  const counts = { [NEIGHBOR]: 0, [DISTANT]: 0, [MISSING]: 0, [EXTRA]: 0, [SWAP]: 0 };
  for (const op of ops) counts[op.category] += 1;

  const total = ops.length;
  return Object.entries(counts).map(([type, count]) => ({
    type, label: TYPE_LABEL[type], count,
    percent: total === 0 ? 0 : Math.round((count / total) * 100),
  }));
}

// 정확도(%). 제시한 자모 중 제대로 친 비율로 본다.
export function accuracy(targetLength, distance) {
  if (targetLength === 0) return 0;
  const correct = Math.max(0, targetLength - distance);
  return Math.round((correct / targetLength) * 100);
}
