// Módulo de carga de Finanzas: la pestaña «Importar» y toda la lógica de meter un extracto en la
// app. Aquí viven el mapeo de columnas, el cotejo con lo ya guardado y el historial de cargas.
import { estado, guardar, h, lista, crudo, delegar, uid, fechaCorta, hoyISO, horaActual, euros, pedir, confirmar, toast, aviso, navegar } from '../../nucleo.js';
import { pedirJSON, lista as listaJSON } from '../../llm.js';
import { leerExtracto, num, fechaNorm } from '../../extracto.js';
import { adivinar, sinTildes, porReclasificar, cuentaDeIban, ibanCorto, normIban, nombreCuenta, saldoCuenta } from './calculos.js';
import { cambiarClave } from '../../cofre.js';

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

// Importa candidatos {fecha, descripcion, importe, saldo, orden} en una cuenta. Siempre actualiza:
// lo que ya estaba se rehace con lo del fichero y lo que no, se añade (preferencia del 27-sep); el
// concepto puesto a mano nunca se toca. Dos apuntes idénticos el mismo día son legítimos (dos
// cafés iguales), así que el cotejo va por multiplicidad: cada fila del fichero consume un
// existente y solo la que se queda sin pareja es nueva.
// El cotejo tiene dos niveles, porque la descripción depende de qué columnas se eligieran al
// importar: primero por fecha + importe + descripción, y con lo que sobre, por fecha + importe.
// Sin el segundo, reimportar el mismo extracto con otro mapeo de columnas duplicaría el año.
// Solo se coteja dentro de la cuenta elegida (y con los movimientos que aún no tienen cuenta, que
// pasan a ser suyos): el mismo cargo el mismo día en dos cuentas son dos movimientos.
export function planImportar(cands, cuenta) {
  const usados = new Set();
  const propios = estado.movimientos.filter(m => !m.cuenta || m.cuenta === cuenta);
  const indexar = clave => {
    const m = new Map();
    for (const mov of propios) { const k = clave(mov); if (!m.has(k)) m.set(k, []); m.get(k).push(mov); }
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
  const existentes = [], resto = [], nuevos = [];
  for (const c of cands) { const m = tomar(exactos, claveMov(c)); if (m) existentes.push({ c, mov: m }); else resto.push(c); }
  for (const c of resto) { const m = tomar(aproximados, `${c.fecha}|${c.importe}`); if (m) existentes.push({ c, mov: m }); else nuevos.push(c); }
  return { existentes, nuevos };
}

// Pregunta la cuenta (la del IBAN del fichero si se reconoce) enseñando qué va a pasar, y aplica.
// Devuelve {n, rep, cuenta} o null si se cancela: cancelar no escribe nada.
export async function importarMovimientos(cands, origen = '', { iban = '', cuenta = '' } = {}) {
  const porIban = cuentaDeIban(iban);
  const inicial = cuenta || porIban?.id || estado.importaciones.find(x => x.cuenta)?.cuenta || estado.cuentas[0]?.id || '';
  const fechas = cands.map(c => c.fecha).sort();
  const periodo = fechas.length ? `del ${fechaCorta(fechas[0])} al ${fechaCorta(fechas.at(-1))}` : '';
  const explicar = id => {
    const p = planImportar(cands, id);
    return `${origen ? origen + ': ' : ''}${cands.length} ${cands.length === 1 ? 'movimiento' : 'movimientos'} ${periodo}. En «${nombreCuenta(id)}» ${p.nuevos.length === 1 ? 'se añade 1 nuevo' : `se añaden ${p.nuevos.length} nuevos`} y ${p.existentes.length === 1 ? 'se actualiza 1 que ya estaba' : `se actualizan ${p.existentes.length} que ya estaban`} con lo del fichero; el concepto que hayas puesto a mano no se toca. El fichero no se guarda en la app.`;
  };
  const campos = [{ n: 'cuenta', l: iban ? `Cuenta (el extracto es de ${ibanCorto(iban)}${porIban ? '' : ', que aún no es de ninguna'})` : 'Cuenta', t: 'select', o: estado.cuentas.map(c => ({ v: c.id, l: c.nombre + (c.iban ? ' · ' + ibanCorto(c.iban) : '') })), v: inicial }];
  if (iban && !porIban) campos.push({ n: 'recordar', l: `Apuntar ${ibanCorto(iban)} como IBAN de esa cuenta`, t: 'check', v: true });
  const v = await pedir('Importar extracto', campos, {}, {
    texto: explicar(inicial), aceptar: 'Importar',
    alAbrir: ({ form }) => { const p = form.querySelector(':scope > p.mini'); form.elements.cuenta?.addEventListener('change', e => { if (p) p.textContent = explicar(e.target.value); }); },
  });
  if (!v) return null;
  const id = v.cuenta;
  if (v.recordar && iban && !iban.startsWith('*')) { const c = estado.cuentas.find(x => x.id === id); if (c) c.iban = iban; }
  const { existentes, nuevos } = planImportar(cands, id);
  const extra = c => ({ ...(c.saldo != null ? { saldo: c.saldo } : {}), ...(c.orden != null ? { orden: c.orden } : {}) });
  for (const c of nuevos) estado.movimientos.push({ id: uid(), fecha: c.fecha, descripcion: c.descripcion, importe: c.importe, concepto: adivinar(c.descripcion, c.importe), cuenta: id, ...extra(c) });
  for (const { c, mov } of existentes) {
    Object.assign(mov, { fecha: c.fecha, descripcion: c.descripcion, importe: c.importe, cuenta: id }, extra(c));
    if (!mov.conceptoManual) mov.concepto = adivinar(c.descripcion, c.importe);
  }
  guardar();
  return { n: nuevos.length, rep: existentes.length, cuenta: id };
}

// Deja constancia de cada carga: sin esto no hay forma de saber qué extractos se han metido ya,
// que es la primera pregunta al volver al mes siguiente.
function anotar(fichero, origen, r, mal) {
  estado.importaciones.unshift({ id: uid(), fecha: hoyISO(), hora: horaActual(), fichero, origen, cuenta: r.cuenta, n: r.n, rep: r.rep, mal });
  estado.importaciones = estado.importaciones.slice(0, 40);
  guardar();
}
const resumen = (r, mal) => `${nombreCuenta(r.cuenta)}: ${r.n} nuevos · ${r.rep} actualizados${mal ? ` · ${mal} ${mal === 1 ? 'ilegible' : 'ilegibles'}` : ''}`;
// El navegador no deja que una web borre archivos del dispositivo: la app no guarda el fichero, y lo recuerda.
const BORRAR = f => `«${f}» no se ha guardado en la app, solo sus movimientos (cifrados). Puedes borrarlo de Descargas.`;
const avisar = (r, mal, f) => toast(`${resumen(r, mal)}. ${BORRAR(f)}`, 9000);

// El extracto de BBVA tiene siempre las mismas columnas (F.Valor, Fecha, Concepto, Movimiento,
// Importe, Divisa, Disponible, Divisa, Observaciones): con ese formato no se pregunta el mapeo.
export function mapaBBVA(cab) {
  const k = cab.map(c => sinTildes(c).replace(/[^a-z]/g, ''));
  const i = n => k.indexOf(n);
  if ([i('fecha'), i('importe'), i('concepto'), i('movimiento')].some(x => x < 0)) return null;
  return { f: i('fecha'), i: i('importe'), d: [i('concepto'), i('movimiento'), i('observaciones')].filter(x => x >= 0), s: i('disponible') };
}

// Plan B del PDF: el texto suelto al mayordomo, que devuelve los movimientos en JSON.
async function interpretarLLM(texto, fichero, iban) {
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
    const r = await importarMovimientos(cands, 'leído por el mayordomo', { iban });
    if (!r) return toast('Importación cancelada: no se ha guardado nada', 4000);
    anotar(fichero, 'PDF (mayordomo)', r, 0);
    avisar(r, 0, fichero);
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
    if (v) return interpretarLLM(p.texto, f.name, p.iban);
    return;
  }
  let mapa = mapaBBVA(p.cab);
  if (!mapa) {
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
    ], {}, { texto: `${f.name} · ${p.origen}: ${p.filas.length} filas. Primera: ${m0.filter(Boolean).slice(0, 5).join(' · ')}. No es el formato de BBVA, así que dime qué es cada columna.`, aceptar: 'Continuar' });
    if (!v) return;
    mapa = { f: Number(v.f), i: Number(v.i), d: (v.d || []).map(Number).filter(i => !isNaN(i)), s: -1, inv: v.inv };
    if (!mapa.d.length) return toast('Marca al menos una columna para la descripción', 5000);
  }
  const cands = []; let mal = 0;
  // `orden` crece hacia lo más reciente, venga el extracto de lo nuevo a lo viejo o al revés: sirve
  // para saber cuál es el último saldo de un día con varios movimientos.
  const fechas = p.filas.map(fila => fechaNorm(fila[mapa.f])).filter(Boolean);
  const alReves = fechas.length > 1 && fechas[0] > fechas.at(-1);
  p.filas.forEach((fila, k) => {
    const fecha = fechaNorm(fila[mapa.f]); let importe = num(fila[mapa.i]); const descripcion = unirDescripcion(mapa.d.map(x => fila[x]));
    if (!fecha || importe == null) { mal++; return; }
    if (mapa.inv) importe = -importe;
    const saldo = mapa.s >= 0 ? num(fila[mapa.s]) : null;
    cands.push({ fecha, descripcion, importe, ...(saldo != null ? { saldo } : {}), orden: alReves ? p.filas.length - k : k });
  });
  const r = await importarMovimientos(cands, (mapaBBVA(p.cab) ? 'BBVA · ' : '') + p.origen, { iban: p.iban });
  if (!r) return toast('Importación cancelada: no se ha guardado nada', 4000);
  anotar(f.name, p.origen, r, mal);
  avisar(r, mal, f.name);
}

// ---------- pestaña ----------
const camposCuenta = [{ n: 'nombre', l: 'Nombre', req: true }, { n: 'iban', l: 'IBAN', ph: 'ES00 0000 0000 0000 0000 0000', ayuda: 'Con él se sabe de qué cuenta es cada extracto. Se guarda cifrado con el resto de Finanzas.' }];
export function render(cont) {
  const his = estado.importaciones;
  const porClas = porReclasificar().length;
  const total = estado.movimientos.length;
  const sinCuenta = estado.movimientos.filter(m => !m.cuenta).length;
  const anios = [...new Set(estado.movimientos.map(m => String(m.fecha).slice(0, 4)))].sort();
  const cuantos = id => estado.movimientos.filter(m => m.cuenta === id).length;
  cont.innerHTML = h`
    <div class="zona">
      <div><b>Importar extracto del banco</b></div>
      <div class="mini">El Excel de BBVA (.xls o .xlsx) entra sin preguntar columnas; también CSV o PDF. Se lee en el móvil y nada sale de él. La cuenta se reconoce por el IBAN del extracto.</div>
      <label class="btn p">Elegir fichero<input type="file" accept=".csv,.xlsx,.xls,.pdf,text/csv,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" data-c="extracto" hidden></label>
    </div>
    <p class="mini">Cualquier periodo: lo que ya estaba se actualiza con el fichero nuevo y lo que falta se añade, sin duplicar. La app no guarda el fichero, solo sus movimientos; el navegador no puede borrarlo de Descargas por ti.</p>
    <h3>Cuentas</h3>
    ${lista(estado.cuentas.map(c => { const sd = saldoCuenta(c.id); return h`<div class="tarjeta fila" data-a="cuenta" data-id="${c.id}"><div class="t"><b>${c.nombre}</b><div class="mini">${c.iban ? ibanCorto(c.iban) : 'sin IBAN: se apunta al importar su primer extracto'} · ${cuantos(c.id)} movimientos</div></div>${sd ? h`<div class="centro"><b>${euros(sd.saldo)}</b><div class="mini">saldo ${fechaCorta(sd.fecha)}</div></div>` : ''}</div>`; }))}
    ${sinCuenta ? h`<div class="tarjeta"><div class="fila"><div class="t"><b>${sinCuenta} sin cuenta</b><div class="mini">Importados antes de que hubiera cuentas. Al importar el extracto de cada cuenta se asignan solos; o asígnalos ya todos a una.</div></div><button class="btn" data-a="asignar">Asignar</button></div></div>` : ''}
    <h3>Qué hay cargado</h3>
    <div class="tarjeta"><div class="fila"><div class="t"><b>${total} ${total === 1 ? 'movimiento' : 'movimientos'}</b><div class="mini">${anios.length ? 'de ' + anios.join(', ') : 'todavía ninguno'}</div></div>
      ${porClas ? h`<button class="btn" data-a="reclasificar">Reclasificar ${porClas}</button>` : crudo('')}</div>
      ${porClas ? h`<div class="mini">${porClas} ${porClas === 1 ? 'movimiento cambiaría' : 'movimientos cambiarían'} de concepto con las reglas de ahora. Los editados a mano no se tocan.</div>` : ''}</div>
    <h3>Cargas anteriores</h3>
    ${his.length ? lista(his.map(x => h`<div class="tarjeta"><div class="fila"><div class="t"><b>${x.fichero || 'extracto'}</b><div class="mini">${fechaCorta(x.fecha)} ${x.hora} · ${x.origen}${x.cuenta ? ' · ' + nombreCuenta(x.cuenta) : ''}</div></div>
      <div class="mini centro">${x.n ? h`<b class="pos">+${x.n}</b>` : crudo('')}${x.rep ? h` · ${x.rep} actualizados` : ''}${x.omit ? h` · ${x.omit} sin tocar` : ''}${x.mal ? h` · ${x.mal} ilegibles` : ''}</div></div></div>`))
      : aviso('Aquí queda la lista de extractos que vayas cargando, con cuántos movimientos entraron en cada uno.')}
    <div class="acciones">${his.length ? h`<button class="btn peligro" data-a="olvidar">Vaciar esta lista</button>` : ''}<button class="btn" data-a="clave">Cambiar la clave de Finanzas</button></div>`;
  delegar(cont, {
    extracto: async el => { const f = el.files[0]; el.value = ''; if (f) await cargarFichero(f); },
    cuenta: async el => {
      const c = estado.cuentas.find(x => x.id === el.dataset.id); if (!c) return;
      const v = await pedir('Cuenta', camposCuenta, c);
      if (!v) return;
      const iban = normIban(v.iban);
      if (iban && estado.cuentas.some(x => x !== c && normIban(x.iban) === iban)) return toast('Ese IBAN ya es de otra cuenta', 5000);
      Object.assign(c, { nombre: v.nombre.trim(), iban }); guardar();
    },
    asignar: async () => {
      const v = await pedir('Asignar a una cuenta', [{ n: 'cuenta', l: `Los ${sinCuenta} movimientos sin cuenta van a`, t: 'select', o: estado.cuentas.map(c => ({ v: c.id, l: c.nombre })) }], {}, { aceptar: 'Asignar' });
      if (!v) return;
      for (const m of estado.movimientos) if (!m.cuenta) m.cuenta = v.cuenta;
      guardar(); toast(`${sinCuenta} asignados a ${nombreCuenta(v.cuenta)}`);
    },
    reclasificar: async () => {
      const cambian = porReclasificar();
      const n = cambian.length;
      if (!await confirmar(`${n} ${n === 1 ? 'movimiento cambia' : 'movimientos cambian'} de concepto con las reglas de ahora. Los que hayas editado a mano no se tocan.`, 'Reclasificar')) return;
      for (const x of cambian) x.concepto = adivinar(x.descripcion, x.importe);
      guardar(); toast(n === 1 ? '1 reclasificado' : n + ' reclasificados');
    },
    olvidar: async () => { if (await confirmar('Solo borra el historial de cargas, no los movimientos.', 'Vaciar')) { estado.importaciones = []; guardar(); } },
    clave: async () => {
      const v = await pedir('Cambiar la clave', [{ n: 'actual', l: 'Clave de ahora', t: 'password', req: true }, { n: 'nueva', l: 'Clave nueva (4 caracteres o más)', t: 'password', req: true }, { n: 'otra', l: 'Repite la nueva', t: 'password', req: true }], {}, { aceptar: 'Cambiar' });
      if (!v) return;
      if (v.nueva.length < 4) return toast('La clave nueva tiene que tener al menos 4 caracteres', 5000);
      if (v.nueva !== v.otra) return toast('Las dos claves nuevas no coinciden', 5000);
      toast(await cambiarClave(v.actual, v.nueva) ? 'Clave cambiada' : 'La clave de ahora no es esa', 5000);
    },
  });
}
