---
fecha: 2026-09-20
estado: aceptada
tags: [maydom, arquitectura, datos]
---
# ADR-002 · Datos local-first en el navegador

## Contexto
La app se publica como sitio estático en Pages (público). No puede haber datos reales en `docs/` ni un backend con estado sin volumen en Fly.

## Decisión
Todo el estado del usuario se guarda en `localStorage` del dispositivo bajo la clave `maydom.v1`, con versión de esquema y migraciones. Exportar/importar JSON como copia de seguridad y como sincronización manual entre móvil y PC.

## Consecuencias
- Funciona sin red. El LLM es un extra, no un requisito.
- Deuda D9: sincronización automática cuando haga falta.
- La clave de OpenRouter nunca está en el cliente: la guarda Fly y la usa `POST /api/mayordomo`.
