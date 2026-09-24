---
fecha: 2026-09-24
estado: aceptada
tags: [maydom, menu, ux, hoy]
---
# ADR-007 · Accesos directos en Hoy: rejilla propia, fijados con ☆

## Contexto
El usuario pide, a la entrada de la app, botones grandes de colores con nombre que lleven directamente a las opciones que más usa; elegir color, nombre y forma de cada uno (círculo, cuadrado, rectángulo, pentágono, hexágono), y colocarlos donde quiera, «incluso sin alinear». Se revisó la idea y se aceptaron cuatro correcciones, que se probaron en el mock `docs/mocks/003-accesos-directos.html` antes de desarrollar.

## Decisión
- **Van a acciones, no solo a secciones**: un acceso es una ruta de la app, y con `?accion=<data-a>` pulsa al llegar el mismo botón que ya tiene la sección («Contar la noche», «+ Movimiento», «+ Nota»). Ninguna sección sabe nada de los accesos.
- **Rejilla de 4 columnas fijas en vez de colocación libre**: cada acceso ocupa casillas explícitas (`x`, `y`) en tamaño pequeño (1×1), ancho (2×1) o grande (2×2); se pueden dejar huecos, y al soltar uno encima de otro, el otro pasa al sitio que quedó libre. Las columnas no cambian con la pantalla, así que una posición es la misma en el móvil y en el PC.
- **Forma + color + icono + nombre de 12 letras** como mucho, con cinco formas (círculo, cuadrado, hexágono, pentágono, hoja); el rectángulo es el tamaño ancho.
- **En lo alto de Hoy**, no en una pantalla nueva: una pantalla de entrada más sería un toque más. Complementa ADR-003 sin cambiar el menú.
- **Se fijan con ☆**: «☆ Fijar» en la cabecera de cada sección (ofrece la sección, su vista o pestaña y sus botones) y ☆ en toda ventana que abra un botón. Nada de botón flotante abajo a la derecha, donde tapa la barra inferior.
- **Colocar es un modo aparte** (mantener pulsado o «✎ Colocar»), como en el escritorio del móvil, para que no se muevan por accidente.
- **Las sugerencias por uso son solo propuestas**: el mayordomo cuenta qué botones y secciones se usan y ofrece los tres más usados que no estén fijados; nunca los añade solo.

## Consecuencias
- Datos en `estado.accesos` y `estado.usos` de `maydom.v1`; viajan con exportar/importar.
- Solo se pueden fijar botones con `data-a` y sin otros `data-*`: los que dependen de una ficha concreta (`data-id`) no se pueden fijar, ni los de borrar.
- Del destino solo se guardan `v`, `vista` y `guion`; la fecha, el mes o una búsqueda son del momento y dejarían el acceso clavado en ese día.
- Un botón que cambie de `data-a` rompe los accesos que lo usen: la app avisa («Esa acción no está ahora mismo en …») y abre la sección igualmente.
- Los atajos del manifest (mantener pulsado el icono de la app en el móvil) son estáticos y no pueden seguir a los del usuario; quedan fuera por ahora.
