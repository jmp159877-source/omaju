// 나의 수첩: 말로 메모 · 나의 일정 · 기억할 날 (음력 가능)
import * as DB from './db.js';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const KIND = { memo: '메모', event: '일정', anniv: '기억할 날', note: '노트' };
let notes = [], toast = () => {}, modal = () => {}, closeModal = () => {}, openGate = () => {};

export function init(h) { toast = h.toast; modal = h.modal; closeModal = h.closeModal; openGate = h.openGate; bind(); }

// ── 음력 ──
// 음력 월/일이 올해 양력으로 며칠인지: 해의 모든 날을 음력으로 바꿔 보며 찾는다 (휴대폰 내장 달력 사용)
const lunarFmt = (() => { try { return new Intl.DateTimeFormat('ko-KR-u-ca-dangi', { month: 'numeric', day: 'numeric' }); } catch (e) { return null; } })();
function lunarOf(d) { if (!lunarFmt) return null; const p = lunarFmt.formatToParts(d); const m = p.find(x => x.type === 'month'), dd = p.find(x => x.type === 'day'); return m && dd ? [parseInt(m.value), parseInt(dd.value)] : null; }
const lunarCache = {};
function solarForLunar(month, day, year) {
  const k = `${year}-${month}-${day}`; if (lunarCache[k] !== undefined) return lunarCache[k];
  let found = null;
  for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) { const l = lunarOf(d); if (l && l[0] === month && l[1] === day) { found = new Date(d); break; } }
  lunarCache[k] = found; return found;
}
export function lunarToday() { return lunarOf(new Date()); }

// ── 날짜 계산 ──
function nextDate(n) {
  // 기억할 날: 올해(지났으면 내년)의 양력 날짜
  const y = new Date().getFullYear(), t = new Date(); t.setHours(0, 0, 0, 0);
  for (const yy of [y, y + 1]) {
    const d = n.lunar ? solarForLunar(n.month, n.day, yy) : new Date(yy, n.month - 1, n.day);
    if (d && d >= t) return d;
  }
  return null;
}
function daysUntil(d) { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 86400000); }
const WD = ['일', '월', '화', '수', '목', '금', '토'];
function fmtDate(key) { const [y, m, d] = key.split('-').map(Number); const dt = new Date(y, m - 1, d); return `${m}월 ${d}일 (${WD[dt.getDay()]})`; }
function fmtTime(t) { if (!t) return ''; const [h, m] = t.split(':').map(Number); const ap = h === 12 ? '낮' : h === 0 ? '밤' : h < 6 ? '새벽' : h < 12 ? '오전' : h < 18 ? '오후' : '저녁'; return `${ap} ${h % 12 || 12}시${m ? ' ' + m + '분' : ''}`; }

// ── 말에서 날짜·시간 뽑기 ──
export function parseSpeech(text, kind) {
  const r = { text: text.trim() };
  // 우리말 시각을 숫자로: '세 시 반' → '3시 반', '열두 시' → '12시'
  const KH = [['열두', 12], ['열한', 11], ['열', 10], ['아홉', 9], ['여덟', 8], ['일곱', 7], ['여섯', 6], ['다섯', 5], ['네', 4], ['세', 3], ['두', 2], ['한', 1]];
  let norm = ' ' + text + ' ';
  for (const [w, n] of KH) norm = norm.replace(new RegExp('(^|[^가-힣])' + w + '\\s*시(?![가-힣]*[작간])', 'g'), `$1${n}시`);
  let s = norm;
  const now = new Date();
  if (kind === 'anniv') {
    r.lunar = /음력/.test(s); s = s.replace(/음력|양력/g, ' ');
    const m = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/); if (m) { r.month = +m[1]; r.day = +m[2]; s = s.replace(m[0], ' '); }
    r.text = s.replace(/\s+/g, ' ').trim() || text.trim();
    return r;
  }
  if (kind === 'event') {
    let d = null;
    const m1 = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    const m2 = !m1 && s.match(/(?:^|\s)(\d{1,2})\s*일/);
    if (m1) { d = new Date(now.getFullYear(), +m1[1] - 1, +m1[2]); if (d < now && daysUntil(d) < -1) d.setFullYear(d.getFullYear() + 1); s = s.replace(m1[0], ' '); }
    else if (m2) { d = new Date(now.getFullYear(), now.getMonth(), +m2[1]); if (daysUntil(d) < -1) d.setMonth(d.getMonth() + 1); s = s.replace(m2[0], ' '); }
    else if (/오늘/.test(s)) { d = new Date(now); s = s.replace('오늘', ' '); }
    else if (/내일/.test(s)) { d = new Date(now); d.setDate(d.getDate() + 1); s = s.replace('내일', ' '); }
    else if (/모레/.test(s)) { d = new Date(now); d.setDate(d.getDate() + 2); s = s.replace('모레', ' '); }
    else { const wd = s.match(/(?:이번|다음)?\s*주?\s*(월|화|수|목|금|토|일)요일/); if (wd) { d = new Date(now); const want = WD.indexOf(wd[1]); let add = (want - d.getDay() + 7) % 7; if (add === 0 || /다음/.test(wd[0])) add += 7; d.setDate(d.getDate() + add); s = s.replace(wd[0], ' '); } }
    if (d) r.date = todayKey(d);
    const t = s.match(/(오전|오후|아침|저녁|밤|낮)?\s*(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분)?/);
    if (t) { let h = +t[2]; const ap = t[1] || ''; if ((/오후|저녁|밤|낮/.test(ap) && h < 12) || (!ap && h >= 1 && h <= 6)) h += 12; if (/오전|아침/.test(ap) && h === 12) h = 0; const mm = t[3] ? (t[3] === '반' ? 30 : +t[4]) : 0; r.time = `${pad(h)}:${pad(mm)}`; s = s.replace(t[0], ' '); }
    r.text = s.replace(/\s+/g, ' ').replace(/^(에|에는)\s/, '').trim() || text.trim();
  }
  return r;
}

// ── 음성 ── (다른 코너에서도 쓴다: 내 고향 둘러보기 주소 말하기)
export function listen(onText) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('이 브라우저에서는 말로 적기를 쓸 수 없습니다. 크롬으로 열어 주세요.'); return; }
  // 끊기지 않게: 계속 듣기 + 중간에 멈추면 저절로 다시 켜기, 말한 내용은 화면에 바로바로 글로
  let done = false, finalText = '', live = '', rec = null, restarts = 0;
  const mic = '<svg class="mic-ic" viewBox="0 0 24 24" width="44" height="44" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  modal(`<h2>듣고 있습니다</h2><div class="nb-listen"><span class="mic-big on">${mic}</span></div><p class="nb-say-tip">아무렇게나 편하게 말씀하세요.<br>다 말씀하시면 <b>다 했어요</b>를 누르세요.</p><div class="nb-live" id="nb-live"><span class="ph">여기에 말씀하신 내용이 글로 나옵니다…</span></div><div class="modal-actions"><button type="button" class="btn green" id="nb-done">다 했어요</button><button type="button" class="btn line" id="nb-stop">그만</button></div>`, () => {
    $('nb-done').onclick = () => { done = true; try { rec && rec.stop(); } catch (e) {} finish(); };
    $('nb-stop').onclick = () => { done = true; try { rec && rec.abort(); } catch (e) {} closeModal(); };
  });
  const show = () => { const el = $('nb-live'); if (el) el.innerHTML = (finalText + ' ' + live).trim() ? `${(finalText).replace(/</g, '&lt;')}${finalText && live ? ' ' : ''}<span class="itm">${live.replace(/</g, '&lt;')}</span>` : '<span class="ph">여기에 말씀하신 내용이 글로 나옵니다…</span>'; };
  const finish = () => { const t = (finalText + ' ' + live).replace(/\s+/g, ' ').trim(); if (t) onText(t); /* 같은 창 자리에 바로 확인 화면 → 수첩에 그대로 머묾 */ else { closeModal(); toast('말씀이 들리지 않았습니다. 다시 눌러 말씀해 주세요.'); } };
  const start = () => {
    // 안드로이드 크롬은 '계속 듣기'에서 중간 글자를 잘 안 보내고 같은 말을 겹쳐 보낸다 → 한 마디씩 듣고 저절로 이어 듣기
    const android = /android/i.test(navigator.userAgent);
    rec = new SR(); rec.lang = 'ko-KR'; rec.interimResults = true; rec.continuous = !android; rec.maxAlternatives = 1;
    let base = finalText;
    // PC: 어제까지 잘 되던 방식 그대로
    if (!android) rec.onresult = e => { live = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += (finalText ? ' ' : '') + r[0].transcript.trim(); else live += r[0].transcript; } show(); };
    else rec.onresult = e => {
      let fin = '', mid = '';
      for (let i = 0; i < e.results.length; i++) { const r = e.results[i], t = r[0].transcript.trim(); if (!t) continue; if (r.isFinal) { if (!fin.endsWith(t)) fin += (fin ? ' ' : '') + t; } else mid = t; }
      finalText = (base + ' ' + fin).trim(); live = mid; show();
    };
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { done = true; closeModal(); toast('마이크 사용을 허용해 주세요.'); } };
    rec.onend = () => { if (done || !$('nb-done')) return; if (live) { finalText += (finalText ? ' ' : '') + live.trim(); live = ''; } if (restarts++ < 40) setTimeout(() => { if (!done && $('nb-done')) try { start(); } catch (e) {} }, 150); else finish(); };
    try { rec.start(); } catch (e) { done = true; closeModal(); toast('마이크를 켤 수 없습니다.'); }
  };
  start();
}

// 말로 적은 것을 AI 로 다듬기 (api/tidy.js). 9초 안에 못 받거나 AI 가 안 돌면 null → 규칙 정리로
async function tidyNote(text, kind) {
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch('/api/tidy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal, body: JSON.stringify({ text, mode: kind, today: todayKey() }) });
    clearTimeout(tm); const j = await r.json(); return j && j.ai && j.text ? j : null;
  } catch (e) { return null; }
}

// ── 적기·고치기 창 ──
function editor(kind, n = {}, id = null) {
  const isNew = !id;
  const back = listOpen;   // 목록 창에서 들어왔으면 끝나고 그 목록으로 돌아간다
  const fields = kind === 'memo' ? '' : kind === 'note' ? '' : kind === 'event'
    ? `<div class="field"><label>날짜</label><input type="date" id="nb-date" value="${esc(n.date || todayKey())}"></div><div class="field"><label>시간 (없으면 비워 두세요)</label><input type="time" id="nb-time" value="${esc(n.time || '')}"></div>`
    : `<div class="nb-row"><div class="field"><label>월</label><input type="number" id="nb-m" min="1" max="12" value="${n.month || ''}"></div><div class="field"><label>일</label><input type="number" id="nb-d" min="1" max="30" value="${n.day || ''}"></div></div><label class="nb-check"><input type="checkbox" id="nb-lunar" ${n.lunar ? 'checked' : ''}> 음력</label>`;
  modal(`<h2>${isNew ? KIND[kind] + ' 적기' : KIND[kind] + ' 고치기'}</h2>
    ${kind === 'note' ? `<div class="field"><label>제목</label><input id="nb-title" maxlength="30" placeholder="예: 산악회 모임" value="${esc(n.title || '')}"></div>` : ''}
    <div class="field"><label>${kind === 'memo' ? '내용' : kind === 'note' ? '내용' : kind === 'event' ? '무슨 일' : '무슨 날 (예: 큰딸 생일)'}</label><textarea id="nb-text" rows="${kind === 'note' ? 12 : kind === 'memo' ? 4 : 2}" maxlength="${kind === 'note' ? 2000 : 500}">${esc(n.text || '')}</textarea></div>
    ${fields}
    <div class="modal-actions"><button type="button" class="btn green" id="nb-save">${isNew ? '저장' : '고친 내용 저장'}</button>${isNew ? '' : '<button type="button" class="btn line danger" id="nb-del">지우기</button>'}</div>
    <p class="msg" id="nb-msg"></p>`, () => {
    $('nb-save').onclick = async () => {
      const data = { kind, text: $('nb-text').value.trim() };
      if (kind === 'note') { data.title = ($('nb-title').value || '').trim(); if (!data.title) return msg('제목을 적어 주세요.'); }
      const moved = n.fromMemo;   // 메모에서 옮겨 온 것이면 원래 메모는 지운다
      if (kind === 'event') { data.date = $('nb-date').value; data.time = $('nb-time').value || ''; if (!data.date) return msg('날짜를 넣어 주세요.'); }
      if (kind === 'anniv') { data.month = +$('nb-m').value; data.day = +$('nb-d').value; data.lunar = $('nb-lunar').checked; if (!(data.month >= 1 && data.month <= 12 && data.day >= 1 && data.day <= 31)) return msg('월과 일을 넣어 주세요.'); }
      if (!data.text) return msg('내용을 적어 주세요.');
      try { if (isNew) await DB.addNote(data); else await DB.updateNote(id, data); closeModal(); toast(isNew ? '적어 두었습니다.' : '고쳤습니다.'); await refresh();
        if (moved) { try { await DB.deleteNote(moved); await refresh(); } catch (e2) {} }
        if (back) openList(back);
        else if (kind !== 'note') openCal(kind === 'event' ? data.date : todayKey()); } catch (e) { msg(e.message); }
    };
    if (!isNew) $('nb-del').onclick = () => { const acts = $('nb-del').parentElement; acts.innerHTML = '<p class="nb-ask">정말 지울까요? 지우면 되돌릴 수 없습니다.</p><button type="button" class="btn line danger" id="nb-del-yes">지우기</button><button type="button" class="btn green" id="nb-del-no">그만두기</button>'; $('nb-del-no').onclick = () => { closeModal(); editor(kind, n, id); }; $('nb-del-yes').onclick = async () => { try { await DB.deleteNote(id); closeModal(); toast('지웠습니다.'); await refresh(); if (back) openList(back); } catch (e) { msg(e.message); } }; };
    $('nb-text').focus();
  });
  const msg = t => { $('nb-msg').textContent = t; };
}

// ── 달력 보기: 메모(적은 날)·일정·기억할 날을 한 달 달력에 점으로, 날짜를 누르면 그날 것 ──
let calY = new Date().getFullYear(), calM = new Date().getMonth(), calSel = todayKey();
let memoAll = false, ntOpen = null;
const LIST = {};          // 칸별 목록 HTML — 창을 열 때 쓴다
let listOpen = null;      // 지금 열려 있는 칸

/** 적어 둔 뒤 그날 달력을 펼쳐 보여 준다 — 적자마자 그날 것만 눈에 들어오게. */
function openCal(key) {
  const [y, m] = key.split('-').map(Number);
  calY = y; calM = m - 1; calSel = key;
  const cb = $('nb-calbtn'); if (cb) { cb.setAttribute('aria-expanded', 'true'); cb.querySelector('b').textContent = '달력 닫기'; }
  const w = $('nb-calwrap'); if (w) w.classList.add('open');
  renderCal();
  if (w) w.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function itemsOn(key) {
  const [y, m, d] = key.split('-').map(Number), out = [];
  notes.forEach(n => {
    if (n.kind === 'event' && n.date === key) out.push({ n, t: '일정', c: 'ev' });
    else if (n.kind === 'memo' && todayKey(new Date(n.createdAt || 0)) === key) out.push({ n, t: '메모', c: 'mm' });
    else if (n.kind === 'anniv') { const sd = n.lunar ? solarForLunar(n.month, n.day, y) : new Date(y, n.month - 1, n.day); if (sd && sd.getMonth() + 1 === m && sd.getDate() === d) out.push({ n, t: '기억할 날', c: 'an' }); }
  });
  return out;
}
function renderCal() {
  const el = $('nb-cal'); if (!el) return;
  const first = new Date(calY, calM, 1), start = first.getDay(), days = new Date(calY, calM + 1, 0).getDate(), today = todayKey();
  let cells = '';
  for (let i = 0; i < start; i++) cells += '<span class="cal-d empty"></span>';
  for (let d = 1; d <= days; d++) {
    const key = `${calY}-${pad(calM + 1)}-${pad(d)}`, it = itemsOn(key), wd = (start + d - 1) % 7;
    const dots = it.length ? '<i class="dot"></i>' : '';
    cells += `<button type="button" class="cal-d${key === today ? ' today' : ''}${key === calSel ? ' sel' : ''}${wd === 0 ? ' sun' : wd === 6 ? ' sat' : ''}" data-cal="${key}"><b>${d}</b><span class="dots">${dots}</span></button>`;
  }
  const list = itemsOn(calSel);
  const EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  el.innerHTML = `<div class="cal-head"><button type="button" class="cal-nav" data-calm="-1" aria-label="지난달">‹</button><div class="cal-title"><b>${calM + 1}</b><span><em>${EN[calM]}</em><small>${calY}</small></span></div><button type="button" class="cal-nav" data-calm="1" aria-label="다음 달">›</button></div>
    <div class="cal-wk">${WD.map((w, i) => `<span class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</span>`).join('')}</div><div class="cal-grid">${cells}</div>
    <div class="cal-day"><p class="cal-day-h">${fmtDate(calSel)}${calSel === today ? ' · 오늘' : ''}</p>${list.length ? list.map(({ n, t, c }) => `<div class="nb-item" data-id="${n.id}"><span class="nb-when"><i class="cal-tag">${t}</i>${n.time ? ' · ' + fmtTime(n.time) : ''}</span><span class="nb-txt">${esc(n.text)}</span><span class="nb-acts"><span class="nb-edit">고치기</span><button type="button" class="nb-rm" data-rm="${n.id}">지우기</button></span></div>`).join('') : '<p class="nb-empty">이날 적어 둔 것이 없습니다.</p>'}</div>`;
}
window.addEventListener('hashchange', () => { if (location.hash === '#g4' && DB.currentUser()) refresh(); });
document.addEventListener('click', e => {
  const cb = e.target.closest('#nb-calbtn'); if (cb) { const open = cb.getAttribute('aria-expanded') !== 'true'; cb.setAttribute('aria-expanded', open); $('nb-calwrap').classList.toggle('open', open); cb.querySelector('b').textContent = open ? '달력 닫기' : '달력으로 보기'; return; }
  const mo = e.target.closest('#nb-memo-more'); if (mo) { memoAll = !memoAll; render(); return; }
  const d = e.target.closest('[data-cal]'); if (d) { calSel = d.dataset.cal; renderCal(); return; }
  const m = e.target.closest('[data-calm]'); if (m) { calM += +m.dataset.calm; if (calM < 0) { calM = 11; calY--; } if (calM > 11) { calM = 0; calY++; } renderCal(); }
});

// ── 목록 ──
function render() {
  renderCal();
  const by = k => notes.filter(n => n.kind === k);
  const memo = by('memo'); const memoShow = memoAll ? memo : memo.slice(0, 20);
  LIST.memo = memo.length ? memoShow.map(n => `<div class="nb-item" data-id="${n.id}"><span class="nb-when">${fmtDate(todayKey(new Date(n.createdAt || Date.now())))}</span><span class="nb-txt">${esc(n.text)}</span><span class="nb-acts"><span class="nb-edit">고치기</span><button type="button" class="nb-tonote" data-tonote="${n.id}">노트로</button><button type="button" class="nb-rm" data-rm="${n.id}">지우기</button></span></div>`).join('') : '<p class="nb-empty">아직 메모가 없습니다.<br><span class="nb-eg">예) "오늘 장 볼 것 — 두부, 대파" · "주차 B3 열두 번째"</span></p>';
  if (memo.length > 20) LIST.memo += `<button type="button" class="nb-more" id="nb-memo-more">${memoAll ? '접기' : `지난 메모 ${memo.length - 20}개 더 보기`}</button>`;
  const ev = by('event').filter(n => n.date >= todayKey()).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const past = by('event').filter(n => n.date < todayKey()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  LIST.event = (ev.length ? ev.map(n => `<div class="nb-item ${n.date === todayKey() ? 'today' : ''}" data-id="${n.id}"><span class="nb-when">${n.date === todayKey() ? '오늘' : fmtDate(n.date)}${n.time ? ' · ' + fmtTime(n.time) : ''}</span><span class="nb-txt">${esc(n.text)}</span><span class="nb-acts"><span class="nb-edit">고치기</span><button type="button" class="nb-rm" data-rm="${n.id}">지우기</button></span></div>`).join('') : '<p class="nb-empty">다가오는 일정이 없습니다.<br><span class="nb-eg">예) "20일 오후 두 시 정형외과" · "다음 주 토요일 동창회"</span></p>')
    + (past.length ? `<p class="nb-sub">지난 일정</p>` + past.map(n => `<div class="nb-item past" data-id="${n.id}"><span class="nb-when">${fmtDate(n.date)}</span><span class="nb-txt">${esc(n.text)}</span><span class="nb-acts"><span class="nb-edit">고치기</span><button type="button" class="nb-rm" data-rm="${n.id}">지우기</button></span></div>`).join('') : '');
  // 나의 노트 — 오래 두고 찾아보는 것이라 날짜가 아니라 **최근 고친 순**. 목록에는 제목만.
  const nt = by('note').slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  LIST.note = nt.length ? nt.map(x => `<div class="nt-row${ntOpen === x.id ? ' open' : ''}" data-nt="${x.id}"><button type="button" class="nt-head">${x.pinned ? '<em class="nt-pin" aria-label="고정됨">✦</em>' : ''}<b>${esc(x.title || '제목 없음')}</b><i>${ntOpen === x.id ? '▴' : '▾'}</i></button>${ntOpen === x.id ? `<div class="nt-body">${esc(x.text).replace(/\n/g, '<br>')}</div><div class="nt-acts"><button type="button" class="btn line" data-nt-pin="${x.id}">${x.pinned ? '고정 풀기' : '맨 위에 두기'}</button><button type="button" class="btn line" data-nt-edit="${x.id}">고치기</button><button type="button" class="btn line danger" data-rm="${x.id}">지우기</button></div>` : ''}</div>`).join('')
    : '<p class="nb-empty">아직 노트가 없습니다.<br><span class="nb-eg">예) "산악회 모임" · "자주 타는 버스" · "연락처"</span></p>';
  const an = by('anniv').map(n => ({ n, d: nextDate(n) })).filter(x => x.d).sort((a, b) => a.d - b.d);
  LIST.anniv = an.length ? an.map(({ n, d }) => { const left = daysUntil(d); return `<div class="nb-item ${left === 0 ? 'today' : ''}" data-id="${n.id}"><span class="nb-when">${n.lunar ? '음력 ' : ''}${n.month}월 ${n.day}일 → ${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})${left === 0 ? ' · 오늘' : left === 1 ? ' · 내일' : ` · ${left}일 남음`}</span><span class="nb-txt">${esc(n.text)}</span><span class="nb-acts"><span class="nb-edit">고치기</span><button type="button" class="nb-rm" data-rm="${n.id}">지우기</button></span></div>`; }).join('') : '<p class="nb-empty">아직 없습니다.<br><span class="nb-eg">예) "음력 3월 12일 큰딸 생일" · "11월 3일 결혼기념일"</span></p>';
  // 적어 둔 것이 있으면 '누르면 고치거나 지울 수 있어요' 한 줄
  for (const k of ['memo', 'event', 'anniv']) if (/nb-item/.test(LIST[k] || '')) LIST[k] = '<p class="nb-tip">적어 둔 것을 누르면 고칠 수 있어요. 지우려면 지우기를 누르세요.</p>' + LIST[k];
  // 칸에는 개수만, 목록은 눌러 들어가서 (운영자 2026-10-21: 첫 화면에 줄줄이 따라 나오면 안 된다)
  const counts = { memo: memo.length, event: by('event').length, anniv: by('anniv').length, note: nt.length };
  for (const k in counts) { const el = $('nb-n-' + k); if (el) el.textContent = counts[k]; }
  if (listOpen && listOpen !== 'save') paintList();
  // 첫 화면 오늘 줄
  const tl = $('today-line'); if (!tl) return;
  const todays = [...ev.filter(n => n.date === todayKey()).map(n => (n.time ? fmtTime(n.time) + ' ' : '') + n.text), ...an.filter(x => daysUntil(x.d) === 0).map(x => x.n.text), ...an.filter(x => daysUntil(x.d) === 1).map(x => '내일 ' + x.n.text)];
  tl.hidden = !todays.length; tl.textContent = todays.length ? '오늘 · ' + todays.join(' · ') : '';
}

function askRemove(id) {
  const n = notes.find(x => x.id === id); if (!n) return;
  const back = listOpen;
  modal(`<h2>지울까요?</h2><p class="nb-ask">${esc(n.text)}</p><p class="note">지우면 되돌릴 수 없습니다.</p>
    <div class="modal-actions"><button type="button" class="btn line danger" id="nb-rm-yes">지우기</button><button type="button" class="btn green" id="nb-rm-no">그만두기</button></div>`, () => {
    $('nb-rm-no').onclick = () => closeModal();
    $('nb-rm-yes').onclick = async () => { try { await DB.deleteNote(id); closeModal(); toast('지웠습니다.'); await refresh(); if (back) openList(back); } catch (e) { toast(e.message); } };
  });
}

async function refresh() { try { notes = await DB.listNotes(); } catch (e) { notes = []; } render(); }

// ── 담아 둔 것 ──
// 코너에서 담아 둔 글을 그대로 보관한다. 누르면 그 자리에서 펼쳐 읽는다.
let saves = [], svOpen = null;
const SV_LABEL = { dog: '댕댕이', cat: '냥이', 'solo-day': '혼자 떠나는 하루 코스', 'solo-eat': '혼밥 맛집', 'solo-hobby': '혼자 즐기는 취미 자리', 'solo-see': '혼자 보기 좋은 것', 'solo-home': '혼자 사는 살림', 'solo-trip': '혼자 떠나는 여행', mind: '마음 한 줄', body: '몸 한 가지', food: '오늘의 한 끼', book: '오늘의 한 권', quiz: '시사 상식', culture: '오늘의 문화' };
const CU_LABEL = { poem: '시', painting: '그림', essay: '에세이', quote: '명언', humor: '유머', bible: '성경', dharma: '법문' };
// 코너마다 펼쳐서 보여 줄 차례 — [작은 제목, 열쇠]. 작은 제목이 빈 칸이면 제목 없이 글만.
const SV_FIELDS = {
  mind: [['', 'line'], ['', 'by'], ['풀이', 'note'], ['오늘 해 볼 것', 'todo']],
  body: [['', 'line'], ['', 'note'], ['오늘 해 볼 것', 'todo'], ['', 'tip']],
  book: [['', 'blurb'], ['멈추게 되는 대목', 'scene'], ['', 'why']],
  quiz: [['', 'meaning'], ['왜 나왔나', 'why'], ['이렇게 씁니다', 'example']],
  poem: [['', 'text'], ['이 시가 나온 때', 'bg'], ['감상', 'note']],
  painting: [['', 'about'], ['화가 이야기', 'artist_story']],
  essay: [['', 'paras'], ['', 'by']],
  quote: [['', 'text'], ['', 'who'], ['', 'note']],
  humor: [['', 'text'], ['', 'punch']],
  bible: [['', 'text'], ['', 'ref'], ['묵상', 'note']],
  dharma: [['', 'text'], ['', 'src'], ['풀이', 'note']],
};
function svWhen(d) { if (!d) return ''; const [y, m, dd] = d.split('-').map(Number); return `${m}월 ${dd}일`; }
function svBody(it) {
  const d = it.data || {}, out = [];
  if (it.corner === 'food') {
    if (d.lead) out.push(`<p class="sv-p">${esc(d.lead)}</p>`);
    if (d.ingredients && d.ingredients.length) out.push(`<p class="is-sub">재료</p><ul class="ing">${d.ingredients.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
    if (d.steps && d.steps.length) out.push(`<p class="is-sub">만드는 법</p><ol class="steps">${d.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`);
    if (d.tip) out.push(`<p class="sv-p">${esc(d.tip)}</p>`);
  } else if (it.corner === 'dog' || it.corner === 'cat') {
    if (d.hook) out.push(`<p class="sv-p">${esc(d.hook)}</p>`);
    if (d.why) out.push(`<p class="is-sub">왜 그럴까요</p><p class="sv-p">${esc(d.why)}</p>`);
    if (d.todo && d.todo.length) out.push(`<p class="is-sub">이렇게 해 보세요</p><ol class="steps">${d.todo.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`);
    if (d.vet) out.push(`<p class="is-sub">이럴 땐 동물병원에</p><p class="sv-p">${esc(d.vet)}</p>`);
  } else if (/^solo-/.test(it.corner)) {
    if (d.hook) out.push(`<p class="sv-p">${esc(d.hook)}</p>`);
    (d.items || []).forEach((x, i) => out.push(`<p class="is-sub">${i + 1}. ${esc(x.name)}${x.where ? ' · ' + esc(x.where) : ''}</p><p class="sv-p">${esc(x.note)}</p>${x.solo ? `<p class="sv-p">${esc(x.solo)}</p>` : ''}${x.where ? `<p class="sv-p"><a href="https://map.naver.com/p/search/${encodeURIComponent(x.where + ' ' + x.name)}" target="_blank" rel="noopener">지도에서 보기</a></p>` : ''}`));
    if (d.tips && d.tips.length) out.push(`<p class="is-sub">알아 두면 좋아요</p>${d.tips.map(x => `<p class="sv-p">${esc(x)}</p>`).join('')}`);
  } else {
    if (it.corner === 'painting' || (it.corner === 'culture' && it.kind === 'painting')) {
      if (d.img) out.push(`<figure class="sv-fig"><img src="${esc(d.img)}" alt="${esc(d.title || '')}" referrerpolicy="no-referrer" loading="lazy"></figure>`);
    }
    for (const [label, k] of (SV_FIELDS[it.kind] || SV_FIELDS[it.corner] || [])) {
      const v = d[k]; if (!v) continue;
      if (label) out.push(`<p class="is-sub">${esc(label)}</p>`);
      out.push(Array.isArray(v) ? v.map(x => `<p class="sv-p">${esc(x)}</p>`).join('') : `<p class="sv-p">${esc(v)}</p>`);
    }
  }
  return out.join('') || '<p class="sv-p">담아 둔 글이 비어 있습니다.</p>';
}
function svListHtml() {
  if (!saves.length) return '<p class="nb-empty">아직 담아 둔 것이 없습니다. 마음에 드는 글 밑에서 <b>담아 두기</b>를 누르면 여기에 모입니다.</p>';
  return saves.map(it => {
    const open = svOpen === it.key;
    const tag = it.corner === 'culture' ? (CU_LABEL[it.kind] || SV_LABEL.culture) : (SV_LABEL[it.corner] || '');
    return `<div class="sv-item${open ? ' open' : ''}"><button type="button" class="sv-head" data-sopen="${esc(it.key)}" aria-expanded="${open}"><span class="sv-meta"><span class="sv-tag">${esc(tag)}</span><span class="sv-date">${esc(svWhen(it.date))}</span></span><strong>${esc(it.title || '')}</strong></button>${open ? `<div class="sv-full">${svBody(it)}<button type="button" class="sv-rm" data-srm="${esc(it.key)}">수첩에서 빼기</button></div>` : ''}</div>`;
  }).join('');
}
export async function refreshSaves() {
  try { saves = await DB.listSaves(); } catch (e) { saves = []; }
  renderSaves();
}
/** 담아 둔 것 개수는 칸에 적고, 창이 열려 있으면 목록도 다시 그린다. */
function renderSaves() {
  const n = $('nb-n-save'); if (n) n.textContent = saves.length;
  if (listOpen === 'save') paintList();
}


// ── 칸을 눌러 들어가면 그 칸의 목록만 한 화면에 (운영자 2026-10-21) ──
const LIST_TITLE = { memo: '적어 둔 메모', event: '나의 일정', anniv: '기억할 날', note: '나의 노트', save: '담아 둔 것' };
function paintList() {
  const box = $('nb-listbox'); if (!box) return;
  box.innerHTML = listOpen === 'save' ? svListHtml() : (LIST[listOpen] || '');
  box.className = listOpen === 'note' ? 'nb-list nt-list' : listOpen === 'save' ? 'sv-list' : 'nb-list';
  const f = $('nb-find');
  if (f) { f.hidden = box.querySelectorAll('.nb-item, .nt-row, .sv-item').length < 5; if (!f.hidden && f.value) filterList(); }
}
/** 찾기: 줄 안의 글에 그 말이 없으면 감춘다. 목록이 쌓여도 두 글자로 찾게. */
function filterList() {
  const f = $('nb-find'), box = $('nb-listbox'); if (!f || !box) return;
  const q = f.value.trim().toLowerCase();
  let seen = 0;
  for (const row of box.querySelectorAll('.nb-item, .nt-row, .sv-item')) {
    const hit = !q || row.textContent.toLowerCase().includes(q);
    row.hidden = !hit; if (hit) seen++;
  }
  const old = box.querySelector('.nb-none'); if (old) old.remove();
  if (q && !seen) box.insertAdjacentHTML('beforeend', '<p class="nb-none">찾는 말이 없습니다.</p>');
}
function openList(kind) {
  listOpen = kind;
  ntOpen = null; svOpen = null;   // 들어오면 늘 목차부터 — 펼쳐 둔 것은 접고 시작한다
  const add = kind === 'save' ? '' :
    `<div class="modal-actions nb-add"><button type="button" class="nb-mic" data-kind="${kind}">말로 적기</button><button type="button" class="nb-hand" data-kind="${kind}">${kind === 'note' ? '새 노트 쓰기' : '손으로 적기'}</button></div>`;
  modal(`<h2>${LIST_TITLE[kind]}</h2>${add}<input type="search" class="nb-find" id="nb-find" placeholder="찾기 (예: 버스)" hidden><div id="nb-listbox"></div>`, () => {
    $('modal').classList.add('nb-listmodal');
    paintList();
    $('nb-find').oninput = filterList;
    const x = $('modal-x'); if (x) x.onclick = () => { listOpen = null; closeModal(); };
  });
}

/** 수첩 화면은 지워지지 않고 숨었다 나오는 것이라, 펼쳐 둔 달력이 그대로 남아 있었다
    (운영자 2026-10-21 밤). 들어올 때마다 접어 둔다. */
function shutCal() {
  const cb = $('nb-calbtn'); if (!cb) return;
  cb.setAttribute('aria-expanded', 'false');
  const b = cb.querySelector('b'); if (b) b.textContent = '달력으로 보기';
  const w = $('nb-calwrap'); if (w) w.classList.remove('open');
}

function bind() {
  addEventListener('hashchange', () => { if (location.hash === '#g4') shutCal(); });
  document.addEventListener('click', e => {
    const mic = e.target.closest('.nb-mic'); if (mic) { const kind = mic.dataset.kind; listen(async t => {
      const p = kind === 'note' ? { text: t } : parseSpeech(t, kind);
      // 노트는 제목이 있어야 찾는다 — 말한 첫머리를 제목으로 미리 넣어 두고 고칠 수 있게 한다
      if (kind === 'note') p.title = (t.split(/[.\n]/)[0] || t).trim().slice(0, 20);
      // AI 정리 (대표 2026-10-25: "말로 메모·일정 등록이 깔끔하게 안 된다") — 군말 빼고 다듬고, 일정은 날짜·시간까지. 안 되면 위의 규칙 정리 그대로
      const live = $('nb-live'); if (live) live.innerHTML = '<span class="ph">깔끔하게 정리하는 중…</span>';
      const a = await tidyNote(t, kind);
      if (a) {
        p.text = a.text || p.text;
        if (kind === 'note' && a.title) p.title = a.title;
        if (kind === 'event') { if (a.date) p.date = a.date; if (a.time) p.time = a.time; }
        if (kind === 'anniv') { if (a.month) p.month = a.month; if (a.day) p.day = a.day; if (a.lunar) p.lunar = true; }
      }
      editor(kind, p); }); return; }
    const hand = e.target.closest('.nb-hand'); if (hand) { editor(hand.dataset.kind); return; }
    const op = e.target.closest('[data-nbopen]'); if (op) { openList(op.dataset.nbopen); return; }
    const np = e.target.closest('[data-nt-pin]'); if (np) { const x = notes.find(y => y.id === np.dataset.ntPin);
      if (x) DB.updateNote(x.id, { pinned: !x.pinned }).then(async () => { toast(x.pinned ? '고정을 풀었습니다.' : '맨 위에 두었습니다.'); await refresh(); }).catch(err => toast(err.message)); return; }
    const tn = e.target.closest('[data-tonote]'); if (tn) { const m = notes.find(y => y.id === tn.dataset.tonote);
      if (m) editor('note', { text: m.text, title: m.text.trim().slice(0, 20), fromMemo: m.id }); return; }
    const ne = e.target.closest('[data-nt-edit]'); if (ne) { const n = notes.find(x => x.id === ne.dataset.ntEdit); if (n) editor('note', n, n.id); return; }
    const rm = e.target.closest('[data-rm]'); if (rm) { askRemove(rm.dataset.rm); return; }
    const nh = e.target.closest('.nt-head'); if (nh) { const id = nh.closest('[data-nt]').dataset.nt; ntOpen = ntOpen === id ? null : id; render(); return; }
    const it = e.target.closest('.nb-item'); if (it) { const n = notes.find(x => x.id === it.dataset.id); if (n) editor(n.kind, n, n.id); return; }
    const so = e.target.closest('[data-sopen]'); if (so) { svOpen = svOpen === so.dataset.sopen ? null : so.dataset.sopen; renderSaves(); return; }
    const srm = e.target.closest('[data-srm]'); if (srm) { const k = srm.dataset.srm; DB.removeSave(k).then(() => { saves = saves.filter(x => x.key !== k); svOpen = null; renderSaves(); toast('수첩에서 뺐습니다.'); if (window.omajuSvRemoved) window.omajuSvRemoved(k); }).catch(err => toast(err.message)); return; }
    if (e.target.id === 'nb-login') openGate('나의 수첩을 쓰려면');
  });
  DB.onUser(u => { $('nb-gate').hidden = !!u; $('nb-body').hidden = !u; if (u) { refresh(); refreshSaves(); } else { notes = []; saves = []; renderSaves(); const tl = $('today-line'); if (tl) tl.hidden = true; } });
}
