import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, fechaCorta, pedir, confirmar, toast, aviso, navegar, duracionTexto } from '../nucleo.js';
import { TIPOS_EJERCICIO, pildoras as PILDORAS } from '../datos/semillas.js';
import { crearEvento, primerHueco } from '../agenda.js';
import { pedirJSON, conLLM, lista as listaLLM } from '../llm.js';

const ejercicio = id => estado.ejercicios.find(e => e.id === id);
const camposEj = [
  { n: 'nombre', l: 'Nombre', req: true }, { n: 'tipo', l: 'Tipo', t: 'select', o: TIPOS_EJERCICIO },
  { n: 'descripcion', l: 'Cómo se hace', t: 'textarea', filas: 3 }, { n: 'series', l: 'Series', t: 'number', v: 3, min: 1 }, { n: 'reps', l: 'Repeticiones o tiempo', v: '10' },
  { n: 'video', l: 'Vídeo (URL)', ph: 'vacío = búsqueda en YouTube' },
];
export function pildoraAleatoria() {
  const pref = estado.preferencias.tiposEjercicio || [];
  let pool = estado.ejercicios.filter(e => PILDORAS.includes(e.id) || e.pildora);
  if (!pool.length) pool = estado.ejercicios.filter(e => e.tipo === 'movilidad' || e.tipo === 'cardio');
  const preferidos = pool.filter(e => pref.includes(e.tipo));
  const lista = preferidos.length ? preferidos : pool;
  return lista[Math.floor(Math.random() * lista.length)] || null;
}
export function registrarPildora(ej, hecha = true) { estado.pildoras.push({ id: uid(), fecha: hoyISO(), hora: new Date().toTimeString().slice(0, 5), ejercicioId: ej?.id, nombre: ej?.nombre, hecha }); guardar(); }

function render(cont, params) {
  const vista = params.v || 'tablas';
  const pref = estado.preferencias.tiposEjercicio || [];
  const tipo = params.tipo || '';
  const ejs = estado.ejercicios.filter(e => !tipo || e.tipo === tipo).sort((a, b) => (pref.includes(b.tipo) - pref.includes(a.tipo)) || a.nombre.localeCompare(b.nombre));
  const sesiones = estado.sesionesEjercicio.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);
  const hechas = estado.sesionesEjercicio.reduce((n, s) => n + s.items.filter(i => i.hecho).length, 0), total = estado.sesionesEjercicio.reduce((n, s) => n + s.items.length, 0);
  const pildorasHoy = estado.pildoras.filter(p => p.fecha === hoyISO() && p.hecha).length;
  cont.innerHTML = h`
    <div class="chips">${lista(['tablas', 'catalogo', 'historial'].map(v => h`<button class="pill ${v === vista ? 'sel' : ''}" data-a="vista" data-v="${v}">${{ tablas: 'Tablas', catalogo: 'Catálogo', historial: 'Seguimiento' }[v]}</button>`))}</div>
    ${vista === 'tablas' ? crudo(`
      ${estado.tablas.map(t => h`<div class="tarjeta"><div class="fila"><div class="t"><b>${t.nombre}</b><div class="mini">${t.items.length} ejercicios · ${duracionTexto(t.duracion)} · ${[...new Set(t.items.map(i => ejercicio(i.ejercicioId)?.tipo).filter(Boolean))].join(', ')}</div></div>
        <button class="btn p" data-a="empezar" data-id="${t.id}">Hacer</button></div>
        <div class="acciones"><button class="btn mini" data-a="planificar" data-id="${t.id}">Al calendario</button><button class="btn mini" data-a="editarTabla" data-id="${t.id}">Editar</button></div></div>`).join('') || aviso('Sin tablas. Crea una o carga las semillas en Ajustes.').__crudo}
      <div class="acciones"><button class="btn p" data-a="nuevaTabla">+ Tabla</button><button class="btn" data-a="proponer">Proponer tabla según preferencias</button></div>
      <div class="tarjeta"><div class="fila"><div class="t"><b>Píldora de movimiento</b><div class="mini">Hoy: ${pildorasHoy} hechas · cada ${estado.preferencias.pildoraCada} min de trabajo (Preferencias)</div></div><button class="btn" data-a="pildora">Dame una</button></div></div>`)
    : vista === 'catalogo' ? crudo(`
      <div class="chips">${['', ...TIPOS_EJERCICIO].map(t => h`<button class="pill ${t === tipo ? 'sel' : ''} ${pref.includes(t) ? 'ok' : ''}" data-a="tipo" data-t="${t}">${t || 'todos'}</button>`).join('')}</div>
      <p class="mini">Los tipos que has marcado en Preferencias van primero. Cada ejercicio enlaza a una búsqueda en YouTube.</p>
      ${ejs.map(e => h`<div class="tarjeta"><div class="fila"><div class="t"><b>${e.nombre}</b> <span class="pill g">${e.tipo}</span><div class="mini">${e.series} × ${e.reps}</div></div><a class="btn mini" href="${e.video}" target="_blank" rel="noopener">▶ vídeo</a><button class="btn mini" data-a="editarEj" data-id="${e.id}">✎</button></div>
        <div class="mini">${e.descripcion}</div></div>`).join('') || aviso('Sin ejercicios de este tipo.').__crudo}
      <div class="acciones"><button class="btn p" data-a="nuevoEj">+ Ejercicio</button><button class="btn" data-a="buscarEj">YouTube (${pref.join(', ') || 'básicos'})</button><button class="btn" data-a="buscarLLM">Buscar con LLM</button></div>`)
    : crudo(`
      <div class="tarjeta"><div class="grande">${total ? Math.round(hechas / total * 100) : 0} %</div><div class="mini">de las series planificadas se hicieron · ${estado.sesionesEjercicio.length} sesiones · ${estado.pildoras.filter(p => p.hecha).length} píldoras</div></div>
      ${sesiones.map(s => h`<div class="tarjeta" data-a="verSesion" data-id="${s.id}"><div class="fila"><div class="t"><b>${fechaCorta(s.fecha)} · ${s.nombre}</b><div class="mini">${s.items.filter(i => i.hecho).length}/${s.items.length} hechos${s.nota ? ' · ' + s.nota : ''}</div></div><span class="pill ${s.items.every(i => i.hecho) ? 'ok' : 'w'}">${s.items.every(i => i.hecho) ? 'completa' : 'parcial'}</span></div></div>`).join('') || aviso('Todavía no hay sesiones registradas.').__crudo}`)}`;
  delegar(cont, {
    vista: el => navegar('ejercicio', { v: el.dataset.v }),
    tipo: el => navegar('ejercicio', { v: 'catalogo', tipo: el.dataset.t }),
    empezar: el => sesion(cont, el.dataset.id),
    verSesion: el => { const s = estado.sesionesEjercicio.find(x => x.id === el.dataset.id); if (s) sesion(cont, s.tablaId, s); },
    planificar: async el => {
      const t = estado.tablas.find(x => x.id === el.dataset.id);
      const v = await pedir('Planificar ' + t.nombre, [{ n: 'fecha', l: 'Fecha', t: 'date', v: hoyISO(), req: true }, { n: 'hora', l: 'Hora', t: 'time', v: primerHueco(hoyISO(), t.duracion || 25, '09:00') || '11:00' }]);
      if (v) { const ev = await crearEvento({ titulo: 'Tabla: ' + t.nombre, fecha: v.fecha, hora: v.hora, dur: t.duracion || 25, seccion: 'ejercicio', ref: t.id }); if (ev) toast('En el calendario'); }
    },
    nuevaTabla: () => editarTabla(cont),
    editarTabla: el => editarTabla(cont, estado.tablas.find(x => x.id === el.dataset.id)),
    proponer: () => {
      const tipos = pref.length ? pref : TIPOS_EJERCICIO;
      const pool = estado.ejercicios.filter(e => tipos.includes(e.tipo));
      if (pool.length < 3) { toast('Pocos ejercicios de esos tipos; añade más al catálogo'); return; }
      const items = pool.sort(() => Math.random() - 0.5).slice(0, estado.preferencias.energia >= 4 ? 6 : 4).map(e => ({ ejercicioId: e.id }));
      estado.tablas.push({ id: uid(), nombre: `Propuesta ${tipos.join('/')} ${fechaCorta(hoyISO())}`, duracion: items.length * 5, items }); guardar(); toast('Tabla propuesta añadida');
    },
    pildora: () => { const e = pildoraAleatoria(); if (!e) return toast('Carga el catálogo primero'); pedir('Píldora: ' + e.nombre, [], {}, { texto: `${e.series} × ${e.reps}. ${e.descripcion}`, aceptar: 'Hecha' }).then(v => { if (v) { registrarPildora(e); toast('Píldora anotada'); } }); },
    nuevoEj: async () => { const v = await pedir('Nuevo ejercicio', camposEj, { tipo: pref[0] || 'calistenia' }); if (v) { if (!v.video) v.video = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(v.nombre + ' técnica'); estado.ejercicios.push({ id: uid(), ...v }); guardar(); } },
    editarEj: async el => { const e = ejercicio(el.dataset.id); const v = await pedir('Editar ejercicio', camposEj, e, { extra: 'Borrar' }); if (!v) return; if (v.__extra) { estado.ejercicios = estado.ejercicios.filter(x => x.id !== e.id); guardar(); return; } Object.assign(e, v); guardar(); },
    buscarLLM: el => conLLM(el, async () => {
      const tipos = tipo ? [tipo] : (pref.length ? pref : ['calistenia', 'movilidad']);
      const j = await pedirJSON({ operacion: 'ejercicios', tarea: `Propón 8 ejercicios de tipo ${tipos.join(' o ')} para hacer en casa sin apenas material, que NO estén en esta lista: ${estado.ejercicios.map(e => e.nombre).join('; ')}. Explicación de 2 frases con la técnica y un error habitual. Devuelve {"ejercicios":[{"nombre":"","tipo":"${tipos[0]}","descripcion":"","series":3,"reps":"10"}]} con tipo entre: ${TIPOS_EJERCICIO.join(', ')}.` });
      let n = 0;
      for (const e of listaLLM(j, 'ejercicios')) { if (!e || !e.nombre || estado.ejercicios.some(x => x.nombre.toLowerCase() === String(e.nombre).toLowerCase())) continue; estado.ejercicios.push({ id: uid(), nombre: String(e.nombre), tipo: TIPOS_EJERCICIO.includes(e.tipo) ? e.tipo : tipos[0], descripcion: String(e.descripcion || ''), series: Number(e.series) || 3, reps: String(e.reps || '10'), video: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(e.nombre + ' técnica correcta'), origen: 'llm' }); n++; }
      guardar(); toast(n ? n + ' ejercicios nuevos en el catálogo' : 'Nada nuevo');
    }),
    buscarEj: () => window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent((pref[0] || 'ejercicios en casa') + ' ejercicios principiantes'), '_blank'),
  });
}
async function editarTabla(cont, t) {
  const v = await pedir(t ? 'Editar tabla' : 'Nueva tabla', [
    { n: 'nombre', l: 'Nombre', req: true }, { n: 'duracion', l: 'Duración (min)', t: 'number', v: 25, min: 5 },
    { n: 'ids', l: 'Ejercicios (nombres separados por coma)', t: 'textarea', filas: 3, ayuda: 'Se buscan por nombre en el catálogo; los que no existan se ignoran.' },
  ], t ? { ...t, ids: t.items.map(i => ejercicio(i.ejercicioId)?.nombre).filter(Boolean).join(', ') } : {}, t ? { extra: 'Borrar' } : {});
  if (!v) return;
  if (v.__extra) { if (await confirmar('¿Borrar la tabla?')) { estado.tablas = estado.tablas.filter(x => x.id !== t.id); guardar(); } return; }
  const items = v.ids.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).map(n => estado.ejercicios.find(e => e.nombre.toLowerCase() === n)).filter(Boolean).map(e => ({ ejercicioId: e.id }));
  if (t) Object.assign(t, { nombre: v.nombre, duracion: v.duracion, items }); else estado.tablas.push({ id: uid(), nombre: v.nombre, duracion: v.duracion, items });
  guardar();
}
// Pantalla de sesión: la tabla con un check por ejercicio; al terminar, queda en el historial.
function sesion(cont, tablaId, existente) {
  const t = estado.tablas.find(x => x.id === tablaId);
  const s = existente || { id: uid(), fecha: hoyISO(), tablaId, nombre: t?.nombre || 'Sesión', items: (t?.items || []).map(i => ({ ejercicioId: i.ejercicioId, hecho: false })), nota: '' };
  const pinta = () => {
    cont.innerHTML = h`<h2>${s.nombre} <span class="mini">${fechaCorta(s.fecha)}</span></h2>
      ${lista(s.items.map((i, k) => { const e = ejercicio(i.ejercicioId) || { nombre: '?', series: '', reps: '', descripcion: '' }; return h`<div class="tarjeta fila"><button class="chk" data-a="chk" data-k="${k}">${i.hecho ? '✓' : '○'}</button><div class="t"><b>${e.nombre}</b> <span class="mini">${e.series} × ${e.reps}</span><div class="mini">${e.descripcion}</div></div><a class="btn mini" href="${e.video || '#'}" target="_blank" rel="noopener">▶</a></div>`; }))}
      <div class="acciones"><button class="btn p" data-a="fin">${existente ? 'Guardar' : 'Terminar y guardar'}</button><button class="btn" data-a="todos">Todo hecho</button><button class="btn" data-a="volver">Volver</button></div>`;
    delegar(cont, {
      chk: el => { s.items[el.dataset.k].hecho = !s.items[el.dataset.k].hecho; pinta(); },
      todos: () => { s.items.forEach(i => i.hecho = true); pinta(); },
      volver: () => render(cont, { v: existente ? 'historial' : 'tablas' }),
      fin: async () => {
        const v = await pedir('¿Cómo fue?', [{ n: 'nota', l: 'Una línea (opcional)', v: s.nota, ph: 'flojo de piernas, mucho calor…' }], {}, { aceptar: 'Guardar' }); if (!v) return;
        s.nota = v.nota; if (!existente) estado.sesionesEjercicio.push(s);
        const ev = estado.eventos.find(e => e.fecha === s.fecha && e.ref === tablaId && e.seccion === 'ejercicio'); if (ev) ev.hecho = true;
        guardar(); navegar('ejercicio', { v: 'historial' });
      },
    });
  };
  pinta();
}
export default { id: 'ejercicio', titulo: 'Ejercicio', grupo: 'Cuerpo', icono: '⚡', render };
