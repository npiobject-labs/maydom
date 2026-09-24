// Accesos directos de Hoy (ADR-007): botones que el usuario fija con ☆ y coloca a su gusto en una
// rejilla de 4 columnas fijas, así una casilla es la misma en el móvil y en el PC.
// Un destino es una ruta de la app; con ?accion=<data-a> además pulsa ese botón al llegar, de modo
// que cualquier botón de cualquier sección se puede fijar sin que la sección sepa nada de esto.
import { estado, guardar, persistir, esc, toast, seccion, secciones, rutaActual } from './nucleo.js';

const COLS = 4, MAX_NOMBRE = 12;
const TAM = { '1x1': [1, 1], '2x1': [2, 1], '2x2': [2, 2] };
const NOMBRE_TAM = { '1x1': 'Pequeño', '2x1': 'Ancho', '2x2': 'Grande' };
const FORMAS = { circulo: 'Círculo', cuadrado: 'Cuadrado', hexagono: 'Hexágono', pentagono: 'Pentágono', hoja: 'Hoja' };
// Colores oscuros a propósito: el texto blanco se lee sobre todos, en claro y en oscuro.
const COLORES = { verdeazul: ['#0B6E7A', 'Verde azulado'], azul: ['#1F5FBF', 'Azul'], violeta: ['#6B4FC8', 'Violeta'], magenta: ['#A8307A', 'Magenta'], rojo: ['#B8322A', 'Rojo'], naranja: ['#B85C1E', 'Naranja'], ocre: ['#8A6A12', 'Ocre'], verde: ['#2E7D4F', 'Verde'], pizarra: ['#4A5A66', 'Pizarra'] };
// Parámetros de ruta que forman parte de un destino (pestaña, vista, guion). El resto (fecha, mes,
// búsqueda) es de ese momento: un acceso a «+ Movimiento» no puede quedarse clavado en septiembre.
const PARAMS_DESTINO = ['v', 'vista', 'guion'];
const FUERA = ['hoy', 'menu'];

const dims = a => TAM[a.tam] || TAM['1x1'];
const colorDe = a => (COLORES[a.color] || COLORES.verdeazul)[0];
const formaDe = a => (FORMAS[a.forma] ? a.forma : 'cuadrado');
const esDestino = d => typeof d === 'string' && /^#\/[a-z]+(\?[\w.%=&+-]*)?$/.test(d);
const hash = (id, params = {}) => { const q = new URLSearchParams(params).toString(); return `#/${id}${q ? '?' + q : ''}`; };
export function ir(destino) { if (esDestino(destino)) location.hash = destino; }

let colocando = false;
window.addEventListener('hashchange', () => { colocando = false; });

// ---------- colocación: casillas explícitas; se puede dejar hueco ----------
const solapan = (a, ax, ay, b) => { const [aw, ah] = dims(a), [bw, bh] = dims(b); return ax < b.x + bw && b.x < ax + aw && ay < b.y + bh && b.y < ay + ah; };
const libre = (t, x, y) => x >= 0 && y >= 0 && x + dims(t)[0] <= COLS && !estado.accesos.some(b => b !== t && solapan(t, x, y, b));
function primerHueco(t) { for (let y = 0; ; y++) for (let x = 0; x + dims(t)[0] <= COLS; x++) if (libre(t, x, y)) return { x, y }; }
// Al soltar encima de otro, ese otro pasa al sitio que se ha dejado libre (o al primer hueco si no cabe).
function colocar(a, x, y, antes = { x: a.x, y: a.y }) {
  a.x = x; a.y = y;
  for (const b of estado.accesos.filter(b => b !== a && solapan(a, a.x, a.y, b))) {
    const bx = Math.min(antes.x, COLS - dims(b)[0]);
    Object.assign(b, libre(b, bx, antes.y) ? { x: bx, y: antes.y } : primerHueco(b));
  }
}
const filas = () => Math.max(0, ...estado.accesos.map(a => a.y + dims(a)[1]));

// ---------- qué se puede fijar ----------
const textoBoton = b => b.textContent.replace(/\s+/g, ' ').trim();
const EMOJI = /^(\p{Extended_Pictographic}️?)\s*/u;
const limpiar = t => t.replace(/^\+\s*/, '').replace(EMOJI, '').replace(/\s*[›»↗]$/, '').trim();
// Un botón se puede fijar si solo lleva su acción: los que llevan data-id, data-s… dependen de una
// ficha concreta de la pantalla. Tampoco los de borrar ni las pestañas (esas van por ?v=).
export const esFijable = b => b.matches('button[data-a]') && !b.closest('dialog, .pestanas') && !b.classList.contains('peligro') && Object.keys(b.dataset).length === 1 && !!limpiar(textoBoton(b));
export function nombreCorto(t) {
  let p = limpiar(t).split(' ');
  while (p.join(' ').length > MAX_NOMBRE && p.length > 1) p.pop();
  while (p.length > 1 && /^(de|del|la|el|los|las|a|al|y|en)$/i.test(p[p.length - 1])) p.pop();
  return p.join(' ').slice(0, MAX_NOMBRE);
}
function vistaActual() {
  const r = rutaActual(), s = seccion(r.id) || seccion('hoy'), id = s.id, params = s.id === r.id ? r.params : {};
  const vista = Object.fromEntries(Object.entries(params).filter(([k]) => PARAMS_DESTINO.includes(k)));
  const pest = document.querySelector('#main .pestanas button.sel')?.textContent.replace(/\s*\d+$/, '').trim();
  return { id, vista, s, pest };
}
export function opcionDeBoton(b) {
  const { id, vista, s, pest } = vistaActual(), t = textoBoton(b);
  return { destino: hash(id, { ...vista, accion: b.dataset.a }), texto: [s.titulo, pest, limpiar(t)].filter(Boolean).join(' › '), icono: t.match(EMOJI)?.[1] || s.icono, corto: nombreCorto(t) };
}
const abrirSeccion = s => ({ destino: hash(s.id), texto: 'Abrir ' + s.titulo, icono: s.icono, corto: nombreCorto(s.titulo) });
export function opcionesDePantalla() {
  const { id, vista, s, pest } = vistaActual();
  const ops = [abrirSeccion(s)];
  if (Object.keys(vista).length) ops.push({ destino: hash(id, vista), texto: `${s.titulo} › ${pest || 'esta vista'}`, icono: s.icono, corto: nombreCorto(pest || s.titulo) });
  for (const b of document.querySelectorAll('#main button[data-a]')) if (esFijable(b)) { const o = opcionDeBoton(b); if (!ops.some(x => x.destino === o.destino)) ops.push(o); }
  return { ops, sel: ops.length > 1 && Object.keys(vista).length ? 1 : 0 };
}

// Llega una ruta con ?accion=: se quita de la dirección (para que un repintado no la repita) y se
// pulsa el botón de la sección, que hace lo de siempre.
export function lanzarAccion(s, params) {
  const { accion, ...resto } = params;
  history.replaceState(null, '', hash(s.id, resto));
  setTimeout(() => {
    const b = [...document.querySelectorAll('#main button[data-a]')].find(x => x.dataset.a === accion && esFijable(x));
    if (b) b.click(); else toast(`Esa acción no está ahora mismo en ${s.titulo}`);
  }, 0);
}

// ---------- uso: de aquí salen las sugerencias del mayordomo ----------
let aplazado = null;
export function contarUso(op) {
  if (!esDestino(op.destino)) return;
  const u = estado.usos[op.destino] ||= { n: 0 };
  Object.assign(u, { n: u.n + 1, texto: op.texto, icono: op.icono, corto: op.corto });
  // Sin guardar(): contar no debe repintar la app. Se escribe al rato, con lo que haya.
  clearTimeout(aplazado);
  aplazado = setTimeout(() => {
    const orden = Object.entries(estado.usos).sort((a, b) => b[1].n - a[1].n);
    if (orden.length > 40) estado.usos = Object.fromEntries(orden.slice(0, 40));
    persistir();
  }, 1500);
}
function sugerencias(n = 3) {
  const fijos = new Set(estado.accesos.map(a => a.destino));
  return Object.entries(estado.usos || {}).filter(([d, u]) => u.n >= 3 && !fijos.has(d) && esDestino(d))
    .sort((a, b) => b[1].n - a[1].n).slice(0, n).map(([destino, u]) => ({ destino, ...u }));
}

// ---------- pintar ----------
function htmlAcceso(a, extra = '') {
  const [w, h] = dims(a);
  return `<button class="acceso f-${formaDe(a)}${[...String(a.nombre)].length > 9 ? ' largo' : ''}" type="button" data-acc-id="${esc(a.id)}" data-w="${w}" data-h="${h}" ${extra}
    style="grid-column:${a.x + 1} / span ${w};grid-row:${a.y + 1} / span ${h};--color:${colorDe(a)}" aria-label="${esc(a.nombre)}" title="${esc(a.texto || '')}">
    <span class="forma"><span class="ico">${esc(a.icono)}</span><span class="nom">${esc(a.nombre)}</span></span>
    <span class="quitar" data-acc-quitar="${esc(a.id)}" role="button" aria-label="Quitar ${esc(a.nombre)}">✕</span></button>`;
}
const chips = sug => sug.length ? `<div class="sugerencias">El mayordomo sugiere (por uso): ${sug.map((s, i) => `<button class="pill" type="button" data-acc-sug="${i}">+ ${esc(s.corto || s.texto)}</button>`).join('')}</div>` : '';

export function htmlAccesos() {
  const lista = estado.accesos, sug = sugerencias();
  const boton = !lista.length ? '' : colocando ? '<button class="btn mini p" type="button" data-acc="listo">✓ Listo</button>' : '<button class="btn mini" type="button" data-acc="colocar">✎ Colocar</button>';
  const cab = `<h3 class="cab-accesos">Accesos<span></span>${boton}</h3>`;
  if (!lista.length) return `<section class="bloque-accesos">${cab}<div class="tarjeta mini">Fija aquí lo que más uses con <b>☆ Fijar</b> en la cabecera de cualquier sección o con la ☆ de sus ventanas.${chips(sug)}</div></section>`;
  let huecos = '';
  if (colocando) for (let y = 0, n = filas() + 1; y < n; y++) for (let x = 0; x < COLS; x++)
    if (!lista.some(b => solapan({ tam: '1x1' }, x, y, b))) huecos += `<button class="hueco" type="button" data-acc-hueco="${x},${y}" style="grid-column:${x + 1};grid-row:${y + 1}" aria-label="Añadir aquí">+</button>`;
  return `<section class="bloque-accesos">${cab}<div class="accesos"><div class="rejilla${colocando ? ' colocando' : ''}">${huecos}${lista.map(a => htmlAcceso(a)).join('')}<div class="destino" hidden></div></div></div>
    ${colocando ? `<p class="mini">Arrastra para mover (se pueden dejar huecos; encima de otro, los cambia de sitio), toca uno para cambiarlo o ✕ para quitarlo.</p>${chips(sug)}` : ''}</section>`;
}

// Se engancha a los elementos recién pintados (no a #main, que dura toda la vida de la app).
export function enlazarAccesos(cont, repintar) {
  const bloque = cont.querySelector('.bloque-accesos'); if (!bloque) return;
  const sug = sugerencias();
  bloque.querySelector('[data-acc="colocar"]')?.addEventListener('click', () => { colocando = true; repintar(); });
  bloque.querySelector('[data-acc="listo"]')?.addEventListener('click', () => { colocando = false; repintar(); });
  bloque.querySelectorAll('[data-acc-sug]').forEach(b => b.addEventListener('click', () => abrirFijar({ ops: [sug[Number(b.dataset.accSug)]] })));
  bloque.querySelectorAll('[data-acc-hueco]').forEach(b => b.addEventListener('click', () => {
    const [x, y] = b.dataset.accHueco.split(',').map(Number);
    abrirFijar({ ops: [...sugerencias(8), ...secciones.filter(s => !FUERA.includes(s.id)).map(abrirSeccion)], x, y });
  }));
  const rej = bloque.querySelector('.rejilla'); if (!rej) return;
  rej.addEventListener('contextmenu', e => e.preventDefault());
  rej.querySelectorAll('.acceso').forEach(el => {
    const a = estado.accesos.find(x => x.id === el.dataset.accId); if (!a) return;
    el.addEventListener('pointerdown', e => { if (e.button > 0 || e.target.closest('[data-acc-quitar]')) return; colocando ? arrastrar(e, el, a, rej) : pulsar(e, el, a, repintar); });
    el.addEventListener('click', e => { if (e.detail === 0) colocando ? abrirFijar({ acceso: a }) : ir(a.destino); }); // teclado
  });
  rej.querySelectorAll('[data-acc-quitar]').forEach(q => q.addEventListener('click', e => {
    e.stopPropagation();
    const a = estado.accesos.find(x => x.id === q.dataset.accQuitar);
    estado.accesos = estado.accesos.filter(x => x !== a); guardar(); toast(`«${a.nombre}» quitado`);
  }));
}

// Toque corto: ir. Mantener pulsado: modo colocar, como en el escritorio del móvil.
function pulsar(e, el, a, repintar) {
  const x0 = e.clientX, y0 = e.clientY; let largo = false;
  const t = setTimeout(() => { largo = true; navigator.vibrate?.(30); colocando = true; repintar(); }, 550);
  const mover = ev => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) fin(); };
  const fin = () => { clearTimeout(t); el.removeEventListener('pointermove', mover); el.removeEventListener('pointerup', soltar); el.removeEventListener('pointercancel', fin); };
  const soltar = () => { fin(); if (!largo) ir(a.destino); };
  el.addEventListener('pointermove', mover); el.addEventListener('pointerup', soltar); el.addEventListener('pointercancel', fin);
}

function arrastrar(e, el, a, rej) {
  e.preventDefault();
  try { el.setPointerCapture(e.pointerId); } catch { }
  const dest = rej.querySelector('.destino'), r = rej.getBoundingClientRect(), gap = parseFloat(getComputedStyle(rej).rowGap) || 0;
  const paso = (r.width - (COLS - 1) * gap) / COLS + gap;
  const [w, h] = dims(a), x0 = e.clientX, y0 = e.clientY;
  let movido = false, obj = null;
  const mover = ev => {
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (!movido && Math.hypot(dx, dy) < 6) return;
    movido = true; el.classList.add('arrastrando');
    el.style.transform = `translate(${dx}px,${dy}px)`;
    obj = { x: Math.max(0, Math.min(COLS - w, Math.round(a.x + dx / paso))), y: Math.max(0, Math.min(filas(), Math.round(a.y + dy / paso))) };
    Object.assign(dest.style, { gridColumn: `${obj.x + 1} / span ${w}`, gridRow: `${obj.y + 1} / span ${h}` });
    dest.hidden = false;
  };
  const soltar = () => {
    el.removeEventListener('pointermove', mover); el.removeEventListener('pointerup', soltar); el.removeEventListener('pointercancel', soltar);
    if (!movido) return abrirFijar({ acceso: a });
    el.classList.remove('arrastrando'); el.style.transform = ''; dest.hidden = true;
    if (obj && (obj.x !== a.x || obj.y !== a.y)) { colocar(a, obj.x, obj.y); guardar(); }
  };
  el.addEventListener('pointermove', mover); el.addEventListener('pointerup', soltar); el.addEventListener('pointercancel', soltar);
}

// ---------- ventana «Fijar en inicio» (también edita) ----------
// ops: [{destino, texto, icono, corto}] entre los que elegir; sel: el preseleccionado.
export function abrirFijar({ ops = [], sel = 0, acceso = null, x = null, y = null }) {
  if (acceso) ops = [{ destino: acceso.destino, texto: acceso.texto || acceso.nombre, icono: acceso.icono, corto: acceso.nombre }, ...secciones.filter(s => !FUERA.includes(s.id)).map(abrirSeccion).filter(o => o.destino !== acceso.destino)];
  ops = ops.filter(o => o && esDestino(o.destino));
  if (!ops.length) return;
  const usados = new Set(estado.accesos.map(a => a.color));
  const v = acceso || { nombre: ops[sel]?.corto || '', icono: ops[sel]?.icono || '★', color: Object.keys(COLORES).find(c => !usados.has(c)) || 'verdeazul', forma: 'circulo', tam: '1x1' };
  const radios = (nombre, pares, pintar) => pares.map(([val, t]) => `<label title="${esc(t)}"><input type="radio" name="${nombre}" value="${esc(val)}" aria-label="${esc(t)}">${pintar(val, t)}</label>`).join('');
  const dlg = document.createElement('dialog');
  dlg.className = 'modal fijar-acceso';
  dlg.innerHTML = `<form method="dialog" class="form">
    <div class="cabecera-modal"><h2>${acceso ? 'Editar acceso' : 'Fijar en inicio'}</h2><button type="button" class="cerrar" data-cancelar aria-label="Cerrar sin guardar" title="Cerrar sin guardar">✕</button></div>
    ${ops.length > 1 ? `<label for="acc-destino">Lleva a</label><select id="acc-destino" name="destino">${ops.map((o, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(o.texto)}</option>`).join('')}</select>`
      : `<label>Lleva a</label><div class="lleva">${esc(ops[0].texto)}</div><input type="hidden" name="destino" value="0">`}
    <label for="acc-nombre">Nombre <span class="cuenta"></span></label><input id="acc-nombre" name="nombre" maxlength="${MAX_NOMBRE}" autocomplete="off" required>
    <label for="acc-icono">Icono</label><input id="acc-icono" name="icono" maxlength="4" autocomplete="off" class="icono">
    <label>Color</label><div class="muestras">${radios('color', Object.entries(COLORES).map(([k, [, t]]) => [k, t]), k => `<span class="color" style="--c:${COLORES[k][0]}"></span>`)}</div>
    <label>Forma</label><div class="muestras">${radios('forma', Object.entries(FORMAS), (k, t) => `<span class="opcion"><i class="f-${k}"></i>${t}</span>`)}</div>
    <label>Tamaño</label><div class="muestras">${radios('tam', Object.entries(NOMBRE_TAM), (k, t) => `<span class="opcion"><i class="t-${k}"></i>${t}</span>`)}</div>
    <div class="vista-acceso"><div class="accesos"><div class="rejilla"></div></div></div>
    <div class="acciones fin">${acceso ? '<button type="button" class="btn peligro" data-quitar>Quitar</button><span style="flex:1"></span>' : ''}
      <button type="button" class="btn" data-cancelar>Cancelar</button><button type="submit" class="btn p">${acceso ? 'Guardar' : 'Fijar'}</button></div></form>`;
  document.body.appendChild(dlg);
  const f = dlg.querySelector('form');
  const cerrar = () => { dlg.close(); dlg.remove(); };
  f.nombre.value = v.nombre; f.icono.value = v.icono;
  f.color.value = COLORES[v.color] ? v.color : 'verdeazul'; f.forma.value = formaDe(v); f.tam.value = TAM[v.tam] ? v.tam : '1x1';
  let nombreTocado = !!acceso;
  const vista = () => {
    dlg.querySelector('.cuenta').textContent = `${f.nombre.value.length}/${MAX_NOMBRE}`;
    const p = { id: 'vista', nombre: f.nombre.value || '…', icono: f.icono.value, color: f.color.value, forma: f.forma.value, tam: f.tam.value, x: 1, y: 0 };
    dlg.querySelector('.vista-acceso .rejilla').innerHTML = htmlAcceso(p, 'tabindex="-1"');
  };
  f.addEventListener('input', e => {
    if (e.target === f.nombre || e.target === f.icono) nombreTocado = true;
    if (e.target.name === 'destino' && !nombreTocado) { const o = ops[Number(f.destino.value)]; f.nombre.value = o.corto || ''; f.icono.value = o.icono || '★'; }
    vista();
  });
  vista();
  dlg.querySelectorAll('[data-cancelar]').forEach(b => { b.onclick = cerrar; });
  dlg.addEventListener('cancel', e => { e.preventDefault(); cerrar(); });
  dlg.querySelector('[data-quitar]')?.addEventListener('click', () => {
    cerrar(); estado.accesos = estado.accesos.filter(a => a !== acceso); guardar(); toast(`«${acceso.nombre}» quitado`);
  });
  f.onsubmit = e => {
    e.preventDefault();
    const o = ops[Number(f.destino.value)] || ops[0];
    const datos = { destino: o.destino, texto: o.texto, nombre: f.nombre.value.trim().slice(0, MAX_NOMBRE) || o.corto || '…', icono: f.icono.value.trim() || '★', color: f.color.value, forma: f.forma.value, tam: f.tam.value };
    cerrar();
    if (acceso) {
      const tamAntes = acceso.tam;
      Object.assign(acceso, datos);
      if (tamAntes !== acceso.tam) colocar(acceso, Math.min(acceso.x, COLS - dims(acceso)[0]), acceso.y, { x: acceso.x, y: acceso.y });
      guardar(); return;
    }
    const nuevo = { id: Math.random().toString(36).slice(2, 8) + Date.now().toString(36), ...datos };
    const xx = x == null ? null : Math.min(x, COLS - dims(nuevo)[0]);
    Object.assign(nuevo, xx != null && libre(nuevo, xx, y) ? { x: xx, y } : primerHueco(nuevo));
    estado.accesos.push(nuevo); guardar();
    toast(rutaActual().id === 'hoy' ? `«${nuevo.nombre}» fijado` : `«${nuevo.nombre}» fijado en Hoy`);
  };
  dlg.showModal();
  f.nombre.focus();
}
