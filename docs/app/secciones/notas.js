import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, fechaCorta, pedir, confirmar, toast, aviso } from '../nucleo.js';
import { pedirJSON } from '../llm.js';
import { botonDictado } from '../voz.js';

const ETIQUETAS = ['ejercicio', 'sueno', 'meditacion', 'alimentacion', 'suplementos', 'proyecto', 'ocio', 'finanzas', 'calendario', 'mayordomo', 'idea'];
const TIPOS = [{ v: 'nota', l: 'Nota' }, { v: 'preferencia', l: 'Preferencia (guía al mayordomo)' }, { v: 'tendencia', l: 'Tendencia (algo que noto)' }];
const VALIDOS = TIPOS.map(t => t.v);
export const campos = [
  { n: 'titulo', l: 'Título', ph: 'vacío = lo pone el mayordomo' },
  { n: 'texto', l: 'Texto', t: 'textarea', filas: 4, req: true },
  { n: 'etiquetas', l: 'Etiquetas (coma)', t: 'tags', ayuda: ETIQUETAS.join(' · ') },
  { n: 'tipo', l: 'Tipo', t: 'select', o: TIPOS, v: 'nota' },
];
// Título de emergencia mientras no llega el del mayordomo, o si no hay LLM: las primeras palabras.
export function tituloProvisional(texto) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  if (limpio.length <= 55) return limpio;
  const corte = limpio.slice(0, 55);
  return corte.slice(0, corte.lastIndexOf(' ') > 25 ? corte.lastIndexOf(' ') : 55) + '…';
}
// Analiza una nota y rellena SOLO lo que el usuario dejó vacío. Nunca pisa lo escrito a mano.
export async function analizarNota(nota, { forzar = false } = {}) {
  const faltaTitulo = forzar || !nota.tituloManual;
  const faltanEtiquetas = forzar || !(nota.etiquetas || []).length;
  if (!faltaTitulo && !faltanEtiquetas) return false;
  const j = await pedirJSON({
    operacion: 'nota', contexto: false,
    tarea: `Analiza esta nota personal y devuelve {"titulo":"","etiquetas":[],"tipo":"nota|preferencia|tendencia"}.
El título: una línea de 3 a 8 palabras en español, que diga de qué va la nota, sin comillas ni punto final.
Las etiquetas: de 1 a 3, preferentemente de esta lista: ${ETIQUETAS.join(', ')}; si ninguna encaja, propón una en minúsculas y sin acentos.
El tipo: "preferencia" si expresa lo que quiere o busca en los próximos días, "tendencia" si describe algo que nota que le pasa, "nota" en cualquier otro caso.`,
    mensaje: String(nota.texto || '').slice(0, 4000),
  });
  let cambio = false;
  if (faltaTitulo && j?.titulo) { nota.titulo = String(j.titulo).replace(/^["'\s]+|["'\s.]+$/g, '').slice(0, 90); cambio = true; }
  if (faltanEtiquetas && Array.isArray(j?.etiquetas) && j.etiquetas.length) {
    nota.etiquetas = j.etiquetas.map(e => String(e).toLowerCase().trim()).filter(Boolean).slice(0, 3); cambio = true;
  }
  // El tipo solo se sugiere; el usuario lo ve marcado y puede cambiarlo.
  if (!nota.tipoManual && VALIDOS.includes(j?.tipo) && j.tipo !== nota.tipo) { nota.tipo = j.tipo; nota.tipoSugerido = true; cambio = true; }
  if (cambio) { nota.analizada = true; guardar(); }
  return cambio;
}
// Guarda ya y analiza después: una nota nunca se pierde por un fallo de red.
export function guardarNota(datos, previa = null) {
  const nota = previa || { id: uid(), fecha: hoyISO() };
  Object.assign(nota, datos);
  nota.tituloManual = !!(datos.titulo || '').trim();
  if (!nota.titulo) nota.titulo = tituloProvisional(nota.texto);
  if (!previa) estado.notas.push(nota);
  guardar();
  analizarNota(nota).catch(e => console.warn('nota sin analizar:', e.message));
  return nota;
}

function render(cont, params) {
  const filtro = (params.q || '').toLowerCase(), etq = params.etq || '';
  const notas = estado.notas.filter(n => (!filtro || (n.texto + ' ' + (n.titulo || '')).toLowerCase().includes(filtro)) && (!etq || (n.etiquetas || []).includes(etq))).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  const usadas = [...new Set(estado.notas.flatMap(n => n.etiquetas || []))];
  const sinAnalizar = estado.notas.filter(n => !n.analizada && !n.tituloManual);
  cont.innerHTML = h`
    <div class="acciones"><input type="search" placeholder="Buscar en las notas" value="${filtro}" data-c="buscar"><button class="btn p" data-a="nueva">+ Nota</button></div>
    <div class="chips">${lista([h`<button class="pill ${etq ? '' : 'sel'}" data-a="etq" data-e="">todas</button>`, ...usadas.map(e => h`<button class="pill ${e === etq ? 'sel' : ''}" data-a="etq" data-e="${e}">${e}</button>`)])}</div>
    ${sinAnalizar.length > 1 ? h`<div class="tarjeta fila"><div class="t mini">${sinAnalizar.length} notas sin título propio</div><button class="btn" data-a="lote">Titularlas</button></div>` : ''}
    ${notas.length ? lista(notas.map(n => h`<div class="tarjeta nota t-${n.tipo}" data-a="editar" data-id="${n.id}">
      <b>${n.titulo || tituloProvisional(n.texto)}</b>
      <div class="mini">${fechaCorta(n.fecha)} · ${n.tipo}${n.tipoSugerido ? ' (sugerido)' : ''}${(n.etiquetas || []).length ? ' · ' + n.etiquetas.join(', ') : ''}</div>
      <div class="cuerpo">${n.texto}</div></div>`)) : aviso('Sin notas. Cualquier cosa vale: una idea, un plato que te sentó bien, un ejercicio que no repetirías.')}`;
  delegar(cont, {
    buscar: el => { params.q = el.value; render(cont, params); },
    etq: el => { params.etq = el.dataset.e; render(cont, params); },
    nueva: async () => { const v = await pedir('Nueva nota', campos, { etiquetas: etq ? [etq] : [] }, { dictar: 'texto' }); if (v) { guardarNota(v); toast('Guardada; el mayordomo le pone título'); } },
    editar: async el => {
      const n = estado.notas.find(x => x.id === el.dataset.id); if (!n) return;
      const v = await pedir('Editar nota', campos, n, { extra: 'Borrar', dictar: 'texto', otro: 'Retitular' });
      if (!v) return;
      if (v.__extra) { if (await confirmar('¿Borrar la nota?')) { estado.notas = estado.notas.filter(x => x.id !== n.id); guardar(); } return; }
      if (v.__otro) { n.tituloManual = false; if (await analizarNota(n, { forzar: true })) toast('Retitulada'); return; }
      if (v.tipo !== n.tipo) n.tipoManual = true;
      guardarNota(v, n);
    },
    lote: async el => {
      el.disabled = true; el.textContent = 'Titulando…';
      let n = 0;
      for (const nota of sinAnalizar.slice(0, 20)) { try { if (await analizarNota(nota)) n++; } catch (e) { toast('LLM: ' + e.message, 5000); break; } }
      toast(n ? n + ' notas tituladas' : 'Ninguna cambió'); render(cont, params);
    },
  });
}
export default { id: 'notas', titulo: 'Notas', grupo: 'Agenda', icono: '✎', render };
