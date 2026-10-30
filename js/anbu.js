// 안부 카드 (대표 2026-10-31 — "오마주에 와서 인사 카드 보내기를 메인으로 딱 빼자")
// 첫 화면 커버·소개 배너 바로 밑. 친구·지인 / 부모님께 / 자녀에게 / 모임 단톡방 네 갈래.
// 보내기는 누구나, **받는 분 이름 넣기는 무료 구독자만**(이름 칸을 누르는 순간 한 번 권함).
// 카드에는 로고 없이 오른쪽 아래 구석에 작게 '오마주 매거진'(대표 2026-10-31: "받는 사람이 이게 뭐지 하고 검색해 보게").
// 사진은 cardpool 가지에서 고른 실사(img/anbu/), 문장은 data/anbu.json.
const TABS = [
  ['friend', '친구·지인에게', '예: 미숙아 · 김 선생님 · 언니', ''],
  ['parent', '부모님께', '예: 엄마 · 아버지 · 장모님', '엄마 아빠,'],
  ['child', '자녀에게', '예: 지수야 · 아들 · 우리 딸', ''],
  ['group', '모임 단톡방에', '예: 62년생 동창회 여러분 · 북한산 산악회', '여러분,'],
];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export let D; let deps, tab = 'friend', box;
const now = new Date(), DAY = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5), DOW = now.getDay();
const M = now.getMonth(), SEASON = M < 2 || M === 11 ? 'winter' : M < 5 ? 'spring' : M < 8 ? 'summer' : 'autumn';
const fits = x => (!x.w || x.w.includes(DOW)) && (!x.s || x.s === SEASON);
const nameKey = t => 'omaju.anbu.' + t;
const getName = t => { try { return localStorage.getItem(nameKey(t)) || ''; } catch (e) { return ''; } };
const setName = (t, v) => { try { v ? localStorage.setItem(nameKey(t), v) : localStorage.removeItem(nameKey(t)); } catch (e) {} };
const member = () => !!(deps && deps.DB.currentUser());
const nameFor = t => (member() && getName(t)) || (TABS.find(x => x[0] === t) || [])[3] || '';   // 이름을 안 넣으면 부모님께는 '엄마 아빠,' 모임에는 '여러분,'

// 오늘 이 칸에 보여 줄 여섯 장 — 오늘 요일·철에 맞는 문장을 먼저, 날마다 차례가 돈다
export function todays(t) {
  const all = (D[t] || []).map((x, i) => ({ ...x, i })).filter(fits);
  const tagged = all.filter(x => x.w || x.s), plain = all.filter(x => !x.w && !x.s);
  const rot = (a, n) => a.length ? a.slice(n % a.length).concat(a.slice(0, n % a.length)) : a;
  const ti = TABS.findIndex(x => x[0] === t);
  const out = rot(tagged, DAY).slice(0, 2).concat(rot(plain, DAY * 3 + ti)).slice(0, 6);
  const ph = D.photos.filter(fits);
  return out.map((x, k) => ({ text: x.t, photo: ph[(DAY * 5 + ti * 3 + k) % ph.length] }));
}

function tileHTML(c, k, name) {
  const lines = (name ? [name] : []).concat(c.text.split('\n'));
  return `<button type="button" class="anb-card k-${c.photo.k}" data-k="${k}" style="background-image:url('img/anbu/${c.photo.f}.jpg')"><span class="anb-txt">${lines.map((l, j) => `<span class="${name && j === 0 ? 'anb-nm' : ''}">${esc(l)}</span>`).join('')}</span><small class="anb-mark">오마주 매거진</small></button>`;
}

function render() {
  const t = TABS.find(x => x[0] === tab), name = nameFor(tab);
  box.querySelector('.anb-tabs').innerHTML = TABS.map(x => `<button type="button" data-t="${x[0]}" class="${x[0] === tab ? 'on' : ''}" aria-pressed="${x[0] === tab}">${x[1]}</button>`).join('');
  const inp = box.querySelector('#anb-name');
  inp.placeholder = t[2]; inp.value = member() ? getName(tab) : '';
  box.querySelector('.anb-lock').hidden = member();
  box.querySelector('.anb-row').innerHTML = todays(tab).map((c, k) => tileHTML(c, k, name)).join('');
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
    x.fillStyle = 'rgba(0,0,0,0.20)'; x.fillRect(0, 0, W, H);
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
  modal(`<h2 id="anb-h">안부 카드를 만들고 있어요</h2><div id="anb-box" style="height:325px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;max-width:260px;background:rgba(0,0,0,0.04);border-radius:6px;opacity:.7">잠시만요…</div><div class="modal-actions"><button type="button" class="btn green" id="anb-send" disabled style="opacity:.45">카톡으로 보내기</button><button type="button" class="btn line" id="anb-save" disabled style="opacity:.45">사진에 저장하기</button></div>${member() ? '' : '<p class="anb-tip">무료 구독하면 받는 분 이름을 넣어 보낼 수 있어요.</p>'}`);
  const fname = `오마주매거진_안부카드_${k + 1}.jpg`; let blob, file;
  try { blob = await toBlob(await draw(c, name)); if (!blob) throw new Error('blob'); file = new File([blob], fname, { type: 'image/jpeg' }); } catch (e) { closeModal(); toast('카드를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.'); return; }
  const bx = document.getElementById('anb-box'); if (!bx) return;
  const url = URL.createObjectURL(blob);
  document.getElementById('anb-h').textContent = '안부 카드가 준비되었습니다';
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

export async function mount(d) {
  deps = d;
  try { D = await (await fetch('data/anbu.json?v=' + DAY)).json(); } catch (e) { return; }
  // 시대 공유 판(home2)이 먼저 배너 뒤에 붙고 나서 끼워야 안부 카드가 배너 바로 밑에 온다
  if (document.documentElement.classList.contains('v2')) for (let i = 0; i < 40 && !document.querySelector('.cols-wrap.h4'); i++) await new Promise(r => setTimeout(r, 50));
  const intro = document.querySelector('.intro'); if (!intro || document.getElementById('anbu')) return;
  box = document.createElement('section'); box.id = 'anbu'; box.className = 'anbu'; box.setAttribute('aria-label', '안부 카드');
  box.innerHTML = `<p class="cols-head">오늘의 안부 카드 <small>마음 가는 분께 한 장</small></p>
    <ol class="anb-how"><li>누구에게 보낼지 고르고</li><li>받는 분 이름이나 호칭을 쓰고</li><li>마음에 드는 카드를 눌러 카톡으로</li></ol>
    <div class="anb-tabs" role="group" aria-label="누구에게"></div>
    <label class="anb-in"><span>받는 분</span><input id="anb-name" type="text" maxlength="16" autocomplete="off" inputmode="text"></label>
    <p class="anb-lock">이름 넣기는 <b>무료 구독</b>하면 바로 쓸 수 있어요. 카톡·네이버로 두 번이면 끝나요.</p>
    <div class="anb-row"></div>`;
  intro.after(box);
  // 느린 폰에서 시대 공유 판이 나중에 배너 뒤에 붙으면 안부 카드를 다시 배너 바로 밑으로
  if (document.documentElement.classList.contains('v2') && !document.querySelector('.cols-wrap.h4')) { const mo = new MutationObserver(() => { if (document.querySelector('.cols-wrap.h4')) { mo.disconnect(); intro.after(box); } }); mo.observe(intro.parentNode, { childList: true }); setTimeout(() => mo.disconnect(), 15000); }
  render();
  box.addEventListener('click', e => {
    const tb = e.target.closest('[data-t]'); if (tb) { tab = tb.dataset.t; render(); return; }
    const cd = e.target.closest('.anb-card'); if (cd) open(+cd.dataset.k);
  });
  const inp = box.querySelector('#anb-name');
  const gate = e => { if (!member()) { e.preventDefault(); inp.blur(); deps.openGate('받는 분 이름을 넣어 보내려면'); } };
  inp.addEventListener('focus', gate); inp.addEventListener('mousedown', gate);
  let tm; inp.addEventListener('input', () => { const t = tab; setName(t, inp.value.trim()); clearTimeout(tm); tm = setTimeout(() => { if (t !== tab) return; box.querySelector('.anb-row').innerHTML = todays(t).map((c, k) => tileHTML(c, k, nameFor(t))).join(''); }, 250); });
  deps.DB.onUser(() => render());
}
