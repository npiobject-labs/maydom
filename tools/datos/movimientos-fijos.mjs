// Movimientos inventados para probar el previsor de pagos fijos (ADR-012): año y medio de extractos
// de tres cuentas con recibos de ritmos distintos y ruido alrededor. Nada es real.
// generar(hasta) devuelve los movimientos hasta esa fecha (AAAA-MM-DD), empezando 19 meses antes.
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Un recibo domiciliado que cae en fin de semana se pasa el lunes.
const habil = d => { const w = d.getDay(); if (w === 6) d.setDate(d.getDate() + 2); else if (w === 0) d.setDate(d.getDate() + 1); return d; };
export function generar(hasta) {
  const fin = new Date(hasta + 'T12:00:00');
  const ini = new Date(fin.getFullYear(), fin.getMonth() - 18, 1, 12);
  const out = [];
  let n = 0, semilla = 7;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const mov = (d, descripcion, importe, cuenta, concepto) => { const f = iso(d); if (f <= hasta && d >= ini) out.push({ id: 'g' + (n++), fecha: f, descripcion, importe: Math.round(importe * 100) / 100, cuenta, concepto }); };
  for (let i = 0; i <= 19; i++) {
    const y = ini.getFullYear(), m = ini.getMonth() + i;
    const dia = d => new Date(y, m, d, 12);
    // Luz: mensual, día 5 hábil, importe que varía con la estación.
    mov(habil(dia(5)), `Adeudo recibo · IBERDROLA CLIENTES SAU · FACTURA ${y}${pad(m % 12 + 1)} Nº ${100000 + i}`, -(45 + 40 * azar()), 'fijos', 'suministros');
    // Comunidad: mensual, día 1 hábil, fija.
    mov(habil(dia(1)), 'Adeudo comunidad · COMUNIDAD PROPIETARIOS CALLE INVENTADA', -60, 'fijos', 'suministros');
    // Gas: bimestral (meses pares), día 12 hábil.
    if ((m % 12) % 2 === 1) mov(habil(dia(12)), `Adeudo recibo · NATURGY IBERIA SA · Periodo ${pad(m % 12)}/${y}`, -(55 + 30 * azar()), 'fijos', 'suministros');
    // Netflix con tarjeta: día 15 aunque sea domingo.
    mov(dia(15), 'Compra tarjeta · NETFLIX.COM', -12.99, 'variables', 'servicios web');
    // Dos suscripciones del mismo proveedor, mismo texto: se separan por importe.
    mov(dia(3), 'Compra tarjeta · GOOGLE PAYMENT IE', -1.99, 'variables', 'servicios web');
    mov(dia(20), 'Compra tarjeta · GOOGLE PAYMENT IE', -11.99, 'variables', 'servicios web');
    // Gimnasio: mensual el 2, dado de baja cinco meses antes del final.
    if (i < 13) mov(habil(dia(2)), 'Adeudo recibo · GIMNASIO BARRIO SL', -35, 'variables', 'ocio');
    // Seguros anuales del mismo emisor: casa en marzo y coche en junio.
    if (m % 12 === 2) mov(habil(dia(20)), 'Adeudo recibo · MAPFRE ESPANA · POLIZA 1234', -310, 'fijos', 'seguros');
    if (m % 12 === 5) mov(habil(dia(10)), 'Adeudo recibo · MAPFRE ESPANA · POLIZA 5678', -520, 'fijos', 'seguros');
    // Ruido: súper cada 3 o 4 días, cafés, nómina, traspasos y un cajero.
    for (let d = 1; d <= 28; d += 3 + Math.round(azar())) mov(dia(d), 'Compra tarjeta · MERCADONA BARRIO', -(30 + 50 * azar()), 'variables', 'alimentación');
    for (let k = 0; k < 4; k++) mov(dia(1 + Math.floor(azar() * 27)), 'Compra tarjeta · CAFETERIA ESQUINA', -(1.5 + 2 * azar()), 'variables', 'restauración');
    mov(dia(27), 'Abono · NOMINA EMPRESA', 1800, 'variables', 'ingresos');
    mov(dia(28), 'Traspaso · A CUENTA AHORRO', -300 - Math.round(azar() * 3) * 100, 'variables', 'transferencias');
    mov(dia(1 + Math.floor(azar() * 27)), 'Ret. efectivo · CAJERO', -50, 'variables', 'efectivo');
  }
  return out;
}
