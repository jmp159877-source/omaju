// 연재 만화 한 화를 컷마다 그림(PNG 2000×1520)으로 뜬다 — 쇼츠·블로그용.
//   NODE_PATH=$(npm root -g) node tools/comic_img.js <화 id 또는 날짜> <나갈 폴더>
// 사이트와 같은 js/comic.js 로 그리므로 화면과 그림이 똑같다.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const [want, OUT = 'comic_out'] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/comic.json'), 'utf8'));
const a = D.items.find(x => x.id === want || x.date === want);
if (!a) { console.error('화를 못 찾음', want); process.exit(1); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0}svg{width:1000px;height:760px;display:block}</style><body><script type=module>
import { panel } from '/js/comic.js'; const a = ${JSON.stringify(a)};
window.draw = i => { document.body.innerHTML = panel(a.panels[i], i); return true; }; document.title = 'ready';</script>`;
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u === '/') { r.writeHead(200, { 'content-type': 'text/html' }); r.end(page); return; }
  fs.readFile(path.join(ROOT, u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : u.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); r.end(d); });
}).listen(0, '127.0.0.1', async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 2 })).newPage();
  await p.goto(`http://127.0.0.1:${srv.address().port}/`); await p.waitForFunction(() => document.title === 'ready');
  for (let i = 0; i < a.panels.length; i++) { await p.evaluate(i => window.draw(i), i); await p.waitForTimeout(900); await p.screenshot({ path: path.join(OUT, `p${i + 1}.png`) }); }
  fs.writeFileSync(path.join(OUT, 'ep.json'), JSON.stringify({ id: a.id, no: a.no, date: a.date, title: a.title, next: a.next || '' }, null, 1));
  console.log('컷', a.panels.length, '→', OUT); await b.close(); srv.close();
});
