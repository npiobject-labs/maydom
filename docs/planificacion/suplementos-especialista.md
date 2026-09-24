# Suplementos: del «Revisar horario con LLM» a un especialista que propone pauta y dosis

**Fecha:** 2026-09-24 · **Estado:** propuesta, pendiente de decisión · **Mock:** [`docs/mocks/004-suplementos-especialista.html`](../mocks/004-suplementos-especialista.html)

## 1. Qué se pide

Que el botón de revisar el horario deje de ser un repaso superficial y pase a ser un **agente especialista en suplementos** que conozca los más de diez que toma el usuario, vea las incompatibilidades y proponga **la mejor hora de toma y la dosis** de cada uno, pensando en el máximo rendimiento en alimentación, ejercicio y salud. En cada suplemento, una de las opciones de hora y de dosis tiene que ser **«la que propone la IA»**. El stock (pastillas, gramos, cuánto queda) se aparca: la fase 1 es la pauta. Como el especialista necesita conocimiento de verdad, probablemente **no vale el modelo por defecto**.

## 2. Qué hay hoy y por qué se queda corto

Código: `docs/app/secciones/suplementos.js` (acción `revisarLLM`) y `app/src/main.rs` (`SISTEMA`, `mayordomo()`).

| # | Hallazgo | Consecuencia |
|---|---|---|
| 1 | **El modelo es `google/gemini-2.5-flash-lite`**, el que pone el gateway cuando la petición no trae `model` (`openrouter/app/src/config.rs`), salvo que `LLM_MODELO` esté definida en Fly [SUPUESTO: no lo está; se ve en Ajustes → Mayordomo o en `GET /api/estado`]. Es el modelo más barato del catálogo, elegido porque en el gateway igualó a los caros **mapeando columnas de un BOM**. | Conocer bien farmacología y cruzar 14 productos no es mapear columnas. Para esto no se ha medido. |
| 2 | **El sistema es el del mayordomo**: «máximo 120 palabras, sin listas de más de 3 puntos, sin diagnósticos médicos». Va a todas las llamadas, también a esta. | Empuja al modelo a respuestas cortas y genéricas justo donde hace falta detalle. |
| 3 | `max_tokens` 2000 en JSON, `temperature` 0.3, `tarea` recortada a 4000 caracteres y **`contexto` con el resumen de toda la app** (8000 caracteres de agenda, finanzas, ocio…). | Catorce suplementos con motivo, dosis e interacciones no caben en 2000 tokens. Y el contexto mete ruido que no ayuda. |
| 4 | Solo pide **momento** (mañana, comida, tarde, noche) y una hora. **Ni dosis, ni días de entreno, ni pre/post-entreno, ni «X minutos antes de acostarte»**, ni tomas repartidas en dos veces. | No puede expresar la mitad de las buenas pautas (creatina después de entrenar, colágeno 45 min antes, magnesio 45 min antes de dormir). |
| 5 | La respuesta se empareja **por el nombre exacto** en minúsculas. | «Magnesio» contra «Magnesio bisglicinato» no casa y se pierde sin avisar. |
| 6 | **Aplica los cambios directamente**, sin preguntar, y deja el motivo en una sola línea de Consejos. | Contradice el principio 4 del plan («aconsejar, no imponer»). Ni se ve qué cambió ni se puede aceptar uno sí y otro no. |
| 7 | **No conoce la composición** de cada producto (qué lleva el multivitamínico) ni la medicación, ni analíticas, ni la jornada real (horas de comer y de entrenar). | No puede sumar un mismo nutriente entre productos, que es donde suelen estar los excesos (zinc y B6 del multivitamínico más el suelto), ni avisar de los choques con fármacos, que son los que de verdad importan. |
| 8 | Nada comprueba lo que devuelve el modelo. | Una dosis por encima del límite legal o un choque inventado llegan tal cual al usuario. |

## 3. Crítica a la petición

Lo pedido es correcto y vale la pena hacerlo. Hay cinco matices que conviene decidir antes de ponerse:

1. **Buscar el máximo rendimiento choca con la sencillez** (principio 5 del plan). La pauta óptima para 14 suplementos puede tener 6 o 7 tomas al día, y así nadie la sigue. Propuesta: el especialista **pega cada toma a algo que ya haces** (levantarte, comidas, entreno, acostarte), con un máximo de 5 o 6 anclas, y cuando ajustar la hora aporta poco da además una **alternativa sencilla**. En el ejemplo del mock, la pauta óptima pide 6 tomas los días de entreno y la sencilla, 4.
2. **Sin composición no hay dosis en pastillas.** El especialista puede proponer la dosis en principio activo (200 mg de magnesio), pero para decirla en cápsulas necesita saber cuánto lleva cada una. No hace falta todo el stock: basta **una línea de composición por producto** («1 cápsula = 100 mg de magnesio bisglicinato»). Sin ella, la dosis sale en mg y avisa. Lo de contar pastillas y gramos sigue aparcado.
3. **Sin analítica no se ajusta la dosis de todo.** Vitamina D, hierro y B12 se dosifican según la analítica. Sin ella, el especialista se queda en **dosis de mantenimiento dentro de los límites**, nunca en dosis para tratar un déficit, y pide la analítica.
4. **La medicación importa más que el modelo.** Los choques peligrosos son con fármacos (anticoagulantes con K2 y omega-3; levotiroxina con minerales y ashwagandha; sedantes con melatonina). Hoy la app no pregunta qué medicación tomas. Es el dato más barato y el que más cambia la pauta.
5. **A veces la mejor pauta es quitar alguno.** Con más de diez productos es probable que haya duplicados o alguno con poca evidencia. El especialista puede proponer **suspender**, y tiene que decir el nivel de evidencia de cada cosa, porque no todo lo que se toma para rendir rinde.

Y dos sobre el modelo:

6. **Que el modelo sea potente no lo hace seguro.** Los modelos buenos también se inventan dosis. Los límites y los choques conocidos los comprueba **una tabla local**, que manda sobre el modelo (§5.3).
7. **Lo que limita no es el precio, es el tiempo.** Una pauta con un modelo de primera cuesta céntimos (§6), pero el gateway corta a los **120 s**, y un modelo que razona a fondo sobre 14 productos puede pasar de ahí. Para que quepa, el diseño se reparte así: la IA pone el conocimiento y la app calcula el horario (§5.4).

## 4. La propuesta en una frase

**La IA decide qué tomar, cuánto y respecto a qué** (con la comida más grasa, 45 min antes de entrenar, 45 min antes de acostarte); **una tabla local comprueba** límites y choques; **la app calcula la hora** con tu jornada; y **tú aceptas cada cambio**.

```
Tus datos ──► Especialista (LLM potente) ──► Comprobación local ──► Planificador de horas ──► Tú aceptas
jornada        qué, cuánto, anclas,          límites EFSA,          anclas + jornada =        por suplemento,
perfil         choques, evidencia,           choques conocidos,     hora de cada toma;        o todo;
suplementos    preguntas                     ids, formato           entreno / descanso        «✦ IA» o «mía»
```

## 5. El agente especialista

### 5.1 Qué recibe

Una llamada nueva, **operación `suplementos-pauta`**, que no manda el resumen de toda la app sino solo lo que el especialista necesita:

- **Jornada tipo**: hora de levantarse, desayuno, comida (y cuál es la más grasa), cena y acostarse; días, hora y duración del entreno; horas del café. Se rellena sola con lo que la app ya sabe (preferencias, medias de Sueño, Ejercicio) y se corrige a mano.
- **Sueño**: latencia media y despertares, sacados de `registrosCompletos()`. Con eso el especialista puede ver, por ejemplo, que la melatonina aporta poco a quien se duerme en 12 minutos.
- **Perfil de salud (opcional)**: edad, peso, medicación, condiciones y analíticas con fecha. Se guarda en el móvil y **solo sale en esta consulta**, con aviso.
- **Objetivos**: rendimiento en el entreno, dormir, salud general, recuperación. Se elige uno o varios.
- **Cada suplemento con su `id`**: nombre, composición por unidad (opcional), dosis y momento actuales, para qué lo tomas y si está «fijado por mí», en cuyo caso no se toca.
- **Hechos verificados** de la tabla local para los ingredientes reconocidos: límite diario, choques conocidos y separaciones. Van en el prompt para que el modelo los tenga delante y no tenga que recordarlos.

### 5.2 Qué devuelve (contrato)

JSON con esquema estricto (`response_format: json_schema`). Los textos llevan `maxLength` para que el tamaño de la salida quede acotado.

```json
{
  "resumen": "≤ 300 car.",
  "suplementos": [{
    "id": "s4",
    "identificado": { "nombre": "Magnesio", "forma": "bisglicinato",
                      "principios": [{ "nombre": "magnesio", "cantidad": 100, "unidad": "mg", "por": "cápsula" }] },
    "accion": "mantener | ajustar | suspender | preguntar",
    "dosis": { "cantidad": 200, "unidad": "mg", "texto": "200 mg (2 cápsulas)", "frecuencia": "diaria | alterna | dias_entreno | dias_descanso" },
    "anclas": [{ "ancla": "antes_de_dormir", "desfase_min": -45, "dias": "todos | entreno | descanso" }],
    "sencilla": { "anclas": [{ "ancla": "cena", "desfase_min": 0, "dias": "todos" }], "pierde": "≤ 120 car." },
    "condiciones": { "con_grasa": false, "ayunas": false, "separar_de": [{ "id": "s9", "horas": 2, "por": "≤ 80 car." }] },
    "motivo": "≤ 240 car.",
    "evidencia": { "dosis": "alta | moderada | baja", "hora": "alta | moderada | baja" },
    "confianza": 0.8,
    "medico": false
  }],
  "avisos": [{ "tipo": "exceso | choque | farmaco | antientreno | sinergia | info",
               "gravedad": "alta | media | baja", "ids": ["s6", "s1"],
               "texto": "≤ 240 car.", "accion": "≤ 120 car." }],
  "preguntas": [{ "id": "medicacion", "texto": "≤ 160 car.", "cambia": ["s2", "s3", "s11"] }],
  "medico": ["≤ 160 car."],
  "fuera": ["≤ 160 car. (café, comidas: no son suplementos pero afectan)"]
}
```

Anclas admitidas: `al_levantarse`, `desayuno`, `comida`, `pre_entreno`, `post_entreno`, `cena`, `antes_de_dormir`. **El modelo no devuelve horas.** Devuelve anclas con su desfase («45 min antes de dormir»), y la hora sale de la jornada. Así, si cambias el entreno de las 18:30 a las 07:00, la pauta se recoloca sin volver a llamar a la IA.

### 5.3 Comprobación local (la tabla manda)

Un módulo `docs/app/datos/suplementos-base.js` con los ingredientes más comunes (sinónimos, liposoluble o no, anclas buenas y malas), sus **límites diarios** y una lista de **choques con evidencia**. Se usa tres veces:

1. **Antes de llamar**, para reconocer los ingredientes y meter en el prompt los hechos que tocan.
2. **Después**, para comprobar la respuesta: que los `id` existan todos y ninguno sobre; que la suma de cada nutriente entre productos no pase su límite; que se respeten las separaciones de la tabla; que no se toque nada «fijado por mí». Lo que no pase se marca y **no se puede aceptar con un toque**: hay que aceptarlo leyendo el aviso.
3. **Sin LLM**, como plan B: sustituye a la tabla `criteriosSuplemento` de `semillas.js`, que hoy solo da un momento por palabra clave, por algo que también suma nutrientes y avisa de excesos.

Primeros límites, de EFSA y para adultos: vitamina D 100 µg (4000 UI); zinc 25 mg; B6 12 mg (revisado en 2023); magnesio **suplementado** 250 mg (el límite es por su efecto laxante); vitamina A (retinol) 3000 µg; vitamina E 300 mg; ácido fólico 1000 µg; selenio 255 µg; yodo 600 µg; calcio 2500 mg; cobre 5 mg; EPA+DHA hasta 5 g sin problemas de seguridad; cafeína 400 mg al día y 200 mg por toma. [SUPUESTO] hierro 40 mg (el «nivel seguro» de EFSA de 2024) y melatonina por debajo de 2 mg/día como complemento en España; plan B: se verifican contra la fuente antes de escribirlos en la tabla y, mientras tanto, el especialista los trata como «preguntar al médico».

Primeros choques: hierro frente a calcio, zinc, magnesio, café, té y fibra (2 h); zinc sostenido por encima de 40 mg, que baja el cobre; minerales frente a levotiroxina (4 h) y frente a quinolonas y tetraciclinas; K2 frente a anticoagulantes antivitamina K; omega-3 en dosis altas, vitamina E, cúrcuma y ginkgo frente a anticoagulantes y antiagregantes; hipérico frente a casi todo; ashwagandha frente a hormona tiroidea, sedantes, inmunosupresores y embarazo; melatonina frente a sedantes y fluvoxamina; berberina frente a antidiabéticos; fibra y psyllium frente a todo (2 h); vitamina C a partir de 1 g y E en dosis altas junto al entreno, que atenúan las adaptaciones; cafeína en las 6–8 h antes de acostarse.

Y lo que **no** es un choque también se escribe: zinc y magnesio a dosis normales pueden ir juntos. Los modelos baratos suelen repetir cosas como «separa todos los minerales 2 h», que complican la pauta sin ganar nada.

### 5.4 Planificador de horas (local)

Una función pura: cada ancla con su desfase se convierte en hora usando la jornada, y las tomas se agrupan por ancla. Los días de entreno y los de descanso salen distintos, porque `pre_entreno` y `post_entreno` solo existen los días que se entrena. Con «Sencilla» se usan las anclas de `sencilla`. Es instantáneo, reproducible y **no gasta crédito**.

### 5.5 El prompt del especialista

Va en el backend (`SISTEMA_SUPLEMENTOS`) y **sustituye** al del mayordomo en esta operación, no se suma a él. Borrador:

> Eres especialista en suplementación deportiva y nutricional, con criterio de farmacéutico clínico. Trabajas para una sola persona y tu trabajo es proponer la **pauta diaria** de todos sus suplementos: qué tomar, cuánto y en qué momento del día, para sacar el máximo rendimiento en su entreno, su alimentación, su sueño y su salud.
>
> Cómo decides:
> - La dosis, dentro del rango que tiene evidencia y **nunca por encima de los límites** de los hechos verificados que recibes. Suma el mismo nutriente entre productos (un multivitamínico también lleva zinc, D, B6 y magnesio) y compara el total. Sin analítica, dosis de mantenimiento; una dosis para corregir un déficit es cosa del médico.
> - El momento, anclado a lo que la persona ya hace: levantarse, comidas, entreno y acostarse, con un desfase en minutos. No inventes horas. Liposolubles con la comida más grasa. Lo activador, por la mañana; lo que ayuda a dormir, 30–60 min antes de acostarse. Separa solo lo que tiene evidencia de competir o de chocar, y di cuánto. Si la hora apenas cambia el resultado, dilo y prioriza que no se olvide.
> - Pocas tomas: 6 anclas como máximo, y cuando la óptima complique la vida, da una alternativa sencilla y lo que se pierde con ella.
> - Cuestiona la lista: duplicados, productos que no aportan nada con lo demás, evidencia baja. Puedes proponer suspender.
> - Medicación y condiciones primero. Si falta un dato que cambiaría la pauta (medicación, analítica, peso), pregúntalo en `preguntas` y propón mientras la opción prudente.
> - Evidencia honesta: califica por separado la de la dosis y la de la hora. Nada de marketing.
> - No toques lo marcado como «fijado por el usuario»: solo puedes avisar.
>
> Esto es orientación general, no un tratamiento. Marca `medico: true` cuando haya que consultarlo. Responde solo con el JSON del esquema, en español, y usa los `id` que recibes.

Los principios del mayordomo que siguen valiendo (aconsejar sin imponer, sencillez, el sueño como prioridad) ya van dentro. Se quitan los límites de longitud.

### 5.6 El modelo: cuál y cómo se elige

El gateway reenvía el cuerpo tal cual a OpenRouter (`openrouter/app/src/rutas/chat.rs`), así que maydom puede pedir **cualquier modelo del catálogo** y parámetros como `reasoning`. No hace falta tocar el gateway.

| Candidato (vía OpenRouter) | Precio entrada/salida por millón de tokens | Coste de una pauta ¹ | Papel |
|---|---|---|---|
| `google/gemini-2.5-flash-lite` (el de ahora) | céntimos | < 0,01 $ | línea base de la comparación |
| Claude Sonnet 5 | 2 $ / 10 $ | ≈ 0,10–0,15 $ | candidato rápido |
| **Claude Opus 5.5** | 4 $ / 20 $ | ≈ 0,20–0,30 $ | **candidato principal** |
| Claude Fable 5.1 | 10 $ / 50 $ | ≈ 0,50–0,80 $ | solo si los otros fallan en la evaluación |

¹ Unos 6 000 tokens de entrada y entre 5 000 y 12 000 de salida contando el razonamiento. Los precios son los de Anthropic; OpenRouter cobra lo mismo por estos modelos [SUPUESTO; plan B: `GET /v1/models` del gateway da el precio exacto]. Con una pauta nueva cada vez que cambia la lista o la jornada, unas 4 al mes, el gasto no llega a 1,5 $ al mes. **El precio no decide.**

Recomendación: **Opus 5.5 con razonamiento `medium`**, porque es lo que más sabe por céntimos. Hay que confirmar tres cosas: el identificador exacto en OpenRouter [SUPUESTO: `anthropic/claude-opus-5.5`; plan B: sacarlo de `GET /v1/models`], que la respuesta llegue en menos de 120 s y que acierte en la evaluación. Si tarda demasiado, Sonnet 5; si falla la evaluación, Fable 5.1.

**Se elige midiendo, como se hizo en el gateway con el BOM, no a ojo.** Un workflow `evaluar-suplementos.yml` (`workflow_dispatch`, corre en el runner, que sí llega al gateway) lanza un **juego de casos** contra los candidatos y puntúa sin intervención humana:

- Caso A: la lista del mock (14 productos, con los excesos de B6 y zinc escondidos en el multivitamínico).
- Caso B: anticoagulante + K2 + omega-3 + cúrcuma.
- Caso C: levotiroxina + hierro + calcio + magnesio + café en el desayuno.
- Caso D: vegano con B12, hierro y creatina, que entrena por la mañana.

Por cada caso y modelo: JSON válido contra el esquema; ninguna dosis por encima del límite; **detecta los choques obligatorios** del caso; respeta las separaciones; ni inventa ni pierde `id`; tiempo por debajo de 100 s; coste. Además, un informe con los motivos para leerlo a mano. El caso B es eliminatorio: un modelo que no vea el anticoagulante queda fuera.

### 5.7 Cambios en el backend (para cuando se desarrolle)

- `Peticion` gana `agente` (vacío = mayordomo). Con `agente: "suplementos"` el backend usa `SISTEMA_SUPLEMENTOS`, el modelo de la variable **`LLM_MODELO_SUPLEMENTOS`** (con uno por defecto en el código), `reasoning: {effort: "medium"}`, `max_tokens` 16 000, el esquema en `response_format` y `tarea` hasta 16 000 caracteres. **El cliente no elige el modelo**: una URL pública que dejara pedir cualquier modelo sería presupuesto regalado, aun con `X-Clave`.
- `provider: {data_collection: "deny"}` en esa llamada, porque viaja la medicación [SUPUESTO: el gateway lo deja pasar, igual que el resto del cuerpo].
- `GET /api/estado` dice también qué modelo usa el especialista. `deploy.yml` vuelca la variable si existe.
- Si 120 s no bastan, [SUPUESTO] plan B por orden: bajar el razonamiento a `low`, usar Sonnet 5, o subir el tiempo máximo del gateway para maydom, que es un proyecto propio.

## 6. En la app

- **«Revisar horario con LLM» pasa a llamarse «✦ Pauta del especialista»** y abre una vista `#/suplementos?v=pauta` en tres pasos: *Preparar* (jornada, perfil, objetivos y modelo, con el coste estimado), *Consultando* (el progreso real: especialista → comprobación → horas) y *Pauta*.
- **La pauta se ve de dos formas**: el día por tomas (entreno o descanso, óptima o sencilla) y cada suplemento comparando **Ahora** con **✦ IA** (hora y dosis), con el motivo, la evidencia y los botones **Aceptar**, **Mantener la mía** y **Fijar a mano**. Arriba, los avisos por gravedad y las preguntas del especialista; abajo, lo que hay que hablar con el médico.
- **En la ficha**, «Momento de toma» gana la opción **«✦ Según la IA»**, que muestra la toma calculada («Cena · 21:00»), y la dosis tiene dos opciones: **«✦ La de la IA»** o **«La mía»**. «Fijado por mí» se queda como está y la IA nunca lo toca. Una pauta nueva no cambia nada sola: lo que cambie respecto a la aceptada vuelve como propuesta.
- **Composición** y **para qué lo tomo**: dos campos nuevos y opcionales en la ficha. El stock queda plegado bajo «Stock y reposición (aparcado)».
- **La pauta se guarda con su firma** (suplementos, jornada, perfil), como `plato.pasos` en el modo cocina: si nada cambia, no se vuelve a pedir, y al abrir la vista se avisa de que está desactualizada cuando la firma no coincide.
- Datos nuevos en `maydom.v1`: `jornada`, `perfilSalud`, `pautaSuplementos` (fecha, modelo, `uso_id`, coste, firma, respuesta y verificación) y, en cada suplemento, `composicion`, `objetivo`, `origenHora` (`ia` | `regla` | `mio`), `origenDosis` (`ia` | `mio`) e `ia` (la propuesta y si está aceptada o rechazada). Viajan con exportar e importar.

## 7. Fases

| Fase | Qué | Estado |
|---|---|---|
| **1 · Pauta** | Jornada, perfil y composición; agente `suplementos-pauta` con su prompt, su modelo y su esquema; tabla local de límites y choques; planificador de horas; vista de pauta con aceptar por suplemento; «✦ IA» en hora y dosis; evaluación de modelos por workflow. | Propuesta (este documento y el mock) |
| 2 · Tomas | Hoy agrupado por toma («✓ todo lo de la cena»), avisos por toma, foto de la etiqueta para leer la composición (`reducirImagen` + visión), ciclos (ashwagandha 8 + 2 semanas). | Después |
| 3 · Stock | Pastillas y gramos derivados de la dosis, consumo real y reposición a Compra. | Aparcada por el usuario |

## 8. Riesgos y supuestos

- [SUPUESTO] **Los identificadores de OpenRouter** de los modelos de Claude. Plan B: `GET /v1/models` del gateway, en el primer paso del workflow de evaluación.
- [SUPUESTO] **Que una pauta de 14 productos cabe en 120 s** con Opus 5.5 y razonamiento medio. Plan B: el orden de §5.7.
- [SUPUESTO] **Que el gateway deja pasar `reasoning` y `provider`**. Reenvía el cuerpo sin tocarlo salvo `model` y `stream`, así que debería. Plan B: quitarlos; el esquema y el prompt ya hacen casi todo.
- **Responsabilidad**: la app ya dice «criterio general, no médico». Con dosis concretas hay que decirlo con más claridad. Tres reglas lo cubren: nada se aplica sin aceptarlo, nada por encima del límite de la tabla se acepta de un toque, y lo marcado como «médico» no tiene botón de aceptar, solo «Lo he consultado».
- **Privacidad**: medicación y analíticas salen del móvil hacia el gateway y el proveedor del modelo. Se avisa en el paso *Preparar*, se envían solo en esta operación y se pide `data_collection: "deny"`.
- **Variabilidad**: dos llamadas pueden dar pautas distintas. Temperatura baja cuando el modelo la admite, firma para no repetir y comparación con la pauta anterior al pedir otra.
- **ADR**: si se aprueba, ADR-008 «Especialista de suplementos: modelo propio, tabla local que manda y horas calculadas en la app». Complementa el ADR-004 (sigue pasando por el gateway) y no lo contradice.
