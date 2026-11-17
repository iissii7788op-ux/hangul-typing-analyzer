// 제시한 자모열과 실제로 친 자모열을 맞춰 보고, 어디서 어떻게 틀렸는지 뽑아낸다.
//
// 편집 거리는 '최소 몇 번 고치면 같아지는가' 라는 숫자만 알려 준다.
// 우리에게 필요한 건 숫자가 아니라 '어느 자모를 어느 자모로 잘못 쳤는가' 다.
// 그래서 표를 채운 뒤 거꾸로 되짚어(역추적) 연산 하나하나를 복원한다.

import { isNeighborKey } from './keyboard.js';
import { isJamo } from './hangul.js';

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

// ── 끝이 열린 정렬 ───────────────────────────────────────
//
// 치는 도중의 입력은 제시 문장의 '앞부분' 하고만 견줘야 한다. 그런데 어디까지가
// 앞부분인지를 미리 정해 두면 틀린다. 두 번 그렇게 틀렸다.
//   문장 전체와 견줌    -> 안 친 뒷부분까지 맞추려다 짝이 흔들려
//                          '로 -> 루' 하나가 ㅓ>ㅜ, ㅡ>ㅜ, ㅗ>ㅜ 로 세 번 적혔다
//   입력 길이만큼 자름  -> 하나를 빠뜨리면 그 뒤로 짝이 한 칸씩 밀려
//                          '가ㅏㅇ 운동장' 의 뒤 글자가 전부 덧침이 되었다
//
// 그래서 끝을 정하지 않고, 입력과 가장 잘 맞는 지점까지를 스스로 고른다.
// d[i][m] 은 '제시 앞 i개를 입력 전체로 바꾸는 최소 횟수' 이므로, 표를 문장 전체로
// 한 번 채운 뒤 마지막 열에서 가장 작은 칸을 고르면 된다. 계산량은 diffKeys 와 같다.
//
// 반환하는 reached 는 '제시 문장의 몇 번째 키까지 쳤다고 보는가' 다.
export function openDiff(target, typed) {
  const d = buildTable(target, typed);
  const m = typed.length;

  let reached = 0;
  for (let i = 1; i <= target.length; i++) {
    // 동점이면 더 많이 진행한 쪽을 고른다. 그러면 '잘못 쳤다' 나 '빠뜨렸다' 로 읽히고,
    // 반대로 고르면 '더 쳤다' 로 읽힌다. 값씨 의 ㅣ 가 ㅏ>ㅣ 가 아니라 덧침(ㅣ) 로 잡히는
    // 식이다. 4차시에 정한 '교체를 먼저 인정한다' 와 같은 방향이다.
    if (d[i][m] <= d[reached][m]) reached = i;
  }

  // traceBack 은 (제시 길이, 입력 길이) 칸에서 되짚기 시작한다.
  // 제시를 reached 까지만 넘기면 그 칸에서 시작한다. 표의 i 번째 줄은 제시의 앞 i개만
  // 보고 채워지므로 문장 전체로 채운 표를 그대로 써도 된다.
  const ops = traceBack(d, target.slice(0, reached), typed)
    .map(op => ({ ...op, category: classify(op) }));
  return { distance: d[reached][m], ops, reached };
}

// ── 치는 동안의 오타 추적 ─────────────────────────────────
//
// 오타를 내면 보통 지우고 다시 친다. 최종 입력만 보면 흔적이 없으므로
// 치는 동안 무언가를 적어 두어야 한다. 세 번째로 고친 방식이다.
//
//   1) 입력이 줄어드는 순간에 건짐  -> 덮어쓰기처럼 길이가 안 줄면서 고치는 길을 놓침
//   2) 칠 때마다 판정해 적어 둠    -> 치는 도중의 판정은 뒤에 올 키를 봐야 확정되는데,
//                                    잠정적인 판정까지 영영 남겨 버림
//   3) 지워지는 순간에만 판정      <- 지금 방식
//
// 키가 입력창에 남아 있는 동안은 판정하지 않는다. 남아 있는 키는 문장을 마칠 때
// 최종 입력으로 한 번에 견주면 되기 때문이다. 판정이 필요한 것은 '사라지는 키' 뿐이다.
// 사라지면 마지막에 볼 수 없으니, 사라지기 직전 입력으로 그 순간 판정해 둔다.
//
// 사라진 키는 '길이가 줄었는가' 가 아니라 '앞에서부터 같은 부분이 어디까지인가' 로
// 알아챈다. 값씨 -> 값싸 처럼 길이가 그대로여도 ㅣ 가 사라진 것을 잡는다.
//
// 기록의 열쇠는 '제시 문장의 몇 번째 자리에서 무엇을 무엇으로' 다.
// 같은 자리의 같은 실수는 한 번으로 센다. 지운 때 적은 것과 마지막에 견준 것이
// 겹쳐도 한 번이 된다.
function commonPrefixLength(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

export function createErrorTracker(targetKeys) {
  const seen = new Map();
  let prev = [];

  const remember = (op) => {
    const key = `${op.targetIndex}:${op.from ?? ''}>${op.to ?? ''}`;
    if (!seen.has(key)) seen.set(key, op);
  };

  return {
    // 입력이 바뀔 때마다 부른다. judge 가 false 면 직전 입력만 갈아 두고 판정은 건너뛴다.
    update(typedKeys, { judge = true } = {}) {
      const kept = commonPrefixLength(prev, typedKeys);   // 이만큼은 그대로 남았다
      if (judge && prev.length > kept) {                  // 그 뒤가 사라졌다
        for (const op of openDiff(targetKeys, prev).ops) {
          if (op.typedIndex >= kept) remember(op);        // 사라진 자리의 오타만
        }
      }
      prev = typedKeys;
    },

    // 문장을 마칠 때 부른다. 남아 있는 키는 여기서 한 번에 판정한다.
    //
    // 엔터로 마쳤으면 다 쳤다는 뜻이므로 문장 끝까지 견주고, 덜 친 끝은 빠뜨림이다.
    // '그만하고 결과 보기' 로 끊었으면(partial) 친 데까지만 견준다. 이때도 입력 길이로
    // 자르면 같은 밀림이 생기므로 끝이 열린 정렬을 쓴다.
    // targetLength 는 정확도의 분모로 쓸 '제시에서 친 데까지의 키 수' 다.
    finish(typedKeys, { partial = false } = {}) {
      const result = partial ? openDiff(targetKeys, typedKeys) : diffKeys(targetKeys, typedKeys);
      for (const op of result.ops) remember(op);
      return {
        ops: [...seen.values()],
        targetLength: partial ? result.reached : targetKeys.length,
      };
    },
  };
}

// ── 집계 ─────────────────────────────────────────────────

// 한/영 전환을 안 하고 친 것인지 가려낸다.
//
// '교실' 을 영문 상태로 치면 ryslf 가 들어와 'ㄱ 을 r 로 쳤다' 로 잡힌다.
// 하지만 손가락은 ㄱ 자리(R키)를 정확히 눌렀다. 자판 실수가 아니라 입력 상태 문제다.
// 이것을 자모 통계에 섞으면 'ㄱ 이 약하다' 는 엉뚱한 결론이 나고,
// 그 자모로 맞춤 연습 문장까지 만들어 버린다.
//
// 틀린 것은 맞으므로 오타 개수와 정확도에는 그대로 둔다.
// 다만 '어느 자모가 약한가' 를 따지는 집계에서만 뺀다.
export function isJamoError(op) {
  if (op.type === SUBSTITUTE) return isJamo(op.from) && isJamo(op.to);
  if (op.type === INSERT)     return isJamo(op.to);
  return isJamo(op.from);     // 빠뜨림과 자리바꿈은 제시 쪽 자모로 본다
}

// 어느 자모를 어느 자모로 잘못 쳤는지 세어 많은 순으로 돌려준다.
// 교체만 센다. 빠뜨림과 덧침은 '쌍' 이 아니라서 순위에 넣으면 뜻이 흐려진다.
export function countErrorPairs(ops) {
  const tally = new Map();
  for (const op of ops) {
    if (op.type !== SUBSTITUTE || !isJamoError(op)) continue;
    const key = `${op.from}>${op.to}`;
    const cur = tally.get(key) ?? { from: op.from, to: op.to, count: 0, category: op.category };
    cur.count += 1;
    tally.set(key, cur);
  }
  return [...tally.values()].sort((a, b) => b.count - a.count);
}

// 키마다 몇 번 틀렸는지 센다. 자판 히트맵에서 키를 얼마나 진하게 칠할지 정하는 값이다.
//
// 기준은 '쳤어야 할 자모'(from) 다. 'ㅕ 를 칠 자리에서 자꾸 실수한다' 가
// 연습에 쓸모 있는 정보이기 때문이다.
// 덧침은 쳐야 할 자모가 없으므로 실제로 누른 키(to)로 센다.
export function countByKey(ops) {
  const tally = new Map();
  for (const op of ops) {
    if (!isJamoError(op)) continue;   // 한/영 전환 실수는 자판 탓이 아니다
    const key = op.from ?? op.to;
    if (!key) continue;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return tally;
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

// 정확도(%).
//
// 분모를 제시 길이로만 잡으면, 제시보다 길게 쳤을 때 숫자가 무너진다.
// 제시를 정확히 치고 뒤에 더 붙였더니 덧침이 제시 길이를 넘어서 정확도가
// 7% 로 나온 적이 있다. 덧침은 제시에 없는 자리라 분모에 들어가지 않기 때문이다.
// 그래서 제시와 입력 중 긴 쪽을 분모로 삼는다.
export function accuracy(targetLength, typedLength, errorCount) {
  const total = Math.max(targetLength, typedLength);
  if (total === 0) return 0;
  return Math.round((Math.max(0, total - errorCount) / total) * 100);
}
