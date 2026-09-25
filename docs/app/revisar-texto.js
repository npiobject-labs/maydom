// Diferencias entre un texto y su versión revisada, por palabras, para enseñar cada cambio y poder
// desmarcarlo antes de aplicarlo (mock 6). Funciones puras: las usa el diálogo de Notas con la
// respuesta de `nota-revisar`, y valen para cualquier otro texto que el mayordomo corrija.
import { sinAcentos } from './interpretar-nota.js';

const trocear = t => String(t || '').match(/[\p{L}\p{N}]+|\s+|[^\p{L}\p{N}\s]/gu) || [];
// Dos palabras que solo difieren en mayúsculas o tildes se alinean, y salen como un cambio de una a otra.
const clave = t => sinAcentos(t).toLowerCase();
const palabras = s => clave(s).match(/[\p{L}\p{N}]+/gu) || [];
const letras = s => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const esPalabra = t => /[\p{L}\p{N}]/u.test(t);
const esSigno = t => !esPalabra(t) && !/^\s+$/.test(t);

// Secuencia de [op, trozo], con op '=', '-' o '+', trozo a trozo (palabra, espacio o signo), por la
// subsecuencia común más larga.
export function diferencias(a, b) {
  const x = trocear(a), y = trocear(b), out = [];
  // Lo común por delante y por detrás no entra en la tabla.
  let ini = 0; while (ini < x.length && ini < y.length && x[ini] === y[ini]) ini++;
  let fx = x.length, fy = y.length; while (fx > ini && fy > ini && x[fx - 1] === y[fy - 1]) { fx--; fy--; }
  const xs = x.slice(ini, fx), ys = y.slice(ini, fy), n = xs.length, m = ys.length;
  const kx = xs.map(clave), ky = ys.map(clave);
  for (const t of x.slice(0, ini)) out.push(['=', t]);
  if (n * m > 4e6) { for (const t of xs) out.push(['-', t]); for (const t of ys) out.push(['+', t]); }
  else {
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = kx[i] === ky[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (kx[i] === ky[j]) {
        if (xs[i] === ys[j]) out.push(['=', xs[i]]); else out.push(['-', xs[i]], ['+', ys[j]]);
        i++; j++;
      } else if (L[i + 1][j] >= L[i][j + 1]) out.push(['-', xs[i++]]);
      else out.push(['+', ys[j++]]);
    }
    while (i < n) out.push(['-', xs[i++]]);
    while (j < m) out.push(['+', ys[j++]]);
  }
  for (const t of x.slice(fx)) out.push(['=', t]);
  return out;
}

// Tramos de cambio: lo que va seguido sin nada igual en medio. Los signos de los bordes de un cambio
// de palabras van aparte (el punto final no es parte de «5 → cinco»), y dos cambios de palabras
// separados solo por un espacio son uno («haber si» → «a ver si»).
function tramos(ops) {
  const t = [];
  for (const op of ops) {
    const igual = op[0] === '=', u = t[t.length - 1];
    if (u && u.igual === igual) u.ops.push(op); else t.push({ igual, ops: [op] });
  }
  const conPalabras = tr => !tr.igual && tr.ops.some(o => esPalabra(o[1]));
  const partidos = [];
  for (const tr of t) {
    if (!conPalabras(tr)) { partidos.push(tr); continue; }
    let a = 0, b = tr.ops.length;
    while (a < b && esSigno(tr.ops[a][1])) a++;
    while (b > a && esSigno(tr.ops[b - 1][1])) b--;
    if (a) partidos.push({ igual: false, ops: tr.ops.slice(0, a) });
    partidos.push({ igual: false, ops: tr.ops.slice(a, b) });
    if (b < tr.ops.length) partidos.push({ igual: false, ops: tr.ops.slice(b) });
  }
  const out = [];
  for (const tr of partidos) {
    const u = out[out.length - 1], v = out[out.length - 2];
    if (conPalabras(tr) && u?.igual && u.ops.length === 1 && /^ +$/.test(u.ops[0][1]) && v && conPalabras(v)) { out.pop(); v.ops.push(...u.ops, ...tr.ops); }
    else out.push(tr);
  }
  return out;
}

// ¿Explica esta corrección del mayordomo el cambio de `antes` a `despues`? Cuentan las palabras que
// salen y las que entran, no las que se quedan («me e» → «Me he» es la corrección «e» → «he»).
function cubre(c, antes, despues) {
  const a = palabras(antes), d = palabras(despues);
  const quita = a.filter(w => !d.includes(w)), pone = d.filter(w => !a.includes(w));
  if (!quita.length && !pone.length) return false;
  const ca = palabras(c.antes), cd = palabras(c.despues);
  return quita.every(w => ca.includes(w)) && pone.every(w => cd.includes(w));
}
// ¿Cae este trozo dentro de la corrección? Todas sus palabras están en ella, antes y después.
function dentro(c, antes, despues) {
  const a = palabras(antes), d = palabras(despues), ca = palabras(c.antes), cd = palabras(c.despues);
  return (a.length || d.length) > 0 && a.every(w => ca.includes(w)) && d.every(w => cd.includes(w));
}
const lado = (ops, op) => ops.filter(o => o[0] === op || o[0] === '=').map(o => o[1]).join('');

// Trozos [op, texto, id] del paso de `original` a `revisado`. Cada cambio lleva un id para poder
// desmarcarlo; los de solo signos, espacios o mayúsculas comparten el id 'p'. Con `formato` (la
// versión en lista), lo que no es corrección es el cambio de formato: id 'f', que no se desmarca.
export function revision(original, revisado, correcciones = [], { formato = false } = {}) {
  const ts = tramos(diferencias(original, revisado));
  let n = 0;
  const info = ts.map(tr => {
    if (tr.igual) return null;
    const antes = lado(tr.ops, '-'), despues = lado(tr.ops, '+');
    // En la lista, lo que pone o quita saltos de línea es el formato: desmarcarlo la rompería.
    if (formato && /\n/.test(antes + despues)) return { id: 'f' };
    if (letras(antes) === letras(despues)) return { id: 'p', p: { tipo: 'Puntuación' } };
    const c = correcciones.find(c => cubre(c, antes, despues));
    if (c) return { id: 'c' + (++n), c, p: { tipo: String(c.tipo || 'Corrección'), nota: String(c.nota || ''), opcional: !!c.opcional } };
    if (clave(antes) === clave(despues)) return { id: 'c' + (++n), p: { tipo: 'Tildes' } };
    return formato ? { id: 'f' } : { id: 'c' + (++n), p: { tipo: 'Cambio' } };
  });
  // Una corrección se lleva los trozos seguidos que abarca: «y tambien» → «También» es un cambio, no un
  // «y» que sale y una tilde aparte. Un signo entre medias va con ella si lo que sigue también es suyo.
  const espacio = k => ts[k]?.igual && ts[k].ops.length === 1 && /^ +$/.test(ts[k].ops[0][1]);
  const siguiente = k => (espacio(k + 1) ? k + 2 : k + 1);
  const suyo = (c, k) => ts[k] && !ts[k].igual && info[k].id !== 'f' && dentro(c, lado(ts[k].ops, '-'), lado(ts[k].ops, '+'));
  for (let i = 0; i < ts.length; i++) {
    const c = info[i]?.c; if (!c) continue;
    for (let j = siguiente(i); ts[j] && !ts[j].igual; j = siguiente(j)) {
      if (suyo(c, j)) info[j] = { id: info[i].id };
      else if (info[j].id === 'p' && suyo(c, siguiente(j))) info[j] = { id: info[i].id };
      else break;
    }
  }
  // El signo que abre una frase nueva va con el cambio que la empieza en mayúscula («descuento. También»):
  // si ese cambio se desmarca, el punto tampoco tiene sentido.
  for (let i = 0; i < ts.length; i++) {
    if (info[i]?.id !== 'p') continue;
    let j = i + 1;
    if (ts[j]?.igual && ts[j].ops.length === 1 && /^ +$/.test(ts[j].ops[0][1])) j++;
    const x = info[j];
    if (x && x.id !== 'p' && x.id !== 'f' && /^\p{Lu}/u.test(lado(ts[j].ops, '+').trimStart())) info[i] = { id: x.id };
  }
  const segs = [], problemas = {};
  const poner = (op, t, id) => { const u = segs[segs.length - 1]; if (u && u[0] === op && u[2] === id) u[1] += t; else segs.push(id ? [op, t, id] : [op, t]); };
  ts.forEach((tr, i) => {
    const x = info[i];
    if (x?.p && !problemas[x.id]) problemas[x.id] = x.p;
    for (const [op, t] of tr.ops) poner(tr.igual ? '=' : op, t, x?.id);
  });
  return { segs, problemas };
}

const activo = (id, acc) => !id || id === 'f' || !!acc[id];
// El texto que queda con los cambios marcados en `acc` ({id: true|false}).
export const resultado = (segs, acc) => segs.map(([op, t, id]) => op === '=' ? t : (op === '+') === activo(id, acc) ? t : '').join('');
// Los ids de los cambios que se pueden desmarcar, en el orden en que aparecen.
export const cambios = segs => [...new Set(segs.filter(s => s[2] && s[2] !== 'f').map(s => s[2]))];
// Cómo se lee un cambio en su fila: lo que había y lo que queda (para 'p', solo cuántos signos).
export function detalleCambio(segs, id) {
  const de = segs.filter(s => s[2] === id);
  if (id === 'p') return { signos: de.filter(s => s[0] === '+').length };
  // Un cambio puede juntar trozos separados (dos tramos del mismo id); se enseñan unidos por « … ».
  const trozos = [];
  for (let k = 0; k < segs.length; k++) {
    if (segs[k][2] !== id) continue;
    const g = [];
    while (k < segs.length && segs[k][2] === id) g.push(segs[k++]);
    trozos.push({ antes: lado(g, '-').trim(), despues: lado(g, '+').trim() });
  }
  // Un signo que va con una palabra cambiada no se enseña suelto («. … También»): basta la palabra.
  const conPalabras = trozos.filter(t => esPalabra(t.antes + t.despues));
  if (conPalabras.length) trozos.splice(0, trozos.length, ...conPalabras);
  return { antes: trozos.map(t => t.antes).filter(Boolean).join(' … '), despues: trozos.map(t => t.despues).filter(Boolean).join(' … ') };
}
