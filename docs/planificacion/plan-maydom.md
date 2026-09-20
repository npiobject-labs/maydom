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
Notas rápidas sobre cualquier área, con etiquetas por sección (`ejercicio`, `alimentacion`, `proyecto`, …). Una nota puede marcarse como **preferencia** o **tendencia**, y entonces alimenta a Preferencias. Búsqueda por texto y etiqueta.

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
| Backend | Rust (axum) en Fly.io, **sin estado**: `/salud`, `/holamundo`, `POST /api/mayordomo` (proxy a OpenRouter con la clave en secreto de Fly) | La clave de OpenRouter nunca va al navegador; el resto no necesita servidor |
| Notificaciones | Notificaciones locales del navegador con la app abierta o instalada (service worker) | Push real requiere servidor con estado y suscripciones: deuda |
| Memoria del mayordomo | Bóveda **Obsidian** en `docs/planificacion/memoria/` (Markdown con frontmatter y wikilinks), en el repo | El repo es la única fuente de verdad; los agentes la leen en cada sesión; la app exporta decisiones en ese formato |
| Semillas | Catálogos iniciales en `docs/app/datos/` (ejercicios, meditaciones, técnicas de sueño, tiendas, categorías) | Editables desde Ajustes; nunca datos reales del usuario |

Esquema de datos (clave `maydom.v1` en `localStorage`): `preferencias`, `eventos[]`, `notas[]`, `ejercicios[]`, `tablas[]`, `sesionesEjercicio[]`, `sueno[]`, `alimentos[]`, `menus[]`, `comidas[]`, `suplementos[]`, `tomas[]`, `compra[]`, `proyectos[]`, `horas[]`, `ocio[]`, `movimientos[]`, `tiendas[]`, `consejos[]`, `memoria[]`, `ajustes`.

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
| F1 | Planificación (este documento), memoria Obsidian, mock de la app | Esta sesión |
| F2 | Núcleo PWA: shell, menú por apartados, almacenamiento local, Hoy, Calendario con regla de carga y conflictos, Notas, Preferencias, Ajustes con exportar/importar | Esta sesión |
| F3 | Cuerpo: Ejercicio (catálogo, tablas, seguimiento, píldoras), Sueño (registro, objetivo 7 h, técnicas), Meditación (guiones, temporizador, modo nocturno) | Esta sesión |
| F4 | Mesa: Alimentación (menús, seguimiento, stock), Suplementos (stock, hora, umbral 10 %), Compra unificada | Esta sesión |
| F5 | Vida: Proyectos (horas, semáforo, bloques con píldoras), Ocio (fijas, propuestas, conflictos, presupuesto), Finanzas (movimientos, CSV, recurrentes, balances) | Esta sesión |
| F6 | Mayordomo: consejos con estados, motor de reglas local, motor LLM vía backend, Buscador con catálogo de tiendas, exportar memoria | Esta sesión |
| F7 | PWA: manifest, service worker, instalación, notificaciones locales | Esta sesión |
| F8 | Backend: `POST /api/mayordomo` proxy a OpenRouter con CORS, sin clave en el cliente | Esta sesión (la clave se pone a mano en Fly, ver §7) |
| F9 | Deuda de desarrollo (§7) | Pendiente |

## 7. Deuda de desarrollo

Lo que las notas piden y no se puede cerrar sin servicios externos, datos reales o decisiones del usuario:

| # | Qué | Por qué queda | Plan B / cómo se cierra |
|---|---|---|---|
| D1 | **Clave de OpenRouter en Fly** | El sandbox no tiene la clave. [SUPUESTO] el usuario tiene cuenta en OpenRouter | `flyctl secrets set OPENROUTER_API_KEY=... --app maydom-npiobject-labs`; opcional `OPENROUTER_MODEL`. Sin clave, el backend responde 503 y la app usa solo el motor de reglas |
| D2 | **Push real** (avisos con la app cerrada) | Necesita servidor con estado (suscripciones VAPID) | Añadir volumen en Fly + web-push; mientras, notificaciones locales con la app abierta/instalada |
| D3 | **Foto del frigorífico → stock** | Requiere modelo de visión y flujo de fotos | Enviar la foto a `/api/mayordomo` con un modelo multimodal cuando D1 esté; mientras, stock a mano |
| D4 | **Importación bancaria automática** | Los bancos no dan API abierta sin agregador | CSV manual (hecho); agregador (PSD2) si compensa |
| D5 | **Precios y ofertas reales en tiendas** | Sin API pública; scraping frágil | El buscador abre las búsquedas en cada tienda; catálogo se poda a mano |
| D6 | **Ofertas por ubicación** | Requiere geolocalización en segundo plano y fuente de ofertas | Deuda hasta tener D2 y D5 |
| D7 | **Agenda real de ocio de Madrid** | Sin fuente estable | El mayordomo propone desde catálogo y preferencias; integrar una fuente (p. ej. datos abiertos del Ayuntamiento) más adelante |
| D8 | **Búsqueda de ejercicios en YouTube con resultados dentro de la app** | YouTube Data API con clave y cuota | Enlaces de búsqueda (hecho) |
| D9 | **Sincronización entre dispositivos** | Backend sin estado | Exportar/importar JSON (hecho); volumen en Fly + endpoint de estado si hace falta |
| D10 | **Sincronización automática con Obsidian** | La bóveda vive en el repo; la app en el navegador | Exportar memoria en Markdown (hecho); un workflow que reciba el export es el siguiente paso |
| D11 | **El agente ejecuta acciones** (finanzas) | Las notas lo dejan para "próximas versiones" | Solo cuando haya aprobación explícita por consejo |

## 8. Verificación

- Pages: run de `pages.yml` en `success` para el SHA publicado; la app en https://npiobject-labs.github.io/maydom/ .
- Backend: run de `deploy.yml` en `success`; `/salud` devuelve el SHA. `/api/mayordomo` sin clave devuelve 503 con mensaje claro (comprobable con `curl` desde el runner, no desde la sesión).
- Cada iteración de la app sube el `build` (`MA-B1-AAAAMMDD-NNN`) y archiva la anterior en `docs/mocks/`.
