// Informes con varios roles y selección de modelo (ADR-010): réplica de F25/F26 de `prueba` sobre las
// ideas de maydom. Cada rol es una llamada al mayordomo en modo `informe` (cuatro a la vez) y una
// síntesis escribe la cabecera; el informe lo compone la app, así la estructura no depende del modelo.
// Todo es local (ADR-002): roles propios e informes viven en el estado y viajan en la copia JSON; el
// backend solo reenvía al gateway. Cada generación va con X-Operacion `maydom-informe-<id>-<n>`, y el
// coste de la ficha es el que anotó el gateway para esa operación.
import { estado, guardar, persistir, uid, esc, h, lista, toast, pedir, confirmar, fechaCorta, montarCajas, pad } from './nucleo.js';
import { consultar, catalogoModelos, costeDe } from './llm.js';

export const MAX_ROLES = 8, MAX_FUENTES = 20, UMBRAL_CARO = 0.25;
const MAX_CARACTERES = 30000, SIMULTANEOS = 4;

// Los nueve de `prueba` (D55). Viven en el código para que mejoren con cada versión.
export const DE_SERIE = [
  { id: 'critico', icono: '🧐', nombre: 'Crítico', enfoque: 'Abogado del diablo: busca los puntos débiles, los supuestos que se dan por buenos sin prueba, lo que falta y qué puede salir mal. No suavices: si algo no se sostiene, dilo.' },
  { id: 'analitico', icono: '📊', nombre: 'Analítico', enfoque: 'Ordena el material: agrupa las ideas en bloques, detecta huecos, contradicciones entre notas y datos que faltan para decidir, y di qué nota dice cada cosa.' },
  { id: 'economico', icono: '💶', nombre: 'Económico', enfoque: 'Costes, ingresos, modelo de negocio y viabilidad económica. Da órdenes de magnitud cuando puedas y señala qué cifras faltan para decidir.' },
  { id: 'marketing', icono: '📣', nombre: 'Marketing', enfoque: 'Público objetivo, propuesta de valor, posicionamiento, canales para llegar a él y competencia. Cómo se explicaría en una frase y a quién.' },
  { id: 'usabilidad', icono: '🧭', nombre: 'Usabilidad', enfoque: 'Recorrido del usuario, fricciones, accesibilidad y uso real en el móvil: dónde se atasca alguien que lo usa por primera vez.' },
  { id: 'tecnico', icono: '🛠', nombre: 'Técnico', enfoque: 'Arquitectura, complejidad, riesgos técnicos, dependencias y qué conviene no construir porque ya existe.' },
  { id: 'legal', icono: '⚖️', nombre: 'Legal y privacidad', enfoque: 'Protección de datos (RGPD), consentimiento, pagos, propiedad intelectual y condiciones de uso: qué obligaciones aparecen y cómo cumplirlas sin frenar el proyecto.' },
  { id: 'producto', icono: '🎯', nombre: 'Producto', enfoque: 'Qué entra en la primera versión, en qué orden y qué se deja fuera; cómo se mide si funciona.' },
  { id: 'usuario', icono: '👤', nombre: 'Usuario final', enfoque: 'Ponte en la piel de quien lo va a usar: qué le convence, qué le molesta, qué no entiende y qué le haría dejarlo. Habla en primera persona cuando ayude.' },
];
export const todosLosRoles = () => [...DE_SERIE.map(r => ({ ...r, propio: false })), ...estado.roles.map(r => ({ ...r, propio: true }))];
const clave = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// ---------- Modelos ----------
let cat = null;
// El catálogo se pide una vez por sesión; un fallo se recuerda un minuto para no repintar en bucle.
export async function cargarCatalogo(forzar = false) {
  if (cat && !forzar && (!cat.error || Date.now() - cat.t < 60000)) return cat;
  try { cat = { ...(await catalogoModelos()), t: Date.now() }; } catch (e) { cat = { defecto: null, modelos: [], error: e.message, t: Date.now() }; }
  return cat;
}
export const catalogoListo = () => !!cat;
export const infoModelo = id => cat?.modelos.find(m => m.id === id);
export const nombreModelo = id => id ? (infoModelo(id)?.nombre || id) : 'el del servidor';
export const dolares = v => (v < 0.01 ? '< 0,01' : v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' $';
const num = (v, d = 3) => v.toLocaleString('es-ES', { maximumFractionDigits: d });
export const precio = m => m ? `${num(m.entrada)} / ${num(m.salida)} $ · ${m.contexto >= 1e6 ? num(m.contexto / 1e6, 1) + 'M' : Math.round(m.contexto / 1000) + 'K'}` : '';
// Botón con el modelo: «🧠 nombre / precio · etiqueta ›». Lo usan Ajustes y la hoja de Analizar.
export function botonModelo(id, etiqueta, accion) {
  const def = cat?.defecto, m = infoModelo(id || def);
  const nombre = id ? nombreModelo(id) : 'El del servidor' + (def ? ' · ' + nombreModelo(def) : '');
  return h`<button type="button" class="modelo-btn" data-a="${accion}"><span>🧠</span><span><b>${nombre}</b><small>${[etiqueta, precio(m)].filter(Boolean).join(' · ')}</small></span><i>›</i></button>`;
}

// Selector con buscador: el del servidor, los recomendados y el resto del catálogo. Devuelve el id
// elegido ('' = el del servidor) o null si se cierra sin elegir.
export function elegirModelo({ titulo = 'Modelo', aviso = '', actual = '' } = {}) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog'); dlg.className = 'modal ancho';
    dlg.innerHTML = h`<div class="cabecera-modal"><h2>${titulo}</h2><button type="button" class="cerrar" data-cancelar aria-label="Cerrar sin elegir" title="Cerrar sin elegir">✕</button></div>
      ${aviso ? h`<p class="mini">${aviso}</p>` : ''}<input type="search" placeholder="Buscar por nombre o id" data-buscar autocomplete="off">
      <div data-lista><p class="mini">Cargando el catálogo…</p></div>`;
    document.body.appendChild(dlg);
    const cerrar = v => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', e => { e.preventDefault(); cerrar(null); });
    dlg.onclick = e => { if (e.target.closest('[data-cancelar]')) return cerrar(null); const b = e.target.closest('[data-id]'); if (b) cerrar(b.dataset.id); };
    const zona = dlg.querySelector('[data-lista]'), buscar = dlg.querySelector('[data-buscar]');
    const boton = (id, nombre, sub) => h`<button type="button" class="modelo ${id === actual ? 'on' : ''}" data-id="${id}"><span><b>${nombre}</b><code>${id || cat.defecto || ''}</code><small>${sub}</small></span><i>✓</i></button>`;
    const pintar = () => {
      const q = clave(buscar.value), cabe = m => !q || clave(m.nombre + ' ' + m.id).includes(q);
      const sub = m => [precio(m), m.recomendado].filter(Boolean).join(' · ');
      const partes = [h`<div class="lista-modelos">${boton('', 'El del servidor', 'Por defecto' + (infoModelo(cat.defecto) ? ' · ' + precio(infoModelo(cat.defecto)) : ''))}</div>`];
      if (cat.error) partes.push(h`<p class="mini error">No se pudo traer el catálogo (${cat.error}). Queda el del servidor.</p>`);
      else {
        const rec = cat.modelos.filter(m => m.recomendado && cabe(m)), resto = cat.modelos.filter(m => !m.recomendado && cabe(m));
        if (rec.length) partes.push(h`<div class="grupo-m">Recomendados para informes</div><div class="lista-modelos">${lista(rec.map(m => boton(m.id, m.nombre, sub(m))))}</div>`);
        if (resto.length) partes.push(h`<div class="grupo-m">${q ? `Coinciden ${resto.length}` : `Todos · ${cat.modelos.length} en el catálogo`}</div><div class="lista-modelos">${lista(resto.slice(0, 60).map(m => boton(m.id, m.nombre, sub(m))))}</div>`,
          resto.length > 60 ? h`<p class="mini">Y ${resto.length - 60} más: escribe arriba para encontrarlos.</p>` : '');
        if (!rec.length && !resto.length) partes.push(h`<p class="mini">Ningún modelo coincide.</p>`);
      }
      zona.innerHTML = partes.map(p => p.__crudo ?? p).join('');
    };
    let t; buscar.oninput = () => { clearTimeout(t); t = setTimeout(pintar, 150); };
    dlg.showModal();
    cargarCatalogo().then(() => { if (dlg.open) pintar(); });
  });
}

// ---------- Roles propios (D59) ----------
// Uno de serie se ve y se duplica; uno propio se edita o se borra. Devuelve el id creado, si lo hay.
export async function abrirRol(r, copia = null) {
  if (r && !r.propio) {
    const v = await pedir(`${r.icono} ${r.nombre}`, [], {}, { texto: r.enfoque + ' — Los roles de serie mejoran con cada versión; para ajustar uno, duplícalo.', aceptar: 'Duplicar como propio' });
    return v ? abrirRol(null, { icono: r.icono, nombre: (r.nombre + ' (mío)').slice(0, 30), enfoque: r.enfoque }) : null;
  }
  let valores = r || copia || { icono: '', nombre: '', enfoque: '' };
  for (;;) {
    const v = await pedir(r ? 'Editar rol' : copia ? 'Duplicar rol' : 'Nuevo rol', [
      { n: 'icono', l: 'Icono (un emoji)', ph: '🧪' },
      { n: 'nombre', l: 'Nombre', ph: 'Nutricionista', req: true },
      { n: 'enfoque', l: 'Qué mira este rol', t: 'textarea', filas: 4, req: true, ayuda: 'Escríbelo como un encargo: qué debe buscar y qué debe proponer. La app le añade la estructura común (veredicto, hallazgos, recomendaciones y preguntas).' },
    ], valores, { extra: r ? 'Borrar' : '' });
    if (!v) return null;
    if (v.__extra) {
      if (!(await confirmar(`¿Borrar el rol «${r.nombre}»? Los informes ya hechos no cambian.`, 'Borrar'))) return null;
      estado.roles = estado.roles.filter(x => x.id !== r.id);
      estado.ajustes.rolesInforme = (estado.ajustes.rolesInforme || []).filter(id => id !== r.id);
      guardar(); toast('Rol borrado'); return null;
    }
    const nombre = v.nombre.replace(/\s+/g, ' ').trim(), enfoque = v.enfoque.trim(), icono = [...v.icono.trim()].slice(0, 8).join('') || '🧪';
    const choca = todosLosRoles().some(x => x.id !== r?.id && clave(x.nombre) === clave(nombre));
    const fallo = !nombre || nombre.length > 30 ? 'El nombre tiene que tener entre 1 y 30 caracteres'
      : enfoque.length > 600 ? '«Qué mira este rol» admite hasta 600 caracteres' : choca ? 'Ya hay un rol con ese nombre' : '';
    if (fallo) { toast(fallo, 4000); valores = v; continue; }
    if (r) Object.assign(estado.roles.find(x => x.id === r.id), { nombre, icono, enfoque });
    else estado.roles.push({ id: 'p' + uid(), nombre, icono, enfoque });
    guardar(); toast(r ? 'Rol guardado' : 'Rol creado');
    return r ? r.id : estado.roles[estado.roles.length - 1].id;
  }
}

// ---------- Hoja de Analizar (D54, D60, D62) ----------
// `ideas`: las candidatas (las visibles en Ideas); `previo`: un informe para regenerarlo con lo mismo.
export function abrirAnalisis({ ideas = [], previo = null } = {}) {
  const conocidos = new Set(todosLosRoles().map(r => r.id));
  const guardados = previo ? previo.roles.map(r => r.id) : (estado.ajustes.rolesInforme || ['critico', 'analitico']);
  const rolesSel = new Set(guardados.filter(id => conocidos.has(id)));
  const candidatas = previo ? previo.fuentes : ideas;
  const marcadas = new Set(candidatas.slice(0, MAX_FUENTES).map(n => n.id));
  let modelo = previo ? previo.modelo : null; // null = el de Ajustes
  const modeloDe = () => modelo ?? (estado.ajustes.modelo || '');
  const dlg = document.createElement('dialog'); dlg.className = 'modal ancho';
  dlg.innerHTML = h`<form class="form" method="dialog">
    <div class="cabecera-modal"><h2>${previo ? 'Regenerar el informe' : '🔎 Analizar ideas'}</h2><button type="button" class="cerrar" data-cancelar aria-label="Cerrar sin generar" title="Cerrar sin generar">✕</button></div>
    ${previo ? h`<p class="mini">Se rehace con las mismas ${previo.fuentes.length} ideas (con su texto de ahora, si siguen existiendo). Lo que haya ahora en el informe se pierde.</p>`
      : h`<label>Ideas <span class="mini" data-cuenta></span></label><div class="fuentes">${lista(candidatas.map(n => h`<label><input type="checkbox" value="${n.id}" ${marcadas.has(n.id) ? 'checked' : ''}><span><b>${n.titulo || n.texto.slice(0, 60)}</b> <span class="mini">${fechaCorta(n.fecha)}</span></span></label>`))}</div>
        <div class="acciones"><button type="button" class="btn mini" data-f="todas">Todas</button><button type="button" class="btn mini" data-f="ninguna">Ninguna</button></div>`}
    <label>Roles <span class="mini" data-cuantos></span></label><div class="roles" data-roles></div>
    <div class="acciones"><button type="button" class="btn mini" data-r="todos">Todos</button><button type="button" class="btn mini" data-r="ninguno">Ninguno</button></div>
    <label>Modelo</label><div data-modelo></div>
    <label for="c_instruccion">Qué quieres que miren (opcional)</label>
    <textarea id="c_instruccion" name="instruccion" rows="2" placeholder="Por ejemplo: ¿merece la pena empezar este mes?">${previo?.instruccion || ''}</textarea>
    <div class="coste" data-coste></div>
    <div class="acciones fin"><button type="button" class="btn" data-cancelar>Cancelar</button><button type="submit" class="btn p" data-si>Generar</button></div></form>`;
  document.body.appendChild(dlg);
  const form = dlg.querySelector('form'), $ = s => dlg.querySelector(s);
  montarCajas(form);
  const fuentesElegidas = () => previo ? previo.fuentes : candidatas.filter(n => marcadas.has(n.id));
  const pintar = () => {
    const todos = todosLosRoles();
    $('[data-roles]').innerHTML = [...todos.map(r => h`<button type="button" class="rol ${rolesSel.has(r.id) ? 'on' : ''}" data-rol="${r.id}"><b>${r.icono} ${r.nombre}</b><small>${r.propio ? 'PROPIO · ' : ''}${r.enfoque}</small></button>`.__crudo),
      '<button type="button" class="rol nuevo" data-rol="+">＋ Rol propio</button>'].join('');
    $('[data-cuantos]').textContent = rolesSel.size ? `· ${rolesSel.size} elegido${rolesSel.size === 1 ? '' : 's'} (tope ${MAX_ROLES})` : '';
    $('[data-modelo]').innerHTML = botonModelo(modeloDe(), modelo != null ? 'Solo para este informe' : 'El de Ajustes', 'modelo').__crudo;
    const cu = $('[data-cuenta]'); if (cu) cu.textContent = `· ${marcadas.size} de ${candidatas.length}${marcadas.size > MAX_FUENTES ? ` (tope ${MAX_FUENTES})` : ''}`;
    pintarCoste();
  };
  const pintarCoste = () => {
    const f = fuentesElegidas(), n = rolesSel.size, c = $('[data-coste]'), si = $('[data-si]');
    const car = f.reduce((t, x) => t + (x.texto || '').length + (x.titulo || '').length, 0);
    const m = infoModelo(modeloDe() || cat?.defecto);
    const fallo = !f.length ? 'Elige al menos una idea.' : f.length > MAX_FUENTES ? `Como mucho ${MAX_FUENTES} ideas por informe.` : !n ? 'Elige al menos un rol.' : '';
    si.disabled = !!fallo; c.className = 'coste';
    if (fallo) { c.textContent = fallo; return; }
    const coste = m ? estimar(n, car, f.length, m) : null, caro = coste != null && coste > UMBRAL_CARO;
    c.className = 'coste' + (caro ? ' caro' : '');
    c.innerHTML = esc(`${n + 1} llamadas (${n} ${n === 1 ? 'rol' : 'roles'} + síntesis)`) + (coste != null ? ` · <b>≈ ${esc(dolares(coste))}</b>` : '') + ` · ${n > 4 ? '2–3' : '1–2'} min`
      + (car > MAX_CARACTERES ? '<br>Son muchas letras: se recortan las ideas más largas y el informe lo dice.' : '')
      + (caro ? '<br>Es un informe caro con este modelo: revisa los roles o prueba uno más barato.' : '');
  };
  return new Promise(resolve => {
    const cerrar = v => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', e => { e.preventDefault(); cerrar(null); });
    dlg.onclick = async e => {
      const t = e.target;
      if (t.closest('[data-cancelar]')) return cerrar(null);
      const rb = t.closest('[data-rol]'), fb = t.closest('[data-f]'), tb = t.closest('[data-r]');
      if (rb && rb.dataset.rol === '+') { const id = await abrirRol(null); if (id && rolesSel.size < MAX_ROLES) rolesSel.add(id); pintar(); }
      else if (rb) { const id = rb.dataset.rol; if (rolesSel.has(id)) rolesSel.delete(id); else if (rolesSel.size < MAX_ROLES) rolesSel.add(id); else toast(`Como mucho ${MAX_ROLES} roles`); pintar(); }
      else if (tb) { rolesSel.clear(); if (tb.dataset.r === 'todos') todosLosRoles().slice(0, MAX_ROLES).forEach(r => rolesSel.add(r.id)); pintar(); }
      else if (fb) { marcadas.clear(); if (fb.dataset.f === 'todas') candidatas.slice(0, MAX_FUENTES).forEach(n => marcadas.add(n.id)); dlg.querySelectorAll('.fuentes input').forEach(i => { i.checked = marcadas.has(i.value); }); pintar(); }
      else if (t.closest('[data-a="modelo"]')) {
        const id = await elegirModelo({ titulo: 'Modelo para este informe', aviso: 'Solo cambia este informe; el de siempre está en Ajustes.', actual: modeloDe() });
        if (id != null) modelo = id === (estado.ajustes.modelo || '') ? null : id;
        pintar();
      }
    };
    dlg.onchange = e => { const i = e.target.closest('.fuentes input'); if (!i) return; if (i.checked) marcadas.add(i.value); else marcadas.delete(i.value); pintar(); };
    form.onsubmit = e => {
      e.preventDefault();
      const roles = todosLosRoles().filter(r => rolesSel.has(r.id)), f = fuentesElegidas();
      if (!roles.length || !f.length || f.length > MAX_FUENTES) return;
      estado.ajustes.rolesInforme = roles.map(r => r.id); persistir();
      cerrar({ roles, fuentes: f, modelo: modeloDe(), instruccion: form.elements.instruccion.value.trim() });
    };
    pintar(); dlg.showModal();
    if (!catalogoListo()) cargarCatalogo().then(() => { if (dlg.open) pintar(); });
  });
}
// Estimación (D62): unos 3,6 caracteres por token; cada rol escribe unos 1.200 y la síntesis 1.500.
export function estimar(nRoles, caracteres, nFuentes, m) {
  const material = Math.min(caracteres, MAX_CARACTERES) / 3.6 + nFuentes * 25 + 500;
  const entrada = nRoles * material + (material + nRoles * 1200), salida = nRoles * 1200 + 1500;
  return (entrada * m.entrada + salida * m.salida) / 1e6;
}

// ---------- Generación (D57, D63, D64) ----------
const copiaIdea = n => ({ id: n.id, titulo: n.titulo || n.texto.slice(0, 60), texto: n.texto, fecha: n.fecha, etiquetas: n.etiquetas || [] });
// Crea el informe y lo genera en segundo plano; devuelve su id al momento para ir a verlo.
export function crearInforme({ roles, fuentes, modelo, instruccion }) {
  const inf = { id: uid(), titulo: 'Informe en preparación', creado: new Date().toISOString(), generacion: 0, modelo, instruccion, fuentes: fuentes.map(copiaIdea), roles: roles.map(copiaRol) };
  estado.informes.unshift(inf);
  generar(inf);
  return inf.id;
}
const copiaRol = r => ({ id: r.id, nombre: r.nombre, icono: r.icono, enfoque: r.enfoque, estado: 'espera', texto: '', error: '' });
// Regenerar: roles, modelo e instrucción nuevos sobre las mismas ideas (con su texto actual si existen).
export function regenerar(inf, { roles, modelo, instruccion }) {
  inf.fuentes = inf.fuentes.map(f => { const n = estado.notas.find(x => x.id === f.id); return n ? copiaIdea(n) : f; });
  Object.assign(inf, { roles: roles.map(copiaRol), modelo, instruccion, editado: false });
  generar(inf);
}
const enCurso = new Set();
export const generando = inf => enCurso.has(inf.id);
function generar(inf) {
  inf.generacion = (inf.generacion || 0) + 1;
  Object.assign(inf, { estado: 'generando', sintesis: '', texto: '', error: '', coste: null, servido: '' });
  trabajar(inf);
}
// Reintentar (D64): rehace solo los roles fallidos y la síntesis, en la misma operación (el coste suma).
export function reintentar(inf) {
  if (enCurso.has(inf.id)) return;
  inf.roles.forEach(r => { if (r.estado !== 'hecho') Object.assign(r, { estado: 'espera', error: '' }); });
  Object.assign(inf, { estado: 'generando', sintesis: '', error: '', editado: false });
  trabajar(inf);
}
async function trabajar(inf) {
  enCurso.add(inf.id); guardar();
  const op = `informe-${inf.id}-${inf.generacion}`, material = materialDe(inf);
  const llamar = (tarea, contenido) => consultar({ modo: 'informe', operacion: op, modelo: inf.modelo, contexto: false, tarea, mensajes: [{ rol: 'usuario', contenido }] });
  const cola = inf.roles.filter(r => r.estado !== 'hecho');
  const hilo = async () => {
    for (let r; (r = cola.shift());) {
      r.estado = 'trabajando'; guardar();
      try {
        const j = await llamar(tareaRol(r), material);
        r.texto = bajarTitulos(j.respuesta); if (!r.texto.trim()) throw new Error('respuesta vacía');
        Object.assign(r, { estado: 'hecho', servido: j.modelo || '', cortada: !!j.cortada });
      } catch (e) { Object.assign(r, { estado: 'fallido', error: e.message }); }
      guardar();
    }
  };
  await Promise.all(Array.from({ length: Math.min(SIMULTANEOS, cola.length) }, hilo));
  const hechos = inf.roles.filter(r => r.estado === 'hecho');
  if (hechos.length) {
    inf.estado = 'sintesis'; guardar();
    try {
      const j = await llamar(tareaSintesis(hechos.length), material + '\n\nAnálisis de cada rol:\n\n' + hechos.map(r => `### ${r.icono} ${r.nombre}\n\n${r.texto.trim()}`).join('\n\n'));
      inf.sintesis = j.respuesta.trim(); inf.servido = j.modelo || hechos[0].servido || '';
      if (!inf.sintesis) throw new Error('respuesta vacía');
    } catch (e) { inf.sintesis = ''; inf.error = 'La síntesis falló: ' + e.message; }
  } else inf.error = 'Ningún rol respondió' + (inf.roles[0]?.error ? ': ' + inf.roles[0].error : '');
  inf.estado = !hechos.length ? 'fallido' : inf.sintesis && hechos.length === inf.roles.length ? 'listo' : 'incompleto';
  inf.coste = await costeDe('maydom-' + op).catch(() => null);
  inf.titulo = tituloDe(inf); inf.texto = componer(inf);
  enCurso.delete(inf.id); guardar();
  toast(inf.estado === 'listo' ? 'Informe listo: ' + inf.titulo : inf.estado === 'fallido' ? 'El informe falló: ' + inf.error : 'Informe con fallos: se puede reintentar', 5000);
}
// Al cargar la app nada se está generando: lo que quedó a medias pasa a fallido y se puede reintentar.
export function recuperarInformes() {
  let cambio = false;
  for (const inf of estado.informes) if (['generando', 'sintesis'].includes(inf.estado)) {
    inf.roles.forEach(r => { if (r.estado !== 'hecho') Object.assign(r, { estado: 'fallido', error: 'la app se cerró a medias' }); });
    const hechos = inf.roles.some(r => r.estado === 'hecho');
    Object.assign(inf, { estado: hechos ? 'incompleto' : 'fallido', error: 'La app se cerró a medias', titulo: tituloDe(inf) });
    inf.texto = componer(inf); cambio = true;
  }
  if (cambio) persistir();
}

// ---------- Prompts (los de `prueba`, D57/D58: markdown libre, vale cualquier modelo) ----------
function tareaRol(r) {
  return `Eres el rol «${r.nombre}» (${r.icono}) de un equipo que analiza las ideas y notas personales de una persona. Tu enfoque: ${r.enfoque.trim()}
Lee todas las ideas y analízalas desde ese enfoque y solo desde ese: otros roles cubren lo demás. Devuelve solo markdown, sin ningún encabezado con almohadillas, con exactamente estas cuatro partes y en este orden:
**Veredicto:** una o dos frases con tu conclusión.
**Hallazgos** y debajo una lista con guiones de 3 a 6 puntos; cada uno es una idea concreta que se apoya en lo que dicen las notas.
**Recomendaciones** y debajo una lista numerada de 2 a 5 acciones concretas.
**Preguntas abiertas** y debajo una lista con guiones de 1 a 3 preguntas cerradas que habría que contestar.
Si te falta información para tu enfoque, dilo en Hallazgos. Una cifra que no salga de las notas va marcada como orden de magnitud.`;
}
function tareaSintesis(n) {
  const tensiones = n === 1 ? 'como solo hay un rol, una sola línea que diga que con un rol no hay tensiones que comparar.'
    : 'cada punto va como `**Rol A ↔ Rol B:** en qué chocan y qué propones`; si no chocan en nada importante, una línea que lo diga.';
  return `Coordinas un equipo de analistas que ha revisado las mismas ideas desde enfoques distintos. Recibes las ideas y el análisis de cada rol, y escribes la cabecera de un informe único. Devuelve solo markdown con esta estructura exacta:
\`# \` y el título: una frase corta y concreta sobre de qué va el informe, sin comillas ni punto final.
\`## Resumen ejecutivo\`: un párrafo de cinco a ocho líneas para alguien que no ha leído nada: qué es, qué concluyen los roles y cuál es el mayor riesgo.
\`## Conclusiones clave\`: lista numerada de 3 a 6 conclusiones en las que coinciden varios roles, cada una empezando por la idea en negrita.
\`## Tensiones entre roles\`: ${tensiones}
\`## Plan de acción\`: lista numerada de 3 a 7 acciones ordenadas por prioridad; cada una empieza por **Alta**, **Media** o **Baja** seguida de una raya.
\`## Preguntas abiertas\`: lista con guiones de las preguntas más importantes que quedan, sin repetirlas.
No copies el análisis de cada rol, que va entero detrás: sintetiza y cruza. No escribas ninguna otra sección: el resto del informe lo añade la aplicación.`;
}
// Las ideas en el formato que lee el modelo, de la más antigua a la más reciente, recortadas por idea si
// no caben (un corte global dejaría fuera las últimas). La petición de la persona va delante de todo.
function materialDe(inf) {
  const fs = [...inf.fuentes].sort((a, b) => a.fecha.localeCompare(b.fecha)), por = Math.floor(MAX_CARACTERES / Math.max(1, fs.length));
  let recortadas = 0;
  const partes = fs.map((f, i) => {
    const t = f.texto.length > por ? (recortadas++, f.texto.slice(0, por) + '…') : f.texto;
    return `### Idea ${i + 1} — ${f.titulo} (${fechaCorta(f.fecha)})${f.etiquetas.length ? ' · etiquetas: ' + f.etiquetas.join(', ') : ''}\n${t}`;
  });
  return (inf.instruccion ? `Lo que pide la persona: ${inf.instruccion}\n\n` : '') + 'Ideas y notas, de la más antigua a la más reciente:\n\n' + partes.join('\n\n')
    + (recortadas ? `\n\n(Aviso: ${recortadas} idea(s) se han recortado por longitud; dilo si te falta algo.)` : '');
}
// Un rol no debe traer encabezados; si los trae, bajan de nivel para no romper la estructura del informe.
const bajarTitulos = t => String(t || '').replace(/^#{1,3}\s+/gm, '#### ').trim();

// ---------- Composición (D57) ----------
function tituloDe(inf) {
  const l = (inf.sintesis || '').split('\n').find(x => x.trim());
  const t = l && /^#\s+/.test(l.trim()) ? l.trim().replace(/^#\s+/, '').replace(/[*"«»]/g, '').replace(/\.$/, '').trim().slice(0, 80) : '';
  return t || 'Informe: ' + (inf.fuentes[0]?.titulo || 'ideas');
}
export function componer(inf) {
  const cuerpo = (inf.sintesis || '').split('\n'), i = cuerpo.findIndex(x => x.trim());
  const sintesis = i >= 0 && /^#\s+/.test(cuerpo[i].trim()) ? cuerpo.slice(i + 1).join('\n').trim() : (inf.sintesis || '').trim();
  const out = [`# ${tituloDe(inf)}`, '', sintesis || `_Sin síntesis (${inf.error || 'no se hizo'}); se puede reintentar desde la app._`, '', '## Análisis por rol', ''];
  for (const r of inf.roles) out.push(`### ${r.icono} ${r.nombre}`, '', r.estado === 'hecho' ? r.texto.trim() + (r.cortada ? '\n\n_(El modelo cortó este análisis por longitud.)_' : '') : `_Este rol no respondió (${r.error || 'sin detalle'}); se puede reintentar desde la app._`, '');
  out.push('## Ideas de origen', '', ...inf.fuentes.map(f => `- ${f.titulo} (${fechaCorta(f.fecha)})`), '', '## Ficha', '');
  const pedido = inf.modelo ? '`' + inf.modelo + '`' : 'el del servidor';
  out.push(`- **Modelo:** ${pedido}${inf.servido && inf.servido !== inf.modelo ? ' (servido por `' + inf.servido + '`)' : ''}`,
    `- **Roles:** ${inf.roles.map(r => r.nombre).join(', ')}`,
    `- **Llamadas:** ${inf.roles.length + 1} · **Coste:** ${inf.coste != null ? dolares(inf.coste) : 'no disponible'}`,
    `- **Generado:** ${fechaHora(inf.creado)}`);
  if (inf.instruccion) out.push(`- **Instrucción:** ${inf.instruccion}`);
  return out.join('\n') + '\n';
}
const fechaHora = iso => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export { fechaHora };

// ---------- Salidas: copiar, descargar e imprimir (D65) ----------
export function copiarInforme(inf) {
  const hecho = () => toast('Informe copiado');
  if (navigator.clipboard) return navigator.clipboard.writeText(inf.texto).then(hecho).catch(() => copiarViejo(inf.texto) && hecho());
  if (copiarViejo(inf.texto)) hecho(); else toast('No se pudo copiar');
}
function copiarViejo(t) {
  const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { } ta.remove(); return ok;
}
export const nombreFichero = inf => (clave(inf.titulo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'informe') + '.md';
export function descargarInforme(inf) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([inf.texto], { type: 'text/markdown' })); a.download = nombreFichero(inf); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function compartirInforme(inf) {
  const f = new File([inf.texto], nombreFichero(inf), { type: 'text/markdown' });
  try { if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: inf.titulo }); else await navigator.share({ title: inf.titulo, text: inf.texto }); }
  catch (e) { if (e.name !== 'AbortError') toast('No se pudo compartir'); }
}
