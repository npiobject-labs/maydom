// Semillas: catálogos iniciales. Se copian al estado la primera vez y se editan desde la app.
// Nunca datos reales del usuario: docs/ es público.
const yt = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const ej = (nombre, tipo, descripcion, series = 3, reps = '10', dur = null) => ({ id: 'e_' + nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_'), nombre, tipo, descripcion, series, reps, dur, video: yt(nombre + ' técnica correcta') });

export const TIPOS_EJERCICIO = ['calistenia', 'kettlebell', 'movilidad', 'cardio', 'fuerza', 'estiramiento'];

export const ejercicios = [
  ej('Sentadilla al aire', 'calistenia', 'Pies al ancho de caderas, baja como si te sentaras, rodillas siguen la punta de los pies, pecho alto.', 3, '12'),
  ej('Flexiones', 'calistenia', 'Manos algo más abiertas que los hombros, cuerpo en línea, baja el pecho a un puño del suelo. Si cuesta, sobre rodillas o en pared.', 3, '8'),
  ej('Plancha', 'calistenia', 'Antebrazos y puntas de pies, glúteo apretado, mirada al suelo. Sin hundir la cadera.', 3, '30 s', 1),
  ej('Puente de glúteo', 'calistenia', 'Tumbado, pies apoyados, sube la cadera apretando glúteo, un segundo arriba.', 3, '15'),
  ej('Zancadas', 'calistenia', 'Paso largo adelante, rodilla trasera cerca del suelo, tronco vertical. Alterna piernas.', 3, '10 por pierna'),
  ej('Dominadas australianas', 'calistenia', 'Cuelga de una barra baja o mesa robusta, cuerpo recto, tira del pecho a la barra.', 3, '8'),
  ej('Fondos en silla', 'calistenia', 'Manos en el borde de una silla, baja flexionando codos hacia atrás, sube sin bloquear.', 3, '10'),
  ej('Elevación de talones', 'calistenia', 'De pie, sube a puntillas despacio, baja controlado. Vale en un escalón.', 3, '20'),
  ej('Hollow hold', 'calistenia', 'Tumbado boca arriba, lumbar pegado al suelo, brazos y piernas estirados a pocos cm.', 3, '20 s', 1),
  ej('Swing con kettlebell', 'kettlebell', 'Bisagra de cadera, la pesa va entre las piernas y sube a la altura del pecho por impulso de cadera, no de brazos.', 4, '15'),
  ej('Goblet squat', 'kettlebell', 'Pesa agarrada al pecho, sentadilla profunda con codos entre las rodillas.', 3, '10'),
  ej('Peso muerto con kettlebell', 'kettlebell', 'Pesa entre los pies, espalda neutra, sube extendiendo cadera.', 3, '10'),
  ej('Press con kettlebell', 'kettlebell', 'Pesa en rack, empuja vertical hasta bloquear, baja controlado. Un brazo cada vez.', 3, '8 por brazo'),
  ej('Remo con kettlebell', 'kettlebell', 'Una mano apoyada, tira de la pesa hacia la cadera con el codo pegado.', 3, '10 por brazo'),
  ej('Turkish get-up', 'kettlebell', 'Levantarse del suelo con la pesa en alto, paso a paso. Empieza sin peso.', 2, '3 por lado'),
  ej('Gato-camello', 'movilidad', 'A cuatro patas, alterna arquear y redondear la espalda al ritmo de la respiración.', 2, '10'),
  ej('Círculos de cadera', 'movilidad', 'De pie, manos en cadera, círculos amplios en los dos sentidos.', 2, '10 por lado'),
  ej('Rotación torácica', 'movilidad', 'A cuatro patas, mano en la nuca, abre el codo al techo girando el tronco.', 2, '8 por lado'),
  ej('Sentadilla profunda sostenida', 'movilidad', 'Baja del todo, talones en el suelo (o sobre un libro), codos empujan rodillas. Respira.', 2, '45 s', 1),
  ej('Apertura de pecho en marco de puerta', 'estiramiento', 'Antebrazos en el marco, da un paso adelante hasta notar el pecho.', 2, '30 s', 1),
  ej('Estiramiento de flexores de cadera', 'estiramiento', 'Rodilla en el suelo, empuja la cadera adelante, glúteo apretado.', 2, '30 s por lado', 1),
  ej('Isquios en pared', 'estiramiento', 'Tumbado, una pierna vertical apoyada en la pared, la otra en el suelo.', 2, '45 s por lado', 1),
  ej('Marcha en el sitio', 'cardio', 'Rodillas altas, brazos activos. Píldora ideal entre bloques de trabajo.', 1, '2 min', 2),
  ej('Burpees suaves', 'cardio', 'Sin salto: agáchate, manos al suelo, lleva pies atrás, vuelve y levántate.', 3, '8'),
  ej('Subir escaleras', 'cardio', 'Dos o tres tramos a buen ritmo. Sirve como píldora.', 1, '3 min', 3),
  ej('Saltos de tijera', 'cardio', 'Ritmo moderado, aterriza suave.', 3, '30'),
];

// Píldoras: ejercicios cortos para intercalar en el trabajo (ids de arriba).
export const pildoras = ['e_sentadilla_al_aire', 'e_marcha_en_el_sitio', 'e_elevaci_n_de_talones', 'e_c_rculos_de_cadera', 'e_gato_camello', 'e_subir_escaleras', 'e_apertura_de_pecho_en_marco_de_puerta', 'e_plancha', 'e_puente_de_gl_teo', 'e_rotaci_n_tor_cica'];

export const tablas = [
  { id: 't_basica', nombre: 'Calistenia básica 25′', duracion: 25, items: ['e_sentadilla_al_aire', 'e_flexiones', 'e_puente_de_gl_teo', 'e_plancha', 'e_zancadas'].map(e => ({ ejercicioId: e })) },
  { id: 't_kb', nombre: 'Kettlebell 20′', duracion: 20, items: ['e_swing_con_kettlebell', 'e_goblet_squat', 'e_press_con_kettlebell', 'e_remo_con_kettlebell'].map(e => ({ ejercicioId: e })) },
  { id: 't_mov', nombre: 'Movilidad 12′', duracion: 12, items: ['e_gato_camello', 'e_c_rculos_de_cadera', 'e_rotaci_n_tor_cica', 'e_sentadilla_profunda_sostenida', 'e_estiramiento_de_flexores_de_cadera'].map(e => ({ ejercicioId: e })) },
];

export const meditaciones = [
  { id: 'm_46', nombre: 'Respiración 4-6', min: 3, nocturna: true, pasos: ['Siéntate o túmbate. Nada que preparar.', 'Inspira por la nariz contando 4.', 'Espira despacio por la boca contando 6.', 'Repite. Si la mente se va, vuelve a contar. No pasa nada.'] },
  { id: 'm_vd', nombre: 'Volver a dormir', min: 4, nocturna: true, pasos: ['No mires la hora. No enciendas luz.', 'Nota el peso del cuerpo en el colchón, de los pies a la cabeza.', 'Inspira 4, espira 6, diez veces.', 'Cuenta hacia atrás desde 100 al ritmo de cada espiración.', 'Si a los 20 min sigues despierto, levántate a luz tenue, sin pantallas, y vuelve cuando tengas sueño.'] },
  { id: 'm_esc', nombre: 'Escaneo corporal breve', min: 5, nocturna: false, pasos: ['Ojos cerrados. Tres respiraciones amplias.', 'Recorre: pies, piernas, cadera, espalda, hombros, brazos, cara.', 'En cada zona, dos respiraciones y afloja.', 'Termina notando el cuerpo entero.'] },
  { id: 'm_cd', nombre: 'Cuenta descendente', min: 2, nocturna: true, pasos: ['Cuenta de 30 a 0, un número por espiración.', 'Si te pierdes, vuelve a 30 sin juzgar.'] },
];

export const tecnicasSueno = [
  { t: 'Hora fija de levantarse', d: 'Ancla el reloj interno aunque la noche haya sido corta. Es lo que más cuesta y lo que más funciona.' },
  { t: 'Luz de día en la primera hora', d: '10–20 min al aire libre nada más levantarte; adelanta la melatonina de la noche.' },
  { t: 'Cena ligera y temprana', d: 'Al menos 2–3 h antes de acostarte. La digestión pesada rompe el primer tramo.' },
  { t: 'Sin pantallas la última media hora', d: 'O al menos brillo mínimo y modo nocturno. La meditación 4-6 sustituye al móvil.' },
  { t: 'Cafeína hasta las 14:00', d: 'Su vida media son 5–6 h; a las 23:00 sigue habiendo un cuarto de la del mediodía.' },
  { t: 'Habitación fresca y oscura', d: '18–19 °C. Antifaz si entra luz.' },
  { t: 'Despertar nocturno: no luchar', d: 'Es normal. Sin mirar la hora, sin móvil; guion "Volver a dormir". Si pasan 20 min, salir de la cama a luz tenue.' },
  { t: 'Segundo tramo ligero es válido', d: 'El objetivo son 7 h en total: 4,5–5 h de un tirón + ~2 h más ligeras cuentan.' },
  { t: 'Magnesio por la noche', d: 'Si lo tomas, con la cena o una hora antes de acostarte (criterio general; consulta a tu médico).' },
];

// Criterio general de momento de toma por palabra clave del nombre del suplemento.
export const criteriosSuplemento = [
  { k: /magnesio/i, momento: 'noche', hora: '22:30', por: 'relaja y ayuda al sueño; mejor por la noche' },
  { k: /melatonina/i, momento: 'noche', hora: '22:30', por: '30–60 min antes de acostarse' },
  { k: /zinc/i, momento: 'noche', hora: '22:00', por: 'lejos del hierro y del calcio; tolera mejor con algo de comida' },
  { k: /vitamina ?d|d3|colecalciferol/i, momento: 'comida', hora: '14:00', por: 'liposoluble: con la comida principal, que lleve grasa' },
  { k: /omega|aceite de pescado|krill|dha|epa/i, momento: 'comida', hora: '14:00', por: 'con comida grasa reduce el reflujo y mejora absorción' },
  { k: /vitamina ?k|k2/i, momento: 'comida', hora: '14:00', por: 'liposoluble; junto a la vitamina D' },
  { k: /hierro/i, momento: 'manana', hora: '07:30', por: 'en ayunas con vitamina C, lejos del café y del calcio' },
  { k: /vitamina ?c|ascórbico/i, momento: 'manana', hora: '08:30', por: 'con el desayuno' },
  { k: /b12|complejo b|vitamina ?b/i, momento: 'manana', hora: '08:30', por: 'activa; por la mañana para no interferir con el sueño' },
  { k: /probi[oó]tico/i, momento: 'manana', hora: '07:30', por: 'en ayunas o justo antes del desayuno' },
  { k: /creatina/i, momento: 'personal', hora: '12:00', por: 'a cualquier hora, lo importante es la constancia' },
  { k: /prote[ií]na|whey/i, momento: 'personal', hora: '12:00', por: 'tras el entreno o en la comida que falte proteína' },
  { k: /ashwagandha/i, momento: 'noche', hora: '22:00', por: 'por la noche por su efecto calmante' },
  { k: /cafe[ií]na|guaran/i, momento: 'manana', hora: '08:30', por: 'nunca después de las 14:00' },
  { k: /colágeno/i, momento: 'manana', hora: '08:00', por: 'en ayunas con vitamina C' },
];
export const MOMENTOS = [{ v: 'manana', l: 'Mañana' }, { v: 'comida', l: 'Con la comida' }, { v: 'tarde', l: 'Tarde' }, { v: 'noche', l: 'Noche' }, { v: 'personal', l: 'Fijado por mí' }];

// Platos para proponer menús. tags: ligera, proteina, vegetal, rapida, sin_gluten, sin_lactosa, pescado, carne
const pl = (nombre, tipo, tags, min = 20) => ({ id: 'p_' + nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_'), nombre, tipo, tags, min });
export const platos = [
  pl('Avena con fruta y nueces', 'desayuno', ['vegetal', 'rapida', 'sin_lactosa'], 10),
  pl('Tostada integral con aguacate y huevo', 'desayuno', ['proteina', 'rapida'], 10),
  pl('Yogur natural con semillas y arándanos', 'desayuno', ['proteina', 'rapida', 'sin_gluten'], 5),
  pl('Tortilla de dos huevos con espinacas', 'desayuno', ['proteina', 'sin_gluten', 'sin_lactosa'], 12),
  pl('Kéfir con plátano y canela', 'desayuno', ['rapida', 'sin_gluten'], 5),
  pl('Ensalada de garbanzos, tomate y atún', 'comida', ['proteina', 'pescado', 'rapida', 'sin_gluten', 'sin_lactosa'], 15),
  pl('Lentejas con verduras', 'comida', ['vegetal', 'sin_gluten', 'sin_lactosa'], 45),
  pl('Pollo al horno con boniato y brócoli', 'comida', ['proteina', 'carne', 'sin_gluten', 'sin_lactosa'], 50),
  pl('Salmón a la plancha con quinoa y espárragos', 'comida', ['proteina', 'pescado', 'sin_gluten', 'sin_lactosa'], 25),
  pl('Arroz integral con verduras salteadas y tofu', 'comida', ['vegetal', 'sin_gluten', 'sin_lactosa'], 30),
  pl('Pasta integral con pisto y huevo', 'comida', ['vegetal'], 30),
  pl('Guiso de ternera con patata y zanahoria', 'comida', ['proteina', 'carne', 'sin_gluten', 'sin_lactosa'], 70),
  pl('Bowl de quinoa, aguacate, judías negras y maíz', 'comida', ['vegetal', 'sin_gluten', 'sin_lactosa', 'rapida'], 20),
  pl('Merluza al vapor con patata y pimientos', 'comida', ['ligera', 'pescado', 'sin_gluten', 'sin_lactosa'], 30),
  pl('Crema de calabaza y tortilla francesa', 'cena', ['ligera', 'vegetal', 'sin_gluten'], 30),
  pl('Revuelto de champiñones con ensalada', 'cena', ['ligera', 'proteina', 'sin_gluten', 'sin_lactosa'], 15),
  pl('Sopa de verduras con pollo desmenuzado', 'cena', ['ligera', 'proteina', 'sin_gluten', 'sin_lactosa'], 35),
  pl('Ensalada templada de espinacas, huevo y nueces', 'cena', ['ligera', 'proteina', 'sin_gluten', 'sin_lactosa', 'rapida'], 12),
  pl('Dorada al horno con calabacín', 'cena', ['ligera', 'pescado', 'sin_gluten', 'sin_lactosa'], 35),
  pl('Tortilla de calabacín y cebolla', 'cena', ['ligera', 'vegetal', 'sin_gluten', 'sin_lactosa'], 25),
  pl('Gazpacho con tostada y jamón', 'cena', ['ligera', 'rapida'], 10),
  pl('Puré de verduras con pescado blanco', 'cena', ['ligera', 'pescado', 'sin_gluten', 'sin_lactosa'], 30),
];

export const CATEGORIAS_TIENDA = [{ v: 'alimentacion', l: 'Alimentación' }, { v: 'ecologica', l: 'Ecológica' }, { v: 'suplementos', l: 'Suplementos' }, { v: 'electronica', l: 'Electrónica' }, { v: 'ocio', l: 'Ocio' }, { v: 'general', l: 'General' }, { v: 'servicios', l: 'Servicios' }];
const ti = (nombre, categoria, url) => ({ id: 't_' + nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_'), nombre, categoria, url, activa: true });
export const tiendas = [
  ti('Mercadona', 'alimentacion', 'https://tienda.mercadona.es/search-results?query={q}'),
  ti('Carrefour', 'alimentacion', 'https://www.carrefour.es/search-nwx/?query={q}'),
  ti('Dia', 'alimentacion', 'https://www.dia.es/search?q={q}'),
  ti('Veritas', 'ecologica', 'https://www.veritas.es/catalogsearch/result/?q={q}'),
  ti('Herbolario Navarro', 'ecologica', 'https://www.herbolarionavarro.es/search?q={q}'),
  ti('Planeta Huerto', 'ecologica', 'https://www.planetahuerto.es/buscar?q={q}'),
  ti('iHerb', 'suplementos', 'https://es.iherb.com/search?kw={q}'),
  ti('HSN', 'suplementos', 'https://www.hsnstore.com/buscar?q={q}'),
  ti('Amazon', 'general', 'https://www.amazon.es/s?k={q}'),
  ti('PcComponentes', 'electronica', 'https://www.pccomponentes.com/buscar/?query={q}'),
  ti('Mouser', 'electronica', 'https://www.mouser.es/c/?q={q}'),
  ti('AliExpress', 'electronica', 'https://www.aliexpress.com/wholesale?SearchText={q}'),
  ti('Agenda Madrid (esmadrid)', 'ocio', 'https://www.esmadrid.com/buscar?search_api_fulltext={q}'),
  ti('Atrápalo', 'ocio', 'https://www.atrapalo.com/buscar/?q={q}'),
  ti('Meetup Madrid', 'ocio', 'https://www.meetup.com/es-ES/find/?keywords={q}&location=es--Madrid'),
  ti('Google', 'general', 'https://www.google.com/search?q={q}'),
];

export const CONCEPTOS = ['vivienda', 'alimentación', 'suplementos', 'ocio', 'servicios web', 'IA / LLM', 'hosting', 'transporte', 'salud', 'ropa', 'ingresos', 'otros'];
export const TIPOS_OCIO = ['cultura', 'social', 'naturaleza', 'deporte', 'música', 'gastronomía', 'formación'];

export const ocioEjemplos = [
  { titulo: 'Paseo por el Retiro o Madrid Río', tipo: 'naturaleza', coste: 0, dur: 90, lugar: 'Madrid', info: '' },
  { titulo: 'Exposición temporal (Reina Sofía, Prado, CaixaForum)', tipo: 'cultura', coste: 12, dur: 120, lugar: 'Madrid', info: 'https://www.esmadrid.com/agenda-madrid' },
  { titulo: 'Concierto en Conde Duque o Matadero', tipo: 'música', coste: 15, dur: 120, lugar: 'Madrid', info: 'https://www.condeduquemadrid.es/' },
  { titulo: 'Meetup técnico', tipo: 'social', coste: 0, dur: 120, lugar: 'Madrid', info: 'https://www.meetup.com/es-ES/find/?location=es--Madrid' },
  { titulo: 'Ruta por la sierra (Cercedilla, La Pedriza)', tipo: 'naturaleza', coste: 10, dur: 300, lugar: 'Sierra de Guadarrama', info: '' },
];
