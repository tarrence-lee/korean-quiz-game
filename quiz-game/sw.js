const CACHE = 'quiz-v4';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  './data/questions.js',
  // 데이터 JSON도 캐싱하여 번들이 없을 때의 오프라인 폴백 경로(fetchJSON)가 동작하도록 한다
  './data/history.json',
  './data/science.json',
  './data/geography.json',
  './data/general.json',
  './data/iq.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// stale-while-revalidate: 캐시를 즉시 응답하되, 백그라운드에서 네트워크로 갱신한다.
// 이렇게 하면 CACHE 버전을 올리지 않아도 다음 방문 시 최신 콘텐츠가 반영된다.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          // 동일 출처의 정상 응답만 캐시에 갱신
          if (res && res.ok && new URL(e.request.url).origin === self.location.origin) {
            cache.put(e.request, res.clone());
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
