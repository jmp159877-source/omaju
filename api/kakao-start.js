// '카카오로 시작하기' — 카카오 로그인 화면으로 보낸다. 열쇠는 서버에만 둔다.
const { siteHost, setState, newState, fail } = require('./_lib');

module.exports = async (req, res) => {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) return fail(res, '카카오 설정이 아직입니다');
  const state = newState();
  setState(res, 'omaju_k', state);
  // ?prep=1 — 화면이 카카오 SDK 로 카카오톡 앱 로그인을 할 때 쓸 표만 받아 간다(쿠키는 같이 심긴다).
  if (/[?&]prep=1/.test(req.url || '')) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ state }));
  }
  const redirect = `https://${siteHost(req)}/api/kakao-callback`;
  const u = 'https://kauth.kakao.com/oauth/authorize'
    + `?client_id=${encodeURIComponent(key)}`
    + `&redirect_uri=${encodeURIComponent(redirect)}`
    + `&response_type=code&state=${state}&scope=profile_nickname`;
  res.writeHead(302, { Location: u });
  res.end();
};
