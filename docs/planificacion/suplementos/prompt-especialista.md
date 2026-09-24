# Prompt del especialista de suplementos

Se pega tal cual en un chat nuevo de claude.ai, con **Claude Fable 5.1** (o Opus 5.5) y el **razonamiento extendido activado**. Se adjuntan `plantilla-entrada.xlsx` ya rellena y `formato-salida.xlsx` sin tocar. Contexto y motivos en [`../suplementos-pauta-externa.md`](../suplementos-pauta-externa.md).

---

## Prompt 1 · la pauta

```text
Adjunto dos ficheros:
- plantilla-entrada.xlsx: mis suplementos (hoja «Suplementos»: uno por fila, con su ID, su unidad de toma y su composición) y mi perfil y mi jornada (hoja «Perfil»). Si adjunto fotos de etiquetas, en el mensaje digo a qué ID corresponde cada una.
- formato-salida.xlsx: el formato exacto en el que quiero la respuesta. Sus filas grises son solo un ejemplo.

Actúa como especialista en suplementación nutricional y deportiva, con criterio de farmacéutico clínico. Quiero la pauta diaria de TODOS mis suplementos a la vez: qué tomar, cuánto y cuándo, para sacar el máximo rendimiento en mi entreno, mi alimentación, mi sueño y mi salud.

ANTES DE LA TABLA
Lee los ficheros y las fotos. Si falta un dato que cambiaría la pauta de forma importante (medicación, una composición que no se lee, mi horario), pregúntamelo antes de seguir, en una sola tanda y con 5 preguntas como máximo. Si no falta nada crítico, sigue sin preguntar.

CÓMO DECIDIR
- Dosis: dentro del rango con evidencia y expresada en unidades del producto (cápsulas, cacitos, gotas), según la composición de la entrada. Suma cada nutriente entre todos los productos (el multivitamínico también cuenta) y no pases del límite diario de EFSA; si un nutriente no lo tiene, usa el de otra autoridad y cítala. Pasar un límite solo con «Médico = sí» y explicado. Sin analítica, dosis de mantenimiento, nunca de tratamiento.
- Momento: anclado a mi jornada (levantarme, comidas, entreno y acostarme), con un desfase en minutos. No inventes horas fuera de mi jornada. Liposolubles, con la comida más grasa. Lo activador, por la mañana; lo que ayuda a dormir, entre 30 y 60 min antes de acostarme. Separa solo lo que tiene evidencia de competir o de chocar, y di cuánto. Si la hora apenas cambia el resultado, dilo y elige lo más fácil de recordar.
- Pocas tomas: respeta el máximo de tomas al día del Perfil. Si la pauta óptima lo supera, dame la sencilla y di en el motivo lo que se pierde.
- Cuestiona la lista: duplicados, productos que no aportan nada con los demás, evidencia baja. Puedes proponer suspender.
- La medicación y las condiciones de salud van primero. Lo que choque con un fármaco o con una condición lleva «Acción = consultar» y «Médico = sí».
- Evidencia honesta, sin marketing: califica cada decisión como alta, moderada o baja.
- Lo marcado como «Fijado por mí = sí» no se cambia: «Acción = mantener». Si algo no te cuadra, dilo en Avisos.

FORMATO DE LA RESPUESTA
Devuélveme un fichero pauta-suplementos.xlsx con las mismas hojas y columnas que formato-salida.xlsx, con los mismos nombres, en el mismo orden y con «Pauta» como primera hoja:
- Pauta: una fila por toma (un suplemento con dos tomas ocupa dos filas con el mismo ID). Tienen que salir todos los ID de la entrada, también los que suspendas (una fila con «Acción = suspender» y sin momento). No inventes ID.
  · Pauta y Dosis: texto legible para mí, por ejemplo «45 min antes de acostarte (22:15), todos los días» y «2 cápsulas (200 mg de magnesio)».
  · Acción, Momento, Unidad, Evidencia y Médico: solo los valores de la hoja «Valores».
  · Hora: HH:MM de 24 h, calculada con mi jornada. Días: «todos» o las letras L,M,X,J,V,S,D separadas por comas (los días alternos como L,X,V,D).
  · Motivo: 200 caracteres como mucho.
- Avisos: excesos, interacciones entre suplementos, choques con fármacos, con el entreno o con el sueño, y sinergias. Incluye también lo que NO hace falta separar cuando sea un mito extendido.
- Totales: cada nutriente que aparezca en dos o más productos o que tenga límite, con el total diario de tu pauta (media semanal si no es diario) frente a su límite.
- Preguntas: lo que te falte saber y lo que tenga que consultar con mi médico.

Antes de entregar, comprueba que salen todos los ID, que ningún total pasa su límite sin «Médico = sí», que los valores cerrados son de la lista y que las horas cuadran con mi jornada.

Si no puedes crear el fichero, dame cada hoja como una tabla en Markdown con esas mismas columnas.

Después del fichero, un resumen en el chat de 10 líneas como mucho: qué cambia, qué suspendes y qué necesitas preguntarme.

Esto es orientación general, no un tratamiento: marca lo que haya que consultar.
```

---

## Prompt 2 · la segunda opinión

En **otro chat**, y mejor con **el otro modelo** (Opus 5.5 si la pauta la hizo Fable 5.1, o al revés). Se adjuntan la entrada y la `pauta-suplementos.xlsx` que salió del prompt 1.

```text
Adjunto mis suplementos y mi perfil (plantilla-entrada.xlsx) y una pauta que ha propuesto otro especialista (pauta-suplementos.xlsx).

Revísala como especialista en suplementación y farmacéutico clínico. No la rehagas: dime solo en qué discrepas, en una tabla con estas columnas: ID, Qué cambiarías, Por qué, Gravedad (alta, media o baja). Comprueba sobre todo las sumas de cada nutriente frente a su límite, los choques con mi medicación y las horas frente a mi jornada. Si todo te parece correcto, dilo en una línea.
```

Lo que salga con gravedad alta en la segunda opinión se lleva al médico o al farmacéutico antes de importar la pauta.
