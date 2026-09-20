// Lógica compartida del calendario: carga del día, conflictos y alta de eventos.
import { estado, guardar, uid, minutos, hhmm, pedir, toast, duracionTexto, hoyISO } from './nucleo.js';

export const SECCIONES_EVENTO = [
  { v: 'otro', l: 'Otro' }, { v: 'ejercicio', l: 'Ejercicio' }, { v: 'alimentacion', l: 'Comida' }, { v: 'meditacion', l: 'Meditación' },
  { v: 'proyecto', l: 'Proyecto / trabajo' }, { v: 'ocio', l: 'Ocio' }, { v: 'suplemento', l: 'Suplemento' }, { v: 'sueno', l: 'Sueño' }, { v: 'aviso', l: 'Aviso' },
];
export const eventosDe = fecha => estado.eventos.filter(e => e.fecha === fecha).sort((a, b) => minutos(a.hora) - minutos(b.hora));
export const cargaDia = fecha => eventosDe(fecha).reduce((s, e) => s + (Number(e.dur) || 0), 0) / 60;
export function conflictos(ev, ignorarId = null) {
  if (!ev.hora) return [];
  const a1 = minutos(ev.hora), a2 = a1 + (Number(ev.dur) || 30);
  return eventosDe(ev.fecha).filter(o => o.id !== ignorarId && o.hora && (() => { const b1 = minutos(o.hora), b2 = b1 + (Number(o.dur) || 30); return a1 < b2 && b1 < a2; })());
}
export function primerHueco(fecha, dur, desde = '08:00', hasta = '22:00') {
  const evs = eventosDe(fecha).filter(e => e.hora);
  let t = minutos(desde);
  while (t + dur <= minutos(hasta)) {
    const choca = evs.find(e => { const b1 = minutos(e.hora), b2 = b1 + (Number(e.dur) || 30); return t < b2 && b1 < t + dur; });
    if (!choca) return hhmm(t);
    t = minutos(choca.hora) + (Number(choca.dur) || 30);
  }
  return null;
}
// Añade un evento respetando la regla de carga y preguntando por conflictos (sustituir / mantener ambos / cancelar).
export async function crearEvento(datos, opciones = {}) {
  const ev = { id: uid(), titulo: '', fecha: hoyISO(), hora: '', dur: 30, seccion: 'otro', ref: null, hecho: false, nota: '', ...datos };
  const ch = conflictos(ev);
  if (ch.length && !opciones.silencioso) {
    const r = await pedir('Choca con otra actividad', [], {}, {
      texto: `"${ev.titulo}" (${ev.hora}, ${duracionTexto(ev.dur)}) coincide con: ${ch.map(c => `${c.titulo} ${c.hora}`).join(', ')}. ¿Sustituir la otra o mantener las dos?`,
      aceptar: 'Mantener las dos', extra: 'Sustituir',
    });
    if (!r) return null;
    if (r.__extra) for (const c of ch) estado.eventos = estado.eventos.filter(e => e.id !== c.id);
  }
  estado.eventos.push(ev);
  const carga = cargaDia(ev.fecha), max = Number(estado.preferencias.cargaMax) || 6;
  if (carga > max) toast(`Ojo: ${ev.fecha} queda con ${carga.toFixed(1)} h planificadas (límite ${max} h)`, 5000);
  guardar();
  return ev;
}
export function borrarEvento(id) { estado.eventos = estado.eventos.filter(e => e.id !== id); guardar(); }
export function formularioEvento(valores = {}) {
  return pedir(valores.id ? 'Editar evento' : 'Nuevo evento', [
    { n: 'titulo', l: 'Título', req: true },
    { n: 'fecha', l: 'Fecha', t: 'date', v: hoyISO(), req: true },
    { n: 'hora', l: 'Hora', t: 'time' },
    { n: 'dur', l: 'Duración (min)', t: 'number', v: 30, min: 0, step: 5 },
    { n: 'seccion', l: 'Sección', t: 'select', o: SECCIONES_EVENTO },
    { n: 'nota', l: 'Nota', t: 'textarea', filas: 2 },
  ], valores, valores.id ? { extra: 'Borrar' } : {});
}
