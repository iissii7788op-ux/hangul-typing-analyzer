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

// ── 누적 기록으로 취약 자모 고르기 (맞춤 훈련 모드) ────────────
//
// 한 라운드가 아니라 지금까지 쌓인 기록 전체로 고른다. 한 판의 오타는 우연일 수 있지만
// 여러 판에 걸쳐 반복되는 오타는 손에 밴 습관이기 때문이다.
// 점수 매기는 법은 한 라운드 때와 같다 (pickWeakJamo).
//   errors    : 데이터베이스의 오류 쌍 [{ from, count }]  (from = 쳤어야 할 자모, 덧침은 누른 키)
//   jamoTimes : 자모별 평균 입력 시간 [{ key, avg }]
export function cumulativeWeakJamo(errors, jamoTimes, count = 3) {
  const tally = new Map();
  for (const { from, count: n } of errors) {
    if (!from) continue;
    tally.set(from, (tally.get(from) ?? 0) + n);
  }
  return pickWeakJamo(tally, jamoTimes, count);
}

// 맞춤 훈련은 진단 기록이 이만큼 쌓여야 열린다.
// 한두 판으로는 취약 자모가 그 판의 문장에 좌우되어 믿기 어렵다.
export const CUSTOM_UNLOCK_SESSIONS = 3;

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

// exclude 에 든 문장은 후보에서 뺀다. 맞춤 훈련을 연달아 할 때 지난 라운드와
// 똑같은 문장이 나오지 않게 하려는 것이다 (배낭은 같은 입력이면 늘 같은 답을 낸다).
export function buildPracticeSet(sentences, templates, categories, weakJamo,
                                 { maxChars = 50, templateChars = 22, exclude = [] } = {}) {
  if (weakJamo.length === 0) return { sentences: [], value: 0 };
  const skip = new Set(exclude);

  const corpus = sentences
    .filter(text => !skip.has(text))
    .map(text => ({ text, weight: charCount(text), value: wordValue(text, weakJamo) }))
    .filter(it => it.value > 0 && it.weight <= maxChars);

  const filled = templates
    .map(t => fillTemplate(t, categories, weakJamo, templateChars))
    .filter(f => f && !skip.has(f.text) && f.value > 0 && f.weight <= maxChars);

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

// ── 맞춤 라운드를 연달아 열 때 문장이 되풀이되지 않게 ──────────
//
// 배낭은 입력이 같으면 늘 같은 답을 낸다. 취약 자모가 그대로이면 맞춤 훈련을 열 때마다
// 똑같은 문장이 나오므로, 이미 나온 문장을 후보에서 빼고 고른다.
//
// 처음에는 '바로 앞 라운드' 만 뺐는데 그러면 두 세트가 번갈아 나왔다.
//   1라운드 -> S1,  2라운드(S1 뺌) -> S2,  3라운드(S2 뺌) -> S1 이 다시 가장 좋은 답
// 같은 취약 자모로 8라운드를 만들어 보니 서로 다른 세트가 2개뿐이었다.
//
// 그렇다고 지금까지 나온 문장을 전부 빼면 점점 덜 좋은 문장만 남는다. 12라운드를 돌려
// 보니 취약 자모가 든 비율이 21% 에서 11% 로 반 토막이 났다. 그래서 '최근 몇 라운드'
// 만 뺀다. 3라운드면 한 문장이 18문장쯤 쉬었다가 돌아오고(세트 4개가 돈다),
// 비율은 21% 에서 17% 로 조금만 떨어진다.
export const RECENT_ROUNDS = 3;

// recentRounds 는 최근 라운드들의 문장 목록([[문장, ...], ...]) 이다.
// 다음 라운드와, 갱신된 recentRounds 를 돌려준다. 호출하는 쪽이 이 값을 들고 있다가
// 다음에 다시 넘긴다. 상태를 안에 숨기지 않아야 같은 입력에 같은 답이 나와 테스트할 수 있다.
export function nextCustomSet(sentences, templates, categories, weakJamo, recentRounds, opts = {}) {
  // 취약 자모가 없으면 고를 문장이 없는 것이지 후보가 바닥난 것이 아니다.
  // 둘을 헷갈려 기억을 비우면 안 되므로 먼저 걸러 낸다.
  if (weakJamo.length === 0) return { set: { sentences: [], value: 0 }, recentRounds };

  let recent = recentRounds;
  let set = buildPracticeSet(sentences, templates, categories, weakJamo,
                             { ...opts, exclude: recent.flat() });

  // 뺐더니 후보가 바닥나면 빼지 않고 다시 고르고, 기억도 새로 시작한다.
  // (기억을 그대로 두면 다음 라운드도 같은 이유로 바닥난다.)
  if (set.sentences.length === 0 && recent.length > 0) {
    recent = [];
    set = buildPracticeSet(sentences, templates, categories, weakJamo, opts);
  }

  // 그래도 문장이 없으면(취약 자모가 든 문장이 아예 없을 때) 열리지 않은 라운드이므로 기억하지 않는다.
  if (set.sentences.length === 0) return { set, recentRounds: recent };

  return { set, recentRounds: [...recent, set.sentences].slice(-RECENT_ROUNDS) };
}

// ── 새로고침해도 최근 라운드를 DB 기록에서 되살린다 ────────────
//
// '최근에 어떤 문장을 썼는가' 를 변수에만 두면 페이지를 새로 열 때마다 사라져서,
// 맞춤 훈련을 열면 늘 첫 세트부터 시작한다. 로그인은 '내가 누구인가' 만 지켜 줄 뿐
// 이 목록과는 무관하다.
//
// 그런데 DB 에는 이미 라운드마다 문장이 저장된다(practice_sessions.sentences).
// 새로 저장할 것 없이 그 기록에서 되살리면 다른 기기에서 열어도 이어진다.
//
// sessions 는 DB 에서 읽은 기록으로 최신이 앞에 온다. 각 줄의 sentences 는
// [{ target, typed }] 꼴이다. basicSentences 는 기본 진단의 고정 문장이다.
// 기본 진단 라운드는 건너뛴다. 건너뛰지 않으면 진단을 몇 판 하는 사이 맞춤 라운드를 잊는다.
//
// 돌려주는 값은 nextCustomSet 이 기대하는 모양(오래된 것이 앞)이다.
// 저장된 모양이 깨져 있어도 앱이 죽지 않아야 하므로 믿지 않고 하나씩 거른다.
export function recentRoundsFromSessions(sessions, basicSentences, rounds = RECENT_ROUNDS) {
  const basic = new Set(basicSentences);
  const found = [];

  for (const row of sessions ?? []) {
    const list = Array.isArray(row?.sentences) ? row.sentences : [];
    const targets = list.map(item => item?.target).filter(t => typeof t === 'string' && t !== '');
    if (targets.length === 0) continue;               // 문장 기록이 없는 연습
    if (targets.every(t => basic.has(t))) continue;   // 기본 진단 라운드

    found.push(targets);
    if (found.length === rounds) break;
  }

  return found.reverse();   // 최신이 앞이었으니 뒤집어 오래된 것이 앞에 오게 한다
}
