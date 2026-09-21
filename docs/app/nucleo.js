// Núcleo de maydom: estado local, utilidades, router, modales y avisos.
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
  ocio: [], movimientos: [], recurrentes: [], tiendas: [], consejos: [], chat: [], memoria: [],
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
  e.version = VERSION_ESQUEMA;
  return e;
}

export const estado = cargar();
const oyentes = new Set();
export function alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
export function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { toast('No se pudo guardar: ' + e.message); }
  for (const fn of oyentes) fn();
}
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
export function fechaLarga(iso) { const d = new Date(iso + 'T12:00:00'); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; }
export function fechaCorta(iso) { const d = new Date(iso + 'T12:00:00'); return `${d.getDate()} ${MESES[d.getMonth()]}`; }
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

// Formulario declarativo dentro de un <dialog>. Devuelve el objeto con los valores o null.
// campo: {n, l, t:'text|number|date|time|select|textarea|check|tags', o:[{v,l}]|[str], v, req, min, max, step, ph, ayuda}
export function pedir(titulo, campos, valores = {}, opciones = {}) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal';
    const f = campos.map(c => campoHTML(c, valores[c.n] ?? c.v)).join('');
    dlg.innerHTML = h`<form method="dialog" class="form">
      <h2>${titulo}</h2>${crudo(f)}
      ${opciones.texto ? crudo('<p class="mini">' + esc(opciones.texto) + '</p>') : ''}
      <div class="acciones fin">
        ${opciones.extra ? crudo(`<button type="button" class="btn peligro" data-extra>${esc(opciones.extra)}</button>`) : ''}
        ${opciones.otro ? crudo(`<button type="button" class="btn" data-otro>${esc(opciones.otro)}</button>`) : ''}
        <button type="button" class="btn" data-cancelar>Cancelar</button>
        <button type="submit" class="btn p">${opciones.aceptar || 'Guardar'}</button></div></form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form');
    const cerrar = v => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.querySelector('[data-cancelar]').onclick = () => cerrar(null);
    const ex = dlg.querySelector('[data-extra]'); if (ex) ex.onclick = () => cerrar({ __extra: true });
    const ot = dlg.querySelector('[data-otro]'); if (ot) ot.onclick = () => cerrar({ __otro: true });
    // Dictado: solo aparece si el navegador lo trae; si no, el formulario queda igual que antes.
    if (opciones.dictar) import('./voz.js').then(v => {
      const campo = form.elements[opciones.dictar];
      if (campo) v.botonDictado(campo, campo.parentElement === form ? campo.insertAdjacentElement('afterend', document.createElement('div')) : null);
    }).catch(() => { });
    dlg.addEventListener('cancel', e => { e.preventDefault(); cerrar(null); });
    form.onsubmit = e => {
      e.preventDefault();
      const out = {};
      for (const c of campos) {
        const el = form.elements[c.n];
        if (!el) continue;
        if (c.t === 'check') out[c.n] = !!el.checked;
        else if (c.t === 'number') out[c.n] = el.value === '' ? null : Number(el.value);
        else if (c.t === 'tags') out[c.n] = el.value.split(',').map(s => s.trim()).filter(Boolean);
        else out[c.n] = el.value;
        if (c.req && (out[c.n] === '' || out[c.n] == null)) { el.focus(); toast('Falta: ' + c.l); return; }
      }
      cerrar(out);
    };
    dlg.showModal();
    const primero = form.querySelector('input:not([type=checkbox]),select,textarea'); if (primero) primero.focus();
  });
}
function campoHTML(c, v) {
  const id = 'c_' + c.n;
  const ayuda = c.ayuda ? `<small class="mini">${esc(c.ayuda)}</small>` : '';
  if (c.t === 'check') return `<label class="check"><input type="checkbox" name="${c.n}" ${v ? 'checked' : ''}> ${esc(c.l)}</label>${ayuda}`;
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
    const fn = acciones[el.dataset.a]; if (fn) { e.preventDefault(); fn(el, e); }
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
