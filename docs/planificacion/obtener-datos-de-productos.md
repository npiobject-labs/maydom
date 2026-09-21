# maydom · Cómo obtener información de productos (precio, disponibilidad, ficha) de tiendas online y otras fuentes

**Fecha:** 2026-09-21 · **Estado:** propuesta aceptada como [ADR-006](memoria/decisiones/ADR-006-obtener-datos-sin-evadir-anti-bot.md) · **Origen:** documento del usuario `05_Saltar_en_buscador_los_robots.md` (análisis de Grok y de Antigravity) más la aportación propia de esta sesión.

## 0. En una página

El problema no es «saltarse a los robots». El problema es **conseguir el precio, la disponibilidad y la ficha de un producto de forma que siga funcionando dentro de seis meses, sin coste fijo y sin que nadie tenga que mantener parches**. Con ese criterio, de todo lo que proponen Grok y Antigravity, lo que aguanta es:

| Nº | Vía | Quién hace el trabajo | Coste | Frágil ante | Veredicto |
|---|---|---|---|---|---|
| 1 | **Datos que el usuario ya tiene delante**: compartir la página abierta a maydom (Web Share Target / pegar URL) y leer su **JSON-LD** | El usuario abre, maydom extrae | 0 | Nada: para la tienda es un humano | **Base de todo** |
| 2 | **Fuentes abiertas y APIs oficiales**: Open Food Facts, Keepa (Amazon), feeds de afiliado, comparadores con API | La fuente | 0–20 $/mes | Cambios de la API (avisados) | **Sí, por fuente** |
| 3 | **buscaproducto** como servicio de agregación (API) | El proyecto hermano | Lo que ya cuesta | Lo que ya asume aquel proyecto | **Sí, cuando exista la API** |
| 4 | **Lectura respetuosa desde servidor** (HTML público, JSON-LD, `robots.txt` obedecido, 1 petición/tienda/30 s) | El backend de maydom | 0 | Que la tienda ponga anti-bot: entonces se para | Solo tiendas sin protección; **nunca** tras un bloqueo |
| 5 | Navegador remoto con «fingerprint real» y proxies residenciales; Camoufox / Patchright «stealth»; APIs móviles reversadas; cookies del usuario en el servidor | Un parche por tienda, para siempre | 0–150 $/mes | Cada actualización del anti-bot | **No, y queda registrado por qué** |

**Regla de oro:** *el humano abre, la app lee*. Todo lo que exige convencer a una tienda de que un robot es una persona se descarta (§3). Lo que la vía 1 no cubra lo cubre la 2 o la 3; la 4 es un extra para las tiendas abiertas; la 5 no se implementa.

## 1. Lo que dicen Grok y Antigravity, y qué vale de cada cosa

### 1.1 Grok

Orden «de más limpia a más frágil»: (1) APIs y feeds oficiales, (2) navegador real con automatización ligera —Playwright stealth, o mejor el navegador del propio usuario—, (3) proxies residenciales con cabeceras realistas, (4) humano en el bucle, (5) fuentes alternativas (Google Shopping, Idealo, Kelkoo). Recomienda APIs donde existan, Playwright stealth para el resto y un fallback humano.

**Vale:** la jerarquía y, sobre todo, dos cosas que dice de pasada: «navegador controlado por el propio usuario» y «humano en el bucle, cero bloqueos y 100 % legal». También el aviso de que Amazon y Wallapop detectan los proxies «muy bien».
**No vale:** que la recomendación final sea Playwright stealth «para el resto». Es la parte frágil de su propia lista puesta como centro; y su «si es solo para tu uso personal, el riesgo es bajo» es una valoración legal sin fuente.

### 1.2 Antigravity

Corrige a Grok con puntos buenos y añade otros discutibles:

| Aportación | Qué es | Valoración para maydom |
|---|---|---|
| PA-API de Amazon exige 3 ventas/180 días | Cierto: es el requisito de acceso a la PA-API v5 | Descarta la PA-API para uso personal. Acertado. |
| **Keepa API** para Amazon | Precio actual e histórico por ASIN; tokens gratis al día, plan de pago después | **Sí**, es la vía correcta para Amazon (§2.2). |
| **JSON-LD first** (`schema.org/Product`) | Muchas tiendas incrustan precio, stock y nombre en `<script type="application/ld+json">` | **Es la pieza central** del plan (§2.1). Lo mejor del documento. |
| **Extensión de navegador** | El usuario navega, la extensión lee el DOM | Correcta la idea; **mal el vehículo**: maydom es una PWA en el móvil sin extensiones. El equivalente es **Web Share Target** + lectura de la página compartida (§2.1). |
| Camoufox / Patchright / playwright-stealth | Navegadores parcheados para no ser detectados | **No**: es una carrera contra Cloudflare, DataDome y Akamai que se pierde por diseño; ver §3. |
| Zyte, Firecrawl, ScraperAPI, Apify, Browserbase | Scraping como servicio | Firecrawl ya está en el nivel C de buscaproducto; el resto son proxies con otro nombre. En maydom no; en buscaproducto, lo que ya decide aquel plan. |
| APIs de apps móviles reversadas (ECI, Carrefour, Wallapop) | Capturar con mitmproxy el tráfico de la app | **No**: son APIs privadas, con tokens que caducan y contrato inexistente. El propio documento avisa de que viola los ToS. |
| Tabla por tienda con «protección» y «mejor estrategia» | Amazon anti-bot propio, ECI DataDome, Carrefour Cloudflare BM, Zara Akamai… | Útil como **mapa de qué no intentar**; se reutiliza en §4 invertida: la protección alta manda esa tienda a las vías 1–3. |
| Costes | Keepa 15–20 $/mes, proxies 50–150 $/mes, Firecrawl 0–16 $/mes… | Útil. Confirma que el stack sin evasión cuesta ~0. |
| Legal España/UE | «ToS: para uso personal la jurisprudencia es laxa»; *Ryanair v PR Aviation* (TJUE 2015) | [SUPUESTO] No verificado y en parte mal citado: *Ryanair v PR Aviation* (C-30/14) dice que una base de datos **sin** protección sui generis puede blindarse **por contrato**, es decir, los ToS **sí** valen. No se apoya ninguna decisión en esta lectura; plan B: consultar a alguien que sepa antes de hacer nada que dependa de ella. |

**Lo que ninguno de los dos dice** y es lo que más pesa para maydom: el coste de mantenimiento. Un adaptador «stealth» por tienda es una pieza que se rompe sin avisar, se descubre cuando el usuario la usa, y hay que arreglar desde una sesión de Code con un sandbox que **no alcanza las tiendas** (el proxy las bloquea). Eso ya pasó el 21-sep con cuatro plantillas de búsqueda de cinco. Un plan que multiplica esa clase de piezas es un plan que se mantendrá roto.

## 2. Plan por capas para maydom

Las capas se prueban en este orden. Cada una tiene un criterio de «hecho» que se comprueba en un workflow (el sandbox no llega a las tiendas; el runner de Actions sí).

### 2.1 Capa 1 · El usuario abre, maydom lee («compartir a maydom»)

Es la versión móvil y sin extensión de lo que Grok y Antigravity llaman «navegador del usuario». Mecánica:

1. El usuario está en la ficha del producto en el navegador o en la app de la tienda y pulsa **Compartir → maydom**. La PWA registra un **Web Share Target** en `manifest.webmanifest` (`share_target` con `url`, `text`, `title`). Plan B para navegadores sin Share Target (Safari iOS lo soporta desde 15; Firefox Android no): campo **«Pegar enlace»** en Compra y en el Buscador.
2. maydom recibe la URL. Lo que se puede leer **desde el propio móvil** ya viene en el `title`/`text` compartidos (nombre y a veces precio). Para más, el backend hace **una** petición `GET` a esa URL con un `User-Agent` que se identifica como `maydom/<build> (+https://npiobject-labs.github.io/maydom/)`, obedece `robots.txt` y extrae:
   - `application/ld+json` con `@type: Product` → `name`, `offers.price`, `offers.priceCurrency`, `offers.availability`, `image`, `brand`, `gtin`/`sku`;
   - si no hay JSON-LD, Open Graph (`og:title`, `og:image`, `product:price:amount`);
   - si tampoco, el `<title>` y nada más.
3. Si la tienda responde con bloqueo (403, 429, página de CAPTCHA, «Just a moment») el backend **no reintenta ni disfraza nada**: devuelve `bloqueada` y la app enseña la ficha mínima que llegó con el share y un campo **precio** para escribirlo a mano (o dictarlo). El dato manual vale igual: es el patrón «guardar primero, completar después» que ya usan notas y platos.
4. Lo leído se guarda como **producto** en la lista de la compra o en el stock, con `fuente: {dominio, url, fecha, via: 'jsonld'|'og'|'manual'}`. Un producto con `url` se puede **refrescar**: mismo flujo, mismo límite.

Criterio de hecho: `tiendas.yml` gana un paso que, para cada tienda del catálogo, abre una ficha de producto conocida y dice si tiene JSON-LD/OG y si el `GET` sin navegador lo devuelve o bloquea. La tabla resultante se guarda en la ficha de cada tienda (`lectura: 'jsonld'|'og'|'bloqueada'|'sin-datos'`) para que la app sepa de antemano qué esperar y no prometa lo que no va a dar.

Coste: 0. Riesgo: ninguno para el usuario (navega él). Cubre **todas** las tiendas, incluidas las de protección alta, porque el bloqueo solo afecta al paso 2 y el share ya trajo lo esencial.

**Dónde encaja el LLM:** con el texto compartido y lo extraído, `pedirJSON` normaliza (nombre limpio, cantidad, unidad, precio por unidad, categoría) con `X-Operacion: maydom-producto`. Y con una **foto de la etiqueta o del ticket** (ya existe `reducirImagen`) saca lo mismo sin que la tienda intervenga. Eso es «otros medios» de la petición: el ticket de compra es la fuente de precios más fiable que existe y no tiene anti-bot.

### 2.2 Capa 2 · Fuentes abiertas y APIs oficiales

Por fuente, no «por tienda», y solo las que no exigen ser afiliado con ventas:

| Fuente | Qué da | Cómo | Estado |
|---|---|---|---|
| **Open Food Facts** (`world.openfoodfacts.org/api/v2/product/{ean}`) | Ficha completa de alimentación por código de barras: nombre, marca, ingredientes, nutrientes, Nutri-Score, foto | API pública sin clave; `User-Agent` identificado como piden | **Primera a hacer.** Encaja con Alimentación y con el escaneo de código de barras (`BarcodeDetector` en Chrome Android; plan B: teclear el EAN). |
| **Keepa** (`api.keepa.com/product?asin=`) | Precio actual e histórico de Amazon, disponibilidad | Clave por usuario en Ajustes; tokens gratis al día [SUPUESTO: el plan gratuito sigue existiendo; plan B: enlace a camelcamelcamel] | Segunda: es la vía honesta a Amazon. |
| **Comparadores** (Idealo, Kelkoo) | Precio en varias tiendas | Idealo tiene API para partners; Kelkoo, feed para afiliados. [SUPUESTO] acceso concedido a un particular; plan B: siguen como enlace (nivel D) | Se pide acceso y se decide con la respuesta. |
| **Feeds de afiliado** (iHerb, Decathlon vía redes tipo Awin/Tradedoubler) | Catálogo con precio en CSV/XML | Alta como afiliado; la mayoría exige web con tráfico | [SUPUESTO] no viable para uso personal; plan B: capa 1. |
| **Google Shopping Content API** | Es para vendedores que suben su catálogo, no para consultar precios ajenos | — | Descartada: ambos documentos la citan mal. |

Criterio de hecho: `deploy.yml` verifica `GET /api/producto/ean/{ean}` contra Open Food Facts con un EAN conocido (el runner sí llega).

### 2.3 Capa 3 · buscaproducto como servicio

Cuando hace falta **buscar** (no leer una ficha concreta) con precios reales de varias tiendas, maydom no lo hace: llama a la API de `npiobject-labs/buscaproducto`, que ya tiene niveles A (API oficial), B (scraping respetuoso), C (adaptador universal con Firecrawl) y D (enlace), con las mismas reglas que aquí: `robots.txt` vinculante, «si hay API oficial no se scrapea», «las fuentes con anti-bot agresivo se quedan en D o A: nunca se intenta evadir». Cualquier mejora de agregación se hace **allí** y maydom la hereda. Esto ya está decidido en ADR-005; esta capa solo fija el contrato: `GET {BUSCAPRODUCTO_URL}/api/buscar?q=&categoria=` con la misma cabecera `X-Clave` del gateway, y el resultado se pinta en el buscador de maydom con «lo que he entendido» delante.

Criterio de hecho: variable `BUSCAPRODUCTO_URL` en Fly; sin ella, el buscador sigue en enlaces.

### 2.4 Capa 4 · Lectura respetuosa desde el servidor, solo para tiendas abiertas

Es la capa 1 sin el usuario: el backend busca en la tienda por su cuenta. Solo tiene sentido en tiendas que en el chequeo salen `ok` sin navegador (hoy: las que no bloquean y tienen buscador con `{q}` verificado) y con estas reglas fijas:

- `robots.txt` se lee y se obedece; si prohíbe `/search` o `/buscar`, esa tienda no entra en esta capa.
- Identificación honesta en `User-Agent`, sin cabeceras de móvil fingidas ni cookies de sesión del usuario.
- **1 petición por tienda cada 30 s** y caché de 24 h por consulta. Es el límite que propone Antigravity y es razonable.
- Primer 403/429/CAPTCHA → la tienda pasa a `bloqueada` en su ficha y se deja de consultar hasta que el chequeo semanal la vuelva a dar por abierta. Nunca se reintenta con otra IP ni con otro navegador.

En la práctica cubrirá pocas tiendas (el chequeo del 21-sep dio 12 de 29 bloqueando al robot y varias de las «ok» solo lo eran porque se medía el dominio, no la búsqueda), así que es la última capa en orden de implementación y puede no llegar a hacerse.

## 3. Lo que se descarta y por qué (para no volver a discutirlo)

| Técnica | Por qué no |
|---|---|
| Playwright stealth, Camoufox, Patchright, `playwright-extra` | Es una carrera de armamento contra empresas cuyo producto es detectarte (Cloudflare BM, DataDome, Akamai, PerimeterX). Funciona hoy, se rompe en la próxima actualización, y se descubre cuando el usuario lo usa. Con un sandbox que no alcanza las tiendas, cada rotura es una sesión entera. |
| Proxies residenciales (Bright Data, Oxylabs…) | 50–150 $/mes para un uso personal; las IPs residenciales salen de SDKs incrustados en apps de terceros, con consentimiento dudoso; y el propio Grok dice que Amazon y Wallapop los detectan. |
| Navegador remoto «con fingerprint real» (Browserbase, Steel, Hyperbrowser…) | Lo mismo que lo anterior con factura mensual y dependencia de un tercero. |
| APIs internas de apps móviles reversadas (`api.elcorteingles.es`, `api.carrefour.es`, Wallapop) | Sin contrato, con tokens que caducan y firmas que cambian; claramente contra los ToS. El documento de Antigravity lo reconoce. |
| Cookies de sesión del usuario en el servidor | Mueve credenciales del usuario a Fly y hace que la tienda vea al robot **como el usuario**: si bloquea, bloquea su cuenta. |
| Cabeceras de móvil fingidas en `requests` | Es mentir en la puerta; si la tienda tiene anti-bot no sirve, y si no lo tiene no hace falta. |

Además de la fragilidad, hay una razón de coherencia: `buscaproducto` fijó en su plan «sin proxies rotatorios, sin resolución de CAPTCHA, sin suplantar navegadores» y maydom decidió (ADR-005) no reimplementar buscaproducto. Adoptar aquí lo que allí se excluyó sería reimplementarlo, y en su versión peor.

## 4. Mapa por tienda del catálogo de maydom

Con la tabla de protección de Antigravity y el chequeo real del 21-sep (run 35598220846). «Vía» es por dónde llega el dato en este plan.

| Tienda | Protección (Antigravity) | Chequeo 21-sep | Vía |
|---|---|---|---|
| Amazon | Alta (propia) | bloquea al robot | Capa 2 Keepa; capa 1 al compartir |
| iHerb | Media (Cloudflare) | plantilla verificada ok | Capa 1; plantilla `{q}` sigue |
| El Corte Inglés | Alta (DataDome) | bloquea | Capa 1 |
| Carrefour | Alta (Cloudflare BM) | 503 al robot | Capa 1 |
| Dia, Mercadona, Alcampo | Baja/media | dominio vivo | Capa 1; candidatas a capa 4 si `robots.txt` lo permite |
| Decathlon, PcComponentes, FNAC, MediaMarkt | Media, **con JSON-LD** | dominio vivo | Capa 1 con ficha completa (JSON-LD) |
| HSN, Naturitas, MyProtein | — | plantillas rotas el 21-sep | Capa 1; plantilla solo si alguien la ve funcionar |
| Open Food Facts | Ninguna (API abierta) | ok | **Capa 2**, por EAN |
| Idealo, Camel | — | dominio vivo | Enlace; capa 2 si conceden API |
| Wallapop | Alta (API propia) | bloquea | Solo enlace y capa 1 con lo que traiga el share |
| Ocio (esmadrid, Atrápalo, Meetup, Time Out, Eventbrite) | — | dominio vivo | Enlace; no son productos |

## 5. Fases y orden

| Fase | Contenido | Toca | Verificación |
|---|---|---|---|
| **P1** | Web Share Target + «Pegar enlace»; `POST /api/producto/leer {url}` con JSON-LD/OG, `robots.txt`, UA identificado, estado `bloqueada`; producto con `fuente` en Compra; precio manual/dictado como plan B | `manifest.webmanifest`, `sw.js`, `nucleo.js`, `secciones/compra.js`, `app/src/main.rs` | `deploy.yml` lee una ficha pública conocida; `tiendas.yml` mide `lectura` por tienda |
| **P2** | Open Food Facts por EAN (`BarcodeDetector` o teclado) en Alimentación y Compra; normalización con el LLM (`maydom-producto`); foto de etiqueta/ticket → producto | `secciones/alimentacion.js`, `compra.js`, `llm.js`, backend | `deploy.yml` con un EAN conocido |
| **P3** | Keepa con clave del usuario en Ajustes; refresco de precio de productos con URL de Amazon | Ajustes, backend | `deploy.yml` sin clave → 503 `falta_keepa`; con clave → 200 |
| **P4** | Contrato con buscaproducto (`BUSCAPRODUCTO_URL`) y resultados en el buscador | `buscador.js`, backend | `deploy.yml` verifica el proxy si hay variable |
| **P5** | Capa 4 para las tiendas abiertas (solo si tras P1–P4 sigue haciendo falta) | backend, `tiendas.yml` semanal | El chequeo decide qué tiendas entran |

P1 y P2 dan el 80 % del valor: cualquier producto que el usuario tenga delante entra en maydom con precio, y cualquier alimento con código de barras trae su ficha. Ninguna de las dos depende de que una tienda «deje pasar» a nadie.

## 6. Reglas que quedan fijadas

1. **El humano abre, la app lee.** Ninguna función de maydom intenta parecer una persona ante una tienda.
2. **Un bloqueo es una respuesta, no un obstáculo:** se anota en la ficha de la tienda y se pide el dato al usuario. Nunca se reintenta con otra IP, otro navegador ni otras cabeceras.
3. `robots.txt` es vinculante para cualquier petición que salga del backend; el `User-Agent` dice quién es.
4. Las claves de terceros (Keepa) son del usuario, viven en Ajustes y viajan por `X-Clave` al backend; nunca en `docs/`.
5. Toda vía nueva se verifica desde un workflow (el sandbox no ve las tiendas), y su estado se guarda en la ficha de la tienda para que la app no prometa lo que no puede dar.
6. Agregación y comparación de precios en varias tiendas: buscaproducto, por API. Aquí no se reimplementa ni se «mejora» con evasión.
