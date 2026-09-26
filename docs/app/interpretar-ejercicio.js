// Del relato del ejercicio a datos: funciones puras, sin estado ni DOM.
// Una sesión contada guarda sus ejercicios como items {nombre, series:[{r}|{s}], kg, descanso}:
// `r` son repeticiones y `s` segundos (isométricos y lo que va por tiempo); `descanso`, segundos entre series.
// En el formulario se repasan como texto, un ejercicio por línea, con el formato que devuelve componerDetalle():
//   Flexiones: 4 × 12 · descanso 60 s
//   Dominadas: 8, 6, 5 · descanso 1 min 30 s
//   Plancha: 3 × 45 s · descanso 30 s
//   Sentadilla goblet: 4 × 10 · 16 kg · descanso 90 s

const sinTildes = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const num = x => { const v = Number(String(x ?? '').replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null; };
const MAX_SERIES = 30;

// «45 s», «1 min», «1 min 30 s», «1:30», «1,5 min», «90 segundos», «1 hora y media»; un número suelto son segundos.
export function leerSegundos(t) {
  const s = sinTildes(t);
  let m = /(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\b\s*(y media)?(?:\s*(?:y\s*)?(\d+)\s*min\w*)?/.exec(s);
  if (m) return Math.round(num(m[1]) * 3600 + (m[2] ? 1800 : 0) + (Number(m[3]) || 0) * 60);
  m = /(\d+):([0-5]\d)/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /(\d+(?:[.,]\d+)?)\s*(?:min\w*|')\s*(?:y\s*)?(?:(\d+)\s*(?:s\b|seg\w*|")?)?/.exec(s);
  if (m) return Math.round(num(m[1]) * 60 + (Number(m[2]) || 0));
  m = /(\d+)\s*(?:s\b|seg\w*|")/.exec(s) || /^\s*(\d+)\s*$/.exec(s);
  return m ? Number(m[1]) : null;
}
export function segTexto(s) {
  s = Math.round(Number(s) || 0);
  const m = Math.floor(s / 60), r = s % 60;
  return m ? `${m} min${r ? ' ' + r + ' s' : ''}` : `${r} s`;
}
const esTiempo = t => /\d\s*(?:s\b|seg|min|h\b|hora|'|")|\d:\d/.test(sinTildes(t));
const serieDe = t => { if (esTiempo(t)) { const s = leerSegundos(t); return s ? { s } : null; } const r = parseInt(String(t).replace(/^\D+/, ''), 10); return r > 0 ? { r } : null; };

// «4 × 12», «3x45 s», «12, 10, 8», «12, 10 y 8», «45 s, 40 s».
export function leerSeries(t) {
  const s = String(t || '').trim();
  const m = /^(\d+)\s*[x×*]\s*(.+)$/i.exec(s);
  if (m) { const una = serieDe(m[2]); return una ? Array.from({ length: Math.min(MAX_SERIES, Number(m[1])) }, () => ({ ...una })) : []; }
  return s.split(/\s*,\s*|\s+y\s+/).map(serieDe).filter(Boolean).slice(0, MAX_SERIES);
}
function seriesTexto(series) {
  if (!series.length) return '';
  const una = x => (x.s != null ? segTexto(x.s) : String(x.r));
  const txt = series.map(una);
  return txt.every(x => x === txt[0]) ? `${series.length} × ${txt[0]}` : txt.join(', ');
}

// Una línea del detalle. Sin dos puntos, el nombre es lo que va antes del primer número.
export function leerLinea(linea) {
  let t = String(linea || '').replace(/^\s*[-•*]\s*/, '').trim();
  if (!t) return null;
  let nombre, resto;
  // Los dos puntos de «1:30» no separan el nombre.
  let dp = -1;
  for (let i = 0; i < t.length && dp < 0; i++) if (t[i] === ':' && !(/\d/.test(t[i - 1] || '') && /\d/.test(t[i + 1] || ''))) dp = i;
  const m = /^([^\d]+?)\s+(\d.*)$/.exec(t);
  if (dp > 0) { nombre = t.slice(0, dp); resto = t.slice(dp + 1); }
  else if (m) { nombre = m[1]; resto = m[2]; }
  else { nombre = t; resto = ''; }
  const it = { nombre: nombre.replace(/[·|\-–]+\s*$/, '').trim(), series: [], kg: null, descanso: null };
  resto = resto.replace(/descans\w*\s*:?\s*(?:de\s*)?([^·|]+)/i, (_, d) => { it.descanso = leerSegundos(d); return ' '; });
  resto = resto.replace(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?)\b/i, (_, k) => { it.kg = num(k); return ' '; });
  const partes = resto.split(/\s*[·|]\s*|\s+-\s+/).map(x => x.trim()).filter(Boolean);
  for (const p of partes) { const ss = leerSeries(p); if (ss.length) { it.series = ss; break; } }
  return it.nombre ? it : null;
}
export const leerDetalle = texto => String(texto || '').split('\n').map(leerLinea).filter(Boolean);
export function componerLinea(it) {
  const partes = [seriesTexto(it.series || [])];
  if (it.kg) partes.push(`${String(it.kg).replace('.', ',')} kg`);
  if (it.descanso) partes.push(`descanso ${segTexto(it.descanso)}`);
  const cola = partes.filter(Boolean).join(' · ');
  return cola ? `${it.nombre}: ${cola}` : it.nombre;
}
export const componerDetalle = items => (items || []).map(componerLinea).join('\n');

// Lo cuantificado de una sesión. El descanso cuenta entre series, no tras la última.
export function volumen(items) {
  const v = { ejercicios: 0, series: 0, reps: 0, seg: 0, descanso: 0, kg: 0 };
  for (const it of items || []) {
    const ss = it.series || [];
    v.ejercicios++; v.series += ss.length;
    for (const x of ss) { if (x.r) { v.reps += x.r; if (it.kg) v.kg += x.r * it.kg; } if (x.s) v.seg += x.s; }
    if (it.descanso && ss.length > 1) v.descanso += (ss.length - 1) * it.descanso;
  }
  v.kg = Math.round(v.kg);
  return v;
}
export function volumenTexto(v) {
  if (!v || !v.ejercicios) return '';
  const p = [`${v.ejercicios} ${v.ejercicios === 1 ? 'ejercicio' : 'ejercicios'}`, `${v.series} ${v.series === 1 ? 'serie' : 'series'}`];
  if (v.reps) p.push(`${v.reps} repeticiones`);
  if (v.seg) p.push(`${segTexto(v.seg)} en ejercicios por tiempo`);
  if (v.descanso) p.push(`${segTexto(v.descanso)} de descanso`);
  if (v.kg) p.push(`${v.kg.toLocaleString('es-ES')} kg movidos`);
  return p.join(' · ');
}

// ---------- plan B sin LLM ----------
// No entiende el relato: parte el texto en trozos («luego», «a continuación», «,»…) y en cada uno busca
// cuántas series, cuántas repeticiones («4 series de 12», «una serie de X con 20 repeticiones», «4x12»)
// o cuánto tiempo («caminata de 30 minutos», «3 de 45 segundos»), el peso y el descanso. La hora del día
// («a las diez») no cuenta. Un descanso dicho aparte vale para los ejercicios de antes que no tenían el
// suyo. Lo que no reconozca no se inventa: se queda fuera y se escribe a mano.
const NUMEROS = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100 };
const RELLENO = /(?:^|\s)(?:hoy|ayer|he|hice|hecho|hago|hicimos|sal[ií]|fui|estuve|me|mi|luego|despu[eé]s|primero|tambi[eé]n|adem[aá]s|y|e|de|del|con|en|a|al|el|la|los|las|un|una|unos|unas|uno|por|cada|lado|brazo|pierna|series?|repeticiones|reps?|veces|seguidas|m[aá]s|otras?|otros?|tras|entre|para|termin[eé]|terminar|empec[eé]|acab[eé]|aproximadamente|como|sobre)(?=\s|$)/g;
const LETRAS = /[a-záéíóúüñ]+/g;
const UNIDAD = /^(?:s|seg\w*|min\w*|h|horas?)$/;
const PARTIR = /[.;\n]+|,(?!\s*\d)|,\s*(?=\d+\s*(?:series?\b|de\s+\d|[x×]))|\s+y\s+(?=\d+\s*(?:series?\b|de\s+\d|[x×])|no\b|ya\b|eso\b|nada\b)|\b(?:y luego|y despu[eé]s|luego|despu[eé]s|a continuaci[oó]n|m[aá]s tarde|por [uú]ltimo|finalmente|para terminar|adem[aá]s|tambi[eé]n)\b/;
const T = '(\\d+(?:[.,]\\d+)?\\s*(?:min\\w*|seg\\w*|s\\b|horas?))';
const DESC = new RegExp(`(?:descans[\\wáéíó]*|recuper[\\wáéíó]*|pausa\\w*)\\s*(?:de\\s*|un[oa]?s?\\s*|entre series\\s*)*${T}|${T}\\s*(?:de\\s*)?(?:descanso|recuperaci[oó]n|pausa)`);

// Las series de un trozo; devuelve también lo que se ha usado, para quitarlo del nombre.
function seriesDelTrozo(f) {
  let m = /(\d+)\s*[x×]\s*(\d+)\s*(s\b|seg\w*|min\w*)?/.exec(f);
  if (m) return { series: leerSeries(`${m[1]} x ${m[2]}${m[3] && UNIDAD.test(m[3]) ? ' ' + m[3] : ''}`), resto: f.replace(m[0], ' ') };
  const tomar = re => { const r = re.exec(f); if (r) f = f.replace(r[0], ' '); return r; };
  const lista = x => x.split(/\s*(?:,|\by\b)\s*/).filter(Boolean);
  // «3 veces 40 segundos» son tres series; «20 veces» a secas, veinte repeticiones.
  const n = tomar(/(\d+)\s*(?:series?\b(?:\s*de\b)?|veces\b(?:\s*de\b)?|de\s+(?=\d))/);
  const reps = tomar(/(\d+(?:\s*(?:,|\by\b)\s*\d+)*)\s*(?:repeticiones|reps?)\b/);
  const tiempo = !reps && tomar(/(\d+(?:[.,]\d+)?(?:\s*(?:,|\by\b)\s*\d+(?:[.,]\d+)?)*)\s*(min\w*|seg\w*|s\b|horas?)(\s*y media)?/);
  const suelto = !reps && !tiempo && tomar(/(\d+(?:\s*(?:,|\by\b)\s*\d+)*)/);
  const veces = n ? Math.min(MAX_SERIES, Number(n[1])) : 1;
  const repetir = x => Array.from({ length: veces }, () => ({ ...x }));
  let series = [];
  if (reps || suelto) {
    const vals = lista((reps || suelto)[1]).map(Number).filter(v => v > 0);
    series = vals.length > 1 ? vals.map(r => ({ r })) : vals.length ? repetir({ r: vals[0] }) : [];
  } else if (tiempo) {
    const vals = lista(tiempo[1]).map(v => leerSegundos(`${v} ${tiempo[2]}${tiempo[3] || ''}`)).filter(Boolean);
    series = vals.length > 1 ? vals.map(s => ({ s })) : vals.length ? repetir({ s: vals[0] }) : [];
  } else if (n && /veces/.test(n[0])) series = [{ r: Number(n[1]) }];
  return { series: series.slice(0, MAX_SERIES), resto: f };
}

export function interpretarLocal(texto, catalogo = []) {
  const t = String(texto || '').toLowerCase()
    .replace(/minuto y medio/g, '90 segundos').replace(/medio minuto/g, '30 segundos').replace(/media hora/g, '30 minutos')
    .replace(/\bun[ao]?\s+(?=(?:series?|minutos?|horas?|segundos?|repeticion)\b)/g, '1 ')
    .replace(LETRAS, w => (NUMEROS[sinTildes(w)] != null ? String(NUMEROS[sinTildes(w)]) : w))
    // La hora del día no es ni una repetición ni una duración.
    .replace(/\ba\s+la(?:s)?\s+\d{1,2}(?:[:.]\d{2})?(?:\s*y (?:media|cuarto))?(?:\s*(?:de la (?:mañana|tarde|noche)|en punto|h\b))?/g, ' ');
  // Para reconocer los del catálogo se comparan sin palabras cortas: «remo kettlebell» es «Remo con kettlebell».
  const base = x => sinTildes(x).split(/\s+/).filter(w => w.length > 3).join(' ');
  const cat = catalogo.map(n => ({ n, k: base(n) }));
  const items = [];
  let desde = 0;
  for (let f of t.split(PARTIR).map(x => (x || '').trim()).filter(Boolean)) {
    let descanso = null, kg = null;
    f = f.replace(DESC, (_, a, b) => { descanso = leerSegundos(a || b); return ' '; });
    f = f.replace(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?)\b/, (_, k) => { kg = num(k); return ' '; });
    const { series, resto } = seriesDelTrozo(f);
    if (!series.length) {
      // Un trozo solo con el descanso vale para los ejercicios anteriores que no tenían el suyo.
      if (descanso) { for (const it of items.slice(desde)) if (!it.descanso) it.descanso = descanso; desde = items.length; }
      continue;
    }
    let nombre = resto.replace(/\d+/g, ' ').replace(/(?:^|\s)(?:segundos?|minutos?|horas?|seg|min|s|media)(?=\s|$)/g, ' ')
      .replace(RELLENO, ' ').replace(RELLENO, ' ').replace(/[^\p{L}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!nombre) continue;
    // Con el nombre del catálogo si es el mismo ejercicio, también en plural («sentadillas»).
    const k = base(nombre), igual = k && cat.find(c => k === c.k || k === c.k + 's' || k === c.k + 'es');
    nombre = igual ? igual.n : nombre[0].toUpperCase() + nombre.slice(1);
    items.push({ nombre, series, kg, descanso });
  }
  return items;
}

// La hora a la que se empezó, si el relato la dice: «a las diez de la mañana», «sobre las 7 y media de la
// tarde», «a las 18:30». Sin «de la tarde» o «de la noche» se toma tal cual: «a las 7» son las 07:00.
export function horaDe(texto) {
  const t = String(texto || '').toLowerCase().replace(LETRAS, w => { const k = sinTildes(w); return k === 'una' ? '1' : NUMEROS[k] != null ? String(NUMEROS[k]) : w; });
  const m = /\b(?:a|sobre|hacia|desde)\s+las?\s+(\d{1,2})(?!\d|\s*(?:series?|repeticiones|reps?|minutos?|segundos?|veces|kilos?|kg)\b)(?:[:.](\d{2}))?(?:\s*y\s+(media|cuarto))?(?:\s*de\s+la\s+(mañana|madrugada|tarde|noche))?/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : m[3] === 'media' ? 30 : m[3] === 'cuarto' ? 15 : 0;
  if (m[4] === 'noche' && h === 12) h = 0;
  else if ((m[4] === 'tarde' || m[4] === 'noche') && h < 12) h += 12;
  return h <= 23 && min <= 59 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null;
}

// ---------- lo que devuelve el mayordomo ----------
// Acepta las formas razonables: listas de repeticiones y de segundos (o minutos), series como número con
// reps o seg, o una lista de objetos. Nunca rellena lo que no venga.
export function desdeLLM(lista) {
  const out = [];
  for (const e of Array.isArray(lista) ? lista : []) {
    const nombre = String(e?.nombre || e?.ejercicio || '').trim().slice(0, 60);
    if (!nombre) continue;
    const series = [];
    const meter = x => {
      if (x && typeof x === 'object') { const s = num(x.seg ?? x.segundos ?? x.s), r = num(x.reps ?? x.repeticiones ?? x.r); if (s) series.push({ s: Math.round(s) }); else if (r) series.push({ r: Math.round(r) }); }
      else if (num(x)) series.push({ r: Math.round(num(x)) });
    };
    for (const k of ['repeticiones', 'series', 'reps']) if (Array.isArray(e[k])) e[k].forEach(meter);
    const tiempos = [...[].concat(e.segundos ?? []).map(num), ...[].concat(e.minutos ?? []).map(x => num(x) && num(x) * 60)].filter(Boolean);
    const cuantas = !Array.isArray(e.series) && num(e.series) ? Math.min(MAX_SERIES, Math.round(num(e.series))) : 0;
    if (!series.length && tiempos.length) {
      if (tiempos.length === 1 && cuantas > 1) for (let i = 0; i < cuantas; i++) series.push({ s: Math.round(tiempos[0]) });
      else tiempos.forEach(s => series.push({ s: Math.round(s) }));
    }
    if (!series.length && cuantas) {
      const r = num(e.reps ?? e.repeticiones);
      if (r) for (let i = 0; i < cuantas; i++) series.push({ r: Math.round(r) });
    }
    if (!series.length && num(e.repeticiones ?? e.reps)) series.push({ r: Math.round(num(e.repeticiones ?? e.reps)) });
    const d = num(e.descanso);
    out.push({ nombre: nombre[0].toUpperCase() + nombre.slice(1), series: series.slice(0, MAX_SERIES), kg: num(e.kg), descanso: d && d <= 1800 ? Math.round(d) : null });
  }
  return out;
}

// Red de seguridad: un modelo pequeño a veces se queda en el primer ejercicio o se deja las series.
// Manda lo que devuelve el mayordomo; lo que se haya saltado y las reglas sí hayan visto se completa
// con ellas, en el orden del relato. Dos ejercicios son el mismo si comparten una palabra de 4 letras.
const claves = n => sinTildes(n).split(/[^a-z]+/).filter(w => w.length >= 4).map(w => w.replace(/(?:es|s)$/, ''));
const mismo = (a, b) => { const kb = claves(b.nombre); return claves(a.nombre).some(w => kb.includes(w)); };
export function combinar(llm, local) {
  const usados = new Set(), out = [];
  const sacarHasta = i => { for (let j = 0; j <= i; j++) if (!usados.has(j)) { usados.add(j); out.push(llm[j]); } };
  for (const l of local) {
    const i = llm.findIndex((x, j) => !usados.has(j) && mismo(x, l));
    // Un nombre de más de cuatro palabras es que las reglas no han sabido separarlo: no se añade.
    if (i < 0) { if (l.series.length && l.nombre.split(' ').length <= 4) out.push(l); continue; }
    const m = llm[i];
    if (!m.series.length && l.series.length) llm[i] = { ...m, series: l.series, kg: m.kg ?? l.kg, descanso: m.descanso ?? l.descanso };
    sacarHasta(i);
  }
  sacarHasta(llm.length - 1);
  return out;
}

// Enlaza cada ejercicio con el del catálogo que se llame igual (sin mirar tildes ni mayúsculas).
export function vincular(items, catalogo) {
  const por = new Map(catalogo.map(e => [sinTildes(e.nombre), e.id]));
  return items.map(it => ({ ...it, ejercicioId: por.get(sinTildes(it.nombre)) || null }));
}
