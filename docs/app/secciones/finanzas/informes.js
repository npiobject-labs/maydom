// Listados de Finanzas (pestaña «Listados», ruta `v=informes`). Cada uno es una entrada de INFORMES
// con sus `parametros` (campos de pedir()) y su render: tocarlo abre primero la selección de
// parámetros y luego pinta el listado, que se puede volver a filtrar con «Cambiar». Los parámetros
// viajan en la ruta, así que un listado se puede fijar en Hoy o volver a él con «atrás».
// Uno sin parámetros sale directamente. Añadir uno es añadir una entrada; la pestaña hace el resto.
import { estado, h, lista, crudo, delegar, euros, aviso, navegar, mesAbrev, hoyISO, fechaCorta, pedir } from '../../nucleo.js';
import { CONCEPTOS, CONCEPTOS_NEUTROS } from '../../datos/semillas.js';
import { balanceAnio, aniosConDatos, filtrar, nombreCuenta, saldoCuenta, SIN_CUENTA } from './calculos.js';

// ---------- parámetros comunes ----------
const anioDefecto = () => aniosConDatos()[0] || hoyISO().slice(0, 4);
const P = {
  anio: () => ({ n: 'anio', l: 'Año', t: 'select', o: [...new Set([...aniosConDatos(), hoyISO().slice(0, 4)])].sort().reverse() }),
  cuenta: () => ({ n: 'cuenta', l: 'Cuenta', t: 'select', o: [{ v: '', l: 'Todas las cuentas' }, ...estado.cuentas.map(c => ({ v: c.id, l: c.nombre })), ...(estado.movimientos.some(m => !m.cuenta) ? [{ v: SIN_CUENTA, l: 'Sin cuenta' }] : [])] }),
  desde: () => ({ n: 'desde', l: 'Desde', t: 'date' }),
  hasta: () => ({ n: 'hasta', l: 'Hasta', t: 'date' }),
  tipo: () => ({ n: 'tipo', l: 'Qué movimientos', t: 'select', o: [{ v: '', l: 'Ingresos y gastos' }, { v: 'gastos', l: 'Solo gastos' }, { v: 'ingresos', l: 'Solo ingresos' }] }),
  concepto: () => ({ n: 'concepto', l: 'Concepto', t: 'select', o: [{ v: '', l: 'Todos' }, ...CONCEPTOS] }),
  texto: () => ({ n: 'texto', l: 'Que la descripción contenga (opcional)', ph: 'mercadona, bizum, nómina…' }),
};
const periodoDefecto = () => ({ desde: anioDefecto() + '-01-01', hasta: hoyISO() });
const TIPOS = { gastos: 'solo gastos', ingresos: 'solo ingresos' };
// Resumen legible de los parámetros elegidos, encima del listado.
const resumenParametros = p => [
  p.anio, p.desde && p.hasta ? `${fechaCorta(p.desde)} → ${fechaCorta(p.hasta)}` : p.desde ? 'desde ' + fechaCorta(p.desde) : p.hasta ? 'hasta ' + fechaCorta(p.hasta) : '',
  p.cuenta ? nombreCuenta(p.cuenta === SIN_CUENTA ? '' : p.cuenta) : 'todas las cuentas', TIPOS[p.tipo], p.concepto, p.texto ? `«${p.texto}»` : '',
].filter(Boolean);

export const INFORMES = [
  { id: 'anual', titulo: 'Resumen del año', resumen: 'Ingresos, gastos y neto mes a mes, con el gasto real (sin traspasos) y el desglose por concepto.', parametros: () => [P.anio(), P.cuenta()], defecto: () => ({ anio: anioDefecto(), cuenta: '' }), render: renderAnual },
  { id: 'movimientos', titulo: 'Movimientos', resumen: 'Lista filtrada por fechas, cuenta, concepto, ingresos o gastos y texto, con sus totales.', parametros: () => [P.desde(), P.hasta(), P.cuenta(), P.tipo(), P.concepto(), P.texto()], defecto: () => ({ ...periodoDefecto(), cuenta: '', tipo: '', concepto: '', texto: '' }), render: renderMovimientos },
  { id: 'conceptos', titulo: 'Gasto por concepto', resumen: 'En qué se va el dinero en un periodo: total, porcentaje, número de cargos y media al mes de cada concepto.', parametros: () => [P.desde(), P.hasta(), P.cuenta()], defecto: () => ({ ...periodoDefecto(), cuenta: '' }), render: renderConceptos },
  { id: 'cuentas', titulo: 'Cuentas', resumen: 'Ingresos, gastos y neto de cada cuenta en un periodo, con el último saldo que dio el banco.', parametros: () => [P.desde(), P.hasta()], defecto: () => periodoDefecto(), render: renderCuentas },
];

// ---------- resumen del año ----------
function renderAnual(cont, params) {
  const anios = aniosConDatos();
  const anio = Number(params.anio) || Number(anios[0]) || Number(hoyISO().slice(0, 4));
  const cuenta = params.cuenta || '';
  const b = balanceAnio(String(anio), cuenta);
  const tope = Math.max(1, ...b.filas.map(f => Math.max(f.ing, f.gas)));
  const peor = b.filas.slice().sort((x, z) => z.gas - x.gas)[0];
  const mejor = b.filas.slice().sort((x, z) => z.neto - x.neto)[0];
  cont.innerHTML = h`
    <div class="fila cab"><button class="btn" data-a="anio" data-y="${anio - 1}">‹</button><div class="t centro"><b>${anio}</b></div><button class="btn" data-a="anio" data-y="${anio + 1}">›</button></div>
    ${anios.length > 1 ? h`<div class="chips">${lista(anios.map(a => h`<button class="pill ${Number(a) === anio ? 'sel' : ''}" data-a="anio" data-y="${a}">${a}</button>`))}</div>` : ''}
    ${b.n ? '' : aviso('Sin movimientos en ' + anio + '. Importa el extracto del banco desde la pestaña Importar, o cambia de año con las flechas.')}
    ${b.n ? h`<div class="tarjeta"><div class="grande ${b.neto >= 0 ? 'pos' : 'neg'}">${euros(b.neto)}</div>
      <div class="mini">ingresos ${euros(b.ing)} · gastos ${euros(b.gas)} · ${b.n} ${b.n === 1 ? 'movimiento' : 'movimientos'} en ${b.mesesConDatos} ${b.mesesConDatos === 1 ? 'mes' : 'meses'}</div>
      ${b.neutro ? h`<div class="mini">de esos gastos, ${euros(b.neutro)} son traspasos y efectivo (no salen de tu bolsillo): gasto real ${euros(b.gasReal)}, ${euros(b.gasReal / b.mesesConDatos)} al mes</div>` : ''}
      <div class="mini">media mensual: ingresos ${euros(b.ing / b.mesesConDatos)} · gastos ${euros(b.gas / b.mesesConDatos)}${peor ? ' · mes de más gasto ' + mesAbrev(peor.mes) + ' (' + euros(peor.gas) + ')' : ''}${mejor ? ' · mejor mes ' + mesAbrev(mejor.mes) + ' (' + euros(mejor.neto) + ')' : ''}</div></div>` : ''}
    ${b.n ? crudo('<h3>Ingresos y gastos por mes</h3><table class="tabla"><tr><th>Mes</th><th class="n">Ingresos</th><th class="n">Gastos</th><th class="n">Neto</th></tr>'
      + b.filas.map(f => h`<tr data-a="ir" data-m="${f.mes}"><td>${mesAbrev(f.mes)}<div class="barra"><i class="ok" style="width:${Math.round(f.ing / tope * 100)}%"></i></div><div class="barra"><i class="mal" style="width:${Math.round(f.gas / tope * 100)}%"></i></div></td><td class="n pos">${euros(f.ing)}</td><td class="n neg">${euros(f.gas)}</td><td class="n ${f.neto >= 0 ? 'pos' : 'neg'}"><b>${euros(f.neto)}</b></td></tr>`).join('')
      + h`<tr><td><b>Total</b></td><td class="n pos"><b>${euros(b.ing)}</b></td><td class="n neg"><b>${euros(b.gas)}</b></td><td class="n ${b.neto >= 0 ? 'pos' : 'neg'}"><b>${euros(b.neto)}</b></td></tr>`
      + '</table>') : ''}
    ${Object.keys(b.por).length ? crudo('<h3>Gasto por concepto</h3><table class="tabla">' + Object.entries(b.por).sort((x, z) => z[1] - x[1]).map(([c, v]) => h`<tr><td>${c}</td><td class="n">${euros(v)}</td><td class="n mini">${Math.round(v / b.gas * 100)}%</td><td style="width:35%"><div class="barra"><i style="width:${Math.round(v / b.gas * 100)}%"></i></div></td></tr>`).join('') + '</table>') : ''}
    ${b.n ? h`<p class="mini">Toca un mes para ver sus movimientos.</p>` : ''}`;
  delegar(cont, {
    anio: el => navegar('finanzas', { v: 'informes', informe: 'anual', anio: el.dataset.y, cuenta }),
    ir: el => navegar('finanzas', { v: 'movimientos', mes: el.dataset.m, ...(cuenta ? { cuenta } : {}) }),
  });
}

// ---------- movimientos filtrados ----------
const TOPE_FILAS = 500;
function renderMovimientos(cont, params) {
  const ms = filtrar(params).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.orden || 0) - (a.orden || 0));
  const ing = ms.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0), gas = ms.filter(m => m.importe < 0).reduce((s, m) => s - m.importe, 0);
  cont.innerHTML = h`
    ${ms.length ? h`<div class="tarjeta"><div class="grande ${ing - gas >= 0 ? 'pos' : 'neg'}">${euros(ing - gas)}</div><div class="mini">${ms.length} ${ms.length === 1 ? 'movimiento' : 'movimientos'} · ingresos ${euros(ing)} · gastos ${euros(gas)}</div></div>` : aviso('Ningún movimiento cumple esos parámetros. Cámbialos con «Cambiar».')}
    ${ms.length ? crudo('<table class="tabla">' + ms.slice(0, TOPE_FILAS).map(x => h`<tr><td class="mini">${fechaCorta(x.fecha)}</td><td>${x.descripcion}<div class="mini">${x.concepto}${params.cuenta ? '' : ' · ' + nombreCuenta(x.cuenta)}</div></td><td class="n ${x.importe >= 0 ? 'pos' : 'neg'}">${euros(x.importe)}</td></tr>`).join('') + '</table>') : ''}
    ${ms.length > TOPE_FILAS ? h`<p class="mini">Se enseñan los ${TOPE_FILAS} más recientes de ${ms.length}; los totales son de todos. Acota las fechas para ver el resto.</p>` : ''}`;
}

// ---------- gasto por concepto ----------
function renderConceptos(cont, params) {
  const ms = filtrar({ ...params, tipo: 'gastos' });
  const por = {};
  for (const m of ms) { const c = por[m.concepto] || (por[m.concepto] = { total: 0, n: 0 }); c.total -= m.importe; c.n++; }
  const total = Object.values(por).reduce((s, c) => s + c.total, 0);
  const neutro = CONCEPTOS_NEUTROS.reduce((s, c) => s + (por[c]?.total || 0), 0);
  const meses = Math.max(1, new Set(ms.map(m => m.fecha.slice(0, 7))).size);
  cont.innerHTML = h`
    ${ms.length ? h`<div class="tarjeta"><div class="grande neg">${euros(total)}</div><div class="mini">${ms.length} cargos en ${meses} ${meses === 1 ? 'mes' : 'meses'}${neutro ? ` · ${euros(neutro)} son traspasos y efectivo: gasto real ${euros(total - neutro)}` : ''}</div></div>` : aviso('Ningún gasto en ese periodo y cuenta.')}
    ${ms.length ? crudo('<table class="tabla"><tr><th>Concepto</th><th class="n">Total</th><th class="n">%</th><th class="n">Cargos</th><th class="n">Al mes</th></tr>' + Object.entries(por).sort((x, z) => z[1].total - x[1].total).map(([c, v]) => h`<tr data-a="concepto" data-k="${c}"><td>${c}<div class="barra"><i style="width:${Math.round(v.total / total * 100)}%"></i></div></td><td class="n">${euros(v.total)}</td><td class="n mini">${Math.round(v.total / total * 100)}%</td><td class="n mini">${v.n}</td><td class="n mini">${euros(v.total / meses)}</td></tr>`).join('') + '</table>') : ''}
    ${ms.length ? h`<p class="mini">Toca un concepto para ver sus movimientos.</p>` : ''}`;
  delegar(cont, { concepto: el => navegar('finanzas', { v: 'informes', informe: 'movimientos', desde: params.desde || '', hasta: params.hasta || '', cuenta: params.cuenta || '', tipo: 'gastos', concepto: el.dataset.k }) });
}

// ---------- cuentas ----------
function renderCuentas(cont, params) {
  const filas = [...estado.cuentas.map(c => ({ id: c.id, nombre: c.nombre })), ...(estado.movimientos.some(m => !m.cuenta) ? [{ id: SIN_CUENTA, nombre: 'Sin cuenta' }] : [])].map(c => {
    const ms = filtrar({ ...params, cuenta: c.id });
    const ing = ms.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0), gas = ms.filter(m => m.importe < 0).reduce((s, m) => s - m.importe, 0);
    return { ...c, n: ms.length, ing, gas, neto: ing - gas, saldo: c.id === SIN_CUENTA ? null : saldoCuenta(c.id) };
  });
  const t = filas.reduce((s, f) => ({ ing: s.ing + f.ing, gas: s.gas + f.gas }), { ing: 0, gas: 0 });
  cont.innerHTML = crudo('<table class="tabla"><tr><th>Cuenta</th><th class="n">Ingresos</th><th class="n">Gastos</th><th class="n">Neto</th></tr>'
    + filas.map(f => h`<tr data-a="cuenta" data-id="${f.id}"><td>${f.nombre}<div class="mini">${f.n} movimientos${f.saldo ? ` · saldo ${euros(f.saldo.saldo)} el ${fechaCorta(f.saldo.fecha)}` : ''}</div></td><td class="n pos">${euros(f.ing)}</td><td class="n neg">${euros(f.gas)}</td><td class="n ${f.neto >= 0 ? 'pos' : 'neg'}"><b>${euros(f.neto)}</b></td></tr>`).join('')
    + h`<tr><td><b>Total</b></td><td class="n pos"><b>${euros(t.ing)}</b></td><td class="n neg"><b>${euros(t.gas)}</b></td><td class="n ${t.ing - t.gas >= 0 ? 'pos' : 'neg'}"><b>${euros(t.ing - t.gas)}</b></td></tr></table>`
    + '<p class="mini">Los traspasos entre tus cuentas salen como gasto en una y como ingreso en otra: en el total se compensan. Toca una cuenta para ver sus movimientos.</p>').__crudo;
  delegar(cont, { cuenta: el => navegar('finanzas', { v: 'informes', informe: 'movimientos', desde: params.desde || '', hasta: params.hasta || '', cuenta: el.dataset.id }) });
}

// ---------- pestaña ----------
// Abre la selección de parámetros de un listado y, al aceptar, lo pinta con ellos.
async function elegir(inf, actuales = {}) {
  if (!inf.parametros) return navegar('finanzas', { v: 'informes', informe: inf.id });
  const v = await pedir(inf.titulo, inf.parametros(), { ...inf.defecto(), ...actuales }, { aceptar: 'Ver listado', texto: inf.resumen });
  if (!v) return;
  if (v.desde && v.hasta && v.desde > v.hasta) [v.desde, v.hasta] = [v.hasta, v.desde];
  navegar('finanzas', { v: 'informes', informe: inf.id, ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x ?? ''])) });
}
export function render(cont, params) {
  const inf = INFORMES.find(i => i.id === params.informe);
  if (inf) {
    // Lo que no venga en la ruta toma su valor por defecto: un listado se puede abrir con solo su id.
    const p = { ...(inf.defecto?.() || {}), ...Object.fromEntries(Object.entries(params).filter(([k]) => !['v', 'informe'].includes(k))) };
    const cabecera = document.createElement('div');
    cabecera.innerHTML = h`<div class="fila cab"><div class="t"><b>${inf.titulo}</b></div>${inf.parametros ? h`<button class="btn mini" data-a="cambiar">Cambiar</button>` : ''}<button class="btn mini" data-a="volver">Todos los listados</button></div>
      ${inf.parametros ? h`<div class="filtros-listado">${lista(resumenParametros(p).map(t => h`<span class="pill g">${t}</span>`))}</div>` : ''}`.__crudo;
    cont.innerHTML = '';
    cont.appendChild(cabecera);
    delegar(cabecera, { volver: () => navegar('finanzas', { v: 'informes' }), cambiar: () => elegir(inf, p) });
    const caja = document.createElement('div');
    cont.appendChild(caja);
    return inf.render(caja, p);
  }
  const anios = aniosConDatos();
  cont.innerHTML = h`
    ${anios.length ? '' : aviso('Todavía no hay movimientos que listar. Empieza por la pestaña Importar.')}
    ${lista(INFORMES.map(i => h`<div class="tarjeta" data-a="abrir" data-id="${i.id}"><div class="fila"><div class="t"><b>${i.titulo}</b><div class="mini">${i.resumen}</div></div><span class="pill">${i.parametros ? 'elegir' : 'ver'}</span></div></div>`))}
    <p class="mini">Cada listado pide antes sus parámetros (fechas, cuenta, concepto…) y se pueden cambiar después sin salir de él. Vendrán más: comparación entre años, presupuesto frente a real, evolución de un concepto y recurrentes detectados solos.</p>`;
  delegar(cont, { abrir: el => elegir(INFORMES.find(i => i.id === el.dataset.id)) });
}
