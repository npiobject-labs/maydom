// Prueba de humo del modo cocina: paso 0 de ingredientes (lo que falta va a Compra), pasos que la IA
// afina en segundo plano, temporizador que suena y se para, ficha plegada y sesión que sobrevive a
// una recarga. El gateway simulado da un paso de 3 segundos para no esperar minutos.
// Uso: npm i playwright && node tools/prueba-cocina.mjs
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


const FICHA = 'Ingredientes:\n1 rebanada de pan de ayer (100g),\n2 dientes de ajo,\nsal.\n\n____________________________\n\nPreparación:\nSofríe los ajos laminados en aceite. Cocina a fuego lento 10 minutos.';
await pag.goto('http://localhost:8095/?api=8098#/alimentacion?v=platos'); await pag.waitForTimeout(400);
await pag.evaluate(f => { const e = JSON.parse(localStorage.getItem('maydom.v1')); e.platos = [{ id: 'sopa', nombre: 'Sopas de ajo', momentos: ['cena'], tags: [], min: 25, descripcion: f }]; localStorage.setItem('maydom.v1', JSON.stringify(e)); }, FICHA);
await pag.reload(); await pag.waitForTimeout(400);
respuesta = { pasos: [{ texto: 'Lamina los ajos', min: 0 }, { texto: 'Sofríe los ajos', min: 0.05, cada: 0 }, { texto: 'Sirve caliente' }] };

console.log('\n--- 1. Botón Cocinar y paso 0 ---');
const cocinar = pag.locator('[data-a="cocinar"]', { hasText: 'Cocinar' });
comprobar(await cocinar.count() === 1, 'el plato tiene botón 🍳 Cocinar');
await cocinar.click(); await pag.waitForTimeout(700);
comprobar((await pag.evaluate(() => location.hash)).includes('v=cocinar'), 'abre el modo cocina');
comprobar(await pag.locator('.ingr').count() === 3, 'lista los tres ingredientes para marcar');
comprobar(await pag.locator('details.plegable').count() === 1 && !(await pag.locator('details.plegable').evaluate(d => d.open)), 'la ficha va en un desplegable cerrado');
comprobar(pedido?.operacion === 'plato-cocinar', 'pide los pasos a la IA en segundo plano');

console.log('\n--- 2. Lo que falta va a Compra ---');
await pag.locator('.ingr input').nth(0).check(); await pag.locator('.ingr input').nth(1).check();
await pag.locator('[data-a="faltaC"]').click(); await pag.waitForTimeout(200);
comprobar(await pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')).compra.some(c => c.nombre === 'sal' && c.origen === 'plato')), 'la sal, sin marcar, pasa a Compra');
await pag.locator('[data-a="todoC"]').click(); await pag.waitForTimeout(200);

console.log('\n--- 3. Pasos con temporizador ---');
await pag.locator('[data-a="empezarC"]').click(); await pag.waitForTimeout(300);
comprobar(await pag.locator('.paso').count() === 3, 'tres pasos, los de la IA');
comprobar((await pag.locator('.paso.actual').innerText()).includes('Lamina'), 'empieza por el primero');
comprobar(await pag.locator('.paso.actual [data-a="relojC"]').count() === 0, 'un paso sin tiempo no ofrece temporizador');
await pag.locator('.paso.actual [data-a="hechoC"]').click(); await pag.waitForTimeout(300);
const reloj = pag.locator('.paso.actual [data-a="relojC"]');
comprobar(await reloj.count() === 1, 'el paso de cocción ofrece temporizador');
await reloj.click(); await pag.waitForTimeout(300);
comprobar(await pag.locator('.reloj').count() === 1, 'el temporizador aparece arriba');
await pag.reload(); await pag.waitForTimeout(500);
comprobar(await pag.locator('.reloj').count() === 1 && (await pag.locator('.paso.actual').innerText()).includes('Sofríe'), 'tras recargar sigue el paso y el temporizador');
await pag.waitForTimeout(3500);
comprobar(await pag.locator('.reloj.sonando').count() === 1, 'al acabar el tiempo suena y se marca');
await pag.locator('.reloj [data-a="pararC"]').click(); await pag.waitForTimeout(200);
comprobar(await pag.locator('.reloj').count() === 0, 'Parar lo quita');

console.log('\n--- 4. Terminar ---');
await pag.locator('.paso.actual [data-a="hechoC"]').click(); await pag.waitForTimeout(200);
await pag.locator('.paso.actual [data-a="hechoC"]').click(); await pag.waitForTimeout(200);
await pag.locator('[data-a="finC"][data-apuntar]').click(); await pag.waitForTimeout(400);
comprobar(await pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')).comidas.some(c => c.que === 'Sopas de ajo')), 'se apunta como comida de hoy');
comprobar(await pag.evaluate(() => localStorage.getItem('maydom.cocina')) === null, 'la sesión de cocina se cierra');
comprobar(await pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')).platos[0].pasos?.length) === 3, 'los pasos de la IA quedan guardados en el plato');

comprobar(!errores.length, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
await nav.close(); web.close(); api.close();
console.log(fallos.length ? `\n${fallos.length} fallos` : '\ntodo bien');
process.exit(fallos.length ? 1 : 0);
