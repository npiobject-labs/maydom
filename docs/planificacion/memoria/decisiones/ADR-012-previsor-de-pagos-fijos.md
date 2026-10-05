---
fecha: 2026-10-05
estado: aceptada (previsor) · propuesta (avisos)
tags: [maydom, finanzas, avisos]
---
# ADR-012 · Previsor de pagos fijos: detectados solos en los movimientos; avisos al móvil después

## Contexto
El usuario pide un **previsor o avisador de los pagos de gastos fijos**: que, analizando todos los movimientos de las cuentas, un informe diga para cada mes el día en que vence cada recibo (luz, comunidad, gas, suscripciones…), y, en la siguiente versión, una notificación al móvil **N días antes** (1, 2 o 3, ajustable): «mañana se cobra el recibo de la luz». No tenía claro si era una sección nueva o iba en Recurrentes. Pidió ver un mock antes ([[ADR-011-finanzas-con-clave]] sigue: Finanzas cifrada, la clave no se guarda).

## Decisión
- **Va en Recurrentes, renombrada «Pagos fijos»** (la ruta sigue siendo `v=recurrentes`, para no romper accesos fijados). Un recurrente apuntado a mano y un pago detectado son lo mismo para el calendario; la pestaña ya existía y casi no se usaba desde que se importan extractos.
- **Detección automática, sin pedir confirmación** (`docs/app/secciones/finanzas/vencimientos.js`, funciones puras): se agrupan los cargos por emisor (descripción sin números, meses ni trámite bancario, cuatro primeras palabras) y un grupo es pago fijo si los intervalos son casi todos un múltiplo pequeño de 1, 2, 3, 6 o 12 meses (la mitad o más, exactamente uno) y, si es mensual, el día no baila más de 10. Tres cargos para mensual a trimestral; dos (de importe casi igual) para semestral y anual. Fuera cajero y traspasos entre cuentas propias. Dos pagos del mismo emisor que conviven en el tiempo (seguro de casa y del coche) se separan por importe; uno que sube de precio sigue siendo uno.
- **El día** es la mediana de los últimos seis; si el recibo nunca se ha cobrado en fin de semana, los lunes no cuentan (son vencimientos desplazados) y la previsión pasa el sábado y el domingo al lunes. **El importe** es la mediana de los tres últimos, con su horquilla.
- **Lo que decide el usuario** se guarda en `estado.recurrentes` con la `clave` del grupo: el nombre («Luz») o «no es un pago fijo» (descartado, recuperable). Va cifrado con el resto de Finanzas. «Aplicar recurrentes» y el aviso de recurrentes sin aplicar solo cuentan los apuntados a mano.
- **Pestaña Pagos fijos**: coste al mes y al año, próximos 30 días, la lista (detectados y a mano), «Ya no se cobran» y «Descartados». **Listado «Vencimientos de pagos fijos»** en el registro `INFORMES` (próximos 12 meses o un año, cuenta): mes a mes el día, el pago, el importe y su estado —cobrado (el cargo real), previsto, o no ha llegado (debería estar en los extractos importados y no está)—.
- **Avisos al móvil: siguiente versión**, con el mock `docs/mocks/007-pagos-fijos.html` (antelación el mismo día, 1, 2 o 3 días; hora; importe sí o no; antelación por pago). `proximos()` ya da lo que leerán. **Falta decidir el canal** con la app cerrada (deuda D17): A, el propio móvil (Periodic Background Sync de la PWA instalada más un repaso al abrir la app), con la agenda de los próximos 30 días guardada **sin cifrar** para que el aviso no pida la clave; B, exportar al calendario del móvil (`.ics` con alarma); C, push desde Fly, que obliga a guardar los pagos en un servidor ([[ADR-002-local-first]]). Recomendada A con B de respaldo.

## Consecuencias
- Con menos de tres meses de extractos no sale nada mensual, y un anual necesita dos años de historia: se puede apuntar a mano.
- [SUPUESTO] En los extractos reales de BBVA la descripción de un mismo recibo solo cambia en números y meses. Si cambia más (observaciones distintas cada mes), el recibo saldría partido en dos grupos; plan B: un botón «es el mismo que…» que una claves.
- [SUPUESTO] Los recibos domiciliados que vencen en festivo también se desplazan: no se tienen en cuenta los festivos, solo el fin de semana; la previsión puede ir un día antes que el cargo.
- Un cambio en el algoritmo de la clave pierde el nombre puesto a un pago (sigue detectándose con el nombre del banco).
