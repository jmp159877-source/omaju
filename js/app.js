import { DEFAULT_CONTENT } from './content.js';
import * as HOOKS from './hooks.js';
import * as DB from './db.js';
const OPENING_ON = false;   // 오늘의 오프닝 쉬는 중 (대표 2026-10-26)
import * as NB from './notebook.js';
import * as RADIO from './radio.js';
import * as MM from './malmoi.js';
import * as PLAY from './play.js';
import * as PET from './pet.js';
import * as SOLO from './solo.js';
import * as MOOD from './mood.js?v=10261940';   // 오늘의 음악과 함께 (대표 2026-10-25)
let EV = null;   // 기획 칼럼은 첫 화면 맨 아래라 늦게 불러온다 — 처음에 같이 부르면 커버 단추가 밀렸다(큰 글씨 시험)
const evMod = () => EV ? Promise.resolve(EV) : import('./ev.js').then(m => (EV = m));
// 오마주 사랑방 (대표 2026-10-25) — 기획 연재 밑 창, 첫 화면을 다 그린 뒤에 불러온다
let TALK = null; const talkMod = () => TALK ? Promise.resolve(TALK) : import('./talk.js?v=10260845').then(m => { TALK = m; m.init({ DB, toast, openGate, esc, TODAY, nav, listen: NB.listen, closeModal }); return m; });
// 장(章). 네 번째 값은 표지에 찍히는 번호 — 화면에 보이는 차례와 맞춘다(아이디는 그대로 둔다).
const CH = { g1: ['오늘 즐기기', '하루를 기분 좋게', 'tab-today', 1], g2: ['그때 돌아보기', '그 시절을 꺼내다', 'tab-past', 2], g5: ['앞으로 나아가기', '여행 · 관광 · 취미', 'tab-travel', 3], g3: ['나를 돌보기', '산 · 운동 · 마음 · 건강', 'tab-health', 4], g6: ['어쩌다 점점 집사', '댕댕이 · 냥이와 사는 이야기', 'tab-pet', 5], g7: ['혼자라서 좋은 날', '혼자일 때 더 좋은 하루', 'tab-solo', 6], g4: ['나의 수첩', '메모와 일정', 'tab-note', 7] };
let modalPushed = false, skipPop = false, exitOpen = false, reopenAfterPop = false;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('omaju.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('omaju.' + k, JSON.stringify(v)); } catch (e) {} } };
let toastT, readingBtn = null; function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800); }
const SITE = 'https://omaju.kr/';   // 앱을 vercel 주소에서 열었어도 남에게 보낼 땐 늘 omaju.kr
const TAGLINE = '— 오마주, 매일매일 펼쳐 보는 즐거움\n' + SITE + '/?from=card';

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
// 서버(Firestore)가 막히면(하루 읽기 한도 등) 새벽에 떠 둔 그날치 파일로 — 옛 기본 글이 나가지 않게 (2026-10-26)
const remote = (await DB.loadDaily(TODAY)) || (await fetch('daily/' + TODAY + '.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null));
if (remote) C = Object.assign({}, DEFAULT_CONTENT, remote);
DB.bumpVisit(); DB.startLive();
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
// v1 의 잎 장식은 뺐다 — 아래 로고 안의 나뭇가지와 같은 그림이라 두 번 나왔다 (운영자 2026-10-22)
const CARD_ORN = { v2: '<span class="gp-foil"></span>' };
cardsEl.innerHTML = GREET.map((c, i) => { const v = cardVar(i); return `<button type="button" class="gcard paper ${v}" data-copy="${i}" data-v="${v}" aria-label="인사 카드 보내기"${v === 'v6' ? ` style="background-image:url('img/wc/${CARD_SEASON}.jpg')"` : ''}><span class="gp-date">${v === 'v6' ? `${M + 1}월 ${D}일<br>${CARD_DOW}요일` : CARD_DATE}</span>${CARD_ORN[v] || ''}<q>${esc(c).replace(/\n/g, '<br>')}</q><span class="${v === 'v4' ? 'gp-brush' : 'gp-rule'}"></span><img class="gp-logo" src="img/logo.png" alt="오마주" width="600" height="490"></button>`; }).join('');
// cards.js 는 app.js 와 같은 ?v= 를 붙여 불러온다 (운영자 2026-10-22).
// 주소가 그대로면 카톡·네이버 앱 안 브라우저(서비스 워커 없음)가 옛 파일을 계속 써서
// 고친 것이 반영되지 않는다 — 고쳐도 12초가 그대로였던 까닭이다.
const MODV = (() => { try { return new URL(import.meta.url).search || ''; } catch (e) { return ''; } })();
let cardsMod;
const CT = {};   // 어디서 걸리는지 재 둔다 (주소에 ?t=1 을 붙이면 보여 준다)
async function makeCard(i) {
  const t0 = Date.now();
  cardsMod = cardsMod || await import('./cards.js' + MODV);
  CT.load = Date.now() - t0;
  const cv = await cardsMod.drawCard(C.greetings[i], i, { dateText: CARD_DATE, variant: cardVar(i), season: CARD_SEASON });
  CT.draw = Date.now() - t0 - CT.load;
  // toBlob 은 폰에 따라 터무니없이 느리다(13초). toDataURL 로 먼저 해 보고 안 되면 toBlob 으로.
  let blob = null;
  try {
    const d = cv.toDataURL('image/jpeg', 0.88);
    if (d && d.indexOf('data:image/jpeg') === 0) {
      const bin = atob(d.slice(d.indexOf(',') + 1)), u8 = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
      blob = new Blob([u8], { type: 'image/jpeg' });
    }
  } catch (e) {}
  if (!blob) blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
  CT.blob = Date.now() - t0 - CT.load - CT.draw;
  return blob;
}
// 카드에 쓰는 글꼴(명조 800·Cormorant 기울임)과 로고는 화면 어디에도 안 쓰여서 누를 때 비로소 받아 온다.
// 휴대폰 데이터로는 그게 몇 초라 "만드는 중입니다"에서 멈춘 듯 보였다 (운영자 2026-10-22).
// 한가할 때 미리 받아 둔다 — 첫 터치부터 바로 뜨게.
(function warmCard() {
  const go = () => {
    try { document.fonts.load('800 80px "Nanum Myeongjo"', '좋은 아침이에요'); document.fonts.load('italic 500 46px "Cormorant Garamond"', 'Omaju'); } catch (e) {}
    new Image().src = 'img/logo.png';
  };
  (window.requestIdleCallback || (f => setTimeout(f, 2000)))(go);
})();

// ── 카카오톡 공유 ──
// 카톡으로 받은 링크를 눌러 들어온 창에서는 휴대폰 기본 보내기(navigator.share)가 아예 없다.
// 처음 오는 분의 대부분이 그 길로 들어오므로(운영자 2026-10-22) 카카오 공유를 직접 붙인다.
// 사진만 덜렁 가는 것보다 낫다 — 카드 그림에 '오마주 열어보기' 단추가 함께 간다.
// JavaScript 키는 숨기는 종류가 아니다(화면 소스에 그대로 실린다). 카카오가 등록된 도메인만 받아 준다.
const KAKAO_JS_KEY = '391521772a7d00aef5a0f7fe93497bc8';
const OMAJU_LINK = { mobileWebUrl: 'https://omaju.kr/?from=card', webUrl: 'https://omaju.kr/?from=card' };   // 카톡으로 받은 카드에서 온 분을 센다 (홍보국 2026-10-25)
let kakaoP;
function kakaoReady() {
  if (kakaoP) return kakaoP;
  kakaoP = new Promise(res => {
    if (window.Kakao) return res(true);
    setTimeout(() => res(!!window.Kakao), 5000);   // 안 떨어지면 기다리지 말고 다음 길로 (단추가 '보내는 중…'에 멈추지 않게)
    const s = document.createElement('script');
    s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js';
    s.integrity = 'sha384-BGX7Wb16GmRFagri4bLJV2DgipVZaU2AI812GZtHtHzzDQJnfHasDXN5houxv45w';
    s.crossOrigin = 'anonymous'; s.onload = () => res(true); s.onerror = () => res(false);
    document.head.appendChild(s);
  }).then(ok => { try { if (ok && !window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY); return !!(ok && window.Kakao.isInitialized()); } catch (err) { return false; } });
  return kakaoP;
}
// 커버의 '친구에게 보내기' — 휴대폰 기본 보내기가 없는 창에서만 쓴다.
// 받는 분이 보는 모습이 달라지면 안 된다 (운영자 2026-10-22): 그림 카드가 아니라
// 기본 보내기와 **똑같은 글 + 똑같은 주소**가 가게 한다. 주소는 눌러서 바로 들어갈 수 있다.
async function kakaoSendIntro(text) {
  if (!await kakaoReady()) return false;
  try {
    // 그림(미리 보기)과 주소를 같이 보낸다 (운영자 2026-10-22).
    // 카카오 공유로 보낸 메시지는 카톡이 미리 보기를 만들어 주지 않아 우리가 그림을 붙여야 하고,
    // 주소가 글에 없으면 받는 분이 주소를 못 본다. 그래서 둘 다 넣는다.
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: { title: '오마주 · 오늘도 마음은 주니어', description: text.replace(/\n/g, ' ') + '\n' + SITE, imageUrl: 'https://omaju.kr/og-v5.jpg', imageWidth: 1200, imageHeight: 630, link: OMAJU_LINK },
      buttons: [{ title: '오마주 열어보기', link: OMAJU_LINK }],
    });
    return true;
  } catch (err) { return false; }
}

async function kakaoSendCard(file, url) {
  if (!await kakaoReady()) return false;
  try {
    const dt = new DataTransfer(); dt.items.add(file);
    const r = await window.Kakao.Share.uploadImage({ file: dt.files });
    const im = (r && (r.original || (r.infos && r.infos.original))) || {};
    if (!im.url) return false;
    // 카드 밑에 붙는 글을 최대한 없앤다 (운영자 2026-10-22: "오마주 열어보기만 딱 나오게").
    // 제목을 비워 보고(그림 + 단추만), 카카오가 거부할 때만 짧은 한 줄을 넣어 다시 보낸다.
    const LK = url ? { mobileWebUrl: url, webUrl: url } : OMAJU_LINK;
    const pic = { imageUrl: im.url, imageWidth: im.width, imageHeight: im.height, link: LK };
    const btn = [{ title: url ? '나도 해 보기' : '오마주 열어보기', link: LK }];
    try {
      window.Kakao.Share.sendDefault({ objectType: 'feed', content: { title: '', ...pic }, buttons: btn });
    } catch (e2) {
      window.Kakao.Share.sendDefault({ objectType: 'feed', content: { title: '매일 아침 새로 나오는 잡지, 오마주', ...pic }, buttons: btn });
    }
    return true;
  } catch (err) { return false; }
}

// 심리 테스트 결과 카드 보내기 (대표 2026-10-24) — 카카오로 그림 + '나도 해 보기' 단추, 안 되면 휴대폰 기본 보내기, 그것도 안 되면 저장
async function sharePsy(file, url, text) {
  if (await kakaoSendCard(file, url)) return;
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: text + '\n' + url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); toast('카드를 저장했어요. 카톡에서 사진으로 보내 주세요.');
}
// 카드 한 장 열기 — 인사말 칸과 심리 테스트 결과(그분께 보낼 카드)에서 함께 쓴다 (대표 2026-10-23: 테스트에서 밖으로 튕겨 나가지 않게)
cardsEl.onclick = e => { const b = e.target.closest('[data-copy]'); if (b) openCard(+b.dataset.copy); };
async function openCard(i) {
  DB.bumpClick('greeting');
  // 누르면 창부터 띄우고 그림은 되는 대로 채운다 (운영자 2026-10-22: 카톡 안 브라우저에서 10~15초를
  // 아무것도 없이 기다리다 멈춘 줄 알고 또 눌렀다). 무엇이 늦든 멈춘 것처럼 보이지 않게.
  modal(`<h2 id="card-h">인사 카드를 만들고 있어요</h2><div id="card-box" style="height:325px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;max-width:260px;background:rgba(0,0,0,0.04);border-radius:6px;font-size:1.02rem;opacity:0.7">잠시만요…</div><div class="modal-actions"><button type="button" class="btn green" id="card-share" disabled style="opacity:0.45">카톡으로 보내기</button><button type="button" class="btn line" id="card-save" disabled style="opacity:0.45">사진에 저장하기</button></div>`);
  const blob = await makeCard(i), file = new File([blob], 'omaju-card.jpg', { type: 'image/jpeg' });
  if (!$('card-box')) return;   // 기다리는 사이에 닫았으면 그만둔다
  const text = C.greetings[i].replace(/\n/g, ' ') + '\n' + TAGLINE;
  // 보내기 단추는 navigator.share 가 있기만 하면 띄운다 (운영자 2026-10-22: 저장하기만 떴다).
  // canShare({files}) 만 보면 카톡·네이버 앱 안에서 열린 화면에서 단추가 통째로 사라진다 —
  // 그 경우에도 글이라도 넘길 수 있으므로, 안 되면 눌렀을 때 저장으로 넘긴다.
  const url = URL.createObjectURL(blob), canShare = !!navigator.share;
  const canFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  $('card-h').textContent = /[?&]t=1/.test(location.search) ? `불러오기 ${CT.load} · 그리기 ${CT.draw} · 파일 ${CT.blob} (ms)` : '인사 카드가 준비되었습니다';
  $('card-box').outerHTML = `<img src="${url}" alt="" style="width:100%;max-width:260px;display:block;margin:0 auto 16px;box-shadow:0 6px 20px rgba(0,0,0,0.25)">`;
  ['card-share', 'card-save'].forEach(id => { const el = $(id); el.disabled = false; el.style.opacity = ''; });
  const save = () => { const a = document.createElement('a'); a.href = url; a.download = 'omaju-card.jpg'; a.click(); closeModal(); modal(`<h2>카드를 저장했습니다</h2><p style="font-size:1.1rem">휴대폰 <b>사진(갤러리)</b>에 저장되었습니다. 카톡에서 사진 보내기로 보내 주세요.</p>`); };
  $('card-save').onclick = save;
  // 보내는 차례: 카카오 공유(어느 창에서나 되고 '오마주 열어보기' 단추가 함께 간다)
  //            → 휴대폰 기본 보내기 → 그래도 안 되면 저장하기
  $('card-share').onclick = async () => {
    const btn = $('card-share'); btn.disabled = true; btn.textContent = '보내는 중…';
    // 카드도 같다 — 그림을 바로 넘길 수 있는 폰은 원래대로, 안 되는 창에서만 카카오 공유.
    if (canFile) { try { await navigator.share({ files: [file], text }); closeModal(); return; } catch (err) { if (err.name === 'AbortError') { btn.disabled = false; btn.textContent = '카톡으로 보내기'; return; } } }
    if (await kakaoSendCard(file)) { closeModal(); return; }
    if (canShare) { try { await navigator.share({ text: text + '\nhttps://omaju.kr/?from=card' }); closeModal(); return; } catch (err) { if (err.name === 'AbortError') { btn.disabled = false; btn.textContent = '카톡으로 보내기'; return; } } }
    save();
  };
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
const FOLLOW_ORDER = ['run', 'pilates', 'photo', 'coffee', 'camp'];   // 영포티가 실제로 하는 것 (대표 2026-10-24 — 노래 교실·댄스·골프·파크골프는 뺐다)
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
// 예고편·소개 영상 (대표 2026-10-24) — 공식 채널 영상만 tools/shows_week.py 가 달아 둔다. 눌러야 오마주 안에서 재생(노래·따라하기와 같은 창)
function swVid(x, label) {
  const v = x && x.video && x.video.videoId; if (!v) return '';
  return `<button type="button" class="sw-vid" data-swv="${esc(v)}" data-swt="${esc(x.title)}" aria-label="${esc(x.title)} ${label}"><img src="https://i.ytimg.com/vi/${encodeURIComponent(v)}/hqdefault.jpg" alt="" loading="lazy"><span class="sw-play"><i>▶</i>${label}</span></button>`;
}
function playShow(v, t) {
  if (window.omajuRadio) window.omajuRadio.pause();
  modal(`<div class="pl-head"><h2>${esc(t)}</h2><p>공식 영상</p></div><div class="pl-video"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="${esc(t)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`, () => { $('modal').classList.add('pl-modal'); });
  DB.track('show_video', { t });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-swv]'); if (b) playShow(b.dataset.swv, b.dataset.swt); });
function renderShow() {
  const body = $('show-body'); if (!body) return;
  if (!SHOWS) { body.innerHTML = '<p class="note" style="margin-top:30px">이번 주 볼거리를 모으고 있습니다. 잠시 뒤에 다시 들러 주세요.</p>'; return; }
  const tabs = `<div class="sw-tabs" role="group" aria-label="무엇을 볼까">${SHOW_TABS.map(([k, n]) => `<button type="button" data-sw="${k}" aria-pressed="${k === showTab}">${n}</button>`).join('')}</div>`;
  let inner = '';
  if (showTab === 'movie') {
    const ms = SHOWS.movie || [];
    inner = ms.length ? '<div class="rows">' + ms.map(m => `<div class="row sw-row"><b>${esc(m.title)}</b><p class="sw-meta">${esc([m.director ? m.director + ' 감독' : '', m.cast, m.rating].filter(Boolean).join(' · '))}${m.opened ? ` <span class="nw">· ${esc(m.opened)}</span>` : ''}</p><p>${esc(m.why || '')}</p>${swVid(m, '예고편 보기')}<a class="linkbtn" href="https://search.naver.com/search.naver?query=${encodeURIComponent('영화 ' + m.title)}" target="_blank" rel="noopener">상영관 찾기</a></div>`).join('') + '</div>'
      : '<p class="note" style="margin-top:24px">이번 주 극장 소식을 모으고 있습니다.</p>';
  } else {
    const rs = showRegions();
    if (!rs.length) { inner = '<p class="note" style="margin-top:24px">이번 주 소식을 모으고 있습니다.</p>'; }
    else {
      if (!rs.includes(outRegion)) outRegion = rs[0];
      const list = (SHOWS.regions[outRegion] || {})[showTab] || [];
      inner = `<div class="sw-regions" role="group" aria-label="지역 고르기">${rs.map(r => `<button type="button" data-swr="${esc(r)}" aria-pressed="${r === outRegion}">${esc(r)}</button>`).join('')}</div>`
        + (list.length ? '<div class="rows">' + list.map(x => `<div class="row sw-row"><b>${esc(x.title)}</b><p class="sw-meta">${esc(x.where || '')}${x.when ? ` <span class="nw">· ${esc(x.when)}</span>` : ''}${x.price ? ` <span class="nw">· ${esc(x.price)}</span>` : ''}</p><p>${esc(x.why || '')}</p>${swVid(x, showTab === 'exhibit' ? '소개 영상 보기' : '미리 보기')}<a class="linkbtn" href="https://search.naver.com/search.naver?query=${encodeURIComponent(x.title + ' ' + (x.where || ''))}" target="_blank" rel="noopener">자세히 · 예매</a></div>`).join('') + '</div>'
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
  </article>` + askBar('book') + svBar('book', 'book_' + TODAY, b.title);
  svSync();
}

// ── 글 끝 물음 → 사랑방 (대표 2026-10-25: "일방향이 되면 안 된다", "적절하게 한두 개씩 툭툭") ──
// 한 끼·한 권 글 끝에 독자 자신의 이야기를 묻는 한 줄. 새벽 gen_hooks 가 그날 내용으로 쓴 ask 가 있으면 그것, 없으면 아래 돌림.
const ASK_POOL = {
  food: ['이 음식 하면 떠오르는 사람이나 장면이 있나요?', '요즘 당신 집 식탁에 제일 자주 오르는 한 그릇은요?', '입맛 없을 때 꼭 찾게 되는 당신만의 음식은?', '어머니 손맛 중에 아직도 못 따라 하는 게 있나요?', '혼자 먹을 때와 같이 먹을 때, 차리는 게 달라지나요?'],
  book: ['요즘 머리맡에 두고 읽는 책이 있나요?', '오래전에 읽었는데 아직 한 장면이 남아 있는 책은요?', '누군가에게 선물하고 싶은 책 한 권을 꼽는다면?', '책 읽는 시간, 당신은 주로 언제인가요?'],
};
const ASK_NAME = { food: '오늘의 한 끼', book: '오늘의 한 권' };
function askBar(k) {
  const h = (C.hooks || {})[k] || {}, pool = ASK_POOL[k] || [];
  const q = (h.ask || '').trim() || pool[(new Date(TODAY).getDate()) % pool.length];
  if (!q) return '';
  return `<div class="ask"><p class="ask-q">${esc(q)}</p><button type="button" class="ask-go" data-ask="${esc(k)}" data-q="${esc(q)}">사랑방에 한 줄 남기기 <span aria-hidden="true">›</span></button></div>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-ask]'); if (!b) return; window.__tkAsk = { from: ASK_NAME[b.dataset.ask] || '', q: b.dataset.q }; nav('talk'); });

// ── 담아 두기 ──
// 마음에 든 글을 통째로 수첩에 베껴 둔다. 담을 수 있는 코너만 단추가 붙는다(운세·그해 오늘처럼 다시 볼 값이 없는 것은 뺐다).
const SV_NAME = { dog: '댕댕이', cat: '냥이', 'solo-day': '혼자 떠나는 하루 코스', 'solo-eat': '혼밥 맛집', 'solo-hobby': '혼자 즐기는 취미 자리', 'solo-see': '혼자 보기 좋은 것', 'solo-home': '혼자 사는 살림', 'solo-trip': '혼자 떠나는 여행', mind: '마음 한 줄', body: '몸 한 가지', food: '오늘의 한 끼', book: '오늘의 한 권', quiz: '시사 상식', culture: '오늘의 문화' };
const SV_DATA = { dog: () => PET.current('dog'), cat: () => PET.current('cat'), 'solo-day': () => SOLO.current('day'), 'solo-eat': () => SOLO.current('eat'), 'solo-hobby': () => SOLO.current('hobby'), 'solo-see': () => SOLO.current('see'), 'solo-home': () => SOLO.current('home'), 'solo-trip': () => SOLO.current('trip'), mind: () => C.mind, body: () => C.body, food: () => C.meal, book: () => C.book, quiz: () => C.quiz, culture: () => (C.culture || {})[cuTab] };
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
window.omajuSvBar = svBar;   // 집사·혼자라서 좋은 날(따로 그리는 모듈)도 같은 단추를 쓴다
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

// 오늘의 정원 — 운영자가 실제로 하는 일이라 아무도 못 베끼는 자리 (운영자 2026-10-21 밤)
// ── 꿈 해몽 (운영자 2026-10-22) ──
// 찾을 때마다 AI 에게 묻지 않는다 — 구독자가 늘수록 비용이 사람 수만큼 늘어난다.
// 풀이 사전(data/dreams.json)을 한 벌 받아 두고 화면 안에서 바로 찾는다. 비용 0, 즉시, 인터넷이 약해도 된다.
let DREAM = null, dreamCat = '동물';
async function openDream() {
  const box = $('dream-body'); if (!box) return;
  // 머리 사진: 운세 사진을 같이 쓰면 '같은 사진 두 곳' 이 된다. 꿈 사진이 오기 전까지 새벽빛 그러데이션.
  const bg = $('d-bg'); if (bg) bg.style.backgroundImage = 'linear-gradient(115deg, #24324A 0%, #3B4A63 55%, #8C7B5E 100%)';
  if (!DREAM) {
    box.innerHTML = '<p class="dr-none" style="margin-top:30px">꿈 풀이를 펼치는 중입니다…</p>';
    try { DREAM = await (await fetch('data/dreams.json?v=' + (MODV || '').replace(/^\?v=/, ''), { cache: 'no-cache' })).json(); }
    catch (e) { box.innerHTML = '<p class="dr-none" style="margin-top:30px">꿈 풀이를 불러오지 못했습니다. 잠시 뒤 다시 들러 주세요.</p>'; DREAM = null; return; }
  }
  if (box.dataset.ready) return;
  box.dataset.ready = '1';
  box.innerHTML = `<div class="dr-wrap">
    <p class="dr-lead">간밤에 꾼 꿈의 낱말을 넣어 보세요. 예부터 전해 오는 풀이를 <span class="nw">찾아 드립니다.</span></p>
    <form class="ht-form" id="dr-form" autocomplete="off">
      <input type="text" id="dr-q" inputmode="text" placeholder="예: 돼지, 이빨, 돌아가신 분">
      <button type="button" class="btn line ht-mic" id="dr-mic" aria-label="말로 찾기"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg><span>말하기</span></button>
      <button type="submit" class="btn green">찾기</button>
    </form>
    <div id="dr-res"></div>
    <p class="dr-sub">많이 찾는 꿈</p>
    <div class="dr-pop">${DREAM.pop.map(k => `<button type="button" data-drk="${esc(k)}">${esc(drName(k))}</button>`).join('')}</div>
    <p class="dr-sub">분류로 둘러보기</p>
    <div class="dr-cats">${DREAM.cats.map(c => `<button type="button" data-drc="${esc(c)}" aria-pressed="${c === dreamCat}">${esc(c)}</button>`).join('')}</div>
    <div class="dr-catlist" id="dr-catlist"></div>
    <p class="dr-foot">꿈 풀이는 예부터 전해 오는 이야기입니다. 가볍게 재미로 읽어 주세요.</p></div>`;
  paintDreamCat();
}
function paintDreamCat() {
  const el = $('dr-catlist'); if (!el || !DREAM) return;
  el.innerHTML = DREAM.items.filter(x => x.c === dreamCat).map(x => `<button type="button" data-drk="${esc(x.k)}">${esc(drName(x.k))}</button>`).join('');
  document.querySelectorAll('[data-drc]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.drc === dreamCat)));
}
// 문장으로 쳐도 알아듣게 (운영자 2026-10-22: '죽는 사람을 보고 놀라서 잠에서 깸' → 두 줄만 나왔다).
// 낱말로 쪼개 토씨·끝말을 덜어 내고, '놀라서·잠에서·깸' 같은 말은 낱말 찾기에서 뺀다(풀이 제목 맞추기에만 살짝 쓴다).
const DR_STOP = new Set(['놀라서', '놀라', '놀란', '잠에서', '잠', '깸', '깼다', '깼어요', '깼는데', '깨어', '깨는', '꿈', '꿈을', '꿈에', '꿈에서', '꿨다', '꿨어요', '꿨는데', '꾸었다', '꾸었어요', '보고', '봤다', '봤어요', '봤는데', '보는', '봄', '하는', '했다', '했어요', '있는', '있었다', '갑자기', '너무', '정말', '어제', '간밤', '오늘', '밤', '새벽', '내가', '제가', '나는', '저는', '나', '저', '그', '그런', '이런', '어떤', '무슨', '뜻', '해몽', '좀', '같은', '계속', '자꾸', '많이', '엄청', '되게', '진짜']);
// 너무 흔한 말은 낱말 찾기에서 빼고 풀이 제목 맞추기에만 (예: '사람' 때문에 '눈사람'이 걸렸다)
const DR_GENERIC = new Set(['사람', '것', '거', '데', '때', '곳', '분']);
// 식구를 부르는 말이 나오면 '가족'도 같이 찾는다 ('엄마가 죽는 꿈' → '가족이 죽는 꿈')
const DR_FAMILY = new Set(['엄마', '어머니', '아빠', '아버지', '남편', '아내', '부인', '아들', '딸', '자식', '언니', '오빠', '누나', '형', '동생', '할머니', '할아버지', '가족', '식구']);
const drStrip = w => w.replace(/꿈$/, '').replace(/(에서|에게|으로|이랑|하고|처럼|까지|부터|한테|은|는|이|가|을|를|에|의|도|만|와|과|랑|로)$/, '');
const drVerb = w => w.replace(/(했던|했다|했어요|하다가|하는|하고|해서|었던|았던|었다|았다|었어요|았어요|어서|아서|면서|던|고|며)$/, '');
function findDream(raw) {
  const n = s => String(s || '').replace(/\s+/g, '');
  const words = String(raw || '').split(/[\s,.!?~·]+/).map(w => w.trim()).filter(Boolean);
  const toks = [], soft = [];
  for (const w of words) {
    const c = [...new Set([w, drStrip(w), drVerb(drStrip(w))])].filter(Boolean);
    if (c.some(x => DR_FAMILY.has(x))) soft.push('가족');
    if (DR_STOP.has(w) || DR_GENERIC.has(drStrip(w)) || c.every(x => DR_STOP.has(x) || DR_GENERIC.has(x))) { soft.push(...c.filter(x => x.length >= 2 || DR_GENERIC.has(x))); continue; }
    toks.push(c);
  }
  if (!toks.length && !soft.length) return [];
  const out = [];
  for (const x of DREAM.items) {
    const k = n(x.k).replace(/\(.*\)/, ''), al = x.a.map(n);
    let sc = 0, exact = false;
    const lineSc = x.l.map(() => 0);
    for (const cands of toks) {
      let best = 0;
      for (const c of cands) {
        if (c === k || al.includes(c)) { best = Math.max(best, 60); exact = true; }
        else if (c.length >= 2 && (k.includes(c) || (k.length >= 2 && c.includes(k)) || al.some(a => a.includes(c) || (a.length >= 2 && c.includes(a))))) best = Math.max(best, 35);
        if (c.length >= 2) x.l.forEach((l, i) => { if (n(l.t).includes(c)) lineSc[i] += 20; else if (n(l.d).includes(c)) lineSc[i] += 3; });
      }
      sc += best;
    }
    for (const c of soft) x.l.forEach((l, i) => { if (n(l.t).includes(c)) lineSc[i] += c === '가족' ? 20 : 8; });
    const lb = Math.max(0, ...lineSc);
    if (!sc && lb < 20) continue;
    // 맞은 풀이를 앞에. 낱말이 맞았으면 나머지 풀이도 뒤에 붙이고, 글 속에서만 맞았으면 맞은 줄만.
    const order = x.l.map((l, i) => ({ l, s: lineSc[i] })).sort((a, b) => b.s - a.s);
    const show = sc ? order.map(v => v.l).slice(0, exact && toks.length === 1 ? 12 : 6) : order.filter(v => v.s >= 20).map(v => v.l);
    out.push({ x, sc: sc + lb, show });
  }
  return out.sort((a, b) => b.sc - a.sc).slice(0, 8);
}
// 보이는 이름: '죽는' → '죽는 꿈', '눈(내리는)' → '눈'
const drName = k => { k = k.replace(/\(.*\)/, ''); return /는$/.test(k) ? k + ' 꿈' : k; };
function showDream(raw) {
  const res = $('dr-res'); if (!res || !DREAM) return;
  const q = String(raw || '').trim();
  if (!q) { res.innerHTML = ''; return; }
  const hits = findDream(q);
  const tag = g => g === '좋은 꿈' ? '<span class="dr-tag g">좋은 꿈</span>' : g ? `<span class="dr-tag c">${esc(g)}</span>` : '';
  // 비슷한 꿈: 맨 위 풀이와 같은 분류에서 몇 개 — 하나 찾고 끝나지 않고 둘러보게
  const seen = new Set(hits.map(h => h.x.k));
  const near = hits.length ? DREAM.items.filter(x => x.c === hits[0].x.c && !seen.has(x.k)).slice(0, 6) : [];
  res.innerHTML = hits.length
    ? hits.map(h => `<div class="dr-card"><h3>${esc(drName(h.x.k))}</h3><ul>${h.show.map(l => `<li><b>${esc(l.t)}</b>${tag(l.g)}<p>${esc(l.d)}</p></li>`).join('')}</ul></div>`).join('')
      + (near.length ? `<p class="dr-sub">비슷한 꿈</p><div class="dr-pop">${near.map(x => `<button type="button" data-drk="${esc(x.k)}">${esc(drName(x.k))}</button>`).join('')}</div>` : '')
    : `<p class="dr-none">‘${esc(q)}’ 꿈 풀이는 아직 없습니다. 꿈에서 가장 또렷했던 것 하나만 넣어 보세요. (예: 물, 집, 돈)</p>`;
  DB.track && DB.track('dream_find', { q: q.slice(0, 20), n: hits.length });
  res.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
document.addEventListener('submit', e => { if (e.target.id !== 'dr-form') return; e.preventDefault(); showDream(($('dr-q') || {}).value); });
document.addEventListener('click', e => {
  const k = e.target.closest('[data-drk]'); if (k) { const i = $('dr-q'); if (i) i.value = k.dataset.drk; showDream(k.dataset.drk); return; }
  const c = e.target.closest('[data-drc]'); if (c) { dreamCat = c.dataset.drc; paintDreamCat(); return; }
  if (e.target.closest('#dr-mic')) NB.listen(txt => { closeModal(); const i = $('dr-q'); if (i) i.value = txt; showDream(txt); });
});

function renderGarden() {
  const g = C.garden;
  if (!g || !g.title) { $('garden-body').innerHTML = '<p class="note" style="margin-top:30px">오늘의 정원을 고르고 있습니다. 잠시 뒤에 다시 들러 주세요.</p>'; return; }
  if ($('garden-sub')) $('garden-sub').textContent = g.when || '이 철에 해야 할 일 한 가지';
  $('garden-body').innerHTML = `<div class="cu-block">
    <p class="cu-kind">${esc(g.when || '')}</p>
    <h3 class="gd-title">${esc(g.title)}</h3>
    ${(g.body || []).map(x => `<p class="cu-note">${esc(x)}</p>`).join('')}
    ${g.tip ? `<p class="is-sub">요령 하나</p><p class="cu-note">${esc(g.tip)}</p>` : ''}
    ${g.myth ? `<p class="is-sub">잘못 알려진 것</p><p class="cu-note">${esc(g.myth)}</p>` : ''}
    ${g.by ? `<p class="cu-by">— ${esc(g.by)}</p>` : ''}</div>`;
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
  if (!$('phrase-title').classList.contains('b-hook')) $('phrase-title').textContent = '여행';   // 썸네일 제목이 붙었으면 덮지 않는다
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
  // '숨은 곳'은 따로 모아 소제목 아래에 — 번잡한 데를 피해 조용히 쉴 자리 (운영자 2026-10-21 밤)
  const row = it => `<div class="row ot-row"><span class="ot-kind">${esc(it.kind || '나들이')}</span><b>${esc(it.title)}</b><p class="ot-meta">${esc(it.where || '')}${it.when ? ' <span class="nw">· ' + esc(it.when) + '</span>' : ''}</p><p>${esc(it.why || '')}</p><a class="linkbtn" href="https://map.naver.com/p/search/${encodeURIComponent(it.where || it.title)}" target="_blank" rel="noopener">지도에서 보기</a></div>`;
  const all = o[outRegion], hide = all.filter(x => x.kind === '숨은 곳'), open = all.filter(x => x.kind !== '숨은 곳');
  $('outing-body').innerHTML = '<div class="rows" style="margin-top:20px">' + open.map(row).join('') + '</div>'
    + (hide.length ? '<p class="is-sub ot-sub">숨겨진 여가 공간</p><p class="note ot-subnote">사람 많은 곳을 피해, 조용히 쉬다 올 만한 자리입니다.</p><div class="rows">' + hide.map(row).join('') + '</div>' : '')
    + '<p class="note">내용은 매일 아침 새로 찾아 넣습니다. 가기 전에 날짜와 시간을 한 번 더 확인해 주세요.</p>';
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
  if (!$('hike-title').classList.contains('b-hook')) $('hike-title').textContent = '오늘의 산';   // 썸네일 제목이 붙었으면 덮지 않는다
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
(function seasonOuting() { const pic = 'outing';   /* 대표 2026-10-24: 철마다 바꾸던 것을 숲길 산책 사진 한 장으로 */ const b = document.querySelector('[data-open="outing"]'); if (b) b.style.backgroundImage = `url('img/${pic}.jpg?v=2')`; })();





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
try { MOOD.init({ toast, closeModal, track: (n, d) => DB.track(n, d), box: () => DB.loadMusicbox() }); } catch (e) {}
setTimeout(() => { try { MOOD.auto(); } catch (e) {} }, 1200);   // 앱으로 열면 감미로운 그루브 (대표 2026-10-26)
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
  if (!C.era || ![50, 40, 30, 20, 10].some(n => C.era[n])) return;   /* 2026-10-25 0시: 그날 치 era 가 비어 들어와 여기서 멈추며 오프닝·기획 연재까지 안 떴다 */
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
$('meal').innerHTML = `<p class="lead">${esc(C.meal.lead)}</p><ul class="ing">${C.meal.ingredients.map(i => `<li>${esc(i)}</li>`).join('')}</ul><ol class="steps">${C.meal.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="note">${esc(C.meal.tip || '')}</p>` + askBar('food') + svBar('food', 'food_' + TODAY, C.meal.title);
$('story-title').textContent = C.story.title; $('story-sub').textContent = C.story.sub;
$('story-body').innerHTML = C.story.paras.map(p => `<p class="lead">${esc(p)}</p>`).join('') + `<p class="note">— ${esc(C.story.by || '오마주 편집실')}</p>`;

const PT_IDS = ['pt-talk', 'pt-wall', 'pt-trip', 'pt-karaoke', 'pt-morning', 'pt-wallet', 'pt-drive', 'pt-closet', 'pt-alone', 'pt-party', 'pt-coffee'];   // js/psy_tests.js ORDER_T 와 같게
function ptRoot(id) { let r = $(id + '-root'); if (!r) { const sec = document.createElement('section'); sec.className = 'dsec game'; sec.dataset.k = id; sec.innerHTML = `<div id="${id}-root"></div>`; document.querySelector('.d-body').appendChild(sec); r = $(id + '-root'); } return r; }
const DET = { play: ['detail_malmoi', '오늘 PLAY', () => '한 판 더,<br>오늘의 순위'], psy: ['', '심리 테스트', () => ''], psa: ['', '프사 읽기', () => ''], malmoi: ['', '말모이', () => ''], shisen: ['', '사천성', () => ''], num50: ['', '1 to 50', () => ''], sudoku: ['', '스도쿠', () => ''], history: ['detail_history', '그해 오늘', () => `${Y - ago}년,<br>그해 오늘`], music: ['detail_music', '그 시절 노래', () => `${Y - ago}년,<br>그해의 노래`], food: ['detail_food', '오늘의 한 끼', () => esc(C.meal.title)], story: ['detail_story', '그날의 사연', () => esc(C.story.title)], fortune: ['fortune', '오늘의 운세', () => '띠를 고르면,<br>오늘의 한마디'], luck: ['', '오늘의 운세 · 꿈 해몽', () => '오늘의 운,<br>간밤의 꿈'], culture: ['culture_detail', '오늘의 문화', () => '시 한 편,<br>그림 한 점'], follow: ['detail_follow', '오늘의 따라하기', () => '배우는 재미,<br>오늘 한 가지'], move: ['detail_move', '오늘의 몸 풀기', () => '오늘, 몸을 깨우는 시간'], mind: ['detail_culture', '오늘의 마음 한 줄', () => '숨 한 번,<br>마음 한 줄'], body: ['detail_body', '오늘의 몸 한 가지', () => esc((C.body && C.body.part) || '몸') + ',<br>오늘 한 가지'], hike: ['detail_hike', '오늘의 산', () => '이번 주,<br>걷기 좋은 산길'], book: ['detail_book', '오늘의 한 권', () => esc((C.book && C.book.title) || '오늘의 한 권')], home: ['detail_home', '그 동네 지금', () => '그 길에 서서,<br>지금 이 시간'], phrase: ['detail_phrase', '여행', () => '해외 골프 · 관광,<br>자유여행 · 회화'], outing: ['detail_outing', '오늘의 나들이', () => '이번 주말, 어디로 갈까'], garden: ['detail_garden', '오늘의 정원', () => '이 철에,<br>해야 할 일 하나'], dream: ['', '꿈 해몽', () => '간밤의 꿈,<br>무슨 뜻일까'], show: ['detail_show', '이번 주, 무엇을 볼까', () => '극장 · 무대 · 전시'], pick: ['detail_pick', '오늘의 음악과 함께', () => '오늘의 한 곡,<br>그리고 틀어 둘 음악'], dog: ['pet-dog-head', '어쩌다 점점 집사 · 댕댕이', () => esc((PET.current('dog') || {}).title || '오늘의 댕댕이 이야기')], cat: ['pet-cat-head', '어쩌다 점점 집사 · 냥이', () => esc((PET.current('cat') || {}).title || '오늘의 냥이 이야기')], ...Object.fromEntries(PT_IDS.map(id => [id, ['', '심리 테스트', () => '']])), 'solo-day': ['detail_solo-day', '혼자라서 좋은 날 · 혼자 떠나는 하루 코스', () => esc((SOLO.current('day') || {}).title || '혼자 떠나는 하루 코스')], 'solo-eat': ['detail_solo-eat', '혼자라서 좋은 날 · 혼밥 맛집', () => esc((SOLO.current('eat') || {}).title || '혼밥 맛집')], 'solo-hobby': ['detail_solo-hobby', '혼자라서 좋은 날 · 혼자 즐기는 취미 자리', () => esc((SOLO.current('hobby') || {}).title || '혼자 즐기는 취미 자리')], 'solo-see': ['detail_solo-see', '혼자라서 좋은 날 · 혼자 보기 좋은 것', () => esc((SOLO.current('see') || {}).title || '혼자 보기 좋은 것')], 'solo-home': ['detail_solo-home', '혼자라서 좋은 날 · 혼자 사는 살림', () => esc((SOLO.current('home') || {}).title || '혼자 사는 살림')], 'solo-trip': ['detail_solo-trip', '혼자라서 좋은 날 · 혼자 떠나는 여행', () => esc((SOLO.current('trip') || {}).title || '혼자 떠나는 여행')], talk: ['detail_talk', '오마주 사랑방', () => '오늘의 이야기'], ev: ['detail_ev', '시대 공유 · 전기차 시대', () => esc(((EV && EV.current('ev')) || {}).title || '전기차 시대')], ai: ['detail_ai', '시대 공유 · AI 시대에 살 준비가 되었는가', () => esc(((EV && EV.current('ai')) || {}).title || 'AI 시대에 살 준비가 되었는가')], quiz: ['issue_detail', '오늘의 시사 상식', () => esc(C.quiz.term || '오늘의 시사 상식')] };
let cur = null;
function setTitle() { $('d-title').innerHTML = DET[cur][2](); }
// ── 아침 알림 받기 (원하는 사람만, 시간은 직접 고르기) ──
(function pushUI() {
  const btn = $('push-cta'); if (!btn) return;
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!ok && !isIOS) return;
  const get = () => store.get('push', null);
  const draw = () => { const p = get(); btn.hidden = true;   /* 인사말 밑 칸은 뺐다 (대표 2026-10-24: 정신사납다) — 가입 때 고르는 창(openPushPicker)만 남김 */ btn.innerHTML = p ? `<span class="pc-ic">☀</span><span><b>아침 ${p.hour}시 알림 받는 중</b><small>시간 바꾸기 · 그만 받기</small></span>` : `<span class="pc-ic">☀</span><span><b>아침 알림 받기</b><small>매일 아침 인사 카드와 오늘 PLAY를 알려 드려요</small></span>`; };
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

const GAME = { psy: async () => (await import('./psy.js' + MODV)).mountList($('psy-root'), { nav }), psa: async () => (await import('./psy.js' + MODV)).mount($('psa-root'), { toast, cards: () => cardsEl.innerHTML, openCard }), malmoi: () => MM.mount($('mm-root'), { toast, esc }), shisen: async () => (await import('./games/shisen.js')).mount($('ss-root')), num50: async () => (await import('./games/num50.js')).mount($('n5-root')), sudoku: async () => (await import('./games/sudoku.js')).mount($('sd-root')) };
const gameDone = {};

// ── 화면 이동: 잡지 넘기듯 '단계'로 쌓는다 (첫 화면 0 → 장 1 → 코너 2 → 놀이 3).
// 같은 단계끼리 옮겨 다니면 쌓지 않고 바꿔 끼운다 → 몇 개를 열어 봐도 뒤로 가기는 한 단계씩 위로, 많아야 4번이면 나간다.
// 심리 테스트 — 아이디가 늘어나도 여기서 한꺼번에 (대표 2026-10-24: 매주 월요일 새 테스트)
PT_IDS.forEach(ptRoot);   // 칸을 미리 만들어 두어야 들어갈 때 바로 보인다
PT_IDS.forEach(id => { GAME[id] = async () => (await import('./psy.js' + MODV)).mountTest(ptRoot(id), id, { nav, toast, share: sharePsy }); });
const NAV_GAMES = new Set(['psy', 'malmoi', 'shisen', 'num50', 'sudoku']);
const CU_RE = /^cu-[a-z]+$/;   // 오늘의 문화 안쪽 (시·그림…) — 놀이와 같은 단계라 뒤로 가면 고르는 화면으로 온다
const LV = k => !k ? 0 : /^g[1-7]$/.test(k) ? 1 : (k === 'psa' || /^pt-/.test(k)) ? 4 : (NAV_GAMES.has(k) || CU_RE.test(k) || k === 'dream' || k === 'fortune') ? 3 : 2;   // 운세·꿈 해몽은 두 단추 화면(luck) 안쪽 → 뒤로 가면 두 단추로
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
  if (cur === 'dream') openDream();
  if (cur === 'luck') { const bg = $('d-bg'); if (bg) bg.style.backgroundImage = "url('img/fortune.jpg')"; }   // 바깥 카드와 같은 사진으로 이어지게 (표지 목록에는 안 올린다)
  if (/^g[1-7]$/.test(k)) setChapter(k); else if (!cur) { const was = document.body.classList.contains('in-chapter'); setChapter(null); if (was) { route.y = null; const t = $('tabs3'); window.scrollTo(0, Math.max(0, t.getBoundingClientRect().top + window.scrollY - 80)); } }
  document.body.classList.toggle('game-mode', !!GAME[cur] || cur === 'play'); if (!GAME[cur]) PLAY.stopAll();
  if (cur === 'play') PLAY.hub($('play-root'));
  if (cur && cur.startsWith('solo-')) { const sk = cur.slice(5), sc = cur; SOLO.load().then(() => { SOLO.render($('solo-' + sk), sk); if (cur === sc) setTitle(); }); }
  if (cur === 'talk') { talkMod().then(m => m.renderDetail()); } else if (TALK) TALK.clearAsk();   // 사랑방을 나가면 물음도 지운다
  if (cur === 'ev' || cur === 'ai') { const ck = cur; evMod().then(m => m.load(ck)).then(() => { EV.render($(ck + '-body'), null, ck); if (cur === ck) setTitle(); }); }
  if (cur === 'dog' || cur === 'cat') { const pk = cur; PET.load().then(() => { PET.render($('pet-' + pk), pk); if (cur === pk) setTitle(); }); }
  if (GAME[cur] && (!gameDone[cur] || cur === 'psy' || /^pt-/.test(cur))) { gameDone[cur] = true; GAME[cur](); }   /* 심리 테스트 목록·테스트는 들어올 때마다 새로 (지난 결과 반영) */ document.body.classList.toggle('in-detail', !!cur); stopRead(); if (cur) { if (DET[cur][0]) $('d-bg').style.backgroundImage = `url('img/${DET[cur][0]}.jpg?v=2')`; $('d-bg').classList.toggle('d-wide', cur === 'food');   /* 사람 있는 가로 사진은 잘리지 않게 통째로 (대표 2026-10-24) */ $('d-tag').textContent = DET[cur][1]; setTitle(); document.querySelectorAll('.dsec').forEach(s => s.classList.toggle('on', s.dataset.k === cur)); window.scrollTo(0, 0); } else if (route.y != null) window.scrollTo(0, route.y); }
$('back').onclick = () => { const up = NS.length > 1 ? NS[NS.length - 2] : null; if (up != null && LV(up) < LV(location.hash.slice(1))) history.back(); else nav(/^g[1-7]$/.test(NS[0]) ? NS[0] : ''); };
window.addEventListener('hashchange', route);
window.addEventListener('scroll', () => document.body.classList.toggle('nav-solid', document.body.classList.contains('in-detail') && window.scrollY > 160), { passive: true });
/* 한 칸이 비어 들어와 터져도 나머지 화면(오프닝·기획 연재·장)은 그려지게 — 하나씩 따로 (2026-10-25) */
[renderEra, renderMind, renderGarden, renderBody, renderBook, renderShow, route].forEach(f => { try { f(); } catch (e) { console.error(e); } });

// ── 오늘의 추천 음악 (대표 2026-10-24): 그 시절 주옥같은 노래 하루 한 곡 — 공식·원곡 영상만, 누르면 오마주 안에서 바로 ──
// 곡 목록은 data/pick.json(fixed: 날짜 지정 · pool: 날짜로 돌림), 영상은 data/song_videos.json (노래 재생기와 같은 것)
let PICK = null;
function pickToday() {
  if (!PICK || !SONGV) return null;
  const has = x => { const v = SONGV[x.k]; return v && v.v; };
  const fx = PICK.fixed && PICK.fixed[TODAY]; let it = fx && PICK.pool.find(x => x.k === fx);
  if (!it || !has(it)) { const ok = PICK.pool.filter(has); if (!ok.length) return null; it = ok[dayN() % ok.length]; }
  const [t, a] = it.k.split('|'); return { t, a, y: it.y, note: it.note, v: SONGV[it.k].v };
}
function renderPick() {
  const p = pickToday(); const body = $('pick-body');
  if (!p) { if (body) body.innerHTML = '<p class="note" style="margin-top:30px">오늘의 한 곡을 고르는 중입니다. 잠시 뒤에 다시 들러 주세요.</p>' + MOOD.html(); try { MOOD.paint(); } catch (e) {} return; }
  try { HOOKS.apply({ pick: { kick: '오늘의 음악과 함께', hook: '이어폰 꽂고, 그냥 틀어 두세요', sub: '오늘의 추천 곡 한 곡 · 분위기별 연주곡을 끊김 없이' } }); } catch (e) {}   // 칸에는 곡 이름을 내세우지 않는다 (대표 2026-10-25)
  if (body) body.innerHTML = `<div class="pk-card"><span class="pk-sec">오늘의 추천 음악</span><p class="pk-meta">${esc(p.a)}${p.y ? ' · ' + p.y : ''}</p><h2 class="pk-title">${esc(p.t)}</h2><p class="pk-note">${esc(p.note || '')}</p>`
    + `<button type="button" class="sw-vid pk-vid" data-swv="${esc(p.v)}" data-swt="${esc(p.t + ' · ' + p.a)}" aria-label="${esc(p.t)} 듣기"><img src="https://i.ytimg.com/vi/${encodeURIComponent(p.v)}/hqdefault.jpg" alt="" loading="lazy"><span class="sw-play"><i>▶</i>지금 듣기</span></button>`
    + `<p class="note">음반사·가수 공식 영상으로 틉니다. 매일 아침 새 곡이 올라와요.</p></div>`
    + MOOD.html();
  try { MOOD.paint(); } catch (e) {}
}
fetch('data/pick.json', { cache: 'no-cache' }).then(r => r.json()).then(j => { PICK = j; const wait = () => SONGV ? renderPick() : setTimeout(wait, 300); wait(); }).catch(() => {});

// ── 퀴즈 ──
$('quiz-kind').textContent = C.quiz.term ? C.quiz.term : '오늘의 ' + (C.quiz.kind || '퀴즈');
if (C.quiz.meaning) $('quiz-sub').textContent = C.quiz.meaning;
try { HOOKS.apply(HOOKS.build(C, dayN())); } catch (e) {}
// 어쩌다 점점 집사 — 칸 제목은 그날 글의 제목(집사 속마음 한 줄), 밑줄은 첫 장면
SOLO.load().then(() => { const H = {}; for (const k of Object.keys(SOLO.CORNERS)) { const a = SOLO.latest(k); if (a) H['solo-' + k] = { kick: SOLO.CORNERS[k] + (a.region ? ' · ' + a.region : ''), hook: a.title, sub: a.hook || '' }; } try { HOOKS.apply(H); } catch (e) {} });   // 혼자라서 좋은 날 — 칸 제목은 그날 글 제목
{ let colsDone = false; const colsGo = () => { if (colsDone) return; colsDone = true; document.querySelectorAll('.col-tile[data-bg]').forEach(b => { b.style.backgroundImage = `url('${b.dataset.bg}')`; }); evMod().then(m => { for (const k of ['ev', 'ai']) m.load(k).then(() => m.band(k)); }); talkMod(); };
  if (document.readyState === 'complete') setTimeout(colsGo, 300); else window.addEventListener('load', () => setTimeout(colsGo, 300)); setTimeout(colsGo, 2500); }   // 기획 칼럼 단추·사진은 첫 화면을 다 그린 뒤에 (바깥 파일이 늦어 load 가 안 와도 2.5초 뒤엔)
PET.load().then(() => { const H = {}; for (const k of ['dog', 'cat']) { const a = PET.latest(k); if (a) H[k] = { kick: (k === 'dog' ? '댕댕이' : '냥이') + (a.kind ? ' · ' + a.kind : ''), hook: a.title, sub: a.hook || '' }; } try { HOOKS.apply(H); } catch (e) {} });   // 판갈이: 오늘 즐기기 칸 제목을 썸네일처럼 (위 칸 글씨를 다 쓴 뒤에 한 번, 그릴 때 바로)
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
let deferredPrompt = window.__bip || null;   // 머리 부분에서 먼저 받아 둔 것
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; window.__bip = e; });
window.addEventListener('appinstalled', () => { DB.track('installed'); $('install-btn').hidden = true; modal(`<h2>설치되었습니다</h2><p style="font-size:1.2rem">휴대폰 <b>바탕화면</b>에서 <b>오마주</b> 아이콘을 누르면 바로 열립니다.</p><p class="note">바탕화면에 안 보이면 화면을 위로 쓸어 올려 앱 목록에서 "오마주"를 찾으세요.</p><div class="modal-actions"><button type="button" class="btn green" onclick="document.getElementById('modal-root').innerHTML=''">알겠습니다</button></div>`); });
const UA = navigator.userAgent, isIOS = /iPhone|iPad|iPod/.test(UA), inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(UA), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (standalone) $('install-btn').hidden = true;
$('install-btn').onclick = async () => {
  DB.track('install_click');
  if (inApp) {
    // 카톡 안 브라우저와 크롬은 로그인이 따로 저장된다. 로그인한 분이면 10분짜리 표를 주소에 실어
    // 크롬(그리고 거기서 깐 바탕화면 앱)도 같은 분으로 열리게 한다 (대표 2026-10-23).
    const go = ct => `intent://${location.host}${location.pathname}?install=1${ct ? '&ct=' + encodeURIComponent(ct) : ''}#Intent;scheme=https;package=com.android.chrome;end`;
    modal(`<h2>크롬으로 열어 주세요</h2><p>지금은 카톡이나 네이버 앱 안에서 열려 있어서 앱 아이콘을 설치할 수 없습니다.</p>${isIOS ? '<p>오른쪽 아래(또는 위) <b>⋯</b> 또는 <b>공유</b> 버튼을 누르고 <b>"Safari로 열기"</b>를 고르세요.</p>' : `<div class="modal-actions"><a class="btn green" id="to-chrome" style="text-align:center;text-decoration:none" href="${go('')}">크롬으로 열기</a></div>`}`);
    if (!isIOS && DB.currentUser()) {
      const a = $('to-chrome'); a.style.opacity = '.55'; a.style.pointerEvents = 'none';
      const on = () => { a.style.opacity = ''; a.style.pointerEvents = ''; };
      setTimeout(on, 4000);   // 표가 늦어도 단추가 잠겨 있지 않게
      DB.handoffToken().then(ct => { if (ct) a.href = go(ct); on(); });
    }
    return;
  }
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
  // 카톡에서 들고 온 로그인 표(ct)는 남겨 둔다 — 아래 socialReturn 이 받아 로그인하고 지운다.
  const ct = new URLSearchParams(location.search).get('ct');
  history.replaceState(null, '', location.pathname + (ct ? '?ct=' + encodeURIComponent(ct) : ''));
  setTimeout(() => modal(`<h2>앱 아이콘 설치하기</h2><p style="font-size:1.2rem">크롬으로 잘 넘어왔습니다. 아래 단추를 한 번 더 누르면 설치 창이 뜹니다.</p><div class="modal-actions"><button type="button" class="btn green" onclick="document.getElementById('modal-root').innerHTML='';document.getElementById('install-btn').click()">설치하기</button></div>`), 600);
}
$('share-btn').onclick = async () => {
  const text = '매일매일, 펼쳐 보는 즐거움.\n오늘 읽을 것, 할 것, 떠날 곳까지.\n이제는, 오마주와 함께.';
  DB.track('share');
  // 카톡 안 브라우저에는 navigator.share 가 없어 '복사했습니다'로 빠졌다 (운영자 2026-10-22).
  // 카카오 공유로 바로 보낸다 — 커버 사진과 '오마주 열어보기' 단추가 함께 간다.
  // 되던 것은 그대로 둔다 (운영자 2026-10-22). 휴대폰 기본 보내기가 있으면 그걸 먼저 —
  // 주소가 글에 그대로 실려 가고, 받는 쪽에 카톡 자체 미리 보기가 뜬다.
  // 카카오 공유는 그 기능이 아예 없는 창(카톡 안 브라우저)에서만 쓴다.
  if (navigator.share) { try { await navigator.share({ title: '오마주', text: text + '\n' + SITE }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  if (await kakaoSendIntro(text)) return;
  try { await navigator.clipboard.writeText(text + '\n' + SITE); toast('소개 글을 복사했습니다. 카톡에 붙여 넣어 보내세요.'); } catch (e) {}
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
  // 로그인·가입 화면 (운영자가 디자인해 옴, 2026-10-21): 창이 아니라 화면을 꽉 채우는 한 장.
  // 사진 주소는 바깥(Unsplash)에 걸지 않는다 — 끊기면 화면이 깨진다. 우리 그림으로 쓴다.
  modal(`<div class="gate-in">
    <p class="gate-logo"><span>오</span><span>마</span><span>주</span></p>
    <h1 class="gate-head">평생 무료로 열려 있는<br>당신만의 공간.</h1>
    <p class="gate-desc">${why ? why + ' 회원이 되셔야 합니다.<br>' : ''}가입비나 이용료 없이 오마주의 모든 이야기를 누려 보세요.<br>나의 수첩을 채우고 따뜻한 한마디를 나눌 수 있습니다.</p>
    <div class="gate-btns">
      <button type="button" class="gbtn kakao" id="g-kakao"><i aria-hidden="true"></i>카카오로 빠르게 시작하기</button>
      <button type="button" class="gbtn naver" id="g-naver"><i aria-hidden="true"></i>네이버로 빠르게 시작하기</button>
    </div>
    <p class="gate-links"><button type="button" id="g-signup">아이디로 가입하기</button><em></em><button type="button" id="g-login">이미 가입했어요, 로그인</button></p>
    <p class="gate-note">바탕화면에 바로가기 아이콘 설치해 주세요.</p>
    <button type="button" class="gate-install" id="g-install">앱 아이콘 설치하기</button>
  </div>`,
  () => {
    $('modal').classList.add('gate-lux');
    $('g-signup').onclick = openSignup; $('g-login').onclick = openLogin;
    prepKakao();
    $('g-kakao').onclick = () => kakaoLogin();
    $('g-naver').onclick = () => { location.href = '/api/naver-start'; };
    $('g-install').onclick = () => { closeModal(); $('install-btn').click(); };
  });
}
// 크롬·바탕화면 앱에서 카카오를 누르면 아이디·비밀번호를 물었다 (대표 2026-10-23) — 크롬에는 카카오 로그인이 없어서다.
// 휴대폰이면 카카오 공식 SDK 로 카카오톡 앱을 열어 '간편 로그인'을 받는다(카카오 문서: 모바일 웹에서 Kakao.Auth.authorize 는
// 카카오톡을 실행한다). 돌아오는 곳은 지금과 같은 /api/kakao-callback 이라 뒤쪽은 하나도 안 바뀐다.
// 카톡 안 브라우저는 이미 카카오에 로그인돼 있어 지금 길이 더 빠르므로 그대로 둔다. 준비가 안 됐으면 언제나 지금 길로.
let kakaoPrep = null;
// JavaScript 키 쪽 리다이렉트 URI 를 등록하고 대표 폰(크롬)에서 바로 카카오톡이 열리는 것을 확인했다 (2026-10-23 01:54).
function prepKakao() {
  if (inApp || !/Android|iPhone|iPad|iPod/.test(UA) || location.hostname !== 'omaju.kr') return;
  kakaoReady();
  fetch('/api/kakao-start?prep=1', { credentials: 'same-origin', cache: 'no-store' })
    .then(r => r.ok ? r.json() : null).then(j => { kakaoPrep = j && j.state ? j : null; }).catch(() => {});
}
function kakaoLogin() {
  const p = kakaoPrep; kakaoPrep = null;
  try {
    if (p && window.Kakao && window.Kakao.isInitialized() && window.Kakao.Auth) {
      window.Kakao.Auth.authorize({ redirectUri: 'https://omaju.kr/api/kakao-callback', state: p.state, scope: 'profile_nickname' });
      return;
    }
  } catch (e) {}
  location.href = '/api/kakao-start';
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
  // 까닭을 함께 보여 준다 — 열쇠가 다른 프로젝트 것인지, 서명이 틀렸는지 바로 가려진다.
  DB.loginWithToken(t).catch(e => toast('로그인에 실패했습니다 (' + (e && (e.code || e.message) || '알 수 없음') + ')'));
})();

// 카카오·네이버로는 들어왔지만 우리 쪽 정보가 아직 없는 분 — 짧게 세 가지만 받는다.
// (카카오·네이버가 주는 것은 회원 번호와 별명뿐이다. 태어난 해는 '그해 오늘'·'그 시절 노래'가 쓰므로 꼭 필요하다.)
DB.onNeedProfile(async () => {
  const h = await DB.socialHint();
  const years = Array.from({ length: new Date().getFullYear() - 14 - 1925 + 1 }, (_, i) => 1925 + i).reverse();
  modal(`<div class="wel-in">
  <h2>환영합니다, 오마주입니다.</h2>
  <p>다음을 입력해 주세요.</p>
  <div class="field"><label>별명 <span class="lab-sub">(새로 만드셔도 됩니다)</span></label><input id="f-nick" maxlength="12" value="${esc(h.nick || '')}" placeholder="예: 강남 멋쟁이"><div class="hint">카카오·네이버에서 가져온 이름입니다. 글을 쓸 때 보입니다.</div></div>
  <div class="field"><label>성별</label><div class="seg2" id="f-gender"><button type="button" data-g="남">남성</button><button type="button" data-g="여">여성</button></div></div>
  <div class="field"><label>태어난 해</label><select id="f-birth"><option value="">태어난 해를 고르세요</option>${years.map(y => `<option value="${y}">${y}년생</option>`).join('')}</select><div class="hint">그해 오늘·그 시절 노래에 씁니다.</div></div>
  <label class="chk"><input type="checkbox" id="f-terms"><span>(필수) <a href="terms.html" target="_blank">이용약관</a>과 <a href="privacy.html" target="_blank">개인정보처리방침</a>에 동의합니다.</span></label>
  <div class="modal-actions"><button type="button" class="btn warm" id="f-go">시작하기</button></div><div class="msg" id="f-msg"></div></div>`,
  () => {
    $('modal').classList.add('wel-lux');
    let g = '';
    $('f-gender').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; g = b.dataset.g; [...$('f-gender').children].forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
    $('f-go').onclick = async () => {
      if (!$('f-terms').checked) { $('f-msg').textContent = '약관에 동의해 주세요.'; return; }
      $('f-go').disabled = true;
      try {
        const nk = $('f-nick').value.trim();
        await DB.finishSocial({ nick: nk, gender: g, birthYear: +$('f-birth').value });
        closeModal(); setTimeout(() => welcomeHi(nk), 350);   // 닫기가 '뒤로'를 한 칸 쓰므로 그다음에 연다
      } catch (e) { $('f-msg').textContent = e.message; $('f-go').disabled = false; }
    };
    // 끝내지 않고 창을 닫으면 어중간하게 남으므로 로그인을 풀어 둔다
    $('modal-x').onclick = () => { DB.logout(); closeModal(); };
  });
});

const REGIONS = { '서울': ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'], '경기': ['수원', '성남', '고양', '용인', '부천', '안산', '안양', '남양주', '화성', '평택', '의정부', '시흥', '파주', '김포', '광명', '광주', '군포', '하남', '오산', '양주', '이천', '구리', '안성', '포천', '의왕', '여주', '양평', '동두천', '과천', '가평', '연천'], '인천': ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'], '부산': ['중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'], '대구': ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'], '광주': ['동구', '서구', '남구', '북구', '광산구'], '대전': ['동구', '중구', '서구', '유성구', '대덕구'], '울산': ['중구', '남구', '동구', '북구', '울주군'], '세종': ['세종'], '강원': ['춘천', '원주', '강릉', '동해', '태백', '속초', '삼척', '홍천', '횡성', '영월', '평창', '정선', '철원', '화천', '양구', '인제', '고성', '양양'], '충북': ['청주', '충주', '제천', '보은', '옥천', '영동', '증평', '진천', '괴산', '음성', '단양'], '충남': ['천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', '금산', '부여', '서천', '청양', '홍성', '예산', '태안'], '전북': ['전주', '군산', '익산', '정읍', '남원', '김제', '완주', '진안', '무주', '장수', '임실', '순창', '고창', '부안'], '전남': ['목포', '여수', '순천', '나주', '광양', '담양', '곡성', '구례', '고흥', '보성', '화순', '장흥', '강진', '해남', '영암', '무안', '함평', '영광', '장성', '완도', '진도', '신안'], '경북': ['포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산', '의성', '청송', '영양', '영덕', '청도', '고령', '성주', '칠곡', '예천', '봉화', '울진', '울릉'], '경남': ['창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '의령', '함안', '창녕', '고성', '남해', '하동', '산청', '함양', '거창', '합천'], '제주': ['제주시', '서귀포시'] };
function openSignup() {
  modal(`<h2>간편 회원가입 <span class="free-tag">무료</span></h2>
  <p class="free-line">가입비도 이용료도 없습니다.</p>
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
        // 하던 일(afterLogin — 예: 수첩 열기)은 환영 카드를 닫은 뒤에 이어 간다. 창 둘이 겹치면 뒤로 가기가 꼬인다.
        const wantPush = $('s-mkt').checked, nk = $('s-nick').value.trim(); closeModal();
        setTimeout(() => welcomeHi(nk, () => { if (afterLogin) afterLogin(); if (wantPush && window.openPushPicker) setTimeout(() => window.openPushPicker(true), 400); }), 350);
      } catch (e) { err.textContent = e.message; err.hidden = false; $('s-go').disabled = false; $('s-go').textContent = '가입하기'; }
    };
  });
}
// ── 구독 환영 카드 (운영자 2026-10-22) ── 구독이 끝난 바로 뒤 한 번만. 반갑게 인사하고, 처음 해 볼 세 가지를 권한다.
// 첫 줄은 '홈 화면에 놓기'(운영자 2026-10-22 — 맨 먼저). 이미 앱으로 연 사람에게는 보이지 않는다.
// 창간 며칠째·몇 번 구독자 (대표 2026-10-26 23:56 — "창간 5일째, 1207번 구독자가 되셨습니다~!")
// 번호는 api/member-no 가 그 자리에서 매겨 돌려준다. 3초 안에 못 받으면 번호 없이 연다.
async function memberNo() {
  try {
    const u = DB.auth && DB.auth.currentUser; if (!u) return null;
    const idToken = await u.getIdToken();
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch('/api/member-no', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }), signal: ctl.signal });
    clearTimeout(t); const j = await r.json(); return j && j.no ? j.no : null;
  } catch (e) { return null; }
}
async function welcomeHi(nick, after) {
  const no = await memberNo();
  const day = Math.floor((Date.parse(DB.todayKey()) - Date.parse('2026-10-22')) / 864e5) + 1;   // 창간일(10/22)이 1일째
  const who = esc(nick || '구독자');
  const canInstall = !(matchMedia('(display-mode: standalone)').matches || navigator.standalone);
  modal(`<div class="hi-in">
  <p class="hi-eye">Welcome</p>
  <h2><span class="nw">${who}님,</span> <span class="nw">반갑습니다.</span></h2>
  <p class="hi-lead"><span class="nw">오마주를 구독해 주셔서</span> <span class="nw">고맙습니다.</span><br>${no ? `<span class="nw">창간 ${day}일째,</span> <span class="nw"><b>${no}번</b> 구독자가</span> <span class="nw">되셨습니다~!</span>` : `<span class="nw">매일 아침,</span> <span class="nw">새 호가 기다리고 있을게요.</span>`}</p>
  ${founderNow() ? `<p class="hi-fd"><span class="nw">창간 첫 달에 함께해 주신</span> <span class="nw"><b>창간 독자</b>이십니다.</span></p>` : ''}
  ${canInstall ? `<button type="button" class="hi-feat" data-hi="install">
    <span class="hi-app" aria-hidden="true"><img src="icon-192.png" alt=""><em>오마주</em></span>
    <span class="hi-ft"><b>홈 화면에 오마주 놓기</b><small><span class="nw">아이콘 하나로</span> <span class="nw">매일 아침 바로 열려요</span></small><span class="hi-now">지금 설치하기</span></span>
  </button>` : ''}
  <p class="hi-sub">${canInstall ? '그리고' : '처음이시라면'}</p>
  <ol class="hi-list">
    ${OPENING_ON ? `<li><button type="button" data-hi="open"><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#3A86A8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/></svg></i><span><b>오늘의 오프닝 듣기</b><small>오늘 이야기를 들려드려요</small></span></button></li>` : ''}
    <li><button type="button" data-hi="card"><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#3A86A8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/></svg></i><span><b>인사 카드 한 장 보내기</b><small>마음 가는 분께 카톡으로</small></span></button></li>
  </ol>
  <button type="button" class="hi-go" id="hi-go">오마주 들어가기</button>
</div>`, () => {
    $('modal').classList.add('wel-hi');
    const done = then => { closeModal(); setTimeout(() => { if (then) then(); else if (after) after(); }, 350); };
    $('hi-go').onclick = () => done();
    $('modal-root').querySelector('.hi-in').onclick = e => {
      const b = e.target.closest('[data-hi]'); if (!b) return; DB.track('welcome_' + b.dataset.hi);
      if (b.dataset.hi === 'open') done(() => { nav(''); setTimeout(() => $('opening')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200); });
      if (b.dataset.hi === 'card') done(() => { nav('g1'); setTimeout(() => $('cards')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300); });
      if (b.dataset.hi === 'install') done(() => $('install-btn').click());
    };
  });
}
window.welcomeHi = welcomeHi;   // 시안·시험용
window.__memberNo = memberNo;
window.__memberCard = memberCard;   // 시안·시험용
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
// ── 창간 독자 (운영자 2026-10-22) ── 창간(10/22 18:00)부터 한 달(11/22 18:00) 안에 구독한 분. 본인에게만 보인다.
// 번호(founderNo)는 관리자 '구독자' 탭에서 매긴다. 운영자(관리자)와 '창간 번호 빼기' 한 계정은 아니다.
const FOUNDER_END = Date.UTC(2026, 10, 22, 9, 0);   // 2026-11-22 18:00 KST
const isFounder = p => !!p && p.role !== 'admin' && !p.noFounder && (!!p.founderNo || (p.createdAt && p.createdAt.toMillis && p.createdAt.toMillis() < FOUNDER_END));
const founderNow = () => Date.now() < FOUNDER_END;
const fdNo = n => 'No. ' + String(n).padStart(5, '0');   // 만 단위 다섯 자리 (운영자 2026-10-23) — 넘으면 저절로 자리가 는다
// 멤버십 카드 (대표 2026-10-27: "프라이드를 갖게, 소속감을 갖게" — 대표가 준 시안: 샴페인 골드 '구독자 카드')
function memberCard(p) {
  const d = p.createdAt && p.createdAt.toDate ? p.createdAt.toDate() : null;
  const since = d ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` : '—';
  const boss = p.role === 'admin', fd = boss || isFounder(p);   // 대표(관리자)는 '발행인' No. OMJ-00001
  const visits = p.visitDays || 2;   // 방문 일수 — 하루에 여러 번 와도 한 번
  const no = boss ? 'OMJ-00001' : p.founderNo ? 'OMJ-' + String(p.founderNo).padStart(5, '0') : '—';
  const g = boss ? ['발행인', 'PUBLISHER'] : fd ? ['창간멤버', 'FOUNDING MEMBER'] : ['멤버', 'MEMBER'];
  // 바코드는 번호로 그리는 무늬(읽히는 바코드 아님)
  const seed = String(p.founderNo || 0).padStart(5, '0') + '0MAJU'; let bars = '', x = 0;
  for (let k = 0; k < 34; k++) { const w = 1 + ((seed.charCodeAt(k % seed.length) + k * 7) % 3); if (k % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="30"/>`; x += w + 1; }
  // 바탕은 대표가 재미나이로 만든 빈 카드 그림(img/member-card.jpg) — 글씨만 사람마다 얹는다
  return `<div class="mcard2${fd ? ' fd' : ''}" role="img" aria-label="오마주 구독자 카드 — ${esc(p.nick)} 님, ${g[0]}, 구독 번호 ${no}, 방문 ${visits}일">
    <b class="m2-name">${esc(p.nick)} 님</b>
    <span class="m2-since">${since}</span>
    <span class="m2-no">${no}</span>
    <b class="m2-grade">${g[0]}<small>${g[1]}</small></b>
    <span class="m2-visit"><i>방문일수</i> ${visits.toLocaleString()}일</span>
  </div>`;
}
async function openMy() {
  const p = DB.currentProfile();
  if (!p) { toast('정보를 불러오지 못했습니다. 새로고침한 뒤 다시 눌러 주세요.'); return; }
  // 나의 정보 (운영자 2026-10-23 — "촌스럽다, 출석 달력은 왜 있나") — 환영 카드와 같은 '사진 + 흰 종이' 꼴, 달력은 빼고 한 줄로.
  modal(`<div class="my-in">
  ${memberCard(p)}
  <div class="my-f"><label>글자 크기</label><div class="in"><button type="button" class="btn line" id="m-size-big">크게</button><button type="button" class="btn line" id="m-size-normal">보통</button></div></div>
  <div class="my-f"><label>별명</label><div class="in"><input id="m-nick" value="${esc(p.nick)}" maxlength="12"><button type="button" class="btn line" id="m-nick-go">바꾸기</button></div><div class="msg" id="m-nick-msg"></div></div>
  ${p.username ? `<div class="my-f"><label>비밀번호</label><div class="in"><input id="m-pw" type="password" inputmode="numeric" maxlength="6" placeholder="새 비밀번호 숫자 6자리"><button type="button" class="btn line" id="m-pw-go">바꾸기</button></div><div class="msg" id="m-pw-msg"></div></div>` : ''}
  </div>`,
  () => {
    $('modal').classList.add('wel-my');
    const szOn = () => { const b = document.documentElement.classList.contains('big'); $('m-size-big').setAttribute('aria-pressed', b); $('m-size-normal').setAttribute('aria-pressed', !b); };
    szOn();
    $('m-size-big').onclick = () => { applySize(true); store.set('big', true); szOn(); toast('글자를 크게 했습니다.'); };
    $('m-size-normal').onclick = () => { applySize(false); store.set('big', false); szOn(); toast('글자를 보통으로 했습니다.'); };
    $('m-nick-go').onclick = async () => { const m = $('m-nick-msg'); try { await DB.changeNick($('m-nick').value); m.className = 'msg ok'; m.textContent = '바꿨습니다.'; const q = DB.currentProfile(), h = new Date().getHours(); $('user-nick').textContent = q.nick + ' 님, 반갑습니다.'; store.set('hello', { s: 'in', n: q.nick, f: isFounder(q) ? 1 : 0 }); /* 별명만 남고 인사가 빠지던 것 (대표 2026-10-23) */ } catch (e) { m.className = 'msg err'; m.textContent = e.message; } };
    if ($('m-pw-go')) $('m-pw-go').onclick = async () => { const m = $('m-pw-msg'); try { await DB.changePw($('m-pw').value); m.className = 'msg ok'; m.textContent = '바꿨습니다.'; } catch (e) { m.className = 'msg err'; m.textContent = e.code === 'auth/requires-recent-login' ? '안전을 위해 나갔다가 다시 로그인한 뒤 바꿔 주세요.' : e.message; } };
  });
}
$('login-btn').onclick = () => openGate('');
$('logout').onclick = async () => {
  try { await DB.logout(); } catch (e) { toast('로그아웃에 실패했습니다 (' + (e && (e.code || e.message) || '알 수 없음') + ')'); return; }
  // 파이어베이스가 끝내 대답하지 않아도 화면은 나간 모습이 되게 — 적어 둔 인사말도 지운다
  store.set('hello', { s: 'out' }); $('fd-badge').hidden = true;
  $('user-chip').hidden = true; $('login-btn').hidden = false;
  toast('나갔습니다. 내일 또 뵙겠습니다.');
};
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
  if (u && p) { $('user-nick').textContent = p.nick + ' 님, 반갑습니다.'; if (p.zodiac && !myZ) { myZ = p.zodiac; renderZ(); } wxByRegion(p); if (p.region && !store.get('outRegion', null)) { outRegion = p.region.split(' ')[0]; renderOuting(); } }
  // 다음에 열 때 인사말을 그리기 전에 띄울 수 있게 적어 둔다 (늦게 띄우면 화면이 한 번 밀린다)
  $('fd-badge').hidden = !isFounder(p);
  store.set('hello', u && p ? { s: 'in', n: p.nick, f: isFounder(p) ? 1 : 0 } : { s: 'out' });
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
    head.style.backgroundImage = `url('img/${img}.jpg?v=2')`;
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
import('./hometown.js?v=10221640').then(m => { m.init({ toast, modal, closeModal, esc, store, DB }); m.load(); }).catch(e => console.warn('hometown', e));
// 오늘의 오프닝 — 당분간 쉰다 (대표 2026-10-26: "구독자·방문자가 많지 않으니 내려놓자, 나중에 다시"). 다시 켜려면 OPENING_ON = true
// + tools/opening.py 예약(opening.yml schedule · api/tick.js · vercel.json) + 예약 작업 '오프닝 대본 쓰기'·'오프닝 새벽 점검' 을 되살린다.
if (OPENING_ON) import('./opening.js?v=10250140').then(m => m.init({ modal, closeModal, toast, DB })).catch(e => console.warn('opening', e));
