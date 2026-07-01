const CACHE_NAME = 'maze-game-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
  // 必要に応じて画像などもここに追加
];

// インストール時にファイルをキャッシュする
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

// オフライン時にキャッシュから返す
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});
