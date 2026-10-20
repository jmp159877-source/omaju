// 장 음성 안내 '읽어 드려요' — 장 맨 위의 진행자 사진을 누르면 그 장에 오늘 올라온 것을 읽어 준다.
// 장 안에서는 코너를 옮겨 다녀도 계속 흐르고, 그 장을 나가면 멎는다. 소리는 언제나 하나만 난다.
const RAW = 'https://raw.githubusercontent.com/jmp159877-source/omaju/media/radio/';
const CDN = 'https://cdn.jsdelivr.net/gh/jmp159877-source/omaju@media/radio/';
const $ = id => document.getElementById(id);
const key = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// 장마다 그 장에 속한 화면들 — 여기 있는 동안에는 소리가 이어진다
const SCOPE = {
  g1: ['g1', 'play', 'malmoi', 'shisen', 'num50', 'sudoku', 'fortune', 'food', 'book', 'quiz', 'culture'],
  g2: ['g2', 'history', 'music', 'story', 'home'],
  g5: ['g5', 'follow', 'outing', 'show', 'phrase'],
  g3: ['g3', 'hike', 'move', 'mind', 'body'],
};
const inScope = (ch, h) => (SCOPE[ch] || []).includes(h) || /^cu-[a-z]+$/.test(h);
const KO = { open: '여는 말', close: '닫는 말', weather: '오늘의 날씨', market: '오늘의 경제', cards: '오늘의 인사말 카드',
  play: '오늘 PLAY', fortune: '오늘의 운세', food: '오늘의 한 끼', book: '오늘의 한 권', quiz: '오늘의 시사 상식', culture: '오늘의 문화',
  history: '그해 오늘', music: '그 시절 노래', story: '그날의 사연', home: '그 동네 지금',
  follow: '오늘의 따라하기', outing: '오늘의 나들이', show: '이번 주, 무엇을 볼까', phrase: '여행',
  hike: '오늘의 산', move: '오늘의 몸 풀기', mind: '오늘의 마음 한 줄', body: '오늘의 몸 한 가지' };
const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`; };

let au = null, cur = null, data = {}, toast = () => {};

// ── 소리는 하나만 ──
// 다른 소리가 나기 시작하면 이 소리를 멈춘다. 거꾸로 이 소리를 틀면 다른 소리를 멈춘다.
function hush() {
  try { if (window.omajuOpening) window.omajuOpening.pause(); } catch (e) {}
  document.querySelectorAll('audio, video').forEach(a => { if (a !== au && !a.paused) try { a.pause(); } catch (e) {} });
  document.querySelectorAll('iframe[src*="youtube"]').forEach(f => { f.src = ''; });   // 유튜브는 주소를 비워야 멎는다
}

function bar(on) {
  const b = $('rd-bar'); if (!b) return;
  b.hidden = !on; document.body.classList.toggle('rd-on', !!on);
}
function markAt(t) {
  const m = (cur && cur.marks) || []; let k = 0;
  for (let i = 0; i < m.length; i++) if (t >= m[i].t) k = i;
  return k;
}
function paint() {
  if (!cur || !au) return;
  const i = markAt(au.currentTime), m = cur.marks[i];
  const now = $('rd-bar-k'); if (now) now.textContent = KO[m.k] || '';
  const left = $('rd-bar-left'); if (left) left.textContent = mmss(Math.max(0, cur.end - au.currentTime)) + ' 남음';
  const pp = $('rd-bar-pp'); if (pp) { pp.textContent = au.paused ? '이어 듣기' : '잠시 멈춤'; pp.setAttribute('aria-pressed', String(!au.paused)); }
  document.querySelectorAll('[data-corner]').forEach(c => c.classList.toggle('rd-now', !au.paused && c.dataset.corner === m.k));
  const f = $('rd-' + cur.ch + '-face'); if (f) f.classList.toggle('playing', !au.paused);
  face(cur.ch, !au.paused, '이어 듣기');
}
function face(ch, playing, labelIdle = '눌러서 듣기') {
  const go = $('rd-' + ch + '-go'); if (go) go.textContent = playing ? '듣는 중' : labelIdle;
}

export function pause() { if (au && !au.paused) { au.pause(); paint(); } }
export function stop() {
  if (!au) return;
  au.pause(); au.currentTime = 0; bar(false);
  document.querySelectorAll('.rd-now').forEach(c => c.classList.remove('rd-now'));
  if (cur) face(cur.ch, false, '눌러서 듣기');
  cur = null;
}

async function load(ch) {
  const k = key(new Date());
  for (const base of [RAW, CDN]) {
    try { const r = await fetch(base + `${k}-${ch}.json`, { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) {}
  }
  return null;
}

function play(ch) {
  const d = data[ch]; if (!d) return;
  hush();
  if (!au) {
    au = new Audio(); au.preload = 'auto';
    au.ontimeupdate = paint;
    au.onended = () => { stop(); toast('다 들으셨습니다.'); };
    au.onpause = paint; au.onplay = paint;
  }
  if (!cur || cur.ch !== ch) {
    cur = d; let i = 0;
    const src = n => (n ? CDN : RAW) + d.audio + (d.built ? '?v=' + d.built : '');
    au.src = src(0);
    au.onerror = () => { if (!i) { i = 1; au.src = src(1); au.play().catch(() => {}); } };
  }
  au.play().then(() => { bar(true); face(ch, true); paint(); })
    .catch(() => toast('소리를 켜지 못했습니다. 다시 눌러 주세요.'));
}

export async function init(h) {
  toast = (h && h.toast) || (() => {});
  for (const ch of Object.keys(SCOPE)) {
    const box = $('rd-' + ch); if (!box) continue;
    const d = await load(ch);
    const sub = $('rd-' + ch + '-sub'), go = $('rd-' + ch + '-go');
    if (!d || !d.marks || !d.marks.length) { if (sub) sub.textContent = '오늘 안내는 잠시 뒤에 올라옵니다'; if (go) go.textContent = '준비 중'; box.classList.add('rd-off'); continue; }
    data[ch] = d;
    if (sub) sub.textContent = `${d.title}, 틀어 놓고 들으세요 · 약 ${Math.max(1, Math.round(d.end / 60))}분`;
    if (go) go.textContent = '눌러서 듣기';
    box.classList.remove('rd-off');
    const btn = $('rd-' + ch + '-face');
    if (btn) btn.onclick = () => { if (cur && cur.ch === ch && !au.paused) pause(); else play(ch); };
  }

  const pp = $('rd-bar-pp'); if (pp) pp.onclick = () => { if (!au) return; if (au.paused) { hush(); au.play().catch(() => {}); } else au.pause(); paint(); };
  const sk = $('rd-bar-skip'); if (sk) sk.onclick = () => { if (!au || !cur) return; const i = markAt(au.currentTime); const n = cur.marks[i + 1]; au.currentTime = n ? n.t : cur.end; paint(); };
  const x = $('rd-bar-x'); if (x) x.onclick = stop;

  // 저절로 멎는 때: 그 장을 나감 · 다른 앱이나 탭 · 다른 소리가 남
  window.addEventListener('hashchange', () => { if (cur && !inScope(cur.ch, location.hash.slice(1))) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  document.addEventListener('play', e => { if (au && e.target !== au) pause(); }, true);
  window.omajuRadio = { pause, stop, play };
}
