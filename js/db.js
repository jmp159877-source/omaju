// 오마주 — 파이어베이스 연결 (가입·로그인·저장)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCustomToken, signOut, onAuthStateChanged, updatePassword, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, limit, getDocs, runTransaction, serverTimestamp, increment, deleteField, getCountFromServer } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
import { getAnalytics, logEvent } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-analytics.js';
import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
let analytics = null;
try { analytics = getAnalytics(app); } catch (e) {}
setPersistence(auth, browserLocalPersistence).catch(() => {});

const DOMAIN = '@omaju.kr';
export const ADMIN_ROLE = 'admin';

export const todayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const normNick = s => s.replace(/\s+/g, '').toLowerCase();
export const validUsername = s => /^[a-z0-9]{4,12}$/.test(s);
export const validPw = s => /^[0-9]{6}$/.test(s);
export const validPhone = s => /^01[016789]-?\d{3,4}-?\d{4}$/.test(s);

// ── 로그인 상태 ──
let me = null, profile = null;
// 앱이 열리자마자는 로그인 여부를 아직 모른다(파이어베이스가 저장된 로그인을 되살리는 데 잠깐 걸린다).
// 그 사이에 '로그인 안 된 화면'을 그리면 로그인 단추가 깜빡였다가 사라진다 → 알 때까지 아무것도 알리지 않는다.
let authKnown = false;
// 카카오·네이버로 들어왔는데 아직 우리 쪽 정보(별명·태어난 해·성별)가 없는 사람 — 마무리 화면을 띄우라고 알린다
let needProfileCb = null, pendingProfileUser = null;
export function onNeedProfile(cb) { needProfileCb = cb; if (pendingProfileUser) cb(pendingProfileUser); }
const listeners = new Set();
export const authReady = () => authKnown;
export function onUser(cb) { listeners.add(cb); if (authKnown) cb(me, profile); return () => listeners.delete(cb); }
const tellAll = () => { authKnown = true; document.documentElement.classList.add('auth-known'); listeners.forEach(cb => cb(me, profile)); };
onAuthStateChanged(auth, async user => {
  me = user; profile = null;
  if (user) {
    try { const s = await getDoc(doc(db, 'users', user.uid)); profile = s.exists() ? s.data() : null; } catch (e) {}
    // 아이디로 가입할 때도 잠깐 '정보 없음'을 지나므로(그때는 signup() 이 곧 써 준다),
    // 마무리 화면은 **카카오·네이버로 들어온 사람**에게만 띄운다.
    if (!profile) {
      // 알림을 받을 쪽이 아직 준비되지 않았을 수 있다(여기가 먼저 도는 때가 있다) → 적어 두었다가 준비되면 부른다.
      if (/^(kakao|naver)_/.test(user.uid)) { pendingProfileUser = user; if (needProfileCb) needProfileCb(user); }
      // 여기서 그냥 돌아가 버리면 화면은 영영 '아직 모름' 에 머문다 — 나의 정보도 로그아웃도 먹지 않는다
      // (운영자 2026-10-21). 정보가 없는 채로라도 알린다.
      tellAll(); return;
    }
    // 방문한 날 수 (대표 2026-10-27 멤버십 카드 '방문 횟수') — 하루 한 번만 센다
    // 처음 세는 분은 2일부터(대표 2026-10-27 00:10 — 지금 시점 모두 2일, 그다음부터 날마다 한 번)
    const newDay = profile.lastSeenDay !== todayKey(), first = profile.visitDays == null;
    const up = { lastSeen: serverTimestamp(), lastSeenDay: todayKey() };
    if (first) up.visitDays = 2; else if (newDay) up.visitDays = increment(1);
    try { await updateDoc(doc(db, 'users', user.uid), up); profile.visitDays = first ? 2 : newDay ? profile.visitDays + 1 : profile.visitDays; } catch (e) {}
  }
  tellAll();
});
// 파이어베이스가 끝내 대답하지 않아도(네트워크 끊김 등) 화면이 영영 비어 있지 않게
setTimeout(() => { if (!authKnown) tellAll(); }, 6000);
export const currentUser = () => me;
export const currentProfile = () => profile;
export const isAdmin = () => !!(profile && profile.role === ADMIN_ROLE);

// ── 중복 확인 ──
export async function usernameTaken(u) { const s = await getDoc(doc(db, 'usernames', u)); return s.exists(); }
export async function nicknameTaken(n) { const s = await getDoc(doc(db, 'nicknames', normNick(n))); return s.exists(); }
export async function suggestNick(n) {
  for (let i = 2; i < 50; i++) { const c = n + i; if (!(await nicknameTaken(c))) return c; }
  return n + Math.floor(Math.random() * 9000 + 1000);
}

// ── 가입 ──
export async function signup({ username, pw, nick, phone, region, marketing, gender, birthYear }) {
  username = username.trim().toLowerCase(); nick = nick.trim();
  if (!validUsername(username)) throw new Error('아이디는 영문 소문자와 숫자로 4~12자입니다.');
  if (!validPw(pw)) throw new Error('비밀번호는 숫자 6자리입니다.');
  if (nick.length < 2 || nick.length > 12) throw new Error('별명은 2~12자로 적어 주세요.');
  if (!validPhone(phone)) throw new Error('휴대폰 번호를 다시 확인해 주세요. 예: 010-1234-5678');
  if (!['남', '여'].includes(gender)) throw new Error('성별을 골라 주세요.');
  if (!(birthYear >= 1925 && birthYear <= new Date().getFullYear() - 14)) throw new Error('태어난 해를 골라 주세요.');
  if (await usernameTaken(username)) throw new Error('이미 있는 아이디입니다. 다른 아이디를 넣어 주세요.');
  if (await nicknameTaken(nick)) throw new Error('이미 있는 별명입니다. 다른 별명을 넣어 주세요.');
  const cred = await createUserWithEmailAndPassword(auth, username + DOMAIN, pw);
  const uid = cred.user.uid;
  await runTransaction(db, async tx => {
    const u = doc(db, 'usernames', username), n = doc(db, 'nicknames', normNick(nick));
    if ((await tx.get(u)).exists()) throw new Error('이미 있는 아이디입니다.');
    if ((await tx.get(n)).exists()) throw new Error('이미 있는 별명입니다.');
    tx.set(u, { uid }); tx.set(n, { uid });
    tx.set(doc(db, 'users', uid), {
      username, nick, nickKey: normNick(nick), phone: phone.replace(/-/g, ''), region: region || '', gender, birthYear, role: 'member',
      marketing: !!marketing, agreedAt: serverTimestamp(), createdAt: serverTimestamp(), lastSeen: serverTimestamp(), lastSeenDay: todayKey(),
      streak: 0, lastCheckin: ''
    });
  });
  profile = { username, nick, nickKey: normNick(nick), phone: phone.replace(/-/g, ''), region: region || '', gender, birthYear, role: 'member', marketing: !!marketing, streak: 0, lastCheckin: '', checkinCount: 0 };
  tellAll();
  track('sign_up');
  return uid;
}

// ── 카카오·네이버로 들어오기 ──
// 서버(api/*-callback)가 만들어 준 맞춤 토큰으로 로그인한다. 우리 쪽 정보가 없으면 마무리 화면이 뜬다.
export async function loginWithToken(t) { await signInWithCustomToken(auth, t); track('login'); }
// 카톡 안 브라우저 → 크롬으로 넘어갈 때 들고 갈 10분짜리 로그인 표. 로그인 안 했거나 실패하면 빈 값.
export async function handoffToken() {
  try {
    if (!me) return '';
    const r = await fetch('/api/handoff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: await me.getIdToken() }) });
    return r.ok ? ((await r.json()).ct || '') : '';
  } catch (e) { return ''; }
}
export async function socialHint() {
  try { const r = await me.getIdTokenResult(); return { via: r.claims.via || '', nick: r.claims.nick || '' }; }
  catch (e) { return { via: '', nick: '' }; }
}
export async function finishSocial({ nick, gender, birthYear, marketing }) {
  const u = me; if (!u) throw new Error('로그인이 풀렸습니다. 다시 눌러 주세요.');
  nick = (nick || '').trim();
  if (nick.length < 2 || nick.length > 12) throw new Error('별명은 2~12자로 적어 주세요.');
  if (!['남', '여'].includes(gender)) throw new Error('성별을 골라 주세요.');
  if (!(birthYear >= 1925 && birthYear <= new Date().getFullYear() - 14)) throw new Error('태어난 해를 골라 주세요.');
  if (await nicknameTaken(nick)) throw new Error('이미 있는 별명입니다. 다른 별명을 넣어 주세요.');
  const via = (await socialHint()).via;
  await runTransaction(db, async tx => {
    const n = doc(db, 'nicknames', normNick(nick));
    if ((await tx.get(n)).exists()) throw new Error('이미 있는 별명입니다.');
    tx.set(n, { uid: u.uid });
    tx.set(doc(db, 'users', u.uid), {
      username: '', nick, nickKey: normNick(nick), phone: '', region: '', gender, birthYear, role: 'member',
      via, marketing: !!marketing, agreedAt: serverTimestamp(), createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(), lastSeenDay: todayKey(), streak: 0, lastCheckin: ''
    });
  });
  profile = { username: '', nick, nickKey: normNick(nick), phone: '', region: '', gender, birthYear, role: 'member', via, marketing: !!marketing, streak: 0, lastCheckin: '', checkinCount: 0 };
  tellAll();
  track('sign_up');
}

export async function login(username, pw) {
  username = username.trim().toLowerCase();
  try { await signInWithEmailAndPassword(auth, username + DOMAIN, pw); }
  catch (e) { throw new Error('아이디나 비밀번호가 맞지 않습니다.'); }
  track('login');
}
export const logout = () => signOut(auth);

export async function changeNick(nick) {
  if (!me) throw new Error('로그인이 필요합니다.');
  nick = nick.trim();
  if (nick.length < 2 || nick.length > 12) throw new Error('별명은 2~12자로 적어 주세요.');
  if (normNick(nick) === profile.nickKey) return;
  if (await nicknameTaken(nick)) throw new Error('이미 있는 별명입니다.');
  await runTransaction(db, async tx => {
    const n = doc(db, 'nicknames', normNick(nick));
    if ((await tx.get(n)).exists()) throw new Error('이미 있는 별명입니다.');
    tx.set(n, { uid: me.uid }); tx.delete(doc(db, 'nicknames', profile.nickKey));
    tx.update(doc(db, 'users', me.uid), { nick, nickKey: normNick(nick) });
  });
  profile.nick = nick; profile.nickKey = normNick(nick);
}
export async function saveProfile(fields) {
  if (!me) throw new Error('로그인이 필요합니다.');
  await updateDoc(doc(db, 'users', me.uid), fields); Object.assign(profile, fields);
}
export async function changePw(pw) {
  if (!validPw(pw) && !(isAdmin() && pw.length >= 8)) throw new Error('비밀번호는 숫자 6자리입니다.');
  await updatePassword(me, pw);
}
export async function requestReset(username, phone) {
  username = username.trim().toLowerCase();
  if (!validUsername(username) || !validPhone(phone)) throw new Error('아이디와 휴대폰 번호를 다시 확인해 주세요.');
  await addDoc(collection(db, 'resets'), { username, phone: phone.replace(/-/g, ''), ts: serverTimestamp(), done: false });
}

// ── 출석 ──
export async function checkin() {
  if (!me) throw new Error('로그인이 필요합니다.');
  const today = todayKey(), y = new Date(); y.setDate(y.getDate() - 1);
  const ref = doc(db, 'checkins', me.uid + '_' + today);
  if ((await getDoc(ref)).exists()) return profile.streak;
  const streak = profile.lastCheckin === todayKey(y) ? (profile.streak || 0) + 1 : 1;
  await setDoc(ref, { uid: me.uid, date: today, ts: serverTimestamp() });
  await updateDoc(doc(db, 'users', me.uid), { streak, lastCheckin: today, checkinCount: increment(1) });
  profile.streak = streak; profile.lastCheckin = today; profile.checkinCount = (profile.checkinCount || 0) + 1;
  track('checkin');
  return streak;
}
export async function myCheckins(yyyymm) {
  if (!me) return [];
  const q = query(collection(db, 'checkins'), where('uid', '==', me.uid));
  return (await getDocs(q)).docs.map(d => d.data().date).filter(d => d.startsWith(yyyymm));
}

// ── 오늘 콘텐츠·공지 ──
export async function loadDaily(date = todayKey()) {
  try { const s = await getDoc(doc(db, 'daily', date)); return s.exists() ? s.data() : null; } catch (e) { return null; }
}
export async function loadMaint() {
  try { const s = await getDoc(doc(db, 'settings', 'maint')); return s.exists() ? s.data() : null; } catch (e) { return null; }
}
export async function loadMusicbox() {   // 오마주 뮤직박스 — 앱을 열면 저절로 흐를 분위기 (관리자에서 고름, 대표 2026-10-26)
  try { const s = await getDoc(doc(db, 'settings', 'musicbox')); return s.exists() ? s.data() : null; } catch (e) { return null; }
}
export async function loadMarket() {
  try { const s = await getDoc(doc(db, 'settings', 'market')); return s.exists() ? s.data() : null; } catch (e) { return null; }
}
export async function loadIssues() {
  try { const s = await getDoc(doc(db, 'settings', 'issues')); return s.exists() ? s.data() : null; } catch (e) { return null; }
}
export async function loadNotice() {
  try {
    const s = await getDocs(query(collection(db, 'notices'), where('active', '==', true)));
    return s.empty ? null : s.docs[s.docs.length - 1].data();
  } catch (e) { return null; }
}

// ── 투표·한마디 ──
export async function vote(date, idx, n) {
  const ref = doc(db, 'polls', date);
  if (me) {
    const v = doc(db, 'votes', date + '_' + me.uid);
    if ((await getDoc(v)).exists()) return loadPoll(date);
    await setDoc(v, { uid: me.uid, date, idx, ts: serverTimestamp() });
  }
  const s = await getDoc(ref);
  if (!s.exists()) await setDoc(ref, { counts: Array.from({ length: n }, (_, i) => i === idx ? 1 : 0) });
  else await updateDoc(ref, { ['counts.' + idx]: increment(1) });
  return loadPoll(date);
}
export async function loadPoll(date) {
  try { const s = await getDoc(doc(db, 'polls', date)); return s.exists() ? s.data().counts : null; } catch (e) { return null; }
}
export async function addComment(date, text, corner = '') {
  if (!me || !profile) throw new Error('로그인이 필요합니다.');
  text = text.trim(); if (!text) return;
  if (text.length > 200) throw new Error('200자 안으로 적어 주세요.');
  if (BAD.some(w => text.includes(w))) throw new Error('고운 말로 다시 적어 주세요.');
  await addDoc(collection(db, 'comments'), { uid: me.uid, nick: profile.nick, date, text, corner, ts: serverTimestamp(), reports: 0, hidden: false });
}
export async function listComments(date, corner = '') {
  try {
    const q = query(collection(db, 'comments'), where('date', '==', date));
    const ms = x => x && x.ts && x.ts.toMillis ? x.ts.toMillis() : 0;
    return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.hidden && (c.corner || '') === corner).sort((a, b) => ms(b) - ms(a)).slice(0, 50);
  } catch (e) { return []; }
}
export async function reportComment(id) {
  if (!me) throw new Error('로그인이 필요합니다.');
  const r = doc(db, 'reports', id + '_' + me.uid);
  if ((await getDoc(r)).exists()) return;
  await setDoc(r, { uid: me.uid, comment: id, ts: serverTimestamp() });
  await updateDoc(doc(db, 'comments', id), { reports: increment(1) });
}
// 오프닝 사연 보내기: 회원만, 1000자 안. 관리자만 읽는다.
export async function sendStory(text) {
  if (!me || !profile) throw new Error('로그인이 필요합니다.');
  text = String(text || '').trim();
  if (text.length < 10) throw new Error('조금만 더 자세히 적어 주세요.');
  if (text.length > 1000) throw new Error('1000자 안으로 적어 주세요.');
  if (BAD.some(w => text.includes(w))) throw new Error('고운 말로 다시 적어 주세요.');
  await addDoc(collection(db, 'stories'), { uid: me.uid, nick: profile.nick, text, ts: serverTimestamp(), status: 'new' });
}
/** 관리자: 보내 온 사연 보기. status — new(새 것) / ok(싣기로 한 것) / used(나간 것) / hold(보류) */
export async function listStories(status = '') {
  let q0 = collection(db, 'stories');
  const s = await getDocs(status ? query(q0, where('status', '==', status)) : q0);
  return s.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.ts && b.ts.seconds || 0) - (a.ts && a.ts.seconds || 0));
}
export async function setStoryStatus(id, status) { await updateDoc(doc(db, 'stories', id), { status }); }
export async function deleteStory(id) { await deleteDoc(doc(db, 'stories', id)); }

export async function deleteMyComment(id) { await deleteDoc(doc(db, 'comments', id)); }
// ── 오마주 사랑방 (대표 2026-10-25): 매일 주제 하나, 구독자가 한 줄씩. 채움 글(seed)은 새벽에 tools/talk_seed.py 가 넣는다 ──
export async function addTalk(date, text, from = '') {
  if (!me || !profile) throw new Error('로그인이 필요합니다.');
  text = String(text || '').trim(); if (!text) return;
  if (text.length > 120) throw new Error('120자 안으로 적어 주세요.');
  if (BAD.some(w => text.includes(w))) throw new Error('고운 말로 다시 적어 주세요.');
  const now = Date.now();
  await addDoc(collection(db, 'talk'), { uid: me.uid, nick: profile.nick, date, text, ts: serverTimestamp(), show_at: now, seed: false, host: false, reports: 0, hidden: false, ...(from ? { from: String(from).slice(0, 20) } : {}) });
}
export async function listTalk(date) {
  try {
    const q = query(collection(db, 'talk'), where('date', '==', date), where('hidden', '==', false));
    return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() })).filter(x => (x.reports || 0) < 3);
  } catch (e) { return []; }
}
export async function reportTalk(id) {
  if (!me) throw new Error('로그인이 필요합니다.');
  const r = doc(db, 'reports', 'talk_' + id + '_' + me.uid);
  if ((await getDoc(r)).exists()) return;
  await setDoc(r, { uid: me.uid, comment: 'talk/' + id, ts: serverTimestamp() });
  await updateDoc(doc(db, 'talk', id), { reports: increment(1) });
}
export async function deleteMyTalk(id) { await deleteDoc(doc(db, 'talk', id)); }
export const myUid = () => (me ? me.uid : null);
const BAD = ['시발', '씨발', '개새', '병신', '좆', '니미', '썅'];

// ── 집계 ──
export async function bumpVisit() {
  const k = 'omaju.visit.' + todayKey();
  // 네이버 블로그 끝 그림의 링크(omaju.kr/?from=blog)로 온 분 — 블로그가 독자를 데려오는지 보려고 (대표 2026-10-23).
  // 표시는 읽고 바로 주소에서 지운다(공유할 때 따라가지 않게).
  // 홍보국 2026-10-25: 검색(search)·카톡으로 받은 인사 카드(card)·심리 테스트 결과(psy)로 온 분도 센다 — 어디서 낯선 분이 들어오는지 보려고
  // 홍보국 2026-10-25: 쇼츠 '부모님께 보내 드리는 아침 잡지'(자녀 편) 댓글 링크로 온 분(kid)
  const FROMS = ['blog', 'yt', 'search', 'card', 'psy', 'kid', 'story'];   // story = 구글 웹 스토리
  let from = '';
  try { const q = new URLSearchParams(location.search); const fr = q.get('from'); if (FROMS.includes(fr)) { from = fr; q.delete('from'); const r = q.toString(); history.replaceState(history.state, '', location.pathname + (r ? '?' + r : '') + location.hash); } } catch (e) {}
  try { if (localStorage.getItem('omaju.noCount') === '1') return; } catch (e) {}   // 운영자 기기 (관리자 화면에서 켬)
  if (navigator.webdriver || /bot|crawl|spider|slurp|yeti|daum|lighthouse|headless|preview/i.test(navigator.userAgent)) return;   // 검색 로봇·미리보기는 세지 않는다 (운영자 2026-10-22)
  // 유튜브 채널 링크(omaju.kr/?from=yt)도 같은 방식으로 센다 (대표 2026-10-23 유튜브 채널 개설)
  for (const f of FROMS) {
    if (f !== from) continue;
    let once = true; try { const bk = 'omaju.' + f + '.' + todayKey(); if (localStorage.getItem(bk)) once = false; else localStorage.setItem(bk, '1'); } catch (e) {}
    if (once) try { await setDoc(doc(db, 'stats', todayKey()), { [f]: increment(1) }, { merge: true }); } catch (e) {}
  }
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch (e) {}
  // 처음 온 기기 (운영자 2026-10-22 — 가입 안 해도 보는 곳이니 '지금까지 몇 명이 봤나'를 누적으로). 이 브라우저에서 처음이면 1.
  let first = false; try { if (!localStorage.getItem('omaju.seen')) { localStorage.setItem('omaju.seen', todayKey()); first = true; } } catch (e) {}
  // 오늘 현황 (대표 2026-10-26: "오늘 어디서 들어왔는지 매일 보자") — 몇 시에, 어디서 왔는지를 기기마다 하루 한 번 센다.
  // 어디서: ?from= 꼬리표가 먼저, 없으면 카카오톡·네이버 앱 안 브라우저, 그다음 앞 쪽 주소(referrer), 아무것도 없으면 '직접'.
  let src = from;
  if (!src) {
    const ua = navigator.userAgent || '', ref = (() => { try { return new URL(document.referrer).hostname; } catch (e) { return ''; } })();
    // 앞 쪽 주소를 먼저 본다 — 네이버 검색에서 눌러 온 분을 따로 세려고 (대표 2026-10-26: "불특정 다수가 들어오는 가장 중요한 수치")
    src = /(^|\.)search\.naver\.com$/.test(ref) ? 'naver_search' : /(^|\.)blog\.naver\.com$/.test(ref) ? 'naver_blog' : /(^|\.)cafe\.naver\.com$/.test(ref) ? 'naver_cafe'
      : /(^|\.)google\./.test(ref) ? 'google' : /(^|\.)daum\.net$/.test(ref) ? 'daum' : /(^|\.)bing\.com$/.test(ref) ? 'bing' : /youtube|youtu\.be/.test(ref) ? 'yt'
      : /KAKAOTALK/i.test(ua) ? 'kakao' : /NAVER/.test(ua) ? 'naver' : /Instagram/i.test(ua) ? 'insta' : /FBAN|FBAV/i.test(ua) ? 'facebook' : /BAND\//i.test(ua) ? 'band'
      : !ref || ref.endsWith('omaju.kr') ? 'direct' : /naver/.test(ref) ? 'naver' : /kakao/.test(ref) ? 'kakao' : 'etc';
  }
  const hh = String(new Date().getHours()).padStart(2, '0');
  // setDoc 은 'hours.18' 같은 점 이름을 칸 안이 아니라 그 이름 그대로의 칸으로 만든다 → 관리자 '오늘 현황'에 시간·출처가 안 떴다(2026-10-26). 묶음 꼴로 넣는다.
  const add = { visits: increment(1), hours: { [hh]: increment(1) }, src: { [src]: increment(1) } };
  if (first) add.newDevices = increment(1);
  try { await setDoc(doc(db, 'stats', todayKey()), add, { merge: true }); } catch (e) {}
}
export async function bumpClick(corner) {
  try { await setDoc(doc(db, 'stats', todayKey()), { clicks: { [corner]: increment(1) } }, { merge: true }); } catch (e) {}
  track('corner_open', { corner });
}
export function track(name, params) { try { if (analytics) logEvent(analytics, name, params || {}); } catch (e) {} }

// ── 나의 수첩 ──
// kind: memo(메모) | event(일정: date=YYYY-MM-DD, time="14:00" 선택) | anniv(기억할 날: month, day, lunar(true/false))
export async function listNotes() {
  if (!me) return [];
  const s = await getDocs(query(collection(db, 'notes'), where('uid', '==', me.uid)));
  return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
export async function addNote(n) {
  if (!me) throw new Error('로그인이 필요합니다.');
  n.text = (n.text || '').trim(); if (!n.text) throw new Error('내용이 비어 있습니다.');
  const r = await addDoc(collection(db, 'notes'), { ...n, uid: me.uid, createdAt: Date.now() });
  return r.id;
}
export async function updateNote(id, n) { if (!me) throw new Error('로그인이 필요합니다.'); await updateDoc(doc(db, 'notes', id), { ...n, uid: me.uid, updatedAt: Date.now() }); }
export async function deleteNote(id) { await deleteDoc(doc(db, 'notes', id)); }

// ── 담아 두기 ──
// 마음에 든 글을 통째로 베껴 수첩에 모아 둔다. 원본이 바뀌거나 지워져도 담아 둔 것은 그대로 남는다.
// 문서 이름을 '아이디__열쇠'로 두어 두 번 담아도 하나로 덮어쓴다.
export async function listSaves() {
  if (!me) return [];
  const s = await getDocs(query(collection(db, 'saves'), where('uid', '==', me.uid)));
  return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
export async function addSave(it) {
  if (!me) throw new Error('로그인이 필요합니다.');
  const title = String(it.title || '').slice(0, 200);
  await setDoc(doc(db, 'saves', `${me.uid}__${it.key}`), { ...it, title, uid: me.uid, createdAt: Date.now() });
}
export async function removeSave(key) { if (!me) throw new Error('로그인이 필요합니다.'); await deleteDoc(doc(db, 'saves', `${me.uid}__${key}`)); }

// ── 아침 알림 (FCM 웹 푸시) ──
async function tokenId(t) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(h)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join(''); }
export async function pushSubscribe(hour) {
  const { getMessaging, getToken, isSupported } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging.js');
  if (!(await isSupported())) throw new Error('이 휴대폰(브라우저)에서는 알림을 받을 수 없습니다.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('알림이 꺼져 있습니다. 휴대폰 설정에서 오마주 알림을 허용해 주세요.');
  const reg = await navigator.serviceWorker.register('sw.js');
  const token = await getToken(getMessaging(app), { serviceWorkerRegistration: reg });
  if (!token) throw new Error('알림 등록에 실패했습니다. 잠시 뒤 다시 해 주세요.');
  const data = { token, hour, ua: navigator.userAgent.slice(0, 120), updated: serverTimestamp() };
  if (auth.currentUser) data.uid = auth.currentUser.uid;
  await setDoc(doc(db, 'push', await tokenId(token)), data);
  return token;
}
export async function pushUnsubscribe(token) {
  try { await deleteDoc(doc(db, 'push', await tokenId(token))); } catch (e) {}
  try { const { getMessaging, deleteToken } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging.js'); await deleteToken(getMessaging(app)); } catch (e) {}}

// ── 오늘 PLAY 순위 ──
// scores/{놀이_기간}/e/{uid} = { uid, nick, score(작을수록 좋음), label(보여 줄 기록), at }
export const weekKey = (d = new Date()) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return y + 'W' + String(w).padStart(2, '0'); };
export const rankKeys = game => ({ day: game + '_' + todayKey().replace(/-/g, ''), week: game + '_' + weekKey() });
export async function submitScore(game, score, label) {
  if (!me || !profile) return null;
  const out = {};
  for (const [period, k] of Object.entries(rankKeys(game))) {
    const ref = doc(db, 'scores', k, 'e', me.uid), old = await getDoc(ref);
    const best = !old.exists() || score < old.data().score;
    if (best) await setDoc(ref, { uid: me.uid, nick: profile.nick, score, label, at: serverTimestamp() });
    out[period] = best;
  }
  return out;
}
export async function topScores(k, n = 50) {
  const s = await getDocs(query(collection(db, 'scores', k, 'e'), orderBy('score'), limit(n)));
  return s.docs.map(d => d.data());
}
export async function myRank(k) {
  const col = collection(db, 'scores', k, 'e');
  const total = (await getCountFromServer(col)).data().count;
  if (!me) return { total };
  const mine = await getDoc(doc(db, 'scores', k, 'e', me.uid));
  if (!mine.exists()) return { total };
  const better = (await getCountFromServer(query(col, where('score', '<', mine.data().score)))).data().count;
  return { total, rank: better + 1, label: mine.data().label, score: mine.data().score };
}
