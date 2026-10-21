// 오마주 서비스 워커: 앱 설치용. 화면과 코드는 늘 새로 받되, 못 받으면 지난번 것으로 화면을 세운다.
const VER = 'omaju-v25';   // 진행자 사진을 바꾸면 이 숫자를 올려야 휴대폰이 새 사진을 받는다 (사진은 한 번 받으면 계속 쓰므로)
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

// 화면 꾸미는 파일과 코드: 새로 받아서 쓰고, 한 벌 챙겨 둔다. 못 받으면 챙겨 둔 것으로 — 빈손으로 돌려주지 않는다
// (빈손으로 돌려주면 글자만 쭉 나오는 맨 화면이 된다. 2026-10-18)
async function freshFirst(req) {
  const c = await caches.open(VER);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res && res.ok) { try { await c.put(req, res.clone()); } catch (err) {} }
    return res;
  } catch (err) {
    const hit = (await c.match(req)) || (await c.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    throw err;
  }
}
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return;
  if (/\/img\/hosts\//.test(u.pathname)) { e.respondWith(freshFirst(e.request)); return; }   // 진행자 사진은 늘 새로
  if (/\.(jpg|png)$/.test(u.pathname)) {
    e.respondWith(caches.open(VER).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; }))));
  } else {
    e.respondWith(freshFirst(e.request).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || new Response('', { status: 504 }))));
  }
});

// 아침 알림: 서버(FCM)에서 온 메시지를 알림으로 띄우고, 누르면 오마주를 연다.
self.addEventListener('push', e => {
  let m = {}; try { m = e.data ? e.data.json() : {}; } catch (err) {}
  const d = m.data || (m.notification ? { title: m.notification.title, body: m.notification.body } : {});
  e.waitUntil(self.registration.showNotification(d.title || '오마주', { body: d.body || '오늘 아침도 반갑습니다.', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'omaju-morning', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { for (const w of ws) { if (w.url.startsWith(self.registration.scope)) { w.navigate(url); return w.focus(); } } return clients.openWindow(url); }));
});
