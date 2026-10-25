// 사랑방 '말로 쓰기' (대표 2026-10-25: "핸드폰에서 타이핑 치기 너무 힘들다") —
// 말로 대충 한 것을 받아 게시판 한 줄로 깔끔하게 다듬어 돌려준다. 저장은 하지 않는다(화면이 칸에 넣어 주고, 본인이 보고 '남기기').
// 필요한 환경변수 (Vercel): GEMINI_API_KEY — 없으면 군말만 걷어 내는 간단 정리로 돌려준다(화면은 그대로 동작).
// 바깥 꾸러미(npm)는 쓰지 않는다 (api/_lib.js 와 같은 까닭).
const HITS = new Map();   // 같은 곳에서 너무 자주 부르지 못하게 (1분에 8번)
let MODELS = null;

function plain(t) {
  let s = String(t || '').replace(/\s+/g, ' ').trim();
  s = s.replace(/(^|\s)(어+|음+|으음|아+|그+|저기|그러니까|뭐냐|막)(?=\s)/g, ' ').replace(/\s+/g, ' ').trim();
  if (s && !/[.!?…~]$/.test(s)) s += '.';
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
  if (h.length > 8) return send(429, { ok: false, why: '잠시 뒤에 다시 해 주세요' });

  let body = req.body;
  if (!body || typeof body === 'string') { try { body = JSON.parse(body || await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); })); } catch (e) { body = {}; } }
  const text = String(body.text || '').slice(0, 600).trim(), topic = String(body.topic || '').slice(0, 60);
  if (!text) return send(400, { ok: false });

  const key = process.env.GEMINI_API_KEY || '';
  if (!key) return send(200, { ok: true, text: plain(text), ai: false });
  const prompt = `웹 매거진 독자 게시판에 남길 한 줄이다. 오늘의 주제: "${topic}".
아래는 독자가 휴대폰에 대고 말로 한 것을 받아 적은 글이다. 이것을 게시판 글로 깔끔하게 다듬어라.
- 군말(어, 음, 그러니까, 뭐냐)·말 더듬기·되풀이를 빼고, 맞춤법·띄어쓰기·문장부호를 바로잡는다.
- 말한 사람의 뜻·말투(존댓말/반말)·사투리 느낌·웃음은 그대로 살린다. 없는 내용·감상·교훈을 보태지 않는다.
- 120자 이내. 길면 핵심만 남긴다. 따옴표·설명 없이 다듬은 글만 쓴다.
받아 적은 글: ${text}`;
  for (const m of await models(key)) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1024 } }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const out = (((j.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || '').join('').trim().replace(/^["'“”]+|["'“”]+$/g, '');
      if (out) return send(200, { ok: true, text: out.slice(0, 120), ai: true });
    } catch (e) {}
  }
  return send(200, { ok: true, text: plain(text), ai: false });
};
