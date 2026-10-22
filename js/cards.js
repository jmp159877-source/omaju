// 오늘의 인사 카드 — 고급 문구점 편지지 6가지. 화면 카드와 같은 모양으로 보내기용 그림(1080×1350)을 그린다.
// v1 아이보리 금테 · v2 리넨+금 고리 · v3 크라프트+낙관 · v4 한지+먹 · v5 새벽 하늘 · v6 계절 수채
// 그림이 늦게 와도 4초 넘게 붙잡지 않는다 — 없으면 없는 대로 그린다 (운영자 2026-10-22)
function load(src) { return new Promise(r => { const im = new Image(); const done = v => r(v); im.onload = () => done(im); im.onerror = () => done(null); setTimeout(() => done(null), 4000); im.src = src; }); }

const STYLE = {
  v1: { bg: '#FBF8F1', ink: '#2E2618', date: '#A88B55', brand: '#8A7A5A', rule: '#C9A24A', border: 'rgba(176,141,74,0.55)' },   // 잎 장식 뺌 — 아래 로고와 같은 가지 (운영자 2026-10-22)
  v2: { bg: '#EFEAE1', ink: '#3A3328', date: '#9A8A6E', brand: '#857559', rule: '#C9A24A', orn: 'foil', grain: 'linen' },
  v3: { bg: '#D9C3A0', ink: '#3B2B18', date: '#7A5F3A', brand: '#6E5534', rule: '#7A5F3A', grain: 'kraft' },   // 낙관 뺌 — 로고와 서명이 겹쳤다 (운영자 2026-10-22)
  v4: { bg: '#F7F3EA', ink: '#1E1B17', date: '#8C8070', brand: '#6E655A', grain: 'hanji', brush: true },
  v5: { bg: 'sky', ink: '#2A3440', date: '#6F8293', brand: '#6F8293', rule: '#9FB2C2', border: 'rgba(255,255,255,0.95)' },
  v6: { bg: '#FCFAF6', ink: '#3A2E2A', date: '#B08A7A', brand: '#9A7A6A', rule: '#D6A79A', wc: true },
};

// 종이 결 (아주 옅게)
function grain(x, W, H, kind) {
  const r = (a, b) => a + Math.random() * (b - a);
  if (kind === 'kraft') { for (let k = 0; k < 9000; k++) { x.fillStyle = `rgba(90,62,30,${r(0.02, 0.10)})`; x.fillRect(r(0, W), r(0, H), r(1, 2.4), r(1, 2.4)); } return; }
  if (kind === 'linen') {
    for (let y = 0; y < H; y += 3) { x.fillStyle = `rgba(120,100,70,${r(0.015, 0.05)})`; x.fillRect(0, y, W, 1); }
    for (let xx = 0; xx < W; xx += 3) { x.fillStyle = `rgba(120,100,70,${r(0.01, 0.035)})`; x.fillRect(xx, 0, 1, H); }
    return;
  }
  if (kind === 'hanji') { for (let k = 0; k < 700; k++) { x.strokeStyle = `rgba(120,105,80,${r(0.03, 0.09)})`; x.lineWidth = r(0.6, 1.6); const sx = r(0, W), sy = r(0, H), len = r(30, 140); x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo(sx + len / 2, sy + r(-8, 8), sx + len, sy + r(-4, 4)); x.stroke(); } return; }
  for (let k = 0; k < 2600; k++) { x.fillStyle = `rgba(120,95,50,${Math.random() * 0.035})`; x.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4); }
}

function roundRect(x, X, Y, w, h, rr) { x.beginPath(); x.moveTo(X + rr, Y); x.arcTo(X + w, Y, X + w, Y + h, rr); x.arcTo(X + w, Y + h, X, Y + h, rr); x.arcTo(X, Y + h, X, Y, rr); x.arcTo(X, Y, X + w, Y, rr); x.closePath(); }

export async function drawCard(text, i, { dateText = '', variant = 'v1', season = 'autumn' } = {}) {
  const S = STYLE[variant] || STYLE.v1;
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  // 바탕
  if (S.bg === 'sky') { const g = x.createLinearGradient(W * 0.4, 0, W * 0.6, H); g.addColorStop(0, '#DCE7EE'); g.addColorStop(0.55, '#EEF1EE'); g.addColorStop(1, '#F7EFE3'); x.fillStyle = g; } else x.fillStyle = S.bg;
  x.fillRect(0, 0, W, H);
  grain(x, W, H, S.grain);
  const [leaf, wc, logo] = await Promise.all([S.orn === 'leaf' ? load('leaf.png') : null, S.wc ? load(`img/wc/${season}.jpg`) : null, load('img/logo.png')]);
  if (wc) { const w = W * 0.74, h = w * wc.height / wc.width; x.drawImage(wc, W - w, 0, w, h); }
  if (S.border) { x.strokeStyle = S.border; x.lineWidth = 2.4; roundRect(x, 34, 34, W - 68, H - 68, 14); x.stroke(); }
  const lines = String(text).split('\n');
  // 글꼴이 늦게 와도 3초 넘게 붙잡지 않는다 — 처음 누른 분이 멈춘 줄 알고 또 누른다 (운영자 2026-10-22)
  try {
    await Promise.race([
      Promise.all([document.fonts.load('800 80px "Nanum Myeongjo"', text + '오마주'), document.fonts.load('italic 500 46px "Cormorant Garamond"', 'Omaju'), document.fonts.load('400 34px "Noto Sans KR"', dateText + '매일 아침 5분')]),
      new Promise(r => setTimeout(r, 3000)),
    ]);
  } catch (e) {}
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  // 날짜 (수채 카드는 그림을 피해 왼쪽 위 두 줄)
  x.fillStyle = S.date; x.font = '400 34px "Noto Sans KR", sans-serif';
  if ('letterSpacing' in x) x.letterSpacing = '5px';
  if (S.wc) { x.textAlign = 'left'; const [a, b] = dateText.split(' · '); x.fillText(a || dateText, 92, 130); if (b) x.fillText(b, 92, 186); x.textAlign = 'center'; }
  else x.fillText(dateText, W / 2, 132);
  if ('letterSpacing' in x) x.letterSpacing = '0px';
  // 인사말 (가운데)
  let fs = 80; x.font = `800 ${fs}px "Nanum Myeongjo", serif`;
  while (fs > 52 && Math.max(...lines.map(l => x.measureText(l).width)) > W - 220) { fs -= 4; x.font = `800 ${fs}px "Nanum Myeongjo", serif`; }
  // 아래 로고가 자리를 꽤 차지하므로 글을 조금 올려 위아래 여백을 맞춘다 (운영자 2026-10-22)
  const lh = fs * 1.72, top = H / 2 - (lh * lines.length) / 2 + fs * 0.75 - 56;
  const ornY = top - fs - 40;
  if (leaf) { const lw = 170, lhh = lw * leaf.height / leaf.width; x.globalAlpha = 0.92; x.drawImage(leaf, W / 2 - lw / 2, ornY - lhh, lw, lhh); x.globalAlpha = 1; }
  if (S.orn === 'foil') { x.strokeStyle = '#C2A05A'; x.lineWidth = 4; x.beginPath(); x.arc(W / 2, ornY - 36, 34, 0, Math.PI * 2); x.stroke(); x.strokeStyle = 'rgba(194,160,90,0.55)'; x.lineWidth = 2.5; x.beginPath(); x.arc(W / 2, ornY - 36, 46, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = S.ink; x.font = `800 ${fs}px "Nanum Myeongjo", serif`;
  lines.forEach((l, k) => x.fillText(l, W / 2, top + k * lh));
  const after = top + (lines.length - 1) * lh + 66;
  if (S.brush) { x.fillStyle = 'rgba(34,30,25,0.85)'; x.beginPath(); const bx = W / 2 - 115, by = after + 10; x.moveTo(bx, by + 10); x.bezierCurveTo(bx + 60, by - 4, bx + 140, by - 6, bx + 230, by + 2); x.bezierCurveTo(bx + 150, by + 12, bx + 70, by + 16, bx + 4, by + 16); x.closePath(); x.fill(); }
  else if (S.rule) { x.fillStyle = S.rule; x.fillRect(W / 2 - 40, after, 80, 2.5); }
  // 낙관
  if (S.seal) { x.save(); x.translate(W - 150, H - 230); x.rotate(-0.05); x.fillStyle = 'rgba(181,50,42,0.92)'; roundRect(x, 0, 0, 62, 170, 6); x.fill(); x.fillStyle = '#F6E7D8'; x.font = '800 40px "Nanum Myeongjo", serif'; x.textAlign = 'center'; ['오', '마', '주'].forEach((c, k) => x.fillText(c, 31, 50 + k * 48)); x.restore(); }
  // 아래: 로고 · omaju.kr  (운영자 2026-10-22 — 모든 카드에 같은 로고)
  x.textAlign = 'center';
  if (logo) { const lw = 235, lh2 = lw * logo.height / logo.width; x.drawImage(logo, W / 2 - lw / 2, H - 112 - lh2, lw, lh2); }
  else { x.fillStyle = S.brand; x.font = 'italic 500 46px "Cormorant Garamond", serif'; x.fillText('Omaju', W / 2, H - 118); }
  x.fillStyle = S.brand; x.font = '400 26px "Noto Sans KR", sans-serif'; x.globalAlpha = 0.8; x.fillText('매일 아침 5분 · omaju.kr', W / 2, H - 76); x.globalAlpha = 1;
  return cv;
}
