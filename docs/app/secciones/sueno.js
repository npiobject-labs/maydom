import { estado, guardar, h, lista, crudo, delegar, uid, hoyISO, sumarDias, fechaCorta, minutos, pad, duracionTexto, pedir, aviso, navegar, toast } from '../nucleo.js';
import { tecnicasSueno } from '../datos/semillas.js';
import { hayVoz } from '../voz.js';
import { consultar, pedirJSON, conLLM, textoAConsejos } from '../llm.js';

// Calcula los tramos de una noche. Las horas cruzan la medianoche: acostado 23:20, despertar 04:10, levantado 06:45.
// Ni lo que se tarda en dormirse ni los minutos despierto en mitad de la noche son tiempo dormido:
// los dos se descuentan, y el primer tramo empieza cuando uno se duerme, no cuando apaga la luz.
export function calcular(r) {
  const a = minutos(r.acostado), d = r.despertar ? minutos(r.despertar) : null, l = minutos(r.levantado), desp = Number(r.despierto) || 0;
  const lat = Number(r.latencia) || 0;
  const tras = x => (x - a + 1440) % 1440;
  const total = Math.max(0, tras(l) - desp - lat), tramo1 = d != null ? Math.max(0, tras(d) - lat) : total, tramo2 = d != null ? Math.max(0, tras(l) - tras(d) - desp) : 0;
  return { total, tramo1, tramo2, despierto: desp, latencia: lat };
}
// Una noche contada de viva voz puede quedarse sin las dos horas que hacen falta para medirla, ya
// sea porque el relato no las decía o porque aún no se ha interpretado. Esas cuentan como registro
// —el texto no se pierde— pero se quedan fuera de las medias y de los avisos.
export const completo = r => !!(r && r.acostado && r.levantado);
export function registrosOrdenados() { return estado.sueno.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)); }
export const registrosCompletos = () => registrosOrdenados().filter(completo);
export function mediaSueno(dias = 7) { const rs = registrosCompletos().slice(0, dias); if (!rs.length) return null; return rs.reduce((s, r) => s + calcular(r).total, 0) / rs.length; }

// El relato va ARRIBA y los campos debajo: se habla, el mayordomo los rellena y solo se repasan.
// Rellenar el formulario a mano cada mañana es justo lo que esto viene a quitar, así que sus
// campos no son obligatorios: valen para ver qué se ha entendido y corregir lo que baile.
const campoRelato = { n: 'relato', l: 'Cuéntame la noche', t: 'textarea', filas: 5, ph: 'Apagué la luz sobre las 23:45, tardé un cuarto de hora en dormirme. A las 4:30 me desperté para orinar y ya no pude, me puse a leer media hora…' };
const campos = [
  campoRelato,
  { n: 'fecha', l: 'Noche del (fecha de acostarse)', t: 'date', req: true },
  { n: 'acostado', l: 'Me acosté a las', t: 'time' },
  { n: 'latencia', l: 'Tardé en dormirme (min)', t: 'number', v: 15, min: 0 },
  { n: 'despertar', l: 'Despertar nocturno a las (vacío si no hubo)', t: 'time' },
  { n: 'despierto', l: 'Minutos despierto', t: 'number', v: 0, min: 0 },
  { n: 'levantado', l: 'Me levanté a las', t: 'time' },
  { n: 'calidad', l: 'Calidad (1–5)', t: 'select', o: [{ v: 1, l: '1 · fatal' }, { v: 2, l: '2 · mala' }, { v: 3, l: '3 · regular' }, { v: 4, l: '4 · buena' }, { v: 5, l: '5 · muy buena' }], v: 3 },
  { n: 'nota', l: 'Qué pasó (opcional)', ph: 'cena tarde, café a las 17, pantalla…' },
];
const DATOS = ['fecha', 'acostado', 'latencia', 'despertar', 'despierto', 'levantado', 'calidad', 'nota'];

// ---------- contar la noche hablando ----------
// Normaliza una hora venga como venga: «7:5», «07.05», «23:40».
const hora = v => { const m = /^\s*([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)\s*$/.exec(String(v ?? '')); return m ? `${pad(Number(m[1]))}:${m[2]}` : null; };
const entero = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= max ? n : null; };

// Plan B sin LLM. No entiende el relato: reconoce las horas que aparecen y un par de duraciones
// en letra, y las reparte por el orden en que se cuentan —primero acostarse, al final levantarse—.
// Lo que no saque se queda vacío y se edita a mano; es lo que evita que sin clave de LLM la
// pantalla se quede sin ninguna forma de registrar hablando.
export function interpretarLocal(texto) {
  const t = String(texto || '').toLowerCase();
  const horas = [...t.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g)].map(m => `${pad(Number(m[1]))}:${m[2]}`);
  const out = {};
  if (horas.length) out.acostado = horas[0];
  if (horas.length >= 2) out.levantado = horas[horas.length - 1];
  if (horas.length >= 3) out.despertar = horas[1];
  const dur = re => { const m = re.exec(t); return m ? Number(m[1]) : null; };
  const cuarto = /(un )?cuarto de hora/.test(t) ? 15 : /media hora/.test(t) ? 30 : null;
  const tardo = dur(/tard[éeaó]\w*(?:[^.]{0,20}?)\b(\d{1,3})\s*(?:minutos?|min\b)/);
  const lat = tardo ?? (/tard[éeaó]/.test(t) ? cuarto : null);
  if (lat != null) out.latencia = lat;
  const desp = dur(/(?:despierto|desvelad\w+|sin poder dormir\w*)[^.]{0,30}?\b(\d{1,3})\s*(?:minutos?|min\b)/) ?? dur(/\b(\d{1,3})\s*(?:minutos?|min\b)[^.]{0,30}?(?:despierto|desvelad\w+)/);
  if (desp != null) out.despierto = desp;
  return out;
}

// Pasa el relato al mayordomo y devuelve solo los campos que reconozca. Nunca inventa: lo que el
// texto no diga vuelve como null y se queda sin rellenar.
export async function interpretarConLLM(relato, fechaRef) {
  const j = await pedirJSON({
    operacion: 'sueno-relato', contexto: false,
    tarea: `Alguien cuenta cómo ha dormido esta noche. Hoy es ${fechaRef}. Devuelve solo este JSON:
{"fecha":"AAAA-MM-DD","acostado":"HH:MM","latencia":<minutos>,"despertar":"HH:MM","despierto":<minutos>,"levantado":"HH:MM","calidad":<1-5>,"nota":"<una línea>"}
Reglas: "fecha" es la noche, es decir el día en que se acostó (si lo cuenta por la mañana, suele ser el día anterior a hoy). "acostado" es cuando apagó la luz, no cuando se durmió. "latencia" son los minutos que tardó en dormirse. "despertar" es el despertar nocturno más largo y "despierto" los minutos que pasó despierto en él. "calidad" es tu estimación de 1 a 5 según cómo lo cuente. "nota" resume en una línea lo que pasó y lo que pueda explicarlo (cena, café, pantallas, ruido, preocupaciones), sin repetir las horas.
Lo que no diga el texto va a null; no inventes ni redondees a horas típicas. Texto:\n\n${String(relato).slice(0, 4000)}`,
  });
  const out = {};
  for (const k of ['acostado', 'despertar', 'levantado']) { const v = hora(j?.[k]); if (v) out[k] = v; }
  for (const [k, max] of [['latencia', 600], ['despierto', 900]]) { const v = entero(j?.[k], max); if (v != null) out[k] = v; }
  const cal = entero(j?.calidad, 5); if (cal >= 1) out.calidad = cal;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(j?.fecha || ''))) out.fecha = j.fecha;
  if (j?.nota) out.nota = String(j.nota).trim().slice(0, 300);
  return out;
}

// Abre la noche: relato arriba, campos debajo. Al terminar el dictado se interpreta solo; también
// hay botón por si se escribe a mano o se quiere repetir tras corregir el texto.
export function registrarNoche(valores = {}) {
  const editando = !!valores.id;
  let ultimoInterpretado = '';
  const traducir = async (relato, { escribir }, avisar = true) => {
    const t = String(relato || '').trim();
    if (!t || t === ultimoInterpretado) return;
    ultimoInterpretado = t;
    // Sin LLM configurado esto es lo único que hay, así que se escribe siempre primero: algo de
    // lo dictado queda en los campos aunque la llamada falle.
    escribir(interpretarLocal(t));
    try { escribir(await interpretarConLLM(t, hoyISO())); }
    catch (e) { if (avisar) toast('No se pudo interpretar: ' + e.message + '. Lo dictado se guarda igual; repasa las horas.', 8000); }
  };
  return pedir(editando ? 'Editar noche' : 'La noche', campos, {
    fecha: sumarDias(hoyISO(), -1), calidad: 3, ...valores,
  }, {
    dictar: 'relato',
    alDictar: (texto, api) => { toast('Interpretando lo que has contado…', 3000); return traducir(texto, api); },
    acciones: [{ l: '✨ Interpretar lo escrito', cargando: 'Interpretando…', fn: async api => { ultimoInterpretado = ''; await traducir(api.valores.relato, api); } }],
    aceptar: 'Guardar',
    texto: 'Dicta o escribe arriba y los campos se rellenan solos. Repasa lo que haya entendido antes de guardar; lo que no hayas contado se queda como esté.',
    ...(editando ? { extra: 'Borrar' } : {}),
  }).then(v => {
    if (!v) return null;
    if (v.__extra) { estado.sueno = estado.sueno.filter(x => x.id !== valores.id); guardar(); return null; }
    v.relato = (v.relato || '').trim();
    if (editando) {
      const r = estado.sueno.find(x => x.id === valores.id);
      // Lo que se toca a mano queda marcado por si más adelante se vuelve a interpretar.
      r.manuales = [...new Set([...(r.manuales || []), ...DATOS.filter(k => String(v[k] ?? '') !== String(r[k] ?? ''))])];
      Object.assign(r, v); guardar(); return r;
    }
    estado.sueno.push({ id: uid(), manuales: [], ...v }); guardar();
    return estado.sueno.at(-1);
  });
}

function render(cont) {
  const obj = Number(estado.preferencias.objetivoSueno) || 7, objMin = obj * 60;
  const rs = registrosOrdenados();
  const media = mediaSueno(7);
  const ultimo = registrosCompletos()[0], u = ultimo ? calcular(ultimo) : null;
  const modeloOk = u && (u.tramo1 >= 270 || u.total >= objMin);
  const pendientes = rs.filter(r => r.relato && !completo(r));
  cont.innerHTML = h`
    <div class="tarjeta"><div class="grande">${media != null ? duracionTexto(media) : '–'}</div><div class="mini">media de las últimas ${Math.min(7, registrosCompletos().length)} noches · objetivo ${obj} h</div>
      <div class="barra"><i class="${media != null && media >= objMin ? 'ok' : media != null && media >= objMin * 0.8 ? '' : 'w'}" style="width:${media != null ? Math.min(100, media / objMin * 100) : 0}%"></i></div>
      <div class="acciones"><button class="btn p" data-a="registrar">${hayVoz() ? '🎤 ' : ''}Contar la noche</button><button class="btn" data-a="nocturno">Me he despertado</button>${registrosCompletos().length >= 3 ? crudo('<button class="btn" data-a="analizarLLM">Analizar con LLM</button>') : ''}</div></div>
    ${pendientes.length ? lista(pendientes.map(r => h`<div class="tarjeta" data-a="editar" data-id="${r.id}"><div class="fila"><div class="t"><b>Noche del ${fechaCorta(r.fecha)} · sin horas</b><div class="mini">Faltan la hora de acostarse o la de levantarse</div></div><span class="pill w">completar</span></div><div class="mini">«${r.relato.slice(0, 120)}${r.relato.length > 120 ? '…' : ''}»</div></div>`)) : ''}
    ${u ? crudo(`<h3>Última noche · ${fechaCorta(ultimo.fecha)}</h3><div class="tarjeta" data-a="editar" data-id="${ultimo.id}">
      <div class="fila kv"><span>Total dormido</span><b>${duracionTexto(u.total)}</b></div>
      <div class="fila kv"><span>Primer tramo</span><b>${duracionTexto(u.tramo1)} ${u.tramo1 >= 270 ? '✓' : ''}</b></div>
      ${ultimo.despertar ? `<div class="fila kv"><span>Despertar</span><b>${ultimo.despertar} · ${u.despierto} min despierto</b></div><div class="fila kv"><span>Segundo tramo</span><b>${duracionTexto(u.tramo2)}</b></div>` : ''}
      <div class="fila kv"><span>Calidad</span><b>${ultimo.calidad}/5</b></div>
      ${ultimo.nota ? `<div class="mini">${ultimo.nota}</div>` : ''}
      ${ultimo.relato ? `<div class="mini">«${ultimo.relato}»</div>` : ''}
      <p class="mini">${modeloOk ? 'Encaja en el modelo aceptado: tramo largo de al menos 4 h 30, despertar breve y segundo tramo ligero.' : 'Por debajo del modelo (tramo largo ≥ 4 h 30 o 7 h en total). Aquí es donde el mayordomo pone el acento.'}</p></div>`)
      : aviso('Sin registros. Por la mañana, toca «Contar la noche» y díctalo como salga: «apagué la luz sobre las 23:45, tardé un cuarto de hora, a las 4:30 me desperté…».')}
    <h3>Historial</h3>
    ${rs.length ? crudo(`<table class="tabla"><tr><th>Noche</th><th class="n">Total</th><th class="n">1.º</th><th class="n">2.º</th><th class="n">Cal.</th></tr>${rs.slice(0, 14).map(r => { const c = calcular(r); return completo(r)
      ? h`<tr data-a="editar" data-id="${r.id}"><td>${fechaCorta(r.fecha)}${r.relato ? crudo(' <span class="mini">🎤</span>') : ''}</td><td class="n ${c.total >= objMin ? 'pos' : ''}">${duracionTexto(c.total)}</td><td class="n">${duracionTexto(c.tramo1)}</td><td class="n">${r.despertar ? duracionTexto(c.tramo2) : '–'}</td><td class="n">${r.calidad}</td></tr>`
      : h`<tr data-a="editar" data-id="${r.id}"><td>${fechaCorta(r.fecha)}${r.relato ? crudo(' <span class="mini">🎤</span>') : ''}</td><td class="n mini" colspan="4">sin horas · tocar para completar</td></tr>`; }).join('')}</table>`) : ''}
    <h3>Técnicas</h3>
    ${lista(tecnicasSueno.map(t => h`<div class="tarjeta"><b>${t.t}</b><div class="mini">${t.d}</div></div>`))}
    <p class="mini">Modelo aceptado: 7 h en total; vale un tramo de 4 h 30–5 h, un despertar breve y ~2 h más ligeras. La meditación nocturna está en Meditación → "Volver a dormir".</p>`;
  delegar(cont, {
    registrar: async () => { const r = await registrarNoche(); if (r) toast(completo(r) ? `Noche del ${fechaCorta(r.fecha)}: ${duracionTexto(calcular(r).total)} dormidas` : 'Noche guardada; faltan horas por completar', 5000); },
    analizarLLM: el => conLLM(el, async () => {
      const filas = registrosCompletos().slice(0, 14).map(r => { const c = calcular(r); return `${r.fecha}: acostado ${r.acostado}, latencia ${r.latencia || 0} min, ${r.despertar ? 'despertar ' + r.despertar + ' (' + c.despierto + ' min despierto)' : 'sin despertar'}, levantado ${r.levantado}, total ${duracionTexto(c.total)}, calidad ${r.calidad}${r.nota ? ', nota: ' + r.nota : ''}`; }).join('\n');
      const j = await consultar({ operacion: 'sueno', tarea: `Analiza estas noches (objetivo ${obj} h; se acepta un tramo de 4,5–5 h + despertar breve + ~2 h ligeras) y detecta patrones (hora de acostarse, despertares, notas). Da 3 acciones concretas para esta semana, cada una en una línea que empiece por "- ", sencillas y sin preparar nada. Sin diagnósticos médicos.\n${filas}` });
      toast(textoAConsejos(j.respuesta, 'sueno') + ' consejos de sueño nuevos'); navegar('mayordomo');
    }),
    editar: el => registrarNoche(estado.sueno.find(x => x.id === el.dataset.id)),
    nocturno: () => navegar('meditacion', { guion: 'm_vd', oscuro: '1' }),
  });
}
export default { id: 'sueno', titulo: 'Sueño', grupo: 'Cuerpo', icono: '☾', render };
