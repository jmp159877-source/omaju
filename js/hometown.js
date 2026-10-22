// 내 고향 둘러보기 — 주소를 말하거나 적으면 그 자리 로드뷰, 그리고 '지금 그곳' 라이브캠
import * as NB from './notebook.js';  // 주소를 app.js 와 똑같이 — 다르면 수첩이 두 번 불러와져 달력이 바로 닫힌다

let H = {};            // app 에서 받는 도우미: toast, modal, closeModal, esc, store, DB
let CFG = null;        // data/hometown.json — 카카오 키와 라이브캠 목록
let kakaoReady = null; // 카카오 지도 불러오기 약속
let rv = null, rvClient = null, tab = 'road', cam = 0, region = null, lastQ = '';

export function init(h) { H = h; }

const $ = id => document.getElementById(id);
const esc = s => H.esc(String(s == null ? '' : s));

export async function load() {
  try { CFG = await (await fetch('data/hometown.json', { cache: 'no-cache' })).json(); } catch (e) { CFG = null; }
  region = H.store.get('homeRegion', null) || (CFG && CFG.cams && CFG.cams[0] && CFG.cams[0].region) || null;
  tab = H.store.get('homeTab', 'road');
  render();
}

// 카카오 지도는 쓸 때만 불러온다 (첫 화면을 무겁게 하지 않게)
function loadKakao() {
  if (kakaoReady) return kakaoReady;
  const key = CFG && CFG.kakaoJsKey;
  if (!key) return Promise.reject(new Error('키 없음'));
  kakaoReady = new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    s.onload = () => { try { window.kakao.maps.load(() => ok(window.kakao)); } catch (e) { no(new Error('안 열림')); } };
    s.onerror = () => no(new Error('못 불러옴'));
    document.head.appendChild(s);
  });
  // 한 번 실패한 약속을 쥐고 있으면, 주소 등록을 마친 뒤에도 영영 안 열린다 → 실패하면 버리고 다음에 다시 받는다
  kakaoReady.catch(() => { kakaoReady = null; const s = document.querySelector('script[src*="dapi.kakao.com"]'); if (s) s.remove(); });
  return kakaoReady;
}

function regions() { return [...new Set(((CFG && CFG.cams) || []).map(c => c.region))]; }
function camsOf(r) { return ((CFG && CFG.cams) || []).filter(c => c.region === r); }

function render() {
  const tabs = `<div class="ht-tabs" role="group" aria-label="보는 방법">
    <button type="button" data-ht="road" aria-pressed="${tab === 'road'}">로드뷰로 보기</button>
    <button type="button" data-ht="cam" aria-pressed="${tab === 'cam'}">지금 그곳</button></div>`;
  $('home-body').innerHTML = tabs + (tab === 'road' ? roadHtml() : camHtml());
  // 칸을 그리면 로드뷰가 붙어 있던 자리가 없어진다 → 쥐고 있던 것을 버려야 돌아왔을 때 다시 선다
  rv = null;
  camStopped = false;
  if (tab === 'road' && lastQ) go(lastQ, true);
  if (tab === 'cam') watchCam();
}

// ── 라이브캠은 보고 있을 때만 튼다 ──
// 다른 코너로 가거나, 다른 앱으로 넘어가거나, 화면 밖으로 밀려나면 바로 끊는다.
// (유튜브 iframe 은 숨겨도 혼자 계속 돌아간다 — 주소를 비워야 멎는다)
let camStopped = false, camWatch = null;
function stopCam() {
  const f = document.querySelector('.ht-cam iframe');
  if (!f || !f.getAttribute('src') || f.getAttribute('src') === 'about:blank') return;
  f.setAttribute('src', 'about:blank');
  camStopped = true;
}
function watchCam() {
  if (camWatch) { try { camWatch.disconnect(); } catch (e) {} camWatch = null; }
  const box = document.querySelector('.ht-cam'); if (!box) return;
  try { camWatch = new IntersectionObserver(es => es.forEach(e => { if (e.intersectionRatio < 0.3) stopCam(); }), { threshold: [0, 0.3] }); camWatch.observe(box); } catch (e) {}
}
function here() { return location.hash.slice(1) === 'home'; }
window.addEventListener('hashchange', () => { if (!here()) stopCam(); else if (camStopped && tab === 'cam') render(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCam(); });

function roadHtml() {
  const ready = !!(CFG && CFG.kakaoJsKey);
  return `<p class="ht-lead">가고 싶은 곳의 주소를 말하거나 적어 보세요. 그 자리에 서서 둘러볼 수 있습니다.</p>
  <form class="ht-form" id="ht-form">
    <input type="text" id="ht-q" inputmode="text" placeholder="예: 서울 종로구 삼청동" value="${esc(lastQ)}" autocomplete="off">
    <button type="button" class="btn line ht-mic" id="ht-mic" aria-label="말로 주소 넣기"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg><span>말하기</span></button>
    <button type="submit" class="btn green">보기</button>
  </form>
  ${ready ? `<div class="ht-view" id="ht-view"><p class="ht-empty" id="ht-empty">주소를 넣으면 여기에 길이 펼쳐집니다.</p><div id="ht-road"></div></div>
  <div class="ht-pad" id="ht-pad" hidden><button type="button" data-htm="left">◀ 왼쪽 보기</button><button type="button" data-htm="right">오른쪽 보기 ▶</button><button type="button" data-htm="go">▲ 앞으로 가기</button><button type="button" data-htm="back">▼ 뒤로 가기</button></div>
  <p class="ht-tip">화면을 손가락으로 끌면 둘러보고, 아래 단추로 방향을 돌리거나 걸어갈 수 있습니다.</p>
  <p class="note ht-by">지도·로드뷰 제공: 카카오</p>`
  : `<div class="ht-soon"><p>로드뷰는 곧 열립니다.</p><p class="note">지도 서비스 연결을 준비하고 있습니다. 그동안 <b>지금 그곳</b>에서 고향의 지금 모습을 보실 수 있습니다.</p></div>`}`;
}

// 한 채널이 여러 곳을 동시에 트는 데(GiGAeyes·펀제주)는 videoId 로 못 박고,
// 한 곳만 트는 데는 channelId 로 걸어 방송이 끊겼다 켜져도 이어지게 한다.
function camSrc(c) {
  const q = '&rel=0&playsinline=1&modestbranding=1';
  return c.videoId ? `https://www.youtube.com/embed/${encodeURIComponent(c.videoId)}?autoplay=0${q}`
                   : `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(c.channelId)}${q}`;
}

function camHtml() {
  const rs = regions();
  if (!rs.length) return `<div class="ht-soon"><p>준비 중입니다.</p></div>`;
  if (!region || !rs.includes(region)) region = rs[0];
  const list = camsOf(region);
  if (cam >= list.length) cam = 0;
  const c = list[cam];
  return `<p class="ht-lead">고향의 지금 모습입니다. 바다도, 강도, 거리도 지금 이 시간 그대로입니다.</p>
  <div class="ht-regions" role="group" aria-label="권역 고르기">${rs.map(r => `<button type="button" data-htr="${esc(r)}" aria-pressed="${r === region}">${esc(r)}</button>`).join('')}</div>
  ${list.length > 1 ? `<div class="ht-spots" role="group" aria-label="장소 고르기">${list.map((x, i) => `<button type="button" data-htc="${i}" aria-pressed="${i === cam}">${esc(x.name)}</button>`).join('')}</div>` : ''}
  ${c ? `<div class="ht-cam"><iframe src="${esc(camSrc(c))}" title="${esc(c.name)} 실시간 화면" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
  <p class="ht-cap"><b>${esc(c.name)}</b>${c.desc ? `<span>${esc(c.desc)}</span>` : ''}</p>
  <p class="note ht-by">실시간 화면 제공: ${esc(c.owner || '')} (유튜브)</p>` : ''}`;
}

async function go(q, quiet) {
  q = String(q || '').trim(); if (!q) return;
  lastQ = q;   // 앱을 닫으면 잊는다 — 다음에 열 때 지난번 동네가 남아 있으면 안 된다
  const empty = $('ht-empty'), box = $('ht-road');
  if (!box) return;
  if (empty) empty.textContent = '찾는 중입니다…';
  let kakao;
  try { kakao = await loadKakao(); }
  catch (e) {
    // 카카오가 거절하면 까닭은 거의 '이 주소가 등록 안 됨'이다 → 지금 이 화면의 주소를 그대로 보여 준다
    if (empty) empty.innerHTML = '지금은 로드뷰를 열 수 없습니다.<br><span class="note">지도 서비스에 아래 주소가 등록되어 있어야 합니다.</span><br><code class="ht-origin">' + esc(location.origin) + '</code>';
    return;
  }
  new kakao.maps.services.Geocoder().addressSearch(q, (res, st) => {
    if (st !== kakao.maps.services.Status.OK || !res.length) {
      // 주소가 아니면 장소 이름으로도 찾아 본다
      new kakao.maps.services.Places().keywordSearch(q, (r2, s2) => {
        if (s2 !== kakao.maps.services.Status.OK || !r2.length) { if (empty) empty.textContent = '그 주소를 찾지 못했습니다. 동네 이름까지 넣어 보세요. (예: 서울 종로구 삼청동)'; return; }
        show(kakao, +r2[0].y, +r2[0].x);
      });
      return;
    }
    show(kakao, +res[0].y, +res[0].x);
  });
}

function show(kakao, lat, lng) {
  const box = $('ht-road'), empty = $('ht-empty');
  const pos = new kakao.maps.LatLng(lat, lng);
  if (!rv) { rv = new kakao.maps.Roadview(box); rvClient = new kakao.maps.RoadviewClient(); }
  rvClient.getNearestPanoId(pos, 100, id => {
    if (!id) { rvClient.getNearestPanoId(pos, 500, id2 => {
      if (!id2) { if (empty) empty.textContent = '이 자리에는 로드뷰가 없습니다. 조금 더 큰 길 이름으로 해 보세요.'; return; }
      paint(id2, pos);
    }); return; }
    paint(id, pos);
  });
  function paint(id, p) { if (empty) empty.hidden = true; box.classList.add('on'); const pad = $('ht-pad'); if (pad) pad.hidden = false; rv.setPanoId(id, p); setTimeout(() => rv.relayout(), 60); H.DB.track('home_road'); }
}

// ── 큰 단추로 돌기·걷기 (운영자 2026-10-22) ──
// 카카오 로드뷰 바닥의 흰 화살표와 '동서남북' 글자가 휴대폰에서 겹쳐 잘 안 눌렸다.
// 그 화살표는 카카오가 그리는 것이라 모양을 못 바꾼다 → 로드뷰 '아래'에 우리 단추를 따로 둔다 (겹치지 않게).
// 앞으로·뒤로: 지금 보는 방향으로 몇 걸음 앞 자리에서 가장 가까운 로드뷰 사진을 찾아 옮긴다.
function step(kind) {
  if (!rv || !rvClient || !window.kakao) return;
  const kakao = window.kakao;
  let vp; try { vp = rv.getViewpoint(); } catch (e) { return; }
  if (kind === 'left' || kind === 'right') {
    vp.pan = ((vp.pan || 0) + (kind === 'left' ? -45 : 45) + 360) % 360;
    try { rv.setViewpoint(vp); } catch (e) {}
    return;
  }
  const here = rv.getPosition(), now = rv.getPanoId(), pan = vp.pan || 0;
  const deg = (pan + (kind === 'back' ? 180 : 0)) * Math.PI / 180;
  const at = d => new kakao.maps.LatLng(here.getLat() + d * Math.cos(deg) / 111320,
                                         here.getLng() + d * Math.sin(deg) / (111320 * Math.cos(here.getLat() * Math.PI / 180)));
  const tries = [14, 24, 40];
  (function next(i) {
    if (i >= tries.length) { H.toast('이쪽으로는 더 갈 길이 없습니다. 방향을 돌려 보세요.'); return; }
    const p = at(tries[i]);
    rvClient.getNearestPanoId(p, 20, id => {
      if (!id || id === now) return next(i + 1);
      rv.setPanoId(id, p);
      setTimeout(() => { try { const v2 = rv.getViewpoint(); v2.pan = pan; rv.setViewpoint(v2); } catch (e) {} }, 350);   // 걸은 뒤에도 보던 방향 그대로
    });
  })(0);
}

// ── 누르기 ──
document.addEventListener('click', e => {
  const t = e.target.closest('[data-ht]'); if (t) { tab = t.dataset.ht; H.store.set('homeTab', tab); render(); return; }
  const r = e.target.closest('[data-htr]'); if (r) { region = r.dataset.htr; cam = 0; H.store.set('homeRegion', region); render(); return; }
  const c = e.target.closest('[data-htc]'); if (c) { cam = +c.dataset.htc; render(); return; }
  const m = e.target.closest('[data-htm]'); if (m) { step(m.dataset.htm); return; }
  if (e.target.closest('#ht-mic')) {
    // 수첩과 달리 여기는 확인 화면이 없다 → 말이 끝나면 창을 닫고 바로 찾아 준다
    NB.listen(txt => { H.closeModal(); const el = $('ht-q'); if (el) el.value = txt; go(txt); });
  }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('#ht-form'); if (!f) return;
  e.preventDefault(); go(($('ht-q') || {}).value || '');
});
