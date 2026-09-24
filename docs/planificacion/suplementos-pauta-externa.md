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

## 9. Variante: notas de compra en lugar de fotos (análisis, 24-sep 17:46)

**La idea**: en vez de fotografiar los botes, pasar al modelo la nota de compra de cada tienda (el correo de confirmación, la factura en PDF o el historial de pedidos). De ahí sale el enlace al producto, y del enlace, toda la información.

**Veredicto: el pedido sirve muy bien para identificar el producto, pero no para saber qué lleva.** La composición sigue saliendo mejor de la etiqueta. Como complemento de las fotos suma mucho; como sustituto, falla justo en el dato que más importa.

**Lo que aporta el pedido**

- **Identificación exacta**: marca, producto y presentación (25 o 50 mg, 60 o 120 cápsulas). La foto de un frente a veces no la deja clara.
- **Varios suplementos en un solo documento**, y sin tener los botes delante.
- **Tienda y enlace para volver a comprar**: rellenan el campo «Tienda habitual» que la ficha ya tiene y sirven al Buscador y a Compra cuando vuelva el stock.
- **Precio y fecha**: con las unidades por envase y las de la pauta, sale **cuánto cuesta cada suplemento al mes**. Es un extra para Finanzas, no para ahora.

**Dónde falla la cadena pedido → enlace → composición**

1. **Muchos pedidos no traen un enlace útil.** Una factura en PDF suele llevar el nombre y la referencia, no la URL. Los correos llevan enlaces de seguimiento que redirigen o caducan. Un tique de farmacia o de herbolario abrevia el nombre.
2. **La página puede no abrirse.** El chat solo lee una página si la tienda deja entrar a un robot, y aquí ya sabemos que muchas no lo hacen: 12 de 29 tiendas del catálogo rechazan a un robot, y de cinco plantillas de búsqueda escritas a ojo fallaron cuatro. Forzarlo contradice el ADR-006. [SUPUESTO] el lector web del chat choca con los mismos bloqueos; plan B: la captura del usuario (punto 5).
3. **Aunque se abra, la composición suele estar en una imagen**, la foto de la tabla del envase, y no en el texto. Los datos estructurados de la página (JSON-LD, Open Graph) dan nombre, marca, EAN y precio, pero nunca la composición.
4. **La página no tiene por qué ser del bote que tienes.** Enseña la variante por defecto o la fórmula actual; el bote de casa puede ser de otra concentración o de antes de un cambio de fórmula. **La etiqueta del bote es lo que tomas.**
5. **Donde la página sí vale es abierta por ti**: una captura de la sección de composición en tu navegador (el ADR-006 la da por buena, porque es el humano quien abre la página) cuesta lo mismo que la foto del bote y no depende de robots.
6. **Los pedidos llevan datos personales**: nombre, dirección, teléfono, número de pedido y últimos dígitos de la tarjeta. En tu chat no importa, pero el modelo no debe copiarlos a los ficheros.

**Propuesta: aceptar cualquier mezcla y ordenar las fuentes por fiabilidad.** Cada suplemento puede llegar por foto, texto, pedido o enlace, y en «Fuente» se anota de dónde sale la composición:

1. `etiqueta`: la foto de la tabla del bote. Es la mejor.
2. `web`: la página del producto, en una captura tuya o abierta por el modelo si la tienda lo deja, **con la variante comprobada** contra la del pedido.
3. `conocida`: de memoria. Hay que confirmarla.
4. `falta`.

Del pedido se sacan identificación, tienda, enlace limpio (sin seguimiento), precio y fecha. Si el modelo no puede abrir un enlace, lo dice y pide la captura; nunca rellena en silencio.

**Cambios si se adopta** (pocos, no aplicados todavía):

- **Prompt 1**: aceptar notas de compra y enlaces además de fotos y textos; sacar de un pedido solo los suplementos, ignorando el resto y los datos personales; comprobar la presentación exacta; y pedir captura o foto cuando un enlace no abra o la composición sea una imagen que no ve.
- **`formato-entrada.md`**: columnas **Tienda**, **Enlace** y **Presentación** (concentración y unidades por envase), y el valor `web` en «Fuente».
- **`formato-salida.md`**: «Tienda» y «Enlace» en la sección «Suplementos», para que al importar queden en la ficha.

**Cómo probarlo antes de decidir**, como se hizo con las plantillas de búsqueda (nada se da por bueno sin verlo funcionar): tres pedidos reales (uno de iHerb, uno de Amazon y otro de una tienda española) en un chat con el prompt 1. Se apunta de cuáles saca la composición sola, con `Fuente = web` y la variante correcta, y para cuáles pide captura. Con eso se sabe, tienda por tienda, si el pedido basta o hace falta la foto.

## 10. El proceso recurrente: skill + almacén + captura (24-sep 18:15)

Decidido con el usuario. La primera versión del procedimiento hacía una pauta de golpe; la de verdad tiene que **acumular**: hoy tres suplementos, dentro de unos días otro, sin perder lo guardado y sin repetir prompts.

**Cómo se consiguen los datos de cada suplemento (lo más sencillo para quien compra online)**: los enlaces salen de «Mis pedidos» de cada tienda; el modelo abre cada página y rellena la tabla; donde la tienda bloquee o la composición sea una imagen, una captura de la sección «Composición» desde el móvil. La factura no vale como origen (sin composición, sin enlace útil, con datos personales) y la foto del bote queda como comprobación de los que suman con otros (multi, zinc, magnesio, D).

**Las tres piezas, todas dentro de Claude y con la suscripción Max:**

| Pieza | Herramienta | Qué hace |
|---|---|---|
| Proceso | **Skill «suplementos»** en claude.ai (Ajustes → Capacidades → Skills) | Se activa solo al hablar de suplementos. Tres modos: **añadir** (identificar desde enlace, foto, pedido o texto y meter en la tabla sin duplicar ni renumerar ID), **pauta** (generar `pauta-suplementos.md`) y **revisar** (segunda opinión). Fuente: [`suplementos/skill/suplementos/`](suplementos/skill/suplementos/SKILL.md); paquete [`suplementos/skill/suplementos.zip`](suplementos/skill/suplementos.zip) (el `.skill` es el mismo zip). Sin ningún dato personal. |
| Almacén | **Conector de Google Drive** (o un Claude Doc) | `suplementos-entrada.md`, `perfil.md` y `pauta-suplementos.md` en una carpeta privada del Drive del usuario. El skill los lee y los guarda; si no puede escribir, devuelve el fichero completo en un bloque de código. [SUPUESTO] el conector de Drive de claude.ai escribe, no solo lee (en esta sesión tiene `update_file`); plan B: reemplazar el fichero a mano. Alternativa: Claude Docs, una tabla que Claude edita en el sitio; [SUPUESTO] activo en su claude.ai. |
| Captura | **Claude en Chrome** | Navega con el navegador y la sesión del usuario: abre «Mis pedidos» y lee la composición aunque la tienda bloquee robots (patrón del ADR-006: el humano abre, Claude lee). [SUPUESTO] disponible en su plan y región; plan B: pegar enlaces y capturas. |

Lo que no sirve: la memoria de Claude (resume, no guarda tablas), las tareas programadas (el proceso es a voluntad) y las sesiones de Claude Code (el sandbox no alcanza las tiendas).

**Reglas que hacen que acumular funcione** (están en el skill): los ID son para siempre (`S15` después de `S14`, aunque falte `S09`), un suplemento que se deja se marca `retirado` y no se borra, «ya existe» se decide por marca + producto + presentación, ninguna fila se reescribe sin decirlo, y la pauta se pide aparte cuando la tabla o el perfil cambian.

**Este proyecto (maydom) no guarda datos del usuario**: el repositorio es público. La tabla y la pauta reales viven en su Drive y, cuando exista el importador, en su móvil. Aquí solo están el skill, los formatos y el análisis.

**Próxima sesión**: primera inclusión de un suplemento en Drive con el usuario delante: (1) subir el zip a claude.ai como skill; (2) crear la carpeta en Drive con `perfil.md` relleno y `suplementos-entrada.md` vacío (la cabecera de `formato-entrada.md`, sin filas de ejemplo); (3) activar el conector de Drive; (4) en un chat con Fable 5.1 y razonamiento extendido, pegar un enlace de «Mis pedidos» y decir «añade este suplemento»; (5) comprobar en Drive que la fila está y que la cabecera no cambió. Después el usuario sigue solo.
