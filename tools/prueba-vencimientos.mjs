// Prueba de humo del previsor de pagos fijos (ADR-012). Primero las funciones puras de
// vencimientos.js en node, con año y medio de movimientos inventados (tools/datos/movimientos-fijos.mjs):
// qué se detecta y qué no, el día, el periodo, el reparto por importe y el calendario. Después sirve
// docs/ en el 8096 y recorre con Playwright la pestaña «Pagos fijos» y el listado «Vencimientos de
// pagos fijos»: renombrar, descartar y recuperar, pagos a mano, «no ha llegado» y fechas sin ISO.
// Uso: npm i playwright && node tools/prueba-vencimientos.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { detectar, pagosFijos, calendario, proximos, claveDe, nombreDe, fechaPrevista } from '../docs/app/secciones/finanzas/vencimientos.js';
import { generar } from './datos/movimientos-fijos.mjs';

const fallos = [];
const comprobar = (ok, msg) => { console.log((ok ? '  ok  ' : '  FALLO ') + msg); if (!ok) fallos.push(msg); };

console.log('\n--- 1. Detección (funciones puras) ---');
const movs = generar('2026-09-30');
const det = detectar(movs);
const por = t => det.filter(p => p.clave.startsWith(t));
const luz = por('iberdrola')[0], comu = por('comunidad')[0], gas = por('naturgy')[0], netflix = por('netflix')[0];
comprobar(luz && luz.periodo === 1 && luz.dia === 5 && luz.activo, `la luz: mensual, día 5 (aunque los lunes desplazados digan 6 o 7) — ${luz?.periodo} día ${luz?.dia}`);
comprobar(comu && comu.periodo === 1 && comu.dia === 1 && comu.importe === 60, 'la comunidad: mensual, día 1, 60 €');
comprobar(gas && gas.periodo === 2 && gas.dia === 12, `el gas: bimestral, día 12 — ${gas?.periodo} día ${gas?.dia}`);
comprobar(netflix && netflix.finSemana && netflix.dia === 15, 'Netflix con tarjeta: se cobra también en domingo, así que no se mueve al lunes');
const mapfre = por('mapfre');
comprobar(mapfre.length === 2 && mapfre.every(p => p.periodo === 12) && mapfre.map(p => p.importe).sort().join() === '310,520', 'dos seguros anuales del mismo emisor se separan por importe');
// Con los extractos desde abril, del seguro de casa (marzo) solo hay un cargo: junio, marzo y junio
// no son un trimestral, son el del coche (anual) y un cargo suelto.
const corto = detectar(movs.filter(m => m.fecha >= '2025-04-01')).filter(p => p.clave.startsWith('mapfre'));
comprobar(corto.length === 1 && corto[0].periodo === 12 && corto[0].importe === 520, `dos seguros que se alternan no pasan por un trimestral — ${corto.map(p => p.periodo + ' ' + p.importe)}`);
const google = por('google');
comprobar(google.length === 2 && google.every(p => p.periodo === 1), 'dos suscripciones con el mismo texto y distinto importe son dos pagos mensuales');
comprobar(por('gimnasio').length === 1 && !por('gimnasio')[0].activo, 'el gimnasio dado de baja se detecta pero ya no está activo');
comprobar(!por('mercadona').length && !por('cafeteria').length, 'el súper y los cafés no son pagos fijos');
comprobar(!det.some(p => /traspaso|cajero|guitarra|bizum/.test(p.clave)), 'ni los traspasos entre cuentas, ni el cajero, ni un Bizum que se repite cada mes');
comprobar(claveDe('Adeudo recibo · IBERDROLA CLIENTES SAU · FACTURA 202503 Nº 1') === claveDe('Adeudo recibo · IBERDROLA CLIENTES SAU · FACTURA 202504 Nº 2'), 'la clave no cambia con la factura ni el número');
comprobar(nombreDe('Adeudo recibo · IBERDROLA CLIENTES SAU · FACTURA 202503') === 'IBERDROLA CLIENTES SAU', 'el nombre es el emisor, sin el trámite bancario');
comprobar(fechaPrevista({ dia: 5, finSemana: false }, '2026-09') === '2026-09-07', 'un recibo que vence en sábado se prevé el lunes');
comprobar(fechaPrevista({ dia: 31, finSemana: true }, '2026-02') === '2026-02-28', 'el día 31 en febrero es el último del mes');

console.log('\n--- 2. Calendario y próximos (funciones puras) ---');
const manual = { id: 'r1', descripcion: 'Dominio web', importe: -15, dia: 10, periodo: '12', mes: '11' };
const twin = { id: 'r2', descripcion: 'Netflix', importe: -12.99, dia: 15 };
const pf = pagosFijos(movs, [manual, twin, { id: 'x', clave: comu.clave, descartado: true }]);
comprobar(pf.descartados.length === 1 && !pf.activos.some(p => p.clave === comu.clave), 'un pago descartado sale de los activos');
comprobar(pf.activos.filter(p => /netflix/i.test(p.nombre)).length === 1 && pf.activos.some(p => p.nombre === 'Netflix' && p.origen === 'detectado'), 'el Netflix apuntado a mano y el detectado son uno, con el nombre de mano');
const cal = calendario(pf.activos, '2026-09', 4);
const filas = mes => cal.find(m => m.mes === mes).filas;
comprobar(filas('2026-09').some(f => /IBERDROLA/.test(f.pago.nombre) && f.estado === 'cobrado' && f.fecha === '2026-09-07'), 'septiembre: la luz cobrada el día real');
comprobar(filas('2026-10').some(f => /IBERDROLA/.test(f.pago.nombre) && f.estado === 'previsto' && f.fecha === '2026-10-05'), 'octubre: la luz prevista el 05/10');
comprobar(filas('2026-10').some(f => /NATURGY/.test(f.pago.nombre)) && !filas('2026-11').some(f => /NATURGY/.test(f.pago.nombre)), 'el gas bimestral, en octubre sí y en noviembre no');
comprobar(filas('2026-11').some(f => f.pago.nombre === 'Dominio web' && f.fecha === '2026-11-10') && !filas('2026-10').some(f => f.pago.nombre === 'Dominio web'), 'el anual apuntado a mano solo en su mes');
const prox = proximos(pf.activos, '2026-10-04', 3);
comprobar(prox.length === 1 && prox[0].dentro === 1 && /IBERDROLA/.test(prox[0].pago.nombre), 'próximos: el 04/10 avisa de la luz de mañana');
const hueco = movs.filter(m => !(m.descripcion.includes('IBERDROLA') && m.fecha.startsWith('2026-06')));
const calHueco = calendario(pagosFijos(hueco, []).activos, '2026-06', 1)[0].filas;
comprobar(calHueco.some(f => /IBERDROLA/.test(f.pago.nombre) && f.estado === 'sin cargo'), 'un recibo que falta en un mes ya importado sale como «no ha llegado»');

console.log('\n--- 3. En la app ---');
const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'docs');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => e ? (res.writeHead(404), res.end('404')) : (res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'text/plain' }), res.end(d)));
});
await new Promise(r => srv.listen(8096, r));
const enOpt = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers')
  .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f));
const nav = await chromium.launch(enOpt ? { executablePath: enOpt } : {});
const pag = await (await nav.newContext()).newPage();
const errores = [];
pag.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
const main = () => pag.locator('main').innerText();
const ir = async hash => { await pag.goto('http://localhost:8096/' + hash); await pag.waitForTimeout(350); };
const sinISO = async donde => { const iso = (await main()).match(/\b20\d{2}-\d{2}-\d{2}\b/g); comprobar(!iso, `${donde} sin fechas en ISO${iso ? ' — ' + iso.slice(0, 3) : ''}`); };

await ir('#/finanzas?v=recurrentes');
await pag.locator('[data-candado] [name="clave"]').fill('1234');
await pag.locator('[data-candado] [name="otra"]').fill('1234');
await pag.locator('[data-candado] button[type="submit"]').click();
await pag.waitForSelector('.pestanas', { timeout: 15000 });
// Los extractos llegan hasta hace tres días; la app calcula con la fecha real del navegador.
const hoy = await pag.evaluate(() => import('./app/nucleo.js').then(m => m.hoyISO()));
const hasta = new Date(hoy + 'T12:00:00'); hasta.setDate(hasta.getDate() - 3);
const datos = generar(hasta.toISOString().slice(0, 10));
await pag.evaluate(async ([ms, man]) => { const m = await import('./app/nucleo.js'); m.estado.movimientos.push(...ms); m.estado.recurrentes.push(man); m.guardar(); }, [datos, { id: 'r1', descripcion: 'Dominio web', importe: -15, concepto: 'hosting', dia: 10, periodo: '12', mes: '11' }]);
await ir('#/finanzas?v=recurrentes');
let t = await main();
comprobar(/Pagos fijos/.test(await pag.locator('.pestanas').innerText()), 'la pestaña se llama Pagos fijos (ruta recurrentes)');
comprobar(['IBERDROLA', 'COMUNIDAD', 'NATURGY', 'MAPFRE', 'NETFLIX', 'GOOGLE', 'Dominio web'].every(x => t.includes(x)), 'lista los pagos detectados y el apuntado a mano');
comprobar(!/MERCADONA|CAFETERIA|CAJERO|Traspaso/i.test(t.split('Ya no se cobran')[0]), 'sin súper, cafés, cajero ni traspasos');
console.log('   ', t.split('\n').slice(0, 6).join(' | '));
comprobar(/próximos 30 días/i.test(t) && /≈\s.*al mes/.test(t), 'enseña lo que vence en 30 días y el coste al mes');
comprobar(/Ya no se cobran \(1\)/.test(t), 'el gimnasio dado de baja va aparte');
await sinISO('la pestaña Pagos fijos');

// Renombrar un pago detectado.
await pag.locator('.tarjeta[data-a="pago"]', { hasText: 'IBERDROLA' }).first().click();
await pag.waitForSelector('dialog.modal');
comprobar(/Últimos cargos/.test(await pag.locator('dialog.modal').innerText()), 'el diálogo enseña los últimos cargos');
await pag.locator('dialog.modal [name="descripcion"]').fill('Luz');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(300);
t = await main();
comprobar(/\bLuz\b/.test(t) && !/IBERDROLA/.test(t), 'renombrado: se llama Luz');
let rec = await pag.evaluate(() => import('./app/nucleo.js').then(m => m.estado.recurrentes));
comprobar(rec.some(r => r.clave && r.descripcion === 'Luz'), 'el nombre se guarda en un recurrente con la clave del pago');

// Descartar y recuperar.
await pag.locator('.tarjeta[data-a="pago"]', { hasText: 'NETFLIX' }).first().click();
await pag.waitForSelector('dialog.modal');
await pag.locator('dialog.modal [data-extra]').click();
await pag.waitForTimeout(300);
t = await main();
comprobar(/Descartados \(1\)/.test(t) && !/NETFLIX/.test(t.split('Ya no se cobran')[0].split('Descartados')[0]), 'descartado: sale de la lista y va a Descartados');
await pag.locator('details.plegable', { hasText: 'Descartados' }).locator('summary').click();
await pag.locator('.tarjeta[data-a="recuperar"]', { hasText: 'NETFLIX' }).click();
await pag.waitForTimeout(300);
comprobar(!/Descartados/.test(await main()), 'recuperado: vuelve a contar');

// Movimientos: «Aplicar recurrentes» solo cuenta los apuntados a mano.
await pag.locator('.pestanas [data-v="movimientos"]').click(); await pag.waitForTimeout(300);
comprobar(/Aplicar recurrentes \(0\/1\)/.test(await main()), 'Aplicar recurrentes solo cuenta los pagos a mano (0/1)');

console.log('\n--- 4. Listado de vencimientos ---');
await ir('#/finanzas?v=informes');
await pag.locator('.tarjeta[data-a="abrir"]', { hasText: 'Vencimientos de pagos fijos' }).click();
await pag.waitForSelector('dialog.modal');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(400);
t = await main();
const meses = await pag.locator('main h3').count();
comprobar(meses === 12, `doce meses — ${meses}`);
comprobar(/próximos 12 meses/.test(t) && /Luz/.test(t) && /previsto/.test(t), 'próximos 12 meses con la luz prevista');
comprobar(/Dominio web/.test(t), 'el pago anual apuntado a mano está en su mes');
await sinISO('el listado de vencimientos');
const anio = String(Number(hoy.slice(0, 4)) - 1);
await ir(`#/finanzas?v=informes&informe=vencimientos&periodo=${anio}&cuenta=fijos`);
t = await main();
comprobar(/cobrado/.test(t) && !/NETFLIX/.test(t) && /Gastos fijos/.test(t), `año ${anio} en Gastos fijos: lo cobrado de verdad, sin lo de otras cuentas`);
await sinISO('el listado de un año pasado');

console.log('\nerrores de consola:', errores.length ? errores : 'ninguno');
await nav.close(); srv.close();
if (errores.length) fallos.push('errores de consola');
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTodo bien');
process.exit(fallos.length ? 1 : 0);
