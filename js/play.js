// 오늘 PLAY — 놀이 묶음: 소리(배경 음악·효과음), 순위, 놀이 화면 틀
import * as DB from './db.js';

const ls = { get(k, d) { try { const v = localStorage.getItem('omaju.play.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('omaju.play.' + k, JSON.stringify(v)); } catch (e) {} } };
export const store = ls;
let H = {}; // app 에서 넘겨받는 도우미: toast, modal, closeModal, esc, openGate
export function init(h) { H = h; }

// 적는 차례가 곧 화면에 보이는 차례다 (운영자 2026-10-18: 사천성 → 1 to 50 → 스도쿠 → 말모이)
export const GAMES = {
  shisen: { name: '사천성', sub: '같은 그림 <span style="white-space:nowrap">짝 잇기</span>', icon: '<span class="gi-emoji">🀄</span>' },
  num50: { name: '1 to 50', sub: '숫자 순서대로 빨리 누르기', icon: '<span class="gi-num">1·50</span>' },
  sudoku: { name: '스도쿠', sub: '9×9 숫자 퍼즐', icon: '<span class="gi-num">9×9</span>' },
  malmoi: { name: '말모이', sub: '두 글자 낱말 맞히기', icon: '<span class="gi-tiles"><i class="g"></i><i class="y"></i><i></i><i class="g"></i></span>' },
};

// ── 소리: 파일 없이 직접 만드는 잔잔한 소리 ──
let AC = null, bgmTimer = null, bgmGain = null;
const snd = { music: ls.get('music', false), fx: ls.get('fx', true) };
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(freq, t0, dur, vol = 0.12, type = 'sine', dest) {
  const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest || a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}
export function sfx(kind) {
  if (!snd.fx) return; const a = ac(); if (!a) return; const t = a.currentTime;
  if (kind === 'tap') tone(880, t, 0.08, 0.06, 'triangle');
  else if (kind === 'ok') { tone(784, t, 0.18, 0.09); tone(1175, t + 0.07, 0.25, 0.08); }
  else if (kind === 'bad') { tone(196, t, 0.22, 0.08, 'triangle'); }
  else if (kind === 'win') { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.11, 0.5, 0.09)); }
  else if (kind === 'flip') tone(660, t, 0.06, 0.05, 'triangle');
}
const PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
function bgmStart() {
  const a = ac(); if (!a || bgmTimer) return;
  bgmGain = a.createGain(); bgmGain.gain.value = 0.5; const dl = a.createDelay(); dl.delayTime.value = 0.38; const fb = a.createGain(); fb.gain.value = 0.32;
  bgmGain.connect(a.destination); bgmGain.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(a.destination);
  let step = 0;
  const tick = () => { const t = a.currentTime; const f = PENTA[(step * 3 + Math.floor(Math.random() * 3)) % PENTA.length]; tone(f, t, 1.6, 0.035, 'sine', bgmGain); if (step % 4 === 0) tone(PENTA[step % 3] / 2, t, 2.6, 0.03, 'sine', bgmGain); step++; bgmTimer = setTimeout(tick, 700 + Math.random() * 500); };
  tick();
}
function bgmStop() { clearTimeout(bgmTimer); bgmTimer = null; if (bgmGain) { try { bgmGain.disconnect(); } catch (e) {} bgmGain = null; } }
export function stopAll() { bgmStop(); }

// ── 놀이 화면 틀: 위에 [음악] [효과음] [순위], 시계 ──
export function shell(el, game, { timer = true } = {}) {
  el.innerHTML = `<div class="pl-top"><div class="pl-name"><b>${GAMES[game].name}</b><span class="pl-clock" id="pl-clock">${timer ? '0:00' : ''}</span></div>
    <div class="pl-btns"><button type="button" class="pl-b" data-snd="music" aria-pressed="${snd.music}" title="배경 음악">♪<small>음악</small></button><button type="button" class="pl-b" data-snd="fx" aria-pressed="${snd.fx}" title="효과음">🔔<small>효과음</small></button><button type="button" class="pl-b rank" data-rank="${game}">🏆<small>순위</small></button></div></div>
    <div class="pl-body" id="pl-body"></div>`;
  el.querySelectorAll('[data-snd]').forEach(b => b.onclick = () => { const k = b.dataset.snd; snd[k] = !snd[k]; ls.set(k, snd[k]); b.setAttribute('aria-pressed', snd[k]); if (k === 'music') snd.music ? bgmStart() : bgmStop(); if (k === 'fx' && snd.fx) sfx('tap'); });
  el.querySelector('[data-rank]').onclick = () => showRank(game);
  if (snd.music) { const kick = () => { bgmStart(); document.removeEventListener('pointerdown', kick); }; document.addEventListener('pointerdown', kick); }
  const clock = el.querySelector('#pl-clock'); let t0 = 0, iv = null, extra = 0;
  const T = {
    body: el.querySelector('#pl-body'),
    start() { if (iv) return; t0 = Date.now(); iv = setInterval(() => { clock.textContent = fmt(T.ms()); }, 250); },
    stop() { clearInterval(iv); iv = null; const m = T.ms(); clock.textContent = fmt(m); return m; },
    add(ms) { extra += ms; },
    ms() { return t0 ? Date.now() - t0 + extra : 0; },
    reset() { clearInterval(iv); iv = null; t0 = 0; extra = 0; clock.textContent = '0:00'; },
    running: () => !!iv,
    // 3초 세고 바로 시작 (그동안 판은 흐리게 가려서 미리 풀어 볼 수 없게)
    countdown(cb, extraMs = 0, target, local = false) {
      const cover = target || T.body; cover.classList.add('pl-hidden');
      const ov = document.createElement('div'); ov.className = 'pl-cd' + (local ? ' local' : '');
      if (local) { cover.parentElement.style.position = 'relative'; cover.parentElement.appendChild(ov); } else el.appendChild(ov);
      let n = 3; const step = () => {
        if (!document.body.contains(ov)) return;
        if (n > 0) { ov.innerHTML = `<span class="pl-cd-n">${n}</span><span class="pl-cd-t">곧 시작합니다</span>`; sfx('flip'); n--; setTimeout(step, 1000); return; }
        ov.innerHTML = '<span class="pl-cd-n go">시작합니다!</span>'; sfx('ok');
        setTimeout(() => { ov.remove(); cover.classList.remove('pl-hidden'); T.start(); if (extraMs) T.add(extraMs); if (cb) cb(); }, 450);
      };
      step();
    },
  };
  return T;
}

// ── 기준 기록: 순위표가 비어 보이지 않게 놀이마다 50명. 진짜 참여자가 50명을 넘으면 저절로 빠짐. (SEED_ON=false 로 끄기)
const SEED_ON = true, SEED_N = 50, REAL_ENOUGH = 50;
const SEED_NICKS = ['봄날햇살', '산들바람', '느티나무', '꽃길만걷자', '청춘다방', '초록대문', '해맑음', '바다향기', '달빛산책', '커피한잔',
  '은하수', '민들레홀씨', '푸른솔', '한강라이더', '단풍잎', '소나기', '라일락향', '별헤는밤', '아침이슬', '파란하늘',
  '동네왕언니', '등산대장', '낚시광', '골프사랑', '여행가방', '하모니카', '통기타', '책벌레', '꽃할매', '멋쟁이신사',
  '수국정원', '노을빛', '새벽기차', '보리밭', '장미정원', '미소천사', '우리집셰프', '텃밭농부', '자전거여행', '청포도',
  '해바라기', '들국화', '은행나무길', '매화향기', '감나무집', '찐빵좋아', '노래교실짱', '탁구왕', '바둑두는남자', '수다쟁이',
  '제주바람', '부산갈매기', '대구사과', '전주한옥', '강릉커피', '춘천닭갈비', '여수밤바다', '경주나들이', '안동하회', '남해바다'];
function srand(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const RANGE = { num50: [24000, 95000], shisen: [85000, 420000], sudoku: [260000, 1500000], malmoi: [40000, 520000] };
function seeds(game, k) {
  if (!SEED_ON) return [];
  let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) | 0;
  const R = srand(h), [lo, hi] = RANGE[game], names = SEED_NICKS.slice().sort(() => R() - 0.5).slice(0, SEED_N);
  return names.map((nick, i) => {
    const x = Math.pow((i + 0.15 + R() * 0.8) / SEED_N, 1.35), ms = Math.round(lo + (hi - lo) * x);
    if (game === 'malmoi') { const t = [2, 3, 3, 4, 4, 4, 5, 5, 6][Math.floor(R() * 9)]; return { uid: 's_' + nick, nick, score: t * 1e6 + Math.min(ms, 999999), label: `${t}번 · ${fmtKo(ms)}`, seed: true }; }
    return { uid: 's_' + nick, nick, score: ms, label: fmtKo(ms), seed: true };
  });
}
export const fmt = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const fmtKo = ms => { const s = Math.round(ms / 100) / 10; const m = Math.floor(s / 60); return (m ? m + '분 ' : '') + (s % 60).toFixed(1).replace('.0', '') + '초'; };

// 끝났을 때: 기록 저장 + 순위 안내
export async function finish(game, score, label, el) {
  const best = ls.get('best.' + game + '.' + DB.todayKey(), null);
  if (!best || score < best.score) ls.set('best.' + game + '.' + DB.todayKey(), { score, label });
  const box = document.createElement('div'); box.className = 'pl-done';
  box.innerHTML = `<p class="pl-done-t">${H.esc(label)}</p><p class="pl-done-s" id="pl-done-s">${DB.currentUser() ? '순위에 올리는 중…' : '로그인하면 오늘 순위에 오를 수 있어요.'}</p>
    <div class="pl-done-b"><button type="button" class="btn green" data-rank="${game}">순위 보기</button>${DB.currentUser() ? '' : '<button type="button" class="btn line" id="pl-login">로그인하고 순위 올리기</button>'}</div>`;
  el.appendChild(box); box.querySelector('[data-rank]').onclick = () => showRank(game);
  const lg = box.querySelector('#pl-login'); if (lg) lg.onclick = () => H.openGate('순위에 오르려면');
  setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
  if (!DB.currentUser()) return;
  try {
    const r = await DB.submitScore(game, score, label);
    const k = DB.rankKeys(game), m0 = await DB.myRank(k.day), me = withSeeds(game, k.day, m0, m0.score);
    if (me.rank) { const T = tier(me.rank, me.total); box.querySelector('#pl-done-s').innerHTML = `오늘 <b>${T.t}</b>${r && r.day ? '' : ' (오늘 더 좋은 기록이 이미 있어요)'}<br>${T.m}`; } else box.querySelector('#pl-done-s').textContent = '순위에 올렸습니다.';
  } catch (e) { box.querySelector('#pl-done-s').textContent = '순위에 올리지 못했습니다. 잠시 뒤 다시 해 주세요.'; }
}

// 몇 명 중 몇 등 대신 상위·중위·하위 % 와 한마디 (이용자 수가 드러나지 않게)
export function tier(rank, total) {
  const p = Math.max(1, Math.ceil(rank / Math.max(total, 1) * 100));
  if (rank === 1) return { t: '1등이에요!', m: '정말 대단합니다. 내일도 이 자리를 지켜 보세요 👏' };
  if (p <= 10) return { t: `상위 ${p}%`, m: '대단해요! 최상위권입니다 👏' };
  if (p <= 40) return { t: `상위 ${p}%`, m: '훌륭해요! 조금만 더 하면 최상위권이에요.' };
  if (p <= 70) return { t: '중위권', m: '좋아요! 한 판 더 하면 쑥 올라갈 거예요. 화이팅!' };
  return { t: `하위 ${Math.max(1, 101 - p)}%`, m: '오늘은 몸풀기! 내일은 더 잘하실 거예요. 화이팅!' };
}
function withSeeds(game, k, me, myScore) {
  if (me.total >= REAL_ENOUGH) return me;
  const sd = seeds(game, k); if (!sd.length) return me;
  const out = { ...me, total: me.total + sd.length };
  if (me.rank && myScore != null) out.rank = me.rank + sd.filter(x => x.score < myScore).length;
  return out;
}
// ── 순위 창: 오늘 / 이번 주, 1~50위, 내 순위 ──
export async function showRank(game, period = 'day') {
  const k = DB.rankKeys(game)[period];
  H.modal(`<h2>${GAMES[game].name} 순위</h2><div class="rk-tabs"><button type="button" data-p="day" aria-pressed="${period === 'day'}">오늘</button><button type="button" data-p="week" aria-pressed="${period === 'week'}">이번 주</button></div><div class="rk-me" id="rk-me">불러오는 중…</div><ol class="rk-list" id="rk-list"></ol><p class="rk-note">순위에는 오마주가 준비한 기준 기록이 함께 들어 있습니다.</p>`, () => {
    document.querySelectorAll('.rk-tabs [data-p]').forEach(b => b.onclick = () => showRank(game, b.dataset.p));
    document.getElementById('modal').classList.add('rank-modal');
  });
  try {
    const [real, me0] = await Promise.all([DB.topScores(k, 50), DB.myRank(k)]);
    const sd = me0.total >= REAL_ENOUGH ? [] : seeds(game, k), top = real.concat(sd).sort((a, b) => a.score - b.score).slice(0, 50);
    const me = withSeeds(game, k, me0, me0.score);
    const uid = DB.currentUser() && DB.currentUser().uid;
    const meEl = document.getElementById('rk-me'), list = document.getElementById('rk-list'); if (!meEl) return;
    const inTop = !!uid && top.some(r => r.uid === uid);
    if (me.rank) { const T = tier(me.rank, me.total); meEl.innerHTML = `<div class="rk-me-h"><b>내 순위</b><em>${T.t}</em></div><div class="rk-me-r">내 기록 ${H.esc(me.label)}</div><span class="rk-cheer">${T.m}</span>${inTop ? '<button type="button" class="rk-go" id="rk-go">순위표에서 내 자리 보기 ↓</button>' : ''}`; }
    else if (DB.currentUser()) meEl.innerHTML = `<div class="rk-me-h"><b>내 순위</b></div>아직 ${period === 'day' ? '오늘' : '이번 주'} 기록이 없어요. 한 판 해 보세요!`;
    else { meEl.innerHTML = `<div class="rk-me-h"><b>내 순위</b></div>로그인하면 내 순위를 볼 수 있어요.<button type="button" class="rk-go" id="rk-login">로그인하고 내 순위 보기</button>`; }
    list.innerHTML = (top.length ? top.map((r, i) => `<li class="${r.uid === uid ? 'me' : ''}${i < 3 ? ' top' : ''}"><span class="rk-n">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="rk-nick">${H.esc(r.nick)}${r.uid === uid ? ' <small>(나)</small>' : ''}</span><span class="rk-rec">${H.esc(r.label)}</span></li>`).join('') : '<li class="rk-empty">아직 아무도 없어요. 첫 1등이 되어 보세요!</li>')
      + (me.rank && !inTop ? `<li class="rk-gap">⋯</li><li class="me"><span class="rk-n">나</span><span class="rk-nick">${H.esc((DB.currentProfile() || {}).nick || '나')} <small>(${tier(me.rank, me.total).t})</small></span><span class="rk-rec">${H.esc(me.label)}</span></li>` : '');
    const go = document.getElementById('rk-go'); if (go) go.onclick = () => { const li = list.querySelector('li.me'); if (li) li.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    const lg = document.getElementById('rk-login'); if (lg) lg.onclick = () => { H.closeModal(); setTimeout(() => H.openGate('내 순위를 보려면'), 50); };
  } catch (e) { const meEl = document.getElementById('rk-me'); if (meEl) meEl.textContent = '순위를 불러오지 못했습니다.'; }
}

// ── 놀이 목록 ──
export function hub(el) {
  // 읽어 보기(심리 테스트)를 맨 위에 — 놀이 네 가지만 있으니 잘 안 들어오게 됐다 (대표 2026-10-23)
  el.innerHTML = `<div class="pl-hub-head"><span>TODAY PLAY</span><h2>오늘 PLAY</h2><p>가볍게 읽어 보고, 한 판 겨뤄&nbsp;보세요.</p></div>
    
    <button type="button" class="pl-feature" data-go="psy"><span class="pl-f-photo" style="background-image:url('img/psa.jpg'); background-position: center 30%"></span><span class="pl-f-txt"><span class="pl-f-kick">심리 테스트</span><b>가볍게 읽어 보는<br>요즘 마음</b><span class="pl-f-sub">프사 읽기 · 휴대폰 배경화면 · 카톡 답장 속도 · 여행 짐 싸는 법</span></span></button>
    <p class="pl-sec">놀이 · 오늘의 순위</p><div class="pl-hub">${Object.entries(GAMES).map(([k, g]) => {
    const b = ls.get('best.' + k + '.' + DB.todayKey(), null);
    return `<button type="button" class="pl-card has-photo" data-go="${k}"><span class="pl-photo" style="background-image:url('img/play-${k}.jpg')"></span><span class="pl-txt"><b>${g.name}</b><span>${g.sub}</span><em>${b ? '오늘 기록 · ' + H.esc(b.label) : '오늘 아직 안 함'}</em></span></button>`;
  }).join('')}</div>`;
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { (window.omajuNav || (h => { location.hash = h; }))(b.dataset.go); });
}
