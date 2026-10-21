import { DEFAULT_CONTENT } from './content.js';
import * as DB from './db.js';
import * as NB from './notebook.js';
import * as RADIO from './radio.js';
import { drawCard } from './cards.js';
import * as MM from './malmoi.js';
import * as PLAY from './play.js';
// 장(章). 네 번째 값은 표지에 찍히는 번호 — 화면에 보이는 차례와 맞춘다(아이디는 그대로 둔다).
const CH = { g1: ['오늘 즐기기', '하루를 기분 좋게', 'tab-today', 1], g2: ['그때 돌아보기', '그 시절을 꺼내다', 'tab-past', 2], g5: ['앞으로 나아가기', '여행 · 관광 · 취미', 'tab-travel', 3], g3: ['나를 돌보기', '산 · 운동 · 마음 · 건강', 'tab-health', 4], g4: ['나의 수첩', '메모와 일정', 'tab-note', 5] };
let modalPushed = false, skipPop = false, exitOpen = false, reopenAfterPop = false;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('omaju.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('omaju.' + k, JSON.stringify(v)); } catch (e) {} } };
let toastT, readingBtn = null; function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800); }
const SITE = 'https://omaju.kr/';   // 앱을 vercel 주소에서 열었어도 남에게 보낼 땐 늘 omaju.kr
const TAGLINE = '— 오마주, 매일매일 펼쳐 보는 즐거움\n' + SITE;

// ── 날짜 ──
const now = new Date(), M = now.getMonth(), D = now.getDate(), Y = now.getFullYear(), WD = ['일', '월', '화', '수', '목', '금', '토'];
const TODAY = DB.todayKey(now);
$('date').textContent = `${Y}년 ${M + 1}월 ${D}일 ${WD[now.getDay()]}요일`;
try { const p = new Intl.DateTimeFormat('ko-KR-u-ca-dangi', { month: 'numeric', day: 'numeric' }).formatToParts(now); const m = p.find(x => x.type === 'month'), d = p.find(x => x.type === 'day'); if (m && d) $('lunar').textContent = `음력 ${m.value}월 ${d.value}일`; } catch (e) {}
// 철은 1일 자로 바뀐다 (운영자 2026-10-20): 3/1 봄 · 6/1 여름 · 9/1 가을 · 12/1 겨울
const SEASON = M < 2 || M === 11 ? 'winter' : M < 5 ? 'spring' : M < 8 ? 'summer' : 'autumn';
$('wx-card').style.backgroundImage = `url('img/wx-${SEASON}.jpg')`;
$('wx-card').dataset.season = SEASON;  // 봄·겨울 사진은 왼쪽이 환해서 CSS 에서 막을 더 두껍게 한다

// ── 글자 크기 ──
function applySize(b) { document.documentElement.classList.toggle('big', b); $('sizer').textContent = b ? '글자 보통' : '글자 크게'; }
applySize(store.get('big', true)); $('sizer').onclick = () => { const b = !document.documentElement.classList.contains('big'); applySize(b); store.set('big', b); };

// ── 콘텐츠 ──
let C = DEFAULT_CONTENT;
const remote = await DB.loadDaily(TODAY);
if (remote) C = Object.assign({}, DEFAULT_CONTENT, remote);
DB.bumpVisit();
DB.loadMaint().then(m => { if (m && m.on && !DB.isAdmin()) { $('maint-text').textContent = m.text || ''; $('maint').hidden = false; } });
DB.loadNotice().then(n => { if (n && n.text) { $('notice-text').textContent = n.text; $('notice').hidden = false; } });

// ── 날씨 ──
const WMO = { 0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림', 45: '안개', 48: '안개', 51: '이슬비', 53: '이슬비', 55: '이슬비', 56: '이슬비', 57: '이슬비', 61: '약한 비', 63: '비', 65: '강한 비', 66: '진눈깨비', 67: '진눈깨비', 71: '약한 눈', 73: '눈', 75: '많은 눈', 77: '싸락눈', 80: '소나기', 81: '소나기', 82: '강한 소나기', 85: '눈', 86: '많은 눈', 95: '천둥번개', 96: '천둥번개', 99: '천둥번개' };
function wxSay(t, c) { if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95) return '비 소식이 있습니다. 우산 챙기시고, 빗소리 좋은 창가에서 차 한 잔 어떠세요.'; if ((c >= 71 && c <= 77) || c === 85 || c === 86) return '눈이 옵니다. 길이 미끄러우니 천천히, 풍경은 넉넉히 즐기세요.'; if (t >= 28) return '더운 날입니다. 물 자주 드시고 한낮 볕은 잠시 피하세요.'; if (t >= 18) return '걷기 딱 좋은 날씨입니다. 가까운 길이라도 한 바퀴 돌고 오세요.'; if (t >= 8) return '아침저녁으로 쌀쌀합니다. 겉옷 하나 걸치고 나서세요.'; return '날이 찹니다. 목도리 두르고, 따뜻한 국물로 속부터 데우세요.'; }

// 날씨 그림: 맑음 해, 구름, 비, 눈, 천둥, 안개
function wxIcon(c) {
  const sun = '<circle cx="12" cy="12" r="4.2" fill="#FFD54A"/><g stroke="#FFD54A" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g>';
  const cloud = (fill, dy = 0) => `<path transform="translate(0 ${dy})" d="M7 18.5h10.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.4A3.8 3.8 0 0 0 7 18.5z" fill="${fill}"/>`;
  const sunCloud = '<circle cx="8" cy="9" r="3.4" fill="#FFD54A"/><g stroke="#FFD54A" stroke-width="1.6" stroke-linecap="round"><path d="M8 2.6v1.8M2.6 9h1.8M4.2 5.2l1.3 1.3M11.8 5.2l-1.3 1.3"/></g>' + cloud('#F4F1EA', 1);
  const rain = cloud('#DCE3E8', -3) + '<g stroke="#6FB7F0" stroke-width="1.8" stroke-linecap="round"><path d="M8.5 17.5l-1 3M12 17.5l-1 3M15.5 17.5l-1 3"/></g>';
  const snow = cloud('#DCE3E8', -3) + '<g fill="#fff"><circle cx="8" cy="19" r="1.2"/><circle cx="12" cy="20.5" r="1.2"/><circle cx="16" cy="19" r="1.2"/></g>';
  const storm = cloud('#B9C3CC', -3) + '<path d="M12.5 15.5l-2.5 4h2.2l-1.2 3.5 3.5-5h-2.2l1.2-2.5z" fill="#FFD54A"/>';
  const fog = '<g stroke="#E6E6E6" stroke-width="1.8" stroke-linecap="round"><path d="M4 9h16M6 13h12M4 17h16"/></g>';
  let g = sunCloud;
  if (c === 0 || c === 1) g = sun; else if (c === 2) g = sunCloud; else if (c === 3) g = cloud('#E6E6E6', 0); else if (c === 45 || c === 48) g = fog;
  else if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) g = rain; else if ((c >= 71 && c <= 77) || c === 85 || c === 86) g = snow; else if (c >= 95) g = storm;
  return `<svg class="wx-ic" viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">${g}</svg>`;
}
async function loadWx(lat, lon, label) {
  try {
    // open-meteo 의 기상청 모델(kma_*)은 값이 비어 와서(2026-10-16 확인) 기본 모델을 쓴다
    const q = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&timezone=Asia%2FSeoul`;
    const d = await (await fetch(q)).json();
    const c = d.current; if (!c) throw 0;
    const t = Math.round(c.temperature_2m), desc = WMO[c.weather_code] || '';
    $('wx-temp').textContent = t + '°'; $('wx-desc').textContent = desc;
    $('wx-sub').textContent = `${label} · 체감 ${Math.round(c.apparent_temperature)}° · 습도 ${Math.round(c.relative_humidity_2m)}%`;
    $('wx-say').textContent = wxSay(t, c.weather_code);
    $('wx-pill').innerHTML = wxIcon(c.weather_code) + `<span>${esc(label)}  ·  ${esc(desc)}  ${t}°</span>`;
  } catch (e) { $('wx-temp').textContent = ''; $('wx-desc').textContent = '지금은 날씨를 불러오지 못했습니다.'; $('wx-say').textContent = '오늘도 좋은 하루 보내세요.'; }
}
// 좌표 → 동네 이름 (예: 수원시 영통구). 실패하면 '내 동네'
async function placeName(la, lo) {
  try { const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=ko`); const j = await r.json(); const a = j.city || j.principalSubdivision || ''; const b = j.locality && j.locality !== a ? j.locality : ''; return [a, b].filter(Boolean).join(' ') || '내 동네'; } catch (e) { return '내 동네'; }
}
function askHere(silent) {
  if (!navigator.geolocation) { if (!silent) toast('이 기기에서는 위치를 알 수 없습니다.'); return; }
  const btn = $('wx-here'); if (!silent) { btn.textContent = '지금 계신 곳을 찾는 중…'; btn.disabled = true; }
  const done = () => { btn.textContent = '내 동네 날씨로 보기'; btn.disabled = false; };
  navigator.geolocation.getCurrentPosition(async p => { const la = p.coords.latitude, lo = p.coords.longitude; store.set('geo', [la, lo]); const name = await placeName(la, lo); store.set('geoName', name); await loadWx(la, lo, name); if (!silent) { done(); toast(name + ' 날씨로 바꿨습니다.'); } }, err => { if (!silent) done(); if (silent) return; if (err.code === 1) modal(`<h2>위치 허용이 필요합니다</h2><p>휴대폰이 위치를 알려 주지 않도록 되어 있습니다.</p><div class="steps-ios">1. 크롬 주소창 왼쪽의 <b>자물쇠(또는 ⓘ)</b>를 누르세요.<br>2. <b>권한</b> → <b>위치</b>를 "허용"으로 바꾸세요.<br>3. 이 화면으로 돌아와 다시 눌러 주세요.</div><p class="note">허용하지 않아도 가입할 때 적은 거주 지역의 날씨를 보여 드립니다.</p>`); else toast('지금은 위치를 알 수 없습니다. 잠시 뒤 다시 눌러 주세요.'); }, { timeout: 8000, maximumAge: 120000 });  // 2분 안에 잡아 둔 위치면 그대로 쓴다(빠르게)
}
// 시·도별 대표 좌표 (가입 때 적은 거주 지역으로 날씨 보기)
const REGION_XY = { '서울': [37.5665, 126.978], '경기': [37.4138, 127.5183], '인천': [37.4563, 126.7052], '부산': [35.1796, 129.0756], '대구': [35.8714, 128.6014], '광주': [35.1595, 126.8526], '대전': [36.3504, 127.3845], '울산': [35.5384, 129.3114], '세종': [36.48, 127.289], '강원': [37.8813, 127.7298], '충북': [36.6424, 127.489], '충남': [36.6588, 126.6728], '전북': [35.8242, 127.148], '전남': [34.8161, 126.4629], '경북': [36.576, 128.5056], '경남': [35.2383, 128.6924], '제주': [33.4996, 126.5312] };
// 열 때마다 '지금 있는 곳'으로 다시 맞춘다. 저장해 둔 곳을 먼저 보여 주고(화면이 비지 않게),
// 위치를 받으면 조용히 바꿔 끼운다. 이미 허용한 사람은 허용 창이 다시 뜨지 않는다.
const geo = store.get('geo', null);
if (geo) loadWx(geo[0], geo[1], store.get('geoName', '내 동네')); else loadWx(37.5665, 126.978, '서울');
let geoAt = 0;
async function refreshHere(force) {
  if (!navigator.geolocation) return;
  if (!force && Date.now() - geoAt < 10 * 60 * 1000) return;  // 10분 안에 본 적 있으면 넘어간다
  let st = 'prompt';
  try { if (navigator.permissions) st = (await navigator.permissions.query({ name: 'geolocation' })).state; } catch (e) {}
  if (st === 'denied') return;
  if (st !== 'granted' && store.get('geo', null)) return;     // 아직 허용 안 한 분께 허용 창을 거듭 띄우지 않는다
  geoAt = Date.now();
  askHere(true);
}
refreshHere(true);
// 앱을 내렸다가 다시 올려도(화면이 돌아와도) 그때 있는 곳으로 맞춘다
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshHere(false); });
window.addEventListener('pageshow', e => { if (e.persisted) refreshHere(false); });
function wxByRegion(p) { try { if (p && p.region && !store.get('outRegion', null)) { outRegion = p.region.split(' ')[0]; renderOuting(); } } catch (e) {} if (store.get('geo', null) || !p || !p.region) return; const sido = p.region.split(' ')[0], xy = REGION_XY[sido]; if (xy) loadWx(xy[0], xy[1], p.region); }
$('wx-here').onclick = () => askHere(false);

// ── 인사말 (그림 카드) ──
const cardsEl = $('cards');
const GREET = C.greetings.slice(0, 4);
// 인사 카드: 고급 문구점 편지지 6가지(사진·동물 없음). 날마다 돌아가며, 하루 4장은 서로 다른 디자인.
const CARD_DOW = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
const CARD_DATE = `${M + 1}월 ${D}일 · ${CARD_DOW}요일`;
const CARD_SEASON = M < 2 || M === 11 ? 'winter' : M < 5 ? 'spring' : M < 8 ? 'summer' : 'autumn';
const cardVar = i => ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'][(Math.floor(Date.UTC(Y, M, D) / 864e5) * 4 + i) % 6];
const CARD_ORN = { v1: '<img class="gp-leaf" src="leaf.png" alt="">', v2: '<span class="gp-foil"></span>' };
cardsEl.innerHTML = GREET.map((c, i) => { const v = cardVar(i); return `<button type="button" class="gcard paper ${v}" data-copy="${i}" data-v="${v}" aria-label="인사 카드 보내기"${v === 'v6' ? ` style="background-image:url('img/wc/${CARD_SEASON}.jpg')"` : ''}><span class="gp-date">${v === 'v6' ? `${M + 1}월 ${D}일<br>${CARD_DOW}요일` : CARD_DATE}</span>${CARD_ORN[v] || ''}<q>${esc(c).replace(/\n/g, '<br>')}</q><span class="${v === 'v4' ? 'gp-brush' : 'gp-rule'}"></span>${v === 'v3' ? '<span class="gp-seal">오마주</span>' : ''}<span class="gp-brand">Omaju</span></button>`; }).join('');
async function makeCard(i) {
  const cv = await drawCard(C.greetings[i], i, { dateText: CARD_DATE, variant: cardVar(i), season: CARD_SEASON });
  return new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
}
cardsEl.onclick = async e => {
  const b = e.target.closest('[data-copy]'); if (!b) return; const i = +b.dataset.copy; DB.bumpClick('greeting');
  toast('카드를 만드는 중입니다…');
  const blob = await makeCard(i), file = new File([blob], 'omaju-card.jpg', { type: 'image/jpeg' });
  const text = C.greetings[i].replace(/\n/g, ' ') + '\n' + TAGLINE;
  const url = URL.createObjectURL(blob), canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  modal(`<h2>인사 카드가 준비되었습니다</h2><img src="${url}" alt="" style="width:100%;max-width:260px;display:block;margin:0 auto 16px;box-shadow:0 6px 20px rgba(0,0,0,0.25)"><div class="modal-actions">${canShare ? '<button type="button" class="btn green" id="card-share">카톡으로 보내기</button>' : ''}<button type="button" class="btn line" id="card-save">사진에 저장하기</button></div>`);
  const save = () => { const a = document.createElement('a'); a.href = url; a.download = 'omaju-card.jpg'; a.click(); closeModal(); modal(`<h2>카드를 저장했습니다</h2><p style="font-size:1.1rem">휴대폰 <b>사진(갤러리)</b>에 저장되었습니다. 카톡에서 사진 보내기로 보내 주세요.</p>`); };
  $('card-save').onclick = save;
  if (canShare) $('card-share').onclick = async () => { try { await navigator.share({ files: [file], text }); closeModal(); } catch (err) { if (err.name !== 'AbortError') save(); } };
};


// 휴대폰 첫 화면 높이를 열 때 한 번만 숫자로 고정 (주소창 숨김으로 흔들리지 않게)
(function fixHero() {
  const hero = document.querySelector('.hero'); if (!hero) return; let w = 0;
  const set = () => { if (window.innerWidth > 768) { hero.style.minHeight = ''; w = 0; return; } if (window.innerWidth === w) return; w = window.innerWidth; const h = Math.max(window.innerHeight, screen.height * 0.9); hero.style.minHeight = Math.round(h * 1.28) + 'px'; const box = hero.querySelector(':scope > div:last-child'); if (box) box.style.paddingTop = Math.round(h * 0.07 + 18) + 'px'; };
  set(); window.addEventListener('resize', set); window.addEventListener('orientationchange', () => setTimeout(set, 300));
})();


// 따라오는 한 줄 메뉴는 뺐다 (운영자 2026-10-20: "스크롤 하면 상단에 고정돼 따라오는 게 눈에 거슬린다").
// 장을 옮기려면 맨 위 CONTENTS 로 올라가거나 뒤로 가기를 쓴다. 띠를 아래로 내리는 것도 해 봤는데
// '읽어 드려요' 재생 띠(.rd-bar)가 같은 자리에 깔려 서로 가린다. css 의 .tabs-mini 규칙은 남아 있다 —
// 되살릴 일이 있으면 이 자리에 다시 만들면 된다.



// ── 앞으로 나아가기: 따라하기 · 회화 · 나들이 ──
// 몸 푸는 것(나를 돌보기)과 취미로 배우는 것(앞으로 나아가기)을 나눈다
const MOVE_ORDER = ['gym', 'meditate'];
const FOLLOW_ORDER = ['sing', 'dance', 'golf', 'park'];
const cleanT = t => unent(t).replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F\u200D▶►★☆♥❤|#]/gu, ' ').replace(/\((?:[^)]*(?:이벤트|구독|무료|광고)[^)]*)\)/g, '').replace(/\[ENG\]|\[ENG SUB\]/gi, '').replace(/\s{2,}/g, ' ').replace(/\s*[\/·-]\s*$/, '').trim();
const unent = t => String(t || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function renderFollow() {
  const f = C.follow; if (!f) { const m = '<p class="note" style="margin-top:30px">오늘 영상이 준비되지 않았습니다. 내일 다시 들러 주세요.</p>'; $('follow-body').innerHTML = m; $('move-body').innerHTML = m; return; }
  flList('move-body', MOVE_ORDER, f); flList('follow-body', FOLLOW_ORDER, f);
  // 몸 풀기 카드 글씨는 index.html 에 '요가 · 명상 · 매일 10분' 으로 고정 (운영자 2026-10-19: 글씨가 밑으로 떨어졌다)
}
function flList(id, order, f) {
  $(id).innerHTML = '<div class="fl-list">' + order.filter(k => f[k]).map(k => { const it = f[k];     return `<div class="fl-item"><div class="fl-head"><b>${esc(it.name)}</b><span>${esc(it.say || '')}</span></div>${it.videoId ? `<button type="button" class="fl-thumb" data-fl="${k}" aria-label="${esc(it.name)} 영상 보기"><img loading="lazy" src="https://i.ytimg.com/vi/${esc(it.videoId)}/hqdefault.jpg" alt=""><span class="fl-play">▶</span></button><p class="fl-cap">${esc(cleanT(it.title))}${it.channel ? ' · ' + esc(unent(it.channel)) : ''}</p>` : ''}${it.videoId ? '' : `<p class="note" style="margin:10px 0 0">오늘 영상을 준비하는 중입니다. 잠시 뒤에 다시 들러 주세요.</p>`}</div>`; }).join('') + '</div>';
}
// ── 오늘의 마음 한 줄 ──
// ── 이번 주, 무엇을 볼까 (극장 · 무대 · 전시) ──
// 극장은 전국 한 벌, 무대·전시는 지역별. 지역은 나들이에서 고른 것을 그대로 쓴다.
let SHOWS = null, showTab = store.get('showTab', 'movie');
const SHOW_TABS = [['movie', '극장'], ['stage', '무대'], ['exhibit', '전시']];
function showRegions() { return SHOWS && SHOWS.regions ? Object.keys(REGION_XY).filter(r => SHOWS.regions[r]) : []; }
function renderShow() {
  const body = $('show-body'); if (!body) return;
  if (!SHOWS) { body.innerHTML = '<p class="note" style="margin-top:30px">이번 주 볼거리를 모으고 있습니다. 잠시 뒤에 다시 들러 주세요.</p>'; return; }
  const tabs = `<div class="sw-tabs" role="group" aria-label="무엇을 볼까">${SHOW_TABS.map(([k, n]) => `<button type="button" data-sw="${k}" aria-pressed="${k === showTab}">${n}</button>`).join('')}</div>`;
  let inner = '';
  if (showTab === 'movie') {
    const ms = SHOWS.movie || [];
    inner = ms.length ? '<div class="rows">' + ms.map(m => `<div class="row sw-row"><b>${esc(m.title)}</b><p class="sw-meta">${esc([m.director ? m.director + ' 감독' : '', m.cast, m.rating].filter(Boolean).join(' · '))}${m.opened ? ` <span class="nw">· ${esc(m.opened)}</span>` : ''}</p><p>${esc(m.why || '')}</p><a class="linkbtn" href="https://search.naver.com/search.naver?query=${encodeURIComponent('영화 ' + m.title)}" target="_blank" rel="noopener">상영관 찾기</a></div>`).join('') + '</div>'
      : '<p class="note" style="margin-top:24px">이번 주 극장 소식을 모으고 있습니다.</p>';
  } else {
    const rs = showRegions();
    if (!rs.length) { inner = '<p class="note" style="margin-top:24px">이번 주 소식을 모으고 있습니다.</p>'; }
    else {
      if (!rs.includes(outRegion)) outRegion = rs[0];
      const list = (SHOWS.regions[outRegion] || {})[showTab] || [];
      inner = `<div class="sw-regions" role="group" aria-label="지역 고르기">${rs.map(r => `<button type="button" data-swr="${esc(r)}" aria-pressed="${r === outRegion}">${esc(r)}</button>`).join('')}</div>`
        + (list.length ? '<div class="rows">' + list.map(x => `<div class="row sw-row"><b>${esc(x.title)}</b><p class="sw-meta">${esc(x.where || '')}${x.when ? ` <span class="nw">· ${esc(x.when)}</span>` : ''}${x.price ? ` <span class="nw">· ${esc(x.price)}</span>` : ''}</p><p>${esc(x.why || '')}</p><a class="linkbtn" href="https://search.naver.com/search.naver?query=${encodeURIComponent(x.title + ' ' + (x.where || ''))}" target="_blank" rel="noopener">자세히 · 예매</a></div>`).join('') + '</div>'
          : `<p class="note" style="margin-top:24px">${esc(outRegion)} 소식을 아직 모으는 중입니다. 다른 지역을 눌러 보세요.</p>`);
    }
  }
  body.innerHTML = tabs + inner + '<p class="note">주마다 새로 찾아 넣습니다. 가시기 전에 날짜와 남은 자리를 한 번 더 확인해 주세요.</p>';
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-sw]'); if (t) { showTab = t.dataset.sw; store.set('showTab', showTab); renderShow(); return; }
  const r = e.target.closest('[data-swr]'); if (r) { outRegion = r.dataset.swr; store.set('outRegion', outRegion); renderShow(); }
});
fetch('data/shows.json', { cache: 'no-cache' }).then(r => r.json()).then(w => {
  if (!w || !w.week) return;
  const end = new Date(w.week + 'T23:59:59+09:00'); if (end.getTime() + 8 * 864e5 < Date.now()) return; // 지난주 것은 쓰지 않음
  SHOWS = w; renderShow();
}).catch(() => {});

// ── 오늘의 한 권 ──
// 책 속 문장을 그대로 싣지 않는다(저작권). '이런 대목이 있습니다'를 우리 말로 옮긴다.
function renderBook() {
  const b = C.book;
  if (!b || !b.title) { $('book-body').innerHTML = '<p class="note" style="margin-top:30px">오늘의 한 권을 고르고 있습니다. 잠시 뒤에 다시 들러 주세요.</p>'; return; }
  const who = [b.author, b.translator ? b.translator + ' 옮김' : ''].filter(Boolean).join(' · ');
  const pub = [b.publisher, b.year].filter(Boolean).join(' · ');
  const q = encodeURIComponent(b.title + ' ' + (b.author || ''));
  $('book-body').innerHTML = `<article class="bk">
    <p class="cu-kind">${esc(b.kind || '오늘의 한 권')}</p>
    <h2 class="bk-title">${esc(b.title)}</h2>
    <p class="bk-who">${esc(who)}${pub ? `<span>${esc(pub)}</span>` : ''}</p>
    <p class="bk-blurb">${esc(b.blurb)}</p>
    ${b.scene ? `<p class="is-sub">멈추게 되는 대목</p><p class="bk-scene">${esc(b.scene)}</p>` : ''}
    ${b.why ? `<p class="bk-why">${esc(b.why)}</p>` : ''}
    <p class="is-sub">어디서 볼 수 있나</p>
    <div class="bk-go"><a class="btn line" href="https://search.kyobobook.co.kr/search?keyword=${q}" target="_blank" rel="noopener">교보문고</a><a class="btn line" href="https://www.aladin.co.kr/search/wsearchresult.aspx?SearchWord=${q}" target="_blank" rel="noopener">알라딘</a><a class="btn line" href="https://www.nl.go.kr/NL/contents/search.do?kwd=${q}" target="_blank" rel="noopener">도서관에서 찾기</a></div>
    <p class="note bk-note">책 속 문장을 그대로 옮기지 않고, 읽은 느낌을 우리 말로 적었습니다.</p>
  </article>` + svBar('book', 'book_' + TODAY, b.title);
  svSync();
}

// ── 담아 두기 ──
// 마음에 든 글을 통째로 수첩에 베껴 둔다. 담을 수 있는 코너만 단추가 붙는다(운세·그해 오늘처럼 다시 볼 값이 없는 것은 뺐다).
const SV_NAME = { mind: '마음 한 줄', body: '몸 한 가지', food: '오늘의 한 끼', book: '오늘의 한 권', quiz: '시사 상식', culture: '오늘의 문화' };
const SV_DATA = { mind: () => C.mind, body: () => C.body, food: () => C.meal, book: () => C.book, quiz: () => C.quiz, culture: () => (C.culture || {})[cuTab] };
let SAVED = new Set();
function svBar(corner, key, title, kind = '') {
  return `<div class="sv"><button type="button" class="sv-btn" data-save="${esc(corner)}" data-sk="${esc(key)}" data-st="${esc(title || '')}" data-sv="${esc(kind)}" aria-pressed="false"><span class="sv-ic" aria-hidden="true">+</span><span class="sv-tx">담아 두기</span></button></div>`;
}
function svSync() {
  document.querySelectorAll('[data-save]').forEach(b => {
    const on = SAVED.has(b.dataset.sk);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.querySelector('.sv-ic').textContent = on ? '\u2713' : '+';
    b.querySelector('.sv-tx').textContent = on ? '수첩에 담아 둠' : '담아 두기';
  });
}
window.omajuSvSync = svSync;
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-save]'); if (!b) return;
  const corner = b.dataset.save, key = b.dataset.sk;
  if (!DB.currentUser()) return openGate('마음에 든 글을 담아 두려면');
  try {
    if (SAVED.has(key)) { await DB.removeSave(key); SAVED.delete(key); toast('수첩에서 뺐습니다.'); }
    else {
      const d = (SV_DATA[corner] || (() => null))();
      if (!d) return toast('담을 내용이 아직 없습니다.');
      await DB.addSave({ key, corner, kind: b.dataset.sv || '', date: TODAY, title: b.dataset.st, data: d });
      SAVED.add(key); toast('나의 수첩에 담았습니다.');
    }
    svSync(); NB.refreshSaves();
  } catch (err) { toast(err.message || '담아 두지 못했습니다.'); }
});
DB.onUser(async u => { try { SAVED = new Set(u ? (await DB.listSaves()).map(x => x.key) : []); } catch (e) { SAVED = new Set(); } svSync(); });
window.omajuSvRemoved = k => { SAVED.delete(k); svSync(); };

function renderBody() {
  const b = C.body;
  if (!b || !b.line) { $('bd-body').innerHTML = '<p class="note" style="margin-top:30px">오늘의 몸 한 가지를 고르고 있습니다. 잠시 뒤에 다시 들러 주세요.</p>'; return; }
  if ($('body-sub')) $('body-sub').textContent = b.line.length > 30 ? b.line.slice(0, 29) + '…' : b.line;
  $('bd-body').innerHTML = `<article class="bd">
    <p class="cu-kind">오늘의 몸 한 가지${b.part ? ' · ' + esc(b.part) : ''}</p>
    <h2 class="bd-line">${esc(b.line)}</h2>
    <p class="bd-note">${esc(b.note)}</p>
    <p class="is-sub">오늘 해 볼 것</p>
    <p class="bd-todo">${esc(b.todo)}</p>
    ${b.tip ? `<p class="bd-tip">${esc(b.tip)}</p>` : ''}
    <p class="note bd-foot">몸이 보내는 신호가 평소와 다르면 미루지 말고 진료를 받아 보세요.</p>
  </article>` + svBar('body', 'body_' + TODAY, b.line);
  svSync();
}

function renderMind() {
  const m = C.mind;
  if (!m || !m.line) { $('mind-body').innerHTML = '<p class="note" style="margin-top:30px">오늘의 마음 한 줄을 다듬고 있습니다. 잠시 뒤에 다시 들러 주세요.</p>'; return; }
  if ($('mind-sub')) $('mind-sub').textContent = m.line.length > 34 ? m.line.slice(0, 33) + '…' : m.line;
  $('mind-body').innerHTML = `<div class="cu-block cu-quote"><p class="cu-kind">오늘의 마음 한 줄</p><blockquote>${esc(m.line)}</blockquote>${m.by ? `<p class="cu-by">— ${esc(m.by)}</p>` : ''}${m.note ? `<p class="is-sub">풀이</p><p class="cu-note">${esc(m.note)}</p>` : ''}${m.todo ? `<p class="is-sub">오늘 해 볼 것</p><p class="cu-note">${esc(m.todo)}</p>` : ''}</div>` + svBar('mind', 'mind_' + TODAY, m.line)
    + `<div class="mn-breath"><p class="cu-kind">숨 고르기</p><p class="mn-say" id="mn-say">단추를 누르고 동그라미에 맞춰 숨을 쉬어 보세요.</p><div class="mn-ring" id="mn-ring"><span id="mn-cnt">4</span></div><button type="button" class="btn green" id="mn-go">숨 고르기 시작</button></div>`;
  svSync();
}
// 들숨 4초 · 멈춤 4초 · 날숨 6초를 네 번. 숫자와 동그라미로만 안내한다(소리 없음).
let mnT = null;
document.addEventListener('click', e => {
  if (!e.target.closest('#mn-go')) return;
  const go = $('mn-go'), ring = $('mn-ring'), say = $('mn-say'), cnt = $('mn-cnt');
  if (mnT) { clearInterval(mnT); mnT = null; ring.className = 'mn-ring'; go.textContent = '숨 고르기 시작'; say.textContent = '단추를 누르고 동그라미에 맞춰 숨을 쉬어 보세요.'; cnt.textContent = '4'; return; }
  const steps = [['들이쉬기', 4, 'in'], ['잠시 멈추기', 4, 'hold'], ['내쉬기', 6, 'out']];
  let round = 0, si = 0, left = steps[0][1];
  const draw = () => { say.textContent = steps[si][0] + ' · ' + (round + 1) + '번째'; ring.className = 'mn-ring ' + steps[si][2]; cnt.textContent = left; };
  go.textContent = '그만하기'; draw();
  mnT = setInterval(() => {
    left--;
    if (left <= 0) { si++; if (si >= steps.length) { si = 0; round++; if (round >= 4) { clearInterval(mnT); mnT = null; ring.className = 'mn-ring'; go.textContent = '다시 하기'; say.textContent = '잘하셨습니다. 어깨가 한결 가벼워졌을 거예요.'; cnt.textContent = '✓'; return; } } left = steps[si][1]; }
    draw();
  }, 1000);
});

const LANG = { en: ['영어', 'en-US'], ja: ['일본어', 'ja-JP'], zh: ['중국어', 'zh-CN'] };
// ── 여행 회화책: 나라말 5 × 상황 6 ──
let PB = null, pbLang = store.get('pbLang', 'en'), pbScene = store.get('pbScene', 'air'), pbWarned = {};
// 여행 코너 — 회화 한 칸에 해외 골프·관광·자유여행 세 칸을 더했다 (운영자 2026-10-19)
const TRV_TABS = [['talk', '회화'], ['golf', '해외 골프'], ['tour', '해외 관광'], ['free', '자유여행']];
let TRAVEL = null, trvTab = store.get('trvTab', 'talk');

// ── 칸마다 띠 사진 (여행·산) ──
// 사진은 trip-photos 가지에 두고 여기서 읽어 온다(저장소가 무거워지지 않게). 자리는 CSS 로 미리 잡아 두어
// 사진이 늦게 와도 글이 밀리지 않는다. 없으면 그냥 글만 — 빈 칸이 보이지 않게 한다.
const PH_CDN = 'https://cdn.jsdelivr.net/gh/jmp159877-source/omaju@trip-photos/';
const PH_RAW = 'https://raw.githubusercontent.com/jmp159877-source/omaju/trip-photos/';
let TRIPPH = {};
const hasShots = list => !!(list && list.length && list.every(x => TRIPPH[(x.title || '') + '|' + (x.where || '')]));
function shotHtml(x) {
  const f = TRIPPH[(x.title || '') + '|' + (x.where || '')];
  if (!f) return '';
  return `<img class="sw-shot" src="${PH_CDN}${esc(f)}" alt="" loading="lazy" decoding="async"`
    + ` onerror="if(this.dataset.r){this.remove()}else{this.dataset.r=1;this.src='${PH_RAW}${esc(f)}'}">`;
}
fetch('data/trip_photos.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null)
  .then(j => { if (j) { TRIPPH = j; renderPhrase(); renderHike(); } }).catch(() => {});
function trvHtml(k) {
  const list = (TRAVEL && TRAVEL[k]) || [];
  // 칸마다 띠 사진 — 자리를 미리 잡아 두어(aspect-ratio) 사진이 늦게 와도 아래가 밀리지 않는다
  // 사진은 그 칸이 **다 갖춰졌을 때만** 보여 준다 — 한둘만 있으면 나머지가 빠뜨린 것처럼 보인다.
  // 다 갖춰지면 맨 위 띠 사진은 뺀다(사진이 둘씩 겹쳐 쌓이면 되레 어수선하다). (2026-10-20)
  const shots = hasShots(list);
  const band = shots ? '' : `<div class="trv-band" data-band="${k}" style="background-image:url('img/trv-${k}.jpg')" role="img" aria-label=""></div>`;
  if (!list.length) return band + '<p class="note" style="margin-top:24px">갈 만한 곳을 모으고 있습니다. 잠시 뒤에 다시 들러 주세요.</p>';
  return band + '<div class="rows" style="margin-top:20px">' + list.map(x => `<div class="row sw-row">`
    + (shots ? shotHtml(x) : '')
    + `<b>${esc(x.title)}</b>`
    + `<p class="sw-meta">${esc(x.where || '')}${x.when ? ` <span class="nw">· ${esc(x.when)}</span>` : ''}${x.cost ? ` <span class="nw">· ${esc(x.cost)}</span>` : ''}</p>`
    + `<p>${esc(x.why || '')}</p>`
    + (x.tip ? `<p class="sw-tip">${esc(x.tip)}</p>` : '')
    + `<a class="linkbtn" href="https://search.naver.com/search.naver?query=${encodeURIComponent((x.where || '') + ' ' + x.title)}" target="_blank" rel="noopener">더 찾아보기</a>`
    + `</div>`).join('') + '</div><p class="note">값과 일정은 바뀝니다. 떠나시기 전에 한 번 더 확인해 주세요.</p>';
}
fetch('data/travel.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(j => { TRAVEL = j; renderPhrase(); }).catch(() => {});
fetch('data/phrasebook.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(j => { PB = j; renderPhrase(); }).catch(() => {});
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};  // 목소리 목록을 미리 불러 둔다
function voiceFor(bcp) {
  const want = bcp.slice(0, 2).toLowerCase();
  const vs = (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(want));
  return vs.sort((a, b) => (/google|natural|neural|premium/i.test(b.name) ? 1 : 0) - (/google|natural|neural|premium/i.test(a.name) ? 1 : 0))[0] || null;
}
function pbHtml() {
  if (!PB) return '';
  const L = PB.langs.find(x => x.k === pbLang) || PB.langs[0];
  const rows = ((PB.phrases[L.k] || {})[pbScene]) || [];
  const sc = PB.scenes.find(x => x.k === pbScene) || PB.scenes[0];
  return `<div class="pb">
  <p class="cu-kind">여행 회화</p>
  <div class="pb-pick" role="group" aria-label="나라말 고르기">${PB.langs.map(x => `<button type="button" data-pbl="${x.k}" aria-pressed="${x.k === L.k}"><b>${esc(x.name)}</b><span>${esc(x.sub)}</span></button>`).join('')}</div>
  <div class="pb-scenes" role="group" aria-label="상황 고르기">${PB.scenes.map(x => `<button type="button" data-pbs="${x.k}" aria-pressed="${x.k === pbScene}">${esc(x.name)}</button>`).join('')}</div>
  <p class="pb-scene-sub">${esc(sc.name)} · ${esc(sc.sub)}</p>
  ${L.tip ? `<p class="pb-tip">${esc(L.tip)}</p>` : ''}
  <div class="pb-list">${rows.map((x, i) => `<div class="pb-row"><p class="pb-ko">${esc(x.ko)}</p><p class="pb-t" lang="${esc(L.bcp)}">${esc(x.t)}</p><p class="pb-r">${esc(x.r)}</p><div class="pb-btns"><button type="button" class="btn line" data-pb="${i}" data-rate="1">듣기</button><button type="button" class="btn line" data-pb="${i}" data-rate="0.65">천천히</button></div></div>`).join('')}</div>
  </div>`;
}
function pbSay(i, rate) {
  if (!PB || !('speechSynthesis' in window)) return toast('이 기기에서는 듣기를 쓸 수 없습니다.');
  const L = PB.langs.find(x => x.k === pbLang), x = ((PB.phrases[pbLang] || {})[pbScene] || [])[i];
  if (!L || !x) return;
  speechSynthesis.cancel();
  const v = voiceFor(L.bcp);
  if (!v && !pbWarned[pbLang]) { pbWarned[pbLang] = 1; toast(`이 휴대폰에는 ${L.name} 목소리가 없습니다. 한글 발음을 보고 읽어 보세요.`); }
  const u = new SpeechSynthesisUtterance(x.t);
  u.lang = L.bcp; u.rate = +rate; if (v) u.voice = v;
  speechSynthesis.speak(u);
  DB.track('pb_say', { lang: pbLang, scene: pbScene });
}
document.addEventListener('click', e => {
  const tv = e.target.closest('[data-trv]'); if (tv) { trvTab = tv.dataset.trv; store.set('trvTab', trvTab); renderPhrase(); return; }
  const l = e.target.closest('[data-pbl]'); if (l) { pbLang = l.dataset.pbl; store.set('pbLang', pbLang); renderPhrase(); return; }
  const c = e.target.closest('[data-pbs]'); if (c) { pbScene = c.dataset.pbs; store.set('pbScene', pbScene); renderPhrase(); return; }
  const b = e.target.closest('[data-pb]'); if (b) pbSay(+b.dataset.pb, b.dataset.rate);
});
function renderPhrase() {
  const p = C.phrase;
  const today = !p ? '' : `<h3 class="subhead">오늘의 한마디</h3><p class="lead">${p.topic ? `오늘은 <b>${esc(p.topic)}</b>. ` : ''}듣고, 소리 내어 따라 말해 보세요.</p>` + Object.keys(LANG).filter(k => p[k]).map(k => { const x = p[k]; return `<div class="ph-card"><div class="ph-lang">${LANG[k][0]}</div><p class="ph-text">${esc(x.text)}</p><p class="ph-read" id="ph-read-${k}">${(ws => ws.length > 3 && ws.every(w => w.length === 1) ? ws.map(w => `<span>${esc(w)}</span>`).join('') : ws.map(w => `<span>${esc(w)}</span>`).join(' '))(String(x.reading || '').split(/\s+/).filter(Boolean))}</p><p class="ph-mean">${esc(x.meaning || '')}</p>${x.tip ? `<p class="ph-tip">${esc(x.tip)}</p>` : ''}<div class="ph-actions"><button type="button" class="btn green" data-say="${k}" data-rate="0.9">듣기</button><button type="button" class="btn line" data-say="${k}" data-rate="0.6">천천히 듣기</button></div></div>`; }).join('');
  const tabs = `<div class="sw-tabs t4" role="group" aria-label="여행">${TRV_TABS.map(([k, n]) => `<button type="button" data-trv="${k}" aria-pressed="${k === trvTab}">${n}</button>`).join('')}</div>`;
  $('phrase-body').innerHTML = tabs + (trvTab === 'talk' ? pbHtml() + today : trvHtml(trvTab));
  $('phrase-title').textContent = '여행';
}
document.addEventListener('click', e => {
  const zf = e.target.closest('[data-zoom]'); if (zf && CULT && CULT.painting) { const p = CULT.painting; modal(`<div class="lb-wrap"><img src="${esc(p.img)}" alt="${esc(p.title)}" referrerpolicy="no-referrer"></div><p class="lb-cap"><b>${esc(p.title)}</b> · ${esc(p.artist)}, ${esc(p.year)}</p><p class="lb-tip">두 손가락으로 벌리면 더 크게 볼 수 있습니다</p>`, () => $('modal').classList.add('lightbox')); return; }
  if (e.target.id === 'hu-open') { $('hu-punch').hidden = false; e.target.hidden = true; return; } const b = e.target.closest('[data-say]'); if (!b) return; const k = b.dataset.say, x = C.phrase[k]; if (!('speechSynthesis' in window)) return toast('이 기기에서는 듣기를 쓸 수 없습니다.'); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(x.text); u.lang = LANG[k][1]; u.rate = +b.dataset.rate; const v = speechSynthesis.getVoices().filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(LANG[k][1].slice(0, 2).toLowerCase())).sort((a, b) => (/google|natural|neural|premium/i.test(b.name) ? 1 : 0) - (/google|natural|neural|premium/i.test(a.name) ? 1 : 0))[0]; if (v) u.voice = v;
  // 소리에 맞춰 한글 발음이 한 낱말씩 따라가며 칠해지게
  document.querySelectorAll('.ph-read span.on, .ph-read span.done').forEach(x => x.classList.remove('on', 'done'));
  const ws = [...document.querySelectorAll(`#ph-read-${k} span`)], rate = +b.dataset.rate; let i = -1, tm = null, byB = false;
  const mark = n => { if (n <= i || n >= ws.length) return; ws.forEach((w, j) => { w.classList.toggle('done', j < n); w.classList.toggle('on', j === n); }); i = n; };
  const est = k === 'en' ? x.text.split(/\s+/).length * 330 : x.text.replace(/[\s。、！？,.!?]/g, '').length * (k === 'ja' ? 120 : 210);
  const per = Math.max(140, est / Math.max(1, ws.length)) / rate;
  u.onstart = () => { mark(0); tm = setInterval(() => { if (!byB) mark(i + 1); }, per); };
  u.onboundary = ev => { if (ev.name && ev.name !== 'word') return; byB = true; mark(Math.min(ws.length - 1, Math.floor(ev.charIndex / Math.max(1, x.text.length) * ws.length))); };
  u.onend = u.onerror = () => { clearInterval(tm); ws.forEach(w => { w.classList.remove('on'); w.classList.add('done'); }); setTimeout(() => ws.forEach(w => w.classList.remove('done')), 1200); };
  speechSynthesis.speak(u); DB.track('phrase_listen', { lang: k }); });
let outRegion = store.get('outRegion', '서울');
function renderOuting() {
  const o = C.outing; if (!o || !Object.keys(o).length) { $('outing-tabs').innerHTML = ''; $('outing-body').innerHTML = '<p class="note" style="margin-top:30px">이번 주 소식이 준비되지 않았습니다.</p>'; return; }
  const regions = Object.keys(REGION_XY).filter(r => o[r]); if (!o[outRegion]) outRegion = regions[0];
  $('outing-tabs').innerHTML = regions.map(r => `<button type="button" data-region="${r}" aria-pressed="${r === outRegion}">${r}</button>`).join('');
  $('outing-body').innerHTML = '<div class="rows" style="margin-top:20px">' + o[outRegion].map(it => `<div class="row ot-row"><span class="ot-kind">${esc(it.kind || '나들이')}</span><b>${esc(it.title)}</b><p class="ot-meta">${esc(it.where || '')}${it.when ? ' <span class="nw">· ' + esc(it.when) + '</span>' : ''}</p><p>${esc(it.why || '')}</p><a class="linkbtn" href="https://map.naver.com/p/search/${encodeURIComponent(it.where || it.title)}" target="_blank" rel="noopener">지도에서 보기</a></div>`).join('') + '</div><p class="note">내용은 매일 아침 새로 찾아 넣습니다. 가기 전에 날짜와 시간을 한 번 더 확인해 주세요.</p>';
  $('outing-title').textContent = `${outRegion} · 이번 주말 가볼 만한 곳`;
}
$('outing-tabs').onclick = e => { const b = e.target.closest('[data-region]'); if (!b) return; outRegion = b.dataset.region; store.set('outRegion', outRegion); renderOuting(); };
// ── 오늘의 산 (나를 돌보기) ── 지역별로 주 단위로 쌓인다. 산에 가기 전 몸 챙기는 요령도 한 줄 (운영자 2026-10-19)
let HIKE = null, hikeRegion = store.get('hikeRegion', '서울');
function renderHike() {
  const body = $('hike-body'), tabs = $('hike-tabs'); if (!body || !tabs) return;
  const rs = HIKE && HIKE.regions ? Object.keys(REGION_XY).filter(r => (HIKE.regions[r] || []).length) : [];
  if (!rs.length) { tabs.innerHTML = ''; body.innerHTML = '<p class="note" style="margin-top:30px">이번 주 산길을 모으고 있습니다. 잠시 뒤에 다시 들러 주세요.</p>'; return; }
  if (!rs.includes(hikeRegion)) hikeRegion = rs[0];
  tabs.innerHTML = rs.map(r => `<button type="button" data-hkr="${esc(r)}" aria-pressed="${r === hikeRegion}">${esc(r)}</button>`).join('');
  const list = HIKE.regions[hikeRegion] || [];
  const shots = hasShots(list);
  body.innerHTML = '<div class="rows" style="margin-top:20px">' + list.map(x => `<div class="row sw-row">`
    + (shots ? shotHtml(x) : '')
    + `<b>${esc(x.title)}</b>`
    + `<p class="sw-meta">${esc(x.where || '')}${x.course ? ` <span class="nw">· ${esc(x.course)}</span>` : ''}${x.hours ? ` <span class="nw">· ${esc(x.hours)}</span>` : ''}${x.level ? ` <span class="nw">· ${esc(x.level)}</span>` : ''}</p>`
    + `<p>${esc(x.why || '')}</p>`
    + (x.care ? `<p class="sw-tip">${esc(x.care)}</p>` : '')
    + `<a class="linkbtn" href="https://map.naver.com/p/search/${encodeURIComponent(x.where || x.title)}" target="_blank" rel="noopener">지도에서 보기</a>`
    + `</div>`).join('') + '</div><p class="note">산 사정은 날씨에 따라 달라집니다. 떠나시기 전에 입산 시간과 날씨를 한 번 더 확인해 주세요.</p>';
  $('hike-title').textContent = '오늘의 산';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-hkr]'); if (!b) return;
  hikeRegion = b.dataset.hkr; store.set('hikeRegion', hikeRegion); renderHike();
});
fetch('data/hike.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(j => { HIKE = j; renderHike(); }).catch(() => {});
renderFollow(); renderPhrase(); renderOuting(); renderHike();
// 이번 주말 나들이는 주 단위로 쌓이는 data/outing.json 에서 (지역이 채워지는 대로 늘어남)
fetch('data/outing.json', { cache: 'no-cache' }).then(r => r.json()).then(w => {
  if (!w || !w.regions || !Object.keys(w.regions).length) return;
  const wk = new Date(w.week + 'T23:59:59+09:00'); if (wk.getTime() + 864e5 < Date.now()) return; // 지난 주말 것은 쓰지 않음
  C.outing = Object.assign({}, C.outing || {}, w.regions); renderOuting();
}).catch(() => {});
// 나들이 배너·상세 사진은 계절에 따라 (봄·여름·겨울 전용 사진이 오면 outing-spring.jpg 등으로 교체)
(function seasonOuting() { const m = new Date().getMonth() + 1; const pic = m >= 9 && m <= 11 ? 'outing' : m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : 'winter'; const b = document.querySelector('[data-open="outing"]'); if (b) b.style.backgroundImage = `url('img/${pic}.jpg')`; })();





// 위키 그림 사진이 안 열리면 다른 크기 → 원본 순서로 다시 시도
window.imgRetry = el => { const f = +(el.dataset.f || 0); el.dataset.f = f + 1; if (f === 0) el.src = el.src.replace(/\/\d+px-/, '/960px-'); else if (f === 1) el.src = el.src.replace(/\/thumb(\/.+?)\/[^/]+$/, '$1'); };
// ── 오늘의 문화: 시 · 그림 · 명언 ──
let CULT = null;
async function wikiImg(ref) {
  try { const [lang, title] = ref.split(/:(.+)/); const j = await (await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)).json(); const th = (j.thumbnail || {}).source || ''; return th ? { img: th.includes('/thumb/') ? th.replace(/\/\d+px-/, '/1280px-') : th, thumb: th.includes('/thumb/') ? th.replace(/\/\d+px-/, '/640px-') : th } : null; } catch (e) { return null; }
}
const CU_TABS = [['poem', '시'], ['painting', '그림'], ['quote', '명언'], ['essay', '에세이'], ['bible', '성경'], ['dharma', '법문'], ['music', '음악'], ['humor', '유머']];
// cuTab 이 null 이면 '무엇을 볼까' 고르는 화면. 하나를 고르면 그 글이 열리고, 뒤로 가기를 누르면 다시 고르는 화면으로 온다.
let cuTab = null, muGenre = store.get('muGenre', '발라드');
const MU_GENRES = ['발라드', '트로트', '댄스', '팝', '클래식'];
function dayN() { return Math.floor(Date.UTC(Y, M, D) / 86400000) + 719163; } // 서버(파이썬 toordinal)와 같은 번호
async function loadCulture() {
  let d = {}; try { d = await (await fetch('data/culture.json', { cache: 'no-cache' })).json(); } catch (e) {}
  const n = dayN(), base = { poem: d.poems && d.poems[n % d.poems.length], quote: d.quotes && d.quotes[(n * 7) % d.quotes.length], bible: d.bible && d.bible[(n * 5) % d.bible.length], dharma: d.dharma && d.dharma[(n * 3) % d.dharma.length], humor: d.humor && d.humor[(n * 11) % d.humor.length] };
  CULT = Object.assign({}, base, C.culture || {});
  if (!CULT.painting && d.paintings) { const ps = d.paintings; for (let k = 0; k < 4 && !CULT.painting; k++) { const c = ps[(n * 3 + k) % ps.length]; const im = await wikiImg(c.wiki); if (im) CULT.painting = { ...c, ...im }; } }
  renderCulture();
}
// 담아 둘 때 쓸 제목 — 갈래마다 '제목'에 해당하는 곳이 다르다
function cuTitle(c) {
  const d = (c || {})[cuTab] || {};
  return d.title || d.text || d.line || SV_NAME.culture;
}
function renderCulture() {
  const c = CULT; if (!c || !c.poem) return;
  if (!cuTab) { $('culture-body').innerHTML = cuMenuHtml(c); return; }   // 무엇을 볼까 고르는 화면
  const tabs = `<div class="cu-tabs" id="cu-tabs">${CU_TABS.map(([k, l]) => `<button type="button" data-cu="${k}" aria-pressed="${k === cuTab}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (cuTab === 'poem') { const p = c.poem; body = `<div class="cu-block"><div class="cu-poem-page" style="background-image:url('img/poem/${String(dayN() % 23 + 1).padStart(2, '0')}.jpg')"><p class="cu-kind">오늘의 시</p><h2 class="cu-title">${esc(p.title)}</h2><p class="cu-by">${esc(p.author)} · ${esc(p.year)}</p><div class="cu-poem">${esc(p.text)}</div></div>${p.bg ? `<p class="is-sub">이 시가 나온 때</p><p class="cu-note">${esc(p.bg)}</p>` : ''}${p.words && p.words.length ? `<p class="is-sub">낱말 풀이</p><dl class="cu-words">${p.words.map(w => `<dt>${esc(Array.isArray(w) ? w[0] : w.w)}</dt><dd>${esc(Array.isArray(w) ? w[1] : w.m)}</dd>`).join('')}</dl>` : ''}${p.note ? `<p class="is-sub">감상</p><p class="cu-note">${esc(p.note)}</p>` : ''}</div>`; }
  else if (cuTab === 'painting') { const p = c.painting; body = p ? `<div class="cu-block"><p class="cu-kind">오늘의 그림</p><figure class="cu-fig" data-zoom="1"><span class="cu-zoom">눌러서 크게 보기</span><img src="${esc(p.img)}" alt="${esc(p.title)}" referrerpolicy="no-referrer" onerror="imgRetry(this)"></figure><h2 class="cu-title">${esc(p.title)}</h2><p class="cu-by">${esc(p.artist)} · ${esc(p.year)}</p>${p.about ? `<p class="is-sub">작품 이야기</p><p class="cu-note">${esc(p.about)}</p>` : (p.story ? `<p class="cu-note">${esc(p.story)}</p>` : '')}${p.points && p.points.length ? `<p class="is-sub">눈여겨볼 곳</p><ol class="cu-points">${p.points.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}${p.artist_story ? `<p class="is-sub">화가 이야기</p><p class="cu-note">${esc(p.artist_story)}</p>` : ''}<p class="note" style="font-size:.8rem">그림 사진: 위키백과 (저작권이 끝난 공공 저작물)</p></div>` : '<p class="note">그림을 불러오는 중입니다.</p>'; }
  else if (cuTab === 'quote') { const q = c.quote; body = `<div class="cu-block cu-quote"><p class="cu-kind">오늘의 명언</p><blockquote>${esc(q.text)}</blockquote><p class="cu-by">— ${esc(q.who)}</p>${q.note ? `<p class="cu-note">${esc(q.note)}</p>` : ''}</div>`; }
  else if (cuTab === 'essay') { const e = c.essay; body = e ? `<div class="cu-block"><p class="cu-kind">오늘의 에세이</p><h2 class="cu-title">${esc(e.title)}</h2><div class="cu-essay">${e.paras.map(x => `<p>${esc(x)}</p>`).join('')}</div><p class="cu-by" style="text-align:right">${esc(e.by || '오마주 편집실')}</p></div>` : '<div class="cu-block"><p class="cu-kind">오늘의 에세이</p><p class="cu-note">오늘의 에세이를 다듬고 있습니다. 잠시 뒤에 다시 들러 주세요.</p></div>'; }
  else if (cuTab === 'bible') { const b = c.bible; body = b ? `<div class="cu-block cu-quote"><p class="cu-kind">오늘의 성경</p><blockquote>${esc(b.text)}</blockquote><p class="cu-by">— ${esc(b.ref)} (개역한글)</p>${b.note ? `<p class="is-sub">묵상</p><p class="cu-note">${esc(b.note)}</p>` : ''}</div>` : ''; }
  else if (cuTab === 'dharma') { const b = c.dharma; body = b ? `<div class="cu-block cu-quote"><p class="cu-kind">오늘의 법문</p><blockquote>${esc(b.text)}</blockquote><p class="cu-by">— ${esc(b.src)}</p>${b.note ? `<p class="is-sub">풀이</p><p class="cu-note">${esc(b.note)}</p>` : ''}</div>` : ''; }
  else if (cuTab === 'humor') { const h = c.humor; body = h ? `<div class="cu-block cu-humor"><p class="cu-kind">오늘의 유머 · ${esc(h.kind || '')}</p>${h.title ? `<h2 class="cu-title">${esc(h.title)}</h2>` : ''}<p class="hu-text">${esc(h.text).replace(/\n/g, '<br>')}</p><button type="button" class="btn green hu-open" id="hu-open">${h.kind === '넌센스 퀴즈' ? '정답 보기' : '그래서 어떻게 됐을까요?'}</button><p class="hu-punch" id="hu-punch" hidden>${esc(h.punch)}</p></div>` : ''; }
  else if (cuTab === 'music') { const list = musicList(muGenre); body = `<div class="cu-block"><p class="cu-kind">오늘의 음악</p><div class="genre mu-genre" id="mu-genre" style="grid-template-columns:repeat(5,1fr)">${MU_GENRES.map(g => `<button type="button" data-mu="${g}" aria-pressed="${g === muGenre}">${g}</button>`).join('')}</div><div class="rows">${list.map((s, i) => `<button type="button" class="row song-row" data-msong="${i}"><span class="song-no">${i + 1}</span><p><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></p><span class="song-play" aria-hidden="true">▶</span></button>`).join('') || '<p class="note">목록을 불러오는 중입니다.</p>'}</div></div>`; }
  $('culture-body').innerHTML = tabs + body + (SV_DATA.culture() && cuTab !== 'music' ? svBar('culture', 'culture_' + cuTab + '_' + TODAY, cuTitle(c), cuTab) : '');
  svSync();
}
// 고르는 화면: 여덟 칸에 오늘 실린 것의 제목을 미리 한 줄씩 보여 준다
const CU_PEEK = {
  poem: c => c.poem && `${c.poem.title} · ${c.poem.author}`,
  painting: c => c.painting && `${c.painting.title} · ${c.painting.artist}`,
  quote: c => c.quote && c.quote.who,
  essay: c => c.essay && c.essay.title,
  bible: c => c.bible && c.bible.ref,
  dharma: c => c.dharma && c.dharma.src,
  music: () => MU_GENRES.join(' · '),
  humor: c => c.humor && (c.humor.title || c.humor.kind),
};
function cuMenuHtml(c) {
  return `<p class="cu-lead">오늘은 무엇을 보실까요.</p>
  <div class="cu-menu">${CU_TABS.map(([k, l]) => {
    let peek = ''; try { peek = CU_PEEK[k] ? (CU_PEEK[k](c) || '') : ''; } catch (e) {}
    return `<button type="button" class="cu-pick" data-cu="${k}"><b>${l}</b>${peek ? `<span>${esc(String(peek))}</span>` : ''}</button>`;
  }).join('')}</div>`;
}
function musicList(g) { const l = (SONGS_ALL && SONGS_ALL['genre:' + g]) || []; if (!l.length) return []; const st = (dayN() * 2) % l.length; return Array.from({ length: Math.min(5, l.length) }, (_, i) => l[(st + i) % l.length]); }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-cu]'); if (t) { nav('cu-' + t.dataset.cu); DB.track('culture_tab', { tab: t.dataset.cu }); return; }
  const g = e.target.closest('[data-mu]'); if (g) { muGenre = g.dataset.mu; store.set('muGenre', muGenre); renderCulture(); return; }
  const m = e.target.closest('[data-msong]'); if (m) playFrom(musicList(muGenre), +m.dataset.msong, '오늘의 ' + muGenre);
});
loadCulture();

// ── 가요 / 팝송 ──
let genre = store.get('genre', 'kpop'), SONGS_ALL = null;
fetch('data/songs.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(j => { SONGS_ALL = j; renderSongs(); if (typeof renderCulture === 'function' && CULT) renderCulture(); }).catch(() => {});
function pickPop(yr) { return pickSongs('pop:' + yr); }
function pickSongs(key) { // 그날 자료에 노래 목록이 없을 때: data/songs.json 에서 서버와 같은 규칙으로 고름
  const l = (SONGS_ALL && SONGS_ALL[key]) || []; if (!l.length) return [];
  const start = (Math.floor((Date.now() - new Date(Y, 0, 0)) / 86400000) * 3) % l.length;
  return Array.from({ length: Math.min(10, l.length) }, (_, i) => l[(start + i) % l.length]);
}
function songList() { const e = (C.era && C.era[ago]) || {}; return genre === 'pop' ? (e.pop && e.pop.length ? e.pop : pickPop(Y - ago)) : (e.songs && e.songs.length ? e.songs : pickSongs(Y - ago)); }
function renderSongs() {
  if (!$('songs')) return; const list = songList();
  document.querySelectorAll('#genre [data-genre]').forEach(b => b.setAttribute('aria-pressed', b.dataset.genre === genre));
  $('songs').innerHTML = list.length ? `<p class="note" style="margin:22px 0 0">노래를 누르면 이 화면에서 바로 들려 드립니다.</p><div class="rows">` + list.map((s, i) => `<button type="button" class="row song-row" data-song="${i}"><span class="song-no">${i + 1}</span><p><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></p><span class="song-play" aria-hidden="true">▶</span></button>`).join('') + '</div>' : '<p class="note" style="margin-top:22px">노래 목록을 불러오는 중입니다.</p>';
}
$('genre').onclick = e => { const b = e.target.closest('[data-genre]'); if (!b) return; genre = b.dataset.genre; store.set('genre', genre); renderSongs(); };

// ── 노래 재생기: 오마주 안에서 유튜브 영상 재생 (검색 화면·추천 광고로 나가지 않음) ──
let SONGV = null;
fetch('data/song_videos.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(j => { SONGV = j; }).catch(() => { SONGV = {}; });
function playSong(i) { playFrom(songList(), i, `${Y - ago}년 ${genre === 'pop' ? '팝송' : '가요'}`); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fl]'); if (!b) return;
  const src = MOVE_ORDER.includes(b.dataset.fl) ? MOVE_ORDER : FOLLOW_ORDER;
  const order = src.filter(k => C.follow && C.follow[k] && C.follow[k].videoId), i = order.indexOf(b.dataset.fl); playFollow(order, i);
});
function playFollow(order, i) {
  if (window.omajuRadio) window.omajuRadio.pause();
  const it = C.follow[order[i]]; if (!it) return;
  modal(`<div class="pl-head"><span class="pl-no">${i + 1} / ${order.length}</span><h2>${esc(it.name)}</h2><p>${esc(unent(it.title || ''))}</p></div><div class="pl-video"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(it.videoId)}?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="${esc(it.name)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div><div class="pl-nav"><button type="button" class="btn line" id="pl-prev" ${i === 0 ? 'disabled' : ''}>이전</button><button type="button" class="btn green" id="pl-next" ${i === order.length - 1 ? 'disabled' : ''}>다음</button></div>`, () => {
    $('modal').classList.add('pl-modal');
    $('pl-prev').onclick = () => playFollow(order, i - 1); $('pl-next').onclick = () => playFollow(order, i + 1);
  });
  DB.track('follow_play', { k: order[i] });
}
function playFrom(list, i, tag) {
  if (window.omajuRadio) window.omajuRadio.pause();
  const s = list[i]; if (!s) return;
  const v = SONGV && SONGV[`${s[0]}|${s[1]}`];
  const nav = `<div class="pl-nav"><button type="button" class="btn line" id="pl-prev" ${i === 0 ? 'disabled' : ''}>이전 곡</button><button type="button" class="btn green" id="pl-next" ${i === list.length - 1 ? 'disabled' : ''}>다음 곡</button></div>`;
  const body = v && v.v
    ? `<div class="pl-video"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.v)}?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="${esc(s[0])}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
    : `<p class="note" style="margin:16px 0">이 곡은 영상을 준비하는 중입니다. 하루 이틀 안에 여기서 바로 들으실 수 있습니다.</p><a class="btn line" style="display:block;text-align:center;text-decoration:none" href="https://www.youtube.com/results?search_query=${encodeURIComponent(s[1] + ' ' + s[0])}" target="_blank" rel="noopener">유튜브에서 찾아보기</a>`;
  modal(`<div class="pl-head"><span class="pl-no">${i + 1} / ${list.length}</span><h2>${esc(s[0])}</h2><p>${esc(s[1])} · ${esc(tag)}</p></div>${body}${nav}`, () => {
    $('modal').classList.add('pl-modal');
    $('pl-prev').onclick = () => playFrom(list, i - 1, tag); $('pl-next').onclick = () => playFrom(list, i + 1, tag);
  });
  DB.track('song_play', { tag });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-song]'); if (b) playSong(+b.dataset.song); });


// ── 코너별 한마디 (운세·한 끼·시사 상식·문화) ──
const CBOX = { fortune: '오늘의 운세', food: '오늘의 한 끼', quiz: '오늘의 시사 상식', culture: '오늘의 문화' };
Object.keys(CBOX).forEach(k => { const sec = document.querySelector(`.dsec[data-k="${k}"]`); if (!sec) return; const d = document.createElement('div'); d.className = 'cbox'; d.dataset.cbox = k; d.innerHTML = `<p class="is-sub" style="margin-top:34px">한마디 나누기</p><form class="cmt-form" data-cform="${k}"><input type="text" maxlength="200" placeholder="한마디 적기"><button type="submit" class="btn green">남기기</button></form><div class="cmts" data-clist="${k}"></div>`; sec.appendChild(d); });
async function renderCbox(k) {
  const el = document.querySelector(`[data-clist="${k}"]`); if (!el) return;
  const list = await DB.listComments(TODAY, k), me = DB.currentUser();
  el.innerHTML = list.map(c => `<div class="cmt"><b>${esc(c.nick)}</b><p>${esc(c.text)}</p>${me && me.uid === c.uid ? `<button type="button" data-cdel="${c.id}" data-ck="${k}">지우기</button>` : `<button type="button" data-crep="${c.id}">신고</button>`}</div>`).join('') || '<p class="note">첫 한마디를 남겨 보세요.</p>';
}
document.addEventListener('submit', async e => { const f = e.target.closest('[data-cform]'); if (!f) return; e.preventDefault(); const k = f.dataset.cform, inp = f.querySelector('input'); if (!DB.currentUser()) return openGate('한마디를 남기려면'); try { await DB.addComment(TODAY, inp.value, k); inp.value = ''; renderCbox(k); } catch (err) { toast(err.message); } });
document.addEventListener('click', async e => { const d = e.target.closest('[data-cdel]'), r = e.target.closest('[data-crep]'); try { if (d) { await DB.deleteMyComment(d.dataset.cdel); renderCbox(d.dataset.ck); } if (r) { if (!DB.currentUser()) return openGate('신고하려면'); await DB.reportComment(r.dataset.crep); toast('신고했습니다. 확인 후 처리합니다.'); } } catch (err) { toast(err.message); } });
window.addEventListener('hashchange', () => { const k = location.hash.slice(1); if (CBOX[k]) renderCbox(k); });
if (CBOX[location.hash.slice(1)]) renderCbox(location.hash.slice(1));

PLAY.init({ toast, modal, closeModal, esc, openGate: (...a) => openGate(...a) });
NB.init({ toast, modal, closeModal, openGate });
RADIO.init({ toast });

// ── 오늘의 시세 ──
(async function market() {
  const m = await DB.loadMarket(); if (!m || !m.items || !m.items.length) return;
  const fmt = (v, u) => { if (u === '') return v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); const n = Math.round(v); if (n >= 100000000) { const eok = Math.floor(n / 100000000), man = Math.round((n % 100000000) / 10000); return `${eok}억${man ? ' ' + man.toLocaleString('ko-KR') + '만' : ''}${u}`; } if (n >= 10000000) return Math.round(n / 10000).toLocaleString('ko-KR') + '만' + u; return n.toLocaleString('ko-KR') + u; };
  const ORDER = ['코스피', '코스닥', '미국 달러', '일본 엔 (100엔)', '유로', '금 1돈', '은 1돈', '비트코인', '이더리움']; const items = [...m.items].sort((a, b) => (ORDER.indexOf(a.label) + 99) % 99 - (ORDER.indexOf(b.label) + 99) % 99);
  $('mk-grid').innerHTML = items.map(i => `<div class="mk-item"><span class="mk-l">${esc(i.label)}</span><b class="mk-v">${fmt(i.value, i.unit)}</b>${i.change == null ? '' : `<span class="mk-c ${i.change > 0 ? 'up' : i.change < 0 ? 'down' : ''}">${i.change > 0 ? '▲' : i.change < 0 ? '▼' : '－'} ${Math.abs(i.change).toFixed(2)}%</span>`}</div>`).join('');
  const t = new Date(m.updatedAt); $('mk-foot').textContent = `${t.getMonth() + 1}월 ${t.getDate()}일 ${t.getHours()}시 ${String(t.getMinutes()).padStart(2, '0')}분 기준 · 금은 한국거래소, 은은 국제 시세 환산(1돈)`;
  $('mk-sec').hidden = false;
})();

// ── 오늘의 이슈 (정치 빼고 경제·사회·스포츠·연예, 하루 네 번 갱신) ──
(async function issues() {
  const m = await DB.loadIssues(); if (!m || !m.items || m.items.length < 3) return;
  $('is-list').innerHTML = m.items.slice(0, 5).map(i => `<li class="is-item"><a href="${esc(i.url)}" target="_blank" rel="noopener"><span class="is-cat">${esc(i.cat || '')}</span><span class="is-line">${esc(i.line)}</span><span class="is-src">${esc(i.src || '')}</span></a></li>`).join('');
  const t = new Date(m.updatedAt);
  $('is-foot').textContent = `${t.getMonth() + 1}월 ${t.getDate()}일 ${t.getHours()}시 기준 · 한 줄은 오마주가 정리했습니다. 누르면 기사가 열립니다.`;
  $('is-sec').hidden = false;
})();

// ── 운세 ──
const ZO = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'].filter(z => C.fortune && C.fortune[z]); // 자축인묘 순서
let myZ = store.get('zodiac', null);
function renderZ() { $('zodiac').innerHTML = ZO.map(z => `<button type="button" data-z="${z}" aria-pressed="${myZ === z}">${z}</button>`).join(''); const f = myZ ? C.fortune[myZ] : null; if (!f) { $('fortune').textContent = '띠를 고르면 오늘의 운세가 나옵니다.'; return; }
  if (typeof f === 'string') { $('fortune').textContent = f; return; }
  const rows = [['하는 일', f.work], ['사람', f.people], ['지갑', f.money], ['조심할 것', f.care], ['해 보기', f.do]].filter(x => x[1]);
  $('fortune').innerHTML = `<span class="fo-total">${esc(f.total || '')}</span>${rows.map(([k, v]) => `<span class="fo-row${k === '조심할 것' ? ' fo-care' : ''}"><b>${k}</b>${esc(v)}</span>`).join('')}<span class="fo-lucky">${[['색', f.color], ['숫자', f.num], ['시간', f.time], ['장소', f.place]].filter(x => x[1]).map(([k, v]) => `<span><em>${k}</em>${esc(String(v))}</span>`).join('')}</span>`; }
$('zodiac').onclick = e => { const b = e.target.closest('[data-z]'); if (!b) return; myZ = b.dataset.z; store.set('zodiac', myZ); if (DB.currentUser()) DB.saveProfile({ zodiac: myZ }).catch(() => {}); renderZ(); };
renderZ();

// ── 배너 펼치기 / 안쪽 화면 ──
document.addEventListener('click', e => {
  const t = e.target.closest('[data-toggle]'); if (t) { t.classList.toggle('open'); if (t.classList.contains('open') && t.dataset.corner) DB.bumpClick(t.dataset.corner); }
  const o = e.target.closest('[data-open]'); if (o) { route.y = window.scrollY; DB.bumpClick(o.dataset.corner); nav(o.dataset.open); }
});

// ── 그해 오늘 · 노래 ──
let ago = store.get('ago', 40);
// 그날의 신문: 날짜 → 한 줄 → 지면 링크 → 분야별 헤드라인(확인된 분야만) → 그해 그곳 사진
const ERA_FIELDS = ['정치', '경제', '사회', '문화', '연예', '생활', '스포츠'];
function eraNewsHtml(yr, e) {
  const dow = WD[new Date(yr, M, D).getDay()];
  let h = `<div class="paper-head"><div class="date"><span class="nw">${yr}년 ${M + 1}월 ${D}일</span> <span class="nw">${dow}요일</span><small>그날의 신문에서</small></div>${e.mood ? `<p class="mood">${esc(e.mood)}</p>` : ''}${e.papers && e.papers.length ? `<p class="papers">그날 지면 보기 · ${e.papers.map(p => { const nm = Array.isArray(p) ? p[0] : p && p.name, u = Array.isArray(p) ? p[1] : p && p.url; return nm && u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(nm)}</a>` : ''; }).filter(Boolean).join(' · ')}</p>` : ''}</div><div class="rule"></div>`;
  for (const f of ERA_FIELDS) {
    const items = e.news.filter(i => i.field === f); if (!items.length) continue;
    h += `<section class="field"><h2 class="f-name">${f}</h2>` + items.map(i => `<article class="hl"><h3>${esc(i.headline)}</h3><p>${esc(i.summary)}</p><div class="src"><b>${esc(i.source_name || '')}</b>${i.source_url ? `<a href="${esc(i.source_url)}" target="_blank" rel="noopener">원문</a>` : ''}</div></article>`).join('') + '</section>';
  }
  // 확인된 헤드라인이 한두 개뿐인 해는 '그 무렵' 소식도 함께 (2026-10-21: 1976년이 한 줄만 보여 지면이 비었다)
  if (e.news.length < 3 && (e.facts || []).length) h += `<section class="field"><h2 class="f-name">그 무렵</h2><div class="rows">` + e.facts.map(f => f[2] ? `<figure class="era-fig"><img src="${esc(f[2])}" alt="${esc(f[0])}" loading="lazy" referrerpolicy="no-referrer" onerror="eraImgFail(this)"><figcaption><b>${esc(f[0])}</b><span>${esc(f[1])}</span></figcaption></figure>` : `<div class="row"><b>${esc(f[0])}</b><p>${esc(f[1])}</p></div>`).join('') + '</div></section>';
  h += '<p class="foot">제목과 요약은 오마주가 정리한 글입니다. 기사 원문은 출처 링크에서 보실 수 있습니다.</p>';
  const ph = e.photo;
  if (ph && ph.img) h += `<section class="place"><h2 class="f-name">그해, 그곳${ph.area ? ' · ' + esc(ph.area) : ''}</h2><figure class="ph"><button type="button" class="ph-zoom" aria-label="사진 크게 보기"><img src="${esc(ph.img)}" alt="${esc(ph.place || '')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.place').hidden=true"><span class="ph-zoom-i" aria-hidden="true">⤢</span></button><figcaption><b>${esc(ph.year || '')}${ph.place ? ' · ' + esc(ph.place) : ''}</b>${ph.caption ? `<span>${esc(ph.caption)}</span>` : ''}<small>사진 ${esc(ph.src || '')}${ph.url ? ` · <a href="${esc(ph.url)}" target="_blank" rel="noopener">원본</a>` : ''}</small></figcaption></figure></section>`;
  return h;
}
function renderEra() {
  if (!C.era[ago]) ago = [40, 30, 20, 10, 50].find(n => C.era[n]) || ago;
  const tabs = [50, 40, 30, 20, 10].filter(n => C.era[n]).map(n => `<button type="button" data-ago="${n}" aria-pressed="${ago === n}">${n}년 전</button>`).join('');
  $('tabs').innerHTML = tabs; $('tabs2').innerHTML = tabs;
  const yr = Y - ago, e = C.era[ago], memo = store.get('memo' + ago, ''); $('cat-year').textContent = yr;
  let h = e.news && e.news.length ? eraNewsHtml(yr, e) : `<p class="lead" style="margin-top:30px">${esc(e.mood)}</p><div class="rows">` + (e.facts || []).map(f => f[2] ? `<figure class="era-fig"><img src="${esc(f[2])}" alt="${esc(f[0])}" loading="lazy" referrerpolicy="no-referrer" onerror="eraImgFail(this)"><figcaption><b>${esc(f[0])}</b><span>${esc(f[1])}</span></figcaption></figure>` : `<div class="row"><b>${esc(f[0])}</b><p>${esc(f[1])}</p></div>`).join('') + '</div>';
  // 적어 둔 '나는 그때'는 고치거나 지울 수 있게
  const editing = renderEra.edit === ago; renderEra.edit = null;
  h += '<h3 class="subhead">나는 그때</h3>' + (memo && !editing ? `<div class="mine-wrap"><p class="mine">${esc(memo)}</p><div class="mine-acts"><button type="button" class="linkbtn" data-mine="edit">고치기</button><button type="button" class="linkbtn" data-mine="del">지우기</button></div></div>` : `<form class="memo" id="memo"><input type="text" id="memo-in" maxlength="60" placeholder="그해의 나는?" value="${esc(memo)}"><button type="submit" class="btn green">${memo ? '고친 내용 저장' : '남기기'}</button></form>`);
  $('era').innerHTML = h;
  renderSongs();
  if (cur) setTitle();
}
// 사진을 못 불러오면 소식 글은 남기고 사진 자리만 걷어낸다
window.eraImgFail = img => { const f = img.closest('.era-fig'); if (!f) return; const b = f.querySelector('figcaption b'), sp = f.querySelector('figcaption span'); const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<b>${b ? b.innerHTML : ''}</b><p>${sp ? sp.innerHTML : ''}</p>`; f.replaceWith(r); };
// 그해 그곳 사진 누르면 검은 바탕에 사진만 크게 (아무 데나 누르거나 뒤로 가기로 닫힘)
$('era').addEventListener('click', e => {
  const b = e.target.closest('.ph-zoom'); if (!b) return;
  const img = b.querySelector('img'); if (!img || !img.getAttribute('src')) return;
  const cap = ((b.closest('.ph') || b).querySelector('figcaption b') || {}).textContent || '';
  modal(`<div class="ph-full"><img src="${esc(img.currentSrc || img.src)}" alt="${esc(img.alt)}" referrerpolicy="no-referrer">${cap ? `<p>${esc(cap)}</p>` : ''}</div>`, () => {
    const m = $('modal'); m.classList.add('ph-modal');
    m.querySelector('.modal-box').addEventListener('click', ev => { if (!ev.target.closest('.x')) closeModal(); });
  });
});
const onTab = e => { const b = e.target.closest('[data-ago]'); if (!b) return; ago = +b.dataset.ago; store.set('ago', ago); renderEra(); };
$('tabs').onclick = onTab; $('tabs2').onclick = onTab;
document.addEventListener('click', e => { const m = e.target.closest('[data-mine]'); if (!m) return;
  if (m.dataset.mine === 'edit') { renderEra.edit = ago; renderEra(); const i = $('memo-in'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } return; }
  const acts = m.parentElement; acts.innerHTML = '<span class="mine-ask">지울까요?</span><button type="button" class="linkbtn" data-mine="del-yes">지우기</button><button type="button" class="linkbtn" data-mine="del-no">그만두기</button>'; });
document.addEventListener('click', e => { const m = e.target.closest('[data-mine="del-yes"],[data-mine="del-no"]'); if (!m) return; if (m.dataset.mine === 'del-yes') { store.set('memo' + ago, ''); toast('지웠습니다.'); } renderEra(); });
document.addEventListener('submit', e => { if (e.target.id !== 'memo') return; e.preventDefault(); const v = $('memo-in').value.trim(); if (!v) return; store.set('memo' + ago, v); renderEra(); });

// ── 한 끼 · 사연 ──
$('meal-title').textContent = C.meal.title; $('meal-sub').textContent = C.meal.sub;
$('meal').innerHTML = `<p class="lead">${esc(C.meal.lead)}</p><ul class="ing">${C.meal.ingredients.map(i => `<li>${esc(i)}</li>`).join('')}</ul><ol class="steps">${C.meal.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="note">${esc(C.meal.tip || '')}</p>` + svBar('food', 'food_' + TODAY, C.meal.title);
$('story-title').textContent = C.story.title; $('story-sub').textContent = C.story.sub;
$('story-body').innerHTML = C.story.paras.map(p => `<p class="lead">${esc(p)}</p>`).join('') + `<p class="note">— ${esc(C.story.by || '오마주 편집실')}</p>`;

const DET = { play: ['detail_malmoi', '오늘 PLAY', () => '한 판 더,<br>오늘의 순위'], malmoi: ['', '말모이', () => ''], shisen: ['', '사천성', () => ''], num50: ['', '1 to 50', () => ''], sudoku: ['', '스도쿠', () => ''], history: ['detail_history', '그해 오늘', () => `${Y - ago}년,<br>그해 오늘`], music: ['detail_music', '그 시절 노래', () => `${Y - ago}년,<br>그해의 노래`], food: ['detail_food', '오늘의 한 끼', () => esc(C.meal.title)], story: ['detail_story', '그날의 사연', () => esc(C.story.title)], fortune: ['fortune', '오늘의 운세', () => '열두 띠 운세'], culture: ['culture_detail', '오늘의 문화', () => '시 한 편,<br>그림 한 점'], follow: ['detail_follow', '오늘의 따라하기', () => '배우는 재미,<br>오늘 한 가지'], move: ['detail_move', '오늘의 몸 풀기', () => '오늘, 몸을 깨우는 시간'], mind: ['detail_culture', '오늘의 마음 한 줄', () => '숨 한 번,<br>마음 한 줄'], body: ['detail_body', '오늘의 몸 한 가지', () => esc((C.body && C.body.part) || '몸') + ',<br>오늘 한 가지'], hike: ['detail_hike', '오늘의 산', () => '이번 주,<br>걷기 좋은 산길'], book: ['detail_book', '오늘의 한 권', () => '하루에 한 권,<br>오늘은 이 책'], home: ['detail_home', '그 동네 지금', () => '그 길에 서서,<br>지금 이 시간'], phrase: ['detail_phrase', '여행', () => '해외 골프 · 관광,<br>자유여행 · 회화'], outing: ['detail_outing', '오늘의 나들이', () => '이번 주말, 어디로 갈까'], show: ['detail_show', '이번 주, 무엇을 볼까', () => '극장 · 무대 · 전시'], quiz: ['issue_detail', '오늘의 시사 상식', () => esc(C.quiz.term || '오늘의 시사 상식')] };
let cur = null;
function setTitle() { $('d-title').innerHTML = DET[cur][2](); }
// ── 아침 알림 받기 (원하는 사람만, 시간은 직접 고르기) ──
(function pushUI() {
  const btn = $('push-cta'); if (!btn) return;
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!ok && !isIOS) return;
  const get = () => store.get('push', null);
  const draw = () => { const p = get(); btn.hidden = false; btn.innerHTML = p ? `<span class="pc-ic">☀</span><span><b>아침 ${p.hour}시 알림 받는 중</b><small>시간 바꾸기 · 그만 받기</small></span>` : `<span class="pc-ic">☀</span><span><b>아침 알림 받기</b><small>매일 아침 인사 카드와 오늘 PLAY를 알려 드려요</small></span>`; };
  const open = () => {
    if (isIOS && !standalone) return modal(`<h2>아침 알림 받기</h2><p style="font-size:1.1rem;line-height:1.8">아이폰은 오마주를 <b>앱 아이콘으로 설치</b>한 뒤에 알림을 받을 수 있습니다.<br>화면 아래 <b>공유</b> 단추 → <b>홈 화면에 추가</b>를 누른 뒤, 아이콘으로 열어 다시 눌러 주세요.</p>`);
    const p = get();
    modal(`<h2>몇 시에 받을까요?</h2><p style="font-size:1.05rem;color:#555">매일 그 시간에 오늘의 인사 카드가 찾아갑니다.</p><div class="pc-hours">${[7, 8, 9].map(h => `<button type="button" class="btn ${p && p.hour === h ? 'green' : 'line'}" data-hour="${h}">아침 ${h}시</button>`).join('')}</div>${p ? '<button type="button" class="pc-stop" id="pc-stop">알림 그만 받기</button>' : ''}`, () => {
      document.querySelectorAll('[data-hour]').forEach(b => b.onclick = async () => {
        const hour = +b.dataset.hour; b.textContent = '등록하는 중…';
        try { const token = await DB.pushSubscribe(hour); store.set('push', { token, hour }); closeModal(); draw(); toast(`매일 아침 ${hour}시에 찾아가겠습니다.`); DB.track && DB.track('push_on', { hour }); }
        catch (e) { closeModal(); toast(e.message || '알림 등록에 실패했습니다.'); }
      });
      const stop = $('pc-stop'); if (stop) stop.onclick = async () => { await DB.pushUnsubscribe(p.token); store.set('push', null); closeModal(); draw(); toast('알림을 껐습니다.'); };
    });
  };
  btn.onclick = () => open(); window.openPushPicker = open;
  draw();
})();

const GAME = { malmoi: () => MM.mount($('mm-root'), { toast, esc }), shisen: async () => (await import('./games/shisen.js')).mount($('ss-root')), num50: async () => (await import('./games/num50.js')).mount($('n5-root')), sudoku: async () => (await import('./games/sudoku.js')).mount($('sd-root')) };
const gameDone = {};

// ── 화면 이동: 잡지 넘기듯 '단계'로 쌓는다 (첫 화면 0 → 장 1 → 코너 2 → 놀이 3).
// 같은 단계끼리 옮겨 다니면 쌓지 않고 바꿔 끼운다 → 몇 개를 열어 봐도 뒤로 가기는 한 단계씩 위로, 많아야 4번이면 나간다.
const NAV_GAMES = new Set(['malmoi', 'shisen', 'num50', 'sudoku']);
const CU_RE = /^cu-[a-z]+$/;   // 오늘의 문화 안쪽 (시·그림…) — 놀이와 같은 단계라 뒤로 가면 고르는 화면으로 온다
const LV = k => !k ? 0 : /^g[1-5]$/.test(k) ? 1 : (NAV_GAMES.has(k) || CU_RE.test(k)) ? 3 : 2;
const NS = [location.hash.slice(1)]; let navOurs = false, navPending = null;
function nav(h) {
  h = String(h || '').replace(/^#/, ''); const top = NS[NS.length - 1]; if (h === top) return;
  if (LV(h) > LV(top)) { NS.push(h); navOurs = true; location.hash = h; return; }
  let steps = 0; while (steps < NS.length - 1 && LV(NS[NS.length - 1 - steps]) >= LV(h)) steps++;
  if (!steps) { NS[NS.length - 1] = h; navOurs = true; location.replace('#' + h); return; }
  const base = NS[NS.length - 1 - steps]; NS.length -= steps; navPending = base === h ? null : h; navOurs = true; history.go(-steps);
}
window.omajuNav = nav;
window.addEventListener('hashchange', () => {
  const k = location.hash.slice(1);
  if (navOurs) { navOurs = false; if (navPending != null) { const h = navPending; navPending = null; if (LV(h) > LV(NS[NS.length - 1])) { NS.push(h); navOurs = true; location.hash = h; } else { NS[NS.length - 1] = h; navOurs = true; location.replace('#' + h); } } return; }
  if (NS.length > 1 && NS[NS.length - 2] === k) NS.pop(); else NS[NS.length - 1] = k; // 휴대폰 뒤로 가기
});
function route() { const k = location.hash.slice(1);
  // 오늘의 문화: #culture 는 고르는 화면, #cu-poem 처럼 뒤가 붙으면 그 글을 보는 화면
  if (k === 'culture' || CU_RE.test(k)) { const t = CU_RE.test(k) ? k.slice(3) : null; if (t !== cuTab) { cuTab = CU_TABS.some(([x]) => x === t) ? t : null; renderCulture(); } }
  cur = CU_RE.test(k) ? 'culture' : (DET[k] ? k : null);
  if (/^g[1-5]$/.test(k)) setChapter(k); else if (!cur) { const was = document.body.classList.contains('in-chapter'); setChapter(null); if (was) { route.y = null; const t = $('tabs3'); window.scrollTo(0, Math.max(0, t.getBoundingClientRect().top + window.scrollY - 80)); } }
  document.body.classList.toggle('game-mode', !!GAME[cur] || cur === 'play'); if (!GAME[cur]) PLAY.stopAll();
  if (cur === 'play') PLAY.hub($('play-root'));
  if (GAME[cur] && !gameDone[cur]) { gameDone[cur] = true; GAME[cur](); } document.body.classList.toggle('in-detail', !!cur); stopRead(); if (cur) { if (DET[cur][0]) $('d-bg').style.backgroundImage = `url('img/${DET[cur][0]}.jpg')`; $('d-tag').textContent = DET[cur][1]; setTitle(); document.querySelectorAll('.dsec').forEach(s => s.classList.toggle('on', s.dataset.k === cur)); window.scrollTo(0, 0); } else if (route.y != null) window.scrollTo(0, route.y); }
$('back').onclick = () => { const up = NS.length > 1 ? NS[NS.length - 2] : null; if (up != null && LV(up) < LV(location.hash.slice(1))) history.back(); else nav(/^g[1-5]$/.test(NS[0]) ? NS[0] : ''); };
window.addEventListener('hashchange', route);
window.addEventListener('scroll', () => document.body.classList.toggle('nav-solid', document.body.classList.contains('in-detail') && window.scrollY > 160), { passive: true });
renderEra(); renderMind(); renderBody(); renderBook(); renderShow(); route();

// ── 퀴즈 ──
$('quiz-kind').textContent = C.quiz.term ? C.quiz.term : '오늘의 ' + (C.quiz.kind || '퀴즈');
if (C.quiz.meaning) $('quiz-sub').textContent = C.quiz.meaning;
$('issue-card').innerHTML = C.quiz.term ? `<div class="is-card"><p class="cu-kind">오늘의 시사 상식</p><h2 class="is-term">${esc(C.quiz.term)}</h2><p class="is-mean">${esc(C.quiz.meaning || '')}</p><p class="is-exp">${esc(C.quiz.explain || '')}</p>${C.quiz.why ? `<p class="is-sub">요즘 자주 들리는 까닭</p><p class="is-exp">${esc(C.quiz.why)}</p>` : ''}${C.quiz.example ? `<p class="is-sub">이렇게 씁니다</p><p class="is-ex">“${esc(C.quiz.example)}”</p>` : ''}</div>` : '';
if (C.quiz.term) $('issue-card').innerHTML += svBar('quiz', 'quiz_' + TODAY, C.quiz.term);
$('quiz-q').textContent = C.quiz.question;
let pick = null;
function renderQuiz() {
  const s = store.get('quiz', { day: '', pick: null }), done = s.day === TODAY;
  if (done) pick = s.pick;
  $('opts').innerHTML = C.quiz.options.map((o, i) => `<button type="button" data-o="${i}" aria-pressed="${pick === i}" class="${done ? (i === C.quiz.answer ? 'ok' : 'no') : ''}" ${done ? 'disabled' : ''}>${i + 1}. ${esc(o)}</button>`).join('');
  $('quiz-check').disabled = done || pick == null; $('quiz-check').hidden = done;
  $('quiz-result').textContent = done ? (s.pick === C.quiz.answer ? '정답입니다.' : `아쉽습니다. 정답은 ${C.quiz.answer + 1}번입니다.`) : '';
  $('quiz-exp').hidden = !done || !!C.quiz.term; $('quiz-exp').textContent = C.quiz.explain;
}
$('opts').onclick = e => { const b = e.target.closest('[data-o]'); if (!b || b.disabled) return; pick = +b.dataset.o; renderQuiz(); };
$('quiz-check').onclick = () => { if (pick == null) return; store.set('quiz', { day: TODAY, pick }); DB.track('quiz_answer', { correct: pick === C.quiz.answer }); renderQuiz(); };
renderQuiz();

// ── 투표 · 한마디 ──
$('poll-q').textContent = C.poll.question;
function renderPoll(counts) {
  const mine = store.get('poll.' + TODAY, null), total = counts ? counts.reduce((a, b) => a + b, 0) : 0;
  $('poll').innerHTML = C.poll.options.map((o, i) => { const pct = mine != null && total ? Math.round((counts[i] || 0) * 100 / total) : null; return `<button type="button" data-p="${i}" aria-pressed="${mine === i}" ${mine != null ? 'disabled' : ''}>${pct != null ? `<i style="width:${pct}%"></i>` : ''}<span><span>${esc(o)}</span>${pct != null ? `<span>${pct}%</span>` : ''}</span></button>`; }).join('');
}
$('poll').onclick = async e => { const b = e.target.closest('[data-p]'); if (!b || b.disabled) return; const i = +b.dataset.p; store.set('poll.' + TODAY, i); renderPoll(await DB.vote(TODAY, i, C.poll.options.length)); };
DB.loadPoll(TODAY).then(renderPoll);
async function renderCmts() {
  const list = await DB.listComments(TODAY), me = DB.currentUser();
  $('cmts').innerHTML = list.map(c => `<div class="cmt"><b>${esc(c.nick)}</b><p>${esc(c.text)}</p>${me && me.uid === c.uid ? `<button type="button" data-del="${c.id}">지우기</button>` : `<button type="button" data-rep="${c.id}">신고</button>`}</div>`).join('') || '<p class="note">첫 한마디를 남겨 보세요.</p>';
}
$('cmt-form').onsubmit = async e => { e.preventDefault(); if (!DB.currentUser()) return openGate('한마디를 남기려면'); try { await DB.addComment(TODAY, $('cmt-in').value); $('cmt-in').value = ''; renderCmts(); } catch (err) { toast(err.message); } };
$('cmts').onclick = async e => { const d = e.target.closest('[data-del]'), r = e.target.closest('[data-rep]'); try { if (d) { await DB.deleteMyComment(d.dataset.del); renderCmts(); } if (r) { if (!DB.currentUser()) return openGate('신고하려면'); await DB.reportComment(r.dataset.rep); toast('신고했습니다. 확인 후 처리합니다.'); } } catch (err) { toast(err.message); } };
renderCmts();

// ── 읽어 주기 ──
const READ = { cards: () => C.greetings.join('. '), fortune: () => $('fortune').textContent, quiz: () => C.quiz.question + '. ' + C.quiz.options.map((o, i) => (i + 1) + '번, ' + o).join('. '), era: () => $('era').innerText, meal: () => C.meal.title + '. ' + C.meal.lead + ' 재료. ' + C.meal.ingredients.join(', ') + '. 만드는 법. ' + C.meal.steps.join(' '), story: () => C.story.paras.join(' ') };
// 기기에 깔린 한국어 목소리 중 가장 자연스러운 것을 고른다 (구글 > 삼성 > 나머지)
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith('ko'));
  const score = v => (/google/i.test(v.name) ? 30 : 0) + (/samsung|yuna|sora/i.test(v.name) ? 20 : 0) + (/natural|neural|premium|enhanced/i.test(v.name) ? 15 : 0) + (v.localService ? 0 : 5);
  return vs.sort((a, b) => score(b) - score(a))[0];
}
try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); } catch (e) {}
function stopRead() { try { speechSynthesis.cancel(); } catch (e) {} if (readingBtn) { readingBtn.textContent = '읽어 주기'; readingBtn.setAttribute('aria-pressed', 'false'); readingBtn = null; } }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-read]'); if (!b) return;
  if (readingBtn === b) return stopRead();
  stopRead();
  if (!('speechSynthesis' in window)) return toast('이 기기에서는 읽어 주기를 쓸 수 없습니다.');
  const u = new SpeechSynthesisUtterance(READ[b.dataset.read]()); u.lang = 'ko-KR'; u.rate = 0.95; u.pitch = 1;
  const v = pickVoice(); if (v) u.voice = v;
  u.onend = stopRead; speechSynthesis.speak(u); readingBtn = b; b.textContent = '멈추기'; b.setAttribute('aria-pressed', 'true');
});

// ── 앱 설치 · 알리기 ──
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
window.addEventListener('appinstalled', () => { DB.track('installed'); $('install-btn').hidden = true; modal(`<h2>설치되었습니다</h2><p style="font-size:1.2rem">휴대폰 <b>바탕화면</b>에서 <b>오마주</b> 아이콘을 누르면 바로 열립니다.</p><p class="note">바탕화면에 안 보이면 화면을 위로 쓸어 올려 앱 목록에서 "오마주"를 찾으세요.</p><div class="modal-actions"><button type="button" class="btn green" onclick="document.getElementById('modal-root').innerHTML=''">알겠습니다</button></div>`); });
const UA = navigator.userAgent, isIOS = /iPhone|iPad|iPod/.test(UA), inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(UA), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (standalone) $('install-btn').hidden = true;
$('install-btn').onclick = async () => {
  DB.track('install_click');
  if (inApp) return modal(`<h2>크롬으로 열어 주세요</h2><p>지금은 카톡이나 네이버 앱 안에서 열려 있어서 앱 아이콘을 설치할 수 없습니다.</p>${isIOS ? '<p>오른쪽 아래(또는 위) <b>⋯</b> 또는 <b>공유</b> 버튼을 누르고 <b>"Safari로 열기"</b>를 고르세요.</p>' : `<div class="modal-actions"><a class="btn green" style="text-align:center;text-decoration:none" href="intent://${location.host}${location.pathname}?install=1#Intent;scheme=https;package=com.android.chrome;end">크롬으로 열기</a></div>`}`);
  if (deferredPrompt) {
    modal(`<h2>앱 아이콘 설치하기</h2><p style="font-size:1.2rem">화면 <b>위쪽(또는 아래쪽)</b>에 뜨는 <b>"설치"</b> 버튼을 눌러 주세요.</p><p class="note">안 보이면 이 창을 닫고 다시 눌러 주세요.</p>`);
    const p = deferredPrompt; deferredPrompt = null;
    p.prompt(); const r = await p.userChoice;
    if (r.outcome === 'accepted') { modal(`<h2>설치하는 중입니다…</h2><p style="font-size:1.2rem">잠시만 기다려 주세요.</p>`); }
    else { closeModal(); toast('설치를 취소했습니다. 언제든 다시 누르시면 됩니다.'); }
    return;
  }
  if (isIOS) return modal(`<h2>앱 아이콘 설치하기</h2><div class="steps-ios">1. 화면 아래 가운데 <b>네모에 화살표 (공유)</b> 버튼을 누르세요.<br>2. 아래로 내려 <b>"홈 화면에 추가"</b>를 누르세요.<br>3. 오른쪽 위 <b>"추가"</b>를 누르세요.</div><p class="note">바탕화면에 오마주 아이콘이 생깁니다.</p>`);
  modal(`<h2>앱 아이콘 설치하기</h2><p>크롬 오른쪽 위 <b>⋮</b> 메뉴를 누르고 <b>"홈 화면에 추가"</b> 또는 <b>"앱 설치"</b>를 누르세요.</p><p class="note">이미 설치되어 있으면 바탕화면에서 오마주 아이콘을 찾아 주세요.</p>`);
};
if (/[?&]install=1/.test(location.search) && !standalone && !inApp) {
  history.replaceState(null, '', location.pathname);
  setTimeout(() => modal(`<h2>앱 아이콘 설치하기</h2><p style="font-size:1.2rem">크롬으로 잘 넘어왔습니다. 아래 단추를 한 번 더 누르면 설치 창이 뜹니다.</p><div class="modal-actions"><button type="button" class="btn green" onclick="document.getElementById('modal-root').innerHTML='';document.getElementById('install-btn').click()">설치하기</button></div>`), 600);
}
$('share-btn').onclick = async () => {
  const text = '매일매일, 펼쳐 보는 즐거움.\n오늘 읽을 것, 할 것, 떠날 곳까지.\n이제는, 오마주와 함께.';
  DB.track('share');
  if (navigator.share) { try { await navigator.share({ title: '오마주', text: text + '\n' + SITE }); } catch (e) {} }
  else { try { await navigator.clipboard.writeText(text + '\n' + SITE); toast('소개 글을 복사했습니다. 카톡에 붙여 넣어 보내세요.'); } catch (e) {} }
};

// ── 모달 ──
function modal(html, onReady) { const r = $('modal-root'); if (!modalPushed && !r.innerHTML) { if (skipPop) reopenAfterPop = true; else history.pushState({ m: 1 }, '', location.href); modalPushed = true; } /* 창을 닫자마자 새 창을 열면 '뒤로'가 끝난 뒤에 다시 한 칸 쌓는다 */ exitOpen = false; r.innerHTML = `<div class="modal" id="modal"><div class="modal-box"><button type="button" class="x" id="modal-x" aria-label="닫기">×</button>${html}</div></div>`; $('modal-x').onclick = closeModal; $('modal').onclick = e => { if (e.target.id === 'modal') closeModal(); }; if (onReady) onReady(); }
function closeModal() { $('modal-root').innerHTML = ''; exitOpen = false; if (modalPushed) { modalPushed = false; skipPop = true; history.back(); } }

// ── 휴대폰 뒤로 가기: 창이 떠 있으면 창만 닫고, 첫 화면에서 나갈 땐 한 번 묻기 ──
(function backGuard() {
  const here = location.pathname + location.search;
  history.replaceState({ root: 1 }, '', here);
  history.pushState({ guard: 1 }, '', here + location.hash);
  window.addEventListener('popstate', e => {
    if (skipPop) { skipPop = false; if (reopenAfterPop) { reopenAfterPop = false; history.pushState({ m: 1 }, '', location.href); } return; }
    const r = $('modal-root');
    if (r.innerHTML && modalPushed) { modalPushed = false; r.innerHTML = ''; return; }
    if (e.state && e.state.root && !location.hash) {
      // 설치한 앱은 화면이 스스로 앱을 닫을 수 없다 → '한 번 더 누르면 나감' 방식.
      // 지금 이 자리(맨 처음 칸)에서 한 번 더 뒤로 가면 휴대폰이 앱을 닫는다. 잠시 뒤 안 누르면 다시 막아 둔다.
      exitOpen = true;
      toast('뒤로 가기를 한 번 더 누르면 오마주를 나갑니다.');
      clearTimeout(window.__exitT);
      window.__exitT = setTimeout(() => { if (exitOpen && history.state && history.state.root) history.pushState({ guard: 1 }, '', here); exitOpen = false; }, 2500);
    }
  });
})();
let afterLogin = null;
function openGate(why) {
  afterLogin = null;
  modal(`<h2>오마주 회원이 되어 주세요</h2><p>${why ? why + ' 회원가입이 필요합니다. ' : ''}가입하면 한마디 나누기, 나의 수첩(메모·일정·기억할 날)을 쓸 수 있습니다. 쓰시던 카카오나 네이버로 바로 들어오실 수 있습니다.</p>
  <div class="modal-actions social"><button type="button" class="btn kakao" id="g-kakao"><span>카카오로 시작하기</span></button><button type="button" class="btn naver" id="g-naver"><span>네이버로 시작하기</span></button></div>
  <p class="note tip">가장 빠른 길입니다. 비밀번호를 따로 외우지 않으셔도 됩니다.</p>
  <div class="divider"></div>
  <div class="modal-actions"><button type="button" class="btn warm" id="g-signup">아이디로 가입하기 <span class="free">무료</span></button><button type="button" class="btn line" id="g-login">이미 가입했어요, 로그인</button></div>
  <div class="divider"></div><p class="note">매일 아침 바로 열어 보시려면</p><div class="modal-actions"><button type="button" class="btn ivory" id="g-install">앱 아이콘 설치하기</button></div>`,
  () => { $('modal').classList.add('gate-modal'); $('g-signup').onclick = openSignup; $('g-login').onclick = openLogin;
    $('g-kakao').onclick = () => { location.href = '/api/kakao-start'; };
    $('g-naver').onclick = () => { location.href = '/api/naver-start'; }; $('g-install').onclick = () => { closeModal(); $('install-btn').click(); }; });
}
// ── 카카오·네이버로 들어오기 ──
// 서버가 ?ct= 로 토큰을 들려 보낸다. 받아서 로그인하고 주소는 바로 지운다(새로고침해도 다시 안 쓰이게).
(function socialReturn() {
  const q = new URLSearchParams(location.search);
  const t = q.get('ct'), why = q.get('login');
  if (!t && !why) return;
  const clean = location.pathname + location.hash;
  history.replaceState(history.state, '', clean);
  if (why) { toast(why); return; }
  DB.loginWithToken(t).catch(() => toast('로그인에 실패했습니다. 다시 눌러 주세요.'));
})();

// 카카오·네이버로는 들어왔지만 우리 쪽 정보가 아직 없는 분 — 짧게 세 가지만 받는다.
// (카카오·네이버가 주는 것은 회원 번호와 별명뿐이다. 태어난 해는 '그해 오늘'·'그 시절 노래'가 쓰므로 꼭 필요하다.)
DB.onNeedProfile(async () => {
  const h = await DB.socialHint();
  const where = h.via === 'naver' ? '네이버' : '카카오';
  const years = Array.from({ length: new Date().getFullYear() - 14 - 1925 + 1 }, (_, i) => 1925 + i).reverse();
  modal(`<h2>거의 다 됐습니다</h2><p>${where}로 들어오셨습니다. 세 가지만 알려 주시면 끝납니다.</p>
  <div class="field"><label>별명</label><input id="f-nick" maxlength="12" value="${esc(h.nick || '')}" placeholder="예: 강남 멋쟁이"><div class="hint">글을 쓸 때 보이는 이름입니다.</div></div>
  <div class="field"><label>성별</label><div class="seg2" id="f-gender"><button type="button" data-g="남">남성</button><button type="button" data-g="여">여성</button></div></div>
  <div class="field"><label>태어난 해</label><select id="f-birth"><option value="">태어난 해를 고르세요</option>${years.map(y => `<option value="${y}">${y}년생</option>`).join('')}</select><div class="hint">그해 오늘·그 시절 노래를 고르는 데 씁니다.</div></div>
  <label class="chk"><input type="checkbox" id="f-terms"><span>(필수) <b>이용약관</b>과 <b>개인정보처리방침</b>에 동의합니다. <a href="terms.html" target="_blank">약관</a> · <a href="privacy.html" target="_blank">처리방침</a></span></label>
  <div class="modal-actions"><button type="button" class="btn warm" id="f-go">시작하기</button></div><div class="msg" id="f-msg"></div>`,
  () => {
    let g = '';
    $('f-gender').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; g = b.dataset.g; [...$('f-gender').children].forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
    $('f-go').onclick = async () => {
      if (!$('f-terms').checked) { $('f-msg').textContent = '약관에 동의해 주세요.'; return; }
      $('f-go').disabled = true;
      try {
        await DB.finishSocial({ nick: $('f-nick').value, gender: g, birthYear: +$('f-birth').value });
        closeModal(); toast('오마주에 오신 것을 환영합니다.');
      } catch (e) { $('f-msg').textContent = e.message; $('f-go').disabled = false; }
    };
    // 끝내지 않고 창을 닫으면 어중간하게 남으므로 로그인을 풀어 둔다
    $('modal-x').onclick = () => { DB.logout(); closeModal(); };
  });
});

const REGIONS = { '서울': ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'], '경기': ['수원', '성남', '고양', '용인', '부천', '안산', '안양', '남양주', '화성', '평택', '의정부', '시흥', '파주', '김포', '광명', '광주', '군포', '하남', '오산', '양주', '이천', '구리', '안성', '포천', '의왕', '여주', '양평', '동두천', '과천', '가평', '연천'], '인천': ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'], '부산': ['중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'], '대구': ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'], '광주': ['동구', '서구', '남구', '북구', '광산구'], '대전': ['동구', '중구', '서구', '유성구', '대덕구'], '울산': ['중구', '남구', '동구', '북구', '울주군'], '세종': ['세종'], '강원': ['춘천', '원주', '강릉', '동해', '태백', '속초', '삼척', '홍천', '횡성', '영월', '평창', '정선', '철원', '화천', '양구', '인제', '고성', '양양'], '충북': ['청주', '충주', '제천', '보은', '옥천', '영동', '증평', '진천', '괴산', '음성', '단양'], '충남': ['천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', '금산', '부여', '서천', '청양', '홍성', '예산', '태안'], '전북': ['전주', '군산', '익산', '정읍', '남원', '김제', '완주', '진안', '무주', '장수', '임실', '순창', '고창', '부안'], '전남': ['목포', '여수', '순천', '나주', '광양', '담양', '곡성', '구례', '고흥', '보성', '화순', '장흥', '강진', '해남', '영암', '무안', '함평', '영광', '장성', '완도', '진도', '신안'], '경북': ['포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산', '의성', '청송', '영양', '영덕', '청도', '고령', '성주', '칠곡', '예천', '봉화', '울진', '울릉'], '경남': ['창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '의령', '함안', '창녕', '고성', '남해', '하동', '산청', '함양', '거창', '합천'], '제주': ['제주시', '서귀포시'] };
function openSignup() {
  modal(`<h2>간편 회원가입</h2>
  <div class="field"><label>아이디</label><div class="in"><input id="s-id" autocomplete="username" inputmode="latin" placeholder="예: abc1234" maxlength="12"><button type="button" class="btn line" id="s-id-chk">중복 확인</button></div><div class="hint">영어 소문자 + 숫자 조합, 4~12자 <span style="white-space:nowrap">(예: abc1234)</span></div><div class="msg" id="s-id-msg"></div></div>
  <div class="field"><label>비밀번호</label><input id="s-pw" type="password" inputmode="numeric" placeholder="숫자 6개" maxlength="6" autocomplete="new-password"><div class="hint">숫자 6자리</div></div>
  <div class="field"><label>별명</label><div class="in"><input id="s-nick" placeholder="예: 강남 멋쟁이" maxlength="12"><button type="button" class="btn line" id="s-nick-chk">중복 확인</button></div><div class="hint">글을 쓸 때 보이는 이름</div><div class="msg" id="s-nick-msg"></div></div>
  <div class="field"><label>연락처</label><input id="s-phone" type="tel" inputmode="tel" placeholder="010-1234-5678" maxlength="13"><div class="hint">아이디나 비밀번호를 잊으셨을 때 찾는 데 필요합니다.</div></div>
  <div class="field"><label>성별</label><div class="seg2" id="s-gender"><button type="button" data-g="남">남성</button><button type="button" data-g="여">여성</button></div></div>
  <div class="field"><label>태어난 해</label><select id="s-birth"><option value="">태어난 해를 고르세요</option>${Array.from({ length: new Date().getFullYear() - 14 - 1925 + 1 }, (_, i) => 1925 + i).map(y => `<option value="${y}">${y}년생</option>`).join('')}</select><div class="hint">나이에 맞는 소식을 고르는 데만 씁니다.</div></div>
  <label class="chk"><input type="checkbox" id="s-terms"><span>(필수) <b>이용약관</b>에 동의합니다. 무단 복제·비방·광고 글은 예고 없이 지워지고 탈퇴 처리될 수 있습니다. <a href="terms.html" target="_blank">약관 보기</a></span></label>
  <label class="chk"><input type="checkbox" id="s-agree"><span>(필수) 개인정보 수집에 동의합니다. 아이디·비밀번호 찾기와 서비스 안내에만 쓰고, 다른 곳에 주지 않습니다. <a href="privacy.html" target="_blank">자세히</a></span></label>
  <label class="chk"><input type="checkbox" id="s-mkt"><span>(선택) 매일 아침 오마주 소식을 <b>알림</b>으로 받겠습니다.</span></label>
  <div class="modal-actions"><button type="button" class="btn green" id="s-go">가입하기</button></div><div class="err-box" id="s-err" hidden></div>`,
  () => {
    let gender = ''; $('s-gender').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; gender = b.dataset.g; $('s-gender').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); };
    $('s-phone').oninput = e => { let v = e.target.value.replace(/\D/g, '').slice(0, 11); if (v.length > 7) v = v.slice(0, 3) + '-' + v.slice(3, 7) + '-' + v.slice(7); else if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3); e.target.value = v; };
    $('s-id').oninput = e => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''); $('s-id-msg').textContent = ''; };
    $('s-id-chk').onclick = async () => { const u = $('s-id').value; const m = $('s-id-msg'); if (!DB.validUsername(u)) { m.className = 'msg err'; m.textContent = '영문 소문자와 숫자로 4~12자입니다.'; return; } m.className = 'msg'; m.textContent = '확인 중…'; const t = await DB.usernameTaken(u); m.className = 'msg ' + (t ? 'err' : 'ok'); m.textContent = t ? '이미 있는 아이디입니다. 다른 아이디를 넣어 주세요.' : '사용할 수 있습니다.'; };
    $('s-nick-chk').onclick = async () => { const n = $('s-nick').value.trim(); const m = $('s-nick-msg'); if (n.length < 2) { m.className = 'msg err'; m.textContent = '2자 이상 적어 주세요.'; return; } m.className = 'msg'; m.textContent = '확인 중…'; const t = await DB.nicknameTaken(n); if (t) { const s = await DB.suggestNick(n); m.className = 'msg err'; m.innerHTML = `이미 있는 별명입니다. "<b>${esc(s)}</b>"는 어떠세요? <button type="button" class="linkbtn" id="s-nick-use">이걸로 할게요</button>`; $('s-nick-use').onclick = () => { $('s-nick').value = s; m.className = 'msg ok'; m.textContent = '사용할 수 있습니다.'; }; } else { m.className = 'msg ok'; m.textContent = '사용할 수 있습니다.'; } };
    $('s-go').onclick = async () => {
      const err = $('s-err'); err.hidden = true;
      if (!gender) { err.textContent = '성별을 골라 주세요.'; err.hidden = false; return; }
      if (!$('s-birth').value) { err.textContent = '태어난 해를 골라 주세요.'; err.hidden = false; return; }
      if (!$('s-terms').checked) { err.textContent = '이용약관 동의에 체크해 주세요.'; err.hidden = false; return; }
      if (!$('s-agree').checked) { err.textContent = '개인정보 수집 동의에 체크해 주세요.'; err.hidden = false; return; }
      $('s-go').disabled = true; $('s-go').textContent = '가입하는 중…';
      try {
        await DB.signup({ username: $('s-id').value, pw: $('s-pw').value, nick: $('s-nick').value, phone: $('s-phone').value, region: '', gender, birthYear: +$('s-birth').value, marketing: $('s-mkt').checked });
        const wantPush = $('s-mkt').checked; closeModal(); toast('가입되었습니다. 환영합니다!'); if (afterLogin) afterLogin();
        if (wantPush && window.openPushPicker) setTimeout(() => window.openPushPicker(true), 600);
      } catch (e) { err.textContent = e.message; err.hidden = false; $('s-go').disabled = false; $('s-go').textContent = '가입하기'; }
    };
  });
}
function openLogin() {
  modal(`<h2>로그인</h2>
  <div class="field"><label>아이디</label><input id="l-id" autocomplete="username" placeholder="아이디"></div>
  <div class="field"><label>비밀번호</label><input id="l-pw" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password" placeholder="숫자 6개"></div>
  <div class="modal-actions"><button type="button" class="btn green" id="l-go">로그인</button><button type="button" class="btn line" id="l-signup">처음이에요, 회원가입</button><button type="button" class="linkbtn" id="l-forgot">아이디·비밀번호를 잊었어요</button></div><div class="err-box" id="l-err" hidden></div>`,
  () => { $('l-signup').onclick = openSignup; $('l-forgot').onclick = openForgot; const go = async () => { const err = $('l-err'); err.hidden = true; try { await DB.login($('l-id').value, $('l-pw').value); closeModal(); toast('반갑습니다.'); if (afterLogin) afterLogin(); } catch (e) { err.textContent = e.message; err.hidden = false; } }; $('l-go').onclick = go; $('l-pw').onkeydown = e => { if (e.key === 'Enter') go(); }; });
}
function openForgot() {
  modal(`<h2>아이디·비밀번호 찾기</h2><p>가입할 때 적은 아이디와 휴대폰 번호를 넣어 주세요. 확인 뒤 그 번호로 연락드립니다.</p>
  <div class="field"><label>아이디</label><input id="f-id" placeholder="아이디 (모르면 비워 두세요)"></div>
  <div class="field"><label>휴대폰 번호</label><input id="f-phone" type="tel" placeholder="010-1234-5678"></div>
  <div class="modal-actions"><button type="button" class="btn green" id="f-go">찾기 요청</button></div><div class="err-box" id="f-err" hidden></div>`,
  () => { $('f-go').onclick = async () => { const err = $('f-err'); err.hidden = true; try { await DB.requestReset($('f-id').value || 'unknown', $('f-phone').value); closeModal(); toast('요청했습니다. 확인 뒤 연락드리겠습니다.'); } catch (e) { err.textContent = e.message; err.hidden = false; } }; });
}
async function openMy() {
  const p = DB.currentProfile(); if (!p) return;
  const ym = TODAY.slice(0, 7), days = await DB.myCheckins(ym), set = new Set(days.map(d => +d.slice(8)));
  const first = new Date(Y, M, 1).getDay(), last = new Date(Y, M + 1, 0).getDate();
  let cal = WD.map(w => `<div class="h">${w}</div>`).join('') + '<div></div>'.repeat(first);
  for (let d = 1; d <= last; d++) cal += `<div class="${set.has(d) ? 'on' : ''}">${d}</div>`;
  modal(`<h2>${esc(p.nick)}님의 정보</h2><p class="note">아이디 ${esc(p.username)} · 연속 ${p.streak || 0}일 · 총 ${p.checkinCount || 0}일 출석</p>
  <p class="note" style="margin-top:14px">${M + 1}월 출석</p><div class="cal">${cal}</div>
  <div class="field" style="margin-top:22px"><label>글자 크기</label><div class="in"><button type="button" class="btn line" id="m-size-big">크게</button><button type="button" class="btn line" id="m-size-normal">보통</button></div></div>
  <div class="field"><label>별명 바꾸기</label><div class="in"><input id="m-nick" value="${esc(p.nick)}" maxlength="12"><button type="button" class="btn line" id="m-nick-go">바꾸기</button></div><div class="msg" id="m-nick-msg"></div></div>
  <div class="field"><label>비밀번호 바꾸기</label><div class="in"><input id="m-pw" type="password" inputmode="numeric" maxlength="6" placeholder="새 숫자 6개"><button type="button" class="btn line" id="m-pw-go">바꾸기</button></div><div class="msg" id="m-pw-msg"></div></div>
  <div class="field"><label>태어난 해 · 성별 (선택)</label><div class="in"><input id="m-born" inputmode="numeric" maxlength="4" placeholder="예: 1960" value="${p.born || ''}"><select id="m-sex"><option value="">성별</option><option ${p.sex === '남' ? 'selected' : ''}>남</option><option ${p.sex === '여' ? 'selected' : ''}>여</option></select><button type="button" class="btn line" id="m-born-go">저장</button></div><div class="msg" id="m-born-msg"></div></div>`,
  () => {
    $('m-size-big').onclick = () => { applySize(true); store.set('big', true); toast('글자를 크게 했습니다.'); };
    $('m-size-normal').onclick = () => { applySize(false); store.set('big', false); toast('글자를 보통으로 했습니다.'); };
    $('m-nick-go').onclick = async () => { const m = $('m-nick-msg'); try { await DB.changeNick($('m-nick').value); m.className = 'msg ok'; m.textContent = '바꿨습니다.'; $('user-nick').textContent = DB.currentProfile().nick; } catch (e) { m.className = 'msg err'; m.textContent = e.message; } };
    $('m-pw-go').onclick = async () => { const m = $('m-pw-msg'); try { await DB.changePw($('m-pw').value); m.className = 'msg ok'; m.textContent = '바꿨습니다.'; } catch (e) { m.className = 'msg err'; m.textContent = e.code === 'auth/requires-recent-login' ? '안전을 위해 나갔다가 다시 로그인한 뒤 바꿔 주세요.' : e.message; } };
    $('m-born-go').onclick = async () => { const m = $('m-born-msg'); const born = +$('m-born').value; if ($('m-born').value && (born < 1920 || born > 2010)) { m.className = 'msg err'; m.textContent = '태어난 해를 다시 확인해 주세요.'; return; } try { await DB.saveProfile({ born: $('m-born').value, sex: $('m-sex').value }); m.className = 'msg ok'; m.textContent = '저장했습니다.'; } catch (e) { m.className = 'msg err'; m.textContent = e.message; } };
  });
}
$('login-btn').onclick = () => openGate('');
$('logout').onclick = async () => { await DB.logout(); toast('나갔습니다. 내일 또 뵙겠습니다.'); };
$('my').onclick = openMy;

// ── 출석 도장 ──
function renderStamp(p) {
  $('stamp-wrap').hidden = true;
  const done = p && p.lastCheckin === TODAY;
  $('stamp').disabled = !!done; $('stamp').textContent = done ? '오늘 출석 완료' : '출석 도장 찍기';
  $('streak').textContent = p ? (p.streak ? `연속 ${p.streak}일째` : '매일 찍으면 기록이 쌓입니다') : '가입하면 기록이 쌓입니다';
}
$('stamp').onclick = async () => { if (!DB.currentUser()) { afterLogin = () => $('stamp').click(); return openGate('출석 도장을 찍으려면'); } try { const s = await DB.checkin(); renderStamp(DB.currentProfile()); toast(s > 1 ? `도장을 찍었습니다. 연속 ${s}일째!` : '도장을 찍었습니다.'); } catch (e) { toast(e.message); } };
DB.onUser((u, p) => {
  $('user-chip').hidden = !u; $('login-btn').hidden = !!u;
  $('admin-btn').hidden = !(p && p.role === 'admin');
  if (p && p.role === 'admin') $('maint').hidden = true;
  if (u && p) { $('user-nick').textContent = p.nick + ' 님, ' + (new Date().getHours() < 12 ? '좋은 아침입니다.' : new Date().getHours() < 18 ? '좋은 오후입니다.' : '편안한 저녁입니다.'); if (p.zodiac && !myZ) { myZ = p.zodiac; renderZ(); } wxByRegion(p); if (p.region && !store.get('outRegion', null)) { outRegion = p.region.split(' ')[0]; renderOuting(); } }
  // 다음에 열 때 인사말을 그리기 전에 띄울 수 있게 적어 둔다 (늦게 띄우면 화면이 한 번 밀린다)
  store.set('hello', u && p ? { s: 'in', n: p.nick } : { s: 'out' });
  renderStamp(p); renderCmts();
});

// ── 세 묶음 탭 ──
// 네 칸을 누르면 그 장(章) 안으로 들어간다: 사진이 화면 가득 커지며 넘어가고, 맨 위에 그 장의 표지
function setChapter(g) {
  document.body.classList.toggle('in-chapter', !!g);
  document.body.dataset.ch = g || '';
  const tabG = g || 'g1';
  document.querySelectorAll('#tabs3 button').forEach(x => x.setAttribute('aria-pressed', x.dataset.tab === g));
  document.querySelectorAll('.tabsec').forEach(s => s.classList.toggle('on', s.dataset.g === tabG));
  let head = $('ch-head');
  if (g) {
    if (!head) { head = document.createElement('header'); head.id = 'ch-head'; head.className = 'ch-head'; document.querySelector('.tabsec').before(head); }
    const [t, sub, img, no] = CH[g];
    head.style.backgroundImage = `url('img/${img}.jpg')`;
    head.innerHTML = `<button type="button" class="ch-back" id="ch-back">← 처음으로</button><div class="ch-t"><span class="ch-k">CHAPTER ${no || g.slice(1)}</span><h2>${t}</h2><p>${sub}</p></div>`;
    $('ch-back').onclick = () => history.back();
  }
}
$('tabs3').onclick = e => {
  const sn = e.target.closest('[data-soon]'); if (sn) { toast('정성껏 준비하고 있습니다. 곧 찾아올게요.'); return; }
  const b = e.target.closest('[data-tab]'); if (!b) return; const g = b.dataset.tab; DB.track('tab', { tab: g });
  const r = b.getBoundingClientRect(), z = document.createElement('div'); z.className = 'ch-zoom';
  z.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;background-image:${getComputedStyle(b).backgroundImage}`;
  document.body.appendChild(z);
  requestAnimationFrame(() => { z.style.left = '0px'; z.style.top = '0px'; z.style.width = innerWidth + 'px'; z.style.height = innerHeight + 'px'; z.style.borderRadius = '0'; });
  setTimeout(() => { nav(g); window.scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(() => { z.classList.add('out'); setTimeout(() => z.remove(), 650); })); }, 460);
};

// ── 서비스 워커 ──
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ── 오늘의 오프닝 (미소·한결) ──
import('./hometown.js?v=10182250').then(m => { m.init({ toast, modal, closeModal, esc, store, DB }); m.load(); }).catch(e => console.warn('hometown', e));
import('./opening.js?v=10191740').then(m => m.init({ modal, closeModal, toast, DB })).catch(e => console.warn('opening', e));
