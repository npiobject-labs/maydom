// Prueba de humo de la PWA: aviso de versión nueva y tarjeta Aplicación de Ajustes.
// El servidor puede «publicar» un build nuevo con la app abierta (cambia el <meta name="build"> de
// index.html y la CACHE de sw.js). Se prueba dos veces: sin service worker (así corre en local) y con
// él, forzando el registro en http://localhost, que es contexto seguro.
// Uso: npm i playwright && node tools/prueba-pwa.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'docs');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const ACTUAL = /<meta name="build" content="([^"]+)"/.exec(fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8'))[1];
const NUEVO = ACTUAL + '-nuevo';
let publicado = false, conSW = false;
const web = http.createServer((req, res) => {
  let f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('404'); }
    let t = d;
    const nombre = path.basename(f);
    if (publicado && (nombre === 'index.html' || nombre === 'sw.js')) t = d.toString().replaceAll(ACTUAL, NUEVO);
    if (conSW && nombre === 'pwa.js') t = d.toString().replace("location.protocol !== 'https:'", 'false');
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'text/plain', 'cache-control': 'max-age=600' });
    res.end(t);
  });
});
await new Promise(r => web.listen(8096, r));

const enOpt = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers')
  .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f));
const nav = await chromium.launch(enOpt ? { executablePath: enOpt } : {});
let fallos = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  MAL ') + m); if (!c) fallos++; };
const build = pag => pag.evaluate(() => document.querySelector('meta[name=build]').content);
const bandaVisible = pag => pag.evaluate(() => !document.getElementById('nueva-version').hidden);

for (const modo of ['sin service worker', 'con service worker']) {
  console.log(modo);
  publicado = false; conSW = modo.startsWith('con');
  const ctx = await nav.newContext();
  const pag = await ctx.newPage();
  const errores = [];
  pag.on('pageerror', e => errores.push(e.message));
  await pag.goto('http://localhost:8096/#/ajustes');
  await pag.waitForSelector('#salida-version');
  if (conSW) {
    await pag.evaluate(() => navigator.serviceWorker.ready);
    await pag.reload(); // la segunda carga ya va por el service worker
    await pag.waitForSelector('#salida-version');
    ok(await pag.evaluate(() => !!navigator.serviceWorker.controller), 'la página la controla el service worker');
  }
  await pag.waitForTimeout(400);
  ok(!(await bandaVisible(pag)), 'sin publicación nueva no hay banda');
  ok(/aún no ofrece instalarla/.test(await pag.textContent('main')), 'sin oferta del navegador, Ajustes explica cómo instalar');

  // El navegador ofrece instalar: aparece el botón y lanza el diálogo del sistema.
  await pag.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__pedido = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await pag.click('[data-a=instalar]');
  ok(await pag.evaluate(() => window.__pedido === true), '«Instalar la app» lanza el diálogo de instalación');
  ok(!(await pag.$('[data-a=instalar]')), 'tras aceptar, el botón desaparece');

  // Se publica un build nuevo: «Buscar actualización» lo encuentra y sale la banda.
  publicado = true;
  await pag.click('[data-a=buscarVersion]');
  await pag.waitForFunction(() => !document.getElementById('nueva-version').hidden, null, { timeout: 8000 }).catch(() => null);
  ok(await bandaVisible(pag), 'con build nuevo publicado sale la banda');
  ok(!!(await pag.waitForSelector('[data-a=actualizar]', { timeout: 3000 }).catch(() => null)), 'Ajustes ofrece «Actualizar ahora»');
  ok((await pag.textContent('#salida-version')).includes(NUEVO), 'y nombra el build nuevo');

  // «Actualizar» recarga y la app queda en el build nuevo, sin banda. Con service worker, antes se deja
  // al viejo 40 s sin tráfico: bajo Playwright, que se engancha al service worker, el relevo no llega
  // mientras la página siga abierta, y una recarga pocos segundos después de instalarse el nuevo se
  // queda colgada. Con Chromium sin automatizar esa misma recarga carga bien (probado a 0, 3 y 8 s).
  if (conSW) await pag.waitForTimeout(40000);
  await Promise.all([pag.waitForEvent('load', { timeout: 15000 }), pag.click('#nueva-version button')]);
  await pag.waitForSelector('#salida-version');
  await pag.waitForTimeout(600);
  ok((await build(pag)) === NUEVO, `tras «Actualizar» corre el build nuevo (${await build(pag)})`);
  ok(!(await bandaVisible(pag)), 'y ya no hay banda');
  if (conSW) {
    const caches = await pag.evaluate(() => caches.keys());
    ok(caches.length === 1 && caches[0].endsWith(NUEVO), `solo queda la caché nueva (${caches})`);
  }
  // Volver a la app sin cambios no vuelve a avisar.
  await pag.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pag.waitForTimeout(600);
  ok(!(await bandaVisible(pag)), 'volver a la app sin publicación nueva no avisa');
  ok(!errores.length, 'sin errores de página' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await ctx.close();
}
await nav.close(); web.close();
console.log(fallos ? `${fallos} fallos` : 'todo bien');
process.exit(fallos ? 1 : 0);
