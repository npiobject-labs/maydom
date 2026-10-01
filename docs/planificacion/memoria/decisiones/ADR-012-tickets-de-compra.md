---
fecha: 2026-10-01
estado: propuesta
tags: [maydom, finanzas, llm, datos]
---
# ADR-012 · Tickets de compra leídos por foto, vinculados al movimiento del banco y desglosados por línea

## Contexto
El extracto de BBVA dice cuánto y dónde, pero no **en qué**: un cargo de supermercado es una línea con un concepto («alimentación») aunque dentro haya comida, droguería y una bolsa. El usuario quiere saber qué parte del **gasto variable** es alimentación, ocio, ropa…, y propone fotografiar cada ticket, subirlo a maydom y que se asocie solo al movimiento del banco cuando llegue el extracto. Finanzas está cifrada con clave ([[ADR-011-finanzas-con-clave]]) y el LLM se consume por el gateway ([[ADR-004-llm-por-el-gateway]]). Plan completo en `docs/planificacion/tickets-gastos-variables.md`.

## Decisión (propuesta)
- **El ticket es un dato de Finanzas**: dos listas nuevas en el cofre, `tickets` y `clasesTicket`, cifradas como los movimientos. La foto no se guarda por defecto.
- **Lee el LLM, comprueba el navegador**: una llamada `finanzas-ticket` por foto devuelve comercio, fecha, hora, total, pagos, líneas con categoría, ofertas e IVA; el navegador verifica tres cuadres (líneas − ofertas = total, base + cuota = total, ahorro = ofertas) y, si no cuadran, el ticket queda «a revisar». Guardar primero y leer después; sin LLM, alta a mano con una sola línea.
- **El vínculo vive en el ticket** (`movimientoId`), no en el movimiento: importe exacto en céntimos, ventana de −1 a +4 días, puntos por comercio y por tarjeta; automático solo si es inequívoco, por multiplicidad como el cotejo de importar, y se reintenta al terminar cada importación. Las últimas 4 cifras de la tarjeta se aprenden en la cuenta.
- **El desglose no reescribe el banco**: `partidas()` sustituye al movimiento por sus líneas en los listados, escaladas para que sumen exactamente el cargo. Las categorías son los `CONCEPTOS` de siempre, más **hogar** y **cuidado personal**, y subcategorías solo en alimentación.
- **Efectivo**: un ticket pagado en efectivo es gasto por sí mismo, porque la retirada del cajero ya es neutra.
- **Nada manual se pisa**: `cm` en la línea y vínculo manual en el ticket; lo corregido se aprende por producto y comercio.

## Consecuencias
- Hacer la foto pide la clave de Finanzas. Hay que arreglar antes que un acceso fijado a un botón de Finanzas pierda su acción al pasar por el candado. Si en la práctica molesta, buzón sellado con clave pública (escribir sin clave, leer solo con ella).
- [SUPUESTO] El modelo barato del gateway lee papel térmico a 2.000 px; plan B: releer con un modelo con imagen del catálogo, o dos fotos apiladas.
- [SUPUESTO] `localStorage` aguanta años de tickets (~0,7 MB/año cifrado); plan B: el cofre a IndexedDB.
- La foto viaja al proveedor del modelo con las últimas cifras de la tarjeta, como ya viaja un extracto en PDF ilegible.
