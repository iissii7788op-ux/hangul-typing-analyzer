// 익명 로그인을 '한 번만' 돌게 하는 장치.
//
// 처음 들어온 사람은 로그인 상태가 없어서, 저장할 때 익명 로그인을 새로 한다.
// 그런데 결과 화면을 먼저 띄우려고 저장을 기다리지 않기 때문에, 첫 로그인이 끝나기
// 전에 다음 저장이 시작될 수 있다. 예전 코드는 그때도 '로그인 상태가 없네' 하고
// 로그인을 또 해서 익명 사용자가 둘 생겼다.
//
// 브라우저의 로그인 상태는 하나뿐이라 늦게 끝난 로그인이 앞의 것을 덮어쓴다.
// 그러면 먼저 시작한 저장은 줄에는 사용자 A 라고 적고, 요청은 B 의 표로 보내게 되어
// RLS('토큰 주인과 줄의 주인이 같아야 한다')에 막혔다.
//
// 그래서 로그인을 진행 중인 약속(Promise) 하나로 묶어 두고, 그사이 들어온 요청은
// 새로 로그인하지 않고 같은 약속을 함께 기다리게 한다.
//
// auth 에는 supabase.auth 를 넘긴다. 테스트에서는 가짜를 넘겨 확인한다.
export function createEnsureSignedIn(auth) {
  let pending = null;   // 지금 진행 중인 '로그인 확인' 하나

  return function ensureSignedIn() {
    if (!pending) {
      pending = (async () => {
        // 로그인 상태 확인도 약속 안에 넣는다. 밖에 두면 두 요청이 모두
        // '아직 없음' 을 본 뒤에 약속을 만들러 들어와서 다시 둘이 된다.
        const { data: { session } } = await auth.getSession();
        if (session) return session.user;

        const { data, error } = await auth.signInAnonymously();
        if (error) throw error;
        return data.user;
      })().finally(() => {
        // 끝나면 비운다. 성공했으면 다음 확인은 저장된 로그인 상태를 곧바로 찾고,
        // 실패했으면 다음 저장 때 다시 시도할 수 있다.
        pending = null;
      });
    }
    return pending;
  };
}
