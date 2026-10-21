// 카카오·네이버 로그인을 파이어베이스 로그인으로 잇는 다리에서 같이 쓰는 것들.
// 바깥 꾸러미(npm)를 하나도 쓰지 않는다 — 이 저장소는 그냥 정적 사이트라, 꾸러미를 들이면
// 올리는 방식 자체가 달라져 멀쩡히 돌던 화면이 깨질 수 있다. 파이어베이스 맞춤 토큰은
// 서비스 계정 열쇠로 서명한 JWT 일 뿐이라 node 에 들어 있는 crypto 로 충분하다.
const crypto = require('crypto');

const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o))
  .toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT 없음');
  return JSON.parse(raw);
}

/** 파이어베이스 맞춤 토큰 — 화면에서 signInWithCustomToken 으로 로그인한다. */
function customToken(uid, claims = {}) {
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const body = {
    iss: sa.client_email, sub: sa.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now, exp: now + 3600, uid, claims,
  };
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const payload = b64(body);
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + payload).end()
    .sign(sa.private_key).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${head}.${payload}.${sig}`;
}

async function post(url, body, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8', ...headers },
    body,
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) throw new Error(`${url} ${r.status} ${t.slice(0, 200)}`);
  return j || {};
}

async function get(url, headers = {}) {
  const r = await fetch(url, { headers });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) throw new Error(`${url} ${r.status} ${t.slice(0, 200)}`);
  return j || {};
}

/** 돌아왔을 때 우리가 보낸 요청이 맞는지 보려고 심는 한 번짜리 표 */
function setState(res, name, value) {
  res.setHeader('Set-Cookie',
    `${name}=${value}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`);
}
function readState(req, name) {
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? m[1] : '';
}
const newState = () => crypto.randomBytes(16).toString('hex');

/** 로그인에 실패하면 첫 화면으로 돌려보내고 까닭만 한 줄 알린다 (속내용은 기록에만). */
function fail(res, why, detail) {
  console.error('[소셜 로그인]', why, detail || '');
  res.writeHead(302, { Location: '/?login=' + encodeURIComponent(why) });
  res.end();
}

/** 토큰을 주소에 실어 첫 화면으로 — 화면 쪽에서 받아 로그인하고 주소를 지운다. */
function done(res, token) {
  res.writeHead(302, { Location: '/?ct=' + encodeURIComponent(token) });
  res.end();
}

module.exports = { customToken, post, get, setState, readState, newState, fail, done };
