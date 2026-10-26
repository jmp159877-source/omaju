// 기획 연재 '전기차 시대' — 오마주 편집실 (대표 2026-10-24)
// 첫 한 달은 매일 한 편, 그다음은 매주 한 편. 글은 사람이 쓰고 확인해 data/ev.json 에 쌓는다(새벽 AI 자동 생성 아님).
// 날짜가 오늘(한국 시각) 이전인 편만 열린다 — 일주일 치를 미리 써 두어도 하루에 한 편씩.
// 글 모양: 머리말(hook) → 본문 묶음(소제목·문단·도표·사진) → 생각해 볼 점 → 다음 편 → 출처.
// 도표는 우리가 그린다(SVG) — 남의 그래프 그림을 가져오지 않는다. 사진은 저작권이 분명한 것만(위키미디어 공용 CC·보도용) 출처를 붙여.
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const G = '#1F5A3E', GOLD = '#C9A24A', MUTE = '#C9D8CE';
// 기획 칼럼 둘이 같은 틀을 쓴다 (대표 2026-10-24): 전기차 시대 · AI 시대에 살 준비가 되었는가
export const SERIES = {
  ev: { file: 'data/ev.json', name: '전기차 시대', foot: '오마주 매거진은 특정 브랜드의 광고·협찬 없이 씁니다. 협찬을 받으면 글 첫머리에 밝힙니다. 차를 사시라거나 사지 마시라는 권유가 아니라, 고르실 때 쓸 자료입니다.' },
  ai: { file: 'data/ai.json', name: 'AI 시대에 살 준비가 되었는가', foot: '오마주 매거진은 특정 회사의 광고·협찬 없이 씁니다. 협찬을 받으면 글 첫머리에 밝힙니다. 어떤 서비스를 쓰시라는 권유가 아니라, 직접 해 보실 때 쓸 안내입니다.' },
};
// 맨 끝 주석 (대표 2026-10-26: AI 가 모아 정리한 글임을 밝히고, 오류가 있을 수 있음을 알린다)
export const AI_NOTE = '이 연재는 AI가 공개된 자료를 모아 정리하고, 오마주 매거진이 출처를 대조해 싣습니다. 숫자는 기준 시점의 자료이며 다소 오류가 있을 수 있습니다. 바로잡을 곳은 jmp159877@gmail.com 으로 알려 주시면 확인해 고치겠습니다.';
const DATA = {}, loading = {}, shown = {};
export function load(k = 'ev') {
  if (DATA[k]) return Promise.resolve(DATA[k]);
  return loading[k] || (loading[k] = fetch(SERIES[k].file, { cache: 'no-cache' }).then(r => r.json()).catch(() => ({ items: [] })).then(d => (DATA[k] = d || { items: [] })));
}
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const list = k => ((DATA[k] && DATA[k].items) || []).filter(x => x.date <= today()).sort((a, b) => b.no - a.no);
export function all(k = 'ev') { return list(k).slice().reverse(); }   // 1편부터 (첫 화면 연재 서가)
export function latest(k = 'ev') { return list(k)[0] || null; }
export function current(k = 'ev') { return shown[k] || latest(k); }
const fmt = n => Number(n).toLocaleString('ko-KR');

// ── 도표 (모두 SVG, 글자는 화면 글자 크기를 따르도록 viewBox 안 em 대신 고정 비율) ──
function bar(c) {   // 세로 막대: 몇 해·몇 기간의 변화
  const W = 260, H = 150, max = Math.max(...c.items.map(i => i[1])) * 1.15, bw = Math.min(64, (W - 40) / c.items.length - 24);
  const gap = (W - c.items.length * bw) / (c.items.length + 1);
  return `<svg viewBox="0 0 ${W} ${H + 34}" role="img" aria-label="${esc(c.title)}">${c.items.map(([l, v, hi], i) => {
    const h = (v / max) * H, x = gap + i * (bw + gap), y = H - h + 6;
    return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="6" fill="${hi ? G : MUTE}"/>
      <text x="${x + bw / 2}" y="${y - 8}" text-anchor="middle" class="ev-v${hi ? ' hi' : ''}">${esc(v >= 1000 ? fmt(v) : v)}${esc(c.unit || '')}</text>
      <text x="${x + bw / 2}" y="${H + 28}" text-anchor="middle" class="ev-l">${esc(l)}</text>`;
  }).join('')}<line x1="8" x2="${W - 8}" y1="${H + 6}" y2="${H + 6}" stroke="#bbb" stroke-width="1"/></svg>`;
}
function donut(c) {   // 원: 전체 가운데 몇 %
  const r = 70, C = 2 * Math.PI * r, p = c.value / 100;
  return `<div class="ev-donut"><svg viewBox="0 0 200 200" role="img" aria-label="${esc(c.title)}">
    <circle cx="100" cy="100" r="${r}" fill="none" stroke="${MUTE}" stroke-width="30"/>
    <circle cx="100" cy="100" r="${r}" fill="none" stroke="${G}" stroke-width="30" stroke-dasharray="${C * p} ${C}" transform="rotate(-90 100 100)"/>
    <text x="100" y="98" text-anchor="middle" class="ev-big">${esc(c.value)}%</text>
    <text x="100" y="124" text-anchor="middle" class="ev-l">${esc(c.center || '')}</text></svg>
    <ul class="ev-key"><li><i style="background:${G}"></i>${esc(c.on)}</li><li><i style="background:${MUTE}"></i>${esc(c.off)}</li></ul></div>`;
}
function hbar(c) {   // 가로 막대: 순위
  const max = Math.max(...c.items.map(i => i[1]));
  return `<ol class="ev-rank">${c.items.map(([l, v, hi], i) => `<li class="${hi ? 'hi' : ''}">
    <span class="ev-rk">${i + 1}</span><span class="ev-nm">${esc(l)}</span>
    <span class="ev-track"><span style="width:${Math.max(4, v / max * 100)}%"></span></span><b>${fmt(v)}${esc(c.unit || '')}</b></li>`).join('')}</ol>`;
}
function chart(c) {
  const body = c.kind === 'donut' ? donut(c) : c.kind === 'hbar' ? hbar(c) : bar(c);
  return `<figure class="ev-chart"><figcaption>${esc(c.title)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</figcaption>${body}
    ${c.legend ? `<p class="ev-legend">${esc(c.legend)}</p>` : ''}<p class="ev-src">자료: ${esc(c.source)}</p></figure>`;
}
function photo(b) {
  return `<figure class="ev-photo"><img src="${esc(b.src)}" alt="${esc(b.alt || b.caption || '')}" loading="lazy">
    <figcaption>${esc(b.caption || '')}<small>사진: ${esc(b.credit)}</small></figcaption></figure>`;
}
// 사진 여러 장을 옆으로 넘겨 보는 띠 (대표 2026-10-25: "글보다 눈으로 보는 게 강하다 — 차 사진을 다양한 각도·배경으로 많이")
// 글 길이는 그대로 두고 볼거리만 늘린다. 장마다 설명·찍은 사람·라이선스.
function gallery(g) {
  const n = g.items.length;
  return `<figure class="ev-gal">${g.title ? `<figcaption class="ev-gal-t">${esc(g.title)}<small>옆으로 넘겨 보세요 · ${n}장</small></figcaption>` : ''}
    <div class="ev-gal-row">${g.items.map((b, i) => `<div class="ev-gal-it"><img src="${esc(b.src)}" alt="${esc(b.alt || b.caption || '')}" loading="lazy"><span class="ev-gal-no">${i + 1} / ${n}</span>
      <p>${esc(b.caption || '')}<small>사진: ${esc(b.credit)}</small></p></div>`).join('')}</div></figure>`;
}
// 대표 2026-10-24: 문장이 줄줄이 이어지면 읽기 힘들다 — 한 단락은 한두 문장으로 끊고 단락 사이를 띄운다.
// 문장이 짧으면(둘 합쳐 70자 아래) 두 문장을 한 단락에, 길면 한 문장씩.
function paras(text) {
  const ss = String(text).split(/(?<=[.?!])\s+(?=\S)/).filter(Boolean), out = [];
  for (let i = 0; i < ss.length; i++) {
    if (i + 1 < ss.length && (ss[i] + ss[i + 1]).length < 70) { out.push(ss[i] + ' ' + ss[i + 1]); i++; } else out.push(ss[i]);
  }
  return out;
}
// 대표 2026-10-24: 주요 낱말·숫자는 살짝 굵게(색은 넣지 않는다). 낱말은 글에 **이렇게** 표시하고, 숫자+단위는 저절로.
const NUM = /((?:\d[\d,.]*\s?만\s?)?\d[\d,.]*만?(?:~\d[\d,.]*만?)?\s?(?:%|대|원|위|배|명))/g;
function rich(t) {
  return String(t).split(/(\*\*[^*]+\*\*)/).map(x => /^\*\*[^*]+\*\*$/.test(x) ? `<b>${esc(x.slice(2, -2))}</b>` : esc(x).replace(NUM, '<b>$1</b>')).join('');
}
function block(b) {
  if (b.h) return `<p class="is-sub">${esc(b.h)}</p>`;
  if (b.p) return paras(b.p).map(t => `<p class="ev-p">${rich(t)}</p>`).join('');
  if (b.chart) return chart(b.chart);
  if (b.photo) return photo(b.photo);
  if (b.gallery) return gallery(b.gallery);
  if (b.box) return `<div class="ev-box"><b>${esc(b.box.title)}</b>${rich(b.box.text)}</div>`;
  return '';
}
export function render(el, id, k = 'ev') {
  if (!el) return;
  const items = list(k);
  if (!items.length) { el.innerHTML = '<p class="note" style="margin-top:30px">첫 편을 준비하고 있어요.</p>'; return; }
  const a = items.find(x => x.id === id) || items[0];
  shown[k] = a;
  try { const r = JSON.parse(localStorage.getItem('omaju.read') || '{}'); if (!r[k] || r[k].no < a.no) { r[k] = { no: a.no, title: a.title, id: a.id }; localStorage.setItem('omaju.read', JSON.stringify(r)); } } catch (e) {}   // 내 서재 '이어 읽기'
  const t = document.getElementById('d-title'); if (t && document.body.classList.contains('in-detail')) t.textContent = a.title;
  const d = a.date.slice(5).replace('-', '월 ').replace(/^0/, '') + '일';
  el.innerHTML = `<article class="ev">
      <p class="pet-meta">${a.no}편 · ${esc(a.part || '')}</p>
      <p class="ev-by">오마주 매거진 · ${esc(a.date.slice(0, 4))}년 ${esc(d)}</p>
      ${a.hook ? `<p class="pet-hook">${rich(a.hook)}</p>` : ''}
      ${(a.blocks || []).map(block).join('')}
      ${a.cons && a.cons.length ? `<div class="pet-vet"><b>생각해 볼 점</b><ul class="ev-cons">${a.cons.map(x => `<li>${rich(x)}</li>`).join('')}</ul></div>` : ''}
      ${a.next ? `<p class="ev-next"><small>다음 편</small>${esc(a.next)}</p>` : ''}
      ${(a.corrections || []).map(c => `<div class="ev-fix"><b>바로잡습니다 (${esc(c.date.slice(5).replace('-', '.'))})</b><ul>${(c.items || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}
      <div class="ev-sources"><b>출처</b><ol>${(a.sources || []).map(s => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)}</li>`).join('')}</ol>
      ${a.photos ? `<p>사진: ${esc(a.photos)}</p>` : ''}
      <p>${esc(SERIES[k].foot)}</p>
      <p class="ev-ai">※ ${esc(AI_NOTE)}</p></div>
    </article>
    <div class="pet-past"><p class="is-sub">연재 목록</p>${items.slice().reverse().map(x => `<button type="button" data-ev="${esc(x.id)}" aria-current="${x === a}"><span>${x.no}. ${esc(x.title)}</span><small>${esc(x.date.slice(5).replace('-', '.'))}</small></button>`).join('')}</div>`;
  el.querySelectorAll('[data-ev]').forEach(b => b.onclick = () => { render(el, b.dataset.ev, k); window.scrollTo({ top: 0 }); });
}
// 첫 화면 띠: 오늘 편 제목
// 칼럼 단추: 오늘 편 제목. 1편이 아직 안 열린 칼럼은 단추를 숨긴다(빈 칸을 세우지 않는다)
export function band(k = 'ev') {
  const a = latest(k), el = document.getElementById(k + '-band-title'), tile = document.querySelector(`.col-tile[data-open="${k}"]`);
  if (tile) { tile.hidden = !a; const row = tile.parentElement; row.classList.toggle('one', row.querySelectorAll('.col-tile:not([hidden])').length < 2); }
  if (a && el) el.textContent = `${a.no}편 · ${a.title}`;
}
