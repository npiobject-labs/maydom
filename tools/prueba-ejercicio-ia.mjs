// Prueba de humo del botón «Generar con IA» de Editar ejercicio: con un gateway simulado, comprueba
// que el botón queda bajo «Cómo se hace», que rellena el formulario abierto y que sin nombre no llama.
// Uso: npm i playwright && node tools/prueba-ejercicio-ia.mjs
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
await pag.goto('http://localhost:8095/?api=8098#/ejercicio?v=catalogo'); await pag.waitForTimeout(500);
respuesta = { descripcion: 'De pie, pies al ancho de hombros. Baja la cadera como si te sentaras.' + ' Mantén la espalda recta y el pecho abierto durante todo el recorrido.'.repeat(8), series: 4, reps: '12' };

console.log('\n--- 1. Nuevo ejercicio: botón bajo «Cómo se hace» ---');
await pag.locator('[data-a="nuevoEj"]').click();
await pag.waitForSelector('dialog.modal');
const boton = pag.locator('dialog.modal button', { hasText: 'Generar con IA' });
comprobar(await boton.count() === 1, 'hay botón «Generar con IA»');
const entre = await pag.evaluate(() => { const q = s => document.querySelector('dialog.modal ' + s).getBoundingClientRect(); return q('[name="descripcion"]').bottom <= q('[data-acciones]').top && q('[data-acciones]').bottom <= q('[name="series"]').top; });
comprobar(entre, 'el botón queda entre «Cómo se hace» y Series');

console.log('\n--- 2. Sin nombre no llama ---');
pedido = null; await boton.click(); await pag.waitForTimeout(300);
comprobar(pedido === null, 'sin nombre no hay llamada');

console.log('\n--- 3. Con nombre rellena el formulario abierto ---');
await pag.fill('dialog.modal [name="nombre"]', 'Sentadilla');
const alto = () => pag.locator('dialog.modal [name="descripcion"]').evaluate(t => t.getBoundingClientRect().height);
const antes = await alto();
await boton.click(); await pag.waitForTimeout(600);
const despues = await alto();
comprobar(despues > antes + 40, `la caja crece con el texto generado (${Math.round(antes)} → ${Math.round(despues)} px)`);
await pag.fill('dialog.modal [name="descripcion"]', 'corto');
comprobar(await alto() < despues, 'y encoge al borrar');
await boton.click(); await pag.waitForTimeout(600);
comprobar(JSON.stringify(pedido).includes('ejercicios'), 'la llamada lleva la operación ejercicios');
comprobar((await campo('descripcion')).startsWith('De pie'), 'explicación escrita');
comprobar(await campo('series') === '4' && await campo('reps') === '12', 'series y repeticiones escritas');
comprobar(await pag.locator('dialog.modal').count() === 1, 'la ventana sigue abierta');

console.log('\n--- 4. Editar ejercicio también lo tiene ---');
await pag.locator('dialog.modal button[type="submit"]').click(); await pag.waitForTimeout(400);
await pag.locator('[data-a="editarEj"]').first().click();
await pag.waitForSelector('dialog.modal');
comprobar(await pag.locator('dialog.modal button', { hasText: 'Generar con IA' }).count() === 1, 'hay botón en Editar ejercicio');

comprobar(!errores.length, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
await nav.close(); web.close(); api.close();
console.log(fallos.length ? `\n${fallos.length} fallos` : '\ntodo bien');
process.exit(fallos.length ? 1 : 0);
