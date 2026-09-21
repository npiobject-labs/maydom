---
fecha: 2026-09-20
estado: aceptada
tags: [maydom, mayordomo, arquitectura]
---
# ADR-001 · maydom no lleva una app de gestión aparte

## Contexto
El usuario pregunta (nota 20-sep 18:48) si maydom necesita otra aplicación detrás para administrarla, y deja la decisión al análisis.

## Decisión
No. Un solo usuario, sin roles ni cuentas. Lo administrable son catálogos (tiendas, ejercicios, suplementos, categorías) y parámetros, que viven en el apartado **Ajustes** de la propia app. La administración de fondo es el repositorio: semillas en `docs/app/datos/`, memoria en esta bóveda, reglas en `CLAUDE.md`. El backend queda sin estado (solo proxy al LLM).

## Consecuencias
- Menos coste: sin persistencia en Fly, sin panel, sin autenticación.
- Los datos personales quedan en el dispositivo (local-first) con exportar/importar.
- Se revisa si aparece un segundo usuario, sincronización multi-dispositivo o si el agente pasa a ejecutar acciones. Ver [[ADR-002-local-first]].
