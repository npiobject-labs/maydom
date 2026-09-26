// Prueba de humo de «Contar el ejercicio»: sirve docs/ y un gateway simulado, cuenta una sesión en
// lenguaje natural y comprueba que la lista de ejercicios se rellena sola con series, repeticiones,
// segundos, peso y descanso, que el volumen se calcula a la vista, que se guarda en maydom.v1 con el
// relato y que sin LLM las reglas sacan la lista igualmente.
// Uso: npm i playwright && node tools/prueba-ejercicio-relato.mjs
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

const RELATO = 'Hoy he hecho 4 series de 12 flexiones descansando un minuto entre series, luego tres series de 45 segundos de plancha con 30 segundos de descanso y después 3 series de 8, 6 y 5 dominadas con 10 kilos descansando minuto y medio. Acabé cansado de hombros.';

const ir = async (v = '') => { await pag.goto('http://localhost:8095/?api=8098#/ejercicio' + (v ? '?v=' + v : '')); await pag.waitForTimeout(400); };
const campo = n => pag.locator(`dialog.modal [name="${n}"]`).inputValue();
const sesiones = () => pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')).sesionesEjercicio);

await ir();
await pag.evaluate(() => { const e = JSON.parse(localStorage.getItem('maydom.v1') || '{}'); e.sesionesEjercicio = []; e.ejercicios = [{ id: 'e1', nombre: 'Flexiones', tipo: 'calistenia', series: 3, reps: '10', descripcion: '' }, { id: 'e2', nombre: 'Plancha', tipo: 'calistenia', series: 3, reps: '30 s', descripcion: '' }, { id: 'e3', nombre: 'Dominadas', tipo: 'calistenia', series: 3, reps: '6', descripcion: '' }]; localStorage.setItem('maydom.v1', JSON.stringify(e)); });
await pag.reload(); await pag.waitForTimeout(400);

console.log('\n--- 1. Botón «Contar el ejercicio» y formulario ---');
for (const v of ['tablas', 'catalogo', 'historial']) { await ir(v); comprobar(await pag.locator('main [data-a="contar"]').count() === 1, `el botón está en la vista ${v}`); }
await pag.locator('[data-a="contar"]').click();
await pag.waitForSelector('dialog.modal');
const orden = await pag.locator('dialog.modal [name]').evaluateAll(els => els.map(e => e.name));
console.log('  campos:', orden.join(', '));
comprobar(orden[0] === 'relato', `«relato» es el primer campo — ${orden[0]}`);
comprobar(orden.includes('detalle') && orden.includes('fecha'), 'debajo, la lista de ejercicios y la fecha');
const sitio = await pag.evaluate(() => {
  const f = document.querySelector('dialog.modal form'), hijos = [...f.children];
  const pos = el => hijos.findIndex(c => c === el || c.contains(el));
  return { relato: pos(f.elements.relato), boton: pos(f.querySelector('[data-accion]')), fecha: pos(f.elements.fecha), detalle: pos(f.elements.detalle), volumen: pos(f.querySelector('.volumen')) };
});
console.log('  posiciones:', JSON.stringify(sitio));
comprobar(sitio.boton > sitio.relato && sitio.boton < sitio.fecha, 'el botón ✨ Interpretar va justo debajo de la caja del relato');
comprobar(sitio.volumen > sitio.detalle, 'el volumen se enseña debajo de la lista de ejercicios');
comprobar(/aún no hay ejercicios/i.test(await pag.locator('dialog.modal .volumen').innerText()), 'sin ejercicios, el volumen lo dice');

console.log('\n--- 2. El agente traduce el relato a series, repeticiones, segundos y descansos ---');
respuesta = { fecha: '2026-09-26', hora: '18:30', duracion: 35, ejercicios: [
  { nombre: 'Flexiones', series: [12, 12, 12, 12], segundos: [], kg: null, descanso: 60 },
  { nombre: 'Plancha', series: [], segundos: [45, 45, 45], kg: null, descanso: 30 },
  { nombre: 'Dominadas', series: [8, 6, 5], segundos: [], kg: 10, descanso: 90 },
], nota: 'Acabó cansado de hombros.' };
await pag.locator('dialog.modal [name="relato"]').fill(RELATO);
await pag.locator('dialog.modal [data-accion]').click();
await pag.waitForTimeout(600);
const detalle = await campo('detalle');
console.log('  detalle:\n    ' + detalle.split('\n').join('\n    '));
comprobar(detalle.split('\n').length === 3, 'una línea por ejercicio');
comprobar(detalle.includes('Flexiones: 4 × 12 · descanso 1 min'), 'series × repeticiones y descanso');
comprobar(detalle.includes('Plancha: 3 × 45 s · descanso 30 s'), 'el isométrico lleva segundos por serie');
comprobar(detalle.includes('Dominadas: 8, 6, 5 · 10 kg · descanso 1 min 30 s'), 'series distintas, peso y descanso');
comprobar(await campo('duracion') === '35' && /hombros/.test(await campo('nota')), 'duración y nota');
comprobar(await campo('hora') === '18:30', `la hora de inicio — ${await campo('hora')}`);
const vol = await pag.locator('dialog.modal .volumen').innerText();
console.log('  ', vol);
comprobar(/3 ejercicios · 10 series · 67 repeticiones · 2 min 15 s en ejercicios por tiempo · 7 min de descanso · 190 kg movidos/.test(vol), 'el volumen se calcula a la vista');
comprobar(pedido.operacion === 'ejercicio-relato', `la llamada lleva su propia operación — ${pedido.operacion}`);
comprobar(pedido.contexto === '', 'no manda el contexto entero de la app');
comprobar(pedido.tarea.includes('Flexiones; Plancha; Dominadas'), 'le pasa los nombres del catálogo para que coincidan');
comprobar(pedido.mensajes?.[0]?.contenido === RELATO && !pedido.tarea.includes(RELATO), 'el relato va como mensaje, no metido en las instrucciones');
comprobar(/Ejemplo/.test(pedido.tarea), 'las instrucciones llevan un ejemplo de varios ejercicios');

console.log('\n--- 3. Corregir la lista a mano recalcula el volumen ---');
await pag.locator('dialog.modal [name="detalle"]').fill(detalle.replace('Flexiones: 4 × 12', 'Flexiones: 5 × 12'));
const vol2 = await pag.locator('dialog.modal .volumen').innerText();
comprobar(/11 series · 79 repeticiones/.test(vol2), `recalcula al escribir — ${vol2}`);

console.log('\n--- 4. Guardar en la base de datos (maydom.v1) ---');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(500);
let ss = await sesiones();
const s = ss[0];
console.log('  guardado:', JSON.stringify(s).slice(0, 240));
comprobar(ss.length === 1 && s.origen === 'relato', 'guarda una sesión contada');
comprobar(s.relato === RELATO, 'con el relato original, palabra por palabra');
comprobar(s.items.length === 3 && s.items[0].series.length === 5 && s.items[0].series.every(x => x.r === 12) && s.items[0].descanso === 60, 'flexiones: 5 series de 12 con 60 s de descanso');
comprobar(s.items[1].series.every(x => x.s === 45) && s.items[2].kg === 10, 'plancha en segundos, dominadas con peso');
comprobar(s.items[0].ejercicioId === 'e1' && s.items[2].ejercicioId === 'e3', 'cada ejercicio queda enlazado con el del catálogo');
comprobar(s.duracion === 35 && s.fecha === '2026-09-26' && s.hora === '18:30', 'duración, fecha y hora de inicio');
comprobar(/historial/.test(await pag.evaluate(() => location.hash)), 'al guardar lleva al seguimiento');
const main = await pag.locator('main').innerText();
console.log('  ', main.split('\n').slice(0, 8).join(' | '));
comprobar(/Últimos 7 días/.test(main) && /Repeticiones\s+79/.test(main) && /Kg movidos\s+190/.test(main), 'el seguimiento resume el volumen de la semana');
comprobar(/contada/.test(main) && /79 repeticiones/.test(main), 'la sesión sale en el historial con su volumen');
comprobar(/26\/09\/2026 · 18:30 · Flexiones/.test(main) && /35 min de sesión/.test(main), 'con la hora de inicio y la duración de la sesión');
comprobar(/Duración de las sesiones\s+35 min/.test(main) && /En ejercicios por tiempo\s+2 min 15 s/.test(main), 'la semana separa la duración de las sesiones del tiempo de los ejercicios por tiempo');

console.log('\n--- 5. Editar: vuelve el relato y lo tocado a mano se marca ---');
await pag.locator('main .tarjeta[data-a="verSesion"]').first().click();
await pag.waitForSelector('dialog.modal');
comprobar((await campo('relato')) === RELATO, 'el relato vuelve a salir arriba');
comprobar((await campo('detalle')).startsWith('Flexiones: 5 × 12'), 'y la lista, compuesta desde lo guardado');
await pag.locator('dialog.modal [name="nota"]').fill('Bien de fuerzas');
await pag.locator('dialog.modal [name="duracion"]').fill('45');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(400);
ss = await sesiones();
comprobar(ss.length === 1 && ss[0].nota === 'Bien de fuerzas' && ss[0].duracion === 45, 'guarda la nota y la duración corregidas');
comprobar(JSON.stringify(ss[0].manuales.slice().sort()) === '["duracion","nota"]', `solo la nota y la duración quedan marcadas como manuales — ${JSON.stringify(ss[0].manuales)}`);
const tras = await pag.locator('main').innerText();
comprobar(/Duración de las sesiones\s+45 min/.test(tras) && /45 min de sesión/.test(tras), 'la duración corregida (35 → 45) se ve en la semana y en la sesión, como pidió el usuario el 26-sep');

console.log('\n--- 6. Si el LLM falla, las reglas sacan la lista igualmente ---');
fallar = 'gateway simulado caído';
await pag.locator('[data-a="contar"]').click();
await pag.waitForSelector('dialog.modal');
await pag.locator('dialog.modal [name="relato"]').fill('Sentadillas 4x10 con 16 kilos, descanso de 90 segundos. Burpees 3 x 15. Entre series descansé 1 minuto.');
await pag.locator('dialog.modal [data-accion]').click();
await pag.waitForTimeout(700);
const d6 = await campo('detalle');
console.log('  tras el fallo:', JSON.stringify(d6), '· aviso:', await pag.locator('#toast').innerText());
comprobar(d6.includes('Sentadillas: 4 × 10 · 16 kg · descanso 1 min 30 s') && d6.includes('Burpees: 3 × 15 · descanso 1 min'), 'el plan B por reglas rellena la lista');
comprobar(/no se pudo interpretar/i.test(await pag.locator('#toast').innerText()), 'avisa de que el mayordomo no contestó');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(400);
comprobar((await sesiones()).length === 2, 'la sesión se guarda aunque el LLM no esté');

console.log('\n--- 6b. Si el mayordomo se salta ejercicios, las reglas los completan (caso real del 26-sep) ---');
fallar = null;
// Lo que devolvió de verdad el modelo del gateway con el prompt anterior: solo el primero y sin series.
respuesta = { fecha: '2026-09-26', duracion: 30, ejercicios: [{ nombre: 'Caminata', series: [], segundos: [], kg: null, descanso: null }], nota: 'Ha sido una sesión corta.' };
await pag.locator('[data-a="contar"]').click();
await pag.waitForSelector('dialog.modal');
await pag.locator('dialog.modal [name="relato"]').fill('A las diez de la mañana he hecho una caminata de unos 30 minutos y después he hecho una serie de dominadas con 20 repeticiones a continuación he hecho una serie de rodillo abdominal con 15 repeticiones y no he hecho nada más eso es todo');
await pag.locator('dialog.modal [data-accion]').click();
await pag.waitForTimeout(600);
const d6b = await campo('detalle');
console.log('  detalle:', JSON.stringify(d6b));
comprobar(d6b === 'Caminata: 1 × 30 min\nDominadas: 1 × 20\nRodillo abdominal: 1 × 15', 'salen los tres ejercicios, con su tiempo y sus repeticiones');
comprobar(await campo('hora') === '10:00', `«a las diez de la mañana» da la hora de inicio aunque el mayordomo no la diga — ${await campo('hora')}`);
comprobar(/3 ejercicios · 3 series · 35 repeticiones · 30 min en ejercicios por tiempo/.test(await pag.locator('dialog.modal .volumen').innerText()), 'y el volumen los cuenta a los tres');
await pag.locator('dialog.modal [data-cancelar]').first().click();

console.log('\n--- 7. El lector sin LLM, por su cuenta ---');
const local = await pag.evaluate(() => import('./app/interpretar-ejercicio.js').then(m => [
  m.componerDetalle(m.interpretarLocal('Hoy he hecho cinco series de diez fondos en paralelas y dos de un minuto de plancha lateral por cada lado', ['Plancha'])),
  m.interpretarLocal('Hoy no he entrenado, estaba cansado'),
  m.componerDetalle(m.leerDetalle('Remo: 12, 10, 8 · 20 kg · descanso 1:30\nEstiramientos')),
  m.componerDetalle(m.interpretarLocal('Empecé con 10 minutos de bici estática, después 3 series de 10 sentadillas goblet con 16 kilos descansando un minuto y medio, a continuación 4 series de flexiones de 15, 12, 10 y 8, luego plancha 3 veces 40 segundos, después 2 series de 12 remo con kettlebell con 12 kilos y para terminar 5 minutos de estiramientos', ['Remo con kettlebell'])),
]));
console.log('  ', JSON.stringify(local));
comprobar(local[0] === 'Fondos paralelas: 5 × 10\nPlancha lateral: 2 × 1 min', 'números en letra, «y dos de un minuto» abre otro ejercicio');
comprobar(local[1].length === 0, 'de un texto sin series no se inventa ninguna');
comprobar(local[2] === 'Remo: 12, 10, 8 · 20 kg · descanso 1 min 30 s\nEstiramientos', 'la lista escrita a mano se lee y se recompone igual');
comprobar(local[3] === 'Bici estática: 1 × 10 min\nSentadillas goblet: 3 × 10 · 16 kg · descanso 1 min 30 s\nFlexiones: 15, 12, 10, 8\nPlancha: 3 × 40 s\nRemo con kettlebell: 2 × 12 · 12 kg\nEstiramientos: 1 × 5 min', 'seis ejercicios mezclados: tiempo, peso, series distintas y «3 veces»');

console.log('\n--- 8. Se puede fijar en Hoy ---');
await ir('historial');
await pag.goto('http://localhost:8095/?api=8098#/ejercicio?accion=contar'); await pag.waitForTimeout(600);
comprobar(await pag.locator('dialog.modal [name="relato"]').count() === 1, '?accion=contar abre el diálogo, así que el botón es fijable');

console.log('\nerrores de consola:', errores.length ? errores : 'ninguno', '(el 503 del paso 6 es de la propia prueba)');
await nav.close(); web.close(); api.close();
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTODO OK');
const inesperados = errores.filter(e => !/503/.test(e));
process.exit(fallos.length || inesperados.length ? 1 : 0);
