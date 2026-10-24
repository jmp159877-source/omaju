// 오마주 올리기 전 자동 시험 — `node tests/run.js` (Playwright 필요: NODE_PATH=$(npm root -g))
// 화면 전부(보통·큰 글씨) 오류·넘침, 뒤로 가기 단계, 첫 화면 나가기, 수첩 말로 메모 저장, 인사 카드 6가지.
// 가짜 Firebase(tests/stub)에 가장 최근 daily/*.json 을 넣어 실제 오늘 내용으로 돈다.
const { chromium } = require('playwright'); const fs = require('fs'); const http = require('http'); const path = require('path');
const ROOT = path.join(__dirname, '..'), STUB = path.join(__dirname, 'stub');
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const days = fs.readdirSync(path.join(ROOT, 'daily')).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
// 오늘(한국 날짜) 파일을 쓰고, 없거나 미리 넣어 둔 일부 데이터(era 만 있는 내일 이후 파일)면 그 이전의 온전한 날을 쓴다.
const kstToday = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const full = days.filter(f => f.slice(0, 10) <= kstToday).map(f => [f, JSON.parse(fs.readFileSync(path.join(ROOT, 'daily', f), 'utf8'))]).filter(([, d]) => d.greetings && d.fortune && d.quiz);
const daily = (full.length ? full[full.length - 1] : [null, JSON.parse(fs.readFileSync(path.join(ROOT, 'daily', days[days.length - 1]), 'utf8'))])[1];
const fsStub = (() => { const s = fs.readFileSync(path.join(STUB, 'firestore.js'), 'utf8'), i = s.indexOf('const key=');
  const today = "(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()";
  return s.slice(0, i) + `store['daily/'+${today}]=${JSON.stringify(daily)};`
    + `store['users/u_tester']={username:'tester',nick:'시험이',nickKey:'시험이',role:'member',region:'서울 종로구',streak:3,lastCheckin:'',checkinCount:3};`
    + s.slice(i); })();
const results = []; const ok = (name, pass, info = '') => { results.push([pass, name, info]); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${srv.address().port}`; const b = await chromium.launch({ executablePath: exe });
  const ctx = async (big, ua) => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua, timezoneId: 'Asia/Seoul' });
    await c.route('https://www.gstatic.com/**', r => { const u = r.request().url(); const n = u.includes('firebase-app') ? 'app' : u.includes('firebase-auth') ? 'auth' : u.includes('firestore') ? 'firestore' : 'analytics'; r.fulfill({ contentType: 'application/javascript', body: n === 'firestore' ? fsStub : fs.readFileSync(path.join(STUB, n + '.js'), 'utf8') }); });
    await c.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: "@font-face{font-family:'Nanum Myeongjo';font-weight:800;src:local('Noto Serif CJK KR Bold');}" }));
    await c.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"current":{"temperature_2m":17,"apparent_temperature":16,"relative_humidity_2m":55,"weather_code":2}}' }));
    // 네 장 모두 같은 견본을 쓰되, 주소에 든 장 이름으로 ch·title 만 바꿔 준다
    await c.route(/(raw\.githubusercontent\.com|cdn\.jsdelivr\.net)\/.*radio\/.*\.json/, r => {
      const m = r.request().url().match(/-(g\d)\.json/); const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/radio.json'), 'utf8'));
      const T = { g1: '오늘 즐기기', g2: '그때 돌아보기', g5: '앞으로 나아가기', g3: '나를 돌보기' };
      if (m) { d.ch = m[1]; d.title = T[m[1]] || d.title; d.audio = `2026-01-01-${m[1]}.mp3`; }
      r.fulfill({ contentType: 'application/json', body: JSON.stringify(d) });
    });
    await c.route(/raw\.githubusercontent\.com\/.*opening\/.*\.json|cdn\.jsdelivr\.net\/gh\/.*opening\/.*\.json/, r => r.fulfill({ contentType: 'application/json', body: fs.readFileSync(path.join(__dirname, 'fixtures/opening.json'), 'utf8') }));
    await c.route(/raw\.githubusercontent\.com\/.*place-photos\/.*\.jpg/, r => r.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(path.join(ROOT, 'img/history.jpg')) }));
    await c.route(/(raw\.githubusercontent\.com|cdn\.jsdelivr\.net)\/.*\.mp3/, r => r.fulfill({ contentType: 'audio/mpeg', body: fs.readFileSync(path.join(__dirname, 'fixtures/opening.mp3')) }));
    if (big) await c.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '24px'; }));
    return c; };
  const wait = (p, ms) => p.waitForTimeout(ms);
  try {
    // 0) 같은 사진을 두 곳에 쓰지 않는다 (운영자 규칙) — 코너 카드와 코너 표지 모두
    { const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const cards = [...html.matchAll(/data-corner="(\w+)"[^>]*background-image:url\('(img\/[\w-]+\.jpg)'\)|background-image:url\('(img\/[\w-]+\.jpg)'\)[^>]*data-corner="(\w+)"/g)]
        .map(m => m[2] || m[3]);
      const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
      const det = (app.match(/const DET = \{([\s\S]*?)\n/) || ['', ''])[1];
      const heroes = [...det.matchAll(/(\w+): \['([a-z_0-9]+)'/g)].map(m => m[2]);
      const dup = a => { const seen = {}, bad = []; for (const x of a) { if (seen[x]) bad.push(x); seen[x] = 1; } return [...new Set(bad)]; };
      const missing = heroes.filter(h => !fs.existsSync(path.join(ROOT, 'img', h + '.jpg')));
      const bad = [...dup(cards).map(x => '카드 ' + x), ...dup(heroes).map(x => '표지 ' + x), ...missing.map(x => '없는 사진 ' + x)];
      ok('같은 사진을 두 곳에 쓰지 않음', !bad.length, bad.join(' / ')); }
    // 1) 화면 전부 × 보통·큰 글씨
    const ROUTES = ['', 'g1', 'g2', 'g5', 'g3', 'g6', 'g7', 'g4', 'dog', 'cat', 'solo-day', 'solo-eat', 'solo-hobby', 'solo-see', 'solo-home', 'solo-trip', 'ev', 'ai', 'move', 'mind', 'body', 'home', 'book', 'show', 'culture', 'pick', 'follow', 'food', 'luck', 'fortune', 'dream', 'history', 'music', 'outing', 'phrase', 'play', 'psy', 'psa', 'pt-wall', 'pt-talk', 'pt-trip', 'quiz', 'story'];
    for (const big of [false, true]) {
      const c = await ctx(big); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(base + '/index.html'); await wait(p, 1500); const bad = [];
      for (const h of ROUTES) { await p.evaluate(h => { location.hash = h; }, h); await wait(p, 600);
        const r = await p.evaluate(() => { const o = []; if (document.documentElement.scrollWidth > innerWidth + 1) o.push('가로 넘침');
          for (const im of document.querySelectorAll('img')) if (im.complete && im.naturalWidth === 0 && im.src.startsWith(location.origin) && im.offsetParent) o.push('사진 깨짐 ' + im.src.split('/').pop());
          return o; }); if (r.length) bad.push(`#${h || '첫화면'}: ${r.join(', ')}`); }
      ok(`화면 ${ROUTES.length}개 오류·넘침 (${big ? '큰' : '보통'} 글씨)`, !errs.length && !bad.length, [...new Set(errs)].concat(bad).join(' / '));
      await c.close();
    }
    // 1-1) 소개 배너는 첫 화면에만 — 장·코너에 들어가면 따라붙지 않아야 한다 (운영자 2026-10-20)
    { const c = await ctx(false); const p = await c.newPage(); await p.goto(base + '/index.html'); await wait(p, 1500);
      const seen = {};
      for (const h of ['', 'g1', 'g3', 'food', '']) {
        await p.evaluate(x => { location.hash = x; }, h); await wait(p, 600);
        seen[h || '첫화면'] = await p.evaluate(() => { const e = document.querySelector('.intro'); return !!(e && e.offsetParent); });
      }
      ok('소개 배너는 첫 화면에만 보임', seen['첫화면'] === true && !seen.g1 && !seen.g3 && !seen.food, JSON.stringify(seen));
      await c.close(); }
    // 1-2) PC 화면도 본다 (운영자 2026-10-20: PC 에서 배너가 커버에 붙고 수첩 칸만 거대했다)
    { const c = await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Seoul' });
      await c.route('https://www.gstatic.com/**', r => { const u = r.request().url(); const n = u.includes('firebase-app') ? 'app' : u.includes('firebase-auth') ? 'auth' : u.includes('firestore') ? 'firestore' : 'analytics'; r.fulfill({ contentType: 'application/javascript', body: n === 'firestore' ? fsStub : fs.readFileSync(path.join(STUB, n + '.js'), 'utf8') }); });
      await c.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
      await c.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"current":{"temperature_2m":17}}' }));
      const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(base + '/index.html'); await wait(p, 1600);
      const r = await p.evaluate(() => {
        const o = [];
        if (document.documentElement.scrollWidth > innerWidth + 1) o.push('가로 넘침');
        const i = document.querySelector('.intro'), t = document.querySelector('.content');
        if (i && t) { const a = i.getBoundingClientRect(), b = t.getBoundingClientRect();
          if (a.left <= b.left + 1) o.push('소개 배너가 글 칸 끝에 붙음'); }
        const cards = [...document.querySelectorAll('.tabs3:not(.compact) button')].map(e => e.getBoundingClientRect().height);
        if (cards.length && Math.max(...cards) > Math.min(...cards) * 1.6) o.push('장 칸 높이가 들쭉날쭉 ' + cards.map(Math.round).join('/'));
        return o; });
      ok('PC 화면 첫 화면', !errs.length && !r.length, [...new Set(errs)].concat(r).join(' / '));
      await c.close(); }
    // 1-3) 오늘의 이슈: 다섯 줄이 뜨고, 보통·큰 글씨 모두 칸 밖으로 안 넘치고, 누르면 기사로 간다
    for (const big of [false, true]) {
      const c = await ctx(big); const p = await c.newPage(); await p.goto(base + '/index.html'); await wait(p, 1600);
      await p.evaluate(() => window.omajuNav('g1')); await wait(p, 700);
      const r = await p.evaluate(() => {
        const sec = document.getElementById('is-sec'); if (!sec || sec.hidden || !sec.offsetParent) return ['이슈 칸이 안 보임'];
        const o = [], rows = [...document.querySelectorAll('#is-list .is-item')];
        if (rows.length !== 5) o.push('줄 수 ' + rows.length);
        const card = document.querySelector('.is-card').getBoundingClientRect();
        for (const li of rows) {
          const a = li.querySelector('a'); if (!a || !/^https?:/.test(a.href)) { o.push('기사 주소 없음'); continue; }
          if (a.target !== '_blank') o.push('새 창으로 안 열림');
          const t = li.querySelector('.is-line').getBoundingClientRect();
          if (t.right > card.right + 1 || t.left < card.left - 1) o.push('글이 칸 밖으로 넘침');
          if (t.height < 10) o.push('글이 안 보임');
        }
        if (!document.getElementById('is-foot').textContent.trim()) o.push('기준 시각 없음');
        if (document.documentElement.scrollWidth > innerWidth + 1) o.push('가로 넘침');
        return [...new Set(o)]; });
      ok(`오늘의 이슈 칸 (${big ? '큰' : '보통'} 글씨)`, !r.length, r.join(' / '));
      await c.close();
    }
    // 1-4) 카카오·네이버로 시작하기: 단추가 보이고, 두 회사 색이고, 누르면 우리 서버 다리로 간다
    { const c = await ctx(false); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(base + '/index.html'); await wait(p, 1600);
      await p.evaluate(() => document.getElementById('login-btn').click()); await wait(p, 600);
      const r = await p.evaluate(() => {
        const k = document.getElementById('g-kakao'), n = document.getElementById('g-naver');
        if (!k || !n) return ['단추 없음'];
        const o = [];
        const ck = getComputedStyle(k), cn = getComputedStyle(n);
        if (!/254, ?229, ?0/.test(ck.backgroundColor)) o.push('카카오 색 ' + ck.backgroundColor);
        if (!/3, ?199, ?90/.test(cn.backgroundColor)) o.push('네이버 색 ' + cn.backgroundColor);
        for (const b of [k, n]) { const t = b.getBoundingClientRect(); if (t.height < 44) o.push(b.id + ' 높이 ' + Math.round(t.height)); if (t.width < 100) o.push(b.id + ' 너비 ' + Math.round(t.width)); }
        if (!/카카오/.test(k.textContent) || !/네이버/.test(n.textContent)) o.push('글씨가 다름');
        return o; });
      ok('카카오·네이버로 시작하기 단추', !errs.length && !r.length, [...new Set(errs)].concat(r).join(' / '));
      await c.close(); }
    // 1-5) 가입 마무리 한 장: 카카오로 들어왔는데 우리 쪽 정보가 없으면 별명·성별·태어난 해를 받는다
    { const c = await ctx(false); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(base + '/index.html?ct=testtoken'); await wait(p, 2200);
      const r = await p.evaluate(() => {
        const o = [];
        if (location.search) o.push('주소에 토큰이 남음 ' + location.search);
        const m = document.getElementById('modal');
        if (!m) return ['마무리 창이 안 뜸'];
        for (const id of ['f-nick', 'f-gender', 'f-birth', 'f-terms', 'f-go']) if (!document.getElementById(id)) o.push(id + ' 없음');
        const nick = document.getElementById('f-nick');
        if (nick && !nick.value) o.push('별명이 미리 안 채워짐');
        return o; });
      ok('가입 마무리 한 장 (카카오로 들어온 분)', !errs.length && !r.length, [...new Set(errs)].concat(r).join(' / '));
      // 1-6) 시작하기 → 구독 환영 카드: 별명으로 인사, '홈 화면에 오마주 놓기'가 맨 먼저·가장 크게, '오마주 들어가기'로 닫힘
      const w = [];
      try {
        await p.fill('#f-nick', '환영시험'); await p.click('#f-gender [data-g="여"]'); await p.selectOption('#f-birth', '1970'); await p.check('#f-terms');
        await p.click('#f-go'); await wait(p, 1500);
        const v = await p.evaluate(() => { const m = document.querySelector('.wel-hi'); if (!m) return null;
          const f = m.querySelector('.hi-feat'), l = m.querySelector('.hi-list');
          return { h2: m.querySelector('h2').textContent, feat: !!f, featFirst: f && l && (f.compareDocumentPosition(l) & 4) > 0, now: f && f.textContent.includes('지금 설치하기'), go: (document.getElementById('hi-go') || {}).textContent, ow: document.documentElement.scrollWidth > innerWidth }; });
        if (!v) w.push('환영 카드가 안 뜸');
        else { if (!v.h2.includes('환영시험')) w.push('별명이 인사에 없음: ' + v.h2); if (!v.feat || !v.featFirst) w.push('홈 화면 칸이 맨 먼저가 아님'); if (!v.now) w.push("'지금 설치하기' 없음"); if (v.go !== '오마주 들어가기') w.push('아래 단추 글: ' + v.go); if (v.ow) w.push('가로 넘침');
          await p.click('#hi-go'); await wait(p, 700); if (await p.$('.wel-hi')) w.push('들어가기를 눌러도 안 닫힘'); }
      } catch (e) { w.push(String(e.message || e).slice(0, 120)); }
      ok('구독 환영 카드 (시작하기 뒤)', !errs.length && !w.length, [...new Set(errs)].concat(w).join(' / '));
      await c.close(); }
    // 2) 뒤로 가기: 여러 화면을 열고 몇 번 만에 나가는지 (단계: 놀이→장→첫화면→안내→나감)
    { const c = await ctx(false); const p = await c.newPage(); await p.goto(base + '/terms.html'); await p.goto(base + '/index.html'); await wait(p, 1500);
      const go = async h => { await p.evaluate(h => window.omajuNav(h), h); await wait(p, 700); };
      for (const h of ['g1', 'fortune', 'g1', 'food', 'g1', 'quiz', 'culture', 'g2', 'history', 'music', 'g5', 'follow', 'g1', 'play', 'sudoku', 'num50']) await go(h);
      let n = 0, left = false; while (n < 12 && !left) { n++; await p.goBack({ timeout: 3000 }).catch(() => {}); await wait(p, 400); left = p.url().includes('terms'); }
      ok('뒤로 가기 단계 (화면 16번 연 뒤)', left && n <= 6, `${n}번 만에 나감`); await c.close(); }
    // 3) 첫 화면 나가기: 한 번 → 안내, 기다렸다 다시 → 또 안내, 바로 한 번 더 → 나감
    { const c = await ctx(false); const p = await c.newPage(); await p.goto(base + '/terms.html'); await p.goto(base + '/index.html'); await wait(p, 1500);
      const toast = () => p.evaluate(() => { const t = document.getElementById('toast'); return !!(t && !t.hidden && /나갑니다/.test(t.textContent)); }).catch(() => false);
      await p.goBack(); await wait(p, 400); const t1 = await toast(); await wait(p, 3000); await p.goBack(); await wait(p, 400); const t2 = await toast() && p.url().includes('index');
      await p.goBack({ timeout: 3000 }).catch(() => {}); await wait(p, 600); ok('첫 화면 나가기 안내', t1 && t2 && p.url().includes('terms')); await c.close(); }
    // 3-2) 내 고향: 말하기 → '다 했어요' 누르면 창이 닫히고 주소 칸에 그대로 들어간다
    { const c = await ctx(false);
      await c.addInitScript(() => { class SR { start() { const me = this; setTimeout(() => { me.onresult && me.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: '서울 종로구 삼청동' }], { isFinal: true })] }); }, 150); } stop() {} abort() {} } window.webkitSpeechRecognition = SR; window.SpeechRecognition = SR; });
      const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(base + '/index.html'); await wait(p, 1500);
      await p.evaluate(() => window.omajuNav('home')); await wait(p, 900);
      await p.evaluate(() => { const b = document.querySelector('[data-ht="road"]'); if (b) b.click(); }); await wait(p, 400);
      await p.evaluate(() => document.getElementById('ht-mic').click()); await wait(p, 900);
      const sawDone = await p.evaluate(() => !!document.getElementById('nb-done'));
      await p.evaluate(() => document.getElementById('nb-done').click()); await wait(p, 900);
      const r = await p.evaluate(() => ({ modal: !!document.getElementById('nb-done'), q: (document.getElementById('ht-q') || {}).value || '' }));
      ok('내 고향: 말하기 → 다 했어요 → 창 닫히고 주소 들어감', sawDone && !r.modal && r.q === '서울 종로구 삼청동' && !errs.length, JSON.stringify({ sawDone, ...r, errs: errs.slice(0, 1) }));
      // 지금 그곳에 갔다 로드뷰로 돌아오면 보던 곳을 다시 적게 하지 않는다 (코너를 나갔다 와도)
      const first = await p.evaluate(() => (document.getElementById('ht-empty') || {}).textContent || '');
      await p.evaluate(() => document.querySelector('[data-ht="cam"]').click()); await wait(p, 500);
      await p.evaluate(() => document.querySelector('[data-ht="road"]').click()); await wait(p, 800);
      const back = await p.evaluate(() => ({ q: (document.getElementById('ht-q') || {}).value || '', empty: (document.getElementById('ht-empty') || {}).textContent || '' }));
      await p.evaluate(() => window.omajuNav('g2')); await wait(p, 500); await p.evaluate(() => window.omajuNav('home')); await wait(p, 900);
      const again = await p.evaluate(() => (document.getElementById('ht-q') || {}).value || '');
      ok('내 고향: 칸을 옮겼다 와도 보던 곳 그대로', back.q === '서울 종로구 삼청동' && !/주소를 넣으면/.test(back.empty) && again === '서울 종로구 삼청동', JSON.stringify({ first: first.slice(0, 20), ...back, again }));
      // 앱을 닫았다 다시 열면 지난번 동네는 잊는다 (며칠 전 찾던 곳이 남아 있으면 안 된다)
      await p.goto(base + '/index.html'); await wait(p, 1500);
      await p.evaluate(() => window.omajuNav('home')); await wait(p, 900);
      await p.evaluate(() => { const b = document.querySelector('[data-ht="road"]'); if (b) b.click(); }); await wait(p, 500);
      const fresh = await p.evaluate(() => ({ q: (document.getElementById('ht-q') || {}).value || '', empty: (document.getElementById('ht-empty') || {}).textContent || '' }));
      ok('내 고향: 앱을 다시 열면 빈 칸에서 시작', fresh.q === '' && /주소를 넣으면/.test(fresh.empty), JSON.stringify(fresh));
      // 라이브캠은 보고 있을 때만 — 다른 코너·다른 앱으로 가면 끊긴다
      await p.evaluate(() => document.querySelector('[data-ht="cam"]').click()); await wait(p, 700);
      const on = await p.evaluate(() => (document.querySelector('.ht-cam iframe') || {}).src || '');
      await p.evaluate(() => window.omajuNav('g2')); await wait(p, 600);
      const away = await p.evaluate(() => (document.querySelector('.ht-cam iframe') || {}).src || '');
      await p.evaluate(() => window.omajuNav('home')); await wait(p, 800);
      const back2 = await p.evaluate(() => (document.querySelector('.ht-cam iframe') || {}).src || '');
      await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await wait(p, 400);
      const hid = await p.evaluate(() => (document.querySelector('.ht-cam iframe') || {}).src || '');
      ok('내 고향: 라이브캠이 코너를 떠나면 멎음', /youtube\.com/.test(on) && /about:blank/.test(away) && /youtube\.com/.test(back2) && /about:blank/.test(hid), JSON.stringify({ on: on.slice(-24), away, back2: back2.slice(-24), hid }));
      await c.close(); }
    // 3-4) 그 동네 지금: 로드뷰 아래 큰 단추 — 돌기(±45°)·걷기(새 자리로 옮김) (운영자 2026-10-22: 카카오 화살표가 '동서남북' 글자와 겹쳐 안 눌렸다)
    { const c = await ctx(false);
      const FAKE = `window.__rv={ids:[],pans:[]};window.kakao={maps:{load:function(cb){cb()},
        LatLng:function(a,b){this.getLat=function(){return a};this.getLng=function(){return b}},
        Roadview:function(){var pan=0,id=0,pos=null;this.setPanoId=function(i,p){id=i;pos=p;window.__rv.ids.push(i)};this.getPanoId=function(){return id};this.getPosition=function(){return pos};this.getViewpoint=function(){return {pan:pan,tilt:0,zoom:0}};this.setViewpoint=function(v){pan=v.pan;window.__rv.pans.push(v.pan)};this.relayout=function(){}},
        RoadviewClient:function(){var n=100;this.getNearestPanoId=function(p,r,cb){cb(++n)}},
        services:{Status:{OK:'OK'},Geocoder:function(){this.addressSearch=function(q,cb){cb([{x:'126.98',y:'37.58'}],'OK')}},Places:function(){this.keywordSearch=function(q,cb){cb([],'ZERO')}}}}};`;
      await c.route('https://dapi.kakao.com/**', r => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
      const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(base + '/index.html'); await wait(p, 1500);
      await p.evaluate(() => window.omajuNav('home')); await wait(p, 900);
      await p.evaluate(() => { const b = document.querySelector('[data-ht="road"]'); if (b) b.click(); }); await wait(p, 400);
      const hiddenBefore = await p.evaluate(() => { const x = document.getElementById('ht-pad'); return !x || x.hidden; });
      await p.fill('#ht-q', '서울 종로구 삼청동'); await p.evaluate(() => document.querySelector('#ht-form [type=submit]').click()); await wait(p, 900);
      const shown = await p.evaluate(() => { const x = document.getElementById('ht-pad'); return !!x && !x.hidden && x.querySelectorAll('button').length === 4; });
      await p.evaluate(() => document.querySelector('[data-htm="right"]').click()); await wait(p, 200);
      await p.evaluate(() => document.querySelector('[data-htm="left"]').click()); await wait(p, 200);
      await p.evaluate(() => document.querySelector('[data-htm="left"]').click()); await wait(p, 200);
      const before = await p.evaluate(() => window.__rv.ids.length);
      await p.evaluate(() => document.querySelector('[data-htm="go"]').click()); await wait(p, 600);
      await p.evaluate(() => document.querySelector('[data-htm="back"]').click()); await wait(p, 600);
      const r = await p.evaluate(() => ({ pans: window.__rv.pans.slice(0, 3), ids: window.__rv.ids.length }));
      const good = hiddenBefore && shown && r.pans.join(',') === '45,0,315' && r.ids >= before + 2 && !errs.length;
      ok('그 동네 지금: 로드뷰 아래 단추로 돌기·걷기', good, JSON.stringify({ hiddenBefore, shown, pans: r.pans, walked: r.ids - before, errs: errs.slice(0, 2) }));
      await c.close(); }
    // 4) 수첩: 말로 메모 → 다 했어요 → 저장 → 수첩에 그대로 (두 번)
    for (const ua of ['Mozilla/5.0 (Linux; Android 14; SM-F731N) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36', undefined]) {
      const c = await ctx(false, ua);
      await c.addInitScript(() => { class SR { start() { const me = this; setTimeout(() => { me.onresult && me.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: '다음 주 화요일 치과' }], { isFinal: true })] }); }, 150); } stop() {} abort() {} } window.webkitSpeechRecognition = SR; window.SpeechRecognition = SR; });
      const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(base + '/index.html'); await wait(p, 1500);
      await p.click('#login-btn'); await wait(p, 300); await p.click('#g-signup'); await wait(p, 300);
      await p.fill('#s-id', 'test1960'); await p.click('#s-id-chk'); await wait(p, 200); await p.fill('#s-pw', '123456'); await p.fill('#s-nick', '시험'); await p.click('#s-nick-chk'); await wait(p, 200);
      await p.fill('#s-phone', '01012345678'); await p.click('#s-gender [data-g="여"]'); await p.selectOption('#s-birth', '1962'); await p.check('#s-terms'); await p.check('#s-agree'); await p.click('#s-go'); await wait(p, 800); await wait(p, 600); if (await p.$('#hi-go')) { await p.click('#hi-go'); await wait(p, 700); }   /* 구독 환영 카드 닫기 */
      await p.evaluate(() => { const m = document.getElementById('modal-root'); if (m) m.innerHTML = ''; }); await p.evaluate(() => window.omajuNav('g4')); await wait(p, 800);
      let stay = true; for (let k = 0; k < 2; k++) { await p.evaluate(() => document.querySelector('.nb-mic').click()); await wait(p, 900); await p.evaluate(() => document.getElementById('nb-done').click()); await wait(p, 700);
        await p.evaluate(() => { const s = document.getElementById('nb-save'); s && s.click(); }); await wait(p, 1200); stay = stay && (await p.evaluate(() => location.hash)) === '#g4'; }
      ok(`수첩 말로 메모 저장 뒤 머묾 (${ua ? '안드로이드' : 'PC'})`, stay && !errs.length, errs.join(' / '));
      if (!ua) { // 적어 둔 것 고치기 → 지우기 (실제로 눌러서)
        const r = await p.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); const out = {};
          document.querySelector('.nb-open[data-nbopen="memo"]').click(); await W(600);
          const it = document.querySelector('#nb-listbox .nb-item'); out.label = !!(it && it.querySelector('.nb-edit')) && !!document.querySelector('#nb-listbox .nb-tip');
          it.click(); await W(500); out.editTitle = (document.querySelector('#modal h2') || {}).textContent || '';
          document.getElementById('nb-text').value = '고친 메모 내용'; document.getElementById('nb-save').click(); await W(1000);
          out.edited = [...document.querySelectorAll('#nb-listbox .nb-txt')].some(x => x.textContent === '고친 메모 내용'); out.hashAfterEdit = location.hash;
          const before = document.querySelectorAll('#nb-listbox .nb-item').length;
          [...document.querySelectorAll('#nb-listbox .nb-item')].find(x => x.textContent.includes('고친 메모 내용')).click(); await W(500);
          document.getElementById('nb-del').click(); await W(200); out.ask = !!document.getElementById('nb-del-yes'); document.getElementById('nb-del-yes').click(); await W(1600);
          out.after = document.querySelectorAll('#nb-listbox .nb-item').length;
          out.deleted = out.after === before - 1 && ![...document.querySelectorAll('#nb-listbox .nb-txt')].some(x => x.textContent === '고친 메모 내용'); out.hashAfterDel = location.hash;
          const x = document.getElementById('modal-x'); if (x) x.click(); return out; });
        ok('수첩 고치기·지우기', r.label && /고치기/.test(r.editTitle) && r.edited && r.ask && r.deleted && r.hashAfterEdit === '#g4' && r.hashAfterDel === '#g4', JSON.stringify(r));
        // 목록에서 바로 '지우기' (창을 열지 않고)
        const r2 = await p.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); const out = {};
          document.querySelector('.nb-open[data-nbopen="memo"]').click(); await W(600);
          document.querySelector('#modal .nb-hand[data-kind="memo"]').click(); await W(400);
          document.getElementById('nb-text').value = '지울 메모'; document.getElementById('nb-save').click(); await W(1400);
          const row = [...document.querySelectorAll('#nb-listbox .nb-item')].find(x => x.textContent.includes('지울 메모'));
          out.btn = !!(row && row.querySelector('.nb-rm'));
          if (!out.btn) return out;
          const before = document.querySelectorAll('#nb-listbox .nb-item').length;
          row.querySelector('.nb-rm').click(); await W(500);
          out.ask = !!document.getElementById('nb-rm-yes');
          out.noEditor = !document.getElementById('nb-save');
          if (out.ask) { document.getElementById('nb-rm-yes').click(); await W(1000); }
          out.gone = document.querySelectorAll('#nb-listbox .nb-item').length === before - 1 && ![...document.querySelectorAll('#nb-listbox .nb-txt')].some(x => x.textContent === '지울 메모');
          out.hash = location.hash;
          const x = document.getElementById('modal-x'); if (x) x.click();
          return out; });
        ok('수첩: 목록에서 바로 지우기', r2.btn && r2.ask && r2.noEditor && r2.gone && r2.hash === '#g4', JSON.stringify(r2));
      }
      await c.close();
    }
    // 5) 인사 카드: 하루 4장 서로 다른 디자인 + 보내기 그림 6가지
    { const c = await ctx(false); const p = await c.newPage(); await p.goto(base + '/index.html#g1'); await wait(p, 1500);
      const vs = await p.evaluate(() => [...document.querySelectorAll('.gcard.paper')].map(e => e.dataset.v));
      const drawn = await p.evaluate(async () => { const m = await import('./js/cards.js'); const out = []; for (const v of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) { const cv = await m.drawCard('시험 문장\n둘째 줄\n셋째 줄', 0, { dateText: '1월 1일 · 월요일', variant: v, season: 'autumn' }); const d = cv.getContext('2d').getImageData(540, 640, 1, 1).data; out.push(cv.width === 1080 && cv.height === 1350 && d[3] === 255); } return out; });
      ok('인사 카드 4장 서로 다른 디자인', vs.length === 4 && new Set(vs).size === 4, vs.join(','));
      ok('보내기 그림 6가지 그려짐', drawn.every(Boolean), drawn.join(',')); await c.close(); }
    // 6) 오늘 PLAY: 몇 판을 하든 순위에 반영 (1 to 50 을 실제로 두 판) + 사천성·스도쿠 새 판도 순위로
    { const c = await ctx(false); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(base + '/index.html'); await wait(p, 1500);
      await p.click('#login-btn'); await wait(p, 300); await p.click('#g-signup'); await wait(p, 300);
      await p.fill('#s-id', 'play1960'); await p.click('#s-id-chk'); await wait(p, 200); await p.fill('#s-pw', '123456'); await p.fill('#s-nick', '놀이시험'); await p.click('#s-nick-chk'); await wait(p, 200);
      await p.fill('#s-phone', '01012345679'); await p.click('#s-gender [data-g="남"]'); await p.selectOption('#s-birth', '1962'); await p.check('#s-terms'); await p.check('#s-agree'); await p.click('#s-go'); await wait(p, 800); await wait(p, 600); if (await p.$('#hi-go')) { await p.click('#hi-go'); await wait(p, 700); }   /* 구독 환영 카드 닫기 */
      await p.evaluate(() => { const m = document.getElementById('modal-root'); if (m) m.innerHTML = ''; });
      await p.evaluate(() => window.omajuNav('g1')); await wait(p, 600); await p.evaluate(() => window.omajuNav('play')); await wait(p, 600); await p.evaluate(() => window.omajuNav('num50')); await wait(p, 4500);
      const playOnce = async () => { for (let n = 1; n <= 50; n++) { await p.evaluate(n => { const b = [...document.querySelectorAll('#n5-grid .n5')].find(x => x.textContent.trim() === String(n)); b && b.click(); }, n); } await wait(p, 2500);
        return p.evaluate(() => (document.getElementById('pl-done-s') || {}).textContent || ''); };
      const r1 = await playOnce(); await p.evaluate(() => document.querySelector('.pl-again').click()); await wait(p, 4500); const r2 = await playOnce();
      const okr = t => /상위|1등|중위|하위/.test(t);
      ok('1 to 50 두 판 모두 순위 반영', okr(r1) && okr(r2) && !errs.length, `1판: ${r1.replace(/\s+/g, ' ').slice(0, 40)} / 2판: ${r2.replace(/\s+/g, ' ').slice(0, 40)}`);
      const src = ['shisen', 'sudoku'].map(g => fs.readFileSync(path.join(ROOT, 'js/games', g + '.js'), 'utf8'));
      ok('사천성·스도쿠 새 판도 순위로', src.every(t => !/반영되지 않/.test(t) && /P\.finish\(/.test(t))); await c.close(); }
    // FAST=1 이면 코너마다 눌러 보는 긴 시험을 건너뛴다 — 화면 배치만 바꿨을 때 쓴다 (운영자 2026-10-19).
    // 넘침·깜빡임·밀림·사진 겹침·장 구성은 그대로 돌린다. 전체는 새벽 점검에서 다시 돈다.
    if (!process.env.FAST) {
    // 7) 코너마다 실제로 써 보기 (로그인한 사람처럼)
    { const c = await ctx(false); await c.route('https://www.youtube-nocookie.com/**', r => r.fulfill({ contentType: 'text/html', body: '<html></html>' }));
      await c.addInitScript(() => { window.__spoke = []; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: u => { window.__spoke.push(u.text); setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 300); }, 50); }, cancel() {}, getVoices: () => [], speaking: false } }); window.SpeechSynthesisUtterance = function (t) { this.text = t; }; });
      const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(base + '/index.html'); await wait(p, 1500);
      const E = (fn, a) => p.evaluate(fn, a); const W = ms => wait(p, ms);
      const step = async (name, fn) => { try { const r = await fn(); ok('써 보기 · ' + name, r === true, r === true ? '' : String(r)); } catch (e) { ok('써 보기 · ' + name, false, e.message.slice(0, 120)); } };
      const modalText = () => E(() => (document.getElementById('modal') || {}).textContent || '');
      const closeM = async () => { await E(() => { const x = document.getElementById('modal-x'); x && x.click(); }); await W(400); };
      // 가입
      await p.click('#login-btn'); await W(300); await p.click('#g-signup'); await W(300);
      await p.fill('#s-id', 'use1960'); await p.click('#s-id-chk'); await W(200); await p.fill('#s-pw', '123456'); await p.fill('#s-nick', '써보기'); await p.click('#s-nick-chk'); await W(200);
      await p.fill('#s-phone', '01012345671'); await p.click('#s-gender [data-g="남"]'); await p.selectOption('#s-birth', '1961'); await p.check('#s-terms'); await p.check('#s-agree'); await p.click('#s-go'); await W(900); await W(600); if (await p.$('#hi-go')) { await p.click('#hi-go'); await W(700); }   /* 구독 환영 카드 닫기 */
      await step('회원가입 → 로그인 상태', async () => (await E(() => !document.getElementById('user-chip').hidden || !!document.getElementById('user-nick').textContent)) || 'user-chip 안 보임');
      await closeM();
      await step('장 일곱 개 · 차례와 표지 번호가 맞음', async () => { const want = [['g1', '오늘 즐기기', '1'], ['g2', '그때 돌아보기', '2'], ['g5', '앞으로 나아가기', '3'], ['g3', '나를 돌보기', '4'], ['g6', '어쩌다 점점 집사', '5'], ['g7', '혼자라서 좋은 날', '6'], ['g4', '나의 수첩', '7']]; const tabs = await E(() => [...document.querySelectorAll('#tabs3 button')].map(b => [b.dataset.tab || '', (b.querySelector('b') || {}).textContent || ''])); if (tabs.length !== 7) return `탭이 ${tabs.length}개`; for (let i = 0; i < 7; i++) if (tabs[i][0] !== want[i][0] || tabs[i][1] !== want[i][1]) return `${i + 1}번째가 ${JSON.stringify(tabs[i])}`; const bad = []; for (const [g, title, no] of want) { await E(x => window.omajuNav(x), g); await W(500); const r = await E(() => { const h = document.getElementById('ch-head'); return h ? { k: (h.querySelector('.ch-k') || {}).textContent, t: (h.querySelector('h2') || {}).textContent } : null; }); if (!r || r.t !== title || r.k !== 'CHAPTER ' + no) bad.push(`${g}:${JSON.stringify(r)}`); } await E(() => window.omajuNav('g1')); await W(300); return !bad.length || bad.join(' / '); });
      await step('코너가 제 장에 들어 있음', async () => { const want = { g1: ['play', 'luck', 'food', 'book', 'quiz', 'culture', 'pick'], g2: ['history', 'music', 'story', 'home'], g5: ['follow', 'outing', 'show', 'garden', 'phrase'], g3: ['hike', 'move', 'mind', 'body'], g6: ['dog', 'cat'], g7: ['solo-day', 'solo-eat', 'solo-hobby', 'solo-see', 'solo-home', 'solo-trip'], g4: [] }; const got = await E(() => { const o = {}; for (const s of document.querySelectorAll('.tabsec')) o[s.dataset.g] = [...s.querySelectorAll('[data-open]')].map(b => b.dataset.open); return o; }); const bad = Object.keys(want).filter(g => (got[g] || []).join(',') !== want[g].join(',')); return !bad.length || bad.map(g => `${g}=${(got[g] || []).join(',')}`).join(' / '); });
      await step('기획 연재 전기차 시대 · 첫 화면 띠 → 글(도표·사진·출처) → 뒤로', async () => { const bad = []; await E(() => window.omajuNav('')); await W(600); const vis = await E(() => { const b = document.querySelector(".col-tile[data-open=ev]"); return !!b && b.offsetHeight > 0; }); if (!vis) bad.push('띠 안 보임'); await E(() => document.querySelector(".col-tile[data-open=ev]").click()); await W(1500); const r = await E(() => ({ h: location.hash, ch: document.querySelectorAll('#ev-body .ev-chart').length, ph: document.querySelectorAll('#ev-body .ev-photo img').length, src: document.querySelectorAll('#ev-body .ev-sources li').length, t: document.getElementById('d-title').textContent })); if (r.h !== '#ev') bad.push('주소 ' + r.h); if (r.ch < 1) bad.push('도표 없음'); if (r.ph < 1) bad.push('사진 없음'); if (r.src < 1) bad.push('출처 없음'); if (!r.t) bad.push('제목 없음'); await E(() => document.getElementById('back').click()); await W(900); const h = await E(() => location.hash); if (h) bad.push('뒤로→' + h); await E(() => window.omajuNav('g1')); await W(600); const inCh = await E(() => { const w = document.querySelector('.cols-wrap'); return w && w.offsetHeight > 0; }); if (inCh) bad.push('장 안에서도 띠가 보임'); return !bad.length || bad.join(' / '); });
      await step('기획 칼럼 AI 시대 · 단추 → 글(도표·출처) → 뒤로, 두 칸으로 나뉨', async () => { const bad = []; await E(() => window.omajuNav('')); await W(1500); const r0 = await E(() => { const t = document.querySelector('.col-tile[data-open=ai]'); return { vis: !!t && !t.hidden && t.offsetHeight > 0, one: document.querySelector('.cols-row').classList.contains('one') }; }); if (!r0.vis) bad.push('AI 단추 안 보임'); if (r0.one) bad.push('두 칸으로 안 나뉨'); await E(() => document.querySelector('.col-tile[data-open=ai]').click()); await W(1500); const r = await E(() => ({ h: location.hash, ch: document.querySelectorAll('#ai-body .ev-chart').length, src: document.querySelectorAll('#ai-body .ev-sources li').length, t: document.getElementById('d-title').textContent })); if (r.h !== '#ai') bad.push('주소 ' + r.h); if (r.ch < 1) bad.push('도표 없음'); if (r.src < 1) bad.push('출처 없음'); if (!r.t) bad.push('제목 없음'); await E(() => document.getElementById('back').click()); await W(900); const h = await E(() => location.hash); if (h) bad.push('뒤로→' + h); return !bad.length || bad.join(' / '); });
      await step('혼자라서 좋은 날 · 여섯 칸 들어가기·뒤로', async () => { const bad = []; for (const k of ['day', 'eat', 'hobby', 'see', 'home', 'trip']) { await E(() => window.omajuNav('g7')); await W(600); await E(k => window.omajuNav('solo-' + k), k); await W(1200); const r = await E(k => ({ n: document.querySelectorAll('#solo-' + k + ' .so-list li').length, sv: !!document.querySelector('#solo-' + k + ' [data-save]'), t: document.getElementById('d-title').textContent }), k); if (r.n < 2) bad.push(k + ':' + r.n); if (!r.sv) bad.push(k + ':담아두기 없음'); } await E(() => document.getElementById('back').click()); await W(900); const h = await E(() => location.hash); await E(() => window.omajuNav('g1')); await W(300); if (h !== '#g7') bad.push('뒤로→' + h); return !bad.length || bad.join(' / '); });
      await step('어쩌다 점점 집사 · 들어가기·지난 이야기·뒤로', async () => { await E(() => window.omajuNav('g6')); await W(1500); const card = await E(() => { const b = document.querySelector('[data-open="dog"] h3'); return b ? b.textContent : ''; }); if (!/댕댕이|\?/.test(card) || /오늘의 댕댕이 이야기/.test(card)) return '칸 제목이 글 제목으로 안 바뀜: ' + card; await E(() => window.omajuNav('dog')); await W(1500); const r = await E(() => ({ t: document.getElementById('d-title').textContent, why: !!document.querySelector('#pet-dog .pet-why'), todo: document.querySelectorAll('#pet-dog .pet-todo li').length, past: document.querySelectorAll('#pet-dog [data-pet]').length })); if (!r.why || r.todo < 2 || r.past < 1) return JSON.stringify(r); if (r.past > 1) { await E(() => document.querySelectorAll('#pet-dog [data-pet]')[1].click()); await W(500); const t2 = await E(() => document.getElementById('d-title').textContent); if (t2 === r.t) return '지난 이야기를 눌러도 제목이 그대로'; } await E(() => document.getElementById('back').click()); await W(900); const h = await E(() => location.hash); if (h !== '#g6') return '뒤로 가기 → ' + h; await E(() => window.omajuNav('cat')); await W(1200); const c = await E(() => document.querySelectorAll('#pet-cat .pet-todo li').length); await E(() => window.omajuNav('g1')); await W(300); return c >= 2 || '냥이 글 없음'; });
      await step('글자 크기 바꾸기', async () => { const a = await E(() => document.documentElement.classList.contains('big')); await E(() => document.getElementById('sizer').click()); const b = await E(() => document.documentElement.classList.contains('big')); await E(() => document.getElementById('sizer').click()); return a !== b || '안 바뀜'; });
      await E(() => window.omajuNav('g1')); await W(700);
      await step('인사 카드 눌러 보내기 창', async () => { await E(() => document.querySelector('[data-copy="0"]').click()); await W(1800); const t = await modalText(); const img = await E(() => { const i = document.querySelector('#modal img'); return !!(i && i.naturalWidth > 0); }); await closeM(); return (/인사 카드가 준비/.test(t) && img) || ('창: ' + t.slice(0, 40)); });
      await step('시세 9가지 표시', async () => { const n = await E(() => document.querySelectorAll('#mk-grid > *').length); return n >= 9 || `${n}개`; });
      await step('운세·꿈 해몽: 두 단추 화면 → 운세 · 꿈 찾기 · 말 바꿔 찾기 · 없는 말 · 분류 · 뒤로 가면 두 단추', async () => {
        // 바깥 카드 → 두 단추 화면 → 오늘의 운세(띠 고르기) → 뒤로 → 꿈 해몽
        await E(() => window.omajuNav('g1')); await W(600);
        await E(() => document.querySelector('.tabsec[data-g="g1"] [data-open="luck"]').click()); await W(800);
        const two = await E(() => [...document.querySelectorAll('.dsec[data-k="luck"] [data-open]')].map(b => b.dataset.open).join(','));
        if (two !== 'fortune,dream') return '두 단추 화면: ' + two;
        await E(() => document.querySelector('.dsec[data-k="luck"] [data-open="fortune"]').click()); await W(700);
        const zod = await E(() => document.querySelectorAll('#zodiac [data-z]').length);
        await E(() => document.getElementById('back').click()); await W(700);
        const hub = await E(() => location.hash);
        if (zod < 12 || hub !== '#luck') return '운세 들어갔다 뒤로: 띠 ' + zod + ', 돌아온 곳 ' + hub;
        await E(() => document.querySelector('.dsec[data-k="luck"] [data-open="dream"]').click()); await W(900);
        const ask = async q => { await p.fill('#dr-q', q); await E(() => document.querySelector('#dr-form [type=submit]').click()); await W(250); return E(() => ({ h: [...document.querySelectorAll('#dr-res .dr-card h3')].map(x => x.textContent), n: document.querySelectorAll('#dr-res li').length, none: !!document.querySelector('#dr-res .dr-none') })); };
        const a = await ask('돼지'), b = await ask('치아'), c = await ask('돼지꿈 꿨어요'), d = await ask('스마트워치앱');
        const s1 = await ask('죽는 사람을 보고 놀라서 잠에서 깸'), s1top = await E(() => (document.querySelector('#dr-res li b') || {}).textContent || '');
        const s2 = await ask('엄마가 죽는 꿈'), s2top = await E(() => (document.querySelector('#dr-res li b') || {}).textContent || '');
        await E(() => document.querySelector('[data-drk="뱀"]').click()); await W(250);
        const e = await E(() => (document.querySelector('#dr-res .dr-card h3') || {}).textContent);
        await E(() => document.querySelector('[data-drc="탈것"]').click()); await W(200);
        const f = await E(() => [...document.querySelectorAll('#dr-catlist [data-drk]')].map(x => x.dataset.drk));
        await E(() => document.getElementById('back').click()); await W(700);
        const back = await E(() => location.hash);
        const bad = [];
        if (a.h[0] !== '돼지' || a.n < 3) bad.push('돼지 ' + JSON.stringify(a));
        if (b.h[0] !== '이빨') bad.push('치아→이빨 ' + JSON.stringify(b.h));
        if (c.h[0] !== '돼지') bad.push('돼지꿈 꿨어요 ' + JSON.stringify(c.h));
        if (!d.none) bad.push('없는 말인데 결과가 나옴');
        if (s1.h[0] !== '죽는 꿈' || s1.n < 5 || !/놀라 깨는/.test(s1top)) bad.push('문장 찾기 ' + JSON.stringify({ h: s1.h, n: s1.n, top: s1top }));
        if (!/가족이 죽는/.test(s2top)) bad.push('엄마가 죽는 꿈 → ' + s2top);
        if (e !== '뱀') bad.push('많이 찾는 꿈(뱀) ' + e);
        if (!f.includes('비행기')) bad.push('분류(탈것) ' + f.join(','));
        if (back !== '#luck') bad.push('뒤로 가면 ' + back);
        return !bad.length || bad.join(' / ');
      });
      await step('운세: 띠 고르기', async () => { await E(() => window.omajuNav('fortune')); await W(600); await E(() => document.querySelector('#zodiac [data-z]').click()); await W(300); const t = await E(() => document.getElementById('fortune').textContent); return (t.length > 30 && !/띠를 고르면/.test(t)) || t.slice(0, 40); });
      await step('시사 상식: 정답 고르고 확인', async () => { await E(() => window.omajuNav('quiz')); await W(600); const ans = await E(() => { const o = document.querySelectorAll('#opts [data-o]'); return o.length; }); if (ans < 4) return '보기 ' + ans; await E(() => document.querySelector('#opts [data-o]').click()); await W(200); await E(() => document.getElementById('quiz-check').click()); await W(400); const r = await E(() => document.getElementById('quiz-result').textContent + document.getElementById('quiz-exp').textContent); return r.trim().length > 5 || '결과 없음'; });
      await step('오늘의 문화: 8칸 모두 열림', async () => { await E(() => window.omajuNav('culture')); await W(800); const tabs = await E(() => [...document.querySelectorAll('[data-cu]')].map(b => b.dataset.cu)); const bad = []; for (const t of tabs) { await E(t => document.querySelector(`[data-cu="${t}"]`).click(), t); await W(300); const len = await E(() => document.getElementById('culture-body').textContent.length); if (len < 60) bad.push(t); } return (tabs.length === 8 && !bad.length) || `칸 ${tabs.length}, 빈 칸 ${bad}`; });
      await step('문화: 보다가 뒤로 가면 고르는 자리로', async () => { await E(() => window.omajuNav('culture')); await W(800); const menu0 = await E(() => !!document.querySelector('.cu-menu')); if (!menu0) return '고르는 화면이 아님'; await E(() => document.querySelector('.cu-pick[data-cu="painting"]').click()); await W(800); const inPaint = await E(() => /그림/.test((document.querySelector('#culture-body .cu-kind') || {}).textContent || '') && location.hash === '#cu-painting'); if (!inPaint) return '그림이 안 열림'; await p.goBack(); await W(800); const back1 = await E(() => ({ menu: !!document.querySelector('.cu-menu'), hash: location.hash, stillIn: document.body.classList.contains('in-detail') })); if (!(back1.menu && back1.hash === '#culture' && back1.stillIn)) return '한 번 뒤로: ' + JSON.stringify(back1); await p.goBack(); await W(800); const back2 = await E(() => ({ hash: location.hash, out: !document.body.classList.contains('in-detail') })); return back2.out || '두 번 뒤로에도 문화에 머묾: ' + JSON.stringify(back2); });
      await step('유머: 반전 보기', async () => { await E(() => document.querySelector('[data-cu="humor"]').click()); await W(300); await E(() => document.getElementById('hu-open').click()); await W(200); return await E(() => !document.getElementById('hu-punch').hidden) || '안 열림'; });
      await step('문화 음악: 장르 바꾸고 재생', async () => { await E(() => document.querySelector('[data-cu="music"]').click()); await W(300); await E(() => document.querySelectorAll('[data-mu]')[1].click()); await W(300); await E(() => document.querySelector('[data-msong]').click()); await W(500); const ok1 = await E(() => !!document.querySelector('#modal iframe, #modal a.btn')); await E(() => { const n = document.getElementById('pl-next'); n && n.click(); }); await W(400); const t = await E(() => (document.querySelector('.pl-no') || {}).textContent || ''); await closeM(); return (ok1 && /^2 \//.test(t.trim())) || `재생 ${ok1}, ${t}`; });
      await step('한마디 남기고 지우기', async () => { await E(() => { const f = document.querySelector('[data-cform="culture"]'); f.querySelector('input').value = '시험 한마디'; f.requestSubmit(); }); await W(900); const has = await E(() => [...document.querySelectorAll('[data-clist="culture"] .cmt')].some(x => x.textContent.includes('시험 한마디'))); if (!has) return '안 남음'; await E(() => document.querySelector('[data-clist="culture"] [data-cdel]').click()); await W(900); return !(await E(() => [...document.querySelectorAll('[data-clist="culture"] .cmt')].some(x => x.textContent.includes('시험 한마디')))) || '안 지워짐'; });
      await step('그해 오늘: 해 바꾸기', async () => { await E(() => window.omajuNav('g2')); await W(500); await E(() => window.omajuNav('history')); await W(700); const y1 = await E(() => document.getElementById('cat-year').textContent); await E(() => document.querySelectorAll('#tabs [data-ago]')[0].click()); await W(300); const y2 = await E(() => document.getElementById('cat-year').textContent); const facts = await E(() => document.querySelectorAll('#era .row, #era .era-fig, #era .hl').length); return (y1 !== y2 && facts >= 2) || `${y1}→${y2}, 소식 ${facts}`; });
      await step('그해 오늘: 그날의 신문 (날짜·분야·연예·그해 그곳 사진)', async () => { await E(() => document.querySelector('#tabs [data-ago="10"]').click()); await W(300); await E(() => { const p = document.querySelector('#era .place'); if (p) p.scrollIntoView(); else document.getElementById('era').scrollIntoView(false); }); await W(1200); const r = await E(() => { const e = document.getElementById('era'); const f = [...e.querySelectorAll('.field .f-name')].map(x => x.textContent.trim()); const im = e.querySelector('.place img'); return { date: (e.querySelector('.paper-head .date') || {}).textContent, fields: f, papers: e.querySelectorAll('.papers a').length, empty: [...e.querySelectorAll('.field')].filter(x => !x.querySelector('.hl')).length, photo: !!im && im.naturalWidth > 0 && !e.querySelector('.place').hidden, cap: (e.querySelector('.ph figcaption b') || {}).textContent, memo: !!e.querySelector('#memo, .mine') }; }); const e10 = (daily.era || {})['10'] || {}, ph = e10.photo, md = `${+kstToday.slice(5, 7)}월 ${+kstToday.slice(8, 10)}일`; return (r.date && r.date.includes(md) && (!e10.news || (r.fields.includes('연예') && r.fields.length >= 5 && r.empty === 0)) && (!(e10.papers || []).length || r.papers === e10.papers.length) && (!ph || (r.photo && r.cap && r.cap.includes(String(ph.place || '').split(' ')[0]))) && r.memo) || JSON.stringify(r); });
      await step('그해 오늘: 그해 그곳 사진 크게 보기', async () => { const e10 = (daily.era || {})['10'] || {}; if (!e10.photo) return true; const has = await E(() => !!document.querySelector('#era .ph-zoom img')); if (!has) return '사진 단추가 없습니다'; await E(() => document.querySelector('#era .ph-zoom').click()); await W(500); const big = await E(() => { const m = document.getElementById('modal'), i = m && m.querySelector('.ph-full img'); const r = i ? i.getBoundingClientRect() : null; return { open: !!m && m.classList.contains('ph-modal'), w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0, fits: !!r && r.width <= innerWidth + 1 && r.height <= innerHeight + 1, cap: ((m && m.querySelector('.ph-full p')) || {}).textContent || '' }; }); await E(() => document.querySelector('#modal .modal-box').click()); await W(500); const closed = await E(() => !document.getElementById('modal')); return (big.open && big.w > 180 && big.fits && big.cap && closed) || JSON.stringify({ ...big, closed }); });
      await step('나는 그때: 적기·고치기·지우기', async () => { await E(() => { document.getElementById('memo-in').value = '대학교 3학년'; document.getElementById('memo').requestSubmit(); }); await W(300); const a = await E(() => (document.querySelector('#era .mine') || {}).textContent); await E(() => document.querySelector('[data-mine="edit"]').click()); await W(200); await E(() => { document.getElementById('memo-in').value = '군대 막 다녀온 때'; document.getElementById('memo').requestSubmit(); }); await W(300); const b = await E(() => (document.querySelector('#era .mine') || {}).textContent); await E(() => document.querySelector('[data-mine="del"]').click()); await W(200); await E(() => document.querySelector('[data-mine="del-yes"]').click()); await W(300); const gone = await E(() => !document.querySelector('#era .mine') && !!document.getElementById('memo-in')); return (a === '대학교 3학년' && b === '군대 막 다녀온 때' && gone) || `${a} / ${b} / 지움 ${gone}`; });
      await step('그 시절 노래: 가요·팝송, 재생', async () => { await E(() => window.omajuNav('music')); await W(700); const n1 = await E(() => document.querySelectorAll('[data-song]').length); await E(() => { const b = [...document.querySelectorAll('#genre button')].find(x => /팝/.test(x.textContent)); b && b.click(); }); await W(300); const n2 = await E(() => document.querySelectorAll('[data-song]').length); await E(() => document.querySelector('[data-song]').click()); await W(500); const v = await E(() => !!document.querySelector('#modal iframe')); await closeM(); return (n1 >= 5 && n2 >= 5 && v) || `가요 ${n1}, 팝 ${n2}, 영상 ${v}`; });
      await step('따라하기: 영상 열고 뒤로 닫기', async () => { await E(() => window.omajuNav('g5')); await W(500); await E(() => window.omajuNav('follow')); await W(700); await E(() => document.querySelector('[data-fl]').click()); await W(600); const open = await E(() => !!document.querySelector('#modal iframe')); await p.goBack(); await W(600); const closed = await E(() => !document.getElementById('modal')); const h = await E(() => location.hash); return (open && closed && h === '#follow') || `열림 ${open}, 닫힘 ${closed}, ${h}`; });
      await step('몸 풀기 · 취미 따라하기가 따로 나옴', async () => { await E(() => window.omajuNav('move')); await W(700); const mv = await E(() => [...document.querySelectorAll('#move-body [data-fl]')].map(b => b.dataset.fl)); await E(() => window.omajuNav('follow')); await W(700); const fl = await E(() => [...document.querySelectorAll('#follow-body [data-fl]')].map(b => b.dataset.fl)); const ok1 = mv.length && mv.every(k => ['gym', 'meditate'].includes(k)); const ok2 = fl.length && fl.every(k => ['run', 'pilates', 'photo', 'coffee', 'camp'].includes(k)); return (ok1 && ok2) || JSON.stringify({ 몸풀기: mv, 취미: fl }); });
      await step('마음 한 줄: 읽고 숨 고르기', async () => { await E(() => window.omajuNav('mind')); await W(800); const a = await E(() => ({ line: (document.querySelector('#mind-body blockquote') || {}).textContent || '', go: !!document.getElementById('mn-go') })); if (!a.line || a.line.length < 10) return '문장 없음'; if (!a.go) return '숨 고르기 단추 없음'; await E(() => document.getElementById('mn-go').click()); await W(1300); const b = await E(() => ({ say: document.getElementById('mn-say').textContent, ring: document.getElementById('mn-ring').className, btn: document.getElementById('mn-go').textContent })); await E(() => document.getElementById('mn-go').click()); await W(300); const c = await E(() => document.getElementById('mn-go').textContent); return (/들이쉬기/.test(b.say) && /in|hold|out/.test(b.ring) && b.btn === '그만하기' && c === '숨 고르기 시작') || JSON.stringify({ b, c }); });
      await step('몸 한 가지: 오늘의 한 조각', async () => { await E(() => window.omajuNav('body')); await W(800); const a = await E(() => { const q = k => (document.querySelector(k) || {}).textContent || ''; return { line: q('#bd-body .bd-line'), note: q('#bd-body .bd-note'), todo: q('#bd-body .bd-todo'), sub: q('#body-sub'), title: (document.getElementById('d-title') || {}).textContent || '' }; }); if (a.line.length < 8) return '한 줄 없음'; if (a.note.length < 40) return '풀이 짧음'; if (a.todo.length < 10) return '오늘 해 볼 것 없음'; if (!a.sub) return '카드 밑줄 비어 있음'; if (/시니어|어르신|치매|노화|은퇴/.test(a.line + a.note + a.todo)) return '쓰지 않기로 한 말이 들어 있음'; return true; });
      await step('여행 회화: 다섯 나라 말 × 여섯 상황, 150문장', async () => { await E(() => window.omajuNav('phrase')); await W(1200);
        const langs = await E(() => [...document.querySelectorAll('[data-pbl]')].map(b => b.dataset.pbl));
        const scenes = await E(() => [...document.querySelectorAll('[data-pbs]')].map(b => b.dataset.pbs));
        if (langs.join(',') !== 'en,ja,zh,vi,th') return '나라말: ' + langs.join(',');
        if (scenes.join(',') !== 'air,move,hotel,food,shop,way') return '상황: ' + scenes.join(',');
        const bad = [];
        for (const L of langs) { await E(x => document.querySelector(`[data-pbl="${x}"]`).click(), L); await W(200);
          for (const S of scenes) { await E(x => document.querySelector(`[data-pbs="${x}"]`).click(), S); await W(150);
            const r = await E(() => [...document.querySelectorAll('.pb-row')].map(x => ({ ko: (x.querySelector('.pb-ko') || {}).textContent || '', t: (x.querySelector('.pb-t') || {}).textContent || '', rr: (x.querySelector('.pb-r') || {}).textContent || '', btn: x.querySelectorAll('[data-pb]').length })));
            if (r.length !== 5) { bad.push(`${L}/${S} ${r.length}개`); continue; }
            for (const x of r) if (!x.ko || !x.t || !x.rr || x.btn !== 2) bad.push(`${L}/${S} 빈 칸`);
            if (!/[가-힣]/.test(r[0].rr)) bad.push(`${L}/${S} 한글 발음 없음`); } }
        return !bad.length || bad.slice(0, 4).join(' / '); });
      await step('오늘의 한 권: 책 한 권이 제대로 펼쳐짐', async () => { await E(() => window.omajuNav('book')); await W(800);
        const r = await E(() => { const b = document.querySelector('.bk'); if (!b) return { none: true };
          return { tag: (document.getElementById('d-tag') || {}).textContent || '', title: (b.querySelector('.bk-title') || {}).textContent || '', who: (b.querySelector('.bk-who') || {}).textContent || '',
            blurb: ((b.querySelector('.bk-blurb') || {}).textContent || '').length, scene: ((b.querySelector('.bk-scene') || {}).textContent || '').length,
            why: !!b.querySelector('.bk-why'), links: [...b.querySelectorAll('.bk-go a')].map(a => a.href), note: !!b.querySelector('.bk-note') }; });
        if (r.none) return '책이 안 보임';
        if (r.tag !== '오늘의 한 권') return '이름표: ' + r.tag;
        if (!r.title || !r.who) return JSON.stringify(r);
        if (r.blurb < 60 || r.scene < 40) return `소개 ${r.blurb}자 · 대목 ${r.scene}자`;
        if (r.links.length < 3 || !r.links.some(u => /kyobobook/.test(u)) || !r.links.some(u => /aladin/.test(u))) return '서점 고리: ' + r.links.length;
        return (r.why && r.note) || JSON.stringify({ why: r.why, note: r.note }); });
      await step('오늘의 추천 음악: 한 곡 · 눌러 듣기 · 닫으면 멎음', async () => { await E(() => window.omajuNav('pick')); await W(1200);
        const r = await E(() => ({ t: (document.querySelector('.pk-title') || {}).textContent || '', v: !!document.querySelector('.pk-vid'), hook: (document.querySelector('[data-open="pick"] h3') || {}).textContent || '' }));
        if (!r.t || !r.v) return JSON.stringify(r);
        await E(() => document.querySelector('.pk-vid').click()); await W(600);
        const on = await E(() => !!document.querySelector('#modal iframe')); await closeM(); await W(400);
        const left = await E(() => !!document.querySelector('#modal iframe'));
        return (on && !left && r.hook === r.t) || JSON.stringify({ ...r, on, left });
      });
      await step('이번 주 무엇을 볼까: 예고편 눌러 보기 · 닫으면 멎음', async () => { await E(() => window.omajuNav('show')); await W(600);
        await E(() => { const b = document.createElement('button'); b.className = 'sw-vid'; b.dataset.swv = 'TESTvid0001'; b.dataset.swt = '시험 예고편'; b.id = 'sw-test'; document.getElementById('show-body').prepend(b); b.click(); }); await W(600);
        const on = await E(() => { const f = document.querySelector('#modal iframe'); return f ? f.src : ''; });
        await closeM(); await W(400);
        const left = await E(() => !!document.querySelector('#modal iframe[src*="TESTvid0001"]'));
        await E(() => { const b = document.getElementById('sw-test'); b && b.remove(); });
        return (/TESTvid0001/.test(on) && !left) || JSON.stringify({ on, left });
      });
      await step('이번 주 무엇을 볼까: 세 칸 · 지역 바꾸기', async () => { await E(() => window.omajuNav('show')); await W(900);
        const tabs = await E(() => [...document.querySelectorAll('[data-sw]')].map(b => b.dataset.sw));
        if (tabs.join(',') !== 'movie,stage,exhibit') return '칸: ' + tabs.join(',');
        await E(() => document.querySelector('[data-sw="movie"]').click()); await W(400);
        const mv = await E(() => [...document.querySelectorAll('.sw-row')].map(r => ({ t: (r.querySelector('b') || {}).textContent || '', meta: (r.querySelector('.sw-meta') || {}).textContent || '', link: !!r.querySelector('.linkbtn') })));
        if (mv.length < 2 || !mv.every(x => x.t && x.link)) return '극장: ' + JSON.stringify(mv).slice(0, 120);
        await E(() => document.querySelector('[data-sw="stage"]').click()); await W(500);
        const rs = await E(() => [...document.querySelectorAll('[data-swr]')].map(b => b.dataset.swr));
        if (rs.length < 2) return '지역 ' + rs.length;
        const first = await E(() => (document.querySelector('.sw-row b') || {}).textContent || '');
        await E(r => document.querySelector(`[data-swr="${r}"]`).click(), rs[1]); await W(500);
        const after = await E(() => ({ on: (document.querySelector('[data-swr][aria-pressed="true"]') || {}).textContent || '', t: (document.querySelector('.sw-row b') || {}).textContent || '', note: (document.querySelector('#show-body .note') || {}).textContent || '' }));
        if (after.on !== rs[1]) return '지역 안 바뀜: ' + after.on;
        if (!after.t && !/모으는/.test(after.note)) return '바꾼 지역이 빈 화면';
        await E(() => document.querySelector('[data-sw="exhibit"]').click()); await W(400);
        const ex = await E(() => document.querySelectorAll('.sw-row').length || /모으는/.test((document.querySelector('#show-body .note') || {}).textContent || ''));
        return (first !== null && !!ex) || JSON.stringify({ first, ex }); });
      await step('오늘의 산: 지역 바꾸기 · 몸 챙기는 요령', async () => { await E(() => window.omajuNav('hike')); await W(900);
        const rs = await E(() => [...document.querySelectorAll('[data-hkr]')].map(b => b.dataset.hkr));
        const note = await E(() => (document.querySelector('#hike-body .note') || {}).textContent || '');
        if (!rs.length) return /모으고/.test(note) || '지역도 안내도 없음';
        const a = await E(() => [...document.querySelectorAll('#hike-body .sw-row')].map(r => ({
          t: (r.querySelector('b') || {}).textContent || '', meta: (r.querySelector('.sw-meta') || {}).textContent || '',
          care: (r.querySelector('.sw-tip') || {}).textContent || '', link: !!r.querySelector('.linkbtn') })));
        if (!a.length || !a.every(x => x.t && x.link)) return '첫 지역: ' + JSON.stringify(a).slice(0, 140);
        if (!a.some(x => x.care)) return '몸 챙기는 요령이 하나도 없음';
        if (rs.length > 1) {
          await E(r => document.querySelector(`[data-hkr="${r}"]`).click(), rs[1]); await W(500);
          const on = await E(() => (document.querySelector('[data-hkr][aria-pressed="true"]') || {}).textContent || '');
          if (on !== rs[1]) return '지역 안 바뀜: ' + on;
        }
        return true; });
      await step('여행: 네 칸(회화·해외 골프·관광·자유여행) 오가기', async () => { await E(() => window.omajuNav('phrase')); await W(800);
        const tabs = await E(() => [...document.querySelectorAll('[data-trv]')].map(b => b.dataset.trv));
        if (tabs.join(',') !== 'talk,golf,tour,free') return '칸: ' + tabs.join(',');
        const out = {};
        for (const k of ['golf', 'tour', 'free']) {
          await E(x => document.querySelector(`[data-trv="${x}"]`).click(), k); await W(400);
          out[k] = await E(() => { const b = document.querySelector('#phrase-body .trv-band');
            return { on: (document.querySelector('[data-trv][aria-pressed="true"]') || {}).textContent || '',
              rows: document.querySelectorAll('#phrase-body .sw-row').length,
              note: (document.querySelector('#phrase-body .note') || {}).textContent || '',
              band: b ? b.dataset.band : '', h: b ? Math.round(b.getBoundingClientRect().height) : 0,
              pb: !!document.querySelector('#phrase-body .pb'), shots: document.querySelectorAll('#phrase-body .sw-row .sw-shot').length }; });
          if (out[k].pb) return k + ' 칸인데 회화가 보임';
          // 칸마다 사진이 다 갖춰지면 맨 위 띠는 빼는 것이 맞다 (app.js trvHtml, 2026-10-20)
          const allShots = out[k].rows && out[k].shots === out[k].rows;
          if (!allShots && out[k].band !== k) return k + ' 칸인데 띠 사진이 ' + out[k].band;
          if (!allShots && out[k].h < 60) return k + ' 띠 사진 높이 ' + out[k].h;
          if (!out[k].rows && !/모으고/.test(out[k].note)) return k + ' 칸이 빈 화면';
        }
        await E(() => document.querySelector('[data-trv="talk"]').click()); await W(400);
        const back = await E(() => !!document.querySelector('#phrase-body .pb'));
        return back || ('회화로 못 돌아옴 ' + JSON.stringify(out)); });
      await step('여행 회화: 표지 제목이 앱 용어가 아님', async () => { await E(() => window.omajuNav('phrase')); await W(800); const r = await E(() => { const h = document.getElementById('ch-head'); const t = document.getElementById('d-title'); return { tag: (document.getElementById('d-tag') || {}).textContent || '', title: (t || {}).textContent || '' }; }); if (/추천 요청|undefined|null/.test(r.title)) return '제목: ' + r.title; return (/여행/.test(r.title) && r.tag === '여행') || JSON.stringify(r); });
      await step('여행 회화: 태국어 남녀 말끝 안내', async () => { await E(() => document.querySelector('[data-trv="talk"]').click()); await W(300); await E(() => document.querySelector('[data-pbl="th"]').click()); await W(300); const tip = await E(() => (document.querySelector('.pb-tip') || {}).textContent || ''); await E(() => document.querySelector('[data-pbl="en"]').click()); await W(200); const none = await E(() => !document.querySelector('.pb-tip')); return (/크랍/.test(tip) && /카/.test(tip) && none) || JSON.stringify({ tip, none }); });
      await step('여행 회화: 듣기·천천히 눌러 보기', async () => { await E(() => { window.__said = []; const S = window.speechSynthesis; if (S) { window.__realSpeak = S.speak.bind(S); S.speak = u => window.__said.push({ t: u.text, lang: u.lang, rate: u.rate }); } }); await E(() => document.querySelector('[data-pbl="vi"]').click()); await W(300); await E(() => document.querySelector('[data-pbs="way"]').click()); await W(300); await E(() => document.querySelectorAll('.pb-row')[0].querySelector('[data-rate="1"]').click()); await W(200); await E(() => document.querySelectorAll('.pb-row')[0].querySelector('[data-rate="0.65"]').click()); await W(200); const said = await E(() => { const S = window.speechSynthesis; if (S && window.__realSpeak) S.speak = window.__realSpeak; return window.__said; }); return (said.length === 2 && said[0].lang === 'vi-VN' && said[0].rate === 1 && said[1].rate === 0.65 && /đâu|Đây/.test(said[0].t)) || JSON.stringify(said); });
      await step('회화: 듣기', async () => { await E(() => window.omajuNav('phrase')); await W(600); await E(() => document.querySelector('[data-trv="talk"]').click()); await W(300); await E(() => document.querySelector('[data-say]').click()); await W(500); return (await E(() => window.__spoke.length)) > 0 || '소리 안 남'; });
      await step('내 고향 둘러보기: 두 칸 · 말하기 · 라이브캠', async () => { await E(() => window.omajuNav('home')); await W(900);
        const t = await E(() => [...document.querySelectorAll('[data-ht]')].map(b => b.dataset.ht));
        if (t.join(',') !== 'road,cam') return '칸: ' + t.join(',');
        const road = await E(() => ({ form: !!document.getElementById('ht-form'), mic: !!document.getElementById('ht-mic'), soon: !!document.querySelector('.ht-soon') }));
        if (!road.soon && !(road.form && road.mic)) return '로드뷰 칸: ' + JSON.stringify(road);
        await E(() => document.querySelector('[data-ht="cam"]').click()); await W(600);
        const camOn = await E(() => { const f = document.querySelector('.ht-cam iframe'); return { soon: !!document.querySelector('.ht-soon'), src: f ? f.getAttribute('src') : '', regions: [...document.querySelectorAll('[data-htr]')].map(b => b.dataset.htr), spots: document.querySelectorAll('[data-htc]').length }; });
        if (camOn.soon) return true;   // 라이브캠을 아직 안 넣었으면 '준비 중'이 맞다
        if (!/youtube\.com\/embed\/(live_stream\?channel=UC|[\w-]{8,})/.test(camOn.src)) return '라이브캠 주소: ' + camOn.src;
        if (camOn.regions.length < 2) return '권역 ' + camOn.regions.join(',');
        // 권역을 바꾸면 화면도 바뀌어야 한다
        const other = camOn.regions[1];
        await E(r => document.querySelector(`[data-htr="${r}"]`).click(), other); await W(500);
        const after = await E(() => ({ src: (document.querySelector('.ht-cam iframe') || {}).src || '', cap: (document.querySelector('.ht-cap b') || {}).textContent || '' }));
        if (!after.cap || after.src === camOn.src) return '권역을 바꿔도 그대로: ' + after.cap;
        return true; });
      await step('내 고향: 로드뷰 칸 열림 (지도 키 들어감)', async () => { await E(() => window.omajuNav('home')); await W(700); await E(() => { const b = document.querySelector('[data-ht="road"]'); if (b) b.click(); }); await W(500);
        const r = await E(() => ({ soon: !!document.querySelector('.ht-soon'), view: !!document.getElementById('ht-view'), q: !!document.getElementById('ht-q'), mic: !!document.getElementById('ht-mic'), by: [...document.querySelectorAll('.ht-by')].some(p => /카카오/.test(p.textContent)) }));
        if (r.soon) return '아직 준비 중 — 지도 키가 안 들어감';
        return (r.view && r.q && r.mic && r.by) || JSON.stringify(r); });
      await step('나들이: 지역 바꾸기', async () => { await E(() => window.omajuNav('outing')); await W(700); const rs = await E(() => [...document.querySelectorAll('[data-region]')].map(b => b.dataset.region)); if (rs.length < 2) return `지역 ${rs.length}개`; await E(r => document.querySelector(`[data-region="${r}"]`).click(), rs[1]); await W(300); const t = await E(() => document.getElementById('outing-title').textContent); const items = await E(() => document.querySelectorAll('#outing-body .ot-row').length); return (t.includes(rs[1]) && items > 0) || `${t}, ${items}`; });
      await step('오늘 PLAY 차례 · 심리 테스트→사천성→1 to 50→스도쿠→말모이', async () => { await E(() => window.omajuNav('play')); await W(700); const got = await E(() => [...document.querySelectorAll('#play-root [data-go]')].map(b => b.dataset.go)); const want = ['psy', 'shisen', 'num50', 'sudoku', 'malmoi']; return got.join(',') === want.join(',') || got.join(','); });
      await step('운세: 수필이 아니라 운세 꼴', async () => { await E(() => window.omajuNav('fortune')); await W(700); await E(() => { const b = document.querySelector('#zodiac [data-z]'); if (b) b.click(); }); await W(500); const r = await E(() => { const f = document.getElementById('fortune'); const rows = [...f.querySelectorAll('.fo-row b')].map(b => b.textContent.trim()); return { total: (f.querySelector('.fo-total') || {}).textContent || '', rows, care: !!f.querySelector('.fo-care'), lucky: f.querySelectorAll('.fo-lucky span').length }; }); const need = ['하는 일', '사람', '지갑', '조심할 것', '해 보기']; const missing = need.filter(k => !r.rows.includes(k)); if (missing.length) return '빠진 칸: ' + missing.join(','); if (!/날입니다|좋습니다|낫습니다|필요한|합니다/.test(r.total)) return '총운이 판단 문장이 아님: ' + r.total.slice(0, 40); return (r.care && r.lucky >= 3) || JSON.stringify({ care: r.care, lucky: r.lucky }); });
      // 심리 테스트 (대표 2026-10-23): 목록 → 프사 읽기(결과·도감·인사 카드 연결) → 보기 고르는 테스트 셋 → 뒤로 가기
      await step('심리 테스트 · 목록에 네 가지', async () => { await E(() => window.omajuNav('g1')); await W(300); await E(() => window.omajuNav('play')); await W(400); await E(() => document.querySelector('#play-root [data-go="psy"]').click()); await W(1200); const got = await E(() => [...document.querySelectorAll('#psy-root [data-go]')].map(b => b.dataset.go).join(',')); return got.startsWith('psa,pt-talk,pt-wall,pt-trip,pt-karaoke') || got; });
      await step('심리 테스트 · 프사 읽기 결과·도감', async () => {
        await E(() => { try { localStorage.removeItem('omaju.psa.seen'); } catch (e) {} document.querySelector('#psy-root [data-go="psa"]').click(); }); await W(1200);
        await E(() => document.querySelector('#psa-root [data-go]').click()); await W(300);
        for (const v of ['kin', 'still', 'empty']) { await E(v => document.querySelector(`#psa-root [data-v="${v}"]`).click(), v); await W(250); }
        const r = await E(() => ({ name: (document.querySelector('#psa-root .psa-res h2') || {}).textContent, ask: !!document.querySelector('#psa-root [data-copyask]'), card: !!document.querySelector('#psa-root [data-cg] [data-copy]'), seen: JSON.parse(localStorage.getItem('omaju.psa.seen') || '[]') }));
        if (r.name !== '든든한 울타리형' || !r.ask || !r.card || r.seen.join() !== 'kin-old') return JSON.stringify(r);
        await E(() => document.querySelector('#psa-root .psa-row [data-dex]').click()); await W(300);
        const on = await E(() => document.querySelectorAll('#psa-root .psa-cell.on').length + '/' + document.querySelectorAll('#psa-root .psa-cell').length);
        return on === '1/12' || '도감 ' + on;
      });
      await step('심리 테스트 · 그분께 보낼 카드가 그 자리에서 열림', async () => { await E(() => document.querySelector('#psa-root [data-go]').click()); await W(300); for (const v of ['land', 'week', 'big', 'quote']) { await E(v => document.querySelector(`#psa-root [data-v="${v}"]`).click(), v); await W(250); } const n = await E(() => document.querySelectorAll('#psa-root [data-cg] [data-copy]').length); await E(() => document.querySelector('#psa-root [data-cg] [data-copy]').click()); await W(2500); const r = await E(() => ({ h: location.hash, m: !!document.querySelector('#card-share, #card-box, #card-h') })); return (n === 4 && r.h === '#psa' && r.m) || JSON.stringify({ n, ...r }); });
      await step('심리 테스트 · 세 가지 끝까지·지난 결과', async () => {
        const bad = [];
        for (const [k, picks, want] of [['pt-wall', [1, 1, 1, 1], '떠날 궁리 중인 사람'], ['pt-talk', [2, 1, 1, 1], '꾹꾹 눌러 쓰는 사람'], ['pt-trip', [2, 0, 2, 1], '모두의 가방을 챙기는 사람'], ['pt-karaoke', [2, 3, 2, 0], '흥 담당']]) {
          await E(() => window.omajuNav('play')); await W(300); await E(() => window.omajuNav('psy')); await W(800); await E(k => document.querySelector(`#psy-root [data-go="${k}"]`).click(), k); await W(1000);
          await E(k => document.querySelector(`#${k}-root [data-go]`).click(), k); await W(250);
          for (const v of picks) { await E(([k, v]) => document.querySelector(`#${k}-root [data-o="${v}"]`).click(), [k, v]); await W(200); }
          const got = await E(k => (document.querySelector(`#${k}-root .psa-res h2`) || {}).textContent, k); if (got !== want) bad.push(`${k}=${got}`);
        }
        await E(() => window.omajuNav('play')); await W(300); await E(() => window.omajuNav('psy')); await W(800);
        const last = await E(() => document.querySelectorAll('#psy-root .pt-map li').length);
        return (!bad.length && last === 4) || (bad.join(' ') + ' 마음지도 ' + last);
      });
      await step('심리 테스트 · 뒤로 가기 단계', async () => { await E(() => document.querySelector('#psy-root [data-go="pt-talk"]').click()); await W(800); await E(() => history.back()); await W(700); const a = await E(() => location.hash); await E(() => history.back()); await W(700); const b = await E(() => location.hash); return (a === '#psy' && b === '#play') || `${a} → ${b}`; });
      await step('놀이 4종 열림', async () => { const bad = []; for (const g of ['malmoi', 'shisen', 'num50', 'sudoku']) { await E(() => window.omajuNav('g1')); await W(300); await E(() => window.omajuNav('play')); await W(400); await E(g => window.omajuNav(g), g); await W(1500); const n = await E(g => (document.getElementById({ malmoi: 'mm-root', shisen: 'ss-root', num50: 'n5-root', sudoku: 'sd-root' }[g]) || {}).innerHTML.length || 0, g); if (n < 200) bad.push(g); } return !bad.length || '안 열림 ' + bad; });
      await step('놀이 순위 보기 창', async () => { await E(() => document.querySelector('[data-rank]').click()); await W(800); const t = await modalText(); await closeM(); return /순위/.test(t) || t.slice(0, 40); });
      // 달력은 접힌 채로 시작한다(운영자 2026-10-21 밤) — 눌러서 폈다 다시 접히는지까지 본다
      await step('수첩: 달력 폈다 접기 · 날짜 고르기', async () => { await E(() => window.omajuNav('g4')); await W(700);
        const first = await E(() => document.getElementById('nb-calbtn').getAttribute('aria-expanded'));
        await E(() => document.getElementById('nb-calbtn').click()); await W(300);
        const shut = await E(() => document.getElementById('nb-calbtn').getAttribute('aria-expanded'));
        await E(() => document.getElementById('nb-calbtn').click()); await W(300);
        const open = await E(() => document.getElementById('nb-calbtn').getAttribute('aria-expanded'));
        await E(() => { const d = document.querySelectorAll('[data-cal]'); d[Math.min(10, d.length - 1)].click(); }); await W(300);
        const day = await E(() => !!document.querySelector('.cal-day'));
        // 폈다가 나갔다 다시 들어오면 다시 접혀 있어야 한다 (운영자 2026-10-21 밤)
        await E(() => document.getElementById('nb-calbtn').click()); await W(300);
        await E(() => window.omajuNav('g1')); await W(500);
        await E(() => window.omajuNav('g4')); await W(600);
        const again = await E(() => document.getElementById('nb-calbtn').getAttribute('aria-expanded'));
        return (first === 'false' && shut === 'true' && open === 'false' && day && again === 'false') || `처음 ${first}, 폄 ${shut}, 접음 ${open}, 날짜 ${day}, 다시 ${again}`; });
      await step('수첩: 나의 노트 쓰기 → 펼쳐 읽기 → 고치기 → 지우기', async () => {
        await E(() => window.omajuNav('g4')); await W(600);
        await E(() => document.querySelector('.nb-hand[data-kind="note"]').click()); await W(400);
        await E(() => { document.getElementById('nb-title').value = '산악회 모임';
          document.getElementById('nb-text').value = '매월 둘째 토요일 아침 일곱 시 사당역 1번 출구';
          document.getElementById('nb-save').click(); }); await W(900);
        await E(() => { const m = document.getElementById('modal'); if (m) document.getElementById('modal-x').click(); }); await W(300);
        await E(() => document.querySelector('.nb-open[data-nbopen="note"]').click()); await W(500);
        const listed = await E(() => [...document.querySelectorAll('#nb-listbox .nt-head b')].some(x => x.textContent === '산악회 모임'));
        if (!listed) return '목록에 안 보임';
        await E(() => document.querySelector('#nb-listbox .nt-head').click()); await W(300);
        const body = await E(() => (document.querySelector('#nb-listbox .nt-body') || {}).textContent || '');
        if (!/사당역/.test(body)) return '펼쳐도 내용이 없음: ' + body.slice(0, 30);
        await E(() => document.querySelector('#nb-listbox [data-nt-edit]').click()); await W(400);
        const hasTitle = await E(() => (document.getElementById('nb-title') || {}).value || '');
        await E(() => { const m = document.getElementById('modal-x'); if (m) m.click(); }); await W(500);
        await E(() => { const o = document.querySelector('.nb-open[data-nbopen="note"]'); if (o) o.click(); }); await W(600);
        await E(() => { const h = document.querySelector('#nb-listbox .nt-head'); if (h) h.click(); }); await W(600);
        const hasRm = await E(() => !!document.querySelector('#nb-listbox [data-rm]'));
        if (!hasRm) return '펼쳐도 지우기 단추가 없음';
        await E(() => document.querySelector('#nb-listbox [data-rm]').click()); await W(600);
        await E(() => { const y = document.getElementById('nb-rm-yes'); if (y) y.click(); }); await W(1500);
        const gone = await E(() => ![...document.querySelectorAll('#nb-listbox .nt-head b')].some(x => x.textContent === '산악회 모임'));
        await E(() => { const m = document.getElementById('modal-x'); if (m) m.click(); }); await W(300);
        return (hasTitle === '산악회 모임' && gone) || `고치기 제목 ${hasTitle}, 지워짐 ${gone}`; });
      await step('수첩: 메모를 노트로 옮기기 · 노트 맨 위에 두기', async () => {
        await E(() => window.omajuNav('g4')); await W(600);
        await E(() => document.querySelector('.nb-hand[data-kind="memo"]').click()); await W(400);
        await E(() => { document.getElementById('nb-text').value = '옮길 메모'; document.getElementById('nb-save').click(); }); await W(1100);
        await E(() => { const x = document.getElementById('modal-x'); if (x) x.click(); }); await W(300);
        await E(() => document.querySelector('.nb-open[data-nbopen="memo"]').click()); await W(600);
        const row = await E(() => { const r = [...document.querySelectorAll('#nb-listbox .nb-item')].find(x => x.textContent.includes('옮길 메모')); if (!r) return false; r.querySelector('[data-tonote]').click(); return true; });
        if (!row) return '노트로 단추가 없음';
        await W(500);
        await E(() => { document.getElementById('nb-title').value = '옮긴 노트'; document.getElementById('nb-save').click(); }); await W(1600);
        await E(() => { const x = document.getElementById('modal-x'); if (x) x.click(); }); await W(300);
        await E(() => document.querySelector('.nb-open[data-nbopen="memo"]').click()); await W(600);
        const memoGone = await E(() => ![...document.querySelectorAll('#nb-listbox .nb-txt')].some(x => x.textContent === '옮길 메모'));
        await E(() => { const x = document.getElementById('modal-x'); if (x) x.click(); }); await W(300);
        await E(() => document.querySelector('.nb-open[data-nbopen="note"]').click()); await W(600);
        const noteThere = await E(() => [...document.querySelectorAll('#nb-listbox .nt-head b')].some(x => x.textContent === '옮긴 노트'));
        if (!noteThere) return '노트로 안 옮겨짐';
        // 맨 위에 두기: 가장 아래 노트를 고정하면 첫 줄로 올라온다
        const last = await E(() => { const hs = [...document.querySelectorAll('#nb-listbox .nt-head')]; const h = hs[hs.length - 1]; const t = h.querySelector('b').textContent; h.click(); return t; }); await W(400);
        await E(() => { const b2 = document.querySelector('#nb-listbox [data-nt-pin]'); if (b2) b2.click(); }); await W(1500);
        const first = await E(() => (document.querySelector('#nb-listbox .nt-head b') || {}).textContent || '');
        const pinned = await E(() => !!document.querySelector('#nb-listbox .nt-pin'));
        await E(() => { const x = document.getElementById('modal-x'); if (x) x.click(); }); await W(300);
        return (memoGone && first === last && pinned) || `메모지워짐 ${memoGone}, 맨위 ${first} (바란 것 ${last}), 표시 ${pinned}`; });
      await step('수첩: 노트가 쌓이면 찾기로 걸러진다', async () => {
        await E(() => window.omajuNav('g4')); await W(600);
        for (const t of ['버스 노선', '치과 전화번호', '관리비 계좌', '우산 둔 곳', '와이파이 비밀번호']) {
          await E(() => document.querySelector('.nb-hand[data-kind="note"]').click()); await W(350);
          await E(t => { document.getElementById('nb-title').value = t; document.getElementById('nb-text').value = t + ' 적어 둠'; document.getElementById('nb-save').click(); }, t); await W(900);
          await E(() => { const x = document.getElementById('modal-x'); if (x) x.click(); }); await W(250);
        }
        await E(() => document.querySelector('.nb-open[data-nbopen="note"]').click()); await W(700);
        const shown = await E(() => { const f = document.getElementById('nb-find'); return f && !f.hidden; });
        if (!shown) return '찾기 칸이 안 보임';
        await E(() => { const f = document.getElementById('nb-find'); f.value = '버스'; f.dispatchEvent(new Event('input')); }); await W(400);
        const left = await E(() => [...document.querySelectorAll('#nb-listbox .nt-row')].filter(x => !x.hidden).map(x => x.textContent.trim().replace(/[▾▴]/g, '')));
        await E(() => { const f = document.getElementById('nb-find'); f.value = '없는말'; f.dispatchEvent(new Event('input')); }); await W(400);
        const none = await E(() => !!document.querySelector('#nb-listbox .nb-none'));
        await E(() => { const x = document.getElementById('modal-x'); if (x) x.click(); }); await W(300);
        return (left.length === 1 && /버스/.test(left[0]) && none) || `걸린 것 ${JSON.stringify(left)}, 없음안내 ${none}`; });
      await step('수첩: 손으로 일정 적기', async () => { await E(() => document.querySelector('.nb-hand[data-kind="event"]').click()); await W(400); await E(() => { document.getElementById('nb-text').value = '치과 예약'; document.getElementById('nb-save').click(); }); await W(900); await E(() => { const m = document.getElementById('modal'); if (m) document.getElementById('modal-x').click(); }); await W(300); await E(() => document.querySelector('.nb-open[data-nbopen="event"]').click()); await W(500); const seen = await E(() => [...document.querySelectorAll('#nb-listbox .nb-txt')].some(x => x.textContent === '치과 예약')); await E(() => { const m = document.getElementById('modal-x'); if (m) m.click(); }); await W(300); return seen || '안 보임'; });
      await step('담아 두기: 코너에서 담고 → 수첩에서 읽고 → 빼기', async () => {
        await E(() => window.omajuNav('body')); await W(700);
        const b0 = await E(() => { const b = document.querySelector('#bd-body [data-save]'); return b ? { tx: b.querySelector('.sv-tx').textContent, on: b.getAttribute('aria-pressed') } : null; });
        if (!b0) return '담아 두기 단추 없음';
        if (b0.on !== 'false') return '처음부터 담긴 상태';
        await E(() => document.querySelector('#bd-body [data-save]').click()); await W(700);
        const b1 = await E(() => ({ on: document.querySelector('#bd-body [data-save]').getAttribute('aria-pressed'), tx: document.querySelector('#bd-body .sv-tx').textContent }));
        if (b1.on !== 'true') return '눌러도 담기지 않음 ' + JSON.stringify(b1);
        await E(() => window.omajuNav('g4')); await W(900);
        await E(() => { const o = document.querySelector('.nb-open[data-nbopen="save"]'); if (o) o.click(); }); await W(600);
        const list = await E(() => [...document.querySelectorAll('#nb-listbox .sv-item')].map(x => (x.querySelector('strong') || {}).textContent || ''));
        if (!list.length) return '수첩에 안 보임';
        await E(() => document.querySelector('#nb-listbox .sv-head').click()); await W(400);
        const full = await E(() => (document.querySelector('#nb-listbox .sv-full') || {}).textContent || '');
        if (full.length < 40) return '펼쳐도 내용이 없음';
        await E(() => document.querySelector('#nb-listbox [data-srm]').click()); await W(800);
        const left = await E(() => document.querySelectorAll('#nb-listbox .sv-item').length);
        if (left) return '빼도 남아 있음';
        await E(() => { const x = document.getElementById('modal-x'); if (x) x.click(); }); await W(400);
        await E(() => window.omajuNav('body')); await W(600);
        const b2 = await E(() => document.querySelector('#bd-body [data-save]').getAttribute('aria-pressed'));
        return b2 === 'false' || '뺐는데 단추가 그대로';
      });
      await step('읽어 드려요: 네 장 모두 · 코너 옮겨도 이어짐 · 장 나가면 멎음', async () => {
        if (true) return true;   // 화면에서 뺐다 (대표 2026-10-24) — 다시 켜면 이 줄을 지운다
        // 장마다 띠가 있고, 눌러 들으면 아래 띠가 뜨고, 그 장 안 코너로 가도 이어지고, 장을 나가면 멎는다
        // 장 안의 코너를 하나만 들어가 보면 빠진 코너를 못 잡는다 (2026-10-22: 정원에 들어가면 멎었다) → 전부 들어가 본다
        const CH = [['g1', ['food', 'book', 'quiz', 'luck', 'fortune', 'dream']], ['g2', ['history', 'story']], ['g5', ['follow', 'outing', 'show', 'garden', 'phrase']], ['g3', ['hike', 'move', 'mind', 'body']]];
        const bad = [];
        for (const [ch, corners] of CH) {
          await E(x => window.omajuNav(x), ch); await W(900);
          const a = await E(c => { const b = document.getElementById('rd-' + c + '-face'); return b ? { sub: document.getElementById('rd-' + c + '-sub').textContent, go: document.getElementById('rd-' + c + '-go').textContent, off: document.getElementById('rd-' + c).classList.contains('rd-off') } : null; }, ch);
          if (!a) { bad.push(ch + ': 띠 없음'); continue; }
          if (a.off) { bad.push(ch + ': 오늘 안내 못 받음'); continue; }
          if (!/분/.test(a.sub)) { bad.push(ch + ': 길이 안내 없음'); continue; }
          await E(c => document.getElementById('rd-' + c + '-face').click(), ch); await W(900);
          if (await E(() => document.getElementById('rd-bar').hidden)) { bad.push(ch + ': 아래 띠가 안 뜸'); continue; }
          let stopped = '';
          for (const corner of corners) {
            await E(x => window.omajuNav(x), corner); await W(600);
            if (await E(() => document.getElementById('rd-bar').hidden)) { stopped = corner; break; }
          }
          if (stopped) { bad.push(ch + ': ' + stopped + ' 에 들어가니 멎음'); continue; }
          await E(x => window.omajuNav(x), ch === 'g1' ? 'g2' : 'g1'); await W(700);
          if (!(await E(() => document.getElementById('rd-bar').hidden))) bad.push(ch + ': 장을 나갔는데 안 멎음');
          await E(() => { try { window.omajuRadio.stop(); } catch (e) {} }); await W(300);
        }
        await E(() => window.omajuNav('g1')); await W(400);
        return !bad.length || bad.join(' / ');
      });
      await step('아침 알림 시간 고르기 창', async () => { await E(() => window.omajuNav('g1')); await W(500); const has = await E(() => { const b = document.getElementById('push-cta'); if (!b || b.hidden) return 'none'; b.click(); return 'ok'; }); if (has === 'none') return true; await W(600); const n = await E(() => document.querySelectorAll('[data-hour]').length); await closeM(); return n === 3 || `시간 단추 ${n}`; });
      await step('내 정보 창', async () => { await E(() => document.getElementById('my').click()); await W(500); const t = await modalText(); await closeM(); return /별명|비밀번호|글자/.test(t) || t.slice(0, 40); });
      await step('로그아웃 → 다시 로그인', async () => { await E(() => document.getElementById('logout').click()); await W(800); await closeM(); const out = await E(() => !document.getElementById('login-btn').hidden); await E(() => document.getElementById('login-btn').click()); await W(400); await E(() => { const b = document.getElementById('g-login'); b && b.click(); }); await W(400); await p.fill('#l-id', 'use1960'); await p.fill('#l-pw', '123456'); await E(() => document.getElementById('l-go').click()); await W(1000); const back = await E(() => !!document.getElementById('user-nick').textContent); return (out && back) || `로그아웃 ${out}, 로그인 ${back}`; });
      await step('아이디·비밀번호 찾기 창', async () => { await E(() => document.getElementById('logout').click()); await W(800); await closeM(); await E(() => document.getElementById('login-btn').click()); await W(400); await E(() => { const b = document.getElementById('g-login'); b && b.click(); }); await W(400); await E(() => document.getElementById('l-forgot').click()); await W(500); const t = await modalText(); await closeM(); return /찾기|연락처|아이디/.test(t) || t.slice(0, 40); });
      ok('써 보기 중 화면 오류 없음', !errs.length, [...new Set(errs)].join(' / '));
      await c.close(); }
    // 8) 오늘의 오프닝: 저절로 소리 안 남, 재생·멈춤, 장면·자막 넘김, 다른 코너·앱으로 가면 멈춤, 사연 보내기
    { const c = await ctx(false); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(base + '/index.html'); await wait(p, 2000);
      const E = (fn, a) => p.evaluate(fn, a);
      const st = await E(() => { const s = document.getElementById('opening'); const a = document.getElementById('opn-audio');
        return { shown: !!s && !s.hidden && s.offsetHeight > 200, name: document.getElementById('opn-name').textContent, cap: document.getElementById('opn-cap').textContent, next: document.getElementById('opn-next').textContent,
          silent: a.paused && !a.autoplay && a.currentTime === 0, play: !document.getElementById('opn-play').hidden, heading: (document.querySelector('.opn-toc em') || {}).textContent,
          before: (() => { const o = document.getElementById('opening'), t = document.querySelector('.toc-c:not(.opn-toc)'); return !!(o && t && (o.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING)); })() }; });
      ok('오프닝: CONTENTS 위에 보임·이름표·자막·내일 예고', st.shown && st.before && /Opening/i.test(st.heading) && /윤미소/.test(st.name) && st.cap.length > 3 && /서한결/.test(st.next), JSON.stringify(st));
      ok('오프닝: 소리 저절로 안 남', st.silent && st.play);
      await E(() => document.getElementById('opening').scrollIntoView({ block: 'center' })); await wait(p, 300);
      await p.click('#opn-play'); await wait(p, 900);
      const r1 = await E(() => { const a = window.omajuOpening.audio; return { playing: !a.paused, ctrl: !document.getElementById('opn-ctrl').hidden, btn: document.getElementById('opn-ctrl').textContent }; });
      await p.click('#opn-ctrl'); await wait(p, 300); const r2 = await E(() => ({ paused: window.omajuOpening.audio.paused, btn: document.getElementById('opn-ctrl').textContent }));
      await p.click('#opn-ctrl'); await wait(p, 500); const r3 = await E(() => !window.omajuOpening.audio.paused);
      ok('오프닝: 소리 켜기 → 잠시 멈춤 → 이어 듣기', r1.playing && r1.ctrl && /멈춤/.test(r1.btn) && r2.paused && /이어/.test(r2.btn) && r3, JSON.stringify([r1, r2, r3]));
      const flow = await E(async () => { const a = window.omajuOpening.audio; const W = ms => new Promise(r => setTimeout(r, ms)); const seen = [];
        for (const t of [0.2, 2.5, 3.9, 4.8]) { Object.defineProperty(a, 'currentTime', { configurable: true, get: () => t, set() {} }); a.dispatchEvent(new Event('timeupdate')); await W(50);
          seen.push([(document.querySelector('.opn-shot.on') || {}).dataset.tag, document.getElementById('opn-cap').textContent]); }
        delete a.currentTime; return seen; });
      ok('오프닝: 말에 맞춰 장면·자막 바뀜', flow[0][0] === 'wave' && flow[1][0] === 'read' && flow[2][0] === 'laugh' && flow[3][0] === 'moved' && new Set(flow.map(x => x[1])).size === 4, JSON.stringify(flow));
      await E(() => { if (window.omajuOpening.audio.paused) window.omajuOpening.play(); }); await wait(p, 400);
      await E(() => window.omajuNav('g1')); await wait(p, 600); const r4 = await E(() => window.omajuOpening.audio.paused);
      await E(() => { history.back(); }); await wait(p, 600); await E(() => document.getElementById('opening').scrollIntoView({ block: 'center' })); await wait(p, 300);
      await E(() => window.omajuOpening.play()); await wait(p, 400);
      await E(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); await wait(p, 200); const r5 = await E(() => window.omajuOpening.audio.paused);
      await E(() => { delete document.hidden; window.omajuOpening.play(); }); await wait(p, 400); await E(() => window.scrollTo(0, document.body.scrollHeight)); await wait(p, 800); const r6 = await E(() => window.omajuOpening.audio.paused);
      ok('오프닝: 다른 코너·다른 앱·화면 밖이면 저절로 멈춤', r4 && r5 && r6, JSON.stringify({ 코너: r4, 앱: r5, 스크롤: r6 }));
      await E(() => window.scrollTo(0, 0)); await wait(p, 300);
      await E(() => document.getElementById('opn-send').click()); await wait(p, 500); const askLogin = await E(() => /로그인/.test(document.getElementById('toast').textContent));
      await E(() => { const m = document.getElementById('modal-root'); if (m) m.innerHTML = ''; });
      await p.click('#login-btn').catch(() => {}); await wait(p, 300); await p.click('#g-signup').catch(() => {}); await wait(p, 300);
      await p.fill('#s-id', 'story1960'); await p.click('#s-id-chk'); await wait(p, 200); await p.fill('#s-pw', '123456'); await p.fill('#s-nick', '사연시험'); await p.click('#s-nick-chk'); await wait(p, 200);
      await p.fill('#s-phone', '01012345672'); await p.click('#s-gender [data-g="여"]'); await p.selectOption('#s-birth', '1963'); await p.check('#s-terms'); await p.check('#s-agree'); await p.click('#s-go'); await wait(p, 900); await wait(p, 600); if (await p.$('#hi-go')) { await p.click('#hi-go'); await wait(p, 700); }   /* 구독 환영 카드 닫기 */
      await E(() => { const x = document.getElementById('modal-x'); x && x.click(); }); await wait(p, 400);
      await E(() => document.getElementById('opn-send').click()); await wait(p, 500); const form = await E(() => !!document.getElementById('opn-story'));
      await E(() => { document.getElementById('opn-story').value = '오십에 처음 혼자 떠난 여행에서 생긴 일입니다. 시험 사연.'; document.getElementById('opn-story-go').click(); }); await wait(p, 900);
      const sent = await E(() => /도착/.test(document.getElementById('toast').textContent) && !document.getElementById('opn-story'));
      ok('오프닝: 사연 보내기 (로그인 안내 → 적어서 보냄)', askLogin && form && sent && !errs.length, JSON.stringify({ askLogin, form, sent, errs }));
      await p.close();
      // 첫 곳(raw)에서 목소리 파일을 못 받아도 한 번 눌러 바로 재생되는지 (두 번째 곳으로 저절로 바꿈)
      const p2 = await c.newPage(); await p2.route(/raw\.githubusercontent\.com\/.*\.mp3/, r => r.fulfill({ status: 404, body: 'no' }));
      await p2.goto(base + '/index.html'); await wait(p2, 2000); await p2.evaluate(() => document.getElementById('opening').scrollIntoView({ block: 'center' })); await wait(p2, 300);
      await p2.click('#opn-play'); await wait(p2, 1500);
      const fb = await p2.evaluate(() => { const a = window.omajuOpening.audio; return { playing: !a.paused, src: a.currentSrc, toast: document.getElementById('toast').textContent }; });
      ok('오프닝: 첫 곳에서 파일 못 받아도 한 번 눌러 재생', fb.playing && /jsdelivr/.test(fb.src) && !/다시 눌러/.test(fb.toast), JSON.stringify(fb));
      await p2.close();
      // 자정~새벽 5시는 '어제 저녁' 오프닝 (토요일 0시 30분이면 금요일 저녁 인사)
      const p3 = await c.newPage(); const asked = [];
      await p3.addInitScript(() => { const R = Date; const F = new R(2026, 9, 17, 0, 30, 0).getTime(); const D = function (...a) { return a.length ? new R(...a) : new R(F); }; D.now = () => F; D.parse = R.parse; D.UTC = R.UTC; D.prototype = R.prototype; window.Date = D; });
      p3.on('request', r => { if (/opening\/.*\.json/.test(r.url())) asked.push(r.url()); });
      await p3.goto(base + '/index.html'); await wait(p3, 2000);
      const mid = await p3.evaluate(() => ({ who: document.getElementById('opn-who').textContent, date: document.getElementById('opn-date').textContent }));
      ok('오프닝: 자정 넘어 새벽 5시 전엔 어제 저녁 인사', /2026-10-16\.json/.test(asked[0] || '') && /저녁/.test(mid.who), JSON.stringify({ asked: asked[0], mid }));
      await p3.close();
      await c.close(); }
    }
    // 이미 로그인된 사람이 앱을 열 때 '로그인·회원가입'이나 수첩 잠금 화면이 잠깐 비치면 안 된다
    { const c = await ctx(false); const p = await c.newPage();
      await p.addInitScript(() => { globalThis.__omajuAuth = { uid: 'u_tester', email: 'tester@omaju.kr', delay: 600 }; });
      await p.addInitScript(() => {
        globalThis.__flash = { login: 0, gate: 0, chip: 0 };
        const look = () => { const l = document.getElementById('login-btn'), g = document.getElementById('nb-gate'), u = document.getElementById('user-chip');
          if (l && !l.hidden && l.offsetParent) globalThis.__flash.login++;
          if (g && !g.hidden && g.offsetParent) globalThis.__flash.gate++;
          if (u && !u.hidden) globalThis.__flash.chip++; };
        const tick = () => { look(); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      });
      await p.goto(base + '/index.html'); await wait(p, 400);
      await p.evaluate(() => { location.hash = 'g4'; }); await wait(p, 2200);
      const f = await p.evaluate(() => ({ ...globalThis.__flash, loginNow: !!document.getElementById('login-btn') && document.getElementById('login-btn').hidden, chipNow: !document.getElementById('user-chip').hidden, gateNow: document.getElementById('nb-gate').hidden }));
      ok('로그인한 채로 열면 로그인 화면이 비치지 않음', f.login === 0 && f.gate === 0 && f.chipNow && f.loginNow && f.gateNow, JSON.stringify(f));
      await c.close(); }

    // 다른 동네에 다녀오면, 단추를 누르지 않아도 지금 있는 곳 날씨로 바뀐다
    { const c = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', permissions: ['geolocation'], geolocation: { latitude: 35.1796, longitude: 129.0756 } });
      await c.route('https://www.gstatic.com/**', r => { const u = r.request().url(); const n = u.includes('firebase-app') ? 'app' : u.includes('firebase-auth') ? 'auth' : u.includes('firestore') ? 'firestore' : 'analytics'; r.fulfill({ contentType: 'application/javascript', body: n === 'firestore' ? fsStub : fs.readFileSync(path.join(STUB, n + '.js'), 'utf8') }); });
      await c.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
      await c.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"current":{"temperature_2m":17,"apparent_temperature":16,"relative_humidity_2m":55,"weather_code":2}}' }));
      await c.route('https://api.bigdatacloud.net/**', r => { const u = new URL(r.request().url()); const la = +u.searchParams.get('latitude'); r.fulfill({ contentType: 'application/json', body: JSON.stringify(la > 36 ? { city: '서울특별시', locality: '종로구' } : { city: '부산광역시', locality: '해운대구' }) }); });
      const p = await c.newPage();
      // 어제 서울에서 보던 상태로 만들어 둔다
      await p.addInitScript(() => { try { localStorage.setItem('omaju.geo', JSON.stringify([37.5665, 126.978])); localStorage.setItem('omaju.geoName', JSON.stringify('서울특별시 종로구')); } catch (e) {} });
      await p.goto(base + '/index.html'); await wait(p, 3000);
      const r = await p.evaluate(() => ({ sub: document.getElementById('wx-sub').textContent, saved: localStorage.getItem('omaju.geoName') }));
      ok('다른 동네에 가면 저절로 그곳 날씨로 바뀜', /부산/.test(r.sub) && /부산/.test(r.saved || ''), JSON.stringify(r));
      await c.close(); }

    // 꾸미는 파일을 한 번 못 받아도 글자만 쭉 나오는 맨 화면이 되지 않는다
    { const c = await ctx(false); const p = await c.newPage(); let blocked = 0;
      await c.route(/\/css\/omaju\.css/, r => { if (blocked++ === 0) return r.abort(); return r.continue(); });
      await p.goto(base + '/index.html'); await wait(p, 2500);
      const r = await p.evaluate(() => { const b = getComputedStyle(document.body); const t = document.querySelector('#tabs3'); return { bg: b.backgroundColor, sheets: document.styleSheets.length, tabsGrid: t ? getComputedStyle(t).display : '' }; });
      ok('꾸미는 파일을 못 받아도 맨 화면이 되지 않음', r.tabsGrid === 'grid' && r.sheets > 0, JSON.stringify({ ...r, blocked }));
      await c.close(); }

    // 들어갈 때 '보였다 사라지는 것'도 '늦게 나타나 아래를 미는 것'도 없어야 한다
    { const CASES = [['처음 온 사람', { seed: false }], ['로그인 · 앱으로 깔아 둔 사람', { seed: true, app: true, hello: 'in' }], ['로그인 · 브라우저', { seed: true, hello: 'in' }], ['로그아웃한 채 늘 쓰는 사람', { seed: false, hello: 'out' }]];
      for (const [who, o] of CASES) {
        const c = await ctx(false); const p = await c.newPage();
        if (o.hello) await p.addInitScript(v => { try { localStorage.setItem('omaju.hello', JSON.stringify(v === 'in' ? { s: 'in', n: '시험이' } : { s: 'out' })); } catch (e) {} }, o.hello);
        if (o.app) await p.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q); });
        if (o.seed) await p.addInitScript(() => { globalThis.__omajuAuth = { uid: 'u_tester', email: 'tester@omaju.kr', delay: 500 }; });
        await p.addInitScript(() => {
          globalThis.__cls = 0; globalThis.__clsWho = []; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { globalThis.__cls += e.value; for (const s of (e.sources || [])) { const n = s.node; if (n && n.nodeType === 1) globalThis.__clsWho.push(e.value.toFixed(4) + ' ' + n.tagName + '.' + (n.className || '').toString().slice(0, 30) + '#' + (n.id || '')); } } }).observe({ type: 'layout-shift', buffered: true });
          globalThis.__life = {};
          const key = el => el.id ? '#' + el.id : '.' + String(el.className || '').split(' ')[0];
          const look = () => { const t = Math.round(performance.now());
            for (const el of document.querySelectorAll('body [id], body [hidden]')) { if (!el.id && !el.hasAttribute('hidden')) continue;
              const on = !!el.offsetParent && !el.hidden, k = key(el), r = globalThis.__life[k] || (globalThis.__life[k] = { flips: [] });
              if (r.last === undefined) r.last = on; if (on !== r.last) { r.flips.push((on ? '보임' : '사라짐') + '@' + t); r.last = on; } }
            requestAnimationFrame(look); };
          requestAnimationFrame(look);
        });
        await p.goto(base + '/index.html'); await wait(p, 3000);
        // '보였다 사라지는 것'은 무조건 잘못. 늦게 나타나는 것은 화면이 밀리지 않으면(cls) 괜찮다.
        const r = await p.evaluate(() => ({ cls: +globalThis.__cls.toFixed(4), who: globalThis.__clsWho.slice(0, 5), big: document.documentElement.classList.contains('big'),
          bad: Object.entries(globalThis.__life).filter(([, v]) => v.flips.some(f => f.startsWith('사라짐'))).map(([k, v]) => k + ' ' + v.flips.join('→')) }));
        ok('들어갈 때 깜빡임·밀림 없음 · ' + who, r.cls <= 0.005 && !r.bad.length && r.big, JSON.stringify(r));
        await c.close(); } }

    // 앱으로 깔아 둔 사람에게 '앱 아이콘 설치하기'가 잠깐이라도 비치면 안 된다
    { const c = await ctx(false); const p = await c.newPage();
      await p.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q); });
      await p.addInitScript(() => { globalThis.__seen = 0; const tick = () => { const b = document.getElementById('install-btn'); if (b && !b.hidden && b.offsetParent) globalThis.__seen++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      await p.goto(base + '/index.html'); await wait(p, 2500);
      const r = await p.evaluate(() => ({ seen: globalThis.__seen, shown: !!document.getElementById('install-btn').offsetParent }));
      ok('깔아 둔 사람에게 설치 단추가 비치지 않음', r.seen === 0 && !r.shown, JSON.stringify(r));
      await c.close(); }
    // 아직 안 깔아 둔 사람에게는 설치 단추가 보인다
    { const c = await ctx(false); const p = await c.newPage();
      await p.goto(base + '/index.html'); await wait(p, 2000);
      const shown = await p.evaluate(() => !!document.getElementById('install-btn').offsetParent);
      ok('안 깔아 둔 사람에게는 설치 단추가 보임', shown, shown ? '' : '안 보임');
      await c.close(); }
    // 카톡 안에서 '앱 아이콘 설치하기' → 크롬으로 넘기는 단추 (대표 2026-10-23: 넘어가면 로그인이 풀렸다)
    { const c = await ctx(false); const p = await c.newPage();
      await p.addInitScript(() => { Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 KAKAOTALK 10.8.0' }); });
      await p.goto(base + '/index.html'); await wait(p, 2000);
      await p.evaluate(() => document.getElementById('install-btn').click()); await wait(p, 600);
      const h = await p.evaluate(() => { const a = document.getElementById('to-chrome'); return a ? a.getAttribute('href') : ''; });
      ok('카톡 안에서 크롬으로 넘기는 단추', /^intent:\/\/.*install=1.*package=com\.android\.chrome/.test(h), h);
      await c.close(); }
    // 블로그에서 온 표시(?from=blog)는 세고 나서 주소에서 지운다 (대표 2026-10-23)
    { const c = await ctx(false); const p = await c.newPage();
      await p.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' }); });   // 시험 브라우저는 로봇으로 보여 안 센다
      await p.goto(base + '/index.html?from=blog'); await wait(p, 2500);
      const q = await p.evaluate(() => ({ q: location.search, k: Object.keys(localStorage).some(x => x.startsWith('omaju.blog.')) }));
      ok('블로그에서 온 방문을 세고 주소를 지움', q.q === '' && q.k, JSON.stringify(q));
      await c.close(); }
    { const c = await ctx(false); const p = await c.newPage();
      await p.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' }); });
      await p.goto(base + '/index.html?from=yt'); await wait(p, 2500);
      const q = await p.evaluate(() => ({ q: location.search, k: Object.keys(localStorage).some(x => x.startsWith('omaju.yt.')) }));
      ok('유튜브에서 온 방문을 세고 주소를 지움', q.q === '' && q.k, JSON.stringify(q));
      await c.close(); }
    // 크롬에 도착하면 들고 온 로그인 표(ct)를 받아 쓰고 주소에서 지운다 (설치 안내가 먼저 지워 버리면 안 된다)
    { const c = await ctx(false); const p = await c.newPage();
      await p.addInitScript(() => { globalThis.__toasts = ''; new MutationObserver(() => { const t = document.getElementById('toast'); if (t && t.textContent) globalThis.__toasts += t.textContent + '|'; if (document.getElementById('f-nick')) globalThis.__inn = true; }).observe(document, { subtree: true, childList: true, characterData: true }); });
      await p.goto(base + '/index.html?install=1&ct=bogus'); await wait(p, 4000);
      const r = await p.evaluate(() => ({ q: location.search, inn: !!globalThis.__inn, m: (document.getElementById('modal-root') || {}).innerText, t: globalThis.__toasts }));
      ok('크롬 도착 시 로그인 표를 받아 씀', r.q === '' && r.inn, JSON.stringify(r));
      await c.close(); }

  } catch (e) { ok('시험 실행', false, e.message); }
  await b.close(); srv.close();
  const fails = results.filter(r => !r[0]).length; console.log(fails ? `\n실패 ${fails}개 — 올리지 말고 고칠 것` : '\n모두 통과'); process.exit(fails ? 1 : 0);
});
