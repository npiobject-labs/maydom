// Prueba de humo del botón «abrir ↗» del Buscador: es un <a> con data-a, y `delegar()` cancelaba
// todos los clics con data-a, así que el enlace no abría nada. Comprueba que ahora navega, que
// sigue marcando la tienda como comprobada y que los botones normales se siguen cancelando.
// Uso: npm i playwright && node tools/prueba-buscador-abrir.mjs
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
await new Promise(r => web.listen(8096, r));

const enOpt = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers')
  .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f));
const nav = await chromium.launch(enOpt ? { executablePath: enOpt } : {});
const ctx = await nav.newContext();
const pag = await ctx.newPage();
// Ninguna tienda real se llega a cargar: se corta la navegación en el proxy de pruebas.
await ctx.route('**', r => /localhost:8096/.test(r.request().url()) ? r.continue() : r.fulfill({ status: 200, contentType: 'text/html', body: '<title>tienda simulada</title>' }));
const fallos = [];
const comprobar = (ok, msg) => { console.log((ok ? '  ok  ' : '  FALLO ') + msg); if (!ok) fallos.push(msg); };

await pag.goto('http://localhost:8096/#/buscador?q=yogur%20griego');
await pag.waitForTimeout(500);

console.log('\n--- 1. El enlace tiene destino de verdad ---');
const abrir = pag.locator('main a[data-a="abierta"]').first();
const href = await abrir.getAttribute('href');
console.log('  href:', href);
comprobar(!!href && /^https?:/.test(href), 'el botón abrir lleva una URL absoluta');
comprobar(/yogur/.test(decodeURIComponent(href)), 'la URL lleva lo buscado');

console.log('\n--- 2. El clic no se cancela: abre la pestaña de la tienda ---');
const cancelado = await pag.evaluate(() => new Promise(res => {
  const a = document.querySelector('main a[data-a="abierta"]');
  document.addEventListener('click', e => res(e.defaultPrevented), { capture: false, once: true });
  a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}));
comprobar(cancelado === false, `el clic en el enlace no se cancela — defaultPrevented=${cancelado}`);
const nueva = await Promise.race([
  ctx.waitForEvent('page').then(p => p.url()),
  new Promise(r => setTimeout(() => r(null), 2500)),
]);
console.log('  pestaña abierta:', nueva);
comprobar(!!nueva && nueva !== 'about:blank', 'se abre una pestaña nueva con la tienda');

console.log('\n--- 3. Sigue marcando la tienda como comprobada ---');
const id = await abrir.getAttribute('data-id');
const verificada = await pag.evaluate(i => (JSON.parse(localStorage.getItem('maydom.v1')).tiendas.find(t => t.id === i) || {}), id);
console.log('  tienda:', verificada.nombre, '· url:', verificada.url ? 'con plantilla' : 'sin plantilla', '· verificada:', verificada.verificada);
comprobar(!verificada.url || verificada.verificada === true, 'al abrirla con plantilla queda comprobada');

console.log('\n--- 4. Los botones normales se siguen cancelando ---');
await pag.goto('http://localhost:8096/#/buscador?q=yogur%20griego');
await pag.waitForTimeout(400);
const antes = pag.url();
await pag.locator('main [data-a="cat"]').nth(1).click();
await pag.waitForTimeout(300);
comprobar(pag.url() !== antes && /cat=/.test(pag.url()), 'el chip de categoría sigue filtrando sin recargar');

await nav.close(); web.close();
console.log(fallos.length ? `\n${fallos.length} FALLOS:\n- ` + fallos.join('\n- ') : '\nTodo correcto.');
process.exit(fallos.length ? 1 : 0);
