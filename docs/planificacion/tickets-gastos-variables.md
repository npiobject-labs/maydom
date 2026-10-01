# Tickets de compra → desglose del gasto variable

**Estado**: planificado el 01-oct-2026, **sin desarrollo**. Decisión en [`memoria/decisiones/ADR-012-tickets-de-compra.md`](memoria/decisiones/ADR-012-tickets-de-compra.md) (propuesta). Preferencias del día en [`memoria/preferencias/2026-10-01.md`](memoria/preferencias/2026-10-01.md).

## 1. Qué se pide

Cada compra deja un ticket. El usuario le hace una foto y la sube a maydom; cuando llega el extracto de BBVA, el movimiento que corresponde a ese ticket se **asocia solo** (fecha, importe, comercio). Objetivo final: saber **qué parte del gasto variable es alimentación, ocio, ropa…**, que es justo lo que el extracto no dice: un cargo de supermercado de 7,55 € es una sola línea en el banco y cuatro cosas distintas en el ticket.

Pagado en efectivo, el ticket no tendrá nunca movimiento bancario, y aun así es gasto (ver §7.4).

## 2. Lo que ya existe y se reutiliza

| Pieza | Dónde | Para qué aquí |
|---|---|---|
| Foto → LLM multimodal | `reducirImagen()` y `pedirJSON({ imagen })` en `llm.js`; precedente: foto del frigorífico (`foto-stock`) | Leer el ticket. El backend acepta `data:image/…` de hasta 6 MB (cuerpo 8 MB) y 2.000 tokens de salida en JSON |
| Cofre cifrado (ADR-011) | `cofre.js`, `LISTAS` | Los tickets son datos de Finanzas: van cifrados, en dos listas nuevas |
| Movimientos con `id` estable | `finanzas/importar.js`: reimportar hace `Object.assign` sobre el existente | El vínculo `ticket.movimientoId` sobrevive a reimportar el extracto |
| Conceptos y `REGLAS` | `datos/semillas.js`, `finanzas/calculos.js` | Las categorías de cada línea son los mismos `CONCEPTOS`, así los listados siguen hablando un solo idioma |
| Registro `INFORMES` | `finanzas/informes.js` | Cada listado nuevo es una entrada más con sus parámetros |
| Repaso «una línea por cosa» | `componerDetalle()`/`leerDetalle()` de Ejercicio; `alAbrir` de `pedir()` | Las líneas del ticket se repasan en una caja de texto y el cuadre se recalcula al escribir |
| Guardar primero, interpretar después | Notas, Sueño | La foto se guarda como ticket «leyendo…» y nunca se pierde si el gateway falla |
| No pisar lo manual | `conceptoManual`, `tituloManual` | `catManual` en cada línea y `vinculoManual` en el ticket |
| Lector de ficheros | `extracto.js` (`textoPDF()`) | Tickets digitales en PDF (fase T5) sin escribir otro lector |

## 3. Anatomía de un ticket (del que adjuntó el usuario)

Ticket real de un supermercado de cadena. Aquí se reproduce **solo su estructura**: comercio, dirección, fecha, hora, número de factura, últimas cifras de la tarjeta y códigos de autorización quedan fuera, porque `docs/` es público. La foto **no** entra en el repositorio.

```
DESCRIPCION ARTICULO / CANTIDAD PVP/UNIT          IMPORTE €
CHOCOLATE NEGRO 85%                                1,89 B
CHULETAS PAVO AJILLO   0,763 kg  7,79 €/kg         5,94 B
BOLSA 50% RECICLADA                                0,15 C
BARRA PEREGRINA 250G                               0,79 A
OFERTAS
  CHULET.PAVO AJIL.DIA                            -1,22
TOTAL COMPRA                                       7,55
DESGLOSE IVA  (A) 4 % 0,76+0,03 · (B) 10 % 6,01+0,60 · (C) 21 % 0,12+0,03
TOTAL A PAGAR 7,55 · TARJETA 7,55 · TOTAL AHORRO 1,22
VENTA CONTACTLESS · TARJ. ************NNNN · FECHA DD/MM/AAAA HORA HH:MM
```

Lo que enseña:

- **Tres comprobaciones independientes**, todas en el navegador y sin LLM:
  1. líneas − ofertas = total: 1,89 + 5,94 + 0,15 + 0,79 − 1,22 = **7,55** ✓
  2. Σ (base + cuota) del IVA = total: 0,79 + 6,61 + 0,15 = **7,55** ✓
  3. «Total ahorro» = Σ ofertas: **1,22** ✓

  Si la lectura del modelo cuadra en las tres, se da por buena; si no, el ticket queda «a revisar» con la diferencia a la vista. Es la defensa contra un modelo pequeño leyendo papel térmico.
- **Las ofertas van aparte y nombran la línea** a la que se aplican, abreviada («CHULET.PAVO AJIL»). El importe efectivo de la línea es 5,94 − 1,22 = 4,72; repartir el descuento entre todas daría un desglose falso.
- **Líneas al peso**: cantidad, unidad y precio por kilo. Son el germen de un histórico de precios (fase T5).
- **El IVA delata la naturaleza**: 4 % pan y básicos, 10 % alimentación, 21 % el resto (la bolsa). Sirve de pista para clasificar sin LLM.
- **El pie trae medio de pago, últimas 4 cifras de la tarjeta, fecha y hora**: es lo que permite vincularlo con el banco y saber de qué cuenta sale.
- **Ticket largo y estrecho**: con el `reducirImagen()` de 1.024 px de lado mayor, un ticket como este queda en ~450 px de ancho y cada línea en unos 10 px de alto. Para tickets hay que subir a ~2.000 px (≈ 500–800 KB en JPEG), dentro del límite del backend.

## 4. Flujo de usuario

1. **Hacer la foto**. Finanzas → pestaña nueva **Tickets** (`?v=tickets`) → «📷 Ticket» (`data-a="ticket"`, fijable en Hoy). Abre la cámara (`<input type=file accept=image/* capture=environment>`) o la galería. Hay también «+ Ticket a mano» para el que no tenga foto.
2. **Se guarda al instante** como ticket «leyendo…» con lo único seguro (fecha de hoy) y se lanza `finanzas-ticket` en segundo plano. La foto no se guarda (§9).
3. **Repaso** en la ventana de `pedir()`: comercio, fecha, hora, total, medio de pago, últimas 4 cifras; debajo, **las líneas, una por renglón** («Chocolate negro 85 % · 1,89 · alimentación/dulces»), las ofertas con la línea a la que se aplican y, pintado con `alAbrir` y recalculado en cada `input`, **«Cuadra ✓ 7,55»** o **«Faltan 0,30 €»**. Se puede aceptar sin tocar nada.
4. **Vinculación**: si el movimiento ya está importado y es inequívoco, se vincula al guardar; si no, el ticket queda **pendiente** y se intenta de nuevo cada vez que se importa un extracto (§7). En efectivo, queda como **gasto en efectivo** y no se busca movimiento.
5. **En Movimientos**, el cargo vinculado lleva 🧾 y al abrirlo se ve el desglose; uno sin ticket ofrece «Vincular ticket» (lista de pendientes compatibles).
6. **En Listados**, el gasto de ese cargo cuenta por líneas: 7,40 € de alimentación (4,72 de carne, 1,89 de dulces, 0,79 de pan) y 0,15 € de hogar, en vez de 7,55 € de «alimentación» a secas (§8).

Estados del ticket, con su insignia en la lista: ⏳ leyendo · ⚠ a revisar (no cuadra o el modelo no leyó) · 🔗 pendiente de movimiento · ✓ vinculado · 💶 efectivo.

## 5. Modelo de datos

Dos listas nuevas en el cofre (`LISTAS` de `cofre.js`), cifradas como el resto de Finanzas:

```js
// estado.tickets[]
{
  id, creado,                         // marca de tiempo del alta
  origen: 'foto' | 'manual' | 'pdf',
  estado: 'leyendo' | 'revisar' | 'pendiente' | 'vinculado' | 'efectivo',
  comercio: 'SUPERMERCADO X',         // tal cual lo lee el modelo, normalizado a mayúsculas sin tildes
  fecha: '2026-09-15', hora: '16:30',
  total: 7.55,
  pagos: [{ medio: 'tarjeta', importe: 7.55, tarjeta: '1234' }],   // admite pago mixto (vale + tarjeta)
  lineas: [                           // claves cortas: un año de tickets pesa (§9)
    { d: 'CHOCOLATE NEGRO 85%', i: 1.89, iva: 10, c: 'alimentación', s: 'dulces y snacks' },
    { d: 'CHULETAS PAVO AJILLO', q: 0.763, u: 'kg', pu: 7.79, i: 5.94, iva: 10, c: 'alimentación', s: 'carne y pescado', dto: -1.22 },
    { d: 'BOLSA 50% RECICLADA', i: 0.15, iva: 21, c: 'hogar' },
    { d: 'BARRA PEREGRINA 250G', i: 0.79, iva: 4, c: 'alimentación', s: 'panadería', cm: true },  // cm = categoría puesta a mano
  ],
  ofertasSueltas: [],                 // descuentos que no se pudieron atribuir a una línea: se prorratean
  iva: [{ t: 4, base: 0.76, cuota: 0.03 }, …],
  cuadra: true,                       // las tres comprobaciones de §3
  movimientoId: null,                 // id del movimiento de banco
  vinculo: null | 'auto' | 'manual',
  diferencia: 0,                      // solo en vínculo manual con importe distinto (propina, preautorización)
  texto: '',                          // nota del usuario
}

// estado.clasesTicket[] — lo aprendido al corregir categorías (una por producto y comercio)
{ id: 'supermercado x|chocolate negro 85%', c: 'alimentación', s: 'dulces y snacks' }
```

- `clasesTicket` es lista con `id` y no un objeto porque el cofre fusiona entre copias abiertas **por `id`, lista a lista**; así no hay que tocar esa lógica.
- En el movimiento no se escribe nada: el vínculo vive en el ticket y `calculos.js` construye al vuelo el índice `movimientoId → ticket`. Reimportar un extracto no puede romperlo (rehace campos, conserva el `id`).
- La migración de `cargar()` no tiene nada que migrar: listas nuevas, vacías por defecto.

## 6. Lectura con el LLM: operación `finanzas-ticket`

- **Una llamada por ticket**, `pedirJSON({ operacion: 'finanzas-ticket', contexto: false, imagen, mensaje, tarea })`. `contexto: false`: el modelo no necesita saber nada del usuario para leer un papel.
- **Prompt en frases cortas y con un ejemplo de varias líneas** (lección del 26-sep con `ejercicio-relato`: el modelo pequeño del gateway, con instrucciones largas sin ejemplo, devolvía solo el primer elemento de la lista). Pide:
  `{"comercio","fecha":"AAAA-MM-DD","hora","total","pagos":[{"medio","importe","tarjeta"}],"lineas":[{"d","q","u","pu","i","iva","c","s"}],"ofertas":[{"d","i","linea"}],"iva":[{"t","base","cuota"}],"legible":true}`
  con `c` restringido a la lista de categorías y `linea` = índice de la línea a la que se aplica la oferta.
- **Lo que el modelo no hace**: sumar, cuadrar ni decidir el vínculo. Eso lo hace el navegador (§3, §7), así el resultado no depende del modelo.
- **Resolución**: `reducirImagen(f, 2000, 0.8)` para tickets. [SUPUESTO] basta para papel térmico; plan B: dos fotos (mitad superior e inferior) que el navegador apila en un solo lienzo antes de enviar, porque el backend solo adjunta una imagen por llamada.
- **Si no cuadra**: el ticket queda ⚠ y la ventana ofrece «Leer otra vez con un modelo mejor», que pasa `modelo` explícito (uno del catálogo con `imagen: true`; `consultar()` ya lo respeta si viene definido) y vuelve a cuadrar.
- **Ticket largo truncado**: con 2.000 tokens de salida caben unas 50 líneas. Si el backend avisa de respuesta a medias, el ticket queda ⚠ con lo leído. [SUPUESTO] un ticket doméstico rara vez pasa de 40 líneas; plan B: subir el tope solo para esta operación en el backend.
- **Plan B sin LLM** (gateway caído, sin clave, sin crédito): el ticket queda con lo que se teclee a mano —comercio, fecha, total y medio de pago— y **una sola línea** con la categoría que diga `adivinar()` por el comercio. Vale para vincular; el desglose por líneas se puede escribir a mano en la misma caja o pedir más tarde con «✨ Leer la foto» si se conservó (T5). No se plantea OCR local: Tesseract.js son varios MB de WASM para un resultado peor en papel térmico, y `TextDetector` sigue tras una bandera en Chrome.
- Fila nueva en la tabla de §4.1 del plan: Finanzas · foto del ticket → comercio, fecha, total, pago, líneas con categoría, ofertas e IVA · `finanzas-ticket`.

## 7. Vinculación con el movimiento del banco

### 7.1 Candidatos

Para un ticket pagado con tarjeta, un movimiento es candidato si:

- su importe es **exactamente** `−(importe pagado con tarjeta)`, comparado en céntimos (`Math.round(x * 100)`);
- su fecha está entre **un día antes y cuatro después** de la del ticket. [SUPUESTO] BBVA anota los pagos con tarjeta con la fecha de la operación, a veces uno a tres días tarde (contactless fuera de línea, fines de semana); plan B: ampliar la ventana a 7 días o usar también la `F.Valor` del extracto;
- no está vinculado ya a otro ticket.

### 7.2 Puntuación y decisión

```
puntos = 100
       − 15 × |días de diferencia|
       + 30 si un trozo del comercio (normalizado, ≥ 3 letras) aparece en la descripción del movimiento
       + 20 si la cuenta del movimiento es la que tiene apuntada esa tarjeta
```

- **Un solo candidato con ≥ 70 puntos** y el siguiente, si lo hay, 30 por debajo → **vínculo automático** (`vinculo: 'auto'`, se puede deshacer).
- **Varios parecidos** → no se adivina: el ticket queda 🔗 y la ventana enseña los candidatos para elegir con un toque.
- **Ninguno** → 🔗 pendiente. Se vuelve a intentar **al terminar cada importación** (gancho al final del cotejo en `finanzas/importar.js`) y el resumen de la carga lo dice: «3 tickets vinculados, 1 sigue pendiente».
- Dos tickets del mismo importe el mismo día (dos cafés iguales) se resuelven igual que el cotejo de importar, por multiplicidad: cada ticket consume un movimiento, el de más puntos primero.

### 7.3 Tarjeta → cuenta

Las últimas 4 cifras de la tarjeta se aprenden en el primer vínculo: la cuenta guarda `tarjetas: ['1234']` (cifrado, como su IBAN). Desde entonces suma puntos y, en Movimientos, la cuenta propuesta para un ticket es la suya. [SUPUESTO] el Excel de BBVA no trae la tarjeta en cada movimiento; si la trae en `Observaciones`, se usa también como prueba fuerte (+40).

### 7.4 Efectivo y casos raros

- **Efectivo**: sin vínculo; el ticket es un gasto por sí mismo, con la fecha del ticket y la «cuenta» virtual Efectivo. Como la retirada del cajero ya es **neutra** (`CONCEPTOS_NEUTROS`), contar el ticket no duplica nada: el dinero sale del banco como traspaso y se gasta cuando hay ticket. Un listado dirá cuánto efectivo retirado queda sin justificar con tickets.
- **Importe distinto** (propina añadida en el datáfono, preautorización de gasolinera, ticket que no recoge una bolsa): solo vínculo **manual**, y la diferencia se guarda y se reparte en proporción entre las líneas.
- **Pago mixto** (vale + tarjeta): se coteja solo la parte de tarjeta (`pagos`).
- **Devolución**: un ticket con total negativo busca un abono con el mismo importe; sus líneas restan de su categoría.

## 8. Clasificación por líneas y efecto en los listados

### 8.1 Categorías

- **Nivel 1 = `CONCEPTOS`** de siempre (alimentación, restauración, ropa, ocio, salud, compras…), para que un ticket y un movimiento sin ticket sumen en la misma columna.
- **Dos conceptos nuevos** que un supermercado necesita y hoy acaban en «otros» o «compras»: **hogar** (limpieza, droguería, menaje, bolsas, pilas) y **cuidado personal** (higiene, cosmética). Pendiente de visto bueno (§12).
- **Nivel 2 solo para alimentación** (`s`): fruta y verdura, carne y pescado, lácteos y huevos, panadería, despensa, dulces y snacks, bebidas, congelados y preparados. Es lo que conecta con Alimentación y con la pregunta «¿cuánto se va en dulces?».

### 8.2 Quién pone la categoría, por orden

1. **Lo aprendido** en `clasesTicket` (producto + comercio): si el usuario corrigió «Barra peregrina» a panadería, el siguiente ticket ya llega así, sin LLM.
2. **Lo que diga el modelo** en la misma llamada de lectura.
3. **Reglas locales** de `interpretar-ticket.js` (palabras genéricas de producto, nunca marcas ni nombres de personas) y la pista del IVA (4 % → alimentación básica, 21 % → no alimentación). Son el plan B y la red cuando el modelo devuelve una categoría que no está en la lista.

Corregir una línea marca `cm` y escribe en `clasesTicket`; **reclasificar nunca pisa `cm`**, igual que `conceptoManual`.

### 8.3 Cómo cuenta en los listados

Función nueva `partidas(filtros)` en `finanzas/calculos.js`, que sustituye a `estado.movimientos` donde se reparte gasto por concepto:

- **Movimiento sin ticket** → una partida: él mismo, con su concepto.
- **Movimiento con ticket que cuadra** → una partida por línea con su importe efectivo (línea + su oferta + su parte de lo no atribuido), escalado al importe real del movimiento; el redondeo sobrante va a la línea mayor, así **la suma es exactamente el cargo del banco**. Fecha y cuenta, las del movimiento.
- **Ticket con ⚠** → cuenta como el movimiento entero, sin desglose, hasta repasarlo.
- **Ticket en efectivo** → sus partidas, con la fecha del ticket y la cuenta Efectivo.

Cambios en `INFORMES`:

| Listado | Cambio |
|---|---|
| Gasto por concepto | Nuevo parámetro «Desglosar tickets» (sí por defecto) e «Incluir efectivo con ticket» |
| Resumen del año | El gasto real suma los tickets en efectivo; línea «Efectivo retirado sin ticket» |
| **Gasto variable** (nuevo) | Periodo, cuenta (por defecto «Ingresos y gastos variables») y agrupación por categoría, subcategoría de alimentación o comercio. Es la respuesta directa a la petición |
| **Tickets** (nuevo) | Por estado: a revisar, pendientes de movimiento, efectivo; con acceso a cada uno |
| **Cobertura** (nuevo, T4) | Qué parte del gasto de la cuenta de variables tiene ticket, y los cargos más altos sin él |

## 9. Privacidad y almacenamiento

- **Todo ticket va cifrado en el cofre** (ADR-011): revela dónde, cuándo y qué compra el usuario, y con qué tarjeta. Cerrada Finanzas, ninguna sección lo ve.
- **La foto viaja al gateway** y de ahí al proveedor del modelo, como la del frigorífico. Incluye las últimas cifras de la tarjeta y el comercio. [SUPUESTO] aceptable, igual que el extracto en PDF que ya se le puede mandar (`finanzas-extracto`); plan B: recortar el pie del ticket antes de enviarlo (el pago y la fecha se teclean).
- **La foto no se guarda** por defecto (mismo criterio que el extracto, D16): lo que vale son los datos. Opción por ticket «Conservar la foto» para devoluciones y garantías (T5): JPEG reducido en IndexedDB, cifrado con la misma llave, fuera de `localStorage` y fuera de la copia JSON.
- **Peso**: un ticket de 15 líneas son ~1,5 KB de JSON; uno al día, ~0,7 MB al año ya cifrado (base64). `localStorage` da ~5 MB por origen **compartidos con toda la organización en Pages** (ADR-011). [SUPUESTO] caben dos o tres años; plan B: llevar el cofre a IndexedDB, que el cofre ya escribe de forma asíncrona y en cola, así que el cambio queda dentro de `cofre.js`. Se vigila con un aviso en Ajustes cuando el cofre pase de 2 MB.
- **Pruebas**: nunca con el ticket real. La prueba de humo genera un ticket **inventado** pintándolo en un `<canvas>` con Playwright y responde con un gateway simulado en el 8098, como el resto de pruebas con LLM.

## 10. Hacer la foto sin abrir Finanzas

Abrir Finanzas pide la clave, y en la cola del súper eso es fricción. Dos niveles:

- **T1 (sencillo)**: «📷 Ticket» vive dentro de Finanzas y se fija en Hoy. Hay que arreglar antes un fallo que afecta a cualquier acceso fijado de Finanzas: `lanzarAccion()` (en `accesos.js`) quita `?accion=` de la ruta y busca el botón **mientras se ve el candado**, así que avisa «Esa acción no está ahora mismo en Finanzas» y la pierde. El candado tiene que guardar la acción pendiente y lanzarla al abrirse. El envío del formulario de la clave es un gesto del usuario, así que el `click()` que abre la cámara justo después debería estar permitido. [SUPUESTO]; plan B: que al abrirse se vea un botón grande «📷 Hacer la foto» en lugar de disparar la cámara.
- **T5 (buzón sellado)**, si la clave en la cola molesta: al crear la clave se genera un par ECDH P-256; la **pública** queda en claro en `maydom.v1` y la **privada** dentro del cofre. Fuera de Finanzas, «📷 Ticket» lee la foto con el gateway y **cifra el resultado con la pública** (ECDH efímero + AES-GCM) en `maydom.buzon`: se puede escribir sin la clave pero no leer. Al abrir Finanzas se descifra el buzón, los tickets pasan a la lista y se vinculan. Encaja con ADR-011 sin rebajarlo: sin clave nadie lee un ticket.

## 11. Fases

| Fase | Contenido | Ficheros | Prueba de humo | Estimación |
|---|---|---|---|---|
| **T1** · Leer | Pestaña Tickets; foto → `finanzas-ticket` → repaso con cuadre en vivo; alta a mano; efectivo; dos listas en el cofre; acción pendiente tras el candado; conceptos hogar y cuidado personal | `secciones/finanzas.js`, `finanzas/tickets.js` (nuevo), `interpretar-ticket.js` (nuevo, funciones puras: `cuadrar`, `componerLineas`/`leerLineas` con ida y vuelta, `atribuirOfertas`, reglas), `cofre.js`, `accesos.js`, `datos/semillas.js`, `sw.js`, `pages.yml` (rutas nuevas) | `tools/prueba-tickets.mjs`: ticket inventado en canvas, gateway simulado, cuadre, ⚠ con una línea mal leída, acceso de Hoy a través del candado | ~4 h |
| **T2** · Vincular | Candidatos, puntos y multiplicidad; vínculo al guardar y al terminar cada importación; tarjeta → cuenta; 🧾 en Movimientos, «Vincular ticket», deshacer | `finanzas/vincular.js` (nuevo, puro), `finanzas/importar.js` (gancho), `finanzas.js` | La misma prueba importando el Excel de prueba de `tools/datos/` con un cargo que cuadre, otro gemelo y otro desplazado tres días | ~3 h |
| **T3** · Desglosar | `partidas()`; Gasto por concepto desglosado; listados Gasto variable y Tickets; efectivo en el resumen del año | `finanzas/calculos.js`, `finanzas/informes.js` | `prueba-finanzas-pestanas` (ninguna fecha ISO a la vista) y comprobación de que Σ partidas = Σ movimientos | ~3 h |
| **T4** · Aprender | `clasesTicket`, subcategorías de alimentación, «Reclasificar líneas», listado Cobertura | `interpretar-ticket.js`, `finanzas/tickets.js`, `informes.js` | Corregir una línea y que el ticket siguiente llegue corregido sin LLM | ~2 h |
| **T5** · Extras (a demanda) | Buzón sellado (§10); conservar foto en IndexedDB; dos fotos apiladas; ticket digital en PDF por `extracto.js`; compartir a maydom (`share_target`, con D14); lo comprado de Compra marcado y stock de Alimentación; histórico de precios por producto (enlaza con P2 de [`obtener-datos-de-productos.md`](obtener-datos-de-productos.md)) | varios | una por pieza | — |

T1 y T2 son lo mínimo para que tenga sentido; T3 es lo que contesta la pregunta del usuario. Antes de T1, como manda `CLAUDE.md`, un workflow temporal en la rama de trabajo comprueba qué devuelve el modelo real con un ticket **inventado** (los logs del repo son públicos).

## 12. Decisiones que tiene que tomar el usuario

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Pedir la clave de Finanzas para hacer la foto? | Sí en T1 (es lo que ya hay); buzón sellado (T5) solo si en el uso real molesta |
| 2 | ¿Conservar la foto del ticket? | No por defecto; casilla por ticket para lo que tenga garantía o devolución |
| 3 | ¿Conceptos nuevos «hogar» y «cuidado personal» y subcategorías solo en alimentación? | Sí: sin ellos, la mitad de un ticket de droguería acaba en «otros» |
| 4 | ¿Los tickets en efectivo cuentan como gasto? | Sí: la retirada ya es neutra, así que es la única forma de que ese gasto aparezca |
| 5 | ¿Vincular solo o preguntar siempre? | Solo cuando es inequívoco (§7.2), con «deshacer» a la vista; preguntar cuando hay dudas |
| 6 | ¿Avisar de cargos grandes de la cuenta de variables sin ticket? | No como aviso; sí en el listado Cobertura (T4) |

## 13. Supuestos sin verificar

| Supuesto | Cómo se comprueba | Plan B |
|---|---|---|
| El modelo del gateway lee bien un ticket térmico a 2.000 px | Workflow temporal con un ticket inventado antes de T1, y la primera semana de uso real (el cuadre lo delata) | «Leer otra vez con un modelo mejor»; dos fotos apiladas |
| BBVA anota el pago con tarjeta en la fecha de la compra o hasta 4 días después | Primer extracto con tickets ya cargados | Ventana de 7 días o usar `F.Valor` |
| El movimiento de BBVA nombra al comercio de forma reconocible | Ídem | Sin comercio, solo importe y fecha (−30 puntos): más casos van a «elegir» en vez de automáticos |
| La cámara se puede abrir justo después de dar la clave | Prueba en el móvil | Botón grande tras abrir |
| `localStorage` aguanta años de tickets | Aviso de tamaño en Ajustes | Cofre a IndexedDB |
