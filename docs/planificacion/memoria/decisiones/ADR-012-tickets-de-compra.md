---
fecha: 2026-10-01
estado: aceptada
tags: [maydom, finanzas, llm, datos]
---
# ADR-012 · Tickets de compra leídos por foto, vinculados al movimiento del banco y desglosados por línea

## Contexto
El extracto de BBVA dice cuánto y dónde, pero no **en qué**: un cargo de supermercado es una línea con un concepto («alimentación») aunque dentro haya comida, droguería y una bolsa. El usuario quiere saber qué parte del **gasto variable** es alimentación, ocio, ropa…, y propone fotografiar cada ticket, subirlo a maydom y que se asocie solo al movimiento del banco cuando llegue el extracto. Finanzas está cifrada con clave ([[ADR-011-finanzas-con-clave]]) y el LLM se consume por el gateway ([[ADR-004-llm-por-el-gateway]]). Plan completo en `docs/planificacion/tickets-gastos-variables.md`.

## Decisión (aceptada el 01-oct-2026 con las recomendaciones del plan)
- **Los tickets son muy variados** y cada comercio repite el suyo: **ningún código conoce el formato de una tienda** (ni plantillas ni expresiones regulares por comercio). Un solo esquema con casi todo opcional (un ticket puede ser solo comercio, fecha y total), comprobaciones que se aplican según lo que traiga el papel, y lo que se repite por comercio se **aprende como dato** en un perfil: nombres en el ticket y en el banco, CIF, tipo, categoría por defecto, si se desglosa por línea, retraso hasta el cargo, IVA por letras, pistas de lectura y modelo. Se prueba con un muestrario inventado de disposiciones distintas, nunca con un solo ticket.
- **El ticket es un dato de Finanzas**: tres listas nuevas en el cofre, `tickets`, `comercios` y `productos`, cifradas como los movimientos. La foto no se guarda por defecto.
- **Lee el LLM, comprueba el navegador**: una llamada `finanzas-ticket` por foto devuelve tipo de comercio, fecha, hora, total, pagos, líneas con categoría y nombre genérico, descuentos, extras e IVA; el navegador aplica las comprobaciones que el ticket permita (cantidad × precio, líneas = total, IVA = total, pagos = total, ahorro = descuentos): «cuadra», «sin comprobar» (solo total) o «a revisar». Si no cuadra, segunda lectura con las pistas y el modelo del perfil del comercio. Guardar primero y leer después; sin LLM, alta a mano con una sola línea.
- **El vínculo vive en el ticket** (`vinculos`), no en el movimiento, y admite varios con varios: tolerancia de importe por tipo de comercio (exacto en general; propina en restaurantes, preautorización en gasolineras, cambio en otra divisa), ventana de días aprendida por comercio, puntos por descriptor del banco aprendido y por tarjeta; automático solo si es inequívoco y exacto, por multiplicidad como el cotejo de importar, y se reintenta al terminar cada importación.
- **El desglose no reescribe el banco**: `partidas()` sustituye al movimiento por sus líneas en los listados, escaladas para que sumen exactamente el cargo. Las categorías son los `CONCEPTOS` de siempre, más **hogar** y **cuidado personal**, y subcategorías solo en alimentación.
- **Efectivo**: un ticket pagado en efectivo es gasto por sí mismo, porque la retirada del cajero ya es neutra.
- **Nada manual se pisa**: `cm` en la línea, vínculo manual en el ticket y campos fijados en el perfil; lo corregido se aprende por producto y comercio. Un comercio que no se desglosa (restaurante, gasolinera, transporte) va entero a su categoría.

## Consecuencias
- Hacer la foto pide la clave de Finanzas. Hay que arreglar antes que un acceso fijado a un botón de Finanzas pierda su acción al pasar por el candado. Si en la práctica molesta, buzón sellado con clave pública (escribir sin clave, leer solo con ella).
- [SUPUESTO] El modelo barato del gateway lee tickets de disposiciones muy distintas a 2.000 px; plan B: segunda lectura con pistas, un modelo mejor fijado por comercio, o varias fotos apiladas.
- [SUPUESTO] Basta con aplicar el perfil después de leer (no se sabe el comercio hasta leer); plan B: elegir el comercio antes de la foto.
- [SUPUESTO] `localStorage` aguanta años de tickets (~0,7 MB/año cifrado); plan B: el cofre a IndexedDB.
- La foto viaja al proveedor del modelo con las últimas cifras de la tarjeta, como ya viaja un extracto en PDF ilegible.
- **El perfil de cada comercio no va a la bóveda de Obsidian** (propuesta del usuario, valorada el mismo día; pendiente de su confirmación). La bóveda se publica con `docs/`, así que diría dónde y cuándo compra el usuario. Además, la app no puede escribir en ella sin un token (D10), y la copia se desfasaría con la primera corrección. A Obsidian solo van las lecciones generales de lectura, sin datos, que alimentan el prompt general. El perfil se lee y se edita en su ficha dentro de la app.
