import { estado, guardar, h, lista, crudo, delegar, hoyISO, sumarDias, fechaLarga, duracionTexto, navegar, toast, minutos, horaActual, uid } from '../nucleo.js';
import { eventosDe, formularioEvento, crearEvento, borrarEvento } from '../agenda.js';
import { tarjetaDia, barraCarga } from './calendario.js';
import { registrarNoche, registrosOrdenados, calcular } from './sueno.js';
import { tomadoHoy, bajoStock } from './suplementos.js';
import { pildoraAleatoria, registrarPildora } from './ejercicio.js';
import { refrescarConsejos } from '../reglas.js';
import { tarjetaConsejo, accionesConsejo, consejosNuevos } from './mayordomo.js';
import { rezagados } from './proyectos.js';

function render(cont) {
  const hoy = hoyISO(), ahora = minutos(horaActual());
  if (refrescarConsejos()) guardar();
  const anoche = registrosOrdenados().find(r => r.fecha === sumarDias(hoy, -1));
  const sups = estado.suplementos.filter(s => !tomadoHoy(s)).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  const proximaSup = sups.find(s => s.hora && minutos(s.hora) >= ahora - 60) || sups[0];
  const consejos = consejosNuevos().slice(0, 3);
  const trabajo = estado.sesionTrabajo;
  const proximo = eventosDe(hoy).find(e => e.hora && !e.hecho && minutos(e.hora) >= ahora);
  const menu = estado.menus.find(m => m.fecha === hoy);
  const plato = id => estado.platos.find(p => p.id === id)?.nombre;
  const rez = rezagados();
  cont.innerHTML = h`
    <div class="tarjeta">${crudo(barraCarga(hoy))}
      ${proximo ? h`<div class="mini">Siguiente: <b>${proximo.hora} ${proximo.titulo}</b></div>` : ''}</div>
    ${crudo(tarjetaDia(hoy, { check: true }))}
    <div class="acciones"><button class="btn p" data-a="nuevo">+ Evento</button><button class="btn" data-a="cal">Calendario ›</button></div>
    <h3>Ahora</h3>
    ${trabajo ? h`<div class="tarjeta fila"><div class="t"><b>Trabajando en ${estado.proyectos.find(p => p.id === trabajo.proyectoId)?.nombre || '?'}</b><div class="mini">desde ${new Date(trabajo.inicio).toTimeString().slice(0, 5)}</div></div><button class="btn" data-a="ir" data-s="proyectos">Ver ›</button></div>` : ''}
    <div class="tarjeta fila"><div class="t"><b>Píldora de movimiento</b><div class="mini">${estado.pildoras.filter(p => p.fecha === hoy && p.hecha).length} hoy · cada ${estado.preferencias.pildoraCada} min de trabajo</div></div><button class="btn" data-a="pildora">Dame una</button></div>
    ${proximaSup ? h`<div class="tarjeta fila"><div class="t"><b>${proximaSup.nombre}</b><div class="mini">${proximaSup.dosis || ''} · ${proximaSup.hora || proximaSup.momento}${bajoStock(proximaSup) ? crudo(' · <span class="pill w">reponer</span>') : ''} · ${sups.length} pendientes</div></div><button class="btn p" data-a="tomar" data-id="${proximaSup.id}">Tomado</button></div>` : ''}
    ${menu ? h`<div class="tarjeta"><div class="mini">Menú de hoy</div><div>${['desayuno', 'comida', 'cena'].map(t => plato(menu[t])).filter(Boolean).join(' · ')}</div><div class="acciones"><button class="btn mini" data-a="ir" data-s="alimentacion">Registrar comida ›</button></div></div>` : h`<div class="tarjeta fila"><div class="t"><b>Sin menú para hoy</b></div><button class="btn" data-a="ir" data-s="alimentacion">Proponer ›</button></div>`}
    ${anoche ? h`<div class="tarjeta fila"><div class="t"><b>Anoche: ${duracionTexto(calcular(anoche).total)}</b><div class="mini">tramo largo ${duracionTexto(calcular(anoche).tramo1)} · calidad ${anoche.calidad}/5</div></div><button class="btn" data-a="ir" data-s="sueno">Sueño ›</button></div>` : h`<div class="tarjeta fila"><div class="t"><b>Sueño de anoche</b><div class="mini">sin registrar</div></div><button class="btn p" data-a="sueno">Registrar</button></div>`}
    ${rez.length ? h`<div class="tarjeta fila"><div class="t"><b>${rez.length} proyecto${rez.length > 1 ? 's' : ''} rezagado${rez.length > 1 ? 's' : ''}</b><div class="mini">${rez.map(p => p.nombre).join(', ')}</div></div><button class="btn" data-a="ir" data-s="proyectos">Ver ›</button></div>` : ''}
    <h3>Mayordomo ${consejosNuevos().length > 3 ? crudo(`<span class="mini">(${consejosNuevos().length} nuevos)</span>`) : ''}</h3>
    ${consejos.length ? lista(consejos.map(c => tarjetaConsejo(c, true))) : crudo('<div class="tarjeta mini">Nada nuevo que aconsejar ahora mismo.</div>')}
    <div class="acciones"><button class="btn" data-a="ir" data-s="mayordomo">Todos los consejos ›</button><button class="btn" data-a="nota">+ Nota rápida</button></div>`;
  delegar(cont, accionesConsejo({
    nuevo: async () => { const v = await formularioEvento({ fecha: hoy }); if (v) await crearEvento(v); },
    editar: async el => { const ev = estado.eventos.find(e => e.id === el.dataset.id); if (!ev) return; const v = await formularioEvento(ev); if (!v) return; if (v.__extra) { borrarEvento(ev.id); return; } Object.assign(ev, v); guardar(); },
    hecho: (el, e) => { e.stopPropagation(); const ev = estado.eventos.find(x => x.id === el.dataset.id); if (ev) { ev.hecho = !ev.hecho; guardar(); } },
    cal: () => navegar('calendario'),
    pildora: async () => { const e = pildoraAleatoria(); if (!e) return toast('Carga el catálogo de ejercicios en Ajustes'); const { pedir } = await import('../nucleo.js'); const ok = await pedir('Píldora: ' + e.nombre, [], {}, { texto: `${e.series} × ${e.reps}. ${e.descripcion}`, aceptar: 'Hecha' }); if (ok) { registrarPildora(e); toast('Anotada'); } },
    tomar: el => { const s = estado.suplementos.find(x => x.id === el.dataset.id); estado.tomas.push({ id: uid(), suplementoId: s.id, fecha: hoy, hora: horaActual() }); if (s.stock != null) s.stock = Math.max(0, Number(s.stock) - 1); guardar(); },
    sueno: async () => { if (await registrarNoche()) toast('Noche registrada'); },
    nota: async () => { const { pedir } = await import('../nucleo.js'); const v = await pedir('Nota rápida', [{ n: 'texto', l: 'Texto', t: 'textarea', req: true }, { n: 'etiquetas', l: 'Etiquetas', t: 'tags' }]); if (v) { estado.notas.push({ id: uid(), fecha: hoy, tipo: 'nota', ...v }); guardar(); toast('Nota guardada'); } },
  }));
}
export default { id: 'hoy', titulo: 'Hoy', grupo: null, icono: '☀', render };
