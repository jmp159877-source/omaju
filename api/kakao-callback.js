// 카카오가 돌려보낸 코드를 받아 파이어베이스 로그인 토큰으로 바꾼다.
const { siteHost, customToken, post, get, readState, fail, done } = require('./_lib');

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (url.searchParams.get('error')) return fail(res, '카카오에서 취소되었습니다');
    if (!code) return fail(res, '카카오 응답이 비었습니다');
    if (!state || state !== readState(req, 'omaju_k')) return fail(res, '로그인이 만료되었습니다. 다시 눌러 주세요');

    const redirect = `https://${siteHost(req)}/api/kakao-callback`;
    const tok = await post('https://kauth.kakao.com/oauth/token', new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_KEY,
      client_secret: process.env.KAKAO_CLIENT_SECRET || '',
      redirect_uri: redirect, code,
    }).toString());

    const me = await get('https://kapi.kakao.com/v2/user/me', { Authorization: 'Bearer ' + tok.access_token });
    if (!me.id) return fail(res, '카카오 회원 정보를 받지 못했습니다');
    const nick = ((me.kakao_account && me.kakao_account.profile) || me.properties || {}).nickname || '';
    done(res, customToken('kakao_' + me.id, { via: 'kakao', nick }));
  } catch (e) {
    fail(res, '카카오 로그인에 실패했습니다', e.message);
  }
};
