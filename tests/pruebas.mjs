// Pruebas automáticas de PandarIA Fit
// Cargan www/index.html en un navegador simulado (jsdom), con fecha y azar fijos, y comprueban que
// los algoritmos dan exactamente los mismos resultados que los guardados en tests/resultados.json.
//   node tests/pruebas.mjs                 → compara (falla si algo cambió)
//   node tests/pruebas.mjs --actualizar    → guarda los resultados actuales como los correctos
//                                            (solo cuando Eddy aprueba un cambio a propósito)
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.TZ = 'UTC';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.join(DIR, '..', 'www', 'index.html');
const ESPERADO = path.join(DIR, 'resultados.json');
const COPIA07 = path.join(DIR, 'copia-0.7.json');
const ACTUALIZAR = process.argv.includes('--actualizar');
const NOW = Date.UTC(2026, 10, 12, 12, 0, 0); // 12 nov 2026, 12:00

/* ---------- Navegador simulado con fecha y azar fijos ---------- */
function abrir(storage) {
  const errores = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errores.push(String(e.message || e).slice(0, 300)));
  vc.on('error', e => errores.push(String(e).slice(0, 300)));
  const dom = new JSDOM(fs.readFileSync(HTML, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/', virtualConsole: vc,
    beforeParse(w) {
      let now = NOW;
      const RD = w.Date;
      class FD extends RD { constructor(...a) { if (a.length === 0) super(now); else super(...a); } static now() { return now; } }
      w.Date = FD;
      w.__setNow = t => { now = t; };
      let seed = 1;
      w.__seed = n => { seed = n >>> 0 || 1; };
      w.Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      w.scrollTo = () => {};
      w.Element.prototype.scrollIntoView = () => {};
      if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
    }
  });
  return { w: dom.window, errores, cerrar: () => dom.window.close() };
}
const espera = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Ayudas que viven dentro de la app ---------- */
const HOMBRE = { name: 'A', age: 30, height: 178, weight: 80, sex: 'h', fitness: 'activo' };
const MUJER = { name: 'B', age: 34, height: 163, weight: 60, sex: 'm', fitness: 'activo' };
const AYUDAS = () => `
window.HOMBRE = ${JSON.stringify(HOMBRE)}; window.MUJER = ${JSON.stringify(MUJER)};
window.__NOW = ${NOW};
window.__clean = o => JSON.parse(JSON.stringify(o, (k, v) => ['uid','id','sid','routineId','superset','created','itemUid'].includes(k) ? undefined : (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));
window.__reset = (profile, settings) => {
  __seed(7); __setNow(${NOW});
  S = DEF(); S.settings.onboarded = true; Object.assign(S.settings, settings || {});
  S.profile = Object.assign({ injuries: [] }, profile || {});
  if (S.profile.weight) S.measures.push({ id: 'm0', date: ${NOW} - 90 * DAY, peso: S.profile.weight });
  loadExercises([]); TPLM_reset();
};
// Historial sintético: n sesiones de una rutina, una cada 'cada' días, terminando hace 'fin' días.
// Las cargas suben 'paso' kg por sesión; en la última se llega al tope del rango si 'tope'.
window.__hist = (r, o) => {
  o = Object.assign({ n: 6, cada: 3, fin: 1, base: 0.6, paso: 2.5, tope: true, intensidad: 7 }, o);
  for (let k = 0; k < o.n; k++) {
    const end = ${NOW} - (o.fin + (o.n - 1 - k) * o.cada) * DAY, last = k === o.n - 1;
    const items = r.items.map(it => { const ex = getEx(it.exId); return { exId: it.exId, note: '', sets: it.sets.filter(s => s.t !== 'c').map(s => {
      if (ex.mode === 't') return { t: 'n', time: (+s.time || 30) + k * 5, done: true };
      const reps = it.range ? (last && o.tope ? it.range[1] : it.range[0] + (k % 2)) : (+s.reps || 10);
      const kg = ex.mode === 'p' ? Math.round(((+s.kg || 20) * o.base + k * o.paso) * 2) / 2 : null;
      return { t: 'n', kg, reps, done: true, rir: 2 }; }) }; });
    const s = { id: 's' + k + '_' + r.id, routineId: r.id, routineName: r.name, start: end - 3600000, end, intensity: o.intensidad, checkin: null, items };
    s.vol = sessionVolume(s); s.prs = []; S.sessions.push(s);
    S.firstSession = S.firstSession || end; S.periodStart = S.periodStart || end;
  }
  S.sessions.sort((a, b) => a.end - b.end);
};
window.__routine = (items, o) => { const r = newRoutine(Object.assign({ name: 'Prueba', items, pandaria: true, goal: 'musculo' }, o || {})); r.id = 'r_' + (S.routines.length + 1); S.routines.push(r); return r; };
`;

/* ---------- Casos ---------- */
// Cada caso es una función que se ejecuta DENTRO de la app y devuelve un resultado que se puede guardar.
const casos = [];
const caso = (nombre, fn) => casos.push([nombre, fn]);

// 1-6 · Prescripción por objetivo y nivel
for (const goal of ['fuerza', 'musculo', 'grasa', 'resistencia', 'flexibilidad', 'salud']) {
  caso(`prescripcion_${goal}`, new Function(`__reset(${JSON.stringify(HOMBRE)});
    const out = {}; for (const id of ['sentadilla','curl_barra','plancha','correr_cinta','est_isquios']) { const ex = EX[id] || Object.values(EX).find(x => x.id.startsWith(id.split('_')[0]));
      out[ex.id] = [1,2,3].map(l => prescribe(ex, '${goal}', l)); } return out;`));
}
// 7-9 · Prescripción con perfiles especiales
caso('prescripcion_mayor_55', () => { __reset({ age: 55, height: 170, weight: 75, sex: 'h' }); return ['sentadilla', 'press_banca'].map(id => prescribe(EX[id], 'musculo', 2)); });
caso('prescripcion_sedentario', () => { __reset({ age: 40, height: 165, weight: 70, sex: 'm', fitness: 'sedentario' }); return ['sentadilla', 'press_banca'].map(id => prescribe(EX[id], 'musculo', 1)); });
caso('prescripcion_menor_16', () => { __reset({ age: 16, height: 170, weight: 60, sex: 'h' }); return ['sentadilla', 'press_banca'].map(id => prescribe(EX[id], 'fuerza', 1)); });
// 10-13 · Peso inicial estimado
caso('peso_inicial_hombre', () => { __reset(HOMBRE); return ['sentadilla', 'press_banca', 'peso_muerto', 'curl_barra', 'press_militar'].map(id => [1, 3].map(l => { S.settings.level = ['', 'principiante', 'intermedio', 'avanzado'][l]; return estimateKg(id, 8); })); });
caso('peso_inicial_mujer', () => { __reset(MUJER, { level: 'intermedio' }); return ['sentadilla', 'press_banca', 'hip_thrust', 'remo_barra'].map(id => estimateKg(id, 10)); });
caso('peso_inicial_sin_perfil', () => { __reset(); return ['sentadilla', 'press_banca'].map(id => estimateKg(id, 10)); });
caso('items_construidos', () => { __reset(HOMBRE); return __clean(['sentadilla', 'plancha', 'curl_barra'].map(id => buildItem(id, 'musculo', 2))); });
// 14-20 · Nutrición
for (const goal of ['bajar', 'mantener', 'ganar']) caso(`nutricion_hombre_${goal}`, new Function(`__reset(${JSON.stringify(HOMBRE)}); nut().goal='${goal}'; return calcNutrition();`));
caso('nutricion_mujer_ganar', () => { __reset(MUJER); nut().goal = 'ganar'; return calcNutrition(); });
caso('nutricion_imc_bajo', () => { __reset({ age: 25, height: 180, weight: 55, sex: 'h' }); nut().goal = 'bajar'; return calcNutrition(); });
caso('nutricion_menor', () => { __reset({ age: 16, height: 170, weight: 60, sex: 'm' }); nut().goal = 'bajar'; return calcNutrition(); });
caso('nutricion_sin_perfil', () => { __reset(); return calcNutrition(); });
// 21-22 · Agua
caso('agua_sin_entreno', () => { __reset(HOMBRE); return waterGoal(); });
caso('agua_con_entreno', () => { __reset(HOMBRE); const r = __routine([buildItem('sentadilla', 'musculo', 2)]); __hist(r, { n: 1, fin: 0 }); return waterGoal(); });
// 23-28 · Planes semanales de PandarIA
caso('plan_musculo_3d', () => { __reset(HOMBRE); return __clean(generateProgram({ goal: 'musculo', days: 3, minutes: 60, level: 1, priorities: [], equip: S.settings.equip })); });
caso('plan_fuerza_4d', () => { __reset(HOMBRE); return __clean(generateProgram({ goal: 'fuerza', days: 4, minutes: 75, level: 2, priorities: [], equip: S.settings.equip })); });
caso('plan_grasa_2d', () => { __reset(MUJER); return __clean(generateProgram({ goal: 'grasa', days: 2, minutes: 45, level: 1, priorities: [], equip: S.settings.equip })); });
caso('plan_flexibilidad_3d', () => { __reset(MUJER); return __clean(generateProgram({ goal: 'flexibilidad', days: 3, minutes: 30, level: 1, priorities: [], equip: S.settings.equip })); });
caso('plan_salud_5d', () => { __reset({ age: 62, height: 170, weight: 78, sex: 'h' }); return __clean(generateProgram({ goal: 'salud', days: 5, minutes: 30, level: 3, priorities: [], equip: S.settings.equip })); });
caso('plan_casa_prioridad_gluteos', () => { __reset(MUJER); return __clean(generateProgram({ goal: 'musculo', days: 3, minutes: 50, level: 2, priorities: ['gluteos'], equip: ['man', 'est'] })); });
// 29-31 · Rutina por grupo muscular
caso('grupo_pecho_triceps', () => { __reset(HOMBRE); return __clean(generateByMuscles({ muscles: ['pecho', 'triceps'], goal: 'musculo', minutes: 50, level: 2, equip: S.settings.equip })); });
caso('grupo_piernas', () => { __reset(MUJER); return __clean(generateByMuscles({ muscles: ['cuadriceps', 'gluteos', 'isquios'], goal: 'fuerza', minutes: 60, level: 2, equip: S.settings.equip })); });
caso('grupo_espalda_20min', () => { __reset(HOMBRE); return __clean(generateByMuscles({ muscles: ['dorsales'], goal: 'musculo', minutes: 20, level: 1, equip: S.settings.equip })); });
// 32-35 · Sugerencias en vivo
const SUG = (o, ret) => `__reset(${JSON.stringify(HOMBRE)}, {level:'intermedio'}); const r = __routine([buildItem('press_banca','musculo',2), buildItem('sentadilla','musculo',2), buildItem('dominadas','musculo',2), buildItem('plancha','musculo',2)]);
  __hist(r, ${JSON.stringify(o)}); return r.items.map(it => it.sets.map((s, i) => __clean(suggestSet(r, it, i))))${ret || ''};`;
caso('sugerencia_tras_tope', new Function(SUG({ n: 4, tope: true })));
caso('sugerencia_sin_tope', new Function(SUG({ n: 4, tope: false })));
caso('sugerencia_tras_parar_30_dias', new Function(SUG({ n: 4, fin: 30 })));
caso('sugerencia_esfuerzo_alto', new Function(SUG({ n: 5, intensidad: 10 })));
// 36-38 · Análisis después de entrenar
caso('analisis_tras_sesion', () => { __reset(HOMBRE, { level: 'intermedio' }); const r = __routine([buildItem('press_banca', 'musculo', 2), buildItem('remo_barra', 'musculo', 2), buildItem('curl_barra', 'musculo', 2)]);
  __hist(r, { n: 6, tope: true }); const created = S.sessions.map(x => afterSession(x)).flat(); return __clean({ created, sugg: r.sugg, completions: r.completions }); });
caso('analisis_estancado', () => { __reset(HOMBRE, { level: 'intermedio' }); const r = __routine([buildItem('press_banca', 'musculo', 2), buildItem('sentadilla', 'musculo', 2)]);
  __hist(r, { n: 7, paso: 0, tope: false }); const created = S.sessions.map(x => afterSession(x)).flat(); return __clean({ created, sugg: r.sugg }); });
caso('analisis_poco_sueno', () => { __reset(HOMBRE, { level: 'intermedio' }); const r = __routine([buildItem('press_banca', 'musculo', 2)]);
  __hist(r, { n: 5 }); S.sessions.forEach(x => x.checkin = { sleep: 0, energy: 1, sore: 1 }); const created = S.sessions.map(x => afterSession(x)).flat(); return __clean(created.map(c => c.kind)); });
caso('series_por_musculo', () => { __reset(HOMBRE); const r = __routine(generateProgram({ goal: 'musculo', days: 3, minutes: 60, level: 2, priorities: [], equip: S.settings.equip })[0].items);
  __hist(r, { n: 6, cada: 2 }); return { sets: muscleSets(7), lagging: laggingMuscles() }; });
// 39-40 · Alternativas y orden de la sesión
caso('alternativas', () => { __reset(HOMBRE); return ['press_banca', 'sentadilla', 'dominadas', 'curl_barra'].map(id => alternatives(id).slice(0, 5)); });
caso('orden_de_la_sesion', () => { __reset(HOMBRE); const ids = ['curl_barra', 'plancha', 'sentadilla', 'ext_cuadriceps', 'press_banca', 'mov_articular', 'remo_barra'];
  return orderItems(ids.map(id => buildItem(id, 'musculo', 2))).map(x => x.exId); });
// 41-43 · Seguridad del perfil
caso('bloqueo_lesion_rodilla', () => { __reset({ age: 30, height: 175, weight: 75, sex: 'h', injuries: ['rodilla'] }); return Object.keys(EX).filter(id => profileBlocks(id)).sort(); });
caso('bloqueo_edad_65', () => { __reset({ age: 65, height: 170, weight: 75, sex: 'm' }); return Object.keys(EX).filter(id => profileBlocks(id)).sort(); });
caso('bloqueo_imc_32', () => { __reset({ age: 40, height: 170, weight: 93, sex: 'h' }); return { bmi: bmi(), blocked: Object.keys(EX).filter(id => profileBlocks(id)).sort() }; });
// 44-45 · Periodización y descansos
caso('periodizacion_6_semanas', () => { __reset(HOMBRE); const r = __routine([buildItem('sentadilla', 'musculo', 2)]); const out = [];
  for (let w = 0; w < 7; w++) { S.periodStart = __NOW - w * 7 * DAY; out.push([periodPhase(r), phaseInfo()]); } return out; });
caso('descansos_preajustes', () => { __reset(HOMBRE); const it = buildItem('sentadilla', 'fuerza', 2); [0.5, 0.7].forEach(f => it.sets.unshift({ t: 'c', kg: 40 * f, reps: 5 }));
  const out = [restPreset(it, 'warm'), it.sets.map((s, i) => restFor(it, i)), restPreset(it, 'end'), it.sets.map((s, i) => restFor(it, i)), restPreset(it, 'same'), it.sets.map((s, i) => restFor(it, i))]; return out; });
// 46-47 · Informes y metas
caso('informe_semanal', () => { __reset(HOMBRE); const r = __routine([buildItem('press_banca', 'musculo', 2), buildItem('sentadilla', 'musculo', 2)]); __hist(r, { n: 8, cada: 2 });
  return __clean({ report: weekReport(weekKey(__NOW - 7 * DAY)), streak: streakWeeks(), records: records() }); });
caso('equilibrio_muscular', () => { __reset(HOMBRE); const r = __routine([buildItem('press_banca', 'musculo', 2), buildItem('press_inclinado_barra', 'musculo', 2), buildItem('curl_barra', 'musculo', 2)]); __hist(r, { n: 8, cada: 2 });
  return __clean(balanceReport(28)); });
// 48-49 · Ayuno
caso('ayuno_consejos_exigente', () => { __reset({ age: 30, height: 175, weight: 75, sex: 'h', fitness: 'sedentario' }); const f = nut().fast; f.plan = '20:4'; f.screened = true; nut().goal = 'ganar'; return fastAdvice(); });
caso('ayuno_consejos_activo', () => { __reset(HOMBRE); const f = nut().fast; f.plan = '16:8'; f.screened = true; f.active = { start: __NOW - 26 * 3600000, goalH: 16 }; nut().goal = 'bajar'; return fastAdvice(); });
// 50 · Consejos del día
caso('consejo_del_dia', () => { __reset(HOMBRE); const out = []; for (let d = 0; d < 5; d++) { __setNow(__NOW + d * DAY); out.push(tipOfDay('nut'), tipOfDay('entreno')); } __setNow(__NOW); return out; });

/* ---------- Ejecución ---------- */
const resultados = {}, fallos = [];
const { w, errores, cerrar } = abrir();
await espera(1500);
w.eval(AYUDAS());
for (const [nombre, fn] of casos) {
  try {
    const body = `(${fn.toString()})()`;
    resultados[nombre] = JSON.parse(JSON.stringify(w.eval(body) ?? null));
  } catch (e) { fallos.push(`${nombre}: error al ejecutar → ${e.message}`); }
}
const BIB = JSON.parse(w.eval(`JSON.stringify({rules:KB_RULES, src:KB_SRC, lic:Object.keys(KB_LIC), ev:Object.keys(KB_EV), areas:Object.keys(KB_AREAS), ver:KB_VER, log:KB_LOG, frozen:KB_RULES.every(r=>typeof r.v!=='object'||Object.isFrozen(r.v)), why:KB_WHY.map(x=>x[1]), sugg:Object.values(KB_SUGG)})`));
cerrar();

/* ---------- Comprobaciones que no dependen de resultados guardados ---------- */
const comprobaciones = [];
const comprobar = (nombre, ok, detalle) => { comprobaciones.push(nombre); if (!ok) fallos.push(`${nombre}: ${detalle || 'falló'}`); };
comprobar('la app arranca sin errores', !errores.length, errores.join(' | '));

// Copia de la 0.7: se carga, se migra sin perder datos y se guarda una copia previa
if (fs.existsSync(COPIA07)) {
  const raw = fs.readFileSync(COPIA07, 'utf8'), d0 = JSON.parse(raw);
  const a = abrir({ 'pandaria-fit-v1': raw });
  await espera(1500);
  const st = JSON.parse(a.w.eval('JSON.stringify(S)'));
  const keep = k => JSON.stringify(st[k]) === JSON.stringify(d0[k]);
  comprobar('copia 0.7: rutinas intactas', keep('routines'));
  comprobar('copia 0.7: historial intacto', keep('sessions'));
  comprobar('copia 0.7: medidas, perfil, metas y plan intactos', ['measures', 'profile', 'goals', 'plan', 'nutri', 'customEx', 'achievements'].every(keep));
  comprobar('copia 0.7: ajustes conservados', Object.keys(d0.settings).every(k => JSON.stringify(st.settings[k]) === JSON.stringify(d0.settings[k])));
  comprobar('copia 0.7: sube a la versión de datos actual', st.v === a.w.eval('typeof DATA_VER !== "undefined" ? DATA_VER : null'), `v=${st.v}`);
  comprobar('copia 0.7: guarda una copia antes de migrar', a.w.localStorage.getItem('pandaria-fit-antes-v' + (d0.v || 1)) === raw);
  // la app sigue funcionando con esos datos: todas las pestañas se dibujan
  let tabsOk = true, tabErr = '';
  for (const t of ['rutinas', 'explorar', 'nutricion', 'historial', 'ajustes']) { try { a.w.eval(`TAB='${t}'; render();`); } catch (e) { tabsOk = false; tabErr += t + ': ' + e.message + ' '; } }
  comprobar('copia 0.7: todas las pestañas se abren', tabsOk && !a.errores.length, tabErr + a.errores.join(' | '));
  // importarla a mano desde Ajustes también la migra
  a.w.eval(`S=DEF(); save(true); confirmBox=o=>o.ok(); importText(${JSON.stringify(raw)});`);
  const st2 = JSON.parse(a.w.eval('JSON.stringify(S)'));
  comprobar('copia 0.7: importar desde Ajustes conserva todo', JSON.stringify(st2.sessions) === JSON.stringify(d0.sessions) && JSON.stringify(st2.routines) === JSON.stringify(d0.routines) && st2.v === st.v);
  // abrir de nuevo no vuelve a migrar ni pisa la copia previa
  const raw2 = a.w.localStorage.getItem('pandaria-fit-v1'); a.cerrar();
  const b = abrir({ 'pandaria-fit-v1': raw2, ['pandaria-fit-antes-v' + (d0.v || 1)]: raw });
  await espera(1500);
  comprobar('copia 0.7: una segunda carga no cambia nada', b.w.eval('JSON.stringify(S.sessions)') === JSON.stringify(d0.sessions) && b.w.localStorage.getItem('pandaria-fit-antes-v' + (d0.v || 1)) === raw);
  b.cerrar();
} else fallos.push('falta tests/copia-0.7.json');


/* ---------- Biblioteca de evidencia ---------- */
{
  const html = fs.readFileSync(HTML, 'utf8');
  const ini = html.indexOf('/* ============ PandarIA · BIBLIOTECA DE EVIDENCIA'), fin = html.indexOf('/* ============ PandarIA · MOTOR DE ENTRENAMIENTO');
  const fuera = html.slice(0, ini) + html.slice(fin);
  const ids = BIB.rules.map(r => r.id), hoy = new Date().toISOString().slice(0, 10);
  const mal = (f) => BIB.rules.filter(f).map(r => r.id).join(', ');
  comprobar('biblioteca: sin reglas repetidas', new Set(ids).size === ids.length, ids.filter((x, i) => ids.indexOf(x) !== i).join(', '));
  comprobar('biblioteca: cada regla tiene nombre, texto, uso, población, valor y versión', !mal(r => !r.n || !r.t || !r.usa || !r.pob || r.v == null || !r.desde), mal(r => !r.n || !r.t || !r.usa || !r.pob || r.v == null || !r.desde));
  comprobar('biblioteca: cada regla tiene fuente y la fuente existe', !mal(r => !r.src || !r.src.length || r.src.some(s => !BIB.src[s])), mal(r => !r.src || !r.src.length || r.src.some(s => !BIB.src[s])));
  comprobar('biblioteca: cada fuente tiene título, autor, año y tipo de licencia válido', Object.entries(BIB.src).every(([k, s]) => s.n && s.a && s.y && BIB.lic.includes(s.lic) && (s.lic === 'propio' || /^https:\/\//.test(s.url))), Object.entries(BIB.src).filter(([k, s]) => !(s.n && s.a && s.y && BIB.lic.includes(s.lic) && (s.lic === 'propio' || /^https:\/\//.test(s.url)))).map(x => x[0]).join(', '));
  // regla de licencias: una regla nunca puede declarar un uso más libre que el de sus fuentes
  const orden = { propio: 0, consejo: 1, pd: 2 };
  const libre = r => r.lic === 'pd' && r.src.some(s => BIB.src[s].lic !== 'pd');
  comprobar('biblioteca: tipo de licencia válido y nunca más libre que su fuente', !mal(r => !BIB.lic.includes(r.lic) || libre(r) || (r.lic === 'consejo' && r.src.every(s => BIB.src[s].lic === 'propio'))), mal(r => !BIB.lic.includes(r.lic) || libre(r)));
  comprobar('biblioteca: nivel de evidencia válido', !mal(r => !BIB.ev.includes(r.ev)), mal(r => !BIB.ev.includes(r.ev)));
  comprobar('biblioteca: área válida', !mal(r => !BIB.areas.includes(r.area)), mal(r => !BIB.areas.includes(r.area)));
  comprobar('biblioteca: ninguna regla con la revisión vencida', !mal(r => !/^\d{4}-\d\d-\d\d$/.test(r.rev) || r.rev <= hoy), mal(r => !/^\d{4}-\d\d-\d\d$/.test(r.rev) || r.rev <= hoy));
  comprobar('biblioteca: los valores no se pueden modificar desde el código', BIB.frozen);
  comprobar('biblioteca: el historial coincide con la versión', BIB.log.length && BIB.log[BIB.log.length - 1].v === BIB.ver);
  const usados = [...fuera.matchAll(/kb\('([^']+)'\)/g)].map(m => m[1]);
  const desconocidos = [...new Set(usados.concat(BIB.why, BIB.sugg))].filter(x => !ids.includes(x));
  comprobar('biblioteca: el código solo pide reglas que existen', !desconocidos.length, desconocidos.join(', '));
  const sinUso = ids.filter(id => !fuera.includes(`'${id}'`) && !fuera.includes(`"${id}"`) && !BIB.why.includes(id) && !BIB.sugg.includes(id));
  comprobar('biblioteca: cada regla se usa en la app', !sinUso.length, sinUso.join(', '));
}

/* ---------- Comparación con los resultados guardados ---------- */
if (ACTUALIZAR) {
  fs.writeFileSync(ESPERADO, JSON.stringify(resultados, null, 1) + '\n');
  console.log(`Guardados ${Object.keys(resultados).length} resultados en tests/resultados.json`);
} else if (!fs.existsSync(ESPERADO)) fallos.push('falta tests/resultados.json (ejecuta con --actualizar)');
else {
  const esp = JSON.parse(fs.readFileSync(ESPERADO, 'utf8'));
  for (const k of Object.keys(esp)) if (!(k in resultados)) fallos.push(`${k}: el caso ya no existe`);
  for (const [k, v] of Object.entries(resultados)) {
    if (!(k in esp)) { fallos.push(`${k}: caso nuevo sin resultado guardado`); continue; }
    const a = JSON.stringify(v), b = JSON.stringify(esp[k]);
    if (a !== b) { let i = 0; while (a[i] === b[i]) i++; fallos.push(`${k}: el resultado cambió\n   antes:  …${b.slice(Math.max(0, i - 60), i + 80)}…\n   ahora:  …${a.slice(Math.max(0, i - 60), i + 80)}…`); }
  }
}

console.log(`\n${casos.length} casos de algoritmos · ${comprobaciones.length} comprobaciones de datos`);
if (fallos.length) { console.log(`\n✗ ${fallos.length} fallo(s):\n- ` + fallos.join('\n- ')); process.exit(1); }
console.log('✓ Todo correcto');
