// 구독 번호를 그 자리에서 매긴다 (대표 2026-10-26 23:55 — 환영 카드에 "창간 5일째, 1207번 구독자가 되셨습니다~!").
// 예전엔 tools/founder.py 가 하루 열두 번 돌며 나중에 매겼다. 그래서 가입 직후 환영 카드에서는 번호를 알 수 없었다.
// 이제 가입을 마친 화면이 이 주소를 부르면 여기서 바로 매기고 돌려준다(founder.py 는 빠진 분을 채우는 예비로 그대로 둔다).
// 규칙은 founder.py 와 같다: 관리자·'창간 빼기' 한 분 제외, 창간 기간(~2026-11-22 18:00) 안 구독자만, 1206번부터(이미 있으면 가장 큰 번호 다음).
// 꾸러미 없이 — 파이어베이스 로그인 표(idToken)는 identitytoolkit 로 확인, 저장소는 서비스 계정으로 REST.
const crypto = require('crypto');

const PROJECT = 'omaju-d7862';
const WEB_KEY = 'AIzaSyDy7HkwonhfoAJLe-K1zDQ4Lh02xFzC2_U';   // 화면(firebase-config.js)에 공개돼 있는 웹 열쇠 — 비밀 아님
const START = 1206;
const END = Date.parse('2026-11-22T09:00:00Z');
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function sa() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim().startsWith('{')) return JSON.parse(raw);
  let key = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  return { client_email: (process.env.FIREBASE_CLIENT_EMAIL || '').trim(), private_key: key.replace(/\\n/g, '\n') };
}
async function accessToken() {
  const s = sa(), now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' }), body = b64({ iss: s.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600 });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + body).end().sign(s.private_key).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${head}.${body}.${sig}` });
  const j = await r.json(); if (!j.access_token) throw new Error('token ' + JSON.stringify(j).slice(0, 120)); return j.access_token;
}
const val = f => (f == null ? null : f.integerValue != null ? +f.integerValue : f.stringValue != null ? f.stringValue : f.booleanValue != null ? f.booleanValue : f.timestampValue || null);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.idToken) return res.status(400).json({ ok: false, why: 'no token' });
    // 누구인지: 화면이 준 로그인 표를 파이어베이스에 물어 확인
    const lk = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: body.idToken }) })).json();
    const uid = lk.users && lk.users[0] && lk.users[0].localId; if (!uid) return res.status(401).json({ ok: false, why: 'bad token' });
    const tok = await accessToken(), H = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
    const u = await (await fetch(`${DOCS}/users/${uid}`, { headers: H })).json();
    const f = u.fields || {};
    if (val(f.founderNo)) return res.json({ ok: true, no: val(f.founderNo) });
    const created = Date.parse(val(f.createdAt) || '') || Date.now();
    if (val(f.role) === 'admin' || val(f.noFounder) || created >= END) return res.json({ ok: true, no: null });
    // 지금 가장 큰 번호 다음
    const q = await (await fetch(`${DOCS}:runQuery`, { method: 'POST', headers: H, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'users' }], orderBy: [{ field: { fieldPath: 'founderNo' }, direction: 'DESCENDING' }], limit: 1 } }) })).json();
    const top = Array.isArray(q) && q[0] && q[0].document ? val(q[0].document.fields.founderNo) || 0 : 0;
    const no = Math.max(START - 1, top) + 1;
    const w = await fetch(`${DOCS}/users/${uid}?updateMask.fieldPaths=founderNo&currentDocument.exists=true`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { founderNo: { integerValue: String(no) } } }) });
    if (!w.ok) throw new Error('write ' + w.status + ' ' + (await w.text()).slice(0, 120));
    return res.json({ ok: true, no });
  } catch (e) {
    console.error('member-no', e.message);
    return res.status(500).json({ ok: false, why: String(e.message).slice(0, 160) });
  }
};
