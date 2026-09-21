import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, fechaCorta, toast, aviso, navegar, urlBackend, seccion, confirmar } from '../nucleo.js';
import { refrescarConsejos } from '../reglas.js';
import { consultar } from '../llm.js';

const ESTADOS = { nuevo: 'nuevo', probar: 'probando', espera: 'en espera', rechazado: 'rechazado', hecho: 'hecho' };
export function consejosNuevos() { return estado.consejos.filter(c => c.estado === 'nuevo'); }
export function tarjetaConsejo(c, compacta = false) {
  return h`<div class="tarjeta consejo"><div class="mini">${fechaCorta(c.fecha)} · ${c.origen === 'llm' ? 'LLM' : 'reglas'} · ${seccion(c.seccion)?.titulo || c.seccion} · <span class="pill ${{ probar: 'ok', espera: 'w', rechazado: 'mal', hecho: 'g' }[c.estado] || ''}">${ESTADOS[c.estado]}</span></div>
    <div>${c.texto}</div>
    <div class="acciones">${c.estado !== 'probar' && c.estado !== 'hecho' ? crudo(`<button class="btn p mini" data-a="est" data-id="${c.id}" data-e="probar">Probar</button>`) : ''}
      ${c.estado === 'probar' ? crudo(`<button class="btn p mini" data-a="est" data-id="${c.id}" data-e="hecho">Hecho</button>`) : ''}
      ${c.estado !== 'espera' && c.estado !== 'hecho' ? crudo(`<button class="btn mini" data-a="est" data-id="${c.id}" data-e="espera">Esperar</button>`) : ''}
      ${c.estado !== 'rechazado' && c.estado !== 'hecho' ? crudo(`<button class="btn mini" data-a="est" data-id="${c.id}" data-e="rechazado">Rechazar</button>`) : ''}
      ${c.accion && !compacta ? crudo(`<button class="btn mini" data-a="ir" data-s="${c.accion}">Ir a ${seccion(c.accion)?.titulo || c.accion} ›</button>`) : ''}
      ${compacta ? '' : crudo(`<button class="btn mini" data-a="borrar" data-id="${c.id}">×</button>`)}</div></div>`;
}
export function accionesConsejo(extra = {}) {
  return {
    est: el => { const c = estado.consejos.find(x => x.id === el.dataset.id); if (!c) return; c.estado = el.dataset.e; c.cambiado = hoyISO(); if (['probar', 'rechazado', 'hecho'].includes(c.estado)) estado.memoria.push({ id: uid(), fecha: hoyISO(), tipo: 'consejo', texto: `${ESTADOS[c.estado]}: ${c.texto}` }); guardar(); },
    ir: el => navegar(el.dataset.s),
    borrar: el => { estado.consejos = estado.consejos.filter(x => x.id !== el.dataset.id); guardar(); },
    ...extra,
  };
}
// Llama al backend, que reenvía a OpenRouter con la clave guardada en Fly. Sin clave, el backend contesta 503.
export function preguntarLLM(mensajes) { return consultar({ mensajes: mensajes.slice(-12) }); }
// Bóveda Obsidian en el repo: la memoria se sube como fichero nuevo en preferencias/ vía la página "new file" de GitHub, prellenada.
const REPO_MEMORIA = 'https://github.com/npiobject-labs/maydom/new/main/docs/planificacion/memoria/preferencias';
function exportarMemoria() {
  const p = estado.preferencias;
  const md = [`---\nfecha: ${hoyISO()}\nhorizonte: ${p.horizonte}\ntags: [maydom, preferencias, export-app]\n---\n# Preferencias exportadas el ${hoyISO()}\n`,
    `- Energía ${p.energia}/5 · foco: ${p.foco || '-'} · carga máx ${p.cargaMax} h · píldoras cada ${p.pildoraCada} min\n- Ejercicio: ${(p.tiposEjercicio || []).join(', ') || '-'} · alimentación: ${p.restricciones || '-'}\n- Ocio: ${(p.tiposOcio || []).join(', ')} · ${p.ocioPorMes}/mes · ${p.presupuestoOcio} €\n- Sueño: acostarse ${p.horaAcostarse}, objetivo ${p.objetivoSueno} h\n${p.notas ? '- Notas: ' + p.notas + '\n' : ''}`,
    `\n## Consejos decididos\n`, ...estado.consejos.filter(c => c.estado !== 'nuevo').map(c => `- ${c.cambiado || c.fecha} · **${ESTADOS[c.estado]}** · #${c.seccion} · ${c.texto}`),
    `\n## Memoria de la app\n`, ...estado.memoria.slice(-100).map(m => `- ${m.fecha} · ${m.tipo} · ${m.texto}`),
    `\n## Notas marcadas\n`, ...estado.notas.filter(n => n.tipo !== 'nota').map(n => `- ${n.fecha} · ${n.tipo} · ${n.texto} ${(n.etiquetas || []).map(e => '#' + e).join(' ')}`)].join('\n');
  const nombre = `${hoyISO()}-app.md`;
  const url = `${REPO_MEMORIA}?filename=${encodeURIComponent(nombre)}&value=${encodeURIComponent(md)}`;
  // GitHub prellena el fichero desde la URL hasta unos 8 KB; si es más largo, se descarga y se copia.
  if (url.length < 8000) { window.open(url, '_blank'); toast('Abierto en GitHub: revisa y haz commit en la bóveda'); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' })); a.download = nombre; a.click();
  navigator.clipboard?.writeText(md).then(() => toast('Memoria larga: descargada y copiada; súbela a memoria/preferencias/')).catch(() => toast('Memoria descargada'));
}
let pensando = false;
function render(cont, params) {
  const nuevos = refrescarConsejos(); if (nuevos) guardar();
  const filtro = params.f || 'activos';
  const cs = estado.consejos.filter(c => filtro === 'activos' ? ['nuevo', 'probar', 'espera'].includes(c.estado) : filtro === 'todos' ? true : c.estado === filtro).sort((a, b) => (a.estado === 'nuevo' ? 0 : 1) - (b.estado === 'nuevo' ? 0 : 1) || b.fecha.localeCompare(a.fecha));
  cont.innerHTML = h`
    <div class="tarjeta"><div class="chat" id="chat">${lista(estado.chat.slice(-10).map(m => h`<div class="msg ${m.rol === 'usuario' ? 'yo' : ''}">${m.contenido}</div>`))}
      ${estado.chat.length ? '' : crudo('<div class="msg">Soy tu mayordomo. Conozco tu calendario, sueño, ejercicio, comidas, suplementos, proyectos, ocio y cuentas. Aconsejo; tú decides qué probar, rechazar o dejar en espera.</div>')}
      ${pensando ? crudo('<div class="msg mini">pensando…</div>') : ''}</div>
      <form class="acciones" id="f-chat"><input type="text" name="q" placeholder="Pregunta o cuéntale algo…" autocomplete="off"><span id="dictar-chat"></span><button class="btn p" type="submit">Enviar</button></form>
      <div class="acciones"><button class="btn mini" data-a="consejoLLM">Pedir consejos al LLM</button><button class="btn mini" data-a="limpiarChat">Limpiar chat</button></div></div>
    <div class="chips">${lista(['activos', 'hecho', 'rechazado', 'todos'].map(f => h`<button class="pill ${f === filtro ? 'sel' : ''}" data-a="filtro" data-f="${f}">${f}</button>`))}</div>
    ${cs.length ? lista(cs.map(c => tarjetaConsejo(c))) : aviso('Sin consejos ' + filtro + '. Se generan solos a partir de lo que registras; cuantos más datos, mejores consejos.')}
    <div class="acciones"><button class="btn" data-a="regenerar">Revisar reglas</button><button class="btn" data-a="memoria">Exportar memoria (Obsidian)</button></div>
    <p class="mini">Reglas locales siempre; el LLM (OpenRouter vía backend) cuando hay clave en Fly. Backend: ${urlBackend()}.</p>`;
  const enviar = async (texto, pedirConsejos = false) => {
    if (pensando) return;
    if (texto) estado.chat.push({ rol: 'usuario', contenido: texto });
    const mensajes = pedirConsejos ? [...estado.chat, { rol: 'usuario', contenido: 'Dame 3 consejos concretos para hoy y esta semana, uno por línea, empezando cada línea por "- ". Prioriza el sueño.' }] : estado.chat;
    pensando = true; guardar(); render(cont, params);
    try {
      const j = await preguntarLLM(mensajes.map(m => ({ rol: m.rol, contenido: m.contenido })));
      estado.chat.push({ rol: 'mayordomo', contenido: j.respuesta || '(sin respuesta)' });
      if (pedirConsejos) for (const l of (j.respuesta || '').split('\n').map(s => s.trim()).filter(s => /^[-•*]\s/.test(s))) estado.consejos.push({ id: uid(), fecha: hoyISO(), origen: 'llm', estado: 'nuevo', clave: 'llm:' + uid(), seccion: 'mayordomo', texto: l.replace(/^[-•*]\s+/, '') });
      estado.chat = estado.chat.slice(-40);
    } catch (e) { estado.chat.push({ rol: 'mayordomo', contenido: 'No he podido consultar al LLM: ' + e.message + '. Los consejos por reglas siguen funcionando.' }); }
    pensando = false; guardar(); render(cont, params);
    const ch = cont.querySelector('#chat'); if (ch) ch.scrollTop = ch.scrollHeight;
  };
  import('../voz.js').then(v => v.botonDictado(cont.querySelector('#f-chat input'), cont.querySelector('#dictar-chat'))).catch(() => { });
  cont.querySelector('#f-chat').onsubmit = e => { e.preventDefault(); const q = e.target.q.value.trim(); if (q) { e.target.q.value = ''; enviar(q); } };
  delegar(cont, accionesConsejo({
    filtro: el => navegar('mayordomo', { f: el.dataset.f }),
    regenerar: () => { const n = refrescarConsejos(); guardar(); toast(n ? n + ' consejos nuevos' : 'Nada nuevo que aconsejar'); },
    consejoLLM: () => enviar('', true),
    limpiarChat: async () => { if (await confirmar('¿Vaciar la conversación?')) { estado.chat = []; guardar(); } },
    memoria: exportarMemoria,
  }));
}
export default { id: 'mayordomo', titulo: 'Mayordomo', grupo: 'Mayordomo', icono: '✦', render };
