// Prueba de humo de Notas por tipo (mock 5): un solo diálogo que clasifica en tarea, compra o idea
// por reglas y con el mayordomo; fecha tope leída del dictado; compras partidas en líneas que van a
// la lista de Compra sin duplicar; una nota que mezcla se guarda por separado; las tareas salen en
// Hoy y en el Calendario; y las notas de antes pasan a ser ideas.
// El mayordomo se simula interceptando POST /api/mayordomo, así que no hace falta backend.
// Uso: npm i playwright && node tools/prueba-notas.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'docs');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const web = http.createServer((req, res) => {
  let f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => e ? (res.writeHead(404), res.end('404')) : (res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'text/plain' }), res.end(d)));
});
await new Promise(r => web.listen(8096, r));
const URL0 = 'http://localhost:8096/';

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HOY = new Date(); HOY.setHours(12, 0, 0, 0);
const mas = n => { const d = new Date(HOY); d.setDate(d.getDate() + n); return iso(d); };
const VIERNES = mas(((5 - HOY.getDay() + 7) % 7) || 7), JUEVES = mas(((4 - HOY.getDay() + 7) % 7) || 7);

const enOpt = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers')
  .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f));
const nav = await chromium.launch(enOpt ? { executablePath: enOpt } : {});
const pag = await nav.newPage({ viewport: { width: 390, height: 844 } });
const errores = [];
pag.on('pageerror', e => errores.push(e.message));
pag.on('console', m => { if (m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) errores.push(m.text()); });
const fallos = [];
const comprobar = (ok, msg) => { console.log((ok ? '  ok  ' : '  FALLO ') + msg); if (!ok) fallos.push(msg); };
const datos = () => pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')));
const ir = async h => { await pag.goto(URL0 + h); await pag.waitForTimeout(350); };

// Mayordomo simulado: responde según el texto; con `sinLLM` contesta 503 como sin LLM_API_KEY.
let sinLLM = false, llamadas = 0;
await pag.route('**/api/mayordomo', async ruta => {
  llamadas++;
  if (sinLLM) return ruta.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'falta_llm_api_key' }) });
  const m = JSON.parse(ruta.request().postData()).mensajes[0].contenido;
  let j = { clase: 'idea', titulo: 'Caminar después de comer', etiquetas: ['ejercicio'], tipo: 'preferencia', tope: '', lineas: [], partes: [] };
  if (/ITV/.test(m)) j = { clase: 'tarea', titulo: 'Llevar el coche a la ITV', etiquetas: [], tipo: 'nota', tope: VIERNES, lineas: [], partes: [] };
  if (/leche/.test(m)) j = { clase: 'compra', titulo: 'Compra de la semana', etiquetas: [], tipo: 'nota', tope: '', lineas: [{ nombre: 'leche', cantidad: '2 l', etiqueta: 'alimentacion' }, { nombre: 'pan', cantidad: '', etiqueta: 'alimentacion' }, { nombre: 'pilas', cantidad: '4', etiqueta: 'otras' }], partes: [] };
  if (/gestor/.test(m)) j = { clase: 'tarea', titulo: 'Llamar a la gestoría', etiquetas: [], tipo: 'nota', tope: JUEVES, lineas: [{ nombre: 'sobres', cantidad: '', etiqueta: 'otras' }], partes: [{ clase: 'tarea', texto: 'Llamar a la gestoría el jueves' }, { clase: 'compra', texto: 'comprar sobres' }] };
  await new Promise(r => setTimeout(r, 150));
  ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ respuesta: JSON.stringify(j) }) });
});
// Escribe en el diálogo y sale del campo, como al terminar un dictado.
const escribir = async texto => { await pag.fill('.dialogo-nota [name=texto]', texto); await pag.waitForTimeout(400); await pag.dispatchEvent('.dialogo-nota [name=texto]', 'change'); await pag.waitForTimeout(400); };
const clase = () => pag.$eval('.dialogo-nota [data-clase].sel', b => b.dataset.clase);
const guardarDialogo = async () => { await pag.click('.dialogo-nota button[type=submit]'); await pag.waitForTimeout(500); };

// Estado de partida: una nota de las de antes (sin clase) y una línea de compra manual.
await pag.goto(URL0);
await pag.evaluate(() => localStorage.setItem('maydom.v1', JSON.stringify({
  notas: [{ id: 'vieja', fecha: '2026-09-20', texto: 'Cenar antes de las nueve me ayuda a dormir', titulo: 'Cenar antes de las nueve', tituloManual: true, tipo: 'preferencia', etiquetas: ['sueno'], analizada: true }],
  compra: [{ id: 'm1', nombre: 'Leche', cantidad: '', tienda: '', origen: 'manual', refId: null, comprado: false }],
  ajustes: { semillasCargadas: true },
})));
await pag.reload(); await pag.waitForTimeout(300);

console.log('\n--- 1. Las notas de antes pasan a ser ideas, y se guarda ---');
await ir('#/notas');
comprobar((await datos()).notas[0].clase === 'idea', 'la nota antigua es una idea en localStorage');
comprobar(await pag.locator('.pestanas button').allTextContents().then(t => t.join('|')).then(t => /Tareas/.test(t) && /Compras1/.test(t) && /Ideas1/.test(t)), 'pestañas Tareas, Compras (1) e Ideas (1)');
comprobar(await pag.locator('.pestanas button.sel').textContent() === 'Tareas', 'abre en Tareas');

console.log('\n--- 2. Tarea dictada: clase y fecha tope por reglas; título del mayordomo ---');
await pag.click('[data-a=nueva]');
comprobar(await pag.locator('.dialogo-nota h2').textContent() === 'Nueva nota', 'el diálogo genérico se titula «Nueva nota»');
await pag.fill('.dialogo-nota [name=texto]', 'Tengo que llevar el coche a la ITV antes del viernes');
await pag.waitForTimeout(450);
comprobar(await clase() === 'tarea', 'las reglas la ven como tarea mientras se escribe');
comprobar(await pag.inputValue('.dialogo-nota [name=tope]') === VIERNES, 'fecha tope = el próximo viernes ' + VIERNES);
comprobar(/antes del viernes/.test(await pag.textContent('.dialogo-nota [data-leido]')), 'dice de dónde ha sacado la fecha');
comprobar(await pag.getAttribute('.dialogo-nota [name=titulo]', 'placeholder') === 'Llevar el coche a la ITV', 'título provisional por reglas');
llamadas = 0;
await pag.dispatchEvent('.dialogo-nota [name=texto]', 'change'); await pag.waitForTimeout(400);
comprobar(/mayordomo/i.test(await pag.textContent('.dialogo-nota [data-detectado]')), 'el mayordomo confirma la clase');
await guardarDialogo();
await pag.waitForTimeout(300);
let d = await datos(), tarea = d.notas.find(n => n.clase === 'tarea');
comprobar(tarea && tarea.tope === VIERNES && tarea.titulo === 'Llevar el coche a la ITV' && !tarea.hecha, 'tarea guardada con tope y título');
comprobar(llamadas === 1, `una sola llamada al mayordomo por nota (hubo ${llamadas})`);
comprobar(await pag.locator('.tarea').count() === 1, 'aparece en la pestaña Tareas');

console.log('\n--- 3. Compra dictada: líneas con etiqueta en la lista de Compra, sin duplicar ---');
await pag.click('[data-a=nueva]');
await escribir('Comprar dos litros de leche, pan y cuatro pilas');
comprobar(await clase() === 'compra', 'la ve como compra');
comprobar(await pag.locator('.linea-compra').count() === 3, 'tres líneas');
await guardarDialogo();
d = await datos();
comprobar(d.compra.filter(c => c.origen === 'nota').length === 2, 'entran dos líneas nuevas (pan y pilas)');
comprobar(d.compra.filter(c => /leche/i.test(c.nombre)).length === 1 && d.compra.find(c => c.id === 'm1').cantidad === '2 l', 'la leche ya estaba: no se duplica y toma la cantidad');
comprobar(d.compra.find(c => /pilas/i.test(c.nombre))?.etiqueta === 'otras', 'pilas con etiqueta «otras»');
comprobar(await pag.locator('.pestanas button.sel').textContent().then(t => t.startsWith('Compras')), 'al guardar se va a la pestaña Compras');
comprobar(await pag.locator('main h3').allTextContents().then(t => t.some(x => /Alimentación/.test(x)) && t.some(x => /Otras/.test(x))), 'agrupadas por etiqueta');

console.log('\n--- 4. Sin LLM: las reglas bastan ---');
sinLLM = true;
await pag.click('[data-a=nuevaCompra]');
comprobar(await pag.locator('.dialogo-nota h2').textContent() === 'Añadir a la compra', '+ Compra abre con la clase elegida');
await escribir('falta ibuprofeno y papel higiénico');
comprobar(await pag.locator('.linea-compra').count() === 2, 'dos líneas por reglas');
comprobar(await pag.$$eval('.linea-compra select', s => s.map(x => x.value).join(',')) === 'farmacia,drogueria', 'etiquetas farmacia y droguería');
await guardarDialogo();
comprobar((await datos()).compra.some(c => c.etiqueta === 'farmacia'), 'guardadas');
sinLLM = false;

console.log('\n--- 5. Una nota que mezcla se guarda por separado ---');
await pag.click('[data-a=nueva]');
await escribir('Llamar a la gestoría el jueves y comprar sobres');
comprobar(await pag.locator('.dialogo-nota [data-mezcla]').isVisible(), 'avisa de que son dos cosas');
comprobar(await pag.inputValue('.dialogo-nota [name=tope]') === JUEVES, 'tope de la tarea: el próximo jueves');
await pag.click('.dialogo-nota [data-partir]'); await pag.waitForTimeout(500);
d = await datos();
comprobar(d.notas.some(n => n.clase === 'tarea' && n.tope === JUEVES && /gestor/i.test(n.texto)), 'guarda la tarea');
comprobar(d.compra.some(c => /sobres/i.test(c.nombre)), 'y la línea de compra');

console.log('\n--- 6. Tarea para hoy: sale en Hoy y se marca hecha ---');
await ir('#/notas?v=tareas&accion=nuevaTarea');
comprobar(await pag.locator('.dialogo-nota h2').textContent() === 'Nueva tarea', 'un acceso ?accion=nuevaTarea abre la tarea');
await escribir('Pagar el seguro del coche hoy');
await pag.fill('.dialogo-nota [name=titulo]', 'Pagar el seguro');
await guardarDialogo();
await ir('#/hoy');
comprobar(await pag.locator('main .tarea').filter({ hasText: 'Pagar el seguro' }).count() === 1, 'en Hoy');
await pag.click('main .tarea:has-text("Pagar el seguro") [data-a=tareaHecha]'); await pag.waitForTimeout(300);
comprobar(await pag.locator('main .tarea').filter({ hasText: 'Pagar el seguro' }).count() === 0, 'hecha, deja de salir en Hoy');
comprobar((await datos()).notas.find(n => n.titulo === 'Pagar el seguro')?.tituloManual === true, 'el título escrito a mano no se pisa');

console.log('\n--- 7. Calendario: la tarea sale el día de su tope sin sumar carga ---');
await ir('#/calendario?fecha=' + VIERNES);
comprobar(await pag.locator('main .tarea').filter({ hasText: 'ITV' }).count() === 1, 'la ITV sale el viernes');
comprobar(/0\.0 h/.test(await pag.textContent('main .tarjeta')), 'sin horas de carga');

console.log('\n--- 8. Editar: cambiar la fecha tope ---');
await ir('#/notas?v=tareas');
await pag.click('main .tarea:has-text("ITV") [data-a=verTarea]');
comprobar(await pag.locator('.dialogo-nota h2').textContent() === 'Editar tarea', 'abre «Editar tarea»');
await pag.click('.dialogo-nota [data-tope]:has-text("En 15 días")');
await guardarDialogo();
comprobar((await datos()).notas.find(n => /ITV/.test(n.texto)).tope === mas(15), 'tope cambiado');

console.log('\n--- 9. Idea: etiquetas y tipo del mayordomo ---');
await pag.click('.pestanas [data-v=ideas]'); await pag.waitForTimeout(300);
await pag.click('[data-a=nuevaIdea]');
await escribir('Se me ha ocurrido caminar veinte minutos después de comer');
comprobar(await clase() === 'idea', 'idea');
await guardarDialogo(); await pag.waitForTimeout(300);
const idea = (await datos()).notas.find(n => /caminar/.test(n.texto));
comprobar(idea?.clase === 'idea' && idea.etiquetas.includes('ejercicio') && idea.tipo === 'preferencia' && idea.tipoSugerido, 'etiquetas y tipo sugeridos por el mayordomo');
comprobar(await pag.locator('main .nota').count() === 2, 'dos ideas en la pestaña');

console.log('\n--- 10. Compra ve las líneas dictadas y ninguna fecha sale en ISO ---');
await ir('#/compra');
comprobar(await pag.locator('main').textContent().then(t => /Pilas/.test(t) && /Otras/.test(t)), 'Compra enseña la línea dictada con su etiqueta');
for (const r of ['#/notas?v=tareas', '#/notas?v=compras', '#/notas?v=ideas', '#/hoy']) { await ir(r); comprobar(!/\d{4}-\d{2}-\d{2}/.test(await pag.textContent('main')), 'sin AAAA-MM-DD en ' + r); }

comprobar(!errores.length, 'sin errores de consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
await nav.close(); web.close();
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTodo bien');
process.exit(fallos.length ? 1 : 0);
