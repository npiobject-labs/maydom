import { estado, guardar, h, lista, delegar, uid, hoyISO, fechaCorta, pedir, confirmar, aviso } from '../nucleo.js';
const ETIQUETAS = ['ejercicio', 'sueno', 'meditacion', 'alimentacion', 'suplementos', 'proyecto', 'ocio', 'finanzas', 'calendario', 'mayordomo', 'idea'];
const TIPOS = [{ v: 'nota', l: 'Nota' }, { v: 'preferencia', l: 'Preferencia (guía al mayordomo)' }, { v: 'tendencia', l: 'Tendencia (algo que noto)' }];
const campos = [
  { n: 'texto', l: 'Texto', t: 'textarea', filas: 4, req: true },
  { n: 'etiquetas', l: 'Etiquetas (coma)', t: 'tags', ayuda: ETIQUETAS.join(' · ') },
  { n: 'tipo', l: 'Tipo', t: 'select', o: TIPOS, v: 'nota' },
];
function render(cont, params) {
  const filtro = (params.q || '').toLowerCase(), etq = params.etq || '';
  const notas = estado.notas.filter(n => (!filtro || n.texto.toLowerCase().includes(filtro)) && (!etq || (n.etiquetas || []).includes(etq))).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  const usadas = [...new Set(estado.notas.flatMap(n => n.etiquetas || []))];
  cont.innerHTML = h`
    <div class="acciones"><input type="search" placeholder="Buscar en las notas" value="${filtro}" data-c="buscar"><button class="btn p" data-a="nueva">+ Nota</button></div>
    <div class="chips">${lista([h`<button class="pill ${etq ? '' : 'sel'}" data-a="etq" data-e="">todas</button>`, ...usadas.map(e => h`<button class="pill ${e === etq ? 'sel' : ''}" data-a="etq" data-e="${e}">${e}</button>`)])}</div>
    ${notas.length ? lista(notas.map(n => h`<div class="tarjeta nota t-${n.tipo}" data-a="editar" data-id="${n.id}">
      <div class="mini">${fechaCorta(n.fecha)} · ${n.tipo}${(n.etiquetas || []).length ? ' · ' + n.etiquetas.join(', ') : ''}</div>
      <div>${n.texto}</div></div>`)) : aviso('Sin notas. Cualquier cosa vale: una idea, un plato que te sentó bien, un ejercicio que no repetirías.')}`;
  delegar(cont, {
    buscar: el => { params.q = el.value; render(cont, params); },
    etq: el => { params.etq = el.dataset.e; render(cont, params); },
    nueva: async () => { const v = await pedir('Nueva nota', campos, { etiquetas: etq ? [etq] : [] }); if (v) { estado.notas.push({ id: uid(), fecha: hoyISO(), ...v }); guardar(); } },
    editar: async el => {
      const n = estado.notas.find(x => x.id === el.dataset.id); if (!n) return;
      const v = await pedir('Editar nota', campos, n, { extra: 'Borrar' }); if (!v) return;
      if (v.__extra) { if (await confirmar('¿Borrar la nota?')) { estado.notas = estado.notas.filter(x => x.id !== n.id); guardar(); } return; }
      Object.assign(n, v); guardar();
    },
  });
}
export default { id: 'notas', titulo: 'Notas', grupo: 'Agenda', icono: '✎', render };
