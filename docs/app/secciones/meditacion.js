import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, pedir, toast, navegar, duracionTexto } from '../nucleo.js';
import { meditaciones } from '../datos/semillas.js';
import { crearEvento } from '../agenda.js';

let temporizador = null;
function render(cont, params) {
  if (params.guion) return guion(cont, params);
  const hechas = estado.eventos.filter(e => e.seccion === 'meditacion' && e.hecho).length;
  cont.innerHTML = h`
    <p class="mini">Sencillez: nada que preparar, pocos minutos. Si hace falta un entorno o un protocolo, no vale.</p>
    ${lista(meditaciones.map(m => h`<div class="tarjeta"><div class="fila"><div class="t"><b>${m.nombre}</b> ${m.nocturna ? crudo('<span class="pill">vale de noche</span>') : ''}<div class="mini">${m.min} min · ${m.pasos[0]}</div></div>
      <button class="btn p" data-a="ir" data-g="${m.id}">Empezar</button></div>
      <div class="acciones"><button class="btn mini" data-a="cal" data-g="${m.id}">Al calendario</button></div></div>`))}
    <div class="tarjeta"><div class="fila"><div class="t"><b>Despertar nocturno</b><div class="mini">Pantalla negra, sin mirar la hora. Guion "Volver a dormir".</div></div><button class="btn" data-a="nocturno">Abrir</button></div></div>
    <p class="mini">${hechas} meditaciones marcadas como hechas en el calendario.</p>`;
  delegar(cont, {
    ir: el => navegar('meditacion', { guion: el.dataset.g }),
    nocturno: () => navegar('meditacion', { guion: 'm_vd', oscuro: '1' }),
    cal: async el => {
      const m = meditaciones.find(x => x.id === el.dataset.g);
      const v = await pedir('Planificar ' + m.nombre, [{ n: 'fecha', l: 'Fecha', t: 'date', v: hoyISO() }, { n: 'hora', l: 'Hora', t: 'time', v: estado.preferencias.horaAcostarse || '23:00' }]);
      if (v && await crearEvento({ titulo: 'Meditación: ' + m.nombre, fecha: v.fecha, hora: v.hora, dur: m.min, seccion: 'meditacion', ref: m.id })) toast('En el calendario');
    },
  });
}
function guion(cont, params) {
  const m = meditaciones.find(x => x.id === params.guion) || meditaciones[0];
  const oscuro = params.oscuro === '1';
  let restante = m.min * 60, paso = 0;
  clearInterval(temporizador);
  const pinta = () => {
    const cuerpo = h`<div class="tempo">${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}</div>
      <p><b>${m.pasos[paso]}</b></p>
      <div class="mini">${paso + 1} / ${m.pasos.length}</div>
      <div class="acciones ${oscuro ? '' : 'centro'}"><button class="btn" data-a="ant" ${paso ? '' : 'disabled'}>‹</button><button class="btn" data-a="sig" ${paso < m.pasos.length - 1 ? '' : 'disabled'}>›</button><button class="btn" data-a="fin">${restante ? 'Terminar' : 'Hecho'}</button></div>`;
    cont.innerHTML = oscuro ? h`<div class="oscuro"><div class="grande">${m.nombre}</div>${crudo(cuerpo)}</div>` : h`<h2>${m.nombre}</h2><div class="tarjeta centro">${crudo(cuerpo)}</div><ol class="pasos mini">${lista(m.pasos.map(p => h`<li>${p}</li>`))}</ol>`;
    delegar(cont, { ant: () => { paso = Math.max(0, paso - 1); pinta(); }, sig: () => { paso = Math.min(m.pasos.length - 1, paso + 1); pinta(); }, fin: terminar });
  };
  const terminar = () => {
    clearInterval(temporizador);
    const ev = estado.eventos.find(e => e.fecha === hoyISO() && e.ref === m.id && !e.hecho); if (ev) { ev.hecho = true; guardar(); }
    estado.memoria.push({ id: uid(), fecha: hoyISO(), tipo: 'meditacion', texto: `${m.nombre} (${duracionTexto(m.min - Math.floor(restante / 60))})${oscuro ? ' · despertar nocturno' : ''}` }); guardar();
    navegar(oscuro ? 'sueno' : 'meditacion');
  };
  temporizador = setInterval(() => { if (restante > 0) { restante--; const el = cont.querySelector('.tempo'); if (el) el.textContent = `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}`; if (restante === 0) { try { navigator.vibrate?.(200); } catch { } pinta(); } } }, 1000);
  pinta();
}
export default { id: 'meditacion', titulo: 'Meditación', grupo: 'Cuerpo', icono: '◠', render };
