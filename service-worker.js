// Service Worker for FulfillME PWA

const CACHE_NAME = 'fulfillme-v1.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/pages/dashboard.html',
    '/pages/browse.html',
    '/pages/post-need.html',
    '/pages/login.html',
    '/pages/register.html',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activate event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event with network-first strategy
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip Chrome extensions
    if (event.request.url.startsWith('chrome-extension://')) return;
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached response if found
                if (response) {
                    return response;
                }
                
                // Clone the request because it's a one-time use stream
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest)
                    .then(response => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response because it's a one-time use stream
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        // If both cache and network fail, show offline page
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/offline.html');
                        }
                    });
            })
    );
});

// Background sync for offline submissions
self.addEventListener('sync', event => {
    if (event.tag === 'sync-needs') {
        event.waitUntil(syncNeeds());
    }
});

// Sync offline needs when back online
async function syncNeeds() {
    const offlineNeeds = await getOfflineNeeds();
    
    for (const need of offlineNeeds) {
        try {
            await fetch('/api/needs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(need)
            });
            
            // Remove from offline storage if successful
            await removeOfflineNeed(need.id);
        } catch (error) {
            console.error('Failed to sync need:', error);
        }
    }
}

// Store offline needs in IndexedDB
async function getOfflineNeeds() {
    return new Promise((resolve) => {
        const request = indexedDB.open('fulfillme-offline', 1);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore('needs', { keyPath: 'id' });
        };
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['needs'], 'readonly');
            const store = transaction.objectStore('needs');
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = () => {
                resolve(getAllRequest.result);
            };
        };
    });
}

function removeOfflineNeed(id) {
    return new Promise((resolve) => {
        const request = indexedDB.open('fulfillme-offline', 1);
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['needs'], 'readwrite');
            const store = transaction.objectStore('needs');
            store.delete(id);
            resolve();
        };
    });
}

// Push notifications
self.addEventListener('push', event => {
    if (!event.data) return;
    
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            {
                action: 'view',
                title: 'View'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'close') {
        return;
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (const client of clientList) {
                if (client.url === event.notification.data.url && 'focus' in client) {
                    return client.focus();
                }
            }
            
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});