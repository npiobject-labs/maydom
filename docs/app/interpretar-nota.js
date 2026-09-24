// Plan B sin LLM para las notas: de qué clase es (tarea, compra o idea), qué fecha tope dice y
// qué líneas de compra trae. Funciones puras: reciben el día de hoy en ISO para poder probarlas.
// Con LLM, el mayordomo (operación `nota`) afina lo mismo; esto se aplica antes y nunca deja el
// formulario vacío si el gateway falla.

export const CLASES = ['tarea', 'compra', 'idea'];
// Etiquetas de compra: las de partida, más las que el usuario vaya escribiendo en sus líneas.
export const ETIQUETAS_COMPRA = ['alimentacion', 'drogueria', 'farmacia', 'otras'];
export const NOMBRE_ETIQUETA = { alimentacion: '🥕 Alimentación', drogueria: '🧴 Droguería', farmacia: '💊 Farmacia', suplementos: '💊 Suplementos', otras: '🛒 Otras' };

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const NUMEROS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15 };
export const sinAcentos = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '');
// Para comparar nombres de productos: sin acentos, en minúsculas y sin plural.
export const normalizar = s => sinAcentos(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean).map(p => p.length > 3 ? p.replace(/(es|s)$/, '') : p).join(' ');

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fecha = s => new Date(s + 'T12:00:00');
const mas = (hoy, n) => { const d = fecha(hoy); d.setDate(d.getDate() + n); return iso(d); };
// El próximo día de la semana pedido; si es hoy, el de la semana que viene («el jueves» dicho un jueves).
const proximo = (hoy, dow) => mas(hoy, ((dow - fecha(hoy).getDay() + 7) % 7) || 7);
const domingo = hoy => mas(hoy, (7 - fecha(hoy).getDay()) % 7);

// Fecha tope que dice el texto, o '' si no dice ninguna. `leido` es el trozo en que se basa.
export function topeDe(texto, hoy) {
  const t = sinAcentos(texto).toLowerCase();
  let m;
  if (/\bpasado manana\b/.test(t)) return { tope: mas(hoy, 2), leido: 'pasado mañana' };
  // «mañana» es mañana salvo cuando es la parte del día («por la mañana», «cada mañana»).
  if (/(?<!\b(?:la|por la|de la|esta|cada|toda la|las)\s)\bmanana\b/.test(t)) return { tope: mas(hoy, 1), leido: 'mañana' };
  if (/\bhoy\b/.test(t)) return { tope: hoy, leido: 'hoy' };
  if ((m = t.match(/\b(?:en|dentro de)\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|diez|quince)\s+(dias?|semanas?)\b/))) {
    const n = NUMEROS[m[1]] ?? Number(m[1]);
    return { tope: mas(hoy, m[2].startsWith('semana') ? n * 7 : n), leido: m[0] };
  }
  // Un día de la semana cuenta con artículo o preposición delante: «los lunes» es una costumbre, no un plazo.
  if ((m = t.match(/\b(?:el|este|antes del|para el|hasta el|el proximo)\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/))) return { tope: proximo(hoy, DIAS.indexOf(m[1])), leido: m[0] };
  if ((m = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/))) {
    const a = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : fecha(hoy).getFullYear();
    const d = new Date(a, Number(m[2]) - 1, Number(m[1]), 12);
    if (d.getDate() === Number(m[1])) { if (!m[3] && iso(d) < hoy) d.setFullYear(d.getFullYear() + 1); return { tope: iso(d), leido: m[0] }; }
  }
  if ((m = t.match(/\b(?:el|antes del|para el|hasta el)(?: dia)? (\d{1,2})(?: de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))?\b/))) {
    const dia = Number(m[1]), mes = m[2] ? MESES.indexOf(m[2]) : -1, h = fecha(hoy);
    if (dia >= 1 && dia <= 31) {
      const d = new Date(h.getFullYear(), mes >= 0 ? mes : h.getMonth(), dia, 12);
      if (iso(d) < hoy) mes >= 0 ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1, dia);
      if (d.getDate() === dia) return { tope: iso(d), leido: m[0] };
    }
  }
  if (/\b(esta semana|este fin de semana|el fin de semana)\b/.test(t)) return { tope: domingo(hoy), leido: 'esta semana' };
  if (/\b(la semana que viene|la proxima semana)\b/.test(t)) return { tope: mas(domingo(hoy), 5), leido: 'la semana que viene' };
  if (/\b(este mes|fin de mes|final de mes|finales de mes)\b/.test(t)) { const h = fecha(hoy); return { tope: iso(new Date(h.getFullYear(), h.getMonth() + 1, 0, 12)), leido: 'este mes' }; }
  if (/\b(el mes que viene|el proximo mes)\b/.test(t)) { const h = fecha(hoy); return { tope: iso(new Date(h.getFullYear(), h.getMonth() + 2, 0, 12)), leido: 'el mes que viene' }; }
  return { tope: '', leido: '' };
}

const VERBO_COMPRA = '(?:comprar|compra|comprame|reponer|pillar)';
const RE_COMPRA = new RegExp(`\\b${VERBO_COMPRA}\\b|\\b(?:se (?:ha|han) acabado|se acabo|se acabaron|no queda|no quedan|faltan?)\\b`);
const RE_TAREA = /\b(tengo que|hay que|tendria que|no olvidar|no olvides|acordarme de|recordar|recuerdame)\b|^\s*(llamar|pagar|renovar|pedir|enviar|mandar|recoger|devolver|llevar|reservar|cancelar|revisar|preparar|escribir|contestar|responder|arreglar|ir a|sacar|firmar|entregar|presentar|hacer|comprobar|avisar|quedar con)\b/;
const VERBO_SEGUNDO = /^(.*?)\s*,?\s+(?:y|y ademas|ademas)\s+((?:tengo que |hay que )?(?:comprar|compra|reponer|llamar|pagar|renovar|pedir|enviar|mandar|recoger|devolver|llevar|reservar|cancelar|revisar|preparar|escribir|contestar|responder|arreglar|ir a|sacar|firmar|entregar)\b.*)$/;

const esCompra = t => RE_COMPRA.test(sinAcentos(t).toLowerCase());
const esTarea = (t, hoy) => RE_TAREA.test(sinAcentos(t).toLowerCase()) || !!topeDe(t, hoy).tope;
function claseSimple(texto, hoy) { return esCompra(texto) ? 'compra' : esTarea(texto, hoy) ? 'tarea' : 'idea'; }

// Una nota que junta dos cosas de clases distintas («llamar a la gestoría el jueves y comprar sobres»)
// se parte por la conjunción que precede al segundo verbo. Devuelve [] si no hay nada que partir.
export function partesDe(texto, hoy) {
  const t = String(texto || '').trim();
  const m = sinAcentos(t).toLowerCase().match(VERBO_SEGUNDO);
  if (!m) return [];
  const corte = m[1].length, resto = t.slice(corte).replace(/^\s*,?\s+(?:y además|y ademas|además|ademas|y)\s+/i, '');
  const a = t.slice(0, corte).trim(), ca = claseSimple(a, hoy), cb = claseSimple(resto, hoy);
  return ca !== cb ? [{ clase: ca, texto: a }, { clase: cb, texto: resto }] : [];
}

export function claseDe(texto, hoy) { return claseSimple(String(texto || ''), hoy); }

// Palabras que delatan la etiqueta de una línea de compra. Genéricas: docs/ es público.
const ALIMENTOS = /\b(leche|huevos?|pan|barras?|fruta|manzanas?|platanos?|naranjas?|limon(es)?|peras?|uvas|kiwis?|fresas|tomates?|lechugas?|cebollas?|ajos?|patatas?|zanahorias?|pimientos?|calabacin(es)?|berenjenas?|espinacas|brocoli|verduras?|pollo|pavo|ternera|cerdo|carne|pescado|merluza|salmon|atun|sardinas|gambas|jamon|chorizo|embutido|arroz|pasta|macarrones|espaguetis|harina|legumbres|garbanzos|lentejas|alubias|avena|cereales|galletas|nueces|almendras|frutos secos|aceite|vinagre|sal|azucar|miel|cafe|te|infusion(es)?|cacao|chocolate|yogur(es|t)?|queso|mantequilla|nata|kefir|agua|zumo|cerveza|vino|refresco|tofu|hummus|pizza|caldo|tomate frito|mermelada|aceitunas)\b/;
const DROGUERIA = /\b(detergente|suavizante|lejia|friegasuelos|fregasuelos|lavavajillas|jabon|champu|gel|desodorante|pasta de dientes|dentifrico|cepillo|papel higienico|papel de cocina|servilletas|bolsas de basura|bayetas?|estropajos?|limpiacristales|ambientador|colonia|crema|cuchillas|maquinillas?|compresas|tampones|panales|toallitas|insecticida|pastillas? de lavavajillas)\b/;
const FARMACIA = /\b(ibuprofeno|paracetamol|aspirinas?|tiritas|gasas|alcohol|agua oxigenada|betadine|termometro|suero|colirio|jarabe|antihistaminico|omeprazol|pastillas|pomada|protector solar|crema solar|mascarillas?|preservativos|test de embarazo|medicamentos?|receta)\b/;
export function etiquetaCompra(nombre) {
  const t = sinAcentos(nombre).toLowerCase();
  return FARMACIA.test(t) ? 'farmacia' : DROGUERIA.test(t) ? 'drogueria' : ALIMENTOS.test(t) ? 'alimentacion' : 'otras';
}

// Líneas de compra de un dictado: una por cosa, con la cantidad si se dijo.
const CANTIDAD = /^((?:\d+(?:[.,]\d+)?|una?|uno|dos|tres|cuatro|cinco|seis|media|medio)\s*(?:kilos?|kg|gramos|g|litros?|l|paquetes?|botes?|docenas?|botellas?|bolsas?|latas?|cajas?|barras?|tarros?|packs?|unidades)?)\s+(?:de\s+)?(.+)$/i;
const RE_ARRANQUE = new RegExp(`\\b(?:(?:hay|tengo) que )?${VERBO_COMPRA}\\b|\\b(?:se (?:ha|han) acabado|se acabo|se acabaron|no quedan?|faltan?)\\b`);
export function lineasDe(texto) {
  // Se quita todo hasta el primer «comprar», «falta», «se ha acabado»…: lo que sigue es la lista.
  const t = String(texto || ''), m = RE_ARRANQUE.exec(sinAcentos(t).toLowerCase());
  const limpio = (m ? t.slice(m.index + m[0].length) : t).replace(/^\s*:?\s*/, '').replace(/[.;!]+\s*$/, '');
  return limpio.split(/\s*[,;\n]\s*|\s+y\s+|\s+e\s+/i).map(s => s.trim()).filter(Boolean).map(s => {
    const q = s.match(CANTIDAD);
    let nombre = (q ? q[2] : s).replace(/^(?:el|la|los|las|unas?|unos|algo de|más|mas)\s+/i, '').trim();
    // «un poco de», «algo de» y similares no son una cantidad útil.
    const cantidad = q && !/^(una?|uno)$/i.test(q[1].trim()) ? q[1].trim() : '';
    nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);
    return { nombre, cantidad, etiqueta: etiquetaCompra(nombre) };
  }).filter(l => l.nombre.length > 1);
}

// Título de una tarea sin LLM: el dictado sin el «tengo que» ni el plazo.
export function tituloTarea(texto) {
  let t = String(texto || '').replace(/\s+/g, ' ').trim()
    .replace(/^(?:tengo que|hay que|tendr[ií]a que|no olvidar(?: de)?|no olvides|acordarme de|recordar|recu[eé]rdame(?: que)?)\s+/i, '');
  t = t.replace(/[\s,]+(?:el|este|antes del?|para el|hasta el|el pr[oó]ximo)\s+(?:d[ií]a\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|\d{1,2}(?:[/-]\d{1,2}(?:[/-]\d{2,4})?)?(?: de \p{L}+)?)\b.*$/iu, '')
    .replace(/^(?:pasado mañana|mañana|hoy|esta semana|el (?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo))[\s,]+/iu, '')
    .replace(/(?<!\b(?:la|esta|cada))[\s,]+(?:pasado mañana|mañana|hoy|esta semana|este fin de semana|la semana que viene|la pr[oó]xima semana|este mes|el mes que viene|(?:en|dentro de) \S+ (?:d[ií]as?|semanas?))\b.*$/iu, '')
    .replace(/[.;]+$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
