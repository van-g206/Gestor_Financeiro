const CACHE_NAME = 'gestor-v10-cache-v7';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './scripts.js',
    './formata.css',
    './manifest.json',
    './android-chrome-192x192.png',
    './android-chrome-512x512.png',
    './apple-touch-icon.png',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Evento de Instalação
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Iniciando instalação...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cache aberto com sucesso. Adicionando arquivos...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[Service Worker] Todos os arquivos foram cacheados com sucesso!');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Falha crítica no addAll durante a instalação:', error);
            })
    );
});

self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Sincronização em segundo plano:', event.tag);
});

self.addEventListener('periodicsync', (event) => {
    console.log('[Service Worker] Sincronização periódica ativa.');
});

self.addEventListener('push', (event) => {
    console.log('[Service Worker] Notificação Push recebida.');
});

// Evento de Ativação
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando e limpando caches antigos...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deletando cache obsoleto:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
            
        })
        .then(() => {
            console.log('[Service Worker] Agora o app está pronto para uso offline.');
            return self.clients.claim();
        })
    );
});

// Estratégia de Interceptação de Requisições (Fetch)
self.addEventListener('fetch', (event) => {
    // Ignorar requisições de extensões ou esquemas não suportados
    if (!(event.request.url.indexOf('http') === 0)) return;

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Retorna o arquivo do cache se encontrar
                if (response) {
                    return response;
                }

                // Se não estiver no cache, busca na rede
                return fetch(event.request).then((networkResponse) => {
                    // Verifica se a resposta é válida
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    // Opcional: Clonar e adicionar novos arquivos ao cache dinamicamente
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        // Você pode habilitar o cache dinâmico aqui se desejar
                        // cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                });
            }).catch((err) => {
                console.error('[Service Worker] Erro ao buscar recurso:', event.request.url, err);
                // Aqui você poderia retornar uma página de fallback offline
            })
    );
});

// Listener para mensagens (Sync/Push)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('[Service Worker] Arquivo carregado e ouvindo eventos.');
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Sincronização em segundo plano', event.tag);
});

self.addEventListener('periodicsync', (event) => {
    console.log('[Service Worker] Sincronização periódica');
});

self.addEventListener('push', (event) => {
    console.log('[Service Worker] Notificação Push recebida');
});