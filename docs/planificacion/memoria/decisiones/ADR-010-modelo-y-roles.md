---
fecha: 2026-09-26
estado: aceptada
tags: [maydom, llm, informes, ajustes]
---
# ADR-010 · Elegir modelo en Ajustes e informes con varios roles, como en `prueba`

## Contexto
El usuario pide llevar a maydom lo que ya tiene `prueba` en Ajustes (F25/F26, D54 a D67 de su `plan-analisis.md`): elegir el modelo del catálogo del gateway `npiobject-labs/openrouter` y generar análisis con varios agentes de roles distintos (crítico, analítico, económico…). En `prueba` todo vive en el backend (SQLite, generación en segundo plano); maydom es local-first ([[ADR-002-local-first]]) y su backend no guarda nada.

## Decisión
- **Modelo en Ajustes** («Modelo e informes»): selector con buscador, «El del servidor» arriba, luego los recomendados y el resto del catálogo con precio (entrada / salida $ por millón) y contexto. Se guarda en `estado.ajustes.modelo` (este dispositivo). Vale para **lo que redacta**: chat, consejos e informes. Lo que rellena campos (`pedirJSON`) o mira una foto sigue con el modelo barato del servidor. En la hoja de Analizar se puede cambiar solo para ese informe.
- **Backend**: `POST /api/mayordomo` acepta `modelo` (id del catálogo; 400 `modelo_invalido` si no tiene forma de id) y `modo: "informe"` (sistema propio sin la persona ni el contexto del mayordomo, 2.500 tokens, mensajes de hasta 90.000 caracteres). `GET /api/modelos` reenvía el catálogo de texto del gateway con los recomendados marcados (`LLM_RECOMENDADOS` los sustituye) y el de por defecto; `GET /api/uso?operacion=maydom-…` da lo que costó una operación. Ambas exigen `X-Clave`. El modelo no se valida contra el catálogo en cada llamada: si no existe, el error del gateway llega traducido.
- **Informes sobre las Ideas** (Notas → Ideas → 🔎 Analizar; se leen en la pestaña **Informes**): de 1 a 20 ideas (las visibles con el buscador y la etiqueta puestos) y de 1 a 8 roles. Los **nueve de serie** son los de `prueba`; los **propios** se crean, editan y borran en Ajustes o desde la hoja, y viven en `estado.roles`.
- **La generación la orquesta el navegador**: una llamada por rol, cuatro a la vez, y una síntesis que escribe título, resumen ejecutivo, conclusiones, tensiones entre roles, plan de acción y preguntas. El informe lo compone la app (síntesis + análisis por rol + ideas de origen + ficha). Cada generación va con `X-Operacion: maydom-informe-<id>-<n>`; «Reintentar» rehace solo lo fallido en la misma operación, así que el coste de la ficha incluye los reintentos.
- **También desde la propia idea** (añadido el mismo día, a petición): el diálogo de una idea lleva «🔎 Analizar con roles», que la guarda y abre la hoja con solo ella marcada, y «📄 N informes» con los informes en los que entra.
- Salidas: leer formateado (markdown propio, sin librerías), ✏️ Editar, 📋 Copiar arriba y abajo, ⬇ .md, 🖨 PDF (impresión que solo deja el informe), Compartir, ↻ Regenerar y Borrar.

## Por qué en el navegador y no en el backend
Así el backend sigue sin estado y los informes y roles viajan en la copia JSON como el resto de los datos. El precio es que un informe **no sigue si se cierra la app**: al volver a abrirla, lo pendiente queda como fallido y «Reintentar» lo completa sin repetir lo hecho. [SUPUESTO] Para informes de hasta 8 roles (1–3 minutos) es aceptable. Plan B: mover la orquestación a una ruta del backend con almacenamiento en el volumen de Fly, como `prueba`.

## Consecuencias
- Los roles propios no salen en otros dispositivos salvo por la copia JSON (en `prueba` se guardan en el servidor).
- [SUPUESTO] Los recomendados (`google/gemini-2.5-pro`, `anthropic/claude-sonnet-4.5`, `openai/gpt-5`, `google/gemini-2.5-flash`, `deepseek/deepseek-chat-v3.1`) existen en el catálogo; si alguno desaparece, simplemente no sale arriba. Plan B: `LLM_RECOMENDADOS`.
- Un modelo caro elegido en Ajustes encarece también el chat: el aviso lo dice en la tarjeta.
