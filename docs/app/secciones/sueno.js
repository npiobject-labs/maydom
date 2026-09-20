import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, sumarDias, fechaCorta, minutos, duracionTexto, pedir, aviso, navegar, toast } from '../nucleo.js';
import { tecnicasSueno } from '../datos/semillas.js';

// Calcula los tramos de una noche. Las horas cruzan la medianoche: acostado 23:20, despertar 04:10, levantado 06:45.
export function calcular(r) {
  const a = minutos(r.acostado), d = r.despertar ? minutos(r.despertar) : null, l = minutos(r.levantado), desp = Number(r.despierto) || 0;
  const tras = x => (x - a + 1440) % 1440;
  const total = tras(l) - desp, tramo1 = d != null ? tras(d) : total, tramo2 = d != null ? Math.max(0, tras(l) - tras(d) - desp) : 0;
  return { total, tramo1, tramo2, despierto: desp, latencia: Number(r.latencia) || 0 };
}
export function registrosOrdenados() { return estado.sueno.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)); }
export function mediaSueno(dias = 7) { const rs = registrosOrdenados().slice(0, dias); if (!rs.length) return null; return rs.reduce((s, r) => s + calcular(r).total, 0) / rs.length; }
const campos = [
  { n: 'fecha', l: 'Noche del (fecha de acostarse)', t: 'date', req: true },
  { n: 'acostado', l: 'Me acosté a las', t: 'time', req: true },
  { n: 'latencia', l: 'Tardé en dormirme (min)', t: 'number', v: 15, min: 0 },
  { n: 'despertar', l: 'Despertar nocturno a las (vacío si no hubo)', t: 'time' },
  { n: 'despierto', l: 'Minutos despierto', t: 'number', v: 0, min: 0 },
  { n: 'levantado', l: 'Me levanté a las', t: 'time', req: true },
  { n: 'calidad', l: 'Calidad (1–5)', t: 'select', o: [{ v: 1, l: '1 · fatal' }, { v: 2, l: '2 · mala' }, { v: 3, l: '3 · regular' }, { v: 4, l: '4 · buena' }, { v: 5, l: '5 · muy buena' }], v: 3 },
  { n: 'nota', l: 'Qué pasó (opcional)', ph: 'cena tarde, café a las 17, pantalla…' },
];
export function registrarNoche(valores = {}) {
  return pedir('Registrar noche', campos, { fecha: sumarDias(hoyISO(), -1), acostado: estado.preferencias.horaAcostarse || '23:00', levantado: '07:00', ...valores }, valores.id ? { extra: 'Borrar' } : {}).then(v => {
    if (!v) return null;
    if (v.__extra) { estado.sueno = estado.sueno.filter(x => x.id !== valores.id); guardar(); return null; }
    const r = valores.id ? Object.assign(estado.sueno.find(x => x.id === valores.id), v) : (estado.sueno.push({ id: uid(), ...v }), estado.sueno.at(-1));
    guardar(); return r;
  });
}
function render(cont) {
  const obj = Number(estado.preferencias.objetivoSueno) || 7, objMin = obj * 60;
  const rs = registrosOrdenados();
  const media = mediaSueno(7);
  const ultimo = rs[0], u = ultimo ? calcular(ultimo) : null;
  const modeloOk = u && (u.tramo1 >= 270 || u.total >= objMin);
  cont.innerHTML = h`
    <div class="tarjeta"><div class="grande">${media != null ? duracionTexto(media) : '–'}</div><div class="mini">media de las últimas ${Math.min(7, rs.length)} noches · objetivo ${obj} h</div>
      <div class="barra"><i class="${media != null && media >= objMin ? 'ok' : media != null && media >= objMin * 0.8 ? '' : 'w'}" style="width:${media != null ? Math.min(100, media / objMin * 100) : 0}%"></i></div>
      <div class="acciones"><button class="btn p" data-a="registrar">Registrar anoche</button><button class="btn" data-a="nocturno">Me he despertado</button></div></div>
    ${u ? crudo(`<h3>Última noche · ${fechaCorta(ultimo.fecha)}</h3><div class="tarjeta">
      <div class="fila kv"><span>Total dormido</span><b>${duracionTexto(u.total)}</b></div>
      <div class="fila kv"><span>Primer tramo</span><b>${duracionTexto(u.tramo1)} ${u.tramo1 >= 270 ? '✓' : ''}</b></div>
      ${ultimo.despertar ? `<div class="fila kv"><span>Despertar</span><b>${ultimo.despertar} · ${u.despierto} min despierto</b></div><div class="fila kv"><span>Segundo tramo</span><b>${duracionTexto(u.tramo2)}</b></div>` : ''}
      <div class="fila kv"><span>Calidad</span><b>${ultimo.calidad}/5</b></div>
      <p class="mini">${modeloOk ? 'Encaja en el modelo aceptado: tramo largo de al menos 4 h 30, despertar breve y segundo tramo ligero.' : 'Por debajo del modelo (tramo largo ≥ 4 h 30 o 7 h en total). Aquí es donde el mayordomo pone el acento.'}</p></div>`) : aviso('Sin registros. Un registro de una línea cada mañana basta: acostado, despertar, levantado.')}
    <h3>Historial</h3>
    ${rs.length ? crudo(`<table class="tabla"><tr><th>Noche</th><th class="n">Total</th><th class="n">1.º</th><th class="n">2.º</th><th class="n">Cal.</th></tr>${rs.slice(0, 14).map(r => { const c = calcular(r); return h`<tr data-a="editar" data-id="${r.id}"><td>${fechaCorta(r.fecha)}</td><td class="n ${c.total >= objMin ? 'pos' : ''}">${duracionTexto(c.total)}</td><td class="n">${duracionTexto(c.tramo1)}</td><td class="n">${r.despertar ? duracionTexto(c.tramo2) : '–'}</td><td class="n">${r.calidad}</td></tr>`; }).join('')}</table>`) : ''}
    <h3>Técnicas</h3>
    ${lista(tecnicasSueno.map(t => h`<div class="tarjeta"><b>${t.t}</b><div class="mini">${t.d}</div></div>`))}
    <p class="mini">Modelo aceptado: 7 h en total; vale un tramo de 4 h 30–5 h, un despertar breve y ~2 h más ligeras. La meditación nocturna está en Meditación → "Volver a dormir".</p>`;
  delegar(cont, {
    registrar: async () => { const r = await registrarNoche(); if (r) toast('Noche registrada'); },
    editar: el => registrarNoche(estado.sueno.find(x => x.id === el.dataset.id)),
    nocturno: () => navegar('meditacion', { guion: 'm_vd', oscuro: '1' }),
  });
}
export default { id: 'sueno', titulo: 'Sueño', grupo: 'Cuerpo', icono: '☾', render };
