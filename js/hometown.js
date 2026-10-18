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
    s.onload = () => window.kakao.maps.load(() => ok(window.kakao));
    s.onerror = () => no(new Error('못 불러옴'));
    document.head.appendChild(s);
  });
  return kakaoReady;
}

function regions() { return [...new Set(((CFG && CFG.cams) || []).map(c => c.region))]; }
function camsOf(r) { return ((CFG && CFG.cams) || []).filter(c => c.region === r); }

function render() {
  const tabs = `<div class="ht-tabs" role="group" aria-label="보는 방법">
    <button type="button" data-ht="road" aria-pressed="${tab === 'road'}">로드뷰로 보기</button>
    <button type="button" data-ht="cam" aria-pressed="${tab === 'cam'}">지금 그곳</button></div>`;
  $('home-body').innerHTML = tabs + (tab === 'road' ? roadHtml() : camHtml());
  if (tab === 'road' && lastQ) go(lastQ, true);
}

function roadHtml() {
  const ready = !!(CFG && CFG.kakaoJsKey);
  return `<p class="ht-lead">가고 싶은 곳의 주소를 말하거나 적어 보세요. 그 자리에 서서 둘러볼 수 있습니다.</p>
  <form class="ht-form" id="ht-form">
    <input type="text" id="ht-q" inputmode="text" placeholder="예: 전주시 완산구 풍남동" value="${esc(lastQ)}" autocomplete="off">
    <button type="button" class="btn line ht-mic" id="ht-mic" aria-label="말로 주소 넣기"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg><span>말하기</span></button>
    <button type="submit" class="btn green">보기</button>
  </form>
  ${ready ? `<div class="ht-view" id="ht-view"><p class="ht-empty" id="ht-empty">주소를 넣으면 여기에 길이 펼쳐집니다.</p><div id="ht-road"></div></div>
  <p class="ht-tip">화면을 손가락으로 끌면 둘러보고, 바닥의 화살표를 누르면 그 길로 걸어갑니다.</p>
  <p class="note ht-by">지도·로드뷰 제공: 카카오</p>`
  : `<div class="ht-soon"><p>로드뷰는 곧 열립니다.</p><p class="note">지도 서비스 연결을 준비하고 있습니다. 그동안 <b>지금 그곳</b>에서 고향의 지금 모습을 보실 수 있습니다.</p></div>`}`;
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
  ${c ? `<div class="ht-cam"><iframe src="https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(c.channelId)}&rel=0&playsinline=1" title="${esc(c.name)} 실시간 화면" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
  <p class="ht-cap"><b>${esc(c.name)}</b>${c.desc ? `<span>${esc(c.desc)}</span>` : ''}</p>
  <p class="note ht-by">실시간 화면 ${esc(c.owner || '')} · ${esc(c.channel || '')} (유튜브)</p>` : ''}`;
}

async function go(q, quiet) {
  q = String(q || '').trim(); if (!q) return;
  lastQ = q; H.store.set('homeQ', q);
  const empty = $('ht-empty'), box = $('ht-road');
  if (!box) return;
  if (empty) empty.textContent = '찾는 중입니다…';
  let kakao;
  try { kakao = await loadKakao(); }
  catch (e) { if (empty) empty.textContent = '지금은 로드뷰를 열 수 없습니다. 잠시 뒤에 다시 해 보세요.'; return; }
  new kakao.maps.services.Geocoder().addressSearch(q, (res, st) => {
    if (st !== kakao.maps.services.Status.OK || !res.length) {
      // 주소가 아니면 장소 이름으로도 찾아 본다
      new kakao.maps.services.Places().keywordSearch(q, (r2, s2) => {
        if (s2 !== kakao.maps.services.Status.OK || !r2.length) { if (empty) empty.textContent = '그 주소를 찾지 못했습니다. 동네 이름까지 넣어 보세요. (예: 전주시 완산구 풍남동)'; return; }
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
  function paint(id, p) { if (empty) empty.hidden = true; box.classList.add('on'); rv.setPanoId(id, p); setTimeout(() => rv.relayout(), 60); H.DB.track('home_road'); }
}

// ── 누르기 ──
document.addEventListener('click', e => {
  const t = e.target.closest('[data-ht]'); if (t) { tab = t.dataset.ht; H.store.set('homeTab', tab); render(); return; }
  const r = e.target.closest('[data-htr]'); if (r) { region = r.dataset.htr; cam = 0; H.store.set('homeRegion', region); render(); return; }
  const c = e.target.closest('[data-htc]'); if (c) { cam = +c.dataset.htc; render(); return; }
  if (e.target.closest('#ht-mic')) {
    NB.listen(txt => { const el = $('ht-q'); if (el) el.value = txt; go(txt); });
  }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('#ht-form'); if (!f) return;
  e.preventDefault(); go(($('ht-q') || {}).value || '');
});
