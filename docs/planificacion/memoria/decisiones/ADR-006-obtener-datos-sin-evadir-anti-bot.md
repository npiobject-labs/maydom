---
fecha: 2026-09-21
estado: aceptada
tags: [maydom, buscador, compra, productos, alcance]
---
# ADR-006 · Los datos de producto se obtienen sin evadir anti-bot: el humano abre, la app lee

## Contexto
Doce de las veintinueve tiendas del catálogo rechazan a un robot, y cuatro de cinco plantillas de búsqueda escritas a ojo fallaron en la tienda real. El usuario aportó dos análisis externos (Grok y Antigravity) que proponen navegadores «stealth» (Camoufox, Patchright), proxies residenciales, navegadores remotos con fingerprint real y APIs internas de apps móviles reversadas. Los dos coinciden también en que la vía limpia es el navegador del propio usuario, los datos estructurados JSON-LD y las APIs abiertas. Análisis completo en [`obtener-datos-de-productos.md`](../../obtener-datos-de-productos.md).

## Decisión
maydom obtiene precio, disponibilidad y ficha de producto por estas vías y solo por estas, en este orden: (1) la página que el usuario **comparte** a la app (Web Share Target o enlace pegado), de la que el backend lee JSON-LD/Open Graph con un `User-Agent` identificado y obedeciendo `robots.txt`, con precio manual o dictado como plan B; (2) fuentes abiertas y APIs oficiales que no exijan ser afiliado con ventas (Open Food Facts por EAN, Keepa con clave del usuario); (3) la API de `buscaproducto` para agregar y comparar; (4) lectura desde el servidor únicamente en tiendas que no bloquean y con límite de una petición cada 30 s. Un bloqueo se anota y se deja de intentar: nunca se cambia de IP, de navegador ni de cabeceras para pasar.

Quedan **descartados**: navegadores parcheados o «stealth», proxies residenciales, navegadores remotos de terceros, APIs móviles reversadas, cookies de sesión del usuario en el servidor y cabeceras fingidas.

## Consecuencias
- Coste fijo cero y ninguna pieza que se rompa con la próxima actualización de Cloudflare/DataDome/Akamai; la única «rotura» posible es una tienda que empiece a bloquear, y eso el chequeo lo anota sin tocar código.
- Cubre todas las tiendas, incluidas las de protección alta, porque el usuario es quien navega; a cambio, el precio de una tienda bloqueada no se refresca solo.
- Coherente con ADR-005 y con el plan de buscaproducto, que excluye proxies, CAPTCHA y suplantación; toda mejora de agregación se hace allí.
- Las afirmaciones legales de los análisis externos no se toman como base: quedan marcadas como [SUPUESTO] y ninguna decisión depende de ellas.
