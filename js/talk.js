// 오마주 사랑방 (대표 2026-10-25) — 기획 연재 밑 창. 매일 주제 하나, 구독자가 한 줄씩.
// 창: 글이 아래에서 천천히 떠올라 머물다 위로 밀려 올라간다(세 줄 보임). 몇 바퀴마다 오늘의 주제 카드가 한 번 지나간다.
// 새 글은 30초마다 확인(화면이 보일 때만). 채움 글(seed)은 show_at 이 지난 것만 보인다 — 하루 동안 시간차로 하나씩 떠오른다.
// 누르면 #talk 에서 오늘 글 전부 + 한 줄 쓰기. 쓰기는 회원만, 지우기는 본인 것, 그 밖엔 신고(3번이면 내려감).
let DB, toast, openGate, esc, TODAY, nav, listen, closeModal;
let TOPIC = null, ALL = [], timer = null, poll = null, idx = 0;
const STEP = 3600;   // 한 칸 머무는 시간(ms)

// 글꼴은 사랑방이 뜰 때만 (대표 2026-10-25 시안: 제목 Noto Serif KR · 본문 Pretendard) — 첫 화면 속도에 영향 없게
function fonts() {
  if (document.getElementById('tk-fonts')) return;
  const a = document.createElement('link'); a.id = 'tk-fonts'; a.rel = 'stylesheet'; a.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700&display=swap';
  const b = document.createElement('link'); b.rel = 'stylesheet'; b.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-subset.css';
  document.head.append(a, b);
}
export function init(o) { ({ DB, toast, openGate, esc, TODAY, nav, listen, closeModal } = o); fonts(); load().then(() => { mount(); start(); }); }

async function topic() {
  try {
    const t = await (await fetch('data/talk_topics.json')).json();
    const i = Math.round((Date.parse(TODAY) - Date.parse(t.start)) / 864e5);
    return t.topics[((i % t.topics.length) + t.topics.length) % t.topics.length];
  } catch (e) { return { q: '오늘의 이야기', sub: '한 줄이면 충분해요' }; }
}
async function load() {
  if (!TOPIC) TOPIC = await topic();
  ALL = await DB.listTalk(TODAY);
}
const shown = () => { const now = Date.now(); return ALL.filter(x => (x.show_at || 0) <= now).sort((a, b) => (b.show_at || 0) - (a.show_at || 0)); };
// 제목 끝 두 낱말은 붙여서 — 한 글자만 다음 줄로 떨어지지 않게
const nw = q => esc(q).replace(/(\S+\s+\S+)$/, '<span style="white-space:nowrap">$1</span>');
// 말풍선 (대표 2026-10-25: "생동감") — 별명 첫 글자 얼굴 + 사람마다 다른 색 + '방금·5분 전'
const PAL = ['#C9A27E', '#8FAE9B', '#9AAFC8', '#C7A96B', '#B49AB8', '#C99A9A', '#8DB3B0', '#A7AE84', '#C4927A', '#97A9B8'];   // 바랜 색 — 원색은 촌스럽다(대표 2026-10-25)
const col = n => PAL[[...String(n)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % PAL.length];
const ago = t => { const m = Math.max(0, Math.round((Date.now() - (t || 0)) / 60000)); return m < 1 ? '방금' : m < 60 ? m + '분 전' : Math.floor(m / 60) + '시간 전'; };
const item = x => `<li class="tk-it${x.host ? ' tk-host' : ''}"><div class="tk-bb"><b><span>${esc(x.nick)}</span>${x.host ? '<em>진행</em>' : ''}<i>${ago(x.show_at)}</i></b><p>${esc(x.text)}</p></div></li>`;

function mount() {
  const box = document.getElementById('talk-box'); if (!box) return;
  box.hidden = false;
  box.querySelector('.tk-q').innerHTML = nw(TOPIC.q);   // 가로 칸 — 설명 한 줄은 안쪽 화면에
  box.onclick = e => { if (e.target.closest('a,button') && !e.target.closest('.tk-go')) return; nav('talk'); };
  paint(true);
}
// 띠에 걸 글 차례: 최근 것부터 열두 개, 네 칸마다 주제 카드를 한 번 끼운다
function reel() {
  const xs = shown().slice(0, 12), out = [];
  xs.forEach((x, i) => { if (i && i % 3 === 0) out.push({ typing: 1 }); out.push(x); });
  return out;
}
function paint(reset) {
  const ul = document.querySelector('#talk-box .tk-reel'); if (!ul) return;
  const r = reel(), n = document.querySelector('#talk-box .tk-n');
  if (n) { const c = shown().length; n.innerHTML = c ? `오늘 <b>${c}</b>` : ''; }
  if (!r.length) { ul.innerHTML = '<li class="tk-it tk-empty"><p>아직 조용해요. 첫 이야기를 남겨 주세요.</p></li>'; return; }
  // 끝없이 도는 띠: 두 벌 이어 붙이고 한 칸씩 올린다
  ul.innerHTML = [...r, ...r].map(x => x.topic ? `<li class="tk-it tk-topic"><span>오늘의 이야기</span><p>${esc(TOPIC.q)}</p></li>` : x.typing ? '<li class="tk-it tk-typing"><small>누군가 이야기를 쓰고 있어요</small><span class="tk-dots"><i></i><i></i><i></i></span></li>' : item(x)).join('');
  if (reset) { idx = 0; ul.style.transition = 'none'; ul.style.transform = 'translateY(0)'; }
  ul.dataset.len = r.length;
}
function tick() {
  const ul = document.querySelector('#talk-box .tk-reel'); if (!ul || !ul.children.length) return;
  const len = +ul.dataset.len || 0; if (len < 2) return;
  const h = ul.children[0].getBoundingClientRect().height;
  idx++; ul.style.transition = 'transform 1.1s cubic-bezier(.22,.7,.2,1)'; ul.style.transform = `translateY(${-idx * h}px)`;
  [...ul.children].forEach((li, i) => li.classList.toggle('in', i >= idx && i < idx + 2));
  if (idx >= len) setTimeout(() => { ul.style.transition = 'none'; idx = 0; ul.style.transform = 'translateY(0)'; [...ul.children].forEach((li, i) => li.classList.toggle('in', i < 2)); }, 1150);
}
function start() {
  stop();
  const ul = document.querySelector('#talk-box .tk-reel'); if (ul) [...ul.children].forEach((li, i) => li.classList.toggle('in', i < 2));
  timer = setInterval(() => { if (document.hidden) return; tick(); }, STEP);
  // 새 글 확인: 30초마다(화면이 보일 때만), 채움 글이 시간 되어 떠오르는 것도 이때 반영
  let last = shown().length;
  poll = setInterval(async () => { if (document.hidden) return; await load(); const c = shown().length; if (c !== last) { last = c; paint(true); } if (location.hash === '#talk') renderList(); }, 30000);
}
function stop() { clearInterval(timer); clearInterval(poll); }

// ── #talk : 오늘 글 전부 + 쓰기 ──
// 목록만 새로 그린다 — 30초마다 다시 읽을 때 쓰던 글·자판이 날아가지 않게 (대표 2026-10-25: "쓰다가 밖으로 튀어나온다")
function listHTML() {
  const me = DB.myUid(), xs = shown();
  return xs.map(x => `<li><b>${esc(x.nick)}${x.host ? '<em>진행</em>' : ''}</b><p>${esc(x.text)}</p>${me && x.uid === me ? `<button type="button" data-tkdel="${x.id}">지우기</button>` : x.seed || x.host ? '' : `<button type="button" data-tkrep="${x.id}">신고</button>`}</li>`).join('') || '<li class="tk-empty"><p>첫 이야기를 남겨 주세요.</p></li>';
}
function renderList() {
  const ul = document.querySelector('#talk-body .tk-list'); if (!ul) return renderDetail();
  ul.innerHTML = listHTML();
  ul.querySelectorAll('[data-tkdel]').forEach(b => b.onclick = async () => { await DB.deleteMyTalk(b.dataset.tkdel); await load(); renderList(); paint(true); });
  ul.querySelectorAll('[data-tkrep]').forEach(b => b.onclick = async () => { if (!DB.currentUser()) return openGate('신고하려면'); try { await DB.reportTalk(b.dataset.tkrep); b.textContent = '신고됨'; b.disabled = true; } catch (err) { toast(err.message); } });
}
// 말로 쓰기 (대표 2026-10-25: "말로 대충 쓰면 AI 가 알아서 깔끔하게") — 받아 적고 → /api/tidy 가 다듬어 → 칸에 넣어 준다. 본인이 보고 '남기기'.
async function tidy(raw) {
  try {
    const r = await fetch('/api/tidy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: raw, topic: (TOPIC && TOPIC.q) || '' }) });
    const j = await r.json(); if (j && j.text) return j.text;
  } catch (e) {}
  return raw.replace(/\s+/g, ' ').trim().slice(0, 120);
}
export async function renderDetail() {
  const el = document.getElementById('talk-body'); if (!el) return;
  if (!TOPIC) TOPIC = await topic();
  if (!ALL.length) await load();
  const keep = (el.querySelector('#tk-in') || {}).value || '';   // 다시 그려도 쓰던 글은 그대로
  el.innerHTML = `<div class="tk-head"><span class="tk-k">오늘의 주제</span><h3>${nw(TOPIC.q)}</h3><p>${esc(TOPIC.sub || '')}</p></div>
    <form class="tk-form" id="tk-form"><textarea id="tk-in" maxlength="120" rows="3" placeholder="한 줄이면 충분해요. 오늘 주제에 내 이야기를 남겨 보세요."></textarea>
    <div class="tk-fb"><small id="tk-cnt">0 / 120</small><span class="tk-btns"><button type="button" class="btn line tk-mic" id="tk-mic">🎙 말로 쓰기</button><button type="submit" class="btn green">남기기</button></span></div></form>
    <ul class="tk-list">${listHTML()}</ul>
    <p class="note" style="margin-top:22px">서로 다정하게 — 남을 깎아내리는 말·광고·연락처는 내려갑니다. 신고가 세 번 모이면 자동으로 가려집니다.</p>`;
  const inp = el.querySelector('#tk-in'), cnt = () => { el.querySelector('#tk-cnt').textContent = `${inp.value.length} / 120`; }; inp.oninput = cnt;
  if (keep) { inp.value = keep; cnt(); }
  el.querySelector('#tk-mic').onclick = () => {
    if (!listen) return;
    listen(async raw => {
      if (closeModal) closeModal();
      const b = el.querySelector('#tk-mic'); b.disabled = true; b.textContent = '정리하는 중…';
      const t = await tidy(raw);
      inp.value = ((inp.value.trim() ? inp.value.trim() + ' ' : '') + t).slice(0, 120); cnt();
      b.disabled = false; b.textContent = '🎙 말로 쓰기'; inp.focus();
      toast('깔끔하게 정리했어요. 보시고 고칠 곳 있으면 고친 뒤 남겨 주세요.');
    });
  };
  el.querySelector('#tk-form').onsubmit = async e => {
    e.preventDefault(); if (!DB.currentUser()) return openGate('이야기를 남기려면');
    try { await DB.addTalk(TODAY, inp.value); inp.value = ''; cnt(); await load(); renderList(); paint(true); toast('남겼어요. 고맙습니다.'); } catch (err) { toast(err.message); }
  };
  renderList();
}
