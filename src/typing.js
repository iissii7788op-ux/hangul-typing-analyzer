// 타이핑 판정과 시각 기록.
//
// 화면(DOM)을 건드리지 않고 값만 다룬다. 그래야 한글 조합 중 상태처럼
// 손으로 쳐서는 확인하기 어려운 경우를 테스트로 검증할 수 있다.

import { decomposeToKeys, isJamo } from './hangul.js';

// ── 글자별 맞음/틀림 판정 ────────────────────────────────
//
// 한글은 글자가 완성되기 전 중간 상태를 지나간다. '안' 을 치면
// 화면에 ㅇ -> 아 -> 안 순서로 나타난다.
// 중간 상태를 곧바로 틀렸다고 하면 정확히 치는 중에도 빨갛게 깜빡인다.
// 그래서 마지막 글자만은 '제시 글자로 가는 길 위에 있는지' 를 따로 본다.

export const OK = 'correct';    // 제시 글자와 같다
export const TYPING = 'typing'; // 아직 완성 전이지만 제시 글자로 가는 길 위에 있다
export const BAD = 'wrong';     // 그 길에서 벗어났다
export const NONE = 'pending';  // 아직 치지 않았다

// a 가 b 의 앞부분인지 본다. ['ㅇ','ㅏ'] 는 ['ㅇ','ㅏ','ㄴ'] 의 앞부분이다.
function isPrefix(a, b) {
  if (a.length > b.length) return false;
  return a.every((x, i) => x === b[i]);
}

// 제시 문장과 지금까지 친 문장을 글자 단위로 맞춰 본다.
// 반환: { states, extra }
//   states 제시 글자마다 하나씩, 위 네 가지 중 하나
//   extra  제시 문장보다 더 친 글자 수
export function judge(target, typed) {
  const targetChars = [...target];
  const typedChars  = [...typed];
  const lastIndex   = typedChars.length - 1;   // 조합 중일 수 있는 자리

  const states = targetChars.map((targetCh, i) => {
    if (i >= typedChars.length) return NONE;

    const typedCh = typedChars[i];
    if (typedCh === targetCh) return OK;

    // 마지막으로 친 글자는 아직 만드는 중일 수 있다.
    // 키 단위로 쪼개서 제시 글자의 앞부분인지 본다.
    if (i === lastIndex && isPrefix(decomposeToKeys(typedCh), decomposeToKeys(targetCh))) {
      return TYPING;
    }
    return BAD;
  });

  return { states, extra: Math.max(0, typedChars.length - targetChars.length) };
}

// ── 키 입력 시각 기록 ────────────────────────────────────
//
// 한글은 IME(입력기)를 거치기 때문에 keydown 이벤트의 key 값이 실제 자모로
// 오지 않는다. 그래서 '화면에 실제로 나타난 자모' 를 기준으로 삼는다.
// 입력이 바뀔 때마다 키 배열로 쪼개서, 늘어난 만큼 지금 시각을 붙인다.
//
// times 는 keys 와 같은 길이가 되며, times[i] 는 i 번째 키가 나타난 시각이다.
//
// now 로는 벽시계 시각이 아니라 '연습이 실제로 흐른 시간' 을 넘긴다.
// 연습 중에 기록 화면을 보고 오면 그동안은 연습 시간이 아닌데, 벽시계를 쓰면
// 자리 비운 30초가 다음 자모의 입력 시간으로 잡힌다. 경과 시간을 쓰면 멈춘
// 구간이 애초에 더해지지 않으므로 따로 보정할 일이 없다.
export function recordKeyTimes(text, times, now) {
  const keys = decomposeToKeys(text);

  // 지웠으면(백스페이스) 기록도 같이 잘라낸다.
  if (times.length > keys.length) times.length = keys.length;
  // 늘어난 자리에는 지금 시각을 넣는다. 한 번에 여러 개가 늘 수도 있다(붙여넣기).
  while (times.length < keys.length) times.push(now);

  return keys;
}

// 키마다 걸린 시간을 구한다. i 번째 키의 시간은 앞 키와의 시각 차이다.
// 첫 키는 앞이 없으므로 뺀다.
export function keyDurations(keys, times) {
  const out = [];
  for (let i = 1; i < keys.length && i < times.length; i++) {
    out.push({ key: keys[i], ms: times[i] - times[i - 1] });
  }
  return out;
}

// 같은 자모끼리 모아 평균을 낸다. 느린 순으로 정렬해서 돌려준다.
// 틀리지는 않았지만 유독 오래 걸리는 자모를 찾는 것이 목적이다.
//
// 공백과 문장부호는 뺀다. 스페이스바도 분명 키 입력이지만 자모가 아니라서,
// 섞어 두면 '입력이 느린 자모' 순위에 공백이 1등으로 올라온다.
export function averageByJamo(durations) {
  const sum = new Map();
  for (const { key, ms } of durations) {
    if (!isJamo(key)) continue;
    const cur = sum.get(key) ?? { key, total: 0, count: 0 };
    cur.total += ms;
    cur.count += 1;
    sum.set(key, cur);
  }

  return [...sum.values()]
    .map(({ key, total, count }) => ({ key, count, avg: total / count }))
    .sort((a, b) => b.avg - a.avg);
}
