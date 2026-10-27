// 혼자라서 좋은 날 — 혼자일 때 더 좋은 하루 (대표 2026-10-24)
// 여섯 칸: 하루 코스 · 혼밥 맛집 · 취미 자리 · 혼자 보기 · 혼자 사는 살림 · 혼자 떠나는 여행.
// 글은 새벽에 tools/gen_daily.py gen_solo 가 data/solo.json 에 쌓는다(장소는 검색으로 두 번 확인한 곳만).
// 글 모양: 장면(hook) → 추천(장소마다 '혼자라서 좋은 점' + 지도) → 혼자 갈 때 요령 → 지난 이야기.
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const CORNERS = { day: '혼자 떠나는 하루 코스', eat: '혼밥 맛집', hobby: '혼자 즐기는 취미 자리', see: '혼자 보기 좋은 것', home: '혼자 사는 살림', trip: '혼자 떠나는 여행' };
const HEAD = { day: '오늘의 코스', eat: '혼자 가기 편한 집', hobby: '혼자 가기 좋은 곳', see: '혼자 보기 좋은 곳', home: '오늘의 요령', trip: '들를 곳' };
let DATA = null, loading = null;
const shown = {}, REG = {};   // 지난 이야기 지역 고르기 (대표 2026-10-27 — 지역별로 지난 글을 찾게)
const regs = items => [...new Set(items.map(x => x.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
export function load() {
  if (DATA) return Promise.resolve(DATA);
  return loading || (loading = fetch('data/solo.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({})).then(d => (DATA = d || {})));
}
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const list = k => ((DATA && DATA[k]) || []).filter(x => !x.date || x.date <= today());
export function latest(k) { return list(k)[0] || null; }
export function current(k) { return shown[k] || latest(k); }
const map = x => 'https://map.naver.com/p/search/' + encodeURIComponent(((x.where || '') + ' ' + x.name).trim());
export function render(el, k, id) {
  if (!el) return;
  const items = list(k);
  if (!items.length) { el.innerHTML = '<p class="note" style="margin-top:30px">첫 이야기를 준비하고 있어요.</p>'; return; }
  const a = items.find(x => x.id === id) || items[0], isToday = a === items[0];
  shown[k] = a;
  const t = document.getElementById('d-title'); if (t && document.body.classList.contains('in-detail')) t.textContent = a.title;
  const meta = [a.region, a.topic && k !== 'eat' && k !== 'day' && k !== 'trip' ? a.topic : '', isToday ? '' : a.date.slice(5).replace('-', '월 ').replace(/^0/, '') + '일'].filter(Boolean).join(' · ');
  el.innerHTML = `<article class="solo">
      ${meta ? `<p class="pet-meta">${esc(meta)}</p>` : ''}
      ${a.hook ? `<p class="pet-hook">${esc(a.hook)}</p>` : ''}
      <p class="is-sub">${HEAD[k]}</p>
      <ol class="so-list${k === 'day' || k === 'trip' ? ' so-route' : ''}">${a.items.map(x => `<li>
        ${x.time ? `<span class="so-time">${esc(x.time)}</span>` : ''}
        <b class="so-name">${esc(x.name)}</b>${x.where ? `<span class="so-where">${esc(x.where)}</span>` : ''}
        <p class="so-note">${esc(x.note)}</p>
        ${x.solo ? `<p class="so-solo"><i>혼자라서 좋은 점</i>${esc(x.solo)}</p>` : ''}
        ${x.where ? `<a class="so-map" href="${map(x)}" target="_blank" rel="noopener">지도에서 보기</a>` : ''}
      </li>`).join('')}</ol>
      ${a.tips && a.tips.length ? `<div class="pet-vet"><b>혼자 갈 때 알아 두면 좋아요</b>${a.tips.map(x => `<span class="so-tip">${esc(x)}</span>`).join('')}</div>` : ''}
      ${k !== 'home' ? '<p class="note pet-foot">가시기 전에 영업 시간과 휴무일을 한 번 더 확인해 주세요.</p>' : ''}
    </article>
    ${window.omajuSvBar ? window.omajuSvBar('solo-' + k, 'solo_' + a.id, a.title) : ''}
    <div class="pet-past so-past"><p class="is-sub">지난 이야기 <small>${items.length}편</small></p>${regs(items).length > 1 ? `<div class="so-regs"><button type="button" data-reg="" aria-pressed="${!REG[k]}">모두</button>${regs(items).map(r => `<button type="button" data-reg="${esc(r)}" aria-pressed="${REG[k] === r}">${esc(r)}</button>`).join('')}</div>` : ''}${items.filter(x => !REG[k] || x.region === REG[k]).map(x => `<button type="button" data-solo="${esc(x.id)}" aria-current="${x === a}"><span>${esc(x.title)}</span><small>${x.region ? esc(x.region) + ' · ' : ''}${esc(x.date.slice(5).replace('-', '.'))}</small></button>`).join('')}</div>`;
  window.omajuSvSync && window.omajuSvSync();
  el.querySelectorAll('[data-solo]').forEach(b => b.onclick = () => { render(el, k, b.dataset.solo); window.scrollTo({ top: 0 }); });
  el.querySelectorAll('[data-reg]').forEach(b => b.onclick = () => { REG[k] = b.dataset.reg; const y = window.scrollY; render(el, k, a.id); window.scrollTo(0, y); });
}
