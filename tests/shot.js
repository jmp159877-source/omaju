// 휴대폰 시안 찍기 — 보통 글씨와 큰 글씨(24px) 두 장씩. 올리기 전에 눈으로 보려고 쓴다.
//   NODE_PATH=$(npm root -g) node tests/shot.js phrase:tour phrase:free hike
// 화면 이름 뒤에 ':칸' 을 붙이면 그 칸(탭)을 눌러 놓고 찍는다. 사진은 /tmp/shot/ 에 나온다.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), STUB = path.join(__dirname, 'stub');
const OUT = process.env.SHOT_OUT || '/tmp/shot';
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' };
const fsStub = (() => { const s = fs.readFileSync(path.join(STUB, 'firestore.js'), 'utf8'), i = s.indexOf('const key='); return i < 0 ? s : s; })();
const args = process.argv.slice(2);
const WANT = (args.length ? args : ['phrase:tour', 'phrase:free', 'phrase:golf', 'hike']).map(a => a.split(':'));
// 띠 사진은 trip-photos 가지에 있다 — 받아 둔 것이 있으면 그것으로 보여 준다
const LOCAL = process.env.TRIP_DIR || '/tmp/tp2';

fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
});
srv.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch({ executablePath: exe });
  for (const big of [false, true]) {
    const PC = process.env.PC === '1';   // PC=1 이면 데스크톱 화면으로 찍는다 (운영자 2026-10-20)
    const c = await b.newContext({ viewport: PC ? { width: 1440, height: 900 } : { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', deviceScaleFactor: PC ? 1 : 2 });
    await c.route('https://www.gstatic.com/**', r => { const u = r.request().url(); const n = u.includes('firebase-app') ? 'app' : u.includes('firebase-auth') ? 'auth' : u.includes('firestore') ? 'firestore' : 'analytics'; r.fulfill({ contentType: 'application/javascript', body: n === 'firestore' ? fsStub : fs.readFileSync(path.join(STUB, n + '.js'), 'utf8') }); });
    await c.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: "@font-face{font-family:'Nanum Myeongjo';font-weight:800;src:local('Noto Serif CJK KR Bold');}" }));
    await c.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"current":{"temperature_2m":17,"apparent_temperature":16,"relative_humidity_2m":55,"weather_code":2}}' }));
    await c.route(/omaju@?\/?trip-photos\//, r => { const f = path.join(LOCAL, r.request().url().split('/').pop()); try { r.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(f) }); } catch (e) { r.fulfill({ status: 404, body: '' }); } });
    if (big) await c.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '24px'; }));
    const p = await c.newPage(); p.on('pageerror', e => console.log('  오류', e.message));
    await p.goto(base + '/index.html'); await p.waitForTimeout(1800);
    for (const [screen, tab] of WANT) {
      await p.evaluate(h => { location.hash = h; }, screen); await p.waitForTimeout(800);
      if (tab) { const t = await p.$(`[data-trv="${tab}"], [data-hkr="${tab}"]`); if (t) { await t.click(); await p.waitForTimeout(900); } }
      // 끝까지 한 번 훑어 내려 늦게 받는 사진(lazy)까지 다 띄운 뒤에 찍는다
      await p.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
        window.scrollTo(0, 0);
      });
      await p.waitForTimeout(900);
      const name = `${screen}${tab ? '-' + tab : ''}-${PC ? 'PC-' : ''}${big ? '큰글씨' : '보통'}.png`;
      await p.screenshot({ path: path.join(OUT, name), fullPage: true });
      console.log(' 찍음', name);
    }
    await c.close();
  }
  await b.close(); srv.close();
});
