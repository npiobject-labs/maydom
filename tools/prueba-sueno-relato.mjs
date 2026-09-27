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
let respuesta = null, fallar = null, pedido = null, llamadas = 0, retraso = 0;
const api = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let cuerpo = '';
  req.on('data', c => cuerpo += c);
  req.on('end', () => {
    if (req.url.startsWith('/api/estado')) { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); return res.end(JSON.stringify({ llm: true, modelo: 'simulado', clave_requerida: false, build: 'test' })); }
    pedido = JSON.parse(cuerpo || '{}'); llamadas++;
    if (fallar) { res.writeHead(503, { ...cors, 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: fallar, code: 'gateway_simulado' })); }
    const r = respuesta;
    setTimeout(() => { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify({ respuesta: JSON.stringify(r) })); }, retraso);
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
const sumar = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
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
const sitio = await pag.evaluate(() => {
  const f = document.querySelector('dialog.modal form');
  const hijos = [...f.children];
  const pos = el => hijos.findIndex(c => c === el || c.contains(el));
  return {
    relato: pos(f.elements.relato),
    boton: pos(f.querySelector('[data-accion]')),
    fecha: pos(f.elements.fecha),
    enviar: pos(f.querySelector('button[type="submit"]')),
  };
});
console.log('  posiciones:', JSON.stringify(sitio));
comprobar(sitio.boton > sitio.relato, 'el botón va debajo de la caja donde se cuenta la noche');
comprobar(sitio.boton < sitio.fecha, 'y por encima de los campos que rellena, no al final del formulario');
comprobar(sitio.boton < sitio.enviar, 'antes que el botón de guardar');

console.log('\n--- 2. Escribir la noche y que el agente la traduzca ---');
const [hoy, ayer, antier] = await pag.evaluate(() => import('./app/nucleo.js').then(m => [m.hoyISO(), m.sumarDias(m.hoyISO(), -1), m.sumarDias(m.hoyISO(), -2)]));
respuesta = { fecha: antier, acostado: '23:45', latencia: 15, despertar: '04:30', despierto: 40, levantado: '07:20', calidad: 2, nota: 'Cena tarde; desvelado tras el despertar y leyó 40 min.' };
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
comprobar(leidos.fecha === antier, `acepta la noche que diga el mayordomo si es de antes de hoy — ${leidos.fecha}`);
comprobar(pedido.operacion === 'sueno-relato', `la llamada lleva su propia operación — ${pedido.operacion}`);
comprobar(pedido.contexto === '', 'no manda el contexto entero de la app para esto');

const conHoy = await pag.evaluate(([h]) => {
  const orig = window.fetch;
  window.fetch = async () => new Response(JSON.stringify({ respuesta: JSON.stringify({ fecha: h, acostado: '23:00', levantado: '07:00' }) }), { headers: { 'content-type': 'application/json' } });
  return import('./app/secciones/sueno.js').then(m => m.interpretarConLLM('Me acosté a las 23:00 y me levanté a las 7:00', h)).finally(() => { window.fetch = orig; });
}, [hoy]);
comprobar(!('fecha' in conHoy) && conHoy.acostado === '23:00', `si el modelo pone la noche de hoy, se ignora y queda la de ayer del formulario — ${JSON.stringify(conHoy)}`);

console.log('\n--- 3. Guardar ---');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(400);
let rs = await sueno();
console.log('  guardado:', JSON.stringify(rs[0]).slice(0, 160));
comprobar(rs.length === 1 && rs[0].acostado === '23:45', 'guarda la noche con sus horas');
comprobar(rs[0].relato === RELATO, 'guarda también el relato original, palabra por palabra');
comprobar(!!rs[0].creado, 'guarda cuándo se contó');
const aviso3 = await pag.locator('#toast').innerText();
comprobar(/→/.test(aviso3) && /guardada/.test(aviso3), `el aviso dice qué noche se ha guardado, con sus dos días — «${aviso3}»`);
let main = await pag.locator('main').innerText();
console.log('  ', main.split('\n').slice(0, 6).join(' | '));
comprobar(/6 h 40/.test(main), `descuenta del total lo que tardó en dormirse y lo que pasó despierto — ${main.match(/\d+ h( \d+)?/)?.[0]}`);
comprobar(main.includes(RELATO.slice(0, 30)), 'la ficha enseña lo que contaste junto a los datos');
comprobar(/Última noche · \S+ \d\d → \S+ \d\d\/\d\d\/\d{4}/i.test(main), `la noche se nombra con el día de acostarse y el de levantarse — ${main.match(/Última noche[^\n]*/i)?.[0]}`);
comprobar(/Contada el \S+ \d\d\/\d\d\/\d{4} a las \d\d:\d\d/.test(main), 'y dice cuándo se contó');
comprobar(!/\d{4}-\d\d-\d\d/.test(main), 'sin fechas ISO a la vista');

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

console.log('\n--- 8. Lo contado no se pierde al cerrar la ventana sin guardar ---');
fallar = 'sin mayordomo';
let antes = (await sueno()).length;
await pag.locator('[data-a="registrar"]').first().click();
await pag.waitForSelector('dialog.modal');
await pag.locator('dialog.modal [name="relato"]').fill('Me acosté a las 23:10 y me levanté a las 7:40, bien.');
await pag.locator('dialog.modal [data-accion]').click();
await pag.waitForTimeout(500);
await pag.locator('dialog.modal .cerrar').click();
await pag.waitForTimeout(300);
main = await pag.locator('main').innerText();
comprobar(/sin guardar/i.test(main) && main.includes('Me acosté a las 23:10'), 'al cerrar con la cruz, la noche queda a la vista como «sin guardar»');
await pag.reload(); await pag.waitForTimeout(400);
comprobar(/sin guardar/i.test(await pag.locator('main').innerText()), 'y sigue ahí aunque se cierre la app');
await pag.locator('main button:has-text("Recuperar")').click();
await pag.waitForSelector('dialog.modal');
comprobar((await campo('relato')).includes('23:10') && (await campo('acostado')) === '23:10', 'al recuperarla vuelven el relato y lo que se había interpretado');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(400);
comprobar((await sueno()).length === antes + 1, 'se guarda como una noche más');
comprobar(!/sin guardar/i.test(await pag.locator('main').innerText()), 'y el aviso de «sin guardar» desaparece');
await pag.locator('[data-a="registrar"]').first().click();
await pag.waitForSelector('dialog.modal');
comprobar((await campo('relato')) === '', 'la siguiente noche empieza en blanco');
await pag.locator('dialog.modal .cerrar').click();
await pag.waitForTimeout(200);
comprobar(await pag.evaluate(() => !JSON.parse(localStorage.getItem('maydom.borradores') || '{}').sueno), 'abrir y cerrar sin escribir no deja borrador');
fallar = null;

console.log('\n--- 9. Dos copias de la app abiertas: la vieja no borra lo que guardó la otra ---');
const otra = await pag.context().newPage();
await otra.goto('http://localhost:8095/?api=8098#/sueno'); await otra.waitForTimeout(400);
antes = (await sueno()).length;
// La otra copia tiene una ventana abierta (así no relee) mientras en esta se guarda una noche.
await otra.locator('[data-a="registrar"]').first().click();
await otra.waitForSelector('dialog.modal');
await pag.bringToFront();
await pag.locator('[data-a="registrar"]').first().click();
await pag.waitForSelector('dialog.modal');
await pag.locator('dialog.modal [name="relato"]').fill('Primera copia: me acosté a las 22:50 y me levanté a las 6:55.');
await pag.locator('dialog.modal [name="acostado"]').fill('22:50');
await pag.locator('dialog.modal [name="levantado"]').fill('06:55');
await pag.locator('dialog.modal [name="fecha"]').fill(sumar(antier, -5));
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(300);
await otra.bringToFront();
await otra.locator('dialog.modal [name="relato"]').fill('Segunda copia: me acosté a las 00:20 y me levanté a las 8:00.');
await otra.locator('dialog.modal [name="acostado"]').fill('00:20');
await otra.locator('dialog.modal [name="levantado"]').fill('08:00');
await otra.locator('dialog.modal [name="fecha"]').fill(sumar(antier, -6));
await otra.locator('dialog.modal button[type="submit"]').click();
await otra.waitForTimeout(300);
rs = await sueno();
comprobar(rs.length === antes + 2, `se quedan las dos noches, la de cada copia — ${rs.length - antes} nuevas`);
comprobar(rs.some(r => r.relato.startsWith('Primera copia')) && rs.some(r => r.relato.startsWith('Segunda copia')), 'la que guardó primero no desaparece al guardar la otra');
comprobar((await otra.locator('table.tabla tr[data-a="editar"]').count()) === antes + 2, 'y la segunda copia ya enseña las dos');
// Sin ventana abierta, la copia de fondo se pone al día sola cuando la otra guarda.
await pag.bringToFront();
await pag.evaluate(() => import('./app/nucleo.js').then(m => { m.estado.sueno = m.estado.sueno.filter(r => !r.relato.startsWith('Primera copia')); m.guardar(); }));
await otra.waitForTimeout(300);
comprobar(!(await otra.locator('main').innerText()).includes('Primera copia'), 'un borrado en una copia llega a la otra sin recargar');
await otra.close();

console.log('\n--- 10. «Guardar» con el micrófono aún abierto: la noche se interpreta después ---');
// Caso real del 27-sep: el relato se veía en la caja, pero el dictado espera 20 s de silencio antes de
// interpretarlo y «Guardar» llegaba antes. La noche quedaba «sin horas», sin cifras en el historial.
await pag.addInitScript(() => {
  class Rec { constructor() { window.__rec = this; window.__escuchando = false; } start() { window.__escuchando = true; } stop() { window.__escuchando = false; setTimeout(() => this.onend?.(), 10); } abort() { this.stop(); } }
  window.SpeechRecognition = Rec;
  window.__decir = t => { const res = [[{ transcript: t }]]; res[0].isFinal = true; window.__rec.onresult({ resultIndex: 0, results: res }); };
});
await pag.evaluate(() => { const e = JSON.parse(localStorage.getItem('maydom.v1')); e.sueno = []; localStorage.setItem('maydom.v1', JSON.stringify(e)); localStorage.removeItem('maydom.borradores'); });
await pag.reload(); await pag.waitForTimeout(400);
const SIN_CIFRAS = 'Me acosté a las once y cuarto, tardé un rato en dormirme y me levanté a las siete menos cuarto bastante bien.';
respuesta = { acostado: '23:15', latencia: 20, levantado: '06:45', calidad: 4, nota: 'Noche tranquila.' };
retraso = 700; llamadas = 0;
await pag.locator('[data-a="registrar"]').first().click();
await pag.waitForSelector('dialog.modal');
await pag.locator('dialog.modal .dictar').click();
await pag.evaluate(t => window.__decir(t), SIN_CIFRAS);
await pag.waitForTimeout(200);
comprobar((await campo('relato')) === SIN_CIFRAS && (await campo('acostado')) === '', 'el relato está en la caja y los campos aún vacíos: el dictado sigue abierto');
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(150);
comprobar(!(await pag.evaluate(() => window.__escuchando)), 'cerrar la ventana apaga el micrófono');
main = await pag.locator('main').innerText();
comprobar(/interpretando lo que contaste/i.test(main), 'mientras el mayordomo lee, la noche dice que se está interpretando');
await pag.waitForTimeout(1000);
rs = await sueno();
console.log('  guardada:', JSON.stringify(rs[0]).slice(0, 200));
comprobar(rs.length === 1 && rs[0].acostado === '23:15' && rs[0].levantado === '06:45' && rs[0].interpretado === 'mayordomo', 'y al volver la respuesta la noche queda con sus horas');
comprobar(rs[0].relato === SIN_CIFRAS, 'con el relato tal cual');
comprobar(llamadas === 1, `una sola llamada al mayordomo — ${llamadas}`);
main = await pag.locator('main').innerText();
comprobar(!/sin horas/i.test(main) && /Última noche/i.test(main), 'ya no sale «sin horas»: es la última noche');
comprobar(await pag.locator('table.tabla tr[data-a="editar"] td.n').count() >= 4, 'y en el historial tiene sus cifras');
comprobar(/completada con lo que contaste/.test(await pag.locator('#toast').innerText()), 'avisa de que se ha completado');
// Lo corregido a mano antes de guardar no lo pisa la respuesta que llega después.
respuesta = { fecha: sumar(hoy, -2), acostado: '23:30', levantado: '07:00', calidad: 3 };
await pag.locator('[data-a="registrar"]').first().click();
await pag.waitForSelector('dialog.modal');
await pag.locator('dialog.modal .dictar').click();
await pag.evaluate(() => window.__decir('Me acosté a las once y media y me levanté a las siete.'));
await pag.locator('dialog.modal [name="levantado"]').fill('07:05');
await pag.locator('dialog.modal [name="fecha"]').fill(sumar(hoy, -2));
await pag.locator('dialog.modal button[type="submit"]').click();
await pag.waitForTimeout(1000);
const corregida = (await sueno()).find(r => r.relato.startsWith('Me acosté a las once y media'));
comprobar(corregida?.acostado === '23:30' && corregida.levantado === '07:05' && corregida.manuales.includes('levantado'), `la hora corregida a mano se queda y el resto lo rellena el mayordomo — ${corregida?.acostado} / ${corregida?.levantado}`);

console.log('\n--- 11. Las noches que ya se guardaron sin horas se completan solas ---');
const [pAyer, pAntes] = [sumar(hoy, -1), sumar(hoy, -3)];
await pag.goto('http://localhost:8095/?api=8098#/hoy'); await pag.waitForTimeout(300);
await pag.evaluate(([f1, f2, c]) => { const e = JSON.parse(localStorage.getItem('maydom.v1')); e.sueno = [
  { id: 'viejaA', fecha: f1, creado: c, relato: 'Me acosté tarde, sobre la una, y me levanté a las ocho.', acostado: '', latencia: 15, despertar: '', despierto: 0, levantado: '', calidad: '3', nota: 'escrita a mano', manuales: [] },
  { id: 'viejaB', fecha: f2, creado: c, relato: 'Dormí fatal.', acostado: '', latencia: 15, despertar: '', despierto: 0, levantado: '', calidad: '3', nota: '', manuales: [], interpretado: 'reglas' },
]; localStorage.setItem('maydom.v1', JSON.stringify(e)); }, [pAyer, pAntes, new Date().toISOString()]);
respuesta = { fecha: sumar(hoy, -2), acostado: '01:00', latencia: 10, levantado: '08:00', calidad: 2, nota: 'Se acostó tarde.' };
retraso = 300; llamadas = 0;
await pag.reload(); await pag.waitForTimeout(400);
comprobar(/Anoche: contada, sin horas/.test(await pag.locator('main').innerText()), 'Hoy no pinta cifras falsas de una noche sin horas');
await pag.goto('http://localhost:8095/?api=8098#/sueno'); await pag.waitForTimeout(1200);
comprobar(!(await sueno()).some(r => r.relato === SIN_CIFRAS), 'la prueba parte solo de las dos noches viejas');
rs = await sueno();
const va = rs.find(r => r.id === 'viejaA'), vb = rs.find(r => r.id === 'viejaB');
console.log('  vieja A:', JSON.stringify(va).slice(0, 220));
comprobar(va.acostado === '01:00' && va.levantado === '08:00', 'la guardada sin horas se interpreta al abrir Sueño');
comprobar(va.fecha === pAyer && va.nota === 'escrita a mano', 'sin cambiarle la fecha ni pisar lo que ya tenía escrito');
comprobar(llamadas === 1 && !vb.acostado, `solo se llama por la que nunca se interpretó — ${llamadas}`);
await pag.locator(`table.tabla tr[data-id="viejaB"]`).click();
await pag.waitForSelector('dialog.modal');
await pag.waitForTimeout(500);
comprobar((await campo('acostado')) === '01:00', 'y la que falló, al abrirla, se interpreta en la propia ventana');
await pag.locator('dialog.modal .cerrar').click();
retraso = 0;

console.log('\nerrores de consola:', errores.length ? errores : 'ninguno', '(los 503 de los pasos 4 y 8 son de la propia prueba)');
await nav.close(); web.close(); api.close();
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTODO OK');
// Los 503 de los pasos 4 y 8 los provoca la propia prueba: el navegador lo registra siempre.
const inesperados = errores.filter(e => !/503/.test(e));
process.exit(fallos.length || inesperados.length ? 1 : 0);
