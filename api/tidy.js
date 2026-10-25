// 말로 쓰기 정리 — 사랑방 한 줄 + 나의 수첩(메모·노트·일정·기억할 날) (대표 2026-10-25: "핸드폰에서 타이핑 치기 너무 힘들다") —
// 말로 대충 한 것을 받아 게시판 한 줄로 깔끔하게 다듬어 돌려준다. 저장은 하지 않는다(화면이 칸에 넣어 주고, 본인이 보고 '남기기').
// 필요한 환경변수 (Vercel): GEMINI_API_KEY — 없으면 군말만 걷어 내는 간단 정리로 돌려준다(화면은 그대로 동작).
// 바깥 꾸러미(npm)는 쓰지 않는다 (api/_lib.js 와 같은 까닭).
const HITS = new Map();   // 같은 곳에서 너무 자주 부르지 못하게 (1분에 8번)
let MODELS = null;

function plain(t) {
  let s = String(t || '').replace(/\s+/g, ' ').trim();
  s = s.replace(/(^|\s)(어+|음+|으음|아+|그+|저기|그러니까|뭐냐|막)(?=\s)/g, ' ').replace(/\s+/g, ' ').trim();
  if (s && !/[.!?…~ㅋㅎㅠㅜ^)]$/.test(s) && !/\p{Extended_Pictographic}$/u.test(s)) s += '.';
  return s.slice(0, 120);
}

async function models(key) {
  if (MODELS) return MODELS;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`);
    const ms = ((await r.json()).models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.split('/').pop());
    const ok = ms.filter(n => /flash/.test(n) && !/image|tts|live|audio/.test(n));
    const ver = n => { const m = n.match(/gemini-(\d+)(?:\.(\d+))?/); return m ? (+m[1]) * 100 + (+(m[2] || 0)) * 10 + (/preview|exp/.test(n) ? 0 : 1) : 0; };
    ok.sort((a, b) => ver(b) - ver(a) || (/lite/.test(b) ? 1 : 0) - (/lite/.test(a) ? 1 : 0));
    MODELS = ok.slice(0, 3);
  } catch (e) { MODELS = []; }
  return MODELS;
}

module.exports = async (req, res) => {
  const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return send(405, { ok: false });
  const origin = String((req.headers && (req.headers.origin || req.headers.referer)) || '');
  if (origin && !/^https:\/\/([a-z0-9-]+\.)?omaju\.kr/.test(origin)) return send(403, { ok: false });
  const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || 'x');
  const now = Date.now(), h = (HITS.get(ip) || []).filter(t => now - t < 60000); h.push(now); HITS.set(ip, h);
  if (h.length > 12) return send(429, { ok: false, why: '잠시 뒤에 다시 해 주세요' });

  let body = req.body;
  if (!body || typeof body === 'string') { try { body = JSON.parse(body || await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); })); } catch (e) { body = {}; } }
  const mode = ['memo', 'note', 'event', 'anniv'].includes(body.mode) ? body.mode : 'talk';
  const LIM = { talk: 120, memo: 500, note: 2000, event: 200, anniv: 100 }[mode];
  const text = String(body.text || '').slice(0, mode === 'note' ? 3000 : 600).trim(), topic = String(body.topic || '').slice(0, 60);
  if (!text) return send(400, { ok: false });
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today || '') ? body.today : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const wd = '일월화수목금토'[new Date(today + 'T12:00:00Z').getUTCDay()];

  const key = process.env.GEMINI_API_KEY || '';
  if (!key) return send(200, { ok: true, text: plain(text).slice(0, LIM), ai: false });
  const CLEAN = `- 군말(어, 음, 그러니까, 뭐냐)·말 더듬기·되풀이를 빼고, 맞춤법·띄어쓰기·문장부호를 바로잡는다.
- 말한 사람의 뜻·말투·사투리 느낌은 그대로 살린다. 없는 내용·감상·교훈을 보태지 않는다.`;
  const prompt = {
    talk: `웹 매거진 독자 게시판에 남길 한 줄이다. 오늘의 주제: "${topic}".
아래는 독자가 휴대폰에 대고 말로 한 것을 받아 적은 글이다. 게시판 글로 깔끔하게 다듬어라.
${CLEAN}
- ${LIM}자 이내. 길면 핵심만 남긴다.
형식(JSON만): {"text": "다듬은 글"}`,
    memo: `수첩에 적을 메모다. 아래는 말로 한 것을 받아 적은 글이다. 나중에 봐도 한눈에 알아보게 메모로 다듬어라.
${CLEAN}
- 할 일·살 것처럼 여러 가지면 쉼표나 줄바꿈으로 나눈다. ${LIM}자 이내.
형식(JSON만): {"text": "메모"}`,
    note: `수첩 노트다. 아래는 말로 한 것을 받아 적은 글이다. 읽기 좋은 노트로 다듬고 짧은 제목을 붙여라.
${CLEAN}
- 문단을 적당히 나눈다(줄바꿈). 제목은 20자 이내, 내용에서만. ${LIM}자 이내.
형식(JSON만): {"title": "제목", "text": "내용"}`,
    event: `수첩 일정 등록이다. 오늘은 ${today} (${wd}요일). 아래는 말로 한 것을 받아 적은 글이다.
날짜·시간을 알아내고, 무슨 일인지는 짧게(예: "치과 예약", "동창 모임 · 강남역") 적어라.
- '내일·모레·다음 주 화요일·이번 주말·25일' 같은 말은 오늘 기준으로 실제 날짜로 바꾼다. 지난 날짜면 다음 해·다음 달로.
- 시간: '오후 세 시 반'→15:30, '아침 7시'→07:00. 오전·오후 말이 없고 1~6시면 오후로 본다. 시간 말이 없으면 "".
- 날짜 말이 없으면 date 는 "". 없는 내용을 보태지 않는다.
형식(JSON만): {"text": "무슨 일", "date": "YYYY-MM-DD", "time": "HH:MM"}`,
    anniv: `수첩 '기억할 날' 등록이다. 아래는 말로 한 것을 받아 적은 글이다. 무슨 날인지(예: "큰딸 생일", "결혼기념일"), 월·일, 음력인지 알아내라.
- 월·일 말이 없으면 0. 음력이라고 했을 때만 lunar true. 없는 내용을 보태지 않는다.
형식(JSON만): {"text": "무슨 날", "month": 0, "day": 0, "lunar": false}`,
  }[mode] + `\n받아 적은 글: ${text}`;
  for (const m of await models(key)) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' } }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const raw = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').trim();
      let o; try { o = JSON.parse(raw.replace(/^```(json)?|```$/g, '')); } catch (e) { continue; }
      if (!o || !o.text) continue;
      const out = { ok: true, ai: true, text: String(o.text).trim().slice(0, LIM) };
      if (mode === 'note') out.title = String(o.title || '').trim().slice(0, 30);
      if (mode === 'event') { out.date = /^\d{4}-\d{2}-\d{2}$/.test(o.date || '') ? o.date : ''; out.time = /^\d{2}:\d{2}$/.test(o.time || '') ? o.time : ''; }
      if (mode === 'anniv') { out.month = +o.month || 0; out.day = +o.day || 0; out.lunar = !!o.lunar; }
      return send(200, out);
    } catch (e) {}
  }
  return send(200, { ok: true, text: plain(text).slice(0, LIM), ai: false });
};
