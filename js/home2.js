// 첫 화면 판갈이 시안 (대표 2026-10-27 새벽 방향 회의 — docs/회의/2026-10-27_방향회의.md)
// "요일마다 다음 편이 기다려지는 연재" · 축은 그때와 지금 · 연재가 맨 앞, CONTENTS 는 '더 둘러보기'로 아래
// 지금은 시안: 주소에 ?v2=1 (또는 localStorage omaju.v2=1) 일 때만 켜진다. 대표가 "올려" 하면 기본으로 바꾼다.
import * as EV from './ev.js';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dow = () => new Date(Date.now() + 9 * 3600e3).getUTCDay();   // 0 일 ~ 6 토

// 연재 다섯 — 요일 편성(안). 전기차는 11/23 까지 매일(대표 약속), 그 뒤 목요일.
export const SER = [
  { k: 'ai', name: 'AI 시대에 살 준비가 되었는가', short: 'AI', day: 1, live: true, line: '오늘 저녁 휴대폰으로 해 볼 수 있는 AI' },
  { k: 'then', name: '그때 그 물건, 지금은', short: '그때', day: 2, line: '삐삐에서 스마트폰까지, 그 물건은 지금 무엇이 됐을까', soon: '11월 공개 예정' },
  { k: 'work', name: '다시, 일', short: '일', day: 3, line: '자격증 · 작은 가게 · 새 일 — 쉰 넘어 다시 시작한 사람들', soon: '11월 공개 예정' },
  { k: 'ev', name: '전기차 시대', short: '전기차', day: 4, live: true, daily: '매일 연재', line: '사기 전에 알아 둘 숫자와 브랜드 이야기' },
  { k: 'trip', name: '요즘 여행법', short: '여행', day: 5, line: '앱으로 기차·숙소 잡기부터 혼자 떠나는 해외까지', soon: '11월 공개 예정' },
];
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function cover(a) {   // 편의 대표 사진: 첫 사진 → 사진 띠 첫 장 → 연재 머리 사진
  for (const b of (a && a.blocks) || []) {
    if (b.photo && b.photo.src) return b.photo.src;
    if (b.gallery && b.gallery.items && b.gallery.items[0]) return b.gallery.items[0].src;
  }
  return null;
}
const fallback = k => `img/detail_${k}.jpg`;
function todayCard(s, a, isNew) {
  const img = cover(a) || fallback(s.k);
  return `<button type="button" class="h2-today" data-open="${s.k}" data-corner="${s.k}">
    <span class="h2-ph" style="background-image:url('${esc(img)}')">${isNew ? '<i class="h2-badge">NEW</i>' : ''}</span>
    <span class="h2-tx"><small>${esc(s.short)} · ${a.no}화</small><b>${esc(a.title)}</b><em>${esc(a.dek || '')}</em>
    ${a.next ? `<span class="h2-next"><i>다음 화</i> ${esc(a.next)}</span>` : ''}</span></button>`;
}

function shelfRow(s, list) {
  const tiles = list.length
    ? list.map(a => `<button type="button" class="h2-ep" data-open="${s.k}" data-corner="${s.k}" data-ep="${esc(a.id)}"><span class="h2-ep-ph" style="background-image:url('${esc(cover(a) || fallback(s.k))}')"><i>${a.no}화</i></span><span class="h2-ep-t">${esc(a.title)}</span></button>`).join('')
    : `<div class="h2-soon"><b>${esc(s.soon || '공개 예정')}</b><span>${esc(s.line)}</span></div>`;
  return `<div class="h2-row${list.length ? '' : ' is-soon'}">
    <div class="h2-rh"><b>${esc(s.name)}</b><span class="h2-day">${s.daily ? '매일 연재' : `${DOW[s.day]}요일 연재`}</span></div>
    ${list.length ? `<p class="h2-rl">${esc(s.line)} · <span class="nw">지금 ${list.length}화</span></p>` : ''}
    <div class="h2-eps">${tiles}</div></div>`;
}

export async function mount(h) {
  const intro = document.querySelector('.intro'); if (!intro) return;
  // 배너 첫 줄: '잡지' 빼고 (대표 2026-10-27)
  const lede = intro.querySelector('.intro-lede'); if (lede) lede.innerHTML = '<span class="nw">매일 아침,</span> <span class="nw">새로운 이야기를 만납니다.</span>';
  // 시안 4 (대표 2026-10-27 07:43 — "기존 시대 공유 박스가 깔끔하고 고급스러웠다, 그 모양으로"):
  // 예전 '시대 공유' 사진 칸을 그대로 첫 화면 맨 앞으로 — 연재 다섯 + 그해 오늘 = 2×3 사진 칸, 그 밑 사랑방. CONTENTS 는 그 아래 원래 모양 그대로.
  const wrap = document.querySelector('.cols-wrap'); if (!wrap) return;
  const sec = document.createElement('section'); sec.className = 'cols-wrap h4'; sec.setAttribute('aria-label', '시대 공유');
  const head = wrap.querySelector('.cols-head'), orn = wrap.querySelector('.cols-orn:not(.tk-orn)'), row = wrap.querySelector('.cols-row'), tkOrn = wrap.querySelector('.cols-orn.tk-orn'), talk = document.getElementById('talk-box');
  if (orn) sec.appendChild(orn); if (head) sec.appendChild(head);   // '시대 공유 · 오마주 매거진' 그대로
  if (row) {
    // 대표 2026-10-27 07:51: AI 를 맨 위 한 줄(가로 칸), 그 밑에 전기차 · 그때 그 물건 · 다시, 일 · 요즘 여행법 네 칸(2×2). 칸 모양은 예전 그대로(사진 + 가운데 제목).
    row.classList.remove('one'); row.classList.add('h4-row');
    const ai = row.querySelector('[data-open="ai"]'), ev = row.querySelector('[data-open="ev"]');
    if (ai) { ai.hidden = false; ai.classList.add('h4-wide'); row.prepend(ai); }
    if (ev) ev.hidden = false;
    const IMG = { then: 'img/then-tile.jpg', work: 'img/work-tile.jpg', trip: 'img/trip-tile.jpg' };
    row.insertAdjacentHTML('beforeend', SER.filter(s => !s.live).map(s => `<button type="button" class="col-tile h4-soon" data-soon="${s.k}" style="background-image:url('${IMG[s.k]}')"><span class="ct-in"><b>${esc(s.name)}</b><em class="h4-when">11월 시작</em></span></button>`).join(''));
    sec.appendChild(row);
  }
  if (tkOrn) sec.appendChild(tkOrn);
  if (talk) sec.appendChild(talk);
  intro.after(sec);
  sec.addEventListener('click', e => { const s = e.target.closest('[data-soon]'); if (s) { e.stopPropagation(); const t = document.getElementById('toast'); if (t) { t.textContent = '11월에 첫 화가 올라옵니다.'; t.hidden = false; setTimeout(() => { t.hidden = true; }, 2200); } } }, true);
  // CONTENTS 도 시대 공유와 같은 꼴로 (대표 2026-10-27 08:01 — 나뭇잎 로고 머리 빼고 같은 금빛 줄 + 큰 제목, 칸도 같은 사진 칸)
  const toc = document.querySelector('.toc.toc-c:not(.opn-toc)');
  if (toc) { toc.hidden = true; toc.insertAdjacentHTML('afterend', '<div class="h4-chd"><div class="cols-orn" aria-hidden="true"><i></i><b>✦</b><i></i></div><p class="cols-head">콘텐츠 <small>매일 새로 펼쳐지는 코너</small></p></div>'); }
  // 큰 글씨에서 끝 낱말 하나만 다음 줄로 떨어지지 않게 (CLAUDE.md '한 글자만 다음 줄로 떨어짐 없게')
  const glue = el => { if (!el || el.dataset.glued) return; const t = el.textContent.trim(); const w = t.split(' '); if (w.length > 1 && w[w.length - 1].length <= 2) { el.innerHTML = esc(w.slice(0, -2).join(' ')) + (w.length > 2 ? ' ' : '') + '<span class="nw">' + esc(w.slice(-2).join(' ')) + '</span>'; } el.dataset.glued = 1; };
  const dots = el => { if (!el || el.dataset.glued) return; el.innerHTML = el.textContent.split(' · ').map(x => '<span class="nw">' + esc(x.trim()) + '</span>').join(' · '); el.dataset.glued = 1; };
  setTimeout(() => { document.querySelectorAll('#tabs3 button b, .h4 .col-tile b').forEach(glue); document.querySelectorAll('#tabs3 button small').forEach(dots); }, 0);
  // 나의 수첩 → 내 서재
  // 내 서재 — 모두에게 (대표 2026-10-27 08:25 "나의 서재도 리셋해도 돼, 사용자 없으니까"). 예전 수첩 칸은 css 로 감춘다.
  if (document.documentElement.classList.contains('lib2')) {
    H = h || {};
    mountLibrary();
    EV.load('ev').then(() => EV.load('ai')).then(mountLibrary).catch(() => {});
    if (H.onUser) H.onUser(() => { Promise.resolve(H.refreshSaves && H.refreshSaves()).catch(() => {}).then(mountLibrary); });
    addEventListener('hashchange', () => { if (location.hash === '#g4') mountLibrary(); });
    addEventListener('omaju:saves', mountLibrary);
  }
}
let H = {};

// ── 내 서재 (나의 수첩 자리) — 세 가지만: 이어 읽기 · 따라가는 연재 · 담아 둔 글 ──
const LS = { get(k, d) { try { const v = localStorage.getItem('omaju.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('omaju.' + k, JSON.stringify(v)); } catch (e) {} } };
export function mountLibrary() {
  const g4 = document.querySelector('.tabsec[data-g="g4"]'); if (!g4) return;
  let lib = document.getElementById('lib'); if (!lib) { lib = document.createElement('div'); lib.id = 'lib'; lib.className = 'lib'; g4.prepend(lib); }
  const p = H.profile ? H.profile() : null;
  const read = LS.get('read', {});
  const follow = LS.get('follow', []);
  const saved = (H.saves ? H.saves() : []) || [];
  const card = p && window.__memberCard ? window.__memberCard(p) : '';
  const rk = Object.keys(read).filter(k => SER.some(x => x.k === k));
  const cont = k => {   // 다음 편이 올라와 있으면 그 편, 아니면 마지막 읽은 편
    const s = SER.find(x => x.k === k), r = read[k], items = EV.all(k), nx = items.find(x => x.no === r.no + 1);
    const go = nx ? nx.id : r.id;
    return `<button type="button" class="lib-cont" data-open="${k}" data-corner="${k}" data-ep="${esc(go)}"><small>${esc(s ? s.name : k)}</small><b>${nx ? `${nx.no}화부터 이어 보기` : `${r.no}화까지 읽으셨어요`}</b><em>${nx ? `지난번 ${r.no}화 · ${esc(r.title)}` : '새 편이 오르면 여기서 이어 봅니다'}</em><i>›</i></button>`;
  };
  lib.innerHTML = `
    ${card ? `<div class="lib-card">${card}</div>` : `<div class="lib-join"><b>무료 구독하면, 좋았던 글을 담아 둘 수 있어요.</b><span>어디까지 읽었는지는 이 휴대폰이 기억해 둡니다.</span><button type="button" class="btn green" id="lib-login">로그인 · 무료 구독하기</button></div>`}
    <div class="lib-h">이어 읽기</div>
    ${rk.length ? rk.map(cont).join('') : '<p class="lib-empty">연재를 읽으면 여기에서 이어 볼 수 있어요.</p>'}
    <div class="lib-h">따라가는 연재 <small>누르면 켜고 끕니다</small></div>
    <div class="lib-fol">${SER.map(s => `<button type="button" class="lib-f${follow.includes(s.k) ? ' on' : ''}" data-fk="${s.k}"><b>${esc(s.name)}</b><small>${s.daily ? '매일 연재' : `${DOW[s.day]}요일 연재`}${s.soon ? ' · ' + esc(s.soon) : ''}</small><i>${follow.includes(s.k) ? '따라가는 중' : '따라가기'}</i></button>`).join('')}</div>
    <div class="lib-h">담아 둔 글${saved.length ? ` <small>${saved.length}개</small>` : ''}</div>
    ${saved.length ? `<ul class="lib-saved">${saved.slice(0, 5).map(it => `<li><button type="button" data-libsave="1"><small>${esc(H.label ? H.label(it) : '')}</small><b>${esc(it.title || '')}</b></button></li>`).join('')}</ul>${saved.length > 5 ? '<button type="button" class="lib-more" data-libsave="1">모두 보기 ›</button>' : ''}` : `<p class="lib-empty">${p ? "글 끝의 '담아 두기'를 누르면 여기에 모입니다." : "구독하시면 글 끝의 '담아 두기'로 좋았던 글을 모아 둘 수 있어요."}</p>`}`;
  lib.onclick = e => {
    if (e.target.closest('#lib-login')) { H.login && H.login(); return; }
    if (e.target.closest('[data-libsave]')) { H.openSaves && H.openSaves(); return; }
    const c = e.target.closest('[data-ep]'); if (c) { try { sessionStorage.setItem('omaju.ep.' + c.dataset.open, c.dataset.ep); } catch (x) {} return; }   // 넘어가는 것은 app.js 의 [data-open]
    const f = e.target.closest('[data-fk]'); if (!f) return;
    const cur = LS.get('follow', []); const k = f.dataset.fk; const nx = cur.includes(k) ? cur.filter(x => x !== k) : cur.concat(k); LS.set('follow', nx); mountLibrary();
  };
}
