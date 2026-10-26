// 첫 화면 판갈이 시안 (대표 2026-10-27 새벽 방향 회의 — docs/회의/2026-10-27_방향회의.md)
// "요일마다 다음 편이 기다려지는 연재" · 축은 그때와 지금 · 연재가 맨 앞, CONTENTS 는 '더 둘러보기'로 아래
// 지금은 시안: 주소에 ?v2=1 (또는 localStorage omaju.v2=1) 일 때만 켜진다. 대표가 "올려" 하면 기본으로 바꾼다.
import * as EV from './ev.js';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dow = () => new Date(Date.now() + 9 * 3600e3).getUTCDay();   // 0 일 ~ 6 토

// 연재 다섯 — 요일 편성(안). 전기차는 11/23 까지 매일(대표 약속), 그 뒤 목요일.
export const SER = [
  { k: 'ai', name: 'AI 시대에 살 준비가 되었는가', short: 'AI 시대', day: 1, live: true, line: '오늘 저녁 휴대폰으로 해 볼 수 있는 AI' },
  { k: 'then', name: '그때 그 물건, 지금은', short: '그때 그 물건', day: 2, line: '삐삐에서 스마트폰까지, 그 물건은 지금 무엇이 됐을까', soon: '11월 첫 편' },
  { k: 'work', name: '다시, 일', short: '다시, 일', day: 3, line: '자격증 · 작은 가게 · 새 일 — 쉰 넘어 다시 시작한 사람들', soon: '11월 첫 편' },
  { k: 'ev', name: '전기차 시대', short: '전기차 시대', day: 4, live: true, daily: '11월 23일까지 매일', line: '사기 전에 알아 둘 숫자와 브랜드 이야기' },
  { k: 'trip', name: '요즘 여행법', short: '요즘 여행법', day: 5, line: '앱으로 기차·숙소 잡기부터 혼자 떠나는 해외까지', soon: '11월 첫 편' },
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
    <span class="h2-ph" style="background-image:url('${esc(img)}')"><i class="h2-badge">${isNew ? '오늘 새 편' : '최신 편'}</i></span>
    <span class="h2-tx"><small>${esc(s.name)} · ${a.no}편</small><b>${esc(a.title)}</b><em>${esc(a.dek || '')}</em>
    ${a.next ? `<span class="h2-next"><i>다음 편</i> ${esc(a.next)}</span>` : ''}</span></button>`;
}

function shelfRow(s, list) {
  const tiles = list.length
    ? list.map(a => `<button type="button" class="h2-ep" data-open="${s.k}" data-corner="${s.k}" data-ep="${esc(a.id)}"><span class="h2-ep-ph" style="background-image:url('${esc(cover(a) || fallback(s.k))}')"><i>${a.no}</i></span><span class="h2-ep-t">${esc(a.title)}</span></button>`).join('')
    : `<div class="h2-soon"><b>${esc(s.soon || '곧 시작')}</b><span>${esc(s.line)}</span></div>`;
  return `<div class="h2-row${list.length ? '' : ' is-soon'}">
    <div class="h2-rh"><b>${esc(s.name)}</b><span class="h2-day">${s.daily ? esc(s.daily) : `매주 ${DOW[s.day]}요일`}</span></div>
    ${list.length ? `<p class="h2-rl">${esc(s.line)} · <span class="nw">지금 ${list.length}편</span></p>` : ''}
    <div class="h2-eps">${tiles}</div></div>`;
}

export async function mount() {
  const intro = document.querySelector('.intro'); if (!intro) return;
  // 배너 첫 줄: '잡지' 빼고 (대표 2026-10-27)
  const lede = intro.querySelector('.intro-lede'); if (lede) lede.innerHTML = '<span class="nw">매일 아침,</span> <span class="nw">새로운 이야기를 만납니다.</span>';
  const mast = intro.querySelector('.intro-mast'); if (mast) mast.textContent = 'Omaju Magazine · Since 2026';

  await Promise.all(['ev', 'ai'].map(k => EV.load(k)));
  const T = today();
  const open = k => (EV.all ? EV.all(k) : []);
  const lists = {}; for (const s of SER) lists[s.k] = s.live ? open(s.k) : [];
  const todays = SER.filter(s => s.live).map(s => { const l = lists[s.k]; const a = l[l.length - 1]; return a ? { s, a, isNew: a.date === T } : null; }).filter(Boolean)
    .sort((x, y) => (y.isNew - x.isNew) || (y.a.date > x.a.date ? 1 : -1));

  const sec = document.createElement('section'); sec.className = 'h2'; sec.id = 'h2';
  const d = dow();
  sec.innerHTML = `
    <div class="h2-hd"><p class="h2-k">오늘의 연재</p><h2>오늘 새로 올라온 이야기</h2><p class="h2-sub">요일마다 다음 편이 이어집니다. 1편부터 천천히 따라오셔도 좋아요.</p></div>
    <div class="h2-todays">${todays.map(x => todayCard(x.s, x.a, x.isNew)).join('')}</div>
    <div class="h2-week" aria-label="요일 편성">${[1, 2, 3, 4, 5].map(n => { const s = SER.find(x => x.day === n); return `<span class="${n === d ? 'on' : ''}"><i>${DOW[n]}</i><b>${esc(s.short)}</b></span>`; }).join('')}</div>
    <div class="h2-hd sm"><p class="h2-k">연재 서가</p><h2>다섯 개의 연재</h2></div>
    <div class="h2-shelf">${SER.map(s => shelfRow(s, lists[s.k])).join('')}</div>
    <div class="h2-hd sm then"><p class="h2-k">그때</p><h2>그해 오늘, 우리는</h2></div>
    <button type="button" class="h2-then" data-open="history" data-corner="history" style="background-image:url('img/detail_history.jpg')"><span><small>50·40·30·20·10년 전 오늘</small><b>그해 오늘, 무슨 일이 있었을까</b><em>그날의 신문 · 그 시절 노래 · 나는 그때</em></span></button>
    <div class="h2-hd sm"><p class="h2-k">사랑방</p><h2>오늘의 이야기, 한 줄 보태기</h2></div>
    <div class="h2-talk" id="h2-talk"></div>`;
  intro.after(sec);
  // 에피소드 표지를 누르면 그 편을 연다 (연재 서가)
  sec.addEventListener('click', e => { const b = e.target.closest('[data-ep]'); if (b) { try { sessionStorage.setItem('omaju.ep.' + b.dataset.open, b.dataset.ep); } catch (x) {} } }, true);

  // 사랑방 상자를 위로 옮긴다 (그대로 움직이므로 talk.js 는 손대지 않는다)
  const talk = document.getElementById('talk-box'); if (talk) document.getElementById('h2-talk').appendChild(talk);
  // CONTENTS → 더 둘러보기, 나의 수첩 → 내 서재
  const toc = document.querySelector('.toc.toc-c:not(.opn-toc) em'); if (toc) toc.textContent = 'More';
  const tocBox = toc && toc.closest('.toc'); if (tocBox) { const h = document.createElement('div'); h.className = 'h2-hd sm more'; h.innerHTML = '<p class="h2-k">더 둘러보기</p><h2>운세 · 한 끼 · 인사 카드 · 그 밖의 코너</h2>'; tocBox.before(h); tocBox.hidden = true; }
  const nb = document.querySelector('#tabs3 [data-tab="g4"]'); if (nb) nb.innerHTML = '<b>내 서재</b><small>이어 읽기 · 담아 둔 글</small>';
  // 아래 '시대 공유' 두 칸은 위로 올라갔으니 감춘다
  const cols = document.querySelector('.cols-wrap .cols-row'); if (cols) { cols.hidden = true; const hd = document.querySelector('.cols-head'); if (hd) hd.hidden = true; const o = document.querySelector('.cols-wrap > .cols-orn:not(.tk-orn)'); if (o) o.hidden = true; }
  mountLibrary();
}

// ── 내 서재 (나의 수첩 자리) — 세 가지만: 이어 읽기 · 따라가는 연재 · 담아 둔 글 ──
const LS = { get(k, d) { try { const v = localStorage.getItem('omaju.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('omaju.' + k, JSON.stringify(v)); } catch (e) {} } };
export function mountLibrary() {
  const g4 = document.querySelector('.tabsec[data-g="g4"]'); if (!g4) return;
  let lib = document.getElementById('lib'); if (!lib) { lib = document.createElement('div'); lib.id = 'lib'; lib.className = 'lib'; g4.prepend(lib); }
  const p = (window.__libProfile) || null;
  const read = LS.get('read', null) || (window.__libDemo ? { ev: { no: 3, title: "테슬라가 문을 열었다: '중국산' 꼬리표가 옅어진 까닭", id: 'ev-03' }, ai: { no: 3, title: '처음 써 보기: 휴대폰에서 5분', id: 'ai-03' } } : {});
  const follow = LS.get('follow', window.__libDemo ? ['ev', 'ai', 'work'] : []);
  const saved = window.__libDemo ? [['전기차 시대 · 1편', '전기차 시대가 왔다'], ['오늘의 한 끼', '꽈리고추 멸치 비빔밥'], ['AI 시대 · 4편', '잘 묻는 법: 대답이 달라지는 세 가지 요령']] : [];
  const card = p && window.__memberCard ? window.__memberCard(p) : '';
  const rk = Object.keys(read);
  lib.innerHTML = `
    ${card ? `<div class="lib-card">${card}</div>` : `<div class="lib-join"><b>무료 구독하면, 읽던 연재를 이어서 볼 수 있어요.</b><span>어디까지 읽었는지 기억해 두고, 좋았던 글은 담아 둡니다.</span><button type="button" class="btn green" id="lib-login">로그인 · 무료 구독하기</button></div>`}
    <div class="lib-h">이어 읽기</div>
    ${rk.length ? rk.map(k => { const s = SER.find(x => x.k === k); const r = read[k]; return `<button type="button" class="lib-cont" data-open="${k}" data-corner="${k}"><small>${esc(s ? s.name : k)}</small><b>${r.no + 1}편부터 이어 읽기</b><em>지난번: ${r.no}편 「${esc(r.title)}」</em><i>›</i></button>`; }).join('') : '<p class="lib-empty">연재를 읽으면 여기에서 이어 볼 수 있어요.</p>'}
    <div class="lib-h">따라가는 연재 <small>누르면 켜고 끕니다</small></div>
    <div class="lib-fol">${SER.map(s => `<button type="button" class="lib-f${follow.includes(s.k) ? ' on' : ''}" data-fk="${s.k}"><b>${esc(s.name)}</b><small>${s.daily ? esc(s.daily) : `매주 ${DOW[s.day]}요일`}${s.soon ? ' · ' + esc(s.soon) : ''}</small><i>${follow.includes(s.k) ? '따라가는 중' : '따라가기'}</i></button>`).join('')}</div>
    <div class="lib-h">담아 둔 글</div>
    ${saved.length ? `<ul class="lib-saved">${saved.map(([k, t]) => `<li><small>${esc(k)}</small><b>${esc(t)}</b></li>`).join('')}</ul>` : '<p class="lib-empty">글 끝의 \'담아 두기\'를 누르면 여기에 모입니다.</p>'}
    <p class="lib-note">예전에 수첩에 적어 두신 메모·일정은 지우지 않고 그대로 보관합니다.</p>`;
  lib.onclick = e => {
    const f = e.target.closest('[data-fk]'); if (!f) return;
    const cur = LS.get('follow', []); const k = f.dataset.fk; const nx = cur.includes(k) ? cur.filter(x => x !== k) : cur.concat(k); LS.set('follow', nx); mountLibrary();
  };
}
