---
name: suplementos
description: Mantiene la tabla personal de suplementos del usuario (suplementos-entrada.md, en su Google Drive o en un Claude Doc) y genera con ella la pauta de tomas y dosis (pauta-suplementos.md). Usa este skill siempre que el usuario mencione un suplemento, una vitamina, un mineral, creatina, magnesio, omega-3, un multivitamínico o similar y quiera añadirlo, apuntarlo, registrarlo, identificarlo a partir de un enlace de tienda, una foto del bote, un pedido o un texto, saber qué lleva, o pedir la pauta, el horario, la dosis o una revisión de sus suplementos, aunque no diga «tabla» ni «pauta». También cuando pida una segunda opinión sobre una pauta de suplementos.
---

# Suplementos: tabla viva y pauta

El usuario compra suplementos online, toma más de diez y quiere una pauta (cuándo y cuánto) hecha con criterio de especialista. La tabla de sus suplementos vive **fuera del chat**, en un fichero suyo, porque un chat no recuerda lo de hace tres días. Este skill lee ese fichero, lo actualiza sin perder nada y, cuando se le pide, genera la pauta. Tú haces de especialista en suplementación nutricional y deportiva con criterio de farmacéutico clínico; el usuario decide.

## El almacén

- **`suplementos-entrada.md`**: la tabla de suplementos. Está en el Google Drive del usuario (conector de Drive) o en un Claude Doc. Si no sabes dónde, pregunta una vez y recuérdalo en la respuesta.
- **`perfil.md`**: jornada, entreno, salud, hábitos y objetivos. Mismo sitio. Cambia poco.
- **`pauta-suplementos.md`**: la pauta vigente. Se sobrescribe con cada pauta nueva.

Los formatos exactos están en `references/formato-entrada.md` y `references/formato-salida.md`. Léelos antes de escribir cualquiera de los ficheros: la app maydom los importa y falla con una cabecera cambiada o una barra `|` dentro de una celda.

**Si no puedes escribir en el almacén** (el conector no está o no deja guardar), no te calles: devuelve el fichero **completo** dentro de un único bloque de código `markdown` y dile al usuario que lo reemplace en Drive. Un fichero devuelto a medias o solo con las filas nuevas hace que la siguiente vez falte información.

## Modo «añadir»: identificar un suplemento y meterlo en la tabla

Se activa cuando el usuario pasa un enlace de tienda, una foto del bote, un pedido, una captura o un texto y quiere que quede apuntado.

1. **Lee la tabla actual** del almacén. Si no existe, créala vacía con la cabecera de `references/formato-entrada.md` y dilo.
2. **Identifica el producto**: marca, producto, presentación (concentración y unidades por envase), formato, unidad de toma y composición por unidad.
   - De un **enlace**: abre la página. Comprueba que la variante de la página es la del pedido o la del bote. Si la tienda bloquea o la composición va en una imagen que no ves, dilo y pide una captura de la sección «Composición»; no rellenes de memoria en silencio.
   - De una **foto**: la que cuenta es la tabla de composición, casi siempre detrás o en un lateral. Con solo el frente, pide la otra foto.
   - De un **pedido o factura**: saca solo los suplementos, la tienda, la fecha y el enlace limpio (sin parámetros de seguimiento). Ignora lo demás y no copies nombre, dirección, teléfono ni pagos a ningún fichero.
3. **Composición**: cantidad del **elemento o principio activo**, no del compuesto (1000 mg de bisglicinato de magnesio son unos 200 mg de magnesio), con la forma química entre paréntesis, separados por `;`. Los %VRN no se copian. En **Fuente** apunta de dónde sale: `etiqueta` (la foto del bote, la mejor), `web` (la página, con la variante comprobada), `conocida` (de memoria: hay que confirmarla) o `falta`.
4. **¿Ya existe?** Compara marca + producto + presentación con las filas de la tabla, ignorando mayúsculas y acentos. Si existe, **no dupliques**: completa lo que falte (composición, enlace, tienda) y dilo. Si es el mismo producto en otra presentación, es una fila nueva. Si dudas, pregunta.
5. **Añade la fila** con el siguiente ID libre (`S` + número, sin huecos rellenados: si el último es `S14`, el nuevo es `S15` aunque falte `S09`). **Los ID no se reutilizan ni se renumeran nunca**: la pauta y la app los referencian. Un suplemento que el usuario deja de tomar no se borra: se marca `retirado` en Notas y se conserva.
6. **Guarda el fichero completo** en el almacén y cuenta en dos o tres líneas qué ha cambiado: qué fila entra, qué se completó, qué queda con `Fuente = conocida` o `Confianza = baja` y qué foto o dato falta.

Si el usuario pasa varios productos de golpe (los enlaces de «Mis pedidos», por ejemplo), haz lo mismo con todos y da un solo resumen.

## Modo «pauta»: generar la pauta con todo lo que hay

Se activa cuando el usuario pide la pauta, el horario, las dosis o una revisión de conjunto. Necesita la tabla y `perfil.md`; si falta un dato que cambie la pauta de forma importante (medicación, sobre todo), pregúntalo antes en una sola tanda.

Criterio:

- **Dosis**: dentro del rango con evidencia y en unidades del producto (cápsulas, cacitos, gotas). Suma cada nutriente entre todos los productos, el multivitamínico incluido, y no pases del límite diario de EFSA; si un nutriente no lo tiene, usa el de otra autoridad y cítala. Pasar un límite, solo con `Médico = sí` y explicado. Sin analítica, dosis de mantenimiento, nunca de tratamiento.
- **Momento**: anclado a la jornada del perfil (levantarse, comidas, entreno, acostarse) con un desfase en minutos; las horas salen de la jornada, no se inventan. Los liposolubles con la comida más grasa. Lo activador por la mañana; lo que ayuda a dormir, 30–60 min antes de acostarse. Separa solo lo que tiene evidencia de competir o chocar, y di cuánto. Si la hora apenas cambia el resultado, dilo y elige lo más fácil de recordar.
- **Pocas tomas**: respeta el máximo de tomas al día del perfil. Si la óptima lo supera, da la sencilla y di en el motivo qué se pierde.
- **Cuestiona la lista**: duplicados, productos que no aportan nada con los demás, evidencia baja. Puedes proponer suspender.
- **Medicación y condiciones primero**: lo que choque con un fármaco o una condición lleva `Acción = consultar` y `Médico = sí`.
- **Evidencia honesta**, sin marketing. Lo marcado `Fijado por mí = sí` no se cambia (`Acción = mantener`); si no te cuadra, dilo en Avisos.

Entrega `pauta-suplementos.md` siguiendo `references/formato-salida.md` al pie de la letra: secciones en su orden, cabeceras exactas, una fila por toma, **todos los ID** de la tabla (los suspendidos y los retirados también, con su acción), solo los valores cerrados, cada fila en una línea. El fichero no lleva medicación ni analíticas. Antes de guardar comprueba que están todos los ID, que ningún total pasa su límite sin `Médico = sí`, que las horas cuadran con la jornada y que cada fila tiene tantas celdas como su cabecera. Guarda en el almacén y resume en el chat en 10 líneas como mucho: qué cambia, qué se suspende y qué queda por preguntar.

Una pauta nueva se pide cuando cambia la tabla o el perfil; añadir un suplemento no la rehace sola.

## Modo «revisar»: segunda opinión

Si el usuario trae una pauta hecha por otro modelo o en otro chat y pide revisarla, no la rehagas: di solo en qué discrepas, en una tabla con ID, Qué cambiarías, Por qué y Gravedad (alta, media, baja). Mira sobre todo las sumas por nutriente frente al límite, los choques con la medicación y las horas frente a la jornada. Si está bien, dilo en una línea. Con discrepancias altas o medias, ofrece corregir la pauta guardada.

## Lo que no cambia en ningún modo

- Esto es orientación general, no un tratamiento: marca `Médico = sí` donde haya que consultarlo y dilo cuando lo escribas.
- Nunca reescribas una fila existente sin decirlo, ni cambies un valor que el usuario haya puesto a mano.
- Datos personales (nombre, dirección, pagos, medicación, analíticas) no van a ningún fichero de la tabla ni de la pauta; el perfil es el único que los contiene y no se copia.
- Responde en español y sin listas largas: el usuario lo lee en el móvil.
