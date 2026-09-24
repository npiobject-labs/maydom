// Notas en tres pestañas —Tareas, Compras e Ideas— con un solo diálogo para dictar (mock 5).
// La clase la decide el mayordomo (operación `nota`, la misma llamada que pone el título) y, sin
// LLM o mientras llega, las reglas de interpretar-nota.js; lo que se elige a mano manda.
// Las compras no se guardan como notas: son líneas de la lista de Compra, que es una sola.
import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, diasEntre, fechaCorta, fechaLarga, confirmar, toast, aviso, esc, navegar, rutaActual, tomarOrigen } from '../nucleo.js';
import { pedirJSON } from '../llm.js';
import { botonDictado } from '../voz.js';
import { CLASES, claseDe, topeDe, lineasDe, tituloTarea, partesDe, etiquetaCompra, sinAcentos, ETIQUETAS_COMPRA } from '../interpretar-nota.js';
import { anadirCompras, etiquetaDe, nombreEtiqueta, etiquetasCompra, editarLinea, marcarComprado, categoriaBusqueda } from './compra.js';

const ETIQUETAS = ['ejercicio', 'sueno', 'meditacion', 'alimentacion', 'suplementos', 'proyecto', 'ocio', 'finanzas', 'calendario', 'mayordomo', 'idea'];
const TIPOS = [{ v: 'nota', l: 'Nota' }, { v: 'preferencia', l: 'Preferencia (guía al mayordomo)' }, { v: 'tendencia', l: 'Tendencia (algo que noto)' }];
const VALIDOS = TIPOS.map(t => t.v);
const NOMBRE_CLASE = { tarea: '☑ Tarea', compra: '🛒 Compra', idea: '💡 Idea' };
const PESTANAS = [{ v: 'tareas', l: 'Tareas', clase: 'tarea' }, { v: 'compras', l: 'Compras', clase: 'compra' }, { v: 'ideas', l: 'Ideas', clase: 'idea' }];
const PESTANA_DE = { tarea: 'tareas', compra: 'compras', idea: 'ideas' };

export const esIdea = n => (n.clase || 'idea') === 'idea';
export const esTarea = n => n.clase === 'tarea';
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
export function tarjetaTarea(n) {
  const d = n.tope ? diasEntre(hoyISO(), n.tope) : null, vencida = !n.hecha && d != null && d < 0;
  return h`<div class="tarjeta fila tarea ${n.hecha ? 'hecha' : ''} ${vencida ? 'vencida' : ''}">
    <button class="chk" data-a="tareaHecha" data-id="${n.id}" aria-label="${n.hecha ? 'Marcar pendiente' : 'Marcar hecha'}">${n.hecha ? '✓' : ''}</button>
    <div class="t" data-a="verTarea" data-id="${n.id}"><b>${n.titulo || tituloProvisional(n.texto)}</b>
      <div class="mini">${n.hecha ? 'hecha el ' + fechaCorta(n.hechaEl || n.tope) : n.tope ? 'tope ' + fechaLarga(n.tope) : 'sin fecha tope'}</div></div>
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
- etiquetas y tipo, solo en una idea: de 1 a 3 etiquetas, preferentemente de esta lista: ${ETIQUETAS.join(', ')} (si ninguna encaja, una en minúsculas y sin acentos); tipo "preferencia" si expresa lo que quiere o busca en los próximos días, "tendencia" si describe algo que nota que le pasa, "nota" en otro caso.
- partes: solo si la nota junta cosas de clases distintas (una tarea y una compra, por ejemplo), [{"clase":"","texto":"el trozo de la nota, tal cual"}]; si no, [].`;
}
export const analizar = texto => pedirJSON({ operacion: 'nota', contexto: false, tarea: tareaAnalisis(), mensaje: String(texto || '').slice(0, 4000) });
const limpiarTitulo = t => String(t).replace(/^["'«\s]+|["'»\s.]+$/g, '').slice(0, 90);
const esISO = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const limpiarEtiqueta = e => sinAcentos(e).toLowerCase().trim().replace(/[^a-z0-9ñ ]/g, '').replace(/\s+/g, ' ');
// Rellena SOLO lo que el usuario dejó vacío. Nunca pisa lo escrito a mano.
function aplicarAnalisis(nota, j, { forzar = false } = {}) {
  if (!j || !estado.notas.includes(nota)) return false;
  let cambio = false;
  if ((forzar || !nota.tituloManual) && j.titulo) { nota.titulo = limpiarTitulo(j.titulo); cambio = true; }
  if (esIdea(nota)) {
    if ((forzar || !(nota.etiquetas || []).length) && Array.isArray(j.etiquetas) && j.etiquetas.length) {
      nota.etiquetas = j.etiquetas.map(limpiarEtiqueta).filter(Boolean).slice(0, 3); cambio = true;
    }
    // El tipo solo se sugiere; el usuario lo ve marcado y puede cambiarlo.
    if (!nota.tipoManual && VALIDOS.includes(j.tipo) && j.tipo !== nota.tipo) { nota.tipo = j.tipo; nota.tipoSugerido = true; cambio = true; }
  }
  if (cambio) { nota.analizada = true; guardar(); }
  return cambio;
}
export async function analizarNota(nota, opciones = {}) {
  const faltaTitulo = opciones.forzar || !nota.tituloManual;
  const faltanEtiquetas = esIdea(nota) && (opciones.forzar || !(nota.etiquetas || []).length);
  if (!faltaTitulo && !faltanEtiquetas) return false;
  return aplicarAnalisis(nota, await analizar(nota.texto), opciones);
}

// ---------- guardar ----------
// Guarda ya y analiza después: una nota nunca se pierde por un fallo de red.
function guardarNota(datos, previa = null) {
  const nota = previa || { id: uid(), fecha: hoyISO() };
  const tituloAntes = previa?.titulo;
  Object.assign(nota, datos);
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
    const st = { clase: previa?.clase || clase || 'idea', manual: !!(previa || clase), topeTocado: !!previa, lineasTocadas: false, lineas: [], partes: [], j: null, jTexto: '', pendiente: null, pTexto: '' };
    const dlg = document.createElement('dialog');
    dlg.className = 'modal dialogo-nota';
    dlg.innerHTML = `<form class="form" autocomplete="off" novalidate>
      <div class="cabecera-modal"><h2 data-titulo></h2>
        ${fijable ? '<button type="button" class="fijar" data-fijar aria-label="Fijar en inicio" title="Fijar en inicio">☆</button>' : ''}
        <button type="button" class="cerrar" data-cancelar aria-label="Cerrar sin guardar" title="Cerrar sin guardar">✕</button></div>
      <label for="n_texto">Dicta o escribe</label>
      <textarea id="n_texto" name="texto" rows="3" placeholder="«Llamar al fontanero el jueves» · «Comprar leche, huevos y pilas» · una idea"></textarea>
      <div data-voz></div>
      <label>Es una</label>
      <div class="segmento" role="radiogroup">${CLASES.map(c => `<button type="button" role="radio" data-clase="${c}">${NOMBRE_CLASE[c]}</button>`).join('')}</div>
      <div class="mini detectado" data-detectado></div>
      <div class="aviso-mezcla" data-mezcla hidden></div>
      <div data-para="tarea idea"><label for="n_titulo">Título</label><input id="n_titulo" name="titulo" placeholder="vacío = lo pone el mayordomo"></div>
      <div data-para="tarea"><label for="n_tope">Fecha tope</label><input id="n_tope" name="tope" type="date">
        <div class="rapidas">${[['Hoy', 0], ['Mañana', 1], ['Viernes', 'v'], ['Domingo', 'd'], ['En 15 días', 15]].map(([l, n]) => `<button type="button" class="pill" data-tope="${esc(fechaRapida(hoy, n))}">${l}</button>`).join('')}</div>
        <small class="mini" data-leido></small></div>
      <div data-para="compra"><label>Qué hay que comprar <span class="mini">(una línea por cosa)</span></label><div data-lineas></div>
        <div class="acciones"><button type="button" class="btn mini" data-mas>+ línea</button><span class="mini">Van a la lista de 🧺 Compra</span></div></div>
      <div data-para="idea"><label for="n_etq">Etiquetas (coma)</label><input id="n_etq" name="etiquetas" placeholder="vacío = las pone el mayordomo"><small class="mini">${esc(ETIQUETAS.join(' · '))}</small>
        <label for="n_tipo">Tipo</label><select id="n_tipo" name="tipo">${TIPOS.map(t => `<option value="${t.v}">${esc(t.l)}</option>`).join('')}</select></div>
      <div class="acciones fin">
        ${previa ? '<button type="button" class="btn peligro" data-borrar>Borrar</button><button type="button" class="btn" data-retitular>Retitular</button>' : ''}
        <button type="button" class="btn" data-cancelar>Cancelar</button><button type="submit" class="btn p">Guardar</button></div></form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form'), $ = s => dlg.querySelector(s);
    const campo = n => form.elements[n];
    const cerrar = v => { dlg.close(); dlg.remove(); resolve(v); };
    const crecer = t => { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, innerHeight * 0.4) + 'px'; };

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
    function analizarDespues(nota) {
      if (previa && nota.texto === textoAntes && nota.analizada && nota.tituloManual === manualAntes) return;
      if (nota.tituloManual && !(esIdea(nota) && !(nota.etiquetas || []).length)) return;
      const p = st.pendiente && st.pTexto === nota.texto ? st.pendiente : analizar(nota.texto);
      p.then(j => aplicarAnalisis(nota, j)).catch(e => console.warn('nota sin analizar:', e.message));
    }
    const irA = c => { if (rutaActual().id === 'notas' && rutaActual().params.v !== PESTANA_DE[c]) navegar('notas', { v: PESTANA_DE[c] }); };
    function guardarTarea(texto, titulo, tope, sobre = null) {
      const n = guardarNota({ clase: 'tarea', texto, titulo, tope, etiquetas: sobre?.etiquetas || [] }, sobre);
      analizarDespues(n); return n;
    }
    function guardarIdea(texto, datos, sobre = null) {
      if (sobre && datos.tipo !== sobre.tipo) datos.tipoManual = true;
      const n = guardarNota({ clase: 'idea', texto, hecha: false, ...datos }, sobre);
      analizarDespues(n); return n;
    }
    const quitarPrevia = () => { if (previa) estado.notas = estado.notas.filter(x => x.id !== previa.id); };
    const etiquetasEscritas = () => campo('etiquetas').value.split(',').map(limpiarEtiqueta).filter(Boolean);

    form.onsubmit = e => {
      e.preventDefault();
      const texto = campo('texto').value.trim(), titulo = campo('titulo').value.trim();
      if (st.clase === 'tarea') {
        const tope = campo('tope').value;
        if (!texto && !titulo) { campo('texto').focus(); return toast('Escribe o dicta la tarea'); }
        if (!tope) { campo('tope').focus(); return toast('Una tarea necesita fecha tope'); }
        cerrar(true);
        guardarTarea(texto || titulo, titulo, tope, previa);
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
        guardarIdea(texto, { titulo, etiquetas: etiquetasEscritas(), tipo: campo('tipo').value }, previa);
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
      if (t.matches('[data-borrar]')) { if (await confirmar('¿Borrar la nota?')) { cerrar(true); quitarPrevia(); guardar(); } return; }
      if (t.matches('[data-retitular]')) { cerrar(true); previa.tituloManual = false; analizarNota(previa, { forzar: true }).then(c => toast(c ? 'Retitulada' : 'Sin cambios')).catch(er => toast('LLM: ' + er.message, 5000)); }
    });
    let espera = null;
    form.addEventListener('input', e => {
      const el = e.target;
      if (el.name === 'texto') { crecer(el); clearTimeout(espera); espera = setTimeout(aplicarReglas, 300); }
      else if (el.name === 'tope') { st.topeTocado = true; $('[data-leido]').textContent = el.value ? `${fechaLarga(el.value)} (${relativo(el.value)})` : ''; }
      else if (el.dataset.k && el.dataset.k !== 'etiqueta') { st.lineas[Number(el.dataset.l)][el.dataset.k] = el.value; st.lineasTocadas = true; }
    });
    form.addEventListener('change', e => {
      const el = e.target;
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
    dlg.addEventListener('cancel', e => { e.preventDefault(); cerrar(null); });

    if (previa) {
      campo('texto').value = previa.texto || ''; campo('titulo').value = previa.titulo || '';
      campo('tope').value = previa.tope || ''; campo('etiquetas').value = (previa.etiquetas || []).join(', ');
      campo('tipo').value = VALIDOS.includes(previa.tipo) ? previa.tipo : 'nota';
      if (previa.tope) $('[data-leido]').textContent = `${fechaLarga(previa.tope)} (${relativo(previa.tope)})`;
    }
    ponerClase(st.clase);
    if (!st.manual) $('[data-detectado]').textContent = 'Dicta y el mayordomo decide si es tarea, compra o idea; puedes cambiarlo.';
    pintarLineas();
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
function cuerpoTareas() {
  const hoy = hoyISO(), pend = tareasPendientes();
  const domingo = fechaRapida(hoy, 'd');
  const grupos = [
    ['Vencidas', n => n.tope && n.tope < hoy, 'mal'], ['Hoy', n => n.tope === hoy], ['Esta semana', n => n.tope > hoy && n.tope <= domingo],
    ['Más adelante', n => n.tope > domingo], ['Sin fecha tope', n => !n.tope],
  ];
  const hechas = estado.notas.filter(n => esTarea(n) && n.hecha).sort((a, b) => (b.hechaEl || '').localeCompare(a.hechaEl || '')).slice(0, 20);
  return h`<div class="acciones"><button class="btn p" data-a="nuevaTarea">+ Tarea</button><button class="btn" data-a="nueva">+ Nota</button><span class="mini">por fecha tope</span></div>
    ${pend.length ? lista(grupos.map(([nom, f, cls]) => { const l = pend.filter(f); return l.length ? h`<h3 class="${cls || ''}">${nom} <span class="mini">${l.length}</span></h3>${lista(l.map(tarjetaTarea))}` : ''; })) : aviso('Nada pendiente. Dicta «tengo que … antes del viernes» y aparece aquí con su fecha tope.')}
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
function cuerpoIdeas(params) {
  const filtro = (params.q || '').toLowerCase(), etq = params.etq || '';
  const ideas = estado.notas.filter(esIdea);
  const notas = ideas.filter(n => (!filtro || (n.texto + ' ' + (n.titulo || '')).toLowerCase().includes(filtro)) && (!etq || (n.etiquetas || []).includes(etq))).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  const usadas = [...new Set(ideas.flatMap(n => n.etiquetas || []))];
  const sinAnalizar = ideas.filter(n => !n.analizada && !n.tituloManual);
  return h`<div class="acciones"><input type="search" placeholder="Buscar en las ideas" value="${filtro}" data-i="filtrar"><button class="btn p" data-a="nuevaIdea">+ Idea</button><button class="btn" data-a="nueva">+ Nota</button></div>
    ${usadas.length ? h`<div class="chips">${lista([h`<button class="pill ${etq ? '' : 'sel'}" data-a="etq" data-e="">todas</button>`, ...usadas.map(e => h`<button class="pill ${e === etq ? 'sel' : ''}" data-a="etq" data-e="${e}">${e}</button>`)])}</div>` : ''}
    ${sinAnalizar.length > 1 ? h`<div class="tarjeta fila"><div class="t mini">${sinAnalizar.length} ideas sin título propio</div><button class="btn" data-a="lote">Titularlas</button></div>` : ''}
    ${notas.length ? lista(notas.map(n => h`<div class="tarjeta nota t-${n.tipo}" data-a="editar" data-id="${n.id}">
      <b>${n.titulo || tituloProvisional(n.texto)}</b>
      <div class="mini">${fechaCorta(n.fecha)} · ${n.tipo}${n.tipoSugerido ? ' (sugerido)' : ''}${(n.etiquetas || []).length ? ' · ' + n.etiquetas.join(', ') : ''}</div>
      <div class="cuerpo">${n.texto}</div></div>`)) : aviso('Sin ideas. Cualquier cosa vale: una idea, un plato que te sentó bien, un ejercicio que no repetirías.')}`;
}
function render(cont, params) {
  const v = PESTANAS.some(p => p.v === params.v) ? params.v : 'tareas';
  const pend = tareasPendientes(), vencidas = pend.filter(n => n.tope && n.tope < hoyISO()).length;
  const cuenta = { tareas: pend.length, compras: estado.compra.filter(c => !c.comprado).length, ideas: estado.notas.filter(esIdea).length };
  cont.innerHTML = h`<div class="pestanas">${lista(PESTANAS.map(p => h`<button class="${p.v === v ? 'sel' : ''}" data-a="pestana" data-v="${p.v}">${p.l}${cuenta[p.v] ? crudo(`<i class="n ${p.v === 'tareas' && vencidas ? 'mal' : ''}">${cuenta[p.v]}</i>`) : ''}</button>`))}</div>
    ${v === 'tareas' ? cuerpoTareas() : v === 'compras' ? cuerpoCompras(params) : cuerpoIdeas(params)}`;
  const repintar = () => render(cont, params);
  delegar(cont, {
    pestana: el => navegar('notas', { v: el.dataset.v }),
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
export default { id: 'notas', titulo: 'Notas', grupo: 'Agenda', icono: '✎', render };
