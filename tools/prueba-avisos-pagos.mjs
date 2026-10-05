// Prueba de humo de los avisos de pagos fijos (ADR-012, opción A). Primero las reglas compartidas
// (docs/app/avisos-sw.js) y la agenda (agendaAvisos) en node. Después sirve docs/ en el 8094 con el
// service worker activado (en local pwa.js no lo registra: aquí se le quita esa condición, como en
// prueba-pwa.mjs) y recorre con Playwright: poner los avisos, la agenda en Cache Storage, el aviso de
// «mañana se cobra…» desde la página y desde el service worker, sin repetirse, un pago sin aviso,
// sin importe, probar un aviso y quitar los avisos (la agenda se borra).
// Uso: npm i playwright && node tools/prueba-avisos-pagos.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import '../docs/app/avisos-sw.js';
import { agendaAvisos, pagosFijos } from '../docs/app/secciones/finanzas/vencimientos.js';
import { generar } from './datos/movimientos-fijos.mjs';

const fallos = [];
const comprobar = (ok, msg) => { console.log((ok ? '  ok  ' : '  FALLO ') + msg); if (!ok) fallos.push(msg); };
const A = globalThis.maydomAvisos;

console.log('\n--- 1. Reglas (funciones puras) ---');
const movs = generar('2026-09-30');
const pf = pagosFijos(movs, [{ id: 'x', clave: pagosFijos(movs, []).activos.find(p => p.clave.startsWith('netflix')).clave, aviso: 'no' }]).activos;
const ag = agendaAvisos(pf, '2026-10-04', { antelacion: 1, importe: true }, 30, id => ({ fijos: 'Gastos fijos' }[id] || ''));
const luz = ag.find(x => /IBERDROLA/.test(x.nombre));
comprobar(luz && luz.fecha === '2026-10-05' && luz.avisar === '2026-10-04' && luz.importe > 0 && luz.cuenta === 'Gastos fijos', 'la luz del 05/10 se avisa el 04/10, con importe y cuenta');
comprobar(!ag.some(x => /NETFLIX/.test(x.nombre)), 'un pago con «no avisar» no entra en la agenda');
const sinImporte = agendaAvisos(pf, '2026-10-04', { antelacion: 3, importe: false }, 30);
comprobar(sinImporte.every(x => x.importe == null && x.cuenta == null) && sinImporte.find(x => /IBERDROLA/.test(x.nombre)).avisar === '2026-10-02', 'sin importe no guarda cifras; con 3 días, avisa el 02/10');
const agenda = { activo: true, hora: '09:00', hasta: '2026-12-03', items: ag };
const a8 = new Date(2026, 9, 4, 8, 0), a10 = new Date(2026, 9, 4, 10, 0);
comprobar(A.pendientes(agenda, a8).length === 0, 'el día de avisar, antes de la hora, todavía no');
const p10 = A.pendientes(agenda, a10);
comprobar(p10.length === 1 && /IBERDROLA/.test(p10[0].nombre), 'a las 10:00 del 04/10, el de la luz');
comprobar(A.pendientes(agenda, a10, { [p10[0].id]: 1 }).length === 0, 'lo ya avisado no se repite');
comprobar(A.pendientes(agenda, new Date(2026, 9, 5, 7, 0)).some(x => /IBERDROLA/.test(x.nombre)), 'si el móvil despierta tarde (el día del cobro, antes de la hora), avisa igual');
comprobar(!A.pendientes(agenda, new Date(2026, 9, 6, 10, 0)).some(x => /IBERDROLA/.test(x.nombre)), 'pasado el día del cobro ya no avisa');
const [n1] = A.notificaciones(p10, a10);
comprobar(n1.titulo === 'Mañana se cobra IBERDROLA CLIENTES SAU' && /≈\s.*€ · Gastos fijos · lunes 05\/10\/2026/.test(n1.cuerpo) && n1.tag === 'pagos-2026-10-05', `«${n1.titulo}» · ${n1.cuerpo}`);
const dos = A.notificaciones([{ id: 'a', nombre: 'Luz', fecha: '2026-10-05', importe: 50, aprox: true }, { id: 'b', nombre: 'Netflix', fecha: '2026-10-05', importe: 12.99 }], a10);
comprobar(dos.length === 1 && dos[0].titulo === 'Mañana se cobran 2 pagos fijos' && /Luz ≈\s50,00\s€ · Netflix 12,99\s€/.test(dos[0].cuerpo), 'dos el mismo día van en un aviso');
comprobar(A.pendientes({ ...agenda, items: [] }, new Date(2026, 10, 27, 10, 0)).some(x => x.renovar), 'a una semana del fin de la agenda, pide entrar en Finanzas para renovarla');

console.log('\n--- 2. En la app, con service worker ---');
const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'docs');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('404'); }
    const t = path.basename(f) === 'pwa.js' ? d.toString().replace("location.protocol !== 'https:'", 'false') : d;
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'text/plain' }); res.end(t);
  });
});
await new Promise(r => srv.listen(8094, r));
const URL0 = 'http://localhost:8094/';
const enOpt = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers')
  .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f));
const nav = await chromium.launch(enOpt ? { executablePath: enOpt } : {});
const ctx = await nav.newContext();
await ctx.grantPermissions(['notifications'], { origin: URL0.slice(0, -1) });
const pag = await ctx.newPage();
const errores = [];
pag.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
const main = () => pag.locator('main').innerText();
const ir = async hash => { await pag.goto(URL0 + hash); await pag.waitForTimeout(400); };
const agendaGuardada = () => pag.evaluate(async () => { const r = await (await caches.open('maydom-avisos')).match('agenda.json'); return r ? r.json() : null; });
const avisos = () => pag.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map(n => ({ titulo: n.title, cuerpo: n.body, tag: n.tag })));
const limpiarAvisos = () => pag.evaluate(async () => { for (const n of await (await navigator.serviceWorker.ready).getNotifications()) n.close(); await (await caches.open('maydom-avisos')).delete('avisados.json'); });

await ir('#/finanzas?v=recurrentes');
await pag.evaluate(() => navigator.serviceWorker.ready);
await pag.reload(); await pag.waitForTimeout(400);
comprobar(await pag.evaluate(() => !!navigator.serviceWorker.controller), 'la página la controla el service worker');
await pag.locator('[data-candado] [name="clave"]').fill('1234');
await pag.locator('[data-candado] [name="otra"]').fill('1234');
await pag.locator('[data-candado] button[type="submit"]').click();
await pag.waitForSelector('.pestanas', { timeout: 15000 });
// Movimientos inventados hasta hace tres días y un pago a mano que vence mañana. La hora de los
// avisos se pone a las 00:00 para que la prueba no dependa de la hora a la que corre.
// Bajo Playwright, con el service worker recién puesto, un evaluate pierde a veces el contexto sin
// que la página navegue (ni petición ni load): se repite. La carga de datos es idempotente.
async function evaluar(fn, arg) {
  for (let i = 0; ; i++) {
    try { return await pag.evaluate(fn, arg); }
    catch (e) { if (i >= 3 || !/context was destroyed/.test(e.message)) throw e; await pag.waitForTimeout(700); }
  }
}
const hoy = await evaluar(() => import('./app/nucleo.js').then(m => m.hoyISO()));
const manana = new Date(hoy + 'T12:00:00'); manana.setDate(manana.getDate() + 1);
const hasta = new Date(hoy + 'T12:00:00'); hasta.setDate(hasta.getDate() - 3);
await evaluar(async ([ms, dia]) => {
  const m = await import('./app/nucleo.js');
  if (m.estado.recurrentes.some(r => r.id === 'r1')) return;
  m.estado.movimientos.push(...ms);
  m.estado.recurrentes.push({ id: 'r1', descripcion: 'Seguro de prueba', importe: -40, concepto: 'seguros', dia: String(dia), periodo: '1', cuenta: 'fijos' });
  m.estado.ajustes.avisosPagos = { hora: '00:00' };
  m.guardar();
}, [generar(hasta.toISOString().slice(0, 10)), manana.getDate()]);
await ir('#/finanzas?v=recurrentes');
let t = await main();
comprobar(/Avisos de pagos fijos/.test(t) && !(await pag.locator('[data-c="avisoActivo"]').isChecked()), 'la tarjeta de avisos está, sin marcar');
comprobar(!(await agendaGuardada()), 'sin avisos puestos no hay agenda sin cifrar');

await pag.locator('[data-c="avisoActivo"]').check();
await pag.waitForTimeout(1200);
let ag2 = await agendaGuardada();
const seguro = ag2?.items.find(x => x.nombre === 'Seguro de prueba');
comprobar(ag2?.activo && seguro && seguro.avisar === hoy && seguro.importe === 40, 'puestos: la agenda está en Cache Storage, con el seguro de mañana para avisar hoy');
t = await main();
comprobar(/1 día antes/.test(t) && /Probar un aviso/.test(t) && /avisa hoy/.test(t), 'la tarjeta enseña antelación, hora y prueba; los próximos dicen cuándo avisan');
let ns = await avisos();
comprobar(ns.some(n => n.titulo === 'Mañana se cobra Seguro de prueba' && /40,00\s€ · Gastos fijos/.test(n.cuerpo)), `aviso de la página: ${JSON.stringify(ns.map(n => n.titulo))}`);
const otra = await pag.evaluate(() => import('./app/avisos-pagos.js').then(m => m.revisarAhora()));
comprobar(otra === 0, 'repasar otra vez no repite el aviso');

// El service worker solo, como cuando el navegador lo despierta con la app cerrada.
await limpiarAvisos();
await pag.evaluate(() => navigator.serviceWorker.controller.postMessage({ tipo: 'revisar-avisos' }));
await pag.waitForTimeout(1200);
ns = await avisos();
comprobar(ns.some(n => n.titulo === 'Mañana se cobra Seguro de prueba'), 'el service worker avisa por su cuenta con la agenda');

// Un pago sin aviso, y los avisos sin importe.
await pag.locator('.tarjeta[data-a="editarRec"]', { hasText: 'Seguro de prueba' }).click();
await pag.waitForSelector('dialog.modal');
await pag.locator('dialog.modal [name="aviso"]').selectOption('no');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(800);
ag2 = await agendaGuardada();
comprobar(!ag2.items.some(x => x.nombre === 'Seguro de prueba') && /sin aviso/.test(await main()), '«No avisar» lo saca de la agenda y lo dice');
await pag.locator('[data-c="avisoImporte"]').uncheck();
await pag.waitForTimeout(800);
ag2 = await agendaGuardada();
comprobar(ag2.items.length && ag2.items.every(x => x.importe == null), 'sin importe, la agenda no guarda cifras');
await pag.locator('[data-a="avisoAntelacion"][data-v="3"]').click();
await pag.waitForTimeout(800);
ag2 = await agendaGuardada();
comprobar(ag2.items.every(x => { const d = new Date(x.fecha + 'T12:00:00'); d.setDate(d.getDate() - 3); return x.avisar === d.toISOString().slice(0, 10); }), '3 días antes: cambia el día de avisar de todos');

await limpiarAvisos();
await pag.locator('[data-a="avisoProbar"]').click();
await pag.waitForTimeout(800);
ns = await avisos();
comprobar(ns.some(n => n.tag === 'pagos-prueba' && / se cobra /.test(n.titulo)), `probar un aviso lo enseña ya — ${JSON.stringify(ns.map(n => n.titulo))}`);
const iso = (await main()).match(/\b20\d{2}-\d{2}-\d{2}\b/g);
comprobar(!iso, `sin fechas en ISO${iso ? ' — ' + iso.slice(0, 3) : ''}`);

await pag.locator('[data-c="avisoActivo"]').uncheck();
await pag.waitForTimeout(800);
comprobar(!(await agendaGuardada()), 'al quitar los avisos, la agenda se borra');

console.log('\nerrores de consola:', errores.length ? errores : 'ninguno');
await nav.close(); srv.close();
if (errores.length) fallos.push('errores de consola');
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTodo bien');
process.exit(fallos.length ? 1 : 0);
