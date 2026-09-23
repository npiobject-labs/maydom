// Formato único de la ficha de un plato, sacado de «Sopas de ajo castellana»: cuatro apartados con
// su encabezado en una línea, los ingredientes uno por línea (coma al final, punto en el último) y
// una raya entre apartados. Sin dependencias: lo usan la migración de nucleo.js y Alimentación.
export const RAYA = '____________________________';
const APARTADOS = [
  ['ingredientes', 'Ingredientes', /^ingredientes/i],
  ['preparacion', 'Preparación', /^preparaci[oó]n/i],
  ['racion', 'Por ración', /^(por raci[oó]n|nutrientes|valores)/i],
  ['nota', 'Nota', /^notas?$/i],
];
const CABECERA = /^\s*(ingredientes|preparaci[oó]n|por raci[oó]n|nutrientes|valores nutricionales|notas?)\s*:\s*/i;

// Parte por comas fuera de paréntesis, sin romper decimales («1,5 l»), y por saltos de línea.
export function trocear(texto) {
  const out = []; let hondo = 0, cur = '';
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '(') hondo++; else if (c === ')') hondo = Math.max(0, hondo - 1);
    const corta = c === '\n' || c === ';' || (c === ',' && !hondo && !/\d/.test(texto[i + 1] || ''));
    if (corta) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim().replace(/^[-•*·]\s*/, '').replace(/[.,;]+$/, '').trim()).filter(Boolean);
}
export const frases = t => t.split(/(?<=[.!?])\s+(?=[¡¿A-ZÁÉÍÓÚÑ0-9])/).map(s => s.trim()).filter(Boolean);
// Un párrafo largo se parte en dos, como en la ficha modelo (tres frases y dos).
function parrafos(v) {
  let ps = (Array.isArray(v) ? v.map(String) : String(v || '').split(/\n\s*\n/)).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (ps.length === 1) { const fs = frases(ps[0]); if (fs.length >= 4) { const k = Math.ceil(fs.length / 2); ps = [fs.slice(0, k).join(' '), fs.slice(k).join(' ')]; } }
  return ps;
}
const conPunto = s => s && !/[.!?…]$/.test(s) ? s + '.' : s;

// {ingredientes: [..] | texto, preparacion: [..] | texto, racion, nota} → texto de la ficha.
export function componerFicha({ ingredientes, preparacion, racion, nota } = {}) {
  const ing = (Array.isArray(ingredientes) ? ingredientes.flatMap(x => trocear(String(x))) : trocear(String(ingredientes || '')));
  const bloques = [];
  if (ing.length) bloques.push('Ingredientes:\n' + ing.map((x, i) => x + (i < ing.length - 1 ? ',' : '.')).join('\n'));
  const pre = parrafos(preparacion);
  if (pre.length) bloques.push('Preparación:\n' + pre.join('\n\n'));
  const rac = String(racion || '').replace(/\s+/g, ' ').trim();
  if (rac) bloques.push('Por ración:\n' + conPunto(rac));
  const no = String(nota || '').replace(/\s+/g, ' ').trim();
  if (no) bloques.push('Nota:\n' + no);
  return bloques.join(`\n\n${RAYA}\n\n`);
}

// Texto con los apartados reconocibles → {ingredientes, preparacion, racion, nota}; si no los
// reconoce (texto libre, o algo antes del primer encabezado), null: ese texto no se toca.
export function leerFicha(texto) {
  const lineas = String(texto || '').replace(/\r/g, '').split('\n').filter(l => !/^\s*[_\-=—]{5,}\s*$/.test(l));
  const partes = {}; let actual = null;
  for (const l of lineas) {
    const m = l.match(CABECERA);
    if (m) {
      const ap = APARTADOS.find(([, , re]) => re.test(m[1].trim()));
      actual = ap[0]; partes[actual] = (partes[actual] ? partes[actual] + '\n' : '') + l.slice(m[0].length);
    } else if (actual) partes[actual] += '\n' + l;
    else if (l.trim()) return null;
  }
  if (!('ingredientes' in partes) || !('preparacion' in partes)) return null;
  return partes;
}

// Pone en el formato una ficha ya escrita. Devuelve el texto tal cual si no la reconoce.
export function formatearFicha(texto) {
  const p = leerFicha(texto);
  return p ? componerFicha(p) : texto;
}
