// Llamadas al LLM a través del backend (POST /api/mayordomo → OpenRouter). Sin clave en Fly, el backend responde 503.
import { estado, guardar, uid, hoyISO, urlBackend, toast } from './nucleo.js';
import { resumenParaLLM } from './reglas.js';

// Cabeceras: la clave de acceso de la app (X-Clave) la guarda el usuario en Ajustes; la del gateway
// openrouter vive solo en el backend (secreto LLM_API_KEY) y nunca pasa por el navegador.
function cabeceras() {
  const h = { 'Content-Type': 'application/json' };
  if (estado.ajustes.clave) h['X-Clave'] = estado.ajustes.clave;
  return h;
}
// El modelo de Ajustes (ADR-010) vale para lo que redacta —chat, consejos, informes—; lo que rellena
// campos (JSON) o mira una foto sigue con el del servidor, que es barato y sabe leer imágenes.
export async function consultar({ tarea = '', mensaje = '', mensajes = null, formato = '', imagen = '', contexto = true, operacion = 'chat', modelo, modo = '' } = {}) {
  if (modelo === undefined) modelo = formato === 'json' || imagen ? '' : (estado.ajustes.modelo || '');
  const cuerpo = { contexto: contexto ? resumenParaLLM() : '', tarea, formato, imagen, operacion, modelo, modo, mensajes: mensajes || [{ rol: 'usuario', contenido: mensaje || 'Adelante.' }] };
  // El backend espera hasta 150 s al gateway; el cliente, algo más, para que corte el que mide.
  const r = await fetch(urlBackend() + '/api/mayordomo', { method: 'POST', headers: cabeceras(), body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(170000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  if (j.aviso) toast('Aviso de presupuesto del gateway: ' + j.aviso, 6000);
  return j;
}
// Estado del backend: si hay LLM, qué modelo y si exige clave. No gasta crédito.
export async function estadoLLM() {
  const r = await fetch(urlBackend() + '/api/estado', { headers: cabeceras(), signal: AbortSignal.timeout(20000) });
  const j = await r.json();
  estado.ajustes.llm = j; guardar();
  return j;
}
// GET al backend con la clave de acceso; el error trae el mensaje del backend.
async function leer(ruta) {
  const r = await fetch(urlBackend() + ruta, { headers: cabeceras(), signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}
// Catálogo de modelos de texto del gateway: {defecto, modelos: [{id, nombre, contexto, entrada, salida, json, imagen, recomendado}]}.
export const catalogoModelos = () => leer('/api/modelos');
// Lo que costó una operación según el gateway (dólares), o null si no anotó nada.
export const costeDe = async operacion => { const j = await leer('/api/uso?operacion=' + encodeURIComponent(operacion)); return j.llamadas ? j.coste : null; };
export async function pedirJSON(opciones) {
  const j = await consultar({ ...opciones, formato: 'json' });
  try { return JSON.parse(j.respuesta); } catch { throw new Error('El LLM no devolvió JSON válido'); }
}
// Ejecuta una consulta con el botón deshabilitado y avisos de progreso y error.
export async function conLLM(boton, fn, aviso = 'Consultando al mayordomo…') {
  if (boton) { boton.disabled = true; boton.dataset.txt = boton.textContent; boton.textContent = '…'; }
  toast(aviso, 4000);
  try { await fn(); }
  catch (e) { toast('LLM: ' + e.message, 6000); }
  finally { if (boton) { boton.disabled = false; boton.textContent = boton.dataset.txt; } }
}
// Convierte una respuesta en texto en consejos (una línea que empiece por "- " = un consejo).
export function textoAConsejos(texto, seccion, accion = seccion) {
  const lineas = (texto || '').split('\n').map(s => s.trim()).filter(s => /^[-•*]\s/.test(s)).map(s => s.replace(/^[-•*]\s+/, ''));
  const out = lineas.length ? lineas : [texto.trim()].filter(Boolean);
  for (const t of out) estado.consejos.push({ id: uid(), fecha: hoyISO(), origen: 'llm', estado: 'nuevo', clave: 'llm:' + uid(), seccion, accion, texto: t });
  guardar();
  return out.length;
}
// Reduce una foto del móvil a JPEG de como mucho `max` px de lado para no enviar megabytes.
export function reducirImagen(fichero, max = 1024, calidad = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichero); const img = new Image();
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', calidad)); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}
export const lista = (j, clave) => Array.isArray(j) ? j : (Array.isArray(j?.[clave]) ? j[clave] : []);
