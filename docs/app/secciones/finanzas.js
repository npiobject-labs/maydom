import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, mesISO, fechaCorta, euros, pedir, confirmar, toast, aviso, navegar } from '../nucleo.js';
import { CONCEPTOS, CONCEPTOS_NEUTROS } from '../datos/semillas.js';
import { consultar, conLLM, pedirJSON, textoAConsejos, lista as listaJSON } from '../llm.js';
import { leerExtracto, num, fechaNorm } from '../extracto.js';

const campos = [
  { n: 'fecha', l: 'Fecha', t: 'date', req: true }, { n: 'descripcion', l: 'Descripción', req: true },
  { n: 'importe', l: 'Importe (negativo = gasto)', t: 'number', step: 0.01, req: true }, { n: 'concepto', l: 'Concepto', t: 'select', o: CONCEPTOS },
];
const camposRec = [{ n: 'descripcion', l: 'Servicio', req: true }, { n: 'importe', l: 'Importe mensual (negativo = gasto)', t: 'number', step: 0.01, req: true }, { n: 'concepto', l: 'Concepto', t: 'select', o: CONCEPTOS, v: 'servicios web' }, { n: 'dia', l: 'Día del mes', t: 'number', v: 1, min: 1, max: 28 }];
export function balanceMes(mes) { const ms = estado.movimientos.filter(m => mesISO(m.fecha) === mes); const ing = ms.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0), gas = ms.filter(m => m.importe < 0).reduce((s, m) => s - m.importe, 0); const por = {}; for (const m of ms) if (m.importe < 0) por[m.concepto] = (por[m.concepto] || 0) - m.importe; return { ing, gas, neto: ing - gas, por, n: ms.length }; }
// Resumen del año: una fila por mes con ingresos, gastos y neto, más totales y conceptos del año.
export function balanceAnio(anio) {
  const ms = estado.movimientos.filter(m => String(m.fecha).startsWith(anio + '-'));
  const meses = new Map();
  const por = {};
  for (const m of ms) {
    const k = mesISO(m.fecha);
    if (!meses.has(k)) meses.set(k, { mes: k, ing: 0, gas: 0, n: 0 });
    const f = meses.get(k);
    if (m.importe > 0) f.ing += m.importe; else { f.gas -= m.importe; por[m.concepto] = (por[m.concepto] || 0) - m.importe; }
    f.n++;
  }
  const filas = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)).map(f => ({ ...f, neto: f.ing - f.gas }));
  const ing = filas.reduce((s, f) => s + f.ing, 0), gas = filas.reduce((s, f) => s + f.gas, 0);
  // Traspasos entre cuentas y retiradas de cajero no son gasto: se enseñan aparte para que el
  // informe no diga que se gastó un dinero que solo cambió de sitio.
  const neutro = CONCEPTOS_NEUTROS.reduce((t, c) => t + (por[c] || 0), 0);
  return { filas, ing, gas, neto: ing - gas, n: ms.length, por, neutro, gasReal: gas - neutro, mesesConDatos: filas.length };
}
// Adivina el concepto por la descripción del extracto. Las reglas salen de extractos reales: el
// orden importa, porque «adeudo comunidad» tiene que ganar a «comunidad» y un traspaso entre
// cuentas propias no es un gasto aunque el importe sea negativo. Solo patrones genéricos de
// comercios y conceptos bancarios: nunca nombres de personas.
const REGLAS = [
  [/bizum|traspaso|transferencia (realizada|enviada|recibida)|trans\. (a|de) favor/, 'transferencias'],
  [/ret\. ?efectivo|reintegro|cajero|disposicion efectivo|retirada de efectivo/, 'efectivo'],
  [/ayuntamiento|impuesto|tributo|hacienda|agencia tributaria|\bibi\b|\biae\b|tasa municipal|recaudacion|seguridad social/, 'impuestos'],
  [/iberdrola|endesa|naturgy|curenergia|repsol luz|holaluz|totalenergies|canal isabel|aqualia|hidraulica|comunidad propietarios|alquiler|hipoteca|\bgas natural\b/, 'suministros'],
  [/telefonica|movistar|vodafone|orange|jazztel|yoigo|masmovil|pepephone|digi movil|\bo2\b|simyo|finetwork/, 'telefonía'],
  [/mutua|seguros?\b|mapfre|axa|allianz|generali|linea directa|zurich|caser|sanitas|adeslas|asisa/, 'seguros'],
  [/farmacia|fcia|parafarmacia|clinica|dentista|dental|optica|podolog|fisio|hospital|analisis clinicos|medic/, 'salud'],
  [/iherb|hsn|suplement|herbolario|myprotein|naturitas|prozis/, 'suplementos'],
  [/mercadona|carrefour|\bdia\b|lidl|aldi|alcampo|eroski|consum|ahorramas|alimerka|primaprix|gadis|froiz|bonarea|leclerc|lupa|super|hipermercado|mercado|fruteria|carniceria|pescaderia|panaderia|obrador|charcuteria|pasteleria/, 'alimentación'],
  [/restaurante|cafeteria|\bcafe\b|\bbar\b|taberna|cerveceria|pizzeria|hamburgues|churreria|asador|tapas|sushi|kebab|glovo|just ?eat|uber ?eats/, 'restauración'],
  [/metro |renfe|\bemt\b|alsa|avanza|taxi|uber|cabify|bolt|gasolinera|repsol|cepsa|\bgalp\b|\bbp\b|shell|parking|aparcamiento|peaje|\bitv\b|autopista|blablacar|iberia|ryanair|vueling|aena/, 'transporte'],
  [/openrouter|openai|anthropic|claude|\bgpt\b|midjourney|\bllm\b/, 'IA / LLM'],
  [/fly\.io|hetzner|ovh|vercel|\baws\b|digitalocean|github|hosting|dominio|namecheap|cloudflare|godaddy/, 'hosting'],
  [/netflix|spotify|disney|hbo|\bmax\b|prime video|filmin|movistar\+|google|apple|icloud|dropbox|notion|microsoft|adobe|canva|suscrip/, 'servicios web'],
  [/corte ingles|amazon|aliexpress|decathlon|ikea|leroy|bricomart|mediamarkt|worten|\bfnac\b|action |bazar|ferreteria|papeleria/, 'compras'],
  [/zara|primark|\bh&m\b|mango|bershka|pull&bear|stradivarius|springfield|calzado|zapateria|\bmoda\b|textil/, 'ropa'],
  [/cine|teatro|concierto|entrada|museo|espectaculo|gimnasio|\bpadel\b|eventos?\b|festival|libreria|casa del libro/, 'ocio'],
  [/nomina|pension|paga|subsidio|prestacion|devolucion|abono|finiquito|dividendo|intereses/, 'ingresos'],
];
const sinTildes = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function adivinar(desc, importe = -1) {
  const d = sinTildes(desc);
  for (const [re, c] of REGLAS) if (re.test(d)) {
    // En un abono, el patrón del comercio solo vale si mueve dinero (traspaso, cajero): lo demás
    // que entra es un ingreso, no un gasto de esa categoría. Una devolución de Hacienda no es
    // «impuestos» en la columna de ingresos.
    if (importe > 0 && !CONCEPTOS_NEUTROS.includes(c) && c !== 'ingresos') return 'ingresos';
    return c;
  }
  // Un ingreso sin patrón conocido es un ingreso; un cargo sin patrón, «otros».
  return importe > 0 ? 'ingresos' : 'otros';
}
// Clave de cotejo de un movimiento. La descripción se normaliza (minúsculas, sin tildes, espacios
// colapsados) porque dos exportaciones del mismo banco imprimen el mismo apunte con espaciados
// distintos y, sin normalizar, el duplicado se cuela como movimiento nuevo.
const claveMov = m => `${m.fecha}|${m.importe}|${sinTildes(m.descripcion).replace(/\s+/g, ' ').trim()}`;

// Importa candidatos {fecha, descripcion, importe} cotejándolos con lo ya guardado y preguntando
// qué hacer con los que ya existen. Dos apuntes idénticos el mismo día son legítimos (dos cafés
// iguales), así que el cotejo va por multiplicidad: cada fila del fichero consume un existente de
// su misma clave y solo la que se queda sin pareja es nueva. Antes se saltaban en silencio, lo que
// además perdía el segundo de dos apuntes gemelos.
// Devuelve {n, rep, omit} o null si se cancela: cancelar no escribe nada.
async function importarMovimientos(cands, origen = '') {
  const libres = new Map();
  for (const m of estado.movimientos) {
    const k = claveMov(m);
    if (!libres.has(k)) libres.set(k, []);
    libres.get(k).push(m);
  }
  const nuevos = [], pares = [];
  for (const c of cands) {
    const cola = libres.get(claveMov(c));
    if (cola && cola.length) pares.push({ c, mov: cola.shift() }); else nuevos.push(c);
  }
  let modo = 'saltar';
  if (pares.length) {
    const uno = pares.length === 1;
    const v = await pedir(uno ? 'Un movimiento que ya existe' : 'Movimientos que ya existen', [{
      n: 'modo', l: uno ? 'Qué hago con el que ya está' : `Qué hago con los ${pares.length} que ya están`, t: 'select', v: 'saltar',
      o: [{ v: 'saltar', l: uno ? 'Saltar: dejarlo como está' : `Saltar: dejar los ${pares.length} como están` }, { v: 'reemplazar', l: uno ? 'Reemplazar: rehacerlo con lo del fichero' : 'Reemplazar: rehacerlos con lo del fichero' }],
      ayuda: 'Reemplazar rehace descripción, importe y concepto desde el fichero; el concepto que hayas puesto a mano no se toca. Saltar deja intacto lo guardado.',
    }], {}, {
      texto: `${origen ? origen + ': ' : ''}${cands.length} ${cands.length === 1 ? 'movimiento' : 'movimientos'} en el fichero. ${nuevos.length} ${nuevos.length === 1 ? 'es nuevo' : 'son nuevos'} y se ${nuevos.length === 1 ? 'añade' : 'añaden'} igualmente; ${pares.length} ya ${pares.length === 1 ? 'está guardado' : 'están guardados'} (misma fecha, descripción e importe).`,
      aceptar: 'Importar',
    });
    if (!v) return null;
    modo = v.modo;
  }
  for (const c of nuevos) estado.movimientos.push({ id: uid(), fecha: c.fecha, descripcion: c.descripcion, importe: c.importe, concepto: adivinar(c.descripcion, c.importe) });
  let rep = 0;
  if (modo === 'reemplazar') for (const { c, mov } of pares) {
    mov.fecha = c.fecha; mov.descripcion = c.descripcion; mov.importe = c.importe;
    if (!mov.conceptoManual) mov.concepto = adivinar(c.descripcion, c.importe);
    rep++;
  }
  guardar();
  return { n: nuevos.length, rep, omit: pares.length - rep };
}

// Plan B del PDF: el texto suelto al mayordomo, que devuelve los movimientos en JSON.
async function interpretarLLM(texto) {
  toast('El mayordomo está leyendo el extracto…', 5000);
  try {
    const j = await pedirJSON({
      operacion: 'finanzas-extracto', contexto: false,
      tarea: `Este es el texto de un extracto bancario. Devuelve {"movimientos":[{"fecha":"AAAA-MM-DD","descripcion":"...","importe":-12.34}]} con un objeto por movimiento, importe negativo si es gasto y positivo si es ingreso, sin inventar ninguno. Texto:\n\n${texto.slice(0, 12000)}`,
    });
    const cands = [];
    for (const m of listaJSON(j, 'movimientos')) {
      const fecha = fechaNorm(m.fecha), importe = num(m.importe), descripcion = String(m.descripcion || '').trim();
      if (fecha && importe != null) cands.push({ fecha, descripcion, importe });
    }
    const r = await importarMovimientos(cands, 'leído por el mayordomo');
    toast(r ? `${r.n} nuevos · ${r.rep} reemplazados · ${r.omit} sin tocar` : 'Importación cancelada', 5000);
  } catch (e) { toast('LLM: ' + e.message, 6000); }
}

function render(cont, params) {
  if (params.vista === 'anio') return renderAnio(cont, params);
  const mes = params.mes || mesISO(hoyISO());
  const b = balanceMes(mes);
  const [y, m] = mes.split('-').map(Number); const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`, next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
  const movs = estado.movimientos.filter(x => mesISO(x.fecha) === mes).sort((a, c) => c.fecha.localeCompare(a.fecha));
  const recAplicadas = estado.recurrentes.filter(r => estado.movimientos.some(x => x.recurrenteId === r.id && mesISO(x.fecha) === mes)).length;
  // Cuántos movimientos cambiarían de concepto si se volviesen a pasar por las reglas de hoy.
  const porClasificar = estado.movimientos.filter(x => !x.conceptoManual && adivinar(x.descripcion, x.importe) !== x.concepto).length;
  cont.innerHTML = h`
    <div class="fila cab"><button class="btn" data-a="mes" data-m="${prev}">‹</button><div class="t centro"><b>${mes}</b> <button class="btn mini" data-a="anio">año ${y}</button></div><button class="btn" data-a="mes" data-m="${next}">›</button></div>
    <div class="tarjeta"><div class="grande ${b.neto >= 0 ? 'pos' : 'neg'}">${euros(b.neto)}</div><div class="mini">ingresos ${euros(b.ing)} · gastos ${euros(b.gas)} · ${b.n} movimientos</div>
      ${Object.keys(b.por).length ? crudo('<table class="tabla">' + Object.entries(b.por).sort((x, z) => z[1] - x[1]).map(([c, v]) => h`<tr><td>${c}</td><td class="n">${euros(v)}</td><td style="width:40%"><div class="barra"><i style="width:${Math.round(v / b.gas * 100)}%"></i></div></td></tr>`).join('') + '</table>') : ''}</div>
    <div class="acciones"><button class="btn p" data-a="nuevo">+ Movimiento</button><label class="btn">Importar extracto: CSV · Excel · PDF <input type="file" accept=".csv,.xlsx,.xls,.pdf,text/csv,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" data-c="extracto" hidden></label><button class="btn" data-a="aplicarRec">Aplicar recurrentes (${recAplicadas}/${estado.recurrentes.length})</button>${porClasificar ? h`<button class="btn" data-a="reclasificar">Reclasificar (${porClasificar})</button>` : ''}${b.n ? crudo('<button class="btn" data-a="analizarLLM">Recomendaciones con LLM</button>') : ''}</div>
    <h3>Movimientos</h3>
    ${movs.length ? crudo('<table class="tabla">' + movs.slice(0, 60).map(x => h`<tr data-a="editar" data-id="${x.id}"><td class="mini">${fechaCorta(x.fecha)}</td><td>${x.descripcion}<div class="mini">${x.concepto}</div></td><td class="n ${x.importe >= 0 ? 'pos' : 'neg'}">${euros(x.importe)}</td></tr>`).join('') + '</table>') : aviso('Sin movimientos este mes. Importa el extracto del banco (CSV, Excel o PDF) o añade a mano.')}
    <h3>Recurrentes (servicios que consumo)</h3>
    ${estado.recurrentes.length ? lista(estado.recurrentes.map(r => h`<div class="tarjeta fila" data-a="editarRec" data-id="${r.id}"><div class="t"><b>${r.descripcion}</b><div class="mini">${r.concepto} · día ${r.dia}</div></div><b class="${r.importe >= 0 ? 'pos' : 'neg'}">${euros(r.importe)}/mes</b></div>`)) : aviso('Servidor, OpenRouter, dominios, suscripciones… Se aplican al mes con un botón.')}
    <div class="acciones"><button class="btn" data-a="nuevoRec">+ Recurrente</button></div>
    <p class="mini">El mayordomo hace recomendaciones a partir de esto; ejecutarlas queda para versiones futuras (D11). Importa el extracto en CSV, Excel o PDF; la conexión automática con el banco sigue siendo deuda D4.</p>`;
  delegar(cont, {
    mes: el => navegar('finanzas', { mes: el.dataset.m }),
    anio: () => navegar('finanzas', { vista: 'anio', anio: y }),
    analizarLLM: el => conLLM(el, async () => {
      const bp = balanceMes(prev);
      const j = await consultar({ operacion: 'finanzas', tarea: `Analiza las finanzas de ${mes}: ingresos ${euros(b.ing)}, gastos ${euros(b.gas)}, por concepto ${Object.entries(b.por).map(([k, v]) => k + ' ' + euros(v)).join(', ')}; mes anterior gastos ${euros(bp.gas)} (${Object.entries(bp.por).map(([k, v]) => k + ' ' + euros(v)).join(', ') || 'sin datos'}); recurrentes: ${estado.recurrentes.map(r => r.descripcion + ' ' + euros(r.importe)).join(', ') || 'ninguno'}. Da 3 recomendaciones concretas y accionables, cada una en una línea que empiece por "- ". Solo recomendar, nunca ejecutar.` });
      toast(textoAConsejos(j.respuesta, 'finanzas') + ' recomendaciones en Consejos'); navegar('mayordomo');
    }),
    nuevo: async () => { const v = await pedir('Movimiento', campos, { fecha: hoyISO(), concepto: 'otros' }); if (v) { estado.movimientos.push({ id: uid(), ...v }); guardar(); } },
    editar: async el => { const x = estado.movimientos.find(z => z.id === el.dataset.id); const v = await pedir('Editar', campos, x, { extra: 'Borrar' }); if (!v) return; if (v.__extra) estado.movimientos = estado.movimientos.filter(z => z.id !== x.id); else { if (v.concepto !== x.concepto) v.conceptoManual = true; Object.assign(x, v); } guardar(); },
    nuevoRec: async () => { const v = await pedir('Recurrente', camposRec); if (v) { estado.recurrentes.push({ id: uid(), ...v }); guardar(); } },
    editarRec: async el => { const r = estado.recurrentes.find(z => z.id === el.dataset.id); const v = await pedir('Editar recurrente', camposRec, r, { extra: 'Borrar' }); if (!v) return; if (v.__extra) estado.recurrentes = estado.recurrentes.filter(z => z.id !== r.id); else Object.assign(r, v); guardar(); },
    reclasificar: async () => {
      const cambian = estado.movimientos.filter(x => !x.conceptoManual && adivinar(x.descripcion, x.importe) !== x.concepto);
      const n = cambian.length;
      if (!await confirmar(`${n} ${n === 1 ? 'movimiento cambia' : 'movimientos cambian'} de concepto con las reglas de ahora. Los que hayas editado a mano no se tocan.`, 'Reclasificar')) return;
      for (const x of cambian) x.concepto = adivinar(x.descripcion, x.importe);
      guardar(); toast(n === 1 ? '1 reclasificado' : n + ' reclasificados');
    },
    aplicarRec: () => { let n = 0; for (const r of estado.recurrentes) { if (estado.movimientos.some(x => x.recurrenteId === r.id && mesISO(x.fecha) === mes)) continue; estado.movimientos.push({ id: uid(), fecha: `${mes}-${String(r.dia || 1).padStart(2, '0')}`, descripcion: r.descripcion, importe: r.importe, concepto: r.concepto, recurrenteId: r.id }); n++; } guardar(); toast(n + ' aplicados'); },
    extracto: async el => {
      const f = el.files[0]; if (!f) return; el.value = '';
      let p;
      try { p = await leerExtracto(f); } catch (e) { return toast('No se pudo leer: ' + e.message, 6000); }
      // Un PDF sin tabla reconocible todavía tiene arreglo, pero antes hay que saber qué se leyó:
      // sin texto es un PDF escaneado y no hay nada que hacer; con texto, o lo interpreta el
      // mayordomo (se pregunta porque gasta crédito) o se mira el texto para ver por qué falla.
      if (!p.filas.length) {
        if (!p.texto) return toast('De ese PDF no sale texto: está escaneado (es una imagen) o usa una fuente sin mapa de caracteres. Descarga el extracto en CSV o Excel desde el banco.', 9000);
        const muestra = p.texto.split('\n').filter(Boolean).slice(0, 3).map(l => l.slice(0, 70)).join(' ⏎ ');
        const v = await pedir('Extracto en PDF', [], {}, { texto: `No reconozco ninguna fila de «fecha … importe». Esto es lo que he leído: «${muestra}». Que lo interprete el mayordomo consume LLM.`, aceptar: 'Interpretar', otro: 'Ver el texto' });
        if (v && v.__otro) return pedir('Texto leído del PDF', [{ n: 't', l: 'Se puede copiar de aquí para ver por qué no se reconoce', t: 'textarea', filas: 14, v: p.texto.slice(0, 4000) }], {}, { aceptar: 'Cerrar' });
        if (v) return interpretarLLM(p.texto);
        return;
      }
      const ops = p.cab.map((c, i) => ({ v: i, l: c || 'columna ' + (i + 1) }));
      const adiv = re => Math.max(0, p.cab.findIndex(c => re.test(c)));
      const m0 = p.filas[0];
      const v = await pedir('Columnas del extracto', [
        { n: 'f', l: 'Fecha', t: 'select', o: ops, v: adiv(/fecha|date/i) },
        { n: 'd', l: 'Descripción / concepto', t: 'select', o: ops, v: adiv(/concepto|descrip|detalle/i) },
        { n: 'i', l: 'Importe', t: 'select', o: ops, v: adiv(/importe|amount|cantidad/i) },
        { n: 'inv', l: 'Los gastos vienen en positivo (invertir el signo)', t: 'check' },
      ], {}, { texto: `${p.origen}: ${p.filas.length} filas. Primera: ${m0.filter(Boolean).slice(0, 4).join(' · ')}. Si alguna ya está guardada se preguntará si reemplazarla o saltarla.`, aceptar: 'Continuar' });
      if (!v) return;
      const cands = []; let mal = 0;
      for (const fila of p.filas) {
        const fecha = fechaNorm(fila[v.f]); let importe = num(fila[v.i]); const descripcion = String(fila[v.d] || '').trim();
        if (!fecha || importe == null) { mal++; continue; }
        if (v.inv) importe = -importe;
        cands.push({ fecha, descripcion, importe });
      }
      const r = await importarMovimientos(cands, p.origen);
      if (!r) return toast('Importación cancelada: no se ha guardado nada', 4000);
      toast(`${r.n} nuevos · ${r.rep} reemplazados · ${r.omit} sin tocar · ${mal} ${mal === 1 ? 'ilegible' : 'ilegibles'}`, 6000);
    },

  });
}
// Informe del año: el primer nivel de análisis sobre lo importado. Cada mes lleva a su detalle.
function renderAnio(cont, params) {
  const anio = Number(params.anio) || Number(hoyISO().slice(0, 4));
  const b = balanceAnio(String(anio));
  const tope = Math.max(1, ...b.filas.map(f => Math.max(f.ing, f.gas)));
  const mesLargo = m => ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(m.slice(5)) - 1];
  const peor = b.filas.slice().sort((x, z) => z.gas - x.gas)[0];
  const mejor = b.filas.slice().sort((x, z) => z.neto - x.neto)[0];
  cont.innerHTML = h`
    <div class="fila cab"><button class="btn" data-a="anio" data-y="${anio - 1}">‹</button><div class="t centro"><b>${anio}</b> <button class="btn mini" data-a="volver">ver por meses</button></div><button class="btn" data-a="anio" data-y="${anio + 1}">›</button></div>
    ${b.n ? crudo('') : aviso('Sin movimientos en ' + anio + '. Importa el extracto del banco o cambia de año con las flechas.')}
    ${b.n ? h`<div class="tarjeta"><div class="grande ${b.neto >= 0 ? 'pos' : 'neg'}">${euros(b.neto)}</div>
      <div class="mini">ingresos ${euros(b.ing)} · gastos ${euros(b.gas)} · ${b.n} movimientos en ${b.mesesConDatos} meses</div>
      ${b.neutro ? h`<div class="mini">de esos gastos, ${euros(b.neutro)} son traspasos y efectivo (no salen de tu bolsillo): gasto real ${euros(b.gasReal)}, ${euros(b.gasReal / b.mesesConDatos)} al mes</div>` : ''}
      <div class="mini">media mensual: ingresos ${euros(b.ing / b.mesesConDatos)} · gastos ${euros(b.gas / b.mesesConDatos)}${peor ? ' · mes de más gasto ' + mesLargo(peor.mes) + ' (' + euros(peor.gas) + ')' : ''}${mejor ? ' · mejor mes ' + mesLargo(mejor.mes) + ' (' + euros(mejor.neto) + ')' : ''}</div></div>` : ''}
    ${b.n ? crudo('<h3>Ingresos y gastos por mes</h3><table class="tabla"><tr><th>Mes</th><th class="n">Ingresos</th><th class="n">Gastos</th><th class="n">Neto</th></tr>'
      + b.filas.map(f => h`<tr data-a="ir" data-m="${f.mes}"><td>${mesLargo(f.mes)}<div class="barra"><i class="ok" style="width:${Math.round(f.ing / tope * 100)}%"></i></div><div class="barra"><i class="mal" style="width:${Math.round(f.gas / tope * 100)}%"></i></div></td><td class="n pos">${euros(f.ing)}</td><td class="n neg">${euros(f.gas)}</td><td class="n ${f.neto >= 0 ? 'pos' : 'neg'}"><b>${euros(f.neto)}</b></td></tr>`).join('')
      + h`<tr><td><b>Total</b></td><td class="n pos"><b>${euros(b.ing)}</b></td><td class="n neg"><b>${euros(b.gas)}</b></td><td class="n ${b.neto >= 0 ? 'pos' : 'neg'}"><b>${euros(b.neto)}</b></td></tr>`
      + '</table>') : ''}
    ${Object.keys(b.por).length ? crudo('<h3>Gasto por concepto</h3><table class="tabla">' + Object.entries(b.por).sort((x, z) => z[1] - x[1]).map(([c, v]) => h`<tr><td>${c}</td><td class="n">${euros(v)}</td><td class="n mini">${Math.round(v / b.gas * 100)}%</td><td style="width:35%"><div class="barra"><i style="width:${Math.round(v / b.gas * 100)}%"></i></div></td></tr>`).join('') + '</table>') : ''}
    <p class="mini">Toca un mes para ver sus movimientos. Este informe es la base: filtros, comparación entre años y presupuesto vendrán después.</p>`;
  delegar(cont, {
    anio: el => navegar('finanzas', { vista: 'anio', anio: el.dataset.y }),
    volver: () => navegar('finanzas', { mes: (b.filas[b.filas.length - 1] || {}).mes || mesISO(hoyISO()) }),
    ir: el => navegar('finanzas', { mes: el.dataset.m }),
  });
}
export default { id: 'finanzas', titulo: 'Finanzas', grupo: 'Vida', icono: '€', render };
