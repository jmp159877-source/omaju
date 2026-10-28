
// 휴대폰에서 표를 카드처럼 보이게: 각 칸에 머리글 이름을 붙인다
function labelize(t) { const hs = [...t.querySelectorAll('th')].map(h => h.textContent); t.querySelectorAll('tr').forEach(tr => [...tr.children].forEach((td, i) => { if (td.tagName === 'TD' && hs[i]) td.dataset.l = hs[i]; })); }
import * as DB from './db.js';
import { DEFAULT_CONTENT } from './content.js';
import { renderDash, hbars, card } from './admin_dash.js?v=10281640';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, where, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const db = DB.db, TODAY = DB.todayKey();
const md = ts => { if (!ts || !ts.toDate) return ''; const d = ts.toDate(), z = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${z(d.getHours())}:${z(d.getMinutes())}`; };   // 회원 표: 한 줄로 '10/22 18:52'
const fmt = ts => ts && ts.toDate ? ts.toDate().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const dayOffset = n => { const d = new Date(); d.setDate(d.getDate() + n); return DB.todayKey(d); };

$('a-go').onclick = async () => { $('err').textContent = ''; try { await DB.login($('a-id').value, $('a-pw').value); } catch (e) { $('err').textContent = e.message; } };
$('a-pw').onkeydown = e => { if (e.key === 'Enter') $('a-go').click(); };
$('a-out').onclick = () => DB.logout();
DB.onUser((u, p) => {
  const ok = u && p && p.role === 'admin';
  $('gate').hidden = !!ok; $('panel').hidden = !ok;
  if (u && !ok) { $('err').textContent = '관리자 권한이 없는 계정입니다.'; DB.logout(); }
  if (ok) { $('who').textContent = p.nick; loadToday(); }
});
document.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-pressed', x === b)); document.querySelectorAll('.sec').forEach(s => s.classList.toggle('on', s.dataset.sec === b.dataset.tab)); ({ today: loadToday, dash: () => { if (!loadDash.done) { loadDash.done = true; loadDash(); } }, users: loadUsers, content: () => { $('c-date').value = TODAY; loadContent(); }, comments: () => { $('m-date').value = TODAY; loadComments(false); }, resets: loadResets, blog: () => { if (!$('b-date').value) $('b-date').value = TODAY; loadBlog(); }, notice: loadNotice, maint: loadMaint, musicbox: loadMusicbox, stories: loadStories })[b.dataset.tab]?.(); };

// ── 오늘 현황 (대표 2026-10-26: "당분간 매일 체크 — 오늘 방문, 어디서 들어왔는지, 누가 들어왔는지") ──
const SRC = { naver_search: '네이버 검색', naver_blog: '네이버 블로그', naver_cafe: '네이버 카페', daum: '다음 검색', direct: '직접 (주소·홈 화면·북마크)', kakao: '카카오톡', naver: '네이버 앱 (검색 아닌 곳)', google: '구글 검색', yt: '유튜브', blog: '블로그 링크', search: '검색용 글 쪽', card: '받은 인사 카드', psy: '심리 테스트 결과', kid: '유튜브 자녀 편', story: '구글 웹 스토리', band: '밴드', insta: '인스타그램', facebook: '페이스북', bing: '빙', etc: '그 밖의 곳' };
$('t-reload').onclick = () => loadToday();
// 지금 보는 분 (대표 2026-10-27 — "5분마다 한 번씩 봐도 돼") — 화면을 보는 기기가 3분마다 live/ 에 남기는 것을 6분 안 것만 센다
const LIVE_NM = { home: '첫 화면', g1: '오늘 즐기기', g2: '그때 돌아보기', g3: '앞으로 나아가기', g4: '나를 돌보기', g5: '집사', g6: '나의 수첩', g7: '혼자라서 좋은 날', talk: '사랑방', food: '한 끼', book: '한 권', quiz: '시사 상식', culture: '문화', play: 'PLAY', ev: '전기차 연재', ai: 'AI 연재' };
async function paintLive() {
  const el = $('ad-now'); if (!el) return;
  try {
    const L = await DB.listLive(), mem = L.filter(x => x.m).length;
    const where = {}; L.forEach(x => { const k = LIVE_NM[x.ch] || x.ch; where[k] = (where[k] || 0) + 1; });
    const w = Object.entries(where).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${v}`).join(' · ');
    const t = new Date(), hm = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    el.querySelector('b').textContent = L.length + '명';
    el.querySelector('small').innerHTML = L.length ? `구독자 ${mem} · 비회원 ${L.length - mem}${w ? '<br>' + w : ''}<br><i>${hm} 기준 · 5분마다 새로</i>` : `<i>${hm} 기준 · 5분마다 새로</i>`;
  } catch (e) { el.querySelector('small').textContent = '읽지 못했어요: ' + (e.code || e.message); }
}
setInterval(() => { if (!document.hidden) paintLive(); }, 300000);
async function loadToday() {
  const el = $('today-board');
  try {
    const st = (await getDoc(doc(db, 'stats', TODAY))).data() || {};
    const users = (await getDocs(collection(db, 'users'))).docs.map(d => ({ id: d.id, ...d.data() }));
    const seen = users.filter(u => u.lastSeenDay === TODAY).sort((a, b) => ((b.lastSeen && b.lastSeen.toMillis()) || 0) - ((a.lastSeen && a.lastSeen.toMillis()) || 0));
    const joined = users.filter(u => u.createdAt && u.createdAt.toDate && DB.todayKey(u.createdAt.toDate()) === TODAY);
    let talk = [];
    try { talk = (await getDocs(query(collection(db, 'talk'), where('date', '==', TODAY)))).docs.map(d => d.data()).filter(t => !t.seed && !t.host); } catch (e) {}
    const hm = t => { if (!t || !t.toDate) return ''; const d = t.toDate(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    // 어디서: 새로 세는 src(10/26 오후부터) + 예전부터 세던 꼬리표(blog·yt·search·card·psy·kid·story)
    const src = { ...(st.src || {}) };
    for (const [k, v] of Object.entries(st)) if (k.startsWith('src.')) src[k.slice(4)] = (src[k.slice(4)] || 0) + v;   // 10/26 오후 잘못 들어간 'src.○○' 칸도 함께
    if (!st.src) for (const k of ['blog', 'yt', 'search', 'card', 'psy', 'kid', 'story']) if (st[k]) src[k] = st[k];
    const srcRows = Object.entries(src).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([k, v]) => [SRC[k] || k, v]);
    const hours = { ...(st.hours || {}) }; for (const [k, v] of Object.entries(st)) if (k.startsWith('hours.')) hours[k.slice(6)] = (hours[k.slice(6)] || 0) + v; const hRows = Object.keys(hours).sort().map(h => [`${+h}시`, hours[h]]);
    const NM = { greeting: '인사말', fortune: '운세', luck: '운세', food: '한 끼', book: '한 권', quiz: '시사 상식', culture: '문화', play: '오늘 PLAY', history: '그해 오늘', music: '그 시절 노래', talk: '사랑방', ev: '전기차 시대', ai: 'AI 시대', dog: '댕댕이', cat: '냥이', pick: '추천 음악', psy: '심리 테스트' };
    const clicks = Object.entries(st.clicks || {}).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => [NM[k] || k, v]);
    const big = (k, v, note) => `<div class="ad-big"><small>${esc(k)}</small><b>${(v || 0).toLocaleString()}</b>${note ? `<i>${esc(note)}</i>` : ''}</div>`;
    const who = seen.length ? '<ul class="t-who">' + seen.map(u => `<li><b>${esc(u.nick)}</b>${u.role === 'admin' ? ' <small>(관리자)</small>' : ''}${joined.includes(u) ? ' <em>오늘 구독</em>' : ''}<span>${hm(u.lastSeen)} · ${u.via === 'kakao' ? '카카오' : u.via === 'naver' ? '네이버' : '아이디'} 가입 · 출석 ${u.checkinCount || 0}번</span></li>`).join('') + '</ul>' : '<p class="ad-empty">오늘 들른 구독자가 아직 없어요</p>';
    el.innerHTML = `<div class="ad-nowbar" id="ad-now"><span class="dot"></span><b>…</b> 지금 보는 분<small></small></div><div class="ad-bigs five">${big('오늘 방문', st.visits, '기기마다 하루 한 번')}${big('처음 온 기기', st.newDevices)}${big('들른 구독자', seen.length)}${big('오늘 구독', joined.length)}${big('검색으로 온 분', ['naver_search', 'google', 'daum', 'bing', 'search'].reduce((t, k) => t + (src[k] || 0), 0), '네이버·구글·다음 검색')}</div><div class="ad-grid">`
      + card('어디서', '어디서 들어왔나', hbars(srcRows, { empty: '아직 없음 — 들어온 곳은 10/26 오후부터 셉니다' }) + '<p class="note">\'네이버 검색\'은 네이버에서 검색해 오마주를 눌러 온 분 — 모르는 분이 들어오는 가장 중요한 숫자입니다(10/26 밤부터 셉니다). 카카오톡으로 받은 링크는 \'카카오톡\', 주소를 직접 치거나 홈 화면 아이콘은 \'직접\'.</p>', true)
      + card('누가', '오늘 들른 구독자', who + '<p class="note">구독하지 않은 분은 누구인지 알 수 없어 숫자로만 셉니다.</p>', true)
      + card('언제', '몇 시에 들어왔나', hbars(hRows, { empty: '아직 없음 — 10/26 오후부터 셉니다' }))
      + card('무엇을', '오늘 많이 누른 코너', hbars(clicks, { empty: '아직 없음' }))
      + card('사랑방', '오늘 독자가 쓴 글', talk.length ? '<ul class="t-talk">' + talk.map(t => `<li><b>${esc(t.nick)}</b> ${esc(t.text)}</li>`).join('') + '</ul>' : '<p class="ad-empty">아직 없음</p>', true) + '</div>';
    paintLive(); $('t-at').textContent = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) + ' 기준';
  } catch (e) { el.innerHTML = '<p class="note">오늘 현황을 불러오지 못했어요: ' + esc(e.message) + ' (사이트 저장소 하루 읽기 한도에 걸렸으면 오후 4시 뒤에 다시 보세요)</p>'; }
}

// ── 현황 ──
async function loadDash() {
  const users = (await getDocs(collection(db, 'users'))).docs.map(d => d.data());
  const today = users.filter(u => u.lastSeenDay === TODAY).length;
  const week = users.filter(u => u.lastSeenDay >= dayOffset(-6)).length;
  const sToday = (await getDoc(doc(db, 'stats', TODAY))).data() || {};
  const joined = users.filter(u => u.createdAt && DB.todayKey(u.createdAt.toDate()) === TODAY).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  // 위 숫자 칸·그래프는 admin_dash.js 가 그린다 (대표 2026-10-25 "세련되게, 그래픽 차트로")
  // 오늘 가입한 사람 (운영자 2026-10-22 — 숫자만 보이니 누가 들어왔는지 회원 탭까지 가야 했다)
  const hm = t => { const d = t.toDate(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  $('joined').innerHTML = joined.length ? '<tr><th>별명</th><th>구독 시각</th><th>성별</th><th>태어난 해</th></tr>' + joined.map(u => `<tr><td>${esc(u.nick)}</td><td>${hm(u.createdAt)}</td><td>${esc(u.gender || '')}</td><td>${u.birthYear ? u.birthYear + '년생' : ''}</td></tr>`).join('') : '<tr><td>오늘은 아직 없음</td></tr>'; labelize($('joined'));
  paintNoCount();
  // 누적 (창간 10/22 부터) — 날마다의 방문을 더한 것과, 처음 온 기기를 더한 것(10/23 부터 셈)
  const all = (await getDocs(collection(db, 'stats'))).docs.filter(d => d.id >= '2026-10-22').map(d => ({ day: d.id, ...d.data() }));
  const sum = (from, f) => all.filter(x => x.day >= from).reduce((t, x) => t + (x[f] || 0), 0);
  $('cumul').innerHTML = '<tr><th>기간</th><th>방문(날마다 더함)</th><th>처음 온 기기</th><th>블로그에서 옴</th><th>유튜브에서 옴</th><th>검색에서 옴</th><th>카드 받고 옴</th><th>테스트 받고 옴</th></tr>' + [['오늘', TODAY], ['창간 이후', '2026-10-22'], ['최근 30일', dayOffset(-29)], ['최근 10일', dayOffset(-9)], ['최근 7일', dayOffset(-6)]]
    .map(([k, from]) => `<tr><td>${k}</td><td>${sum(from, 'visits').toLocaleString()}</td><td>${sum(from, 'newDevices').toLocaleString()}</td><td>${sum(from, 'blog').toLocaleString()}</td><td>${sum(from, 'yt').toLocaleString()}</td><td>${sum(from, 'search').toLocaleString()}</td><td>${sum(from, 'card').toLocaleString()}</td><td>${sum(from, 'psy').toLocaleString()}</td></tr>`).join(''); labelize($('cumul'));
  const NAMES = { greeting: '인사말', fortune: '운세', dream: '꿈 해몽', luck: '운세 · 꿈 해몽', food: '한 끼', book: '한 권', quiz: '시사 상식', culture: '문화', play: '오늘 PLAY', history: '그해 오늘', music: '그 시절 노래', talk: '사랑방', ev: '전기차 시대', ai: 'AI 시대', dog: '댕댕이', cat: '냥이', pick: '추천 음악', psy: '심리 테스트', mind: '마음 한 줄', body: '몸 한 가지', hike: '오늘의 산', move: '몸 풀기', show: '무엇을 볼까', outing: '나들이', phrase: '여행', follow: '따라하기', story: '사연' };
  const start = dayOffset(-29) > '2026-10-22' ? dayOffset(-29) : '2026-10-22';
  const days30 = []; for (let d = new Date(start + 'T12:00:00'); DB.todayKey(d) <= TODAY; d.setDate(d.getDate() + 1)) days30.push(DB.todayKey(d));
  const stats = {}; all.forEach(x => { stats[x.day] = x; });
  const U = users.map(u => ({ joined: u.createdAt && u.createdAt.toDate ? DB.todayKey(u.createdAt.toDate()) : '', gender: u.gender, birthYear: u.birthYear, region: u.region, lastSeenDay: u.lastSeenDay }));
  try { renderDash($('dash-board'), { users: U, stats, today: TODAY, days30, joinedToday: joined, clicks: sToday.clicks || {}, names: NAMES }); } catch (e) { console.error(e); $('dash-board').innerHTML = '<p class="note">현황 그림을 그리지 못했어요: ' + esc(e.message) + '</p>'; }
}

// 이 기기는 방문 수에서 빼기 (운영자 2026-10-22 — 운영자 폰·PC 가 하루 방문 수에 섞였다)
// 같은 주소(omaju.kr)라 index.html 의 bumpVisit 이 이 표시를 본다. 브라우저마다 따로라 폰·PC 각각 한 번 누른다.
const NC = 'omaju.noCount';
function paintNoCount() {
  let on = false; try { on = localStorage.getItem(NC) === '1'; } catch (e) {}
  $('nocount').textContent = on ? '이 기기는 방문 수에서 빠져 있음 · 다시 세기' : '이 기기는 방문 수에서 빼기';
  $('nocount').setAttribute('aria-pressed', on);
}
$('nocount').onclick = () => { try { localStorage.getItem(NC) === '1' ? localStorage.removeItem(NC) : localStorage.setItem(NC, '1'); } catch (e) {} paintNoCount(); };

// ── 회원 ──
let allUsers = [];
// 창간 독자 번호 (운영자 2026-10-22) — 대표가 정한 사람부터 1번. 빈 칸 채우기는 구독 순서대로 이어 붙인다.
const FOUNDER_END = Date.UTC(2026, 10, 22, 9, 0);
const fdOk = u => u.role !== 'admin' && !u.noFounder && (u.founderNo || (u.createdAt && u.createdAt.toMillis() < FOUNDER_END));
const fdCell = u => u.role === 'admin' ? '' : u.noFounder ? `<button type="button" data-fdback="${u.id}">다시 넣기</button>` : fdOk(u) ? `<input class="fd-in" data-fdno="${u.id}" inputmode="numeric" size="3" value="${u.founderNo || ''}" placeholder="—"><button type="button" data-fdx="${u.id}" title="창간 독자에서 빼기">×</button>` : '';
async function fillFounders() {
  const all = (await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'asc')))).docs.map(d => ({ id: d.id, ...d.data() }));
  let n = Math.max(1205, ...all.map(u => u.founderNo || 0)), done = 0;   // 새로 오는 분은 1206번부터 (대표 2026-10-26, 그전엔 125번부터) — tools/founder.py 와 같은 규칙
  for (const u of all) if (fdOk(u) && !u.founderNo) { n++; await updateDoc(doc(db, 'users', u.id), { founderNo: n }); done++; }
  $('fd-msg').textContent = done ? `${done}명에게 번호를 매겼습니다 (마지막 ${n}번).` : '새로 매길 사람이 없습니다.';
  loadUsers();
}
$('fd-fill').onclick = fillFounders;
async function loadUsers() {
  allUsers = (await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))).docs.map(d => ({ id: d.id, ...d.data() }));
  renderUsers(allUsers);
}
function renderUsers(list) {
  $('u-count').textContent = list.length + '명';
  $('users').innerHTML = '<tr><th>별명</th><th>창간</th><th>성별</th><th>출생</th><th>구독 경로</th><th>연락처</th><th>구독</th><th>마지막</th><th>출석</th><th></th></tr>' + list.slice(0, 300).map(u => `<tr><td>${esc(u.nick)}${u.role === 'admin' ? ' <small>(관리자)</small>' : ''}${u.banned ? ' <small style="color:#a93226">(정지)</small>' : ''}</td><td>${fdCell(u)}</td><td>${esc(u.gender || '')}</td><td>${u.birthYear || ''}</td><td>${u.via === 'kakao' ? '카카오' : u.via === 'naver' ? '네이버' : esc(u.username || '')}</td><td>${esc(u.phone)}</td><td>${md(u.createdAt)}</td><td>${esc((u.lastSeenDay || '').slice(5).replace('-', '/'))}</td><td>${u.checkinCount || 0}</td><td>${u.role === 'admin' ? '' : `<button type="button" data-ban="${u.id}" class="${u.banned ? '' : 'danger'}">${u.banned ? '정지 풀기' : '정지'}</button><button type="button" data-del="${u.id}" class="danger">삭제</button>`}</td></tr>`).join(''); labelize($('users'));
}
$('u-find').onclick = () => { const q = $('u-q').value.trim().toLowerCase(); renderUsers(q ? allUsers.filter(u => [u.nick, u.username, u.phone].some(x => (x || '').toLowerCase().includes(q))) : allUsers); };
// 회원 삭제 (운영자 2026-10-22 — 시험으로 만든 계정 정리). 회원 문서와 아이디·별명 자리를 지운다.
// 카카오·네이버 로그인 자체는 남으므로 그 사람이 다시 들어오면 처음 온 사람처럼 가입 창이 뜬다.
async function dropUser(u) {
  const mine = async (col, key) => { if (!key) return; const r = doc(db, col, key), s = await getDoc(r); if (s.exists() && s.data().uid === u.id) await deleteDoc(r); };
  await mine('nicknames', u.nickKey); await mine('usernames', u.username);
  await deleteDoc(doc(db, 'users', u.id));
}
$('users').addEventListener('change', async e => { const i = e.target.closest('[data-fdno]'); if (!i) return; const v = parseInt(i.value, 10); await updateDoc(doc(db, 'users', i.dataset.fdno), { founderNo: v > 0 ? v : null }); i.style.background = '#e5f4e4'; });
$('users').addEventListener('click', async e => {
  const x = e.target.closest('[data-fdx]'), back = e.target.closest('[data-fdback]');
  if (x && confirm('이 분을 창간 독자에서 뺄까요? (번호도 지워집니다)')) { await updateDoc(doc(db, 'users', x.dataset.fdx), { noFounder: true, founderNo: null }); loadUsers(); }
  if (back) { await updateDoc(doc(db, 'users', back.dataset.fdback), { noFounder: false }); loadUsers(); }
});
$('users').onclick = async e => { const d = e.target.closest('[data-del]'); if (d) { const u = allUsers.find(x => x.id === d.dataset.del); if (!u || !confirm(`'${u.nick}' 구독자를 삭제할까요?\n되돌릴 수 없습니다.`)) return; d.disabled = true; try { await dropUser(u); } catch (err) { alert('삭제하지 못했습니다: ' + (err.code || err.message)); } loadUsers(); return; } const b = e.target.closest('[data-ban]'); if (!b) return; const u = allUsers.find(x => x.id === b.dataset.ban); if (!confirm((u.banned ? '정지를 풀까요? ' : '이 구독자를 정지할까요? ') + u.nick)) return; await updateDoc(doc(db, 'users', u.id), { banned: !u.banned }); loadUsers(); };

// ── 오늘 콘텐츠 ──
async function loadContent() {
  const d = $('c-date').value; const s = await getDoc(doc(db, 'daily', d));
  $('c-json').value = JSON.stringify(s.exists() ? s.data() : DEFAULT_CONTENT, null, 2);
  const x = s.exists() ? s.data() : null; $('c-msg').textContent = x ? (x.source === 'auto' ? '자동으로 만들어진 내용입니다. ' + (x.generatedAt || '').slice(0, 16).replace('T', ' ') + (x.errors && x.errors.length ? ' · 못 만든 코너: ' + x.errors.map(e => e.split(':')[0]).join(', ') : '') : '관리자가 저장한 내용입니다.') : '저장된 것이 없어 기본 내용을 보여 줍니다.';
}
$('c-load').onclick = loadContent;
$('c-default').onclick = () => { $('c-json').value = JSON.stringify(DEFAULT_CONTENT, null, 2); };
$('c-save').onclick = async () => {
  let data; try { data = JSON.parse($('c-json').value); } catch (e) { $('c-msg').textContent = '모양이 틀렸습니다. 따옴표나 쉼표를 확인해 주세요. (' + e.message + ')'; return; }
  data.source = 'admin'; data.editedAt = new Date().toISOString(); delete data.errors;
  await setDoc(doc(db, 'daily', $('c-date').value), data); $('c-msg').textContent = $('c-date').value + ' 저장했습니다. (관리자가 고친 날은 자동 생성이 덮어쓰지 않습니다)';
};

// ── 한마디·신고 ──
async function loadComments(onlyReported) {
  const q = onlyReported ? query(collection(db, 'comments'), where('reports', '>', 0), orderBy('reports', 'desc'), limit(100)) : query(collection(db, 'comments'), where('date', '==', $('m-date').value));
  const list = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  $('comments').innerHTML = '<tr><th>날짜</th><th>별명</th><th>내용</th><th>신고</th><th></th></tr>' + (list.map(c => `<tr style="${c.hidden ? 'opacity:.5' : ''}"><td>${esc(c.date)}</td><td>${esc(c.nick)}</td><td>${esc(c.text)}</td><td>${c.reports || 0}</td><td><button type="button" data-hide="${c.id}" data-h="${c.hidden ? 0 : 1}">${c.hidden ? '다시 보이기' : '숨기기'}</button><button type="button" data-rm="${c.id}" class="danger">삭제</button></td></tr>`).join('') || '<tr><td colspan="5">없음</td></tr>'); labelize($('comments'));
}
$('m-load').onclick = () => loadComments(false); $('m-reported').onclick = () => loadComments(true);
$('comments').onclick = async e => { const h = e.target.closest('[data-hide]'), r = e.target.closest('[data-rm]'); if (h) await updateDoc(doc(db, 'comments', h.dataset.hide), { hidden: h.dataset.h === '1' }); if (r && confirm('삭제할까요?')) await deleteDoc(doc(db, 'comments', r.dataset.rm)); if (h || r) loadComments(false); };

// ── 찾기 요청 ──
async function loadResets() {
  const list = (await getDocs(query(collection(db, 'resets'), orderBy('ts', 'desc'), limit(100)))).docs.map(d => ({ id: d.id, ...d.data() }));
  const rows = await Promise.all(list.map(async r => { let m = '아이디 없음'; if (r.username && r.username !== 'unknown') { const u = await getDoc(doc(db, 'usernames', r.username)); if (u.exists()) { const p = (await getDoc(doc(db, 'users', u.data().uid))).data(); m = p ? (p.phone === r.phone ? '연락처 일치 ✓ (' + esc(p.nick) + ')' : '연락처 불일치 ✗') : '구독자 정보 없음'; } } return `<tr style="${r.done ? 'opacity:.5' : ''}"><td>${fmt(r.ts)}</td><td>${esc(r.username)}</td><td>${esc(r.phone)}</td><td>${m}</td><td>${r.done ? '완료' : `<button type="button" data-done="${r.id}">처리 완료</button>`}</td></tr>`; }));
  $('resets').innerHTML = '<tr><th>요청</th><th>아이디</th><th>연락처</th><th>확인</th><th></th></tr>' + (rows.join('') || '<tr><td colspan="5">없음</td></tr>'); labelize($('resets'));
}
$('resets').onclick = async e => { const b = e.target.closest('[data-done]'); if (!b) return; await updateDoc(doc(db, 'resets', b.dataset.done), { done: true }); loadResets(); };

// ── 공지 ──
async function loadNotice() { const n = await DB.loadNotice(); $('n-text').value = n ? n.text : ''; }
$('n-save').onclick = async () => { const t = $('n-text').value.trim(); if (!t) return; const old = await getDocs(query(collection(db, 'notices'), where('active', '==', true))); await Promise.all(old.docs.map(d => updateDoc(d.ref, { active: false }))); await addDoc(collection(db, 'notices'), { text: t, active: true, ts: serverTimestamp() }); $('n-msg').textContent = '올렸습니다.'; };
$('n-off').onclick = async () => { const old = await getDocs(query(collection(db, 'notices'), where('active', '==', true))); await Promise.all(old.docs.map(d => updateDoc(d.ref, { active: false }))); $('n-text').value = ''; $('n-msg').textContent = '내렸습니다.'; };

// ── 점검 모드 ──
async function loadMaint() { const s = await getDoc(doc(db, 'settings', 'maint')); const m = s.exists() ? s.data() : {}; $('mt-text').value = m.text || ''; $('mt-msg').textContent = m.on ? '지금 점검 모드가 켜져 있습니다.' : '꺼져 있습니다.'; }
$('mt-on').onclick = async () => { await setDoc(doc(db, 'settings', 'maint'), { on: true, text: $('mt-text').value.trim(), ts: serverTimestamp() }); $('mt-msg').textContent = '켰습니다. 방문자에게 안내가 보입니다.'; };
$('mt-off').onclick = async () => { await setDoc(doc(db, 'settings', 'maint'), { on: false, text: '', ts: serverTimestamp() }); $('mt-msg').textContent = '껐습니다.'; };

// ── 오마주 뮤직박스 (대표 2026-10-26: "가끔 골라서 바꿀 수 있게") — settings/musicbox.k ──
async function loadMusicbox() {
  const { MOODS } = await import('./mood.js?v=10261940');
  const s = await getDoc(doc(db, 'settings', 'musicbox')); const k = (s.exists() && s.data().k) || 'drive';
  $('mb-list').innerHTML = MOODS.map(([id, n, d]) => `<label class="mb-item"><input type="radio" name="mb" value="${id}" ${id === k ? 'checked' : ''}><b>${esc(n)}</b><button type="button" class="mb-play" data-pv="${id}">▶ 들어보기</button><small>${esc(d || '')}</small></label>`).join('');
  $('mb-msg').textContent = '지금: ' + ((MOODS.find(m => m[0] === k) || [, k])[1]);
}
// 미리 듣기 (대표 2026-10-26: "눌러 보고 들어 보고 고르게") — 그 분위기의 곡을 차례로 하나씩
const MB_BASE = 'https://raw.githubusercontent.com/jmp159877-source/omaju/mood/';
let mbList = null, mbAu = null, mbCur = null, mbIdx = {};
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-pv]'); if (!b) return; e.preventDefault(); e.stopPropagation();
  const id = b.dataset.pv;
  if (!mbList) { try { mbList = await (await fetch(MB_BASE + 'list.json', { cache: 'no-store' })).json(); } catch (x) { $('mb-msg').textContent = '음악 목록을 못 받았어요. 잠시 뒤 다시 눌러 주세요.'; return; } }
  if (!mbAu) { mbAu = new Audio(); mbAu.onended = () => { document.querySelectorAll('[data-pv]').forEach(x => { x.textContent = '▶ 들어보기'; }); mbCur = null; }; }
  document.querySelectorAll('[data-pv]').forEach(x => { x.textContent = '▶ 들어보기'; });
  if (mbCur === id && !mbAu.paused) { mbAu.pause(); mbCur = null; return; }
  const L = mbList[id] || []; if (!L.length) { $('mb-msg').textContent = '이 분위기는 아직 곡이 없어요.'; return; }
  const i = (mbIdx[id] = ((mbIdx[id] ?? -1) + 1) % L.length);   // 누를 때마다 다음 곡
  mbAu.src = MB_BASE + L[i].f; mbCur = id; b.textContent = '❚❚ 멈춤';
  try { await mbAu.play(); $('mb-msg').textContent = `들어 보는 중: ${L.length}곡 중 ${i + 1}번째 — 다시 누르면 멈추고, 또 누르면 다음 곡`; } catch (x) { b.textContent = '▶ 들어보기'; }
}, true);
$('mb-save').onclick = async () => {
  const v = (document.querySelector('input[name=mb]:checked') || {}).value; if (!v) return;
  await setDoc(doc(db, 'settings', 'musicbox'), { k: v, ts: serverTimestamp() });
  $('mb-msg').textContent = '정했습니다. 다음에 앱을 여는 분부터 이 음악이 흐릅니다.';
};

// ── 사연 ──
// 보내 온 사연은 여기서 한 번 보고 '싣기'를 누른 것만 아침에 올라간다.
// 아무나 보낸 글이 그대로 방송돼 나가면 수습할 길이 없다.
const S_LABEL = { new: '새 사연', ok: '싣기로 함', used: '나간 것', hold: '보류' };
async function loadStories() {
  $('s-msg').textContent = '불러오는 중…';
  let list = [];
  try { list = await DB.listStories(); } catch (e) { $('s-msg').textContent = e.message; return; }
  const n = list.filter(x => x.status === 'new').length, ok = list.filter(x => x.status === 'ok').length;
  $('s-msg').textContent = `새 사연 ${n}편 · 실을 것 ${ok}편`;
  $('stories').innerHTML = '<tr><th>보낸 분</th><th>때</th><th>사연</th><th>상태</th><th></th></tr>' + (list.length ? list.map(x => `<tr>
    <td>${esc(x.nick || '')}</td><td>${fmt(x.ts)}</td>
    <td style="white-space:pre-wrap;max-width:520px">${esc(x.text || '')}</td>
    <td>${S_LABEL[x.status] || esc(x.status || '')}${x.usedDate ? '<br><small>' + esc(x.usedDate) + '</small>' : ''}</td>
    <td style="white-space:nowrap">
      ${x.status === 'ok' ? '<button type="button" class="btn line" data-st="new" data-id="' + x.id + '">되돌리기</button>'
                          : '<button type="button" class="btn green" data-st="ok" data-id="' + x.id + '">싣기</button>'}
      <button type="button" class="btn line" data-st="hold" data-id="${x.id}">보류</button>
      <button type="button" class="btn line" data-del="${x.id}">지우기</button>
    </td></tr>`).join('') : '<tr><td colspan="5">아직 들어온 사연이 없습니다.</td></tr>');
  labelize($('stories'));
}
$('s-load').onclick = loadStories;
$('stories').onclick = async e => {
  const b = e.target.closest('[data-st]'), d = e.target.closest('[data-del]');
  try {
    if (b) await DB.setStoryStatus(b.dataset.id, b.dataset.st);
    else if (d) { if (!confirm('이 사연을 지울까요?')) return; await DB.deleteStory(d.dataset.del); }
    else return;
    loadStories();
  } catch (err) { $('s-msg').textContent = err.message; }
};

// ── 블로그 재료 (운영자 2026-10-22) ── 네이버 블로그 '오늘의 인사카드' 글을 밤 12시 반~1시에 올린다.
// 카드는 사이트와 똑같이 이 브라우저에서 그린다(cards.js — 글꼴·로고 그대로). 제목·본문·태그는 날짜로 만든 틀.
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
async function loadBlog() {
  const key = $('b-date').value || TODAY, [Y, M1, D] = key.split('-').map(Number), M = M1 - 1;
  const dow = DOWS[new Date(Date.UTC(Y, M, D)).getUTCDay()];
  $('b-msg').textContent = '불러오는 중…'; $('b-cards').innerHTML = '';
  let x = await DB.loadDaily(key);
  let G = x && x.greetings;
  // 아직 오지 않은 날은 일주일 치 미리 만든 글귀로 (대표 2026-10-25: 일주일에 한 번 몰아서 예약 발행)
  if (!G || !G.length) { try { const w = await (await fetch('data/greetings_week.json?t=' + Date.now(), { cache: 'no-store' })).json(); if (w[key] && w[key].length) { G = w[key]; x = x || {}; } } catch (e) {} }
  if (!G || !G.length) { $('b-msg').textContent = key + ' 인사 카드가 아직 없습니다. (다음 주 치는 일요일 밤 9시 반에 만들어집니다)'; return; }
  const cards = await import('./cards.js');
  const dateText = `${M + 1}월 ${D}일 · ${dow}요일`, season = M < 2 || M === 11 ? 'winter' : M < 5 ? 'spring' : M < 8 ? 'summer' : 'autumn';
  const vv = i => ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'][(Math.floor(Date.UTC(Y, M, D) / 864e5) * 4 + i) % 6];   // 사이트(app.js cardVar)와 같은 셈
  for (let i = 0; i < G.length; i++) {
    const cv = await cards.drawCard(G[i], i, { dateText, variant: vv(i), season });
    const url = cv.toDataURL('image/jpeg', 0.92), name = `${M + 1}월${D}일_인사카드_${i + 1}.jpg`;
    $('b-cards').insertAdjacentHTML('beforeend', `<figure><img src="${url}" alt="인사 카드 ${i + 1}"><a class="bk-dl" href="${url}" download="${name}">${i + 1}번 내려받기</a></figure>`);
  }
  $('b-title').value = `${M + 1}월 ${D}일 ${dow}요일 아침 인사 카드 · 좋은 아침 인사말 이미지`;
  // 날마다 같은 틀이면 네이버가 찍어 내는 글로 볼 수 있다 (대표 2026-10-23) — 첫 문단·끝인사를 그날 내용과 날짜로 바꾼다.
  const n = Math.floor(Date.UTC(Y, M, D) / 864e5), pick = (a, k = 0) => a[(n + k) % a.length];
  const one = s => String(s || '').replace(/\s*\n\s*/g, ' ').trim();
  const q = one(G[n % G.length]);
  const hi = pick([`${M + 1}월 ${D}일 ${dow}요일 아침입니다.`, `${dow}요일, ${M + 1}월 ${D}일의 아침이에요.`, `좋은 아침입니다. 오늘은 ${M + 1}월 ${D}일 ${dow}요일.`, `${M + 1}월 ${D}일, ${dow}요일 아침 인사 드립니다.`]);
  const mood = x.mind && x.mind.line ? one(x.mind.line) : '';
  const quote = pick([`오늘 카드 가운데 “${q}” 이 한 줄이 오래 남네요.`, `“${q}” — 오늘은 이 말로 하루를 열어 봅니다.`, `오늘 고른 글귀는 “${q}”.`, `누군가에게 “${q}” 하고 건네고 싶은 아침입니다.`], 1);
  const send = pick(['마음 가는 분께 아침 인사로 한 장 보내 보세요.', '오래 연락 못 한 분께 한 장 건네 보셔도 좋겠습니다.', '단톡방에 한 장, 마음 가는 분께 한 장.', '말로 하기 쑥스러운 안부를 카드에 맡겨 보세요.'], 2);
  const extra = [];
  if (x.meal && x.meal.title) extra.push(`한 끼 ‘${one(x.meal.title)}’`);
  if (x.book && x.book.title) extra.push(`한 권 『${one(x.book.title)}』`);
  const today = extra.length ? pick([`오늘 오마주에 올라온 것 — ${extra.join(', ')}.`, `오늘의 오마주 — ${extra.join(' · ')}.`], 3) : '';
  const end = pick(['매일 아침 새 카드가 나오는 곳, 오마주 매거진.', '카드는 매일 아침 오마주 매거진에서 새로 나옵니다.', '내일 아침에도 새 카드로 찾아오겠습니다. 오마주 매거진.'], 4);
  $('b-body').value = [hi, mood, '', quote, send, '',
    ...G.map((_, i) => `(카드 ${i + 1})`), '',
    '카드를 한 번 누르면 크게 뜹니다. 화면 오른쪽의 내려받기 단추로 저장하세요.', today, end, '네이버에서 “오마주 매거진”을 찾으시거나, 아래 그림을 누르세요.', '', '(맨 끝 그림 — 링크 https://omaju.kr/?from=blog)'].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  $('b-title').value = pick([`${M + 1}월 ${D}일 ${dow}요일 아침 인사 카드 · 좋은 아침 인사말 이미지`, `${M + 1}월 ${D}일 아침 인사말 이미지 · ${dow}요일 좋은 아침 카드`, `${dow}요일 아침 인사 카드 (${M + 1}월 ${D}일) · 좋은 아침 인사 이미지`]);
  $('b-tags').value = ['오마주매거진', '아침인사', '아침인사이미지', '좋은아침', `${M + 1}월인사말`, `${dow}요일인사`, '인사카드', '좋은글'].join(', ');
  $('b-msg').textContent = key + ' 카드 ' + G.length + '장';
}
$('b-load').onclick = loadBlog;
// 일주일 치 날짜 단추 (대표 2026-10-25): 다음 월~일(일요일엔 다음 주, 다른 날엔 이번 주 남은 날부터)
(function weekBtns() {
  const now = new Date(Date.now() + 9 * 3600e3), dw = now.getUTCDay(), start = new Date(now); start.setUTCDate(now.getUTCDate() + (dw === 0 ? 1 : 1 - dw));
  const box = document.createElement('div'); box.className = 'bar'; box.id = 'b-week';
  for (let i = 0; i < 7; i++) { const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); const k = d.toISOString().slice(0, 10);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${DOWS[d.getUTCDay()]}`;
    b.onclick = () => { $('b-date').value = k; loadBlog(); }; box.appendChild(b); }
  $('b-load').closest('.bar').after(box);
})();
document.querySelector('[data-sec="blog"]').addEventListener('click', async e => { const b = e.target.closest('[data-copy]'); if (!b) return; const t = $(b.dataset.copy); try { await navigator.clipboard.writeText(t.value); } catch (err) { t.select(); document.execCommand('copy'); } const o = b.textContent; b.textContent = '복사됨'; setTimeout(() => b.textContent = o, 1200); });
