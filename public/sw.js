/* StrongLog Pro - Service Worker v7.0 */
/* Release Date: 2026-09-01 */

const CACHE_NAME = 'stronglog-pro-v7.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './data/exercises.min.json',
  './data/muscle_ontology.json',
  './vendor/three/GLTFLoader.js',
  './assets/models/human_body_sci_fi.glb'
];
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/dexie@latest/dist/dexie.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap'
];

// Instalação resiliente:
// 1. Core (mesma origem) é cacheado com cacheamento individual tolerante a falhas.
// 2. CDNs são cacheadas em segundo plano — se qualquer CDN falhar, a instalação NÃO falha.
//    (fix v5.5: antes, cache.addAll atômico deixava o novo SW preso em "installing"
//    quando um CDN instável caía, e o SW velho servia a UI antiga para sempre.)
self.addEventListener('install', (e) => {
  console.log('[SW] Instalando nova versão', CACHE_NAME);
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Core: cacheia individualmente; falha individual não derruba a instalação
      await Promise.all(CORE_ASSETS.map(async (url) => {
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res && res.status === 200) await cache.put(url, res);
        } catch (err) {
          console.warn('[SW] Core asset falhou (continuando):', url, err.message);
        }
      }));
      // CDNs: best-effort em paralelo, sem bloquear nem falhar a instalação
      CDN_ASSETS.forEach((url) => {
        fetch(url, { mode: 'no-cors', cache: 'no-cache' })
          .then((res) => cache.put(url, res))
          .catch((err) => console.warn('[SW] CDN asset falhou (best-effort):', url, err.message));
      });
    })
  );
});

// Ativação - Limpa caches antigos e assume controle imediato
self.addEventListener('activate', (e) => {
  console.log('[SW] Ativando e limpando caches antigos...');
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Deletando cache antigo:', key);
          return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const isNavigate = e.request.mode === 'navigate';

  if (isNavigate) {
    // fix v5.5: NAVEGAÇÃO agora é NETWORK-FIRST.
    // Antes (cache-first), o usuário via a UI antiga mesmo após deploy novo.
    // Se a rede falhar (offline), cai para o cache — preservando o offline-first.
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            if (networkResponse && networkResponse.status === 200) cache.put(e.request, networkResponse.clone());
          });
          return networkResponse;
        })
        .catch(() =>
          caches.open(CACHE_NAME).then((cache) =>
            cache.match(e.request).then((res) => res || cache.match('./index.html'))
          )
        )
    );
  } else if (e.request.method === 'GET' && e.request.url.startsWith(self.location.origin)) {
    // Assets da mesma origem: Stale-While-Revalidate
    e.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(e.request).then((response) => {
          const fetchPromise = fetch(e.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(e.request, networkResponse.clone());
            }
            return networkResponse;
          });
          return response || fetchPromise;
        });
      })
    );
  } else if (e.request.method === 'GET') {
    // CDNs e fonts: Cache First clássico
    e.respondWith(
      caches.match(e.request).then((res) => res || fetch(e.request))
    );
  }
});
