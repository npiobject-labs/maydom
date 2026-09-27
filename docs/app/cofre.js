// Finanzas con clave (ADR-011). Los movimientos, las cuentas con su IBAN, los recurrentes y el
// historial de cargas no se guardan en claro en maydom.v1: van cifrados (AES-GCM, clave derivada
// de la del usuario con PBKDF2) en su propia entrada, y solo están en memoria mientras Finanzas está
// abierta. Cerrada, esas listas están vacías, así que ni el menú, ni los consejos, ni el contexto
// del mayordomo, ni otra web del mismo origen (todo npiobject-labs.github.io comparte localStorage)
// ven una cifra. La clave no se guarda en ningún sitio: si se olvida, los datos no se recuperan.
import { estado, guardar, rutaActual, usarCofre, toast, notificarCambio } from './nucleo.js';

export const LISTAS = ['movimientos', 'recurrentes', 'importaciones', 'cuentas'];
export const CLAVE_COFRE = 'maydom.finanzas';
const ITERACIONES = 600000;
// Con la app en segundo plano más de esto, al volver Finanzas está cerrada.
export const CIERRE_MS = 5 * 60 * 1000;

let llave = null, sal = null, iter = ITERACIONES;
// Lo último que esta copia leyó o escribió del cofre, para fusionar si otra copia escribió entretanto.
let conocido = null, planoTexto = null, base = null;
let cadena = Promise.resolve(), ocultaDesde = 0;
// Listas que había en claro al arrancar con clave (las escribió una copia vieja de la app): se suman al abrir.
const sueltos = {};

const leer = () => { try { return localStorage.getItem(CLAVE_COFRE); } catch { return null; } };
export const conClave = () => !!leer();
export const abierta = () => !!llave;
export const cerrada = () => !llave && conClave();

const aB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function derivar(clave, s, n) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: s, iterations: n }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function cifrar(texto, k, s, n) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(texto)));
  return JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iter: n, sal: aB64(s), iv: aB64(iv), datos: aB64(datos) });
}
async function descifrar(blob, k) {
  const b = JSON.parse(blob);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(b.iv) }, k, deB64(b.datos))));
}
const tomar = () => Object.fromEntries(LISTAS.map(k => [k, Array.isArray(estado[k]) ? estado[k] : []]));
const idsDe = datos => Object.fromEntries(LISTAS.map(k => [k, new Set((datos[k] || []).map(x => x?.id).filter(Boolean))]));
// Suma a `destino` lo que otra copia añadió (ni lo tenemos ni lo conocíamos): lo que esta borró sigue borrado.
function sumar(destino, otro, conocidos) {
  for (const k of LISTAS) {
    destino[k] = destino[k] || [];
    const mios = new Set(destino[k].map(x => x?.id));
    for (const x of otro?.[k] || []) if (x?.id && !mios.has(x.id) && !conocidos?.[k]?.has(x.id)) destino[k].push(x);
  }
}

// Escritura en cola: cifrar es asíncrono y guardar() no, así que cada escritura se encadena a la
// anterior con la llave y las listas del momento en que se pidió. Cerrar deja su propia escritura
// en la cola antes de vaciar la memoria, de modo que nada de lo guardado se pierde al cerrar.
function escribir(datos, forzar = false) {
  const k = llave, s = sal, n = iter;
  if (!k) return cadena;
  cadena = cadena.then(async () => {
    const actual = leer();
    if (actual && actual !== conocido) {
      // Otra copia cambió la clave (otra sal): esta no escribe encima con la vieja; se cierra.
      if (JSON.parse(actual).sal !== aB64(s)) {
        if (llave === k) { llave = null; for (const l of LISTAS) estado[l] = []; toast('La clave de Finanzas se cambió en otra ventana: vuelve a entrar', 8000); guardar(); }
        return;
      }
      try { sumar(datos, await descifrar(actual, k), base); } catch { }
    }
    const texto = JSON.stringify(datos);
    if (!forzar && texto === planoTexto && actual === conocido) return;
    const blob = await cifrar(texto, k, s, n);
    localStorage.setItem(CLAVE_COFRE, blob);
    conocido = blob; planoTexto = texto; base = idsDe(datos);
  }).catch(e => toast('No se pudieron guardar las finanzas: ' + e.message, 10000));
  return cadena;
}
export const pendiente = () => cadena;

export async function crearClave(clave) {
  const s = crypto.getRandomValues(new Uint8Array(16));
  const k = await derivar(clave, s, ITERACIONES);
  const datos = tomar();
  sumar(datos, sueltos, null);
  llave = k; sal = s; iter = ITERACIONES; conocido = null; planoTexto = null;
  for (const l of LISTAS) estado[l] = datos[l];
  await escribir(datos, true);
  guardar(); // quita de maydom.v1 lo que había en claro
}

// Devuelve false si la clave no es la buena (AES-GCM no descifra con otra).
export async function abrir(clave) {
  const blob = leer();
  if (!blob) return false;
  const b = JSON.parse(blob);
  const k = await derivar(clave, deB64(b.sal), b.iter || ITERACIONES);
  let datos;
  try { datos = await descifrar(blob, k); } catch { return false; }
  llave = k; sal = deB64(b.sal); iter = b.iter || ITERACIONES;
  conocido = blob; planoTexto = JSON.stringify(datos); base = idsDe(datos);
  sumar(datos, sueltos, null); sumar(datos, tomar(), null);
  for (const l of LISTAS) { estado[l] = datos[l] || []; delete sueltos[l]; }
  guardar();
  return true;
}

export async function cambiarClave(actual, nueva) {
  if (!llave) return false;
  const b = JSON.parse(leer());
  try { await descifrar(leer(), await derivar(actual, deB64(b.sal), b.iter || ITERACIONES)); } catch { return false; }
  // Sal y llave nuevas se calculan aparte y se cambian juntas, sin un await por medio: una escritura
  // que cayera entre las dos cifraría con la llave vieja bajo la sal nueva y el cofre no se abriría.
  const s2 = crypto.getRandomValues(new Uint8Array(16)), k2 = await derivar(nueva, s2, ITERACIONES);
  await cadena;
  sal = s2; iter = ITERACIONES; llave = k2;
  await escribir(tomar(), true);
  return true;
}

export function cerrar() {
  if (!llave) return;
  escribir(tomar());
  llave = null;
  for (const l of LISTAS) estado[l] = [];
}

// «He olvidado la clave»: sin ella no hay nada que descifrar, así que solo cabe empezar de cero.
export function borrarFinanzas() {
  try { localStorage.removeItem(CLAVE_COFRE); } catch { }
  llave = null; conocido = null; planoTexto = null; base = null;
  for (const l of LISTAS) { estado[l] = []; delete sueltos[l]; }
  guardar();
}

// Copia de seguridad: el cofre viaja cifrado dentro del JSON de Ajustes, sin pedir la clave.
export const copiaCifrada = () => leer();
export async function restaurarCopia(blob) {
  if (llave) { cerrar(); await cadena; }
  try { localStorage.setItem(CLAVE_COFRE, blob); } catch { }
  conocido = null; planoTexto = null; base = null;
}

// Arranque: con clave, lo que hubiera en claro no se enseña; se guarda aparte hasta abrir.
if (conClave()) for (const l of LISTAS) if (estado[l]?.length) { sueltos[l] = estado[l]; estado[l] = []; }

usarCofre({
  activo: conClave,
  vacias: () => Object.fromEntries(LISTAS.map(k => [k, []])),
  alGuardar: () => { if (llave) escribir(tomar()); },
  // releer() carga maydom.v1, que con clave no trae las listas: las abiertas se conservan.
  conservar: () => (llave ? tomar() : null),
});

// Se pide al entrar en Finanzas; al salir de la sección se cierra.
addEventListener('hashchange', () => { if (llave && rutaActual().id !== 'finanzas') cerrar(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { ocultaDesde = Date.now(); return; }
  // Con una ventana abierta (una importación a medias) no se cierra: vaciar la memoria ahí perdería lo que está escribiendo.
  if (llave && ocultaDesde && Date.now() - ocultaDesde > CIERRE_MS && !document.querySelector('dialog[open]')) { cerrar(); guardar(); }
  ocultaDesde = 0;
});
// Otra copia de la app escribió el cofre y aquí Finanzas está abierta: lo suyo manda (es lo último
// guardado) y de lo de esta copia solo se añade lo que aún no ha visto. Si no hay nada así, no se
// reescribe: escribir siempre, aunque fuera lo mismo, hacía que las dos copias se contestaran sin fin.
addEventListener('storage', async e => {
  if (e.key !== CLAVE_COFRE || !llave || !e.newValue || e.newValue === conocido) return;
  const k = llave;
  if (JSON.parse(e.newValue).sal !== aB64(sal)) { llave = null; for (const l of LISTAS) estado[l] = []; toast('La clave de Finanzas se cambió en otra ventana: vuelve a entrar', 8000); return notificarCambio(); }
  let suyo;
  try { suyo = await descifrar(e.newValue, k); } catch { return; }
  if (llave !== k) return;
  const mios = tomar(), vistos = idsDe(suyo);
  let propios = 0;
  for (const l of LISTAS) {
    suyo[l] = suyo[l] || [];
    for (const x of mios[l]) if (x?.id && !vistos[l].has(x.id) && !base?.[l]?.has(x.id)) { suyo[l].push(x); propios++; }
    estado[l] = suyo[l];
  }
  conocido = e.newValue; base = vistos; planoTexto = propios ? null : JSON.stringify(suyo);
  if (propios) escribir(tomar());
  notificarCambio();
});
