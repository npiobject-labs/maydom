# Suplementos: pauta hecha fuera con el mejor modelo e importada como fichero

**Fecha:** 2026-09-24 (revisado a las 18:10) · **Estado:** propuesta, pendiente de decisión · **Sustituye como fase 1 a** [`suplementos-especialista.md`](suplementos-especialista.md): el agente integrado queda para más adelante, si hace falta · **Ficheros:** [`suplementos/prompt-especialista.md`](suplementos/prompt-especialista.md), [`suplementos/perfil.md`](suplementos/perfil.md), [`suplementos/formato-entrada.md`](suplementos/formato-entrada.md) y [`suplementos/formato-salida.md`](suplementos/formato-salida.md)

## 1. El procedimiento

1. El usuario pasa al chat (Fable 5.1 u Opus 5.5) **una colección de fotos y textos, uno por suplemento**, junto con su **perfil** (jornada, entreno, salud, objetivos) y los dos formatos.
2. **Paso 1 · identificar**: el modelo reconoce cada suplemento y genera la **tabla de entrada** (`suplementos-entrada.md`) con su composición. **Se para** para que el usuario la revise.
3. **Paso 2 · la pauta**: con la entrada confirmada, el modelo genera `pauta-suplementos.md`, que es la tabla de entrada con **pauta y dosis** (cuándo y cuánto), más avisos, totales y preguntas.
4. Segunda opinión con el otro modelo y, si hace falta, corrección.
5. `pauta-suplementos.md` se importa en maydom con un botón **«Importar pauta»** y alimenta la toma diaria. Sin seguimiento de tomado o no tomado, y sin avisos de stock.

Cambios respecto a la primera versión (17:23): el paso de identificación a partir de fotos y textos, y **Markdown en lugar de Excel**. Las plantillas `.xlsx` se retiran.

## 2. El formato: Markdown, sí

`.md` con tablas de Markdown y una cabecera `---` que dice qué formato y qué versión es (`formato: maydom-suplementos-pauta/1`). Es la opción adecuada:

- **El modelo lo escribe de forma natural** y el chat lo enseña como tablas. No hay que convertir nada en ningún sentido, a diferencia del `.xlsx`.
- **Se lee y se corrige en cualquier sitio**: el móvil, GitHub u Obsidian (la memoria del mayordomo ya es una bóveda de Obsidian con este mismo estilo de cabeceras).
- **Un solo fichero** con todo (jornada, suplementos, pauta, avisos, totales, preguntas). Un CSV necesitaría uno por tabla.
- **La app lo lee sin librerías**: secciones `## …` y filas `| … |`. Es más simple que leer un `.xlsx`.

Descartados: **JSON** (robusto para la máquina, pero ni se lee ni se corrige a mano, y un error de comillas lo invalida entero); **CSV** (comas dentro de los textos y un fichero por tabla); **YAML** (un fallo de sangría lo rompe); **Excel** (binario, y cada vuelta por el chat pide descargar, subir y convertir).

El único punto débil de Markdown es que **una barra `|` o un salto de línea dentro de una celda desmontan la fila**. Lo evitan tres cosas: las reglas del formato, que el modelo compruebe antes de entregar que cada fila tiene tantas celdas como su cabecera, y la validación de la app al importar, que dirá qué línea falla.

## 3. ¿Tiene algún problema el procedimiento nuevo?

Ninguno que lo tumbe. Hay siete que conviene tener en cuenta, y todos quedan resueltos en el prompt o en los formatos:

| # | Problema | Cómo queda resuelto |
|---|---|---|
| 1 | **La foto del frente no trae la composición.** La tabla suele estar detrás o en un lateral. Con solo el frente, el modelo tiende a «recordar» la composición del producto, y ahí es donde se equivoca sin avisar. | Columna **Fuente**: `etiqueta` (leída), `conocida` (de memoria, **hay que confirmarla**) o `falta`. Además, **Confianza** en la identificación, y las fotos que falten se piden en «Dudas». La instrucción práctica es mandar siempre la foto de la tabla de composición. |
| 2 | **Varias fotos del mismo producto.** | Van en una sola fila, y la columna **Origen** dice de qué fotos sale. Si no está claro, el modelo pregunta. |
| 3 | **Elemento o compuesto.** «Bisglicinato de magnesio 1000 mg» aporta unos 200 mg de magnesio. Confundirlos multiplica la dosis. | La regla obliga a escribir la cantidad del elemento o principio activo, con la forma química entre paréntesis. |
| 4 | **Un error al identificar se arrastra** a la dosis y al horario. | **Pausa tras el paso 1**: el modelo entrega la entrada con sus dudas y espera. Cuesta un «sigue». Si se quiere de un tirón, «sin pausa» en el mismo mensaje. |
| 5 | **De las fotos no sale el perfil**, y la medicación es lo que más cambia la pauta. | `perfil.md`: se rellena una vez y se reutiliza. Si falta un dato importante, el modelo lo pregunta en la pausa. |
| 6 | **El repositorio es público.** La pauta y el perfil son datos de salud reales. Si «pasármela» significa meterla en el código, iría a parar a `docs/`, y eso no puede ser. | **La pauta real no se commitea.** Llega a la app con «Importar pauta», que la guarda solo en el móvil. Si me la pasas en una sesión, la uso para comprobar el formato y probar el importador, sin subirla. El fichero de salida tampoco lleva la medicación ni las analíticas. |
| 7 | **Copiar una tabla ya pintada en el chat del móvil pierde las barras.** | El prompt pide un `.md` descargable o, si no puede, el fichero entero dentro de un bloque de código, que se copia exacto con su botón. |

Lo que ya estaba resuelto en la versión anterior sigue igual: columnas para la máquina además de «Pauta» y «Dosis», una fila por toma, días como letras de la semana, **Motivo**, **Avisos**, **Totales** frente al límite de EFSA, y **segunda opinión** con el otro modelo.

## 4. Bondades

- **Cero desarrollo para tener la pauta**, y ahora **tampoco hay que teclear la composición**: basta con fotografiar los botes.
- **El mejor modelo sin los límites de la app**: ni los 120 s del gateway, ni tope de tokens, ni presupuesto del gateway, porque va en la suscripción.
- **Conversación**: pregunta antes de decidir, se le puede discutir y, con la pausa, el usuario revisa el paso más propenso a errores.
- **Un documento que se lee**: el usuario lo corrige a mano y lo enseña al médico o al farmacéutico.
- **La app se queda sencilla y local** (ADR-002): importar un fichero de texto y enseñarlo.

## 5. Qué modelo

- **Claude Fable 5.1**, si el plan lo tiene. Es el más capaz de Anthropic, lee bien las fotos, y en el chat su precio (dos veces y media el de Opus 5.5 por token en la API) no cuenta. [SUPUESTO] que el plan del usuario lo ofrece; plan B, Opus 5.5.
- **Claude Opus 5.5**, con razonamiento extendido: para la segunda opinión si la pauta la hace Fable 5.1, o como primera opción si Fable no está.
- **Siempre con razonamiento extendido** y en un chat nuevo.
- **Búsqueda web**: no hace falta. Solo sirve para confirmar un límite concreto.
- **Otros proveedores**: no tengo datos para decir que alguno lo haga mejor. Lo que mejora el resultado es la segunda opinión con un modelo distinto.

## 6. Paso a paso

1. Rellenar `perfil.md` (una vez).
2. Fotografiar cada bote, siempre con **la tabla de composición**. Añadir texto donde haga falta: cómo lo tomas ahora, para qué, o «fijado por mí».
3. Chat nuevo con Fable 5.1 y razonamiento extendido. Adjuntar fotos, textos, `perfil.md`, `formato-entrada.md` y `formato-salida.md`. Pegar el **prompt 1**.
4. Revisar `suplementos-entrada.md`, sobre todo las filas con `Fuente = conocida` o `Confianza = baja`. Corregir o mandar las fotos que pida, y escribir «sigue».
5. Descargar `pauta-suplementos.md`.
6. **Prompt 2** en otro chat con Opus 5.5: la segunda opinión. Si trae discrepancias altas o medias, **prompt 3** en el primer chat, y consultar lo que siga sin acuerdo.
7. Pasarme la pauta **sin subirla al repositorio** (adjunta en la sesión): compruebo que cumple el formato y con ella programo y pruebo el importador. Después, «Importar pauta» en el móvil.

## 7. Lo que hará la app (cuando se programe; hoy no se toca nada)

- **«📥 Importar pauta»** en Suplementos: elegir el fichero `.md` o pegar su texto. Se comprueba la cabecera `formato: maydom-suplementos-pauta/1` y se leen las secciones por su título.
- **Validación sin LLM**, con el número de línea: secciones y cabeceras exactas, celdas por fila, valores cerrados, horas `HH:MM`, días válidos, todos los ID de «Suplementos» presentes en «Pauta», y cada ID no suspendido con al menos una toma.
- **Vista previa con diferencias** (nuevos, cambian, se suspenden) antes de escribir nada. La pauta importada **sustituye** a la lista actual; lo suspendido queda archivado y visible.
- **Toma diaria**: Suplementos y Hoy enseñan las tomas del día agrupadas por hora según el día de la semana, con la dosis en unidades. Es la vista «Tu día con la pauta» del mock 004; los días ya vienen resueltos, así que sobra el selector de entreno o descanso.
- **Avisos, totales y preguntas** legibles en la sección, y en cada ficha la pauta, la dosis, el motivo y la composición.
- **Fuera**: «Tomado», el stock, el paso a Compra y el consejo de la toma de la noche. Se ocultan, no se borran.
- Con la **Jornada** dentro del fichero, la app podrá recalcular horas más adelante si cambias el entreno, sin volver al modelo.
- Prueba de humo del importador con el ejemplo de `formato-salida.md`, que ya cumple el formato: comprobado que cada fila tiene sus celdas y que coinciden los ID.

## 8. Supuestos

- [SUPUESTO] **El chat de claude.ai entrega ficheros `.md` descargables.** Plan B: el prompt pide, si no puede, el fichero dentro de un bloque de código, que se copia exacto.
- [SUPUESTO] **El plan del usuario incluye Fable 5.1.** Plan B: Opus 5.5 para la pauta y Sonnet 5 para la segunda opinión.
- [SUPUESTO] **La pausa se respeta.** Los modelos suelen parar cuando se les pide, pero puede que alguno siga. Plan B: si sigue sin parar, revisar igualmente la sección Suplementos de la pauta antes del prompt 2.
