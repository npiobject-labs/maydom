// Markdown mínimo propio (títulos, listas, negrita, cursiva y código): la PWA funciona sin red y no
// carga librerías de CDN. Es el mismo intérprete que pinta los informes de `prueba`.
import { esc } from './nucleo.js';

const linea = t => esc(t)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,:;!?]|$)/g, '$1<em>$2</em>');

export function markdown(texto) {
  const out = []; let lista = null;
  const cerrar = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
  for (const l of String(texto || '').split('\n')) {
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { cerrar(); out.push(`<h${m[1].length}>${linea(m[2])}</h${m[1].length}>`); }
    else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (lista !== 'ul') { cerrar(); out.push('<ul>'); lista = 'ul'; } out.push(`<li>${linea(m[1])}</li>`); }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (lista !== 'ol') { cerrar(); out.push('<ol>'); lista = 'ol'; } out.push(`<li>${linea(m[1])}</li>`); }
    else if (!l.trim()) cerrar();
    else { cerrar(); out.push(`<p>${linea(l)}</p>`); }
  }
  cerrar();
  return out.join('');
}
