const CACHE_NAME = 'escala-dniz-v3';
const APP_URLS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './dniz.png'
];
const CDN_URLS = [
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone@7.23.5/babel.min.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // Cache critical assets
                return cache.addAll([...APP_URLS, ...CDN_URLS]);
            })
    );
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // Strategy for CDNs: Cache First (they don't change often)
    if (CDN_URLS.some(url => requestUrl.href.includes(url)) || requestUrl.hostname.includes('gstatic.com') || requestUrl.hostname.includes('unpkg.com')) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // Strategy for App Files: Network First (try network, fall back to cache)
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // If network works, update cache and use it
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If network fails, try cache
                return caches.match(event.request);
            })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
            .then(() => self.clients.claim())
    );
});
