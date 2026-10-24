// 어쩌다 점점 집사 — 댕댕이 · 냥이 이야기 (대표 2026-10-23, 2026-10-24 판갈이 틀로)
// 칸마다 날마다 한 편(tools/gen_daily.py gen_pet 이 새벽에 data/pets.json 맨 앞에 넣는다). 맨 위에 오늘 글, 아래에 지난 글 제목 목차.
// 글 모양: 첫 장면(hook) → 왜 그럴까요 → 이렇게 해 보세요(두세 가지) → 이럴 땐 병원에(한 줄). 진단·약 이야기는 하지 않는다.
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NAME = { dog: '댕댕이', cat: '냥이' };   // 대표 2026-10-24: 반려견·반려묘는 안내판 같다 — 애칭으로. 본문은 검색에 걸리게 강아지·고양이
let DATA = null, loading = null;
const shown = {};
export function load() {
  if (DATA) return Promise.resolve(DATA);
  return loading || (loading = fetch('data/pets.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({ dog: [], cat: [] })).then(d => (DATA = d)));
}
// 내일치를 미리 만들어 둘 수 있으니, 오늘(한국 시각)까지의 글만 보여 준다
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const list = k => ((DATA && DATA[k]) || []).filter(x => !x.date || x.date <= today());
export function latest(k) { return list(k)[0] || null; }
export function current(k) { return shown[k] || latest(k); }
export function render(el, k, id) {
  if (!el) return;
  const items = list(k);
  if (!items.length) { el.innerHTML = '<p class="note" style="margin-top:30px">오늘의 이야기를 준비하고 있어요.</p>'; return; }
  const a = items.find(x => x.id === id) || items[0], isToday = a === items[0];
  shown[k] = a;
  const t = document.getElementById('d-title'); if (t && document.body.classList.contains('in-detail')) t.textContent = a.title;
  el.innerHTML = `<article class="pet">
      <p class="pet-meta">${esc(a.kind || NAME[k])}${isToday ? '' : ' · ' + esc(a.date.slice(5).replace('-', '월 ').replace(/^0/, '') + '일')}</p>
      ${a.hook ? `<p class="pet-hook">${esc(a.hook)}</p>` : ''}
      <p class="is-sub">왜 그럴까요</p>
      <p class="pet-why">${esc(a.why)}</p>
      <p class="is-sub">이렇게 해 보세요</p>
      <ol class="pet-todo">${a.todo.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      <p class="pet-vet"><b>이럴 땐 동물병원에</b>${esc(a.vet)}</p>
      <p class="note pet-foot">집에서 해 볼 수 있는 생활 요령이에요. 아이마다 다르니 걱정되면 수의사와 먼저 상의해 주세요.</p>
    </article>
    ${window.omajuSvBar ? window.omajuSvBar(k, 'pet_' + a.id, a.title) : ''}
    <div class="pet-past"><p class="is-sub">지난 이야기</p>${items.slice(0, 30).map(x => `<button type="button" data-pet="${esc(x.id)}" aria-current="${x === a}"><span>${esc(x.title)}</span><small>${esc(x.date.slice(5).replace('-', '.'))}</small></button>`).join('')}</div>`;
  window.omajuSvSync && window.omajuSvSync();
  el.querySelectorAll('[data-pet]').forEach(b => b.onclick = () => { render(el, k, b.dataset.pet); window.scrollTo({ top: 0 }); });
}
