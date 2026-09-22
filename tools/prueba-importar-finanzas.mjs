// Prueba de humo de la importación de extractos en Finanzas: sirve docs/ en el 8099 y recorre con
// Playwright los caminos que importan — primera carga, reimportar saltando, reimportar
// reemplazando, cancelar y reimportar con otro mapeo de columnas — comprobando que dos apuntes
// gemelos del mismo día sobreviven, que la descripción se compone de varias columnas y que un
// concepto puesto a mano nunca se pisa.
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
const movs = () => pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')).movimientos);

const irAImportar = async (recargar = false) => {
  await pag.goto('http://localhost:8099/#/finanzas?v=importar');
  if (recargar) await pag.reload();
  await pag.waitForSelector('[data-c="extracto"]', { state: 'attached', timeout: 15000 });
};
await irAImportar();

// Sube el CSV, rellena el diálogo de columnas (descCols = índices a marcar para la descripción) y,
// si sale el de duplicados, contesta con los modos pedidos. Devuelve los textos de cada diálogo.
async function importar({ csv = CSV, descCols = null, ig = 'saltar', par = 'reemplazar', cancelar = false } = {}) {
  await pag.setInputFiles('[data-c="extracto"]', { name: 'extracto.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
  await pag.waitForSelector('dialog.modal', { timeout: 5000 });
  const cols = await pag.locator('dialog.modal').last().innerText();
  const marcadasPorDefecto = await pag.locator('dialog.modal input[name="d"]:checked').evaluateAll(els => els.map(e => e.value));
  if (descCols) {
    for (const el of await pag.locator('dialog.modal input[name="d"]').all()) {
      const v = await el.getAttribute('value');
      await el.setChecked(descCols.includes(Number(v)));
    }
  }
  await pag.locator('dialog.modal button[type="submit"]').click();
  await pag.waitForTimeout(400);
  let dup = null;
  if (await pag.locator('dialog.modal select[name="ig"], dialog.modal select[name="par"]').count()) {
    dup = await pag.locator('dialog.modal').last().innerText();
    if (cancelar) { await pag.locator('dialog.modal .cerrar').click(); await pag.waitForTimeout(300); return { cols, dup, marcadasPorDefecto, toast: await pag.locator('#toast').innerText() }; }
    if (await pag.locator('dialog.modal select[name="ig"]').count()) await pag.selectOption('dialog.modal select[name="ig"]', ig);
    if (await pag.locator('dialog.modal select[name="par"]').count()) await pag.selectOption('dialog.modal select[name="par"]', par);
    await pag.locator('dialog.modal button[type="submit"]').click();
    await pag.waitForTimeout(400);
  }
  return { cols, dup, marcadasPorDefecto, toast: await pag.locator('#toast').innerText().catch(() => '') };
}

console.log('\n--- 1. Primera importación del formato real del banco ---');
let r = await importar();
console.log('  columnas marcadas por defecto:', r.marcadasPorDefecto.join(','), '→', r.cols.match(/Descripción[^\n]*/)?.[0]);
console.log('  toast:', r.toast);
let m = await movs();
comprobar(r.dup === null, 'sin base previa no pregunta por duplicados');
comprobar(JSON.stringify(r.marcadasPorDefecto) === '["2","3","8"]', `marca Concepto, Movimiento y Observaciones — marcó ${r.marcadasPorDefecto}`);
comprobar(m.length === 4, `importa 4 movimientos — hay ${m.length}`);
const bizum = m.find(x => x.fecha === '2025-12-31');
console.log('  descripción compuesta:', JSON.stringify(bizum.descripcion), '→', bizum.concepto);
comprobar(bizum.descripcion === 'Bizum · Enviado: 2 parte', 'une Concepto y Movimiento, y no repite lo que Observaciones ya dice en mayúsculas');
comprobar(bizum.concepto === 'transferencias', 'con la descripción completa clasifica el Bizum como transferencia');
const nom = m.find(x => x.importe > 0);
comprobar(nom.descripcion === 'Abono · NOMINA EMPRESA · Nómina mensual', `pega las tres columnas cuando aportan cosas distintas — «${nom.descripcion}»`);
comprobar(nom.concepto === 'ingresos', 'la nómina se clasifica como ingresos');
comprobar(m.filter(x => x.descripcion.includes('MERCADONA')).length === 2, 'los dos apuntes gemelos se conservan');
comprobar(m.every(x => !/EUR|49\d{3}/.test(x.descripcion)), 'ni la divisa ni el saldo disponible ensucian la descripción');
comprobar(/1 ilegible\b/.test(r.toast), 'la fila rota se cuenta como ilegible');

await pag.evaluate(() => {
  const e = JSON.parse(localStorage.getItem('maydom.v1'));
  const x = e.movimientos.find(z => z.descripcion.includes('MERCADONA'));
  x.concepto = 'ocio'; x.conceptoManual = true;
  localStorage.setItem('maydom.v1', JSON.stringify(e));
});
await irAImportar(true);

console.log('\n--- 2. Reimportar el mismo fichero igual → SALTAR ---');
r = await importar({ ig: 'saltar' });
console.log('  diálogo:', (r.dup || '').replace(/\n/g, ' | '));
console.log('  toast:', r.toast);
m = await movs();
comprobar(r.dup !== null, 'pregunta antes de escribir nada');
comprobar(/4 idénticos/.test(r.dup), 'los cuenta como 4 idénticos, gemelos incluidos');
comprobar(!/otra descripción/.test(r.dup), 'con el mismo mapeo no hay ninguno «parecido»');
comprobar(m.length === 4, `no duplica nada — hay ${m.length}`);
comprobar(m.find(x => x.conceptoManual).concepto === 'ocio', 'saltar no toca el concepto manual');

console.log('\n--- 3. Reimportar con OTRO mapeo de columnas (solo Movimiento) ---');
r = await importar({ descCols: [3], par: 'reemplazar' });
console.log('  diálogo:', (r.dup || '').replace(/\n/g, ' | '));
console.log('  toast:', r.toast);
m = await movs();
comprobar(/4 con la misma fecha e importe, pero otra descripción/.test(r.dup || ''), 'los reconoce como los mismos aunque cambie la descripción');
comprobar(m.length === 4, `cambiar de mapeo NO duplica el extracto — hay ${m.length}`);
comprobar(m.find(x => x.fecha === '2025-12-31').descripcion === 'Enviado: 2 parte', 'reemplazar deja la descripción del mapeo nuevo');
comprobar(m.find(x => x.conceptoManual).concepto === 'ocio', 'reemplazar respeta el concepto puesto a mano');

console.log('\n--- 4. Volver al mapeo bueno y cancelar ---');
r = await importar({ par: 'reemplazar', cancelar: true });
m = await movs();
console.log('  toast:', r.toast);
comprobar(m.length === 4 && m.find(x => x.fecha === '2025-12-31').descripcion === 'Enviado: 2 parte', 'cancelar no escribe nada');

console.log('\n--- 5. Fichero con una fila nueva y otra repetida ---');
const CSV2 = [CAB,
  '03/01/2025;03/01/2025;Compra tarjeta;MERCADONA MADRID;-45,30;EUR;1,00;EUR;',
  '09/01/2025;09/01/2025;Recibo;FARMACIA CENTRAL;-12,40;EUR;1,00;EUR;',
].join('\n');
r = await importar({ csv: CSV2, ig: 'saltar', par: 'saltar' });
console.log('  diálogo:', (r.dup || '').replace(/\n/g, ' | '));
m = await movs();
comprobar(/1 es nuevo y se añade/.test(r.dup || ''), 'distingue la fila nueva de la repetida');
comprobar(m.length === 5, `la farmacia entra y el Mercadona no se repite — hay ${m.length}`);
comprobar(m.filter(x => x.descripcion.includes('MERCADONA')).length === 2, 'siguen siendo 2 los apuntes de Mercadona');
comprobar(m.find(x => x.descripcion.includes('FARMACIA')).concepto === 'salud', 'la farmacia se clasifica en salud');

console.log('\n--- 6. Informe del año ---');
await pag.goto('http://localhost:8099/#/finanzas?v=informes&informe=anual&anio=2025');
await pag.waitForTimeout(600);
const anio = await pag.locator('#vista, main').innerText().catch(() => '');
console.log('  ' + anio.split('\n').slice(3, 6).join(' | '));
comprobar(/5 movimientos/.test(anio), 'el informe del año cuenta los 5 movimientos');

console.log('\nerrores de consola:', errores.length ? errores : 'ninguno');
await nav.close(); srv.close();
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTODO OK');
process.exit(fallos.length || errores.length ? 1 : 0);
