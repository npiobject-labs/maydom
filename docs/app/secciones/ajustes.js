import { estado, guardar, reemplazarEstado, h, lista, crudo, delegar, pedir, confirmar, toast, urlBackend, pedirPermisoAvisos, hoyISO, CLAVE } from '../nucleo.js';
import { estadoLLM } from '../llm.js';
import { esc } from '../nucleo.js';
import * as S from '../datos/semillas.js';

// Copia las semillas al estado si el catálogo correspondiente está vacío (o siempre, con forzar).
export function cargarSemillas(forzar = false) {
  const copiar = (clave, datos) => { if (forzar || !estado[clave].length) estado[clave] = JSON.parse(JSON.stringify(datos)); };
  copiar('ejercicios', S.ejercicios); copiar('tablas', S.tablas); copiar('platos', S.platos); copiar('tiendas', S.tiendas);
  estado.ajustes.semillasCargadas = true; guardar();
}
function descargar(nombre, contenido, tipo = 'application/json') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([contenido], { type: tipo })); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function render(cont) {
  const a = estado.ajustes;
  const tam = Math.round((localStorage.getItem(CLAVE) || '').length / 1024);
  const cuenta = ['eventos', 'notas', 'ejercicios', 'sueno', 'suplementos', 'proyectos', 'movimientos', 'consejos', 'tiendas'].map(k => `${k} ${estado[k].length}`).join(' · ');
  cont.innerHTML = h`
    <h3>Datos</h3>
    <div class="tarjeta"><div class="mini">Todo vive en este navegador (${tam} KB): ${cuenta}.</div>
      <div class="acciones"><button class="btn p" data-a="exportar">Exportar copia (JSON)</button>
        <label class="btn">Importar <input type="file" accept="application/json" data-c="importar" hidden></label>
        <button class="btn peligro" data-a="borrar">Borrar todo</button></div></div>
    <h3>Catálogos</h3>
    <div class="tarjeta"><div class="mini">Ejercicios, tablas, platos y tiendas vienen de semillas del repo (docs/app/datos/semillas.js) y se editan en cada sección.</div>
      <div class="acciones"><button class="btn" data-a="semillas">Cargar las que falten</button><button class="btn" data-a="semillasForzar">Restaurar semillas (sobrescribe)</button></div></div>
    <h3>Avisos</h3>
    <div class="tarjeta"><div class="mini">Con la app abierta o instalada avisa de eventos, tomas y píldoras. Permiso: ${'Notification' in window ? Notification.permission : 'no disponible'}.</div>
      <div class="acciones"><button class="btn" data-a="avisos">${a.avisos ? 'Avisos activados' : 'Activar avisos'}</button>
        <button class="btn" data-a="instalar" id="btn-instalar" ${window.__instalar ? '' : 'hidden'}>Instalar en el móvil</button></div></div>
    <h3>Backend y mayordomo</h3>
    <div class="tarjeta"><div class="mini">URL: ${urlBackend()} ${a.backend ? '(manual)' : '(derivada del meta fly-app o localhost)'}</div>
      <div class="mini">Clave de acceso: ${a.clave ? '••••' + a.clave.slice(-4) : 'sin poner'} · el mayordomo usa el gateway openrouter del propio proyecto; su clave vive en el backend, nunca aquí.</div>
      ${a.llm ? crudo(`<div class="mini">LLM: <b>${a.llm.llm ? 'disponible' : 'no configurado en el backend'}</b>${a.llm.modelo ? ' · modelo ' + esc(a.llm.modelo) : ''}${a.llm.clave_requerida ? ' · exige clave de acceso' : ''}</div>`) : ''}
      <div class="acciones"><button class="btn" data-a="backend">Cambiar URL</button><button class="btn p" data-a="clave">Clave de acceso</button><button class="btn" data-a="probar">Probar /salud</button><button class="btn" data-a="estado">Estado del LLM</button></div>
      <div id="salida-backend" class="mini"></div></div>
    <h3>Aspecto</h3>
    <div class="tarjeta"><div class="acciones">${lista(['auto', 'light', 'dark'].map(t => h`<button class="btn ${a.tema === t ? 'p' : ''}" data-a="tema" data-t="${t}">${{ auto: 'Sistema', light: 'Claro', dark: 'Oscuro' }[t]}</button>`))}</div></div>
    <p class="mini">Build ${document.querySelector('meta[name=build]')?.content} · <a href="bitacora.html">bitácora</a> · <a href="mocks/">mocks</a> · <a href="holamundo.html">comprobación del backend</a></p>`;
  delegar(cont, {
    exportar: () => descargar(`maydom-${hoyISO()}.json`, JSON.stringify(estado, null, 1)),
    importar: async el => {
      const f = el.files[0]; if (!f) return;
      try { const j = JSON.parse(await f.text()); if (!j || typeof j !== 'object' || !('preferencias' in j)) throw new Error('no parece una copia de maydom'); if (await confirmar('Sustituir todos los datos por los del fichero?')) { reemplazarEstado(j); toast('Importado'); } }
      catch (e) { toast('No se pudo importar: ' + e.message); }
      el.value = '';
    },
    borrar: async () => { if (await confirmar('Se borra TODO lo guardado en este navegador. ¿Seguro?', 'Borrar')) { reemplazarEstado({}); cargarSemillas(); toast('Datos borrados'); } },
    semillas: () => { cargarSemillas(false); toast('Semillas cargadas'); },
    semillasForzar: async () => { if (await confirmar('Sobrescribe ejercicios, tablas, platos y tiendas con las semillas.')) { cargarSemillas(true); toast('Semillas restauradas'); } },
    avisos: async () => { if (await pedirPermisoAvisos()) toast('Avisos activados'); else toast('Sin permiso de avisos'); render(cont); },
    instalar: async () => { if (window.__instalar) { window.__instalar.prompt(); await window.__instalar.userChoice; window.__instalar = null; render(cont); } },
    clave: async () => { const v = await pedir('Clave de acceso al mayordomo', [{ n: 'clave', l: 'Clave', ph: 'la del secreto MAYDOM_CLAVE', ayuda: 'Solo controla quién puede gastar presupuesto desde esta app. La clave del gateway no pasa por el navegador.' }], a); if (v) { a.clave = v.clave.trim(); guardar(); render(cont); } },
    estado: async () => {
      const out = cont.querySelector('#salida-backend'); out.textContent = 'Consultando…';
      try { const j = await estadoLLM(); out.textContent = `llm=${j.llm} modelo=${j.modelo} clave_requerida=${j.clave_requerida} build=${j.build}`; render(cont); }
      catch (e) { out.textContent = 'Error: ' + e.message; }
    },
    backend: async () => { const v = await pedir('URL del backend', [{ n: 'backend', l: 'URL (vacío = automática)', ph: 'https://maydom-npiobject-labs.fly.dev' }], a); if (v) { a.backend = v.backend.trim(); guardar(); } },
    probar: async () => {
      const out = cont.querySelector('#salida-backend'); out.textContent = 'Probando…';
      try { const r = await fetch(urlBackend() + '/salud', { signal: AbortSignal.timeout(30000) }); const j = await r.json(); out.textContent = `ok=${j.ok} build=${j.build}`; }
      catch (e) { out.textContent = 'Error: ' + e.message; }
    },
    tema: el => { a.tema = el.dataset.t; guardar(); aplicarTema(); },
  });
}
export function aplicarTema() { const t = estado.ajustes.tema; if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; }
export default { id: 'ajustes', titulo: 'Ajustes', grupo: 'Ajustes', icono: '⚙', render };
