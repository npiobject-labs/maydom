# maydom · La lista de la compra con productos variados en varias tiendas

**Fecha:** 2026-09-22 · **Estado:** planificación, sin implementar · **Origen:** el usuario intenta comprar yogur, café y varias cosas más en Mercadona desde el Buscador y se encuentra con el campo «URL de su buscador con `{q}`», que no le dice nada. La pregunta de fondo no es el campo: es **cómo se hace una compra de verdad** —varios productos, varias tiendas— con lo que la app tiene hoy.

## 0. En una página

| # | Posibilidad | Qué resuelve | Coste | Depende de | Veredicto |
|---|---|---|---|---|---|
| A | **Modo «comprar en esta tienda»**: recorrido por los artículos de esa tienda, uno a uno, sin volver atrás | Tu caso exacto: 8 cosas en Mercadona | ~2 h, sin LLM | Nada | **Primero** |
| B | **«+ a la compra» desde el Buscador** | Lo que encuentras cae en la lista con su tienda | ~1 h, sin LLM | Nada | **Primero** |
| C | **Tienda aprendida por producto** (historial local) | Que la lista se agrupe sola bien, sin teclear la tienda cada vez | ~1,5 h, sin LLM | Nada | **Después de A+B** |
| D | **Dictar la lista entera** | «yogur griego, café molido y papel de cocina» → tres líneas | ~2 h, con LLM | Clave del gateway | **Después** |
| E | **Rejilla productos × tiendas** | Ver de un golpe dónde buscar cada cosa | ~2 h, sin LLM | Nada | Solo si A se queda corto |
| F | **Plantillas de compra** («la de siempre») | Rehacer la compra semanal de un toque | ~1,5 h, sin LLM | C (historial) | Después |
| G | **Compartir a maydom** (ficha y precio reales) | Que el producto entre con nombre, precio y tienda | ~4-5 h | Ya planificado: D14 / P1 | Por su propio documento |
| H | **Reparto sugerido por el mayordomo** (qué comprar dónde) | Decidir tienda por precio o por tipo | ~3 h, con LLM | G (datos reales) o se queda en opinión | Al final, o nunca |
| X | Carrito automático en la tienda, cuenta del usuario en el servidor, scraping del catálogo | «Que compre él» | Alto y permanente | Romper ADR-006 | **Descartado** |

**Recomendación:** A + B en una sesión, que es lo que hace usable la compra hoy; C y F en la siguiente; D cuando eso esté asentado. E, H y todo lo de precios reales solo tienen sentido con lo anterior hecho.

## 1. El malentendido del `{q}` (y por qué no es tu camino)

El campo **«URL de su buscador con `{q}`» es opcional y para un caso muy concreto**: cuando conoces la dirección que le queda a la tienda en la barra del navegador *después* de buscar dentro de ella. Se copia esa dirección y se sustituye lo buscado por `{q}`.

```
buscas «yogur» en la tienda  →  barra:  .../search-results?query=yogur
en el campo se pega          →          .../search-results?query={q}
```

Lo que **no** vale ahí:

- `tienda.mercadona.es` a secas → eso es el campo **Dominio**, y es el único obligatorio. Ya lo tienes bien.
- El enlace de *un yogur concreto* → es la ficha de un producto, no una búsqueda. No sirve para `{q}`.
- Una dirección que no has visto funcionar. Regla del proyecto (§4.2 del plan): el 21-sep se escribieron cinco plantillas a ojo y **cuatro fallaron** en la tienda real. **No se escribe ninguna sin haberla visto devolver resultados.**

Si la barra de direcciones **no cambia** al buscar (muchas tiendas son aplicaciones de una sola página), esa tienda sencillamente no tiene URL de búsqueda: se deja vacío y la app busca `site:tienda.mercadona.es yogur` en un buscador general, que siempre responde.

[SUPUESTO] La tienda online de Mercadona exige código postal y sesión iniciada antes de enseñar el catálogo, así que su búsqueda por URL puede no funcionar aunque exista. No se ha podido comprobar desde la sesión: el sandbox no alcanza las tiendas. Plan B: se queda sin plantilla, como está ahora, y se busca dentro del sitio.

**Conclusión: deja ese campo vacío.** No es lo que te falta.

## 2. Lo que hay hoy, y dónde se rompe

**Compra** (Menú → Mesa → Compra) ya es la lista de la compra:

- Entra solo lo que baja de umbral en Alimentación y Suplementos, más lo que añadas con `+ Línea` (Qué, Cantidad, Tienda).
- Se **agrupa por tienda**, con la cuenta de artículos de cada una.
- Marcar comprado repone el stock del alimento o del suplemento.
- `Copiar lista` la pasa como texto al portapapeles.
- Cada línea tiene **buscar**, que salta al Buscador con esa palabra y su categoría.

**Buscador** está montado en el eje contrario: *un producto → todas las tiendas*. Abre una pestaña por tienda para **una sola** consulta.

Los dos agujeros, y son justo los de tu pregunta:

1. **No existe el eje «una tienda → muchos productos».** Para ocho artículos de Mercadona hay que entrar en cada línea, pulsar buscar, elegir Mercadona entre nueve tiendas, volver atrás, siguiente. Ocho veces.
2. **El Buscador no devuelve nada a la lista.** Encuentras el yogur y no hay forma de decir «esto, a la compra».

Todo lo que sigue son maneras distintas de tapar esos dos agujeros.

## 3. Las posibilidades, una a una

### A · Modo «comprar en esta tienda»

En Compra, cada cabecera de tienda gana un botón **«Comprar en Mercadona (8)»**. Abre una pantalla de recorrido:

- Un artículo a la vez, grande: **Yogur griego · 2 botes**, con su enlace de búsqueda **en esa tienda**, y `✓ comprado` / `saltar` / `siguiente`.
- El enlace usa la plantilla de la tienda si la tiene, y si no `site:dominio`, que es lo que ya hace el Buscador.
- Al marcar comprado hace lo de siempre: repone stock y pregunta cantidad cuando la línea viene de Alimentación o Suplementos.
- Al terminar, resumen: comprados, saltados y lo que queda para otra tienda.
- El estado del recorrido no se guarda: la sección se repinta con cada cambio, como el resto de la app.

Toca `secciones/compra.js` y nada más. Sin LLM, sin red, sin decisiones nuevas de arquitectura. **Es lo que resuelve tu caso literal.**

Lo que no arregla: sigue siendo una pestaña del navegador por artículo. No hay carrito.

### B · «+ a la compra» desde el Buscador

Un botón junto a la caja de búsqueda («añadir “yogur griego” a la compra») y otro en cada tarjeta de tienda («a la compra · Mercadona», que además rellena la tienda de la línea).

Cierra el círculo que hoy solo va en un sentido: Compra → Buscador. Toca `secciones/buscador.js` y reutiliza el alta de `compra.js`.

### C · Tienda aprendida por producto

Hoy la tienda de una línea se teclea a mano, y si la dejas vacía todo cae en «Sin tienda» y la agrupación no sirve de nada.

Cada vez que marcas algo comprado en una tienda, la app lo anota (`producto → tienda`, solo en local). La próxima vez que ese producto entre en la lista —por umbral o a mano— trae esa tienda puesta. Un desplegable con las tiendas del catálogo en vez del campo de texto libre, que hoy admite cualquier cosa y no casa con el catálogo.

Es barato, no necesita LLM y es lo que hace que A y F valgan de verdad: sin tienda en las líneas, no hay grupos que recorrer.

### D · Dictar la lista entera

Un cuadro de texto arriba de Compra, con dictado: *«necesito yogur griego, café molido, papel de cocina y proteína de suero»* → el mayordomo lo parte en líneas con cantidad y tienda sugerida, que se repasan antes de guardar.

Mismo patrón que el relato de sueño: **plan B por reglas primero** (partir por comas y por «y», detectar cantidades) y el LLM encima; si el gateway falla, las líneas ya están escritas. Operación nueva `compra-lista` en la tabla de §4.1 del plan.

### E · Rejilla productos × tiendas

Una tabla: filas los artículos pendientes, columnas las tiendas activas de su categoría, cada celda un enlace de búsqueda. Se abre por columna (todo en Mercadona) o por fila (este yogur en todas).

Enseña de un golpe lo que A enseña de uno en uno. En un móvil, una rejilla de 8 × 9 es mala idea; quedaría para pantalla ancha. **Solo si A resulta insuficiente.**

### F · Plantillas de compra

«La compra de siempre»: un conjunto guardado de líneas (nombre, cantidad, tienda) que se vuelca a la lista de un toque. Se crea desde lo que compraste la semana pasada, que el historial de C ya tiene.

### G · Compartir a maydom (ficha y precio reales)

Ya está planificado y decidido, no hay que inventarlo aquí: es **D14 / fase P1** de [`obtener-datos-de-productos.md`](obtener-datos-de-productos.md), bajo [`ADR-006`](memoria/decisiones/ADR-006-obtener-datos-sin-evadir-anti-bot.md). Abres el yogur en la tienda, pulsas Compartir → maydom, y el producto entra en la lista con nombre, tienda, precio e imagen. Es la pieza que convierte la lista de la compra en algo con datos reales dentro.

Encaja detrás de A y B: el sitio donde cae lo compartido es la lista.

### H · Reparto sugerido por el mayordomo

«De esta lista, el yogur y el café en Mercadona, la proteína en HSN, el papel en Carrefour.» Con precios reales (G) es una recomendación; sin ellos es una opinión del modelo sobre qué tienda vende qué, y se equivocará con seguridad en el surtido local.

Encaja al final, y solo si G da datos. Antes de eso, C (lo que tú mismo compraste dónde) acierta más y cuesta la décima parte.

## 4. Lo que se descarta, y por qué

| Idea | Por qué no |
|---|---|
| **Meter los productos en el carrito de la tienda automáticamente** | Exige sesión iniciada del usuario, y ejecutarlo desde el servidor exige sus cookies. Prohibido explícitamente por [`ADR-006`](memoria/decisiones/ADR-006-obtener-datos-sin-evadir-anti-bot.md) §3 |
| **Guardar la cuenta de Mercadona (o de cualquier tienda) en maydom** | Credenciales de terceros en una app pública sin backend con estado. No |
| **Descargar el catálogo de cada tienda para buscar dentro de maydom** | Es scraping con mantenimiento perpetuo, y ya existe el proyecto que lo hace: `buscaproducto` ([`ADR-005`](memoria/decisiones/ADR-005-buscador-nivel-enlace.md), deuda D5) |
| **Escribir plantillas `{q}` de las nueve tiendas de alimentación** | Cuatro de cinco fallaron el 21-sep. Solo entran las vistas funcionar (§4.2 del plan) |

## 5. Fases propuestas

| Fase | Contenido | Criterio de «hecho» |
|---|---|---|
| **C1** | A + B: recorrido por tienda y «+ a la compra» desde el Buscador | Prueba de humo que añade tres líneas de dos tiendas, recorre una tienda entera marcando comprado y comprueba que el stock se repone y que la otra tienda queda intacta |
| **C2** | C + desplegable de tiendas del catálogo en la línea de compra | Marcar comprado en una tienda y ver que el mismo producto vuelve con esa tienda puesta |
| **C3** | F: plantillas de compra | Guardar la lista actual como plantilla y volcarla con la lista vacía |
| **C4** | D: dictar la lista entera | Con gateway simulado: un dictado de cuatro productos da cuatro líneas; con el gateway caído, el plan B por reglas también |
| — | G (D14/P1) y H | Por su propio documento; H solo con G hecha |

## 6. Lo que hace falta decidir

1. **El recorrido de A, ¿pantalla aparte o dentro de Compra?** Propuesta: dentro, con la ruta en `?tienda=`, como Finanzas hace con `?v=`. Así el botón «atrás» del móvil funciona.
2. **¿La tienda de una línea pasa a ser del catálogo (desplegable) o sigue texto libre?** Propuesta: desplegable con las tiendas del catálogo más «otra», porque si no, A no puede agrupar.
3. **¿Qué pasa con lo que no tiene tienda?** Propuesta: grupo «Sin tienda» con su propio recorrido, que abre el Buscador normal (todas las tiendas de la categoría).
4. **¿El historial de C se exporta?** Va en el JSON de `localStorage` como todo lo demás; decide si quieres que la exportación lo incluya o sea local y desechable.
