// Dictado con el reconocimiento de voz del navegador. En Android/Chrome va; en otros puede no existir,
// y entonces `hayVoz()` es false y la app sencillamente no enseña el botón.
export const hayVoz = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

// Abre un dictado y va entregando el texto por `alTexto(parcial, definitivo)`.
// Devuelve un objeto con parar(); el reconocimiento se corta solo tras un silencio largo.
export function dictar({ alTexto, alFin, alError, idioma = 'es-ES' } = {}) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) { alError?.(new Error('Este navegador no tiene dictado')); return null; }
  const rec = new Rec();
  rec.lang = idioma; rec.continuous = true; rec.interimResults = true;
  let definitivo = '';
  rec.onresult = e => {
    let parcial = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) definitivo += t; else parcial += t;
    }
    alTexto?.(parcial, definitivo);
  };
  rec.onerror = e => {
    const motivos = { 'not-allowed': 'Falta permiso de micrófono para esta página', 'service-not-allowed': 'El navegador no permite el dictado aquí', 'no-speech': 'No se oyó nada', 'audio-capture': 'No hay micrófono disponible', 'network': 'Sin conexión para el dictado' };
    alError?.(new Error(motivos[e.error] || ('Dictado: ' + e.error)));
  };
  rec.onend = () => alFin?.(definitivo);
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
  btn.onclick = () => {
    if (sesion) { parar(); return; }
    base = campo.value ? campo.value.trimEnd() + ' ' : '';
    btn.classList.add('grabando'); btn.innerHTML = '⏹ Parar';
    sesion = dictar({
      alTexto: (parcial, definitivo) => { campo.value = base + definitivo + parcial; campo.scrollTop = campo.scrollHeight; },
      alFin: definitivo => { campo.value = (base + definitivo).trim(); parar(); campo.focus(); },
      alError: e => { import('./nucleo.js').then(m => m.toast(e.message, 5000)); parar(); },
    });
    if (!sesion) parar();
  };
  (contenedor || campo.parentElement).appendChild(btn);
  return btn;
}
