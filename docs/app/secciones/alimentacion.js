import { estado, guardar, h, lista, crudo, esc, delegar, uid, hoyISO, sumarDias, fechaCorta, fechaLarga, pedir, confirmar, toast, aviso, navegar } from '../nucleo.js';
import { sincronizarCompra } from './compra.js';
import { pedirJSON, conLLM, reducirImagen, lista as listaLLM } from '../llm.js';

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
const ETIQUETAS_PLATO = ['ligera', 'proteina', 'vegetal', 'rapida', 'sin_gluten', 'sin_lactosa', 'pescado', 'carne'];
// La descripción va justo debajo del nombre: ingredientes, preparación, nutrientes y notas, todo junto.
const camposPlato = [
  { n: 'nombre', l: 'Plato', req: true },
  { n: 'descripcion', l: 'Ingredientes, preparación y nutrientes', t: 'textarea', filas: 7, ph: 'vacío = lo redacta el mayordomo a partir del nombre' },
  { n: 'tipo', l: 'Momento', t: 'select', o: [{ v: '', l: '— lo decide el mayordomo —' }, ...TIPOS.map(t => ({ v: t, l: t }))] },
  { n: 'tags', l: 'Etiquetas', t: 'tags', ayuda: ETIQUETAS_PLATO.join(', ') },
  { n: 'min', l: 'Minutos', t: 'number', v: 20 },
];
// Rellena lo que el usuario dejó vacío; nunca pisa lo escrito a mano.
export async function analizarPlato(plato, { forzar = false } = {}) {
  const faltaDesc = forzar || !plato.descripcionManual;
  const faltanTags = forzar || !(plato.tags || []).length;
  if (!faltaDesc && !faltanTags) return false;
  const j = await pedirJSON({
    operacion: 'plato', contexto: false,
    tarea: `Eres cocinero y sabes de nutrición. Para el plato que te digan, devuelve {"descripcion":"","etiquetas":[],"tipo":"desayuno|comida|cena","min":0}.
La descripción, en español y en texto plano, con estas cuatro partes en este orden y cada una en su línea, sin markdown:
Ingredientes: para una ración, con cantidades.
Preparación: los pasos en dos o tres frases seguidas.
Por ración: kilocalorías y gramos aproximados de proteína, hidratos y grasa.
Nota: una indicación útil (a qué hora sienta mejor, cómo aligerarlo, conservación) o la línea entera vacía si no aplica.
Si el plato que te dan ya trae una descripción o varios pasos, respétalos y complétalos, no los inventes de cero.
Las etiquetas, de 1 a 4 de esta lista: ${ETIQUETAS_PLATO.join(', ')}. min es el tiempo total en minutos.`,
    mensaje: `Plato: ${plato.nombre}\n${plato.descripcion ? 'Lo que ya tengo escrito:\n' + String(plato.descripcion).slice(0, 2000) : ''}`,
  });
  let cambio = false;
  if (faltaDesc && j?.descripcion) { plato.descripcion = String(j.descripcion).trim().slice(0, 2500); cambio = true; }
  if (faltanTags && Array.isArray(j?.etiquetas) && j.etiquetas.length) { plato.tags = j.etiquetas.map(e => String(e).toLowerCase().trim()).filter(Boolean).slice(0, 4); cambio = true; }
  if (!plato.tipoManual && TIPOS.includes(j?.tipo) && j.tipo !== plato.tipo) { plato.tipo = j.tipo; cambio = true; }
  if (!plato.min && Number(j?.min) > 0) { plato.min = Math.round(Number(j.min)); cambio = true; }
  if (cambio) { plato.analizado = true; guardar(); }
  return cambio;
}
// Guarda ya y completa después, como en Notas: escribir el nombre basta.
function guardarPlato(datos, previo = null) {
  const p = previo || { id: uid(), tags: [] };
  const tipoAntes = p.tipo;
  Object.assign(p, datos);
  p.descripcionManual = !!(datos.descripcion || '').trim();
  // Momento elegido a mano: se respeta. Vacío: lo pone el mayordomo y queda como suyo.
  if (datos.tipo) { if (!previo || datos.tipo !== tipoAntes) p.tipoManual = true; }
  else { p.tipo = p.tipo || ''; }
  if (!previo) estado.platos.push(p);
  guardar();
  analizarPlato(p).catch(e => console.warn('plato sin completar:', e.message));
  return p;
}

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
      <div class="acciones"><button class="btn p" data-a="proponer">${menu ? 'Proponer otro menú' : 'Proponer menú del día'}</button><button class="btn" data-a="semana">Proponer la semana</button><button class="btn" data-a="semanaLLM">Semana con LLM</button></div>
      <div class="tarjeta mini">Ajuste al menú en las últimas ${ultimas.length} comidas: <b>${ajuste == null ? '–' : ajuste + ' %'}</b>. Preferencias de alimentación: ${estado.preferencias.restricciones || 'ninguna'} (se cambian en Preferencias).</div>`)
    : vista === 'stock' ? crudo(`
      <p class="mini">Lo que baja del umbral pasa solo a Compra. Con una foto del frigorífico o la despensa, el LLM propone el stock (requiere clave de OpenRouter).</p>
      <div class="acciones"><label class="btn p">📷 Foto del frigorífico <input type="file" accept="image/*" capture="environment" data-c="foto" hidden></label></div>
      ${estado.alimentos.slice().sort((a, b) => (a.stock <= a.umbral ? 0 : 1) - (b.stock <= b.umbral ? 0 : 1) || a.nombre.localeCompare(b.nombre)).map(a => h`<div class="tarjeta fila"><div class="t" data-a="editarAl" data-id="${a.id}"><b>${a.nombre}</b> ${Number(a.stock) <= Number(a.umbral) ? crudo('<span class="pill w">reponer</span>') : ''}<div class="mini">${a.stock} ${a.unidad} · aviso &lt; ${a.umbral}${a.tienda ? ' · ' + a.tienda : ''}</div></div>
        <button class="btn mini" data-a="menos" data-id="${a.id}">−</button><button class="btn mini" data-a="mas" data-id="${a.id}">+</button></div>`).join('') || aviso('Sin alimentos en el stock. Añade los básicos que repones a menudo.').__crudo}
      <div class="acciones"><button class="btn p" data-a="nuevoAl">+ Alimento</button><button class="btn" data-a="buscar">Buscar en tiendas</button><button class="btn" data-a="compra">Ver Compra</button></div>`)
    : crudo(`
      ${(() => {
        const q = (params.q || '').toLowerCase(), mom = params.mom || '', orden = params.orden || 'nombre';
        let ps = estado.platos.filter(p => (!mom || p.tipo === mom) && (!q || (p.nombre + ' ' + (p.descripcion || '') + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q)));
        ps.sort((a, b) => orden === 'tiempo' ? (a.min || 0) - (b.min || 0) : orden === 'reciente' ? String(b.id).localeCompare(String(a.id)) : a.nombre.localeCompare(b.nombre));
        const sinCompletar = estado.platos.filter(p => !p.descripcion);
        return `<div class="acciones"><input type="search" placeholder="Buscar plato, ingrediente o etiqueta" value="${esc(q)}" data-i="buscarPl"></div>
        <div class="chips">${[{ v: '', l: 'todos' }, ...TIPOS.map(t => ({ v: t, l: t }))].map(t => h`<button class="pill ${t.v === mom ? 'sel' : ''}" data-a="momPl" data-m="${t.v}">${t.l}</button>`).join('')}</div>
        <div class="chips">${[['nombre', 'A-Z'], ['tiempo', 'más rápido'], ['reciente', 'recientes']].map(([v, l]) => h`<button class="pill ${v === orden ? 'sel' : ''}" data-a="ordenPl" data-o="${v}">${l}</button>`).join('')}</div>
        ${sinCompletar.length > 1 ? `<div class="tarjeta fila"><div class="t mini">${sinCompletar.length} platos sin ficha</div><button class="btn" data-a="lotePl">Completarlas</button></div>` : ''}
        <div class="mini">${ps.length} de ${estado.platos.length} platos</div>
        ${ps.map(p => h`<div class="tarjeta" data-a="editarPl" data-id="${p.id}"><b>${p.nombre}</b>
          <div class="mini">${p.tipo || 'sin momento'} · ${p.min || '?'} min${(p.tags || []).length ? ' · ' + p.tags.join(', ') : ''}</div>
          ${p.descripcion ? h`<div class="cuerpo mini">${p.descripcion}</div>` : crudo('<div class="mini">sin ficha todavía</div>')}</div>`).join('') || aviso('Ningún plato encaja con esa búsqueda.').__crudo}`;
      })()}
      <div class="acciones"><button class="btn p" data-a="nuevoPl">+ Plato</button></div>`)}`;
  delegar(cont, {
    vista: el => navegar('alimentacion', { v: el.dataset.v, fecha }),
    dia: el => navegar('alimentacion', { v: 'menu', fecha: el.dataset.f }),
    proponer: () => { estado.menus = estado.menus.filter(m => m.fecha !== fecha); estado.menus.push(proponerMenu(fecha)); guardar(); },
    semanaLLM: el => conLLM(el, async () => {
      const j = await pedirJSON({ operacion: 'menu', tarea: `Propón el menú de 7 días a partir de ${fecha} (desayuno, comida y cena), saludable, variado, con cenas ligeras para dormir mejor, respetando las preferencias de alimentación del contexto. Reutiliza platos de esta lista cuando encajen: ${estado.platos.map(p => p.nombre).join('; ')}. Devuelve {"dias":[{"fecha":"AAAA-MM-DD","desayuno":{"nombre":"","min":10,"tags":["ligera"]},"comida":{...},"cena":{...}}]} con tags entre: ligera, proteina, vegetal, rapida, sin_gluten, sin_lactosa, pescado, carne.` });
      let n = 0;
      for (const d of listaLLM(j, 'dias')) {
        if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '')) continue;
        const menu = { id: uid(), fecha: d.fecha };
        for (const t of TIPOS) { const pl = d[t]; if (!pl || !pl.nombre) continue; let p = estado.platos.find(x => x.nombre.toLowerCase() === String(pl.nombre).toLowerCase()); if (!p) { p = { id: uid(), nombre: String(pl.nombre), tipo: t, tags: Array.isArray(pl.tags) ? pl.tags.map(String) : [], min: Number(pl.min) || 20, origen: 'llm' }; estado.platos.push(p); } menu[t] = p.id; }
        estado.menus = estado.menus.filter(m => m.fecha !== d.fecha); estado.menus.push(menu); n++;
      }
      guardar(); toast(n ? `Menú de ${n} días propuesto por el LLM` : 'El LLM no devolvió días válidos');
    }),
    foto: async el => {
      const f = el.files[0]; el.value = ''; if (!f) return;
      await conLLM(null, async () => {
        const imagen = await reducirImagen(f);
        const j = await pedirJSON({ operacion: 'foto-stock', contexto: false, imagen, mensaje: 'Esta es una foto de mi frigorífico o despensa.', tarea: 'Enumera los alimentos que se ven con una cantidad aproximada. Devuelve {"alimentos":[{"nombre":"","cantidad":1,"unidad":"ud"}]}. Nombres en español, genéricos (no marcas), sin repetir.' });
        let nuevos = 0, actualizados = 0;
        for (const a of listaLLM(j, 'alimentos')) { if (!a || !a.nombre) continue; const nombre = String(a.nombre).trim(); const ex = estado.alimentos.find(x => x.nombre.toLowerCase() === nombre.toLowerCase()); const stock = Number(a.cantidad) || 1; if (ex) { ex.stock = stock; actualizados++; } else { estado.alimentos.push({ id: uid(), nombre, stock, unidad: String(a.unidad || 'ud'), umbral: 1, tienda: '' }); nuevos++; } }
        sincronizarCompra(); guardar(); toast(`Stock desde la foto: ${nuevos} nuevos, ${actualizados} actualizados`, 5000); navegar('alimentacion', { v: 'stock' });
      }, 'Leyendo la foto…');
    },
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
    buscarPl: el => { params.q = el.value; render(cont, params); },
    momPl: el => { params.mom = el.dataset.m; render(cont, params); },
    ordenPl: el => { params.orden = el.dataset.o; render(cont, params); },
    nuevoPl: async () => { const v = await pedir('Nuevo plato', camposPlato, {}, { dictar: 'descripcion' }); if (v) { guardarPlato(v); toast('Guardado; el mayordomo completa la ficha'); } },
    editarPl: async el => {
      const p = estado.platos.find(x => x.id === el.dataset.id);
      const v = await pedir('Editar plato', camposPlato, p, { extra: 'Borrar', dictar: 'descripcion', otro: 'Rehacer ficha' });
      if (!v) return;
      if (v.__extra) { if (await confirmar('¿Borrar el plato?')) { estado.platos = estado.platos.filter(x => x.id !== p.id); guardar(); } return; }
      if (v.__otro) { p.descripcionManual = false; if (await analizarPlato(p, { forzar: true })) toast('Ficha rehecha'); return; }
      guardarPlato(v, p);
    },
    lotePl: async el => {
      el.disabled = true; el.textContent = 'Completando…';
      let n = 0;
      for (const p of estado.platos.filter(x => !x.descripcion).slice(0, 15)) { try { if (await analizarPlato(p)) n++; } catch (e) { toast('LLM: ' + e.message, 5000); break; } }
      toast(n ? n + ' fichas completadas' : 'Ninguna cambió'); render(cont, params);
    },
  });
}
export default { id: 'alimentacion', titulo: 'Alimentación', grupo: 'Mesa', icono: '🥗', render };
