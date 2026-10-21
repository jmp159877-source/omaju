// '네이버로 시작하기' — 네이버 로그인 화면으로 보낸다.
const { setState, newState, fail } = require('./_lib');

module.exports = async (req, res) => {
  const id = process.env.NAVER_CLIENT_ID;
  if (!id) return fail(res, '네이버 설정이 아직입니다');
  const state = newState();
  setState(res, 'omaju_n', state);
  const host = req.headers.host;
  const redirect = `https://${host}/api/naver-callback`;
  // ?re=1 — 이미 동의한 사람에게도 동의 화면을 다시 띄운다 (네이버 검수용 단계별 캡처를 찍으려고)
  const q = new URL(req.url, 'https://' + host).searchParams;
  const u = 'https://nid.naver.com/oauth2.0/authorize'
    + `?response_type=code&client_id=${encodeURIComponent(id)}`
    + `&redirect_uri=${encodeURIComponent(redirect)}&state=${state}`
    + (q.get('re') ? '&auth_type=reprompt' : '');
  // ?show=1 — 네이버로 보내지 않고 무엇을 보내는지 글로 보여 준다 (설정이 어긋났을 때 어디가 틀렸는지 보려고)
  if (q.get('show')) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`host: ${host}\nredirect_uri: ${redirect}\nclient_id: ${id}\nclient_id 길이: ${id.length}\n`
      + `secret 길이: ${(process.env.NAVER_CLIENT_SECRET || '').length}\n\n${u}\n`);
    return;
  }
  res.writeHead(302, { Location: u });
  res.end();
};
