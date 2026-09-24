# Formato de entrada: `suplementos-entrada.md`

Es el fichero que el modelo **genera en el paso 1** a partir de las fotos y los textos de los suplementos. El usuario lo revisa antes de que el modelo siga. Las filas del ejemplo son inventadas.

## Reglas

1. **Una fila por producto**, con su ID: `S01`, `S02`… en el orden en que llegan las fotos y los textos. Si varias fotos son del mismo producto (el frente y la tabla de composición), van en una sola fila y se nombran todas en «Origen».
2. **Composición por unidad**: cada principio activo con la cantidad **del elemento o principio activo, no la del compuesto**, y la forma química entre paréntesis, separados por `;`. Ejemplo: bisglicinato de magnesio 1000 mg que aporta 200 mg de magnesio → `magnesio 200 mg (bisglicinato)`. Los %VRN no se copian.
3. **Fuente** dice de dónde sale la composición: `etiqueta` (leída en la foto o el texto), `conocida` (no se ve y es la habitual de ese producto: **hay que confirmarla**) o `falta`.
4. **Confianza** en haber identificado bien el producto: `alta`, `media` o `baja`. Con `baja`, la duda va en «Dudas».
5. «Cómo lo tomo ahora», «Para qué lo tomo» y «Fijado por mí» solo se rellenan si el usuario lo dice en su texto. Si no, se dejan vacías.
6. **Markdown estricto**, para que la app lo pueda leer: cada fila en una sola línea, ningún `|` dentro de una celda (se usa `/`), sin saltos de línea dentro de una celda, coma decimal, cabeceras exactamente como aquí y en este orden. Lo que no aplica queda vacío.
7. Se entrega como fichero `.md` descargable o, si no se puede, dentro de un único bloque de código `markdown`, para que al copiarlo no se pierdan las barras.

Valores cerrados: **Formato** `cápsula`, `comprimido`, `polvo`, `líquido`, `gotas`, `gominola` u `otro` · **Fuente** `etiqueta`, `conocida` o `falta` · **Confianza** `alta`, `media` o `baja` · **Fijado por mí** `sí`, `no` o vacío.

## Plantilla con ejemplo

````markdown
---
formato: maydom-suplementos-entrada/1
fecha: 2026-09-24
---
# Suplementos · entrada

## Suplementos

| ID | Origen | Suplemento | Marca / producto | Formato | Unidad de toma | Composición por unidad | Fuente | Confianza | Cómo lo tomo ahora | Para qué lo tomo | Fijado por mí | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S01 | imágenes 1 y 2 | Magnesio | Marca X · Magnesio bisglicinato | cápsula | 1 cápsula | magnesio 100 mg (bisglicinato) | etiqueta | alta | 3 por la noche | dormir, calambres | no | |
| S02 | imagen 3 | Multivitamínico | Marca Y · Multi 50+ | comprimido | 1 comprimido | vitamina D3 25 µg; zinc 10 mg (gluconato); vitamina B6 5 mg; magnesio 100 mg (óxido); B12 25 µg (metilcobalamina) | conocida | media | 1 con el desayuno | | | la foto solo enseña el frente |
| S03 | texto 1 | Creatina | Marca Z · Creatina monohidrato | polvo | 1 cacito (5 g) | creatina monohidrato 5 g | etiqueta | alta | cuando me acuerdo | fuerza | | |
| S04 | imagen 4 | Complejo B | Marca Y · B-Complex | cápsula | 1 cápsula | vitamina B6 25 mg (piridoxina); B12 500 µg (cianocobalamina); B1 50 mg (tiamina) | etiqueta | alta | 1 por la mañana | energía | | |

## Dudas

- S02: la foto solo enseña el frente; he puesto la composición habitual de ese producto (Fuente = conocida). Mándame una foto de la tabla de composición.
- Perfil: no dices si tomas medicación. Si es para el tiroides, cambia el horario del magnesio y del multivitamínico.
````
