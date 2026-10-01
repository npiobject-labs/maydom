# Tickets de compra → desglose del gasto variable

**Estado**: planificado el 01-oct-2026 y revisado el mismo día para que valga para **cualquier formato de ticket**; **sin desarrollo**. Decisión en [`memoria/decisiones/ADR-012-tickets-de-compra.md`](memoria/decisiones/ADR-012-tickets-de-compra.md) (propuesta). Preferencias del día en [`memoria/preferencias/2026-10-01.md`](memoria/preferencias/2026-10-01.md).

## 1. Qué se pide

Cada compra deja un ticket. El usuario le hace una foto y la sube a maydom; cuando llega el extracto de BBVA, el movimiento que corresponde a ese ticket se **asocia solo** (fecha, importe, comercio). Objetivo final: saber **qué parte del gasto variable es alimentación, ocio, ropa…**, que es justo lo que el extracto no dice: un cargo de supermercado es una línea en el banco y varias cosas distintas en el ticket.

**Los tickets son muy variados.** Cada comercio tiene su formato y el mismo comercio repite el suyo, pero entre comercios no se parecen. El ticket que adjuntó el usuario (apéndice A) es **un ejemplo, no el molde**.

## 2. Principio de diseño: tolerar la variedad, aprender lo que se repite

1. **Ningún código conoce el formato de un comercio.** No hay plantillas ni expresiones regulares por tienda. Misma lección que las plantillas de búsqueda del 21-sep: de cinco escritas a ojo fallaron cuatro. Leer el ticket es cosa del modelo, que ve la imagen entera, sea cual sea su disposición.
2. **Un solo esquema, casi todo opcional.** Un ticket válido puede ser solo «comercio, fecha y total» (parking, taxi, máquina). Las líneas, el IVA, los descuentos y los pagos se rellenan cuando el papel los trae.
3. **Comprobaciones según lo que haya.** El navegador aplica las que el ticket permita (§7.3); que falte un apartado no es un error.
4. **Lo que se repite por comercio se aprende como dato**, no se programa: un **perfil del comercio** (§6) con sus nombres en el ticket y en el banco, su tipo, su categoría por defecto, si merece desglose por línea, cuántos días tarda en llegar al banco y pistas de lectura. Se crea con el primer ticket y mejora con cada corrección.
5. **El tipo de comercio decide el tratamiento.** Un restaurante no necesita desglose por línea (todo es restauración) y puede llevar propina. Un supermercado o unos grandes almacenes sí lo necesitan. Una gasolinera puede cobrar distinto de lo que dice el ticket.
6. **Se prueba con un muestrario variado e inventado** (§13), nunca con un solo ticket ni con tickets reales.

## 3. Qué variedad hay que esperar

| Tipo | Rasgos que cambian | Qué implica en maydom |
|---|---|---|
| Supermercado, hipermercado, droguería | Muchas líneas; productos al peso; «2 x 1,50»; ofertas en un bloque aparte que nombra la línea, o en negativo justo debajo, o como «2ª ud −50 %»; cupones, puntos, vales; IVA por letras, por porcentaje o sin desglose; bolsa | Desglose por línea; los descuentos se atribuyen a su línea si se puede y, si no, se prorratean |
| Grandes almacenes, bazar, compra online | Artículos de naturaleza muy distinta en un mismo ticket (ropa, menaje, electrónica); gastos de envío; descuento global | Desglose por línea con categoría por artículo; el envío va con el artículo o en «otros» |
| Restaurante, bar, cafetería | Platos y bebidas; comensales; a menudo sin desglose de IVA; la **propina se añade en el datáfono** y no sale en el ticket | Una sola categoría (restauración) y no se clasifica línea a línea; el cargo puede ser mayor que el ticket |
| Gasolinera | Litros y precio por litro; **preautorización** que se ajusta después | Transporte; el vínculo admite diferencia y a veces llegan dos cargos |
| Farmacia, óptica, clínica | Receta, aportación del usuario, IVA a 4/10/21 % | Salud; **los nombres de medicamentos son datos de salud** (§11) |
| Ropa, calzado | Talla, referencia, ticket regalo, descuento porcentual; cambios y devoluciones | Ropa; las devoluciones restan |
| Ticket sin líneas | Parking, taxi, peaje, transporte, máquina, entradas | Solo total; la categoría la da el comercio |
| Factura completa | Con NIF del cliente, número de factura, a veces en A4 | Mismo esquema; suele traer el desglose de IVA |
| Ticket digital | Captura de la app del comercio, PDF o correo | Captura = imagen; PDF con texto = llamada de texto (más barata y fiable); fase T5 |
| Fuera de lo habitual | Manuscrito; en otro idioma; en **otra divisa** (viaje); pago mixto (vale + tarjeta, efectivo + tarjeta); total negativo (devolución) | Divisa: el banco cobra otro importe (cambio y comisión); pago mixto: solo se coteja la parte de tarjeta |
| Calidad de la foto | Papel térmico desvaído, arrugado, torcido, con sombras; ticket muy largo | Resolución mayor para tickets (§7.4); varias fotos apiladas; si no se lee, «a revisar» y no se inventa nada |

## 4. Lo que ya existe y se reutiliza

| Pieza | Dónde | Para qué aquí |
|---|---|---|
| Foto → LLM multimodal | `reducirImagen()` y `pedirJSON({ imagen })` en `llm.js`; precedente: foto del frigorífico (`foto-stock`) | Leer el ticket. El backend acepta `data:image/…` de hasta 6 MB (cuerpo 8 MB) y 2.000 tokens de salida en JSON |
| Cofre cifrado (ADR-011) | `cofre.js`, `LISTAS` | Tickets, comercios y lo aprendido van cifrados con el resto de Finanzas |
| Movimientos con `id` estable | `finanzas/importar.js`: reimportar hace `Object.assign` sobre el existente | El vínculo con el movimiento sobrevive a reimportar el extracto |
| Conceptos y `REGLAS` | `datos/semillas.js`, `finanzas/calculos.js` | Las categorías de cada línea son los mismos `CONCEPTOS`; `adivinar()` da la categoría de partida de un comercio nuevo |
| Registro `INFORMES` | `finanzas/informes.js` | Cada listado nuevo es una entrada más con sus parámetros |
| Repaso «una línea por cosa» | `componerDetalle()`/`leerDetalle()` de Ejercicio; `alAbrir` de `pedir()` | Las líneas se repasan en una caja de texto y las comprobaciones se recalculan al escribir |
| Guardar primero, interpretar después | Notas, Sueño | La foto se guarda como ticket «leyendo…» y nunca se pierde si el gateway falla |
| No pisar lo manual | `conceptoManual`, `tituloManual` | Marcas de manual en línea, ticket, vínculo y perfil |
| Lector de ficheros | `extracto.js` | Tickets en PDF (T5) sin escribir otro lector |

## 5. Esquema único del ticket

Listas nuevas en el cofre (`LISTAS` de `cofre.js`): `tickets`, `comercios` y `productos`. Todas tienen `id` porque el cofre fusiona entre copias abiertas **por `id`, lista a lista**.

```js
// estado.tickets[] — solo fecha y total son imprescindibles; lo demás, si el papel lo trae
{
  id, creado, origen: 'foto' | 'captura' | 'pdf' | 'manual',
  estado: 'leyendo' | 'revisar' | 'pendiente' | 'vinculado' | 'efectivo',
  comercioId,                          // perfil del comercio (§6)
  comercioTexto: 'NOMBRE TAL CUAL',    // lo que pone el papel
  doc: 'ticket' | 'factura' | 'pedido',
  fecha: 'AAAA-MM-DD', hora: 'HH:MM',
  total: 0, divisa: 'EUR',
  lineas: [{                           // puede estar vacía; claves cortas porque un año de tickets pesa (§11)
    d: 'texto tal cual', n: 'nombre genérico',   // n lo pone el modelo: «chocolate negro», «chuletas de pavo»
    q: 1, u: 'ud' | 'kg' | 'l', pu: 0, i: 0,     // cantidad, unidad, precio unitario, importe
    dto: 0,                                      // descuentos atribuidos a esta línea (negativo)
    iva: 10, c: 'alimentación', s: 'carne y pescado',
    cm: false,                                   // categoría puesta a mano
  }],
  descuentos: [{ d, i }],              // los que no se pudieron atribuir a una línea: se prorratean
  extras: [{ d: 'propina' | 'envío' | 'recargo' | 'redondeo', i }],
  iva: [{ t: 10, base: 0, cuota: 0 }],
  pagos: [{ medio: 'tarjeta' | 'efectivo' | 'vale' | 'otro', importe: 0, tarjeta: '1234' }],
  comprobacion: 'cuadra' | 'sin-comprobar' | 'no-cuadra', faltan: 0,
  vinculos: [{ movimientoId, importe }],         // admite 1 ticket ↔ varios cargos y varios tickets ↔ 1 cargo
  vinculo: null | 'auto' | 'manual',
  texto: '',                           // nota del usuario
}
```

- **En el movimiento no se escribe nada**: el vínculo vive en el ticket y `calculos.js` construye al vuelo el índice `movimientoId → tickets`. Reimportar un extracto no puede romperlo.
- `n` (nombre genérico) es lo que permite juntar el mismo producto de comercios que lo abrevian distinto («CHULET.PAVO AJIL» y «Chuletas pavo ajillo 500 g»). Prepara el histórico de precios (T5).
- La migración de `cargar()` no tiene nada que migrar: son listas nuevas, vacías por defecto.

## 6. El perfil del comercio: lo que se aprende

```js
// estado.comercios[]
{
  id, nombre: 'Nombre corto',               // editable
  nombresTicket: ['NOMBRE EN EL TICKET', 'RAZÓN SOCIAL'],   // cómo aparece en el papel
  cif: '',                                  // identificador fiscal del comercio si el ticket lo trae: la clave más estable
  descriptoresBanco: ['TEXTO EN EL EXTRACTO'],              // aprendidos al vincular (§8.2)
  tipo: 'supermercado' | 'grandes-almacenes' | 'online' | 'restaurante' | 'gasolinera' | 'farmacia' | 'ropa' | 'transporte' | 'ocio' | 'otro',
  categoria: 'alimentación', desglosar: true,               // restaurante, gasolinera, transporte: false
  retraso: { min: 0, max: 2 },              // días entre el ticket y el cargo, observados
  ivaLetras: { A: 4, B: 10, C: 21 },        // si el comercio marca el IVA con letras
  pistas: [],                               // frases cortas para releer sus tickets (§7.5)
  modelo: '',                               // si el modelo barato falla a menudo con este comercio
  lecturas: 0, cuadradas: 0, corregidas: 0, // fiabilidad visible en la pestaña
  manual: [],                               // campos que el usuario fijó a mano: ninguna lectura los pisa
}

// estado.productos[] — categoría aprendida por producto y comercio
{ id: '<comercioId>|<texto normalizado>', n: 'nombre genérico', c: 'alimentación', s: 'dulces y snacks' }
```

**Cómo se reconoce el comercio** tras leer el ticket, por orden: el CIF si lo trae; uno de sus `nombresTicket` (normalizado, sin tildes ni signos); si no, se propone el más parecido y el usuario confirma o crea uno nuevo. El primer ticket de un comercio crea su perfil con el `tipo` y la categoría que proponga el modelo (o `adivinar()` por el nombre), y la ventana de repaso lo enseña para corregirlo una vez.

**Para qué sirve**, siempre después de leer y casi todo sin LLM:
- **Categoría**: si `desglosar` es falso, todas las líneas van a la categoría del comercio, diga lo que diga el modelo.
- **IVA por letras**: se traducen con `ivaLetras` cuando el modelo devuelve la letra y no el porcentaje.
- **Vínculo**: descriptores del banco, retraso y tolerancias por tipo (§8).
- **Segunda lectura**: con sus `pistas` y su `modelo`, solo si la primera no cuadra (§7.5).
- **Fiabilidad**: si un comercio acumula correcciones, la pestaña lo dice y ofrece fijarle un modelo mejor.

[SUPUESTO] Basta con aplicar el perfil después de leer, porque no se sabe de qué comercio es un ticket hasta leerlo. Plan B: elegir el comercio antes de la foto (con «el último» a un toque) para mandar las pistas ya en la primera llamada.

## 7. Lectura con el LLM: operación `finanzas-ticket`

### 7.1 Entrada
- **Foto** (cámara o galería) o **captura de pantalla** de un ticket digital: imagen.
- **Varias fotos** de un ticket largo: se apilan en un solo lienzo en el navegador, porque el backend adjunta una imagen por llamada.
- **PDF** (factura online, ticket por correo), en T5: si `extracto.js` le saca texto, va como **texto**, sin imagen: más barato y sin errores de lectura. Un PDF escaneado sin texto pide una captura. [SUPUESTO] El gateway no acepta PDF como adjunto; plan B: la captura.

### 7.2 La llamada
- Una llamada por ticket, `pedirJSON({ operacion: 'finanzas-ticket', contexto: false, imagen, mensaje, tarea })`.
- **Prompt general, en frases cortas, con dos ejemplos inventados y opuestos**: un supermercado con ofertas y productos al peso, y un restaurante sin desglose de IVA. Nunca el ticket del usuario. Lección del 26-sep (`ejercicio-relato`): sin un ejemplo de varios elementos, el modelo pequeño devolvía solo el primero.
- Reglas para el modelo: copiar los textos tal cual; números con punto decimal; fecha en ISO; **no inventar** líneas, IVA ni pagos que no estén en el papel; marcar con `legible: false` lo que no se lea; devolver el tipo de comercio y, por línea, la categoría (de la lista cerrada) y el nombre genérico.
- **Lo que el modelo no hace**: sumar, cuadrar, decidir el comercio ni el vínculo. Eso es del navegador, así que el resultado no depende de cómo le dé por redondear al modelo.

### 7.3 Comprobaciones según lo que traiga
Cada una se aplica solo si el ticket tiene los datos. Tolerancia: 1 céntimo por línea, para redondeos.

| Comprobación | Se aplica si hay |
|---|---|
| cantidad × precio unitario = importe, línea a línea | `q` y `pu` |
| Σ líneas + descuentos + extras = total | líneas con importe |
| Σ (base + cuota) del IVA = total | desglose de IVA |
| Σ pagos = total | pagos |
| ahorro declarado = Σ descuentos | un «total ahorro» o similar |

Resultado: **✓ cuadra** (al menos una se aplica y ninguna falla), **· sin comprobar** (solo hay total: un taxi), **⚠ no cuadra** (con lo que falta a la vista). «Sin comprobar» no es un error y se vincula igual.

### 7.4 Resolución
`reducirImagen()` deja la foto en 1.024 px de lado mayor: un ticket largo y estrecho queda con letras de unos 10 px. Para tickets, ~2.000 px (≈ 500–800 KB en JPEG), dentro del límite del backend. [SUPUESTO] Basta para papel térmico; plan B: varias fotos apiladas.

### 7.5 Si no cuadra
1. **Segunda lectura con el perfil**, si el comercio tiene `pistas` o `modelo`: la misma llamada con esas frases añadidas («las ofertas van en un bloque aparte y nombran la línea abreviada», «el IVA va con letras al final de cada línea») y, si lo tiene, su modelo.
2. Si no, la ventana ofrece **«Leer otra vez con un modelo mejor»** (uno del catálogo con `imagen: true`; `consultar()` ya respeta un `modelo` explícito).
3. **Las pistas se escriben solas o a mano**: al corregir un ticket que no cuadraba, «¿Recordar cómo leer este comercio?» pide al modelo una frase a partir de lo leído y lo corregido (operación `finanzas-ticket-pista`, a petición). El usuario la puede editar. T4.

Ticket muy largo: con 2.000 tokens de salida caben unas 50 líneas. Si la respuesta llega a medias, queda ⚠ con lo leído. [SUPUESTO] Un ticket doméstico rara vez pasa de 40 líneas; plan B: subir el tope solo para esta operación en el backend.

### 7.6 Sin LLM
Si el gateway está caído o no hay clave ni crédito, se teclean comercio, fecha, total y medio de pago, y queda **una sola línea** con la categoría del perfil o de `adivinar()`. Eso basta para vincular; el desglose se puede escribir a mano en la misma caja. No se plantea OCR local: Tesseract.js son varios MB de WASM para un resultado peor en papel térmico, y `TextDetector` sigue tras una bandera en Chrome.

Fila nueva en la tabla de §4.1 del plan: Finanzas · foto o captura del ticket → comercio, tipo, fecha, total, pagos, líneas con categoría, descuentos e IVA · `finanzas-ticket` (y `finanzas-ticket-pista` a petición).

## 8. Vinculación con el movimiento del banco

### 8.1 Candidatos y puntos
Para un ticket con pago con tarjeta, un movimiento es candidato si:
- el importe encaja con la tolerancia del tipo de comercio (tabla siguiente), comparando en céntimos;
- la fecha cae en la ventana del comercio (`retraso` aprendido o, si es nuevo, de −1 a +4 días);
- no está ya vinculado por completo.

```
puntos = 100
       − 15 × días fuera del retraso habitual del comercio
       + 40 si la descripción del movimiento contiene uno de sus descriptoresBanco
       + 20 si no, pero contiene un trozo de su nombre (≥ 3 letras)
       + 20 si la cuenta es la que tiene apuntada esa tarjeta
       − 30 si el importe no es exacto (aunque esté dentro de la tolerancia)
```

| Tipo de comercio | Tolerancia de importe | Automático |
|---|---|---|
| General | Exacto | Sí, si es inequívoco |
| Restaurante, bar | Del total al total + 25 % (propina en el datáfono) | Solo si es exacto; si no, se propone |
| Gasolinera | ± 2 € o preautorización y cargo final | Se propone |
| Otra divisa | ± 4 % del cambio del día (cambio y comisión) | Se propone |
| Online | Exacto, o varios cargos que suman el pedido (o al revés) | Solo 1:1 exacto; las sumas se proponen |

**Decisión**: con un solo candidato de ≥ 70 puntos y el siguiente 30 por debajo, **vínculo automático** (se puede deshacer). Con varios parecidos, el usuario elige con un toque. Sin ninguno, 🔗 **pendiente**: se reintenta al terminar cada importación (gancho al final del cotejo de `finanzas/importar.js`) y el resumen de la carga lo dice. Dos tickets gemelos (mismo importe y día) se resuelven por multiplicidad, como el cotejo de importar.

### 8.2 Lo que aprende cada vínculo
- El **texto del banco** pasa a `descriptoresBanco` del comercio. El nombre del ticket («nombre comercial») y el del banco («razón social», a veces recortada) casi nunca coinciden; tras el primer vínculo, el siguiente ya puntúa alto.
- El **retraso** observado ajusta la ventana del comercio (una gasolinera o una tienda online pueden cobrar días después).
- Las **últimas 4 cifras de la tarjeta** se apuntan en la cuenta (`tarjetas`, cifrado como su IBAN).

[SUPUESTO] El Excel de BBVA no trae la tarjeta en cada movimiento; si la trae en `Observaciones`, se usa como prueba fuerte (+40).

### 8.3 Varios con varios
- **Un ticket y varios cargos** (pedido online enviado en dos partes, preautorización y cargo final): `vinculos` con el importe de cada uno, y las partidas se reparten en proporción.
- **Varios tickets y un cargo** (dos compras pagadas juntas, un pedido con varios vendedores): cada ticket apunta al mismo movimiento con su parte. La app solo propone combinaciones de dos o tres pendientes del mismo comercio y día que sumen el cargo exacto.
- **Pago mixto**: se coteja solo la parte pagada con tarjeta.
- **Devolución**: total negativo que busca un abono del mismo comercio.

### 8.4 Efectivo
No se busca vínculo: el ticket es un gasto por sí mismo, con la fecha del ticket y la «cuenta» virtual Efectivo. La retirada de cajero ya es **neutra** (`CONCEPTOS_NEUTROS`), así que contar el ticket no duplica nada. Un listado dirá cuánto efectivo retirado queda sin justificar con tickets.

## 9. Clasificación

### 9.1 Categorías
- **Nivel 1 = `CONCEPTOS`** de siempre, para que un ticket y un movimiento sin ticket sumen en la misma columna.
- **Dos conceptos nuevos**: **hogar** (limpieza, droguería, menaje, bolsas, pilas) y **cuidado personal** (higiene, cosmética). Sin ellos, media compra de droguería acaba en «otros». Pendiente de visto bueno (§15).
- **Nivel 2 solo para alimentación** (`s`): fruta y verdura, carne y pescado, lácteos y huevos, panadería, despensa, dulces y snacks, bebidas, congelados y preparados.

### 9.2 Quién pone la categoría de una línea, por orden
1. **El perfil del comercio**, si no desglosa: todo a su categoría.
2. **Lo aprendido** en `productos` (comercio + texto normalizado): lo que el usuario corrigió una vez llega bien la siguiente, sin depender del modelo.
3. **El modelo**, en la misma llamada de lectura.
4. **Reglas locales** de `interpretar-ticket.js`: palabras genéricas de producto (nunca marcas de un comercio ni nombres de personas) y la pista del IVA (un 4 % es alimentación básica o farmacia; un 21 % casi nunca es comida). Son el plan B y la red cuando el modelo devuelve una categoría fuera de la lista.

Corregir una línea marca `cm` y escribe en `productos`. **Reclasificar nunca pisa `cm`**, igual que `conceptoManual`.

## 10. Cómo cuenta en los listados

Función nueva `partidas(filtros)` en `finanzas/calculos.js`, que sustituye a `estado.movimientos` donde se reparte el gasto por concepto:
- **Movimiento sin ticket** → una partida: él mismo, con su concepto.
- **Movimiento con ticket(s) que cuadran o están sin comprobar** → una partida por línea, con su importe efectivo (línea + su descuento + su parte de descuentos y extras no atribuidos), **escaladas al importe real del cargo**. El redondeo sobrante va a la línea mayor, así la suma es exactamente lo que cobró el banco. La propina o la comisión de cambio caen así, en proporción, en la categoría del ticket. Fecha y cuenta, las del movimiento.
- **Ticket con ⚠** → cuenta como el movimiento entero, sin desglose, hasta repasarlo.
- **Ticket en efectivo** → sus partidas, con la fecha del ticket y la cuenta Efectivo.

| Listado | Cambio |
|---|---|
| Gasto por concepto | Parámetros «Desglosar tickets» (sí por defecto) e «Incluir efectivo con ticket» |
| Resumen del año | El gasto real suma los tickets en efectivo; línea «Efectivo retirado sin ticket» |
| **Gasto variable** (nuevo) | Periodo, cuenta (por defecto «Ingresos y gastos variables») y agrupación por categoría, subcategoría de alimentación, comercio o tipo de comercio. Es la respuesta directa a la petición |
| **Tickets** (nuevo) | Por estado (a revisar, pendientes, efectivo) y por comercio, con la fiabilidad de lectura de cada uno |
| **Cobertura** (nuevo, T4) | Qué parte del gasto de la cuenta de variables tiene ticket, y los cargos más altos sin él |

## 11. Privacidad y almacenamiento

- **Todo va cifrado en el cofre** (ADR-011): tickets, comercios y productos revelan dónde, cuándo y qué compra el usuario, y con qué tarjeta. Con Finanzas cerrada, ninguna sección lo ve.
- **La foto viaja al gateway** y de ahí al proveedor del modelo, como la del frigorífico, con el comercio y las últimas cifras de la tarjeta. [SUPUESTO] Es aceptable, igual que el extracto en PDF que ya se le puede mandar (`finanzas-extracto`); plan B: recortar el pie antes de enviarla. **Farmacia**: los nombres de medicamentos son datos de salud. Con un comercio de tipo farmacia ya conocido, la app avisa antes de leer y ofrece apuntar solo comercio y total.
- **La foto no se guarda** por defecto (mismo criterio que el extracto, D16): lo que vale son los datos. Opción por ticket «Conservar la foto» para devoluciones y garantías (T5): JPEG reducido en IndexedDB, cifrado con la misma llave, fuera de `localStorage` y de la copia JSON.
- **Peso**: un ticket de 15 líneas son ~1,5 KB de JSON; uno al día, ~0,7 MB al año ya cifrado. `localStorage` da ~5 MB por origen, **compartidos con toda la organización en Pages** (ADR-011). [SUPUESTO] Caben dos o tres años; plan B: llevar el cofre a IndexedDB, que ya escribe en cola y de forma asíncrona, así que el cambio queda dentro de `cofre.js`. Aviso en Ajustes cuando el cofre pase de 2 MB.

## 12. Hacer la foto sin abrir Finanzas

Abrir Finanzas pide la clave, y en la cola de una tienda eso es fricción. Dos niveles:
- **T1 (sencillo)**: «📷 Ticket» vive dentro de Finanzas y se fija en Hoy. Antes hay que arreglar un fallo que afecta a cualquier acceso fijado de Finanzas: `lanzarAccion()` (`accesos.js`) quita `?accion=` de la ruta y busca el botón **mientras se ve el candado**, así que avisa «Esa acción no está ahora mismo en Finanzas» y la pierde. El candado tiene que guardar la acción pendiente y lanzarla al abrirse. [SUPUESTO] El envío de la clave cuenta como gesto del usuario y permite abrir la cámara justo después; plan B: un botón grande «📷 Hacer la foto» al abrirse.
- **T5 (buzón sellado)**, si la clave molesta: al crear la clave se genera un par ECDH P-256. La **pública** queda en claro en `maydom.v1` y la **privada** dentro del cofre. Fuera de Finanzas, «📷 Ticket» lee la foto y **cifra el resultado con la pública** en `maydom.buzon`: se puede escribir sin la clave pero no leer. Al abrir Finanzas se descifra, se aplica el perfil del comercio y se vincula. ADR-011 no se rebaja: sin clave nadie lee un ticket.

## 13. Pruebas: un muestrario, no un ticket

- **Muestrario inventado** en `tools/datos/tickets/`: una ficha por caso con el contenido (comercio ficticio, líneas, IVA, pagos) y lo que se espera leer. Una función lo pinta en `<canvas>` con **disposiciones distintas**:
  - térmico estrecho con ofertas en bloque;
  - térmico con descuentos en línea y «2 x»;
  - restaurante sin IVA;
  - gasolinera con litros;
  - farmacia con aportación;
  - ropa con ticket regalo;
  - factura A4 de compra online con envío;
  - parking solo con total;
  - ticket en otra divisa;
  - devolución.
- **Prueba de humo** (`tools/prueba-tickets.mjs`, con el gateway simulado en el 8098, como las demás): recorre el muestrario de punta a punta. Cubre las comprobaciones (incluido un «sin comprobar» y un «no cuadra»), la creación y reutilización del perfil, la categoría por defecto de un restaurante, el vínculo con propina propuesto y no automático, el pago mixto y el acceso de Hoy a través del candado.
- **Modelo real**: antes de T1, un workflow temporal en la rama de trabajo manda las imágenes del muestrario a `/api/mayordomo` e imprime cuántas líneas y totales acierta en cada disposición. Solo datos inventados: los logs son públicos.
- **Tickets reales**: nunca en el repositorio. La medida real es la fiabilidad por comercio que enseña la propia app (`lecturas`, `cuadradas`, `corregidas`).

## 14. Fases

| Fase | Contenido | Ficheros | Estimación |
|---|---|---|---|
| **T1** · Leer | Pestaña Tickets; foto o captura → `finanzas-ticket` → repaso con comprobaciones en vivo; alta a mano; efectivo; perfil del comercio básico (reconocer, crear, tipo, categoría, desglosar, IVA por letras); listas en el cofre; acción pendiente tras el candado; conceptos hogar y cuidado personal; muestrario y prueba de humo | `secciones/finanzas.js`, `finanzas/tickets.js` (nuevo), `interpretar-ticket.js` (nuevo, funciones puras: `comprobar`, `componerLineas`/`leerLineas` con ida y vuelta, `atribuirDescuentos`, `reconocerComercio`, reglas), `cofre.js`, `accesos.js`, `datos/semillas.js`, `sw.js`, `pages.yml` | ~5 h |
| **T2** · Vincular | Candidatos, puntos, tolerancias por tipo y multiplicidad; vínculo al guardar y tras cada importación; descriptores del banco, retraso y tarjeta aprendidos; varios con varios (manual con propuestas); 🧾 en Movimientos, «Vincular ticket», deshacer | `finanzas/vincular.js` (nuevo, puro), `finanzas/importar.js` (gancho), `finanzas.js` | ~4 h |
| **T3** · Desglosar | `partidas()`; Gasto por concepto desglosado; listados Gasto variable y Tickets; efectivo en el resumen del año | `finanzas/calculos.js`, `finanzas/informes.js` | ~3 h |
| **T4** · Aprender | `productos` aprendidos; subcategorías de alimentación; segunda lectura con pistas y `finanzas-ticket-pista`; modelo por comercio y fiabilidad; listado Cobertura | `interpretar-ticket.js`, `finanzas/tickets.js`, `informes.js` | ~3 h |
| **T5** · Extras (a demanda) | Tickets en PDF por `extracto.js`; buzón sellado (§12); conservar la foto; compartir a maydom (`share_target`, con D14); lo comprado marcado en Compra y stock de Alimentación; histórico de precios por nombre genérico (enlaza con P2 de [`obtener-datos-de-productos.md`](obtener-datos-de-productos.md)) | varios | — |

T1 y T2 son lo mínimo para que tenga sentido; T3 es lo que contesta la pregunta del usuario.

## 15. Decisiones que tiene que tomar el usuario

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Pedir la clave de Finanzas para hacer la foto? | Sí en T1 (es lo que ya hay); buzón sellado (T5) solo si en el uso real molesta |
| 2 | ¿Conservar la foto del ticket? | No por defecto; casilla por ticket para lo que tenga garantía o devolución |
| 3 | ¿Conceptos nuevos «hogar» y «cuidado personal» y subcategorías solo en alimentación? | Sí |
| 4 | ¿Los tickets en efectivo cuentan como gasto? | Sí: la retirada ya es neutra, así que es la única forma de que ese gasto aparezca |
| 5 | ¿Vincular solo o preguntar siempre? | Solo cuando es inequívoco y el importe es exacto; con propina, divisa o varios cargos, proponer |
| 6 | ¿Desglosar línea a línea los restaurantes y similares? | No: el comercio va entero a su categoría; se puede activar por comercio |
| 7 | ¿Elegir el comercio antes de la foto? | No: se reconoce al leer y se confirma en el repaso |
| 8 | ¿Avisar de cargos grandes de la cuenta de variables sin ticket? | No como aviso; sí en el listado Cobertura (T4) |

## 16. Supuestos sin verificar

| Supuesto | Cómo se comprueba | Plan B |
|---|---|---|
| El modelo del gateway lee tickets de disposiciones muy distintas a 2.000 px | Workflow temporal con el muestrario antes de T1; fiabilidad por comercio en el uso real | Segunda lectura con pistas; modelo mejor por comercio; varias fotos apiladas |
| Aplicar el perfil después de leer basta | Fiabilidad de los comercios con perfil frente a los nuevos | Elegir el comercio antes de la foto |
| BBVA anota los cargos con un retraso de 0 a 4 días y nombra al comercio de forma reconocible | Primer extracto con tickets cargados | Retraso aprendido por comercio; descriptores aprendidos al vincular a mano |
| La cámara se puede abrir justo después de dar la clave | Prueba en el móvil | Botón grande tras abrir |
| `localStorage` aguanta años de tickets | Aviso de tamaño en Ajustes | Cofre a IndexedDB |
| El gateway no acepta PDF como adjunto | Catálogo de modelos (`/api/modelos`) | Texto del PDF con `extracto.js`; captura si es escaneado |

## Apéndice A. El ticket del 1-oct, como ejemplo

Ticket real de un supermercado de cadena. Aquí va **solo su estructura**: comercio, dirección, fecha, hora, número de factura, tarjeta y códigos de autorización quedan fuera, porque `docs/` es público. La foto no entra en el repositorio. Es **un caso más** del tipo «supermercado» de §3, no la referencia del diseño.

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

Qué comprobaciones de §7.3 le tocan:
- líneas + descuentos = total: 8,77 − 1,22 = 7,55 ✓;
- IVA: 0,79 + 6,61 + 0,15 = 7,55 ✓;
- pagos: 7,55 ✓;
- ahorro: 1,22 ✓;
- cantidad × precio en la línea al peso: 0,763 × 7,79 = 5,94 ✓.

Rasgos de este comercio que irían a su perfil, no al código: las ofertas van en un bloque aparte y nombran la línea abreviada; el IVA va con letras (A 4 %, B 10 %, C 21 %); es de tipo supermercado y conviene desglosarlo. Desglosado, el cargo de 7,55 € serían 4,72 € de carne (con la oferta), 1,89 € de dulces, 0,79 € de pan y 0,15 € de hogar.
