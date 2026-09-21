// Dictado con el reconocimiento de voz del navegador. En Android/Chrome va; en otros puede no existir,
// y entonces `hayVoz()` es false y la app sencillamente no enseña el botón.
export const hayVoz = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

// Junta trozos de transcripción con un solo espacio, sin espacios sueltos antes de la puntuación.
const unir = (...partes) => partes.filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();

const llano = t => unir(t).toLowerCase();

// Pega un trozo a lo ya acumulado deshaciendo las dos formas en que Chrome en Android repite:
// reemite entero un resultado ya cerrado ("...un platoeste es un plato") y va entregando finales
// que son ampliaciones del anterior ("este" → "este es un" → "este es un plato").
const pegarTrozo = (texto, trozo) => {
  const a = llano(texto), b = llano(trozo);
  if (!b) return texto;
  if (!a) return unir(trozo);
  if (a === b || a.endsWith(b)) return texto;          // ya estaba
  if (b.startsWith(a)) return unir(trozo);             // el trozo amplía lo anterior: sustituye
  return unir(texto, trozo);
};

// Junta una lista de trozos deshaciendo repeticiones.
const compactar = lista => lista.reduce((t, x) => pegarTrozo(t, x || ''), '');

// Abre un dictado y va entregando el texto por `alTexto(parcial, definitivo)`.
// Devuelve un objeto con parar(); el reconocimiento se corta solo tras un silencio largo.
export function dictar({ alTexto, alFin, alError, idioma = 'es-ES' } = {}) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) { alError?.(new Error('Este navegador no tiene dictado')); return null; }
  const rec = new Rec();
  rec.lang = idioma; rec.continuous = true; rec.interimResults = true;
  // Los finales se guardan POR ÍNDICE, no acumulando: así una reemisión del mismo resultado
  // sobrescribe en vez de duplicar. `cerrado` guarda las tandas anteriores cuando el motor
  // reinicia su lista de resultados (Android lo hace tras cada pausa larga).
  let cerrado = '', trozos = [];
  const textoFinal = () => compactar([cerrado, ...trozos]);
  rec.onresult = e => {
    // ¿El motor empezó una lista nueva? Pasa tras una pausa larga en Android: vuelve a resultIndex 0
    // con otro texto. Si el nuevo primer trozo continúa al viejo, es una reemisión, no un reinicio.
    if (e.resultIndex === 0 && trozos.length) {
      const nuevo = llano(e.results[0][0].transcript), viejo = llano(trozos[0] || '');
      if (e.results.length < trozos.length || !(nuevo.startsWith(viejo) || viejo.startsWith(nuevo))) { cerrado = textoFinal(); trozos = []; }
    }
    let parcial = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) trozos[i] = t; else parcial += t;
    }
    const definitivo = textoFinal();
    alTexto?.(parcial.trim(), definitivo);
  };
  rec.onerror = e => {
    const motivos = { 'not-allowed': 'Falta permiso de micrófono para esta página', 'service-not-allowed': 'El navegador no permite el dictado aquí', 'no-speech': 'No se oyó nada', 'audio-capture': 'No hay micrófono disponible', 'network': 'Sin conexión para el dictado' };
    alError?.(new Error(motivos[e.error] || ('Dictado: ' + e.error)));
  };
  rec.onend = () => alFin?.(textoFinal());
  try { rec.start(); } catch (e) { alError?.(e); return null; }
  return { parar: () => { try { rec.stop(); } catch { } } };
}

// Añade un botón de micrófono que escribe en un <textarea> o <input>, dentro de un formulario abierto.
export function botonDictado(campo, contenedor) {
  if (!hayVoz() || !campo) return null;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn dictar'; btn.innerHTML = '🎤 Dictar';
  let sesion = null, base = '';
  const parar = () => { sesion?.parar(); sesion = null; btn.classList.remove('grabando'); btn.innerHTML = '🎤 Dictar'; };
  // Lo que había escrito antes tampoco se duplica si el motor lo devuelve al empezar.
  const pegar = (...partes) => compactar([base, ...partes]);
  btn.onclick = () => {
    if (sesion) { parar(); return; }
    base = campo.value ? campo.value.trimEnd() : '';
    btn.classList.add('grabando'); btn.innerHTML = '⏹ Parar';
    sesion = dictar({
      alTexto: (parcial, definitivo) => { campo.value = pegar(definitivo, parcial); campo.scrollTop = campo.scrollHeight; },
      alFin: definitivo => { campo.value = pegar(definitivo); parar(); campo.focus(); },
      alError: e => { import('./nucleo.js').then(m => m.toast(e.message, 5000)); parar(); },
    });
    if (!sesion) parar();
  };
  (contenedor || campo.parentElement).appendChild(btn);
  return btn;
}
