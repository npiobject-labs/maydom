// Cálculos y clasificación de Finanzas, aparte de la pantalla: los usan las tres pestañas
// (movimientos, importar, informes) y también reglas.js y menu.js desde fuera de la sección.
import { estado, mesISO } from '../../nucleo.js';
import { CONCEPTOS_NEUTROS } from '../../datos/semillas.js';

export function balanceMes(mes) {
  const ms = estado.movimientos.filter(m => mesISO(m.fecha) === mes);
  const ing = ms.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0), gas = ms.filter(m => m.importe < 0).reduce((s, m) => s - m.importe, 0);
  const por = {};
  for (const m of ms) if (m.importe < 0) por[m.concepto] = (por[m.concepto] || 0) - m.importe;
  return { ing, gas, neto: ing - gas, por, n: ms.length };
}

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

// Los años con algún movimiento, del más reciente al más antiguo.
export const aniosConDatos = () => [...new Set(estado.movimientos.map(m => String(m.fecha).slice(0, 4)))].sort().reverse();

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
export const sinTildes = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
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
// Cuántos movimientos cambiarían de concepto si se volviesen a pasar por las reglas de hoy.
export const porReclasificar = () => estado.movimientos.filter(x => !x.conceptoManual && adivinar(x.descripcion, x.importe) !== x.concepto);
