// Avisos de pagos fijos al móvil (ADR-012, opción A). Script clásico, sin import ni export: lo carga
// el service worker con importScripts —que lo despierta el navegador con `periodicsync` aunque la app
// esté cerrada— y la página con un import, y deja sus funciones en globalThis.maydomAvisos.
// Ninguno de los dos tiene la clave de Finanzas: leen la agenda que Finanzas deja en Cache Storage
// (`maydom-avisos`, agenda.json) cada vez que se abre, con lo que vence en los próximos 60 días.
(function (g) {
  const CACHE = 'maydom-avisos';
  const pad = n => String(n).padStart(2, '0');
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const fechaLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const horaLocal = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const aDate = iso => new Date(iso + 'T12:00:00');
  const diasEntre = (a, b) => Math.round((aDate(b) - aDate(a)) / 86400000);
  const sumarDias = (iso, n) => { const d = aDate(iso); d.setDate(d.getDate() + n); return fechaLocal(d); };
  const fechaLarga = iso => { const d = aDate(iso); return `${DIAS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const euros = n => (Math.round(n * 100) / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  const cuando = n => (n <= 0 ? 'Hoy' : n === 1 ? 'Mañana' : n === 2 ? 'Pasado mañana' : `En ${n} días`);
  const cifra = x => (x.importe == null ? '' : (x.aprox ? '≈ ' : '') + euros(x.importe));

  // Qué toca avisar ya: ha llegado el día de avisar (y, si es ese mismo día, la hora elegida), el
  // pago aún no ha pasado y no se ha avisado antes. Si el navegador despierta la app tarde —puede
  // tardar horas—, el aviso sale en cuanto despierta, aunque sea el mismo día del cobro.
  // A siete días de que se acabe la agenda, un aviso pide entrar en Finanzas para renovarla.
  function pendientes(agenda, ahora, avisados = {}) {
    if (!agenda?.activo) return [];
    const hoy = fechaLocal(ahora), hora = horaLocal(ahora);
    const out = (agenda.items || []).filter(x => x.fecha >= hoy && x.avisar <= hoy && (x.avisar < hoy || hora >= (agenda.hora || '09:00')) && !avisados[x.id]);
    const renovar = 'renovar|' + agenda.hasta;
    if (agenda.hasta && sumarDias(agenda.hasta, -7) <= hoy && hora >= (agenda.hora || '09:00') && !avisados[renovar]) out.push({ id: renovar, renovar: true });
    return out;
  }

  // Una notificación por día de cobro: «Mañana se cobra Luz» o «Mañana se cobran 2 pagos fijos».
  // La etiqueta es la fecha: si el aviso se repite, sustituye al anterior en vez de apilarse.
  function notificaciones(items, ahora) {
    const hoy = fechaLocal(ahora), porFecha = new Map(), out = [];
    for (const x of items) {
      if (x.renovar) { out.push({ titulo: 'Renueva los avisos de pagos fijos', cuerpo: 'Entra en Finanzas para preparar los de los próximos dos meses.', tag: 'pagos-renovar', ids: [x.id] }); continue; }
      if (!porFecha.has(x.fecha)) porFecha.set(x.fecha, []);
      porFecha.get(x.fecha).push(x);
    }
    for (const [fecha, xs] of [...porFecha].sort((a, b) => a[0].localeCompare(b[0]))) {
      const c = cuando(diasEntre(hoy, fecha));
      const titulo = xs.length === 1 ? `${c} se cobra ${xs[0].nombre}` : `${c} se cobran ${xs.length} pagos fijos`;
      const cuerpo = xs.length === 1
        ? [cifra(xs[0]), xs[0].cuenta, fechaLarga(fecha)].filter(Boolean).join(' · ')
        : xs.map(x => [x.nombre, cifra(x)].filter(Boolean).join(' ')).join(' · ') + ' · ' + fechaLarga(fecha);
      out.unshift({ titulo, cuerpo, tag: 'pagos-' + fecha, ids: xs.map(x => x.id) });
    }
    return out;
  }

  // Lee la agenda, enseña lo pendiente y lo apunta como avisado. `mostrar(titulo, opciones)` es
  // registration.showNotification en el service worker o en la página. Devuelve cuántos avisó.
  async function revisar(mostrar, ahora = new Date()) {
    if (typeof caches === 'undefined') return 0;
    const c = await caches.open(CACHE);
    const agenda = await (await c.match('agenda.json'))?.json().catch(() => null);
    if (!agenda?.activo) return 0;
    const avisados = (await (await c.match('avisados.json'))?.json().catch(() => null)) || {};
    const ps = pendientes(agenda, ahora, avisados);
    if (!ps.length) return 0;
    let n = 0;
    for (const x of notificaciones(ps, ahora)) {
      try { await mostrar(x.titulo, { body: x.cuerpo, tag: x.tag, renotify: true, icon: 'app/icono-192.png', badge: 'app/icono-192.png', data: { url: './#/finanzas?v=recurrentes' } }); n++; }
      catch { return n; } // sin permiso: se volverá a intentar, no se apunta como avisado
      for (const id of x.ids) avisados[id] = Date.now();
    }
    // Lo avisado hace más de 90 días ya no hace falta recordarlo.
    for (const [k, t] of Object.entries(avisados)) if (Date.now() - t > 90 * 86400000) delete avisados[k];
    await c.put('avisados.json', new Response(JSON.stringify(avisados), { headers: { 'content-type': 'application/json' } }));
    return n;
  }

  g.maydomAvisos = { CACHE, pendientes, notificaciones, revisar, cuando, fechaLocal };
})(globalThis);
