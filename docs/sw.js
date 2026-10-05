// Service worker de maydom: red primero, caché de respaldo para usar la app sin conexión.
// Siempre revalida con el servidor (cache: 'no-cache'): Pages sirve con max-age=600 y, sin eso, tras
// «Actualizar» el navegador podía devolver de su caché HTTP los módulos de la versión anterior.
const CACHE = 'maydom-MA-B1-20261005-002';
// Avisos de pagos fijos (ADR-012): las reglas, compartidas con la página; la agenda vive en su propia caché.
importScripts('./app/avisos-sw.js');
const AVISOS = self.maydomAvisos.CACHE;
const BASE = ['./', './index.html', './manifest.webmanifest', './app/estilos.css', './app/app.js', './app/nucleo.js', './app/agenda.js', './app/reglas.js', './app/llm.js', './app/voz.js', './app/extracto.js', './app/ficha-plato.js', './app/cocina.js', './app/pwa.js', './app/accesos.js', './app/interpretar-nota.js', './app/revisar-texto.js', './app/interpretar-ejercicio.js', './app/informe.js', './app/markdown.js', './app/cofre.js', './app/avisos-pagos.js', './app/avisos-sw.js', './app/icono.svg', './app/icono-192.png', './app/icono-512.png', './app/icono-maskable-512.png', './app/datos/semillas.js',
  ...['hoy', 'calendario', 'notas', 'ejercicio', 'sueno', 'meditacion', 'alimentacion', 'suplementos', 'compra', 'proyectos', 'ocio', 'finanzas', 'mayordomo', 'preferencias', 'buscador', 'ajustes', 'menu'].map(s => `./app/secciones/${s}.js`),
  ...['calculos', 'importar', 'informes', 'vencimientos'].map(s => `./app/secciones/finanzas/${s}.js`)];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE.map(u => new Request(u, { cache: 'reload' })))).catch(() => null)); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== AVISOS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request)));
});
// «Actualizar» en la app: si el nuevo quedara esperando, que tome el mando ya.
self.addEventListener('message', e => {
  if (e.data?.tipo === 'saltar') self.skipWaiting();
  if (e.data?.tipo === 'revisar-avisos') e.waitUntil(revisarAvisos());
});
const revisarAvisos = () => self.maydomAvisos.revisar((t, o) => self.registration.showNotification(t, o)).catch(() => 0);
// El navegador despierta la app instalada (cada 12 horas como mucho, cuando él decide) para avisar con ella cerrada.
self.addEventListener('periodicsync', e => { if (e.tag === 'avisos-pagos') e.waitUntil(revisarAvisos()); });
// Tocar un aviso abre la app donde dice (los de pagos fijos, en Pagos fijos, tras la clave de Finanzas).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window' }).then(ws => (ws.length ? ws[0].focus().then(w => (e.notification.data?.url ? w.navigate(url) : w)).catch(() => null) : clients.openWindow(url))));
});
