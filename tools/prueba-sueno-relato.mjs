// Prueba de humo del relato hablado de Sueño: sirve docs/ y un gateway simulado, escribe una noche
// en lenguaje natural y comprueba que los campos del propio formulario se rellenan solos, que lo
// dictado se guarda aunque el LLM falle y que el plan B por reglas saca las horas sin LLM.
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

const RELATO = 'Apagué la luz sobre las 23:45, tardé un cuarto de hora en dormirme. A las 4:30 me desperté y orine, luego intenté dormirme y no podía y me puse a leer unos 40 minutos. Me levanté a las 7:20 hecho polvo, ayer cené tarde.';

const ir = async () => { await pag.goto('http://localhost:8095/?api=8098#/sueno'); await pag.waitForTimeout(400); };
const campo = n => pag.locator(`dialog.modal [name="${n}"]`).inputValue();
const sueno = () => pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')).sueno);

await ir();
await pag.evaluate(() => { const e = JSON.parse(localStorage.getItem('maydom.v1')); e.sueno = []; localStorage.setItem('maydom.v1', JSON.stringify(e)); });
await pag.reload(); await pag.waitForTimeout(400);

console.log('\n--- 1. El relato va dentro del formulario, encima de los campos ---');
await pag.locator('[data-a="registrar"]').click();
await pag.waitForSelector('dialog.modal');
const orden = await pag.locator('dialog.modal [name]').evaluateAll(els => els.map(e => e.name));
console.log('  campos:', orden.join(', '));
comprobar(orden[0] === 'relato', `«relato» es el primer campo del formulario — ${orden[0]}`);
comprobar(orden.includes('acostado') && orden.includes('levantado'), 'los campos de horas siguen ahí para repasar');
comprobar(await pag.locator('dialog.modal [data-accion]').count() === 1, 'hay un botón para interpretar lo escrito');

console.log('\n--- 2. Escribir la noche y que el agente la traduzca ---');
respuesta = { fecha: '2026-09-21', acostado: '23:45', latencia: 15, despertar: '04:30', despierto: 40, levantado: '07:20', calidad: 2, nota: 'Cena tarde; desvelado tras el despertar y leyó 40 min.' };
await pag.locator('dialog.modal [name="relato"]').fill(RELATO);
await pag.locator('dialog.modal [data-accion]').click();
await pag.waitForTimeout(600);
const leidos = {};
for (const k of ['fecha', 'acostado', 'latencia', 'despertar', 'despierto', 'levantado', 'calidad', 'nota']) leidos[k] = await campo(k);
console.log('  ', JSON.stringify(leidos));
comprobar(leidos.acostado === '23:45' && leidos.levantado === '07:20', 'rellena las horas de acostarse y levantarse');
comprobar(leidos.despertar === '04:30' && leidos.despierto === '40', 'rellena el despertar nocturno y los minutos despierto');
comprobar(leidos.latencia === '15', 'rellena lo que tardó en dormirse');
comprobar(leidos.calidad === '2' && /cena tarde/i.test(leidos.nota), 'rellena calidad y nota');
comprobar(leidos.fecha === '2026-09-21', 'la noche es la del día anterior, no la de hoy');
comprobar(pedido.operacion === 'sueno-relato', `la llamada lleva su propia operación — ${pedido.operacion}`);
comprobar(pedido.contexto === '', 'no manda el contexto entero de la app para esto');

console.log('\n--- 3. Guardar ---');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(400);
let rs = await sueno();
console.log('  guardado:', JSON.stringify(rs[0]).slice(0, 160));
comprobar(rs.length === 1 && rs[0].acostado === '23:45', 'guarda la noche con sus horas');
comprobar(rs[0].relato === RELATO, 'guarda también el relato original, palabra por palabra');
let main = await pag.locator('main').innerText();
console.log('  ', main.split('\n').slice(0, 6).join(' | '));
comprobar(/6 h 40/.test(main), `descuenta del total lo que tardó en dormirse y lo que pasó despierto — ${main.match(/\d+ h( \d+)?/)?.[0]}`);
comprobar(main.includes(RELATO.slice(0, 30)), 'la ficha enseña lo que contaste junto a los datos');

console.log('\n--- 4. Si el LLM falla, lo dictado no se pierde ---');
fallar = 'gateway simulado caído';
await pag.locator('[data-a="registrar"]').click();
await pag.waitForSelector('dialog.modal');
await pag.locator('dialog.modal [name="relato"]').fill('Me acosté a las 00:30 y me levanté a las 08:10, fatal.');
await pag.locator('dialog.modal [data-accion]').click();
await pag.waitForTimeout(700);
const conFallo = { acostado: await campo('acostado'), levantado: await campo('levantado') };
console.log('  tras el fallo:', JSON.stringify(conFallo), '· aviso:', await pag.locator('#toast').innerText());
comprobar(conFallo.acostado === '00:30' && conFallo.levantado === '08:10', 'el plan B por reglas saca igualmente las horas del texto');
comprobar(/no se pudo interpretar/i.test(await pag.locator('#toast').innerText()), 'avisa de que el mayordomo no contestó');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(400);
rs = await sueno();
comprobar(rs.length === 2 && rs.some(r => r.relato.includes('00:30')), 'la noche se guarda aunque el LLM no esté');

console.log('\n--- 5. Corregir a mano queda marcado ---');
fallar = null;
await pag.locator('table.tabla tr[data-a="editar"]').first().click();
await pag.waitForSelector('dialog.modal');
comprobar((await campo('relato')).length > 0, 'al editar, el relato vuelve a salir arriba');
await pag.locator('dialog.modal [name="calidad"]').selectOption('5');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(400);
rs = await sueno();
const editado = rs.find(r => String(r.calidad) === '5');
console.log('  manuales:', JSON.stringify(editado?.manuales));
comprobar(editado && editado.manuales.includes('calidad'), 'el campo corregido a mano queda marcado para no pisarlo luego');

console.log('\n--- 6. El parser sin LLM, por su cuenta ---');
const local = await pag.evaluate(() => import('./app/secciones/sueno.js').then(m => [
  m.interpretarLocal('Apagué la luz sobre las 23:45, tardé un cuarto de hora. A las 4:30 me desperté y estuve 40 minutos despierto. Me levanté a las 7:20.'),
  m.interpretarLocal('Dormí de un tirón, genial'),
]));
console.log('  ', JSON.stringify(local[0]), '·', JSON.stringify(local[1]));
comprobar(local[0].acostado === '23:45' && local[0].levantado === '07:20' && local[0].despertar === '04:30', 'reparte las horas por el orden en que se cuentan');
comprobar(local[0].latencia === 15, '«un cuarto de hora» son 15 minutos');
comprobar(local[0].despierto === 40, 'saca los minutos despierto');
comprobar(Object.keys(local[1]).length === 0, 'de un texto sin horas no se inventa ninguna');

console.log('\n--- 7. Las técnicas van plegadas ---');
await ir();
const det = pag.locator('details.plegable');
comprobar(await det.count() === 1, 'las técnicas están en un desplegable');
comprobar(!(await det.evaluate(e => e.open)), 'viene cerrado: cada mañana no estorba');
comprobar(!(await pag.locator('main').innerText()).includes('Ancla el reloj interno'), 'su contenido no se lee con el desplegable cerrado');
await det.locator('summary').click();
await pag.waitForTimeout(250);
comprobar(await det.evaluate(e => e.open), 'se abre al tocar la cabecera');
comprobar((await pag.locator('main').innerText()).includes('Ancla el reloj interno'), 'y entonces sí se leen las técnicas');
await det.locator('summary').click();
await pag.waitForTimeout(250);
comprobar(!(await det.evaluate(e => e.open)), 'y se vuelve a cerrar');

console.log('\nerrores de consola:', errores.length ? errores : 'ninguno', '(el 503 del paso 4 es de la propia prueba)');
await nav.close(); web.close(); api.close();
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTODO OK');
// El 503 del paso 4 lo provoca la propia prueba: el navegador lo registra siempre.
const inesperados = errores.filter(e => !/503/.test(e));
process.exit(fallos.length || inesperados.length ? 1 : 0);
