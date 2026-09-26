// Núcleo de maydom: estado local, utilidades, router, modales y avisos.
import { formatearFicha } from './ficha-plato.js';
export const CLAVE = 'maydom.v1';
export const VERSION_ESQUEMA = 1;

const vacio = () => ({
  version: VERSION_ESQUEMA,
  preferencias: {
    horizonte: 'semana', energia: 3, foco: '', cargaMax: 6, pildoraCada: 60, rezagoDias: 7,
    tiposEjercicio: ['calistenia', 'movilidad'], restricciones: '', tiposOcio: ['cultura', 'social'],
    ocioPorMes: 4, presupuestoOcio: 100, horaAcostarse: '23:00', objetivoSueno: 7, notas: '',
    actualizado: null,
  },
  historialPreferencias: [],
  eventos: [], notas: [], ejercicios: [], tablas: [], sesionesEjercicio: [], pildoras: [],
  sueno: [], alimentos: [], platos: [], menus: [], comidas: [],
  suplementos: [], tomas: [], compra: [], proyectos: [], horas: [], sesionTrabajo: null,
  ocio: [], movimientos: [], recurrentes: [], importaciones: [], tiendas: [], consejos: [], chat: [], memoria: [],
  accesos: [], usos: {},
  ajustes: { backend: '', clave: '', avisos: false, tema: 'auto', semillasCargadas: false, llm: null },
});

function cargar() {
  let e = null;
  try { e = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { e = null; }
  const base = vacio();
  if (!e || typeof e !== 'object') return base;
  // Migración por fusión: cualquier clave nueva del esquema aparece con su valor por defecto.
  for (const k of Object.keys(base)) if (!(k in e)) e[k] = base[k];
  e.preferencias = { ...base.preferencias, ...(e.preferencias || {}) };
  e.ajustes = { ...base.ajustes, ...(e.ajustes || {}) };
  // Un plato tenía un único momento; ahora puede ser de varios. Se migra al cargar y se persiste,
  // porque una migración que solo vive en memoria vuelve a hacerse en cada arranque.
  for (const p of e.platos || []) if (!Array.isArray(p.momentos)) { p.momentos = p.tipo ? [p.tipo] : []; delete p.tipo; e.__migrado = true; }
  // Toda ficha de plato con apartados reconocibles pasa al formato de «Sopas de ajo castellana».
  for (const p of e.platos || []) if (p.descripcion) { const f = formatearFicha(p.descripcion); if (f !== p.descripcion) { p.descripcion = f; e.__migrado = true; } }
  // Las tiendas ganan dominio (para buscar en el sitio) y marca de verificada. Las tres plantillas
  // que se comprobaron rotas el 21-sep se vacían: esa tienda pasa a buscarse en su propio sitio.
  // De cinco plantillas escritas a ojo, cuatro fallaron en la tienda real. Las que nadie ha dado
  // por buenas se retiran y esa tienda pasa a buscarse dentro de su web.
  for (const t of e.tiendas || []) {
    if (!t.dominio) {
      try { t.dominio = new URL(String(t.url || '').replace('{q}', 'x')).hostname; } catch { t.dominio = ''; }
      e.__migrado = true;
    }
    if (t.url && !t.verificada) { t.url = ''; e.__migrado = true; }
    if (t.verificada === undefined) { t.verificada = false; e.__migrado = true; }
  }
  // Las notas se reparten en tareas, compras e ideas: todas las de antes son ideas.
  for (const n of e.notas || []) if (!n.clase) { n.clase = 'idea'; e.__migrado = true; }
  e.version = VERSION_ESQUEMA;
  return e;
}

export const estado = cargar();
if (estado.__migrado) { delete estado.__migrado; try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { } }
const oyentes = new Set();
export function alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
export function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { toast('No se pudo guardar: ' + e.message); }
  for (const fn of oyentes) fn();
}
// Escribe sin avisar a los oyentes: para lo que no cambia nada visible (contar usos) y no debe repintar.
export function persistir() { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { } }
export function reemplazarEstado(nuevo) {
  for (const k of Object.keys(estado)) delete estado[k];
  Object.assign(estado, vacio(), nuevo);
  guardar();
}

// ---------- utilidades ----------
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
export const pad = n => String(n).padStart(2, '0');
export function fechaISO(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export const hoyISO = () => fechaISO(new Date());
export function horaActual() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function sumarDias(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return fechaISO(d); }
export function minutos(hhmm) { if (!hhmm) return 0; const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); }
export function hhmm(min) { min = ((min % 1440) + 1440) % 1440; return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }
export function duracionTexto(min) { if (min == null || isNaN(min)) return '–'; const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} h${m ? ' ' + pad(m) : ''}` : `${m} min`; }
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// Toda fecha que se pinta en pantalla va en día/mes/año: el ISO solo vive en los datos y en los
// <input type=date>, que ya los muestra el navegador en el formato del sistema.
export function fechaCorta(iso) { const d = new Date(iso + 'T12:00:00'); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
export function fechaLarga(iso) { const d = new Date(iso + 'T12:00:00'); return `${DIAS[d.getDay()]} ${fechaCorta(iso)}`; }
export const mesNombre = mes => `${MESES_LARGO[Number(mes.slice(5)) - 1]} ${mes.slice(0, 4)}`;
export const mesAbrev = mes => MESES[Number(mes.slice(5)) - 1];
export function diaSemana(iso) { return new Date(iso + 'T12:00:00').getDay(); }
export function mesISO(iso) { return iso.slice(0, 7); }
export function diasEntre(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
export const euros = n => (Math.round(n * 100) / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function crudo(s) { return { __crudo: String(s) }; }
// Plantilla con escape automático; los valores crudo() y los arrays de crudo() se insertan tal cual.
// Devuelve un String marcado como crudo: una plantilla h anidada en otra no se vuelve a escapar.
export function h(partes, ...vals) {
  const s = partes.reduce((acc, p, i) => {
    let v = vals[i - 1];
    if (Array.isArray(v)) v = v.map(x => (x && x.__crudo != null ? x.__crudo : esc(x))).join('');
    else if (v && v.__crudo != null) v = v.__crudo;
    else v = esc(v == null ? '' : v);
    return acc + v + p;
  });
  const out = new String(s); out.__crudo = s; return out;
}
export const lista = arr => crudo(arr.join(''));

// ---------- UI ----------
export function toast(msg, ms = 2600) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('ver');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('ver'), ms);
}

// Botón que acaba de abrir una ventana (lo anota app.js): pedir() le pone ☆ para fijarlo en Hoy.
let origen = null;
export function anotarOrigen(o) { origen = o ? { ...o, t: Date.now() } : null; }
// El botón fijable que acaba de abrir una ventana (o null), y se olvida: solo lo toma una ventana.
export function tomarOrigen() { const o = origen && Date.now() - origen.t < 3000 ? origen : null; origen = null; return o; }

// ---------- cajas de texto redimensionables (mock 6) ----------
// El tirador nativo de la esquina no se arrastra con el dedo en el móvil: bajo cada <textarea> va un
// asa a lo ancho (arrastre, doble toque para compacta ↔ grande, flechas) y ⤢ para escribir a pantalla
// completa. La caja crece sola mientras se escribe hasta que el usuario la ajusta (lo manual manda), y
// esa altura se recuerda por sección y campo en una clave aparte, fuera del estado.
const CLAVE_TEXTOS = 'maydom.textos';
const tamanos = () => { try { return JSON.parse(localStorage.getItem(CLAVE_TEXTOS)) || {}; } catch { return {}; } };
function recordarTamano(clave, alto) {
  try { const t = tamanos(); if (alto) t[clave] = Math.round(alto); else delete t[clave]; localStorage.setItem(CLAVE_TEXTOS, JSON.stringify(t)); } catch { }
}
export function crecer(t, tope = Number(t.dataset.tope) || 0.6) {
  if (t.dataset.manual) return;
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight + 2, innerHeight * tope) + 'px';
}
// Lo que se coloca detrás de una caja (botones, micrófono) va después de su asa.
export const finCaja = t => (t.nextElementSibling?.classList.contains('asa-texto') ? t.nextElementSibling : t);
// Toda caja nueva fuera de pedir() llama a esto al crearse; `tope` es la fracción de pantalla hasta la que crece sola.
export function montarCajas(raiz, tope = 0.6) { raiz.querySelectorAll('textarea:not(.con-asa)').forEach(t => montarCaja(t, tope)); }
function montarCaja(ta, tope) {
  ta.classList.add('con-asa'); ta.dataset.tope = tope;
  const clave = `${rutaActual().id}:${ta.name || ta.id}`;
  const barra = document.createElement('div');
  barra.className = 'asa-texto';
  barra.innerHTML = '<div class="asa" role="separator" aria-orientation="horizontal" tabindex="0" aria-label="Arrastra para cambiar el alto" title="Arrastra · doble toque: compacta o grande"><span></span></div><button type="button" class="ampliar" aria-label="Escribir a pantalla completa" title="Pantalla completa">⤢</button>';
  ta.insertAdjacentElement('afterend', barra);
  const asa = barra.firstElementChild;
  const fijar = alto => { alto = Math.max(72, Math.min(alto, innerHeight * 0.8)); ta.style.height = alto + 'px'; ta.dataset.manual = '1'; return alto; };
  const guardada = tamanos()[clave];
  if (guardada) fijar(guardada);
  ta.addEventListener('input', () => crecer(ta));
  let y0 = 0, h0 = 0, movido = false, ultimo = 0;
  asa.addEventListener('pointerdown', e => {
    e.preventDefault(); asa.setPointerCapture?.(e.pointerId);
    y0 = e.clientY; h0 = ta.getBoundingClientRect().height; movido = false;
    barra.classList.add('arrastrando');
  });
  asa.addEventListener('pointermove', e => {
    if (!barra.classList.contains('arrastrando')) return;
    if (Math.abs(e.clientY - y0) > 3) movido = true;
    if (movido) fijar(h0 + e.clientY - y0);
  });
  const soltar = () => {
    if (!barra.classList.contains('arrastrando')) return;
    barra.classList.remove('arrastrando');
    if (movido) return recordarTamano(clave, ta.getBoundingClientRect().height);
    // Doble toque: compacta ↔ grande. Un toque suelto no hace nada.
    const ahora = Date.now();
    if (ahora - ultimo > 350) { ultimo = ahora; return; }
    ultimo = 0;
    if (ta.getBoundingClientRect().height < innerHeight * 0.45) recordarTamano(clave, fijar(innerHeight * 0.6));
    else { delete ta.dataset.manual; recordarTamano(clave, 0); crecer(ta); }
  };
  asa.addEventListener('pointerup', soltar);
  asa.addEventListener('pointercancel', soltar);
  asa.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    recordarTamano(clave, fijar(ta.getBoundingClientRect().height + (e.key === 'ArrowDown' ? 32 : -32)));
  });
  barra.querySelector('.ampliar').onclick = () => pantallaCompleta(ta, true);
}
// A pantalla completa la caja no se mueve de sitio (ni pierde el foco ni lo escrito): pasa a fija y
// encima va una cabecera con «Listo». Con el teclado abierto se encoge a lo que queda visible.
function pantallaCompleta(ta, on) {
  const vv = window.visualViewport;
  if (on) {
    const cab = document.createElement('div');
    cab.className = 'cab-pantalla';
    cab.innerHTML = '<b></b><button type="button" class="btn p">Listo</button>';
    const etiqueta = ta.id ? ta.closest('form, dialog, main')?.querySelector(`label[for="${ta.id}"]`) : null;
    cab.querySelector('b').textContent = etiqueta?.textContent.trim() || 'Texto';
    cab.querySelector('button').onclick = () => pantallaCompleta(ta, false);
    finCaja(ta).insertAdjacentElement('afterend', cab);
    ta.cabPantalla = cab;
    ta.ajustarPantalla = () => { if (vv) ta.style.bottom = Math.max(0, innerHeight - vv.height - vv.offsetTop) + 'px'; };
    vv?.addEventListener('resize', ta.ajustarPantalla);
    ta.ajustarPantalla();
    ta.classList.add('a-pantalla'); document.documentElement.classList.add('con-pantalla');
  } else {
    ta.cabPantalla?.remove(); ta.cabPantalla = null;
    vv?.removeEventListener('resize', ta.ajustarPantalla);
    ta.style.bottom = '';
    ta.classList.remove('a-pantalla'); document.documentElement.classList.remove('con-pantalla');
    crecer(ta);
  }
  ta.focus();
}
// Esc o «atrás» con una caja a pantalla completa la devuelven a su sitio en vez de cerrar la ventana.
export function salirPantalla(raiz = document) {
  const t = raiz.querySelector('textarea.a-pantalla');
  if (!t) return false;
  pantallaCompleta(t, false);
  return true;
}

// Formulario declarativo dentro de un <dialog>. Devuelve el objeto con los valores o null.
// campo: {n, l, t:'text|number|date|time|select|textarea|check|tags', o:[{v,l}]|[str], v, req, min, max, step, ph, ayuda}
export function pedir(titulo, campos, valores = {}, opciones = {}) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal';
    const fijable = tomarOrigen();
    const f = campos.map(c => campoHTML(c, valores[c.n] ?? c.v)).join('');
    dlg.innerHTML = h`<form method="dialog" class="form">
      <div class="cabecera-modal"><h2>${titulo}</h2>
        ${fijable ? crudo('<button type="button" class="fijar" data-fijar aria-label="Fijar en inicio" title="Fijar en inicio">☆</button>') : ''}
        <button type="button" class="cerrar" data-cancelar aria-label="Cerrar sin guardar" title="Cerrar sin guardar">✕</button></div>${crudo(f)}
      ${opciones.texto ? crudo('<p class="mini">' + esc(opciones.texto) + '</p>') : ''}
      ${opciones.acciones ? crudo('<div class="acciones" data-acciones>' + opciones.acciones.map((x, i) => `<button type="button" class="btn ${esc(x.clase || '')}" data-accion="${i}">${esc(x.l)}</button>`).join('') + '</div>') : ''}
      <div class="acciones fin">
        ${opciones.extra ? crudo(`<button type="button" class="btn peligro" data-extra>${esc(opciones.extra)}</button>`) : ''}
        ${opciones.otro ? crudo(`<button type="button" class="btn" data-otro>${esc(opciones.otro)}</button>`) : ''}
        <button type="button" class="btn" data-cancelar>Cancelar</button>
        <button type="submit" class="btn p">${opciones.aceptar || 'Guardar'}</button></div></form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form');
    montarCajas(form);
    const cerrar = v => { salirPantalla(dlg); dlg.close(); dlg.remove(); resolve(v); };
    dlg.querySelectorAll('[data-cancelar]').forEach(b => { b.onclick = () => cerrar(null); });
    const fj = dlg.querySelector('[data-fijar]'); if (fj) fj.onclick = () => { cerrar(null); import('./accesos.js').then(m => m.abrirFijar({ ops: [fijable] })); };
    const ex = dlg.querySelector('[data-extra]'); if (ex) ex.onclick = () => cerrar({ __extra: true });
    const ot = dlg.querySelector('[data-otro]'); if (ot) ot.onclick = () => cerrar({ __otro: true });
    const leer = () => Object.fromEntries(campos.map(c => [c.n, form.elements[c.n]?.value]));
    // Las cajas de texto crecen con lo que se escribe, se dicta o genera la IA (hasta el 60 % de la pantalla; luego, barra),
    // salvo que el usuario les haya dado alto con el asa.
    const escribir = datos => { for (const [k, v] of Object.entries(datos)) { const el = form.elements[k]; if (el && v != null && v !== '') { el.value = v; if (el.tagName === 'TEXTAREA') crecer(el); } } };
    const zonaAcciones = dlg.querySelector('[data-acciones]');
    if (zonaAcciones && opciones.accionesTras) {
      const campo = form.elements[opciones.accionesTras];
      if (campo) finCaja(campo).insertAdjacentElement('afterend', zonaAcciones);
    }
    dlg.querySelectorAll('[data-accion]').forEach(b => {
      const acc = opciones.acciones[Number(b.dataset.accion)];
      b.onclick = async () => {
        const txt = b.textContent; b.disabled = true; b.textContent = acc.cargando || '…';
        try { await acc.fn({ valores: leer(), escribir, form }); }
        finally { b.disabled = false; b.textContent = txt; }
      };
    });
    // Dictado: solo aparece si el navegador lo trae; si no, el formulario queda igual que antes.
    if (opciones.dictar) import('./voz.js').then(v => {
      const campo = form.elements[opciones.dictar];
      const zona = opciones.accionesTras === opciones.dictar ? dlg.querySelector('[data-acciones]') : null;
      if (campo) v.botonDictado(campo, zona || (campo.parentElement === form ? finCaja(campo).insertAdjacentElement('afterend', document.createElement('div')) : null),
        opciones.alDictar ? texto => opciones.alDictar(texto, { escribir, form }) : null);
    }).catch(() => { });
    dlg.addEventListener('cancel', e => { e.preventDefault(); if (!salirPantalla(dlg)) cerrar(null); });
    form.onsubmit = e => {
      e.preventDefault();
      const out = {};
      for (const c of campos) {
        const el = form.elements[c.n];
        if (!el && c.t !== 'checks') continue;
        if (c.t === 'checks') out[c.n] = [...form.querySelectorAll(`[name="${c.n}"]:checked`)].map(x => x.value);
        else if (c.t === 'check') out[c.n] = !!el.checked;
        else if (c.t === 'number') out[c.n] = el.value === '' ? null : Number(el.value);
        else if (c.t === 'tags') out[c.n] = el.value.split(',').map(s => s.trim()).filter(Boolean);
        else out[c.n] = el.value;
        if (c.req && (out[c.n] === '' || out[c.n] == null)) { el.focus?.(); toast('Falta: ' + c.l); return; }
      }
      cerrar(out);
    };
    dlg.showModal();
    form.querySelectorAll('textarea').forEach(t => crecer(t));
    // Para lo que se pinta dentro de la ventana según se escribe (el volumen de Ejercicio).
    opciones.alAbrir?.({ escribir, form });
    const primero = form.querySelector('input:not([type=checkbox]),select,textarea'); if (primero) primero.focus();
  });
}
function campoHTML(c, v) {
  const id = 'c_' + c.n;
  const ayuda = c.ayuda ? `<small class="mini">${esc(c.ayuda)}</small>` : '';
  if (c.t === 'check') return `<label class="check"><input type="checkbox" name="${c.n}" ${v ? 'checked' : ''}> ${esc(c.l)}</label>${ayuda}`;
  // Varias opciones a la vez: casillas en fila, que en el móvil se tocan mejor que un desplegable.
  if (c.t === 'checks') {
    const marcadas = Array.isArray(v) ? v.map(String) : [];
    const ops = (c.o || []).map(o => { const ov = typeof o === 'object' ? o.v : o, ol = typeof o === 'object' ? o.l : o;
      return `<label class="check opcion"><input type="checkbox" name="${c.n}" value="${esc(ov)}" ${marcadas.includes(String(ov)) ? 'checked' : ''}> ${esc(ol)}</label>`; }).join('');
    return `<label>${esc(c.l)}</label><div class="opciones">${ops}</div>${ayuda}`;
  }
  if (c.t === 'select') {
    const ops = (c.o || []).map(o => { const ov = typeof o === 'object' ? o.v : o, ol = typeof o === 'object' ? o.l : o; return `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('');
    return `<label for="${id}">${esc(c.l)}</label><select id="${id}" name="${c.n}">${ops}</select>${ayuda}`;
  }
  if (c.t === 'textarea') return `<label for="${id}">${esc(c.l)}</label><textarea id="${id}" name="${c.n}" rows="${c.filas || 3}" placeholder="${esc(c.ph || '')}">${esc(v ?? '')}</textarea>${ayuda}`;
  const tipo = c.t === 'tags' ? 'text' : (c.t || 'text');
  const val = c.t === 'tags' ? (Array.isArray(v) ? v.join(', ') : (v ?? '')) : (v ?? '');
  const attrs = ['min', 'max', 'step'].filter(a => c[a] != null).map(a => `${a}="${c[a]}"`).join(' ');
  return `<label for="${id}">${esc(c.l)}</label><input id="${id}" type="${tipo}" name="${c.n}" value="${esc(val)}" placeholder="${esc(c.ph || '')}" ${attrs} ${c.req ? 'required' : ''}>${ayuda}`;
}
export function confirmar(texto, aceptar = 'Sí') {
  return pedir('Confirmar', [], {}, { texto, aceptar }).then(v => !!v);
}

// Delegación de eventos: data-a (click), data-c (change) y data-i (mientras se escribe).
export function delegar(cont, acciones) {
  // Un buscador tiene que filtrar según se teclea, no al salir del campo. Como la acción vuelve a
  // pintar la sección entera, hay que devolver el foco y el cursor al campo recién creado.
  let temporizador = null;
  cont.oninput = e => {
    const el = e.target.closest('[data-i]'); if (!el) return;
    const fn = acciones[el.dataset.i]; if (!fn) return;
    const clave = el.dataset.i, pos = el.selectionStart;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      fn(el, e);
      const nuevo = cont.querySelector(`[data-i="${clave}"]`);
      if (nuevo && nuevo !== document.activeElement) {
        nuevo.focus();
        try { nuevo.setSelectionRange(pos ?? nuevo.value.length, pos ?? nuevo.value.length); } catch { }
      }
    }, 220);
  };
  cont.onclick = e => {
    const el = e.target.closest('[data-a]'); if (!el || !cont.contains(el)) return;
    const fn = acciones[el.dataset.a]; if (!fn) return;
    // Un <a> con destino propio (no ancla) navega y la acción solo acompaña al clic: cancelarlo
    // dejaba muerto el botón «abrir ↗» del buscador, que es un enlace con data-a para marcar la
    // tienda como comprobada. Todo lo demás (botones, celdas) sí se cancela como siempre.
    const href = el.tagName === 'A' ? el.getAttribute('href') || '' : '';
    if (!href || href.startsWith('#')) e.preventDefault();
    fn(el, e);
  };
  cont.onchange = e => {
    const el = e.target.closest('[data-c]'); if (!el) return;
    const fn = acciones[el.dataset.c]; if (fn) fn(el, e);
  };
}

// ---------- router ----------
export const secciones = [];
export function registrar(s) { secciones.push(s); }
export function seccion(id) { return secciones.find(s => s.id === id); }
export function navegar(id, params = {}) {
  const q = new URLSearchParams(params).toString();
  location.hash = '#/' + id + (q ? '?' + q : '');
}
export function rutaActual() {
  const m = location.hash.match(/^#\/([a-z]+)(?:\?(.*))?$/);
  return { id: m ? m[1] : 'hoy', params: Object.fromEntries(new URLSearchParams(m && m[2] ? m[2] : '')) };
}

// ---------- backend ----------
export function urlBackend() {
  if (estado.ajustes.backend) return estado.ajustes.backend.replace(/\/$/, '');
  const meta = document.querySelector('meta[name="fly-app"]')?.content || '';
  const p = new URLSearchParams(location.search);
  const enLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  return enLocal ? `${location.protocol}//${location.hostname}:${p.get('api') || '8080'}` : `https://${meta}.fly.dev`;
}

// ---------- avisos ----------
const avisados = new Set();
export async function pedirPermisoAvisos() {
  if (!('Notification' in window)) { toast('Este navegador no admite avisos'); return false; }
  const r = await Notification.requestPermission();
  estado.ajustes.avisos = r === 'granted'; guardar();
  return estado.ajustes.avisos;
}
export async function avisar(titulo, cuerpo, clave) {
  if (clave) { if (avisados.has(clave)) return; avisados.add(clave); }
  toast(`${titulo} · ${cuerpo}`, 5000);
  if (!estado.ajustes.avisos || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(titulo, { body: cuerpo, icon: 'app/icono.svg', tag: clave || undefined });
    else new Notification(titulo, { body: cuerpo });
  } catch { /* sin aviso del sistema */ }
}
// Comprueba cada minuto eventos y tomas próximas; las píldoras las lleva la sección Proyectos.
export function arrancarVigilante() {
  const tick = () => {
    const hoy = hoyISO(), ahora = minutos(horaActual());
    for (const ev of estado.eventos) {
      if (ev.fecha !== hoy || ev.hecho || !ev.hora) continue;
      const d = minutos(ev.hora) - ahora;
      if (d >= 0 && d <= 5) avisar('En ' + d + ' min: ' + ev.titulo, ev.nota || seccion(ev.seccion)?.titulo || '', 'ev:' + ev.id + ':' + hoy);
    }
    for (const s of estado.suplementos) {
      if (!s.hora) continue;
      const tomada = estado.tomas.some(t => t.suplementoId === s.id && t.fecha === hoy);
      const d = minutos(s.hora) - ahora;
      if (!tomada && d >= 0 && d <= 2) avisar('Toma: ' + s.nombre, s.dosis || '', 'sup:' + s.id + ':' + hoy);
    }
  };
  tick(); setInterval(tick, 60000);
}
export const aviso = msg => crudo('<div class="tarjeta mini">' + esc(msg) + '</div>');
