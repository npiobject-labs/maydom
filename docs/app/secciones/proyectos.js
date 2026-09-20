import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, fechaCorta, diasEntre, duracionTexto, pedir, confirmar, toast, aviso, navegar, avisar, minutos, hhmm } from '../nucleo.js';
import { crearEvento, primerHueco } from '../agenda.js';
import { pildoraAleatoria, registrarPildora } from './ejercicio.js';

const horasDe = id => estado.horas.filter(x => x.proyectoId === id).reduce((s, x) => s + Number(x.horas), 0);
const ultimaHora = id => estado.horas.filter(x => x.proyectoId === id).map(x => x.fecha).sort().at(-1) || null;
export function rezagados() { const n = Number(estado.preferencias.rezagoDias) || 7; return estado.proyectos.filter(p => p.estado === 'activo' && (!ultimaHora(p.id) || diasEntre(ultimaHora(p.id), hoyISO()) >= n)); }
const campos = [
  { n: 'nombre', l: 'Proyecto', req: true }, { n: 'tipo', l: 'Tipo', t: 'select', o: [{ v: 'trabajo', l: 'Trabajo' }, { v: 'personal', l: 'Personal' }] },
  { n: 'estimacion', l: 'Horas estimadas', t: 'number', min: 0, step: 0.5 }, { n: 'objetivo', l: 'Fecha objetivo', t: 'date' },
  { n: 'estado', l: 'Estado', t: 'select', o: ['activo', 'pausado', 'hecho'], v: 'activo' }, { n: 'movil', l: 'Se puede hacer desde el móvil', t: 'check', v: true },
  { n: 'descripcion', l: 'Descripción', t: 'textarea', filas: 2 },
];
let reloj = null;
function render(cont) {
  clearInterval(reloj);
  const s = estado.sesionTrabajo;
  const activos = estado.proyectos.filter(p => p.estado === 'activo'), otros = estado.proyectos.filter(p => p.estado !== 'activo');
  const rez = rezagados().map(p => p.id);
  const semana = estado.horas.filter(x => diasEntre(x.fecha, hoyISO()) < 7).reduce((s, x) => s + Number(x.horas), 0);
  const tarjeta = p => { const hs = horasDe(p.id), pct = p.estimacion ? Math.min(100, Math.round(hs / p.estimacion * 100)) : null, ult = ultimaHora(p.id); return h`<div class="tarjeta">
    <div class="fila"><div class="t" data-a="editar" data-id="${p.id}"><b>${p.nombre}</b> <span class="pill g">${p.tipo}</span> ${rez.includes(p.id) ? crudo('<span class="pill w">rezagado</span>') : ''} ${p.movil ? crudo('<span class="pill">móvil</span>') : ''}
      <div class="mini">${hs} h${p.estimacion ? ' de ' + p.estimacion + ' h (' + pct + ' %)' : ''}${p.objetivo ? ' · objetivo ' + fechaCorta(p.objetivo) : ''} · ${ult ? 'última vez ' + fechaCorta(ult) : 'sin horas'}</div>
      ${pct != null ? crudo(`<div class="barra"><i class="${pct >= 100 ? 'ok' : ''}" style="width:${pct}%"></i></div>`) : ''}</div>
      ${s && s.proyectoId === p.id ? crudo(`<button class="btn p" data-a="parar">Parar</button>`) : crudo(`<button class="btn" data-a="empezar" data-id="${p.id}" ${s ? 'disabled' : ''}>Empezar</button>`)}</div>
    <div class="acciones"><button class="btn mini" data-a="horas" data-id="${p.id}">+ horas a mano</button><button class="btn mini" data-a="bloque" data-id="${p.id}">Bloque al calendario</button></div></div>`; };
  cont.innerHTML = h`
    ${s ? crudo(`<div class="tarjeta"><div class="fila"><div class="t"><b>En marcha: ${estado.proyectos.find(p => p.id === s.proyectoId)?.nombre || '?'}</b><div class="mini">desde ${new Date(s.inicio).toTimeString().slice(0, 5)} · píldora cada ${estado.preferencias.pildoraCada} min · siguiente en <span id="prox-pildora">–</span></div></div><div class="tempo" id="crono" style="font-size:1.4rem">0:00</div></div>
      <div class="acciones"><button class="btn p" data-a="parar">Parar y anotar</button><button class="btn" data-a="pildoraYa">Píldora ahora</button></div></div>`) : ''}
    <div class="tarjeta mini">Esta semana: <b>${semana} h</b> en ${estado.proyectos.length} proyectos · ${rez.length} rezagado${rez.length === 1 ? '' : 's'} (sin horas en ${estado.preferencias.rezagoDias} días).</div>
    ${activos.length ? lista(activos.map(tarjeta)) : aviso('Sin proyectos activos. Los de trabajo y los personales van en la misma lista.')}
    <div class="acciones"><button class="btn p" data-a="nuevo">+ Proyecto</button></div>
    ${otros.length ? crudo('<h3>Pausados y hechos</h3>' + otros.map(p => h`<div class="tarjeta fila" data-a="editar" data-id="${p.id}"><div class="t"><b>${p.nombre}</b> <span class="pill g">${p.estado}</span> <span class="mini">${horasDe(p.id)} h</span></div></div>`).join('')) : ''}
    <p class="mini">El trabajo es lo más sedentario: cada bloque lleva píldoras de movimiento y al parar se apuntan las horas solas.</p>`;
  if (s) {
    const cada = (Number(estado.preferencias.pildoraCada) || 60) * 60000;
    const tick = () => {
      const t = Date.now() - s.inicio, m = Math.floor(t / 60000);
      const el = cont.querySelector('#crono'); if (el) el.textContent = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
      const desde = Date.now() - (s.ultimaPildora || s.inicio), falta = Math.max(0, Math.ceil((cada - desde) / 60000));
      const pp = cont.querySelector('#prox-pildora'); if (pp) pp.textContent = falta + ' min';
      if (desde >= cada) { s.ultimaPildora = Date.now(); guardar(); const e = pildoraAleatoria(); avisar('Píldora de movimiento', e ? `${e.nombre}: ${e.series} × ${e.reps}` : 'Levántate y muévete 2 min', 'pil:' + s.ultimaPildora); }
    };
    tick(); reloj = setInterval(tick, 15000);
  }
  delegar(cont, {
    nuevo: async () => { const v = await pedir('Nuevo proyecto', campos); if (v) { estado.proyectos.push({ id: uid(), creado: hoyISO(), ...v }); guardar(); } },
    editar: async el => { const p = estado.proyectos.find(x => x.id === el.dataset.id); const v = await pedir('Editar proyecto', campos, p, { extra: 'Borrar' }); if (!v) return; if (v.__extra) { if (await confirmar('¿Borrar el proyecto y sus horas?')) { estado.proyectos = estado.proyectos.filter(x => x.id !== p.id); estado.horas = estado.horas.filter(x => x.proyectoId !== p.id); } } else Object.assign(p, v); guardar(); },
    horas: async el => { const v = await pedir('Anotar horas', [{ n: 'fecha', l: 'Fecha', t: 'date', v: hoyISO() }, { n: 'horas', l: 'Horas', t: 'number', v: 1, min: 0.25, step: 0.25, req: true }, { n: 'nota', l: 'Qué se hizo' }]); if (v) { estado.horas.push({ id: uid(), proyectoId: el.dataset.id, ...v }); guardar(); } },
    empezar: el => { estado.sesionTrabajo = { proyectoId: el.dataset.id, inicio: Date.now(), ultimaPildora: null }; guardar(); },
    parar: async () => {
      const ses = estado.sesionTrabajo; if (!ses) return;
      const horas = Math.round((Date.now() - ses.inicio) / 36e5 * 4) / 4;
      const v = await pedir('Sesión terminada', [{ n: 'horas', l: 'Horas', t: 'number', v: Math.max(0.25, horas), min: 0, step: 0.25 }, { n: 'nota', l: 'Qué se hizo' }]);
      if (!v) return;
      estado.horas.push({ id: uid(), proyectoId: ses.proyectoId, fecha: hoyISO(), horas: v.horas, nota: v.nota }); estado.sesionTrabajo = null; guardar(); toast('Horas anotadas');
    },
    pildoraYa: async () => { const e = pildoraAleatoria(); if (!e) return; const ok = await pedir('Píldora: ' + e.nombre, [], {}, { texto: `${e.series} × ${e.reps}. ${e.descripcion}`, aceptar: 'Hecha' }); if (ok) { registrarPildora(e); if (estado.sesionTrabajo) estado.sesionTrabajo.ultimaPildora = Date.now(); guardar(); } },
    bloque: async el => {
      const p = estado.proyectos.find(x => x.id === el.dataset.id);
      const v = await pedir('Bloque de trabajo: ' + p.nombre, [{ n: 'fecha', l: 'Fecha', t: 'date', v: hoyISO() }, { n: 'hora', l: 'Hora', t: 'time', v: primerHueco(hoyISO(), 120, '09:00') || '10:00' }, { n: 'dur', l: 'Duración (min)', t: 'number', v: 120, step: 15 }]);
      if (!v) return;
      const ev = await crearEvento({ titulo: 'Trabajo: ' + p.nombre, fecha: v.fecha, hora: v.hora, dur: v.dur, seccion: 'proyecto', ref: p.id, nota: `píldoras cada ${estado.preferencias.pildoraCada} min` });
      if (ev) { const cada = Number(estado.preferencias.pildoraCada) || 60; for (let t = cada; t < v.dur; t += cada) await crearEvento({ titulo: 'Píldora de movimiento', fecha: v.fecha, hora: hhmm(minutos(v.hora) + t), dur: 3, seccion: 'ejercicio', ref: 'pildora' }, { silencioso: true }); toast('Bloque y píldoras en el calendario'); }
    },
  });
}
export default { id: 'proyectos', titulo: 'Proyectos', grupo: 'Vida', icono: '▣', render };
