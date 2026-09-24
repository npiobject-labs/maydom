// Prueba de humo de los accesos directos de Hoy (ADR-007): fijar desde la cabecera de una sección y
// desde la ☆ de una ventana, ir con un toque a la acción, mantener pulsado para colocar, arrastrar
// (intercambio al soltar encima), añadir en un hueco, cambiar de tamaño sin solapes, quitar y las
// sugerencias por uso.
// Uso: npm i playwright && node tools/prueba-accesos.mjs
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

const enOpt = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers')
  .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f));
const nav = await chromium.launch(enOpt ? { executablePath: enOpt } : {});
const pag = await nav.newPage({ viewport: { width: 390, height: 844 } });
const errores = [];
pag.on('pageerror', e => errores.push(e.message));
pag.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
const fallos = [];
const comprobar = (ok, msg) => { console.log((ok ? '  ok  ' : '  FALLO ') + msg); if (!ok) fallos.push(msg); };
const accesos = () => pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')).accesos);
const ir = async h => { await pag.goto(URL0 + h); await pag.waitForTimeout(350); };
const sinSolapes = lista => lista.every((a, i) => lista.every((b, j) => {
  if (i === j) return true;
  const [aw, ah] = { '1x1': [1, 1], '2x1': [2, 1], '2x2': [2, 2] }[a.tam], [bw, bh] = { '1x1': [1, 1], '2x1': [2, 1], '2x2': [2, 2] }[b.tam];
  return !(a.x < b.x + bw && b.x < a.x + aw && a.y < b.y + bh && b.y < a.y + ah);
}) && a.x >= 0 && a.x + ({ '1x1': 1, '2x1': 2, '2x2': 2 }[a.tam]) <= 4);
const elegir = async texto => {
  const v = await pag.$eval('.fijar-acceso select', (s, t) => [...s.options].find(o => o.textContent.includes(t))?.value, texto);
  await pag.selectOption('.fijar-acceso select', v);
};

await ir('#/hoy');
console.log('\n--- 1. Sin accesos, Hoy lo explica y la cabecera no ofrece ☆ ---');
comprobar(await pag.locator('.bloque-accesos .tarjeta').isVisible(), 'aviso de cómo fijar');
comprobar(await pag.locator('#fijar').isHidden(), 'sin ☆ Fijar en Hoy');

console.log('\n--- 2. ☆ Fijar en la cabecera de Sueño → «Contar la noche» ---');
await ir('#/sueno');
comprobar(await pag.locator('#fijar').isVisible(), '☆ Fijar visible en Sueño');
await pag.click('#fijar');
const opciones = await pag.$$eval('.fijar-acceso select option', os => os.map(o => o.textContent));
console.log('  opciones:', opciones.join(' | '));
comprobar(opciones[0] === 'Abrir Sueño' && opciones.some(o => /Contar la noche/.test(o)), 'ofrece la sección y sus botones');
comprobar(!opciones.some(o => /Borrar/.test(o)), 'no ofrece botones de borrar');
await elegir('Contar la noche');
comprobar(await pag.inputValue('.fijar-acceso [name=nombre]') === 'Contar', 'nombre corto propuesto (12 letras como mucho, sin «la» colgando)');
await pag.fill('.fijar-acceso [name=nombre]', 'Contar noche');
await pag.click('.fijar-acceso label[title="Hexágono"]');
await pag.click('.fijar-acceso label[title="Grande"]');
await pag.click('.fijar-acceso button[type=submit]');
await pag.waitForTimeout(200);
let l = await accesos();
comprobar(l.length === 1 && l[0].destino === '#/sueno?accion=registrar' && l[0].forma === 'hexagono' && l[0].tam === '2x2', `guardado: ${JSON.stringify(l[0] && { destino: l[0].destino, forma: l[0].forma, tam: l[0].tam })}`);

console.log('\n--- 3. En Hoy, un toque lleva a la acción ---');
await ir('#/hoy');
comprobar(await pag.locator('.rejilla .acceso').count() === 1, 'el acceso aparece en Hoy');
await pag.click('.rejilla .acceso');
await pag.waitForTimeout(400);
comprobar(pag.url().endsWith('#/sueno'), `la dirección queda sin ?accion= — ${pag.url().split('#')[1]}`);
comprobar(await pag.locator('dialog[open] h2', { hasText: 'La noche' }).isVisible(), 'se abre la ventana de contar la noche');
await pag.click('dialog[open] .cerrar');

console.log('\n--- 4. ☆ de una ventana: «+ Nota» en Notas ---');
await ir('#/notas');
await pag.click('main button[data-a="nueva"]');
await pag.waitForTimeout(200);
comprobar(await pag.locator('dialog[open] [data-fijar]').isVisible(), 'la ventana lleva ☆');
await pag.click('dialog[open] [data-fijar]');
await pag.waitForTimeout(200);
comprobar(await pag.locator('.fijar-acceso .lleva').textContent() === 'Notas › Tareas › Nota', 'la ☆ propone justo esa acción (con la pestaña)');
await pag.click('.fijar-acceso label[title="Pentágono"]');
await pag.click('.fijar-acceso button[type=submit]');
await pag.waitForTimeout(200);
l = await accesos();
comprobar(l.length === 2 && l[1].destino === '#/notas?accion=nueva', 'fijado #/notas?accion=nueva');
await pag.click('main button[data-a="nueva"]'); await pag.waitForTimeout(150);
await pag.click('dialog[open] .cerrar');
await pag.locator('main .acciones .mini').click(); await pag.waitForTimeout(100);
// Una ventana abierta por un botón con ficha concreta no hereda la ☆ del último botón pulsado.
const conId = pag.locator('main [data-a][data-id]').first();
if (await conId.count()) { await conId.click(); await pag.waitForTimeout(200); comprobar(!(await pag.locator('dialog[open] [data-fijar]').count()), 'sin ☆ en una ventana de una ficha concreta'); await pag.keyboard.press('Escape'); }

console.log('\n--- 5. Finanzas: la pestaña entra en el destino, el mes no ---');
await ir('#/finanzas?v=movimientos&mes=2026-01');
await pag.click('#fijar');
const opsF = await pag.$$eval('.fijar-acceso select option', os => os.map(o => o.textContent));
console.log('  opciones:', opsF.join(' | '));
await elegir('Movimientos › Movimiento');
await pag.click('.fijar-acceso button[type=submit]');
await pag.waitForTimeout(200);
l = await accesos();
comprobar(l[2]?.destino === '#/finanzas?v=movimientos&accion=nuevo', `destino ${l[2]?.destino}`);

console.log('\n--- 6. Mantener pulsado → colocar; arrastrar encima intercambia ---');
await ir('#/hoy');
const caja = async id => pag.locator(`.acceso[data-acc-id="${id}"]`).boundingBox();
let b = await caja(l[1].id);
await pag.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await pag.mouse.down(); await pag.waitForTimeout(700); await pag.mouse.up();
await pag.waitForTimeout(200);
comprobar(await pag.locator('.rejilla.colocando').count() === 1, 'modo colocar tras mantener pulsado');
comprobar(await pag.locator('.hueco').count() > 0, 'huecos «+» visibles');
const antes = await accesos();
const a1 = antes[1], a2 = antes[2];
b = await caja(a1.id); const d = await caja(a2.id);
await pag.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await pag.mouse.down();
for (let i = 1; i <= 12; i++) await pag.mouse.move(b.x + b.width / 2 + (d.x - b.x) * i / 12, b.y + b.height / 2 + (d.y - b.y) * i / 12);
await pag.mouse.up(); await pag.waitForTimeout(250);
l = await accesos();
comprobar(l[1].x === a2.x && l[1].y === a2.y && l[2].x === a1.x && l[2].y === a1.y, `intercambio: ${antes.map(a => `${a.nombre}@${a.x},${a.y}`).join(' ')} → ${l.map(a => `${a.nombre}@${a.x},${a.y}`).join(' ')}`);
comprobar(sinSolapes(l), 'sin solapes');
comprobar(await pag.locator('.rejilla.colocando').count() === 1, 'sigue en modo colocar tras mover');

console.log('\n--- 7. Añadir en un hueco concreto ---');
const hueco = pag.locator('.hueco').last();
const [hx, hy] = (await hueco.getAttribute('data-acc-hueco')).split(',').map(Number);
await hueco.click(); await pag.waitForTimeout(200);
await elegir('Abrir Compra');
comprobar(await pag.inputValue('.fijar-acceso [name=nombre]') === 'Compra', 'el nombre sigue al destino elegido');
await pag.click('.fijar-acceso button[type=submit]'); await pag.waitForTimeout(200);
l = await accesos();
const compra = l.find(a => a.destino === '#/compra');
comprobar(compra && compra.x === hx && compra.y === hy, `colocado en el hueco ${hx},${hy}`);

console.log('\n--- 8. Tocar en modo colocar edita; agrandar no deja solapes ---');
await pag.click(`.acceso[data-acc-id="${compra.id}"]`, { force: true }); // tiembla: no es «estable» para Playwright await pag.waitForTimeout(200);
comprobar(await pag.locator('.fijar-acceso h2').textContent() === 'Editar acceso', 'abre «Editar acceso»');
await pag.click('.fijar-acceso label[title="Grande"]');
await pag.click('.fijar-acceso button[type=submit]'); await pag.waitForTimeout(200);
l = await accesos();
comprobar(l.find(a => a.id === compra.id).tam === '2x2' && sinSolapes(l), `agrandado y sin solapes: ${l.map(a => `${a.nombre}@${a.x},${a.y}/${a.tam}`).join(' ')}`);

console.log('\n--- 9. Quitar con ✕ ---');
const n0 = l.length;
await pag.click(`[data-acc-quitar="${compra.id}"]`, { force: true }); await pag.waitForTimeout(200);
comprobar((await accesos()).length === n0 - 1, 'quitado');
await pag.click('[data-acc="listo"]'); await pag.waitForTimeout(100);
comprobar(await pag.locator('.rejilla.colocando').count() === 0, '«Listo» sale del modo colocar');

console.log('\n--- 10. Sugerencias por uso ---');
await ir('#/compra');
for (let i = 0; i < 3; i++) { await pag.click('main button[data-a="nuevo"]'); await pag.waitForTimeout(120); await pag.click('dialog[open] .cerrar'); await pag.waitForTimeout(80); }
await pag.waitForTimeout(1700);
const usos = await pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')).usos);
comprobar(usos['#/compra?accion=nuevo']?.n === 3, `uso contado sin repintar: ${JSON.stringify(usos['#/compra?accion=nuevo'])}`);
await ir('#/hoy');
await pag.click('[data-acc="colocar"]'); await pag.waitForTimeout(100);
comprobar(await pag.locator('[data-acc-sug]', { hasText: 'Línea' }).count() === 1, 'el mayordomo sugiere «Línea»');

console.log('\n--- 11. Teclado: Intro en un acceso navega ---');
await pag.click('[data-acc="listo"]'); await pag.waitForTimeout(100);
await pag.focus('.rejilla .acceso'); await pag.keyboard.press('Enter'); await pag.waitForTimeout(400);
comprobar(!pag.url().endsWith('#/hoy'), `Intro lleva al destino — ${pag.url().split('#')[1]}`);

await nav.close(); web.close();
comprobar(!errores.length, 'sin errores en la consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
console.log(fallos.length ? `\n${fallos.length} FALLOS:\n- ` + fallos.join('\n- ') : '\nTodo correcto.');
process.exit(fallos.length ? 1 : 0);
