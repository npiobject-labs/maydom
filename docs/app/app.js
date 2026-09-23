// Arranque de maydom: registra secciones, pinta la shell y enruta por hash.
import { estado, guardar, registrar, secciones, seccion, rutaActual, alCambiar, arrancarVigilante, h, lista, fechaLarga, hoyISO, toast } from './nucleo.js';
import { cargarSemillas, aplicarTema } from './secciones/ajustes.js';
import { sincronizarCompra } from './secciones/compra.js';
import { consejosNuevos } from './secciones/mayordomo.js';
import hoy from './secciones/hoy.js';
import calendario from './secciones/calendario.js';
import notas from './secciones/notas.js';
import ejercicio from './secciones/ejercicio.js';
import sueno from './secciones/sueno.js';
import meditacion from './secciones/meditacion.js';
import alimentacion from './secciones/alimentacion.js';
import suplementos from './secciones/suplementos.js';
import compra from './secciones/compra.js';
import proyectos from './secciones/proyectos.js';
import ocio from './secciones/ocio.js';
import finanzas from './secciones/finanzas.js';
import mayordomo from './secciones/mayordomo.js';
import preferencias from './secciones/preferencias.js';
import buscador from './secciones/buscador.js';
import ajustes from './secciones/ajustes.js';
import menu from './secciones/menu.js';
import { arrancarPWA } from './pwa.js';

[hoy, calendario, notas, ejercicio, sueno, meditacion, alimentacion, suplementos, compra, proyectos, ocio, finanzas, mayordomo, preferencias, buscador, ajustes, menu].forEach(registrar);
if (!estado.ajustes.semillasCargadas) cargarSemillas(false);
sincronizarCompra();
aplicarTema();

const main = document.getElementById('main'), titulo = document.getElementById('titulo'), sub = document.getElementById('sub'), nav = document.getElementById('nav');
const BARRA = ['hoy', 'calendario', 'mayordomo', 'buscador', 'menu'];
let actual = null, scrollPos = {};
function pintarNav() {
  const n = consejosNuevos().length;
  nav.innerHTML = lista(BARRA.map(id => { const s = seccion(id); return h`<a href="#/${id}" class="${actual === id ? 'activo' : ''}"><span>${s.icono}</span>${s.titulo}${id === 'mayordomo' && n ? crudoN(n) : ''}</a>`; })).__crudo;
}
const crudoN = n => ({ __crudo: `<i class="n">${n}</i>` });
function render() {
  const { id, params } = rutaActual();
  const s = seccion(id) || seccion('hoy');
  if (actual && actual !== s.id) scrollPos[actual] = window.scrollY;
  const mismo = actual === s.id; actual = s.id;
  titulo.textContent = s.titulo; sub.textContent = fechaLarga(hoyISO());
  document.title = (s.id === 'hoy' ? 'maydom' : s.titulo + ' · maydom');
  try { s.render(main, params); } catch (e) { main.innerHTML = h`<div class="tarjeta"><b>Error en ${s.titulo}</b><div class="mini">${e.message}</div><div class="acciones"><a class="btn" href="#/ajustes">Ajustes</a></div></div>`; console.error(e); }
  pintarNav();
  if (!mismo) window.scrollTo(0, scrollPos[s.id] || 0);
}
window.addEventListener('hashchange', render);
alCambiar(() => { if (!document.querySelector('dialog[open]')) render(); });
render();
arrancarVigilante();

// PWA: service worker, aviso de versión nueva e instalación. Si Ajustes está delante, se repinta
// cuando el navegador ofrece instalar (o deja de ofrecerlo) y cuando aparece una versión nueva.
arrancarPWA(() => { if (actual === 'ajustes' && !document.querySelector('dialog[open]')) render(); });
window.addEventListener('error', e => { if (e.message) toast('Error: ' + e.message, 5000); });
