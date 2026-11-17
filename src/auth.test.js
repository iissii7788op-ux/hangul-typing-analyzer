// 익명 로그인 테스트. 실행: node src/auth.test.js
import { createEnsureSignedIn } from './auth.js';

let pass = 0, total = 0;
function check(label, actual, expected) {
  total++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} -> ${a}${ok ? '' : `  (기대: ${e})`}`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 가짜 supabase.auth. 로그인할 때마다 새 익명 사용자를 만들고,
// 브라우저처럼 로그인 상태를 하나만 들고 있다(늦게 끝난 쪽이 덮어쓴다).
function 가짜auth({ 처음부터_로그인 = false, 처음_실패 = false } = {}) {
  let stored = 처음부터_로그인 ? { user: { id: '기존사용자' } } : null;
  let 로그인횟수 = 0;
  let 실패남음 = 처음_실패 ? 1 : 0;
  return {
    get 로그인횟수() { return 로그인횟수; },
    async getSession() { await sleep(1); return { data: { session: stored } }; },
    async signInAnonymously() {
      로그인횟수 += 1;
      const user = { id: `익명${로그인횟수}` };
      await sleep(20);                                   // 네트워크를 타는 동안
      if (실패남음 > 0) { 실패남음 -= 1; return { data: {}, error: new Error('네트워크 오류') }; }
      stored = { user };
      return { data: { user }, error: null };
    },
  };
}

// 고치기 전 방식 (비교용)
const 옛방식 = auth => async () => {
  const { data: { session } } = await auth.getSession();
  if (session) return session.user;
  const { data, error } = await auth.signInAnonymously();
  if (error) throw error;
  return data.user;
};

console.log('[저장 두 개가 겹쳤을 때]');
{
  const auth = 가짜auth();
  const ids = (await Promise.all([옛방식(auth)(), 옛방식(auth)()])).map(u => u.id);
  check('옛 방식은 익명 사용자가 둘 생긴다 (비교용)', [auth.로그인횟수, ids[0] === ids[1]], [2, false]);
}
{
  const auth = 가짜auth();
  const ensure = createEnsureSignedIn(auth);
  const ids = (await Promise.all([ensure(), ensure()])).map(u => u.id);
  check('이제는 로그인을 한 번만 한다', auth.로그인횟수, 1);
  check('두 저장이 같은 사용자를 받는다', ids[0] === ids[1], true);
}
{
  const auth = 가짜auth();
  const ensure = createEnsureSignedIn(auth);
  const ids = (await Promise.all([1, 2, 3, 4, 5].map(() => ensure()))).map(u => u.id);
  check('다섯 개가 겹쳐도 한 번', [auth.로그인횟수, new Set(ids).size], [1, 1]);
}

console.log('\n[로그인 뒤]');
{
  const auth = 가짜auth();
  const ensure = createEnsureSignedIn(auth);
  const 처음 = (await ensure()).id;
  const 다음 = (await ensure()).id;
  check('다시 불러도 같은 사용자, 로그인은 그대로 한 번', [처음 === 다음, auth.로그인횟수], [true, 1]);
}
{
  const auth = 가짜auth({ 처음부터_로그인: true });
  const ensure = createEnsureSignedIn(auth);
  check('이미 로그인돼 있으면 새로 로그인하지 않는다', [(await ensure()).id, auth.로그인횟수], ['기존사용자', 0]);
}

console.log('\n[로그인이 실패했을 때]');
{
  const auth = 가짜auth({ 처음_실패: true });
  const ensure = createEnsureSignedIn(auth);
  const 첫결과 = await ensure().then(() => '성공', e => `실패: ${e.message}`);
  const 다음결과 = await ensure().then(u => u.id, e => `실패: ${e.message}`);
  check('실패는 그대로 알린다', 첫결과, '실패: 네트워크 오류');
  check('다음 저장 때 다시 시도한다', 다음결과, '익명2');
}

console.log(`\n${pass}/${total} 통과`);
process.exit(pass === total ? 0 : 1);
