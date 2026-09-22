// Módulo de carga de Finanzas: la pestaña «Importar» y toda la lógica de meter un extracto en la
// app. Aquí viven el mapeo de columnas, el cotejo con lo ya guardado y el historial de cargas.
import { estado, guardar, h, lista, crudo, delegar, uid, fechaCorta, hoyISO, horaActual, euros, pedir, confirmar, toast, aviso, navegar } from '../../nucleo.js';
import { pedirJSON, lista as listaJSON } from '../../llm.js';
import { leerExtracto, num, fechaNorm } from '../../extracto.js';
import { adivinar, sinTildes, porReclasificar } from './calculos.js';

// ---------- cotejo con lo ya guardado ----------
// La descripción se normaliza (minúsculas, sin tildes, espacios colapsados) porque dos
// exportaciones del mismo banco imprimen el mismo apunte con espaciados distintos y, sin
// normalizar, el duplicado se cuela como movimiento nuevo.
const norm = t => sinTildes(t).replace(/\s+/g, ' ').trim();
const claveMov = m => `${m.fecha}|${m.importe}|${norm(m.descripcion)}`;

// Une en una sola descripción las columnas de texto del extracto («Bizum» · «Enviado: 2 parte» ·
// «ENVIADO: 2 parte»). Un banco reparte la misma información entre concepto, movimiento y
// observaciones, y la de observaciones suele repetir la anterior en mayúsculas: de dos trozos en
// que uno contiene al otro se conserva solo el más largo, que es el que informa.
export function unirDescripcion(partes) {
  const out = [];
  for (const p of partes) {
    const t = String(p ?? '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const k = sinTildes(t);
    const i = out.findIndex(o => { const ko = sinTildes(o); return ko === k || k.includes(ko) || ko.includes(k); });
    if (i < 0) out.push(t);
    else if (sinTildes(out[i]).length < k.length) out[i] = t;
  }
  return out.join(' · ');
}

// Importa candidatos {fecha, descripcion, importe} cotejándolos con lo ya guardado y preguntando
// qué hacer con los que ya existen. Dos apuntes idénticos el mismo día son legítimos (dos cafés
// iguales), así que el cotejo va por multiplicidad: cada fila del fichero consume un existente y
// solo la que se queda sin pareja es nueva.
// El cotejo tiene dos niveles, porque la descripción depende de qué columnas se eligieran al
// importar: primero por fecha + importe + descripción, y con lo que sobre, por fecha + importe.
// Sin el segundo nivel, reimportar el mismo extracto con un mapeo de columnas distinto duplicaría
// todo el año. Emparejar por multiplicidad hace que ese segundo nivel sea seguro: dos cargos del
// mismo día y el mismo importe se emparejan uno a uno, así que el número de movimientos no cambia
// ni se pierde ninguno, solo puede intercambiarse qué descripción queda en cuál.
// Devuelve {n, rep, omit} o null si se cancela: cancelar no escribe nada.
export async function importarMovimientos(cands, origen = '') {
  const usados = new Set();
  const indexar = clave => {
    const m = new Map();
    for (const mov of estado.movimientos) { const k = clave(mov); if (!m.has(k)) m.set(k, []); m.get(k).push(mov); }
    return m;
  };
  const exactos = indexar(claveMov), aproximados = indexar(m => `${m.fecha}|${m.importe}`);
  const tomar = (mapa, k) => {
    const cola = mapa.get(k);
    while (cola && cola.length) { const m = cola.shift(); if (!usados.has(m)) { usados.add(m); return m; } }
    return null;
  };
  // Dos pasadas completas: las coincidencias exactas se reparten antes que las aproximadas, o una
  // fila con otra descripción podría quedarse con el movimiento que le tocaba a su gemela exacta.
  const iguales = [], resto = [];
  for (const c of cands) { const m = tomar(exactos, claveMov(c)); if (m) iguales.push({ c, mov: m }); else resto.push(c); }
  const parecidos = [], nuevos = [];
  for (const c of resto) { const m = tomar(aproximados, `${c.fecha}|${c.importe}`); if (m) parecidos.push({ c, mov: m }); else nuevos.push(c); }

  const opciones = (n, que) => [{ v: 'saltar', l: n === 1 ? `Saltar: dejar ${que} como está` : `Saltar: dejar ${que} como están` }, { v: 'reemplazar', l: n === 1 ? 'Reemplazar: rehacerlo con lo del fichero' : 'Reemplazar: rehacerlos con lo del fichero' }];
  let modoIg = 'saltar', modoPar = 'reemplazar';
  if (iguales.length || parecidos.length) {
    const campos = [];
    if (iguales.length) campos.push({
      n: 'ig', t: 'select', v: 'saltar', o: opciones(iguales.length, iguales.length === 1 ? 'el que ya está' : `los ${iguales.length}`),
      l: iguales.length === 1 ? '1 idéntico (misma fecha, importe y descripción)' : `${iguales.length} idénticos (misma fecha, importe y descripción)`,
    });
    if (parecidos.length) campos.push({
      n: 'par', t: 'select', v: 'reemplazar', o: opciones(parecidos.length, parecidos.length === 1 ? 'el guardado' : 'los guardados'),
      l: parecidos.length === 1 ? '1 con la misma fecha e importe, pero otra descripción' : `${parecidos.length} con la misma fecha e importe, pero otra descripción`,
      ayuda: 'Suelen ser los mismos movimientos importados antes con otras columnas de descripción. Reemplazar les pone la descripción del fichero de ahora; en ningún caso se añaden por duplicado.',
    });
    const v = await pedir(iguales.length + parecidos.length === 1 ? 'Un movimiento que ya existe' : 'Movimientos que ya existen', campos, {}, {
      texto: `${origen ? origen + ': ' : ''}${cands.length} ${cands.length === 1 ? 'movimiento' : 'movimientos'} en el fichero. ${nuevos.length} ${nuevos.length === 1 ? 'es nuevo y se añade' : 'son nuevos y se añaden'} igualmente. Reemplazar rehace descripción, importe y concepto; el concepto que hayas puesto a mano nunca se toca.`,
      aceptar: 'Importar',
    });
    if (!v) return null;
    if (iguales.length) modoIg = v.ig;
    if (parecidos.length) modoPar = v.par;
  }

  for (const c of nuevos) estado.movimientos.push({ id: uid(), fecha: c.fecha, descripcion: c.descripcion, importe: c.importe, concepto: adivinar(c.descripcion, c.importe) });
  let rep = 0;
  for (const [grupo, modo] of [[iguales, modoIg], [parecidos, modoPar]]) {
    if (modo !== 'reemplazar') continue;
    for (const { c, mov } of grupo) {
      mov.fecha = c.fecha; mov.descripcion = c.descripcion; mov.importe = c.importe;
      if (!mov.conceptoManual) mov.concepto = adivinar(c.descripcion, c.importe);
      rep++;
    }
  }
  guardar();
  return { n: nuevos.length, rep, omit: iguales.length + parecidos.length - rep };
}

// Deja constancia de cada carga: sin esto no hay forma de saber qué extractos se han metido ya,
// que es la primera pregunta al volver al mes siguiente.
function anotar(fichero, origen, r, mal) {
  estado.importaciones.unshift({ id: uid(), fecha: hoyISO(), hora: horaActual(), fichero, origen, n: r.n, rep: r.rep, omit: r.omit, mal });
  estado.importaciones = estado.importaciones.slice(0, 40);
  guardar();
}
const resumen = (r, mal) => `${r.n} nuevos · ${r.rep} reemplazados · ${r.omit} sin tocar${mal ? ` · ${mal} ${mal === 1 ? 'ilegible' : 'ilegibles'}` : ''}`;

// Plan B del PDF: el texto suelto al mayordomo, que devuelve los movimientos en JSON.
async function interpretarLLM(texto, fichero) {
  toast('El mayordomo está leyendo el extracto…', 5000);
  try {
    const j = await pedirJSON({
      operacion: 'finanzas-extracto', contexto: false,
      tarea: `Este es el texto de un extracto bancario. Devuelve {"movimientos":[{"fecha":"AAAA-MM-DD","descripcion":"...","importe":-12.34}]} con un objeto por movimiento, importe negativo si es gasto y positivo si es ingreso, sin inventar ninguno. Texto:\n\n${texto.slice(0, 12000)}`,
    });
    const cands = [];
    for (const m of listaJSON(j, 'movimientos')) {
      const fecha = fechaNorm(m.fecha), importe = num(m.importe), descripcion = String(m.descripcion || '').trim();
      if (fecha && importe != null) cands.push({ fecha, descripcion, importe });
    }
    const r = await importarMovimientos(cands, 'leído por el mayordomo');
    if (!r) return toast('Importación cancelada: no se ha guardado nada', 4000);
    anotar(fichero, 'PDF (mayordomo)', r, 0);
    toast(resumen(r, 0), 6000);
  } catch (e) { toast('LLM: ' + e.message, 6000); }
}

// Lee el fichero, pregunta el mapeo de columnas y lo pasa al cotejo.
export async function cargarFichero(f) {
  let p;
  try { p = await leerExtracto(f); } catch (e) { return toast('No se pudo leer: ' + e.message, 6000); }
  // Un PDF sin tabla reconocible todavía tiene arreglo, pero antes hay que saber qué se leyó:
  // sin texto es un PDF escaneado y no hay nada que hacer; con texto, o lo interpreta el
  // mayordomo (se pregunta porque gasta crédito) o se mira el texto para ver por qué falla.
  if (!p.filas.length) {
    if (!p.texto) return toast('De ese PDF no sale texto: está escaneado (es una imagen) o usa una fuente sin mapa de caracteres. Descarga el extracto en CSV o Excel desde el banco.', 9000);
    const muestra = p.texto.split('\n').filter(Boolean).slice(0, 3).map(l => l.slice(0, 70)).join(' ⏎ ');
    const v = await pedir('Extracto en PDF', [], {}, { texto: `No reconozco ninguna fila de «fecha … importe». Esto es lo que he leído: «${muestra}». Que lo interprete el mayordomo consume LLM.`, aceptar: 'Interpretar', otro: 'Ver el texto' });
    if (v && v.__otro) return pedir('Texto leído del PDF', [{ n: 't', l: 'Se puede copiar de aquí para ver por qué no se reconoce', t: 'textarea', filas: 14, v: p.texto.slice(0, 4000) }], {}, { aceptar: 'Cerrar' });
    if (v) return interpretarLLM(p.texto, f.name);
    return;
  }
  const ops = p.cab.map((c, i) => ({ v: i, l: c || 'columna ' + (i + 1) }));
  const adiv = re => Math.max(0, p.cab.findIndex(c => re.test(c)));
  const m0 = p.filas[0];
  // Un banco reparte la descripción entre varias columnas (concepto, movimiento, observaciones)
  // y ninguna sola basta: «Bizum» sin «Enviado a …» no dice nada. Por eso se marcan todas las
  // que la componen, no una. Se preseleccionan las de texto conocidas; las de saldo, divisa y
  // fecha se dejan fuera porque solo ensucian la descripción y, con ella, la clasificación.
  const TEXTO = /concepto|descrip|detalle|movimiento|observ|referencia|beneficiar|ordenante|comercio|establecimiento|remitente|notas?\b/i;
  const marcadas = p.cab.map((c, i) => [c, i]).filter(([c]) => TEXTO.test(c)).map(([, i]) => String(i));
  const v = await pedir('Columnas del extracto', [
    { n: 'f', l: 'Fecha', t: 'select', o: ops, v: adiv(/fecha|date/i) },
    { n: 'i', l: 'Importe', t: 'select', o: ops, v: adiv(/importe|amount|cantidad/i) },
    { n: 'd', l: 'Descripción: marca todas las columnas que la forman', t: 'checks', o: ops, v: marcadas.length ? marcadas : [String(adiv(/concepto|descrip|detalle/i))], ayuda: 'Se unen con « · » en ese orden, sin repetir lo que ya diga otra columna. Cuanto más texto, mejor clasifica el concepto.' },
    { n: 'inv', l: 'Los gastos vienen en positivo (invertir el signo)', t: 'check' },
  ], {}, { texto: `${f.name} · ${p.origen}: ${p.filas.length} filas. Primera: ${m0.filter(Boolean).slice(0, 5).join(' · ')}. Si alguna ya está guardada se preguntará si reemplazarla o saltarla.`, aceptar: 'Continuar' });
  if (!v) return;
  const cols = (v.d || []).map(Number).filter(i => !isNaN(i));
  if (!cols.length) return toast('Marca al menos una columna para la descripción', 5000);
  const cands = []; let mal = 0;
  for (const fila of p.filas) {
    const fecha = fechaNorm(fila[v.f]); let importe = num(fila[v.i]); const descripcion = unirDescripcion(cols.map(k => fila[k]));
    if (!fecha || importe == null) { mal++; continue; }
    if (v.inv) importe = -importe;
    cands.push({ fecha, descripcion, importe });
  }
  const r = await importarMovimientos(cands, p.origen);
  if (!r) return toast('Importación cancelada: no se ha guardado nada', 4000);
  anotar(f.name, p.origen, r, mal);
  toast(resumen(r, mal), 6000);
}

// ---------- pestaña ----------
export function render(cont) {
  const his = estado.importaciones;
  const porClas = porReclasificar().length;
  const total = estado.movimientos.length;
  const anios = [...new Set(estado.movimientos.map(m => String(m.fecha).slice(0, 4)))].sort();
  cont.innerHTML = h`
    <div class="zona">
      <div><b>Importar extracto del banco</b></div>
      <div class="mini">CSV, Excel (.xlsx) o PDF. Se lee entero en el móvil: nada sale de este dispositivo.</div>
      <label class="btn p">Elegir fichero<input type="file" accept=".csv,.xlsx,.xls,.pdf,text/csv,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" data-c="extracto" hidden></label>
    </div>
    <p class="mini">Primero eliges qué columnas son la fecha, el importe y la descripción —puedes marcar varias, que es lo normal: concepto, movimiento y observaciones juntos—. Si algún movimiento ya estuviera guardado se pregunta antes de escribir nada, así que reimportar el mismo extracto no duplica.</p>
    <h3>Qué hay cargado</h3>
    <div class="tarjeta"><div class="fila"><div class="t"><b>${total} ${total === 1 ? 'movimiento' : 'movimientos'}</b><div class="mini">${anios.length ? 'de ' + anios.join(', ') : 'todavía ninguno'}</div></div>
      ${porClas ? h`<button class="btn" data-a="reclasificar">Reclasificar ${porClas}</button>` : crudo('')}</div>
      ${porClas ? h`<div class="mini">${porClas} ${porClas === 1 ? 'movimiento cambiaría' : 'movimientos cambiarían'} de concepto con las reglas de ahora. Los editados a mano no se tocan.</div>` : ''}</div>
    <h3>Cargas anteriores</h3>
    ${his.length ? lista(his.map(x => h`<div class="tarjeta"><div class="fila"><div class="t"><b>${x.fichero || 'extracto'}</b><div class="mini">${fechaCorta(x.fecha)} ${x.hora} · ${x.origen}</div></div>
      <div class="mini centro">${x.n ? h`<b class="pos">+${x.n}</b>` : crudo('')}${x.rep ? h` · ${x.rep} rehechos` : ''}${x.omit ? h` · ${x.omit} sin tocar` : ''}${x.mal ? h` · ${x.mal} ilegibles` : ''}</div></div></div>`))
      : aviso('Aquí queda la lista de extractos que vayas cargando, con cuántos movimientos entraron en cada uno.')}
    ${his.length ? h`<div class="acciones"><button class="btn peligro" data-a="olvidar">Vaciar esta lista</button></div>` : ''}`;
  delegar(cont, {
    extracto: async el => { const f = el.files[0]; el.value = ''; if (f) await cargarFichero(f); },
    reclasificar: async () => {
      const cambian = porReclasificar();
      const n = cambian.length;
      if (!await confirmar(`${n} ${n === 1 ? 'movimiento cambia' : 'movimientos cambian'} de concepto con las reglas de ahora. Los que hayas editado a mano no se tocan.`, 'Reclasificar')) return;
      for (const x of cambian) x.concepto = adivinar(x.descripcion, x.importe);
      guardar(); toast(n === 1 ? '1 reclasificado' : n + ' reclasificados');
    },
    olvidar: async () => { if (await confirmar('Solo borra el historial de cargas, no los movimientos.', 'Vaciar')) { estado.importaciones = []; guardar(); } },
  });
}
