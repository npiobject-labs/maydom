# Activar el mayordomo: los dos secretos

Guía de una vez. Mientras no estén, la app funciona entera con el motor de reglas y `POST /api/mayordomo` responde `503 sin_configurar`; con ellos se encienden las nueve funciones con IA (chat, menú semanal, foto del frigorífico, ejercicios, suplementos, ocio, sueño, finanzas y buscador).

## Qué son y por qué son dos

| Secreto | Qué es | Quién lo genera | Quién lo ve |
|---|---|---|---|
| `LLM_API_KEY` | Clave de **aplicación** del gateway `npiobject-labs/openrouter`. Es la que gasta presupuesto | El gateway, al dar de alta la aplicación | Solo el backend de maydom en Fly |
| `MAYDOM_CLAVE` | Clave de **acceso a la app**. Sin ella, cualquiera que encuentre la URL pública gastaría tu presupuesto | Tú, es una cadena cualquiera | Tu navegador y el backend |

La clave de OpenRouter no aparece por ningún lado: vive dentro del gateway y maydom no la conoce. Ver [ADR-004](memoria/decisiones/ADR-004-llm-por-el-gateway.md).

## 1. Dar de alta la aplicación en el gateway

En el móvil, https://npiobject-labs.github.io/openrouter/conectar.html . Pide la **clave de administración** del gateway (la de `SERVICIO_CLAVE`, la que ya usas en su consola; el asistente la recuerda si la guardaste allí).

1. Servidor: el VPS (`https://apisor.oracle402.com`), que es el de producción.
2. Nombre de la aplicación: `maydom`.
3. Topes, antes de la primera llamada real. Punto de partida razonable para uso personal:

   | Tope | Valor | Por qué |
   |---|---|---|
   | Periodo | `mes` | El gasto de maydom es a rachas, no diario |
   | Límite | `3` $ | Corta en seco al llegar |
   | Aviso | `2` $ | Llega en la cabecera `X-Presupuesto` y la app lo enseña |
   | Cuota por minuto | `20` | Una pantalla nunca lanza más de dos o tres llamadas |

4. **Copia la clave que enseña. Solo se ve una vez.** Si se pierde, se crea otra y se revoca la anterior; no hay forma de recuperarla porque el gateway solo guarda su hash.

## 2. Inventar la clave de acceso

Cualquier cadena larga y aleatoria. Si tienes a mano una terminal:

```bash
python3 -c "import secrets,string;print('maydom_'+''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(40)))"
```

No tiene que ser memorizable: se escribe una vez en cada dispositivo donde uses la app.

## 3. Guardar los dos secretos en el repositorio

**Settings → Secrets and variables → Actions → New repository secret**, en `npiobject-labs/maydom`:

| Nombre | Valor |
|---|---|
| `LLM_API_KEY` | La clave de aplicación del paso 1 |
| `MAYDOM_CLAVE` | La cadena del paso 2 |

Son **secretos**, no variables: las variables se leen en los logs. Opcionales, y esas sí como **variables** de repositorio:

| Variable | Para qué |
|---|---|
| `LLM_BASE_URL` | Apuntar a otro servidor del gateway (por defecto `https://apisor.oracle402.com/v1`) |
| `LLM_MODELO` | Fijar un modelo concreto. Sin ella manda el del gateway. Hace falta uno **multimodal** para la foto del frigorífico |

## 4. Desplegar para que lleguen a Fly

Los secretos no viajan solos: los vuelca `deploy.yml`, que solo corre en push a `main` que toque `app/**`. Después de guardarlos, lánzalo a mano:

**Actions → Desplegar backend en Fly.io → Run workflow → rama `main`**.

El propio run verifica al final que `/api/estado` responde y que `/api/mayordomo` ya no da 503; si `MAYDOM_CLAVE` está puesta, comprueba además que una llamada sin clave devuelve 401.

## 5. Escribir la clave de acceso en la app

En https://npiobject-labs.github.io/maydom/ → **Ajustes → Clave de acceso**, pega la cadena del paso 2. Se guarda en ese navegador; hay que repetirlo en cada dispositivo donde instales la app.

Justo debajo, **Estado del LLM** tiene que decir `llm=true` con el modelo. Esa consulta no gasta crédito.

## 6. Comprobar que funciona

1. https://maydom-npiobject-labs.fly.dev/api/estado en el navegador: `"llm":true`.
2. En la app, Mayordomo → escribe cualquier cosa en el chat. Si responde, está listo.
3. En la consola del gateway, `GET /v1/uso/resumen?agrupar=operacion`: el gasto aparece repartido por función (`maydom-chat`, `maydom-menu`, `maydom-foto-stock`, `maydom-ejercicios`, `maydom-suplementos`, `maydom-ocio`, `maydom-sueno`, `maydom-finanzas`, `maydom-buscador`).

## Si algo falla

| Lo que ves | Qué pasa |
|---|---|
| `503 sin_configurar` | `LLM_API_KEY` no llegó a Fly: falta el secreto o falta lanzar `deploy.yml` |
| `401` al usar la app | La clave de Ajustes no coincide con `MAYDOM_CLAVE` |
| `402 presupuesto_agotado` | Se acabó el tope del mes en el gateway. Sube el límite o espera |
| `429 cuota_superada` | Más de 20 llamadas en un minuto. Espera |
| `429 bucle` | El gateway cortó una petición repetida cinco veces. Es un fallo, no carga |
| La foto del frigorífico no devuelve nada | El modelo no acepta imágenes: fija la variable `LLM_MODELO` a uno multimodal |

## Rotar la clave sin cortar el servicio

1. Crear otra aplicación en `conectar.html` (`maydom-2`).
2. Cambiar el secreto `LLM_API_KEY` y lanzar `deploy.yml`.
3. Dar de baja la anterior en el gateway. Su histórico de gasto se conserva.

**Nunca** escribas ninguno de los dos secretos en el repositorio, en `docs/`, en la bitácora ni en un resumen de sesión: `docs/` es un sitio público.
