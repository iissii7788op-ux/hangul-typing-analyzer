// 취약 자모를 정하고, 그 자모가 많이 든 단어들로 맞춤 연습 문장을 만든다.

import { decomposeToKeys } from './hangul.js';

// ── 취약 자모 고르기 ─────────────────────────────────────
//
// 오타가 난 자모와 '틀리지는 않았지만 유독 오래 걸린' 자모를 함께 본다.
// 손이 익지 않은 자리는 둘 중 하나로 드러나기 때문이다.
// 오류가 더 뚜렷한 신호이므로 가중치를 크게 준다.
export function pickWeakJamo(errorTally, slowRanked, count = 3) {
  const score = new Map();

  for (const [jamo, n] of errorTally) {
    score.set(jamo, (score.get(jamo) ?? 0) + n * 10);
  }
  // 입력 시간은 50ms 당 1점. 오타 한 번(10점)이 느림 500ms 와 맞먹는 셈이다.
  for (const { key, avg } of slowRanked) {
    score.set(key, (score.get(key) ?? 0) + Math.round(avg / 50));
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([jamo]) => jamo);
}

// 단어 하나에 취약 자모가 몇 번 들어 있는지 센다. 이것이 배낭 문제의 '가치' 다.
export function wordValue(word, weakJamo) {
  const weak = new Set(weakJamo);
  return decomposeToKeys(word).filter(k => weak.has(k)).length;
}

// ── 배낭 알고리즘 ────────────────────────────────────────
//
// 정해진 글자 수 안에서 취약 자모가 가장 많이 들어가도록 단어를 고른다.
//   담을 수 있는 무게 = 글자 수 제한
//   물건의 무게       = 단어의 글자 수
//   물건의 가치       = 그 단어에 든 취약 자모 개수
//
// 같은 단어를 여러 번 담을 수 있게 하면 한 단어만 반복되는 문장이 나온다.
// 그래서 단어마다 한 번씩만 쓰는 0/1 배낭으로 푼다.
//
// 여기서도 DP 를 쓰는 이유는 편집 거리와 같다. 단어를 넣을지 말지 전부 따지면
// 160개 단어에 2^160 가지가 되지만, 표는 (단어 수 × 글자 수) 칸이면 된다.
export function buildPracticeSentence(words, weakJamo, maxChars = 20) {
  if (weakJamo.length === 0) return { text: '', picked: [] };

  // 취약 자모가 하나도 없는 단어는 고를 이유가 없다
  const items = words
    .map(word => ({ word, weight: [...word].length, value: wordValue(word, weakJamo) }))
    .filter(it => it.value > 0 && it.weight <= maxChars);

  if (items.length === 0) return { text: '', picked: [] };

  const n = items.length;
  // dp[i][w] = 앞 i개 단어만 쓸 수 있고 글자 수가 w 이하일 때 얻는 최대 가치
  const dp = Array.from({ length: n + 1 }, () => new Array(maxChars + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { weight, value } = items[i - 1];
    for (let w = 0; w <= maxChars; w++) {
      dp[i][w] = dp[i - 1][w];                       // 이 단어를 안 넣는 경우
      if (weight <= w) {                             // 넣을 수 있다면 넣어 보고 더 나은 쪽
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - weight] + value);
      }
    }
  }

  // 표를 거꾸로 되짚어 '실제로 넣은 단어' 를 복원한다. 편집 거리의 역추적과 같은 방식이다.
  const picked = [];
  let w = maxChars;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {                 // 값이 달라졌다면 이 단어를 넣은 것
      picked.push(items[i - 1].word);
      w -= items[i - 1].weight;
    }
  }
  picked.reverse();

  return { text: picked.join(' '), picked, value: dp[n][maxChars] };
}
