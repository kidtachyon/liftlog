// Keeps the app working at the gym with weak or no signal.
// The app page itself: try the network first (so updates show right away),
// but fall back to the saved copy if the network is slow or down.
// Icons and other files: serve the saved copy and refresh it in the background.
const CACHE = 'liftlog-v2';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms){ return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate'){
    e.respondWith(caches.open(CACHE).then(async cache => {
      try {
        const res = await Promise.race([fetch(req), timeout(3000)]);
        if (res.ok) cache.put('./index.html', res.clone());
        return res;
      } catch (err) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    }));
    return;
  }

  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, {ignoreSearch: true});
    const fresh = fetch(req)
      .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
      .catch(() => hit);
    return hit || fresh;
  }));
});
