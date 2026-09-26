// Prueba de humo de informes con roles y selección de modelo (ADR-010), de punta a punta: la app en
// Chromium a 390 px, el backend real (app/target/release) y un gateway simulado en el puerto 8098 que
// anota cada llamada (modelo, X-Operacion, sistema, max_tokens) y responde a /models, /estado y
// /uso/resumen como el de npiobject-labs/openrouter. Comprueba: catálogo filtrado en Ajustes, modelo
// elegido solo en lo que redacta, rol propio, hoja de Analizar con coste, roles en paralelo (4 como
// mucho), un rol que falla y se reintenta solo, síntesis, informe compuesto, copiar, descargar,
// regenerar, recuperación tras recargar a medias y que ninguna fecha sale en ISO.
// Uso: cd app && cargo build --release; cd .. && npm i playwright && node tools/prueba-informes.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const RAIZ = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const DOCS = path.join(RAIZ, 'docs');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const web = http.createServer((req, res) => {
  let f = path.join(DOCS, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => e ? (res.writeHead(404), res.end('404')) : (res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'text/plain' }), res.end(d)));
});
await new Promise(r => web.listen(8097, r));

// ---------- Gateway simulado ----------
const log = [], historial = []; // log se vacía entre pasos; historial es lo que el gateway recuerda para el coste
let fallarEconomico = true, espera = 120, activas = 0, maxActivas = 0;
const CATALOGO = [
  { id: 'google/gemini-2.5-flash-lite', nombre: 'Google: Gemini 2.5 Flash Lite', contexto: 1048576, entrada: 0.1, salida: 0.4, json: true, modalidades: ['text', 'image'] },
  { id: 'google/gemini-2.5-pro', nombre: 'Google: Gemini 2.5 Pro', contexto: 1048576, entrada: 1.25, salida: 10, json: true, modalidades: ['text', 'image'] },
  { id: 'anthropic/claude-sonnet-4.5', nombre: 'Anthropic: Claude Sonnet 4.5', contexto: 1000000, entrada: 3, salida: 15, json: true, modalidades: ['text', 'image'] },
  { id: 'mistralai/mistral-small', nombre: 'Mistral Small', contexto: 32000, entrada: 0.2, salida: 0.6, json: false, modalidades: ['text'] },
  { id: 'openrouter/auto', nombre: 'Auto Router', contexto: 2000000, entrada: -1000000, salida: -1000000, json: true, modalidades: ['text'] },
  { id: 'openai/whisper', nombre: 'Whisper', contexto: 0, entrada: 1, salida: 1, json: false, modalidades: ['audio'] },
];
const gw = http.createServer(async (req, res) => {
  const enviar = (st, j) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
  if (req.headers.authorization !== 'Bearer clave-de-app') return enviar(401, { ok: false, error: { code: 'clave_invalida', message: 'no' } });
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/v1/models') return enviar(200, { object: 'list', data: CATALOGO });
  if (u.pathname === '/v1/estado') return enviar(200, { ok: true, modelo_defecto: 'google/gemini-2.5-flash-lite' });
  if (u.pathname === '/v1/uso/resumen') {
    const op = u.searchParams.get('operacion'), n = historial.filter(l => l.op === op && l.status === 200).length;
    return enviar(200, { data: [], totales: { llamadas: n, fallos: 0, coste: n * 0.0012 } });
  }
  if (u.pathname !== '/v1/chat/completions') return enviar(404, { ok: false, error: { code: 'no', message: 'no' } });
  let cuerpo = ''; for await (const c of req) cuerpo += c;
  const j = JSON.parse(cuerpo), sistema = j.messages[0].content, usuario = j.messages[j.messages.length - 1].content;
  const rol = (sistema.match(/Eres el rol «([^»]+)»/) || [])[1] || '';
  const entrada = { op: req.headers['x-operacion'], modelo: j.model || '', max: j.max_tokens, sistema, usuario, rol, formato: j.response_format?.type || '' };
  log.push(entrada); historial.push(entrada);
  activas++; maxActivas = Math.max(maxActivas, activas);
  await new Promise(r => setTimeout(r, espera));
  activas--;
  if (rol === 'Económico' && fallarEconomico) { entrada.status = 500; return enviar(500, { ok: false, error: { code: 'proveedor', message: 'el proveedor falló' } }); }
  entrada.status = 200;
  let texto = 'ok';
  if (/Coordinas un equipo/.test(sistema)) texto = '# Huerto urbano en el balcón\n\n## Resumen ejecutivo\nResumen de prueba.\n\n## Conclusiones clave\n1. **Barato** y viable.\n\n## Tensiones entre roles\n- **Crítico ↔ Económico:** poco.\n\n## Plan de acción\n1. **Alta** — Medir el balcón.\n\n## Preguntas abiertas\n- ¿Cuánta luz?';
  else if (rol) texto = `**Veredicto:** ${rol} opina que sí.\n\n**Hallazgos**\n- Uno\n\n## Un encabezado que no debería estar\n\n**Recomendaciones**\n1. Hacer\n\n**Preguntas abiertas**\n- ¿Cuándo?`;
  else if (entrada.formato === 'json_object') texto = '{"ok":true}';
  enviar(200, { model: j.model || 'google/gemini-2.5-flash-lite', choices: [{ message: { content: texto }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 20 } });
});
await new Promise(r => gw.listen(8098, r));

// ---------- Backend real ----------
const bin = path.join(RAIZ, 'app/target/release/maydom-backend');
const back = spawn(bin, [], { env: { ...process.env, PUERTO: '8080', LLM_API_KEY: 'clave-de-app', LLM_BASE_URL: 'http://localhost:8098/v1', MAYDOM_CLAVE: 'secreta', BUILD_ID: 'local', NO_PROXY: 'localhost,127.0.0.1', no_proxy: 'localhost,127.0.0.1' }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { await fetch('http://localhost:8080/salud'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }

const fallos = [];
const comprobar = (ok, msg) => { console.log((ok ? '  ok  ' : '  FALLO ') + msg); if (!ok) fallos.push(msg); };
try {
  // ---------- Backend directo ----------
  const api = (ruta, o = {}) => fetch('http://localhost:8080' + ruta, { ...o, headers: { 'content-type': 'application/json', ...(o.clave === false ? {} : { 'x-clave': 'secreta' }), ...(o.headers || {}) } });
  comprobar((await api('/api/modelos', { clave: false })).status === 401, '/api/modelos sin X-Clave: 401');
  const mods = await (await api('/api/modelos')).json();
  comprobar(mods.defecto === 'google/gemini-2.5-flash-lite', '/api/modelos trae el de por defecto del gateway');
  comprobar(mods.modelos.length === 4 && !mods.modelos.some(m => /auto|whisper/.test(m.id)), '/api/modelos quita el enrutador y lo que no es texto');
  comprobar(mods.modelos.find(m => m.id === 'google/gemini-2.5-pro')?.recomendado, 'los recomendados vienen marcados');
  const malo = await api('/api/mayordomo', { method: 'POST', body: JSON.stringify({ modelo: 'x y', mensajes: [{ rol: 'usuario', contenido: 'hola' }] }) });
  comprobar(malo.status === 400 && (await malo.json()).code === 'modelo_invalido', 'un modelo con forma rara: 400 modelo_invalido');
  comprobar((await api('/api/uso?operacion=otra-cosa')).status === 400, '/api/uso solo acepta operaciones maydom-');
  const pre = await fetch('http://localhost:8080/api/modelos', { method: 'OPTIONS' });
  comprobar(pre.status === 204 && /x-clave/.test(pre.headers.get('access-control-allow-headers')), 'preflight de /api/modelos con x-clave');

  // ---------- App ----------
  const enOpt = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f));
  const nav = await chromium.launch(enOpt ? { executablePath: enOpt } : {});
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on('pageerror', e => errores.push(e.message));
  pag.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  const URL0 = 'http://localhost:8097/';
  const datos = () => pag.evaluate(() => JSON.parse(localStorage.getItem('maydom.v1')));
  const ir = async h => { await pag.goto(URL0 + h); await pag.waitForTimeout(400); };
  const dialogo = () => pag.locator('dialog[open]').last();

  await pag.goto(URL0);
  await pag.evaluate(() => localStorage.setItem('maydom.v1', JSON.stringify({
    notas: [
      { id: 'i1', clase: 'idea', fecha: '2026-09-10', texto: 'Montar un huerto urbano en el balcón con tomates y albahaca', titulo: 'Huerto en el balcón', etiquetas: ['casa'], tipo: 'nota', analizada: true },
      { id: 'i2', clase: 'idea', fecha: '2026-09-15', texto: 'Riego por goteo con un temporizador barato', titulo: 'Riego por goteo', etiquetas: ['casa'], tipo: 'nota', analizada: true },
      { id: 'i3', clase: 'idea', fecha: '2026-09-20', texto: 'Aprender a hacer compost con los restos de cocina', titulo: 'Compost', etiquetas: [], tipo: 'nota', analizada: true },
      { id: 't1', clase: 'tarea', fecha: '2026-09-20', texto: 'Llamar al fontanero', titulo: 'Llamar al fontanero', tope: '2026-09-30', etiquetas: [] },
    ],
    ajustes: { clave: 'secreta', semillasCargadas: true },
  })));
  await pag.reload();

  // Ajustes: catálogo, modelo y roles.
  await ir('#/ajustes'); await pag.waitForTimeout(600);
  const btnModelo = await pag.textContent('.modelo-btn');
  comprobar(/El del servidor · Google: Gemini 2.5 Flash Lite/.test(btnModelo) && /0,1 \/ 0,4 \$ · 1M/.test(btnModelo), 'Ajustes enseña el modelo del servidor con precio y contexto: ' + btnModelo.trim().replace(/\s+/g, ' '));
  comprobar(await pag.locator('.lista-roles .fila').count() === 9, 'Ajustes lista los nueve roles de serie');
  await pag.click('.modelo-btn');
  await pag.waitForSelector('dialog[open] .lista-modelos');
  comprobar(await dialogo().locator('.grupo-m', { hasText: 'Recomendados' }).count() === 1, 'el selector tiene el grupo de recomendados');
  comprobar(await dialogo().locator('.modelo').count() === 5, 'el selector: el del servidor + 4 del catálogo');
  await dialogo().locator('input[type=search]').fill('sonnet'); await pag.waitForTimeout(300);
  comprobar(await dialogo().locator('.modelo').count() === 2, 'el buscador filtra (servidor + Sonnet)');
  await dialogo().locator('input[type=search]').fill('pro'); await pag.waitForTimeout(300);
  await dialogo().locator('[data-id="google/gemini-2.5-pro"]').click(); await pag.waitForTimeout(300);
  comprobar((await datos()).ajustes.modelo === 'google/gemini-2.5-pro', 'el modelo elegido se guarda en ajustes.modelo');
  comprobar(/Gemini 2.5 Pro/.test(await pag.textContent('.modelo-btn')), 'el botón enseña el modelo elegido');

  // Lo que redacta usa el modelo de Ajustes; lo que rellena campos (JSON), el del servidor.
  log.length = 0;
  await pag.evaluate(async () => { const m = await import('./app/llm.js'); await m.consultar({ mensaje: 'hola' }); await m.pedirJSON({ mensaje: 'campos', operacion: 'nota' }); });
  comprobar(log[0]?.modelo === 'google/gemini-2.5-pro' && log[0].max === 600, 'el chat va con el modelo de Ajustes');
  comprobar(log[1]?.modelo === '' && log[1].formato === 'json_object', 'una llamada JSON sigue con el modelo del servidor');

  // Rol propio; un nombre de serie no vale.
  await pag.click('[data-a="nuevoRol"]');
  await dialogo().locator('[name=icono]').fill('🥕'); await dialogo().locator('[name=nombre]').fill('crítico');
  await dialogo().locator('[name=enfoque]').fill('Mira si da de comer.');
  await dialogo().locator('button[type=submit]').click(); await pag.waitForTimeout(300);
  comprobar((await datos()).roles.length === 0 && await pag.locator('dialog[open]').count() === 1, 'un rol con nombre de serie no se guarda y la ventana sigue abierta');
  await dialogo().locator('[name=nombre]').fill('Hortelano');
  await dialogo().locator('button[type=submit]').click(); await pag.waitForTimeout(300);
  const propio = (await datos()).roles[0];
  comprobar(propio?.nombre === 'Hortelano' && propio.icono === '🥕', 'rol propio guardado en el estado');
  comprobar(await pag.locator('.lista-roles .fila').count() === 10, 'Ajustes lista el rol propio');
  await pag.locator('.lista-roles .fila', { hasText: 'Crítico' }).click();
  comprobar(/Duplicar como propio/.test(await dialogo().textContent()), 'un rol de serie se ve y se ofrece duplicarlo');
  await dialogo().locator('[data-cancelar]').first().click();

  // Hoja de Analizar.
  await ir('#/notas?v=ideas');
  await pag.click('[data-a="analizar"]');
  await pag.waitForSelector('dialog[open] [data-roles] .rol');
  comprobar(await dialogo().locator('.fuentes input:checked').count() === 3, 'la hoja parte con las ideas visibles marcadas (solo ideas)');
  comprobar(await dialogo().locator('.rol.on').count() === 2, 'por defecto, Crítico y Analítico');
  await dialogo().locator('[data-rol="economico"]').click();
  await dialogo().locator('[data-rol="' + propio.id + '"]').click();
  let coste = await dialogo().locator('[data-coste]').textContent();
  comprobar(/5 llamadas \(4 roles \+ síntesis\)/.test(coste) && /≈/.test(coste), 'coste estimado: ' + coste.trim());
  comprobar(/Gemini 2.5 Pro/.test(await dialogo().locator('.modelo-btn').textContent()) && /El de Ajustes/.test(await dialogo().locator('.modelo-btn').textContent()), 'la hoja parte del modelo de Ajustes');
  await dialogo().locator('.modelo-btn').click();
  await pag.waitForSelector('dialog[open] .lista-modelos');
  await dialogo().locator('[data-id="google/gemini-2.5-flash-lite"]').click(); await pag.waitForTimeout(200);
  comprobar(/Solo para este informe/.test(await dialogo().locator('.modelo-btn').textContent()), 'cambiar el modelo en la hoja vale solo para este informe');
  await dialogo().locator('[name=instruccion]').fill('¿Merece la pena este otoño?');
  log.length = 0; maxActivas = 0;
  await dialogo().locator('[data-si]').click();
  await pag.waitForTimeout(150);
  comprobar(/[?&]id=/.test(pag.url()) && await pag.locator('.progreso').count() === 1, 'al generar va al informe y enseña el progreso');
  await pag.waitForFunction(() => { const i = JSON.parse(localStorage.getItem('maydom.v1')).informes[0]; return i && !['generando', 'sintesis'].includes(i.estado); }, null, { timeout: 20000 });
  await pag.waitForTimeout(300);
  let inf = (await datos()).informes[0];
  const roles = log.filter(l => l.rol), sint = log.filter(l => /Coordinas/.test(l.sistema));
  comprobar(roles.length === 4 && sint.length === 1, 'una llamada por rol y una síntesis');
  comprobar(maxActivas <= 4, 'como mucho 4 roles a la vez (' + maxActivas + ')');
  comprobar(log.every(l => l.modelo === 'google/gemini-2.5-flash-lite' && l.max === 2500 && l.op === `maydom-informe-${inf.id}-1`), 'todas con el modelo de la hoja, 2500 tokens y X-Operacion del informe');
  comprobar(log.every(l => /^Formas parte de un equipo/.test(l.sistema) && !/Estado actual de la persona/.test(l.sistema)), 'modo informe: sistema propio y sin el contexto del mayordomo');
  comprobar(/^Lo que pide la persona: ¿Merece la pena este otoño\?/.test(roles[0].usuario) && /Idea 1 — Huerto en el balcón \(10\/09\/2026\)/.test(roles[0].usuario), 'la instrucción y las ideas van en el mensaje, de la más antigua a la más reciente');
  comprobar(/Análisis de cada rol/.test(sint[0].usuario) && !/### 💶 Económico/.test(sint[0].usuario), 'la síntesis recibe solo lo de los roles que respondieron');
  comprobar(/Mira si da de comer/.test(roles.find(l => l.rol === 'Hortelano')?.sistema || ''), 'el rol propio lleva su enfoque');
  comprobar(inf.estado === 'incompleto' && inf.roles.find(r => r.id === 'economico').estado === 'fallido', 'con un rol fallido el informe queda incompleto');
  comprobar(inf.titulo === 'Huerto urbano en el balcón', 'el título sale del # de la síntesis');
  comprobar(['## Resumen ejecutivo', '## Análisis por rol', '### 🧐 Crítico', '### 🥕 Hortelano', '## Ideas de origen', '## Ficha', 'Este rol no respondió'].every(t => inf.texto.includes(t)), 'informe compuesto: síntesis, roles, ideas y ficha');
  comprobar(!/^## Un encabezado/m.test(inf.texto) && /^#### Un encabezado/m.test(inf.texto), 'los encabezados de un rol bajan de nivel');
  comprobar(/\*\*Coste:\*\* < 0,01 \$/.test(inf.texto) && Math.abs(inf.coste - 0.0048) < 1e-9, 'el coste es el que anota el gateway para la operación');
  comprobar(await pag.locator('.aviso-informe', { hasText: 'Económico no respondió' }).count() === 1, 'aviso del rol que falló');
  comprobar(await pag.locator('.md-informe h2', { hasText: 'Resumen ejecutivo' }).count() === 1, 'el informe se lee formateado');
  comprobar(await pag.locator('[data-a="copiarInf"]').count() === 2, '📋 Copiar arriba y abajo');

  // Reintentar solo lo que falló.
  fallarEconomico = false; log.length = 0;
  await pag.click('[data-a="reintentarInf"]');
  await pag.waitForFunction(() => JSON.parse(localStorage.getItem('maydom.v1')).informes[0].estado === 'listo', null, { timeout: 20000 });
  await pag.waitForTimeout(300);
  inf = (await datos()).informes[0];
  comprobar(log.filter(l => l.rol).map(l => l.rol).join() === 'Económico' && log.filter(l => /Coordinas/.test(l.sistema)).length === 1, 'reintentar rehace solo Económico y la síntesis');
  comprobar(log.every(l => l.op === `maydom-informe-${inf.id}-1`) && Math.abs(inf.coste - 0.0072) < 1e-9, 'el reintento suma en la misma operación');
  comprobar(await pag.locator('.aviso-informe').count() === 0 && !inf.texto.includes('no respondió'), 'sin aviso y sin huecos al terminar');

  // Salidas.
  await pag.locator('[data-a="copiarInf"]').first().click(); await pag.waitForTimeout(200);
  comprobar((await pag.evaluate(() => navigator.clipboard.readText())).startsWith('# Huerto urbano en el balcón'), 'Copiar pone el markdown en el portapapeles');
  const [descarga] = await Promise.all([pag.waitForEvent('download'), pag.locator('[data-a="descargarInf"]').first().click()]);
  comprobar(descarga.suggestedFilename() === 'huerto-urbano-en-el-balcon.md', 'Descargar da un .md con nombre limpio: ' + descarga.suggestedFilename());
  await pag.emulateMedia({ media: 'print' });
  const vis = await pag.evaluate(() => [getComputedStyle(document.querySelector('.md-informe h2')).visibility, getComputedStyle(document.querySelector('#nav')).visibility]);
  comprobar(vis[0] === 'visible' && vis[1] === 'hidden', 'al imprimir solo se ve el informe');
  await pag.emulateMedia({ media: 'screen' });
  const texto = await pag.textContent('#main');
  comprobar(!/\d{4}-\d{2}-\d{2}/.test(texto), 'ninguna fecha en ISO en la vista del informe');

  // Regenerar con un rol: nueva generación y nueva operación.
  log.length = 0;
  await pag.click('[data-a="regenerarInf"]');
  await pag.waitForSelector('dialog[open] [data-roles] .rol');
  comprobar(await dialogo().locator('.rol.on').count() === 4 && /Solo para este informe/.test(await dialogo().locator('.modelo-btn').textContent()), 'regenerar parte de los mismos roles y modelo');
  await dialogo().locator('[data-r="ninguno"]').click(); await dialogo().locator('[data-rol="critico"]').click();
  await dialogo().locator('[data-si]').click();
  await pag.waitForFunction(() => JSON.parse(localStorage.getItem('maydom.v1')).informes[0].estado === 'listo', null, { timeout: 20000 });
  inf = (await datos()).informes[0];
  comprobar(inf.generacion === 2 && log.every(l => l.op === `maydom-informe-${inf.id}-2`) && log.length === 2, 'regenerar: generación 2, una llamada por rol y la síntesis');
  comprobar(/Tensiones entre roles`: como solo hay un rol/.test(log.find(l => /Coordinas/.test(l.sistema)).sistema), 'con un solo rol, la síntesis lo sabe');

  // Recargar a medias: lo pendiente queda fallido y se puede reintentar.
  espera = 3000;
  await ir('#/notas?v=ideas');
  await pag.click('[data-a="analizar"]'); await pag.waitForSelector('dialog[open] [data-roles] .rol');
  await dialogo().locator('[data-si]').click(); await pag.waitForTimeout(400);
  await pag.reload(); await pag.waitForTimeout(600);
  const medias = (await datos()).informes[0];
  comprobar(medias.estado === 'fallido' && medias.roles.every(r => r.error === 'la app se cerró a medias'), 'tras recargar a medias, el informe queda fallido y reintentable');
  comprobar(await pag.locator('[data-a="reintentarInf"]').count() === 1, 'y enseña Reintentar');
  espera = 50;
  await ir('#/notas?v=informes');
  comprobar(await pag.locator('.tarjeta[data-a="verInforme"]').count() === 2, 'la pestaña Informes lista los dos');
  // Desde el diálogo de una idea: guarda lo editado y analiza solo esa idea.
  await ir('#/notas?v=ideas');
  comprobar(/🔎 2 informes/.test(await pag.locator('.tarjeta.nota[data-id="i1"]').textContent()), 'la tarjeta de la idea dice en cuántos informes está');
  await pag.click('.tarjeta.nota[data-id="i3"]');
  await pag.waitForSelector('.dialogo-nota [data-analizar]');
  comprobar(await pag.locator('.dialogo-nota [data-analizar]').isVisible(), 'el diálogo de una idea tiene «🔎 Analizar con roles»');
  comprobar(/2 informes/.test(await pag.locator('.dialogo-nota [data-ver-informes]').textContent()), 'y un acceso a sus informes');
  await pag.fill('.dialogo-nota [name=texto]', 'Aprender a hacer compost con los restos de cocina y usarlo en el huerto');
  log.length = 0;
  await pag.click('.dialogo-nota [data-analizar]');
  await pag.waitForSelector('dialog[open] [data-roles] .rol');
  comprobar((await datos()).notas.find(n => n.id === 'i3').texto.endsWith('usarlo en el huerto'), 'Analizar guarda antes lo editado');
  comprobar(await dialogo().locator('.fuentes input:checked').count() === 1 && await dialogo().locator('.fuentes input[value="i3"]').isChecked(), 'la hoja sale con solo esa idea marcada');
  comprobar(await dialogo().locator('.fuentes input').count() === 3, 'y las demás ideas debajo, por si se suman');
  await dialogo().locator('[data-si]').click();
  await pag.waitForFunction(() => JSON.parse(localStorage.getItem('maydom.v1')).informes[0].estado === 'listo', null, { timeout: 20000 });
  const solo = (await datos()).informes[0];
  comprobar(solo.fuentes.length === 1 && solo.fuentes[0].id === 'i3' && /usarlo en el huerto/.test(log.find(l => l.rol)?.usuario || ''), 'el informe es de esa idea, con el texto recién guardado');
  comprobar(new RegExp('id=' + solo.id).test(pag.url()), 'y se abre al generarlo');
  await ir('#/notas?v=ideas');
  await pag.click('.tarjeta.nota[data-id="i1"]'); await pag.waitForSelector('.dialogo-nota [data-ver-informes]');
  await pag.click('.dialogo-nota [data-ver-informes]'); await pag.waitForTimeout(400);
  comprobar(/idea=i1/.test(pag.url()) && await pag.locator('.tarjeta[data-a="verInforme"]').count() === 2, 'el acceso lista solo los informes de esa idea');
  const tarea = await (async () => { await ir('#/notas?v=tareas'); await pag.click('[data-a="nuevaTarea"]'); await pag.waitForSelector('.dialogo-nota'); const v = await pag.locator('.dialogo-nota [data-analizar]').isVisible(); await pag.click('.dialogo-nota [data-cancelar]'); return v; })();
  comprobar(!tarea, 'una tarea no ofrece analizar con roles');
  comprobar(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await nav.close();
} finally {
  back.kill('SIGKILL'); web.close(); gw.close();
}
console.log(fallos.length ? `\n${fallos.length} FALLOS` : '\nTodo bien');
process.exit(fallos.length ? 1 : 0);
