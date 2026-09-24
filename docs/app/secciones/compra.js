import { estado, guardar, h, lista, crudo, delegar, uid, pedir, toast, aviso, navegar, hoyISO } from '../nucleo.js';
import { ETIQUETAS_COMPRA, NOMBRE_ETIQUETA, etiquetaCompra, normalizar } from '../interpretar-nota.js';

// Mantiene en la lista lo que está bajo umbral (alimentos y suplementos), sin duplicar, y quita lo que ya se repuso.
export function sincronizarCompra() {
  const activos = new Set();
  for (const a of estado.alimentos) if (Number(a.stock) <= Number(a.umbral)) { activos.add('al:' + a.id); if (!estado.compra.some(c => c.refId === a.id)) estado.compra.push({ id: uid(), nombre: a.nombre, cantidad: '', tienda: a.tienda || '', origen: 'alimento', refId: a.id, comprado: false }); }
  for (const s of estado.suplementos) { const pct = s.total ? Number(s.stock) / Number(s.total) * 100 : null; if (pct != null && pct <= (Number(s.umbralPct) || 10)) { activos.add('su:' + s.id); if (!estado.compra.some(c => c.refId === s.id)) estado.compra.push({ id: uid(), nombre: s.nombre, cantidad: '1 envase', tienda: s.tienda || '', origen: 'suplemento', refId: s.id, comprado: false }); } }
  estado.compra = estado.compra.filter(c => c.origen === 'manual' || c.origen === 'nota' || c.comprado || activos.has((c.origen === 'alimento' ? 'al:' : 'su:') + c.refId));
}
// Etiqueta de una línea: la suya, o la que le toca por su origen (las de antes no tenían).
export const etiquetaDe = c => c.etiqueta || (c.origen === 'alimento' ? 'alimentacion' : c.origen === 'suplemento' ? 'suplementos' : etiquetaCompra(c.nombre));
export const nombreEtiqueta = e => NOMBRE_ETIQUETA[e] || '🏷 ' + e.charAt(0).toUpperCase() + e.slice(1);
// Las de partida más las que ya se hayan usado: una etiqueta nueva se crea escribiéndola en una línea.
export const etiquetasCompra = () => [...new Set([...ETIQUETAS_COMPRA, ...estado.compra.map(etiquetaDe)])];
export const camposLinea = () => [{ n: 'nombre', l: 'Qué', req: true }, { n: 'cantidad', l: 'Cantidad' }, { n: 'etiqueta', l: 'Etiqueta', t: 'select', o: etiquetasCompra().map(e => ({ v: e, l: nombreEtiqueta(e) })) }, { n: 'tienda', l: 'Tienda' }];
// Añade líneas a la lista sin duplicar lo que ya está pendiente (se actualiza su cantidad si se dijo una).
// Devuelve cuántas eran nuevas y cuántas ya estaban.
export function anadirCompras(lineas, extra = {}) {
  let nuevas = 0, ya = 0;
  for (const l of lineas) {
    const nombre = String(l.nombre || '').trim(); if (!nombre) continue;
    const previa = estado.compra.find(c => !c.comprado && normalizar(c.nombre) === normalizar(nombre));
    if (previa) { ya++; if (l.cantidad) previa.cantidad = l.cantidad; continue; }
    estado.compra.push({ id: uid(), nombre, cantidad: l.cantidad || '', tienda: l.tienda || '', etiqueta: l.etiqueta || etiquetaCompra(nombre), origen: 'nota', refId: null, comprado: false, alta: hoyISO(), ...extra });
    nuevas++;
  }
  guardar();
  return { nuevas, ya };
}
export async function editarLinea(c) {
  const v = await pedir('Editar', camposLinea(), { ...c, etiqueta: etiquetaDe(c) }, { extra: 'Quitar' });
  if (!v) return;
  if (v.__extra) estado.compra = estado.compra.filter(x => x.id !== c.id); else Object.assign(c, v);
  guardar();
}
// Marcar comprado: lo que venía del stock pregunta cuánto se compró para reponerlo.
export async function marcarComprado(c) {
  if (c.origen === 'alimento') { const a = estado.alimentos.find(x => x.id === c.refId); if (a) { const v = await pedir('Reponer ' + a.nombre, [{ n: 'n', l: 'Cantidad comprada (' + a.unidad + ')', t: 'number', v: Math.max(Number(a.umbral) * 3, 1), min: 0 }]); if (!v) return false; a.stock = Number(a.stock) + Number(v.n); } }
  if (c.origen === 'suplemento') { const s = estado.suplementos.find(x => x.id === c.refId); if (s) { const v = await pedir('Reponer ' + s.nombre, [{ n: 'n', l: 'Unidades compradas', t: 'number', v: s.total || 60, min: 1 }]); if (!v) return false; s.stock = Number(s.stock || 0) + Number(v.n); if (!s.total || Number(v.n) > Number(s.total)) s.total = Number(v.n); } }
  c.comprado = true; c.fecha = hoyISO();
  sincronizarCompra(); guardar();
  return true;
}
// Categoría del buscador para una línea.
export const categoriaBusqueda = c => ({ alimentacion: 'alimentacion', suplementos: 'suplementos' }[etiquetaDe(c)] || 'general');
function render(cont) {
  sincronizarCompra();
  const pend = estado.compra.filter(c => !c.comprado), hechos = estado.compra.filter(c => c.comprado).slice(-10);
  const porTienda = {}; for (const c of pend) (porTienda[c.tienda || 'Sin tienda'] ||= []).push(c);
  cont.innerHTML = h`
    <p class="mini">Entra lo que baja del umbral en Alimentación y Suplementos, lo que dictas como compra en Notas y lo que añadas aquí. Marcar comprado repone el stock.</p>
    ${pend.length ? lista(Object.entries(porTienda).map(([t, items]) => h`<h3>${t} <span class="mini">${items.length}</span></h3>${lista(items.map(c => h`<div class="tarjeta fila"><button class="chk" data-a="comprado" data-id="${c.id}">○</button><div class="t" data-a="editar" data-id="${c.id}"><b>${c.nombre}</b><div class="mini">${c.cantidad ? c.cantidad + ' · ' : ''}${nombreEtiqueta(etiquetaDe(c))}</div></div><button class="btn mini" data-a="buscar" data-id="${c.id}">buscar</button></div>`))}`)) : aviso('Nada que comprar.')}
    <div class="acciones"><button class="btn p" data-a="nuevo">+ Línea</button>${pend.length ? crudo('<button class="btn" data-a="copiar">Copiar lista</button>') : ''}</div>
    ${hechos.length ? crudo('<h3>Comprado</h3>' + hechos.map(c => h`<div class="mini">✓ ${c.nombre} ${c.cantidad || ''}</div>`).join('')) : ''}`;
  delegar(cont, {
    nuevo: async () => { const v = await pedir('Añadir a la compra', camposLinea(), { etiqueta: 'otras' }); if (v) { estado.compra.push({ id: uid(), ...v, origen: 'manual', refId: null, comprado: false, alta: hoyISO() }); guardar(); } },
    editar: el => { const c = estado.compra.find(x => x.id === el.dataset.id); if (c) editarLinea(c); },
    comprado: async el => { const c = estado.compra.find(x => x.id === el.dataset.id); if (c && await marcarComprado(c)) toast(c.origen === 'nota' || c.origen === 'manual' ? 'Comprado' : 'Repuesto'); },
    buscar: el => { const c = estado.compra.find(x => x.id === el.dataset.id); if (c) navegar('buscador', { q: c.nombre, cat: categoriaBusqueda(c) }); },
    copiar: () => { const txt = pend.map(c => `- ${c.nombre}${c.cantidad ? ' (' + c.cantidad + ')' : ''}${c.tienda ? ' · ' + c.tienda : ''}`).join('\n'); navigator.clipboard?.writeText(txt).then(() => toast('Lista copiada')).catch(() => toast('No se pudo copiar')); },
  });
}
export default { id: 'compra', titulo: 'Compra', grupo: 'Mesa', icono: '🧺', render };
