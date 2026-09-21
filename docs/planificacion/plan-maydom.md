# maydom — planificación de la app

**Fecha:** 2026-09-20 · **Origen:** 16 notas de voz del 20-sep-2026 (`Todas_Las_Notas.md`, exportadas a las 20:13). **Estado:** v1, base de las fases de desarrollo.

maydom (contracción de *mayordomo*) es una app **para móvil, en HTML**, que también se usa en el PC. Un único usuario. Todo gira alrededor de un **calendario** que se rellena día a día según energía y preferencias, y de un **mayordomo** (superagente IA) que conoce todo lo que pasa en las secciones y **aconseja**, sin apuntar nada en el calendario por su cuenta.

## 1. Principios (de las notas generales)

1. **El calendario está presente en todo.** Cualquier actividad (ejercicio, comida, meditación, ocio, trabajo) se propone mirando el calendario antes.
2. **Nunca sobrecargar.** Primera regla al proponer: que el día no se sature. Segunda: respetar las preferencias vigentes.
3. **Las preferencias son variables.** El usuario no mantiene rutinas largas. Preferencias con horizonte corto (próximos días, semana, a lo sumo mes) que modulan el resto de secciones.
4. **Aconsejar, no imponer.** El mayordomo propone; el usuario prueba, rechaza o deja en espera. Solo el usuario mete cosas en el calendario.
5. **Sencillez.** Si algo exige preparar un entorno o seguir un protocolo complejo (meditación, seguimiento exhaustivo), no se hará. Todo seguimiento es "pequeño": un check, no un formulario.
6. **Búsqueda transversal.** El mismo buscador vale para un alimento, un componente electrónico, un suplemento, una actividad o un servicio, contra un catálogo de tiendas que crece y se poda.
7. **Móvil con notificaciones.** Avisos de tomas, píldoras de movimiento, actividades y stock.

## 2. Menú: orden y apartados

La nota del 20-sep 18:48 pide reordenar el menú y agruparlo bajo cabeceras. Orden decidido (de lo más diario a lo más de fondo):

| Apartado | Secciones | Por qué van juntas |
|---|---|---|
| **Hoy** | Hoy (portada) | Lo que toca ahora: agenda del día, próximas tomas, píldora de movimiento, consejos pendientes |
| **Agenda** | Calendario · Notas | Lo transversal que se usa a todas horas |
| **Cuerpo** | Ejercicio · Sueño · Meditación | Bienestar físico; el sueño es la prioridad declarada, la meditación está al servicio del sueño |
| **Mesa** | Alimentación · Suplementos · Compra | Comer, tomar y reponer. La lista de la compra unifica stock de alimentos y de suplementos |
| **Vida** | Proyectos · Ocio · Finanzas | Trabajo, tiempo libre y dinero |
| **Mayordomo** | Consejos · Preferencias · Buscador | El agente, lo que lo guía y la herramienta transversal |
| **Ajustes** | Datos y catálogos · Tiendas · Backend · Exportar/Importar | Administración dentro de la propia app (ver §5) |

En móvil: barra inferior con **Hoy · Calendario · Mayordomo · Buscar · Menú**; el menú abre el resto agrupado por apartados. En PC, el mismo menú fijo a la izquierda.

## 3. Secciones: qué hace cada una

### Hoy
Portada. Agenda del día con carga (horas ocupadas vs límite), próximas tomas de suplementos, siguiente píldora de movimiento, consejos nuevos del mayordomo, registro rápido de sueño de anoche y de comida hecha.

### Calendario
Vista día y semana. Eventos con sección de origen (ejercicio, comida, meditación, proyecto, ocio, aviso). **Regla de carga**: límite de horas planificadas al día (preferencias, por defecto 6) y aviso al superarlo. **Conflictos**: al añadir algo que choca con otro evento se pregunta si se sustituye o se descarta (nota de ocio). Planificación a corto plazo: se rellena día a día; las plantillas semanales son opcionales.

### Notas
Notas rápidas sobre cualquier área. **Se dictan** (botón de micrófono, donde el navegador lo admita) y **se titulan solas**: al guardar, el mayordomo devuelve título, etiquetas y tipo (nota, preferencia o tendencia) en una llamada. Lo escrito a mano nunca se pisa: el análisis solo rellena lo vacío. El guardado es inmediato y el análisis va después, así que una nota no se pierde por un fallo de red; mientras llega, lleva un título hecho con sus primeras palabras. Las marcadas como preferencia o tendencia alimentan a Preferencias. Búsqueda por texto, título y etiqueta, y un botón para titular en lote las que vengan de antes.

### Ejercicio
- **Catálogo** de ejercicios básicos con tipo (calistenia, kettlebell, movilidad, cardio), explicación y enlace de búsqueda en YouTube. Ampliable a mano y por el mayordomo según preferencias ("quiero calistenia" → propone ejercicios de ese tipo).
- **Tablas** (sesiones): conjunto de series a una hora; se incrustan en el calendario.
- **Seguimiento pequeño**: al terminar, check de qué series se hicieron y cuáles no. Engrosa el historial ("conocimiento de mi persona en ejercicios").
- **Píldoras de movimiento**: durante el trabajo, cada 45/60/75 min (preferencia) un ejercicio corto. Aviso + check.

### Sueño
Objetivo: **7 h de calidad**. Modelo aceptado: un tramo largo de al menos 4,5–5 h, un despertar breve y un segundo tramo de ~2 h más ligero. Registro diario mínimo: hora de acostarse, hora del despertar, minutos despierto, hora de levantarse, calidad (1–5). Cálculo de horas y racha. Técnicas (higiene de sueño, qué hacer en el despertar nocturno) enlazadas con Meditación. Es la sección donde el mayordomo pone más acento.

### Meditación
Guiones **sencillos** (2–5 min) sin preparar nada: respiración 4-6, escaneo corporal breve, cuenta descendente. Un modo específico **"despertar nocturno"**: pantalla oscura, sin luz, guion para volver a dormir. Temporizador. Se puede incrustar en el calendario.

### Alimentación
- **Menús recomendados** (saludables, según preferencias) por día/semana; el usuario acepta o cambia.
- **Seguimiento pequeño**: ¿la comida fue la del menú u otra? Registro de una línea.
- **Catálogo de platos**: cada plato tiene nombre y una **ficha** con ingredientes, preparación, nutrientes por ración y una nota; si se deja vacía, la redacta el mayordomo a partir del nombre (y respeta lo que se escriba a mano). Un plato vale para **uno o varios momentos** (casillas de desayuno, comida y cena); si no se marca ninguno, los decide el mayordomo. Búsqueda en vivo por nombre, ingrediente o etiqueta, y dos desplegables compactos para filtrar por momento y ordenar por nombre, tiempo o novedad. Un desayuno de varios pasos cabe en un solo plato, con los pasos en su ficha.
- **Stock** de alimentos en casa con umbral de reposición; cuando baja, entra en Compra. La foto del frigorífico para inferir stock queda como deuda (§7).
- Búsqueda de productos en tiendas ecológicas y supermercados (usa el Buscador con el catálogo de tiendas de alimentación).
- Ofertas por ubicación: deuda.

### Suplementos
Lista de suplementos en casa con **stock**, dosis y **hora de toma propuesta** por criterio general (ej. magnesio noche, vitamina D con comida grasa) que el usuario puede fijar a mano. Aviso de toma. **Umbral del 10 %** de stock: pasa a Compra. Buscador en tiendas online habituales.

### Compra
Lista unificada: lo que baja del umbral en Alimentación y Suplementos más lo que se añade a mano. Cada línea con tienda preferida. Marcar comprado repone stock.

### Proyectos
Proyectos de **trabajo** o **personales** con estimación de horas, horas registradas, porcentaje y fecha objetivo. Registro de horas por sesión (un botón, no un parte). **Semáforo**: proyectos sin horas en N días se marcan como rezagados. Planificación de bloques de trabajo en el calendario con **píldoras de movimiento** intercaladas (nota: el trabajo es lo más sedentario). Buena parte del trabajo se hace desde el móvil: la app no asume PC.

### Ocio
Madrid. Actividades **fijas** (las que ya hace regularmente) y **propuestas** con información, coste, duración y fecha. Preferencias de ocio: tipos y periodicidad (n veces/semana o mes). Al aceptar una propuesta que choca con otra cosa del calendario se pregunta qué se elimina. Presupuesto de ocio mensual conectado con Finanzas. La búsqueda real de eventos (agendas de Madrid) es deuda; el mayordomo propone a partir del catálogo y de lo que el usuario apunta.

### Finanzas
Movimientos de ingreso y gasto por **concepto** (categorías: vivienda, alimentación, suplementos, ocio, servicios web, IA/LLM, hosting, otros). Importación de extractos bancarios en CSV (mapeo de columnas). Suscripciones recurrentes (servidor, OpenRouter, etc.) como gastos periódicos. Balances por mes y concepto. Recomendaciones del mayordomo; ejecutar acciones queda para versiones futuras.

### Consejos (mayordomo)
El superagente. Conoce el estado de todas las secciones y propone: actividades, comidas, ejercicios, ocio, sueño, gasto. Cada consejo tiene estado: **nuevo → probar / rechazar / en espera → hecho**. Dos motores: reglas locales (funcionan sin red) y LLM vía backend (`POST /api/mayordomo` → OpenRouter). Las decisiones tomadas se guardan en la **memoria** (§5).

### Preferencias
Horizonte (próximos días / semana / mes), energía del día, foco, límite de carga diaria, intervalo de píldoras, tipos de ejercicio deseados, restricciones alimentarias, tipos de ocio y periodicidad, presupuesto. Historial de preferencias con fecha, para ver la deriva.

### Buscador
Input de qué busco + tiendas donde buscarlo (catálogo con categoría: alimentación, ecológica, suplementos, electrónica, ocio, servicios). Abre las búsquedas en cada tienda elegida. Catálogo editable: tiendas que se añaden y tiendas que se quitan porque no aportan. Las demás secciones lo invocan con la categoría prefiltrada.

## 4. Arquitectura

| Capa | Decisión | Motivo |
|---|---|---|
| Frontend | PWA estática en `docs/` (HTML + CSS + JS sin framework, módulos ES), servida por Pages y por `tools/arrancar.ps1` en local | Es lo que el flujo del proyecto publica en cada push; instalable en el móvil; sin build |
| Datos | **Local-first**: todo en `localStorage` del dispositivo (un JSON versionado), con exportar/importar | Un usuario, un móvil; sin cuentas ni servidor con estado; nada real en el sitio público |
| Backend | Rust (axum) en Fly.io, **sin estado**: `/salud`, `/holamundo`, `GET /api/estado`, `POST /api/mayordomo` | Cliente del gateway propio (§4.1); ninguna clave llega al navegador |
| LLM | **Gateway `npiobject-labs/openrouter`** (`https://apisor.oracle402.com/v1`, API de OpenAI), con clave de aplicación propia, presupuesto y `X-Operacion` por sección | Ya existe, mide el gasto por app y por operación, y corta si se pasa del presupuesto |
| Notificaciones | Notificaciones locales del navegador con la app abierta o instalada (service worker) | Push real requiere servidor con estado y suscripciones: deuda |
| Memoria del mayordomo | Bóveda **Obsidian** en `docs/planificacion/memoria/` (Markdown con frontmatter y wikilinks), en el repo | El repo es la única fuente de verdad; los agentes la leen en cada sesión; la app exporta decisiones en ese formato |
| Semillas | Catálogos iniciales en `docs/app/datos/` (ejercicios, meditaciones, técnicas de sueño, tiendas, categorías) | Editables desde Ajustes; nunca datos reales del usuario |

Esquema de datos (clave `maydom.v1` en `localStorage`): `preferencias`, `eventos[]`, `notas[]`, `ejercicios[]`, `tablas[]`, `sesionesEjercicio[]`, `sueno[]`, `alimentos[]`, `menus[]`, `comidas[]`, `suplementos[]`, `tomas[]`, `compra[]`, `proyectos[]`, `horas[]`, `ocio[]`, `movimientos[]`, `tiendas[]`, `consejos[]`, `memoria[]`, `ajustes`.

### 4.1 El LLM: gateway propio, no OpenRouter directo

El mayordomo no habla con OpenRouter: habla con el **servicio `npiobject-labs/openrouter`**, que ya hace de puerta única a OpenRouter para todas las apps del autor. Decidido en [`memoria/decisiones/ADR-004-llm-por-el-gateway.md`](memoria/decisiones/ADR-004-llm-por-el-gateway.md).

| Pieza | Dónde vive | Quién la ve |
|---|---|---|
| Clave de OpenRouter | Solo dentro del gateway | Nadie más |
| Clave de **aplicación** de maydom | Secreto `LLM_API_KEY` del repo → Fly | Solo el backend de maydom |
| Clave de **acceso** a la app | Secreto `MAYDOM_CLAVE` → Fly, y el usuario la escribe una vez en Ajustes | El navegador del usuario |

El backend de maydom manda `Authorization: Bearer <clave de aplicación>` y `X-Operacion: maydom-<sección>` (chat, menu, foto-stock, ejercicios, suplementos, ocio, sueno, finanzas, buscador), así que `GET /v1/uso/resumen?agrupar=operacion` en el gateway dice cuánto cuesta cada función. Sigue la guía de integración del gateway: reintentos solo ante 502/504 (dos, con espera creciente), timeout del cliente por encima del suyo, y los errores traducidos al español con su código (`sin_configurar`, `presupuesto_agotado`, `cuota_superada`, `bucle`). `GET /api/estado` dice si hay LLM y qué modelo, sin gastar crédito.

**Qué hace cada sección con el LLM** (todo opcional: sin clave, la app funciona con el motor de reglas):

| Sección | Función | Operación |
|---|---|---|
| Alimentación | Menú de 7 días según preferencias · **foto del frigorífico → stock** | `menu`, `foto-stock` |
| Ejercicio | Buscar ejercicios nuevos del tipo que apetece | `ejercicios` |
| Suplementos | Revisar horas de toma e interacciones (criterio general) | `suplementos` |
| Ocio | Propuestas en Madrid con coste, duración y enlace | `ocio` |
| Sueño | Analizar las últimas 14 noches → 3 acciones | `sueno` |
| Finanzas | Recomendaciones sobre el gasto del mes | `finanzas` |
| Buscador | Interpretar la petición → consulta corta + categoría | `buscador` |
| Notas | Título, etiquetas y tipo al guardar (y en lote para las antiguas) | `nota` |
| Alimentación | Ficha del plato: ingredientes, preparación, nutrientes, nota, etiquetas, momento y minutos | `plato` |
| Mayordomo | Chat y tanda de consejos | `chat` |

### 4.2 El buscador, mirando a buscaproducto

**Una plantilla de búsqueda no verificada es una promesa rota.** El 21-sep se probaron cinco en el móvil y **cuatro fallaron**: HSN daba 404, Naturitas no encontraba la página, MyProtein buscaba en blanco y Carrefour respondía «Service Unavailable»; solo iHerb devolvía resultados. Desde la sesión no se pueden verificar (el proxy bloquea esas tiendas), y con esa proporción el defecto honesto es **no inventarlas**: de fábrica una tienda se busca dentro de su web y solo las comprobadas llevan plantilla.

- Cada tienda guarda su **dominio** y una marca de **verificada**; la plantilla es opcional.
- Sin plantilla se busca **dentro del sitio** (`site:dominio` en un buscador general), que responde siempre. De las 29 tiendas, solo 4 llevan plantilla: las comprobadas.
- Cada resultado lleva un botón **«no funciona»**: un toque retira esa plantilla, sin tocar código ni esperar a una sesión.
- Quien conozca el buscador de una tienda lo pega en su ficha con `{q}`, y al abrirla queda marcada como comprobada.


`npiobject-labs/buscaproducto` ya resuelve el problema completo (agrega ofertas reales de más de 40 fuentes, extrae atributos, puntúa, deduplica, guarda histórico y alerta). maydom no lo reimplementa: su buscador es el **nivel D** de aquel proyecto —catálogo de fuentes con `{q}`, una pestaña por tienda— más la **interpretación de la consulta** por el LLM, que es lo barato y lo que más aporta. Para comparar precios de verdad, el enlace lleva a buscaproducto. Ver [`ADR-005`](memoria/decisiones/ADR-005-buscador-nivel-enlace.md).

**Y para leer el precio y la ficha de un producto concreto**, la regla es *el humano abre, la app lee*: el usuario comparte la página a maydom (Web Share Target o enlace pegado) y el backend lee sus datos estructurados (JSON-LD/Open Graph) identificándose y obedeciendo `robots.txt`; los alimentos llegan por Open Food Facts con el código de barras y Amazon por Keepa con clave del usuario. Nada de navegadores «stealth», proxies ni APIs móviles reversadas: el plan completo, con la valoración de los análisis de Grok y Antigravity y las fases P1–P5, está en [`obtener-datos-de-productos.md`](obtener-datos-de-productos.md) y la decisión en [`ADR-006`](memoria/decisiones/ADR-006-obtener-datos-sin-evadir-anti-bot.md).

## 5. ¿Necesita maydom una app de gestión? — Decisión

**No, de momento.** Razones:

- Un solo usuario. No hay roles, ni cuentas, ni moderación: lo que administraría una app aparte son **catálogos** (tiendas, ejercicios, suplementos, categorías) y **parámetros**, y eso cabe en un apartado **Ajustes** dentro de la propia app.
- La verdadera "administración" es el **repositorio**: semillas en `docs/app/datos/`, memoria del mayordomo en `docs/planificacion/memoria/`, reglas en `CLAUDE.md`. Cualquier cambio de fondo se hace desde una sesión de Code y queda en `main`.
- Un backend con estado (usuarios, sincronización, panel) multiplicaría el coste de mantenimiento y obligaría a persistencia en Fly (volúmenes) sin aportar nada al uso diario.

Se revisa si aparece un segundo usuario, si hace falta sincronizar varios dispositivos o si el agente pasa a ejecutar acciones (finanzas). Registrado en [`memoria/decisiones/ADR-001-sin-app-de-gestion.md`](memoria/decisiones/ADR-001-sin-app-de-gestion.md).

### Memoria en Obsidian

`docs/planificacion/memoria/` es una bóveda de Obsidian: se abre con "Open folder as vault". Contiene `decisiones/` (ADR con fecha, contexto, decisión, consecuencias), `preferencias/` (lo que el usuario ha dicho que quiere, con fecha) y un `README.md` con las convenciones. Los agentes la leen al empezar la sesión (regla añadida en `CLAUDE.md`). La app tiene "Exportar memoria" que genera Markdown con el mismo formato para pegar en la bóveda; la sincronización automática es deuda.

## 6. Fases

| Fase | Contenido | Estado |
|---|---|---|
| F0 | Plantilla: Pages, Fly, bitácora, tools | Hecha (plantilla) |
| F1 | Planificación (este documento), memoria Obsidian, mock de la app | Hecha 20-sep (mock 003, `docs/mocks/002-mock1.html`) |
| F2 | Núcleo PWA: shell, menú por apartados, almacenamiento local, Hoy, Calendario con regla de carga y conflictos, Notas, Preferencias, Ajustes con exportar/importar | Hecha 20-sep (build 004) |
| F3 | Cuerpo: Ejercicio (catálogo, tablas, seguimiento, píldoras), Sueño (registro, objetivo 7 h, técnicas), Meditación (guiones, temporizador, modo nocturno) | Hecha 20-sep (build 004) |
| F4 | Mesa: Alimentación (menús, seguimiento, stock), Suplementos (stock, hora, umbral 10 %), Compra unificada | Hecha 20-sep (build 004) |
| F5 | Vida: Proyectos (horas, semáforo, bloques con píldoras), Ocio (fijas, propuestas, conflictos, presupuesto), Finanzas (movimientos, CSV, recurrentes, balances) | Hecha 20-sep (build 004) |
| F6 | Mayordomo: consejos con estados, motor de reglas local, motor LLM vía backend, Buscador con catálogo de tiendas, exportar memoria | Hecha 20-sep (build 004) |
| F7 | PWA: manifest, service worker, instalación, notificaciones locales | Hecha 20-sep (build 004) |
| F8 | Backend: `POST /api/mayordomo` proxy a OpenRouter con CORS, sin clave en el cliente | Hecha 20-sep; probado en local con y sin clave. Falta la clave en Fly (D1) |
| F9 | Deuda de desarrollo (§7) | Pendiente |
| F10 | LLM por el gateway propio: funciones con IA en 8 secciones, clave de acceso, `X-Operacion`, foto del frigorífico, buscador interpretado, exportar memoria a GitHub | Hecha 21-sep (build 005) |
| F11 | Notas dictadas y tituladas por el mayordomo; dictado también en la nota rápida y en el chat | Hecha 21-sep (build 006) |
| F12 | Ficha del plato redactada por el mayordomo, con búsqueda en vivo, filtros y orden en el catálogo | Hecha 21-sep (build 007) |
| F13 | Un plato vale para varios momentos (casillas) y los filtros del catálogo pasan a desplegables | Hecha 21-sep (build 008) |
| F14 | Cruz de cerrar en todas las ventanas; catálogo de tiendas con dominio, verificación y búsqueda en el sitio por defecto | Hecha 21-sep (builds 009 a 011) |

## 7. Deuda de desarrollo

Lo que las notas piden y no se puede cerrar sin servicios externos, datos reales o decisiones del usuario:

| # | Qué | Por qué queda | Plan B / cómo se cierra |
|---|---|---|---|
| D1 | **Dar de alta maydom en el gateway** y guardar sus secretos | Hay que crear la aplicación en el gateway con la clave de administración, que no está en esta sesión | En https://npiobject-labs.github.io/openrouter/conectar.html: crear la app «maydom», ponerle presupuesto (p. ej. 3 $/mes, aviso 2, cuota 20/min) y guardar su clave como secreto `LLM_API_KEY` del repo; añadir `MAYDOM_CLAVE` (cualquier cadena larga) y escribirla en Ajustes. `deploy.yml` las vuelca a Fly. Sin ellas, el backend responde 503 y la app va con reglas |
| D2 | **Push real** (avisos con la app cerrada) | Necesita servidor con estado (suscripciones VAPID) | Añadir volumen en Fly + web-push; mientras, notificaciones locales con la app abierta/instalada |
| D3 | ~~Foto del frigorífico → stock~~ | **Hecho** (21-sep): Alimentación → Stock → «Foto del frigorífico»; la imagen se reduce a 1024 px en el móvil y va al LLM multimodal del gateway | Necesita que el modelo del gateway acepte imágenes; si no, fijar `LLM_MODELO` a uno que sí |
| D4 | **Importación bancaria automática** | Los bancos no dan API abierta sin agregador | CSV manual (hecho); agregador (PSD2) si compensa |
| D5 | **Precios y ofertas reales en tiendas** | Es un proyecto en sí mismo, y ya existe: `npiobject-labs/buscaproducto` | maydom se queda en enlace + consulta interpretada (§4.2); la agregación se consume por la API de buscaproducto. La ficha y el precio de un producto concreto sí entran en maydom, por las fases P1–P5 de [`obtener-datos-de-productos.md`](obtener-datos-de-productos.md) (compartir a maydom + JSON-LD, Open Food Facts, Keepa), sin evadir anti-bot (ADR-006) |
| D6 | **Ofertas por ubicación** | Requiere geolocalización en segundo plano y fuente de ofertas | Deuda hasta tener D2 y D5 |
| D7 | **Agenda real de ocio de Madrid** | Sin fuente estable | El mayordomo propone desde catálogo y preferencias; integrar una fuente (p. ej. datos abiertos del Ayuntamiento) más adelante |
| D12 | ~~Platos con ficha~~ | **Hecho** (21-sep, build 007): cada plato tiene ficha con ingredientes, preparación, nutrientes por ración y una nota; la redacta el mayordomo a partir del nombre. Búsqueda en vivo por nombre, ingrediente o etiqueta, filtro por momento y tres órdenes | — |
| D13 | **Dictado en navegadores sin reconocimiento de voz** | Safari en iOS y DuckDuckGo pueden no traerlo; entonces el botón no aparece | Escribir a mano, o usar Chrome. Grabar audio y transcribirlo con el LLM sería la alternativa, pero encarece cada nota |
| D8 | **Búsqueda de ejercicios en YouTube con resultados dentro de la app** | YouTube Data API con clave y cuota | Enlaces de búsqueda y catálogo ampliado por el LLM (hecho); resultados embebidos, pendiente |
| D9 | **Sincronización entre dispositivos** | Backend sin estado | Exportar/importar JSON (hecho); volumen en Fly + endpoint de estado si hace falta |
| D10 | **Sincronización automática con Obsidian** | La bóveda vive en el repo; la app en el navegador | Mayordomo → Exportar memoria abre GitHub con el fichero prellenado en `memoria/preferencias/`: un commit desde el móvil (hecho). Automatizarlo del todo exigiría un token en el cliente: no compensa |
| D14 | **P1 · Compartir a maydom y leer la ficha del producto** | Planificada el 21-sep y aplazada por el usuario; no la bloquea nada (ni clave, ni alta, ni permiso) | `share_target` en el manifest más «Pegar enlace»; `POST /api/producto/leer` con JSON-LD/Open Graph, `robots.txt` y `User-Agent` identificado; producto con `fuente` en Compra y precio manual o dictado cuando la tienda bloquea. ~4-5 h de sesión; el riesgo es extraer el JSON-LD sin meter un parser de HTML que dispare la compilación en CI. Detalle en [`obtener-datos-de-productos.md`](obtener-datos-de-productos.md) §5 |
| D15 | **P2 · Alimentos por código de barras y normalización del producto** | Íd. D14; depende solo del modelo de datos que fije D14 | `GET /api/producto/ean/{ean}` contra Open Food Facts (API abierta, sin clave), EAN tecleado y escaneado, normalización con el LLM (`maydom-producto`) y foto de etiqueta o ticket. ~4 h. El escaneo con `BarcodeDetector` no se puede verificar desde el runner: se prueba en el móvil, y el plan B es teclear el EAN |
| D11 | **El agente ejecuta acciones** (finanzas) | Las notas lo dejan para "próximas versiones" | Solo cuando haya aprobación explícita por consejo |

## 8. Estado tras la sesión del 20-sep

Verificado en el sandbox: prueba de humo con Chromium (Playwright) que recorre las 17 pantallas y ejecuta las acciones principales (evento con conflicto y sustitución, rellenar el día, registro de sueño con tramos, alta de suplemento con hora sugerida y paso a Compra, sesión de trabajo con horas, ideas y aceptación de ocio, movimientos y CSV bancario, menú propuesto y comida registrada, sesión de ejercicio, modo nocturno, consejos por reglas, buscador) sin errores de JS. Backend compilado y probado en local: 503 sin clave, 200 con un OpenRouter simulado, preflight CORS. Pendiente de verificar en Pages y Fly tras fusionar a `main`.

## 9. Verificación

- Pages: run de `pages.yml` en `success` para el SHA publicado; la app en https://npiobject-labs.github.io/maydom/ .
- Backend: run de `deploy.yml` en `success`; `/salud` devuelve el SHA. `/api/mayordomo` sin clave devuelve 503 con mensaje claro (comprobable con `curl` desde el runner, no desde la sesión).
- Cada iteración de la app sube el `build` (`MA-B1-AAAAMMDD-NNN`) y archiva la anterior en `docs/mocks/`.
