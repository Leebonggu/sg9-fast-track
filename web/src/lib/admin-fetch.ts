// 관리자 전용 API 호출용 fetch 래퍼. sessionStorage의 adminPw를 x-app-password 헤더로 첨부해
// middleware.ts의 서버사이드 인증 체크를 통과시킨다. 사용법은 fetch와 동일.
export function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const pw = typeof window !== 'undefined' ? sessionStorage.getItem('adminPw') || '' : '';
  const headers = new Headers(init.headers);
  headers.set('x-app-password', pw);
  return fetch(input, { ...init, headers });
}
