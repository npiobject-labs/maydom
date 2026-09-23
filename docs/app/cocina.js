// Modo cocina: acompaña la elaboración de un plato. Paso 0, comprobar ingredientes; después, un paso
// cada vez con su botón de «hecho», y los que llevan tiempo (cocción, horno, fritura, reposo) o piden
// remover cada pocos minutos, con su temporizador y aviso sonoro, vibración y notificación.
// La sesión vive en su propia clave de localStorage, fuera del estado: un temporizador cambia cada
// segundo y no debe repintar la app ni viajar en las copias. Los relojes guardan la hora de fin, no
// una cuenta atrás, así que sobreviven a una recarga o a que el móvil congele la pestaña.
import { estado, guardar, h, crudo, esc, uid, toast, confirmar, navegar, avisar, pedirPermisoAvisos, hoyISO, delegar, pedir } from './nucleo.js';
import { leerFicha, trocear, frases } from './ficha-plato.js';
import { pedirJSON } from './llm.js';

const CLAVE_S = 'maydom.cocina';
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE_S) || 'null'); } catch { return null; } };
let ses = leer(), vista = null, fichaAbierta = false;
const persistir = () => { try { ses ? localStorage.setItem(CLAVE_S, JSON.stringify(ses)) : localStorage.removeItem(CLAVE_S); } catch { } };
const platoDe = id => estado.platos.find(p => p.id === id);
export const cocinando = () => ses?.platoId || null;

// ---------- pasos ----------
const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40 };
const UNIDAD = '(segundos?|seg|minutos?|min|horas?|h)\\b';
const aMin = (n, u) => Number(String(n).replace(',', '.')) * (/^h/.test(u) ? 60 : /^s/.test(u) ? 1 / 60 : 1);
// Tiempo de espera y cada cuánto remover que aparezcan en una frase: «10 minutos», «media hora»,
// «dos o tres minutos», «cada 2-3 min». De un intervalo se toma el menor: mejor avisar pronto.
export function tiempos(frase) {
  let s = ' ' + frase.toLowerCase() + ' ';
  s = s.replace(/(\d+|una?)\s+horas?\s+y\s+media/g, (m, n) => (Number(NUM[n] || n) * 60 + 30) + ' minutos')
    .replace(/media hora/g, '30 minutos').replace(/(un )?cuarto de hora/g, '15 minutos')
    .replace(new RegExp(`\\b(${Object.keys(NUM).join('|')})\\b(?=\\s+(?:o\\s+\\w+\\s+|a\\s+\\w+\\s+)?${UNIDAD})`, 'g'), w => NUM[w]);
  const r = {};
  const cada = s.match(new RegExp(`cada\\s+(\\d+(?:[.,]\\d+)?)(?:\\s*(?:o|a|-|–)\\s*\\d+)?\\s*${UNIDAD}`));
  if (cada) { r.cada = aMin(cada[1], cada[2]); s = s.replace(cada[0], ' '); }
  const dur = s.match(new RegExp(`(\\d+(?:[.,]\\d+)?)(?:\\s*(?:o|a|-|–)\\s*\\d+)?\\s*${UNIDAD}`));
  if (dur) r.min = aMin(dur[1], dur[2]);
  return r;
}
// Plan B sin LLM: una frase de la preparación es un paso, con los tiempos que se lean en ella.
export function pasosLocales(descripcion) {
  const f = leerFicha(descripcion);
  const texto = f ? f.preparacion : descripcion;
  return frases(String(texto || '').replace(/\s*\n\s*/g, ' ')).map(t => ({ texto: t, ...tiempos(t) }));
}
export const ingredientesDe = descripcion => { const f = leerFicha(descripcion); return f ? trocear(f.ingredientes) : []; };
const firma = s => { let n = 5381; for (const c of String(s || '')) n = (n * 33 + c.charCodeAt(0)) | 0; return String(n); };
const pasosGuardados = p => Array.isArray(p.pasos) && p.pasos.length && p.pasosDe === firma(p.descripcion) ? p.pasos : null;
const limpiar = ps => (Array.isArray(ps) ? ps : []).filter(x => x && x.texto).map(x => {
  const o = { texto: String(x.texto).trim().slice(0, 400) };
  if (Number(x.min) > 0) o.min = Math.min(600, Number(x.min));
  if (Number(x.cada) > 0) o.cada = Math.min(120, Number(x.cada));
  return o;
});
// La IA separa mejor las acciones (pelar, cortar) y distingue esperas de preparación. Se pide en
// segundo plano mientras se comprueban los ingredientes y se guarda en el plato; si llega tarde
// (ya se está cocinando) no cambia los pasos a mitad.
async function afinarConIA(p) {
  if (pasosGuardados(p) || !p.descripcion) return;
  try {
    const j = await pedirJSON({
      operacion: 'plato-cocinar', contexto: false,
      tarea: `Vas a acompañar a alguien mientras cocina. Convierte la ficha del plato en pasos, en español, en el orden en que se hacen. Cada paso es una sola acción corta en imperativo. Separa las de preparación (pelar, cortar, picar, batir) en pasos propios. Un paso con espera (cocción, horno, fritura, reposo, marinado) lleva "min" con los minutos; si además hay que remover o dar la vuelta cada cierto tiempo, "cada" con cada cuántos minutos. Si el horno hay que precalentarlo, ese paso va al principio. No inventes pasos que no estén en la ficha. Devuelve {"pasos":[{"texto":"","min":0,"cada":0}]}.`,
      mensaje: `Plato: ${p.nombre}\n${p.descripcion.slice(0, 2500)}`,
    });
    const pasos = limpiar(j?.pasos);
    if (!pasos.length) return;
    p.pasos = pasos; p.pasosDe = firma(p.descripcion);
    if (ses?.platoId === p.id && ses.fase === 'ingredientes') { ses.pasos = pasos; ses.origen = 'ia'; persistir(); }
    guardar();
  } catch (e) { console.warn('pasos sin IA:', e.message); }
}

// ---------- sonido, voz, pantalla ----------
const sonido = {
  ctx: null,
  desbloquear() { try { this.ctx ||= new (window.AudioContext || window.webkitAudioContext)(); this.ctx.resume?.(); } catch { } },
  pitar(n = 2) {
    const c = this.ctx; if (!c) return;
    try {
      c.resume?.();
      for (let i = 0; i < n; i++) {
        const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + i * 0.35;
        o.frequency.value = 880; o.connect(g); g.connect(c.destination);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
        o.start(t0); o.stop(t0 + 0.27);
      }
    } catch { }
  },
};
// El navegador solo deja sonar audio tras un toque del usuario: cualquiera vale mientras se cocina.
document.addEventListener('pointerdown', () => { if (ses) sonido.desbloquear(); }, { passive: true });
function decir(texto) {
  if (!ses?.voz || !('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(texto); u.lang = 'es-ES'; speechSynthesis.speak(u); } catch { }
}
// Con las manos en la masa la pantalla no debe apagarse; el bloqueo se pierde al cambiar de app.
let bloqueo = null;
async function pantallaEncendida(on) {
  try {
    if (on && !bloqueo && 'wakeLock' in navigator && document.visibilityState === 'visible') { bloqueo = await navigator.wakeLock.request('screen'); bloqueo.addEventListener('release', () => { bloqueo = null; }); }
    if (!on && bloqueo) { await bloqueo.release(); bloqueo = null; }
  } catch { }
}
document.addEventListener('visibilitychange', () => { if (ses) { pantallaEncendida(true); tick(); } });

// ---------- temporizadores ----------
const ALARMA_MAX = 3 * 60000; // una alarma sin atender deja de pitar a los 3 minutos
function alarma(msg, fuerte) {
  sonido.pitar(fuerte ? 3 : 2);
  try { navigator.vibrate?.(fuerte ? [400, 150, 400, 150, 400] : [250, 120, 250]); } catch { }
  avisar('🍳 ' + msg, platoDe(ses?.platoId)?.nombre || '');
  decir(msg);
}
const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function textoReloj(t, ahora = Date.now()) {
  if (t.sonando) return '¡tiempo!';
  if (t.fin) return mmss(t.fin - ahora) + (t.cada ? ` · remover en ${mmss(t.proximo - ahora)}` : '');
  return 'remover en ' + mmss(t.proximo - ahora);
}
function tick() {
  if (!ses?.timers?.length) return;
  const ahora = Date.now(); let cambio = false;
  for (const t of ses.timers) {
    if (t.cada && !t.sonando && ahora >= t.proximo && !(t.fin && ahora >= t.fin)) {
      while (t.proximo <= ahora) t.proximo += t.cada * 60000;
      alarma('Toca remover: ' + t.texto, false); cambio = true;
    }
    if (t.fin && !t.sonando && ahora >= t.fin) { t.sonando = ahora; t.pitido = ahora; alarma('Se acabó el tiempo: ' + t.texto, true); cambio = true; }
    else if (t.sonando && ahora - t.sonando < ALARMA_MAX && ahora - (t.pitido || 0) >= 4000) { t.pitido = ahora; sonido.pitar(3); try { navigator.vibrate?.([300, 150, 300]); } catch { } }
  }
  if (cambio) { persistir(); repintar(); }
  for (const el of document.querySelectorAll('[data-reloj]')) { const t = ses.timers.find(x => x.id === el.dataset.reloj); if (t) el.textContent = textoReloj(t, ahora); }
}
setInterval(tick, 1000);
function nuevoReloj({ texto, min, cada, paso = null }) {
  const ahora = Date.now();
  ses.timers.push({ id: uid(), texto: texto.slice(0, 80), paso, fin: min ? ahora + min * 60000 : null, cada: cada || null, proximo: cada ? ahora + cada * 60000 : null, sonando: null });
  persistir(); sonido.pitar(1);
}
const repintar = () => { if (vista?.isConnected && /v=cocinar/.test(location.hash)) pintarCocina(vista); };

// ---------- entrada ----------
export async function empezarCocina(p) {
  const otro = ses && ses.platoId !== p.id ? platoDe(ses.platoId) : null;
  if (otro && !(await confirmar(`Estás cocinando «${otro.nombre}». ¿Lo dejas y empiezas «${p.nombre}»?`))) return;
  sonido.desbloquear();
  if (!ses || ses.platoId !== p.id) {
    const guardados = pasosGuardados(p);
    ses = { platoId: p.id, fase: 'ingredientes', paso: 0, tengo: {}, hechos: {}, pasos: guardados || pasosLocales(p.descripcion), origen: guardados ? 'ia' : 'local', timers: [], voz: false, inicio: Date.now() };
    persistir();
    afinarConIA(p);
  }
  if ('Notification' in window && Notification.permission === 'default') pedirPermisoAvisos().catch(() => null);
  navegar('alimentacion', { v: 'cocinar' });
}
async function terminar(apuntar) {
  if (ses.timers.some(t => !t.sonando) && !(await confirmar('Hay temporizadores en marcha. ¿Terminar igualmente?'))) return;
  if (apuntar) {
    const hora = new Date().getHours(), tipo = hora < 11 ? 'desayuno' : hora < 17 ? 'comida' : 'cena';
    const menu = estado.menus.find(m => m.fecha === hoyISO());
    estado.comidas = estado.comidas.filter(c => !(c.fecha === hoyISO() && c.tipo === tipo));
    estado.comidas.push({ id: uid(), fecha: hoyISO(), tipo, segunMenu: menu?.[tipo] === ses.platoId, que: platoDe(ses.platoId)?.nombre || '' });
    toast(`Apuntado como ${tipo} de hoy`);
  }
  ses = null; persistir(); pantallaEncendida(false);
  if (apuntar) guardar();
  navegar('alimentacion', { v: 'platos' });
}

// ---------- vista ----------
export function pintarCocina(cont) {
  vista = cont;
  const p = ses && platoDe(ses.platoId);
  if (!p) {
    if (ses) { ses = null; persistir(); }
    cont.innerHTML = h`<div class="tarjeta mini">No estás cocinando nada. Elige un plato y pulsa 🍳 Cocinar.</div><div class="acciones"><button class="btn p" data-a="volver">Ver platos</button></div>`;
    delegar(cont, { volver: () => navegar('alimentacion', { v: 'platos' }) });
    return;
  }
  pantallaEncendida(true);
  const ings = ingredientesDe(p.descripcion), pasos = ses.pasos || [], ahora = Date.now();
  const relojes = ses.timers.map(t => h`<div class="reloj ${t.sonando ? 'sonando' : ''}"><div class="t"><div class="mini">${t.texto}</div><b data-reloj="${t.id}">${textoReloj(t, ahora)}</b></div>
    ${t.sonando ? crudo(`<button class="btn p" data-a="pararC" data-id="${t.id}">Parar</button>`) : crudo(`${t.fin ? `<button class="btn mini" data-a="masC" data-id="${t.id}">+1</button>` : ''}<button class="btn mini" data-a="pararC" data-id="${t.id}">⏹</button>`)}</div>`).join('');
  const relojDe = i => ses.timers.find(t => t.paso === i);
  const etiquetaReloj = x => x.min && x.cada ? `⏱ ${x.min} min, remover cada ${x.cada}` : x.min ? `⏱ Temporizador ${x.min < 1 ? Math.round(x.min * 60) + ' s' : x.min + ' min'}` : `🔁 Avisar cada ${x.cada} min`;
  let cuerpo;
  if (ses.fase === 'ingredientes') {
    cuerpo = h`<div class="tarjeta"><b>Paso 0 · ¿Lo tienes todo?</b><div class="mini">Marca lo que tienes a mano${ses.origen === 'ia' ? '' : '; mientras, el mayordomo prepara los pasos'}.</div>
      ${ings.length ? crudo(ings.map((x, i) => `<label class="ingr"><input type="checkbox" data-c="tengoC" data-n="${i}" ${ses.tengo[i] ? 'checked' : ''}> <span>${esc(x)}</span></label>`).join('')) : crudo('<div class="mini">La ficha no trae lista de ingredientes.</div>')}
      <div class="acciones"><button class="btn p" data-a="empezarC">Empezar a cocinar</button>${ings.length ? crudo('<button class="btn" data-a="todoC">Lo tengo todo</button><button class="btn" data-a="faltaC">Lo que falta, a Compra</button>') : ''}</div></div>`;
  } else if (ses.fase === 'pasos') {
    cuerpo = h`<div class="mini">Paso ${ses.paso + 1} de ${pasos.length}</div>${crudo(pasos.map((x, i) => {
      const r = relojDe(i), actual = i === ses.paso;
      return `<div class="tarjeta paso ${actual ? 'actual' : ''} ${ses.hechos[i] ? 'hecho' : ''}" ${actual ? '' : `data-a="irC" data-n="${i}"`}>
        <div class="fila"><span class="num">${ses.hechos[i] ? '✓' : i + 1}</span><div class="t">${esc(x.texto)}</div></div>
        ${actual ? `<div class="acciones">${(x.min || x.cada) && !r ? `<button class="btn p" data-a="relojC" data-n="${i}">${esc(etiquetaReloj(x))}</button>` : ''}${r ? '<span class="pill">temporizador en marcha</span>' : ''}
          <button class="btn ${(x.min || x.cada) && !r ? '' : 'p'}" data-a="hechoC" data-n="${i}">✓ Hecho</button>${i > 0 ? '<button class="btn" data-a="irC" data-n="' + (i - 1) + '">‹ Anterior</button>' : ''}${ses.voz ? `<button class="btn" data-a="leerC" data-n="${i}">🔊</button>` : ''}</div>` : ''}</div>`;
    }).join('') || '<div class="tarjeta mini">No hay pasos: la ficha no trae preparación.</div>')}`;
  } else {
    cuerpo = h`<div class="tarjeta"><b>✅ ¡Plato terminado!</b><div class="mini">${ses.timers.length ? 'Quedan temporizadores arriba.' : 'Que aproveche.'}</div>
      <div class="acciones"><button class="btn p" data-a="finC" data-apuntar="1">Apuntar como comida de hoy</button><button class="btn" data-a="finC">Terminar</button><button class="btn" data-a="irC" data-n="${pasos.length - 1}">‹ Volver al último paso</button></div></div>`;
  }
  cont.innerHTML = h`
    <div class="fila cab"><div class="t"><div class="mini">🍳 Cocinando</div><b>${p.nombre}</b></div><button class="btn mini" data-a="vozC" aria-pressed="${ses.voz ? 'true' : 'false'}">${ses.voz ? '🔊 Voz' : '🔇 Voz'}</button><button class="btn mini" data-a="salirC">Salir</button></div>
    ${ses.timers.length ? crudo(`<div class="relojes">${relojes}</div>`) : ''}
    <details class="plegable" ${fichaAbierta ? 'open' : ''}><summary>Ficha del plato <span class="mini">ingredientes, preparación y nutrientes</span></summary><div class="cuerpo"><div class="ficha-completa">${p.descripcion || 'Sin ficha.'}</div></div></details>
    ${cuerpo}
    <div class="acciones"><button class="btn" data-a="libreC">+ Temporizador</button>${ses.fase !== 'fin' ? crudo('<button class="btn" data-a="finC">Terminar</button>') : ''}</div>`;
  cont.querySelector('details.plegable')?.addEventListener('toggle', e => { fichaAbierta = e.target.open; });
  const ir = i => { ses.paso = Math.max(0, Math.min(i, pasos.length - 1)); ses.fase = 'pasos'; persistir(); repintar(); decir(pasos[ses.paso]?.texto || ''); window.scrollTo?.(0, 0); };
  delegar(cont, {
    tengoC: el => { ses.tengo[el.dataset.n] = el.checked; persistir(); },
    todoC: () => { ings.forEach((_, i) => { ses.tengo[i] = true; }); persistir(); repintar(); },
    faltaC: () => {
      const faltan = ings.filter((_, i) => !ses.tengo[i]);
      if (!faltan.length) { toast('No falta nada'); return; }
      let n = 0;
      for (const nombre of faltan) if (!estado.compra.some(c => !c.comprado && c.nombre.toLowerCase() === nombre.toLowerCase())) { estado.compra.push({ id: uid(), nombre, cantidad: '', tienda: '', origen: 'plato', refId: p.id, comprado: false }); n++; }
      guardar(); toast(n ? `${n} a Compra` : 'Ya estaba en Compra');
    },
    empezarC: async () => {
      const faltan = ings.filter((_, i) => !ses.tengo[i]);
      if (faltan.length && faltan.length < ings.length && !(await confirmar(`Falta: ${faltan.join(', ')}. ¿Empezar igualmente?`))) return;
      if (!pasos.length) { toast('La ficha no trae preparación'); return; }
      ir(0);
    },
    irC: el => ir(Number(el.dataset.n)),
    hechoC: el => {
      const i = Number(el.dataset.n); ses.hechos[i] = true;
      if (i >= pasos.length - 1) { ses.fase = 'fin'; persistir(); repintar(); decir('Plato terminado'); } else ir(i + 1);
    },
    relojC: el => { const i = Number(el.dataset.n), x = pasos[i]; nuevoReloj({ texto: x.texto, min: x.min, cada: x.cada, paso: i }); repintar(); },
    masC: el => { const t = ses.timers.find(x => x.id === el.dataset.id); if (t) { t.fin += 60000; persistir(); tick(); } },
    pararC: el => { ses.timers = ses.timers.filter(x => x.id !== el.dataset.id); persistir(); repintar(); },
    libreC: async () => {
      const v = await pedir('Temporizador', [{ n: 'texto', l: 'Para qué', v: 'Temporizador' }, { n: 'min', l: 'Minutos', t: 'number', v: 5, min: 0.5, step: 0.5 }, { n: 'cada', l: 'Avisar además cada (min, opcional)', t: 'number', min: 0, step: 0.5 }]);
      if (!v || !(Number(v.min) > 0 || Number(v.cada) > 0)) return;
      nuevoReloj({ texto: v.texto || 'Temporizador', min: Number(v.min) || 0, cada: Number(v.cada) || 0 }); repintar();
    },
    vozC: () => { ses.voz = !ses.voz; persistir(); repintar(); if (ses.voz) decir(ses.fase === 'pasos' ? pasos[ses.paso]?.texto : 'Voz activada'); },
    leerC: el => decir(pasos[Number(el.dataset.n)]?.texto || ''),
    salirC: () => navegar('alimentacion', { v: 'platos' }),
    finC: el => terminar(!!el.dataset.apuntar),
  });
}
