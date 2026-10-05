// Finanzas: tres pestañas con oficios distintos —los movimientos del mes, el módulo de carga y los
// informes— más los pagos fijos. Separarlas es lo que deja sitio para que los informes crezcan sin
// que la pantalla de movimientos se llene de botones que no son de ahí.
import { estado, guardar, persistir, h, lista, crudo, delegar, uid, hoyISO, mesISO, sumarDias, fechaCorta, fechaLarga, mesNombre, euros, pedir, toast, aviso, navegar } from '../nucleo.js';
import { CONCEPTOS } from '../datos/semillas.js';
import { consultar, conLLM, textoAConsejos } from '../llm.js';
import { balanceMes, asegurarCuentas, nombreCuenta, SIN_CUENTA } from './finanzas/calculos.js';
import { conClave, abierta, abrir, crearClave, cerrar, borrarFinanzas } from '../cofre.js';
import * as importar from './finanzas/importar.js';
import * as informes from './finanzas/informes.js';
import { pagosFijos, proximos, alMes, agendaAvisos, PERIODOS } from './finanzas/vencimientos.js';
import { ajustesAvisos, antelacionTexto, HORAS, escribirAgenda, leerAgenda, revisarAhora, despertador, hayDespertador, probar } from '../avisos-pagos.js';

// reglas.js y menu.js consultan los balances desde fuera de la sección.
export { balanceMes, balanceAnio, adivinar } from './finanzas/calculos.js';

const campos = [
  { n: 'fecha', l: 'Fecha', t: 'date', req: true }, { n: 'descripcion', l: 'Descripción', req: true },
  { n: 'importe', l: 'Importe (negativo = gasto)', t: 'number', step: 0.01, req: true }, { n: 'concepto', l: 'Concepto', t: 'select', o: CONCEPTOS },
];
const camposMov = () => [...campos, { n: 'cuenta', l: 'Cuenta', t: 'select', o: opcionesCuenta(false) }];
const MESES_NOMBRE = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const camposRec = () => [{ n: 'descripcion', l: 'Pago', req: true }, { n: 'importe', l: 'Importe de cada pago (negativo = gasto)', t: 'number', step: 0.01, req: true }, { n: 'concepto', l: 'Concepto', t: 'select', o: CONCEPTOS, v: 'servicios web' },
  { n: 'dia', l: 'Día del mes', t: 'number', v: 1, min: 1, max: 31 }, { n: 'periodo', l: 'Cada cuánto', t: 'select', o: Object.entries(PERIODOS).map(([v, l]) => ({ v, l })), v: '1' },
  { n: 'mes', l: 'Mes de un pago (si no es mensual)', t: 'select', o: MESES_NOMBRE.map((l, i) => ({ v: String(i + 1), l })), v: String(Number(hoyISO().slice(5, 7))) },
  { n: 'cuenta', l: 'Cuenta', t: 'select', o: [{ v: '', l: '—' }, ...estado.cuentas.map(c => ({ v: c.id, l: c.nombre }))] }, campoAviso()];
// La antelación de un pago: la general (la de la tarjeta de avisos), otra suya o ninguna.
const campoAviso = () => ({ n: 'aviso', l: 'Aviso al móvil', t: 'select', o: [{ v: '', l: `Como todos (${antelacionTexto(ajustesAvisos().antelacion)})` }, { v: 'no', l: 'No avisar' }, ...[0, 1, 2, 3].map(n => ({ v: String(n), l: antelacionTexto(n) }))] });
// Los recurrentes apuntados a mano: los que tienen `clave` son decisiones sobre un pago detectado (su
// nombre, o que no es un pago fijo), no pagos que aplicar.
const aMano = () => estado.recurrentes.filter(r => !r.clave);

// La ruta de los listados sigue siendo `v=informes`: así no se rompen los accesos ya fijados.
const PESTANAS = [
  { v: 'movimientos', l: 'Movimientos' },
  { v: 'importar', l: 'Importar' },
  { v: 'informes', l: 'Listados' },
  // Ruta `recurrentes` por compatibilidad con los accesos ya fijados (ADR-012).
  { v: 'recurrentes', l: 'Pagos fijos' },
];

// ---------- la clave (ADR-011) ----------
// Se pide una vez al entrar; dentro, pestañas y listados no la vuelven a pedir. Cualquier ruta de
// Finanzas (un acceso directo, el «atrás» del navegador) pasa por aquí antes de pintar nada.
function pintarCandado(cont, params) {
  const nueva = !conClave();
  cont.innerHTML = h`<div class="tarjeta candado"><div class="grande">${nueva ? '🔐' : '🔒'}</div>
    <b>${nueva ? 'Pon una clave a Finanzas' : 'Finanzas con clave'}</b>
    ${nueva ? h`<p class="mini">Movimientos, cuentas con su IBAN, recurrentes y cargas se guardan cifrados con ella y solo se descifran al entrar. Se pide una vez al entrar; al salir de Finanzas, o tras 5 minutos con la app en segundo plano, se cierra sola.</p>
      <p class="mini"><b>Si la olvidas, los datos de Finanzas no se pueden recuperar</b>: la clave no se guarda en ningún sitio. Si quieres una copia sin cifrar de lo que hay ahora, expórtala antes desde Ajustes.</p>` : ''}
    <form class="form" data-candado>
      <input type="password" name="clave" autocomplete="${nueva ? 'new-password' : 'current-password'}" placeholder="${nueva ? 'Clave nueva (4 caracteres o más)' : 'Clave'}" required minlength="${nueva ? 4 : 1}">
      ${nueva ? crudo('<input type="password" name="otra" autocomplete="new-password" placeholder="Repite la clave" required>') : ''}
      <div class="mini error" data-error></div>
      <button class="btn p" type="submit">${nueva ? 'Crear la clave' : 'Entrar'}</button>
    </form>
    ${nueva ? '' : h`<p class="mini"><button class="btn mini" data-a="olvido">He olvidado la clave</button></p>`}</div>`;
  const form = cont.querySelector('[data-candado]'), error = cont.querySelector('[data-error]'), boton = form.querySelector('button');
  form.onsubmit = async e => {
    e.preventDefault();
    const clave = form.elements.clave.value;
    if (nueva && clave !== form.elements.otra.value) { error.textContent = 'Las dos claves no coinciden'; return; }
    boton.disabled = true; boton.textContent = nueva ? 'Cifrando…' : 'Comprobando…'; error.textContent = '';
    try {
      if (nueva) { await crearClave(clave); toast('Clave creada: Finanzas queda cifrada', 5000); }
      else if (!await abrir(clave)) { boton.disabled = false; boton.textContent = 'Entrar'; error.textContent = 'Esa no es la clave'; form.elements.clave.select(); return; }
      render(cont, params);
    } catch (err) { boton.disabled = false; boton.textContent = nueva ? 'Crear la clave' : 'Entrar'; error.textContent = 'No se pudo: ' + err.message; }
  };
  delegar(cont, {
    olvido: async () => {
      const v = await pedir('He olvidado la clave', [{ n: 'ok', l: 'Escribe BORRAR para confirmar' }], {}, { texto: 'Sin la clave no hay forma de descifrar lo guardado: solo queda borrar todos los datos de Finanzas (movimientos, cuentas, recurrentes y cargas) y empezar con una clave nueva. Si tienes una copia exportada de antes de poner la clave, se puede importar después desde Ajustes.', aceptar: 'Borrar Finanzas' });
      if (v && v.ok.trim().toUpperCase() === 'BORRAR') { borrarFinanzas(); toast('Finanzas borrada: crea una clave nueva', 6000); }
      else if (v) toast('No se ha borrado nada', 4000);
    },
  });
  form.elements.clave.focus();
}

function render(cont, params) {
  if (!abierta()) return pintarCandado(cont, params);
  if (asegurarCuentas()) persistir();
  actualizarAgenda();
  // `vista=anio` era la ruta del informe antes de que hubiera pestañas; los enlaces guardados y el
  // botón atrás del navegador siguen trayéndola.
  const v = params.vista === 'anio' ? 'informes' : (PESTANAS.some(p => p.v === params.v) ? params.v : 'movimientos');
  if (params.vista === 'anio') params = { ...params, informe: 'anual' };
  cont.innerHTML = h`<div class="pestanas">${lista(PESTANAS.map(p => {
    const n = { movimientos: estado.movimientos.length, recurrentes: p.v === 'recurrentes' ? pagosFijos(estado.movimientos, estado.recurrentes).activos.length : 0 }[p.v];
    return h`<button class="${p.v === v ? 'sel' : ''}" data-a="pestana" data-v="${p.v}">${p.l}${n ? crudo(`<i class="n">${n}</i>`) : ''}</button>`;
  }))}<button data-a="bloquear" title="Cerrar Finanzas" aria-label="Cerrar Finanzas">🔒</button></div><div id="fin-cuerpo"></div>`;
  delegar(cont, {
    pestana: el => navegar('finanzas', el.dataset.v === 'movimientos' ? { v: 'movimientos', mes: params.mes || mesISO(hoyISO()), ...(params.cuenta ? { cuenta: params.cuenta } : {}) } : { v: el.dataset.v }),
    bloquear: () => { cerrar(); render(cont, params); },
  });
  // En el móvil no caben las cinco pestañas: la elegida se desliza a la vista.
  const sel = cont.querySelector('.pestanas .sel');
  if (sel) sel.parentNode.scrollLeft = Math.max(0, sel.offsetLeft - sel.parentNode.offsetLeft - 16);
  const cuerpo = cont.querySelector('#fin-cuerpo');
  if (v === 'importar') return importar.render(cuerpo);
  if (v === 'informes') return informes.render(cuerpo, params);
  if (v === 'recurrentes') return renderRecurrentes(cuerpo);
  return renderMovimientos(cuerpo, params);
}

// Cada vez que Finanzas se pinta abierta, la agenda de avisos se rehace con lo que hay ahora: es lo
// que el service worker leerá sin la clave (ADR-012). Con los avisos quitados, se borra.
function actualizarAgenda() {
  const aj = ajustesAvisos(), hoy = hoyISO();
  const items = aj.activo ? agendaAvisos(pagosFijos(estado.movimientos, estado.recurrentes).activos, hoy, aj, 60, nombreCuenta) : [];
  escribirAgenda(items, sumarDias(hoy, 60)).then(() => { if (aj.activo) { despertador(true); revisarAhora(); } }).catch(() => null);
}

const opcionesCuenta = (todas = true) => [...(todas ? [{ v: '', l: 'Todas las cuentas' }] : []), ...estado.cuentas.map(c => ({ v: c.id, l: c.nombre })), ...(todas && estado.movimientos.some(m => !m.cuenta) ? [{ v: SIN_CUENTA, l: 'Sin cuenta' }] : [])];
function renderMovimientos(cont, params) {
  const mes = params.mes || mesISO(hoyISO()), cuenta = params.cuenta || '';
  const b = balanceMes(mes, cuenta);
  const [y, m] = mes.split('-').map(Number);
  const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`, next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
  const movs = estado.movimientos.filter(x => mesISO(x.fecha) === mes && (!cuenta || (cuenta === SIN_CUENTA ? !x.cuenta : x.cuenta === cuenta))).sort((a, c) => c.fecha.localeCompare(a.fecha));
  const rec = aMano(), recAplicadas = rec.filter(r => estado.movimientos.some(x => x.recurrenteId === r.id && mesISO(x.fecha) === mes)).length;
  cont.innerHTML = h`
    <div class="fila cab"><button class="btn" data-a="mes" data-m="${prev}">‹</button><div class="t centro"><b>${mesNombre(mes)}</b></div><button class="btn" data-a="mes" data-m="${next}">›</button></div>
    <select data-c="cuenta" aria-label="Cuenta">${lista(opcionesCuenta().map(o => h`<option value="${o.v}" ${o.v === cuenta ? 'selected' : ''}>${o.l}</option>`))}</select>
    <div class="tarjeta"><div class="grande ${b.neto >= 0 ? 'pos' : 'neg'}">${euros(b.neto)}</div><div class="mini">ingresos ${euros(b.ing)} · gastos ${euros(b.gas)} · ${b.n} ${b.n === 1 ? 'movimiento' : 'movimientos'}</div>
      ${Object.keys(b.por).length ? crudo('<table class="tabla">' + Object.entries(b.por).sort((x, z) => z[1] - x[1]).map(([c, v]) => h`<tr><td>${c}</td><td class="n">${euros(v)}</td><td style="width:40%"><div class="barra"><i style="width:${Math.round(v / b.gas * 100)}%"></i></div></td></tr>`).join('') + '</table>') : ''}</div>
    <div class="acciones"><button class="btn p" data-a="nuevo">+ Movimiento</button>${rec.length ? h`<button class="btn" data-a="aplicarRec">Aplicar recurrentes (${recAplicadas}/${rec.length})</button>` : crudo('')}${b.n ? crudo('<button class="btn" data-a="analizarLLM">Recomendaciones con LLM</button>') : ''}</div>
    ${movs.length ? crudo('<table class="tabla">' + movs.slice(0, 60).map(x => h`<tr data-a="editar" data-id="${x.id}"><td class="mini">${fechaCorta(x.fecha)}</td><td>${x.descripcion}<div class="mini">${x.concepto}${cuenta ? '' : ' · ' + nombreCuenta(x.cuenta)}</div></td><td class="n ${x.importe >= 0 ? 'pos' : 'neg'}">${euros(x.importe)}</td></tr>`).join('') + '</table>') : aviso('Sin movimientos en ' + mesNombre(mes) + '. Cambia de mes con las flechas, carga el extracto del banco desde la pestaña Importar o añade uno a mano.')}
    ${movs.length > 60 ? h`<p class="mini">Se enseñan los 60 primeros de ${movs.length}.</p>` : ''}`;
  delegar(cont, {
    mes: el => navegar('finanzas', { v: 'movimientos', mes: el.dataset.m, ...(cuenta ? { cuenta } : {}) }),
    cuenta: el => navegar('finanzas', { v: 'movimientos', mes, ...(el.value ? { cuenta: el.value } : {}) }),
    analizarLLM: el => conLLM(el, async () => {
      const bp = balanceMes(prev);
      const j = await consultar({ operacion: 'finanzas', tarea: `Analiza las finanzas de ${mesNombre(mes)}: ingresos ${euros(b.ing)}, gastos ${euros(b.gas)}, por concepto ${Object.entries(b.por).map(([k, v]) => k + ' ' + euros(v)).join(', ')}; mes anterior gastos ${euros(bp.gas)} (${Object.entries(bp.por).map(([k, v]) => k + ' ' + euros(v)).join(', ') || 'sin datos'}); recurrentes: ${rec.map(r => r.descripcion + ' ' + euros(r.importe)).join(', ') || 'ninguno'}. Da 3 recomendaciones concretas y accionables, cada una en una línea que empiece por "- ". Solo recomendar, nunca ejecutar.` });
      toast(textoAConsejos(j.respuesta, 'finanzas') + ' recomendaciones en Consejos'); navegar('mayordomo');
    }),
    nuevo: async () => { const v = await pedir('Movimiento', camposMov(), { fecha: hoyISO(), concepto: 'otros', cuenta: cuenta && cuenta !== SIN_CUENTA ? cuenta : estado.cuentas[1]?.id }); if (v) { estado.movimientos.push({ id: uid(), ...v }); guardar(); } },
    editar: async el => { const x = estado.movimientos.find(z => z.id === el.dataset.id); const v = await pedir('Editar', camposMov(), x, { extra: 'Borrar' }); if (!v) return; if (v.__extra) estado.movimientos = estado.movimientos.filter(z => z.id !== x.id); else { if (v.concepto !== x.concepto) v.conceptoManual = true; Object.assign(x, v); } guardar(); },
    aplicarRec: () => { let n = 0; for (const r of rec) { if (estado.movimientos.some(x => x.recurrenteId === r.id && mesISO(x.fecha) === mes)) continue; estado.movimientos.push({ id: uid(), fecha: `${mes}-${String(r.dia || 1).padStart(2, '0')}`, descripcion: r.descripcion, importe: r.importe, concepto: r.concepto, recurrenteId: r.id }); n++; } guardar(); toast(n + ' aplicados'); },
  });
}

// ---------- pagos fijos (ADR-012) ----------
// Los que se detectan solos en los movimientos importados más los apuntados a mano, con lo que vence
// en los próximos 30 días encima: es lo que leerán los avisos al móvil cuando los haya.
const cuando = n => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === 2 ? 'pasado mañana' : `en ${n} días`);
const diaTexto = d => (d <= 0 ? 31 + d : d);
const CADA = { 1: 'al mes', 2: 'cada 2 meses', 3: 'cada 3 meses', 6: 'cada 6 meses', 12: 'al año' };
function lineaPago(p) {
  const cuenta = p.cuenta ? nombreCuenta(p.cuenta) : '';
  const dia = p.margen ? `día ${p.dia} (entre el ${diaTexto(p.desde)} y el ${diaTexto(p.hasta)})` : `día ${p.dia}`;
  const historia = p.origen === 'detectado' ? `${p.cargos.length} cargos, del ${fechaCorta(p.primero)} al ${fechaCorta(p.ultimo)}` : 'apuntado a mano';
  const horquilla = p.minimo != null && p.minimo !== p.maximo ? `de ${euros(p.minimo)} a ${euros(p.maximo)}` : '';
  const avisa = !ajustesAvisos().activo || p.aviso === '' || p.aviso == null ? '' : p.aviso === 'no' ? '🔕 sin aviso' : '🔔 ' + antelacionTexto(p.aviso);
  return [PERIODOS[p.periodo], dia, cuenta, horquilla, historia, avisa].filter(Boolean).join(' · ');
}
const tarjetaPago = (p, accion) => h`<div class="tarjeta fila" data-a="${accion}" ${p.origen === 'manual' ? h`data-id="${p.id}"` : h`data-k="${p.clave}"`}><div class="t"><b>${p.nombre}</b> <span class="pill g">${p.origen === 'manual' ? 'a mano' : 'detectado'}</span><div class="mini">${lineaPago(p)}</div></div>
  <div class="n"><b class="${p.ingreso ? 'pos' : 'neg'}">${p.origen === 'detectado' ? '≈\u00a0' : ''}${euros(p.importe)}</b><div class="mini">${CADA[p.periodo]}</div></div></div>`;

function renderRecurrentes(cont) {
  const hoy = hoyISO();
  const { activos, terminados, descartados } = pagosFijos(estado.movimientos, estado.recurrentes);
  const gastos = activos.filter(p => !p.ingreso), alMesTotal = gastos.reduce((s, p) => s + alMes(p), 0);
  const nDet = activos.filter(p => p.origen === 'detectado').length, nMan = activos.length - nDet;
  const prox = proximos(gastos, hoy, 30), aj = ajustesAvisos();
  // Cuándo avisará de cada cobro próximo, para verlo antes de que pase.
  const cuandoAvisa = p => {
    if (!aj.activo) return '';
    if (p.pago.aviso === 'no') return ' · 🔕 sin aviso';
    const el = sumarDias(p.fecha, -(p.pago.aviso === '' || p.pago.aviso == null ? Number(aj.antelacion) : Number(p.pago.aviso)));
    return el <= hoy ? ' · 🔔 avisa hoy' : ` · 🔔 aviso el ${fechaLarga(el)} a las ${aj.hora}`;
  };
  const tarjetaAvisos = h`<div class="tarjeta"><b>🔔 Avisos de pagos fijos</b>
    <label class="check"><input type="checkbox" data-c="avisoActivo" ${aj.activo ? 'checked' : ''}> Avisarme en el móvil antes de cada pago fijo</label>
    ${aj.activo ? h`<div class="mini">Con cuánta antelación</div><div class="chips">${lista([0, 1, 2, 3].map(n => h`<button class="pill ${Number(aj.antelacion) === n ? 'sel' : ''}" data-a="avisoAntelacion" data-v="${n}">${antelacionTexto(n)}</button>`))}</div>
      <div class="mini">A qué hora</div><div class="chips">${lista(HORAS.map(x => h`<button class="pill ${aj.hora === x ? 'sel' : ''}" data-a="avisoHora" data-v="${x}">${x}</button>`))}</div>
      <label class="check"><input type="checkbox" data-c="avisoImporte" ${aj.importe ? 'checked' : ''}> Decir el importe en el aviso</label>
      <div class="acciones"><button class="btn" data-a="avisoProbar">Probar un aviso</button></div>
      <p class="mini" data-estado-avisos></p>` : h`<p class="mini">Llega aunque la app esté cerrada si está instalada en el móvil; si no, al abrirla.</p>`}</div>`;
  cont.innerHTML = h`
    ${activos.length ? h`<div class="tarjeta"><div class="grande neg">≈\u00a0${euros(alMesTotal)} al mes</div><div class="mini">${euros(alMesTotal * 12)} al año en ${activos.length} ${activos.length === 1 ? 'pago fijo' : 'pagos fijos'}: ${nDet} ${nDet === 1 ? 'detectado' : 'detectados'} en tus movimientos y ${nMan} ${nMan === 1 ? 'apuntado' : 'apuntados'} a mano</div></div>`
      : aviso(estado.movimientos.length ? 'No se ha detectado ningún pago que se repita con un ritmo fijo. Hace falta haber importado al menos tres meses de extractos (un año para los anuales); también puedes apuntarlos a mano.' : 'Importa los extractos del banco (pestaña Importar) y aquí saldrán solos los pagos que se repiten —luz, comunidad, gas, seguros, suscripciones— con el día en que vence cada uno. También puedes apuntarlos a mano.')}
    ${activos.length ? h`<h3>Próximos 30 días</h3>
      ${prox.length ? crudo('<table class="tabla">' + prox.map(f => h`<tr data-a="${f.pago.origen === 'manual' ? 'editarRec' : 'pago'}" ${f.pago.origen === 'manual' ? h`data-id="${f.pago.id}"` : h`data-k="${f.pago.clave}"`}><td><b>${cuando(f.dentro)}</b><div class="mini">${fechaLarga(f.fecha)}</div></td><td>${f.pago.nombre}<div class="mini">${PERIODOS[f.pago.periodo]}${f.pago.cuenta ? ' · ' + nombreCuenta(f.pago.cuenta) : ''}${cuandoAvisa(f)}</div></td><td class="n neg">${f.pago.origen === 'detectado' ? '≈\u00a0' : ''}${euros(f.importe)}</td></tr>`).join('') + '</table>') : aviso('Nada en los próximos 30 días.')}
      <div class="acciones"><button class="btn" data-a="calendario">📅 Vencimientos mes a mes</button></div>
      ${tarjetaAvisos}
      <h3>Pagos fijos</h3>${lista(activos.map(p => tarjetaPago(p, p.origen === 'manual' ? 'editarRec' : 'pago')))}` : ''}
    ${terminados.length ? h`<details class="plegable"><summary>Ya no se cobran (${terminados.length})</summary><div class="cuerpo">${lista(terminados.map(p => tarjetaPago(p, 'pago')))}<p class="mini">Se cobraban con ritmo y el último cargo es de hace más de periodo y medio. No entran en el calendario.</p></div></details>` : ''}
    ${descartados.length ? h`<details class="plegable"><summary>Descartados (${descartados.length})</summary><div class="cuerpo">${lista(descartados.map(p => tarjetaPago(p, 'recuperar')))}<p class="mini">Toca uno para volver a contarlo como pago fijo.</p></div></details>` : ''}
    <div class="acciones"><button class="btn p" data-a="nuevoRec">+ Pago a mano</button></div>
    <p class="mini">Se detectan solos en los movimientos importados: cargos del mismo emisor que se repiten cada mes, dos, tres, seis o doce meses en un día parecido. El día es el habitual; un recibo domiciliado que vence en fin de semana se cuenta el lunes. Toca uno para cambiarle el nombre o quitarlo si no es un pago fijo.</p>`;
  const detectado = k => [...activos, ...terminados, ...descartados].find(p => p.clave === k);
  // La decisión sobre un pago detectado se guarda en un recurrente con su clave.
  const decidir = (p, cambios) => {
    let r = estado.recurrentes.find(x => x.clave === p.clave);
    if (!r) { r = { id: uid(), clave: p.clave, descripcion: p.nombre }; estado.recurrentes.push(r); }
    Object.assign(r, cambios); guardar();
  };
  const ponerAvisos = cambios => { estado.ajustes.avisosPagos = { ...ajustesAvisos(), ...cambios }; guardar(); };
  const estadoAvisos = cont.querySelector('[data-estado-avisos]');
  if (estadoAvisos) pintarEstadoAvisos(estadoAvisos);
  delegar(cont, {
    calendario: () => navegar('finanzas', { v: 'informes', informe: 'vencimientos' }),
    // El permiso se pide al marcar la casilla: el navegador solo lo deja pedir tras un toque.
    avisoActivo: async el => {
      if (el.checked) {
        const permiso = typeof Notification === 'undefined' ? 'denied' : await Notification.requestPermission();
        if (permiso !== 'granted') { el.checked = false; toast('Sin permiso de avisos: el navegador no deja a maydom enseñar notificaciones. Se activa en sus ajustes del sitio.', 7000); return; }
      }
      ponerAvisos({ activo: el.checked });
      if (el.checked) toast(`Avisos puestos: ${antelacionTexto(ajustesAvisos().antelacion)}, a las ${ajustesAvisos().hora}`, 4000);
      else { despertador(false); toast('Avisos quitados; la agenda de avisos se ha borrado del móvil', 4000); }
    },
    avisoAntelacion: el => ponerAvisos({ antelacion: Number(el.dataset.v) }),
    avisoHora: el => ponerAvisos({ hora: el.dataset.v }),
    avisoImporte: el => ponerAvisos({ importe: el.checked }),
    avisoProbar: async () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
      try { await probar(agendaAvisos(gastos, hoy, aj, 60, nombreCuenta)[0]); toast('Aviso enviado: mira las notificaciones', 4000); }
      catch { toast('El navegador no deja enseñar el aviso: revisa el permiso de notificaciones de maydom', 7000); }
    },
    pago: async el => {
      const p = detectado(el.dataset.k);
      if (!p) return;
      const ultimos = p.cargos.slice(-6).reverse().map(c => `${fechaCorta(c.fecha)} ${euros(-c.importe)}`).join(' · ');
      const v = await pedir(p.nombre, [{ n: 'descripcion', l: 'Nombre', req: true }, campoAviso()], { descripcion: p.nombre, aviso: p.aviso }, {
        texto: `${PERIODOS[p.periodo]}, ${p.margen ? `del ${diaTexto(p.desde)} al ${diaTexto(p.hasta)} de cada mes que toca` : `el día ${p.dia}`}${p.cuenta ? ', en ' + nombreCuenta(p.cuenta) : ''}. Últimos cargos: ${ultimos}.`,
        extra: 'No es un pago fijo',
      });
      if (!v) return;
      if (v.__extra) { decidir(p, { descartado: true }); toast(`«${p.nombre}» ya no cuenta como pago fijo; está en Descartados`, 5000); }
      else decidir(p, { descripcion: v.descripcion.trim() || p.nombre, aviso: v.aviso });
    },
    recuperar: el => { const p = detectado(el.dataset.k); if (p) { decidir(p, { descartado: false }); toast(`«${p.nombre}» vuelve a contar como pago fijo`); } },
    nuevoRec: async () => { const v = await pedir('Pago fijo a mano', camposRec(), {}, { texto: 'Para lo que no pasa por los extractos importados o aún no se ha cobrado tres veces. Los que salen en los movimientos se detectan solos.' }); if (v) { estado.recurrentes.push({ id: uid(), ...v }); guardar(); } },
    editarRec: async el => { const r = estado.recurrentes.find(z => z.id === el.dataset.id); if (!r) return; const v = await pedir('Editar pago fijo', camposRec(), { periodo: '1', ...r }, { extra: 'Borrar' }); if (!v) return; if (v.__extra) estado.recurrentes = estado.recurrentes.filter(z => z.id !== r.id); else Object.assign(r, v); guardar(); },
  });
}

// Lo que la tarjeta de avisos no sabe al pintarse: el permiso, si el móvil despierta la app y hasta
// cuándo llega la agenda.
async function pintarEstadoAvisos(el) {
  const permiso = typeof Notification === 'undefined' ? 'no' : Notification.permission;
  const [desp, ag] = await Promise.all([hayDespertador(), leerAgenda()]);
  el.textContent = [
    permiso === 'denied' || permiso === 'no' ? 'El navegador no deja enseñar avisos a maydom: actívalos en los ajustes del sitio (Notificaciones).' : '',
    desp ? 'Con la app cerrada, el móvil la despierta para avisar: lo decide el navegador y puede llegar con algo de retraso.' : 'Con la app cerrada solo avisa si está instalada (Ajustes → Aplicación → Instalar la app); mientras, avisa al abrirla.',
    ag?.hasta ? `Avisos preparados hasta el ${fechaCorta(ag.hasta)}: se renuevan cada vez que entras en Finanzas.` : '',
    'Cada pago puede llevar su propia antelación o no avisar: tócalo en la lista.',
  ].filter(Boolean).join(' ');
}

export default { id: 'finanzas', titulo: 'Finanzas', grupo: 'Vida', icono: '€', render };
