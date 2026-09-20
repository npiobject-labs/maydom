import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, fechaCorta, mesISO, euros, duracionTexto, pedir, confirmar, toast, aviso, navegar, sumarDias, diaSemana } from '../nucleo.js';
import { TIPOS_OCIO, ocioEjemplos } from '../datos/semillas.js';
import { crearEvento } from '../agenda.js';

const campos = [
  { n: 'titulo', l: 'Actividad', req: true }, { n: 'tipo', l: 'Tipo', t: 'select', o: TIPOS_OCIO },
  { n: 'fija', l: 'Actividad fija (ya la hago regularmente)', t: 'check' },
  { n: 'periodicidad', l: 'Periodicidad', t: 'select', o: [{ v: 'puntual', l: 'Puntual' }, { v: 'semanal', l: 'Semanal' }, { v: 'quincenal', l: 'Quincenal' }, { v: 'mensual', l: 'Mensual' }], v: 'puntual' },
  { n: 'diaSemana', l: 'Día de la semana (fijas semanales)', t: 'select', o: [{ v: '', l: '—' }, { v: 1, l: 'lunes' }, { v: 2, l: 'martes' }, { v: 3, l: 'miércoles' }, { v: 4, l: 'jueves' }, { v: 5, l: 'viernes' }, { v: 6, l: 'sábado' }, { v: 0, l: 'domingo' }] },
  { n: 'fecha', l: 'Fecha (puntuales)', t: 'date' }, { n: 'hora', l: 'Hora', t: 'time' }, { n: 'dur', l: 'Duración (min)', t: 'number', v: 120, step: 15 },
  { n: 'coste', l: 'Coste (€)', t: 'number', v: 0, min: 0, step: 0.5 }, { n: 'lugar', l: 'Lugar', v: 'Madrid' }, { n: 'info', l: 'Enlace con información' }, { n: 'nota', l: 'Nota' },
];
export function gastoOcioMes(mes = mesISO(hoyISO())) { return estado.ocio.filter(o => o.estado === 'aceptada' && o.fecha && mesISO(o.fecha) === mes).reduce((s, o) => s + Number(o.coste || 0), 0) + estado.movimientos.filter(m => m.concepto === 'ocio' && mesISO(m.fecha) === mes && m.importe < 0).reduce((s, m) => s - m.importe, 0); }
export function ocioMes(mes = mesISO(hoyISO())) { return estado.ocio.filter(o => o.estado === 'aceptada' && o.fecha && mesISO(o.fecha) === mes).length; }
function render(cont) {
  const p = estado.preferencias, mes = mesISO(hoyISO());
  const fijas = estado.ocio.filter(o => o.fija), propuestas = estado.ocio.filter(o => !o.fija && o.estado === 'propuesta'), aceptadas = estado.ocio.filter(o => !o.fija && o.estado === 'aceptada' && o.fecha >= hoyISO()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const gasto = gastoOcioMes(mes), n = ocioMes(mes);
  const tarjeta = o => h`<div class="tarjeta"><div class="fila"><div class="t" data-a="editar" data-id="${o.id}"><b>${o.titulo}</b> <span class="pill g">${o.tipo}</span>
      <div class="mini">${o.fija ? o.periodicidad + (o.diaSemana !== '' && o.diaSemana != null ? ' · ' + ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][o.diaSemana] : '') : (o.fecha ? fechaCorta(o.fecha) : 'sin fecha')}${o.hora ? ' ' + o.hora : ''} · ${duracionTexto(o.dur)} · ${euros(o.coste || 0)}${o.lugar ? ' · ' + o.lugar : ''}</div>
      ${o.info ? crudo(`<a class="mini" href="${o.info}" target="_blank" rel="noopener">información ↗</a>`) : ''}</div>
      ${o.fija ? crudo(`<button class="btn mini" data-a="planFija" data-id="${o.id}">Semana al calendario</button>`) : o.estado === 'propuesta' ? crudo(`<div class="acciones" style="margin:0;flex-direction:column"><button class="btn p mini" data-a="aceptar" data-id="${o.id}">Aceptar</button><button class="btn mini" data-a="rechazar" data-id="${o.id}">No</button></div>`) : crudo('<span class="pill ok">en calendario</span>')}</div></div>`;
  cont.innerHTML = h`
    <div class="tarjeta"><div class="fila"><div class="t"><b>${mes}: ${n} actividad${n === 1 ? '' : 'es'} de ${p.ocioPorMes} deseadas</b><div class="mini">gasto ${euros(gasto)} de ${euros(p.presupuestoOcio || 0)} · tipos: ${(p.tiposOcio || []).join(', ') || 'sin preferencia'}</div>
      <div class="barra"><i class="${gasto > (p.presupuestoOcio || 0) ? 'w' : ''}" style="width:${Math.min(100, p.presupuestoOcio ? gasto / p.presupuestoOcio * 100 : 0)}%"></i></div></div></div></div>
    <h3>Propuestas</h3>
    ${propuestas.length ? lista(propuestas.map(tarjeta)) : aviso('Sin propuestas. Pide ideas o añade algo que hayas visto.')}
    <div class="acciones"><button class="btn p" data-a="nueva">+ Actividad</button><button class="btn" data-a="ideas">Ideas según preferencias</button><button class="btn" data-a="buscar">Buscar en agendas</button></div>
    <h3>Próximas aceptadas</h3>${aceptadas.length ? lista(aceptadas.map(tarjeta)) : aviso('Nada aceptado todavía.')}
    <h3>Fijas</h3>${fijas.length ? lista(fijas.map(tarjeta)) : aviso('Las actividades que ya haces regularmente (un meetup, una clase) van aquí y se planifican de golpe cada semana.')}
    <p class="mini">Al aceptar una propuesta que choca con otra cosa del calendario, se pregunta qué se sustituye. La agenda real de Madrid es deuda (D7): las ideas salen del catálogo y de lo que apuntes.</p>`;
  delegar(cont, {
    nueva: async () => { const v = await pedir('Nueva actividad', campos, { tipo: (p.tiposOcio || [])[0] || 'cultura' }); if (v) { estado.ocio.push({ id: uid(), estado: v.fija ? 'fija' : 'propuesta', ...v }); guardar(); } },
    editar: async el => { const o = estado.ocio.find(x => x.id === el.dataset.id); const v = await pedir('Editar', campos, o, { extra: 'Borrar' }); if (!v) return; if (v.__extra) { if (await confirmar('¿Borrar?')) estado.ocio = estado.ocio.filter(x => x.id !== o.id); } else Object.assign(o, v); guardar(); },
    ideas: () => {
      const tipos = p.tiposOcio || []; let nuevas = 0;
      for (const e of ocioEjemplos) { if ((tipos.length && !tipos.includes(e.tipo)) || estado.ocio.some(o => o.titulo === e.titulo)) continue; estado.ocio.push({ id: uid(), estado: 'propuesta', fija: false, periodicidad: 'puntual', fecha: '', hora: '18:00', ...e }); nuevas++; }
      guardar(); toast(nuevas ? nuevas + ' ideas añadidas' : 'No hay ideas nuevas para esos tipos; cambia los tipos en Preferencias');
    },
    buscar: () => navegar('buscador', { cat: 'ocio', q: (p.tiposOcio || [])[0] || 'madrid agenda' }),
    aceptar: async el => {
      const o = estado.ocio.find(x => x.id === el.dataset.id);
      if (!o.fecha) { const v = await pedir('¿Cuándo?', [{ n: 'fecha', l: 'Fecha', t: 'date', v: hoyISO(), req: true }, { n: 'hora', l: 'Hora', t: 'time', v: o.hora || '18:00' }]); if (!v) return; Object.assign(o, v); }
      if (n >= p.ocioPorMes && !(await confirmar(`Ya llevas ${n} actividades este mes (querías ${p.ocioPorMes}). ¿Aceptar igualmente?`))) return;
      if (gasto + Number(o.coste || 0) > (p.presupuestoOcio || Infinity) && !(await confirmar(`Con esta actividad el gasto de ocio sería ${euros(gasto + Number(o.coste))} (presupuesto ${euros(p.presupuestoOcio)}). ¿Seguir?`))) return;
      const ev = await crearEvento({ titulo: 'Ocio: ' + o.titulo, fecha: o.fecha, hora: o.hora, dur: o.dur || 120, seccion: 'ocio', ref: o.id, nota: o.lugar });
      if (ev) { o.estado = 'aceptada'; guardar(); toast('En el calendario'); }
    },
    rechazar: el => { const o = estado.ocio.find(x => x.id === el.dataset.id); o.estado = 'rechazada'; estado.memoria.push({ id: uid(), fecha: hoyISO(), tipo: 'ocio', texto: 'Rechazado: ' + o.titulo }); guardar(); },
    planFija: async el => {
      const o = estado.ocio.find(x => x.id === el.dataset.id); if (o.diaSemana === '' || o.diaSemana == null) return toast('Ponle día de la semana');
      const d = Number(o.diaSemana); let f = hoyISO(); while (diaSemana(f) !== d) f = sumarDias(f, 1);
      const ev = await crearEvento({ titulo: 'Ocio: ' + o.titulo, fecha: f, hora: o.hora || '19:00', dur: o.dur || 120, seccion: 'ocio', ref: o.id, nota: o.lugar }); if (ev) toast('Planificada el ' + fechaCorta(f));
    },
  });
}
export default { id: 'ocio', titulo: 'Ocio', grupo: 'Vida', icono: '♪', render };
