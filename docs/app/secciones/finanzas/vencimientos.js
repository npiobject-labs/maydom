// Previsor de pagos fijos (ADR-012). Funciones puras, sin estado ni DOM (se prueban en node): buscan
// en los movimientos los cargos que se repiten con un ritmo fijo —luz, comunidad, gas, seguros,
// suscripciones— y calculan en qué día vence cada uno, mes a mes. Lo que el usuario decide sobre un
// pago detectado (nombre, «no es un pago fijo») vive en `estado.recurrentes` con su `clave`, junto a
// los recurrentes apuntados a mano, que entran en el calendario con su día.

const sinTildes = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pad = n => String(n).padStart(2, '0');
const fecha = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aDate = iso => new Date(iso + 'T12:00:00');
const dias = (a, b) => Math.round((aDate(b) - aDate(a)) / 86400000);
const sumarDias = (iso, n) => { const d = aDate(iso); d.setDate(d.getDate() + n); return fecha(d); };
const indiceMes = iso => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
const mesDeIndice = i => `${Math.floor(i / 12)}-${pad(i % 12 + 1)}`;
const finDeMes = mes => new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
const mediana = xs => { const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const redondo = n => Math.round(n * 100) / 100;

export const PERIODOS = { 1: 'mensual', 2: 'bimestral', 3: 'trimestral', 6: 'semestral', 12: 'anual' };
const MES = 30.44;

// ---------- agrupar ----------
// Lo que cambia de un mes a otro en la descripción de un mismo recibo son números (factura, periodo,
// referencia) y nombres de mes; lo que no cambia es el emisor. La clave son las cuatro primeras
// palabras que quedan al quitar eso y las palabras de trámite bancario: con más, un texto de
// observaciones que varíe partiría el grupo; con menos, dos pólizas del mismo emisor se juntarían
// (y eso lo deshace el reparto por importe de detectar()).
const MESES_TXT = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)\b/g;
const TRAMITE = new Set(['adeudo', 'adeudos', 'recibo', 'recibos', 'cargo', 'domiciliacion', 'domiciliado', 'domiciliada', 'factura', 'fra', 'periodo', 'mandato', 'ref', 'referencia', 'cuota', 'pago', 'compra', 'tarjeta', 'con', 'del', 'las', 'los', 'por', 'para', 'sau', 'slu', 'sociedad', 'anonima', 'cia', 'core', 'sepa', 'emisor', 'titular', 'concepto', 'enviado', 'enviada', 'realizada', 'realizado', 'transferencia', 'favor', 'num', 'numero', 'lectura', 'real', 'estimada']);
export function claveDe(desc) {
  const palabras = sinTildes(desc).replace(/\S*\d\S*/g, ' ').replace(MESES_TXT, ' ').replace(/[^a-z]+/g, ' ').split(' ')
    .filter(p => p.length > 2 && !TRAMITE.has(p));
  return palabras.slice(0, 4).join(' ');
}

// Nombre legible del pago: el trozo de la descripción que nombra al emisor, sin el trámite bancario
// («Adeudo recibo · IBERDROLA CLIENTES SAU · FACTURA 123» → «IBERDROLA CLIENTES SAU»).
const GENERICO = /^(adeudo|recibo|cargo|domiciliaci|compra|pago|transferencia|trans\.|traspaso|bizum|abono|operaci|movimiento|tarjeta)/;
export function nombreDe(desc) {
  const trozos = String(desc || '').split(' · ').map(t => t.trim()).filter(Boolean);
  const util = trozos.find(t => !(GENERICO.test(sinTildes(t)) && t.split(/\s+/).length <= 3) && /[a-z]{3}/i.test(t)) || trozos[0] || '';
  const limpio = util.replace(/\b(n[º°o]\.?|ref\.?|referencia|factura)\s*[\w/-]*\d[\w/-]*/gi, '').replace(/\s+\S*\d{4,}\S*/g, '').replace(/\s+/g, ' ').trim();
  return (limpio || util).slice(0, 48);
}

// ---------- ritmo ----------
// Un grupo de cargos tiene ritmo si los intervalos entre ellos son, casi todos, un múltiplo pequeño
// del periodo (un mes saltado es un extracto que falta, no otro ritmo) y la mitad o más son
// exactamente uno. Se prueba del periodo más corto al más largo, así que un bimestral no pasa por
// mensual con todos los saltos dobles. Mensual, bimestral y trimestral piden tres cargos; semestral
// y anual se conforman con dos, porque con un año de extractos no puede haber más.
function ritmo(cargos) {
  const fechas = cargos.map(c => c.fecha);
  const ints = fechas.slice(1).map((f, i) => dias(fechas[i], f));
  if (!ints.length) return null;
  for (const p of [1, 2, 3, 6, 12]) {
    if (cargos.length < (p <= 3 ? 3 : 2)) continue;
    const L = p * MES, tol = Math.max(7, L * 0.13);
    let uno = 0, multiplo = 0;
    for (const d of ints) {
      const k = Math.round(d / L);
      if (k >= 1 && k <= 3 && Math.abs(d - k * L) <= tol * k) { multiplo++; if (k === 1) uno++; }
    }
    if (multiplo / ints.length >= 0.8 && uno / ints.length >= 0.5) return p;
  }
  return null;
}

// Día del mes en que cae, con su margen. Un recibo que va y viene entre el 30 y el 2 se mide con los
// días altos como negativos (el 30 es el «-1» del mes siguiente) para que la mediana no salga el 16.
// Un recibo domiciliado que vence en fin de semana se cobra el lunes: si nunca se ha cobrado en
// sábado ni domingo, los lunes no cuentan para el día (salvo que no haya otra cosa).
function diaTipico(cargos, finSemana) {
  const recientes = cargos.slice(-6), sinLunes = recientes.filter(c => aDate(c.fecha).getDay() !== 1);
  const ds = (finSemana || !sinLunes.length ? recientes : sinLunes).map(c => Number(c.fecha.slice(8, 10)));
  let xs = ds;
  if (Math.max(...ds) - Math.min(...ds) > 15) xs = ds.map(d => (d >= 20 ? d - 31 : d));
  const med = Math.round(mediana(xs));
  return { dia: med <= 0 ? 31 + med : med, desde: Math.min(...xs), hasta: Math.max(...xs), margen: Math.max(...xs) - Math.min(...xs) };
}

// Parte un grupo por importe cuando hay dos pagos distintos del mismo emisor (el seguro de casa y el
// del coche, dos suscripciones del mismo proveedor): huecos de más del 35 % entre importes ordenados.
function porImporte(cargos) {
  const orden = cargos.slice().sort((a, b) => a.importe - b.importe);
  const trozos = [[orden[0]]];
  for (let i = 1; i < orden.length; i++) {
    const a = Math.abs(orden[i - 1].importe), b = Math.abs(orden[i].importe);
    if (Math.abs(b - a) / Math.max(a, b, 1) > 0.35) trozos.push([]);
    trozos.at(-1).push(orden[i]);
  }
  return trozos.map(t => t.sort((a, b) => a.fecha.localeCompare(b.fecha)));
}

// Cuenta y fecha del último extracto de cada cuenta: lo que dice si un recibo que no ha llegado
// falta de verdad o es que aún no se ha importado ese mes.
function ultimasFechas(movs) {
  const u = { '': '' };
  for (const m of movs) { const k = m.cuenta || ''; if (!u[k] || m.fecha > u[k]) u[k] = m.fecha; if (m.fecha > u['']) u[''] = m.fecha; }
  return u;
}

// ---------- detectar ----------
// Devuelve los pagos fijos que salen de los movimientos: {clave, nombre, periodo, dia, desde, hasta,
// margen, importe (estimado, positivo), minimo, maximo, cuenta, concepto, cargos, primero, ultimo,
// datosHasta, finSemana, activo}. Solo cuentan los cargos (importe negativo) que no sean efectivo.
export function detectar(movs) {
  const grupos = new Map();
  for (const m of movs) {
    // Ni el cajero ni los traspasos entre cuentas propias son un pago: el dinero no sale de casa. Los
    // Bizum tampoco (preferencia del 05-oct): son pagos entre personas, no recibos, aunque se repitan.
    if (!(m.importe < 0) || m.concepto === 'efectivo' || !m.fecha || /traspaso|bizum/.test(sinTildes(m.descripcion))) continue;
    const k = claveDe(m.descripcion);
    if (!k) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(m);
  }
  const ult = ultimasFechas(movs), out = [];
  for (const [k, ms] of grupos) {
    if (ms.length < 2) continue;
    // Dos cargos del mismo emisor con menos de una semana entre ellos son un recibo devuelto y
    // vuelto a pasar, o un cargo partido: cuentan como uno, el último.
    const orden = ms.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    // La ventana cuenta desde el primero del racimo, no desde el último: si no, las compras de cada
    // tres días en el mismo súper se encadenarían en un solo cargo.
    const unicos = [];
    let ancla = null;
    for (const m of orden) {
      const prev = unicos.at(-1);
      if (prev && dias(ancla, m.fecha) < 7 && Math.abs(Math.abs(prev.importe) - Math.abs(m.importe)) / Math.max(Math.abs(m.importe), 1) < 0.35) unicos[unicos.length - 1] = m;
      else { unicos.push(m); ancla = m.fecha; }
    }
    // Dos pagos del mismo emisor que conviven en el tiempo (el seguro de casa y el del coche) se
    // separan por importe aunque juntos parezcan tener ritmo —junio, marzo y junio pasan por
    // trimestral—, y de cada importe queda el que lo tenga; si uno empieza cuando el otro acaba, es
    // el mismo pago que subió de precio y va entero. Un cargo suelto muy distinto (una
    // regularización) también convive: sale del grupo y el resto sigue siendo el pago.
    const trozos = porImporte(unicos);
    const conviven = trozos.length > 1 && trozos.some((a, i) => trozos.some((b, j) => i !== j && a[0].fecha <= b.at(-1).fecha && b[0].fecha <= a.at(-1).fecha));
    const partes = conviven || !ritmo(unicos)
      ? trozos.filter(t => ritmo(t)).map(t => ({ clave: `${k}|${Math.round(mediana(t.map(c => -c.importe)))}`, cargos: t }))
      : [{ clave: k, cargos: unicos }];
    for (const { clave, cargos } of partes) {
      const periodo = ritmo(cargos);
      if (!periodo) continue;
      // Con solo dos cargos (semestral o anual), dos compras sueltas en la misma tienda podrían
      // parecer un ritmo: se pide además que cuesten casi lo mismo, como un seguro o un impuesto.
      if (cargos.length === 2 && Math.abs(cargos[0].importe - cargos[1].importe) / Math.max(Math.abs(cargos[1].importe), 1) > 0.15) continue;
      // Si alguna vez se cobró en sábado o domingo (una suscripción con tarjeta), no se mueve al lunes.
      const finSemana = cargos.some(c => [0, 6].includes(aDate(c.fecha).getDay()));
      const d = diaTipico(cargos, finSemana);
      // Un recibo mensual que se pasa del día 5 al 18 según el mes no es un vencimiento previsible.
      if (periodo === 1 && d.margen > 10) continue;
      const ultimo = cargos.at(-1), recientes = cargos.slice(-3).map(c => -c.importe), todos = cargos.slice(-12).map(c => -c.importe);
      const cuenta = ultimo.cuenta || '', datosHasta = ult[cuenta] || ult[''];
      out.push({
        clave, nombre: nombreDe(ultimo.descripcion), periodo, ...d,
        importe: redondo(mediana(recientes)), minimo: redondo(Math.min(...todos)), maximo: redondo(Math.max(...todos)),
        cuenta, concepto: ultimo.concepto || 'otros', cargos: cargos.map(c => ({ id: c.id, fecha: c.fecha, importe: c.importe })),
        primero: cargos[0].fecha, ultimo: ultimo.fecha, datosHasta,
        finSemana,
        // Ha dejado de cobrarse si tras el último cargo han pasado periodo y medio (y tres semanas) sin otro.
        activo: dias(ultimo.fecha, datosHasta) <= periodo * MES * 1.5 + 20,
      });
    }
  }
  return out.sort((a, b) => a.dia - b.dia || a.nombre.localeCompare(b.nombre));
}

// ---------- pagos fijos: lo detectado + lo apuntado a mano ----------
// Une la detección con `recurrentes`: un recurrente con `clave` pone nombre a un pago detectado o lo
// descarta; uno sin clave es un pago apuntado a mano (mensual en su `dia`, o cada `periodo` meses a
// partir de `mes`). Si el nombre de uno a mano está en la clave de uno detectado, son el mismo y
// manda el detectado (con el nombre de mano), para no contarlo dos veces.
export function pagosFijos(movs, recurrentes = []) {
  const detectados = detectar(movs);
  const porClave = new Map(recurrentes.filter(r => r.clave).map(r => [r.clave, r]));
  const manuales = recurrentes.filter(r => !r.clave);
  const activos = [], terminados = [], descartados = [];
  const usados = new Set();
  // Mismo pago si todas las palabras del nombre puesto a mano están en la clave detectada («Netflix»
  // en «netflix com»), palabra a palabra: «gas» no es «gasolinera».
  const mismo = (clave, desc) => { const ps = claveDe(desc).split(' ').filter(Boolean), ks = clave.split(/[ |]/); return ps.length > 0 && ps.every(p => ks.includes(p)); };
  for (const d of detectados) {
    const r = porClave.get(d.clave);
    const gemelo = manuales.find(m => !usados.has(m.id) && mismo(d.clave, m.descripcion));
    if (gemelo) usados.add(gemelo.id);
    const p = { ...d, id: r?.id || null, origen: 'detectado', nombre: r?.descripcion || gemelo?.descripcion || d.nombre, manualId: gemelo?.id || null, aviso: r?.aviso ?? gemelo?.aviso ?? '' };
    if (r?.descartado) descartados.push(p); else if (d.activo) activos.push(p); else terminados.push(p);
  }
  for (const m of manuales) {
    if (usados.has(m.id)) continue;
    const periodo = Number(m.periodo) || 1, dia = Math.min(31, Math.max(1, Number(m.dia) || 1));
    // Los meses en que se aplicó con «Aplicar recurrentes» cuentan como cobrados.
    const cargos = movs.filter(x => x.recurrenteId === m.id).map(x => ({ id: x.id, fecha: x.fecha, importe: x.importe }));
    activos.push({
      clave: null, id: m.id, origen: 'manual', nombre: m.descripcion, periodo, dia, desde: dia, hasta: dia, margen: 0,
      importe: Math.abs(Number(m.importe) || 0), minimo: null, maximo: null, cuenta: m.cuenta || '', concepto: m.concepto || 'otros',
      mesInicial: Number(m.mes) || 1, ingreso: Number(m.importe) > 0, cargos, finSemana: true, activo: true, aviso: m.aviso ?? '',
    });
  }
  const orden = (a, b) => a.dia - b.dia || a.nombre.localeCompare(b.nombre);
  return { activos: activos.sort(orden), terminados: terminados.sort(orden), descartados: descartados.sort(orden) };
}

// Coste medio al mes de un pago, sea cual sea su periodo.
export const alMes = p => p.importe / p.periodo;

// ¿Toca este pago en el mes? Mensual, siempre; los demás, contando periodos desde su último cargo
// (o desde el mes que se apuntó a mano).
function tocaEnMes(p, mes) {
  if (p.periodo === 1) return true;
  const ancla = p.ultimo ? indiceMes(p.ultimo) : Number(mes.slice(0, 4)) * 12 + (p.mesInicial || 1) - 1;
  return ((indiceMes(mes) - ancla) % p.periodo + p.periodo) % p.periodo === 0;
}

// Fecha prevista en un mes: su día (el último del mes si el mes es más corto) y, si nunca se ha
// cobrado en fin de semana, el lunes siguiente, que es cuando el banco pasa un recibo domiciliado.
export function fechaPrevista(p, mes) {
  const f = `${mes}-${pad(Math.min(p.dia, finDeMes(mes)))}`;
  if (p.finSemana) return f;
  const dw = aDate(f).getDay();
  return dw === 6 ? sumarDias(f, 2) : dw === 0 ? sumarDias(f, 1) : f;
}

// Calendario de vencimientos: `meses` meses desde `desde` (AAAA-MM). Cada mes trae sus filas
// {pago, fecha, importe, estado}: «cobrado» (con el cargo real), «previsto», o «sin cargo» si la
// fecha ya está cubierta por los extractos y el cargo no aparece.
export function calendario(pagos, desde, meses = 12) {
  const out = [];
  const i0 = indiceMes(desde + '-01');
  for (let i = i0; i < i0 + meses; i++) {
    const mes = mesDeIndice(i), filas = [];
    for (const p of pagos) {
      const reales = (p.cargos || []).filter(c => c.fecha.slice(0, 7) === mes);
      if (reales.length) { for (const c of reales) filas.push({ pago: p, fecha: c.fecha, importe: -c.importe, estado: 'cobrado' }); continue; }
      if (!tocaEnMes(p, mes)) continue;
      // Antes del primer cargo conocido no se inventa nada hacia atrás.
      if (p.primero && mes < p.primero.slice(0, 7)) continue;
      const f = fechaPrevista(p, mes);
      const cubierto = p.origen === 'detectado' && p.datosHasta && f <= p.datosHasta;
      // Un recibo de este mes que en los extractos aún no ha llegado, pero cuyo margen no ha pasado, sigue previsto.
      const sinCargo = cubierto && sumarDias(f, Math.max(3, p.margen)) <= p.datosHasta;
      filas.push({ pago: p, fecha: f, importe: p.importe, estado: sinCargo ? 'sin cargo' : 'previsto' });
    }
    filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.pago.nombre.localeCompare(b.pago.nombre));
    const total = filas.filter(f => f.estado !== 'sin cargo' && !f.pago.ingreso).reduce((s, f) => s + f.importe, 0);
    out.push({ mes, filas, total: redondo(total) });
  }
  return out;
}

// Los próximos vencimientos desde `hoy` (incluido) en los `dias` siguientes, ya ordenados. Es lo que
// leerán los avisos al móvil: «mañana se cobra…».
export function proximos(pagos, hoy, n = 30) {
  const hasta = sumarDias(hoy, n), meses = indiceMes(hasta) - indiceMes(hoy) + 1;
  return calendario(pagos, hoy.slice(0, 7), meses).flatMap(m => m.filas)
    .filter(f => f.estado === 'previsto' && f.fecha >= hoy && f.fecha <= hasta)
    .map(f => ({ ...f, dentro: dias(hoy, f.fecha) }));
}

// ---------- agenda de avisos (ADR-012, opción A) ----------
// Lo que el service worker necesita para avisar sin la clave: por cada cobro previsto en los
// próximos `dias`, su nombre, la fecha, el día de avisar (la antelación general o la del pago; un
// pago con `aviso: 'no'` no entra) y, si se quiere, el importe y la cuenta. Es lo único de Finanzas
// que queda sin cifrar, y solo mientras los avisos estén puestos.
export function agendaAvisos(pagos, hoy, { antelacion = 1, importe = true } = {}, dias = 60, nombreCuenta = () => '') {
  return proximos(pagos.filter(p => !p.ingreso && p.aviso !== 'no'), hoy, dias).map(f => {
    const ant = f.pago.aviso === '' || f.pago.aviso == null ? Number(antelacion) || 0 : Number(f.pago.aviso);
    return {
      id: `${f.pago.clave || f.pago.id}|${f.fecha}`, nombre: f.pago.nombre, fecha: f.fecha, avisar: sumarDias(f.fecha, -ant),
      ...(importe ? { importe: f.importe, aprox: f.pago.origen === 'detectado', cuenta: f.pago.cuenta ? nombreCuenta(f.pago.cuenta) : '' } : {}),
    };
  });
}
