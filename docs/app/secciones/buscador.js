import { estado, guardar, h, lista, crudo, delegar, uid, pedir, confirmar, toast, aviso, navegar } from '../nucleo.js';
import { CATEGORIAS_TIENDA } from '../datos/semillas.js';
import { pedirJSON, conLLM } from '../llm.js';
const campos = [{ n: 'nombre', l: 'Tienda', req: true }, { n: 'categoria', l: 'Categoría', t: 'select', o: CATEGORIAS_TIENDA }, { n: 'url', l: 'URL de búsqueda con {q}', ph: 'https://tienda.es/buscar?q={q}', req: true }, { n: 'activa', l: 'Activa', t: 'check', v: true }];
function render(cont, params) {
  const q = params.q || '', cat = params.cat || '';
  const tiendas = estado.tiendas.filter(t => !cat || t.categoria === cat || (cat === 'alimentacion' && t.categoria === 'ecologica'));
  const activas = tiendas.filter(t => t.activa);
  const url = t => t.url.replace('{q}', encodeURIComponent(q));
  cont.innerHTML = h`
    <form class="tarjeta" id="f-b"><input type="search" name="q" value="${q}" placeholder="¿Qué buscas? alimento, suplemento, componente, actividad, servicio…">
      <div class="chips">${lista([{ v: '', l: 'todo' }, ...CATEGORIAS_TIENDA].map(c => h`<button type="button" class="pill ${c.v === cat ? 'sel' : ''}" data-a="cat" data-c="${c.v}">${c.l}</button>`))}</div>
      <div class="acciones"><button class="btn p" type="submit">Buscar</button>${q ? crudo('<button class="btn" type="button" data-a="interpretar">Afinar con LLM</button>') : ''}${q && activas.length ? crudo(`<button class="btn" type="button" data-a="todas">Abrir en las ${activas.length} tiendas</button>`) : ''}</div></form>
    ${params.entendido ? h`<div class="tarjeta"><div class="mini">Lo que he entendido</div><div>${params.entendido}</div>${params.consulta && params.consulta !== q ? h`<div class="mini">Consulta para las tiendas: <b>${params.consulta}</b> <button class="btn mini" data-a="usar" data-q="${params.consulta}">usarla</button></div>` : ''}</div>` : ''}
    ${q ? crudo('<h3>Resultados: una pestaña por tienda</h3>' + (activas.map(t => h`<div class="tarjeta fila"><div class="t"><b>${t.nombre}</b> <span class="pill g">${t.categoria}</span></div><a class="btn p mini" href="${url(t)}" target="_blank" rel="noopener">abrir ↗</a></div>`).join('') || aviso('No hay tiendas activas en esta categoría.').__crudo)) : ''}
    <h3>Catálogo de tiendas ${cat ? '· ' + cat : ''}</h3>
    ${tiendas.length ? lista(tiendas.map(t => h`<div class="tarjeta fila"><label class="check" style="margin:0"><input type="checkbox" data-c="activa" data-id="${t.id}" ${t.activa ? 'checked' : ''}></label><div class="t" data-a="editar" data-id="${t.id}"><b>${t.nombre}</b> <span class="pill g">${t.categoria}</span><div class="mini">${t.url}</div></div></div>`)) : aviso('Sin tiendas. Carga las semillas en Ajustes o añade la primera.')}
    <div class="acciones"><button class="btn" data-a="nueva">+ Tienda</button></div>
    <p class="mini">Buscador transversal: las demás secciones llegan aquí con su categoría. Las tiendas que no aportan se desactivan o se borran. Para agregar precios y ofertas reales de varias tiendas en una sola pantalla está <a href="https://npiobject-labs.github.io/buscaproducto/" target="_blank" rel="noopener">buscaproducto</a>, del mismo autor (deuda D5).</p>`;
  cont.querySelector('#f-b').onsubmit = e => { e.preventDefault(); navegar('buscador', { q: e.target.q.value.trim(), cat }); };
  delegar(cont, {
    cat: el => navegar('buscador', { q, cat: el.dataset.c }),
    usar: el => { params.q = el.dataset.q; params.entendido = ''; render(cont, params); },
    // Como en buscaproducto: el LLM convierte lo que pides en una consulta corta y eficaz para
    // el buscador de una tienda, y dice en qué categoría buscarlo.
    interpretar: el => conLLM(el, async () => {
      const j = await pedirJSON({ operacion: 'buscador', contexto: false, tarea: `Convierte esta petición de compra o de búsqueda en una consulta corta y eficaz para el buscador de una tienda española: «${q}». Devuelve {"consulta":"","categoria":"alimentacion|ecologica|suplementos|electronica|ocio|general|servicios","entendido":"una frase con lo que has entendido","alternativas":["otra formulación"]}.` });
      params.entendido = String(j.entendido || ''); params.consulta = String(j.consulta || q);
      if (CATEGORIAS_TIENDA.some(c => c.v === j.categoria)) params.cat = j.categoria;
      render(cont, params);
    }),
    todas: () => { let abiertas = 0; for (const t of activas) { if (window.open(url(t), '_blank')) abiertas++; } if (abiertas < activas.length) toast('El navegador bloqueó algunas pestañas; usa los botones "abrir"'); },
    activa: el => { const t = estado.tiendas.find(x => x.id === el.dataset.id); t.activa = el.checked; guardar(); },
    nueva: async () => { const v = await pedir('Nueva tienda', campos, { categoria: cat || 'general' }); if (v) { estado.tiendas.push({ id: uid(), ...v }); guardar(); } },
    editar: async el => { const t = estado.tiendas.find(x => x.id === el.dataset.id); const v = await pedir('Editar tienda', campos, t, { extra: 'Borrar' }); if (!v) return; if (v.__extra) { if (await confirmar('¿Borrar ' + t.nombre + '?')) estado.tiendas = estado.tiendas.filter(x => x.id !== t.id); } else Object.assign(t, v); guardar(); },
  });
}
export default { id: 'buscador', titulo: 'Buscador', grupo: 'Mayordomo', icono: '⌕', render };
