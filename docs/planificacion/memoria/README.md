---
tags: [maydom, memoria]
---
# Memoria del mayordomo

Bóveda de Obsidian: abre esta carpeta con **Open folder as vault**. Es la memoria que consultan los agentes (y el mayordomo de la app) antes de recomendar nada. Vive en el repo porque el repo es la única fuente de verdad.

## Convenciones

- `decisiones/ADR-NNN-titulo.md`: una decisión por fichero. Frontmatter con `fecha`, `estado` (propuesta / aceptada / superada) y `tags`. Secciones: Contexto, Decisión, Consecuencias.
- `preferencias/AAAA-MM-DD.md`: lo que el usuario dijo que quiere en ese momento, con horizonte. Nunca se edita una anterior: se añade otra. Así se ve la deriva.
- Enlaces entre notas con `[[wikilinks]]`. Etiquetas por sección: `#ejercicio #sueno #meditacion #alimentacion #suplementos #proyectos #ocio #finanzas #calendario #mayordomo`.
- La app exporta consejos aceptados y rechazados en este mismo formato (Mayordomo → Exportar memoria); se pegan aquí en una sesión y se hace commit.

## Regla para los agentes

Al empezar una sesión sobre maydom: leer `decisiones/` entera y la última nota de `preferencias/`. Una recomendación que contradiga una decisión aceptada tiene que decirlo y proponer superarla con un ADR nuevo, no ignorarla.
