---
fecha: 2026-09-27
estado: aceptada
tags: [maydom, finanzas, seguridad, datos]
---
# ADR-011 · Finanzas con clave, cifrada en el dispositivo; tres cuentas por IBAN y listados con parámetros

## Contexto
El usuario pide que Finanzas pida una clave **una sola vez al entrar desde el menú** y que nadie pueda ver ninguna de sus opciones (un listado de 2025, los movimientos, lo que sea) sin haberla dado. Pide también separar la **incorporación de datos** (extractos de BBVA en Excel, de cualquier periodo, que actualizan lo que ya había y añaden lo que falta; el fichero no se conserva) de los **listados** (normalmente con selección de parámetros antes de ejecutarlos), y distinguir **tres cuentas**: gastos fijos, ingresos y gastos variables, y ahorro, reconocidas por su IBAN.

Los datos viven en `localStorage` ([[ADR-002-local-first]]). Ese almacenamiento es **por origen**, y todas las webs de la organización en Pages comparten `npiobject-labs.github.io`: cualquier página de otro repo de la organización lee `maydom.v1`. Además, la copia JSON de Ajustes llevaba los movimientos en claro.

## Decisión
- **Cifrado, no solo una puerta**: con la clave creada, movimientos, cuentas (con su IBAN), recurrentes e historial de cargas salen de `maydom.v1` y van a `maydom.finanzas`, cifrados con AES-GCM 256; la llave se deriva de la clave con PBKDF2-SHA256 (600.000 iteraciones, sal aleatoria). La clave **no se guarda en ningún sitio**: comprobarla es poder descifrar. Módulo `docs/app/cofre.js`; `nucleo.js` solo tiene dos ganchos (`volcar()` escribe esas listas vacías y avisa al cofre; `releer()` las conserva si están abiertas).
- **La pone el usuario, en la app**, la primera vez que entra en Finanzas (dos veces, 4 caracteres o más). No la pone Claude: el repositorio es público.
- **Se pide una vez al entrar**; pestañas y listados no la vuelven a pedir. **Se cierra** al salir de la sección, con el 🔒 de las pestañas o tras 5 minutos con la app en segundo plano (no con una ventana abierta, para no cortar una importación). Cerrada, las listas están vacías en memoria: el menú dice «🔒 con clave», los consejos de finanzas no salen y al mayordomo no le llega ninguna cifra.
- **Cualquier ruta de Finanzas** (acceso fijado en Hoy, «atrás», enlace a un listado) pasa antes por el candado y, al abrirse, pinta justo lo pedido.
- **Copia de seguridad**: la copia JSON lleva Finanzas **cifrada** (`__finanzas`) sin pedir la clave; al restaurarla se pide la clave que tenía. Una copia antigua con movimientos en claro pide la clave de este dispositivo para cifrarlos (o se importa sin Finanzas).
- **Olvido**: sin clave no hay descifrado posible. «He olvidado la clave» borra Finanzas (hay que escribir BORRAR) y deja crear otra.
- **Varias copias abiertas**: cada escritura se encadena y, si otra copia escribió, se suman sus altas por `id`; al recibir el cofre de otra copia se adopta lo suyo y solo se reescribe si esta tiene altas que la otra no ha visto (escribir siempre hacía que se contestaran sin fin).
- **Tres cuentas** de partida (`fijos`, `variables`, `ahorro`), editables en Importar. El IBAN lo escribe el usuario o se apunta al importar el primer extracto de esa cuenta; después el extracto se reconoce solo (IBAN completo o sus cuatro últimas cifras).
- **Importar**: el Excel de BBVA (`.xls` binario BIFF8, `.xlsx`, o `.xls` que es HTML) entra **sin preguntar columnas** (F.Valor, Fecha, Concepto, Movimiento, Importe, Divisa, Disponible, Divisa, Observaciones) y guarda también el saldo disponible. **Siempre actualiza**: lo que ya estaba en esa cuenta se rehace con el fichero y lo que no, se añade; el concepto puesto a mano no se toca. El cotejo es por cuenta. Otros formatos siguen con el diálogo de columnas.
- **El fichero no se conserva**: nunca se guardó; ahora se dice al importar. Una web no puede borrar un archivo de Descargas del móvil, así que la app lo recuerda.
- **Listados** (pestaña «Listados», ruta `v=informes` por compatibilidad): cada uno declara sus parámetros y se elige antes de verlo; «Cambiar» vuelve a ellos. De partida: Resumen del año (año, cuenta), Movimientos (fechas, cuenta, ingresos/gastos, concepto, texto), Gasto por concepto (fechas, cuenta) y Cuentas (fechas).

## Consecuencias
- Olvidar la clave es perder Finanzas, salvo una copia exportada **antes** de crearla o una cifrada con clave recordada. La pantalla de crearla lo dice.
- Fuera de Finanzas no hay cifras: el gasto de ocio del mes solo cuenta lo apuntado en Ocio, no los cargos del banco, y los consejos de finanzas dejan de salir. [SUPUESTO] Es aceptable a cambio de la privacidad; plan B: calcular esos avisos dentro de Finanzas al abrirla.
- [SUPUESTO] El extracto de BBVA trae el IBAN antes de la tabla o en el nombre del fichero; si no lo trae, se elige la cuenta en el diálogo (se propone la última usada). Plan B: reconocer la cuenta por su saldo encadenado.
- [SUPUESTO] PBKDF2 con 600.000 iteraciones tarda menos de un segundo en un móvil actual; si se nota, se baja sin romper nada (las iteraciones van en el propio cofre).
- Quien tenga el móvil desbloqueado y la app con Finanzas abierta la ve: el cierre a los 5 minutos en segundo plano lo acota.
