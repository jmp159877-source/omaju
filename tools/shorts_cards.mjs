// 쇼츠용 인사 카드 그림 — 사이트와 똑같은 js/cards.js 로 그린다 (대표 2026-10-23: 유튜브 쇼츠).
// 깃허브 작업(shorts.yml)에서만 돈다. 저장소 맨 위를 작은 웹 서버로 띄우고, 그 자리에 임시 페이지를 두어
// cards.js 가 쓰는 img/logo.png 같은 상대 주소가 그대로 맞게 한다. 글꼴은 사이트와 같은 구글 글꼴.
// 쓰는 법: node tools/shorts_cards.mjs YYYY-MM-DD 출력폴더
import fs from 'fs';
import path from 'path';
import http from 'http';
import puppeteer from 'puppeteer-core';

const [date, out] = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const daily = JSON.parse(fs.readFileSync(path.join(root, 'daily', date + '.json'), 'utf8'));
const G = daily.greetings || [];
if (!G.length) { console.log('인사 카드 없음'); process.exit(0); }
fs.mkdirSync(out, { recursive: true });

const page = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Sans+KR:wght@300;400;500;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap">
<body><script type="module">
import { drawCard } from './js/cards.js';
window.make = async (G, o) => {
  await document.fonts.load('800 80px "Nanum Myeongjo"', G.join('') + '오마주');
  await document.fonts.load('italic 500 46px "Cormorant Garamond"', 'Omaju');
  await document.fonts.load('400 34px "Noto Sans KR"', o.dateText + '네이버에서 “오마주 매거진”');
  const r = [];
  for (let i = 0; i < G.length; i++) r.push((await drawCard(G[i], i, { dateText: o.dateText, variant: o.vv[i], season: o.season })).toDataURL('image/png'));
  return r;
};
window.ready = true;
</script>`;
fs.writeFileSync(path.join(root, '_shorts.html'), page);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };
const srv = http.createServer((q, s) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(b); });
}).listen(8765);

const [Y, M1, D] = date.split('-').map(Number), M = M1 - 1;
const dow = '일월화수목금토'[new Date(Date.UTC(Y, M, D)).getUTCDay()];
const season = M < 2 || M === 11 ? 'winter' : M < 5 ? 'spring' : M < 8 ? 'summer' : 'autumn';
const n = Math.floor(Date.UTC(Y, M, D) / 864e5);
const vv = G.map((_, i) => ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'][(n * 4 + i) % 6]);   // 사이트(app.js cardVar)·관리자 블로그 탭과 같은 셈

const exe = process.env.CHROME || '/usr/bin/google-chrome';
const br = await puppeteer.launch({ executablePath: exe, args: ['--no-sandbox'] });
try {
  const p = await br.newPage();
  await p.goto('http://localhost:8765/_shorts.html', { waitUntil: 'networkidle0' });
  await p.waitForFunction('window.ready === true');
  const urls = await p.evaluate((G, o) => window.make(G, o), G, { dateText: `${M + 1}월 ${D}일 · ${dow}요일`, vv, season });
  urls.forEach((u, i) => fs.writeFileSync(path.join(out, `card${i + 1}.png`), Buffer.from(u.split(',')[1], 'base64')));
  console.log('카드', urls.length, '장');
} finally { await br.close(); srv.close(); fs.rmSync(path.join(root, '_shorts.html'), { force: true }); }
