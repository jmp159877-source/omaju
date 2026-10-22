// 카톡 안 브라우저 → 크롬으로 넘어갈 때 로그인을 같이 들고 간다 (대표 2026-10-23 찾음).
// 카톡 안 브라우저와 크롬(바탕화면 앱 포함)은 저장 공간이 따로라, 카톡 안에서 구독하고
// 크롬으로 앱을 깔면 앱에서는 로그아웃으로 보였다. 거기서 다시 카카오를 누르면 크롬에는
// 카카오 로그인이 없어 아이디·비밀번호를 물었다.
// 지금 로그인한 사람의 파이어베이스 신분증(ID 토큰)을 확인하고, 같은 사람으로 들어가는
// 10분짜리 맞춤 토큰을 내준다. 받은 사람 자신의 것이므로 남의 계정으로 넘어갈 길은 없다.
const crypto = require('crypto');
const { customToken } = require('./_lib');

const PROJECT = 'omaju-d7862';
const CERTS = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const unb64 = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

async function verify(idToken) {
  const [h, p, sig] = String(idToken || '').split('.');
  if (!h || !p || !sig) throw new Error('토큰 모양이 틀렸습니다');
  const head = JSON.parse(unb64(h).toString()), body = JSON.parse(unb64(p).toString());
  if (head.alg !== 'RS256') throw new Error('alg');
  const certs = await (await fetch(CERTS)).json();
  const pem = certs[head.kid];
  if (!pem) throw new Error('kid');
  const ok = crypto.createVerify('RSA-SHA256').update(h + '.' + p).end().verify(pem, unb64(sig));
  if (!ok) throw new Error('서명이 틀렸습니다');
  const now = Math.floor(Date.now() / 1000);
  if (body.aud !== PROJECT || body.iss !== 'https://securetoken.google.com/' + PROJECT) throw new Error('다른 프로젝트');
  if (!(body.exp > now) || !(body.iat <= now + 60) || !body.sub) throw new Error('만료');
  return body;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
    let raw = '';
    for await (const c of req) { raw += c; if (raw.length > 8000) break; }
    const { idToken } = JSON.parse(raw || '{}');
    const b = await verify(idToken);
    const claims = {};
    if (b.via) claims.via = b.via;
    if (b.nick) claims.nick = b.nick;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ct: customToken(b.sub, claims, 600) }));
  } catch (e) {
    console.error('[handoff]', e.message);
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'no' }));
  }
};
