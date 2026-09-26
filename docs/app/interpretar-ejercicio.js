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

// «45 s», «1 min», «1 min 30 s», «1:30», «1,5 min», «90 segundos»; un número suelto son segundos.
export function leerSegundos(t) {
  const s = sinTildes(t);
  let m = /(\d+):([0-5]\d)/.exec(s);
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
const esTiempo = t => /\d\s*(?:s\b|seg|min|'|")|\d:\d/.test(sinTildes(t));
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
  if (v.seg) p.push(`${segTexto(v.seg)} por tiempo`);
  if (v.descanso) p.push(`${segTexto(v.descanso)} de descanso`);
  if (v.kg) p.push(`${v.kg.toLocaleString('es-ES')} kg movidos`);
  return p.join(' · ');
}

// ---------- plan B sin LLM ----------
// No entiende el relato: reconoce «N series de R <ejercicio>», «<ejercicio> 4x12», «3 series de 45 segundos
// de plancha», el peso y el descanso. Un descanso dicho aparte vale para los ejercicios de antes que no
// tenían el suyo. Lo que no reconozca no se inventa: se queda fuera y se escribe a mano.
const NUMEROS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100 };
const RELLENO = /(?:^|\s)(?:hoy|ayer|he|hice|hecho|hago|hicimos|sal[ií]|fui|estuve|me|mi|luego|despu[eé]s|primero|tambi[eé]n|adem[aá]s|y|e|de|del|con|en|a|al|el|la|los|las|un|una|unos|unas|por|cada|lado|series?|repeticiones|reps?|seguidas|m[aá]s|otras?|tras|entre|para|termin[eé]|empec[eé]|acab[eé])(?=\s|$)/g;
const LETRAS = /[a-záéíóúüñ]+/g;
const UNIDAD = /^(?:s|seg\w*|min\w*)$/;

export function interpretarLocal(texto, catalogo = []) {
  let t = String(texto || '').toLowerCase()
    .replace(/minuto y medio/g, '90 segundos').replace(/medio minuto/g, '30 segundos')
    .replace(LETRAS, w => (NUMEROS[sinTildes(w)] != null ? String(NUMEROS[sinTildes(w)]) : w));
  // Un «y» parte dos ejercicios solo si detrás empieza otro («y 2 series de…», «y 3 de 10…»), no en «8, 6 y 5».
  const trozos = t.split(/[.;\n]+|,(?!\s*\d)|\s+y\s+(?=\d+\s*(?:series?\b|de\s+\d|[x×]))|\b(?:y luego|y despu[eé]s|luego|despu[eé]s|adem[aá]s|tambi[eé]n)\b/)
    .map(x => (x || '').trim()).filter(Boolean);
  const cat = catalogo.map(n => ({ n, k: sinTildes(n) }));
  const items = [];
  let desde = 0;
  const T = '(\\d+(?:[.,]\\d+)?\\s*(?:min\\w*|seg\\w*|s\\b))';
  const DESC = new RegExp(`(?:descans[\\wáéíó]*|recuper[\\wáéíó]*|pausa\\w*)\\s*(?:de\\s*|unos?\\s*|entre series\\s*)*${T}|${T}\\s*(?:de\\s*)?(?:descanso|recuperaci[oó]n|pausa)`);
  for (let f of trozos) {
    let descanso = null, kg = null;
    f = f.replace(DESC, (_, a, b) => { descanso = leerSegundos(a || b); return ' '; });
    f = f.replace(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?)\b/, (_, k) => { kg = num(k); return ' '; });
    let series = [], m;
    const unidad = u => (u && UNIDAD.test(u) ? ' ' + u : '');
    if ((m = /(\d+)\s*[x×]\s*(\d+)\s*(s\b|seg\w*|min\w*)?/.exec(f))) series = leerSeries(`${m[1]} x ${m[2]}${unidad(m[3])}`);
    else if ((m = /(\d+)\s*(?:series?\s*(?:de\s*)?|de\s+(?=\d))(\d+(?:\s*(?:,|y)\s*\d+)*)?\s*(s\b|seg\w*|min\w*|rep\w*)?/.exec(f))) {
      const vals = (m[2] || '').split(/\s*(?:,|y)\s*/).filter(Boolean);
      if (vals.length > 1) series = leerSeries(vals.map(v => v + unidad(m[3])).join(', '));
      else if (vals.length) series = leerSeries(`${m[1]} x ${vals[0]}${unidad(m[3])}`);
    } else if ((m = /(\d+(?:\s*(?:,|y)\s*\d+)*)\s*(s\b|seg\w*|min\w*|rep\w*)?/.exec(f))) {
      series = leerSeries(m[1].split(/\s*(?:,|y)\s*/).map(v => v + unidad(m[2])).join(', '));
    }
    if (!series.length) {
      // Un trozo solo con el descanso vale para los ejercicios anteriores que no tenían el suyo.
      if (descanso) { for (const it of items.slice(desde)) if (!it.descanso) it.descanso = descanso; desde = items.length; }
      continue;
    }
    let nombre = f.replace(m[0], ' ').replace(/\d+/g, ' ').replace(/(?:^|\s)(?:segundos?|minutos?|seg|min|s)(?=\s|$)/g, ' ')
      .replace(RELLENO, ' ').replace(RELLENO, ' ').replace(/[^\p{L}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!nombre) continue;
    // Con el nombre del catálogo si es el mismo ejercicio, también en plural («sentadillas»).
    const k = sinTildes(nombre), igual = cat.find(c => k === c.k || k === c.k + 's' || k === c.k + 'es');
    nombre = igual ? igual.n : nombre[0].toUpperCase() + nombre.slice(1);
    items.push({ nombre, series, kg, descanso });
  }
  return items;
}

// ---------- lo que devuelve el mayordomo ----------
// Acepta las formas razonables: listas de repeticiones y de segundos, series como número con reps
// o seg, o una lista de objetos. Nunca rellena lo que no venga.
export function desdeLLM(lista) {
  const out = [];
  for (const e of Array.isArray(lista) ? lista : []) {
    const nombre = String(e?.nombre || '').trim().slice(0, 60);
    if (!nombre) continue;
    const series = [];
    const meter = x => {
      if (x && typeof x === 'object') { const s = num(x.seg ?? x.segundos ?? x.s), r = num(x.reps ?? x.repeticiones ?? x.r); if (s) series.push({ s: Math.round(s) }); else if (r) series.push({ r: Math.round(r) }); }
      else if (num(x)) series.push({ r: Math.round(num(x)) });
    };
    if (Array.isArray(e.series)) e.series.forEach(meter);
    if (Array.isArray(e.segundos)) e.segundos.forEach(x => num(x) && series.push({ s: Math.round(num(x)) }));
    if (!series.length && num(e.series)) {
      const n = Math.min(MAX_SERIES, Math.round(num(e.series))), s = num(e.seg ?? e.segundos), r = num(e.reps ?? e.repeticiones);
      if (s) for (let i = 0; i < n; i++) series.push({ s: Math.round(s) });
      else if (r) for (let i = 0; i < n; i++) series.push({ r: Math.round(r) });
    }
    const d = num(e.descanso);
    out.push({ nombre: nombre[0].toUpperCase() + nombre.slice(1), series: series.slice(0, MAX_SERIES), kg: num(e.kg), descanso: d && d <= 1800 ? Math.round(d) : null });
  }
  return out;
}

// Enlaza cada ejercicio con el del catálogo que se llame igual (sin mirar tildes ni mayúsculas).
export function vincular(items, catalogo) {
  const por = new Map(catalogo.map(e => [sinTildes(e.nombre), e.id]));
  return items.map(it => ({ ...it, ejercicioId: por.get(sinTildes(it.nombre)) || null }));
}
