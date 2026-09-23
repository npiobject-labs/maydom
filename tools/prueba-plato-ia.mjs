// Prueba de humo del botón «Crear con IA» de Editar plato: con un gateway simulado, comprueba que
// el botón queda debajo de la descripción, que rellena el formulario abierto sin cerrarlo y que
// sin nombre no gasta ninguna llamada.
// Uso: npm i playwright && node tools/prueba-plato-ia.mjs
// Uso: npm i playwright && node tools/prueba-sueno-relato.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'docs');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const web = http.createServer((req, res) => {
  let f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => e ? (res.writeHead(404), res.end('404')) : (res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'text/plain' }), res.end(d)));
});
await new Promise(r => web.listen(8095, r));

// Gateway simulado: responde lo que se le diga en `respuesta`, o falla si `fallar` está puesto.
let respuesta = null, fallar = null, pedido = null;
const api = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let cuerpo = '';
  req.on('data', c => cuerpo += c);
  req.on('end', () => {
    if (req.url.startsWith('/api/estado')) { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); return res.end(JSON.stringify({ llm: true, modelo: 'simulado', clave_requerida: false, build: 'test' })); }
    pedido = JSON.parse(cuerpo || '{}');
    if (fallar) { res.writeHead(503, { ...cors, 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: fallar, code: 'gateway_simulado' })); }
    res.writeHead(200, { ...cors, 'content-type': 'application/json' });
    res.end(JSON.stringify({ respuesta: JSON.stringify(respuesta) }));
  });
});
await new Promise(r => api.listen(8098, r));

const enOpt = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers')
  .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f));
const nav = await chromium.launch(enOpt ? { executablePath: enOpt } : {});
const pag = await (await nav.newContext()).newPage();
const errores = [];
pag.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
const fallos = [];
const comprobar = (ok, msg) => { console.log((ok ? '  ok  ' : '  FALLO ') + msg); if (!ok) fallos.push(msg); };

const campo = n => pag.locator(`dialog.modal [name="${n}"]`).inputValue();
await pag.goto('http://localhost:8095/?api=8098#/alimentacion?v=platos'); await pag.waitForTimeout(500);
respuesta = { ingredientes: ['80 g de arroz integral', '100 g de tofu'], preparacion: ['Cuece el arroz. Saltea el tofu.'], racion: '450 kcal, 20g proteína, 60g hidratos, 12g grasa', nota: '', etiquetas: ['vegetal'], momentos: ['comida'], min: 35 };
const RAYA = '____________________________';

console.log('\n--- 1. Nuevo plato: el botón va debajo de la descripción ---');
await pag.locator('[data-a="nuevoPl"]').click();
await pag.waitForSelector('dialog.modal');
const boton = pag.locator('dialog.modal button', { hasText: 'Crear con IA' });
comprobar(await boton.count() === 1, 'hay botón «Crear con IA»');
const debajo = await pag.evaluate(() => { const d = document.querySelector('dialog.modal [name="descripcion"]'); const z = document.querySelector('dialog.modal [data-acciones]'); return d.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING && z.getBoundingClientRect().top < document.querySelector('dialog.modal [name="momentos"]').getBoundingClientRect().top; });
comprobar(!!debajo, 'el botón queda entre la descripción y el momento');

console.log('\n--- 2. Sin nombre no llama ---');
pedido = null; await boton.click(); await pag.waitForTimeout(300);
comprobar(pedido === null, 'sin nombre no hay llamada');

console.log('\n--- 3. Con nombre rellena el formulario abierto ---');
await pag.fill('dialog.modal [name="nombre"]', 'Arroz integral con tofu');
await boton.click(); await pag.waitForTimeout(600);
comprobar(pedido?.operacion === 'plato' || JSON.stringify(pedido).includes('plato'), 'la llamada lleva la operación del plato');
comprobar(await campo('descripcion') === `Ingredientes:\n80 g de arroz integral,\n100 g de tofu.\n\n${RAYA}\n\nPreparación:\nCuece el arroz. Saltea el tofu.\n\n${RAYA}\n\nPor ración:\n450 kcal, 20g proteína, 60g hidratos, 12g grasa.`, 'descripción escrita con el formato de la ficha');
comprobar(await campo('tags') === 'vegetal', 'etiquetas escritas');
comprobar(await campo('min') === '35', 'minutos escritos');
comprobar(await pag.locator('dialog.modal').count() === 1, 'la ventana sigue abierta');

console.log('\n--- 4. Editar plato también lo tiene ---');
await pag.locator('dialog.modal button[type="submit"]').click(); await pag.waitForTimeout(400);
await pag.locator('[data-a="editarPl"]').first().click();
await pag.waitForSelector('dialog.modal');
comprobar(await pag.locator('dialog.modal button', { hasText: 'Crear con IA' }).count() === 1, 'hay botón en Editar plato');

console.log('\n--- 5. Los platos ya guardados pasan al formato al arrancar ---');
await pag.keyboard.press('Escape');
await pag.evaluate(() => { const e = JSON.parse(localStorage.getItem('maydom.v1')); e.platos.push({ id: 'viejo', nombre: 'Sopas de ajo', momentos: ['cena'], tags: [], min: 25, descripcionManual: true, descripcion: 'Ingredientes: 1 rebanada de pan de ayer (100g), 2 dientes de ajo, sal.\nPreparación: Sofríe los ajos. Añade el pan. Vierte el caldo. Cocina 10 minutos.\nPor ración: 450 kcal.\nNota: Ideal para cenar' }, { id: 'libre', nombre: 'Libre', momentos: [], tags: [], descripcion: 'texto libre' }); localStorage.setItem('maydom.v1', JSON.stringify(e)); });
await pag.reload(); await pag.waitForTimeout(500);
const tras = await pag.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem('maydom.v1')).platos.map(p => [p.id, p.descripcion])));
comprobar(tras.viejo === `Ingredientes:\n1 rebanada de pan de ayer (100g),\n2 dientes de ajo,\nsal.\n\n${RAYA}\n\nPreparación:\nSofríe los ajos. Añade el pan.\n\nVierte el caldo. Cocina 10 minutos.\n\n${RAYA}\n\nPor ración:\n450 kcal.\n\n${RAYA}\n\nNota:\nIdeal para cenar`, 'ficha antigua migrada y persistida');
comprobar(tras.libre === 'texto libre', 'un texto sin apartados no se toca');
comprobar(await pag.evaluate(() => getComputedStyle(document.querySelector('.cuerpo.ficha')).whiteSpace) === 'pre-wrap', 'la lista respeta los saltos de línea');

comprobar(!errores.length, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
await nav.close(); web.close(); api.close();
console.log(fallos.length ? `\n${fallos.length} fallos` : '\ntodo bien');
process.exit(fallos.length ? 1 : 0);
