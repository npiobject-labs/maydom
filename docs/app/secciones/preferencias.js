import { estado, guardar, h, lista, delegar, hoyISO, fechaCorta, pedir, aviso, crudo } from '../nucleo.js';
import { TIPOS_EJERCICIO, TIPOS_OCIO } from '../datos/semillas.js';
const HORIZONTES = [{ v: 'dias', l: 'Próximos días' }, { v: 'semana', l: 'Esta semana' }, { v: 'mes', l: 'Este mes' }];
const campos = [
  { n: 'horizonte', l: 'Horizonte de estas preferencias', t: 'select', o: HORIZONTES },
  { n: 'energia', l: 'Energía ahora (1 baja – 5 alta)', t: 'number', min: 1, max: 5 },
  { n: 'foco', l: 'En qué quiero centrarme', ph: 'dormir mejor, sacar adelante X, moverme más…' },
  { n: 'cargaMax', l: 'Máximo de horas planificadas al día', t: 'number', min: 1, max: 14, step: 0.5 },
  { n: 'pildoraCada', l: 'Píldora de movimiento cada (min)', t: 'number', min: 20, max: 120, step: 5 },
  { n: 'rezagoDias', l: 'Un proyecto está rezagado si no le meto horas en (días)', t: 'number', min: 1, max: 60 },
  { n: 'tiposEjercicio', l: 'Tipos de ejercicio que me apetecen', t: 'tags', ayuda: TIPOS_EJERCICIO.join(' · ') },
  { n: 'restricciones', l: 'Alimentación: restricciones o preferencias', ph: 'sin lactosa, más pescado, cenas ligeras…', ayuda: 'Palabras que entiende el menú: ligera, proteina, vegetal, rapida, sin_gluten, sin_lactosa, pescado, carne' },
  { n: 'tiposOcio', l: 'Tipos de ocio', t: 'tags', ayuda: TIPOS_OCIO.join(' · ') },
  { n: 'ocioPorMes', l: 'Actividades de ocio al mes', t: 'number', min: 0, max: 30 },
  { n: 'presupuestoOcio', l: 'Presupuesto de ocio al mes (€)', t: 'number', min: 0 },
  { n: 'horaAcostarse', l: 'Hora de acostarme', t: 'time' },
  { n: 'objetivoSueno', l: 'Objetivo de sueño (h)', t: 'number', min: 4, max: 10, step: 0.5 },
  { n: 'notas', l: 'Lo que quiera contarle al mayordomo', t: 'textarea', filas: 3 },
];
function render(cont) {
  const p = estado.preferencias;
  const filas = campos.filter(c => c.n !== 'notas').map(c => { let v = p[c.n]; if (Array.isArray(v)) v = v.join(', '); if (c.t === 'select') v = (c.o.find(o => o.v === v) || {}).l || v; return h`<div class="fila kv"><span>${c.l}</span><b>${v ?? '–'}</b></div>`; });
  const prefNotas = estado.notas.filter(n => n.tipo === 'preferencia' || n.tipo === 'tendencia').slice(-5).reverse();
  cont.innerHTML = h`
    <div class="tarjeta"><div class="mini">${p.actualizado ? 'Actualizadas el ' + fechaCorta(p.actualizado) : 'Sin ajustar todavía'} · horizonte: ${(HORIZONTES.find(x => x.v === p.horizonte) || {}).l || p.horizonte}</div>
      ${p.foco ? crudo(crudoFoco(p.foco)) : ''}
      ${lista(filas)}
      ${p.notas ? h`<p class="mini">${p.notas}</p>` : ''}
      <div class="acciones"><button class="btn p" data-a="editar">Ajustar preferencias</button></div></div>
    <h3>Notas marcadas como preferencia o tendencia</h3>
    ${prefNotas.length ? lista(prefNotas.map(n => h`<div class="tarjeta mini">${fechaCorta(n.fecha)} · ${n.tipo}: ${n.texto}</div>`)) : aviso('Ninguna. En Notas, marca una nota como preferencia y aparecerá aquí.')}
    <h3>Historial</h3>
    ${estado.historialPreferencias.length ? lista(estado.historialPreferencias.slice(-8).reverse().map(x => h`<div class="tarjeta mini">${fechaCorta(x.fecha)} · ${x.horizonte} · energía ${x.energia} · ${x.foco || 'sin foco'} · ejercicio: ${(x.tiposEjercicio || []).join(', ') || '–'}</div>`)) : aviso('Cada vez que ajustes las preferencias queda una foto aquí, para ver cómo cambian.')}`;
  delegar(cont, {
    editar: async () => {
      const v = await pedir('Preferencias', campos, p); if (!v) return;
      estado.historialPreferencias.push({ fecha: hoyISO(), ...v });
      Object.assign(p, v, { actualizado: hoyISO() }); guardar();
    },
  });
}
const crudoFoco = f => h`<p><b>Foco:</b> ${f}</p>`;
export default { id: 'preferencias', titulo: 'Preferencias', grupo: 'Mayordomo', icono: '◎', render };
