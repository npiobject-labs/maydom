---
fecha: 2026-09-24
estado: aceptada
tags: [maydom, notas, compra, agenda, ux]
---
# ADR-008 · Notas por tipo: tareas, compras e ideas, con un solo dictado

## Contexto
El usuario pide partir Notas en tres: **tareas**, que llevan fecha tope; **compras**, con etiquetas de alimentación u otras; e **ideas**, que son el texto como hasta ahora. Se propusieron cuatro mejoras en el mock `docs/mocks/005-notas-por-tipo.html` y el usuario las aprobó todas, junto con tres respuestas: etiquetas de compra ampliables, las tareas sin notificación y «el jueves» dicho un jueves es el de la semana que viene.

## Decisión
- **Un solo botón de dictar, tres destinos.** La clase la decide el mayordomo en la misma llamada que ya ponía el título (`nota`); sin LLM, unas reglas. El «+» de cada pestaña la trae ya puesta y lo que el usuario elige a mano manda.
- **La tarea exige fecha tope**, leída del dictado o elegida con botones rápidos. Sale en Hoy si está vencida o es de hoy, y en el Calendario el día de su tope como marca, **sin sumar horas a la carga**. No avisa con notificación.
- **Una sola lista de la compra.** Una compra dictada se parte en líneas, una por cosa, con cantidad y etiqueta, y entran en `estado.compra`, que sigue siendo la lista de la sección Compra. No existe una lista paralela en Notas: su pestaña Compras es la misma lista agrupada por etiqueta, y lo que ya está pendiente no se duplica.
- **Etiquetas de compra ampliables**: alimentación, droguería, farmacia y otras de partida; el usuario crea más desde la propia línea.
- **Las ideas son las notas de antes**, sin cambios; todas las existentes pasan a ideas.
- **Una nota que junta cosas de clases distintas** («llamar a la gestoría el jueves y comprar sobres») se ofrece guardar por separado, nunca sin preguntar.

## Consecuencias
- Una llamada al gateway por nota, como antes: la que se lanza en el diálogo se reutiliza al guardar.
- Las tareas viven en `notas[]` con `clase: 'tarea'`; Preferencias y la memoria exportada solo miran las ideas.
- Si más adelante se quiere que una tarea avise, se añade una hora opcional y se engancha al vigilante de `nucleo.js`, igual que los eventos.
