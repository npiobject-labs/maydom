// Notas en tres pestañas —Tareas, Compras e Ideas— con un solo diálogo para dictar (mock 5).
// La clase la decide el mayordomo (operación `nota`, la misma llamada que pone el título) y, sin
// LLM o mientras llega, las reglas de interpretar-nota.js; lo que se elige a mano manda.
// Las compras no se guardan como notas: son líneas de la lista de Compra, que es una sola.
import { estado, guardar, h, lista, crudo, delegar, pedir, uid, hoyISO, diasEntre, fechaCorta, fechaLarga, confirmar, toast, aviso, esc, navegar, rutaActual, tomarOrigen, crecer, montarCajas, salirPantalla } from '../nucleo.js';
import { pedirJSON } from '../llm.js';
import { botonDictado } from '../voz.js';
import { CLASES, claseDe, topeDe, lineasDe, tituloTarea, partesDe, etiquetaCompra, sinAcentos, ETIQUETAS_COMPRA } from '../interpretar-nota.js';
import { revision, resultado, cambios, detalleCambio } from '../revisar-texto.js';
import { anadirCompras, etiquetaDe, nombreEtiqueta, etiquetasCompra, editarLinea, marcarComprado, categoriaBusqueda } from './compra.js';
import { abrirAnalisis, crearInforme, regenerar, reintentar, generando, copiarInforme, descargarInforme, compartirInforme, nombreModelo, dolares, fechaHora } from '../informe.js';
import { markdown } from '../markdown.js';

const ETIQUETAS = ['ejercicio', 'sueno', 'meditacion', 'alimentacion', 'suplementos', 'proyecto', 'ocio', 'finanzas', 'calendario', 'mayordomo', 'idea', 'casa', 'papeleo', 'salud'];
const TIPOS = [{ v: 'nota', l: 'Nota' }, { v: 'preferencia', l: 'Preferencia (guía al mayordomo)' }, { v: 'tendencia', l: 'Tendencia (algo que noto)' }];
const VALIDOS = TIPOS.map(t => t.v);
const NOMBRE_CLASE = { tarea: '☑ Tarea', compra: '🛒 Compra', idea: '💡 Idea' };
const PESTANAS = [{ v: 'tareas', l: 'Tareas', clase: 'tarea' }, { v: 'compras', l: 'Compras', clase: 'compra' }, { v: 'ideas', l: 'Ideas', clase: 'idea' }, { v: 'informes', l: 'Informes' }];
const PESTANA_DE = { tarea: 'tareas', compra: 'compras', idea: 'ideas' };

export const esIdea = n => (n.clase || 'idea') === 'idea';
export const esTarea = n => n.clase === 'tarea';
// Llevan etiquetas las tareas y las ideas; una compra la lleva en cada línea (mock 6).
const conEtiquetas = n => esIdea(n) || esTarea(n);
// Las etiquetas que ya se usan, las más usadas primero.
function etiquetasUsadas() {
  const c = {};
  for (const n of estado.notas) for (const e of n.etiquetas || []) c[e] = (c[e] || 0) + 1;
  return Object.keys(c).sort((a, b) => c[b] - c[a] || a.localeCompare(b));
}
export const tareasPendientes = () => estado.notas.filter(n => esTarea(n) && !n.hecha).sort((a, b) => (a.tope || '9').localeCompare(b.tope || '9'));
export const tareasDe = fecha => estado.notas.filter(n => esTarea(n) && n.tope === fecha);
export function relativo(tope) {
  const n = diasEntre(hoyISO(), tope);
  return n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === -1 ? 'ayer' : n < 0 ? `hace ${-n} días` : `en ${n} días`;
}
export function marcarTarea(id) {
  const n = estado.notas.find(x => x.id === id); if (!n) return null;
  n.hecha = !n.hecha; n.hechaEl = n.hecha ? hoyISO() : null;
  guardar(); toast(n.hecha ? 'Hecha' : 'Pendiente otra vez');
  return n;
}
// Tarjeta de una tarea: la usan Notas, Hoy y el Calendario con las acciones tareaHecha y verTarea.
// En Notas (`filtrar`) sus etiquetas filtran la lista; en Hoy y el Calendario solo se ven.
export function tarjetaTarea(n, op = {}) {
  const d = n.tope ? diasEntre(hoyISO(), n.tope) : null, vencida = !n.hecha && d != null && d < 0;
  const etqs = (n.etiquetas || []).map(e => op.filtrar ? h`<button class="etq" data-a="etqTarea" data-e="${e}" aria-label="Filtrar por ${e}">${e}</button>` : h`<span class="etq">${e}</span>`);
  return h`<div class="tarjeta fila tarea ${n.hecha ? 'hecha' : ''} ${vencida ? 'vencida' : ''}">
    <button class="chk" data-a="tareaHecha" data-id="${n.id}" aria-label="${n.hecha ? 'Marcar pendiente' : 'Marcar hecha'}">${n.hecha ? '✓' : ''}</button>
    <div class="t" data-a="verTarea" data-id="${n.id}"><b>${n.titulo || tituloProvisional(n.texto)}</b>
      <div class="mini">${n.hecha ? 'hecha el ' + fechaCorta(n.hechaEl || n.tope) : n.tope ? 'tope ' + fechaLarga(n.tope) : 'sin fecha tope'}${n.original ? ' · ✨ revisada' : ''}</div>${etqs.length ? h`<div class="etqs">${lista(etqs)}</div>` : ''}</div>
    ${n.tope && !n.hecha ? h`<span class="pill ${vencida ? 'mal' : d === 0 ? 'w' : 'g'}">${relativo(n.tope)}</span>` : ''}</div>`;
}

// Título de emergencia mientras no llega el del mayordomo, o si no hay LLM: las primeras palabras.
export function tituloProvisional(texto) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  if (limpio.length <= 55) return limpio;
  const corte = limpio.slice(0, 55);
  return corte.slice(0, corte.lastIndexOf(' ') > 25 ? corte.lastIndexOf(' ') : 55) + '…';
}

// ---------- análisis con el mayordomo ----------
function tareaAnalisis() {
  const hoy = hoyISO();
  return `Hoy es ${fechaLarga(hoy)} (${hoy}). Analiza esta nota personal dictada y devuelve solo este JSON:
{"clase":"tarea|compra|idea","titulo":"","etiquetas":[],"tipo":"nota|preferencia|tendencia","tope":"","lineas":[{"nombre":"","cantidad":"","etiqueta":""}],"partes":[]}
- clase: "tarea" si es algo que hay que hacer (llamar, pagar, renovar, llevar, pedir cita…); "compra" si es algo que hay que comprar o reponer; "idea" en cualquier otro caso (una idea, algo que nota, algo que quiere).
- titulo: una línea de 3 a 8 palabras en español que diga de qué va, sin comillas ni punto final; en una tarea, en infinitivo y sin el plazo («Llevar el coche a la ITV»).
- tope, solo en una tarea: la fecha límite en AAAA-MM-DD si la nota dice una. Un día de la semana es el próximo («el jueves» dicho un jueves es el de la semana que viene); «esta semana» es el domingo. Vacío si no dice ninguna: no la inventes.
- lineas, solo en una compra: una por producto, con la cantidad si se dice («2 l», «1 docena») y la etiqueta que mejor encaje de esta lista: ${etiquetasCompra().join(', ')}.
- etiquetas, en una tarea o una idea: de 1 a 3, preferentemente de esta lista: ${ETIQUETAS.join(', ')} (si ninguna encaja, una en minúsculas y sin acentos).
- tipo, solo en una idea: "preferencia" si expresa lo que quiere o busca en los próximos días, "tendencia" si describe algo que nota que le pasa, "nota" en otro caso.
- partes: solo si la nota junta cosas de clases distintas (una tarea y una compra, por ejemplo), [{"clase":"","texto":"el trozo de la nota, tal cual"}]; si no, [].`;
}
export const analizar = texto => pedirJSON({ operacion: 'nota', contexto: false, tarea: tareaAnalisis(), mensaje: String(texto || '').slice(0, 4000) });
const limpiarTitulo = t => String(t).replace(/^["'«\s]+|["'»\s.]+$/g, '').slice(0, 90);
const esISO = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const limpiarEtiqueta = e => sinAcentos(e).toLowerCase().trim().replace(/[^a-z0-9ñ ]/g, '').replace(/\s+/g, ' ');
// Rellena SOLO lo que el usuario dejó vacío. Nunca pisa lo escrito a mano.
// Con `soloEtiquetas` no toca ni el título ni el tipo: es lo que pide etiquetar las tareas de antes.
function aplicarAnalisis(nota, j, { forzar = false, soloEtiquetas = false } = {}) {
  if (!j || !estado.notas.includes(nota)) return false;
  let cambio = false;
  if (!soloEtiquetas && (forzar || !nota.tituloManual) && j.titulo) { nota.titulo = limpiarTitulo(j.titulo); cambio = true; }
  if (conEtiquetas(nota) && (forzar || !(nota.etiquetas || []).length) && Array.isArray(j.etiquetas) && j.etiquetas.length) {
    nota.etiquetas = j.etiquetas.map(limpiarEtiqueta).filter(Boolean).slice(0, 3); cambio = true;
  }
  // El tipo solo se sugiere; el usuario lo ve marcado y puede cambiarlo.
  if (esIdea(nota) && !soloEtiquetas && !nota.tipoManual && VALIDOS.includes(j.tipo) && j.tipo !== nota.tipo) { nota.tipo = j.tipo; nota.tipoSugerido = true; cambio = true; }
  if (cambio) { nota.analizada = true; guardar(); }
  return cambio;
}
export async function analizarNota(nota, opciones = {}) {
  const faltaTitulo = !opciones.soloEtiquetas && (opciones.forzar || !nota.tituloManual);
  const faltanEtiquetas = conEtiquetas(nota) && (opciones.forzar || !(nota.etiquetas || []).length);
  if (!faltaTitulo && !faltanEtiquetas) return false;
  return aplicarAnalisis(nota, await analizar(nota.texto), opciones);
}

// ---------- revisión bajo demanda (operación nota-revisar, mock 6) ----------
// Nunca al guardar: cambia el texto del usuario, así que solo corre cuando lo pide con ✨ Revisar, y
// enseña cada cambio para desmarcarlo antes de aplicarlo. El texto de antes se guarda en `nota.original`.
function tareaRevision(clase) {
  const hoy = hoyISO();
  return `Hoy es ${fechaLarga(hoy)} (${hoy}). Revisa esta nota personal (${clase === 'tarea' ? 'una tarea' : 'una idea'}), dictada o escrita en el móvil, y devuelve solo este JSON:
{"texto":"","lista":"","correcciones":[{"antes":"","despues":"","tipo":"","nota":"","opcional":false}],"avisos":[],"titulo":"","etiquetas":[],"tipo":"","partes":[]}
- texto: la nota corregida sin cambiar lo que dice ni el tono: tildes, ortografía, gramática, puntuación, mayúsculas y lo que el dictado oye mal («haber si» por «a ver si», «e dado» por «he dado»). No resumas, no añadas ni quites nada, no cambies palabras que estén bien.
- lista: solo si la nota enumera varias cosas (cosas que hacer, que llevar, pasos): la misma nota corregida como lista, una línea por cosa empezando por "- ", con una línea de cabecera si todas comparten algo (el plazo, por ejemplo). Vacío si no enumera nada.
- correcciones: cada cambio de "texto" que no sea solo de puntuación o mayúsculas; "antes" copiado tal cual de la nota, "despues" como queda, "tipo" uno de Ortografía, Tildes, Gramática, Dictado o Estilo, y una "nota" de pocas palabras si no es obvio. "opcional": true si es cuestión de estilo y no un error.
- avisos: lo que no tiene arreglo automático y conviene saber (cómo se entiende una fecha u hora, un dato que falta, una frase que admite dos lecturas), en frases cortas; [] si no hay nada.
- titulo: de 3 a 8 palabras, sin comillas ni punto final; en una tarea, en infinitivo y sin el plazo.
- etiquetas: de 1 a 3, preferentemente de esta lista: ${ETIQUETAS.join(', ')} (si ninguna encaja, una en minúsculas y sin acentos).
- tipo, solo en una idea: "preferencia" si expresa lo que quiere o busca, "tendencia" si describe algo que nota que le pasa, "nota" en otro caso.
- partes, solo en una tarea que junta varias cosas que hacer: [{"texto":"cada una, ya corregida","titulo":""}]; si no, [].`;
}
export const revisarTexto = (texto, clase) => pedirJSON({ operacion: 'nota-revisar', contexto: false, tarea: tareaRevision(clase), mensaje: String(texto || '').slice(0, 4000) });
// La respuesta del mayordomo, lista para enseñar: los cambios de cada formato con sus ids, y lo que propone.
export function prepararRevision(original, j, yaPuestas = []) {
  const correcciones = (Array.isArray(j?.correcciones) ? j.correcciones : []).filter(c => c && (c.antes || c.despues));
  const corregido = String(j?.texto || '').trim() || original, enLista = String(j?.lista || '').trim();
  const formatos = { corrido: revision(original, corregido, correcciones) };
  if (enLista && enLista !== corregido) formatos.lista = revision(original, enLista, correcciones, { formato: true });
  const etiquetas = (Array.isArray(j?.etiquetas) ? j.etiquetas : []).map(limpiarEtiqueta).filter(e => e && !yaPuestas.includes(e)).slice(0, 3);
  return {
    original, formatos, fmt: formatos.lista ? 'lista' : 'corrido', vista: 'cambios',
    // Lo opcional (cuestión de estilo) llega desmarcado; lo demás, marcado.
    acc: Object.fromEntries(Object.entries(formatos).map(([f, x]) => [f, Object.fromEntries(Object.entries(x.problemas).map(([id, pr]) => [id, !pr.opcional]))])),
    avisos: (Array.isArray(j?.avisos) ? j.avisos : []).map(a => String(a || '').trim()).filter(Boolean).slice(0, 5),
    titulo: j?.titulo ? limpiarTitulo(j.titulo) : '',
    etqOn: Object.fromEntries(etiquetas.map(e => [e, true])),
    tipo: VALIDOS.includes(j?.tipo) ? j.tipo : '',
    partes: (Array.isArray(j?.partes) ? j.partes : []).filter(x => String(x?.texto || '').trim()).map(x => ({ texto: String(x.texto).trim(), titulo: x.titulo ? limpiarTitulo(x.titulo) : '' })),
  };
}
const htmlCambios = (segs, acc) => segs.map(([op, t, id]) => {
  const on = !id || id === 'f' || acc[id];
  return op === '=' ? esc(t) : op === '-' ? (on ? `<del>${esc(t)}</del>` : esc(t)) : (on ? `<ins>${esc(t)}</ins>` : '');
}).join('');

// ---------- guardar ----------
// Guarda ya y analiza después: una nota nunca se pierde por un fallo de red.
function guardarNota(datos, previa = null) {
  const nota = previa || { id: uid(), fecha: hoyISO() };
  const tituloAntes = previa?.titulo;
  Object.assign(nota, datos);
  if (!nota.original) delete nota.original;
  nota.tituloManual = !!datos.titulo && (previa ? previa.tituloManual || datos.titulo !== tituloAntes : true);
  if (!nota.titulo) nota.titulo = esTarea(nota) ? tituloTarea(nota.texto) || tituloProvisional(nota.texto) : tituloProvisional(nota.texto);
  if (esTarea(nota)) { nota.tipo = 'nota'; nota.hecha = !!nota.hecha; }
  if (!previa) estado.notas.push(nota);
  guardar();
  return nota;
}

// ---------- el diálogo ----------
// Un solo diálogo para las tres clases. Se dicta o se escribe; las reglas clasifican al momento y el
// mayordomo afina cuando termina el dictado o se sale del texto. Nada de lo tocado a mano se pisa:
// ni la clase, ni la fecha tope, ni las líneas de compra.
export function abrirNota({ clase = '', previa = null } = {}) {
  return new Promise(resolve => {
    const hoy = hoyISO(), fijable = tomarOrigen();
    const textoAntes = previa?.texto, manualAntes = previa?.tituloManual;
    const st = { clase: previa?.clase || clase || 'idea', manual: !!(previa || clase), topeTocado: !!previa, lineasTocadas: false, lineas: [], partes: [], j: null, jTexto: '', pendiente: null, pTexto: '',
      etiquetas: [...(previa?.etiquetas || [])], original: previa?.original || '', rev: null, revHecha: previa?.original ? { guardada: true } : null, antes: null, verOriginal: false, tituloIA: false };
    const dlg = document.createElement('dialog');
    dlg.className = 'modal dialogo-nota';
    dlg.innerHTML = `<form class="form" autocomplete="off" novalidate>
      <div class="cabecera-modal"><h2 data-titulo></h2>
        ${fijable ? '<button type="button" class="fijar" data-fijar aria-label="Fijar en inicio" title="Fijar en inicio">☆</button>' : ''}
        <button type="button" class="cerrar" data-cancelar aria-label="Cerrar sin guardar" title="Cerrar sin guardar">✕</button></div>
      <label for="n_texto">Dicta o escribe</label>
      <textarea id="n_texto" name="texto" rows="3" placeholder="«Llamar al fontanero el jueves» · «Comprar leche, huevos y pilas» · una idea"></textarea>
      <div class="bajo-texto"><span data-voz></span><span data-para="tarea idea"><button type="button" class="btn" data-revisar>✨ Revisar</button> <small class="mini">corrige, da formato y etiqueta · 1 consulta</small></span></div>
      <div data-rev></div>
      <label>Es una</label>
      <div class="segmento" role="radiogroup">${CLASES.map(c => `<button type="button" role="radio" data-clase="${c}">${NOMBRE_CLASE[c]}</button>`).join('')}</div>
      <div class="mini detectado" data-detectado></div>
      <div class="aviso-mezcla" data-mezcla hidden></div>
      <div data-para="tarea idea"><label for="n_titulo">Título</label><input id="n_titulo" name="titulo" placeholder="vacío = lo pone el mayordomo"><small class="mini" data-titulo-ia></small></div>
      <div data-para="tarea"><label for="n_tope">Fecha tope</label><input id="n_tope" name="tope" type="date">
        <div class="rapidas">${[['Hoy', 0], ['Mañana', 1], ['Viernes', 'v'], ['Domingo', 'd'], ['En 15 días', 15]].map(([l, n]) => `<button type="button" class="pill" data-tope="${esc(fechaRapida(hoy, n))}">${l}</button>`).join('')}</div>
        <small class="mini" data-leido></small></div>
      <div data-para="compra"><label>Qué hay que comprar <span class="mini">(una línea por cosa)</span></label><div data-lineas></div>
        <div class="acciones"><button type="button" class="btn mini" data-mas>+ línea</button><span class="mini">Van a la lista de 🧺 Compra</span></div></div>
      <div data-para="tarea idea"><label for="n_etq">Etiquetas</label><div class="fichas" data-fichas></div><div class="rapidas" data-usadas></div><datalist id="n_etqs"></datalist></div>
      <div data-para="idea"><label for="n_tipo">Tipo</label><select id="n_tipo" name="tipo">${TIPOS.map(t => `<option value="${t.v}">${esc(t.l)}</option>`).join('')}</select></div>
      <div class="acciones fin">
        ${previa ? '<button type="button" class="btn peligro" data-borrar>Borrar</button><button type="button" class="btn" data-retitular>Retitular</button>' : ''}
        <button type="button" class="btn" data-cancelar>Cancelar</button><button type="submit" class="btn p">Guardar</button></div></form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form'), $ = s => dlg.querySelector(s);
    const campo = n => form.elements[n];
    const cerrar = v => { salirPantalla(dlg); dlg.close(); dlg.remove(); resolve(v); };
    // La caja del texto crece sola hasta el 40 % de la pantalla (el resto es el formulario) o hasta donde la deje el asa.
    montarCajas(form, 0.4);

    function ponerClase(c) {
      st.clase = c;
      dlg.querySelectorAll('[data-clase]').forEach(b => { b.classList.toggle('sel', b.dataset.clase === c); b.setAttribute('aria-checked', b.dataset.clase === c); });
      dlg.querySelectorAll('[data-para]').forEach(d => { d.hidden = !d.dataset.para.split(' ').includes(c); });
      $('[data-titulo]').textContent = previa ? (c === 'tarea' ? 'Editar tarea' : c === 'compra' ? 'Pasar a la compra' : 'Editar nota') : st.manual || campo('texto').value.trim() ? { tarea: 'Nueva tarea', compra: 'Añadir a la compra', idea: 'Nueva idea' }[c] : 'Nueva nota';
      const texto = campo('texto').value.trim();
      if (c === 'tarea' && !st.topeTocado && !campo('tope').value && texto) ponerTope(topeDe(textoDe('tarea'), hoy), 'reglas');
      if (c === 'compra' && !st.lineasTocadas && !st.lineas.length) { st.lineas = lineasCompra(); pintarLineas(); }
      if (c === 'tarea' || c === 'idea') campo('titulo').placeholder = placeholderTitulo();
    }
    // El trozo del texto que toca a una clase cuando la nota junta varias cosas.
    const textoDe = c => st.partes.find(p => p.clase === c)?.texto || campo('texto').value.trim();
    const lineasCompra = () => (st.j && st.jTexto === campo('texto').value.trim() && st.j.lineas?.length ? lineasLLM(st.j) : lineasDe(textoDe('compra')));
    function placeholderTitulo() {
      const texto = campo('texto').value.trim();
      if (st.j && st.jTexto === texto && st.j.titulo && !st.partes.length) return limpiarTitulo(st.j.titulo);
      if (st.clase === 'tarea' && texto) return tituloTarea(textoDe('tarea')) || 'vacío = lo pone el mayordomo';
      return 'vacío = lo pone el mayordomo';
    }
    function ponerTope(t, fuente) {
      if (t.tope) {
        campo('tope').value = t.tope;
        $('[data-leido]').textContent = `${fuente === 'llm' ? 'El mayordomo entiende' : 'Leído del dictado'}: ${t.leido ? '«' + t.leido + '» → ' : ''}${fechaLarga(t.tope)} (${relativo(t.tope)})`;
      } else if (fuente === 'reglas') { campo('tope').value = ''; $('[data-leido]').textContent = 'No he oído ninguna fecha: elige una.'; }
    }
    function pintarLineas() {
      const etqs = [...new Set([...etiquetasCompra(), ...st.lineas.map(l => l.etiqueta)])];
      $('[data-lineas]').innerHTML = st.lineas.map((l, i) => `<div class="linea-compra">
        <input data-l="${i}" data-k="nombre" value="${esc(l.nombre)}" placeholder="qué" aria-label="Qué">
        <input data-l="${i}" data-k="cantidad" value="${esc(l.cantidad)}" placeholder="cuánto" aria-label="Cantidad">
        <select data-l="${i}" data-k="etiqueta" aria-label="Etiqueta">${etqs.map(e => `<option value="${esc(e)}" ${e === l.etiqueta ? 'selected' : ''}>${esc(etiquetaCorta(e))}</option>`).join('')}<option value="__nueva">＋ nueva…</option></select>
        <button type="button" data-quitar="${i}" aria-label="Quitar">✕</button></div>`).join('') || '<div class="mini">Dicta o escribe lo que hay que comprar, o añade una línea.</div>';
    }
    function pintarMezcla() {
      const caja = $('[data-mezcla]');
      caja.hidden = st.partes.length < 2;
      if (caja.hidden) return;
      caja.innerHTML = `Esto parecen <b>${st.partes.length === 2 ? 'dos' : st.partes.length} cosas</b>:<ul>${st.partes.map(p => `<li>${NOMBRE_CLASE[p.clase]}: «${esc(p.texto)}»</li>`).join('')}</ul>
        <button type="button" class="btn mini" data-partir>Guardar por separado</button> <button type="button" class="btn mini" data-no-partir>Dejarla en una</button>`;
    }
    // Aplica una interpretación (de las reglas o del mayordomo) sin pisar nada de lo tocado a mano.
    function aplicar(r, fuente) {
      const partes = (r.partes || []).filter(p => CLASES.includes(p.clase) && String(p.texto || '').trim()).map(p => ({ clase: p.clase, texto: String(p.texto).trim() }));
      st.partes = new Set(partes.map(p => p.clase)).size > 1 ? partes : [];
      pintarMezcla();
      if (!st.manual && CLASES.includes(r.clase)) {
        const c = st.partes.some(p => p.clase === 'tarea') ? 'tarea' : st.partes[0]?.clase || r.clase;
        if (!st.lineasTocadas) st.lineas = [];
        ponerClase(c);
        $('[data-detectado]').textContent = st.partes.length ? 'La nota junta cosas distintas: puedes guardarlas por separado.'
          : `${fuente === 'llm' ? 'El mayordomo lo ve como' : 'Parece'} ${{ tarea: 'una tarea', compra: 'una compra', idea: 'una idea' }[c]}; cámbialo si no.`;
      }
      if (!st.topeTocado && (st.clase === 'tarea' || st.partes.some(p => p.clase === 'tarea'))) ponerTope(r.tope || { tope: '' }, fuente);
      if (!st.lineasTocadas && st.clase === 'compra') { st.lineas = r.lineas?.length ? r.lineas : lineasDe(textoDe('compra')); pintarLineas(); }
      campo('titulo').placeholder = placeholderTitulo();
    }
    function aplicarReglas() {
      const texto = campo('texto').value.trim();
      if (!texto || (st.j && st.jTexto === texto)) return;
      const partes = partesDe(texto, hoy), tarea = partes.find(p => p.clase === 'tarea')?.texto || texto;
      aplicar({ clase: claseDe(texto, hoy), partes, tope: topeDe(tarea, hoy), lineas: lineasDe(partes.find(p => p.clase === 'compra')?.texto || texto) }, 'reglas');
    }
    function consultarMayordomo() {
      const texto = campo('texto').value.trim();
      if (texto.split(/\s+/).length < 2 || texto === st.pTexto || (previa && texto === textoAntes)) return;
      st.pTexto = texto;
      const p = st.pendiente = analizar(texto);
      p.then(j => {
        if (!dlg.open || campo('texto').value.trim() !== texto || !j) return;
        st.j = j; st.jTexto = texto;
        aplicar({ clase: j.clase, partes: j.partes, tope: { tope: esISO(j.tope) ? j.tope : '', leido: '' }, lineas: lineasLLM(j) }, 'llm');
      }).catch(e => console.warn('nota sin analizar:', e.message));
    }
    // Analiza después de guardar, reutilizando la consulta que ya estaba en marcha para el mismo texto.
    // Si no cambió el texto, solo se buscan las etiquetas que falten: el título ya estaba puesto.
    function analizarDespues(nota) {
      const sinEtiquetas = conEtiquetas(nota) && !(nota.etiquetas || []).length;
      const igual = !!previa && nota.texto === textoAntes && nota.analizada && nota.tituloManual === manualAntes;
      if ((igual || nota.tituloManual) && !sinEtiquetas) return;
      const p = st.pendiente && st.pTexto === nota.texto ? st.pendiente : analizar(nota.texto);
      p.then(j => aplicarAnalisis(nota, j, { soloEtiquetas: igual })).catch(e => console.warn('nota sin analizar:', e.message));
    }
    const irA = c => { if (rutaActual().id === 'notas' && rutaActual().params.v !== PESTANA_DE[c]) navegar('notas', { v: PESTANA_DE[c] }); };
    function guardarTarea(texto, titulo, tope, sobre = null, extra = {}) {
      const n = guardarNota({ clase: 'tarea', texto, titulo, tope, etiquetas: sobre?.etiquetas || [], ...extra }, sobre);
      analizarDespues(n); return n;
    }
    function guardarIdea(texto, datos, sobre = null) {
      if (sobre && datos.tipo !== sobre.tipo) datos.tipoManual = true;
      const n = guardarNota({ clase: 'idea', texto, hecha: false, ...datos }, sobre);
      analizarDespues(n); return n;
    }
    const quitarPrevia = () => { if (previa) estado.notas = estado.notas.filter(x => x.id !== previa.id); };

    // ---- etiquetas: fichas que se quitan con ✕; se añaden escribiendo o tocando una de las usadas ----
    function pintarFichas(foco = false) {
      $('[data-fichas]').innerHTML = st.etiquetas.map(e => `<span class="ficha">${esc(e)}<button type="button" data-quitar-etq="${esc(e)}" aria-label="Quitar ${esc(e)}">✕</button></span>`).join('')
        + `<input id="n_etq" list="n_etqs" enterkeyhint="done" autocomplete="off" placeholder="${st.etiquetas.length ? '+ etiqueta' : 'vacío = las pone el mayordomo al guardar'}" aria-label="Añadir etiqueta">`;
      const libres = [...new Set([...etiquetasUsadas(), ...ETIQUETAS])].filter(e => !st.etiquetas.includes(e));
      $('[data-usadas]').innerHTML = libres.slice(0, 8).map(e => `<button type="button" class="pill" data-sug-etq="${esc(e)}">+ ${esc(e)}</button>`).join('');
      $('#n_etqs').innerHTML = libres.map(e => `<option value="${esc(e)}">`).join('');
      if (foco) $('#n_etq').focus();
    }
    // El campo se vacía antes de repintar las fichas: al quitarlo del DOM salta su blur, que volvería a añadirla.
    function anadirEtiqueta(v, foco = true) {
      const campoEtq = $('#n_etq'); if (campoEtq) campoEtq.value = '';
      for (const trozo of String(v).split(',')) { const e = limpiarEtiqueta(trozo); if (e && !st.etiquetas.includes(e)) st.etiquetas.push(e); }
      pintarFichas(foco);
    }

    // ---- revisión: se pide con ✨ Revisar y no escribe nada hasta «Aplicar» ----
    const AVISO_IA = 'Propuesto por el mayordomo; cámbialo si quieres.';
    function htmlRevision() {
      if (!st.rev && st.revHecha) {
        const ver = `<button type="button" class="enlace" data-ver-original>${st.verOriginal ? 'ocultar' : 'ver'} el original</button>`;
        const cita = st.verOriginal && st.original ? `<blockquote>${esc(st.original)}</blockquote>` : '';
        return st.revHecha.guardada
          ? `<div class="rev-hecha">✨ Texto revisado por el mayordomo · ${ver} · <button type="button" class="enlace" data-volver-original>volver a él</button>${cita}</div>`
          : `<div class="rev-hecha">✓ Revisada: ${st.revHecha.n} ${st.revHecha.n === 1 ? 'cambio aplicado' : 'cambios aplicados'} · <button type="button" class="enlace" data-deshacer>↶ Deshacer</button> · ${ver}${cita}</div>`;
      }
      const r = st.rev;
      if (!r) return '';
      if (r.cargando) return '<div class="revision"><div class="rev-cab"><b>✨ Revisión</b></div><div class="cargando"><i></i>El mayordomo está leyendo el texto…</div></div>';
      const { segs, problemas } = r.formatos[r.fmt], acc = r.acc[r.fmt], ids = cambios(segs), fmts = Object.keys(r.formatos), etqs = Object.keys(r.etqOn);
      const filas = ids.map(id => {
        const pr = problemas[id] || { tipo: 'Cambio' }, x = detalleCambio(segs, id);
        const que = id === 'p' ? `${x.signos} ${x.signos === 1 ? 'signo o mayúscula' : 'signos y mayúsculas'}`
          : !x.antes ? `añade <b>${esc(x.despues)}</b>` : !x.despues ? `quita <s>${esc(x.antes)}</s>` : `<s>${esc(x.antes)}</s> → <b>${esc(x.despues)}</b>`;
        return `<label class="prob"><input type="checkbox" data-prob="${id}" ${acc[id] ? 'checked' : ''}><span><span class="tipo-p">${esc(pr.tipo)}</span>${que}${pr.nota ? `<small>${esc(pr.nota)}</small>` : ''}</span></label>`;
      });
      const avisos = r.avisos.map(esc);
      if (st.clase === 'tarea' && r.partes.length > 1) avisos.push(`Son ${r.partes.length} tareas en una nota. <button type="button" class="enlace" data-separar-tareas>Guardarlas por separado</button>`);
      const propone = [
        r.titulo ? `<div class="fila"><span class="mini">Título</span> «${esc(r.titulo)}»${campo('titulo').value.trim() && !st.tituloIA ? ' <span class="mini">(no pisa el tuyo)</span>' : ''}</div>` : '',
        etqs.length ? `<div class="fila"><span class="mini">Etiquetas</span>${etqs.map(e => `<button type="button" class="pill ${r.etqOn[e] ? 'sel' : ''}" data-rev-etq="${esc(e)}">${r.etqOn[e] ? '✓' : '+'} ${esc(e)}</button>`).join('')}</div>` : '',
        r.tipo && st.clase === 'idea' ? `<div class="fila"><span class="mini">Tipo</span> ${esc(TIPOS.find(t => t.v === r.tipo).l)}</div>` : '',
      ].join('');
      return `<div class="revision">
        <div class="rev-cab"><b>✨ Revisión</b><button type="button" class="cerrar" data-rev-cerrar aria-label="Descartar la revisión">✕</button></div>
        <div class="segmento dos">${[['cambios', 'Cambios'], ['resultado', 'Resultado']].map(([v, l]) => `<button type="button" data-vista="${v}" class="${r.vista === v ? 'sel' : ''}">${l}</button>`).join('')}</div>
        <div class="diff">${r.vista === 'cambios' ? htmlCambios(segs, acc) : esc(resultado(segs, acc))}</div>
        ${fmts.length > 1 ? `<div class="fmt"><span class="mini">Formato:</span>${fmts.map(f => `<button type="button" class="pill ${f === r.fmt ? 'sel' : ''}" data-fmt="${f}">${f === 'lista' ? 'Lista' : 'Texto corrido'}</button>`).join('')}</div><div class="mini">Propone lista porque la nota enumera varias cosas.</div>` : ''}
        <h4>Correcciones · ${ids.length}</h4>${filas.join('') || '<div class="mini">Nada que corregir.</div>'}
        ${avisos.length ? `<h4>A tener en cuenta</h4><ul class="avisos">${avisos.map(a => `<li>${a}</li>`).join('')}</ul>` : ''}
        ${propone ? `<h4>Propone</h4><div class="propone">${propone}</div>` : ''}
        <div class="acciones fin"><button type="button" class="btn" data-rev-cerrar>Descartar</button><button type="button" class="btn p" data-aplicar>Aplicar</button></div></div>`;
    }
    const pintarRev = () => { $('[data-rev]').innerHTML = htmlRevision(); };
    async function revisar() {
      const texto = campo('texto').value.trim();
      if (!texto) { campo('texto').focus(); return toast('Escribe o dicta algo primero'); }
      st.rev = { cargando: true }; st.revHecha = null; st.verOriginal = false;
      pintarRev();
      try {
        const j = await revisarTexto(texto, st.clase);
        if (!dlg.open || !st.rev?.cargando || campo('texto').value.trim() !== texto) return;
        st.rev = prepararRevision(texto, j, st.etiquetas);
      } catch (e) { if (!st.rev?.cargando) return; st.rev = null; toast('LLM: ' + e.message, 5000); }
      pintarRev();
    }
    function aplicarRevision() {
      const r = st.rev, { segs } = r.formatos[r.fmt], acc = r.acc[r.fmt];
      st.antes = { texto: campo('texto').value, titulo: campo('titulo').value, etiquetas: [...st.etiquetas], tipo: campo('tipo').value, tituloIA: st.tituloIA, original: st.original };
      campo('texto').value = resultado(segs, acc);
      crecer(campo('texto'));
      if (!st.original) st.original = r.original;
      if (r.titulo && (!campo('titulo').value.trim() || st.tituloIA)) { campo('titulo').value = r.titulo; st.tituloIA = true; $('[data-titulo-ia]').textContent = AVISO_IA; }
      for (const [e, on] of Object.entries(r.etqOn)) if (on && !st.etiquetas.includes(e)) st.etiquetas.push(e);
      if (r.tipo && st.clase === 'idea') campo('tipo').value = r.tipo;
      st.revHecha = { n: cambios(segs).filter(id => acc[id]).length + (r.fmt === 'lista' ? 1 : 0) };
      st.rev = null; st.verOriginal = false;
      pintarRev(); pintarFichas(); aplicarReglas();
      toast('Aplicado; falta guardar');
    }
    function deshacerRevision() {
      const a = st.antes; if (!a) return;
      campo('texto').value = a.texto; campo('titulo').value = a.titulo; campo('tipo').value = a.tipo;
      st.etiquetas = a.etiquetas; st.tituloIA = a.tituloIA; st.original = a.original;
      $('[data-titulo-ia]').textContent = st.tituloIA ? AVISO_IA : '';
      st.revHecha = st.original ? { guardada: true } : null; st.antes = null; st.verOriginal = false;
      crecer(campo('texto')); pintarRev(); pintarFichas(); aplicarReglas();
    }
    // Una tarea que junta varias cosas que hacer se guarda como varias, con la misma fecha tope.
    function separarTareas() {
      const tope = campo('tope').value;
      if (!tope) { campo('tope').focus(); return toast('Falta la fecha tope'); }
      const { partes, original } = st.rev;
      cerrar(true);
      quitarPrevia();
      for (const x of partes) guardarTarea(x.texto, x.titulo, tope, null, { etiquetas: [...st.etiquetas], original });
      toast(`Guardadas ${partes.length} tareas para ${relativo(tope)}`);
      irA('tarea');
    }

    form.onsubmit = e => {
      e.preventDefault();
      const suelta = $('#n_etq')?.value || ''; if (suelta.trim()) anadirEtiqueta(suelta, false);
      const texto = campo('texto').value.trim(), titulo = campo('titulo').value.trim();
      const extra = { etiquetas: [...st.etiquetas], original: st.original && st.original !== texto ? st.original : '' };
      if (st.clase === 'tarea') {
        const tope = campo('tope').value;
        if (!texto && !titulo) { campo('texto').focus(); return toast('Escribe o dicta la tarea'); }
        if (!tope) { campo('tope').focus(); return toast('Una tarea necesita fecha tope'); }
        cerrar(true);
        guardarTarea(texto || titulo, titulo, tope, previa, extra);
        toast(previa ? 'Tarea guardada' : `Tarea para ${relativo(tope)}${tope <= hoy ? ': sale en Hoy' : ''}`);
      } else if (st.clase === 'compra') {
        const lineas = st.lineas.filter(l => String(l.nombre || '').trim());
        if (!lineas.length) return toast('Añade al menos una línea');
        cerrar(true);
        quitarPrevia();
        const r = anadirCompras(lineas, { dictado: texto });
        toast(`${r.nuevas} ${r.nuevas === 1 ? 'línea nueva' : 'líneas nuevas'} en la compra${r.ya ? ` · ${r.ya} ya estaba${r.ya > 1 ? 'n' : ''}` : ''}`);
      } else {
        if (!texto) { campo('texto').focus(); return toast('Escribe o dicta algo'); }
        cerrar(true);
        guardarIdea(texto, { titulo, tipo: campo('tipo').value, ...extra }, previa);
        if (!previa) toast(titulo ? 'Guardada' : 'Guardada; el mayordomo le pone título');
      }
      irA(st.clase);
    };
    // Guardar por separado: cada trozo con su clase. La fecha tope es la del formulario, o la que diga su trozo.
    function partir() {
      const tarea = st.partes.find(p => p.clase === 'tarea');
      const tope = tarea ? (campo('tope').value || topeDe(tarea.texto, hoy).tope) : '';
      if (tarea && !tope) { ponerClase('tarea'); campo('tope').focus(); return toast('Falta la fecha tope de la tarea'); }
      cerrar(true);
      if (previa) quitarPrevia();
      const hechas = [];
      for (const p of st.partes) {
        if (p.clase === 'tarea') { guardarTarea(p.texto, '', p === tarea ? tope : topeDe(p.texto, hoy).tope || tope); hechas.push('una tarea'); }
        else if (p.clase === 'compra') { const r = anadirCompras(st.j && st.j.lineas?.length && st.jTexto === campo('texto').value.trim() ? lineasLLM(st.j) : lineasDe(p.texto), { dictado: p.texto }); hechas.push(`${r.nuevas} ${r.nuevas === 1 ? 'línea' : 'líneas'} de compra`); }
        else { guardarIdea(p.texto, { titulo: '', etiquetas: [], tipo: 'nota' }); hechas.push('una idea'); }
      }
      toast('Guardado: ' + hechas.join(' y '));
    }

    dlg.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.matches('[data-cancelar]')) return cerrar(null);
      if (t.matches('[data-fijar]')) { cerrar(null); import('../accesos.js').then(m => m.abrirFijar({ ops: [fijable] })); return; }
      if (t.dataset.clase) { st.manual = true; ponerClase(t.dataset.clase); $('[data-detectado]').textContent = ''; return; }
      if (t.dataset.tope) { campo('tope').value = t.dataset.tope; st.topeTocado = true; $('[data-leido]').textContent = `${fechaLarga(t.dataset.tope)} (${relativo(t.dataset.tope)})`; return; }
      if (t.dataset.quitar != null) { st.lineas.splice(Number(t.dataset.quitar), 1); st.lineasTocadas = true; return pintarLineas(); }
      if (t.matches('[data-mas]')) { st.lineas.push({ nombre: '', cantidad: '', etiqueta: 'otras' }); st.lineasTocadas = true; pintarLineas(); $('[data-lineas] .linea-compra:last-child input').focus(); return; }
      if (t.matches('[data-partir]')) return partir();
      if (t.matches('[data-no-partir]')) { st.partes = []; pintarMezcla(); return; }
      if (t.matches('[data-quitar-etq]')) { st.etiquetas = st.etiquetas.filter(x => x !== t.dataset.quitarEtq); return pintarFichas(); }
      if (t.matches('[data-sug-etq]')) return anadirEtiqueta(t.dataset.sugEtq, false);
      if (t.matches('[data-revisar]')) return revisar();
      if (t.matches('[data-rev-cerrar]')) { st.rev = null; st.revHecha = st.original ? { guardada: true } : null; return pintarRev(); }
      if (t.dataset.vista) { st.rev.vista = t.dataset.vista; return pintarRev(); }
      if (t.dataset.fmt) { st.rev.fmt = t.dataset.fmt; return pintarRev(); }
      if (t.dataset.revEtq) { st.rev.etqOn[t.dataset.revEtq] = !st.rev.etqOn[t.dataset.revEtq]; return pintarRev(); }
      if (t.matches('[data-aplicar]')) return aplicarRevision();
      if (t.matches('[data-deshacer]')) return deshacerRevision();
      if (t.matches('[data-ver-original]')) { st.verOriginal = !st.verOriginal; return pintarRev(); }
      if (t.matches('[data-volver-original]')) { campo('texto').value = st.original; st.original = ''; st.revHecha = null; crecer(campo('texto')); pintarRev(); aplicarReglas(); return toast('Vuelve el texto de antes de revisarlo'); }
      if (t.matches('[data-separar-tareas]')) return separarTareas();
      if (t.matches('[data-borrar]')) { if (await confirmar('¿Borrar la nota?')) { cerrar(true); quitarPrevia(); guardar(); } return; }
      if (t.matches('[data-retitular]')) { cerrar(true); previa.tituloManual = false; analizarNota(previa, { forzar: true }).then(c => toast(c ? 'Retitulada' : 'Sin cambios')).catch(er => toast('LLM: ' + er.message, 5000)); }
    });
    let espera = null;
    form.addEventListener('input', e => {
      const el = e.target;
      if (el.name === 'texto') {
        // Una revisión pendiente de aplicar deja de valer en cuanto cambia el texto.
        if (st.rev) { st.rev = null; st.revHecha = st.original ? { guardada: true } : null; pintarRev(); }
        clearTimeout(espera); espera = setTimeout(aplicarReglas, 300);
      }
      else if (el.id === 'n_etq') { if (el.value.includes(',')) anadirEtiqueta(el.value); }
      else if (el.name === 'titulo') { st.tituloIA = false; $('[data-titulo-ia]').textContent = ''; }
      else if (el.name === 'tope') { st.topeTocado = true; $('[data-leido]').textContent = el.value ? `${fechaLarga(el.value)} (${relativo(el.value)})` : ''; }
      else if (el.dataset.k && el.dataset.k !== 'etiqueta') { st.lineas[Number(el.dataset.l)][el.dataset.k] = el.value; st.lineasTocadas = true; }
    });
    form.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.prob) { st.rev.acc[st.rev.fmt][el.dataset.prob] = el.checked; return pintarRev(); }
      if (el.name === 'texto') { clearTimeout(espera); aplicarReglas(); consultarMayordomo(); }
      if (el.dataset.k === 'etiqueta') {
        st.lineasTocadas = true;
        const l = st.lineas[Number(el.dataset.l)];
        if (el.value !== '__nueva') { l.etiqueta = el.value; return; }
        // Una etiqueta nueva se escribe en la propia línea; al salir del campo vuelve a ser un selector.
        const inp = document.createElement('input'); inp.placeholder = 'etiqueta nueva'; inp.setAttribute('aria-label', 'Etiqueta nueva');
        el.replaceWith(inp); inp.focus();
        inp.addEventListener('change', () => { const v = limpiarEtiqueta(inp.value); if (v) l.etiqueta = v; pintarLineas(); });
      }
    });
    // Enter o coma cierran la etiqueta que se está escribiendo; al salir del campo, también.
    form.addEventListener('keydown', e => {
      if (e.target.id === 'n_etq' && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); if (e.target.value.trim()) anadirEtiqueta(e.target.value); }
    });
    form.addEventListener('focusout', e => { if (e.target.id === 'n_etq' && e.target.value.trim()) anadirEtiqueta(e.target.value, false); });
    dlg.addEventListener('cancel', e => { e.preventDefault(); if (!salirPantalla(dlg)) cerrar(null); });

    if (previa) {
      campo('texto').value = previa.texto || ''; campo('titulo').value = previa.titulo || '';
      campo('tope').value = previa.tope || '';
      campo('tipo').value = VALIDOS.includes(previa.tipo) ? previa.tipo : 'nota';
      if (previa.tope) $('[data-leido]').textContent = `${fechaLarga(previa.tope)} (${relativo(previa.tope)})`;
    }
    ponerClase(st.clase);
    if (!st.manual) $('[data-detectado]').textContent = 'Dicta y el mayordomo decide si es tarea, compra o idea; puedes cambiarlo.';
    pintarLineas(); pintarFichas(); pintarRev();
    // Dictado: solo aparece si el navegador lo trae. Al terminar, reglas al momento y mayordomo detrás.
    botonDictado(campo('texto'), $('[data-voz]'), () => { clearTimeout(espera); aplicarReglas(); consultarMayordomo(); });
    dlg.showModal();
    crecer(campo('texto'));
    campo('texto').focus();
  });
}
function fechaRapida(hoy, n) {
  const d = new Date(hoy + 'T12:00:00');
  if (n === 'v') d.setDate(d.getDate() + (((5 - d.getDay() + 7) % 7) || 7));
  else if (n === 'd') d.setDate(d.getDate() + (7 - d.getDay()) % 7);
  else d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// En la línea del diálogo no cabe el nombre entero de la etiqueta: emoji y abreviatura.
const CORTAS = { alimentacion: '🥕 Alim.', drogueria: '🧴 Drog.', farmacia: '💊 Farm.', suplementos: '💊 Supl.', otras: '🛒 Otras' };
const etiquetaCorta = e => CORTAS[e] || '🏷 ' + (e.length > 6 ? e.slice(0, 5) + '.' : e);
function lineasLLM(j) {
  return (Array.isArray(j?.lineas) ? j.lineas : []).map(l => {
    const nombre = String(l?.nombre || '').trim();
    return { nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1), cantidad: String(l?.cantidad || '').trim(), etiqueta: limpiarEtiqueta(l?.etiqueta || '') || etiquetaCompra(nombre) };
  }).filter(l => l.nombre);
}

// ---------- la sección ----------
function cuerpoTareas(params) {
  const hoy = hoyISO(), todas = tareasPendientes(), et = params.et || '';
  const pend = et ? todas.filter(n => (n.etiquetas || []).includes(et)) : todas;
  const usadas = [...new Set(todas.flatMap(n => n.etiquetas || []))].sort(), sinEtiquetas = todas.filter(n => !(n.etiquetas || []).length).length;
  const domingo = fechaRapida(hoy, 'd');
  const grupos = [
    ['Vencidas', n => n.tope && n.tope < hoy, 'mal'], ['Hoy', n => n.tope === hoy], ['Esta semana', n => n.tope > hoy && n.tope <= domingo],
    ['Más adelante', n => n.tope > domingo], ['Sin fecha tope', n => !n.tope],
  ];
  const hechas = estado.notas.filter(n => esTarea(n) && n.hecha).sort((a, b) => (b.hechaEl || '').localeCompare(a.hechaEl || '')).slice(0, 20);
  return h`<div class="acciones"><button class="btn p" data-a="nuevaTarea">+ Tarea</button><button class="btn" data-a="nueva">+ Nota</button><span class="mini">por fecha tope</span></div>
    ${usadas.length ? h`<div class="chips">${lista([h`<button class="pill ${et ? '' : 'sel'}" data-a="etqTarea" data-e="">todas</button>`, ...usadas.map(e => h`<button class="pill ${e === et ? 'sel' : ''}" data-a="etqTarea" data-e="${e}">${e}</button>`)])}</div>` : ''}
    ${sinEtiquetas && !et ? h`<div class="tarjeta fila lote"><div class="t mini">${sinEtiquetas === 1 ? '1 tarea sin etiquetas' : sinEtiquetas + ' tareas sin etiquetas'}</div><button class="btn" data-a="etiquetarTareas">✨ Etiquetarlas</button></div>` : ''}
    ${pend.length ? lista(grupos.map(([nom, f, cls]) => { const l = pend.filter(f); return l.length ? h`<h3 class="${cls || ''}">${nom} <span class="mini">${l.length}</span></h3>${lista(l.map(n => tarjetaTarea(n, { filtrar: true })))}` : ''; }))
      : aviso(et ? 'Ninguna tarea pendiente con esa etiqueta.' : 'Nada pendiente. Dicta «tengo que … antes del viernes» y aparece aquí con su fecha tope.')}
    ${hechas.length ? h`<details class="plegable"><summary>Hechas <span class="mini">${hechas.length}</span></summary><div class="cuerpo">${lista(hechas.map(tarjetaTarea))}</div></details>` : ''}`;
}
function cuerpoCompras(params) {
  const pend = estado.compra.filter(c => !c.comprado), usadas = [...new Set(pend.map(etiquetaDe))];
  const orden = [...ETIQUETAS_COMPRA.filter(e => usadas.includes(e)), ...usadas.filter(e => !ETIQUETAS_COMPRA.includes(e)).sort()];
  const etq = orden.includes(params.ec) ? params.ec : '';
  const hechos = estado.compra.filter(c => c.comprado).slice(-10).reverse();
  const origen = c => c.origen === 'alimento' ? 'bajo mínimos en Alimentación' : c.origen === 'suplemento' ? 'por reponer en Suplementos' : c.origen === 'nota' ? 'dictado' + (c.alta ? ' el ' + fechaCorta(c.alta) : '') : 'añadido en Compra';
  return h`<div class="acciones"><button class="btn p" data-a="nuevaCompra">+ Compra</button><button class="btn" data-a="nueva">+ Nota</button>${pend.length ? crudo('<button class="btn" data-a="copiar">Copiar lista</button>') : ''}</div>
    ${orden.length > 1 ? h`<div class="chips">${lista([h`<button class="pill ${etq ? '' : 'sel'}" data-a="etqCompra" data-e="">todas</button>`, ...orden.map(e => h`<button class="pill ${e === etq ? 'sel' : ''}" data-a="etqCompra" data-e="${e}">${nombreEtiqueta(e)}</button>`)])}</div>` : ''}
    ${pend.length ? lista(orden.filter(e => !etq || e === etq).map(e => { const l = pend.filter(c => etiquetaDe(c) === e); return h`<h3>${nombreEtiqueta(e)} <span class="mini">${l.length}</span></h3>${lista(l.map(c => h`<div class="tarjeta fila">
      <button class="chk" data-a="comprado" data-id="${c.id}" aria-label="Comprado"></button>
      <div class="t" data-a="editarLinea" data-id="${c.id}"><b>${c.nombre}</b>${c.cantidad ? h` <span class="mini">${c.cantidad}</span>` : ''}<div class="mini">${origen(c)}${c.tienda ? ' · ' + c.tienda : ''}</div></div>
      <button class="btn mini" data-a="buscar" data-id="${c.id}">buscar</button></div>`))}`; })) : aviso('Nada que comprar. Dicta «comprar leche, pan y pilas» y cada cosa entra como una línea.')}
    ${hechos.length ? h`<details class="plegable"><summary>Comprado <span class="mini">${hechos.length}</span></summary><div class="cuerpo">${lista(hechos.map(c => h`<div class="mini">✓ ${c.nombre} ${c.cantidad || ''}</div>`))}</div></details>` : ''}
    <p class="mini">Es la misma lista que <a href="#/compra">🧺 Compra</a>, que la agrupa por tienda y repone el stock al marcar comprado.</p>`;
}
// Las ideas que se ven con el buscador y la etiqueta puestos: son las que se ofrecen para analizar.
function ideasVisibles(params) {
  const filtro = (params.q || '').toLowerCase(), etq = params.etq || '';
  return estado.notas.filter(n => esIdea(n) && (!filtro || (n.texto + ' ' + (n.titulo || '')).toLowerCase().includes(filtro)) && (!etq || (n.etiquetas || []).includes(etq))).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
}
function cuerpoIdeas(params) {
  const filtro = (params.q || '').toLowerCase(), etq = params.etq || '';
  const ideas = estado.notas.filter(esIdea);
  const notas = ideasVisibles(params);
  const usadas = [...new Set(ideas.flatMap(n => n.etiquetas || []))];
  const sinAnalizar = ideas.filter(n => !n.analizada && !n.tituloManual);
  return h`<div class="acciones"><input type="search" placeholder="Buscar en las ideas" value="${filtro}" data-i="filtrar"><button class="btn p" data-a="nuevaIdea">+ Idea</button><button class="btn" data-a="nueva">+ Nota</button>${notas.length ? crudo('<button class="btn" data-a="analizar">🔎 Analizar</button>') : ''}</div>
    ${usadas.length ? h`<div class="chips">${lista([h`<button class="pill ${etq ? '' : 'sel'}" data-a="etq" data-e="">todas</button>`, ...usadas.map(e => h`<button class="pill ${e === etq ? 'sel' : ''}" data-a="etq" data-e="${e}">${e}</button>`)])}</div>` : ''}
    ${sinAnalizar.length > 1 ? h`<div class="tarjeta fila"><div class="t mini">${sinAnalizar.length} ideas sin título propio</div><button class="btn" data-a="lote">Titularlas</button></div>` : ''}
    ${notas.length ? lista(notas.map(n => h`<div class="tarjeta nota t-${n.tipo}" data-a="editar" data-id="${n.id}">
      <b>${n.titulo || tituloProvisional(n.texto)}</b>
      <div class="mini">${fechaCorta(n.fecha)} · ${n.tipo}${n.tipoSugerido ? ' (sugerido)' : ''}${n.original ? ' · ✨ revisada' : ''}</div>
      <div class="cuerpo">${n.texto}</div>${(n.etiquetas || []).length ? h`<div class="etqs">${lista(n.etiquetas.map(e => h`<button class="etq" data-a="etq" data-e="${e}" aria-label="Filtrar por ${e}">${e}</button>`))}</div>` : ''}</div>`)) : aviso('Sin ideas. Cualquier cosa vale: una idea, un plato que te sentó bien, un ejercicio que no repetirías.')}`;
}
// Informes con roles (ADR-010): lista y lectura. El progreso se repinta solo, porque cada paso guarda.
const ICONO_ESTADO = { espera: '⏳', trabajando: '⏳', hecho: '✓', fallido: '✗' };
const PILDORA = { generando: ['w', 'generando'], sintesis: ['w', 'sintetizando'], listo: ['ok', 'listo'], incompleto: ['w', 'con fallos'], fallido: ['mal', 'falló'] };
const pildora = inf => { const [c, t] = PILDORA[inf.estado] || ['g', inf.estado]; return h`<span class="pill ${c}">${t}</span>`; };
function cuerpoInformes(params) {
  const inf = params.id && estado.informes.find(x => x.id === params.id);
  if (!inf) return h`<div class="acciones"><button class="btn p" data-a="irIdeas">🔎 Analizar ideas</button></div>
    ${estado.informes.length ? lista(estado.informes.map(i => h`<div class="tarjeta" data-a="verInforme" data-id="${i.id}"><b>${i.titulo}</b>
      <div class="mini">${fechaHora(i.creado)} · ${i.roles.map(r => r.icono).join(' ')} ${i.roles.length} ${i.roles.length === 1 ? 'rol' : 'roles'} · ${i.fuentes.length} ${i.fuentes.length === 1 ? 'idea' : 'ideas'}${i.coste != null ? ' · ' + dolares(i.coste) : ''} ${pildora(i)}</div></div>`))
      : aviso('Aún no hay informes. En Ideas, «🔎 Analizar» junta las que elijas y varios roles (crítico, económico, técnico…) las analizan; una síntesis cruza lo que dicen.')}`;
  const enMarcha = ['generando', 'sintesis'].includes(inf.estado), fallidos = inf.roles.filter(r => r.estado === 'fallido');
  const salidas = h`<div class="acciones"><button class="btn" data-a="copiarInf" data-id="${inf.id}">📋 Copiar</button><button class="btn" data-a="descargarInf" data-id="${inf.id}">⬇ .md</button><button class="btn" data-a="imprimirInf" data-id="${inf.id}">🖨 PDF</button>${navigator.share ? crudo(`<button class="btn" data-a="compartirInf" data-id="${esc(inf.id)}">Compartir</button>`) : ''}</div>`;
  return h`<div class="acciones"><button class="btn" data-a="pestana" data-v="informes">← Informes</button></div>
    <h2 class="titulo-informe">${inf.titulo}</h2>
    <div class="mini">🔎 Informe · 🧠 ${nombreModelo(inf.modelo)}${inf.coste != null ? ' · ' + dolares(inf.coste) : ''} · ${fechaHora(inf.creado)} ${pildora(inf)}${inf.editado ? ' · editado a mano' : ''}</div>
    <div class="chips">${lista(inf.roles.map(r => h`<span class="pill ${r.estado === 'fallido' ? 'mal' : 'g'}" title="${r.enfoque}">${r.icono} ${r.nombre}</span>`))}</div>
    ${enMarcha ? h`<div class="tarjeta progreso"><b>Generando…</b><ul>${lista(inf.roles.map(r => h`<li class="${r.estado}">${ICONO_ESTADO[r.estado]} ${r.icono} ${r.nombre}${r.estado === 'fallido' ? ' — ' + r.error : ''}</li>`))}
      <li class="${inf.estado === 'sintesis' ? 'trabajando' : 'espera'}">⏳ Síntesis</li></ul>
      <div class="barra"><i style="width:${Math.round(100 * inf.roles.filter(r => ['hecho', 'fallido'].includes(r.estado)).length / (inf.roles.length + 1))}%"></i></div>
      <div class="mini">Sigue aunque cambies de sección; si cierras la app a medias, lo pendiente se puede reintentar.</div></div>` : ''}
    ${!enMarcha && (fallidos.length || inf.error) ? h`<div class="tarjeta aviso-informe">⚠️ ${fallidos.length ? `${fallidos.map(r => r.nombre).join(', ')} no respondi${fallidos.length === 1 ? 'ó' : 'eron'} (${fallidos[0].error}).` : inf.error}
      <div class="acciones"><button class="btn p" data-a="reintentarInf" data-id="${inf.id}">Reintentar ${fallidos.length === 1 ? fallidos[0].nombre : fallidos.length ? 'los que fallaron' : 'la síntesis'}</button></div></div>` : ''}
    ${!enMarcha && inf.texto ? h`${salidas}<div class="tarjeta md md-informe">${crudo(markdown(inf.texto))}</div>${salidas}` : ''}
    ${enMarcha ? '' : h`<div class="acciones"><button class="btn" data-a="editarInf" data-id="${inf.id}">✏️ Editar</button><button class="btn" data-a="regenerarInf" data-id="${inf.id}">↻ Regenerar</button><button class="btn peligro" data-a="borrarInf" data-id="${inf.id}">Borrar</button></div>`}`;
}
function render(cont, params) {
  const v = PESTANAS.some(p => p.v === params.v) ? params.v : 'tareas';
  const pend = tareasPendientes(), vencidas = pend.filter(n => n.tope && n.tope < hoyISO()).length;
  const cuenta = { tareas: pend.length, compras: estado.compra.filter(c => !c.comprado).length, ideas: estado.notas.filter(esIdea).length, informes: estado.informes.length };
  cont.innerHTML = h`<div class="pestanas">${lista(PESTANAS.map(p => h`<button class="${p.v === v ? 'sel' : ''}" data-a="pestana" data-v="${p.v}">${p.l}${cuenta[p.v] ? crudo(`<i class="n ${p.v === 'tareas' && vencidas ? 'mal' : ''}">${cuenta[p.v]}</i>`) : ''}</button>`))}</div>
    ${v === 'tareas' ? cuerpoTareas(params) : v === 'compras' ? cuerpoCompras(params) : v === 'informes' ? cuerpoInformes(params) : cuerpoIdeas(params)}`;
  const repintar = () => render(cont, params);
  delegar(cont, {
    pestana: el => navegar('notas', { v: el.dataset.v }),
    analizar: async () => { const v = await abrirAnalisis({ ideas: ideasVisibles(params) }); if (v) navegar('notas', { v: 'informes', id: crearInforme(v) }); },
    irIdeas: () => navegar('notas', { v: 'ideas' }),
    verInforme: el => navegar('notas', { v: 'informes', id: el.dataset.id }),
    copiarInf: el => copiarInforme(informe(el)),
    descargarInf: el => descargarInforme(informe(el)),
    compartirInf: el => compartirInforme(informe(el)),
    imprimirInf: () => window.print(),
    reintentarInf: el => reintentar(informe(el)),
    regenerarInf: async el => {
      const inf = informe(el); if (generando(inf)) return;
      if (inf.editado && !(await confirmar('Lo editado a mano se pierde al regenerar. ¿Seguir?', 'Seguir'))) return;
      const v = await abrirAnalisis({ previo: inf }); if (v) regenerar(inf, v);
    },
    editarInf: async el => {
      const inf = informe(el);
      const v = await pedir('Editar el informe', [{ n: 'texto', l: 'Markdown', t: 'textarea', filas: 16 }], { texto: inf.texto });
      if (v && v.texto !== inf.texto) { inf.texto = v.texto; inf.editado = true; guardar(); toast('Informe guardado'); }
    },
    borrarInf: async el => {
      const inf = informe(el); if (generando(inf)) return toast('Espera a que termine');
      if (await confirmar(`¿Borrar el informe «${inf.titulo}»? Las ideas no se tocan.`, 'Borrar')) { estado.informes = estado.informes.filter(x => x !== inf); guardar(); navegar('notas', { v: 'informes' }); }
    },
    nueva: () => abrirNota(),
    nuevaTarea: () => abrirNota({ clase: 'tarea' }),
    nuevaCompra: () => abrirNota({ clase: 'compra' }),
    nuevaIdea: () => abrirNota({ clase: 'idea' }),
    tareaHecha: (el, e) => { e.stopPropagation(); marcarTarea(el.dataset.id); },
    verTarea: el => { const n = estado.notas.find(x => x.id === el.dataset.id); if (n) abrirNota({ previa: n }); },
    comprado: async el => { const c = estado.compra.find(x => x.id === el.dataset.id); if (c && await marcarComprado(c)) toast('Comprado'); },
    editarLinea: el => { const c = estado.compra.find(x => x.id === el.dataset.id); if (c) editarLinea(c); },
    buscar: el => { const c = estado.compra.find(x => x.id === el.dataset.id); if (c) navegar('buscador', { q: c.nombre, cat: categoriaBusqueda(c) }); },
    filtrar: el => { params.q = el.value; repintar(); },
    etqCompra: el => { params.ec = el.dataset.e; repintar(); },
    copiar: () => {
      const pend = estado.compra.filter(c => !c.comprado), grupos = [...new Set(pend.map(etiquetaDe))];
      const txt = grupos.map(e => `${nombreEtiqueta(e)}\n` + pend.filter(c => etiquetaDe(c) === e).map(c => `- ${c.nombre}${c.cantidad ? ' (' + c.cantidad + ')' : ''}`).join('\n')).join('\n\n');
      navigator.clipboard?.writeText(txt).then(() => toast('Lista copiada')).catch(() => toast('No se pudo copiar'));
    },
    etq: el => { params.etq = el.dataset.e; repintar(); },
    etqTarea: el => { params.et = el.dataset.e && el.dataset.e !== params.et ? el.dataset.e : ''; repintar(); },
    // Las tareas de antes no tenían etiquetas: se piden sin tocar su título (una consulta por tarea).
    etiquetarTareas: async el => {
      const sin = tareasPendientes().filter(n => !(n.etiquetas || []).length);
      el.disabled = true; el.textContent = 'Etiquetando…';
      let n = 0;
      for (const nota of sin.slice(0, 20)) { try { if (await analizarNota(nota, { soloEtiquetas: true })) n++; } catch (e) { toast('LLM: ' + e.message, 5000); break; } }
      toast(n ? (n === 1 ? '1 tarea etiquetada' : n + ' tareas etiquetadas') : 'Ninguna cambió'); repintar();
    },
    editar: el => { const n = estado.notas.find(x => x.id === el.dataset.id); if (n) abrirNota({ previa: n }); },
    lote: async el => {
      const sinAnalizar = estado.notas.filter(n => esIdea(n) && !n.analizada && !n.tituloManual);
      el.disabled = true; el.textContent = 'Titulando…';
      let n = 0;
      for (const nota of sinAnalizar.slice(0, 20)) { try { if (await analizarNota(nota)) n++; } catch (e) { toast('LLM: ' + e.message, 5000); break; } }
      toast(n ? n + ' ideas tituladas' : 'Ninguna cambió'); repintar();
    },
  });
}
const informe = el => estado.informes.find(x => x.id === el.dataset.id);
export default { id: 'notas', titulo: 'Notas', grupo: 'Agenda', icono: '✎', render };
