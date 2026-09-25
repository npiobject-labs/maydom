// Prueba de humo del mock 6: etiquetas en las tareas (al guardar, por lotes y como fichas en el
// diálogo), ✨ Revisar (cambios que se desmarcan, formato en lista, aplicar, deshacer, el original
// guardado, partir en varias tareas) y las cajas de texto redimensionables de toda la app.
// El mayordomo se simula interceptando POST /api/mayordomo, así que no hace falta backend.
// Uso: npm i playwright && node tools/prueba-revisar-notas.mjs
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
await new Promise(r => web.listen(8095, r));
const URL0 = 'http://localhost:8095/';

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HOY = new Date(); HOY.setHours(12, 0, 0, 0);
const mas = n => { const d = new Date(HOY); d.setDate(d.getDate() + n); return iso(d); };
const JUEVES = mas(((4 - HOY.getDay() + 7) % 7) || 7);

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
const D = '.dialogo-nota';

// Mayordomo simulado: `nota` (título, clase y etiquetas) y `nota-revisar` (la revisión).
const DICTADO = 'tengo que renovar el seguro del coche antes del jueves haber si me hacen descuento y tambien llamar a la gestoria por lo de el cambio de titular';
const CORREGIDO = 'Tengo que renovar el seguro del coche antes del jueves, a ver si me hacen descuento. También llamar a la gestoría por lo del cambio de titular.';
const EN_LISTA = 'Antes del jueves:\n- Renovar el seguro del coche, a ver si me hacen descuento.\n- Llamar a la gestoría por lo del cambio de titular.';
const pedidos = [];
await pag.route('**/api/mayordomo', async ruta => {
  const cuerpo = JSON.parse(ruta.request().postData()), m = cuerpo.mensajes[0].contenido;
  pedidos.push(cuerpo.operacion);
  let j;
  if (cuerpo.operacion === 'nota-revisar') {
    j = /seguro/.test(m) ? {
      texto: CORREGIDO, lista: EN_LISTA,
      correcciones: [{ antes: 'haber si', despues: 'a ver si', tipo: 'Dictado', nota: '«a ver», de ver' }, { antes: 'de el', despues: 'del', tipo: 'Gramática' }, { antes: 'y tambien', despues: 'También', tipo: 'Estilo', opcional: true }],
      avisos: ['«antes del jueves» es el próximo jueves'], titulo: 'Renovar el seguro del coche', etiquetas: ['coche', 'seguros', 'papeleo'], tipo: '',
      partes: [{ texto: 'Renovar el seguro del coche antes del jueves.', titulo: 'Renovar el seguro del coche' }, { texto: 'Llamar a la gestoría por el cambio de titular.', titulo: 'Llamar a la gestoría' }],
    } : { texto: m, lista: '', correcciones: [], avisos: [], titulo: 'Sin cambios', etiquetas: [], tipo: 'nota', partes: [] };
  } else {
    j = { clase: 'tarea', titulo: 'Pedir cita en el dentista', etiquetas: ['salud'], tipo: 'nota', tope: '', lineas: [], partes: [] };
    if (/DNI/.test(m)) j = { ...j, titulo: 'Otro título', etiquetas: ['papeleo'] };
    if (/ruedas/.test(m)) j = { ...j, titulo: 'Otro título', etiquetas: ['coche'] };
  }
  await new Promise(r => setTimeout(r, 120));
  ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ respuesta: JSON.stringify(j) }) });
});

// De partida, dos tareas de antes sin etiquetas y una idea con ellas.
await pag.goto(URL0);
await pag.evaluate(t => localStorage.setItem('maydom.v1', JSON.stringify({
  notas: [
    { id: 'a1', clase: 'tarea', fecha: '2026-09-20', texto: 'Renovar el DNI', titulo: 'Renovar el DNI', tope: t, hecha: false, etiquetas: [], analizada: true },
    { id: 'a2', clase: 'tarea', fecha: '2026-09-21', texto: 'Mirar la presión de las ruedas', titulo: 'Mirar las ruedas', tope: t, hecha: false, analizada: true },
    { id: 'a3', clase: 'tarea', fecha: '2026-09-22', texto: 'Bajar la basura', titulo: 'Bajar la basura', tope: new Date().toISOString().slice(0, 10), hecha: false, etiquetas: ['casa'], analizada: true },
    { id: 'i1', clase: 'idea', fecha: '2026-09-22', texto: 'Leer en papel antes de dormir', titulo: 'Leer en papel', tituloManual: true, tipo: 'preferencia', etiquetas: ['sueno'], analizada: true },
  ],
  ajustes: { semillasCargadas: true },
})), JUEVES);
await pag.evaluate(() => localStorage.removeItem('maydom.textos'));
await pag.reload(); await pag.waitForTimeout(300);

console.log('\n--- 1. Las tareas de antes se etiquetan por lotes sin tocar su título ---');
await ir('#/notas?v=tareas');
comprobar(/2 tareas sin etiquetas/.test(await pag.textContent('main')), 'avisa de las tareas sin etiquetas');
await pag.click('[data-a=etiquetarTareas]'); await pag.waitForTimeout(900);
let d = await datos();
comprobar(d.notas.find(n => n.id === 'a1').etiquetas.join() === 'papeleo' && d.notas.find(n => n.id === 'a2').etiquetas.join() === 'coche', 'cada tarea con su etiqueta');
comprobar(d.notas.find(n => n.id === 'a1').titulo === 'Renovar el DNI' && d.notas.find(n => n.id === 'a2').titulo === 'Mirar las ruedas', 'los títulos no cambian');
comprobar(!/sin etiquetas/.test(await pag.textContent('main')), 'el aviso desaparece');

console.log('\n--- 2. Las etiquetas filtran la lista y en Hoy solo se ven ---');
comprobar(await pag.locator('main .chips .pill').count() === 4, 'filtro: todas, casa, coche y papeleo');
await pag.click('main .tarea [data-a=etqTarea][data-e=coche]'); await pag.waitForTimeout(250);
comprobar(await pag.locator('main .tarea').count() === 1 && /ruedas/.test(await pag.textContent('main .tarea')), 'tocar #coche en la tarjeta deja solo esa tarea');
await pag.click('main .chips [data-e=""]'); await pag.waitForTimeout(250);
comprobar(await pag.locator('main .tarea').count() === 3, '«todas» vuelve a enseñarlas');

console.log('\n--- 3. Fichas de etiquetas en el diálogo; vacías las pone el mayordomo al guardar ---');
await pag.click('[data-a=nuevaTarea]');
comprobar(await pag.locator(`${D} [data-fichas] .ficha`).count() === 0, 'sin fichas de partida');
comprobar(/mayordomo/.test(await pag.getAttribute('#n_etq', 'placeholder')), 'avisa de que vacías las pone el mayordomo');
await pag.fill(`${D} [name=texto]`, 'Pedir cita en el dentista mañana');
await pag.fill('#n_etq', 'Médico'); await pag.press('#n_etq', 'Enter');
await pag.click(`${D} [data-sug-etq=coche]`);
comprobar(await pag.$$eval(`${D} .ficha`, f => f.map(x => x.firstChild.textContent).join()) === 'medico,coche', 'escrita (sin tilde ni mayúscula) y tocada');
await pag.click(`${D} [data-quitar-etq=coche]`);
await pag.click(`${D} button[type=submit]`); await pag.waitForTimeout(500);
d = await datos();
comprobar(d.notas.find(n => /dentista/.test(n.texto))?.etiquetas.join() === 'medico', 'guarda las escritas y no las pisa');
await pag.click('[data-a=nuevaTarea]');
await pag.fill(`${D} [name=texto]`, 'Pedir cita en el dentista para la revisión mañana'); await pag.waitForTimeout(400);
await pag.click(`${D} button[type=submit]`); await pag.waitForTimeout(700);
d = await datos();
comprobar(d.notas.find(n => /revisión/.test(n.texto))?.etiquetas.join() === 'salud', 'sin etiquetas: las pone el mayordomo al guardar');

console.log('\n--- 4. ✨ Revisar: cambios marcados, formato y lo que propone ---');
pedidos.length = 0;
await pag.click('[data-a=nuevaTarea]');
await pag.fill(`${D} [name=texto]`, DICTADO); await pag.waitForTimeout(400);
comprobar(await pag.inputValue(`${D} [name=tope]`) === JUEVES, 'fecha tope leída por reglas');
await pag.click(`${D} [data-revisar]`); await pag.waitForTimeout(500);
comprobar(pedidos.includes('nota-revisar'), 'la revisión lleva su propia operación');
comprobar(await pag.locator(`${D} .revision .fmt .pill.sel`).textContent() === 'Lista', 'propone lista porque enumera dos cosas');
comprobar(await pag.locator(`${D} .diff ins`).count() > 0 && await pag.locator(`${D} .diff del`).count() > 0, 'los cambios salen marcados');
await pag.click(`${D} [data-fmt=corrido]`);
const filas = await pag.$$eval(`${D} .prob`, f => f.map(x => x.textContent));
comprobar(filas.some(t => /Dictado.*haber.*a ver/.test(t)), 'fila del dictado: «haber» → «a ver»');
comprobar(filas.some(t => /Gramática.*de el.*del/.test(t)), 'fila de gramática: «de el» → «del»');
comprobar(filas.some(t => /Tildes.*gestoria.*gestoría/.test(t)), 'fila de tildes que el mayordomo no listó');
comprobar(filas.some(t => /Puntuación/.test(t)), 'fila de puntuación y mayúsculas');
comprobar(!(await pag.isChecked(`${D} .prob:has-text("Estilo") input`)), 'lo opcional llega desmarcado');
comprobar(/próximo jueves/.test(await pag.textContent(`${D} .avisos`)), 'avisos');
comprobar(await pag.locator(`${D} [data-separar-tareas]`).count() === 1, 'ofrece guardar las dos tareas por separado');
await pag.uncheck(`${D} .prob:has-text("Dictado") input`);
await pag.click(`${D} [data-vista=resultado]`);
comprobar(/haber si/.test(await pag.textContent(`${D} .diff`)), 'desmarcar deja «haber si» en el resultado');
await pag.check(`${D} .prob:has-text("Dictado") input`);
await pag.click(`${D} [data-rev-etq=papeleo]`);
comprobar(await pag.textContent(`${D} [data-rev-etq=papeleo]`) === '+ papeleo', 'una etiqueta propuesta se puede quitar');

console.log('\n--- 5. Aplicar, deshacer y guardar con el original ---');
await pag.click(`${D} [data-aplicar]`); await pag.waitForTimeout(200);
const aplicado = await pag.inputValue(`${D} [name=texto]`);
comprobar(aplicado === 'Tengo que renovar el seguro del coche antes del jueves, a ver si me hacen descuento y tambien llamar a la gestoría por lo del cambio de titular.', `escribe en la caja lo marcado, sin lo opcional ni su punto — ${aplicado}`);
comprobar(await pag.inputValue(`${D} [name=titulo]`) === 'Renovar el seguro del coche', 'pone el título propuesto');
comprobar(await pag.$$eval(`${D} .ficha`, f => f.map(x => x.firstChild.textContent).join()) === 'coche,seguros', 'añade las etiquetas marcadas');
comprobar(/Revisada/.test(await pag.textContent(`${D} [data-rev]`)), 'dice cuántos cambios aplicó');
await pag.click(`${D} [data-deshacer]`);
comprobar(await pag.inputValue(`${D} [name=texto]`) === DICTADO && await pag.inputValue(`${D} [name=titulo]`) === '' && await pag.locator(`${D} .ficha`).count() === 0, '↶ Deshacer lo devuelve todo como estaba');
await pag.click(`${D} [data-revisar]`); await pag.waitForTimeout(500);
await pag.click(`${D} [data-aplicar]`);
const revisado = await pag.inputValue(`${D} [name=texto]`);
comprobar(revisado === EN_LISTA, 'en lista, el texto queda como lo propuso');
const notasAntes = pedidos.filter(o => o === 'nota').length;
await pag.click(`${D} button[type=submit]`); await pag.waitForTimeout(500);
d = await datos();
let t = d.notas.find(n => n.texto === EN_LISTA);
comprobar(t?.original === DICTADO && t.titulo === 'Renovar el seguro del coche' && t.etiquetas.join() === 'coche,seguros,papeleo', 'guarda texto, original, título y etiquetas');
comprobar(pedidos.filter(o => o === 'nota').length === notasAntes, 'con título y etiquetas de la revisión, guardar no llama otra vez al mayordomo');
await pag.click(`main .tarea:has-text("Renovar el seguro") [data-a=verTarea]`);
comprobar(/Texto revisado/.test(await pag.textContent(`${D} [data-rev]`)), 'al editar dice que el texto está revisado');
await pag.click(`${D} [data-ver-original]`);
comprobar((await pag.textContent(`${D} blockquote`)) === DICTADO, 'y enseña el original');
await pag.click(`${D} [data-cancelar]`);
comprobar(/revisada/.test(await pag.textContent('main .tarea:has-text("Renovar el seguro")')), 'la tarjeta dice «✨ revisada»');

console.log('\n--- 6. Una tarea que junta dos se guarda como dos ---');
await pag.click('[data-a=nuevaTarea]');
await pag.fill(`${D} [name=texto]`, DICTADO); await pag.waitForTimeout(400);
await pag.click(`${D} [data-revisar]`); await pag.waitForTimeout(500);
await pag.click(`${D} [data-separar-tareas]`); await pag.waitForTimeout(400);
d = await datos();
comprobar(d.notas.filter(n => n.tope === JUEVES && n.original === DICTADO).length === 3 && d.notas.some(n => n.titulo === 'Llamar a la gestoría'), 'dos tareas nuevas con la fecha tope y el original');

console.log('\n--- 7. Cajas de texto: asa, altura recordada y pantalla completa ---');
await pag.click('[data-a=nuevaTarea]');
const caja = `${D} [name=texto]`;
comprobar(await pag.$eval(caja, t => t.nextElementSibling?.classList.contains('asa-texto')), 'la caja de la nota lleva asa');
const h0 = await pag.$eval(caja, t => t.offsetHeight);
const asa = await pag.locator(`${D} .asa`).boundingBox();
await pag.mouse.move(asa.x + asa.width / 2, asa.y + asa.height / 2); await pag.mouse.down();
await pag.mouse.move(asa.x + asa.width / 2, asa.y + 160, { steps: 6 }); await pag.mouse.up();
const h1 = await pag.$eval(caja, t => t.offsetHeight);
comprobar(h1 > h0 + 100, `arrastrar el asa la agranda (${h0} → ${h1} px)`);
await pag.fill(caja, 'una línea');
comprobar(Math.abs(await pag.$eval(caja, t => t.offsetHeight) - h1) < 3, 'escribir no deshace lo que ajustó el usuario');
comprobar(await pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.textos'))['notas:texto'] > 150), 'recuerda la altura por sección y campo');
await pag.click(`${D} .ampliar`);
comprobar(await pag.$eval(caja, t => t.classList.contains('a-pantalla') && t.getBoundingClientRect().height > 600), '⤢ la pone a pantalla completa');
await pag.keyboard.press('Escape'); await pag.waitForTimeout(150);
comprobar(await pag.locator(D).count() === 1 && !(await pag.$eval(caja, t => t.classList.contains('a-pantalla'))), 'Esc sale de pantalla completa sin cerrar la ventana');
await pag.click(`${D} .ampliar`); await pag.click('.cab-pantalla button');
comprobar(await pag.locator('.cab-pantalla').count() === 0, '«Listo» también');
await pag.keyboard.press('Escape'); await pag.waitForTimeout(150);
await ir('#/notas?v=tareas');
await pag.click('[data-a=nuevaTarea]');
comprobar(Math.abs(await pag.$eval(caja, t => t.offsetHeight) - h1) < 3, 'al volver a abrir, la caja tiene la altura elegida');
await pag.click(`${D} [data-cancelar]`);
// Un formulario de pedir(): el relato de Sueño, con su botón de interpretar debajo del asa.
await ir('#/sueno');
await pag.click('[data-a="registrar"]'); await pag.waitForTimeout(300);
comprobar(await pag.$eval('dialog.modal [name=relato]', t => t.nextElementSibling?.classList.contains('asa-texto') && t.nextElementSibling.nextElementSibling?.matches('[data-acciones]')), 'en pedir(): asa bajo la caja y los botones detrás');
await pag.click('dialog.modal [data-cancelar]');

console.log('\n--- 8. Hoy enseña las etiquetas sin filtrar ---');
await ir('#/hoy');
comprobar(await pag.locator('main .tarea .etq').count() > 0 && await pag.locator('main .tarea button.etq').count() === 0, 'en Hoy las etiquetas son solo texto');

comprobar(!errores.length, 'sin errores de consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
await nav.close(); web.close();
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTodo bien');
process.exit(fallos.length ? 1 : 0);
