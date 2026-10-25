// 관리자 '현황' 판 (대표 2026-10-25: "좀 더 세련되고 멋있게, 그래픽 차트로, 퀄리티 있게")
// 그리기만 한다 — 숫자 모으기는 admin.js loadDash 가 하고 여기에 넘긴다. 바깥 꾸러미 없이 SVG 로 직접 그린다.
// 색: 초록(#0F8A5F) 하나가 기본, 두 줄일 때만 호박색(#C0761A, 점선)을 더한다 — 색만으로 가르지 않게 점선·이름표를 같이 쓴다.
const G = '#0F8A5F', A = '#C0761A', INK = '#1F2A24', SUB = '#6B756F', GRID = '#E7EAE5';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = v => (v || 0).toLocaleString('ko-KR');
const md = d => { const [, m, dd] = d.split('-'); return `${+m}/${+dd}`; };

// ── 작은 선(타일 안) ──
function spark(vals, color = G) {
  const w = 120, h = 34, mx = Math.max(1, ...vals), st = vals.length > 1 ? w / (vals.length - 1) : w;
  const pts = vals.map((v, i) => `${(i * st).toFixed(1)},${(h - 3 - (v / mx) * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg class="ad-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,${h} ${pts} ${w},${h}" fill="${color}" fill-opacity=".10" stroke="none"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}

// ── 선 그래프 (한두 줄, 날짜 축, 마우스·손가락 대면 그날 숫자) ──
function lineChart(id, days, series, { area = false, W = 640, H = 220 } = {}) {
  const L = 34, R = 12, T = 14, B = 26;
  const mx = Math.max(1, ...series.flatMap(s => s.vals)), top = niceMax(mx);
  const x = i => L + (days.length > 1 ? i * (W - L - R) / (days.length - 1) : (W - L - R) / 2), y = v => T + (H - T - B) * (1 - v / top);
  const ticks = [0, top / 2, top].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${GRID}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ad-ax">${n(Math.round(v))}</text>`).join('');
  const every = Math.ceil(days.length / (W < 500 ? 5 : 7));
  const xl = days.map((d, i) => (i % every === 0 || i === days.length - 1) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="ad-ax">${md(d)}</text>` : '').join('');
  const lines = series.map(s => {
    const p = s.vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const last = s.vals.length - 1;
    return (area ? `<polygon points="${x(0)},${y(0)} ${p} ${x(last)},${y(0)}" fill="${s.color}" fill-opacity=".10"/>` : '')
      + `<polyline points="${p}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ' stroke-dasharray="5 4"' : ''}/>`
      + `<circle cx="${x(last)}" cy="${y(s.vals[last])}" r="4.5" fill="${s.color}" stroke="#fff" stroke-width="2"/>`
      + `<text x="${x(last) - 8}" y="${y(s.vals[last]) - 9}" text-anchor="end" class="ad-dl">${n(s.vals[last])}</text>`;
  }).join('');
  const legend = series.length > 1 ? `<div class="ad-legend">${series.map(s => `<span><i style="background:${s.color}${s.dash ? ';background:repeating-linear-gradient(90deg,' + s.color + ' 0 5px,transparent 5px 8px)' : ''}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  const data = esc(JSON.stringify({ days, series: series.map(s => ({ name: s.name, vals: s.vals, color: s.color })) }));
  return `${legend}<div class="ad-plot" data-line="${data}" data-geo="${[W, L, R].join(',')}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map(s => s.name).join(', '))} 추이">${ticks}${xl}${lines}<line class="ad-cross" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="${SUB}" stroke-dasharray="3 3" opacity="0"/></svg><div class="ad-tip" hidden></div></div>`;
}
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p; return 10 * p; }

// ── 가로 막대 (크기 비교 — 한 가지 색, 숫자는 막대 끝에) ──
function hbars(rows, { unit = '', color = G, empty = '아직 없음' } = {}) {
  if (!rows.length || rows.every(r => !r[1])) return `<p class="ad-empty">${empty}</p>`;
  const mx = Math.max(1, ...rows.map(r => r[1])), tot = rows.reduce((t, r) => t + r[1], 0);
  return `<ul class="ad-bars">${rows.map(([k, v, note]) => `<li title="${esc(k)} ${n(v)}${unit}${tot ? ` (${Math.round(v * 100 / tot)}%)` : ''}"><span class="ad-bk">${esc(k)}${note ? `<small>${esc(note)}</small>` : ''}</span><span class="ad-bt"><i style="width:${Math.max(v ? 2 : 0, v * 100 / mx)}%;background:${color}"></i></span><b>${n(v)}${unit}</b></li>`).join('')}</ul>`;
}

// ── 비율 띠 (성별처럼 둘·셋으로 나뉘는 것) ──
function ratio(parts) {
  const tot = parts.reduce((t, p) => t + p[1], 0);
  if (!tot) return '<p class="ad-empty">아직 없음</p>';
  return `<div class="ad-ratio">${parts.filter(p => p[1]).map(([k, v, c]) => `<i style="flex:${v};background:${c}" title="${esc(k)} ${v}명"></i>`).join('')}</div><div class="ad-rl">${parts.map(([k, v, c]) => `<span><i style="background:${c}"></i>${esc(k)} <b>${Math.round(v * 100 / tot)}%</b> <small>${v}명</small></span>`).join('')}</div>`;
}

const card = (k, title, body, wide) => `<section class="ad-card${wide ? ' wide' : ''}"><p class="ad-k">${esc(k)}</p><h3>${esc(title)}</h3>${body}</section>`;

export function renderDash(el, D) {
  const narrow = (el.clientWidth || 1000) < 620;   // 휴대폰: 그래프를 좁은 틀로 그려 글씨가 작아지지 않게
  const { users, stats, today, days30, joinedToday, clicks, names } = D;
  const st = d => stats[d] || {};
  const d14 = days30.slice(-14);
  const visits30 = days30.map(d => st(d).visits || 0), new30 = days30.map(d => st(d).newDevices || 0);
  // 구독자 누적 (날마다)
  const byDay = {}; users.forEach(u => { if (u.joined) byDay[u.joined] = (byDay[u.joined] || 0) + 1; });
  const base = users.filter(u => !u.joined || u.joined < days30[0]).length;
  let acc = base; const subs30 = days30.map(d => (acc += byDay[d] || 0));
  const sum = (f, from = '2026-10-22') => Object.entries(stats).filter(([d]) => d >= from).reduce((t, [, s]) => t + (s[f] || 0), 0);
  const wk = arr => arr.slice(-7).reduce((a, b) => a + b, 0), pwk = arr => arr.slice(-14, -7).reduce((a, b) => a + b, 0);
  const delta = (a, b) => { if (!b) return a ? '<em class="up">새로 생김</em>' : '<em>—</em>'; const p = Math.round((a - b) * 100 / b); return `<em class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}% <small>지난주보다</small></em>`; };
  const dday = Math.floor((Date.parse(today) - Date.parse('2026-10-22')) / 864e5) + 1;

  const kpi = [
    ['누적 구독자', n(users.length), `오늘 +${joinedToday.length}`, spark(subs30.slice(-14))],
    ['오늘 방문', n(st(today).visits), `처음 온 기기 ${n(st(today).newDevices)}`, spark(d14.map(d => st(d).visits || 0))],
    ['이번 주 방문', n(wk(visits30)), delta(wk(visits30), pwk(visits30)), spark(visits30.slice(-14))],
    ['지금까지 본 기기', n(sum('newDevices')), `창간 이후 방문 ${n(sum('visits'))}`, spark(new30.slice(-14), A)],
  ].map(([k, v, s, sp]) => `<div class="ad-kpi"><span>${k}</span><b>${v}</b><small>${s}</small>${sp}</div>`).join('');

  // 어디서 왔나
  const src = [['네이버·구글 검색', sum('search')], ['카톡으로 받은 인사 카드', sum('card')], ['심리 테스트 결과', sum('psy')], ['유튜브', sum('yt')], ['유튜브 자녀 편', sum('kid')], ['네이버 블로그', sum('blog')]];
  const direct = Math.max(0, sum('newDevices') - src.reduce((t, s) => t + s[1], 0));
  // 나이대 · 성별
  const yr = +today.slice(0, 4), age = {};
  users.forEach(u => { if (!u.birthYear) return; const a = Math.floor((yr - u.birthYear) / 10) * 10; const k = a >= 70 ? '70대 이상' : a < 30 ? '20대 이하' : `${a}대`; age[k] = (age[k] || 0) + 1; });
  const ageRows = ['20대 이하', '30대', '40대', '50대', '60대', '70대 이상'].map(k => [k, age[k] || 0]);
  const gen = { 남: 0, 여: 0, 기타: 0 }; users.forEach(u => { const g = /남/.test(u.gender || '') ? '남' : /여/.test(u.gender || '') ? '여' : '기타'; gen[g]++; });
  const reg = {}; users.forEach(u => { const r = (u.region || '').split(' ')[0] || '미입력'; reg[r] = (reg[r] || 0) + 1; });
  const regRows = Object.entries(reg).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const clickRows = Object.entries(clicks || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [names[k] || k, v]);
  // 다시 오는 비율: 최근 7일 접속 구독자 / 누적 구독자
  const wk0 = (() => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 6); return d.toISOString().slice(0, 10); })();
  const active7 = users.filter(u => (u.lastSeenDay || '') >= wk0).length, activeT = users.filter(u => u.lastSeenDay === today).length;

  el.innerHTML = `
  <header class="ad-hero"><div><p class="ad-k">OMAJU · DASHBOARD</p><h2>오마주 현황</h2><p class="ad-date">${today.replace(/-/g, '.')} · 창간 ${dday}일째</p></div>
    <div class="ad-live"><span><b>${n(activeT)}</b>오늘 들른 구독자</span><span><b>${users.length ? Math.round(active7 * 100 / users.length) : 0}%</b>7일 안에 다시 온 구독자</span></div></header>
  <div class="ad-kpis">${kpi}</div>
  <div class="ad-grid">
    ${card(days30.length < 30 ? '창간 이후' : '최근 30일', '날마다 방문', lineChart('v', days30, [{ name: '방문', vals: visits30, color: G }, { name: '처음 온 기기', vals: new30, color: A, dash: 1 }], narrow ? { W: 400, H: 250 } : {}), true)}
    ${card('창간 이후', '구독자는 이렇게 늘었어요', lineChart('s', days30, [{ name: '누적 구독자', vals: subs30, color: G }], { area: true, W: 420, H: 250 }))}
    ${card('창간 이후 처음 온 기기', '어디서 들어왔나', hbars([...src, ['주소·앱으로 바로', direct, '꼬리표 없이']], { unit: '대' }))}
    ${card('구독자', '나이대', hbars(ageRows, { unit: '명', empty: '태어난 해를 받은 구독자가 아직 없어요' }))}
    ${card('구독자', '성별 · 지역', ratio([['여성', gen.여, G], ['남성', gen.남, A], ['미입력', gen.기타, '#C9CEC8']]) + '<div style="height:16px"></div>' + hbars(regRows, { unit: '명' }))}
    ${card('오늘', '코너별 클릭', hbars(clickRows, { unit: '번', empty: '오늘은 아직 클릭이 없어요' }), true)}
  </div>`;
  wire(el);
}

// 선 그래프에 손가락·마우스를 대면 그날 숫자
function wire(el) {
  el.querySelectorAll('.ad-plot').forEach(p => {
    const D = JSON.parse(p.dataset.line), [W, L, R] = p.dataset.geo.split(',').map(Number), svg = p.querySelector('svg'), tip = p.querySelector('.ad-tip'), cr = p.querySelector('.ad-cross');
    const move = ev => {
      const r = svg.getBoundingClientRect(), cx = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * W / r.width;
      const i = Math.max(0, Math.min(D.days.length - 1, Math.round((cx - L) / ((W - L - R) / Math.max(1, D.days.length - 1)))));
      const xv = L + i * (W - L - R) / Math.max(1, D.days.length - 1);
      cr.setAttribute('x1', xv); cr.setAttribute('x2', xv); cr.setAttribute('opacity', '1');
      tip.hidden = false; tip.innerHTML = `<b>${md(D.days[i])}</b>` + D.series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)} ${n(s.vals[i])}</span>`).join('');
      const px = xv * r.width / W; tip.style.left = Math.min(Math.max(px, 60), r.width - 60) + 'px';
    };
    const out = () => { tip.hidden = true; cr.setAttribute('opacity', '0'); };
    p.addEventListener('mousemove', move); p.addEventListener('touchstart', move, { passive: true }); p.addEventListener('touchmove', move, { passive: true });
    p.addEventListener('mouseleave', out); p.addEventListener('touchend', () => setTimeout(out, 1500));
  });
}
