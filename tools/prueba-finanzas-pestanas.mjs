// Prueba de humo de la reorganización de Finanzas y del formato de fecha: recorre las cuatro
// pestañas, comprueba que la carga y los informes están donde toca, que las rutas viejas siguen
// llevando a su sitio y que ninguna sección de la app pinta una fecha en ISO.
// Uso: npm i playwright && node tools/prueba-finanzas-pestanas.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'docs');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => e ? (res.writeHead(404), res.end('404')) : (res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'text/plain' }), res.end(d)));
});
await new Promise(r => srv.listen(8097, r));

const enOpt = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers')
  .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f));
const nav = await chromium.launch(enOpt ? { executablePath: enOpt } : {});
const pag = await (await nav.newContext()).newPage();
const errores = [];
pag.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
const fallos = [];
const comprobar = (ok, msg) => { console.log((ok ? '  ok  ' : '  FALLO ') + msg); if (!ok) fallos.push(msg); };

const ir = async ruta => { await pag.goto('http://localhost:8097/' + ruta); await pag.waitForTimeout(350); };
const texto = () => pag.locator('main').innerText();

// Datos de partida: movimientos de dos años y un recurrente.
await ir('#/finanzas');
await pag.evaluate(() => {
  const e = JSON.parse(localStorage.getItem('maydom.v1'));
  e.movimientos = [
    { id: 'a', fecha: '2025-03-14', descripcion: 'MERCADONA', importe: -45.3, concepto: 'alimentación' },
    { id: 'b', fecha: '2025-03-20', descripcion: 'NOMINA', importe: 1800, concepto: 'ingresos' },
    { id: 'c', fecha: '2026-01-05', descripcion: 'IBERDROLA', importe: -72.15, concepto: 'suministros' },
  ];
  e.recurrentes = [{ id: 'r1', descripcion: 'Fly.io', importe: -6, concepto: 'hosting', dia: 1 }];
  e.importaciones = [];
  localStorage.setItem('maydom.v1', JSON.stringify(e));
});
await pag.reload(); await pag.waitForTimeout(400);

console.log('\n--- 1. Las cuatro pestañas ---');
const pest = await pag.locator('.pestanas button').allInnerTexts();
console.log('  ', pest.join(' | '));
comprobar(pest.length === 4 && /Movimientos/.test(pest[0]) && /Importar/.test(pest[1]) && /Informes/.test(pest[2]) && /Recurrentes/.test(pest[3]), 'Movimientos, Importar, Informes y Recurrentes, en ese orden');
comprobar(/Movimientos3/.test(pest[0].replace(/\s/g, '')), `la pestaña lleva el contador de movimientos — «${pest[0]}»`);
comprobar(await pag.locator('.pestanas button.sel').innerText().then(t => /Movimientos/.test(t)), 'Movimientos es la pestaña por defecto');

console.log('\n--- 2. Movimientos: mes en letra y fechas en día/mes/año ---');
await ir('#/finanzas?v=movimientos&mes=2025-03');
let t = await texto();
console.log('  ', t.split('\n').slice(1, 5).join(' | '));
comprobar(/marzo 2025/.test(t), 'la cabecera dice «marzo 2025», no «2025-03»');
comprobar(/14\/03\/2025/.test(t) && /20\/03\/2025/.test(t), 'las fechas de la tabla van en dd/mm/aaaa');
comprobar(!/2025-03-14/.test(t), 'no se cuela ninguna fecha en ISO');
comprobar(/Aplicar recurrentes/.test(t), 'el botón de recurrentes del mes sigue en Movimientos');
comprobar(!/Importar extracto/.test(t), 'la carga ya no ocupa sitio en Movimientos');

console.log('\n--- 3. Importar: módulo de carga con historial ---');
await ir('#/finanzas?v=importar');
t = await texto();
console.log('  ', t.split('\n').slice(0, 4).join(' | '));
comprobar(await pag.locator('[data-c="extracto"]').count() === 1, 'tiene el selector de fichero');
comprobar(/Qué hay cargado/i.test(t) && /3 movimientos/.test(t), 'dice cuántos movimientos hay ya');
comprobar(/de 2025, 2026/.test(t), 'y de qué años son');
comprobar(/Cargas anteriores/i.test(t), 'tiene el historial de cargas');

console.log('\n--- 4. Informes: portada y el informe anual ---');
await ir('#/finanzas?v=informes');
t = await texto();
console.log('  ', t.split('\n').slice(0, 3).join(' | '));
comprobar(/Resumen del año/.test(t), 'la portada lista el informe anual');
comprobar(/comparación entre años|presupuesto/.test(t), 'anuncia los informes que vendrán');
await pag.locator('[data-a="abrir"]').first().click();
await pag.waitForTimeout(350);
t = await texto();
comprobar(/Todos los informes/.test(t), 'dentro de un informe hay botón para volver a la lista');
comprobar(/2026/.test(t) && /Ingresos y gastos por mes/i.test(t), 'abre el año más reciente con datos');
await pag.locator('.chips .pill', { hasText: '2025' }).click();
await pag.waitForTimeout(350);
t = await texto();
comprobar(/1\.?800/.test(t), 'el selector de años cambia de año');
await pag.locator('table.tabla tr[data-a="ir"]').first().click();
await pag.waitForTimeout(350);
comprobar(/marzo 2025/.test(await texto()), 'tocar un mes del informe lleva a sus movimientos');

console.log('\n--- 5. Compatibilidad de la ruta vieja ---');
await ir('#/finanzas?vista=anio&anio=2025');
t = await texto();
comprobar(/Resumen del año/.test(t) && /Ingresos y gastos por mes/i.test(t), '?vista=anio sigue abriendo el informe anual');

console.log('\n--- 6. Recurrentes ---');
await ir('#/finanzas?v=recurrentes');
t = await texto();
console.log('  ', t.split('\n').slice(0, 3).join(' | '));
comprobar(/Fly\.io/.test(t), 'lista los recurrentes');
comprobar(/72,00/.test(t), 'suma el coste anual');

console.log('\n--- 7. Ninguna sección pinta una fecha en ISO ---');
for (const r of ['#/hoy', '#/calendario', '#/notas', '#/ejercicio', '#/sueno', '#/alimentacion', '#/suplementos', '#/compra', '#/proyectos', '#/ocio', '#/mayordomo', '#/menu', '#/ajustes', '#/buscador', '#/meditacion', '#/preferencias']) {
  await ir(r);
  const cuerpo = await pag.locator('body').innerText();
  const iso = cuerpo.match(/\b20\d{2}-\d{2}-\d{2}\b/g);
  comprobar(!iso, `${r} sin fechas en ISO${iso ? ' — ' + iso.slice(0, 3) : ''}`);
}
const sub = await pag.locator('#sub').innerText();
console.log('  cabecera:', sub);
comprobar(/\d{2}\/\d{2}\/\d{4}/.test(sub), `la fecha de la cabecera va en dd/mm/aaaa — «${sub}»`);

console.log('\nerrores de consola:', errores.length ? errores : 'ninguno');
await nav.close(); srv.close();
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTODO OK');
process.exit(fallos.length || errores.length ? 1 : 0);
