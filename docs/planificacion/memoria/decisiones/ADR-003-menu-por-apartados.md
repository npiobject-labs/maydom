---
fecha: 2026-09-20
estado: aceptada
tags: [maydom, menu, ux]
---
# ADR-003 · Orden del menú por apartados

## Contexto
El orden de secciones dictado en las notas (ejercicio, alimentación, suplementos, proyectos, notas, sueño, meditación, preferencias, calendario, superagente, buscador, financiero, ocio) no es el de uso. El usuario pide un orden lógico con cabeceras.

## Decisión
Hoy · **Agenda** (Calendario, Notas) · **Cuerpo** (Ejercicio, Sueño, Meditación) · **Mesa** (Alimentación, Suplementos, Compra) · **Vida** (Proyectos, Ocio, Finanzas) · **Mayordomo** (Consejos, Preferencias, Buscador) · Ajustes. Barra inferior en móvil: Hoy, Calendario, Mayordomo, Buscar, Menú.

## Consecuencias
- "Compra" es una sección nueva: unifica el stock bajo de alimentos y suplementos (las notas la piden en las dos).
- El buscador transversal se abre desde cualquier sección con la categoría prefiltrada.
