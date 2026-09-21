import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, mesISO, fechaCorta, euros, pedir, confirmar, toast, aviso, navegar } from '../nucleo.js';
import { CONCEPTOS } from '../datos/semillas.js';
import { consultar, conLLM, pedirJSON, textoAConsejos, lista as listaJSON } from '../llm.js';
import { leerExtracto, num, fechaNorm } from '../extracto.js';

const campos = [
  { n: 'fecha', l: 'Fecha', t: 'date', req: true }, { n: 'descripcion', l: 'Descripción', req: true },
  { n: 'importe', l: 'Importe (negativo = gasto)', t: 'number', step: 0.01, req: true }, { n: 'concepto', l: 'Concepto', t: 'select', o: CONCEPTOS },
];
const camposRec = [{ n: 'descripcion', l: 'Servicio', req: true }, { n: 'importe', l: 'Importe mensual (negativo = gasto)', t: 'number', step: 0.01, req: true }, { n: 'concepto', l: 'Concepto', t: 'select', o: CONCEPTOS, v: 'servicios web' }, { n: 'dia', l: 'Día del mes', t: 'number', v: 1, min: 1, max: 28 }];
export function balanceMes(mes) { const ms = estado.movimientos.filter(m => mesISO(m.fecha) === mes); const ing = ms.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0), gas = ms.filter(m => m.importe < 0).reduce((s, m) => s - m.importe, 0); const por = {}; for (const m of ms) if (m.importe < 0) por[m.concepto] = (por[m.concepto] || 0) - m.importe; return { ing, gas, neto: ing - gas, por, n: ms.length }; }
// Adivina concepto por la descripción del extracto.
function adivinar(desc) { const d = desc.toLowerCase(); const t = [[/mercadona|carrefour|dia |lidl|aldi|alcampo|veritas|super/, 'alimentación'], [/iherb|hsn|suplement/, 'suplementos'], [/openrouter|openai|anthropic|claude|gpt|llm/, 'IA / LLM'], [/fly\.io|hetzner|ovh|vercel|aws|digitalocean|github|hosting|dominio/, 'hosting'], [/netflix|spotify|google|apple|icloud|dropbox|notion|suscrip/, 'servicios web'], [/metro|renfe|uber|cabify|gasolina|repsol|bp /, 'transporte'], [/farmacia|clinica|médic|dentista/, 'salud'], [/alquiler|hipoteca|luz|agua|gas natural|endesa|iberdrola|comunidad/, 'vivienda'], [/nomina|nómina|transferencia recibida|ingreso/, 'ingresos'], [/cine|teatro|concierto|entrada|museo|bar |restaurante/, 'ocio']]; for (const [re, c] of t) if (re.test(d)) return c; return 'otros'; }
// Plan B del PDF: el texto suelto al mayordomo, que devuelve los movimientos en JSON.
async function interpretarLLM(texto) {
  toast('El mayordomo está leyendo el extracto…', 5000);
  try {
    const j = await pedirJSON({
      operacion: 'finanzas-extracto', contexto: false,
      tarea: `Este es el texto de un extracto bancario. Devuelve {"movimientos":[{"fecha":"AAAA-MM-DD","descripcion":"...","importe":-12.34}]} con un objeto por movimiento, importe negativo si es gasto y positivo si es ingreso, sin inventar ninguno. Texto:\n\n${texto.slice(0, 12000)}`,
    });
    let n = 0, dup = 0;
    for (const m of listaJSON(j, 'movimientos')) {
      const fecha = fechaNorm(m.fecha), importe = num(m.importe), descripcion = String(m.descripcion || '').trim();
      if (!fecha || importe == null) continue;
      if (estado.movimientos.some(x => x.fecha === fecha && x.descripcion === descripcion && x.importe === importe)) { dup++; continue; }
      estado.movimientos.push({ id: uid(), fecha, descripcion, importe, concepto: adivinar(descripcion) }); n++;
    }
    guardar(); toast(`${n} importados por el mayordomo · ${dup} duplicados`, 5000);
  } catch (e) { toast('LLM: ' + e.message, 6000); }
}

function render(cont, params) {
  const mes = params.mes || mesISO(hoyISO());
  const b = balanceMes(mes);
  const [y, m] = mes.split('-').map(Number); const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`, next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
  const movs = estado.movimientos.filter(x => mesISO(x.fecha) === mes).sort((a, c) => c.fecha.localeCompare(a.fecha));
  const recAplicadas = estado.recurrentes.filter(r => estado.movimientos.some(x => x.recurrenteId === r.id && mesISO(x.fecha) === mes)).length;
  cont.innerHTML = h`
    <div class="fila cab"><button class="btn" data-a="mes" data-m="${prev}">‹</button><div class="t centro"><b>${mes}</b></div><button class="btn" data-a="mes" data-m="${next}">›</button></div>
    <div class="tarjeta"><div class="grande ${b.neto >= 0 ? 'pos' : 'neg'}">${euros(b.neto)}</div><div class="mini">ingresos ${euros(b.ing)} · gastos ${euros(b.gas)} · ${b.n} movimientos</div>
      ${Object.keys(b.por).length ? crudo('<table class="tabla">' + Object.entries(b.por).sort((x, z) => z[1] - x[1]).map(([c, v]) => h`<tr><td>${c}</td><td class="n">${euros(v)}</td><td style="width:40%"><div class="barra"><i style="width:${Math.round(v / b.gas * 100)}%"></i></div></td></tr>`).join('') + '</table>') : ''}</div>
    <div class="acciones"><button class="btn p" data-a="nuevo">+ Movimiento</button><label class="btn">Importar extracto: CSV · Excel · PDF <input type="file" accept=".csv,.xlsx,.xls,.pdf,text/csv,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" data-c="extracto" hidden></label><button class="btn" data-a="aplicarRec">Aplicar recurrentes (${recAplicadas}/${estado.recurrentes.length})</button>${b.n ? crudo('<button class="btn" data-a="analizarLLM">Recomendaciones con LLM</button>') : ''}</div>
    <h3>Movimientos</h3>
    ${movs.length ? crudo('<table class="tabla">' + movs.slice(0, 60).map(x => h`<tr data-a="editar" data-id="${x.id}"><td class="mini">${fechaCorta(x.fecha)}</td><td>${x.descripcion}<div class="mini">${x.concepto}</div></td><td class="n ${x.importe >= 0 ? 'pos' : 'neg'}">${euros(x.importe)}</td></tr>`).join('') + '</table>') : aviso('Sin movimientos este mes. Importa el extracto del banco (CSV, Excel o PDF) o añade a mano.')}
    <h3>Recurrentes (servicios que consumo)</h3>
    ${estado.recurrentes.length ? lista(estado.recurrentes.map(r => h`<div class="tarjeta fila" data-a="editarRec" data-id="${r.id}"><div class="t"><b>${r.descripcion}</b><div class="mini">${r.concepto} · día ${r.dia}</div></div><b class="${r.importe >= 0 ? 'pos' : 'neg'}">${euros(r.importe)}/mes</b></div>`)) : aviso('Servidor, OpenRouter, dominios, suscripciones… Se aplican al mes con un botón.')}
    <div class="acciones"><button class="btn" data-a="nuevoRec">+ Recurrente</button></div>
    <p class="mini">El mayordomo hace recomendaciones a partir de esto; ejecutarlas queda para versiones futuras (D11). Importa el extracto en CSV, Excel o PDF; la conexión automática con el banco sigue siendo deuda D4.</p>`;
  delegar(cont, {
    mes: el => navegar('finanzas', { mes: el.dataset.m }),
    analizarLLM: el => conLLM(el, async () => {
      const bp = balanceMes(prev);
      const j = await consultar({ operacion: 'finanzas', tarea: `Analiza las finanzas de ${mes}: ingresos ${euros(b.ing)}, gastos ${euros(b.gas)}, por concepto ${Object.entries(b.por).map(([k, v]) => k + ' ' + euros(v)).join(', ')}; mes anterior gastos ${euros(bp.gas)} (${Object.entries(bp.por).map(([k, v]) => k + ' ' + euros(v)).join(', ') || 'sin datos'}); recurrentes: ${estado.recurrentes.map(r => r.descripcion + ' ' + euros(r.importe)).join(', ') || 'ninguno'}. Da 3 recomendaciones concretas y accionables, cada una en una línea que empiece por "- ". Solo recomendar, nunca ejecutar.` });
      toast(textoAConsejos(j.respuesta, 'finanzas') + ' recomendaciones en Consejos'); navegar('mayordomo');
    }),
    nuevo: async () => { const v = await pedir('Movimiento', campos, { fecha: hoyISO(), concepto: 'otros' }); if (v) { estado.movimientos.push({ id: uid(), ...v }); guardar(); } },
    editar: async el => { const x = estado.movimientos.find(z => z.id === el.dataset.id); const v = await pedir('Editar', campos, x, { extra: 'Borrar' }); if (!v) return; if (v.__extra) estado.movimientos = estado.movimientos.filter(z => z.id !== x.id); else Object.assign(x, v); guardar(); },
    nuevoRec: async () => { const v = await pedir('Recurrente', camposRec); if (v) { estado.recurrentes.push({ id: uid(), ...v }); guardar(); } },
    editarRec: async el => { const r = estado.recurrentes.find(z => z.id === el.dataset.id); const v = await pedir('Editar recurrente', camposRec, r, { extra: 'Borrar' }); if (!v) return; if (v.__extra) estado.recurrentes = estado.recurrentes.filter(z => z.id !== r.id); else Object.assign(r, v); guardar(); },
    aplicarRec: () => { let n = 0; for (const r of estado.recurrentes) { if (estado.movimientos.some(x => x.recurrenteId === r.id && mesISO(x.fecha) === mes)) continue; estado.movimientos.push({ id: uid(), fecha: `${mes}-${String(r.dia || 1).padStart(2, '0')}`, descripcion: r.descripcion, importe: r.importe, concepto: r.concepto, recurrenteId: r.id }); n++; } guardar(); toast(n + ' aplicados'); },
    extracto: async el => {
      const f = el.files[0]; if (!f) return; el.value = '';
      let p;
      try { p = await leerExtracto(f); } catch (e) { return toast('No se pudo leer: ' + e.message, 6000); }
      // Un PDF sin tabla reconocible (columnas raras, texto en imagen) todavía tiene arreglo: el
      // mayordomo lee el texto suelto. Se pregunta antes porque gasta crédito del gateway.
      if (!p.filas.length && p.texto && await confirmar(`De ese ${p.origen} no salen movimientos. ¿Que lo interprete el mayordomo? Consume LLM.`, 'Interpretar')) {
        return interpretarLLM(p.texto);
      }
      if (!p.filas.length) return toast(`De ese ${p.origen} no he sacado ningún movimiento`, 5000);
      const ops = p.cab.map((c, i) => ({ v: i, l: c || 'columna ' + (i + 1) }));
      const adiv = re => Math.max(0, p.cab.findIndex(c => re.test(c)));
      const m0 = p.filas[0];
      const v = await pedir('Columnas del extracto', [
        { n: 'f', l: 'Fecha', t: 'select', o: ops, v: adiv(/fecha|date/i) },
        { n: 'd', l: 'Descripción / concepto', t: 'select', o: ops, v: adiv(/concepto|descrip|detalle/i) },
        { n: 'i', l: 'Importe', t: 'select', o: ops, v: adiv(/importe|amount|cantidad/i) },
        { n: 'inv', l: 'Los gastos vienen en positivo (invertir el signo)', t: 'check' },
      ], {}, { texto: `${p.origen}: ${p.filas.length} filas. Primera: ${m0.filter(Boolean).slice(0, 4).join(' · ')}. Se saltan las duplicadas (misma fecha, descripción e importe).`, aceptar: 'Importar' });
      if (!v) return;
      let n = 0, dup = 0, mal = 0;
      for (const fila of p.filas) {
        const fecha = fechaNorm(fila[v.f]); let importe = num(fila[v.i]); const descripcion = fila[v.d] || '';
        if (!fecha || importe == null) { mal++; continue; }
        if (v.inv) importe = -importe;
        if (estado.movimientos.some(x => x.fecha === fecha && x.descripcion === descripcion && x.importe === importe)) { dup++; continue; }
        estado.movimientos.push({ id: uid(), fecha, descripcion, importe, concepto: adivinar(descripcion) }); n++;
      }
      guardar(); toast(`${n} importados · ${dup} duplicados · ${mal} ilegibles`, 5000);
    },

  });
}
export default { id: 'finanzas', titulo: 'Finanzas', grupo: 'Vida', icono: '€', render };
