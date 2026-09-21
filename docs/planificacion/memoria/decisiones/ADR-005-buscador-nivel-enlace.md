---
fecha: 2026-09-21
estado: aceptada
tags: [maydom, buscador, alcance]
---
# ADR-005 · El buscador de maydom se queda en enlace + consulta interpretada

## Contexto
Las notas piden un buscador transversal de productos y servicios sobre un catálogo de tiendas. El proyecto `npiobject-labs/buscaproducto` ya hace eso a fondo: más de 40 fuentes, adaptadores por API y scraping, adaptador universal con IA, extracción de atributos, puntuación explicada, deduplicación, histórico de precios y alertas.

## Decisión
maydom no reimplementa nada de eso. Su buscador es el **nivel D** de aquel proyecto (una URL con `{q}` por tienda, una pestaña por tienda) más lo barato que más aporta: el LLM convierte lo que el usuario pide en una consulta corta y eficaz y en una categoría, y enseña «lo que he entendido», como hace el intérprete de buscaproducto. El catálogo se amplía a 30 fuentes por categoría (alimentación, ecológica, suplementos, electrónica, ocio, general, servicios) y se poda desde la propia app.

## Consecuencias
- Cero scraping, cero coste de mantenimiento de adaptadores en maydom.
- Comparar precios de verdad es un enlace a buscaproducto desde el propio buscador.
- Si algún día hace falta agregación dentro de maydom, se consume la API de buscaproducto; no se copia su código. Cierra la deuda D5 como decisión, no como pendiente.
