// 나의 수첩: 말로 메모 · 나의 일정 · 기억할 날 (음력 가능)
import * as DB from './db.js';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const KIND = { memo: '메모', event: '일정', anniv: '기억할 날' };
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

// ── 적기·고치기 창 ──
function editor(kind, n = {}, id = null) {
  const isNew = !id;
  const fields = kind === 'memo' ? '' : kind === 'event'
    ? `<div class="field"><label>날짜</label><input type="date" id="nb-date" value="${esc(n.date || todayKey())}"></div><div class="field"><label>시간 (없으면 비워 두세요)</label><input type="time" id="nb-time" value="${esc(n.time || '')}"></div>`
    : `<div class="nb-row"><div class="field"><label>월</label><input type="number" id="nb-m" min="1" max="12" value="${n.month || ''}"></div><div class="field"><label>일</label><input type="number" id="nb-d" min="1" max="30" value="${n.day || ''}"></div></div><label class="nb-check"><input type="checkbox" id="nb-lunar" ${n.lunar ? 'checked' : ''}> 음력</label>`;
  modal(`<h2>${isNew ? KIND[kind] + ' 적기' : KIND[kind] + ' 고치기'}</h2>
    <div class="field"><label>${kind === 'memo' ? '내용' : kind === 'event' ? '무슨 일' : '무슨 날 (예: 큰딸 생일)'}</label><textarea id="nb-text" rows="${kind === 'memo' ? 4 : 2}" maxlength="500">${esc(n.text || '')}</textarea></div>
    ${fields}
    <div class="modal-actions"><button type="button" class="btn green" id="nb-save">${isNew ? '저장' : '고친 내용 저장'}</button>${isNew ? '' : '<button type="button" class="btn line danger" id="nb-del">지우기</button>'}</div>
    <p class="msg" id="nb-msg"></p>`, () => {
    $('nb-save').onclick = async () => {
      const data = { kind, text: $('nb-text').value.trim() };
      if (kind === 'event') { data.date = $('nb-date').value; data.time = $('nb-time').value || ''; if (!data.date) return msg('날짜를 넣어 주세요.'); }
      if (kind === 'anniv') { data.month = +$('nb-m').value; data.day = +$('nb-d').value; data.lunar = $('nb-lunar').checked; if (!(data.month >= 1 && data.month <= 12 && data.day >= 1 && data.day <= 31)) return msg('월과 일을 넣어 주세요.'); }
      if (!data.text) return msg('내용을 적어 주세요.');
      try { if (isNew) await DB.addNote(data); else await DB.updateNote(id, data); closeModal(); toast(isNew ? '적어 두었습니다.' : '고쳤습니다.'); await refresh(); } catch (e) { msg(e.message); }
    };
    if (!isNew) $('nb-del').onclick = () => { const acts = $('nb-del').parentElement; acts.innerHTML = '<p class="nb-ask">정말 지울까요? 지우면 되돌릴 수 없습니다.</p><button type="button" class="btn line danger" id="nb-del-yes">지우기</button><button type="button" class="btn green" id="nb-del-no">그만두기</button>'; $('nb-del-no').onclick = () => { closeModal(); editor(kind, n, id); }; $('nb-del-yes').onclick = async () => { try { await DB.deleteNote(id); closeModal(); toast('지웠습니다.'); await refresh(); } catch (e) { msg(e.message); } }; };
    $('nb-text').focus();
  });
  const msg = t => { $('nb-msg').textContent = t; };
}

// ── 달력 보기: 메모(적은 날)·일정·기억할 날을 한 달 달력에 점으로, 날짜를 누르면 그날 것 ──
let calY = new Date().getFullYear(), calM = new Date().getMonth(), calSel = todayKey();
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
  const cb = e.target.closest('#nb-calbtn'); if (cb) { const open = cb.getAttribute('aria-expanded') !== 'true'; cb.setAttribute('aria-expanded', open); $('nb-calwrap').classList.toggle('open', open); cb.querySelector('span').textContent = open ? '달력 닫기' : '달력 보기'; return; }
  const d = e.target.closest('[data-cal]'); if (d) { calSel = d.dataset.cal; renderCal(); return; }
  const m = e.target.closest('[data-calm]'); if (m) { calM += +m.dataset.calm; if (calM < 0) { calM = 11; calY--; } if (calM > 11) { calM = 0; calY++; } renderCal(); }
});

// ── 목록 ──
function render() {
  renderCal();
  const by = k => notes.filter(n => n.kind === k);
  const memo = by('memo'); $('nb-memo').innerHTML = memo.length ? memo.map(n => `<div class="nb-item" data-id="${n.id}"><span class="nb-when">${fmtDate(todayKey(new Date(n.createdAt || Date.now())))}</span><span class="nb-txt">${esc(n.text)}</span><span class="nb-acts"><span class="nb-edit">고치기</span><button type="button" class="nb-rm" data-rm="${n.id}">지우기</button></span></div>`).join('') : '<p class="nb-empty">아직 메모가 없습니다. 위의 "말로 적기"를 눌러 보세요.</p>';
  const ev = by('event').filter(n => n.date >= todayKey()).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const past = by('event').filter(n => n.date < todayKey()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  $('nb-event').innerHTML = (ev.length ? ev.map(n => `<div class="nb-item ${n.date === todayKey() ? 'today' : ''}" data-id="${n.id}"><span class="nb-when">${n.date === todayKey() ? '오늘' : fmtDate(n.date)}${n.time ? ' · ' + fmtTime(n.time) : ''}</span><span class="nb-txt">${esc(n.text)}</span><span class="nb-acts"><span class="nb-edit">고치기</span><button type="button" class="nb-rm" data-rm="${n.id}">지우기</button></span></div>`).join('') : '<p class="nb-empty">다가오는 일정이 없습니다.</p>')
    + (past.length ? `<p class="nb-sub">지난 일정</p>` + past.map(n => `<div class="nb-item past" data-id="${n.id}"><span class="nb-when">${fmtDate(n.date)}</span><span class="nb-txt">${esc(n.text)}</span><span class="nb-acts"><span class="nb-edit">고치기</span><button type="button" class="nb-rm" data-rm="${n.id}">지우기</button></span></div>`).join('') : '');
  const an = by('anniv').map(n => ({ n, d: nextDate(n) })).filter(x => x.d).sort((a, b) => a.d - b.d);
  $('nb-anniv').innerHTML = an.length ? an.map(({ n, d }) => { const left = daysUntil(d); return `<div class="nb-item ${left === 0 ? 'today' : ''}" data-id="${n.id}"><span class="nb-when">${n.lunar ? '음력 ' : ''}${n.month}월 ${n.day}일 → ${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})${left === 0 ? ' · 오늘' : left === 1 ? ' · 내일' : ` · ${left}일 남음`}</span><span class="nb-txt">${esc(n.text)}</span><span class="nb-acts"><span class="nb-edit">고치기</span><button type="button" class="nb-rm" data-rm="${n.id}">지우기</button></span></div>`; }).join('') : '<p class="nb-empty">아직 없습니다. 가족 생일부터 하나 적어 보세요.</p>';
  // 적어 둔 것이 있으면 '누르면 고치거나 지울 수 있어요' 한 줄
  ['nb-memo', 'nb-event', 'nb-anniv'].forEach(k => { const el = $(k); if (el && el.querySelector('.nb-item')) el.insertAdjacentHTML('afterbegin', '<p class="nb-tip">적어 둔 것을 누르면 고칠 수 있어요. 지우려면 지우기를 누르세요.</p>'); });
  // 첫 화면 오늘 줄
  const tl = $('today-line'); if (!tl) return;
  const todays = [...ev.filter(n => n.date === todayKey()).map(n => (n.time ? fmtTime(n.time) + ' ' : '') + n.text), ...an.filter(x => daysUntil(x.d) === 0).map(x => x.n.text), ...an.filter(x => daysUntil(x.d) === 1).map(x => '내일 ' + x.n.text)];
  tl.hidden = !todays.length; tl.textContent = todays.length ? '오늘 · ' + todays.join(' · ') : '';
}

function askRemove(id) {
  const n = notes.find(x => x.id === id); if (!n) return;
  modal(`<h2>지울까요?</h2><p class="nb-ask">${esc(n.text)}</p><p class="note">지우면 되돌릴 수 없습니다.</p>
    <div class="modal-actions"><button type="button" class="btn line danger" id="nb-rm-yes">지우기</button><button type="button" class="btn green" id="nb-rm-no">그만두기</button></div>`, () => {
    $('nb-rm-no').onclick = () => closeModal();
    $('nb-rm-yes').onclick = async () => { try { await DB.deleteNote(id); closeModal(); toast('지웠습니다.'); await refresh(); } catch (e) { toast(e.message); } };
  });
}

async function refresh() { try { notes = await DB.listNotes(); } catch (e) { notes = []; } render(); }

function bind() {
  document.addEventListener('click', e => {
    const mic = e.target.closest('.nb-mic'); if (mic) { const kind = mic.dataset.kind; listen(t => { const p = parseSpeech(t, kind); editor(kind, p); }); return; }
    const hand = e.target.closest('.nb-hand'); if (hand) { editor(hand.dataset.kind); return; }
    const rm = e.target.closest('[data-rm]'); if (rm) { askRemove(rm.dataset.rm); return; }
    const it = e.target.closest('.nb-item'); if (it) { const n = notes.find(x => x.id === it.dataset.id); if (n) editor(n.kind, n, n.id); return; }
    if (e.target.id === 'nb-login') openGate('나의 수첩을 쓰려면');
  });
  DB.onUser(u => { $('nb-gate').hidden = !!u; $('nb-body').hidden = !u; if (u) refresh(); else { notes = []; const tl = $('today-line'); if (tl) tl.hidden = true; } });
}
