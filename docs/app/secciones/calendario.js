import { estado, guardar, h, lista, crudo, delegar, hoyISO, sumarDias, fechaLarga, fechaCorta, diaSemana, duracionTexto, navegar, seccion } from '../nucleo.js';
import { eventosDe, cargaDia, crearEvento, borrarEvento, formularioEvento } from '../agenda.js';

const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export function tarjetaDia(fecha, opciones = {}) {
  const evs = eventosDe(fecha);
  if (!evs.length) return `<div class="tarjeta mini">Nada planificado.</div>`;
  return `<div class="tarjeta dia">${evs.map(e => h`<div class="hh">${e.hora || '—'}</div>
    <div class="ev s-${e.seccion} ${e.hecho ? 'hecho' : ''}" data-a="editar" data-id="${e.id}">
      <span>${e.titulo}</span> <small>${e.dur ? duracionTexto(e.dur) : ''}</small>
      ${opciones.check ? crudo(`<button class="chk" data-a="hecho" data-id="${e.id}" title="Hecho">${e.hecho ? '✓' : '○'}</button>`) : ''}
    </div>`).join('')}</div>`;
}
export function barraCarga(fecha) {
  const carga = cargaDia(fecha), max = Number(estado.preferencias.cargaMax) || 6, pct = Math.min(100, carga / max * 100);
  const clase = carga > max ? 'w' : '';
  return h`<div class="fila"><div class="t"><b>Carga</b> <span class="mini">${carga.toFixed(1)} h de ${max} h</span></div>
    <span class="pill ${carga > max ? 'w' : 'ok'}">${carga > max ? 'sobrecarga' : carga > max * 0.8 ? 'al límite' : 'holgura'}</span></div>
    <div class="barra"><i class="${clase}" style="width:${pct}%"></i></div>`;
}

function render(cont, params) {
  const fecha = params.fecha || hoyISO();
  const vista = params.vista || 'dia';
  const lunes = sumarDias(fecha, -((diaSemana(fecha) + 6) % 7));
  const semana = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  cont.innerHTML = h`
    <div class="fila cab"><button class="btn" data-a="ir" data-f="${sumarDias(fecha, vista === 'dia' ? -1 : -7)}">‹</button>
      <div class="t centro"><b>${fechaLarga(fecha)}</b>${fecha === hoyISO() ? '' : crudo(' <button class="btn mini" data-a="ir" data-f="' + hoyISO() + '">hoy</button>')}</div>
      <button class="btn" data-a="ir" data-f="${sumarDias(fecha, vista === 'dia' ? 1 : 7)}">›</button></div>
    <div class="semana">${lista(semana.map(d => h`<div class="${d === fecha ? 'sel' : ''} ${d === hoyISO() ? 'hoy' : ''}" data-a="ir" data-f="${d}">${LETRAS[diaSemana(d)]}<b>${d.slice(8)}</b><i>${eventosDe(d).length ? '•' : ''}</i></div>`))}</div>
    ${vista === 'dia' ? crudo(`<div class="tarjeta">${barraCarga(fecha)}</div>` + tarjetaDia(fecha, { check: true })) : crudo(semana.map(d => `<h3>${fechaLarga(d)} <span class="mini">${cargaDia(d).toFixed(1)} h</span></h3>${tarjetaDia(d, { check: true })}`).join(''))}
    <div class="acciones"><button class="btn p" data-a="nuevo">+ Evento</button>
      <button class="btn" data-a="vista" data-v="${vista === 'dia' ? 'semana' : 'dia'}">${vista === 'dia' ? 'Ver semana' : 'Ver día'}</button>
      <button class="btn" data-a="plantilla">Rellenar el día</button></div>
    <p class="mini">Regla: no sobrecargar. El límite diario se cambia en Preferencias. Al añadir algo que choca, se pregunta qué se sustituye.</p>`;
  delegar(cont, {
    ir: el => navegar('calendario', { fecha: el.dataset.f, vista }),
    vista: el => navegar('calendario', { fecha, vista: el.dataset.v }),
    nuevo: async () => { const v = await formularioEvento({ fecha }); if (v) await crearEvento(v); },
    editar: async el => {
      const ev = estado.eventos.find(e => e.id === el.dataset.id); if (!ev) return;
      const v = await formularioEvento(ev); if (!v) return;
      if (v.__extra) { borrarEvento(ev.id); return; }
      Object.assign(ev, v); guardar();
    },
    hecho: (el, e) => { e.stopPropagation(); const ev = estado.eventos.find(x => x.id === el.dataset.id); if (ev) { ev.hecho = !ev.hecho; guardar(); } },
    plantilla: async () => {
      // Propuesta mínima del día según preferencias: comidas, una tabla si toca, meditación antes de acostarse.
      const p = estado.preferencias; let n = 0;
      const base = [
        { titulo: 'Desayuno', hora: '08:30', dur: 20, seccion: 'alimentacion' },
        { titulo: 'Comida', hora: '14:00', dur: 45, seccion: 'alimentacion' },
        { titulo: 'Cena ligera', hora: '20:30', dur: 30, seccion: 'alimentacion' },
        { titulo: 'Meditación 4-6 y acostarse', hora: p.horaAcostarse || '23:00', dur: 5, seccion: 'meditacion', ref: 'm_46' },
      ];
      if (p.energia >= 3 && estado.tablas.length) base.push({ titulo: 'Tabla: ' + estado.tablas[0].nombre, hora: '11:00', dur: estado.tablas[0].duracion || 25, seccion: 'ejercicio', ref: estado.tablas[0].id });
      for (const b of base) if (!eventosDe(fecha).some(e => e.titulo === b.titulo)) { await crearEvento({ ...b, fecha }, { silencioso: true }); n++; }
      if (!n) { const { toast } = await import('../nucleo.js'); toast('El día ya tiene la base'); }
    },
  });
}
export default { id: 'calendario', titulo: 'Calendario', grupo: 'Agenda', icono: '▦', render };
