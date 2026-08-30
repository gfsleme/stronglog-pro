/* StrongLog Pro - Service Worker v5.1 */
/* Release Date: 2026-08-23 */

const CACHE_NAME = 'stronglog-pro-v5.3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './data/exercises.min.json',
  './data/muscle_ontology.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/dexie@latest/dist/dexie.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap'
];

// Instalação - Cacheia ativos e força o novo SW a assumir
self.addEventListener('install', (e) => {
  console.log('[SW] Instalando nova versão...');
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Fazendo cache dos ativos');
      return cache.addAll(ASSETS);
    })
  );
});

// Ativação - Limpa caches antigos e assume controle
self.addEventListener('activate', (e) => {
  console.log('[SW] Ativando e limpando caches antigos...');
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Deletando cache antigo:', key);
          return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim())
  );
});

// Fetch - Estratégia Stale-While-Revalidate para maior agilidade nas atualizações
self.addEventListener('fetch', (e) => {
  // Ignora requisições de outras origens que não sejam as permitidas ou locais
  if (e.request.mode === 'navigate' || (e.request.method === 'GET' && e.request.url.startsWith(self.location.origin))) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(e.request).then(response => {
          const fetchPromise = fetch(e.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(e.request, networkResponse.clone());
            }
            return networkResponse;
          });
          return response || fetchPromise;
        });
      })
    );
  } else {
    // Para CDNs e fonts, usa Cache First clássico
    e.respondWith(
      caches.match(e.request).then(res => {
        return res || fetch(e.request);
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data && event.data.action === 'clearCache') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
      if (event.ports && event.ports[0]) event.ports[0].postMessage({ success: true });
    });
  }
});
