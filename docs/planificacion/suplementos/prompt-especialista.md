# Prompt del especialista de suplementos

Para un chat nuevo de claude.ai con **Claude Fable 5.1** (u Opus 5.5) y el **razonamiento extendido activado**. Contexto y motivos en [`../suplementos-pauta-externa.md`](../suplementos-pauta-externa.md).

**Qué se adjunta al chat:**

- Las **fotos y los textos** de los suplementos: cada foto o texto es de un suplemento. Si un producto lleva dos fotos (el frente y la tabla de composición), mejor seguidas. La tabla de composición es la que cuenta: suele estar detrás o en un lateral.
- [`perfil.md`](perfil.md) relleno. Se rellena una vez y se reutiliza; **no se sube al repositorio**.
- [`formato-entrada.md`](formato-entrada.md) y [`formato-salida.md`](formato-salida.md), tal cual.

**Qué sale:** `suplementos-entrada.md` (paso 1, lo revisas tú) y `pauta-suplementos.md` (paso 2, **el que se importa en maydom**).

---

## Prompt 1 · identificar y hacer la pauta

```text
Te adjunto:
- Fotos y textos de mis suplementos. Cada foto o texto es de un solo suplemento; varias fotos seguidas pueden ser del mismo producto (el frente y la tabla de composición).
- perfil.md: mi jornada, mi entreno, mi salud, mis hábitos y mis objetivos.
- formato-entrada.md y formato-salida.md: la estructura exacta de los dos ficheros que tienes que producir. Sus filas de ejemplo no son mías.

Actúa como especialista en suplementación nutricional y deportiva, con criterio de farmacéutico clínico. El trabajo tiene dos pasos y entre ellos te paras.

PASO 1 · IDENTIFICAR
1. Identifica cada suplemento en las fotos y los textos y numéralos S01, S02… en el orden en que llegan. Junta en una fila las fotos que sean del mismo producto.
2. Rellena suplementos-entrada.md según formato-entrada.md con lo que LEAS: nombre, marca y producto, formato, unidad de toma y composición por unidad. En la composición va la cantidad del elemento o del principio activo, no la del compuesto, con la forma química entre paréntesis. Ignora los %VRN.
3. No rellenes nada de memoria sin decirlo. En «Fuente» pon «etiqueta» si lo has leído, «conocida» si no se ve y pones lo habitual de ese producto, o «falta». Si no reconoces un producto, no lo adivines: pon «Confianza = baja» y pregúntamelo.
4. Si mi texto dice cómo lo tomo ahora, para qué o que está fijado por mí, pásalo a su columna; si no, déjala vacía.
5. Entrégame suplementos-entrada.md y, en su sección «Dudas», en una sola tanda y con 8 como máximo: lo que no tengas claro de la identificación, las fotos que te falten y los datos del perfil que falten y cambien la pauta (la medicación, sobre todo).
6. PARA y espera a que te corrija o te diga «sigue». Si en este mensaje te escribo «sin pausa», haz los dos pasos seguidos y pon las dudas en la sección Preguntas de la pauta.

PASO 2 · LA PAUTA (cuando te diga «sigue»)
Con la entrada ya confirmada y mi perfil, dame la pauta diaria de TODOS mis suplementos a la vez: qué tomar, cuánto y cuándo, para sacar el máximo rendimiento en mi entreno, mi alimentación, mi sueño y mi salud.
- Dosis: dentro del rango con evidencia y en unidades del producto (cápsulas, cacitos, gotas). Suma cada nutriente entre todos los productos (el multivitamínico también cuenta) y no pases del límite diario de EFSA; si un nutriente no lo tiene, usa el de otra autoridad y cítala. Pasar un límite, solo con «Médico = sí» y explicado. Sin analítica, dosis de mantenimiento, nunca de tratamiento.
- Momento: anclado a mi jornada (levantarme, comidas, entreno y acostarme), con un desfase en minutos. No inventes horas fuera de mi jornada. Los liposolubles, con la comida más grasa. Lo activador, por la mañana; lo que ayuda a dormir, entre 30 y 60 min antes de acostarme. Separa solo lo que tiene evidencia de competir o de chocar, y di cuánto. Si la hora apenas cambia el resultado, dilo y elige lo más fácil de recordar.
- Pocas tomas: respeta el máximo de tomas al día de mi perfil. Si la pauta óptima lo supera, dame la sencilla y di en el motivo lo que se pierde.
- Cuestiona la lista: duplicados, productos que no aportan nada con los demás, evidencia baja. Puedes proponer suspender.
- La medicación y las condiciones de salud van primero. Lo que choque con un fármaco o con una condición lleva «Acción = consultar» y «Médico = sí».
- Evidencia honesta, sin marketing.
- Lo marcado como «Fijado por mí = sí» no se cambia: «Acción = mantener». Si algo no te cuadra, dilo en Avisos.

Entrega pauta-suplementos.md siguiendo formato-salida.md al pie de la letra: las secciones en su orden, las cabeceras exactas, una fila por toma, todos los ID (también los suspendidos), solo los valores cerrados de su lista, cada fila en una sola línea y ningún «|» dentro de una celda. Mi medicación y mis analíticas no se copian al fichero.

Antes de entregar, comprueba que salen todos los ID, que ningún total pasa su límite sin «Médico = sí», que las horas cuadran con la jornada y que cada fila tiene tantas celdas como su cabecera.

Entrega cada fichero como .md descargable. Si no puedes, ponlo entero dentro de un único bloque de código markdown para que al copiarlo no se pierdan las barras. Después de la pauta, un resumen en el chat de 10 líneas como mucho.

Esto es orientación general, no un tratamiento: marca lo que haya que consultar.
```

---

## Prompt 2 · la segunda opinión

En **otro chat** y mejor con **el otro modelo** (Opus 5.5 si la pauta la hizo Fable 5.1, o al revés). Se adjuntan `perfil.md`, `suplementos-entrada.md` y `pauta-suplementos.md`.

```text
Adjunto mi perfil (perfil.md), mis suplementos ya identificados (suplementos-entrada.md) y una pauta que ha propuesto otro especialista (pauta-suplementos.md).

Revísala como especialista en suplementación y farmacéutico clínico. No la rehagas: dime solo en qué discrepas, en una tabla con las columnas ID, Qué cambiarías, Por qué y Gravedad (alta, media o baja). Comprueba sobre todo las sumas de cada nutriente frente a su límite, los choques con mi medicación y las horas frente a mi jornada. Si todo te parece correcto, dilo en una línea.
```

## Prompt 3 · corregir con la segunda opinión

Solo si la segunda opinión trae algo con gravedad alta o media. Se escribe en **el chat del prompt 1**, pegando la tabla de discrepancias.

```text
Otro especialista ha revisado tu pauta y discrepa en esto:

[pega aquí su tabla]

Revisa cada punto. Donde le des la razón, corrige. Donde no, dime por qué en una línea. Luego entrégame pauta-suplementos.md completo otra vez, con el mismo formato.
```

Lo que siga en desacuerdo después del prompt 3 se consulta con el médico o el farmacéutico antes de importar la pauta.
