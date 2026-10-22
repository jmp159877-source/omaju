// Vercel 이 정해진 시각에 이 주소를 불러 깃허브 작업을 깨운다 (운영자 2026-10-22).
//
// 까닭: 깃허브의 예약(schedule)은 이 저장소에서 3~4시간씩 밀리거나 아예 건너뛰었다.
//   10/22 하루만 해도 00:05 내일치 콘텐츠가 04:11 에, 05:10 이슈가 08:11 에 돌았고,
//   시세는 12시 이후 한 번도 안 돌았다. Vercel 의 예약(cron)은 Pro 에서 분 단위로 정확하다.
//
// 하는 일: ?w=작업이름 을 받아 그 깃허브 작업을 한 번 돌리라고 부탁(workflow_dispatch)할 뿐이다.
//   만드는 일 자체는 지금처럼 깃허브에서 한다 (파이썬·ffmpeg 이 거기 있다).
//
// 필요한 환경변수 (Vercel):
//   GH_DISPATCH_TOKEN — 깃허브 열쇠. omaju 저장소 하나, Actions 읽기·쓰기 권한만. 2027-10-22 에 끝난다.
//   CRON_SECRET       — Vercel 이 예약으로 부를 때 'Authorization: Bearer …' 로 붙여 보낸다.
//                       남이 이 주소를 아무 때나 불러 작업(=AI 비용)을 돌리지 못하게 막는 자물쇠.
//
// 바깥 꾸러미(npm)는 쓰지 않는다 (api/_lib.js 와 같은 까닭).

const REPO = 'jmp159877-source/omaju';
// 예약 시각(UTC) → 깨울 작업. vercel.json 의 crons 와 **똑같이** 맞춰 둔다.
// 주소에 ?w= 를 붙이는 방식은 Vercel 문서에 없어서(배포가 거부될까 봐) 쓰지 않는다.
// 대신 Vercel 이 'x-vercel-cron-schedule' 머리말로 어느 예약이 불렀는지 알려 준다 (문서에 있는 방식).
const BY_SCHEDULE = {
  '13 0-7 * * 1-5': 'market', '13 21 * * *': 'market', '13 9 * * *': 'market', '13 12 * * *': 'market',   // 평일 09~16시 매시 13분, 06:13 · 18:13 · 21:13
  '10 20 * * *': 'issues', '40 2,7,11 * * *': 'issues',                                                  // 05:10 · 11:40 · 16:40 · 20:40
  '5 15 * * *': 'daily', '0 18 * * *': 'daily', '0 21 * * *': 'daily', '40 7 * * *': 'daily',           // 00:05, 보강 03:00 · 06:00 · 16:40
  '40 15 * * *': 'era_news',                                                                             // 00:40
  '0 16 * * *': 'opening', '10 19 * * *': 'opening',                                                     // 01:00 (내일치가 다 된 뒤), 보강 04:10
  '20 16 * * *': 'radio', '30 20 * * *': 'radio',                                                        // 01:20, 보강 05:30
};
const ALLOW = new Set(Object.values(BY_SCHEDULE));

module.exports = async (req, res) => {
  const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
  const secret = process.env.CRON_SECRET || '';
  const auth = (req.headers && req.headers.authorization) || '';
  if (!secret || auth !== `Bearer ${secret}`) return send(401, { ok: false, why: '열쇠가 맞지 않음' });

  const sch = String((req.headers && req.headers['x-vercel-cron-schedule']) || '');
  const w = BY_SCHEDULE[sch] || String((req.query && req.query.w) || new URL(req.url, 'http://x').searchParams.get('w') || '');
  if (!ALLOW.has(w)) return send(400, { ok: false, why: '모르는 작업', w });

  const token = process.env.GH_DISPATCH_TOKEN || '';
  if (!token) return send(500, { ok: false, why: 'GH_DISPATCH_TOKEN 없음' });

  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${w}.yml/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'omaju-tick' },
      body: JSON.stringify({ ref: 'main' }),
    });
    if (r.status === 204) return send(200, { ok: true, w, at: new Date().toISOString() });
    const t = (await r.text()).slice(0, 300);
    return send(502, { ok: false, w, status: r.status, why: t });
  } catch (e) {
    return send(502, { ok: false, w, why: String(e && e.message || e).slice(0, 200) });
  }
};
module.exports.BY_SCHEDULE = BY_SCHEDULE;
