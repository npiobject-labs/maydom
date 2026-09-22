// Finanzas: tres pestañas con oficios distintos —los movimientos del mes, el módulo de carga y los
// informes— más los recurrentes. Separarlas es lo que deja sitio para que los informes crezcan sin
// que la pantalla de movimientos se llene de botones que no son de ahí.
import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, mesISO, fechaCorta, mesNombre, euros, pedir, toast, aviso, navegar } from '../nucleo.js';
import { CONCEPTOS } from '../datos/semillas.js';
import { consultar, conLLM, textoAConsejos } from '../llm.js';
import { balanceMes, adivinar } from './finanzas/calculos.js';
import * as importar from './finanzas/importar.js';
import * as informes from './finanzas/informes.js';

// reglas.js y menu.js consultan los balances desde fuera de la sección.
export { balanceMes, balanceAnio, adivinar } from './finanzas/calculos.js';

const campos = [
  { n: 'fecha', l: 'Fecha', t: 'date', req: true }, { n: 'descripcion', l: 'Descripción', req: true },
  { n: 'importe', l: 'Importe (negativo = gasto)', t: 'number', step: 0.01, req: true }, { n: 'concepto', l: 'Concepto', t: 'select', o: CONCEPTOS },
];
const camposRec = [{ n: 'descripcion', l: 'Servicio', req: true }, { n: 'importe', l: 'Importe mensual (negativo = gasto)', t: 'number', step: 0.01, req: true }, { n: 'concepto', l: 'Concepto', t: 'select', o: CONCEPTOS, v: 'servicios web' }, { n: 'dia', l: 'Día del mes', t: 'number', v: 1, min: 1, max: 28 }];

const PESTANAS = [
  { v: 'movimientos', l: 'Movimientos' },
  { v: 'importar', l: 'Importar' },
  { v: 'informes', l: 'Informes' },
  { v: 'recurrentes', l: 'Recurrentes' },
];

function render(cont, params) {
  // `vista=anio` era la ruta del informe antes de que hubiera pestañas; los enlaces guardados y el
  // botón atrás del navegador siguen trayéndola.
  const v = params.vista === 'anio' ? 'informes' : (PESTANAS.some(p => p.v === params.v) ? params.v : 'movimientos');
  if (params.vista === 'anio') params = { ...params, informe: 'anual' };
  cont.innerHTML = h`<div class="pestanas">${lista(PESTANAS.map(p => {
    const n = { movimientos: estado.movimientos.length, recurrentes: estado.recurrentes.length }[p.v];
    return h`<button class="${p.v === v ? 'sel' : ''}" data-a="pestana" data-v="${p.v}">${p.l}${n ? crudo(`<i class="n">${n}</i>`) : ''}</button>`;
  }))}</div><div id="fin-cuerpo"></div>`;
  delegar(cont, { pestana: el => navegar('finanzas', el.dataset.v === 'movimientos' ? { v: 'movimientos', mes: params.mes || mesISO(hoyISO()) } : { v: el.dataset.v }) });
  const cuerpo = cont.querySelector('#fin-cuerpo');
  if (v === 'importar') return importar.render(cuerpo);
  if (v === 'informes') return informes.render(cuerpo, params);
  if (v === 'recurrentes') return renderRecurrentes(cuerpo);
  return renderMovimientos(cuerpo, params);
}

function renderMovimientos(cont, params) {
  const mes = params.mes || mesISO(hoyISO());
  const b = balanceMes(mes);
  const [y, m] = mes.split('-').map(Number);
  const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`, next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
  const movs = estado.movimientos.filter(x => mesISO(x.fecha) === mes).sort((a, c) => c.fecha.localeCompare(a.fecha));
  const recAplicadas = estado.recurrentes.filter(r => estado.movimientos.some(x => x.recurrenteId === r.id && mesISO(x.fecha) === mes)).length;
  cont.innerHTML = h`
    <div class="fila cab"><button class="btn" data-a="mes" data-m="${prev}">‹</button><div class="t centro"><b>${mesNombre(mes)}</b></div><button class="btn" data-a="mes" data-m="${next}">›</button></div>
    <div class="tarjeta"><div class="grande ${b.neto >= 0 ? 'pos' : 'neg'}">${euros(b.neto)}</div><div class="mini">ingresos ${euros(b.ing)} · gastos ${euros(b.gas)} · ${b.n} ${b.n === 1 ? 'movimiento' : 'movimientos'}</div>
      ${Object.keys(b.por).length ? crudo('<table class="tabla">' + Object.entries(b.por).sort((x, z) => z[1] - x[1]).map(([c, v]) => h`<tr><td>${c}</td><td class="n">${euros(v)}</td><td style="width:40%"><div class="barra"><i style="width:${Math.round(v / b.gas * 100)}%"></i></div></td></tr>`).join('') + '</table>') : ''}</div>
    <div class="acciones"><button class="btn p" data-a="nuevo">+ Movimiento</button>${estado.recurrentes.length ? h`<button class="btn" data-a="aplicarRec">Aplicar recurrentes (${recAplicadas}/${estado.recurrentes.length})</button>` : crudo('')}${b.n ? crudo('<button class="btn" data-a="analizarLLM">Recomendaciones con LLM</button>') : ''}</div>
    ${movs.length ? crudo('<table class="tabla">' + movs.slice(0, 60).map(x => h`<tr data-a="editar" data-id="${x.id}"><td class="mini">${fechaCorta(x.fecha)}</td><td>${x.descripcion}<div class="mini">${x.concepto}</div></td><td class="n ${x.importe >= 0 ? 'pos' : 'neg'}">${euros(x.importe)}</td></tr>`).join('') + '</table>') : aviso('Sin movimientos en ' + mesNombre(mes) + '. Cambia de mes con las flechas, carga el extracto del banco desde la pestaña Importar o añade uno a mano.')}
    ${movs.length > 60 ? h`<p class="mini">Se enseñan los 60 primeros de ${movs.length}.</p>` : ''}`;
  delegar(cont, {
    mes: el => navegar('finanzas', { v: 'movimientos', mes: el.dataset.m }),
    analizarLLM: el => conLLM(el, async () => {
      const bp = balanceMes(prev);
      const j = await consultar({ operacion: 'finanzas', tarea: `Analiza las finanzas de ${mesNombre(mes)}: ingresos ${euros(b.ing)}, gastos ${euros(b.gas)}, por concepto ${Object.entries(b.por).map(([k, v]) => k + ' ' + euros(v)).join(', ')}; mes anterior gastos ${euros(bp.gas)} (${Object.entries(bp.por).map(([k, v]) => k + ' ' + euros(v)).join(', ') || 'sin datos'}); recurrentes: ${estado.recurrentes.map(r => r.descripcion + ' ' + euros(r.importe)).join(', ') || 'ninguno'}. Da 3 recomendaciones concretas y accionables, cada una en una línea que empiece por "- ". Solo recomendar, nunca ejecutar.` });
      toast(textoAConsejos(j.respuesta, 'finanzas') + ' recomendaciones en Consejos'); navegar('mayordomo');
    }),
    nuevo: async () => { const v = await pedir('Movimiento', campos, { fecha: hoyISO(), concepto: 'otros' }); if (v) { estado.movimientos.push({ id: uid(), ...v }); guardar(); } },
    editar: async el => { const x = estado.movimientos.find(z => z.id === el.dataset.id); const v = await pedir('Editar', campos, x, { extra: 'Borrar' }); if (!v) return; if (v.__extra) estado.movimientos = estado.movimientos.filter(z => z.id !== x.id); else { if (v.concepto !== x.concepto) v.conceptoManual = true; Object.assign(x, v); } guardar(); },
    aplicarRec: () => { let n = 0; for (const r of estado.recurrentes) { if (estado.movimientos.some(x => x.recurrenteId === r.id && mesISO(x.fecha) === mes)) continue; estado.movimientos.push({ id: uid(), fecha: `${mes}-${String(r.dia || 1).padStart(2, '0')}`, descripcion: r.descripcion, importe: r.importe, concepto: r.concepto, recurrenteId: r.id }); n++; } guardar(); toast(n + ' aplicados'); },
  });
}

function renderRecurrentes(cont) {
  const total = estado.recurrentes.reduce((s, r) => s + Number(r.importe || 0), 0);
  cont.innerHTML = h`
    ${estado.recurrentes.length ? h`<div class="tarjeta"><div class="grande ${total >= 0 ? 'pos' : 'neg'}">${euros(total)}</div><div class="mini">al mes entre ${estado.recurrentes.length} ${estado.recurrentes.length === 1 ? 'servicio' : 'servicios'} · ${euros(total * 12)} al año</div></div>` : ''}
    ${estado.recurrentes.length ? lista(estado.recurrentes.map(r => h`<div class="tarjeta fila" data-a="editarRec" data-id="${r.id}"><div class="t"><b>${r.descripcion}</b><div class="mini">${r.concepto} · día ${r.dia}</div></div><b class="${r.importe >= 0 ? 'pos' : 'neg'}">${euros(r.importe)}/mes</b></div>`))
      : aviso('Servidor, OpenRouter, dominios, suscripciones… Lo que se paga todos los meses se apunta aquí una vez y se aplica al mes con un botón desde Movimientos.')}
    <div class="acciones"><button class="btn p" data-a="nuevoRec">+ Recurrente</button></div>`;
  delegar(cont, {
    nuevoRec: async () => { const v = await pedir('Recurrente', camposRec); if (v) { estado.recurrentes.push({ id: uid(), ...v }); guardar(); } },
    editarRec: async el => { const r = estado.recurrentes.find(z => z.id === el.dataset.id); const v = await pedir('Editar recurrente', camposRec, r, { extra: 'Borrar' }); if (!v) return; if (v.__extra) estado.recurrentes = estado.recurrentes.filter(z => z.id !== r.id); else Object.assign(r, v); guardar(); },
  });
}

export default { id: 'finanzas', titulo: 'Finanzas', grupo: 'Vida', icono: '€', render };
