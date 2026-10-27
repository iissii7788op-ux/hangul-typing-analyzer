-- 오타지도 · 테이블 설계
-- Supabase 대시보드의 SQL Editor 에 붙여넣고 Run 하면 된다.

-- ── 1. 연습 한 라운드의 요약 ─────────────────────────────
-- 계획서: 제시 문장, 실제 입력 문장, 걸린 시간, 정확도, 날짜를 저장한다.
create table if not exists practice_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  created_at    timestamptz not null default now(),

  accuracy      int  not null,          -- 정확도(%)
  cpm           int  not null,          -- 분당 타수
  error_count   int  not null,          -- 오타 몇 곳
  elapsed_ms    int  not null,          -- 걸린 시간(ms)

  -- 문장은 라운드마다 여러 개라서 [{target, typed}] 꼴로 함께 담는다.
  -- 문장 하나하나를 따로 뒤질 일이 없어 표를 더 쪼개지 않았다.
  sentences     jsonb not null default '[]'::jsonb,

  suggested_sentence text                -- 그때 만들어 준 맞춤 연습 문장
);

-- ── 2. 그 라운드에서 나온 오류 쌍 ────────────────────────
-- 계획서: 자모 오류 쌍이 몇 번씩 나왔는지 저장한다.
create table if not exists session_errors (
  id          bigserial primary key,
  session_id  uuid not null references practice_sessions(id) on delete cascade,
  user_id     uuid not null default auth.uid(),

  from_jamo   text not null,            -- 쳤어야 할 자모
  to_jamo     text,                     -- 실제로 친 자모 (빠뜨림이면 비어 있다)
  category    text not null,            -- neighbor / distant / missing / extra / swap
  count       int  not null
);

-- ── 3. 그 라운드의 자모별 평균 입력 시간 ─────────────────
-- 계획서: 자모별 평균 입력 시간을 저장한다.
create table if not exists session_jamo_times (
  id          bigserial primary key,
  session_id  uuid not null references practice_sessions(id) on delete cascade,
  user_id     uuid not null default auth.uid(),

  jamo        text not null,
  avg_ms      int  not null,
  count       int  not null
);

-- 기록 화면에서 '내 것만 날짜 순으로' 불러오므로 그 기준으로 색인을 만든다.
create index if not exists idx_sessions_user_time
  on practice_sessions (user_id, created_at desc);
create index if not exists idx_errors_user
  on session_errors (user_id);
create index if not exists idx_jamo_user
  on session_jamo_times (user_id);

-- ── 4. 자기 기록만 보고 쓰게 막기 (Row Level Security) ───
--
-- 이것을 켜지 않으면 주소와 공개 키만 알면 누구나 남의 기록을 읽고 지울 수 있다.
-- 공개 키(anon key)는 브라우저에 그대로 노출되는 값이라 숨길 수가 없다.
-- 그래서 '키를 숨기는 것' 이 아니라 '키가 있어도 자기 줄만 건드리게' 막는다.
alter table practice_sessions  enable row level security;
alter table session_errors     enable row level security;
alter table session_jamo_times enable row level security;

create policy "자기 연습 기록만" on practice_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "자기 오류 기록만" on session_errors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "자기 입력 시간만" on session_jamo_times
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
