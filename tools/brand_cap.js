// 오마주 소개 쇼츠용 실제 화면 찍기 — https://omaju.kr 을 휴대폰 크기(390×844, 배율 2)로 연다.
//   NODE_PATH=$(npm root -g) node tools/brand_cap.js <나갈 폴더> [화면…]
// 기본 화면: home anbu ai ev trip food (#해시 이름 그대로 — 예: fortune play book hike phrase show)
// anbu 를 찍으면 마음 하나를 고른 anbu2.png 와 카드를 연 modal.png 도 함께 나온다.
// 내 기기는 방문 수에 넣지 않는다(omaju.noCount=1).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const OUT = process.argv[2] || 'cap';
const WANT = process.argv.slice(3).length ? process.argv.slice(3) : ['home', 'anbu', 'ai', 'ev', 'trip', 'food'];
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const opt = process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {};
  const b = await chromium.launch(opt);
  const c = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  await c.addInitScript(() => { try { localStorage.setItem('omaju.noCount', '1'); } catch (e) {} });
  let p = null;
  const hide = () => p.addStyleTag({ content: '#mood-bar,.mood-bar,#mb-bar,[class*="musicbox"]{display:none!important}' }).catch(() => {});
  // 화면마다 새 창으로 연다 — 한 창에서 #해시만 바꾸면 앞 화면(안부 카드 창 등)에 막혀 모두 같은 화면이 찍혔다(2026-11-09).
  // 전체 쪽 캡처는 늦게 받는 사진(lazy)을 안 깨우므로 끝까지 한 번 내려갔다 올라온다.
  const wake = async () => { const h = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 700) { await p.evaluate(v => scrollTo(0, v), y); await p.waitForTimeout(250); }
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(1200); };
  for (const k of WANT) {
    if (p) await p.close(); p = await c.newPage();
    await p.goto('https://omaju.kr/' + (k === 'home' ? '' : '#' + k)); await p.waitForTimeout(7000); await hide(); await wake();
    await p.screenshot({ path: path.join(OUT, k + '.png'), fullPage: true });
    console.log(k, await p.evaluate(() => document.documentElement.scrollHeight));
    if (k === 'anbu') {
      await p.locator('.anb-moods button').nth(1).click().catch(() => {}); await p.waitForTimeout(1500);
      await p.screenshot({ path: path.join(OUT, 'anbu2.png'), fullPage: true });
      await p.locator('.anb-row img, .anb-row button, .anb-row .anb-card').first().click().catch(() => {}); await p.waitForTimeout(2500);
      await p.screenshot({ path: path.join(OUT, 'modal.png') });
    }
  }
  await b.close();
})();
