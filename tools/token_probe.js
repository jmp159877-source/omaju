// 카카오·네이버 로그인이 '로그인에 실패했습니다'로 끝나는 까닭을 가려 보는 점검 도구.
// api/_lib.js 와 똑같은 방식으로 맞춤 토큰을 만들고, 화면이 하는 것과 똑같이
// 파이어베이스에 들이밀어 본다. 되면 열쇠는 멀쩡한 것이고(= Vercel 에 넣은 값이 문제),
// 안 되면 열쇠 자체가 다른 프로젝트 것이거나 잘린 것이다.
const crypto = require('crypto');

const WEB_KEY = 'AIzaSyDy7HkwonhfoAJLe-K1zDQ4Lh02xFzC2_U';   // 화면에 그대로 박혀 있는 공개 열쇠
const WANT = 'omaju-d7862';

const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o))
  .toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function note(s) { console.log('::notice::' + s); }

(async () => {
  let sa;
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }
  catch (e) { note('열쇠(FIREBASE_SERVICE_ACCOUNT)를 읽지 못함: ' + e.message); process.exit(0); }

  const email = sa.client_email || '';
  const proj = (email.split('@')[1] || '').split('.')[0];
  note('서비스 계정 프로젝트: ' + (proj || '(없음)') + ' / 화면이 쓰는 프로젝트: ' + WANT
    + ' → ' + (proj === WANT ? '같음' : '★다름★'));
  note('비밀 열쇠 모양: ' + (/^-----BEGIN PRIVATE KEY-----/.test((sa.private_key || '').trim()) ? '머리 맞음' : '★머리부터 틀림★')
    + ' / 길이 ' + (sa.private_key || '').length + '자 / 줄 수 ' + (sa.private_key || '').split('\n').length);

  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const payload = b64({
    iss: email, sub: email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now, exp: now + 3600, uid: 'kakao_probe', claims: { via: 'kakao', nick: '점검' },
  });
  let token;
  try {
    const sig = crypto.createSign('RSA-SHA256').update(head + '.' + payload).end()
      .sign(sa.private_key).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    token = `${head}.${payload}.${sig}`;
  } catch (e) { note('서명 실패 — 비밀 열쇠가 깨졌습니다: ' + e.message); process.exit(0); }

  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, returnSecureToken: true }) });
  const t = await r.text();
  if (r.ok) note('로그인 됨 — 열쇠는 멀쩡합니다. Vercel 에 넣은 값이 문제입니다.');
  else note('파이어베이스가 거절: ' + r.status + ' ' + t.slice(0, 300));
})();
