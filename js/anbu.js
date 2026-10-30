// 좋은 글귀 인사 카드 (대표 2026-10-31 02:13 — "어떤 마음을 전할지부터 고르고, 누구에게, 호칭, 카드, 카톡")
// 첫 화면 커버·소개 배너 바로 밑. ① 마음 갈래 일곱(사진 칸) ② 받는 사람 넷(말투가 바뀐다) ③ 호칭 ④ 큰 카드 옆으로 넘겨 고르기.
// 보내기는 누구나, **받는 분 이름 넣기는 무료 구독자만**(이름 칸을 누르는 순간 한 번 권함).
// 카드에는 로고 없이 오른쪽 아래 구석에 작게 '오마주 매거진'. 사진 img/anbu/, 문장 data/anbu.json(cards[마음][받는 사람]).
const TABS = [
  ['friend', '친구·지인에게', '예: 미숙아 · 김 선생님', ''],
  ['parent', '부모님께', '예: 엄마 · 아버지 · 장모님', '엄마 아빠,'],
  ['child', '자녀에게', '예: 지수야 · 아들 · 우리 딸', ''],
  ['group', '모임 단톡방에', '예: 동창회 여러분', '여러분,'],
];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export let D; let deps, tab = 'friend', mood = 'courage', box;
const now = new Date(), DAY = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5), DOW = now.getDay();
const M = now.getMonth(), SEASON = M < 2 || M === 11 ? 'winter' : M < 5 ? 'spring' : M < 8 ? 'summer' : 'autumn';
const fits = x => (!x.w || x.w.includes(DOW)) && (!x.s || x.s === SEASON);
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) || ''; v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { return ''; } };
const nameKey = t => 'omaju.anbu.' + t;
const getName = t => ls(nameKey(t));
const setName = (t, v) => ls(nameKey(t), v);
const member = () => !!(deps && deps.DB.currentUser());
const nameFor = t => (member() && getName(t)) || (TABS.find(x => x[0] === t) || [])[3] || '';   // 이름을 안 넣으면 부모님께는 '엄마 아빠,' 모임에는 '여러분,'
const photo = f => D.photos.find(p => p.f === f) || { f, k: 'full' };

// 이 마음·이 사람에게 보여 줄 여섯 장 — 오늘 요일·철에 맞는 것만, 날마다 차례가 돈다
export function todays(t, m = mood) {
  const all = ((D.cards[m] || {})[t] || []).map(x => typeof x === 'string' ? { t: x } : x).filter(fits);
  const n = all.length ? DAY % all.length : 0, out = all.slice(n).concat(all.slice(0, n)).slice(0, 6);
  const md = D.moods.find(x => x.k === m) || D.moods[0];
  const ph = md.p.slice(1).map(photo).filter(fits), pool = ph.length ? ph : D.photos.filter(fits);
  return out.map((x, k) => ({ text: x.t, photo: pool[(DAY + k) % pool.length] }));
}

function tileHTML(c, k, name) {
  const lines = (name ? [name] : []).concat(c.text.split('\n'));
  return `<button type="button" class="anb-card k-${c.photo.k}" data-k="${k}" style="background-image:url('img/anbu/${c.photo.f}.jpg')"><span class="anb-txt">${lines.map((l, j) => `<span class="${name && j === 0 ? 'anb-nm' : ''}">${esc(l)}</span>`).join('')}</span><small class="anb-mark">오마주 매거진</small></button>`;
}

function cards() {
  const row = box.querySelector('.anb-row'), name = nameFor(tab), L = todays(tab);
  row.innerHTML = L.map((c, k) => tileHTML(c, k, name)).join('');
  row.scrollLeft = 0; box.querySelector('.anb-cnt').textContent = L.length ? `1 / ${L.length}` : '';
}
function render() {
  const mw = box.querySelector('.anb-moods');
  if (mw.children.length) mw.querySelectorAll('[data-m]').forEach(b => { const on = b.dataset.m === mood; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  else mw.innerHTML = D.moods.map(x => `<button type="button" data-m="${x.k}" class="${x.k === mood ? 'on' : ''}" aria-pressed="${x.k === mood}"><span class="anb-mph" style="background-image:url('img/anbu/${x.p[0]}.jpg')"></span><span class="anb-mn">${esc(x.n)}</span></button>`).join('');
  const t = TABS.find(x => x[0] === tab);
  box.querySelector('.anb-tabs').innerHTML = TABS.map(x => `<button type="button" data-t="${x[0]}" class="${x[0] === tab ? 'on' : ''}" aria-pressed="${x[0] === tab}">${x[1]}</button>`).join('');
  const inp = box.querySelector('#anb-name');
  inp.placeholder = t[2]; inp.value = member() ? getName(tab) : '';
  box.querySelector('.anb-lock').hidden = member();
  cards();
}

// ── 보내는 그림 (1080×1350) ──
function load(src) { return new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); setTimeout(() => r(null), 5000); im.src = src; }); }
function cover(x, im, X, Y, W, H) { const s = Math.max(W / im.width, H / im.height), w = im.width * s, h = im.height * s; x.drawImage(im, X + (W - w) / 2, Y + (H - h) / 2, w, h); }
export async function draw(c, name) {
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d', { willReadFrequently: true });
  const cap = (p, ms) => Promise.race([Promise.resolve(p).catch(() => null), new Promise(r => setTimeout(() => r(null), ms))]);
  const lines = c.text.split('\n');
  const [im] = await Promise.all([load(`img/anbu/${c.photo.f}.jpg`), cap(document.fonts ? document.fonts.load('800 64px "Nanum Myeongjo"', c.text + name + '오마주 매거진') : null, 2500), cap(document.fonts ? document.fonts.load('500 24px "Noto Sans KR"', '오마주 매거진') : null, 2500)]);
  const k = c.photo.k;
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  const PH = k === 'top' ? 820 : H;
  if (im) cover(x, im, 0, 0, W, PH); else { x.fillStyle = '#D9E2DA'; x.fillRect(0, 0, W, PH); }
  // 글자 크기 — 가장 긴 줄이 폭 안에 들게
  const maxW = W - 180; let fs = 66;
  const setF = (s, wgt = 800) => { x.font = `${wgt} ${s}px "Nanum Myeongjo", serif`; };
  setF(fs); while (fs > 44 && Math.max(...lines.concat(name ? [name] : []).map(l => x.measureText(l).width)) > maxW) { fs -= 2; setF(fs); }
  const lh = fs * 1.55, nfs = Math.round(fs * 0.9);
  const all = (name ? 1 : 0) + lines.length;
  const blockH = lh * all + (name ? 14 : 0);
  const putLines = (cx, top, align, color, shadow, ncol = color) => {
    x.textAlign = align; x.textBaseline = 'alphabetic'; x.fillStyle = color;
    if (shadow) { x.shadowColor = shadow; x.shadowBlur = 26; x.shadowOffsetY = 2; }
    let y = top + fs;
    if (name) { setF(nfs, 700); x.fillStyle = ncol; x.fillText(name, cx, y); x.fillStyle = color; y += lh + 14; }
    setF(fs); lines.forEach(l => { x.fillText(l, cx, y); y += lh; });
    x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0;
  };
  let markColor = 'rgba(255,255,255,0.78)';
  if (k === 'full') {
    const g = x.createLinearGradient(0, H * 0.38, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    putLines(90, H - 150 - blockH, 'left', '#fff', 'rgba(0,0,0,0.35)');
  } else if (k === 'top') {
    const top = PH + (H - PH - blockH) / 2 - 18;
    putLines(W / 2, top, 'center', '#23201B', null, '#1F5A3E');
    markColor = 'rgba(60,60,55,0.55)';
  } else {   // sky — 하늘·풍경 가운데 흰 글씨, 그림자를 넉넉히(밝은 하늘에 흰 글씨는 안 읽힌다)
    x.fillStyle = 'rgba(0,0,0,0.26)'; x.fillRect(0, 0, W, H);
    putLines(W / 2, (H - blockH) / 2 - 20, 'center', '#fff', 'rgba(0,0,0,0.6)');
  }
  // 오른쪽 아래 구석 '오마주 매거진' (작게)
  x.font = '500 24px "Noto Sans KR", sans-serif'; x.textAlign = 'right'; x.fillStyle = markColor;
  if ('letterSpacing' in x) x.letterSpacing = '2px';
  x.fillText('오마주 매거진', W - 40, H - 36);
  return cv;
}
async function toBlob(cv) {
  try { const d = cv.toDataURL('image/jpeg', 0.88); const bin = atob(d.slice(d.indexOf(',') + 1)), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k); return new Blob([u8], { type: 'image/jpeg' }); } catch (e) {}
  return new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
}

async function open(k) {
  const { modal, closeModal, kakaoSendCard, DB, toast } = deps;
  try { DB.bumpClick('anbu'); } catch (e) {}
  const c = todays(tab)[k], name = nameFor(tab);
  if (!c) return;
  modal(`<h2 id="anb-h">인사 카드를 만들고 있어요</h2><div id="anb-box" style="height:325px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;max-width:260px;background:rgba(0,0,0,0.04);border-radius:6px;opacity:.7">잠시만요…</div><div class="modal-actions"><button type="button" class="btn anb-kakao" id="anb-send" disabled style="opacity:.45">카톡으로 보내기</button><button type="button" class="btn line" id="anb-save" disabled style="opacity:.45">사진에 저장하기</button></div>${member() ? '' : '<p class="anb-tip">무료 구독하면 받는 분 이름을 넣어 보낼 수 있어요.</p>'}`);
  const fname = `오마주매거진_인사카드_${k + 1}.jpg`; let blob, file;
  try { blob = await toBlob(await draw(c, name)); if (!blob) throw new Error('blob'); file = new File([blob], fname, { type: 'image/jpeg' }); } catch (e) { closeModal(); toast('카드를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.'); return; }
  const bx = document.getElementById('anb-box'); if (!bx) return;
  const url = URL.createObjectURL(blob);
  document.getElementById('anb-h').textContent = '인사 카드가 준비되었습니다';
  bx.outerHTML = `<img src="${url}" alt="" style="width:100%;max-width:260px;display:block;margin:0 auto 16px;box-shadow:0 6px 20px rgba(0,0,0,.25)">`;
  ['anb-send', 'anb-save'].forEach(id => { const el = document.getElementById(id); el.disabled = false; el.style.opacity = ''; });
  const save = () => { const a = document.createElement('a'); a.href = url; a.download = fname; a.click(); closeModal(); toast('사진에 저장했어요. 카톡에서 사진으로 보내 주세요.'); };
  document.getElementById('anb-save').onclick = save;
  const text = (name ? name + ' ' : '') + c.text.replace(/\n/g, ' ');
  document.getElementById('anb-send').onclick = async () => {
    const b = document.getElementById('anb-send'); b.disabled = true; b.textContent = '보내는 중…';
    const canFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    if (canFile) { try { await navigator.share({ files: [file], text }); closeModal(); return; } catch (err) { if (err.name === 'AbortError') { b.disabled = false; b.textContent = '카톡으로 보내기'; return; } } }
    if (await kakaoSendCard(file)) { closeModal(); return; }
    save();
  };
}

let readyR; const ready = new Promise(r => { readyR = r; });
// 첫 화면: 콘텐츠 칸처럼 사진 한 장 안에 제목·단추 (대표 2026-10-31 07:24 — "쫙 펼쳐 놓지 말고 하나의 항목으로")
export async function mount(d) {
  deps = d;
  try { D = await (await fetch('data/anbu.json?v=' + DAY)).json(); } catch (e) { return; }
  readyR();
  if (document.documentElement.classList.contains('v2')) for (let i = 0; i < 40 && !document.querySelector('.cols-wrap.h4'); i++) await new Promise(r => setTimeout(r, 50));
  const intro = document.querySelector('.intro'); if (!intro || document.getElementById('anbu-home')) return;
  const tile = document.createElement('section'); tile.id = 'anbu-home'; tile.className = 'anbu';
  tile.innerHTML = `<button type="button" class="anb-hero" aria-label="좋은 글귀 인사 카드 — 카드 고르러 가기"><span class="anb-hx"><small>오늘, 마음을 전하는 한 장</small><b>좋은 글귀<br>인사 카드</b><span class="anb-hsub">용기 · 희망 · 위로 · 고마움</span><span class="anb-go">카드 고르기 ›</span></span></button>`;
  intro.after(tile);
  if (document.documentElement.classList.contains('v2') && !document.querySelector('.cols-wrap.h4')) { const mo = new MutationObserver(() => { if (document.querySelector('.cols-wrap.h4')) { mo.disconnect(); intro.after(tile); } }); mo.observe(intro.parentNode, { childList: true }); setTimeout(() => mo.disconnect(), 15000); }
  tile.querySelector('.anb-hero').onclick = () => { try { deps.DB.bumpClick('anbu_tile'); } catch (e) {} (window.omajuNav || (h => { location.hash = h; }))('anbu'); };
  deps.DB.onUser(() => { if (box && box.isConnected) render(); });
}

// 안쪽(#anbu 코너): ① 어떤 마음 ② 누구에게 ③ 호칭 ④ 카드 → 카톡
export async function renderDetail(el) {
  await ready; if (!el) return;
  if (box === el && el.firstChild) { render(); return; }
  box = el; box.classList.add('anbu-in');
  const sv = ls('omaju.anbu.mood'); if (D.moods.some(x => x.k === sv)) mood = sv;
  box.innerHTML = `<p class="anb-q"><b>1</b>어떤 마음을 전할까요?</p>
    <div class="anb-moods" role="group" aria-label="어떤 마음"></div>
    <p class="anb-q"><b>2</b>누구에게 보낼까요?</p>
    <div class="anb-tabs" role="group" aria-label="누구에게"></div>
    <p class="anb-q"><b>3</b>받는 분을 불러 주세요</p>
    <label class="anb-in"><span>받는 분</span><input id="anb-name" type="text" maxlength="16" autocomplete="off" inputmode="text"></label>
    <p class="anb-lock">이름 넣기는 <b>무료 구독</b>하면 바로 쓸 수 있어요. 카톡·네이버로 두 번이면 끝나요.</p>
    <p class="anb-q"><b>4</b>카드를 눌러 카톡으로 <span class="anb-cnt"></span></p>
    <div class="anb-row"></div>`;
  render();
  box.addEventListener('click', e => {
    const mb = e.target.closest('[data-m]'); if (mb) { mood = mb.dataset.m; ls('omaju.anbu.mood', mood); render(); return; }
    const tb = e.target.closest('[data-t]'); if (tb) { tab = tb.dataset.t; render(); return; }
    const cd = e.target.closest('.anb-card'); if (cd) open(+cd.dataset.k);
  });
  const inp = box.querySelector('#anb-name');
  const gate = e => { if (!member()) { e.preventDefault(); inp.blur(); deps.openGate('받는 분 이름을 넣어 보내려면'); } };
  inp.addEventListener('focus', gate); inp.addEventListener('mousedown', gate);
  let tm; inp.addEventListener('input', () => { const t = tab; setName(t, inp.value.trim()); clearTimeout(tm); tm = setTimeout(() => { if (t !== tab) return; const row = box.querySelector('.anb-row'), x = row.scrollLeft; cards(); row.scrollLeft = x; row.dispatchEvent(new Event('scroll')); }, 250); });
  const row = box.querySelector('.anb-row'); let rt;
  row.addEventListener('scroll', () => { clearTimeout(rt); rt = setTimeout(() => { const c = row.querySelector('.anb-card'); if (!c) return; const w = c.offsetWidth + 12, n = row.children.length; const i = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4 ? n : Math.min(n, Math.round(row.scrollLeft / w) + 1); box.querySelector('.anb-cnt').textContent = `${i} / ${n}`; }, 80); }, { passive: true });
}
