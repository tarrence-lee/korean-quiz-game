const CACHE = 'quiz-v6';

// 앱 셸: 이게 없으면 오프라인에서 앱이 아예 동작하지 않으므로 하나라도 실패하면 설치 실패로 처리한다.
// data/questions.js가 500문제 단일 데이터 소스(window.__QUIZ_DATA__)다.
// 개별 카테고리 JSON은 항상 이 번들로 대체되므로(app.js의 fetchJSON이 번들 우선) 캐싱하지 않는다
// — 동일 데이터를 약 2배로 캐싱하던 이중화를 제거한다.
const CRITICAL_ASSETS = [
  './',                 // start_url(manifest) — 오프라인 내비게이션 진입점
  './app.js',
  './style.css',
  './data/questions.js',
];

// 선택 자산: 없어도 핵심 플레이는 가능하므로 개별 실패를 허용한다(부분 실패로 오프라인 전체가 깨지지 않게).
const OPTIONAL_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // 필수 자산은 원자적으로 캐싱(무결성 보장).
      await cache.addAll(CRITICAL_ASSETS);
      // 선택 자산은 개별적으로 시도하고 실패는 무시(allSettled).
      await Promise.allSettled(OPTIONAL_ASSETS.map(a => cache.add(a)));
    }).then(() => self.skipWaiting())
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
