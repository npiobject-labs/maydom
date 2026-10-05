// Avisos de pagos fijos, lado de la página (ADR-012, opción A). Finanzas deja la agenda de los
// próximos 60 días en Cache Storage cada vez que se abre; la app la repasa al arrancar, al volver a
// primer plano y cada cinco minutos, y el service worker cuando el navegador lo despierta
// (Periodic Background Sync, solo con la app instalada). Las reglas de cuándo y qué se avisa están
// en avisos-sw.js, que comparten los dos.
import { estado, hoyISO } from './nucleo.js';
import './avisos-sw.js';

const A = () => globalThis.maydomAvisos;
export const ETIQUETA = 'avisos-pagos';
export const HORAS = ['08:00', '09:00', '14:00', '20:00'];
export const ajustesAvisos = () => ({ activo: false, antelacion: 1, hora: '09:00', importe: true, ...(estado.ajustes.avisosPagos || {}) });
export const antelacionTexto = n => (Number(n) === 0 ? 'el mismo día' : Number(n) === 1 ? '1 día antes' : `${n} días antes`);

const registro = async () => { try { return (await navigator.serviceWorker?.getRegistration()) || null; } catch { return null; } };
// En el móvil, una notificación solo se puede enseñar desde el service worker; sin él (en local, o un
// navegador sin service worker) se usa la de la página.
async function mostrador() {
  const reg = await registro();
  if (reg) return (t, o) => reg.showNotification(t, o);
  return async (t, o) => { if (typeof Notification === 'undefined' || Notification.permission !== 'granted') throw new Error('sin permiso'); new Notification(t, o); };
}
const json = x => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });

// La escribe Finanzas abierta; con los avisos quitados se borra, para no dejar nada sin cifrar.
export async function escribirAgenda(items, hasta) {
  if (typeof caches === 'undefined') return;
  const c = await caches.open(A().CACHE), aj = ajustesAvisos();
  if (!aj.activo) { await c.delete('agenda.json'); return; }
  await c.put('agenda.json', json({ activo: true, hora: aj.hora, creada: hoyISO(), hasta, items }));
}
export async function leerAgenda() {
  if (typeof caches === 'undefined') return null;
  try { return await (await (await caches.open(A().CACHE)).match('agenda.json'))?.json() || null; } catch { return null; }
}

export async function revisarAhora() {
  if (!ajustesAvisos().activo) return 0;
  try { return await A().revisar(await mostrador()); } catch { return 0; }
}

// Que el navegador despierte la app para avisar aunque esté cerrada. Chrome solo lo concede a la app
// instalada y según cuánto se use, y decide él cuándo (cada 12 horas como mucho): devuelve si quedó puesto.
export async function despertador(poner = true) {
  const reg = await registro();
  if (!reg?.periodicSync) return false;
  try {
    if (!poner) { await reg.periodicSync.unregister(ETIQUETA); return false; }
    const p = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (p.state !== 'granted') return false;
    await reg.periodicSync.register(ETIQUETA, { minInterval: 12 * 60 * 60 * 1000 });
    return true;
  } catch { return false; }
}
export async function hayDespertador() {
  const reg = await registro();
  try { return !!reg?.periodicSync && (await reg.periodicSync.getTags()).includes(ETIQUETA); } catch { return false; }
}

// «Probar un aviso»: el primero que vaya a llegar, con el mismo formato, ya.
export async function probar(item) {
  const ahora = new Date();
  const [n] = A().notificaciones([item || { id: 'prueba', nombre: 'Pago de prueba', fecha: hoyISO(), importe: 9.99, aprox: true }], ahora);
  await (await mostrador())(n.titulo, { body: n.cuerpo, tag: 'pagos-prueba', icon: 'app/icono-192.png', data: { url: './#/finanzas?v=recurrentes' } });
}

// Repaso automático mientras la app está abierta.
export function arrancarAvisos() {
  revisarAhora();
  setInterval(revisarAhora, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarAhora(); });
}
