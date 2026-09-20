import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, horaActual, pedir, confirmar, toast, aviso, navegar } from '../nucleo.js';
import { criteriosSuplemento, MOMENTOS } from '../datos/semillas.js';
import { sincronizarCompra } from './compra.js';

export function sugerir(nombre) { return criteriosSuplemento.find(c => c.k.test(nombre || '')) || { momento: 'comida', hora: '14:00', por: 'sin criterio específico: con una comida, por tolerancia' }; }
export const porcentaje = s => s.total ? Math.max(0, Math.min(100, Math.round(Number(s.stock) / Number(s.total) * 100))) : null;
export const bajoStock = s => porcentaje(s) != null && porcentaje(s) <= (Number(s.umbralPct) || 10);
export const tomadoHoy = s => estado.tomas.some(t => t.suplementoId === s.id && t.fecha === hoyISO());
const campos = (nombre = '') => [
  { n: 'nombre', l: 'Suplemento', req: true }, { n: 'dosis', l: 'Dosis', ph: '400 mg, 2 cápsulas…' },
  { n: 'momento', l: 'Momento de toma', t: 'select', o: MOMENTOS }, { n: 'hora', l: 'Hora del aviso', t: 'time' },
  { n: 'stock', l: 'Unidades que quedan', t: 'number', min: 0 }, { n: 'total', l: 'Unidades del envase completo', t: 'number', min: 1 },
  { n: 'umbralPct', l: 'Avisar al llegar al (%)', t: 'number', v: 10, min: 1, max: 50 }, { n: 'tienda', l: 'Tienda habitual (online)' }, { n: 'nota', l: 'Nota', ph: 'por qué lo tomo, lo dijo el médico…' },
];
function render(cont) {
  const orden = { manana: 1, comida: 2, tarde: 3, noche: 4, personal: 5 };
  const sups = estado.suplementos.slice().sort((a, b) => (orden[a.momento] || 9) - (orden[b.momento] || 9) || (a.hora || '').localeCompare(b.hora || ''));
  const pendientes = sups.filter(s => !tomadoHoy(s)).length;
  cont.innerHTML = h`
    <div class="tarjeta"><div class="fila"><div class="t"><b>${sups.length} suplementos</b><div class="mini">${pendientes} tomas pendientes hoy · ${sups.filter(bajoStock).length} por reponer</div></div><button class="btn p" data-a="nuevo">+ Suplemento</button></div></div>
    ${sups.length ? lista(sups.map(s => { const p = porcentaje(s); const t = tomadoHoy(s); return h`<div class="tarjeta"><div class="fila"><div class="t" data-a="editar" data-id="${s.id}"><b>${s.nombre}</b> ${bajoStock(s) ? crudo('<span class="pill w">reponer</span>') : ''}
        <div class="mini">${s.dosis || ''} · ${(MOMENTOS.find(m => m.v === s.momento) || {}).l || s.momento}${s.hora ? ' ' + s.hora : ''}${s.momento === 'personal' ? ' · fijado por mí' : ''}</div>
        ${p != null ? crudo(`<div class="barra"><i class="${bajoStock(s) ? 'w' : ''}" style="width:${p}%"></i></div><div class="mini">${s.stock}/${s.total} (${p} %)</div>`) : ''}</div>
        <button class="btn ${t ? '' : 'p'}" data-a="tomar" data-id="${s.id}">${t ? '✓ hoy' : 'Tomado'}</button></div></div>`; })) : aviso('Sin suplementos. Al añadir uno, la app propone el momento de toma por criterio general (magnesio noche, vitamina D con comida grasa…); tú puedes fijarlo a mano.')}
    <div class="acciones"><button class="btn" data-a="buscar">Buscar en tiendas</button><button class="btn" data-a="compra">Ver Compra</button></div>
    <h3>Tomas recientes</h3>
    ${lista(estado.tomas.slice(-8).reverse().map(t => h`<div class="mini">${t.fecha} ${t.hora} · ${estado.suplementos.find(s => s.id === t.suplementoId)?.nombre || '?'}</div>`))}
    <p class="mini">El criterio de hora es general, no médico. Cualquier momento "fijado por mí" manda sobre la sugerencia.</p>`;
  delegar(cont, {
    nuevo: async () => {
      const paso1 = await pedir('Nuevo suplemento', [{ n: 'nombre', l: 'Nombre', req: true }], {}, { aceptar: 'Siguiente' }); if (!paso1) return;
      const sug = sugerir(paso1.nombre);
      const v = await pedir(paso1.nombre, campos(), { nombre: paso1.nombre, momento: sug.momento, hora: sug.hora, umbralPct: 10 }, { texto: 'Sugerencia: ' + sug.por });
      if (v) { estado.suplementos.push({ id: uid(), ...v }); sincronizarCompra(); guardar(); }
    },
    editar: async el => { const s = estado.suplementos.find(x => x.id === el.dataset.id); const v = await pedir('Editar', campos(), s, { extra: 'Borrar', texto: 'Sugerencia: ' + sugerir(s.nombre).por }); if (!v) return; if (v.__extra) { if (await confirmar('¿Borrar ' + s.nombre + '?')) estado.suplementos = estado.suplementos.filter(x => x.id !== s.id); } else Object.assign(s, v); sincronizarCompra(); guardar(); },
    tomar: el => {
      const s = estado.suplementos.find(x => x.id === el.dataset.id);
      if (tomadoHoy(s)) { estado.tomas = estado.tomas.filter(t => !(t.suplementoId === s.id && t.fecha === hoyISO())); s.stock = Number(s.stock || 0) + 1; }
      else { estado.tomas.push({ id: uid(), suplementoId: s.id, fecha: hoyISO(), hora: horaActual() }); if (s.stock != null) s.stock = Math.max(0, Number(s.stock) - 1); if (bajoStock(s)) toast(`${s.nombre} al ${porcentaje(s)} %: añadido a Compra`); }
      sincronizarCompra(); guardar();
    },
    buscar: () => navegar('buscador', { cat: 'suplementos' }),
    compra: () => navegar('compra'),
  });
}
export default { id: 'suplementos', titulo: 'Suplementos', grupo: 'Mesa', icono: '💊', render };
