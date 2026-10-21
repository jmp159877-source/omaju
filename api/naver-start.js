// '네이버로 시작하기' — 네이버 로그인 화면으로 보낸다.
const { setState, newState, fail } = require('./_lib');

module.exports = async (req, res) => {
  const id = process.env.NAVER_CLIENT_ID;
  if (!id) return fail(res, '네이버 설정이 아직입니다');
  const state = newState();
  setState(res, 'omaju_n', state);
  const redirect = `https://${req.headers.host}/api/naver-callback`;
  const u = 'https://nid.naver.com/oauth2.0/authorize'
    + `?response_type=code&client_id=${encodeURIComponent(id)}`
    + `&redirect_uri=${encodeURIComponent(redirect)}&state=${state}`;
  res.writeHead(302, { Location: u });
  res.end();
};
