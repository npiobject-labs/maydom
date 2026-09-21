// Chequeo de extremo a extremo del catálogo de tiendas: entra de verdad en cada buscador con un
// navegador real y dice si devuelve resultados. No se puede correr desde la sesión (el proxy
// bloquea las tiendas), así que lo ejecuta .github/workflows/tiendas.yml en el runner.
//
//   node tools/chequeo-tiendas.mjs [--base http://localhost:8099] [--solo hsn,iherb] [--json fichero]
//
// Clasifica cada tienda en:
//   ok         la página responde y enseña lo buscado
//   error      404, 5xx o la página dice que no encuentra nada
//   bloqueado   la tienda rechaza al robot (403/429, captcha): no dice nada de si el buscador sirve
//   dudoso     responde pero no se ve lo buscado (puede necesitar JS que no cargó, o estar vacía)

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opcion = (n, d = '') => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const soloEstas = opcion('solo').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const ficheroJson = opcion('json');
const CONCURRENCIA = Number(opcion('hilos', '4'));

// Qué se busca en cada categoría: algo que esa tienda tenga de verdad.
const TERMINO = {
  suplementos: 'creatina', alimentacion: 'yogur griego', ecologica: 'aceite de oliva',
  electronica: 'raspberry pi', ocio: 'concierto', general: 'creatina', servicios: 'estiramientos',
};
// Señales de que la página es un error, no una lista de resultados.
const ERRORES = [
  'error 404', 'página no encontrada', 'pagina no encontrada', 'no pudimos encontrar',
  'service unavailable', 'no se ha encontrado la página', 'page not found', '404 not found',
  'lo sentimos, no hemos encontrado', 'vaya, algo ha salido mal', 'internal server error',
];
const BLOQUEO = ['captcha', 'access denied', 'acceso denegado', 'are you a robot', 'verifica que eres humano', 'cloudflare', 'just a moment'];

// Las tiendas salen del propio catálogo de la app: el chequeo no puede ir por libre.
function catalogo() {
  const src = readFileSync(new URL('../docs/app/datos/semillas.js', import.meta.url), 'utf8');
  const bloque = src.slice(src.indexOf('export const tiendas = ['), src.indexOf('];', src.indexOf('export const tiendas = [')) + 2);
  const tiendas = [];
  for (const m of bloque.matchAll(/ti\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'(?:\s*,\s*'([^']*)')?(?:\s*,\s*(true|false))?\s*\)/g)) {
    tiendas.push({ nombre: m[1], categoria: m[2], dominio: m[3], url: m[4] || '', verificada: m[5] === 'true' });
  }
  return tiendas;
}

const enElSitio = (dominio, q) => `https://duckduckgo.com/?q=${encodeURIComponent('site:' + dominio + ' ' + q)}`;

async function revisar(navegador, tienda) {
  const q = TERMINO[tienda.categoria] || 'creatina';
  const url = tienda.url ? tienda.url.replace('{q}', encodeURIComponent(q)) : enElSitio(tienda.dominio, q);
  const ctx = await navegador.newContext({
    locale: 'es-ES', viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  });
  const pagina = await ctx.newPage();
  const salida = { ...tienda, q, url, estado: 'dudoso', http: 0, titulo: '', detalle: '' };
  try {
    const r = await pagina.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    salida.http = r ? r.status() : 0;
    // Un buscador suele pintar los resultados después; se le da un respiro sin bloquear el chequeo.
    await pagina.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => { });
    salida.titulo = (await pagina.title()).slice(0, 120);
    const texto = ((await pagina.locator('body').innerText().catch(() => '')) || '').toLowerCase();
    const todo = (salida.titulo + ' ' + texto).toLowerCase();
    const palabras = q.toLowerCase().split(' ');

    if (BLOQUEO.some(b => todo.includes(b)) || [403, 429].includes(salida.http)) {
      salida.estado = 'bloqueado'; salida.detalle = 'la tienda rechaza al robot; no dice nada del buscador';
    } else if (salida.http >= 400) {
      salida.estado = 'error'; salida.detalle = `HTTP ${salida.http}`;
    } else if (ERRORES.some(e => todo.includes(e))) {
      salida.estado = 'error'; salida.detalle = 'la página dice que no encuentra nada: ' + (ERRORES.find(e => todo.includes(e)) || '');
    } else if (texto.length < 400) {
      salida.estado = 'dudoso'; salida.detalle = 'la página llega casi vacía (puede necesitar JS)';
    } else if (palabras.every(p => texto.includes(p))) {
      salida.estado = 'ok'; salida.detalle = 'se ve lo buscado en la página';
    } else {
      salida.estado = 'dudoso'; salida.detalle = `responde pero no aparece «${q}»`;
    }
  } catch (e) {
    salida.estado = 'error'; salida.detalle = String(e.message).split('\n')[0].slice(0, 140);
  } finally {
    await ctx.close().catch(() => { });
  }
  return salida;
}

const tiendas = catalogo().filter(t => !soloEstas.length || soloEstas.some(s => t.nombre.toLowerCase().includes(s)));
console.log(`Chequeando ${tiendas.length} tiendas del catálogo…\n`);
const navegador = await chromium.launch();
const resultados = [];
for (let i = 0; i < tiendas.length; i += CONCURRENCIA) {
  const tanda = await Promise.all(tiendas.slice(i, i + CONCURRENCIA).map(t => revisar(navegador, t)));
  for (const r of tanda) {
    const icono = { ok: '✔', error: '✖', bloqueado: '▲', dudoso: '?' }[r.estado];
    console.log(`${icono} ${r.estado.padEnd(9)} ${r.nombre.padEnd(30)} ${r.url.slice(0, 70)}`);
    if (r.detalle) console.log(`             ${r.detalle}`);
    resultados.push(r);
  }
}
await navegador.close();

const cuenta = e => resultados.filter(r => r.estado === e).length;
console.log(`\nResumen: ${cuenta('ok')} bien · ${cuenta('error')} con error · ${cuenta('bloqueado')} bloquean al robot · ${cuenta('dudoso')} dudosas`);
if (ficheroJson) { writeFileSync(ficheroJson, JSON.stringify({ fecha: new Date().toISOString(), resultados }, null, 1)); console.log('Informe en ' + ficheroJson); }

// Solo se falla por una tienda que el catálogo da por comprobada: si esa se rompe, la app miente.
const rotas = resultados.filter(r => r.verificada && r.estado === 'error');
if (rotas.length) {
  console.error('\nTiendas marcadas como comprobadas que ya no funcionan:');
  for (const r of rotas) console.error(`  ${r.nombre}: ${r.detalle} (${r.url})`);
  process.exit(1);
}
