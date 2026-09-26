import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, sumarDias, fechaCorta, pedir, confirmar, toast, aviso, navegar, duracionTexto, finCaja } from '../nucleo.js';
import { TIPOS_EJERCICIO, pildoras as PILDORAS } from '../datos/semillas.js';
import { crearEvento, primerHueco } from '../agenda.js';
import { pedirJSON, conLLM, lista as listaLLM } from '../llm.js';
import { hayVoz } from '../voz.js';
import { leerDetalle, leerSeries, componerDetalle, volumen, volumenTexto, segTexto, interpretarLocal, desdeLLM, combinar, vincular } from '../interpretar-ejercicio.js';

const ejercicio = id => estado.ejercicios.find(e => e.id === id);
const camposEj = [
  { n: 'nombre', l: 'Nombre', req: true }, { n: 'tipo', l: 'Tipo', t: 'select', o: TIPOS_EJERCICIO },
  { n: 'descripcion', l: 'Cómo se hace', t: 'textarea', filas: 5 }, { n: 'series', l: 'Series', t: 'number', v: 3, min: 1 }, { n: 'reps', l: 'Repeticiones o tiempo', v: '10' },
  { n: 'video', l: 'Vídeo (URL)', ph: 'vacío = búsqueda en YouTube' },
];
// Botón «Generar con IA» bajo «Cómo se hace»: escribe técnica, series y repeticiones en el formulario abierto, sin cerrarlo.
const generarConIA = {
  l: '✨ Generar con IA', cargando: 'Generando…', fn: async ({ valores, escribir }) => {
    const nombre = (valores.nombre || '').trim();
    if (!nombre) { toast('Escribe primero el nombre del ejercicio'); return; }
    try {
      const j = await pedirJSON({
        operacion: 'ejercicios', contexto: false,
        tarea: `Eres entrenador. Para el ejercicio que te digan, devuelve {"descripcion":"","series":3,"reps":"10"}. La descripción, en español y texto plano: posición inicial, ejecución paso a paso, respiración y un error habitual que evitar, en 3 a 5 frases. reps puede ser un número o un tiempo ("30 s").`,
        mensaje: `Ejercicio: ${nombre} (tipo ${valores.tipo || 'sin indicar'})${valores.descripcion ? '\nLo que ya tengo escrito:\n' + String(valores.descripcion).slice(0, 1500) : ''}`,
      });
      if (!j?.descripcion) { toast('El mayordomo no devolvió explicación'); return; }
      const datos = { descripcion: String(j.descripcion).trim().slice(0, 2000) };
      if (Number(j.series) > 0) datos.series = Math.round(Number(j.series));
      if (j.reps) datos.reps = String(j.reps).slice(0, 30);
      escribir(datos);
    } catch (e) { toast('LLM: ' + e.message, 5000); }
  },
};
const opcionesEj = { acciones: [generarConIA], accionesTras: 'descripcion' };
export function pildoraAleatoria() {
  const pref = estado.preferencias.tiposEjercicio || [];
  let pool = estado.ejercicios.filter(e => PILDORAS.includes(e.id) || e.pildora);
  if (!pool.length) pool = estado.ejercicios.filter(e => e.tipo === 'movilidad' || e.tipo === 'cardio');
  const preferidos = pool.filter(e => pref.includes(e.tipo));
  const lista = preferidos.length ? preferidos : pool;
  return lista[Math.floor(Math.random() * lista.length)] || null;
}

// ---------- contar el ejercicio hablando ----------
// Mismo patrón que «Contar la noche»: el relato arriba, el botón que lo traduce justo debajo y los
// ejercicios en una caja que se repasa, uno por línea («Flexiones: 4 × 12 · descanso 60 s»). El relato
// se guarda siempre: es la fuente, y los ejercicios, su interpretación.
const camposContar = [
  { n: 'relato', l: 'Cuéntame el ejercicio', t: 'textarea', filas: 5, ph: 'He hecho 4 series de 12 flexiones descansando un minuto, luego 3 series de 45 segundos de plancha con 30 segundos de descanso…' },
  { n: 'fecha', l: 'Fecha', t: 'date', req: true },
  { n: 'detalle', l: 'Ejercicios, uno por línea', t: 'textarea', filas: 4, ph: 'Flexiones: 4 × 12 · descanso 60 s\nPlancha: 3 × 45 s · descanso 30 s\nDominadas: 8, 6, 5 · 10 kg · descanso 90 s' },
  { n: 'duracion', l: 'Duración de la sesión (min, opcional)', t: 'number', min: 0 },
  { n: 'nota', l: 'Cómo fue (opcional)', ph: 'flojo de piernas, mucho calor…' },
];
const DATOS_CONTADA = ['fecha', 'detalle', 'duracion', 'nota'];
const contada = s => s?.origen === 'relato';
const nombreSesion = items => items.length ? items.slice(0, 3).map(i => i.nombre).join(', ') + (items.length > 3 ? '…' : '') : 'Sesión contada';

// Pasa el relato al mayordomo. Nunca inventa: lo que el texto no diga vuelve vacío y no se escribe.
// El modelo del gateway es pequeño: con instrucciones largas y sin ejemplo se quedaba en el primer
// ejercicio (26-sep, «caminata… una serie de dominadas con 20 repeticiones… rodillo abdominal»). Por eso
// las reglas van en frases cortas, con un ejemplo de varios ejercicios, y el relato va como mensaje.
export async function interpretarConLLM(relato, fechaRef) {
  const nombres = estado.ejercicios.map(e => e.nombre).slice(0, 80).join('; ');
  const j = await pedirJSON({
    operacion: 'ejercicio-relato', contexto: false,
    tarea: `Conviertes en datos lo que alguien cuenta de su entrenamiento. Hoy es ${fechaRef}.
Devuelve este JSON: {"fecha":"AAAA-MM-DD","duracion":<minutos de toda la sesión, solo si lo dice>,"ejercicios":[{"nombre":"","repeticiones":[<una cifra por serie>],"segundos":[<una cifra por serie>],"kg":<peso o null>,"descanso":<segundos entre series o null>}],"nota":"<sensaciones en una línea, o vacío>"}
- Un objeto por CADA ejercicio o actividad que se nombre, en el orden en que se cuentan. Puede haber uno o diez: recorre el texto entero.
- Por repeticiones: "repeticiones" lleva una cifra por serie y "segundos" va vacío. "4 series de 12" es [12,12,12,12]; "una serie de 20" es [20]; "8, 6 y 5" es [8,6,5].
- Isométricos y actividades por tiempo (plancha, caminar, correr, bici, estiramientos): "segundos" lleva una cifra por serie y "repeticiones" va vacío. "caminata de 30 minutos" es [1800]; "3 de 45 segundos" es [45,45,45].
- En un circuito de «tres rondas» o «tres vueltas», cada ejercicio de la ronda lleva tres series.
- La hora del día («a las diez») no es ni repetición ni duración. Un descanso dicho para todo va en cada ejercicio.
- Lo que no diga el texto va a null o a lista vacía; no inventes.
${nombres ? `- Si un ejercicio es exactamente uno de estos, usa ese nombre; si solo se parece, deja el nombre que dice el texto: ${nombres}.\n` : ''}Ejemplo. Texto: «A las nueve salí a correr unos 20 minutos, después hice dos series de 10 sentadillas descansando un minuto, a continuación una serie de flexiones con 15 repeticiones y terminé con tres planchas de 40 segundos. Acabé bien.»
JSON: {"fecha":"${fechaRef}","duracion":null,"ejercicios":[{"nombre":"Correr","repeticiones":[],"segundos":[1200],"kg":null,"descanso":null},{"nombre":"Sentadillas","repeticiones":[10,10],"segundos":[],"kg":null,"descanso":60},{"nombre":"Flexiones","repeticiones":[15],"segundos":[],"kg":null,"descanso":null},{"nombre":"Plancha","repeticiones":[],"segundos":[40,40,40],"kg":null,"descanso":null}],"nota":"Acabó bien."}`,
    mensaje: String(relato).slice(0, 4000),
  });
  const out = { items: desdeLLM(j?.ejercicios) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(j?.fecha || ''))) out.fecha = j.fecha;
  const d = Math.round(Number(j?.duracion)); if (d > 0 && d <= 600) out.duracion = d;
  if (j?.nota) out.nota = String(j.nota).trim().slice(0, 300);
  return out;
}

// Abre el ejercicio contado: relato arriba y la lista de ejercicios debajo, con su volumen a la vista.
// Al terminar el dictado se interpreta solo; «✨ Interpretar» lo repite tras corregir el texto.
export function registrarEjercicio(s = {}) {
  const editando = !!s.id;
  let ultimoInterpretado = '';
  const repintar = form => form.elements.detalle?.dispatchEvent(new Event('input'));
  const traducir = async (relato, { escribir, form }, avisar = true) => {
    const t = String(relato || '').trim();
    if (!t || t === ultimoInterpretado) return;
    ultimoInterpretado = t;
    // Las reglas van primero: sin LLM o si la llamada falla, algo de lo contado queda en la lista.
    const local = interpretarLocal(t, estado.ejercicios.map(e => e.nombre));
    if (local.length) { escribir({ detalle: componerDetalle(local) }); repintar(form); }
    try {
      const j = await interpretarConLLM(t, hoyISO());
      // Lo que el mayordomo se salte y las reglas sí hayan visto se completa con ellas.
      const items = combinar(j.items, local);
      escribir({ fecha: j.fecha, duracion: j.duracion, nota: j.nota, detalle: items.length ? componerDetalle(items) : null });
      repintar(form);
    } catch (e) { if (avisar) toast('No se pudo interpretar: ' + e.message + '. Lo contado se guarda igual; repasa la lista.', 8000); }
  };
  return pedir(editando ? 'Editar ejercicio' : 'El ejercicio', camposContar, { fecha: hoyISO(), ...s, detalle: componerDetalle(s.items || []) }, {
    dictar: 'relato',
    alDictar: (texto, api) => { toast('Interpretando lo que has contado…', 3000); return traducir(texto, api); },
    acciones: [{ l: '✨ Interpretar', cargando: 'Interpretando…', fn: async api => { ultimoInterpretado = ''; await traducir(api.valores.relato, api); } }],
    accionesTras: 'relato',
    // El volumen se recalcula con cada cambio de la lista, venga del mayordomo o de lo escrito a mano.
    alAbrir: ({ form }) => {
      const ta = form.elements.detalle, p = document.createElement('p');
      p.className = 'mini volumen'; p.setAttribute('aria-live', 'polite');
      finCaja(ta).insertAdjacentElement('afterend', p);
      const pinta = () => {
        const its = leerDetalle(ta.value), sin = its.filter(i => !i.series.length).map(i => i.nombre);
        p.textContent = its.length ? 'Volumen: ' + volumenTexto(volumen(its)) + (sin.length ? ` · sin series: ${sin.join(', ')}` : '') : 'Aún no hay ejercicios: cuéntalos arriba o escribe uno por línea.';
      };
      ta.addEventListener('input', pinta); pinta();
    },
    aceptar: 'Guardar',
    texto: 'Dicta o escribe lo que has hecho y la lista se rellena sola: series, repeticiones o segundos, peso y descanso. Repásala antes de guardar; cualquier línea se corrige a mano.',
    ...(editando ? { extra: 'Borrar' } : {}),
  }).then(async v => {
    if (!v) return null;
    if (v.__extra) { if (await confirmar('¿Borrar esta sesión?')) { estado.sesionesEjercicio = estado.sesionesEjercicio.filter(x => x.id !== s.id); guardar(); } return null; }
    const items = vincular(leerDetalle(v.detalle), estado.ejercicios).map(it => ({ ...it, hecho: true }));
    const datos = { fecha: v.fecha, nombre: nombreSesion(items), relato: (v.relato || '').trim(), items, duracion: v.duracion || null, nota: (v.nota || '').trim() };
    if (!items.length && !datos.relato) { toast('No hay nada que guardar'); return null; }
    if (editando) {
      const r = estado.sesionesEjercicio.find(x => x.id === s.id);
      const antes = { ...r, detalle: componerDetalle(r.items) };
      // Lo que se toca a mano queda marcado, como en el relato de la noche.
      r.manuales = [...new Set([...(r.manuales || []), ...DATOS_CONTADA.filter(k => String(v[k] ?? '').trim() !== String(antes[k] ?? '').trim())])];
      Object.assign(r, datos); guardar(); return r;
    }
    const nueva = { id: uid(), origen: 'relato', manuales: [], ...datos };
    estado.sesionesEjercicio.push(nueva); guardar();
    return nueva;
  });
}
// Lo hecho en una sesión, para medir volumen: la contada trae sus series; la de una tabla, las del
// catálogo de cada ejercicio marcado como hecho.
export function itemsDeSesion(s) {
  if (contada(s)) return s.items;
  return s.items.filter(i => i.hecho).map(i => ejercicio(i.ejercicioId)).filter(Boolean).map(e => ({ nombre: e.nombre, series: leerSeries(`${e.series} × ${e.reps}`) }));
}

// El volumen de varias sesiones, en filas como la última noche de Sueño.
function filasVolumen(ses) {
  const v = volumen(ses.flatMap(itemsDeSesion)), fila = (l, x) => h`<div class="fila kv"><span>${l}</span><b>${x}</b></div>`;
  return [fila('Sesiones', ses.length), fila('Ejercicios · series', `${v.ejercicios} · ${v.series}`),
    v.reps ? fila('Repeticiones', v.reps) : '', v.seg ? fila('Por tiempo', segTexto(v.seg)) : '',
    v.descanso ? fila('Descanso entre series', segTexto(v.descanso)) : '', v.kg ? fila('Kg movidos', v.kg.toLocaleString('es-ES')) : ''].join('');
}

export function registrarPildora(ej, hecha = true) { estado.pildoras.push({ id: uid(), fecha: hoyISO(), hora: new Date().toTimeString().slice(0, 5), ejercicioId: ej?.id, nombre: ej?.nombre, hecha }); guardar(); }

function render(cont, params) {
  const vista = params.v || 'tablas';
  const pref = estado.preferencias.tiposEjercicio || [];
  const tipo = params.tipo || '';
  const ejs = estado.ejercicios.filter(e => !tipo || e.tipo === tipo).sort((a, b) => (pref.includes(b.tipo) - pref.includes(a.tipo)) || a.nombre.localeCompare(b.nombre));
  const sesiones = estado.sesionesEjercicio.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);
  // El porcentaje de series hechas solo tiene sentido en las sesiones de una tabla: una contada es todo lo hecho.
  const planificadas = estado.sesionesEjercicio.filter(s => !contada(s));
  const hechas = planificadas.reduce((n, s) => n + s.items.filter(i => i.hecho).length, 0), total = planificadas.reduce((n, s) => n + s.items.length, 0);
  const semana = estado.sesionesEjercicio.filter(s => s.fecha >= sumarDias(hoyISO(), -6));
  const pildorasHoy = estado.pildoras.filter(p => p.fecha === hoyISO() && p.hecha).length;
  cont.innerHTML = h`
    <div class="acciones"><button class="btn p" data-a="contar">${hayVoz() ? '🎤 ' : ''}Contar el ejercicio</button></div>
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
      <div class="tarjeta"><b>Últimos 7 días</b>${semana.length ? filasVolumen(semana) : '<div class="mini">Sin sesiones. Toca «Contar el ejercicio» y díctalo como salga: «4 series de 12 flexiones descansando un minuto, 3 de 45 segundos de plancha…».</div>'}</div>
      ${total ? h`<div class="tarjeta"><div class="grande">${Math.round(hechas / total * 100)} %</div><div class="mini">de los ejercicios planificados en tablas se hicieron · ${planificadas.length} sesiones de tabla · ${estado.pildoras.filter(p => p.hecha).length} píldoras</div></div>` : ''}
      ${sesiones.map(s => contada(s)
        ? h`<div class="tarjeta" data-a="verSesion" data-id="${s.id}"><div class="fila"><div class="t"><b>${fechaCorta(s.fecha)} · ${s.nombre}</b>${s.relato ? crudo(' <span class="mini">🎤</span>') : ''}<div class="mini">${volumenTexto(volumen(s.items)) || 'sin series anotadas'}${s.duracion ? ' · ' + duracionTexto(s.duracion) : ''}${s.nota ? ' · ' + s.nota : ''}</div></div><span class="pill ok">contada</span></div></div>`
        : h`<div class="tarjeta" data-a="verSesion" data-id="${s.id}"><div class="fila"><div class="t"><b>${fechaCorta(s.fecha)} · ${s.nombre}</b><div class="mini">${s.items.filter(i => i.hecho).length}/${s.items.length} hechos${s.nota ? ' · ' + s.nota : ''}</div></div><span class="pill ${s.items.every(i => i.hecho) ? 'ok' : 'w'}">${s.items.every(i => i.hecho) ? 'completa' : 'parcial'}</span></div></div>`).join('') || aviso('Todavía no hay sesiones registradas.').__crudo}`)}`;
  delegar(cont, {
    vista: el => navegar('ejercicio', { v: el.dataset.v }),
    tipo: el => navegar('ejercicio', { v: 'catalogo', tipo: el.dataset.t }),
    empezar: el => sesion(cont, el.dataset.id),
    verSesion: el => { const s = estado.sesionesEjercicio.find(x => x.id === el.dataset.id); if (contada(s)) registrarEjercicio(s); else if (s) sesion(cont, s.tablaId, s); },
    contar: async () => { const s = await registrarEjercicio(); if (s) { toast(`${fechaCorta(s.fecha)}: ${volumenTexto(volumen(s.items)) || 'guardado'}`, 5000); navegar('ejercicio', { v: 'historial' }); } },
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
    nuevoEj: async () => { const v = await pedir('Nuevo ejercicio', camposEj, { tipo: pref[0] || 'calistenia' }, opcionesEj); if (v) { if (!v.video) v.video = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(v.nombre + ' técnica'); estado.ejercicios.push({ id: uid(), ...v }); guardar(); } },
    editarEj: async el => { const e = ejercicio(el.dataset.id); const v = await pedir('Editar ejercicio', camposEj, e, { ...opcionesEj, extra: 'Borrar' }); if (!v) return; if (v.__extra) { estado.ejercicios = estado.ejercicios.filter(x => x.id !== e.id); guardar(); return; } Object.assign(e, v); guardar(); },
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
