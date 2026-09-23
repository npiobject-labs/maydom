// PWA: service worker, aviso de versión nueva e instalación.
// Con la app instalada, una publicación nueva puede tardar en verse: se vuelve de segundo plano sin
// recargar y el service worker ya tiene lo que necesita. Por eso se busca versión al abrir y al volver
// a la app, y cuando la hay sale una banda con «Actualizar»; recargar lo decide el usuario, que puede
// estar escribiendo. La versión se compara por el <meta name="build">: el service worker nuevo solo
// dispara la comprobación, porque la red primero ya puede haber traído la página nueva.
export const BUILD = document.querySelector('meta[name=build]')?.content || '';
let registro = null, promptInstalar = null, avisada = null, comprobando = null, repintar = null;

async function buildPublicado() {
  const r = await fetch('./index.html', { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return /<meta name="build" content="([^"]+)"/.exec(await r.text())?.[1] || null;
}
function banda() { return document.getElementById('nueva-version'); }
function avisar(nuevo) {
  avisada = nuevo;
  const b = banda(); if (!b) return;
  b.title = 'Build ' + nuevo;
  if (b.hidden) { b.hidden = false; repintar?.(); }
}
// Pide al navegador que mire si hay sw.js nuevo. Nunca mientras hay uno instalándose o esperando (en la
// prueba de humo ese update() llegó a quedarse colgado y bloquear el register() de la siguiente carga), y con
// tope de tiempo, para que una comprobación atascada no deje la app sin avisos el resto de la sesión.
const refrescarSW = () => registro && !registro.installing && !registro.waiting
  ? Promise.race([registro.update().catch(() => null), new Promise(ok => setTimeout(ok, 5000))]) : null;
// Devuelve el build publicado si es distinto del que corre (y enseña la banda), o null.
export function buscarVersion() {
  comprobando ||= (async () => {
    try {
      await refrescarSW();
      const pub = await buildPublicado();
      if (pub && pub !== BUILD) { avisar(pub); return pub; }
      return null;
    } finally { comprobando = null; }
  })();
  return comprobando;
}
export const versionNueva = () => avisada;

// Antes de recargar se da al service worker nuevo un momento para tomar el mando, así la recarga ya pasa
// por su red sin caché HTTP. Chrome puede retrasar el relevo hasta que el viejo lleva ~30 s sin tráfico
// aunque se llame a skipWaiting(); no se le espera tanto: el viejo también va a la red primero.
export async function actualizar() {
  const b = banda(); if (b) b.querySelector('button').disabled = true;
  try {
    await refrescarSW();
    const nuevo = registro?.installing || registro?.waiting || (registro?.active?.state === 'activating' ? registro.active : null);
    if (nuevo) await new Promise(ok => {
      const listo = () => ['activated', 'redundant'].includes(nuevo.state);
      if (listo()) return ok();
      nuevo.addEventListener('statechange', () => listo() && ok());
      nuevo.postMessage({ tipo: 'saltar' });
      setTimeout(ok, 3000);
    });
  } catch { /* sin red o sin service worker: se recarga igual */ }
  location.reload();
}

export const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const puedeInstalar = () => !!promptInstalar;
export async function instalar() {
  if (!promptInstalar) return false;
  promptInstalar.prompt();
  const { outcome } = await promptInstalar.userChoice;
  promptInstalar = null;
  return outcome === 'accepted';
}

// alCambiar: se llama cuando cambia lo que enseña Ajustes (se puede instalar, hay versión nueva).
export function arrancarPWA(alCambiar) {
  repintar = alCambiar;
  banda()?.querySelector('button')?.addEventListener('click', actualizar);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptInstalar = e; alCambiar?.(); });
  window.addEventListener('appinstalled', () => { promptInstalar = null; alCambiar?.(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) buscarVersion().catch(() => null); });
  // En local (tools/arrancar.ps1, pruebas de humo) no hay service worker, pero el aviso funciona igual.
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') { buscarVersion().catch(() => null); return; }
  navigator.serviceWorker.register('sw.js').then(reg => {
    registro = reg;
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      // Sin controller es la primera visita: no hay nada viejo que sustituir.
      nuevo?.addEventListener('statechange', () => { if (nuevo.state === 'installed' && navigator.serviceWorker.controller) buscarVersion().catch(() => null); });
    });
  }).catch(() => null).finally(() => buscarVersion().catch(() => null));
}
