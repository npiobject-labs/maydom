// Service worker de maydom: red primero, caché de respaldo para usar la app sin conexión.
const CACHE = 'maydom-MA-B1-20260922-022';
const BASE = ['./', './index.html', './manifest.webmanifest', './app/estilos.css', './app/app.js', './app/nucleo.js', './app/agenda.js', './app/reglas.js', './app/llm.js', './app/voz.js', './app/extracto.js', './app/icono.svg', './app/datos/semillas.js',
  ...['hoy', 'calendario', 'notas', 'ejercicio', 'sueno', 'meditacion', 'alimentacion', 'suplementos', 'compra', 'proyectos', 'ocio', 'finanzas', 'mayordomo', 'preferencias', 'buscador', 'ajustes', 'menu'].map(s => `./app/secciones/${s}.js`)];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).catch(() => null)); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request)));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.matchAll({ type: 'window' }).then(ws => ws.length ? ws[0].focus() : clients.openWindow('./'))); });
