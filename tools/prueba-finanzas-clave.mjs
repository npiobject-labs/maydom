// Prueba de humo de Finanzas con clave (ADR-011), cuentas por IBAN, extracto de BBVA en .xls y
// listados con parámetros. Sirve docs/ en el 8097 y recorre con Playwright:
// crear la clave (lo que había en claro pasa a cifrado), pedirla una sola vez al entrar, cerrarse al
// salir, rutas directas de Finanzas detrás del candado, importar el .xls de prueba en una cuenta
// (IBAN apuntado y reconocido la segunda vez, reimportar no duplica), listados con sus parámetros,
// copia JSON cifrada, dos copias de la app con Finanzas abierta y «He olvidado la clave».
// El .xls de tools/datos/ es un BIFF8 real (hecho con xlwt) con datos inventados.
// Uso: npm i playwright && node tools/prueba-finanzas-clave.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const RAIZ = path.join(AQUI, '..', 'docs');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => e ? (res.writeHead(404), res.end('404')) : (res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'text/plain' }), res.end(d)));
});
await new Promise(r => srv.listen(8097, r));
const URL0 = 'http://localhost:8097/';

const enOpt = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers')
  .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f));
const nav = await chromium.launch(enOpt ? { executablePath: enOpt } : {});
const ctx = await nav.newContext({ acceptDownloads: true });
const pag = await ctx.newPage();
const errores = [];
pag.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
const fallos = [];
const comprobar = (ok, msg) => { console.log((ok ? '  ok  ' : '  FALLO ') + msg); if (!ok) fallos.push(msg); };

const ls = k => pag.evaluate(k => localStorage.getItem(k), k);
const estadoGuardado = async () => JSON.parse(await ls('maydom.v1'));
const main = () => pag.locator('main').innerText();
const ir = async hash => { await pag.goto(URL0 + hash); await pag.waitForTimeout(350); };
const candado = () => pag.locator('[data-candado]').count();
async function entrar(clave, p = pag) {
  await p.locator('[data-candado] [name="clave"]').fill(clave);
  if (await p.locator('[data-candado] [name="otra"]').count()) await p.locator('[data-candado] [name="otra"]').fill(clave);
  await p.locator('[data-candado] button[type="submit"]').click();
  await p.waitForFunction(() => !document.querySelector('[data-candado] button[disabled]'), null, { timeout: 15000 });
  await p.waitForTimeout(300);
}
const CLAVE = 'pino-verde-7';

// Datos de antes de la clave, en claro: un movimiento y un recurrente.
await ir('#/hoy');
await pag.evaluate(() => { const e = JSON.parse(localStorage.getItem('maydom.v1')); e.movimientos = [{ id: 'm1', fecha: '2024-11-02', descripcion: 'FARMACIA CENTRO', importe: -12.5, concepto: 'salud' }]; e.recurrentes = [{ id: 'r1', descripcion: 'Hosting', importe: -5, concepto: 'hosting', dia: 1 }]; localStorage.setItem('maydom.v1', JSON.stringify(e)); });
await pag.reload(); await pag.waitForTimeout(300);

console.log('\n--- 1. Crear la clave ---');
await ir('#/finanzas');
comprobar(await candado() === 1 && /Pon una clave a Finanzas/.test(await main()), 'sin clave, Finanzas solo enseña cómo crearla');
comprobar(/no se pueden recuperar/.test(await main()), 'avisa de que olvidarla es perder los datos');
await pag.locator('[data-candado] [name="clave"]').fill(CLAVE);
await pag.locator('[data-candado] [name="otra"]').fill('otra-cosa');
await pag.locator('[data-candado] button[type="submit"]').click();
await pag.waitForTimeout(200);
comprobar(/no coinciden/.test(await main()), 'si las dos claves no coinciden, lo dice y no crea nada');
await entrar(CLAVE);
comprobar(await candado() === 0 && /Movimientos/.test(await main()), 'con la clave creada entra en Finanzas');
let e = await estadoGuardado();
const cofre = await ls('maydom.finanzas');
comprobar(e.movimientos.length === 0 && e.recurrentes.length === 0, 'maydom.v1 ya no lleva movimientos ni recurrentes en claro');
comprobar(!!cofre && !cofre.includes('FARMACIA') && JSON.parse(cofre).kdf === 'PBKDF2-SHA256', 'van en maydom.finanzas, cifrados');
await ir('#/finanzas?v=movimientos&mes=2024-11');
comprobar((await main()).includes('FARMACIA CENTRO'), 'el movimiento de antes sigue ahí, descifrado');

console.log('\n--- 2. Una sola vez al entrar; al salir se cierra ---');
for (const v of ['importar', 'informes', 'recurrentes']) {
  await pag.locator(`.pestanas [data-v="${v}"]`).click(); await pag.waitForTimeout(250);
  comprobar(await candado() === 0, `la pestaña ${v} no vuelve a pedir la clave`);
}
comprobar(/Gastos fijos/.test(await (await ir('#/finanzas?v=importar'), main())) && /Ingresos y gastos variables/.test(await main()) && /Ahorro/.test(await main()), 'hay tres cuentas: Gastos fijos, Ingresos y gastos variables y Ahorro');
await ir('#/menu');
comprobar(/🔒 con clave/.test(await main()) && !/FARMACIA/.test(await main()), 'al salir se cierra: el menú no enseña cifras');
comprobar(await pag.evaluate(() => import('./app/nucleo.js').then(m => m.estado.movimientos.length)) === 0, 'y la memoria no guarda ningún movimiento');
await ir('#/finanzas?v=informes&informe=anual&anio=2024');
comprobar(await candado() === 1 && !/FARMACIA|12,50/.test(await main()), 'una ruta directa a un listado pasa antes por el candado');
await entrar('mala');
comprobar(/no es la clave/.test(await main()) && await candado() === 1, 'con la clave mala no entra');
await entrar(CLAVE);
comprobar(/Resumen del año/.test(await main()) && /12,50/.test(await main()), 'con la buena abre justo el listado pedido');
await pag.locator('.pestanas [data-a="bloquear"]').click(); await pag.waitForTimeout(200);
comprobar(await candado() === 1, 'el 🔒 de las pestañas la cierra al momento');
await entrar(CLAVE);

console.log('\n--- 3. Extracto de BBVA en .xls: cuenta por IBAN ---');
await ir('#/finanzas?v=importar');
const XLS = fs.readFileSync(path.join(AQUI, 'datos', 'extracto-bbva-prueba.xls'));
await pag.setInputFiles('[data-c="extracto"]', { name: 'extracto-bbva.xls', mimeType: 'application/vnd.ms-excel', buffer: XLS });
await pag.waitForSelector('dialog.modal select[name="cuenta"]', { timeout: 8000 });
let dlg = await pag.locator('dialog.modal').innerText();
comprobar(!/Columnas del extracto/.test(dlg), 'el formato de BBVA no pregunta columnas');
comprobar(/ES12 •••• 7890/.test(dlg) && await pag.locator('dialog.modal [name="recordar"]').isChecked(), 'reconoce el IBAN del extracto y propone apuntarlo');
await pag.selectOption('dialog.modal select[name="cuenta"]', 'fijos');
await pag.waitForTimeout(100);
comprobar(/«Gastos fijos» se añaden 204 nuevos y se actualizan 0/.test(await pag.locator('dialog.modal').innerText()), 'el texto dice cuántos entran en la cuenta elegida');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(500);
comprobar(/no se ha guardado en la app/.test(await pag.locator('#toast').innerText()), 'recuerda que el fichero no se guarda y se puede borrar');
let movs = await pag.evaluate(() => import('./app/nucleo.js').then(m => m.estado.movimientos));
const nomina = movs.find(m => /NOMINA/.test(m.descripcion));
comprobar(movs.length === 205 && movs.filter(m => m.cuenta === 'fijos').length === 204, `204 movimientos en Gastos fijos (+1 de antes) — ${movs.length}`);
comprobar(nomina?.descripcion === 'Abono · NOMINA EMPRESA · Nómina mensual ñandú 20€' && nomina.importe === 1800 && nomina.fecha === '2025-01-05', `descripción, importe y fecha del .xls — «${nomina?.descripcion}»`);
comprobar(nomina?.saldo === 51659.4, 'guarda el saldo que da el banco');
comprobar(movs.filter(m => /MERCADONA/.test(m.descripcion)).length === 2, 'los dos apuntes gemelos se conservan');
comprobar(/ES12 •••• 7890/.test(await main()) && /saldo/.test(await main()), 'la cuenta queda con su IBAN y su último saldo');
// Un concepto puesto a mano no lo pisa reimportar.
await pag.evaluate(() => import('./app/nucleo.js').then(m => { const x = m.estado.movimientos.find(z => /Bizum/.test(z.descripcion)); x.concepto = 'ocio'; x.conceptoManual = true; m.guardar(); }));
await pag.setInputFiles('[data-c="extracto"]', { name: 'extracto-bbva.xls', mimeType: 'application/vnd.ms-excel', buffer: XLS });
await pag.waitForSelector('dialog.modal select[name="cuenta"]', { timeout: 8000 });
dlg = await pag.locator('dialog.modal').innerText();
comprobar(await pag.locator('dialog.modal select[name="cuenta"]').inputValue() === 'fijos' && !(await pag.locator('dialog.modal [name="recordar"]').count()), 'la segunda vez la cuenta sale sola por el IBAN');
comprobar(/se añaden 0 nuevos y se actualizan 204/.test(dlg), 'y reimportar el mismo extracto solo actualiza');
await pag.locator('dialog.modal button[type="submit"]').click(); await pag.waitForTimeout(500);
movs = await pag.evaluate(() => import('./app/nucleo.js').then(m => m.estado.movimientos));
comprobar(movs.length === 205, `no duplica nada — ${movs.length}`);
comprobar(movs.find(m => /Bizum/.test(m.descripcion)).concepto === 'ocio', 'el concepto puesto a mano no se toca');
// Cancelar no escribe.
await pag.setInputFiles('[data-c="extracto"]', { name: 'extracto-bbva.xls', mimeType: 'application/vnd.ms-excel', buffer: XLS });
await pag.waitForSelector('dialog.modal select[name="cuenta"]', { timeout: 8000 });
await pag.selectOption('dialog.modal select[name="cuenta"]', 'ahorro');
await pag.locator('dialog.modal .cerrar').click(); await pag.waitForTimeout(300);
comprobar((await pag.evaluate(() => import('./app/nucleo.js').then(m => m.estado.movimientos.length))) === 205, 'cancelar no escribe nada');

console.log('\n--- 4. Listados con parámetros ---');
await pag.locator('.pestanas [data-v="informes"]').click(); await pag.waitForTimeout(250);
comprobar(/Listados/.test(await pag.locator('.pestanas').innerText()) && /Gasto por concepto/.test(await main()) && /Cuentas/.test(await main()), 'la pestaña se llama Listados y ofrece varios');
await pag.locator('[data-a="abrir"][data-id="movimientos"]').click();
await pag.waitForSelector('dialog.modal [name="desde"]');
comprobar(await pag.locator('dialog.modal [name="desde"]').inputValue() === '2025-01-01', 'antes de listar pide los parámetros, con valores de partida');
await pag.fill('dialog.modal [name="desde"]', '2025-01-01'); await pag.fill('dialog.modal [name="hasta"]', '2025-01-31');
await pag.selectOption('dialog.modal select[name="tipo"]', 'gastos');
await pag.locator('dialog.modal button[type="submit"]').click(); await pag.waitForTimeout(300);
let t = await main();
comprobar(/2 movimientos/.test(t) && /MERCADONA/.test(t) && !/NOMINA/.test(t), `enero de 2025, solo gastos: los dos de Mercadona — ${t.match(/\d+ movimientos?/)?.[0]}`);
comprobar(/01\/01\/2025 → 31\/01\/2025/.test(t) && /solo gastos/.test(t), 'encima del listado, los parámetros elegidos');
await pag.locator('[data-a="cambiar"]').click();
await pag.waitForSelector('dialog.modal [name="texto"]');
comprobar(await pag.locator('dialog.modal [name="hasta"]').inputValue() === '2025-01-31', '«Cambiar» vuelve a los parámetros con lo elegido');
await pag.selectOption('dialog.modal select[name="tipo"]', '');
await pag.fill('dialog.modal [name="texto"]', 'nómina');
await pag.locator('dialog.modal button[type="submit"]').click(); await pag.waitForTimeout(300);
t = await main();
comprobar(/1 movimiento\b/.test(t) && /NOMINA/.test(t), 'buscar por texto sin tildes encuentra la nómina');
await ir('#/finanzas?v=informes&informe=cuentas');
t = await main();
comprobar(/Gastos fijos/.test(t) && /204 movimientos/.test(t) && /saldo/.test(t), 'el listado de cuentas da movimientos y saldo por cuenta');
await ir('#/finanzas?v=informes&informe=conceptos&desde=2025-01-01&hasta=2025-12-31');
comprobar(/Gasto por concepto/.test(await main()) && /alimentación/.test(await main()), 'gasto por concepto, abierto desde la ruta con sus parámetros');
comprobar(!/\d{4}-\d\d-\d\d/.test(await main()), 'sin fechas ISO a la vista');

console.log('\n--- 5. Copia JSON: Finanzas viaja cifrada ---');
await ir('#/ajustes');
const [descarga] = await Promise.all([pag.waitForEvent('download'), pag.locator('[data-a="exportar"]').click()]);
const copia = JSON.parse(fs.readFileSync(await descarga.path(), 'utf-8'));
comprobar(copia.movimientos.length === 0 && !!copia.__finanzas && !JSON.stringify(copia).includes('MERCADONA'), 'la copia no lleva ni un movimiento en claro, sí el cofre cifrado');
comprobar(/finanzas 🔒 cifrada/.test(await main()), 'Ajustes no cuenta movimientos: dice que Finanzas está cifrada');

console.log('\n--- 6. Dos copias de la app con Finanzas abierta ---');
const otra = await ctx.newPage();
await otra.goto(URL0 + '#/finanzas?v=movimientos&mes=2026-01'); await otra.waitForTimeout(300);
await entrar(CLAVE, otra);
await ir('#/finanzas?v=movimientos&mes=2026-01'); await entrar(CLAVE);
const alta = async (p, desc) => {
  await p.locator('[data-a="nuevo"]').click(); await p.waitForSelector('dialog.modal [name="descripcion"]');
  await p.fill('dialog.modal [name="fecha"]', '2026-01-10'); await p.fill('dialog.modal [name="descripcion"]', desc); await p.fill('dialog.modal [name="importe"]', '-3');
  await p.locator('dialog.modal button[type="submit"]').click(); await p.waitForTimeout(500);
};
await alta(pag, 'ALTA EN LA PRIMERA');
await otra.bringToFront();
await alta(otra, 'ALTA EN LA SEGUNDA');
await pag.bringToFront(); await pag.waitForTimeout(300);
await pag.evaluate(() => import('./app/cofre.js').then(m => m.pendiente()));
await otra.evaluate(() => import('./app/cofre.js').then(m => m.pendiente()));
await ir('#/hoy'); await ir('#/finanzas?v=movimientos&mes=2026-01'); await entrar(CLAVE);
t = await main();
comprobar(/ALTA EN LA PRIMERA/.test(t) && /ALTA EN LA SEGUNDA/.test(t), 'las altas de las dos copias sobreviven en el cofre');
await otra.close();

console.log('\n--- 7. He olvidado la clave ---');
await ir('#/hoy'); await ir('#/finanzas');
await pag.locator('[data-a="olvido"]').click();
await pag.waitForSelector('dialog.modal [name="ok"]');
await pag.fill('dialog.modal [name="ok"]', 'no');
await pag.locator('dialog.modal button[type="submit"]').click(); await pag.waitForTimeout(250);
comprobar(!!(await ls('maydom.finanzas')), 'sin escribir BORRAR no se borra nada');
await pag.locator('[data-a="olvido"]').click();
await pag.waitForSelector('dialog.modal [name="ok"]');
await pag.fill('dialog.modal [name="ok"]', 'BORRAR');
await pag.locator('dialog.modal button[type="submit"]').click(); await pag.waitForTimeout(300);
comprobar(!(await ls('maydom.finanzas')) && /Pon una clave a Finanzas/.test(await main()), 'con BORRAR se va todo y toca crear otra clave');

console.log('\n--- 8. Restaurar la copia cifrada ---');
await ir('#/ajustes');
await pag.setInputFiles('[data-c="importar"]', { name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(copia)) });
await pag.waitForSelector('dialog.modal'); await pag.locator('dialog.modal button[type="submit"]').click(); await pag.waitForTimeout(400);
await ir('#/finanzas?v=informes&informe=cuentas'); await entrar(CLAVE);
comprobar(/204 movimientos/.test(await main()), 'importar la copia devuelve Finanzas, con la clave que tenía');

console.log('\n--- 9. Cambiar la clave ---');
await ir('#/finanzas?v=importar');
await pag.locator('[data-a="clave"]').click();
await pag.waitForSelector('dialog.modal [name="actual"]');
await pag.fill('dialog.modal [name="actual"]', 'no-es'); await pag.fill('dialog.modal [name="nueva"]', 'nueva-clave'); await pag.fill('dialog.modal [name="otra"]', 'nueva-clave');
await pag.locator('dialog.modal button[type="submit"]').click(); await pag.waitForTimeout(1500);
comprobar(/no es esa/.test(await pag.locator('#toast').innerText()), 'sin la clave de ahora no se cambia');
await pag.locator('[data-a="clave"]').click();
await pag.waitForSelector('dialog.modal [name="actual"]');
await pag.fill('dialog.modal [name="actual"]', CLAVE); await pag.fill('dialog.modal [name="nueva"]', 'nueva-clave'); await pag.fill('dialog.modal [name="otra"]', 'nueva-clave');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForFunction(() => /Clave cambiada/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 15000 });
await ir('#/hoy'); await ir('#/finanzas?v=informes&informe=cuentas');
await entrar(CLAVE);
comprobar(await candado() === 1, 'la clave vieja ya no abre');
await entrar('nueva-clave');
comprobar(/204 movimientos/.test(await main()), 'la nueva sí, con todo dentro');

console.log('\nerrores de consola:', errores.length ? errores : 'ninguno');
await nav.close(); srv.close();
console.log(fallos.filter(Boolean).length ? `\n${fallos.length} FALLOS` : '\nTODO OK');
process.exit(fallos.length || errores.length ? 1 : 0);
