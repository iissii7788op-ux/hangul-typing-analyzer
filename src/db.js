// Supabase 연결과 기록 저장/조회.
//
// 공개 키(anon key)는 브라우저에 그대로 실려 나가므로 숨길 수 있는 값이 아니다.
// 그래서 키를 감추는 대신, 테이블마다 RLS 를 켜서 '키가 있어도 자기 줄만'
// 읽고 쓰게 막아 두었다. (supabase/schema.sql 참고)

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://jyvuyoidwquzflpbdptn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5dnV5b2lkd3F1emZscGJkcHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDEyNTcsImV4cCI6MjEwODYxNzI1N30.1ZSIdLiDIKUpSGAqYCw8f4ZO_xFRyDnd_lYDFr3DjVA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── 로그인 ───────────────────────────────────────────────
//
// 회원가입을 시키지 않고 익명 로그인을 쓴다.
// 그래도 사용자마다 고유한 id 가 생기므로 '내 기록' 을 가릴 수 있고,
// 그 id 로 RLS 가 남의 줄을 막아 준다.
// 로그인 상태는 브라우저에 남아서, 다시 들어와도 같은 사람으로 이어진다.
export async function ensureSignedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

// ── 저장 ─────────────────────────────────────────────────
//
// 한 라운드가 끝나면 요약 한 줄과, 거기서 나온 오류 쌍 / 자모별 입력 시간을 함께 담는다.
// 요약을 먼저 넣고 그 id 를 받아 나머지 두 표에 붙인다.
export async function saveSession({
  accuracy, cpm, errorCount, elapsedMs, sentences, suggested, errorPairs, jamoTimes,
}) {
  const user = await ensureSignedIn();

  const { data: row, error } = await supabase
    .from('practice_sessions')
    .insert({
      user_id: user.id,
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
        session_id: row.id, user_id: user.id,
        from_jamo: p.from, to_jamo: p.to, category: p.category, count: p.count,
      })));
    if (e) throw e;
  }

  if (jamoTimes.length > 0) {
    const { error: e } = await supabase.from('session_jamo_times').insert(
      jamoTimes.map(t => ({
        session_id: row.id, user_id: user.id,
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

// 누적 취약 자모. 여러 회차에 흩어진 오류 쌍을 자모 쌍별로 합친다.
//
// 데이터베이스에 합계를 따로 저장해 두는 방법도 있지만, 그러면 저장할 때와
// 합계를 고칠 때가 어긋나면 숫자가 틀어진다. 기록이 몇 백 줄 수준이라
// 불러와서 더하는 편이 단순하고 틀릴 일이 없다.
export async function loadCumulativeErrors() {
  const { data, error } = await supabase
    .from('session_errors')
    .select('from_jamo, to_jamo, category, count');
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

// 연결이 살아 있는지 확인한다. 6차시 목표가 바로 이것이다.
export async function checkConnection() {
  const user = await ensureSignedIn();
  const { error, count } = await supabase
    .from('practice_sessions')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return { userId: user.id, sessionCount: count ?? 0 };
}
