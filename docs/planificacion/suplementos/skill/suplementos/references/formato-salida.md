# Formato de salida: `pauta-suplementos.md`

Es el fichero que el modelo **genera en el paso 2** y el que se importa en maydom. Contiene todo lo necesario y no hace falta ningún otro: la jornada con la que se calcularon las horas, los suplementos confirmados, la pauta, los avisos, los totales y las preguntas. **No lleva la medicación ni las analíticas**, aunque los avisos puedan nombrar un fármaco. Las filas del ejemplo son inventadas y siguen al ejemplo de [`formato-entrada.md`](formato-entrada.md).

## Reglas

1. **Secciones en este orden** y con estos títulos exactos: `## Resumen`, `## Jornada`, `## Suplementos`, `## Pauta`, `## Avisos`, `## Totales`, `## Preguntas`. Nada fuera de ellas, salvo la cabecera `---` del principio.
2. **Pauta: una fila por toma.** Un suplemento con dos tomas ocupa dos filas con el mismo ID. Tienen que aparecer **todos los ID** de la entrada; uno suspendido lleva una fila con `Acción = suspender`, `Pauta = Suspender` y vacíos Momento, Desfase, Hora, Días, Unidades por toma y Unidad. No se inventan ID.
3. **Pauta** y **Dosis** son el texto legible («45 min antes de acostarte (22:15), todos los días» y «1 cápsula (100 mg de magnesio)»). Las demás columnas son para la app y usan los valores cerrados.
4. **Hora**: `HH:MM` de 24 h, calculada con la jornada. **Desfase**: minutos respecto al momento (`-45` = 45 min antes; `0` = con él). **Días**: `todos` o las letras `L,M,X,J,V,S,D` separadas por comas; los días alternos se escriben `L,X,V,D`.
5. **Unidades por toma**: número de unidades del producto (su «Unidad de toma»), con coma decimal si hace falta (`0,5`).
6. **Totales**: todo nutriente que aparezca en dos o más productos o que tenga límite, con el total diario de la pauta propuesta (media semanal si no es diario) frente al límite. **Ningún total pasa su límite** salvo que sus filas en Pauta lleven `Médico = sí` y el motivo lo explique.
7. **Motivo**: 200 caracteres como mucho.
8. **Markdown estricto**: cada fila en una sola línea, ningún `|` dentro de una celda (se usa `/`), sin saltos de línea dentro de una celda, cabeceras exactamente como aquí y en este orden, y vacío lo que no aplica.
9. Se entrega como fichero `.md` descargable o, si no se puede, dentro de un único bloque de código `markdown`.

## Valores cerrados

| Columna | Valores |
|---|---|
| Acción | `mantener`, `ajustar`, `suspender`, `consultar` |
| Momento | `al_levantarse`, `desayuno`, `media_manana`, `comida`, `merienda`, `pre_entreno`, `post_entreno`, `cena`, `antes_de_dormir` |
| Unidad | `cápsula`, `comprimido`, `cacito`, `g`, `ml`, `gota`, `gominola`, `sobre` |
| Evidencia | `alta`, `moderada`, `baja` |
| Médico | `sí`, `no` |
| Gravedad | `alta`, `media`, `baja` |
| Tipo (Avisos) | `exceso`, `interacción`, `fármaco`, `entreno`, `sueño`, `sinergia`, `info` |
| Estado (Totales) | `ok`, `por encima` |
| Tipo (Preguntas) | `pregunta`, `médico` |
| Momento (Jornada) | los de la lista de Momento, más `entreno` |

## Plantilla con ejemplo

````markdown
---
formato: maydom-suplementos-pauta/1
fecha: 2026-09-24
modelo: Claude Fable 5.1
entrada: suplementos-entrada.md, confirmada el 2026-09-24
---
# Pauta de suplementos

## Resumen

4 suplementos: 3 ajustes y 1 suspensión. El Complejo B sobra: con el multivitamínico sumaba 30 mg de B6 al día. El multivitamínico pasa a la comida y el magnesio baja a 1 cápsula. La creatina, todos los días. Pendiente: confirmar la composición del multivitamínico y si tomas medicación.

## Jornada

| Momento | Hora | Días | Nota |
|---|---|---|---|
| al_levantarse | 07:00 | todos | |
| desayuno | 07:30 | todos | |
| comida | 14:30 | todos | la más grasa |
| entreno | 18:30 | L,X,V | 60 min |
| cena | 21:00 | todos | |
| antes_de_dormir | 23:00 | todos | hora de acostarse |

## Suplementos

| ID | Suplemento | Marca / producto | Unidad de toma | Composición por unidad |
|---|---|---|---|---|
| S01 | Magnesio | Marca X · Magnesio bisglicinato | 1 cápsula | magnesio 100 mg (bisglicinato) |
| S02 | Multivitamínico | Marca Y · Multi 50+ | 1 comprimido | vitamina D3 25 µg; zinc 10 mg (gluconato); vitamina B6 5 mg; magnesio 100 mg (óxido); B12 25 µg (metilcobalamina) |
| S03 | Creatina | Marca Z · Creatina monohidrato | 1 cacito (5 g) | creatina monohidrato 5 g |
| S04 | Complejo B | Marca Y · B-Complex | 1 cápsula | vitamina B6 25 mg (piridoxina); B12 500 µg (cianocobalamina); B1 50 mg (tiamina) |

## Pauta

| ID | Suplemento | Acción | Pauta | Dosis | Momento | Desfase (min) | Hora | Días | Unidades por toma | Unidad | Motivo | Evidencia | Médico |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S01 | Magnesio | ajustar | 45 min antes de acostarte (22:15), todos los días | 1 cápsula (100 mg de magnesio) | antes_de_dormir | -45 | 22:15 | todos | 1 | cápsula | Con los 100 mg del multi suma 200 mg suplementados, dentro del límite de 250 (EFSA). Con 3 cápsulas pasabas de 400. | moderada | no |
| S02 | Multivitamínico | ajustar | Con la comida (14:30), todos los días | 1 comprimido | comida | 0 | 14:30 | todos | 1 | comprimido | Lleva A, D, E y K, que se absorben con grasa: con la comida más grasa del día. | moderada | no |
| S03 | Creatina | ajustar | Al terminar de entrenar (19:30), días de entreno | 1 cacito (5 g) | post_entreno | 0 | 19:30 | L,X,V | 1 | cacito | Funciona por acumulación: todos los días. Después de entrenar rinde algo más. | alta | no |
| S03 | Creatina | ajustar | Con el desayuno (07:30), días sin entreno | 1 cacito (5 g) | desayuno | 0 | 07:30 | M,J,S,D | 1 | cacito | Los días sin entreno también, para no perder la acumulación. | alta | no |
| S04 | Complejo B | suspender | Suspender | | | | | | | | B6 total de 30 mg/día con el multi; el límite de EFSA es 12 mg. El multi ya cubre las B. | alta | no |

## Avisos

| Gravedad | Tipo | IDs | Aviso | Qué hacer |
|---|---|---|---|---|
| alta | exceso | S04,S02 | B6: 30 mg al día entre el Complejo B y el multi; EFSA la limita a 12 mg porque, mantenida, se asocia a neuropatía. | Suspender el Complejo B. |
| baja | info | S01,S02 | No hace falta separar el magnesio del multivitamínico: van en tomas distintas porque encajan así. | Nada. |

## Totales

| Nutriente | Total diario | Unidad | Límite diario | Fuente del límite | IDs | Estado |
|---|---|---|---|---|---|---|
| Magnesio (suplementado) | 200 | mg | 250 | EFSA | S01,S02 | ok |
| Vitamina B6 | 5 | mg | 12 | EFSA 2023 | S02 | ok |

## Preguntas

| Tipo | Texto | IDs |
|---|---|---|
| pregunta | La composición del multivitamínico es la habitual del producto, no la de tu etiqueta: mándame una foto de la tabla. | S02 |
| médico | Si tomas levotiroxina, el multivitamínico y el magnesio van a 4 h de ella: confírmalo con tu médico. | S01,S02 |
````
