// Informes de Finanzas. Añadir uno nuevo es añadir una entrada a INFORMES con su render: la
// pestaña pinta sola la portada, el título y el botón de volver, y no hay que tocar nada más.
import { h, lista, crudo, delegar, euros, aviso, navegar, mesAbrev, hoyISO } from '../../nucleo.js';
import { balanceAnio, aniosConDatos } from './calculos.js';

export const INFORMES = [
  { id: 'anual', titulo: 'Resumen del año', resumen: 'Ingresos, gastos y neto mes a mes, con el gasto real (sin traspasos) y el desglose por concepto.', render: renderAnual },
];

// ---------- resumen del año ----------
function renderAnual(cont, params) {
  const anios = aniosConDatos();
  const anio = Number(params.anio) || Number(anios[0]) || Number(hoyISO().slice(0, 4));
  const b = balanceAnio(String(anio));
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
    anio: el => navegar('finanzas', { v: 'informes', informe: 'anual', anio: el.dataset.y }),
    ir: el => navegar('finanzas', { v: 'movimientos', mes: el.dataset.m }),
  });
}

// ---------- pestaña ----------
export function render(cont, params) {
  const inf = INFORMES.find(i => i.id === params.informe);
  if (inf) {
    const cabecera = document.createElement('div');
    cabecera.innerHTML = h`<div class="fila cab"><div class="t"><b>${inf.titulo}</b></div><button class="btn mini" data-a="volver">Todos los informes</button></div>`.__crudo;
    cont.innerHTML = '';
    cont.appendChild(cabecera);
    delegar(cabecera, { volver: () => navegar('finanzas', { v: 'informes' }) });
    const caja = document.createElement('div');
    cont.appendChild(caja);
    return inf.render(caja, params);
  }
  const anios = aniosConDatos();
  cont.innerHTML = h`
    ${anios.length ? '' : aviso('Todavía no hay movimientos que analizar. Empieza por la pestaña Importar.')}
    ${lista(INFORMES.map(i => h`<div class="tarjeta" data-a="abrir" data-id="${i.id}"><div class="fila"><div class="t"><b>${i.titulo}</b><div class="mini">${i.resumen}</div></div><span class="pill">ver</span></div></div>`))}
    <p class="mini">Aquí irán los informes que vengan: comparación entre años, presupuesto frente a real, evolución de un concepto y gastos recurrentes detectados solos.</p>`;
  delegar(cont, { abrir: el => navegar('finanzas', { v: 'informes', informe: el.dataset.id, anio: anios[0] || hoyISO().slice(0, 4) }) });
}
