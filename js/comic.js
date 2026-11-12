// 연재 만화 '마음은 주니어' (대표 2026-11-12 — "옛날 스포츠 신문 연재 만화, 그거 보려고 신문 사 봤다. 내일이 궁금하게")
// 그림은 그림 AI 없이 이 파일이 SVG 로 그린다 — 인물을 한 번 정해 두고 표정·소품만 바꾸니 매일 같은 얼굴이 나온다.
// 주인공 오주니(56, 마음은 주니어) · 딸 오주아(29) · 친구 강 사장(57). 화면·글은 data/comic.json(날짜가 오늘 이하인 화만 열림).
// 같은 그림을 shorts·블로그용 그림으로도 뜬다(tools/comic_img.js 가 comic/<id>.html 을 찍는다).
export const W = 1000, H = 760;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const INK = '#2B2420', SKIN = '#F4D2B0', SKIN2 = '#E9BC97';
const BG = { cream: '#F6F0E4', mint: '#E1EEE6', sky: '#E0EAF4', peach: '#F8E3D5', lilac: '#ECE5F2', butter: '#FBF0CC', gray: '#E9E8E4', night: '#2E3448' };

// ── 얼굴 표정 (머리 중심 0,0 / 머리 반지름 약 80) ──
function eyes(ex, glasses) {
  const L = -30, R = 30, Y = -6;
  if (ex === 'smile' || ex === 'proud') return `<path d="M${L - 12} ${Y + 3} q12 -12 24 0 M${R - 12} ${Y + 3} q12 -12 24 0" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  if (ex === 'shock') return `<circle cx="${L}" cy="${Y}" r="13" fill="#fff" stroke="${INK}" stroke-width="3.5"/><circle cx="${R}" cy="${Y}" r="13" fill="#fff" stroke="${INK}" stroke-width="3.5"/><circle cx="${L}" cy="${Y}" r="4.5" fill="${INK}"/><circle cx="${R}" cy="${Y}" r="4.5" fill="${INK}"/>`;
  if (ex === 'blank' || ex === 'sad') return `<path d="M${L - 11} ${Y} h22 M${R - 11} ${Y} h22" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  if (ex === 'wink') return `<circle cx="${L}" cy="${Y}" r="5.5" fill="${INK}"/><path d="M${R - 11} ${Y + 2} q11 -9 22 0" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  return `<circle cx="${L}" cy="${Y}" r="5.5" fill="${INK}"/><circle cx="${R}" cy="${Y}" r="5.5" fill="${INK}"/>`;
}
function brows(ex) {
  const up = ex === 'shock' ? -14 : ex === 'sweat' || ex === 'sad' ? -4 : -8;
  if (ex === 'sweat' || ex === 'sad') return `<path d="M-44 ${-26 + up} l26 -6 M44 ${-26 + up} l-26 -6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  if (ex === 'angry') return `<path d="M-44 -38 l26 8 M44 -38 l-26 8" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  return `<path d="M-42 ${-30 + up} q12 -6 24 0 M18 ${-30 + up} q12 -6 24 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
}
function mouth(ex) {
  if (ex === 'smile') return `<path d="M-18 30 q18 18 36 0" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  if (ex === 'proud') return `<path d="M-24 26 q24 30 48 0 z" fill="#8C3B2E" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  if (ex === 'shock') return `<ellipse cx="0" cy="36" rx="12" ry="16" fill="#8C3B2E" stroke="${INK}" stroke-width="4"/>`;
  if (ex === 'sweat') return `<path d="M-18 36 q6 -7 12 0 t12 0 t12 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  if (ex === 'sad' || ex === 'blank') return `<path d="M-14 38 h28" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  if (ex === 'angry') return `<path d="M-16 40 q16 -12 32 0" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  if (ex === 'wink') return `<path d="M-16 30 q16 14 32 0" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  return `<path d="M-12 34 q12 6 24 0" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
}
function extra(ex) {
  let s = '';
  if (ex === 'sweat') s += `<path d="M62 -46 q10 16 0 24 q-10 -8 0 -24z" fill="#9CC8EA" stroke="${INK}" stroke-width="2.5"/>`;
  if (ex === 'sad' || ex === 'blank') s += `<path d="M-30 -66 v18 M-14 -70 v18 M2 -70 v18" stroke="#7A8AA8" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>`;
  if (ex === 'smile' || ex === 'proud' || ex === 'wink') s += `<ellipse cx="-46" cy="22" rx="12" ry="7" fill="#F0A08A" opacity=".55"/><ellipse cx="46" cy="22" rx="12" ry="7" fill="#F0A08A" opacity=".55"/>`;
  if (ex === 'shock') s += `<path d="M-96 -80 l14 14 M96 -80 l-14 14 M0 -112 v18" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  if (ex === 'angry') s += `<path d="M58 -78 l10 10 m-10 0 l10 -10" stroke="#C2362B" stroke-width="5" stroke-linecap="round"/>`;
  return s;
}

// ── 인물 (가슴 위, 바닥 중심 0,0 — 높이 약 430) ──
const WHO = {
  juni: { shirt: '#30405E', collar: '#FFFFFF', hair(f) { return `<path d="M-80 -18 q-6 -96 82 -100 q86 4 80 92 q-10 -40 -50 -54 q-30 20 -96 18 q-10 20 -16 44z" fill="#2E2925"/><path d="M-78 -8 q-4 -22 4 -34" stroke="#9A948C" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M78 -8 q4 -22 -4 -34" stroke="#9A948C" stroke-width="7" stroke-linecap="round" fill="none"/>`; }, glasses: true, name: '오주니' },
  jua: { shirt: '#D9A441', collar: '#F6E7C4', back: `<path d="M-100 96 q-26 -186 100 -192 q126 6 100 192 q-34 14 -64 -2 l-10 -40 h-52 l-10 40 q-30 16 -64 2z" fill="#3A2B24" stroke="${INK}" stroke-width="4"/>`,
    hair(f) { return `<path d="M-84 -20 q2 -74 84 -78 q82 4 84 78 q-30 -36 -60 -40 q-6 18 -30 20 q-10 -16 -20 -18 q-30 4 -58 38z" fill="#3A2B24"/>`; }, earring: true, name: '주아' },
  kang: { shirt: '#A5483E', collar: '#F0E2D6', check: true, hair(f) { return `<path d="M-82 -6 q0 -30 14 -46 q-6 26 2 40z M82 -6 q0 -30 -14 -46 q6 26 -2 40z" fill="#8F8A84"/><path d="M-30 -84 q30 -8 60 0" stroke="#C9A98C" stroke-width="3" fill="none" opacity=".6"/>`; }, stache: true, name: '강 사장' },
};
function person(who, ex = 'neutral', o = {}) {
  const P = WHO[who]; if (!P) return '';
  const hold = o.hold;   // 'phone' — 손에 휴대폰
  const body = `<path d="M-150 430 q0 -150 150 -158 q150 8 150 158z" fill="${P.shirt}" stroke="${INK}" stroke-width="4"/>` +
    (P.check ? `<path d="M-110 300 v130 M-60 286 v144 M0 282 v148 M60 286 v144 M110 300 v130 M-140 350 h280 M-148 400 h296" stroke="rgba(255,255,255,.22)" stroke-width="5"/>` : '') +
    `<path d="M-40 278 l40 44 l40 -44" fill="${P.collar}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
    (who === 'juni' ? `<path d="M0 322 v108" stroke="${INK}" stroke-width="3" opacity=".5"/><circle cx="0" cy="350" r="5" fill="${INK}" opacity=".5"/><circle cx="0" cy="392" r="5" fill="${INK}" opacity=".5"/>` : '');
  const neck = `<rect x="-26" y="230" width="52" height="56" rx="10" fill="${SKIN2}" stroke="${INK}" stroke-width="4"/>`;
  const head = `<g transform="translate(0 150)">${P.back || ''}
      <ellipse cx="-84" cy="8" rx="14" ry="20" fill="${SKIN}" stroke="${INK}" stroke-width="4"/><ellipse cx="84" cy="8" rx="14" ry="20" fill="${SKIN}" stroke="${INK}" stroke-width="4"/>
      ${P.earring ? `<circle cx="-86" cy="34" r="6" fill="#E8C35A" stroke="${INK}" stroke-width="2"/><circle cx="86" cy="34" r="6" fill="#E8C35A" stroke="${INK}" stroke-width="2"/>` : ''}
      <ellipse cx="0" cy="0" rx="82" ry="92" fill="${SKIN}" stroke="${INK}" stroke-width="4"/>
      ${P.hair()}
      ${brows(ex)}${eyes(ex)}
      ${P.glasses ? `<g fill="none" stroke="${INK}" stroke-width="4"><circle cx="-30" cy="-6" r="22"/><circle cx="30" cy="-6" r="22"/><path d="M-8 -8 q8 -6 16 0 M-52 -10 l-28 -6 M52 -10 l28 -6"/></g>` : ''}
      <path d="M-4 6 q-8 16 2 18" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
      ${P.stache ? `<path d="M-30 22 q15 -12 30 0 q15 -12 30 0 q-14 12 -30 4 q-16 8 -30 -4z" fill="#6E655D" stroke="${INK}" stroke-width="2.5"/>` : ''}
      ${mouth(ex)}${extra(ex)}
    </g>`;
  const arm = hold === 'phone' ? `<path d="M110 330 q30 -40 -10 -90" fill="none" stroke="${P.shirt}" stroke-width="44" stroke-linecap="round"/><path d="M110 330 q30 -40 -10 -90" fill="none" stroke="${INK}" stroke-width="4" opacity=".0"/>
      <g transform="translate(72 196) rotate(-12)"><rect x="-28" y="-50" width="56" height="100" rx="10" fill="#1E2228" stroke="${INK}" stroke-width="4"/><rect x="-22" y="-42" width="44" height="78" rx="4" fill="#9FD0E8"/></g>
      <circle cx="96" cy="250" r="22" fill="${SKIN}" stroke="${INK}" stroke-width="4"/>` : '';
  const s = o.s || 1.22, flip = o.flip ? -1 : 1;
  return `<g transform="translate(${o.x || 0} ${o.y || H}) scale(${s * flip} ${s}) translate(0 -430)">${body}${neck}${head}${arm}</g>`;
}

// ── 소품 ──
const PROP = {
  kiosk: o => `<g transform="translate(${o.x} ${o.y || 140})"><rect x="0" y="0" width="230" height="560" rx="18" fill="#3B3F46" stroke="${INK}" stroke-width="5"/><rect x="18" y="22" width="194" height="300" rx="8" fill="#F7F7F2"/>
    <rect x="34" y="40" width="162" height="34" rx="6" fill="#E25B45"/>${[0, 1, 2].map(r => [0, 1].map(c => `<rect x="${34 + c * 84}" y="${90 + r * 74}" width="78" height="62" rx="8" fill="#E4E2DA"/>`).join('')).join('')}
    <rect x="70" y="350" width="90" height="16" rx="4" fill="#1D1F23"/><rect x="40" y="400" width="150" height="110" rx="10" fill="#4A4F57"/></g>`,
  speaker: o => `<g transform="translate(${o.x} ${o.y || 520})"><rect x="-60" y="-110" width="120" height="150" rx="56" fill="#E8E4DC" stroke="${INK}" stroke-width="5"/><ellipse cx="0" cy="-108" rx="58" ry="14" fill="${o.on ? '#5BC0EB' : '#CFCAC0'}" stroke="${INK}" stroke-width="4"/>
    <rect x="-90" y="40" width="180" height="22" rx="6" fill="#B89B74" stroke="${INK}" stroke-width="4"/></g>`,
  table: o => `<rect x="${o.x || 0}" y="${o.y || 640}" width="${o.w || W}" height="140" fill="#C9A47E" stroke="${INK}" stroke-width="5"/>`,
  window: o => `<g transform="translate(${o.x} ${o.y || 70})"><rect width="260" height="230" rx="6" fill="#CFE6F2" stroke="${INK}" stroke-width="5"/><path d="M130 0 v230 M0 115 h260" stroke="${INK}" stroke-width="5"/></g>`,
  queue: o => `<g fill="#B9B4AA" opacity=".85">${[0, 1, 2, 3].map(i => `<g transform="translate(${(o.x || 0) + i * 70} ${(o.y || 330) - (i % 2) * 10})"><circle cx="0" cy="0" r="34"/><path d="M-50 160 q0 -110 50 -116 q50 6 50 116z"/></g>`).join('')}</g>`,
  car: o => `<g transform="translate(${o.x} ${o.y || 470})"><path d="M0 140 q0 -60 60 -70 l70 -60 q20 -14 60 -14 h150 q40 0 64 22 l60 56 q70 6 76 66 v20 h-540z" fill="#F2F2EE" stroke="${INK}" stroke-width="5"/><path d="M150 18 h80 v58 h-130z M250 18 h96 q22 0 40 18 l40 40 h-176z" fill="#9FC7DD" stroke="${INK}" stroke-width="4"/>
    <circle cx="110" cy="160" r="44" fill="#2A2C30" stroke="${INK}" stroke-width="5"/><circle cx="110" cy="160" r="16" fill="#A6A6A2"/><circle cx="410" cy="160" r="44" fill="#2A2C30" stroke="${INK}" stroke-width="5"/><circle cx="410" cy="160" r="16" fill="#A6A6A2"/>
    <path d="M490 78 h22" stroke="#5BC0EB" stroke-width="10" stroke-linecap="round"/></g>`,
  charger: o => `<g transform="translate(${o.x} ${o.y || 300})"><rect x="0" y="0" width="110" height="330" rx="14" fill="#2F7D5B" stroke="${INK}" stroke-width="5"/><rect x="18" y="26" width="74" height="70" rx="6" fill="#DFF3E8"/><path d="M38 70 l14 -26 v18 h14 l-14 26 v-18z" fill="#2F7D5B"/>
    <path d="M110 200 q${o.reach || 120} 40 ${o.reach || 120} ${o.drop || 120}" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/></g>`,
  suitcase: o => `<g transform="translate(${o.x} ${o.y || 470})"><rect x="0" y="0" width="150" height="200" rx="18" fill="#D9653B" stroke="${INK}" stroke-width="5"/><path d="M50 0 v-34 h50 v34" fill="none" stroke="${INK}" stroke-width="6"/><path d="M40 20 v160 M110 20 v160" stroke="${INK}" stroke-width="4" opacity=".4"/></g>`,
  bigphone: o => `<g transform="translate(${o.x} ${o.y || 90})"><rect width="330" height="600" rx="40" fill="#1E2228" stroke="${INK}" stroke-width="5"/><rect x="18" y="40" width="294" height="520" rx="14" fill="${o.screen || '#F3F1EC'}"/>${o.inner || ''}</g>`,
  // 휴대폰 속 단톡방 — o.lines [{me, t, who}] · o.title
  chat: o => { let y = 150; const rows = (o.lines || []).map(l => { const n = 8, ls = wrap(l.t, n), h = ls.length * 40 + 24, w = Math.min(282, Math.max(...ls.map(z => z.length)) * 33 + 30), x = l.me ? 304 - w : 26;
      const r = `${l.who && !l.me ? `<text x="30" y="${y - 6}" font-size="20" font-weight="700" font-family="Noto Sans KR, sans-serif" fill="#55606A">${esc(l.who)}</text>` : ''}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${l.me ? '#FEE500' : '#FFFFFF'}" stroke="${INK}" stroke-width="2"/>` +
        (l.emoji ? '' : ls.map((z, i) => `<text x="${x + 15}" y="${y + 40 + i * 40}" font-size="31" font-weight="700" font-family="Noto Sans KR, sans-serif" fill="${INK}">${esc(z)}</text>`).join('')) +
        (l.emoji ? `<g transform="translate(${x + w / 2} ${y + h / 2})"><circle r="${h / 2 - 8}" fill="#FFD84D" stroke="${INK}" stroke-width="3"/><path d="M-20 -6 h12 M8 -6 h12" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M-16 0 v26 M16 0 v26" stroke="#5BB2E8" stroke-width="7" stroke-linecap="round"/><path d="M-12 20 q12 -10 24 0" fill="none" stroke="${INK}" stroke-width="4"/></g>` : '');
      y += h + (l.who && !l.me ? 46 : 24); return r; }).join('');
    return PROP.bigphone({ x: o.x, y: o.y, screen: '#B9D0E2', inner: `<rect x="18" y="40" width="294" height="64" fill="#A9C2D6"/><text x="165" y="82" text-anchor="middle" font-size="24" font-weight="800" font-family="Noto Sans KR, sans-serif" fill="${INK}">${esc(o.title || '단톡방')}</text>${rows}` }); },
  // 보정 앱 속 내 얼굴 — 반짝이
  selfie: o => PROP.bigphone({ x: o.x, y: o.y, screen: '#F7E9EF', inner: `<g transform="translate(165 560) scale(.62)">${person('juni', 'proud').replace(/^<g transform="[^"]*"/, '<g transform="translate(0 -430)"')}</g>${[[60, 120], [270, 170], [90, 330], [250, 380]].map(([a, b]) => `<path d="M${a} ${b - 16} l5 11 l11 5 l-11 5 l-5 11 l-5 -11 l-11 -5 l11 -5z" fill="#F2B84B"/>`).join('')}<rect x="18" y="470" width="294" height="90" fill="rgba(255,255,255,.85)"/><text x="165" y="526" text-anchor="middle" font-size="26" font-weight="800" font-family="Noto Sans KR, sans-serif" fill="#C2507A">뽀샤시 100%</text>` }),
  // 주식 그래프 휴대폰 — o.trend 'down' | 'up', o.label
  chart: o => { const down = o.trend === 'down', c = down ? '#2F6FD6' : '#D8382E', pts = down ? '40,180 90,160 140,200 190,240 240,300 290,380' : '40,380 90,350 140,300 190,250 240,190 290,120';
    return PROP.bigphone({ x: o.x, y: o.y, screen: '#FFFFFF', inner: `<text x="40" y="110" font-size="30" font-weight="800" font-family="Noto Sans KR, sans-serif" fill="${INK}">${esc(o.label || '내 종목')}</text><text x="40" y="150" font-size="36" font-weight="900" font-family="Noto Sans KR, sans-serif" fill="${c}">${down ? '▼ -12.4%' : '▲ +31.2%'}</text>
      <polyline points="${pts}" fill="none" stroke="${c}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" transform="translate(0 120)"/><line x1="40" y1="530" x2="290" y2="530" stroke="#DDD" stroke-width="3"/>` }); },
  // 접시 위 치킨
  food: o => `<g transform="translate(${o.x} ${o.y || 600})"><ellipse cx="0" cy="40" rx="190" ry="44" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>${[-90, -20, 50].map((d, i) => `<g transform="translate(${d} ${-4 - i % 2 * 12}) rotate(${-20 + i * 18})"><ellipse cx="0" cy="0" rx="52" ry="36" fill="#D9842C" stroke="${INK}" stroke-width="4"/><rect x="40" y="-9" width="40" height="18" rx="8" fill="#F6EEDC" stroke="${INK}" stroke-width="3.5"/></g>`).join('')}
    ${o.steam ? `<path d="M-60 -70 q-14 -24 0 -48 M0 -80 q-14 -24 0 -48 M60 -70 q-14 -24 0 -48" fill="none" stroke="#B8B2A6" stroke-width="5" stroke-linecap="round"/>` : ''}</g>`,
  dumbbell: o => `<g transform="translate(${o.x} ${o.y || 640}) rotate(${o.r || 0})"><rect x="-90" y="-8" width="180" height="16" rx="6" fill="#8E949C" stroke="${INK}" stroke-width="4"/><rect x="-120" y="-38" width="36" height="76" rx="8" fill="#3B3F46" stroke="${INK}" stroke-width="4"/><rect x="84" y="-38" width="36" height="76" rx="8" fill="#3B3F46" stroke="${INK}" stroke-width="4"/></g>`,
  cam: o => `<g transform="translate(${o.x} ${o.y || 300})"><rect x="-70" y="-44" width="140" height="88" rx="14" fill="#2B2E33" stroke="${INK}" stroke-width="4"/><circle cx="0" cy="0" r="28" fill="#5C6670" stroke="#FFFFFF" stroke-width="5"/><path d="M-40 -60 l20 -20 M40 -60 l-20 -20 M0 -64 v-26" stroke="#F2B84B" stroke-width="5" stroke-linecap="round"/></g>`,
  zzz: o => `<g fill="${INK}" font-family="Noto Sans KR, sans-serif" font-weight="800"><text x="${o.x}" y="${o.y}" font-size="54">Z</text><text x="${o.x + 40}" y="${o.y - 40}" font-size="40">z</text><text x="${o.x + 70}" y="${o.y - 70}" font-size="30">z</text></g>`,
  notes: o => `<g fill="${INK}" font-size="56" font-family="serif"><text x="${o.x}" y="${o.y}">♪</text><text x="${o.x + 60}" y="${o.y - 40}">♫</text></g>`,
  boom: o => `<g transform="translate(${o.x} ${o.y})"><path d="M0 -70 l18 44 l46 -20 l-22 42 l48 16 l-48 16 l22 42 l-46 -20 l-18 44 l-18 -44 l-46 20 l22 -42 l-48 -16 l48 -16 l-22 -42 l46 20z" fill="#FFE27A" stroke="${INK}" stroke-width="4"/><text x="0" y="12" text-anchor="middle" font-size="34" font-weight="900" font-family="Noto Sans KR, sans-serif" fill="${INK}">${esc(o.t || '!')}</text></g>`,
  sign: o => `<g transform="translate(${o.x} ${o.y})"><rect x="${-(o.w || 300) / 2}" y="-44" width="${o.w || 300}" height="76" rx="10" fill="${o.fill || '#FFFFFF'}" stroke="${INK}" stroke-width="4"/><text x="0" y="6" text-anchor="middle" font-size="${o.fs || 34}" font-weight="800" font-family="Noto Sans KR, sans-serif" fill="${o.color || INK}">${esc(o.t)}</text></g>`,
};

// ── 말풍선 — 글자 수로 줄을 나눈다(한글은 거의 같은 폭) ──
function wrap(t, n) { const out = []; String(t).split('\n').forEach(seg => { let s = seg; while (s.length > n) { let k = s.lastIndexOf(' ', n); if (k < n * 0.3) k = n; out.push(s.slice(0, k).trim()); s = s.slice(k).trim(); } out.push(s); }); return out; }
function bubble(b) {
  const fs = b.fs || 42, n = b.n || 10, lines = wrap(b.t, n), lh = fs * 1.32;
  const w = Math.max(...lines.map(l => l.length)) * fs * 0.98 + 56, h = lines.length * lh + 36;
  const x = Math.max(16, Math.min(W - w - 16, b.x - w / 2)), y = b.y;
  const tx = b.tx == null ? b.x : b.tx, ty = b.ty == null ? y + h + 40 : b.ty;
  const cx = Math.max(x + 30, Math.min(x + w - 30, tx));
  const think = b.think, shout = b.shout;
  let tail = '';
  if (think) tail = `<circle cx="${(cx + tx) / 2}" cy="${y + h + 18}" r="10" fill="#fff" stroke="${INK}" stroke-width="3.5"/><circle cx="${tx}" cy="${y + h + 40}" r="6" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
  else if (b.tx !== false) tail = `<path d="M${cx - 18} ${ty > y ? y + h - 2 : y + 2} L${tx} ${ty} L${cx + 18} ${ty > y ? y + h - 2 : y + 2}" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M${cx - 15} ${ty > y ? y + h - 3 : y + 3} h30" stroke="#fff" stroke-width="7"/>`;
  const box = shout ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#fff" stroke="${INK}" stroke-width="5" stroke-dasharray="0"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${think ? h / 2 : 26}" fill="#fff" stroke="${INK}" stroke-width="4"/>`;
  const txt = lines.map((l, i) => `<text x="${x + w / 2}" y="${y + 18 + fs + i * lh - fs * 0.12}" text-anchor="middle" font-size="${fs}" font-weight="${shout ? 900 : 700}" font-family="Noto Sans KR, sans-serif" fill="${INK}">${esc(l)}</text>`).join('');
  return tail.startsWith('<circle') ? box + tail + txt : tail + box + txt;
}

export function panel(p, i = 0) {
  const bg = BG[p.bg] || p.bg || BG.cream;
  const props = (p.props || []).map(o => (PROP[o.k] || (() => ''))(o)).join('');
  const ppl = (p.chars || []).map(c => person(c.who, c.ex, c)).join('');
  const front = (p.front || []).map(o => (PROP[o.k] || (() => ''))(o)).join('');
  const says = (p.say || []).map(b => bubble(p.cap && b.y < 92 ? Object.assign({}, b, { y: 92 }) : b)).join('');   // 장면 이름표(위 왼쪽)와 겹치지 않게
  const cap = p.cap ? `<g><rect x="18" y="18" width="${p.cap.length * 30 + 40}" height="56" fill="#FFF8D9" stroke="${INK}" stroke-width="3"/><text x="38" y="56" font-size="28" font-weight="700" font-family="Noto Sans KR, sans-serif" fill="${INK}">${esc(p.cap)}</text></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc((p.say || []).map(s => s.t).join(' '))}">
    <defs><clipPath id="cp${i}"><rect width="${W}" height="${H}" rx="8"/></clipPath></defs>
    <g clip-path="url(#cp${i})"><rect width="${W}" height="${H}" fill="${bg}"/>${p.floor !== false ? `<rect y="${H - 70}" width="${W}" height="70" fill="rgba(0,0,0,.05)"/>` : ''}${props}${ppl}${front}${says}${cap}</g>
    <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="8" fill="none" stroke="${INK}" stroke-width="5"/></svg>`;
}

// ── 화면 (#comic 안쪽, 첫 화면 칸) ──
let DATA = null;
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export async function load() { if (DATA) return DATA; try { DATA = await (await fetch('data/comic.json?v=' + today())).json(); } catch (e) { DATA = { items: [] }; } return DATA; }
const opened = () => (DATA.items || []).filter(x => x.date <= today()).sort((a, b) => b.no - a.no);
export const latest = () => opened()[0] || null;
const nextOf = a => (DATA.items || []).filter(x => x.no === a.no + 1)[0] || null;

export function strip(a) { return a.panels.map((p, i) => `<div class="cm-p">${panel(p, i)}</div>`).join(''); }

// 첫 화면 칸: 오늘 화 첫 컷 + 제목
export async function tile() {
  const el = document.getElementById('comic-home'); if (!el) return;
  await load(); const a = latest(); if (!a) { el.hidden = true; return; }
  el.querySelector('.cm-th').innerHTML = panel(a.panels[0], 90);
  el.querySelector('.cm-tt').textContent = `${a.no}화 · ${a.title}`;
  if (a.date === today() && !el.querySelector('.ct-new')) { const b = document.createElement('i'); b.className = 'ct-new'; b.textContent = 'NEW'; el.querySelector('.cm-hero').appendChild(b); }
}

export async function render(el, deps, id) {
  if (!el) return; await load();
  const L = opened(); if (!L.length) { el.innerHTML = '<p class="note">첫 화를 준비하고 있어요.</p>'; return; }
  const a = L.find(x => x.id === id) || L[0], nx = nextOf(a), isLast = a === L[0];
  const t = document.getElementById('d-title'); if (t && document.body.classList.contains('in-detail')) t.textContent = `${a.no}화 · ${a.title}`;
  el.innerHTML = `<div class="cm-wrap"><p class="cm-meta">매일 아침 한 화씩 · ${esc(a.date.slice(5).replace('-', '월 ').replace(/^0/, ''))}일</p>
    <div class="cm-strip">${strip(a)}</div>
    ${isLast && a.next ? `<div class="ev-soon"><small>내일 아침 공개 · ${a.no + 1}화</small><b>${esc(a.next)}</b></div>` : nx && nx.date <= today() ? `<button type="button" class="btn cm-go" data-cm="${esc(nx.id)}">${nx.no}화 이어 보기 ›</button>` : ''}
    <div class="cm-act"><button type="button" class="btn anb-kakao" id="cm-send">카톡으로 보내기</button></div>
    <p class="cm-cast">등장인물 · <b>오주니</b>(마음만은 주니어인 아빠) · <b>주아</b>(딸) · <b>강 사장</b>(주니의 오랜 친구)</p>
    <div class="pet-past"><p class="is-sub">지난 화</p>${L.map(x => `<button type="button" data-cm="${esc(x.id)}" aria-current="${x === a}"><span>${x.no}화. ${esc(x.title)}</span><small>${esc(x.date.slice(5).replace('-', '.'))}</small></button>`).join('')}</div></div>`;
  el.querySelectorAll('[data-cm]').forEach(b => b.onclick = () => { render(el, deps, b.dataset.cm); window.scrollTo({ top: 0 }); });
  try { deps && deps.DB && deps.DB.bumpClick('comic'); } catch (e) {}
  el.querySelector('#cm-send').onclick = () => send(a, deps);
}

// 네 컷을 한 장 그림으로 (카톡 보내기)
async function toImage(a) {
  const S = 0.9, w = Math.round(W * S), h = Math.round(H * S), gap = 18, top = 120, foot = 70;
  const cv = document.createElement('canvas'); cv.width = w + 60; cv.height = top + a.panels.length * (h + gap) + foot;
  const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
  x.fillStyle = '#2B2420'; x.textAlign = 'left'; x.font = '800 44px "Noto Sans KR", sans-serif'; x.fillText(`${a.no}화 · ${a.title}`, 30, 74);
  for (let i = 0; i < a.panels.length; i++) {
    const svg = panel(a.panels[i], 200 + i); const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const im = await new Promise(r => { const m = new Image(); m.onload = () => r(m); m.onerror = () => r(null); m.src = url; });
    if (im) x.drawImage(im, 30, top + i * (h + gap), w, h);
  }
  x.font = '500 26px "Noto Sans KR", sans-serif'; x.fillStyle = 'rgba(60,55,45,.6)'; x.textAlign = 'right'; x.fillText('연재 만화 마음은 주니어 · 오마주 매거진', cv.width - 30, cv.height - 26);
  return new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
}
async function send(a, deps) {
  const b = document.getElementById('cm-send'); b.disabled = true; b.textContent = '그림 만드는 중…';
  try {
    const blob = await toImage(a), file = new File([blob], `오마주매거진_마음은주니어_${a.no}화.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `마음은 주니어 ${a.no}화 · ${a.title}` }); } catch (e) {} }
    else if (deps && deps.kakaoSendCard && await deps.kakaoSendCard(file)) {}
    else { const u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = file.name; l.click(); deps && deps.toast && deps.toast('사진에 저장했어요. 카톡에서 사진으로 보내 주세요.'); }
  } catch (e) { deps && deps.toast && deps.toast('그림을 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.'); }
  b.disabled = false; b.textContent = '카톡으로 보내기';
}
