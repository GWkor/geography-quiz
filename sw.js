const STATIC_CACHE = 'geography-quiz-static-v6';
const PAGE_CACHE = 'geography-quiz-pages-v6';

const STATIC_ASSETS = [
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

const OFFLINE_PAGE = './index.html';

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)),
      caches.open(PAGE_CACHE).then(cache => cache.add(OFFLINE_PAGE))
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(
            key =>
              key.startsWith('geography-quiz-') &&
              key !== STATIC_CACHE &&
              key !== PAGE_CACHE
          )
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;

  // HTML / page navigation:
  // 항상 최신 네트워크 버전을 먼저 확인
  if (
    event.request.mode === 'navigate' ||
    (
      sameOrigin &&
      (
        url.pathname.endsWith('/index.html') ||
        url.pathname.endsWith('/geography-quiz/')
      )
    )
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(PAGE_CACHE).then(cache => {
              cache.put(OFFLINE_PAGE, copy);
            });
          }

          return response;
        })
        .catch(() => caches.match(OFFLINE_PAGE))
    );

    return;
  }

  // 아이콘/manifest 등 정적 파일:
  // 캐시를 먼저 보여주고 백그라운드에서 최신 버전으로 갱신
  if (sameOrigin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request)
          .then(response => {
            if (response && response.ok) {
              const copy = response.clone();

              caches.open(STATIC_CACHE).then(cache => {
                cache.put(event.request, copy);
              });
            }

            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
  }
});
