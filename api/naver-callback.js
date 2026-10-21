// 네이버가 돌려보낸 코드를 받아 파이어베이스 로그인 토큰으로 바꾼다.
const { siteHost, customToken, get, readState, fail, done } = require('./_lib');

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (url.searchParams.get('error')) return fail(res, '네이버에서 취소되었습니다');
    if (!code) return fail(res, '네이버 응답이 비었습니다');
    if (!state || state !== readState(req, 'omaju_n')) return fail(res, '로그인이 만료되었습니다. 다시 눌러 주세요');

    const q = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.NAVER_CLIENT_ID,
      client_secret: process.env.NAVER_CLIENT_SECRET || '',
      code, state,
    }).toString();
    const tok = await get('https://nid.naver.com/oauth2.0/token?' + q);
    if (!tok.access_token) return fail(res, '네이버 토큰을 받지 못했습니다');

    const me = await get('https://openapi.naver.com/v1/nid/me', { Authorization: 'Bearer ' + tok.access_token });
    const r = me.response || {};
    if (!r.id) return fail(res, '네이버 회원 정보를 받지 못했습니다');
    done(res, customToken('naver_' + r.id, { via: 'naver', nick: r.nickname || '' }));
  } catch (e) {
    fail(res, '네이버 로그인에 실패했습니다', e.message);
  }
};
