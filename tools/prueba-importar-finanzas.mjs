// Prueba de humo de la importación de extractos en Finanzas: sirve docs/ en el 8099 y recorre con
// Playwright los cuatro caminos que importan — primera carga, reimportar saltando, reimportar
// reemplazando y cancelar — comprobando que dos apuntes gemelos del mismo día sobreviven y que un
// concepto puesto a mano nunca se pisa. Uso: npm i playwright && node tools/prueba-importar-finanzas.mjs
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

const CSV = ['Fecha;Concepto;Importe',
  '03/01/2025;MERCADONA MADRID;-45,30',
  '03/01/2025;MERCADONA MADRID;-45,30',   // gemelo legítimo: dos compras iguales el mismo día
  '05/01/2025;NOMINA EMPRESA;1.800,00',
  '07/01/2025;IBERDROLA LUZ;-72,15',
  'sin fecha;FILA ROTA;xxx',              // ilegible
].join('\n');

// El sandbox trae Chromium en /opt/pw-browsers; fuera de él vale el que traiga Playwright.
const enOpt = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers')
  .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f));
const nav = await chromium.launch(enOpt ? { executablePath: enOpt } : {});
const ctx = await nav.newContext();
const pag = await ctx.newPage();
const errores = [];
pag.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));

const fallos = [];
const comprobar = (ok, msg) => { console.log((ok ? '  ok  ' : '  FALLO ') + msg); if (!ok) fallos.push(msg); };

await pag.goto('http://localhost:8099/#/finanzas?mes=2025-01');
await pag.waitForSelector('[data-c="extracto"]', { state: 'attached', timeout: 15000 });

// Sube el CSV y rellena el diálogo de columnas. Devuelve el texto del toast final.
async function importar(modoDuplicados) {
  await pag.setInputFiles('[data-c="extracto"]', { name: 'extracto.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf-8') });
  await pag.waitForSelector('dialog.modal', { timeout: 5000 });
  const cols = await pag.locator('dialog.modal').last().innerText();
  await pag.selectOption('dialog.modal select[name="f"]', '0');
  await pag.selectOption('dialog.modal select[name="d"]', '1');
  await pag.selectOption('dialog.modal select[name="i"]', '2');
  await pag.locator('dialog.modal button[type="submit"]').click();
  await pag.waitForTimeout(400);
  const hayDlg = await pag.locator('dialog.modal select[name="modo"]').count();
  let textoDup = null;
  if (hayDlg) {
    textoDup = await pag.locator('dialog.modal').last().innerText();
    await pag.selectOption('dialog.modal select[name="modo"]', modoDuplicados);
    await pag.locator('dialog.modal button[type="submit"]').click();
    await pag.waitForTimeout(400);
  }
  const toast = await pag.locator('#toast').innerText().catch(() => '');
  const movs = await pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')).movimientos);
  return { cols, textoDup, toast, movs };
}

console.log('\n--- 1. Primera importación (base vacía) ---');
let r = await importar('saltar');
console.log('  diálogo columnas:', r.cols.replace(/\n/g, ' | ').slice(0, 160));
console.log('  toast:', r.toast);
comprobar(r.textoDup === null, 'sin base previa no pregunta por duplicados');
comprobar(r.movs.length === 4, `importa 4 movimientos (los dos gemelos incluidos) — hay ${r.movs.length}`);
comprobar(r.movs.filter(m => m.descripcion === 'MERCADONA MADRID').length === 2, 'los dos apuntes gemelos se conservan');
comprobar(r.movs.find(m => m.descripcion === 'NOMINA EMPRESA').concepto === 'ingresos', 'la nómina se clasifica como ingresos');
comprobar(/1 ilegible\b/.test(r.toast), 'la fila rota se cuenta como ilegible');

// Marca un concepto a mano para comprobar que «reemplazar» no lo pisa.
await pag.evaluate(() => {
  const e = JSON.parse(localStorage.getItem('maydom.v1'));
  const m = e.movimientos.find(x => x.descripcion === 'IBERDROLA LUZ');
  m.concepto = 'ocio'; m.conceptoManual = true;
  localStorage.setItem('maydom.v1', JSON.stringify(e));
});
await pag.reload();
await pag.waitForSelector('[data-c="extracto"]', { state: 'attached' });

console.log('\n--- 2. Reimportar el mismo CSV → SALTAR ---');
r = await importar('saltar');
console.log('  diálogo duplicados:', (r.textoDup || '').replace(/\n/g, ' | '));
console.log('  toast:', r.toast);
comprobar(r.textoDup !== null, 'pregunta antes de cargar porque ya existen');
comprobar(/4 ya/.test(r.textoDup || ''), 'cuenta los 4 existentes, gemelos incluidos (no 3)');
comprobar(r.movs.length === 4, `saltar no duplica nada — hay ${r.movs.length}`);
comprobar(r.movs.find(m => m.descripcion === 'IBERDROLA LUZ').concepto === 'ocio', 'saltar no toca el concepto manual');
comprobar(/0 nuevos/.test(r.toast) && /0 reemplazados/.test(r.toast), 'el resumen dice 0 nuevos y 0 reemplazados');

console.log('\n--- 3. Reimportar el mismo CSV → REEMPLAZAR ---');
r = await importar('reemplazar');
console.log('  toast:', r.toast);
comprobar(r.movs.length === 4, `reemplazar tampoco duplica — hay ${r.movs.length}`);
comprobar(/4 reemplazados/.test(r.toast), 'el resumen dice 4 reemplazados');
comprobar(r.movs.find(m => m.descripcion === 'IBERDROLA LUZ').concepto === 'ocio', 'reemplazar respeta el concepto puesto a mano');
comprobar(r.movs.find(m => m.descripcion === 'MERCADONA MADRID').concepto === 'alimentación', 'reemplazar recalcula el concepto automático');

console.log('\n--- 4. Cancelar el diálogo de duplicados no escribe nada ---');
await pag.setInputFiles('[data-c="extracto"]', { name: 'extracto.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf-8') });
await pag.waitForSelector('dialog.modal');
await pag.selectOption('dialog.modal select[name="f"]', '0');
await pag.selectOption('dialog.modal select[name="d"]', '1');
await pag.selectOption('dialog.modal select[name="i"]', '2');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(300);
await pag.locator('dialog.modal .cerrar').click();
await pag.waitForTimeout(300);
const tras = await pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')).movimientos);
console.log('  toast:', await pag.locator('#toast').innerText());
comprobar(tras.length === 4, `cancelar con la cruz deja 4 movimientos — hay ${tras.length}`);

console.log('\n--- 5. Un CSV con una fila nueva y tres repetidas ---');
const CSV2 = ['Fecha;Concepto;Importe', '03/01/2025;MERCADONA MADRID;-45,30', '09/01/2025;FARMACIA CENTRAL;-12,40'].join('\n');
await pag.setInputFiles('[data-c="extracto"]', { name: 'e2.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV2, 'utf-8') });
await pag.waitForSelector('dialog.modal');
await pag.selectOption('dialog.modal select[name="f"]', '0');
await pag.selectOption('dialog.modal select[name="d"]', '1');
await pag.selectOption('dialog.modal select[name="i"]', '2');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(300);
const t5 = await pag.locator('dialog.modal').last().innerText();
console.log('  diálogo:', t5.replace(/\n/g, ' | '));
comprobar(/1 es nuevo/.test(t5) && /1 ya está guardado/.test(t5), 'distingue 1 nuevo de 1 ya guardado');
await pag.selectOption('dialog.modal select[name="modo"]', 'saltar');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(300);
const fin = await pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')).movimientos);
comprobar(fin.length === 5, `la farmacia entra y el Mercadona no se repite — hay ${fin.length}`);
comprobar(fin.filter(m => m.descripcion === 'MERCADONA MADRID').length === 2, 'siguen siendo 2 los apuntes de Mercadona');

console.log('\n--- 6. Vista del año 2025 ---');
await pag.goto('http://localhost:8099/#/finanzas?vista=anio&anio=2025');
await pag.waitForTimeout(600);
const anio = await pag.locator('#vista, main').innerText().catch(() => '');
console.log(anio.split('\n').slice(0, 10).join(' | '));
comprobar(/5 movimientos/.test(anio), 'el informe del año cuenta los 5 movimientos');

console.log('\nerrores de consola:', errores.length ? errores : 'ninguno');
await nav.close(); srv.close();
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTODO OK');
process.exit(fallos.length || errores.length ? 1 : 0);
