// Motor de reglas del mayordomo: consejos a partir del estado, sin red. Cada consejo lleva una clave para no repetirse.
import { estado, hoyISO, sumarDias, diasEntre, mesISO, duracionTexto, euros } from './nucleo.js';
import { cargaDia, eventosDe } from './agenda.js';
import { calcular, registrosOrdenados, mediaSueno } from './secciones/sueno.js';
import { rezagados } from './secciones/proyectos.js';
import { bajoStock, tomadoHoy } from './secciones/suplementos.js';
import { gastoOcioMes, ocioMes } from './secciones/ocio.js';
import { balanceMes } from './secciones/finanzas.js';

export function generarConsejos() {
  const p = estado.preferencias, hoy = hoyISO(), out = [];
  const c = (clave, texto, seccion, accion) => out.push({ clave, texto, seccion, accion });
  // Sueño: donde va el acento.
  const media = mediaSueno(7), obj = (Number(p.objetivoSueno) || 7) * 60;
  const rs = registrosOrdenados();
  if (!rs.length) c('sueno:sin-registros', 'Sin registros de sueño. Un registro por la mañana (acostado, despertar, levantado) es lo que me permite ayudarte con lo que peor funciona.', 'sueno', 'sueno');
  else {
    if (rs[0].fecha < sumarDias(hoy, -2)) c('sueno:atrasado:' + hoy, 'Llevas más de dos noches sin registrar el sueño. ¿Anoche?', 'sueno', 'sueno');
    if (media != null && media < obj * 0.85) c('sueno:media-baja:' + hoy.slice(0, 7), `Media de ${duracionTexto(media)} en la última semana, lejos de las ${p.objetivoSueno} h. Propongo dos cosas concretas esta semana: cenar antes de las 21:00 y meditación 4-6 al acostarte (${p.horaAcostarse}).`, 'sueno', 'meditacion');
    const conDespertar = rs.slice(0, 7).filter(r => r.despertar);
    if (conDespertar.length >= 3 && conDespertar.every(r => calcular(r).despierto >= 30)) c('sueno:despertar-largo:' + hoy.slice(0, 7), 'En los despertares nocturnos pasas 30 min o más despierto. Regla: sin mirar la hora, guion "Volver a dormir"; si a los 20 min no, levantarse a luz tenue.', 'sueno', 'meditacion');
    const ultimo = calcular(rs[0]);
    if (ultimo.tramo1 < 240 && rs[0].fecha >= sumarDias(hoy, -1)) c('sueno:tramo-corto:' + rs[0].fecha, `Anoche el primer tramo fue de ${duracionTexto(ultimo.tramo1)}. Hoy conviene bajar la carga: no planifiques más de ${Math.max(2, (p.cargaMax || 6) - 2)} h y nada de ejercicio intenso después de las 19:00.`, 'sueno', 'calendario');
  }
  // Calendario: no sobrecargar.
  for (let i = 0; i < 3; i++) { const f = sumarDias(hoy, i), carga = cargaDia(f); if (carga > (Number(p.cargaMax) || 6)) c('carga:' + f, `El ${f === hoy ? 'día de hoy' : f} tiene ${carga.toFixed(1)} h planificadas y tu límite es ${p.cargaMax} h. ¿Quitamos o movemos algo?`, 'calendario', 'calendario'); }
  if (!eventosDe(hoy).length && new Date().getHours() < 12) c('vacio:' + hoy, 'Hoy no hay nada planificado. En Calendario, "Rellenar el día" pone la base (comidas, tabla si hay energía, meditación al acostarse).', 'calendario', 'calendario');
  // Preferencias caducadas según horizonte.
  const dias = { dias: 3, semana: 7, mes: 30 }[p.horizonte] || 7;
  if (p.actualizado && diasEntre(p.actualizado, hoy) > dias) c('pref:caducas:' + hoy.slice(0, 7), `Las preferencias son del ${p.actualizado} y su horizonte era "${p.horizonte}". Tu carácter cambia: ¿qué te apetece en los próximos días?`, 'preferencias', 'preferencias');
  if (!p.actualizado) c('pref:sin', 'Sin preferencias ajustadas. Con energía, foco y tipos de ejercicio/ocio puedo afinar todo lo demás.', 'preferencias', 'preferencias');
  // Ejercicio.
  const ult = estado.sesionesEjercicio.map(s => s.fecha).sort().at(-1);
  if (estado.tablas.length && (!ult || diasEntre(ult, hoy) >= 4) && (p.energia || 3) >= 3) c('ej:sin-sesion:' + hoy.slice(0, 7) + Math.floor(new Date(hoy).getDate() / 4), `Sin sesión de ejercicio desde ${ult ? 'hace ' + diasEntre(ult, hoy) + ' días' : 'que empezaste'}. Una tabla corta (${estado.tablas[0].nombre}) mañana a media mañana, con tu energía en ${p.energia}.`, 'ejercicio', 'ejercicio');
  const ses = estado.sesionesEjercicio.slice(-3);
  if (ses.length === 3 && ses.every(s => s.items.filter(i => !i.hecho).length > s.items.length / 2)) c('ej:tablas-largas:' + hoy.slice(0, 7), 'En las tres últimas sesiones dejaste más de la mitad sin hacer. Mejor tablas de 3–4 ejercicios y completas que de 6 a medias.', 'ejercicio', 'ejercicio');
  const pildHoy = estado.pildoras.filter(x => x.fecha === hoy && x.hecha).length, horasHoy = estado.horas.filter(x => x.fecha === hoy).reduce((s, x) => s + Number(x.horas), 0);
  if (horasHoy >= 3 && pildHoy === 0) c('pildoras:' + hoy, `Hoy llevas ${horasHoy} h de trabajo y ninguna píldora de movimiento. Levántate ahora dos minutos.`, 'ejercicio', 'proyectos');
  // Alimentación.
  const comidas = estado.comidas.slice(-12);
  if (comidas.length >= 6 && comidas.filter(x => x.segunMenu).length / comidas.length < 0.5) c('menu:desajuste:' + hoy.slice(0, 7), 'Menos de la mitad de las comidas siguen el menú. O el menú no encaja (cámbialo con tus preferencias) o mejor proponer solo la cena, que es donde más importa para dormir.', 'alimentacion', 'alimentacion');
  if (!estado.menus.some(m => m.fecha === hoy) && estado.platos.length) c('menu:hoy:' + hoy, 'No hay menú propuesto para hoy. Uno con cena ligera ayuda al primer tramo de sueño.', 'alimentacion', 'alimentacion');
  const bajos = estado.alimentos.filter(a => Number(a.stock) <= Number(a.umbral));
  if (bajos.length) c('stock:' + bajos.map(a => a.id).join(','), `Por reponer: ${bajos.map(a => a.nombre).join(', ')}. Ya están en Compra.`, 'compra', 'compra');
  // Suplementos.
  const sb = estado.suplementos.filter(bajoStock);
  if (sb.length) c('sup:bajo:' + sb.map(s => s.id).join(','), `${sb.map(s => s.nombre).join(' y ')} por debajo del 10 %. Lo he añadido a Compra con la tienda habitual.`, 'suplementos', 'compra');
  const hora = new Date().getHours();
  const pendNoche = estado.suplementos.filter(s => s.momento === 'noche' && !tomadoHoy(s));
  if (hora >= 21 && pendNoche.length) c('sup:noche:' + hoy, `Toma de la noche pendiente: ${pendNoche.map(s => s.nombre).join(', ')}.`, 'suplementos', 'suplementos');
  // Proyectos.
  for (const pr of rezagados()) c('proy:rezagado:' + pr.id + ':' + hoy.slice(0, 7), `"${pr.nombre}" lleva ${p.rezagoDias}+ días sin horas${pr.objetivo ? ' y su objetivo es el ' + pr.objetivo : ''}. ¿Un bloque de 1 h ${pr.movil ? '(vale desde el móvil) ' : ''}en el primer hueco de mañana?`, 'proyectos', 'proyectos');
  for (const pr of estado.proyectos.filter(x => x.estado === 'activo' && x.objetivo && x.estimacion)) { const hs = estado.horas.filter(x => x.proyectoId === pr.id).reduce((s, x) => s + Number(x.horas), 0), faltan = pr.estimacion - hs, dias = diasEntre(hoy, pr.objetivo); if (faltan > 0 && dias >= 0 && faltan / Math.max(1, dias) > 4) c('proy:ritmo:' + pr.id + ':' + hoy.slice(0, 7), `"${pr.nombre}": faltan ${faltan} h para ${dias} días. Son más de 4 h/día; o se recorta alcance o se mueve la fecha.`, 'proyectos', 'proyectos'); }
  // Ocio.
  const mes = mesISO(hoy), nOcio = ocioMes(mes), gastoOcio = gastoOcioMes(mes);
  const diaMes = Number(hoy.slice(8)), propuestas = estado.ocio.filter(o => o.estado === 'propuesta');
  if (diaMes >= 15 && nOcio < (p.ocioPorMes || 0) / 2) c('ocio:pocas:' + mes, `A mitad de mes llevas ${nOcio} actividades de ocio de las ${p.ocioPorMes} que querías. ${propuestas.length ? 'Hay ' + propuestas.length + ' propuestas esperando.' : 'Pide ideas en Ocio.'}`, 'ocio', 'ocio');
  if (p.presupuestoOcio && gastoOcio > p.presupuestoOcio) c('ocio:presupuesto:' + mes, `El ocio de ${mes} va en ${euros(gastoOcio)}, por encima de los ${euros(p.presupuestoOcio)}. Las próximas, mejor gratuitas (paseo, meetup).`, 'ocio', 'ocio');
  // Finanzas.
  const b = balanceMes(mes), bPrev = balanceMes(mesISO(sumarDias(hoy, -30)));
  if (b.n && b.neto < 0 && diaMes >= 20) c('fin:neto:' + mes, `${mes} va en ${euros(b.neto)}. Mayor partida: ${Object.entries(b.por).sort((x, z) => z[1] - x[1])[0]?.join(' ') || '–'}.`, 'finanzas', 'finanzas');
  for (const [con, v] of Object.entries(b.por)) if (bPrev.por[con] && v > bPrev.por[con] * 1.5 && v > 50) c('fin:sube:' + con + ':' + mes, `El gasto en ${con} este mes (${euros(v)}) supera en más de la mitad al del mes pasado (${euros(bPrev.por[con])}).`, 'finanzas', 'finanzas');
  const recSinAplicar = estado.recurrentes.filter(r => !estado.movimientos.some(x => x.recurrenteId === r.id && mesISO(x.fecha) === mes));
  if (recSinAplicar.length && diaMes >= 5) c('fin:rec:' + mes, `${recSinAplicar.length} servicios recurrentes sin aplicar a ${mes} (${recSinAplicar.map(r => r.descripcion).join(', ')}).`, 'finanzas', 'finanzas');
  return out;
}
// Añade al estado los consejos nuevos que no existan ya con la misma clave.
export function refrescarConsejos() {
  let n = 0;
  for (const c of generarConsejos()) { if (estado.consejos.some(x => x.clave === c.clave)) continue; estado.consejos.push({ id: Math.random().toString(36).slice(2, 10), fecha: hoyISO(), origen: 'reglas', estado: 'nuevo', ...c }); n++; }
  // Caducan los consejos de reglas nuevos de hace más de 7 días.
  estado.consejos = estado.consejos.filter(x => !(x.origen === 'reglas' && x.estado === 'nuevo' && diasEntre(x.fecha, hoyISO()) > 7));
  return n;
}
// Resumen compacto del estado para el LLM: nada de ids, solo lo relevante.
export function resumenParaLLM() {
  const p = estado.preferencias, hoy = hoyISO(), media = mediaSueno(7);
  const rs = registrosOrdenados()[0];
  return [
    `Fecha: ${hoy}. Preferencias (horizonte ${p.horizonte}, energía ${p.energia}/5, foco "${p.foco || '-'}"): carga máx ${p.cargaMax} h/día, píldora cada ${p.pildoraCada} min, ejercicio ${(p.tiposEjercicio || []).join('/') || '-'}, alimentación "${p.restricciones || '-'}", ocio ${(p.tiposOcio || []).join('/')} ${p.ocioPorMes}/mes ${p.presupuestoOcio} €, acostarse ${p.horaAcostarse}, objetivo sueño ${p.objetivoSueno} h. Notas: ${p.notas || '-'}`,
    `Sueño: media 7 noches ${media != null ? duracionTexto(media) : 'sin datos'}; última ${rs ? rs.fecha + ' ' + duracionTexto(calcular(rs).total) + ' (tramo1 ' + duracionTexto(calcular(rs).tramo1) + ', calidad ' + rs.calidad + ')' : 'ninguna'}.`,
    `Hoy: ${eventosDe(hoy).map(e => `${e.hora || ''} ${e.titulo}${e.hecho ? ' ✓' : ''}`).join('; ') || 'nada planificado'} (carga ${cargaDia(hoy).toFixed(1)} h). Mañana: ${eventosDe(sumarDias(hoy, 1)).map(e => e.hora + ' ' + e.titulo).join('; ') || 'nada'}.`,
    `Ejercicio: ${estado.sesionesEjercicio.length} sesiones, última ${estado.sesionesEjercicio.map(s => s.fecha).sort().at(-1) || '-'}; píldoras hoy ${estado.pildoras.filter(x => x.fecha === hoy && x.hecha).length}.`,
    `Proyectos activos: ${estado.proyectos.filter(x => x.estado === 'activo').map(x => `${x.nombre} (${x.tipo}, ${estado.horas.filter(h => h.proyectoId === x.id).reduce((s, h) => s + Number(h.horas), 0)}/${x.estimacion || '?'} h${x.objetivo ? ', objetivo ' + x.objetivo : ''})`).join('; ') || '-'}. Rezagados: ${rezagados().map(x => x.nombre).join(', ') || 'ninguno'}.`,
    `Suplementos: ${estado.suplementos.map(s => `${s.nombre} ${s.momento} ${s.hora || ''}${bajoStock(s) ? ' (reponer)' : ''}${tomadoHoy(s) ? ' ✓' : ''}`).join('; ') || '-'}.`,
    `Alimentación: menú hoy ${(estado.menus.find(m => m.fecha === hoy) ? 'sí' : 'no')}; comidas según menú últimas 12: ${estado.comidas.slice(-12).filter(x => x.segunMenu).length}/${Math.min(12, estado.comidas.length)}; stock bajo: ${estado.alimentos.filter(a => Number(a.stock) <= Number(a.umbral)).map(a => a.nombre).join(', ') || 'nada'}.`,
    `Ocio ${mesISO(hoy)}: ${ocioMes()} aceptadas, gasto ${euros(gastoOcioMes())}; propuestas: ${estado.ocio.filter(o => o.estado === 'propuesta').map(o => o.titulo).join('; ') || '-'}; fijas: ${estado.ocio.filter(o => o.fija).map(o => o.titulo).join('; ') || '-'}.`,
    `Finanzas ${mesISO(hoy)}: neto ${euros(balanceMes(mesISO(hoy)).neto)}; gastos por concepto ${Object.entries(balanceMes(mesISO(hoy)).por).map(([k, v]) => k + ' ' + euros(v)).join(', ') || '-'}.`,
    `Consejos en curso: ${estado.consejos.filter(c => c.estado === 'probar').map(c => c.texto.slice(0, 80)).join(' | ') || '-'}. Rechazados recientes: ${estado.consejos.filter(c => c.estado === 'rechazado').slice(-5).map(c => c.texto.slice(0, 60)).join(' | ') || '-'}.`,
    `Notas recientes: ${estado.notas.filter(n => (n.clase || 'idea') === 'idea').slice(-5).map(n => `[${n.tipo}] ${n.texto.slice(0, 100)}`).join(' | ') || '-'}.`,
    `Tareas pendientes: ${estado.notas.filter(n => n.clase === 'tarea' && !n.hecha).sort((a, b) => (a.tope || '9').localeCompare(b.tope || '9')).slice(0, 8).map(n => `${n.titulo} (tope ${n.tope || '-'})`).join('; ') || '-'}.`,
  ].join('\n');
}
