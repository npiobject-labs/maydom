# maydom — instrucciones del proyecto

Flujo "PC arranca, móvil continúa": el desarrollo, la revisión y las pruebas se hacen desde sesiones en la nube (claude.ai/code con este repo seleccionado, desde web o móvil), con el PC apagado. Trabaja en español. Perfil del usuario: desarrollador senior en solitario; no expliques conceptos básicos; marca toda suposición no verificada como [SUPUESTO] e indica su plan B.

## Parámetros

| Parámetro | Valor |
|---|---|
| Proyecto | `maydom` |
| Owner de GitHub | `npiobject-labs` |
| App de Fly.io | `maydom-npiobject-labs` |
| Carpeta de Drive (id) |  |

Esta tabla la rellena sola `.github/workflows/init-plantilla.yml` en el primer push de un repo creado desde la plantilla; no hay nada que tocar a mano salvo el id de Drive.

- **App de Fly.io**: `derivada` significa que `deploy.yml` la calcula como `<repo>-<owner>` en minúsculas, saneado a `[a-z0-9-]` y recortado a 30 caracteres. Si existe la variable de repositorio `FLY_APP`, esa manda; anota aquí el valor cuando la definas.
- **Carpeta de Drive (id)**: vacío significa que este proyecto no usa Drive. Ver ARRANQUE.md para activarlo a mitad de proyecto.

## Fuente de verdad

El repositorio `npiobject-labs/maydom`, rama `main`, es la **única** fuente de verdad, tanto para el código como para la documentación de `docs/planificacion/`. Todo lo que importe vive aquí y se edita aquí.

Google Drive es **opcional** y, cuando está configurado, **solo un destino de copias**, nunca un origen:

- Si el id de la sección **Parámetros** está vacío, este proyecto no usa Drive: omite el paso sin comentarlo.
- Si hay id, al cerrar sesión se suben copias de `docs/planificacion/` a esa carpeta. Solo crear o sobrescribir por nombre: nunca borrar ni renombrar nada en Drive.
- Nunca se toma nada de Drive como origen ni se importa contenido desde allí. Si el repo y Drive difieren, gana el repo.
- La carpeta tiene que ser una carpeta normal de `Mi unidad`. Nunca uses el "Proyecto" de Drive del mismo nombre: el conector no puede escribir en él.

La carpeta local del PC es un espejo de solo lectura. Nunca la trates como origen ni construyas un camino local → nube.

## URLs vivas

| Qué | URL | Despliegue |
|---|---|---|
| Mock estático (Pages) | https://npiobject-labs.github.io/maydom/ | `.github/workflows/pages.yml` en push a `main` |
| Bitácora (Pages) | https://npiobject-labs.github.io/maydom/bitacora.html | idem; el índice lo genera `pages.yml` |
| Backend (Fly.io, opcional) | `https://<app de Fly>.fly.dev/` · `/salud` · `/holamundo` | `.github/workflows/deploy.yml` en push a `main` que toque `app/**` |
| App maydom (Pages) | https://npiobject-labs.github.io/maydom/ | la PWA; misma URL que el mock vivo |
| Comprobación del backend (Pages) | https://npiobject-labs.github.io/maydom/holamundo.html | página estática que llama a `/holamundo` y `/salud` desde el navegador |

Pages está siempre activo. Fly también: `FLY_API_TOKEN` es un secreto de la organización `npiobject-labs` y lo heredan sus repos **públicos**, así que `deploy.yml` despliega sin configurar nada. Si el repo fuera privado (plan Free) o viviera fuera de la organización, el secreto no llega y `deploy.yml` termina en verde con el aviso "Fly no configurado" sin desplegar nada.

## Código

- Todo cambio termina en commit + push a `main`. Mensajes de commit en español, imperativo.
- Backend en `app/` (Rust, axum + tokio). `GET /` devuelve texto plano; `GET /salud` devuelve `{"ok":true,"build":"<BUILD_ID>"}`, donde `BUILD_ID` es el SHA que inyecta el workflow.
- `GET /holamundo` devuelve `holamundo` en texto plano; `/holamundo` y `/salud` llevan `Access-Control-Allow-Origin: *` porque los consume `docs/holamundo.html` desde Pages (otro origen). Si añades más rutas para el frontend, ponles la misma cabecera. `deploy.yml` verifica las dos rutas y falla si cambian.
- **El LLM se consume por el gateway `npiobject-labs/openrouter`**, no llamando a OpenRouter: maydom es una aplicación dada de alta ahí (ver ADR-004 y §4.1 del plan). `POST /api/mayordomo` recibe `{contexto, tarea, formato, imagen, operacion, mensajes:[{rol, contenido}]}` y llama a `{LLM_BASE_URL}/chat/completions` (por defecto `https://openrouter-npiobject-labs.fly.dev/v1`, que es **donde está dada de alta la aplicación de maydom**: el gateway tiene dos despliegues con dos bases y dos juegos de claves, y una clave solo vale en el suyo; para pasar al VPS hay que crear allí otra aplicación y fijar `LLM_BASE_URL`) con la clave de aplicación del secreto `LLM_API_KEY`; manda `X-Operacion: maydom-<sección>` para que el gasto se reparta por función, reintenta solo ante 502/504 (dos veces, 2 s y 8 s) y traduce los errores del gateway conservando su `code`. `GET /api/estado` dice si hay LLM, qué modelo y si exige clave, sin gastar crédito. Sin `LLM_API_KEY` responde 503 y la app sigue con el motor de reglas.
- **La app pública manda `X-Clave`** con el valor del secreto `MAYDOM_CLAVE`, que el usuario escribe una vez en Ajustes → Clave de acceso; sin ella el backend responde 401. Una URL pública sin esa puerta es presupuesto del gateway regalado. Secretos del repo que `deploy.yml` vuelca a Fly: `LLM_API_KEY` y `MAYDOM_CLAVE`; variables opcionales `LLM_BASE_URL` y `LLM_MODELO`. `deploy.yml` verifica `/api/estado`, `/api/mayordomo` (200 o 503), el CORS con `x-clave` y que sin clave responde 401.
- **Los 503 se distinguen**: `falta_llm_api_key` es de maydom (no hay clave configurada) y `gateway_*` son del gateway traducidos con su código prefijado. `deploy.yml` falla si hay `LLM_API_KEY` y la llamada no devuelve 200: antes un 503 del gateway se contaba como el 503 de «aún no hay clave» y el run salía verde con el mayordomo sin funcionar.
- **Ningún preflight devuelve cuerpo**: un 204 con `Content-Length` lo rechaza HTTP/2 en el proxy de Fly (`curl (92)`), y eso rompió un despliegue el 21-sep.
- La app es una PWA en `docs/`: `docs/index.html` (shell) + `docs/app/` (núcleo, secciones, semillas, `llm.js`), `docs/manifest.webmanifest` y `docs/sw.js`. Sin framework ni build; datos en `localStorage` (clave `maydom.v1`). Al subir el `build` cambia también la constante `CACHE` de `docs/sw.js` y la lista de ficheros si hay módulos nuevos. Prueba de humo en local: servir `docs/` y recorrer `#/seccion` con Playwright (ver sesiones 20260920 y 20260921); las funciones con LLM se prueban con un gateway simulado en el puerto 8098 y `LLM_BASE_URL` apuntando a él.
- **Versión nueva e instalación viven en `docs/app/pwa.js`** (réplica de lo que hace `prueba`): al abrir y al volver a la app se compara el `<meta name="build">` publicado (`index.html` con `cache: 'no-store'`) con el que corre, y si difiere sale la banda «Hay una versión nueva de maydom · Actualizar» encima de la cabecera; recargar lo decide el usuario. El service worker nuevo solo dispara la comprobación: la red primero puede haber traído ya la página nueva, y avisar por él daba falsos positivos. En Ajustes, la tarjeta **Aplicación** tiene «Instalar la app» (solo cuando el navegador lo ofrece; si no, explica cómo), el build y «Buscar actualización». `sw.js` va a la red con `cache: 'no-cache'` y precachea con `cache: 'reload'`: Pages sirve con `max-age=600` y sin eso «Actualizar» podía traer módulos viejos de la caché HTTP. El manifest lleva PNG de 192 y 512 (`docs/app/icono-*.png`, más uno `maskable`), que es lo que Chrome pide para ofrecer instalar; antes solo había un SVG. **Chrome retrasa el relevo del service worker** hasta que el viejo lleva ~30 s sin tráfico aunque se llame a `skipWaiting()`, así que `actualizar()` le da 3 s y recarga igual. Prueba de humo: `tools/prueba-pwa.mjs` (sin y con service worker; la segunda espera 40 s porque bajo Playwright una recarga en pleno relevo se cuelga, sin Playwright no).
- **El dictado vive en `docs/app/voz.js`** y es opcional por diseño: `hayVoz()` decide si el botón existe, así que un navegador sin reconocimiento de voz ve la app de siempre. El modal de `pedir()` lo monta con la opción `dictar: '<campo>'`.
- **Las notas se titulan solas** (`analizarNota` en `secciones/notas.js`): al guardar, una llamada devuelve título, etiquetas y tipo. El patrón es **guardar primero y analizar después**, nunca bloquear al usuario esperando al LLM, y **no pisar lo escrito a mano** (`tituloManual`, `tipoManual`). Cualquier sección que adopte títulos automáticos reutiliza ese patrón.
- **Una plantilla de búsqueda sin verificar no se escribe**: el sandbox no alcanza las tiendas (el proxy las bloquea) y de cinco plantillas escritas a ojo, **cuatro fallaron** en la tienda real el 21-sep (HSN 404, Naturitas no encuentra, MyProtein en blanco, Carrefour Service Unavailable; solo iHerb bien). Cada tienda guarda `dominio` y `verificada`, y **sin plantilla se busca `site:dominio`** en un buscador general, que siempre responde. Solo llevan plantilla las comprobadas. El botón «no funciona» de cada resultado retira una plantilla sin tocar código, y la migración de `cargar()` retira las que nadie haya dado por buenas. **No añadas plantillas de búsqueda nuevas sin haberlas visto funcionar.**
- **Los datos de producto se obtienen sin evadir anti-bot** (ADR-006): el humano abre y comparte la página, la app lee JSON-LD/Open Graph con `User-Agent` identificado y obedeciendo `robots.txt`; alimentos por Open Food Facts (EAN), Amazon por Keepa con clave del usuario, agregación por la API de buscaproducto. Un bloqueo se anota en la ficha de la tienda y se deja de intentar. Nunca navegadores «stealth», proxies, navegadores remotos, APIs móviles reversadas ni cookies del usuario en el servidor. Plan por fases en `docs/planificacion/obtener-datos-de-productos.md`.
- **Los extractos bancarios se leen en `docs/app/extracto.js`**, que admite CSV, Excel (`.xlsx`) y PDF sin ninguna librería: el `.xlsx` es un ZIP de XML y los flujos del PDF van en deflate, así que basta `DecompressionStream` + `DOMParser`. Devuelve siempre `{cab, filas, origen, texto}` para que el diálogo de mapeo de columnas de Finanzas valga igual venga de donde venga el fichero. El `.xls` binario (anterior a 2007) no se admite: se avisa de que se guarde como `.xlsx`. **Un PDF de banco moderno usa fuentes Type0 (Identity-H)**: el texto va como códigos de glifo y sin el CMap `/ToUnicode` de cada fuente sale en blanco, así que `textoPDF()` recorre las páginas, resuelve `/Resources → /Font → /ToUnicode` y traduce; el barrido a pelo de los flujos queda solo de respaldo. Al reconstruir filas, una línea sin importe se cose a la anterior **solo si esa fila sigue abierta** (aún sin importe), o el pie legal de la página acabaría dentro del último concepto. Un PDF del que no salga ninguna fila ofrece, previa confirmación porque gasta crédito, que lo interprete el LLM (`finanzas-extracto`). Cualquier sección que importe ficheros del usuario reutiliza este módulo en vez de escribir su propio lector.
- **El concepto de un movimiento lo adivina la tabla `REGLAS` de `secciones/finanzas.js`**, sacada de extractos reales y ordenada (la regla más específica primero). Tiene en cuenta el signo: en un abono solo valen `transferencias`, `efectivo` o `ingresos`. `CONCEPTOS_NEUTROS` (`transferencias`, `efectivo`) no son gasto real y el resumen anual los descuenta. Al editar un movimiento a mano se marca `conceptoManual`, y **Reclasificar nunca pisa eso**: mismo criterio que los títulos automáticos de las notas. Si añades patrones, que sean genéricos de comercios o conceptos bancarios, **nunca nombres de personas**: `docs/` es público.
- **La noche se cuenta hablando, no rellenando un formulario** (`secciones/sueno.js`): el campo `relato` va **arriba del todo** del mismo formulario y los de horas debajo; al terminar el dictado (`alDictar` de `pedir()`) se llama a `sueno-relato`, que devuelve `{fecha, acostado, latencia, despertar, despierto, levantado, calidad, nota}` y **escribe en los campos abiertos** para repasarlos antes de guardar. El relato original se guarda siempre en `r.relato`: es la fuente, los campos son su interpretación. Plan B sin LLM: `interpretarLocal()` saca por reglas las horas que aparezcan —las reparte por el orden del relato— y «un cuarto de hora»; se escribe siempre antes de llamar al LLM, así que un fallo del gateway nunca deja los campos vacíos. Lo corregido a mano se marca en `r.manuales`. Una noche sin `acostado` o sin `levantado` es un registro válido (el texto no se pierde) pero queda fuera de medias y avisos: `registrosCompletos()`, no `registrosOrdenados()`.
- **`pedir()` admite botones que no cierran el diálogo** (`opciones.acciones: [{l, cargando, fn}]`): `fn` recibe `{valores, escribir, form}` y puede rellenar el formulario abierto. Es lo que permite que un agente traduzca un texto a campos sin sacar al usuario de la ventana. `opciones.alDictar` encadena lo mismo al final del dictado, y `opciones.accionesTras: '<campo>'` pega esos botones justo debajo de ese campo en vez de al final del formulario —el de interpretar la noche tiene que quedar entre lo que se ha contado y lo que va a rellenar—; cuando ese campo es además el del dictado, el micrófono comparte la misma fila.
- **Los accesos directos de Hoy viven en `docs/app/accesos.js`** (ADR-007): rejilla de 4 columnas fijas con casillas explícitas (`x`, `y`) y tamaños 1×1, 2×1 y 2×2, en `estado.accesos`. Un destino es una ruta, y `?accion=<data-a>` pulsa al llegar el botón de la sección (`lanzarAccion()` en `app.js` la quita antes de la dirección para que un repintado no la repita), así que **cualquier botón nuevo con `data-a` y sin más `data-*` se puede fijar sin tocar nada**; los de `data-id` o `peligro`, no. **Renombrar el `data-a` de un botón rompe los accesos que lo usen.** «☆ Fijar» va en la cabecera y `pedir()` pone ☆ en la ventana que abre un botón fijable (`anotarOrigen()`; cualquier otro clic en `#main` la borra). Del destino solo se guardan `v`, `vista` y `guion`. Contar usos no repinta: `persistir()` escribe sin avisar a los oyentes. Prueba de humo: `tools/prueba-accesos.mjs`.
- **Ni la latencia ni los minutos despierto son tiempo dormido**: `calcular()` los descuenta del total y el primer tramo empieza al dormirse, no al apagar la luz. Antes solo se descontaba el despertar nocturno, y como el relato hablado rellena la latencia en todas las noches, el sesgo habría sido sistemático.
- **Toda fecha se pinta en día/mes/año**: `fechaCorta()` devuelve `31/12/2025` y `fechaLarga()` le antepone el día de la semana. El ISO vive solo en los datos y en los `<input type=date>`, que ya los formatea el navegador. Un periodo mensual se escribe con `mesNombre()` («diciembre 2025»), nunca `2025-12`; `mesAbrev()` da el `dic` de las tablas. `tools/prueba-finanzas-pestanas.mjs` recorre las dieciséis secciones y falla si alguna deja escapar un `AAAA-MM-DD`.
- **Finanzas va por pestañas** (`docs/app/secciones/finanzas.js` + carpeta `finanzas/`): Movimientos (el mes y su alta manual), Importar (el módulo de carga), Informes y Recurrentes, con la ruta en `?v=`. `finanzas/calculos.js` tiene balances y clasificación —lo que consultan `reglas.js` y `menu.js`, reexportado desde `finanzas.js`—, `finanzas/importar.js` la carga entera y `finanzas/informes.js` el registro `INFORMES`. **Un informe nuevo es una entrada más en `INFORMES`** con su `render`: la pestaña pinta sola la portada, el título y el botón de volver. La ruta antigua `?vista=anio` sigue abriendo el resumen del año.
- **Un `<a>` con `data-a` navega igualmente**: `delegar()` solo hace `preventDefault()` cuando el elemento no es un enlace con destino propio (un `href` que no empiece por `#`). Cancelarlo siempre dejaba muerto el botón «abrir ↗» del Buscador, que es a la vez enlace a la tienda y acción que la marca como comprobada. Prueba de humo: `tools/prueba-buscador-abrir.mjs`.
- **El contenedor de las pestañas envuelve al del cuerpo**, así que un `data-a` de dentro burbujea hasta él: la acción de cambiar de pestaña se llama `pestana` y exige `data-v`. Al anidar dos `delegar()`, nombres de acción distintos o el de fuera se come los clics del de dentro.
- **La descripción de un movimiento importado se compone de varias columnas**: un extracto real reparte la información entre `Concepto` («Bizum»), `Movimiento` («Enviado a …») y `Observaciones`, y ninguna sola basta ni para leerla ni para que `adivinar()` acierte. El diálogo de columnas usa un campo `checks` que preselecciona las de texto conocidas y deja fuera saldo, divisa y fecha; `unirDescripcion()` las pega con « · » descartando el trozo que otro ya contiene, porque `Observaciones` suele repetir `Movimiento` en mayúsculas.
- **El cotejo de duplicados al importar tiene dos niveles y siempre pregunta**: primero fecha + importe + descripción normalizada, y con lo que sobre, fecha + importe (esos son «los mismos con otra descripción», lo que pasa al reimportar con otro mapeo de columnas; sin ese segundo nivel se duplicaría el año entero). El emparejamiento va por multiplicidad —cada fila del fichero consume un existente—, así que dos apuntes gemelos del mismo día siguen siendo dos y ningún modo cambia el número de movimientos. Reemplazar no pisa `conceptoManual`, igual que Reclasificar. Prueba de humo: `tools/prueba-importar-finanzas.mjs`.
- **Lo que se lee una vez va plegado**: `<details class="plegable">` con `<summary>` y un `<div class="cuerpo">` dentro, cerrado por defecto. El estilo está en `estilos.css` y vale para cualquier sección; las Técnicas de Sueño son el primer caso. No guarda si estaba abierto: la sección se repinta entera con cada cambio de estado.
- **Todo modal se cierra con la cruz** de su cabecera, que equivale a Cancelar: `pedir()` la pinta siempre, así que una ventana nueva la tiene sin hacer nada. Cualquier elemento con `data-cancelar` cancela.
- **La ficha de un plato tiene un formato único** (`docs/app/ficha-plato.js`, modelo: «Sopas de ajo castellana»): `Ingredientes:`, `Preparación:`, `Por ración:` y `Nota:` con el encabezado en su línea, un ingrediente por línea (coma al final, punto en el último), la preparación en uno o dos párrafos y una raya de guiones bajos entre apartados; la nota se omite si está vacía. El LLM devuelve los apartados por separado y el texto lo compone `componerFicha()`, así el formato no depende del modelo. `formatearFicha()` reordena sin LLM lo ya escrito —también lo escrito a mano, sin cambiarle una palabra— y deja intacto un texto que no reconozca; se aplica al guardar y en la migración de `cargar()`. Prueba de humo: `tools/prueba-plato-ia.mjs`.
- **El modo cocina vive en `docs/app/cocina.js`** (ruta `#/alimentacion?v=cocinar`, botón 🍳 en cada plato con ficha y en el menú del día). Paso 0: marcar ingredientes, y lo que falte va a Compra; después, un paso cada vez con «✓ Hecho», y los que tienen `min` (espera) o `cada` (remover) ofrecen temporizador. Los pasos salen primero por reglas (`pasosLocales()`: una frase de la preparación = un paso, con sus tiempos leídos por `tiempos()`) y la IA (`plato-cocinar`) los afina en segundo plano mientras se comprueban los ingredientes; se guardan en `plato.pasos` con la firma de la ficha, así que solo se piden una vez por ficha y nunca cambian a mitad de cocinar. La sesión va en su propia clave `maydom.cocina`, fuera del estado, y los relojes guardan la hora de fin: sobreviven a recargas y no repintan la app cada segundo. Aviso: pitido WebAudio (se desbloquea con el primer toque), vibración, notificación y voz opcional; la pantalla se mantiene encendida con Wake Lock. **Manos libres** (🎙): el micrófono queda abierto solo mientras la vista de cocina está delante y cada frase se busca en `ORDENES` (siguiente, repite, anterior, temporizador, cuánto queda, para); las acciones son funciones del módulo que comparten botones y voz, y lo que la app está leyendo en alto se ignora para no tomarlo como orden. Prueba de humo: `tools/prueba-cocina.mjs`, con reconocimiento de voz simulado.
- **Un plato vale para varios momentos**: `plato.momentos` es una lista (`momentosDe()` en `secciones/alimentacion.js` tolera los guardados con el antiguo `plato.tipo`). La migración vive en `cargar()` de `nucleo.js` y **se persiste al arrancar**, no solo en memoria, o se repetiría en cada carga. El formulario usa el campo `checks` de `pedir()`, que devuelve un array.
- **Los buscadores filtran en vivo** con `data-i="accion"` en `delegar()`: antirrebote de 220 ms y devolución del foco y el cursor al campo recreado, porque la acción vuelve a pintar la sección entera. `data-c` sigue siendo para cambios normales (casillas, selectores).
- **Toda función con IA pasa por `docs/app/llm.js`** (`consultar`, `pedirJSON`, `conLLM`, `textoAConsejos`, `reducirImagen`) y lleva su `operacion`. Una sección nueva con IA añade su fila a la tabla de §4.1 del plan.
- **Proyectos hermanos como referencia**: `npiobject-labs/openrouter` (el gateway: su `docs/planificacion/integracion-gestionpresupuestos.md` es la guía de integración, y `conectar.html` da de alta la aplicación) y `npiobject-labs/buscaproducto` (buscador con IA; maydom no lo reimplementa, ver ADR-005). Se clonan en la sesión para consultarlos, nunca se copian a este repo.
- `docs/holamundo.html` toma el nombre de la app de Fly del `<meta name="fly-app">` (`<repo>-<owner>`, como lo deriva `deploy.yml`). Si el proyecto define `FLY_APP` con otro nombre, actualiza ese `content` en el mismo commit.
- `app/fly.toml` no lleva clave `app`: el nombre se pasa con `--app` desde `deploy.yml`.
- El backend escucha en 8080, que es lo que espera Fly; la variable de entorno `PUERTO` solo la usa `tools/arrancar.ps1` para probar en el PC.
- Mocks estáticos en `docs/`. `docs/index.html` es el mock vivo; los anteriores se archivan en `docs/mocks/NNN-nombre.html`.
- El índice `docs/mocks/index.html` lo genera `pages.yml` en cada publicación, leyendo el `<title>` y el `<meta name="build">` de cada mock archivado. No lo edites ni lo commitees: está en `.gitignore`.
- Cada mock lleva `<meta name="build" content="MA-B1-AAAAMMDD-NNN">` con un número nuevo en cada iteración.
- Nunca pongas claves, endpoints internos ni datos reales en `docs/`: el sitio es público.

## Documentación

- Cada documento de planificación, decisión o resumen de sesión se escribe en `docs/planificacion/` de este repo, y solo ahí se edita.
- Planificación de la app en `docs/planificacion/plan-maydom.md` (secciones, menú por apartados, arquitectura, fases y deuda de desarrollo D1–D11). Se actualiza ahí cuando una fase o una deuda cambia de estado.
- `docs/planificacion/memoria/` es una bóveda de Obsidian con la memoria del mayordomo: `decisiones/` (ADR) y `preferencias/` (una nota por fecha, nunca se edita una anterior). **Léela al empezar cada sesión** (todas las decisiones y la última nota de preferencias) antes de recomendar o cambiar nada; una recomendación que contradiga un ADR aceptado lo dice y propone un ADR nuevo. La app exporta su memoria en ese formato (Mayordomo → Exportar memoria); se pega en `preferencias/` y se hace commit.
- Si existe `docs/plantilla/`, es el historial de la plantilla de origen que apartó `init-plantilla.yml`: referencia de solo lectura, nunca se edita ni se mezcla con `docs/planificacion/`.
- Si hay id de Drive en **Parámetros**, al cerrar sesión se sube copia como fichero, sin conversión a formato Google (`disableConversionToGoogleType=true`), tanto `.md` como `.html/.png/.svg`.
- No hay edición incremental en Drive: se vuelve a subir el fichero completo con el mismo nombre, o con sufijo de versión (`-v2`, `-v3`) si quieres conservar la copia anterior.

## Verificación antes de avisar

**El sandbox de la sesión no alcanza Pages, Fly ni el VPS**: `curl` a `*.github.io`, `*.fly.dev` o al VPS devuelve `CONNECT tunnel failed, response 403`. Tampoco hay daemon de Docker. Por eso **la verificación de un despliegue la hace siempre un workflow**, que corre en el runner de GitHub y sí tiene salida a internet:

- `pages.yml` no se queda en el paso `deploy-pages`, que solo prueba que el artefacto se subió: su paso final **«Verificar que Pages sirve la app»** hace `curl` a la URL publicada desde el runner y falla el run si la portada no trae el `build` de `docs/index.html`, si lo que se sirve es el README (señal de que el **Source** sigue en «Deploy from a branch») o si alguno de los ficheros de la app no responde 200. La app es modular: un solo 404 en `docs/app/` la deja en blanco, así que la lista de rutas de ese paso crece cuando se añade un módulo cargado desde el HTML. Si el run falla diciendo que se sirve el README, el arreglo es manual: Settings → Pages → Source: GitHub Actions.
- `deploy.yml` tiene un paso final que hace `curl` a `/salud` y falla el run si la respuesta no contiene el SHA del commit.

No anuncies "puedes probarlo" hasta confirmar por la API de GitHub Actions que el run del workflow para el SHA que acabas de enviar está en `success`. Si en 5 minutos no está, avisa del fallo con la causa leída en los logs, no del éxito. Al avisar, da siempre: SHA, URL y número de `build`.

Si necesitas comprobar algo desde la sesión, hazlo contra la API de GitHub (`https://api.github.com/repos/npiobject-labs/maydom/actions/runs/...`), que sí es accesible.

`pages.yml` solo se puede validar en `main`: el entorno `github-pages` únicamente despliega desde la rama por defecto, así que un `workflow_dispatch` sobre una rama de trabajo no sirve de verificación. `deploy.yml` sí acepta cualquier rama.

## Despliegue

- Estático: GitHub Pages vía `.github/workflows/pages.yml` (push a `main` publica `docs/`). Requiere **Settings → Pages → Source: GitHub Actions** una vez a mano. Se aplica también a este repo: el sitio de la plantilla estuvo sirviendo el README hasta que se hizo.
- Backend (opcional): Fly.io vía `.github/workflows/deploy.yml`. `FLY_API_TOKEN` **llega heredado de la organización `npiobject-labs`** (secreto de organización, repos públicos); no hay que crear ni guardar ningún token por proyecto. Nunca lo imprimas en los logs.
- Si el proyecto usa además un VPS con rama `release`, solo tocas `release` cuando el usuario lo pida explícitamente.
- No intentes SSH, scp, rsync ni curl al VPS, a Fly ni a `*.github.io` desde la sesión: el sandbox los bloquea.

## Aterrizaje en el PC

- Solo a petición y solo con Claude Desktop conectado: `tools/aterrizar.ps1` (idempotente, sobrescribe la copia local sin preguntar). "¿Estoy al día?" = `tools/estado.ps1`. Ambos aceptan `-Proyecto`, `-Owner`, `-Remote`, `-Root` y `-Rama`.
- `tools/arrancar.ps1` levanta la app entera en el PC sin tocar la nube: compila el backend, lo sirve en `localhost:8080` y publica `docs/` en `localhost:8081`. Acepta `-PuertoApi`, `-PuertoWeb`, `-Release` y `-SinNavegador`. Necesita Rust; no necesita Docker.
- `tools/eliminar.ps1` borra el proyecto entero: app de Fly, repositorio y copia local. Sin `-Confirmar` solo enseña el plan; con él pide escribir el nombre. Drive y las sesiones quedan a mano. Solo se ejecuta si el usuario lo pide explícitamente.
- `tools/nuevo-proyecto-V1.ps1` y `tools/eliminar-proyecto-V1.ps1` **solo existen en esta plantilla**: dan de alta y de baja un proyecto entero (repositorio, Pages, app de Fly y clon local; Drive nunca se toca, solo se apunta su id). El primero enseña el plan y pide confirmación —`-Simular` lo enseña y termina—, es reanudable y verifica por HTTP al final; el segundo simula por defecto y solo borra con `-Confirmar`. `init-plantilla.yml` los borra en los proyectos hijos y no les aplica las sustituciones de nombre, porque sus valores por defecto (`-Plantilla`, `-FlyOrg`, `-Protegidos`) nombran a la plantilla y a la organización de Fly.
- Servidas desde `localhost`, las páginas de `docs/` llaman al backend local en vez de al de Fly, tomando el puerto de `?api=` (8080 por defecto). En Pages no cambia nada.

## Cierre de sesión

- Termina cada sesión con un resumen de 5 líneas (qué cambió, SHA, URL para probar, resultado en Drive, qué falta), guárdalo en el repo en `docs/planificacion/sesiones/AAAAMMDD-HHMM.md` y, si hay id de Drive, sube copia a Drive en `sesiones/`.
- Además, entrada nueva en `docs/bitacora/AAAAMMDD-HHMM.json` (ver sección **Bitácora**).

## Bitácora

Página pública: https://npiobject-labs.github.io/maydom/bitacora.html · formato en `docs/bitacora/README.md`.

BITACORA: al cerrar sesión, además del resumen en docs/planificacion/sesiones/,
crea SIEMPRE un fichero nuevo docs/bitacora/AAAAMMDD-HHMM.json. Nunca edites ni
borres entradas anteriores, y nunca toques docs/bitacora.html ni
docs/bitacora/index.json (lo genera el workflow de Pages).

Campos: fecha (ISO con zona), titulo, objetivo, prompts (array de objetos con
texto y nota opcional), cambios (array), sha, sha_completo, run (id del run de
Actions), mock (ruta relativa al mock archivado de esa sesión), build, pagina,
fly (URL de /salud o null), pendiente (array), enlaces (array de {texto,url}),
notas. Obligatorios: fecha y titulo; el workflow falla si faltan.

Los prompts son una transcripción fiel de lo que pidió el usuario en esa sesión,
en sus términos, no un resumen de lo que hiciste. Si la sesión fue larga y la
transcripción es aproximada, dilo en el campo notas.

docs/ es público: nunca copies a la bitácora prompts que contengan claves,
rutas internas, datos personales o nombres de clientes. Si un prompt los
contiene, resúmelo en su lugar y anótalo en notas.
