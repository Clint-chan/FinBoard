const CACHE_NAME = 'fintell-react-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

// 安装时缓存静态资源
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 监听消息：支持清理缓存
self.addEventListener('message', (e) => {
  if (e.data === 'clearCache') {
    caches.keys().then((keys) => {
      Promise.all(keys.map((k) => caches.delete(k))).then(() => {
        e.source.postMessage('cacheCleared');
      });
    });
  }
});

// 请求拦截：网络优先，失败时用缓存
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 行情数据：尝试网络，失败返回缓存的上次数据
  if (url.hostname === 'qt.gtimg.cn' || url.hostname.includes('eastmoney.com')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('last-quotes', clone));
          return res;
        })
        .catch(() => caches.match('last-quotes'))
    );
    return;
  }

  // 静态资源：网络优先，失败用缓存
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
