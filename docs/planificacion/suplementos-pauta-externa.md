# Suplementos: pauta hecha fuera con el mejor modelo e importada como tabla

**Fecha:** 2026-09-24 · **Estado:** propuesta, pendiente de decisión · **Sustituye como fase 1 a** [`suplementos-especialista.md`](suplementos-especialista.md) (el agente integrado pasa a «más adelante, si hace falta») · **Ficheros:** [`suplementos/prompt-especialista.md`](suplementos/prompt-especialista.md), [`suplementos/plantilla-entrada.xlsx`](suplementos/plantilla-entrada.xlsx), [`suplementos/formato-salida.xlsx`](suplementos/formato-salida.xlsx)

## 1. La idea del usuario

En vez de meter un agente en la app:

1. Una **tabla de entrada** (Excel u Hojas de Drive) con cada suplemento y su composición.
2. Un **prompt** que el usuario pega en un chat con Opus 5.5 (o con un modelo mejor), junto a la tabla.
3. El modelo devuelve **la misma tabla con dos campos más: pauta y dosis**.
4. En Suplementos, un botón **«Importar pauta»** que carga esa tabla en la toma diaria.
5. Sin seguimiento de «tomado / no tomado» y sin avisos de stock: el usuario lo ve cada día. La reposición se resuelve aparte.

## 2. Veredicto

**Es mejor fase 1 que el agente integrado.** Da el mismo resultado de fondo (el modelo más capaz, pensando todo lo que haga falta) hoy mismo y sin programar nada, y deja en la app solo lo sencillo: importar y enseñar. El agente integrado solo compensa si la pauta hubiera que rehacerla a menudo, y con una lista que cambia pocas veces al año no es el caso.

Hay que corregir dos cosas: **con dos campos de texto libre no se puede importar de forma fiable**, y **se pierde el porqué** (los avisos). Las dos se arreglan con el formato de salida (§4) sin complicarle la vida al usuario, porque esas columnas las rellena el modelo, no él.

## 3. Bondades

- **Cero desarrollo para tener la pauta**: se puede hacer esta misma tarde.
- **El mejor modelo, sin sus límites en la app**: en el chat no hay tope de 120 s del gateway, ni de tokens, ni hay que elegir modelo en el backend, y el razonamiento extendido puede ir al máximo. El coste va en la suscripción, no en el presupuesto del gateway.
- **Conversación**: el modelo puede **preguntar antes** (medicación, una etiqueta que no se lee) y se le puede discutir la pauta. El agente integrado solo podía devolver preguntas y esperar a la siguiente llamada.
- **Lee fotos de etiquetas**: no hace falta copiar la composición a mano; basta adjuntar la foto de cada etiqueta con su ID.
- **Segunda opinión barata**: el mismo prompt con otro modelo y comparar. Donde discrepan es justo lo que hay que consultar.
- **Un documento auditable**: la tabla se lee, se corrige a mano, se guarda y se le enseña al médico o al farmacéutico.
- **La app se queda sencilla y local**: importar un fichero y enseñarlo encaja con el ADR-002 (datos en el dispositivo) y reutiliza `docs/app/extracto.js`, que ya lee `.xlsx` y CSV sin librerías.
- **El análisis anterior no se tira**: el contrato por anclas, las vistas de pauta y de ficha del mock 004 y los límites de la tabla siguen valiendo; solo cambia de dónde sale la pauta.

## 4. Críticas y cómo se corrigen

| # | Problema | Corrección |
|---|---|---|
| 1 | **«Pauta» y «Dosis» en texto libre no se importan bien.** La toma diaria necesita un momento y una hora, días de entreno frente a días de descanso, días alternos y a veces dos tomas del mismo producto. Interpretar «después de entrenar, y los otros días con el desayuno» exigiría otro LLM al importar. | Se quedan las dos columnas legibles que pide el usuario, **Pauta** y **Dosis**, y el modelo rellena además unas cuantas para la máquina: **Momento** (lista cerrada), **Desfase**, **Hora**, **Días** (letras de la semana), **Unidades por toma** y **Unidad**. Además, **una fila por toma**: un suplemento con dos tomas ocupa dos filas con su ID. |
| 2 | **Se pierde el porqué.** Lo que más vale del especialista son los avisos: el Complejo B se suspende porque suma 30 mg de B6. Con solo dos campos el usuario importaría un horario sin saberlo. | Columna **Motivo** y **Acción** (mantener, ajustar, suspender o consultar) en cada fila, y tres hojas más: **Avisos**, **Totales** (cada nutriente frente a su límite) y **Preguntas** (datos que faltan y cosas para el médico). |
| 3 | **Nadie comprueba al modelo.** En el diseño integrado lo hacía una tabla local de límites. | La hoja **Totales** obliga al modelo a sumar y comparar con el límite, el prompt le pide revisar antes de entregar, y está la **segunda opinión** con el otro modelo. Al importar, la app comprueba lo mecánico (ID, valores cerrados, horas válidas); la tabla local de límites puede venir después. |
| 4 | **La composición manda.** Si entra mal («magnesio 400 mg» cuando es el peso del bisglicinato y no del magnesio), la dosis sale mal. | Columna **Composición por unidad** con la forma química y la opción de **mandar fotos de las etiquetas**. El prompt pide preguntar si algo no se lee. |
| 5 | **La hora queda fija en la tabla.** Si el entreno pasa de las 18:30 a las 07:00, la pauta no se mueve sola. | La tabla guarda **Momento + Desfase** además de la hora. Hoy basta con editar la hora a mano o repetir el prompt; más adelante, la app puede recalcular con la jornada sin volver al modelo. |
| 6 | **La app no puede leer Hojas de Drive directamente**: es un sitio estático sin sesión de Google, y los datos del usuario no pasan por servidores (ADR-002). | Desde Hojas: **Archivo → Descargar → Microsoft Excel (.xlsx)** y en maydom «Importar pauta». Si se usa CSV, hay que bajar solo la hoja «Pauta». |
| 7 | **`extracto.js` solo lee la primera hoja** de un `.xlsx`. | «Pauta» va **la primera** en el formato de salida, y el prompt lo exige. Para leer también «Avisos» hay que ampliar `extracto.js` para que busque una hoja por su nombre; es un cambio pequeño y reutilizable. |
| 8 | **Sin seguimiento ni stock** desaparecen cosas que hoy existen: el botón «Tomado», el consejo «Toma de la noche pendiente» de `reglas.js` y el paso a Compra al 10 %. | Es lo que pide el usuario. Al programar, esas piezas se ocultan, no se borran: si algún día vuelve el stock, la dosis ya estará en unidades por toma y el descuento será directo. |
| 9 | **La medicación y las analíticas salen hacia el chat.** | Es la cuenta del propio usuario y no pasa por maydom. El prompt no necesita nombre ni ningún dato que identifique. |

## 5. Qué modelo

- **Claude Fable 5.1**, si el plan lo tiene: es el más capaz de Anthropic que está disponible, y en el chat su precio (dos veces y media el de Opus 5.5 por token en la API) no cuenta. Para una tarea que se hace pocas veces al año y donde un error se paga en salud, es la elección. [SUPUESTO] que el plan del usuario lo ofrece; plan B, Opus 5.5.
- **Claude Opus 5.5**, con razonamiento extendido: muy bueno en esto y más rápido. Es el que mejor queda para **la segunda opinión** si la pauta la hace Fable 5.1, o como primera opción si Fable no está.
- **Siempre con razonamiento extendido** y en un chat nuevo, sin conversación previa que despiste.
- **Búsqueda web**: opcional. Sirve para confirmar un límite concreto (por ejemplo, la melatonina en España), pero cuanto más busca, más tarda y más se dispersa; no hace falta para la pauta.
- **Otros proveedores**: no tengo datos para decir que alguno lo haga mejor en esta tarea. Lo que sí mejora el resultado es comparar dos modelos distintos.

## 6. El flujo, paso a paso

1. Rellenar `plantilla-entrada.xlsx`: hoja **Suplementos** (una fila por producto; composición o foto) y hoja **Perfil** (medicación, analíticas, jornada, entreno, sueño, tomas máximas al día). Se puede subir a Drive y rellenar como Hoja de cálculo.
2. Chat nuevo con Fable 5.1 (o Opus 5.5) y razonamiento extendido. Adjuntar la entrada, `formato-salida.xlsx` y las fotos si las hay. Pegar el **prompt 1** de `prompt-especialista.md`.
3. Contestar sus preguntas si las hace. Descargar `pauta-suplementos.xlsx`.
4. **Segunda opinión**: otro chat con el otro modelo, las dos tablas y el **prompt 2**. Lo que salga con gravedad alta se consulta antes de seguir.
5. Pasármela: se puede subir el fichero al repositorio o adjuntarlo en la sesión, y la reviso contra el formato antes de programar el importador. Cuando exista, «Importar pauta» en Suplementos.

## 7. Lo que haría la app (cuando se programe; hoy no se toca nada)

- **«📥 Importar pauta»** en Suplementos. Lee el `.xlsx` o el CSV con `extracto.js` y enseña una **vista previa con diferencias** (nuevos, cambian, se suspenden) antes de escribir nada.
- **La tabla manda sobre la lista**: cada ID es un suplemento, con sus tomas (momento, hora, días, unidades), su motivo y su acción. Lo suspendido queda archivado y visible, no borrado.
- **Validación mecánica al importar**: cabeceras exactas, valores de las listas cerradas, horas `HH:MM`, días válidos, que cada ID que no esté suspendido tenga al menos una toma. Lo que falle se señala por fila, sin LLM.
- **Toma diaria**: Suplementos y Hoy enseñan las tomas de hoy agrupadas por hora (según el día de la semana), con la dosis en unidades. Es la vista «Tu día con la pauta» del mock 004, sin el conmutador entreno/descanso porque los días ya vienen resueltos.
- **Avisos y totales**, legibles en la sección (del mock 004).
- **Ficha**: «✦ Según la pauta» en hora y dosis, con opción de dejarla a mano.
- **Fuera**: «Tomado», stock y reposición a Compra, y el consejo de la toma de la noche.
- **Pendiente para entonces**: leer una hoja por su nombre en `extracto.js` y una prueba de humo del importador con `formato-salida.xlsx`.

## 8. Formatos

Los dos ficheros llevan cabeceras comentadas, una fila gris de ejemplo, celdas amarillas donde escribir y listas desplegables en los campos cerrados.

**Entrada** (`plantilla-entrada.xlsx`):

- **Suplementos**: ID · Suplemento · Marca/producto · Formato · Unidad de toma · Composición por unidad · Unidades por envase · Cómo lo tomo ahora · Para qué lo tomo · Fijado por mí · Notas.
- **Perfil**: edad, sexo, peso, medicación, condiciones, analíticas, dieta, café, alcohol, objetivos por orden, horas de levantarse, comidas y acostarse, días, hora y tipo de entreno, sueño, tomas máximas al día y otras preferencias.

**Salida** (`formato-salida.xlsx`, «Pauta» siempre la primera):

- **Pauta**, una fila por toma: ID · Suplemento · Acción · **Pauta** · **Dosis** · Momento · Desfase (min) · Hora · Días · Unidades por toma · Unidad · Motivo · Evidencia · Médico.
- **Avisos**: Gravedad · Tipo · IDs · Aviso · Qué hacer.
- **Totales**: Nutriente · Total diario · Unidad · Límite diario · Fuente · IDs · Estado.
- **Preguntas**: Tipo (pregunta / médico) · Texto · IDs afectados.
- **Valores**: las listas cerradas (Acción, Momento, Unidad, Evidencia, Médico, Gravedad, Tipo de aviso, Estado).

## 9. Supuestos

- [SUPUESTO] **El chat de claude.ai lee `.xlsx` adjuntos y devuelve un `.xlsx`** (la creación de ficheros tiene que estar activada). Plan B: el prompt ya pide, si no puede, cada hoja en Markdown; se pega en Hojas de cálculo y se descarga como `.xlsx`.
- [SUPUESTO] **El plan del usuario incluye Fable 5.1.** Plan B: Opus 5.5 para la pauta y la segunda opinión en otro chat de Opus 5.5 con el prompt 2, o Sonnet 5 como segundo modelo.
- [SUPUESTO] **La validación de datos** (desplegables) sobrevive al subir el fichero a Drive y convertirlo en Hoja de cálculo. Plan B: da igual, porque la app valida al importar.
