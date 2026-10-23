// 어쩌다 점점 집사 — 반려견 · 반려묘 이야기 (대표 2026-10-23)
// 칸마다 날마다 한 편. 맨 위에 오늘 글, 아래에 지난 글 제목 목차. 제목을 누르면 그 글.
// 글 모양: 왜 그럴까 → 이렇게 해 보세요(두세 가지) → 이럴 땐 병원에(한 줄). 진단·약 이야기는 하지 않는다.
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NAME = { dog: '댕댕이', cat: '냥이' };   // 대표 2026-10-24: 반려견·반려묘는 안내판 같다 — 애칭으로. 본문은 검색에 걸리게 강아지·고양이
let DATA = null;
export async function load() {
  if (DATA) return DATA;
  try { DATA = await (await fetch('data/pets.json', { cache: 'no-cache' })).json(); } catch (e) { DATA = { dog: [], cat: [] }; }
  return DATA;
}
export function latest(k) { return ((DATA && DATA[k]) || [])[0] || null; }
export function render(el, k, id) {
  const list = (DATA && DATA[k]) || [];
  if (!list.length) { el.innerHTML = '<p class="note" style="margin-top:30px">오늘의 이야기를 준비하고 있어요.</p>'; return; }
  const a = list.find(x => x.id === id) || list[0], today = a === list[0];
  el.innerHTML = `<article class="pet">
      <p class="cu-kind">어쩌다 점점 집사 · ${NAME[k]}${a.kind ? ' · ' + esc(a.kind) : ''}</p>
      <h2 class="pet-t">${esc(a.title)}</h2>
      ${today ? '' : `<p class="pet-d">${esc(a.date)}</p>`}
      ${a.hook ? `<p class="pet-hook">${esc(a.hook)}</p>` : ''}
      <p class="is-sub">왜 그럴까요</p>
      <p class="pet-why">${esc(a.why)}</p>
      <p class="is-sub">이렇게 해 보세요</p>
      <ol class="pet-todo">${a.todo.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
      <p class="pet-vet"><b>이럴 땐 병원에</b> ${esc(a.vet)}</p>
    </article>
    <div class="pet-past"><p class="pet-ph">지난 이야기</p>${list.map(x => `<button type="button" data-pet="${esc(x.id)}" aria-current="${x === a}"><span>${esc(x.title)}</span><small>${esc(x.date.slice(5).replace('-', '.'))}</small></button>`).join('')}</div>`;
  el.querySelectorAll('[data-pet]').forEach(b => b.onclick = () => { render(el, k, b.dataset.pet); el.scrollIntoView({ block: 'start' }); });
}
