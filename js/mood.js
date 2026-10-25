// 오늘의 음악과 함께 (대표 2026-10-25): 상황을 고르면 오마주가 직접 만든 연주곡이 끊김 없이 이어진다.
//  · 음악은 tools/mood_music.py 가 구글 Lyria 로 만든 것 — 저작권·광고 걱정 없음. 파일은 mood 가지(jsDelivr).
//  · 이 칸만은 화면을 꺼도·다른 앱으로 가도 계속 나온다(대표: "잠가도 계속"). 잠금 화면에 곡 이름·멈춤·앞뒤·끄기.
//  · 소리는 언제나 하나만: 오프닝·유튜브 등 다른 소리가 나면 멎고, 이걸 틀면 다른 소리가 멎는다.
// 깃허브 원본을 먼저(audio/mpeg 로 주는 것 확인), jsDelivr 는 예비 — 곡이 많아 jsDelivr 크기 한도에 걸릴 수 있다
const BASES = ['https://raw.githubusercontent.com/jmp159877-source/omaju/mood/', 'https://cdn.jsdelivr.net/gh/jmp159877-source/omaju@mood/'];
export const MOODS = [
  ['walk', '산책', '기분 좋은 어쿠스틱'], ['hike', '등산', '발걸음 가벼운'], ['exercise', '운동', '신나는 리듬'], ['drive', '운전', '감미로운 그루브'],
  ['rest', '휴식', '잔잔한 피아노'], ['work', '업무', '집중을 돕는'], ['travel', '여행', '창밖 보며 듣는'],
];
const IC = { play: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>', pause: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>', prev: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z" fill="currentColor"/></svg>', next: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z" fill="currentColor"/></svg>' };
const NAME = Object.fromEntries(MOODS.map(([k, n, s]) => [k, n + ' · ' + s]));
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let LIST = null, base = 0, au = null, cur = null, order = [], idx = 0, toastFn = null, closeFn = null, trackFn = null;

async function load() {
  if (LIST) return LIST;
  for (let i = 0; i < BASES.length; i++) {
    try { const r = await fetch(BASES[i] + 'list.json', { cache: 'no-cache' }); if (!r.ok) continue; LIST = await r.json(); base = i; return LIST; } catch (e) {}
  }
  return null;
}
const mins = k => Math.max(1, Math.round(((LIST && LIST[k]) || []).reduce((a, x) => a + (x.sec || 0), 0) / 60));

function paint() {
  document.querySelectorAll('.mz-c').forEach(b => { const on = cur && b.dataset.mz === cur; b.classList.toggle('on', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); const i = b.querySelector('i'); if (i) i.innerHTML = on && au && !au.paused ? IC.pause : IC.play; });
  const bar = $('mz-bar'); if (!bar) return;
  const show = !!(cur && au && au.src);
  bar.hidden = !show; document.body.classList.toggle('mz-on', show);
  if (!show) return;
  $('mz-t').textContent = NAME[cur] || '';
  $('mz-s').textContent = `${order.length}곡 중 ${idx + 1}번째 · 이어 듣기`;
  $('mz-pp').innerHTML = au.paused ? IC.play : IC.pause; $('mz-pp').setAttribute('aria-label', au.paused ? '이어 듣기' : '잠시 멈춤');
}
function session() {
  if (!('mediaSession' in navigator) || !cur) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: NAME[cur], artist: '오마주 매거진', album: '오늘의 음악과 함께',
      artwork: [{ src: location.origin + '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: location.origin + '/icon-192.png', sizes: '192x192', type: 'image/png' }] });
    const h = { play: () => resume(), pause: () => pause(), previoustrack: () => step(-1), nexttrack: () => step(1), stop: () => stop() };
    for (const [a, f] of Object.entries(h)) { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} }
    navigator.mediaSession.playbackState = au && !au.paused ? 'playing' : 'paused';
  } catch (e) {}
}
function others() {
  try { window.omajuOpening && window.omajuOpening.pause(); } catch (e) {}
  try { window.omajuRadio && window.omajuRadio.pause(); } catch (e) {}
  try { const m = document.querySelector('.pl-modal'); if (m) { m.querySelectorAll('iframe').forEach(f => { f.src = 'about:blank'; }); closeFn && closeFn(); } } catch (e) {}   // 유튜브 창이 떠 있으면 닫는다
}
function setTrack() {
  const it = LIST[cur][order[idx]]; au.src = BASES[base] + it.f;
}
async function start(k) {
  if (!(await load()) || !(LIST[k] || []).length) { toastFn && toastFn('음악을 준비하는 중이에요. 잠시 뒤에 다시 눌러 주세요.'); return; }
  if (!au) {
    au = new Audio(); au.preload = 'auto'; au.setAttribute('playsinline', ''); au.id = 'mz-audio';
    au.onended = () => step(1);
    au.onplay = () => { paint(); session(); }; au.onpause = () => { paint(); session(); };
    au.onerror = () => { if (base + 1 < BASES.length) { base++; setTrack(); au.play().catch(() => {}); } };
  }
  cur = k; const n = LIST[k].length; order = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  idx = 0; setTrack(); others();
  try { await au.play(); } catch (e) { toastFn && toastFn('재생을 시작하지 못했어요. 한 번 더 눌러 주세요.'); }
  paint(); session();
  try { trackFn && trackFn('mood_play', { k }); } catch (e) {}
}
function step(d) { if (!cur) return; idx = (idx + d + order.length) % order.length; if (idx === 0 && d > 0) { /* 한 바퀴 돌면 그대로 다시 — 끊김 없이 */ } setTrack(); au.play().catch(() => {}); paint(); session(); }
export function pause() { if (au && !au.paused) au.pause(); }
function resume() { if (au && cur) { others(); au.play().catch(() => {}); } }
export function stop() {
  if (au) { au.pause(); au.removeAttribute('src'); au.load(); }
  cur = null; paint();
  try { if ('mediaSession' in navigator) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } } catch (e) {}
}

export function init(opts = {}) {
  toastFn = opts.toast || null; closeFn = opts.closeModal || null; trackFn = opts.track || null;
  const grid = $('mz-grid'); if (!grid) return;
  grid.innerHTML = MOODS.map(([k, n, s]) => `<button type="button" class="mz-c" data-mz="${k}" aria-pressed="false"><i aria-hidden="true">${IC.play}</i><b>${esc(n)}</b><small>${esc(s)}</small><em class="mz-min" data-min="${k}"></em></button>`).join('');
  grid.addEventListener('click', e => {
    const b = e.target.closest('[data-mz]'); if (!b) return;
    const k = b.dataset.mz;
    if (cur === k && au && au.src) { au.paused ? resume() : pause(); } else start(k);
  });
  $('mz-prev').innerHTML = IC.prev; $('mz-next').innerHTML = IC.next; $('mz-pp').innerHTML = IC.pause;
  $('mz-pp').onclick = () => (au && au.paused ? resume() : pause());
  $('mz-prev').onclick = () => step(-1); $('mz-next').onclick = () => step(1); $('mz-x').onclick = () => stop();
  // 다른 소리가 나면 멎는다 (오프닝 등 <audio>)
  document.addEventListener('play', e => { if (au && e.target !== au && e.target.tagName === 'AUDIO') pause(); }, true);
  // 유튜브 영상(노래·따라하기·추천 음악)을 열면 멎는다
  document.addEventListener('click', e => { if (e.target.closest('[data-swv], [data-fl], [data-msong], [data-song], #opn-play, #opn-ctrl')) pause(); }, true);
  load().then(L => { if (!L) return; document.querySelectorAll('[data-min]').forEach(s => { const m = mins(s.dataset.min); if ((L[s.dataset.min] || []).length) s.textContent = `${m}분 이어 듣기`; }); });
  window.omajuMood = { pause, stop, start, get playing() { return !!(au && !au.paused); }, get cur() { return cur; } };
}
