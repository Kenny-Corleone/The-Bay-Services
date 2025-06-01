self.addEventListener('install', e => {
  console.log('Service Worker: Installed');
  e.waitUntil(
    caches.open('bay-report-cache-v1').then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './manifest.json',
        'https://thebayservices.com/wp-content/uploads/2022/07/bay-services-logo.png'
      ]);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
