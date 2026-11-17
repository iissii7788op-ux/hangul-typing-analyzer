// 취약 자모를 정하고, 그 자모가 많이 든 맞춤 연습 문장을 만든다.

import { decomposeToKeys, decomposeChar } from './hangul.js';

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

// 단어(또는 문장) 하나에 취약 자모가 몇 번 들어 있는지 센다. 이것이 배낭 문제의 '가치' 다.
export function wordValue(word, weakJamo) {
  const weak = new Set(weakJamo);
  return decomposeToKeys(word).filter(k => weak.has(k)).length;
}

// 글자 수. 공백은 세지 않는다 (단어 목록 시절부터 써 온 기준). 이것이 배낭 문제의 '무게' 다.
export function charCount(text) {
  return [...text.replace(/\s/g, '')].length;
}

// ── 0/1 배낭 ─────────────────────────────────────────────
//
// 정해진 글자 수 안에서 취약 자모가 가장 많이 들어가도록 물건을 고른다.
//   담을 수 있는 무게 = 글자 수 제한
//   물건의 무게       = 물건(단어나 문장)의 글자 수
//   물건의 가치       = 그 물건에 든 취약 자모 개수
//
// 같은 물건을 여러 번 담을 수 있게 하면 한 단어만 반복되는 문장이 나온다.
// 그래서 물건마다 한 번씩만 쓰는 0/1 배낭으로 푼다.
//
// 여기서도 DP 를 쓰는 이유는 편집 거리와 같다. 넣을지 말지 전부 따지면
// 160개 단어에 2^160 가지가 되지만, 표는 (물건 수 × 글자 수) 칸이면 된다.
//
// items 는 { weight, value } 배열. 고른 물건의 번호와 가치 합을 돌려준다.
export function knapsack01(items, capacity) {
  const n = items.length;

  // dp[i][w] = 앞 i개 물건만 쓸 수 있고 글자 수가 w 이하일 때 얻는 최대 가치
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { weight, value } = items[i - 1];
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w];                       // 이 물건을 안 넣는 경우
      if (weight <= w) {                             // 넣을 수 있다면 넣어 보고 더 나은 쪽
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - weight] + value);
      }
    }
  }

  // 표를 거꾸로 되짚어 '실제로 넣은 물건' 을 복원한다. 편집 거리의 역추적과 같은 방식이다.
  const picked = [];
  let w = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {                 // 값이 달라졌다면 이 물건을 넣은 것
      picked.push(i - 1);
      w -= items[i - 1].weight;
    }
  }
  picked.reverse();

  return { picked, value: dp[n][capacity] };
}

// 5차시 방식: 단어를 물건으로 담아 단어를 늘어놓은 문장을 만든다.
export function buildPracticeSentence(words, weakJamo, maxChars = 20) {
  if (weakJamo.length === 0) return { text: '', picked: [] };

  // 취약 자모가 하나도 없는 단어는 고를 이유가 없다
  const items = words
    .map(word => ({ word, weight: charCount(word), value: wordValue(word, weakJamo) }))
    .filter(it => it.value > 0 && it.weight <= maxChars);

  if (items.length === 0) return { text: '', picked: [] };

  const r = knapsack01(items, maxChars);
  const picked = r.picked.map(i => items[i].word);
  return { text: picked.join(' '), picked, value: r.value };
}

// ── 조사 붙이기 ──────────────────────────────────────────
//
// 문장 틀의 빈칸에 단어를 넣으면 조사가 앞 글자의 받침에 따라 바뀐다.
//   을/를, 이/가, 은/는, 과/와 : 받침이 있으면 앞쪽, 없으면 뒤쪽
//   으로/로                    : 받침이 있으면 '으로', 단 ㄹ 받침은 '로' (길로, 연필로)
export function attachJosa(word, josa) {
  if (!josa) return word;
  const last = decomposeChar([...word].at(-1));
  const jong = last.length === 3 ? last[2] : '';

  if (josa === '으로/로') return word + (jong && jong !== 'ㄹ' ? '으로' : '로');
  const [withJong, withoutJong] = josa.split('/');
  return word + (jong ? withJong : withoutJong);
}

// ── 문장 틀 채우기: 그룹 배낭 ─────────────────────────────
//
// 틀의 예: '{사람:과/와} 함께 {장소:에서} {음식:을/를} 먹었다'
//   {범주} 는 빈칸이고, ':' 뒤는 빈칸 단어 뒤에 붙는 말이다.
//   '과/와' 처럼 '/' 가 있으면 받침을 보고 고르는 조사, 없으면('에서') 그대로 붙인다.
export function parseTemplate(template) {
  const parts = [];
  const re = /\{([^}:]+)(?::([^}]*))?\}/g;
  let last = 0, m;
  while ((m = re.exec(template))) {
    if (m.index > last) parts.push({ fixed: template.slice(last, m.index) });
    parts.push({ slot: m[1], suffix: m[2] ?? '' });
    last = re.lastIndex;
  }
  if (last < template.length) parts.push({ fixed: template.slice(last) });
  return parts;
}

function fillSlot(word, suffix) {
  return suffix.includes('/') ? attachJosa(word, suffix) : word + suffix;
}

// 빈칸 하나가 '그룹' 이고, 그룹마다 단어를 꼭 하나씩 골라야 한다.
// 0/1 배낭은 물건마다 '넣는다/안 넣는다' 를 고르지만,
// 그룹 배낭(multiple-choice knapsack)은 그룹마다 '어느 것을 넣는다' 를 고른다.
//   담을 수 있는 무게 = 문장 하나의 글자 수 제한 - 틀에 원래 있는 글자 수
//   물건의 무게       = 조사까지 붙인 빈칸 단어의 글자 수
//   물건의 가치       = 조사까지 붙인 빈칸 단어에 든 취약 자모 개수
// 조사까지 붙여서 재는 이유: '바람' 을 고르면 '바람을' 이 되어 ㅇㅡㄹ 이 따라오기 때문이다.
export function fillTemplate(template, categories, weakJamo, maxChars = 22) {
  const parts = parseTemplate(template);
  const fixedText = parts.filter(p => p.fixed !== undefined).map(p => p.fixed).join('');
  const fixedWeight = charCount(fixedText);
  const fixedValue = wordValue(fixedText, weakJamo);
  const capacity = maxChars - fixedWeight;

  const groups = parts.filter(p => p.slot).map(p =>
    (categories[p.slot] ?? []).map(word => {
      const filled = fillSlot(word, p.suffix);
      return { word, filled, weight: charCount(filled), value: wordValue(filled, weakJamo) };
    })
  );
  if (capacity < 0 || groups.some(g => g.length === 0)) return null;

  // dp[g][w] = 앞 g개 빈칸을 '모두' 채워서 글자 수가 '정확히' w 일 때 얻는 최대 가치.
  // 빈칸을 비워 둘 수는 없으므로 만들 수 없는 칸은 -Infinity 로 둔다.
  // (0/1 배낭은 하나도 안 넣어도 되니 모든 칸이 0 에서 시작했던 것과 다른 점이다.)
  const G = groups.length;
  const dp = Array.from({ length: G + 1 }, () => new Array(capacity + 1).fill(-Infinity));
  const choice = Array.from({ length: G + 1 }, () => new Array(capacity + 1).fill(-1));
  dp[0][0] = 0;

  for (let g = 1; g <= G; g++) {
    for (let w = 0; w <= capacity; w++) {
      groups[g - 1].forEach((opt, k) => {           // 이 빈칸에 넣을 단어를 하나씩 대 본다
        if (opt.weight > w || dp[g - 1][w - opt.weight] === -Infinity) return;
        const v = dp[g - 1][w - opt.weight] + opt.value;
        if (v > dp[g][w]) { dp[g][w] = v; choice[g][w] = k; }
      });
    }
  }

  // 가치가 가장 큰 글자 수를 고른다. 같으면 짧은 쪽(먼저 나온 쪽).
  let bestW = -1;
  for (let w = 0; w <= capacity; w++) {
    if (dp[G][w] !== -Infinity && (bestW < 0 || dp[G][w] > dp[G][bestW])) bestW = w;
  }
  if (bestW < 0) return null;

  // 거꾸로 되짚어 빈칸마다 고른 단어를 복원한다
  const chosen = new Array(G);
  for (let g = G, w = bestW; g > 0; g--) {
    const opt = groups[g - 1][choice[g][w]];
    chosen[g - 1] = opt;
    w -= opt.weight;
  }

  let i = 0;
  const text = parts.map(p => (p.slot ? chosen[i++].filled : p.fixed)).join('');
  return {
    text,
    words: chosen.map(c => c.word),
    weight: fixedWeight + bestW,
    value: fixedValue + dp[G][bestW],
  };
}

// ── 맞춤 연습 문장 묶음: 문장 배낭 + 틀 문장 ──────────────────
//
// 1) 틀마다 그룹 배낭으로 가장 좋은 문장을 하나씩 만든다.
// 2) 미리 써 둔 자연스러운 문장들과 함께, 0/1 배낭으로 글자 수 제한 안에서
//    취약 자모가 가장 많이 들어가는 문장 묶음을 고른다.
//      물건의 무게 = 문장의 글자 수
//      물건의 가치 = 문장에 든 취약 자모 개수
//
// 틀 문장은 묶음에 두 개까지, 그것도 같은 단어를 쓰지 않는 것끼리만 넣는다.
// 틀마다 따로 채우면 '짬뽕' 처럼 취약 자모가 많은 단어를 여러 틀이 똑같이 골라
// 같은 단어가 문장마다 나오고, 틀 문장만 잔뜩 담기면 문장이 다 비슷해지기 때문이다.
// 그래서 넣을 틀 문장 조합(없음, 하나, 둘)마다 남은 자리를 0/1 배낭으로 풀어 보고 가장 좋은 것을 쓴다.
// 틀이 14개면 조합은 100개 남짓이고, 배낭 한 번은 (문장 수 × 글자 수) 칸이라 금방 끝난다.
export const MAX_TEMPLATE_SENTENCES = 2;

function templateCombos(filled) {
  const combos = [[]];
  filled.forEach((a, i) => {
    combos.push([a]);
    if (MAX_TEMPLATE_SENTENCES < 2) return;
    for (let j = i + 1; j < filled.length; j++) {
      const b = filled[j];
      if (!a.words.some(w => b.words.includes(w))) combos.push([a, b]);
    }
  });
  return combos;
}

export function buildPracticeSet(sentences, templates, categories, weakJamo,
                                 { maxChars = 50, templateChars = 22 } = {}) {
  if (weakJamo.length === 0) return { sentences: [], value: 0 };

  const corpus = sentences
    .map(text => ({ text, weight: charCount(text), value: wordValue(text, weakJamo) }))
    .filter(it => it.value > 0 && it.weight <= maxChars);

  const filled = templates
    .map(t => fillTemplate(t, categories, weakJamo, templateChars))
    .filter(f => f && f.value > 0 && f.weight <= maxChars);

  let best = { value: 0, sentences: [] };
  for (const combo of templateCombos(filled)) {
    const room = maxChars - combo.reduce((s, f) => s + f.weight, 0);
    if (room < 0) continue;
    const r = knapsack01(corpus, room);
    const value = r.value + combo.reduce((s, f) => s + f.value, 0);
    if (value > best.value) {
      best = {
        value,
        sentences: [...r.picked.map(i => corpus[i].text), ...combo.map(f => f.text)],
      };
    }
  }
  return best;
}
