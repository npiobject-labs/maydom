import { estado, guardar, h, lista, crudo, delegar, uid, pedir, toast, aviso, navegar } from '../nucleo.js';

// Mantiene en la lista lo que está bajo umbral (alimentos y suplementos), sin duplicar, y quita lo que ya se repuso.
export function sincronizarCompra() {
  const activos = new Set();
  for (const a of estado.alimentos) if (Number(a.stock) <= Number(a.umbral)) { activos.add('al:' + a.id); if (!estado.compra.some(c => c.refId === a.id)) estado.compra.push({ id: uid(), nombre: a.nombre, cantidad: '', tienda: a.tienda || '', origen: 'alimento', refId: a.id, comprado: false }); }
  for (const s of estado.suplementos) { const pct = s.total ? Number(s.stock) / Number(s.total) * 100 : null; if (pct != null && pct <= (Number(s.umbralPct) || 10)) { activos.add('su:' + s.id); if (!estado.compra.some(c => c.refId === s.id)) estado.compra.push({ id: uid(), nombre: s.nombre, cantidad: '1 envase', tienda: s.tienda || '', origen: 'suplemento', refId: s.id, comprado: false }); } }
  estado.compra = estado.compra.filter(c => c.origen === 'manual' || c.comprado || activos.has((c.origen === 'alimento' ? 'al:' : 'su:') + c.refId));
}
const campos = [{ n: 'nombre', l: 'Qué', req: true }, { n: 'cantidad', l: 'Cantidad' }, { n: 'tienda', l: 'Tienda' }];
function render(cont) {
  sincronizarCompra();
  const pend = estado.compra.filter(c => !c.comprado), hechos = estado.compra.filter(c => c.comprado).slice(-10);
  const porTienda = {}; for (const c of pend) (porTienda[c.tienda || 'Sin tienda'] ||= []).push(c);
  cont.innerHTML = h`
    <p class="mini">Entra solo lo que baja del umbral en Alimentación y Suplementos, más lo que añadas. Marcar comprado repone el stock.</p>
    ${pend.length ? lista(Object.entries(porTienda).map(([t, items]) => h`<h3>${t} <span class="mini">${items.length}</span></h3>${lista(items.map(c => h`<div class="tarjeta fila"><button class="chk" data-a="comprado" data-id="${c.id}">○</button><div class="t" data-a="editar" data-id="${c.id}"><b>${c.nombre}</b><div class="mini">${c.cantidad || ''} · ${c.origen}</div></div><button class="btn mini" data-a="buscar" data-q="${c.nombre}" data-o="${c.origen}">buscar</button></div>`))}`)) : aviso('Nada que comprar.')}
    <div class="acciones"><button class="btn p" data-a="nuevo">+ Línea</button>${pend.length ? crudo('<button class="btn" data-a="copiar">Copiar lista</button>') : ''}</div>
    ${hechos.length ? crudo('<h3>Comprado</h3>' + hechos.map(c => h`<div class="mini">✓ ${c.nombre} ${c.cantidad || ''}</div>`).join('')) : ''}`;
  delegar(cont, {
    nuevo: async () => { const v = await pedir('Añadir a la compra', campos); if (v) { estado.compra.push({ id: uid(), ...v, origen: 'manual', refId: null, comprado: false }); guardar(); } },
    editar: async el => { const c = estado.compra.find(x => x.id === el.dataset.id); const v = await pedir('Editar', campos, c, { extra: 'Quitar' }); if (!v) return; if (v.__extra) estado.compra = estado.compra.filter(x => x.id !== c.id); else Object.assign(c, v); guardar(); },
    comprado: async el => {
      const c = estado.compra.find(x => x.id === el.dataset.id);
      if (c.origen === 'alimento') { const a = estado.alimentos.find(x => x.id === c.refId); if (a) { const v = await pedir('Reponer ' + a.nombre, [{ n: 'n', l: 'Cantidad comprada (' + a.unidad + ')', t: 'number', v: Math.max(Number(a.umbral) * 3, 1), min: 0 }]); if (!v) return; a.stock = Number(a.stock) + Number(v.n); } }
      if (c.origen === 'suplemento') { const s = estado.suplementos.find(x => x.id === c.refId); if (s) { const v = await pedir('Reponer ' + s.nombre, [{ n: 'n', l: 'Unidades compradas', t: 'number', v: s.total || 60, min: 1 }]); if (!v) return; s.stock = Number(s.stock || 0) + Number(v.n); if (!s.total || Number(v.n) > Number(s.total)) s.total = Number(v.n); } }
      c.comprado = true; c.fecha = new Date().toISOString().slice(0, 10);
      sincronizarCompra(); guardar(); toast('Repuesto');
    },
    buscar: el => navegar('buscador', { q: el.dataset.q, cat: el.dataset.o === 'suplemento' ? 'suplementos' : 'alimentacion' }),
    copiar: () => { const txt = pend.map(c => `- ${c.nombre}${c.cantidad ? ' (' + c.cantidad + ')' : ''}${c.tienda ? ' · ' + c.tienda : ''}`).join('\n'); navigator.clipboard?.writeText(txt).then(() => toast('Lista copiada')).catch(() => toast('No se pudo copiar')); },
  });
}
export default { id: 'compra', titulo: 'Compra', grupo: 'Mesa', icono: '🧺', render };
