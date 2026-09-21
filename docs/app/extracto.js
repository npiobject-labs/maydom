// Lectura de extractos bancarios: CSV, Excel (.xlsx) y PDF, todo en el navegador y sin librerías.
// El .xlsx es un ZIP de XML y los flujos de un PDF van en deflate, así que basta con
// DecompressionStream (en los navegadores desde 2023) + DOMParser. Sin build, sin dependencias.
// Devuelve siempre {cab, filas, origen, texto}: el mismo formato que ya consumía el importador CSV,
// para que el diálogo de mapeo de columnas valga igual venga de donde venga el fichero.

// ---------- números y fechas del extracto ----------
export const num = s => {
  s = String(s ?? '').replace(/[€\s ]/g, '');
  if (!s) return null;
  if (s.endsWith('-')) s = '-' + s.slice(0, -1); // Algunos bancos imprimen el signo detrás: «45,30-».
  // Formato español (1.234,56) frente a inglés (1,234.56): manda el último separador decimal.
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return isNaN(n) ? null : n;
};
export const fechaNorm = s => {
  s = String(s ?? '').trim();
  // Excel guarda las fechas como número de serie desde el 30-12-1899; llegan así al leer la hoja.
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Math.round(Number(s)) * 86400000).toISOString().slice(0, 10);
  const m = s.match(/(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/);
  if (!m) return null;
  let [, a, b, c] = m;
  if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
  if (c.length === 2) c = '20' + c;
  return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
};

// ---------- entrada única ----------
export async function leerExtracto(fichero) {
  const bytes = new Uint8Array(await fichero.arrayBuffer());
  const firma = String.fromCharCode(...bytes.subarray(0, 8));
  if (firma.startsWith('%PDF')) return leerPDF(bytes);
  if (firma.startsWith('PK')) return leerXLSX(bytes);
  // BIFF: el Excel anterior a 2007 es un binario OLE que no se lee sin librería.
  if (/^\xd0\xcf\x11\xe0/.test(firma)) throw new Error('Excel antiguo (.xls): guárdalo como .xlsx o CSV');
  // Muchos bancos exportan el CSV en Windows-1252: el rombo de sustitución delata que no era UTF-8.
  let texto = new TextDecoder('utf-8').decode(bytes);
  if (texto.includes('\ufffd')) texto = new TextDecoder('windows-1252').decode(bytes);
  const p = parseCSV(texto);
  if (!p) throw new Error('CSV vacío o sin cabecera');
  return { ...p, origen: 'CSV', texto: '' };
}

// ---------- CSV ----------
export function parseCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim());
  if (lineas.length < 2) return null;
  const sep = [';', ',', '\t'].sort((a, b) => lineas[0].split(b).length - lineas[0].split(a).length)[0];
  const fila = l => {
    const out = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); return out.map(s => s.trim());
  };
  return conCabecera(lineas.map(fila));
}

// Los extractos traen preámbulo (titular, IBAN, fechas del periodo) antes de la tabla: la cabecera
// es la primera fila con varias columnas seguida de una fila que ya tiene fecha e importe.
function conCabecera(filas) {
  filas = filas.filter(f => f.some(c => String(c ?? '').trim()));
  if (!filas.length) return null;
  const datos = f => f.some(c => fechaNorm(c)) && f.some(c => num(c) != null);
  let i = filas.findIndex((f, k) => f.filter(c => String(c ?? '').trim()).length >= 3 && filas[k + 1] && datos(filas[k + 1]));
  if (i < 0) i = 0;
  const ancho = Math.max(...filas.slice(i).map(f => f.length));
  const norm = f => Array.from({ length: ancho }, (_, k) => String(f[k] ?? '').trim());
  return { cab: norm(filas[i]), filas: filas.slice(i + 1).map(norm) };
}

// ---------- ZIP mínimo (lo justo para un .xlsx) ----------
async function inflar(trozo, formato) {
  if (!formato) return trozo;
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no descomprime ficheros: usa CSV');
  const lector = new Blob([trozo]).stream().pipeThrough(new DecompressionStream(formato)).getReader();
  const partes = []; let total = 0;
  // Un flujo de PDF suele llevar el salto de línea de «endstream» pegado detrás, y eso hace que
  // DecompressionStream aborte al final. Lo ya descomprimido vale, así que se conserva.
  try { for (let r; !(r = await lector.read()).done;) { partes.push(r.value); total += r.value.length; } }
  catch (e) { if (!total) throw e; }
  const out = new Uint8Array(total); let i = 0;
  for (const t of partes) { out.set(t, i); i += t.length; }
  return out;
}
function abrirZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fin = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 66000; i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('El fichero no es un .xlsx válido');
  const n = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  const ent = new Map(), td = new TextDecoder();
  for (let i = 0; i < n; i++) {
    if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true), comp = dv.getUint32(p + 20, true);
    const ln = dv.getUint16(p + 28, true), le = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true);
    ent.set(td.decode(bytes.subarray(p + 46, p + 46 + ln)), { metodo, comp, off: dv.getUint32(p + 42, true) });
    p += 46 + ln + le + lc;
  }
  return { dv, bytes, ent };
}
async function sacar(zip, nombre) {
  const e = zip.ent.get(nombre);
  if (!e) return null;
  const ln = zip.dv.getUint16(e.off + 26, true), le = zip.dv.getUint16(e.off + 28, true);
  const ini = e.off + 30 + ln + le;
  return new TextDecoder().decode(await inflar(zip.bytes.subarray(ini, ini + e.comp), e.metodo === 8 ? 'deflate-raw' : null));
}

// ---------- Excel (.xlsx) ----------
const xml = t => new DOMParser().parseFromString(t, 'application/xml');
const columna = ref => { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };
async function leerXLSX(bytes) {
  const zip = abrirZip(bytes);
  const hojas = [...zip.ent.keys()].filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (!hojas.length) throw new Error('El Excel no trae ninguna hoja legible');
  const ss = await sacar(zip, 'xl/sharedStrings.xml');
  const cadenas = ss ? [...xml(ss).getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
  const doc = xml(await sacar(zip, hojas[0]));
  const filas = [];
  for (const row of doc.getElementsByTagName('row')) {
    const out = [];
    for (const c of row.getElementsByTagName('c')) {
      const t = c.getAttribute('t');
      let v = '';
      if (t === 'inlineStr') v = c.getElementsByTagName('t')[0]?.textContent || '';
      else { v = c.getElementsByTagName('v')[0]?.textContent || ''; if (t === 's') v = cadenas[Number(v)] ?? ''; }
      const i = columna(c.getAttribute('r'));
      if (i >= 0) out[i] = v; else out.push(v);
    }
    filas.push(Array.from({ length: out.length }, (_, i) => String(out[i] ?? '').trim()));
  }
  const p = conCabecera(filas);
  if (!p) throw new Error('La hoja está vacía');
  return { ...p, origen: 'Excel', texto: '' };
}

// ---------- PDF ----------
// Un PDF no tiene tabla: tiene texto colocado. Se infla cada flujo, se reconstruyen las líneas por
// saltos de posición y se reconoce la fila por «fecha … importe», que es como imprime todo banco.
const RE_FECHA = /(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}-\d{2}-\d{2})/;
const RE_IMPORTE = /-?\d{1,3}(?:\.\d{3})*,\d{2}\s?-?(?:€|EUR)?|-?\d+\.\d{2}(?!\d)/g;
function cadenaPDF(t) {
  if (t[0] === '<') {
    const hx = t.slice(1, -1).replace(/\s/g, '');
    const b = []; for (let i = 0; i + 1 < hx.length; i += 2) b.push(parseInt(hx.substr(i, 2), 16));
    // Identity-H (fuentes incrustadas) codifica en UTF-16BE: se delata por los bytes altos a cero.
    if (b.length > 1 && b.filter((v, i) => i % 2 === 0 && v === 0).length > b.length / 4) return b.filter((_, i) => i % 2).map(c => String.fromCharCode(c)).join('');
    return b.map(c => String.fromCharCode(c)).join('');
  }
  return t.slice(1, -1).replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[c] ?? (/^[0-7]+$/.test(c) ? String.fromCharCode(parseInt(c, 8)) : c)));
}
function lineasDeContenido(cs) {
  const out = []; let linea = '', y = null, pila = [];
  const cerrar = () => { const t = linea.replace(/\s+/g, ' ').trim(); if (t) out.push(t); linea = ''; };
  const tok = /\((?:\\[\s\S]|[^\\()])*\)|<[0-9A-Fa-f\s]+>|[-+]?[\d.]+|[A-Za-z'"*]+/g;
  let m;
  while ((m = tok.exec(cs))) {
    const t = m[0];
    if (t[0] === '(' || t[0] === '<') { pila.push(cadenaPDF(t)); continue; }
    if (/^[-+]?[\d.]+$/.test(t)) { pila.push(Number(t)); continue; }
    if (t === 'TJ') linea += pila.map(v => typeof v === 'string' ? v : (v < -120 ? ' ' : '')).join('');
    else if (t === 'Tj') linea += pila.filter(v => typeof v === 'string').join('');
    else if (t === "'" || t === '"') { cerrar(); linea += pila.filter(v => typeof v === 'string').join(''); }
    else if (t === 'Td' || t === 'TD') { if (pila.length >= 2 && pila[pila.length - 1] !== 0) cerrar(); }
    else if (t === 'Tm') { const ny = pila[pila.length - 1]; if (y !== null && typeof ny === 'number' && Math.abs(ny - y) > 1.5) cerrar(); y = ny; }
    else if (t === 'T*' || t === 'BT' || t === 'ET') cerrar();
    pila = [];
  }
  cerrar();
  return out;
}
export async function textoPDF(bytes) {
  const crudo = new TextDecoder('latin1').decode(bytes);
  const lineas = [];
  const re = /stream\r?\n?/g;
  let m;
  while ((m = re.exec(crudo))) {
    const ini = m.index + m[0].length;
    const fin = crudo.indexOf('endstream', ini);
    if (fin < 0) break;
    let corte = fin;
    while (corte > ini && (bytes[corte - 1] === 10 || bytes[corte - 1] === 13)) corte--;
    const trozo = bytes.subarray(ini, corte);
    for (const formato of ['deflate', 'deflate-raw', null]) {
      let txt;
      try { txt = new TextDecoder('latin1').decode(await inflar(trozo, formato)); } catch { continue; }
      if (!/\bT[Jj]\b/.test(txt)) continue;
      lineas.push(...lineasDeContenido(txt));
      break;
    }
    re.lastIndex = fin;
  }
  return lineas;
}
async function leerPDF(bytes) {
  const lineas = await textoPDF(bytes);
  const limpia = l => l.replace(new RegExp(RE_FECHA.source, 'g'), ' ').replace(RE_IMPORTE, ' ').replace(/\s+/g, ' ').trim();
  const filas = [];
  for (const l of lineas) {
    const imp = (l.match(RE_IMPORTE) || []).map(x => x.trim());
    const f = fechaNorm((l.match(RE_FECHA) || [])[0]);
    const ult = filas[filas.length - 1];
    if (f) filas.push([f, limpia(l), ...imp]);
    else if (!ult || l.length < 3) continue;
    // El concepto y el importe caen a menudo en líneas distintas: se cosen a la fila abierta.
    else if (imp.length && ult.length === 2) { ult[1] = (ult[1] + ' ' + limpia(l)).trim(); ult.push(...imp); }
    else if (!imp.length && ult[1].length < 120) ult[1] = (ult[1] + ' ' + l).trim();
  }
  const utiles = filas.filter(f => f.length > 2);
  const ancho = Math.max(3, ...utiles.map(f => f.length));
  const cab = ['Fecha', 'Descripción', ...Array.from({ length: ancho - 2 }, (_, i) => 'Importe' + (i ? ' ' + (i + 1) : ''))];
  return { cab, filas: utiles.map(f => Array.from({ length: ancho }, (_, i) => f[i] ?? '')), origen: 'PDF', texto: lineas.join('\n') };
}
