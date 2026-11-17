// Supabase 연결과 기록 저장/조회.
//
// 공개 키(anon key)는 브라우저에 그대로 실려 나가므로 숨길 수 있는 값이 아니다.
// 그래서 키를 감추는 대신, 테이블마다 RLS 를 켜서 '키가 있어도 자기 줄만'
// 읽고 쓰게 막아 두었다. (supabase/schema.sql 참고)

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { createEnsureSignedIn } from './auth.js';

const SUPABASE_URL = 'https://jyvuyoidwquzflpbdptn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5dnV5b2lkd3F1emZscGJkcHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDEyNTcsImV4cCI6MjEwODYxNzI1N30.1ZSIdLiDIKUpSGAqYCw8f4ZO_xFRyDnd_lYDFr3DjVA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── 로그인 ───────────────────────────────────────────────
//
// 회원가입을 시키지 않고 익명 로그인을 쓴다.
// 그래도 사용자마다 고유한 id 가 생기므로 '내 기록' 을 가릴 수 있고,
// 그 id 로 RLS 가 남의 줄을 막아 준다.
// 로그인 상태는 브라우저에 남아서, 다시 들어와도 같은 사람으로 이어진다.
//
// 로그인은 한 번만 돌게 한다(auth.js). 처음 들어온 사람의 저장이 겹치면
// 익명 사용자가 둘 생겨 저장이 RLS 에 막히던 문제가 있었다.
export const ensureSignedIn = createEnsureSignedIn(supabase.auth);

// ── 저장 ─────────────────────────────────────────────────
//
// 한 라운드가 끝나면 요약 한 줄과, 거기서 나온 오류 쌍 / 자모별 입력 시간을 함께 담는다.
// 요약을 먼저 넣고 그 id 를 받아 나머지 두 표에 붙인다.
//
// user_id 는 브라우저가 적지 않는다. 표를 만들 때 기본값을 auth.uid()(요청을 보낸
// 로그인의 주인)로 정해 두었으므로 데이터베이스가 채운다. 브라우저가 따로 적으면
// 그 사이 로그인 상태가 바뀌었을 때 '줄의 주인' 과 '요청한 사람' 이 어긋날 수 있다.
// 데이터베이스가 채우면 둘은 언제나 같다.
export async function saveSession({
  accuracy, cpm, errorCount, elapsedMs, sentences, suggested, errorPairs, jamoTimes,
}) {
  await ensureSignedIn();   // 로그인 상태가 있어야 요청에 주인이 실린다

  const { data: row, error } = await supabase
    .from('practice_sessions')
    .insert({
      accuracy, cpm,
      error_count: errorCount,
      elapsed_ms: Math.round(elapsedMs),
      sentences,
      suggested_sentence: suggested || null,
    })
    .select('id')
    .single();
  if (error) throw error;

  // 오류 쌍과 입력 시간은 여러 줄이라 한 번에 몰아서 넣는다.
  if (errorPairs.length > 0) {
    const { error: e } = await supabase.from('session_errors').insert(
      errorPairs.map(p => ({
        session_id: row.id,
        from_jamo: p.from, to_jamo: p.to, category: p.category, count: p.count,
      })));
    if (e) throw e;
  }

  if (jamoTimes.length > 0) {
    const { error: e } = await supabase.from('session_jamo_times').insert(
      jamoTimes.map(t => ({
        session_id: row.id,
        jamo: t.key, avg_ms: Math.round(t.avg), count: t.count,
      })));
    if (e) throw e;
  }

  return row.id;
}

// ── 조회 ─────────────────────────────────────────────────

// 최근 연습 기록. 회차별 정확도 그래프와 연습 목록에 쓴다.
export async function loadSessions(limit = 20) {
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('id, created_at, accuracy, cpm, error_count, elapsed_ms, suggested_sentence')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// 최근 연습 기록의 문장. 맞춤 훈련을 열 때 '최근에 쓴 문장' 을 되살리는 데 쓴다.
//
// 기본 진단 사이에 맞춤 라운드가 끼어 있을 수 있어서 맞춤 라운드 3개를 찾으려면
// 몇 개 더 훑어야 한다. 문장 칸만 가져와서 가볍다. RLS 가 내 줄만 돌려준다.
export async function loadRecentSessionSentences(limit = 15) {
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('sentences')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// 누적 취약 자모. 여러 회차에 흩어진 오류 쌍을 자모 쌍별로 합친다.
//
// 데이터베이스에 합계를 따로 저장해 두는 방법도 있지만, 그러면 저장할 때와
// 합계를 고칠 때가 어긋나면 숫자가 틀어진다. 기록이 몇 백 줄 수준이라
// 불러와서 더하는 편이 단순하고 틀릴 일이 없다.
export async function loadCumulativeErrors() {
  // 상한을 두지 않으면 기록이 쌓일수록 느려진다.
  // 최근 것부터 가져오며, 취약 자모를 가리는 데는 이 정도면 넉넉하다.
  const { data, error } = await supabase
    .from('session_errors')
    .select('from_jamo, to_jamo, category, count')
    .order('id', { ascending: false })
    .limit(2000);
  if (error) throw error;

  const tally = new Map();
  for (const row of data) {
    const key = `${row.from_jamo}>${row.to_jamo ?? ''}`;
    const cur = tally.get(key)
      ?? { from: row.from_jamo, to: row.to_jamo, category: row.category, count: 0 };
    cur.count += row.count;
    tally.set(key, cur);
  }
  return [...tally.values()].sort((a, b) => b.count - a.count);
}

// 지금까지 저장된 연습 횟수. 맞춤 훈련 모드를 열지 정할 때 쓴다.
// 줄을 내려받지 않고 개수만 센다 (head: true).
export async function countSessions() {
  await ensureSignedIn();
  const { error, count } = await supabase
    .from('practice_sessions')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

// 누적 자모별 평균 입력 시간. 회차마다 평균이 따로 저장되어 있으므로
// 친 횟수(count)로 가중해서 다시 평균을 낸다. 회차 평균을 그냥 평균하면
// 두 번 친 회차와 스무 번 친 회차가 같은 무게를 갖게 된다.
export async function loadCumulativeJamoTimes() {
  const { data, error } = await supabase
    .from('session_jamo_times')
    .select('jamo, avg_ms, count')
    .order('id', { ascending: false })
    .limit(2000);
  if (error) throw error;

  const sum = new Map();
  for (const row of data) {
    const cur = sum.get(row.jamo) ?? { ms: 0, n: 0 };
    cur.ms += row.avg_ms * row.count;
    cur.n  += row.count;
    sum.set(row.jamo, cur);
  }
  return [...sum.entries()]
    .map(([key, { ms, n }]) => ({ key, avg: n ? ms / n : 0, count: n }))
    .sort((a, b) => b.avg - a.avg);
}

// 연결이 살아 있는지 확인한다. 6차시 목표가 바로 이것이다.
export async function checkConnection() {
  const user = await ensureSignedIn();
  const { error, count } = await supabase
    .from('practice_sessions')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return { userId: user.id, sessionCount: count ?? 0 };
}
