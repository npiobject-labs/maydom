---
fecha: 2026-09-21
estado: aceptada
tags: [maydom, mayordomo, llm, arquitectura]
---
# ADR-004 · El LLM se consume por el gateway `npiobject-labs/openrouter`

## Contexto
El mayordomo necesita un LLM. El primer diseño (ADR-002) llamaba a OpenRouter directamente con una clave propia en Fly. El usuario indica que los LLM se usan a través de su aplicación `openrouter`, que ya existe: un gateway en Rust con la API de OpenAI bajo `/v1`, claves por aplicación revocables, presupuesto por app, cuota por minuto, cortacircuitos de bucles y medición por llamada con `X-Operacion`.

## Decisión
maydom es una **aplicación consumidora** del gateway, no un cliente de OpenRouter.

- El backend llama a `POST {LLM_BASE_URL}/chat/completions` (por defecto `https://apisor.oracle402.com/v1`) con `Authorization: Bearer <clave de aplicación>`.
- Secretos del repo que `deploy.yml` vuelca a Fly: `LLM_API_KEY` (clave de aplicación) y `MAYDOM_CLAVE` (clave de acceso a la app). Variables opcionales: `LLM_BASE_URL`, `LLM_MODELO`.
- Cada llamada lleva `X-Operacion: maydom-<sección>`, así el gasto se reparte por función en el gateway.
- Se siguen sus reglas de integración: reintentos solo ante 502/504 (dos, con espera creciente), timeout del cliente por encima del suyo, errores traducidos conservando su código.
- La app pública en Pages manda `X-Clave` (la misma `MAYDOM_CLAVE`); sin ella el backend responde 401. Una URL pública sin eso es presupuesto regalado.

## Consecuencias
- Ninguna clave de OpenRouter existe en este proyecto. Rotar o revocar maydom es `DELETE /v1/apps/{id}` en el gateway, sin tocar este repo.
- El presupuesto y los topes se fijan en el gateway, no aquí.
- Si el gateway está caído, la app sigue con el motor de reglas: el LLM nunca es requisito. Ver [[ADR-002-local-first]].
- Supera la parte de [[ADR-002-local-first]] que hablaba de OpenRouter directo; el resto (datos local-first) sigue vigente.
