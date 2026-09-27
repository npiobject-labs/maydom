// Prueba de humo de la importación de extractos en Finanzas: sirve docs/ en el 8099 y recorre con
// Playwright los caminos que importan — primera carga del formato de BBVA (sin preguntar columnas),
// reimportar (siempre actualiza), reimportar con otro formato y otras columnas, cancelar, un fichero
// mixto y el mismo fichero en otra cuenta — comprobando que dos apuntes gemelos del mismo día
// sobreviven, que la descripción se compone de varias columnas y que un concepto puesto a mano
// nunca se pisa. Finanzas va con clave (ADR-011): la prueba crea una al empezar.
// Uso: npm i playwright && node tools/prueba-importar-finanzas.mjs
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
await new Promise(r => srv.listen(8099, r));

// Formato real del extracto: preámbulo, columnas de saldo y divisa que no aportan nada, y la
// descripción repartida entre Concepto, Movimiento y Observaciones (que repite en mayúsculas).
const CAB = 'F.Valor;Fecha;Concepto;Movimiento;Importe;Divisa;Disponible;Divisa;Observaciones';
const CSV = ['Fecha de generación del informe: 22/09/2026', '', CAB,
  '31/12/2025;31/12/2025;Bizum;Enviado: 2  parte;-50;EUR;49362.79;EUR;ENVIADO: 2  parte',
  '03/01/2025;03/01/2025;Compra tarjeta;MERCADONA MADRID;-45,30;EUR;49317,49;EUR;',
  '03/01/2025;03/01/2025;Compra tarjeta;MERCADONA MADRID;-45,30;EUR;49272,19;EUR;',
  '05/01/2025;05/01/2025;Abono;NOMINA EMPRESA;1.800,00;EUR;51072,19;EUR;Nómina mensual',
  'sin fecha;;FILA ROTA;;xxx;;;;',
].join('\n');

const enOpt = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers')
  .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f));
const nav = await chromium.launch(enOpt ? { executablePath: enOpt } : {});
const pag = await (await nav.newContext()).newPage();
const errores = [];
pag.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));

const fallos = [];
const comprobar = (ok, msg) => { console.log((ok ? '  ok  ' : '  FALLO ') + msg); if (!ok) fallos.push(msg); };
// Con clave, los movimientos solo están descifrados en memoria: se leen del estado de la app.
const movs = () => pag.evaluate(() => import('./app/nucleo.js').then(m => m.estado.movimientos));

await pag.goto('http://localhost:8099/#/finanzas?v=importar');
await pag.waitForSelector('[data-candado]');
await pag.locator('[data-candado] [name="clave"]').fill('1234');
await pag.locator('[data-candado] [name="otra"]').fill('1234');
await pag.locator('[data-candado] button[type="submit"]').click();
await pag.waitForSelector('[data-c="extracto"]', { state: 'attached', timeout: 15000 });

// Sube el CSV; si sale el diálogo de columnas (formato que no es de BBVA) marca `descCols`, y en el
// de importar elige la cuenta. Devuelve los textos de cada diálogo y el aviso final.
async function importar({ csv = CSV, descCols = null, cuenta = 'variables', cancelar = false } = {}) {
  await pag.setInputFiles('[data-c="extracto"]', { name: 'extracto.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
  await pag.waitForSelector('dialog.modal', { timeout: 5000 });
  let cols = null;
  if (/Columnas del extracto/.test(await pag.locator('dialog.modal').last().innerText())) {
    cols = await pag.locator('dialog.modal').last().innerText();
    if (descCols) for (const el of await pag.locator('dialog.modal input[name="d"]').all()) await el.setChecked(descCols.includes(Number(await el.getAttribute('value'))));
    await pag.locator('dialog.modal button[type="submit"]').click();
    await pag.waitForSelector('dialog.modal select[name="cuenta"]', { timeout: 5000 });
  }
  await pag.selectOption('dialog.modal select[name="cuenta"]', cuenta);
  await pag.waitForTimeout(100);
  const dlg = await pag.locator('dialog.modal').last().innerText();
  if (cancelar) await pag.locator('dialog.modal .cerrar').click();
  else await pag.locator('dialog.modal button[type="submit"]').click();
  await pag.waitForTimeout(400);
  return { cols, dlg, toast: await pag.locator('#toast').innerText().catch(() => '') };
}

console.log('\n--- 1. Primera importación del formato real del banco ---');
let r = await importar();
let m = await movs();
console.log('  diálogo:', r.dlg.replace(/\n/g, ' | '));
comprobar(r.cols === null, 'el formato de BBVA no pregunta columnas');
comprobar(/se añaden 4 nuevos y se actualizan 0/.test(r.dlg), 'dice cuántos entran y en qué cuenta');
comprobar(m.length === 4 && m.every(x => x.cuenta === 'variables'), `importa 4 movimientos en la cuenta elegida — hay ${m.length}`);
const bizum = m.find(x => x.fecha === '2025-12-31');
comprobar(bizum.descripcion === 'Bizum · Enviado: 2 parte', 'une Concepto y Movimiento, y no repite lo que Observaciones ya dice en mayúsculas');
comprobar(bizum.concepto === 'transferencias', 'con la descripción completa clasifica el Bizum como transferencia');
comprobar(bizum.saldo === 49362.79, 'guarda el saldo disponible que da el banco');
const nom = m.find(x => x.importe === 1800);
comprobar(nom.descripcion === 'Abono · NOMINA EMPRESA · Nómina mensual', `pega las tres columnas cuando aportan cosas distintas — «${nom.descripcion}»`);
comprobar(nom.concepto === 'ingresos', 'la nómina se clasifica como ingresos');
comprobar(m.filter(x => x.descripcion.includes('MERCADONA')).length === 2, 'los dos apuntes gemelos se conservan');
comprobar(m.every(x => !/EUR|49\d{3}/.test(x.descripcion)), 'ni la divisa ni el saldo disponible ensucian la descripción');
comprobar(/1 ilegible\b/.test(r.toast), 'la fila rota se cuenta como ilegible');

await pag.evaluate(() => import('./app/nucleo.js').then(n => { const x = n.estado.movimientos.find(z => z.descripcion.includes('MERCADONA')); x.concepto = 'ocio'; x.conceptoManual = true; n.guardar(); }));

console.log('\n--- 2. Reimportar el mismo fichero: siempre actualiza ---');
r = await importar();
m = await movs();
comprobar(/se añaden 0 nuevos y se actualizan 4/.test(r.dlg), 'los reconoce los 4, gemelos incluidos');
comprobar(m.length === 4, `no duplica nada — hay ${m.length}`);
comprobar(m.find(x => x.conceptoManual).concepto === 'ocio', 'actualizar no toca el concepto manual');

console.log('\n--- 3. Reimportar con otro formato y OTRAS columnas de descripción ---');
const OTRO = ['Fecha;Detalle;Importe;Saldo', '31/12/2025;Enviado: 2 parte;-50;1', '03/01/2025;MERCADONA MADRID;-45,30;1', '03/01/2025;MERCADONA MADRID;-45,30;1', '05/01/2025;NOMINA EMPRESA;1.800,00;1'].join('\n');
r = await importar({ csv: OTRO, descCols: [1] });
m = await movs();
comprobar(r.cols !== null, 'un formato que no es de BBVA pregunta las columnas');
comprobar(/se añaden 0 nuevos y se actualizan 4/.test(r.dlg), 'los reconoce como los mismos aunque cambie la descripción');
comprobar(m.length === 4, `cambiar de columnas NO duplica el extracto — hay ${m.length}`);
comprobar(m.find(x => x.fecha === '2025-12-31').descripcion === 'Enviado: 2 parte', 'actualizar deja la descripción del fichero nuevo');
comprobar(m.find(x => x.conceptoManual).concepto === 'ocio', 'y respeta el concepto puesto a mano');

console.log('\n--- 4. Cancelar ---');
r = await importar({ cancelar: true });
m = await movs();
comprobar(m.length === 4 && m.find(x => x.fecha === '2025-12-31').descripcion === 'Enviado: 2 parte', 'cancelar no escribe nada');
comprobar(/cancelada/.test(r.toast), 'y lo dice');

console.log('\n--- 5. Fichero con una fila nueva y otra repetida ---');
const CSV2 = [CAB,
  '03/01/2025;03/01/2025;Compra tarjeta;MERCADONA MADRID;-45,30;EUR;1,00;EUR;',
  '09/01/2025;09/01/2025;Recibo;FARMACIA CENTRAL;-12,40;EUR;1,00;EUR;',
].join('\n');
r = await importar({ csv: CSV2 });
m = await movs();
comprobar(/se añade 1 nuevo y se actualiza 1 que ya estaba/.test(r.dlg), 'distingue la fila nueva de la repetida');
comprobar(m.length === 5, `la farmacia entra y el Mercadona no se repite — hay ${m.length}`);
comprobar(m.filter(x => x.descripcion.includes('MERCADONA')).length === 2, 'siguen siendo 2 los apuntes de Mercadona');
comprobar(m.find(x => x.descripcion.includes('FARMACIA')).concepto === 'salud', 'la farmacia se clasifica en salud');

console.log('\n--- 6. El mismo fichero en otra cuenta ---');
r = await importar({ csv: CSV2, cuenta: 'ahorro' });
m = await movs();
comprobar(/«Ahorro» se añaden 2 nuevos/.test(r.dlg) && m.length === 7, `en otra cuenta son movimientos distintos — hay ${m.length}`);

console.log('\n--- 7. Listado del año ---');
await pag.goto('http://localhost:8099/#/finanzas?v=informes&informe=anual&anio=2025&cuenta=variables');
await pag.waitForTimeout(600);
const anio = await pag.locator('main').innerText().catch(() => '');
console.log('  ' + anio.split('\n').slice(3, 6).join(' | '));
comprobar(/5 movimientos/.test(anio), 'el resumen del año de esa cuenta cuenta sus 5 movimientos');

console.log('\nerrores de consola:', errores.length ? errores : 'ninguno');
await nav.close(); srv.close();
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTODO OK');
process.exit(fallos.length || errores.length ? 1 : 0);
