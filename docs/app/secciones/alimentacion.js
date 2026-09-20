import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, sumarDias, fechaCorta, fechaLarga, pedir, confirmar, toast, aviso, navegar } from '../nucleo.js';
import { sincronizarCompra } from './compra.js';

const TIPOS = ['desayuno', 'comida', 'cena'];
const plato = id => estado.platos.find(p => p.id === id);
// Elige platos por tipo respetando las palabras de preferencias.restricciones (ligera, sin_lactosa, pescado, …) y evitando repetir los últimos días.
export function proponerMenu(fecha) {
  const pref = (estado.preferencias.restricciones || '').toLowerCase().replace(/-/g, '_');
  const quiere = ['ligera', 'proteina', 'vegetal', 'rapida', 'pescado', 'carne'].filter(t => pref.includes(t));
  const excluye = [];
  if (pref.includes('sin_lactosa') || pref.includes('sin lactosa')) excluye.push(t => !t.includes('sin_lactosa'));
  if (pref.includes('sin_gluten') || pref.includes('sin gluten')) excluye.push(t => !t.includes('sin_gluten'));
  if (pref.includes('vegetariano') || pref.includes('vegetal')) excluye.push(t => t.includes('carne') || t.includes('pescado'));
  const recientes = new Set(estado.menus.filter(m => Math.abs(new Date(m.fecha) - new Date(fecha)) < 4 * 86400000).flatMap(m => TIPOS.map(t => m[t])));
  const menu = { id: uid(), fecha };
  for (const t of TIPOS) {
    let pool = estado.platos.filter(p => p.tipo === t && !excluye.some(f => f(p.tags)));
    if (!pool.length) pool = estado.platos.filter(p => p.tipo === t);
    const puntua = p => (quiere.filter(q => p.tags.includes(q)).length) + (t === 'cena' && p.tags.includes('ligera') ? 1 : 0) - (recientes.has(p.id) ? 2 : 0) + Math.random() * 0.5;
    pool.sort((a, b) => puntua(b) - puntua(a));
    menu[t] = pool[0]?.id || null;
  }
  return menu;
}
const camposAlimento = [{ n: 'nombre', l: 'Alimento', req: true }, { n: 'stock', l: 'Cantidad en casa', t: 'number', v: 1, min: 0, step: 0.5 }, { n: 'unidad', l: 'Unidad', v: 'ud' }, { n: 'umbral', l: 'Avisar cuando quede menos de', t: 'number', v: 1, min: 0, step: 0.5 }, { n: 'tienda', l: 'Tienda habitual' }];
const camposPlato = [{ n: 'nombre', l: 'Plato', req: true }, { n: 'tipo', l: 'Momento', t: 'select', o: TIPOS }, { n: 'tags', l: 'Etiquetas', t: 'tags', ayuda: 'ligera, proteina, vegetal, rapida, sin_gluten, sin_lactosa, pescado, carne' }, { n: 'min', l: 'Minutos', t: 'number', v: 20 }];

function render(cont, params) {
  const vista = params.v || 'menu';
  const fecha = params.fecha || hoyISO();
  const menu = estado.menus.find(m => m.fecha === fecha);
  const comidasDia = estado.comidas.filter(c => c.fecha === fecha);
  const ultimas = estado.comidas.slice(-30);
  const ajuste = ultimas.length ? Math.round(ultimas.filter(c => c.segunMenu).length / ultimas.length * 100) : null;
  const bajos = estado.alimentos.filter(a => Number(a.stock) <= Number(a.umbral));
  cont.innerHTML = h`
    <div class="chips">${lista(['menu', 'stock', 'platos'].map(v => h`<button class="pill ${v === vista ? 'sel' : ''}" data-a="vista" data-v="${v}">${{ menu: 'Menú', stock: 'Stock' + (bajos.length ? ` (${bajos.length} bajo)` : ''), platos: 'Platos' }[v]}</button>`))}</div>
    ${vista === 'menu' ? crudo(`
      <div class="fila cab"><button class="btn" data-a="dia" data-f="${sumarDias(fecha, -1)}">‹</button><div class="t centro"><b>${fechaLarga(fecha)}</b></div><button class="btn" data-a="dia" data-f="${sumarDias(fecha, 1)}">›</button></div>
      ${TIPOS.map(t => { const p = menu && plato(menu[t]); const c = comidasDia.find(x => x.tipo === t); return h`<div class="tarjeta"><div class="fila"><div class="t"><div class="mini">${t}</div><b>${p ? p.nombre : '—'}</b>${p ? crudo(`<div class="mini">${p.min} min · ${p.tags.join(', ')}</div>`) : ''}
        ${c ? crudo(`<div class="mini ${c.segunMenu ? 'pos' : 'neg'}">${c.segunMenu ? '✓ según menú' : '≠ ' + c.que}</div>`) : ''}</div>
        ${c ? crudo(`<button class="btn mini" data-a="deshacer" data-id="${c.id}">deshacer</button>`) : crudo(`<button class="btn mini" data-a="hecho" data-t="${t}">Fue esta</button><button class="btn mini" data-a="otra" data-t="${t}">Fue otra</button>`)}
        </div>${p ? crudo(`<div class="acciones"><button class="btn mini" data-a="cambiar" data-t="${t}">Cambiar plato</button></div>`) : ''}</div>`; }).join('')}
      <div class="acciones"><button class="btn p" data-a="proponer">${menu ? 'Proponer otro menú' : 'Proponer menú del día'}</button><button class="btn" data-a="semana">Proponer la semana</button></div>
      <div class="tarjeta mini">Ajuste al menú en las últimas ${ultimas.length} comidas: <b>${ajuste == null ? '–' : ajuste + ' %'}</b>. Preferencias de alimentación: ${estado.preferencias.restricciones || 'ninguna'} (se cambian en Preferencias).</div>`)
    : vista === 'stock' ? crudo(`
      <p class="mini">Lo que baja del umbral pasa solo a Compra. La foto del frigorífico para rellenar esto es deuda (D3).</p>
      ${estado.alimentos.slice().sort((a, b) => (a.stock <= a.umbral ? 0 : 1) - (b.stock <= b.umbral ? 0 : 1) || a.nombre.localeCompare(b.nombre)).map(a => h`<div class="tarjeta fila"><div class="t" data-a="editarAl" data-id="${a.id}"><b>${a.nombre}</b> ${Number(a.stock) <= Number(a.umbral) ? crudo('<span class="pill w">reponer</span>') : ''}<div class="mini">${a.stock} ${a.unidad} · aviso &lt; ${a.umbral}${a.tienda ? ' · ' + a.tienda : ''}</div></div>
        <button class="btn mini" data-a="menos" data-id="${a.id}">−</button><button class="btn mini" data-a="mas" data-id="${a.id}">+</button></div>`).join('') || aviso('Sin alimentos en el stock. Añade los básicos que repones a menudo.').__crudo}
      <div class="acciones"><button class="btn p" data-a="nuevoAl">+ Alimento</button><button class="btn" data-a="buscar">Buscar en tiendas</button><button class="btn" data-a="compra">Ver Compra</button></div>`)
    : crudo(`
      ${estado.platos.map(p => h`<div class="tarjeta fila" data-a="editarPl" data-id="${p.id}"><div class="t"><b>${p.nombre}</b><div class="mini">${p.tipo} · ${p.min} min · ${p.tags.join(', ')}</div></div></div>`).join('') || aviso('Sin platos. Carga las semillas en Ajustes o añade los tuyos.').__crudo}
      <div class="acciones"><button class="btn p" data-a="nuevoPl">+ Plato</button></div>`)}`;
  delegar(cont, {
    vista: el => navegar('alimentacion', { v: el.dataset.v, fecha }),
    dia: el => navegar('alimentacion', { v: 'menu', fecha: el.dataset.f }),
    proponer: () => { estado.menus = estado.menus.filter(m => m.fecha !== fecha); estado.menus.push(proponerMenu(fecha)); guardar(); },
    semana: () => { for (let i = 0; i < 7; i++) { const f = sumarDias(fecha, i); if (!estado.menus.some(m => m.fecha === f)) estado.menus.push(proponerMenu(f)); } guardar(); toast('Semana propuesta'); },
    cambiar: async el => {
      const t = el.dataset.t; const ops = estado.platos.filter(p => p.tipo === t).map(p => ({ v: p.id, l: p.nombre }));
      const v = await pedir('Cambiar ' + t, [{ n: 'p', l: 'Plato', t: 'select', o: ops, v: menu[t] }]); if (v) { menu[t] = v.p; guardar(); }
    },
    hecho: el => { estado.comidas.push({ id: uid(), fecha, tipo: el.dataset.t, segunMenu: true, que: '' }); guardar(); },
    otra: async el => { const v = await pedir('¿Qué comiste?', [{ n: 'que', l: 'Qué fue', req: true }]); if (v) { estado.comidas.push({ id: uid(), fecha, tipo: el.dataset.t, segunMenu: false, que: v.que }); guardar(); } },
    deshacer: el => { estado.comidas = estado.comidas.filter(c => c.id !== el.dataset.id); guardar(); },
    nuevoAl: async () => { const v = await pedir('Nuevo alimento', camposAlimento); if (v) { estado.alimentos.push({ id: uid(), ...v }); sincronizarCompra(); guardar(); } },
    editarAl: async el => { const a = estado.alimentos.find(x => x.id === el.dataset.id); const v = await pedir('Editar alimento', camposAlimento, a, { extra: 'Borrar' }); if (!v) return; if (v.__extra) { estado.alimentos = estado.alimentos.filter(x => x.id !== a.id); } else Object.assign(a, v); sincronizarCompra(); guardar(); },
    menos: el => { const a = estado.alimentos.find(x => x.id === el.dataset.id); a.stock = Math.max(0, Number(a.stock) - 1); sincronizarCompra(); guardar(); },
    mas: el => { const a = estado.alimentos.find(x => x.id === el.dataset.id); a.stock = Number(a.stock) + 1; sincronizarCompra(); guardar(); },
    buscar: () => navegar('buscador', { cat: 'alimentacion' }),
    compra: () => navegar('compra'),
    nuevoPl: async () => { const v = await pedir('Nuevo plato', camposPlato); if (v) { estado.platos.push({ id: uid(), ...v }); guardar(); } },
    editarPl: async el => { const p = estado.platos.find(x => x.id === el.dataset.id); const v = await pedir('Editar plato', camposPlato, p, { extra: 'Borrar' }); if (!v) return; if (v.__extra) { if (await confirmar('¿Borrar el plato?')) estado.platos = estado.platos.filter(x => x.id !== p.id); } else Object.assign(p, v); guardar(); },
  });
}
export default { id: 'alimentacion', titulo: 'Alimentación', grupo: 'Mesa', icono: '🥗', render };
