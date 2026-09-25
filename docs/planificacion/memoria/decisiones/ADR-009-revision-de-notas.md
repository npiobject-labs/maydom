---
fecha: 2026-09-25
estado: aceptada
tags: [maydom, notas, llm, ux]
---
# ADR-009 · Etiquetas al guardar y revisión de notas solo cuando se pide

## Contexto
El usuario pide etiquetas al guardar una nota, o con un botón que llame a la IA, y que esa llamada aproveche para dar formato al texto y señalar fallos de sintaxis. Pide también que todas las cajas de texto de la app se puedan redimensionar. Se aprobó sin cambios el mock `docs/mocks/006-etiquetas-y-revision.html`.

## Decisión
- **Las etiquetas se ponen al guardar y no cuestan una consulta más.** Llevan etiquetas las tareas y las ideas; una compra la sigue llevando en cada línea. Si se dejan vacías, las pone el mayordomo en la misma llamada `nota` que ya pone el título. Se guarda primero y se etiqueta después, y nunca se pisan las escritas a mano. Las tareas antiguas se etiquetan con «✨ Etiquetarlas», que no toca su título.
- **La revisión va en un botón, ✨ Revisar (operación `nota-revisar`), y nunca al guardar.** Corrige tildes, ortografía, gramática, puntuación y lo que el dictado oye mal; ofrece la versión en lista si la nota enumera cosas, y propone título, etiquetas y tipo. Enseña cada cambio para desmarcarlo, y lo que no tiene arreglo automático sale como aviso. No se escribe nada hasta «Aplicar», y el texto de antes se guarda en `nota.original` («↶ Deshacer», «ver el original»).
- **Una tarea que junta varias cosas que hacer** se ofrece guardar como varias tareas, con la misma fecha tope.
- **Todas las cajas de texto llevan un asa táctil y ⤢ pantalla completa.** La altura elegida manda sobre el crecimiento automático y se recuerda por sección y campo, en `maydom.textos`.

## Por qué la revisión no va al guardar
Cambiaría el texto del usuario sin que lo vea, justo lo que la app evita en todas partes: los títulos automáticos, los conceptos de Finanzas y el relato de la noche. Además gastaría una consulta por nota. Si más adelante se quiere automática, será un interruptor en Ajustes, apagado de partida.

## Consecuencias
- Una nota revisada cuesta dos consultas: `nota`, que clasifica al terminar el dictado, y `nota-revisar`. Al guardar no se llama otra vez, porque la revisión ya trae título y etiquetas.
- Las diferencias se calculan en el navegador (`docs/app/revisar-texto.js`, por palabras) a partir del texto que devuelve el mayordomo. Las correcciones que él lista solo sirven para nombrar cada cambio, así que un JSON incompleto no rompe nada.
- En la versión en lista, lo que pone o quita saltos de línea es formato y no se puede desmarcar.
