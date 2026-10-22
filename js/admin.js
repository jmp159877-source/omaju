
// 휴대폰에서 표를 카드처럼 보이게: 각 칸에 머리글 이름을 붙인다
function labelize(t) { const hs = [...t.querySelectorAll('th')].map(h => h.textContent); t.querySelectorAll('tr').forEach(tr => [...tr.children].forEach((td, i) => { if (td.tagName === 'TD' && hs[i]) td.dataset.l = hs[i]; })); }
import * as DB from './db.js';
import { DEFAULT_CONTENT } from './content.js';
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
  if (ok) { $('who').textContent = p.nick; loadDash(); }
});
document.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-pressed', x === b)); document.querySelectorAll('.sec').forEach(s => s.classList.toggle('on', s.dataset.sec === b.dataset.tab)); ({ users: loadUsers, content: () => { $('c-date').value = TODAY; loadContent(); }, comments: () => { $('m-date').value = TODAY; loadComments(false); }, resets: loadResets, blog: () => { if (!$('b-date').value) $('b-date').value = TODAY; loadBlog(); }, notice: loadNotice, maint: loadMaint, stories: loadStories })[b.dataset.tab]?.(); };

// ── 현황 ──
async function loadDash() {
  const users = (await getDocs(collection(db, 'users'))).docs.map(d => d.data());
  const today = users.filter(u => u.lastSeenDay === TODAY).length;
  const week = users.filter(u => u.lastSeenDay >= dayOffset(-6)).length;
  const sToday = (await getDoc(doc(db, 'stats', TODAY))).data() || {};
  const joined = users.filter(u => u.createdAt && DB.todayKey(u.createdAt.toDate()) === TODAY).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  $('tiles').innerHTML = [['누적 구독자', users.length], ['오늘 방문(기기)', sToday.visits || 0], ['오늘 접속 구독자', today], ['7일 접속 구독자', week], ['오늘 구독', joined.length], ['문자 수신 동의', users.filter(u => u.marketing).length]].map(([k, v]) => `<div class="tile"><b>${v}</b><span>${k}</span></div>`).join('');
  // 오늘 가입한 사람 (운영자 2026-10-22 — 숫자만 보이니 누가 들어왔는지 회원 탭까지 가야 했다)
  const hm = t => { const d = t.toDate(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  $('joined').innerHTML = joined.length ? '<tr><th>별명</th><th>구독 시각</th><th>성별</th><th>태어난 해</th></tr>' + joined.map(u => `<tr><td>${esc(u.nick)}</td><td>${hm(u.createdAt)}</td><td>${esc(u.gender || '')}</td><td>${u.birthYear ? u.birthYear + '년생' : ''}</td></tr>`).join('') : '<tr><td>오늘은 아직 없음</td></tr>'; labelize($('joined'));
  paintNoCount();
  const days = Array.from({ length: 14 }, (_, i) => dayOffset(i - 13));
  const stats = await Promise.all(days.map(d => getDoc(doc(db, 'stats', d)).then(s => s.data() || {})));
  const max = Math.max(1, ...stats.map(s => s.visits || 0));
  $('chart').innerHTML = stats.map((s, i) => `<div style="height:${(s.visits || 0) * 100 / max}%" data-v="${s.visits || 0}" title="${days[i]}"></div>`).join('');
  const clicks = Object.entries(sToday.clicks || {}).sort((a, b) => b[1] - a[1]);
  const NAMES = { greeting: '인사말', fortune: '운세', dream: '꿈 해몽', luck: '운세 · 꿈 해몽', food: '한 끼', book: '한 권', quiz: '시사 상식', culture: '문화', play: '오늘 PLAY', history: '그해 오늘', music: '그 시절 노래', story: '사연', follow: '따라하기', show: '무엇을 볼까', outing: '나들이', phrase: '여행', garden: '오늘의 정원', hike: '오늘의 산', move: '몸 풀기', mind: '마음 한 줄', body: '몸 한 가지', home: '그 동네 지금' };
  $('clicks').innerHTML = '<tr><th>코너</th><th>클릭</th></tr>' + (clicks.map(([k, v]) => `<tr><td>${NAMES[k] || k}</td><td>${v}</td></tr>`).join('') || '<tr><td colspan="2">아직 없음</td></tr>'); labelize($('clicks'));
  const reg = {}; users.forEach(u => { const r = (u.region || '미입력').split(' ')[0]; reg[r] = (reg[r] || 0) + 1; });
  $('regions').innerHTML = '<tr><th>지역</th><th>구독자</th></tr>' + Object.entries(reg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join(''); labelize($('regions'));
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
async function loadUsers() {
  allUsers = (await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))).docs.map(d => ({ id: d.id, ...d.data() }));
  renderUsers(allUsers);
}
function renderUsers(list) {
  $('u-count').textContent = list.length + '명';
  $('users').innerHTML = '<tr><th>별명</th><th>성별</th><th>출생</th><th>구독 경로</th><th>연락처</th><th>구독</th><th>마지막</th><th>출석</th><th></th></tr>' + list.slice(0, 300).map(u => `<tr><td>${esc(u.nick)}${u.role === 'admin' ? ' <small>(관리자)</small>' : ''}${u.banned ? ' <small style="color:#a93226">(정지)</small>' : ''}</td><td>${esc(u.gender || '')}</td><td>${u.birthYear || ''}</td><td>${u.via === 'kakao' ? '카카오' : u.via === 'naver' ? '네이버' : esc(u.username || '')}</td><td>${esc(u.phone)}</td><td>${md(u.createdAt)}</td><td>${esc((u.lastSeenDay || '').slice(5).replace('-', '/'))}</td><td>${u.checkinCount || 0}</td><td>${u.role === 'admin' ? '' : `<button type="button" data-ban="${u.id}" class="${u.banned ? '' : 'danger'}">${u.banned ? '정지 풀기' : '정지'}</button><button type="button" data-del="${u.id}" class="danger">삭제</button>`}</td></tr>`).join(''); labelize($('users'));
}
$('u-find').onclick = () => { const q = $('u-q').value.trim().toLowerCase(); renderUsers(q ? allUsers.filter(u => [u.nick, u.username, u.phone].some(x => (x || '').toLowerCase().includes(q))) : allUsers); };
// 회원 삭제 (운영자 2026-10-22 — 시험으로 만든 계정 정리). 회원 문서와 아이디·별명 자리를 지운다.
// 카카오·네이버 로그인 자체는 남으므로 그 사람이 다시 들어오면 처음 온 사람처럼 가입 창이 뜬다.
async function dropUser(u) {
  const mine = async (col, key) => { if (!key) return; const r = doc(db, col, key), s = await getDoc(r); if (s.exists() && s.data().uid === u.id) await deleteDoc(r); };
  await mine('nicknames', u.nickKey); await mine('usernames', u.username);
  await deleteDoc(doc(db, 'users', u.id));
}
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
  const x = await DB.loadDaily(key);
  const G = x && x.greetings;
  if (!G || !G.length) { $('b-msg').textContent = key + ' 인사 카드가 아직 없습니다. (밤 12시 5분에 만들어집니다)'; return; }
  const cards = await import('./cards.js');
  const dateText = `${M + 1}월 ${D}일 · ${dow}요일`, season = M < 2 || M === 11 ? 'winter' : M < 5 ? 'spring' : M < 8 ? 'summer' : 'autumn';
  const vv = i => ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'][(Math.floor(Date.UTC(Y, M, D) / 864e5) * 4 + i) % 6];   // 사이트(app.js cardVar)와 같은 셈
  for (let i = 0; i < G.length; i++) {
    const cv = await cards.drawCard(G[i], i, { dateText, variant: vv(i), season });
    const url = cv.toDataURL('image/jpeg', 0.92), name = `${M + 1}월${D}일_인사카드_${i + 1}.jpg`;
    $('b-cards').insertAdjacentHTML('beforeend', `<figure><img src="${url}" alt="인사 카드 ${i + 1}"><a class="bk-dl" href="${url}" download="${name}">${i + 1}번 내려받기</a></figure>`);
  }
  $('b-title').value = `${M + 1}월 ${D}일 ${dow}요일 아침 인사 카드 · 좋은 아침 인사말 이미지`;
  $('b-body').value = [`${M + 1}월 ${D}일 ${dow}요일, 좋은 아침입니다.`, '오늘의 오마주 인사 카드를 나눕니다.', '마음 가는 분께 아침 인사로 보내 보세요.', '',
    ...G.map((_, i) => `(카드 ${i + 1})`), '',
    '카드는 길게 눌러 저장하시면 됩니다.', '매일 아침 새 카드가 나오는 곳, 오마주 매거진.', '네이버에서 “오마주 매거진”을 찾으시거나, 아래 그림을 누르세요.', '', '(맨 끝 그림 — 링크 https://omaju.kr)'].join('\n');
  $('b-tags').value = ['오마주매거진', '아침인사', '아침인사이미지', '좋은아침', `${M + 1}월인사말`, `${dow}요일인사`, '인사카드', '좋은글'].join(', ');
  $('b-msg').textContent = key + ' 카드 ' + G.length + '장';
}
$('b-load').onclick = loadBlog;
document.querySelector('[data-sec="blog"]').addEventListener('click', async e => { const b = e.target.closest('[data-copy]'); if (!b) return; const t = $(b.dataset.copy); try { await navigator.clipboard.writeText(t.value); } catch (err) { t.select(); document.execCommand('copy'); } const o = b.textContent; b.textContent = '복사됨'; setTimeout(() => b.textContent = o, 1200); });
