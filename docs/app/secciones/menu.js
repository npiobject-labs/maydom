import { estado, h, lista, secciones, hoyISO, duracionTexto, mesISO, euros } from '../nucleo.js';
import { eventosDe } from '../agenda.js';
import { mediaSueno } from './sueno.js';
import { rezagados } from './proyectos.js';
import { bajoStock } from './suplementos.js';
import { balanceMes } from './finanzas.js';
import { consejosNuevos } from './mayordomo.js';

const GRUPOS = ['Agenda', 'Cuerpo', 'Mesa', 'Vida', 'Mayordomo', 'Ajustes'];
function resumen(id) {
  const media = mediaSueno(7);
  const r = {
    calendario: () => `hoy ${eventosDe(hoyISO()).length} eventos`, notas: () => { const t = estado.notas.filter(n => n.clase === 'tarea' && !n.hecha), v = t.filter(n => n.tope && n.tope < hoyISO()).length; return t.length ? `${t.length} tarea${t.length > 1 ? 's' : ''}${v ? ` (${v} vencida${v > 1 ? 's' : ''})` : ''}` : estado.notas.length + ''; },
    ejercicio: () => estado.sesionesEjercicio.length + ' sesiones', sueno: () => media != null ? duracionTexto(media) + ' media' : 'sin datos', meditacion: () => '',
    alimentacion: () => estado.menus.some(m => m.fecha === hoyISO()) ? 'menú de hoy listo' : 'sin menú hoy', suplementos: () => { const n = estado.suplementos.filter(bajoStock).length; return n ? n + ' por reponer' : estado.suplementos.length + ''; }, compra: () => { const n = estado.compra.filter(c => !c.comprado).length; return n ? n + ' líneas' : ''; },
    proyectos: () => { const n = rezagados().length; return n ? n + ' rezagado' + (n > 1 ? 's' : '') : estado.proyectos.filter(p => p.estado === 'activo').length + ' activos'; }, ocio: () => estado.ocio.filter(o => o.estado === 'propuesta').length + ' propuestas', finanzas: () => euros(balanceMes(mesISO(hoyISO())).neto),
    mayordomo: () => { const n = consejosNuevos().length; return n ? n + ' nuevos' : ''; }, preferencias: () => 'horizonte: ' + estado.preferencias.horizonte, buscador: () => estado.tiendas.filter(t => t.activa).length + ' tiendas', ajustes: () => '',
  }[id];
  try { return r ? r() : ''; } catch { return ''; }
}
function render(cont) {
  cont.innerHTML = h`${lista(GRUPOS.map(g => { const ss = secciones.filter(s => s.grupo === g); return ss.length ? h`<h3>${g}</h3><ul class="menu">${lista(ss.map(s => h`<li><a href="#/${s.id}">${s.icono} ${s.titulo}<span>${resumen(s.id)}</span></a></li>`))}</ul>` : ''; }))}
    <p class="mini" style="margin-top:1.5rem">maydom · build ${document.querySelector('meta[name=build]')?.content} · <a href="bitacora.html">bitácora</a> · <a href="https://github.com/npiobject-labs/maydom/blob/main/docs/planificacion/plan-maydom.md">planificación</a></p>`;
}
export default { id: 'menu', titulo: 'Menú', grupo: null, icono: '☰', render };
