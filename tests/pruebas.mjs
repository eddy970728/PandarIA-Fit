// Pruebas automáticas de PandarIA Fit
// Cargan www/index.html en un navegador simulado (jsdom), con fecha y azar fijos, y comprueban que
// los algoritmos dan exactamente los mismos resultados que los guardados en tests/resultados.json.
//   node tests/pruebas.mjs                 → compara (falla si algo cambió)
//   node tests/pruebas.mjs --actualizar    → guarda los resultados actuales como los correctos
//                                            (solo cuando Eddy aprueba un cambio a propósito)
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
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
window.__dia = (items) => { const n = nd(), k = dayKey(); n.diario[k] = items.map(([id, gr, m, t], i) => { const f = alimGet(id); return Object.assign(alimMac(f, gr), { id: 'd' + i, fid: id, n: f.n, gr, m, t: t ?? ${NOW} - 3600000 }); }); return k; };
window.__reset = (profile, settings) => {
  NUT_DAY = null;
  __seed(7); __setNow(${NOW});
  S = DEF(); S.settings.onboarded = true; Object.assign(S.settings, settings || {});
  S.profile = Object.assign({ injuries: [] }, profile || {});
  if (S.profile.weight) S.measures.push({ id: 'm0', date: ${NOW} - 90 * DAY, peso: S.profile.weight });
  loadExercises([]); TPLM_reset();
};
// Historial sintético: n sesiones de una rutina, una cada 'cada' días, terminando hace 'fin' días.
// Las cargas suben 'paso' kg por sesión; en la última se llega al tope del rango si 'tope'.
window.__hist = (r, o) => {
  o = Object.assign({ n: 6, cada: 3, fin: 1, base: 0.6, paso: 2.5, tope: true, intensidad: 7, rir: 2 }, o);
  for (let k = 0; k < o.n; k++) {
    const end = ${NOW} - (o.fin + (o.n - 1 - k) * o.cada) * DAY, last = k === o.n - 1;
    const items = r.items.map(it => { const ex = getEx(it.exId); return { exId: it.exId, note: '', sets: it.sets.filter(s => s.t !== 'c').map(s => {
      if (ex.mode === 't') return { t: 'n', time: (+s.time || 30) + k * 5, done: true };
      const reps = it.range ? (last && o.tope ? it.range[1] : it.range[0] + (k % 2)) : (+s.reps || 10);
      const kg = ex.mode === 'p' ? Math.round(((+s.kg || 20) * o.base + k * o.paso) * 2) / 2 : null;
      return { t: 'n', kg, reps, done: true, rir: o.rir }; }) }; });
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
caso('sugerencia_esfuerzo_alto_al_fallo', new Function(SUG({ n: 5, intensidad: 10, rir: 0 })));
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

// 52-58 · Diario de comidas
caso('alimentos_base', () => { const L = Object.values(ALIM), cats = {}; L.forEach(f => cats[f.cat] = (cats[f.cat] || 0) + 1);
  return { n: L.length, cats, muestra: ['09003', '01077', '05064', '18069', '20045', '16015', '36403', '04053'].map(id => { const f = ALIM[id]; return [f.n, f.k, f.p, f.c, f.g, f.fl, f.por]; }) }; });
caso('alimentos_busqueda', () => { __reset(HOMBRE); const out = {};
  ['palta', 'aguacate', 'frijoles', 'porotos negros', 'fresa', 'frutilla', 'patata', 'papa', 'elote', 'choclo', 'yuca', 'pollo', 'queso', 'jugo naranja', 'arroz', 'platano', 'cacahuate', 'zumo', 'jitomate', 'betabel']
    .forEach(q => out[q] = alimSearch(q).slice(0, 5).map(f => f.n)); return out; });
caso('alimentos_preferencias', () => { __reset(HOMBRE); const ids = ['01077', '18069', '09040', '05064', '15121', '15270', '16087', '12061', '16426', '01123', '19296', '36403'];
  const out = {}; [['todo', []], ['vegetariano', []], ['vegano', []], ['todo', ['L', 'G']], ['todo', ['M', 'N', 'C', 'P']]].forEach(([d, e]) => { nd().prefs = { dieta: d, evitar: e }; out[d + ':' + e.join('')] = ids.map(id => alimConflicts(ALIM[id])); }); return out; });
caso('alimentos_receta', () => { __reset(HOMBRE); const r = { id: 'r1', n: 'Lentejas', rac: 2, items: [{ f: '16070', g: 400 }, { f: '11124', g: 100 }, { f: '04053', g: 20 }] }; nd().recetas.push(r);
  const f = alimGet('r1'); return { k: f.k, p: f.p, c: f.c, g: f.g, fl: f.fl, por: f.por, racion: alimMac(f, f.por[0][1]) }; });
caso('alimentos_propio', () => { __reset(HOMBRE); A.alNew = A.alNew; nd().alim.push({ id: 'p1', n: 'Barrita', k: 400, p: 25, c: 45, g: 12.5, f: null, a: null, na: null, fl: 'MV', por: [['1 barrita', 40]] });
  const f = alimGet('p1'); return [f.cat, f.propio, alimMac(f, 40), alimSearch('barri').map(x => x.n)]; });
caso('alimentos_totales_dia', () => { __reset(HOMBRE); const n = nd(), k = dayKey();
  [['09040', 236, 'desayuno'], ['01077', 244, 'desayuno'], ['20045', 180, 'almuerzo'], ['05064', 172, 'almuerzo'], ['04053', 13.5, 'almuerzo']].forEach(([id, gr, m], i) => { const f = alimGet(id); (n.diario[k] = n.diario[k] || []).push(Object.assign(alimMac(f, gr), { id: 'e' + i, fid: id, n: f.n, gr, m, t: 0 })); });
  return { tot: dayTotals(k), recientes: alimRecent().map(f => f.n) }; });
caso('alimentos_modo_habitos', () => { __reset(HOMBRE); nut().habitos = true; const k = dayKey(), n = nd();
  ['09040', '11090', '05064'].forEach((id, i) => { const f = alimGet(id); (n.diario[k] = n.diario[k] || []).push(Object.assign(alimMac(f, 100), { id: 'h' + i, fid: id, n: f.n, gr: 100, m: i ? 'almuerzo' : 'desayuno', t: 0 })); });
  const html = diarioCard(); return { numeros: /\d\s?kcal/.test(html), resumen: habitosResumen(k).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }; });

// 59-64 · Etapa 4: reglas que cambian resultados
caso('ritmos_nutricion', () => { __reset(HOMBRE); const out = {}; for (const g of ['bajar', 'ganar']) for (const r of ['lento', 'normal', 'rapido']) { nut().goal = g; nut().ritmo = r; const c = calcNutrition(); out[g + ':' + r] = [c.kcal, c.prot, c.carbs]; }
  nut().goal = 'bajar'; nut().ritmo = 'rapido'; S.profile.weight = 120; S.measures = [{ id: 'm', date: __NOW - 90 * DAY, peso: 120 }]; out.grande = calcNutrition().kcal; return out; });
caso('ajuste_automatico', () => { __reset(HOMBRE); nut().goal = 'mantener'; const n = nd();
  for (let i = 1; i <= 14; i++) { const k = dayKey(__NOW - i * DAY); n.diario[k] = [{ id: 'a' + i, fid: '20045', n: 'Arroz', gr: 500, m: 'almuerzo', k: 1300, p: 0, c: 0, g: 0, t: 0 }, { id: 'b' + i, fid: '05064', n: 'Pollo', gr: 400, m: 'cena', k: 1000, p: 0, c: 0, g: 0, t: 0 }]; }
  S.measures = [{ id: 'w1', date: __NOW - 15 * DAY, peso: 80.6 }, { id: 'w2', date: __NOW - 8 * DAY, peso: 80.3 }, { id: 'w3', date: __NOW - 1 * DAY, peso: 80 }];
  const c = calcNutrition(); const raro = (() => { S.measures[2].peso = 70; return calcNutrition().adapt; })(); return { kcal: c.kcal, tdee: c.tdee, adapt: c.adapt, raro, trend: weightTrend() }; });
caso('agua_por_tamano', () => { const out = {}; [['h', 50], ['h', 80], ['h', 130], ['m', 50], ['m', 70], ['m', 110], ['x', 75]].forEach(([sex, w]) => { __reset({ age: 30, height: 170, weight: w, sex }); out[sex + w] = waterGoal(); }); return out; });
caso('dia_con_poco_descanso', () => { __reset(HOMBRE, { level: 'intermedio' }); const r = __routine([buildItem('press_banca', 'musculo', 2), buildItem('dominadas', 'musculo', 2)]); __hist(r, { n: 4, tope: true });
  const normal = r.items.map(it => suggestSet(r, it, 0)); WK_AJUSTE = { f: kb('recuperacion.ajuste').f, why: 'Hoy llegas con poco descanso: 10 % menos de carga', rid: r.id, t: __NOW };
  const suave = r.items.map(it => suggestSet(r, it, 0)); const otra = suggestSet(Object.assign({}, r, { id: 'otra' }), r.items[0], 0); WK_AJUSTE = null; return __clean({ normal, suave, otra }); });
caso('estado_de_recuperacion', () => { __reset(HOMBRE); const r = __routine([buildItem('press_banca', 'musculo', 2), buildItem('remo_barra', 'musculo', 2)]); const out = { nada: recoveryState(r) };
  __hist(r, { n: 1, fin: 0.5, intensidad: 10 }); out.reciente = recoveryState(r); S.sessions.forEach(x => x.checkin = { sleep: 0, energy: 0, sore: 1 }); __hist(r, { n: 2, fin: 0.3 }); S.sessions.forEach(x => x.checkin = { sleep: 0, energy: 1, sore: 1 }); out.mal = recoveryState(r); return out; });
caso('alternativas_sin_barra_marcada', () => { __reset(HOMBRE); S.settings.equip = ['pc', 'est']; return ['press_banca', 'sentadilla', 'curl_barra', 'peso_muerto'].map(id => alternatives(id).slice(0, 3)); });

// 65-71 · Etapa 5: suplementos, calidad de la dieta, menús, agua, ayuno y modo viaje
caso('agua_bebidas_y_cafeina', () => { __reset(HOMBRE); const k = __dia([['14209', 237, 'desayuno'], ['01077', 244, 'desayuno'], ['14148', 355, 'almuerzo'], ['14003', 356, 'cena'], ['20045', 200, 'almuerzo'], ['14210', 30, 'merienda']]); nut().water[k] = 500;
  return { bebidas: diaryDrinks(k), total: waterToday(k), adulto: cafLimit(), embarazo: (nutSalud().embarazo = true, cafLimit()), menor: (S.profile.age = 16, cafLimit()) }; });
caso('agua_entreno_largo', () => { const out = {}; [0, 45, 60, 90, 120, 200].forEach(min => { __reset(HOMBRE); if (min) S.sessions.push({ id: 's', routineId: 'r', start: __NOW - min * 60000 - 60000, end: __NOW - 60000, items: [] }); out[min] = waterGoal(); }); return out; });
caso('calidad_de_la_dieta', () => { __reset(HOMBRE); const k = __dia([['20038', 45, 'desayuno'], ['01077', 244, 'desayuno'], ['05064', 172, 'almuerzo'], ['20045', 200, 'almuerzo'], ['07029', 120, 'cena'], ['18069', 100, 'cena'], ['16070', 198, 'cena']]); return dietQuality(k); });
caso('menu_de_ejemplo', () => { const out = {}; for (const [d, e] of [['todo', []], ['vegetariano', []], ['vegano', []], ['todo', ['L', 'G']], ['todo', ['P', 'C', 'H']]]) { __reset(HOMBRE); nd().prefs = { dieta: d, evitar: e }; const c = calcNutrition(); const m = buildMenu(c, 20261112);
  const ids = m.meals.flatMap(M => M.items.map(it => it.id)); out[d + ':' + e.join('')] = { kcal: Math.round(m.T.k), objetivo: c.kcal, prot: Math.round(m.T.p), conflictos: ids.filter(id => alimConflicts(ALIM[id]).length), comidas: m.meals.map(M => M.m + ':' + M.items.map(it => it.id + '/' + it.gr).join(',')) }; } return out; });
caso('modo_viaje', () => { __reset(HOMBRE, { level: 'intermedio', equip: EQUIP_GYM.slice() }); const ids = ['press_banca', 'remo_barra', 'peso_muerto', 'press_militar', 'curl_barra', 'jalon_pecho', 'flexiones'].filter(id => EX[id]);
  const out = {}; for (const eq of ['pc', 'bnd', 'hotel']) { const used = []; out[eq] = ids.map(id => { const it = buildItem(id, 'musculo', 2); const x = travelItem(it, VIAJE_EQ[eq], used); return [id, x.exId, x.sets.map(s => [s.kg, s.reps, s.time])[0]]; }); } return out; });
caso('ayuno_desde_el_diario', () => { __reset(HOMBRE); __dia([['20038', 45, 'desayuno', __NOW - 10 * 3600000], ['14209', 237, 'desayuno', __NOW - 2 * 3600000], ['05064', 172, 'almuerzo', __NOW - 5 * 3600000]]); return { ultima: (__NOW - lastMealTs()) / 3600000, ventana: fastWindowHtml().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }; });
caso('suplementos_pantalla', () => { __reset(HOMBRE); const txt = () => SCREENS.suplementos({}).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); const sano = txt(); Object.assign(nutSalud(), { embarazo: true, presion: true, rinon: true }); const avisos = txt(); S.profile.age = 16; const menor = txt();
  return { dosis: (sano.match(/\d[\d,–]* (?:a \d+ )?(?:g|mg)[^.]*?(?:día|kg|ti\))/g) || []).slice(0, 8), avisos: (avisos.match(/(En embarazo|Con la presión|Con una enfermedad del riñón)[^.]*\./g) || []), menor: /no da dosis/.test(menor) && !/3 a 5 g/.test(menor) }; });

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
const ALI = JSON.parse(w.eval(`JSON.stringify({list:Object.values(ALIM), cats:Object.keys(ALIM_CATS), fl:Object.keys(ALIM_FL)})`));
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


/* ---------- Copia en Google Drive: el contenido de la copia y la bienvenida sin cuenta ---------- */
if (fs.existsSync(COPIA07)) {
  const a = abrir({ 'pandaria-fit-v1': fs.readFileSync(COPIA07, 'utf8') });
  await espera(900);
  const r = JSON.parse(a.w.eval(`(()=>{ S.settings.cloud={sub:'123',email:'a@b.c',name:'A',at:1}; const env=cloudEnvelope(); const antes=JSON.stringify({r:S.routines,s:S.sessions,m:S.measures,p:S.profile,n:S.nutri});
    const env2=JSON.parse(JSON.stringify(env)); S.routines=[]; S.sessions=[]; cloudApply(env2,'f1');
    const despues=JSON.stringify({r:S.routines,s:S.sessions,m:S.measures,p:S.profile,n:S.nutri});
    return JSON.stringify({sinCuenta: env.data.settings.cloud===undefined, app: env.app, igual: antes===despues, sigue: S.settings.cloud.sub==='123' && S.settings.cloud.fileId==='f1', resumen: env.resumen.entrenos===env.data.sessions.length,
      pasos: obPasos({}).join(',') }); })()`));
  comprobar('copia de Drive: no incluye los datos de la cuenta', r.sinCuenta && r.app === 'PandarIA Fit');
  comprobar('copia de Drive: guardar y recuperar devuelve los mismos datos', r.igual, 'los datos cambiaron');
  comprobar('copia de Drive: al recuperar sigue conectada la misma cuenta', r.sigue);
  comprobar('copia de Drive: el resumen cuenta bien los entrenos', r.resumen);
  comprobar('bienvenida sin Google: no muestra el paso de la cuenta', !r.pasos.includes('cuenta') && r.pasos.startsWith('hola,nombre,perfil,equipo'), r.pasos);
  a.cerrar();
}

/* ---------- Recorrido de pantallas: toca los botones de cada pestaña en español y en inglés ---------- */
// Cada pestaña se abre en un navegador simulado nuevo; en español también se tocan los botones de lo que se abre.
if (fs.existsSync(COPIA07)) {
  const PELIGRO = /wipe|del|Del|Remove|import|export|Export|share|Share|Url|Mail|upd(Download|Open)|hcPrivacy|Discard|kbUrl|copy|Copy|photo|Photo|mPhoto|backup|Backup|xjump|mFile/;
  for (const lang of ['es', 'en']) {
    let toques = 0; const fallosR = [], sinTraducir = new Set();
    for (const t of ['rutinas', 'explorar', 'nutricion', 'agua', 'ayuno', 'historial', 'ajustes']) { // 1.3: Nutrición › Agua y la pestaña Ayuno
      const a = abrir({ 'pandaria-fit-v1': fs.readFileSync(COPIA07, 'utf8') });
      await espera(900);
      const w = a.w;
      w.history.back = () => {}; w.history.go = () => {}; w.open = () => null;
      let ultimo = null; w.addEventListener('error', e => { ultimo = e.message || String(e.error); });
      // en inglés se apunta todo texto que, después de traducir, sigue pareciendo español
      if (lang === 'en') w.eval(`const __tt=trText; window.__ES=new Set(); window.trText=t=>{ const r=__tt(t); const o=(r==null?t:r).replace(/\\s+/g,' ').trim();
        if (o.length>1 && !/^(Jäger|Rosé)|doi\\.org|www\\.|https?:/.test(o) && (/[áéíóúñ¿¡]/i.test(o.replace(/Jäger|Rosé|Pérez|choripán|Choripán|Jesús/g,'')) || /(^|[^\\wÀ-ÿ])(de|del|las|los|para|con|que|una|sin|más|tus|hoy|semana|entreno|rutina|ejercicio|serie|toca|cada|pero|hay|esta|este|también|tienes|puedes|aquí)([^\\wÀ-ÿ]|$)/.test(o))) __ES.add(o); return r; };`);
      w.eval(`S.settings.lang=${JSON.stringify(lang)}; applyLang(); const __f=alimGet('05064'); nd().diario[dayKey()]=[Object.assign(alimMac(__f,150),{id:'x1',fid:'05064',n:__f.n,gr:150,m:'almuerzo',t:Date.now()-3600000})]; save(true); window.__SNAP=JSON.stringify(S);`);
      // 1.8.1: Explorar es una capa de Rutinas y Ayuno una sección de Nutrición; los bloques desplegables se recorren abiertos
      const reset = () => w.eval(`MODALS.length=0; renderModals(); LAYERS.length=0; S=JSON.parse(__SNAP); S.settings.orden181=1; S.settings.fold=Object.fromEntries([...Object.keys(FOLD_DEF),...MEALS.map(m=>'meal-'+m[0])].map(k=>[k,true]));
        TAB=${JSON.stringify(['agua', 'ayuno'].includes(t) ? 'nutricion' : t === 'explorar' ? 'rutinas' : t)}; NSEG=${JSON.stringify(['agua', 'ayuno'].includes(t) ? t : 'comida')}; render(); ${t === 'explorar' ? 'A.openExplorar();' : ''}`);
      const botones = () => [...w.document.querySelectorAll('[data-a]')].map(e => [e.dataset.a, e.dataset.v || '']).filter(([x]) => !PELIGRO.test(x) && x !== 'tab');
      const tocar = (x, v) => { const e = [...w.document.querySelectorAll('[data-a]')].find(e => e.dataset.a === x && (e.dataset.v || '') === v); if (!e) return false; ultimo = null; const n0 = a.errores.length;
        try { e.click(); } catch (er) { ultimo = er.message; } if (!ultimo && a.errores.length > n0) ultimo = a.errores[a.errores.length - 1]; return true; };
      const vistos = new Set(); reset();
      for (const [x, v] of botones()) {
        if (vistos.has(x + v)) continue; vistos.add(x + v);
        reset(); if (!tocar(x, v)) continue; toques++;
        if (ultimo) { fallosR.push(`${t} › ${x}(${v}): ${ultimo}`); continue; }
        if ((lang !== 'es' && x !== 'ajGrupo') || !w.eval('LAYERS.length+MODALS.length')) continue;
        for (const [y, z] of botones().filter(([y]) => y !== 'back' && y !== 'closeModal' && y !== 'cbm').slice(0, 12)) {
          if (vistos.has(x + '>' + y + z)) continue; vistos.add(x + '>' + y + z);
          reset(); tocar(x, v); if (!tocar(y, z)) continue; toques++;
          if (ultimo) fallosR.push(`${t} › ${x}(${v}) › ${y}(${z}): ${ultimo}`);
        }
      }
      await espera(200);
      if (lang === 'en') w.eval('[...__ES]').forEach(x => sinTraducir.add(`${t}: ${x}`));
      a.cerrar();
    }
    console.log(`Recorrido en ${lang === 'es' ? 'español' : 'inglés'}: ${toques} botones tocados`);
    if (lang === 'en') comprobar(`en inglés no queda texto en español (${sinTraducir.size} encontrados)`, !sinTraducir.size, [...sinTraducir].slice(0, 8).join(' | '));
    comprobar(`recorrido de pantallas en ${lang === 'es' ? 'español' : 'inglés'} sin errores (${toques} botones)`, !fallosR.length && toques > 150, fallosR.slice(0, 5).join(' | ') || `solo ${toques} botones`);
  }
}

/* ---------- Métodos especiales y zonas sensibles (1.0) ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE, {level:'intermedio'}); const out={};
    const mk=()=>({id:'rm',name:'M',pandaria:true,goal:'musculo',items:[buildItem('press_banca','musculo',2),buildItem('sentadilla','musculo',2),buildItem('curl_man','musculo',2),buildItem('remo_man','musculo',2)]});
    const ref=JSON.stringify(mk().items.map(i=>i.sets));
    for (const k of Object.keys(METODOS)){ const x=mk(); x.method=k; const n=applyMethod(x); const marcas=x.items.map(it=>it.sets.map(s=>s.m||s.t).join(','));
      const sentadilla=x.items[1].sets.some(s=>s.m==='drop'||s.m==='mini');
      x.method=null; applyMethod(x); out[k]={n, marcas, vuelve: JSON.stringify(x.items.map(i=>i.sets))===ref, sentadilla}; }
    S.settings.level='principiante'; const b=mk(); b.method='descendentes'; out.principiante=applyMethod(b); S.settings.level='intermedio';
    const d=mk(); d.method='descendentes'; applyMethod(d); const it=d.items[0]; const k0=it.sets.findIndex(s=>s.m==='drop');
    out.bajada=[suggestSet(d,it,k0-1).kg, suggestSet(d,it,k0).kg];
    const bb=mk(); bb.method='bilbo'; applyMethod(bb); const ib=bb.items[0], kb0=ib.sets.findIndex(s=>s.m==='bilbo');
    S.sessions.push({id:'sb',routineId:'rm',start:__NOW-90000000,end:__NOW-86400000,items:[{exId:ib.exId,sets:[{t:'n',m:'bilbo',kg:40,reps:22,done:true}]}]});
    out.bilboSube=suggestSet(bb,ib,kb0).kg;
    S.sessions[S.sessions.length-1].items[0].sets[0].reps=12; out.bilboReinicia=suggestSet(bb,ib,kb0).kg;
    S.profile.injuries=['codo']; out.codo=['fondos_pecho','press_frances','curl_predicador'].map(id=>profileBlocks(id)); out.codoCurl=buildItem('curl_man','musculo',2).sets[0].t;
    S.profile.injuries=['cadera']; out.cadera=['sentadilla_sumo','box_jump'].map(id=>profileBlocks(id));
    out.etiqueta=/No comprobado que sea mejor/.test(metodoCard({method:'bilbo'},''))&&/Evidencia limitada/.test(metodoCard({method:'bilbo'},''));
    return JSON.stringify(out); })()`));
  const metodos = ['superseries', 'descendentes', 'restpause', 'myoreps', 'piramide', 'cluster', 'gvt', 'bilbo'];
  comprobar('métodos: cada método cambia la rutina y se puede quitar sin dejar rastro', metodos.every(k => r[k] && r[k].n > 0 && r[k].vuelve), metodos.filter(k => !r[k] || !(r[k].n > 0) || !r[k].vuelve).join(', '));
  comprobar('métodos: los que llegan cerca del fallo no tocan la sentadilla con barra', !['descendentes', 'restpause', 'myoreps'].some(k => r[k].sentadilla));
  comprobar('métodos: los que llegan cerca del fallo no se aplican a principiantes', r.principiante === -1, `devolvió ${r.principiante}`);
  comprobar('métodos: cada bajada de las series descendentes quita un 20 %', r.bajada[1] < r.bajada[0] && r.bajada[1] >= r.bajada[0] * 0.7, r.bajada.join(' → '));
  comprobar('método Bilbo: con 15 o más repeticiones sube 2,5 kg; con menos vuelve al 50 %', r.bilboSube === 42.5 && r.bilboReinicia < 40, `${r.bilboSube} / ${r.bilboReinicia}`);
  comprobar('métodos: llevan la etiqueta de que no está comprobado que sean mejores', r.etiqueta);
  comprobar('codo: PandarIA evita fondos, press francés y curl predicador, y añade calentamiento en brazos', r.codo.every(Boolean) && r.codoCurl === 'c', JSON.stringify(r.codo) + ' ' + r.codoCurl);
  comprobar('cadera: PandarIA evita sentadilla sumo y saltos', r.cadera.every(Boolean));
  a.cerrar();
}

/* ---------- Base de alimentos ---------- */
{
  const L = ALI.list, ids = L.map(f => f.id), nombres = L.map(f => f.n.toLowerCase());
  const mal = f => L.filter(f).map(x => x.n).slice(0, 10).join(', ');
  comprobar('alimentos: al menos 550 alimentos', L.length >= 550, `hay ${L.length}`);
  comprobar('alimentos: sin códigos ni nombres repetidos', new Set(ids).size === ids.length && new Set(nombres).size === nombres.length);
  comprobar('alimentos: categoría válida', !mal(f => !ALI.cats.includes(f.cat)), mal(f => !ALI.cats.includes(f.cat)));
  comprobar('alimentos: valores por 100 g posibles', !mal(f => ![f.k, f.p, f.c, f.g].every(v => Number.isFinite(v) && v >= 0) || f.k > 902 || f.p + f.c + f.g > 100.5), mal(f => ![f.k, f.p, f.c, f.g].every(v => Number.isFinite(v) && v >= 0) || f.k > 902 || f.p + f.c + f.g > 100.5));
  comprobar('alimentos: porciones con gramos válidos', !mal(f => f.por.some(([l, g]) => !l || !(g > 0) || g > 2000)), mal(f => f.por.some(([l, g]) => !l || !(g > 0) || g > 2000)));
  comprobar('alimentos: marcas de alérgenos y dieta válidas', !mal(f => /[^LHGMNSPCZAV]/.test(f.fl) || (f.fl.includes('A') && f.fl.includes('V'))), mal(f => /[^LHGMNSPCZAV]/.test(f.fl)));
  comprobar('alimentos: carnes, aves y pescados marcados como de origen animal', !mal(f => ['carne', 'ave', 'pescado'].includes(f.cat) && !f.fl.includes('A')));
  comprobar('alimentos: lácteos marcados con leche (salvo bebidas vegetales)', !mal(f => f.cat === 'lacteo' && !/^Bebida de/.test(f.n) && !f.fl.includes('L')), mal(f => f.cat === 'lacteo' && !/^Bebida de/.test(f.n) && !f.fl.includes('L')));
  const porId = Object.fromEntries(L.map(f => [f.id, f]));
  comprobar('alimentos: todos vienen del USDA, SR o FNDDS de 8 cifras (las recetas típicas, de ingredientes del USDA)', L.every(f => (f.usda && /^\d{5}$|^\d{8}$/.test(f.id)) || (f.rec && /^R\d{2}$/.test(f.id) && f.ing.length && f.ing.every(([i, g]) => porId[i] && porId[i].usda && g > 0))), mal(f => !f.usda && !f.rec));
  comprobar('recetas típicas: al menos 40, con sus alérgenos sumados de los ingredientes', L.filter(f => f.rec).length >= 40 && L.filter(f => f.rec).every(f => f.ing.every(([i]) => [...porId[i].fl.replace('V', '')].every(x => f.fl.includes(x)))), mal(f => f.rec && !f.ing.every(([i]) => [...porId[i].fl.replace('V', '')].every(x => f.fl.includes(x)))));
  const html = fs.readFileSync(HTML, 'utf8');
  comprobar('alimentos: la app da el crédito al USDA', /USDA, base de datos de nutrientes/.test(html) && /dominio público/.test(html));
}

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

/* ---------- 1.0.1: PandarIA solo con Premium, conexiones nuevas y versión de Google Play ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE, {level:'intermedio'}); const out={};
    const it=buildItem('press_banca','musculo',2), rt={id:'rx',name:'X',pandaria:true,goal:'musculo',items:[it]}; S.routines.push(rt);
    out.premium={pIA:pIA(rt), rest:restSmart(rt)};
    window.isPremium=()=>false;
    out.gratis={pIA:pIA(rt), rest:restSmart(rt), descarga:deloadActive(), tag:/PandarIA · Premium/.test(SCREENS.routine({id:'rx'})), ajustes:(SCREENS.ajGrupo({g:'pandaria'}).match(/🔒/g)||[]).length};
    window.isPremium=()=>true;
    const n=nd(); for (let i=1;i<=3;i++){ n.diario[dayKey(Date.now()-i*DAY)]=[{n:'a',k:300,p:5,c:60,g:2},{n:'b',k:250,p:6,c:40,g:3}]; }
    out.prot=protCorta(); nut().fast.active={start:Date.now()-19*3600000,goalH:20}; out.ayuno=ayunoCarga();
    window.PF_RHR={last:70,avg:60,n:5,at:Date.now()}; out.pulso=!!pulsoAlto(); window.PF_RHR={last:63,avg:60,n:5,at:Date.now()}; out.pulsoNormal=!!pulsoAlto();
    window.isPremium=()=>false; out.gratisConexiones=[protCorta(),ayunoCarga(),pulsoAlto()].every(x=>x===null); window.isPremium=()=>true;
    return JSON.stringify(out); })()`));
  comprobar('PandarIA con Premium: activa en la rutina', r.premium.pIA && r.premium.rest);
  comprobar('PandarIA sin Premium: no ajusta descansos ni descargas y la rutina muestra «PandarIA · Premium»', !r.gratis.pIA && !r.gratis.rest && !r.gratis.descarga && r.gratis.tag, JSON.stringify(r.gratis));
  comprobar('PandarIA sin Premium: los 4 ajustes de PandarIA llevan candado', r.gratis.ajustes >= 4, `candados: ${r.gratis.ajustes}`);
  comprobar('conexiones: proteína corta 3 días seguidos', r.prot && r.prot.low === 3, JSON.stringify(r.prot));
  comprobar('conexiones: 19 h de ayuno cuentan para la recuperación', /19 h/.test(r.ayuno || ''), r.ayuno);
  comprobar('conexiones: pulso en reposo 10 por encima de la media sí, 3 no', r.pulso && !r.pulsoNormal);
  comprobar('conexiones: sin Premium no hay conexiones', r.gratisConexiones);
  a.cerrar();
}
{
  // Versión de Google Play: sin código de actualizaciones de GitHub y con el JavaScript intacto
  const tmp = path.join(fs.mkdtempSync(path.join(DIR, '..', '.tmp-')), 'index.html');
  fs.copyFileSync(HTML, tmp);
  const { execFileSync } = await import('node:child_process');
  let okScript = true; try { execFileSync(process.execPath, [path.join(DIR, '..', 'scripts', 'version-play.mjs'), tmp], { stdio: 'pipe' }); } catch (e) { okScript = false; }
  const h = fs.readFileSync(tmp, 'utf8');
  let okJs = true; try { [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(m => new Function(m[1])); } catch (e) { okJs = e.message; }
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  comprobar('versión de Play: se borra el código que busca y descarga versiones de GitHub', okScript && !/api\.github\.com|PandarIA-Fit\.apk|apps desconocidas/.test(h) && h.includes('const AVISOS_DEV=false;'));
  comprobar('versión de Play: el JavaScript sigue siendo válido', okJs === true, okJs);
  // Health Connect: los permisos que deja el manifiesto son justo los que usa native.js
  const nat = fs.readFileSync(path.join(DIR, '..', 'www', 'native.js'), 'utf8'), ext = fs.readFileSync(path.join(DIR, '..', 'scripts', 'android-extra.mjs'), 'utf8');
  const lista = re => (nat.match(re) || ['', ''])[1].match(/'([a-zA-Z]+)'/g).map(x => x.slice(1, -1));
  const TIPO = { steps: 'STEPS', weight: 'WEIGHT', heartRate: 'HEART_RATE', restingHeartRate: 'RESTING_HEART_RATE', sleep: 'SLEEP', heartRateVariability: 'HEART_RATE_VARIABILITY', calories: 'ACTIVE_CALORIES_BURNED', dietaryEnergyConsumed: 'NUTRITION', dietaryWater: 'HYDRATION' };
  const usa = [...lista(/HC_READ = \[([^\]]*)\]/).map(t => 'READ_' + TIPO[t]), ...lista(/HC_WRITE = \[([^\]]*)\]/).map(t => 'WRITE_' + TIPO[t])].sort();
  const deja = ((ext.match(/HC_USA = \[([^\]]*)\]/) || ['', ''])[1].match(/'([A-Z_]+)'/g) || []).map(x => x.slice(1, -1)).sort();
  comprobar('Health Connect: el manifiesto deja solo los 10 permisos que usa la app', usa.length === 10 && JSON.stringify(usa) === JSON.stringify(deja), `usa ${usa.join(',')} · deja ${deja.join(',')}`);
}

/* ---------- 1.1: base sólida (Google Play, seguridad, fotos, Premium sin conexión, legibilidad) ---------- */
{
  const leer = f => fs.readFileSync(path.join(DIR, '..', f), 'utf8');
  const html = leer('www/index.html'), nat = leer('www/native.js'), prem = leer('www/premium.js'), ext = leer('scripts/android-extra.mjs');
  const pkg = JSON.parse(leer('package.json')), cfg = JSON.parse(leer('capacitor.config.json'));
  // Cada función que native.js o premium.js reemplaza tiene que existir en index.html (si se renombra, el reemplazo dejaría de funcionar sin avisar)
  const reemplazos = [...new Set([...nat.matchAll(/^\s*([a-zA-Z_]\w*) = (?:async )?function/gm), ...prem.matchAll(/^\s*([a-zA-Z_]\w*) = (?:async )?function/gm)].map(m => m[1]))];
  const faltan = reemplazos.filter(n => !new RegExp(`(function ${n}\\(|(let|var|const) ${n}\\s*=)`).test(html));
  comprobar(`reemplazos: las ${reemplazos.length} funciones que cambian native.js y premium.js existen en index.html`, reemplazos.length >= 15 && !faltan.length, faltan.join(', '));
  // Google Play: R8 y borde a borde
  comprobar('R8: se activa con reglas que conservan Capacitor, los complementos y la app', /minifyEnabled true/.test(ext) && /-keep class com\.getcapacitor\.\*\*/.test(ext) && /-keep class com\.pandaria\.fit\.\*\*/.test(ext) && /-keep class ee\.forgr\.\*\*/.test(ext) && /-keep class app\.capgo\.\*\*/.test(ext) && /-keep class io\.capawesome\.\*\*/.test(ext));
  comprobar('borde a borde: sin el complemento StatusBar ni setBackgroundColor; EdgeToEdge activado', !pkg.dependencies['@capacitor/status-bar'] && !/StatusBar|setBackgroundColor/.test(nat) && /EdgeToEdge\.enable\(this\)/.test(ext) && /SystemBars\.setStyle/.test(nat) && cfg.plugins.SystemBars);
  // Seguridad
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  comprobar('CSP: solo se conecta con Google y GitHub; sin objetos ni marcos', /connect-src 'self' https:\/\/www\.googleapis\.com https:\/\/api\.github\.com;/.test(csp) && /object-src 'none'/.test(csp) && /frame-src 'none'/.test(csp) && /img-src 'self' data: blob:;/.test(csp), csp);
  comprobar('avisos: se muestran como texto, nunca como HTML', /t\.textContent=String\(msg\?\?''\)/.test(html) && !/t\.innerHTML=msg/.test(html));
  comprobar('Premium: la suscripción vale 7 días sin comprobar y los códigos no se alargan atrasando el reloj', /const SUB_DAYS = 7;/.test(prem) && /window\.isPremium = \(\) => licOk\(\) \|\| subOk\(\);/.test(prem) && /hoyGuard\(\) > l\.exp/.test(prem));
  comprobar('Premium: el texto de la prueba gratis dice que es para la primera suscripción', /3 días gratis si es tu primera suscripción/.test(prem));
  // En la app
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE); const out={};
    out.recEst=conRecord(getEx('est_isquios')); out.recBanca=conRecord(getEx('press_banca'));
    const foto='data:image/jpeg;base64,'+'A'.repeat(400);
    S.measures.push({id:'m1',date:Date.now(),peso:80,foto});
    out.sinIdb=JSON.parse(datosJSON()).measures.find(m=>m.id==='m1').foto===foto; // sin IndexedDB (jsdom) la foto se queda en los datos
    FOTOS_OK.add('m1'); out.conIdb=JSON.parse(datosJSON()).measures.find(m=>m.id==='m1').foto==='idb'; out.copia=JSON.parse(datosCompletosJSON()).measures.find(m=>m.id==='m1').foto===foto; FOTOS_OK.delete('m1');
    S.measures.find(m=>m.id==='m1').foto='idb'; const n=fotosPrep(); out.prep=n===1 && S.measures.find(m=>m.id==='m1').foto===FOTO_CARGANDO && JSON.parse(datosJSON()).measures.find(m=>m.id==='m1').foto==='idb';
    toast('<b id="tx">x</b>'); out.toast=!document.getElementById('tx');
    return JSON.stringify(out); })()`));
  comprobar('récords: los estiramientos no cuentan; la fuerza sí', !r.recEst && r.recBanca);
  comprobar('fotos: sin IndexedDB se quedan en los datos; con IndexedDB confirmado quedan como «idb»; las copias las llevan completas', r.sinIdb && r.conIdb && r.copia, JSON.stringify(r));
  comprobar('fotos: una copia importada con marcas «idb» las busca en IndexedDB y nunca guarda la imagen vacía', r.prep);
  comprobar('avisos: un aviso con etiquetas no crea HTML', r.toast);
  a.cerrar();
}

/* ---------- 1.2: PandarIA v2, temas, tamaño del texto y versión web ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE); const out={}; const H=3600000;
    out.e1=Math.round(e1Sesion([{kg:100,reps:5},{kg:80,reps:15},{kg:90,reps:8}])*10)/10;
    out.e1Alto=e1Sesion([{kg:60,reps:15}]);
    const ses=(h,items,int)=>({id:'s'+h,routineId:'x',routineName:'X',start:Date.now()-h*H-3600000,end:Date.now()-h*H,intensity:int||6,items:items.map(([id,n,kg,reps])=>({exId:id,sets:Array.from({length:n},()=>({done:true,t:'n',kg,reps}))})),prs:[],vol:0});
    S.sessions=[ses(24,[['press_banca',6,80,8]]), ses(10,[['sentadilla',3,100,5]],9)];
    const R0=recMusculos(); out.pecho=Math.round(R0.pecho.pct*100); out.cuad=Math.round(R0.cuadriceps.pct*100); out.triceps=Math.round(R0.triceps.pct*100);
    S.sessions=[ses(24*40,[['press_banca',3,70,8]]), ses(24*35,[['press_banca',3,72,8]]), ses(24*10,[['press_banca',3,77,8]])];
    out.fuerza=fuerzaMusculos();
    window.isPremium=()=>true; gustoCambio('press_banca','press_banca_man'); gustoCambio('press_banca','press_banca_man'); out.gusto=[gustoAjuste('press_banca'),gustoAjuste('press_banca_man')];
    window.isPremium=()=>false; out.gustoGratis=gustoAjuste('press_banca'); window.isPremium=()=>true; delete S.gustos;
    S.settings.theme='oled'; applyTheme(); out.oled=document.documentElement.dataset.theme;
    S.settings.theme='system'; S.settings.oscuroAuto='oled'; out.auto=temaActual();
    S.settings.theme='dark'; applyTheme();
    S.settings.bigText=true; delete S.settings.texto; out.texto=textoNivel(); A.setTexto('mg'); out.zoom=document.body.style.zoom; A.setTexto('n');
    const rt={id:'rp',name:'P',pandaria:true,goal:'musculo',items:[]}; S.routines.push(rt); S.active={routineId:'rp',items:[]}; S.settings.rir=false;
    out.rirPrem=rirOn(); window.isPremium=()=>false; out.rirGratis=rirOn(); window.isPremium=()=>true; S.settings.rirAuto=false; out.rirApagado=rirOn(); S.active=null;
    out.recuScreen=/Recuperación por músculo/.test(SCREENS.recuMapa({}));
    return JSON.stringify(out); })()`));
  comprobar('fuerza estimada: Epley con la mejor serie de hasta 12 repeticiones', r.e1 === 116.7 && r.e1Alto === null, JSON.stringify([r.e1, r.e1Alto]));
  comprobar('recuperación: 6 series de pecho hace 24 h ≈ 50 %; 3 series de pierna intensas hace 10 h ≈ 36 %; tríceps (secundario) más recuperado', r.pecho === 50 && r.cuad === 36 && r.triceps > r.pecho, JSON.stringify([r.pecho, r.cuad, r.triceps]));
  comprobar('fuerza por músculo: compara las últimas 4 semanas con las 4 anteriores', r.fuerza.length === 1 && r.fuerza[0].m === 'pecho' && r.fuerza[0].pct === 7, JSON.stringify(r.fuerza));
  comprobar('gustos: el ejercicio quitado baja y el elegido sube; sin Premium no cuenta', r.gusto[0] < 0 && r.gusto[1] > 0 && r.gustoGratis === 0, JSON.stringify([r.gusto, r.gustoGratis]));
  comprobar('temas: Negro puro y Automático con el oscuro elegido', r.oled === 'oled' && ['oled', 'light'].includes(r.auto), JSON.stringify([r.oled, r.auto]));
  comprobar('tamaño del texto: «Texto grande» antiguo pasa a Grande; Muy grande amplía 1,25', r.texto === 'g' && r.zoom === '1.25', JSON.stringify([r.texto, r.zoom]));
  comprobar('esfuerzo por serie: se pregunta solo en rutinas de PandarIA con Premium y se puede apagar', r.rirPrem && !r.rirGratis && !r.rirApagado);
  comprobar('mapa de recuperación: la pantalla se dibuja', r.recuScreen);
  a.cerrar();
  // La versión web de prueba (docs/web) está al día con www/
  const { execFileSync } = await import('node:child_process');
  const tmpw = fs.mkdtempSync(path.join(DIR, '..', '.tmp-web-'));
  let okWeb = true; try { execFileSync(process.execPath, [path.join(DIR, '..', 'scripts', 'version-web.mjs'), tmpw], { stdio: 'pipe' }); } catch (e) { okWeb = false; console.log('version-web:', String(e.stderr || e).slice(0, 300)); }
  const igual = f => okWeb && fs.existsSync(path.join(DIR, '..', 'docs', 'web', f)) && fs.readFileSync(path.join(tmpw, f), 'utf8') === fs.readFileSync(path.join(DIR, '..', 'docs', 'web', f), 'utf8');
  const wh = okWeb ? fs.readFileSync(path.join(tmpw, 'index.html'), 'utf8') : '';
  const alDia = igual('index.html') && igual('premium.js');
  fs.rmSync(tmpw, { recursive: true, force: true });
  comprobar('versión web: docs/web está al día (si falla: node scripts/version-web.mjs)', alDia);
  comprobar('versión web: lleva premium.js (Premium bloqueado) y nada de GitHub', /<script src="premium\.js"><\/script>/.test(wh) && !/api\.github\.com|PandarIA-Fit\.apk/.test(wh));
}

/* ---------- 1.3: Nutrición (Comida | Agua), pestaña Ayuno, proteína, peso, sueño, variabilidad y hora habitual ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE); const out={}; const H=3600000;
    window.isPremium=()=>true;
    NSEG='comida'; const vc=viewNutricion(); NSEG='agua'; const va=viewNutricion(); NSEG='comida';
    out.comida=/Diario de comidas/.test(vc) && !/data-a="water"/.test(vc) && vc.includes('<!--fin-objetivo-->');
    out.agua=/data-a="water"/.test(va) && !/Diario de comidas/.test(va);
    NSEG='ayuno'; const vy=viewNutricion(); NSEG='comida';
    out.ayuno=/data-a="nseg" data-v="ayuno"/.test(vc) && /Ayuno/.test(vy) && !/data-a="fastStart"/.test(vc+va) && !/Diario de comidas/.test(vy);
    A.tab('ayuno'); out.nav=document.querySelectorAll('#nav button').length; out.navOn=document.querySelector('#nav button.on').dataset.v+'/'+NSEG; A.tab('rutinas');
    const aj=SCREENS.ajGrupo({g:'nutri'}); out.ajustes=/data-a="nGoalPick"/.test(aj) && /data-a="dPrefs"/.test(aj);
    // proteína: a las 20 h con 30 g de 150 g
    __setNow(Date.UTC(2026,10,12,20,0,0)); const n=nd(); n.diario[dayKey()]=[{id:'a',fid:'09003',n:'Manzana',gr:150,m:'almuerzo',k:80,p:0.4,c:20,g:0.2,t:Date.now()-3600000}];
    const pi=protIdeas(dayKey()); out.prot=!!pi && pi.ids.length===3 && pi.ids.every(id=>{ const f=alimGet(id); return f.p/f.k*100>=8; });
    window.isPremium=()=>false; out.protGratis=protIdeas(dayKey())===null; window.isPremium=()=>true; __setNow(${NOW});
    // peso: de 82 a 80 en 28 días, meta 78
    S.measures=[0,7,14,21,28].map((d,i)=>({id:'w'+i,date:Date.now()-(28-d)*86400000,peso:82-i*0.5})); S.goals=[{id:'g',type:'peso',target:78,deadline:Date.now()+200*86400000}];
    const T=pesoTendencia(); out.peso={now:T.now, rate:T.rate, eta:T.eta?Math.round((T.eta-Date.now())/86400000):null};
    // sueño y variabilidad
    window.PF_SUENO={last:330,avg:420,n:6,at:Date.now()-5*H}; out.sueno=!!suenoCorto(); window.PF_SUENO={last:400,avg:420,n:6,at:Date.now()-5*H}; out.suenoOk=!suenoCorto();
    window.PF_HRV={last:40,avg:50,n:6,at:Date.now()-5*H}; out.hrv=hrvBaja()&&hrvBaja().pct; window.PF_HRV={last:47,avg:50,n:6,at:Date.now()-5*H}; out.hrvOk=!hrvBaja();
    window.PF_SUENO=null; window.PF_HRV=null;
    // hora habitual: 5 entrenos empezando a las 18:00-18:40 (hora local del navegador simulado = UTC)
    S.sessions=[0,10,20,30,40].map((m,i)=>({id:'s'+i,routineId:'r',start:Date.UTC(2026,10,1+i,18,m),end:Date.UTC(2026,10,1+i,19,m),items:[]}));
    out.hora=horaHabitual();
    return JSON.stringify(out); })()`));
  comprobar('Nutrición: Comida, Agua y Ayuno por separado (1.8.1: el ayuno vuelve a Nutrición)', r.comida && r.agua && r.ayuno, JSON.stringify([r.comida, r.agua, r.ayuno]));
  comprobar('barra de abajo: 4 pestañas; ir a Ayuno abre Nutrición › Ayuno', r.nav === 4 && r.navOn === 'nutricion/ayuno', JSON.stringify([r.nav, r.navOn]));
  comprobar('Ajustes › Nutrición y ayuno: objetivo nutricional y preferencias de comida', r.ajustes);
  comprobar('proteína: 3 ideas con 8 g o más por 100 kcal, solo con Premium', r.prot && r.protGratis);
  comprobar('peso: tendencia suavizada, ritmo semanal y fecha estimada de la meta', r.peso.now > 80 && r.peso.now < 81.5 && r.peso.rate < -0.3 && r.peso.eta > 0, JSON.stringify(r.peso));
  comprobar('sueño: menos de 6 h cuenta; 6 h 40 no', r.sueno && r.suenoOk);
  comprobar('variabilidad del pulso: un 20 % bajo la media cuenta; un 6 % no', r.hrv === 20 && r.hrvOk, JSON.stringify([r.hrv, r.hrvOk]));
  comprobar('hora habitual: mediana 18:20, aviso 17:50', r.hora && r.hora.hora === '18:20' && r.hora.aviso === '17:50', JSON.stringify(r.hora));
  a.cerrar();
  const prem = fs.readFileSync(path.join(DIR, '..', 'www', 'premium.js'), 'utf8');
  comprobar('Premium: el candado de calorías usa la marca de fin del objetivo (no depende de que el agua esté debajo)', /h\.indexOf\('<!--fin-objetivo-->'\)/.test(prem));
}

/* ---------- 1.4: Consulta a PandarIA, retos, Tu mes / Tu año, iPhone y Google Play ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE); const out={};
    window.isPremium=()=>true;
    // datos: 6 entrenos con press de banca subiendo y luego estancado
    S.sessions=[0,1,2,3,4,5].map(i=>({id:'s'+i,routineId:'r',routineName:'A',start:Date.now()-(30-i*5)*86400000-3600000,end:Date.now()-(30-i*5)*86400000,intensity:7,
      items:[{exId:'press_banca',sets:[{t:'n',kg:[60,62.5,65,65,65,65][i],reps:8,done:true}]}]}));
    // Consulta: cada pregunta con cada opción responde sin errores, sin «undefined» ni «NaN», y su regla existe
    const malos=[]; let n=0;
    for (const q of CQ){ const ops=q.p?CQ_PARAMS[q.p].ops():[[null]];
      for (const [v] of ops){ const pr={}; if (q.p) pr[q.p]=v; n++;
        try{ const R=q.f(pr), t=JSON.stringify(R), kbId=R.kb!==undefined?R.kb:q.kb;
          if (!R.corta || /undefined|NaN/.test(t) || (kbId && !KB[kbId])) malos.push(q.id+':'+v);
          (R.acciones||[]).forEach(([x])=>{ if (!['tab','hseg','cqPay'].includes(x) && typeof A[x]!=='function') malos.push(q.id+' acción '+x); });
        }catch(e){ malos.push(q.id+':'+v+' '+e.message); } } }
    out.consulta={preguntas:CQ.length, secciones:new Set(CQ.map(q=>q.s)).size, respuestas:n, malos};
    out.estanco=CQ.find(q=>q.id==='estanco').f({ej:'press_banca'}).corta;
    out.proteina=CQ.find(q=>q.id==='proteina').f({}).corta;
    out.buscar=cqBuscar(null,'creatina').map(q=>q.id)[0];
    const pq=SCREENS.consultaQ({id:'proteina',p:{}}); out.premCompleto=/Tu caso/.test(pq) && /Basado en/.test(pq) && !/data-a="cqPay"/.test(pq);
    window.isPremium=()=>false; const fq=SCREENS.consultaQ({id:'proteina',p:{}}); out.gratis=/RESPUESTA CORTA/.test(fq) && /data-a="cqPay"/.test(fq) && /blur/.test(fq); window.isPremium=()=>true;
    out.experimental=/experimental/i.test(SCREENS.consulta({q:''}));
    // burbuja flotante: visible en las pestañas, oculta en el entreno; el chat responde y busca sin inventar
    S.settings.onboarded=true; LAYERS.length=0; MODALS.length=0; renderLayers(); renderModals(); TAB='rutinas'; render();
    const bb=document.getElementById('pfBub'); out.bubTab=!!bb && !bb.hidden;
    LAYERS.push({t:'workout',p:{}}); bubSync(); out.bubEntreno=bb.hidden; LAYERS.length=0; bubSync();
    out.bubIcono=!!bb.querySelector('img[src^="data:image/webp"]') && !/🐼/.test(bb.textContent);
    A.guiaAbrir(); const gd=()=>document.querySelector('#modals .pfguia');
    out.guiaAbre=!!gd() && /experimental/i.test(gd().textContent) && !gd().querySelector('form,textarea') && gd().querySelectorAll('[data-a="guiaQ"]').length>0;
    A.guiaQ('proteina'); out.guiaResp=/128 g/.test(gd().querySelector('.pfg-r').textContent);
    A.guiaQ('pesoUsar'); out.guiaPar=gd().querySelectorAll('[data-a="guiaPar"]').length>0;
    A.guiaAtras(); A.guiaAtras(); out.guiaAtras=GUIA.v==='inicio';
    const gi=document.getElementById('guiaB'); gi.value='creatina'; gi.dispatchEvent(new Event('input',{bubbles:true}));
    out.guiaBusca=!!document.querySelector('#guiaL [data-v="creatina"]');
    gi.value='xyzzy plutonio'; gi.dispatchEvent(new Event('input',{bubbles:true}));
    out.guiaNada=!document.querySelector('#guiaL [data-a="guiaQ"]') && !/mailto|correo|email/i.test(document.getElementById('guiaL').innerHTML);
    out.sinCorreo=typeof A.cqPedir==='undefined' && typeof A.cqEnviar==='undefined';
    out.sinMatraz=!/🧪/.test(bb.innerHTML+document.querySelector('#modals .pfguia').innerHTML);
    try{ LAYERS.push({t:'exercise',p:{id:'est_isquios'}}); renderLayers(); out.estira=!!document.querySelector('.layer'); }catch(e){ out.estira=false; } LAYERS.length=0; renderLayers();
    closeModal();
    MODALS.length=0; renderModals();
    // escáner: el nombre de un alimento nuevo abre el teclado de letras
    const an=SCREENS.alimNuevo({d:{n:'',porl:'',porg:'',k:'',p:'',c:'',g:'',f:'',a:'',na:'',fl:'',codigo:'123',fuente:''}});
    out.teclado=/id="an_n" class="inp" type="text" inputmode="text"/.test(an) && /id="an_k" class="inp" type="number" inputmode="decimal"/.test(an);
    // Retos del mes y con amigos
    S.plan={days:[1,3,5],order:['r']};
    const rm=retosMes(); out.retosMes=rm.map(x=>x.id+':'+x.meta+':'+x.v).join(' ');
    const rt={id:'abc',n:'Diciembre',t:'entrenos',m:12,d0:Date.now()-86400000,d1:Date.now()+29*86400000};
    const cod=retoCodigo(rt); S.retos={logros:{},amigos:[]}; retoImportar('mira esto '+cod+' ¡vamos!'); out.retoImport=S.retos.amigos.length===1 && S.retos.amigos[0].m===12;
    retoImportar(cod); out.retoDuplicado=S.retos.amigos.length===1;
    retoImportar('PFR-'+b64u.enc({v:1,id:'x',n:'Malo',t:'nada',m:5,d0:1,d1:2})); out.retoMalo=S.retos.amigos.length===1;
    retoImportar('PFP-'+b64u.enc({v:1,id:'abc',n:'Ana',val:7,at:Date.now()})); retoImportar('PFP-'+b64u.enc({v:1,id:'abc',n:'Ana',val:9,at:Date.now()}));
    out.rival=JSON.stringify(S.retos.amigos[0].rivales.map(x=>[x.n,x.v]));
    // Tu mes y Tu año
    const D=periodoDatos('ano'); out.ano={entrenos:D.entrenos, dias:D.dias, racha:D.racha};
    // 1.5 · Ayuno completo
    const f5=nut().fast; f5.screened=true; f5.blocked=false; f5.plan='16:8'; f5.history=[]; f5.active={start:Date.now()-13*3600000,goalH:16};
    out.f5linea=/fl-bar/.test(fastCard()) && fastPhaseAt(13).h===12 && fastNextPhase(13).h===16 && (fastCard().match(/Estado de ayuno/g)||[]).length===1;
    out.f5omad=!!FAST_PLANS['23:1'] && FAST_PLANS['23:1'].h===23;
    f5.active=null; for (let i=8;i>=1;i--){ const s=Date.now()-i*DAY, d=(i%2?17:13)*3600000; f5.history.push({start:s,end:s+d,goalH:16,ok:d>=16*3600000,s:{h:2,e:i%2?1:3,a:2}}); }
    out.f5racha=JSON.stringify(fastRachas());
    out.f5sens=/energía suele ser más baja/.test(fastSensInsight()||'');
    const cbOk=(s,e)=>{ A.fastEdit('nuevo'); const k=document.querySelector('#modals .scrim:last-child [data-a="cbm"]').dataset.v; MODALS.length=0; renderModals(); MV={feS:toLocalInput(s),feE:toLocalInput(e)}; CB[k](); };
    cbOk(Date.now()-40*3600000, Date.now()-20*3600000); out.f5anade=f5.history.length===9 && f5.history.some(x=>Math.round((x.end-x.start)/3600000)===20);
    cbOk(Date.now()-2*3600000, Date.now()-5*3600000); out.f5rechaza=f5.history.length===9; MODALS.length=0; renderModals();
    LAYERS.push({t:'fastStats',p:{y:new Date().getFullYear(),m:new Date().getMonth()}}); renderLayers(); out.f5stats=/Racha actual/.test(document.querySelector('.layer:last-child').textContent) && document.querySelectorAll('.layer:last-child .cal .d').length>=28; LAYERS.length=0; renderLayers();
    f5.horario={on:true,hora:'00:00'}; const ini=fastHorarioIni(); A.fastDesdeHorario(); out.f5horario=!!f5.active && f5.active.start===ini && ini<=Date.now(); f5.active=null; f5.horario={on:false,hora:'20:00'};
    // 1.5 · un día aligerado (poco descanso) no se usa como referencia para subir
    { const ex=EX.press_banca, rr={id:'simAj',name:'x',pandaria:true,goal:'musculo',items:[buildItem('press_banca','musculo',2)]}; const S0=S.sessions; S.sessions=[]; const ip=window.isPremium; window.isPremium=()=>true;
      const mk=(d,kg,aj)=>Object.assign({id:'a'+d,routineId:'simAj',start:Date.now()-d*DAY-3600000,end:Date.now()-d*DAY,intensity:7,items:[{exId:'press_banca',sets:[0,1,2].map(()=>({t:'n',kg,reps:12,done:true}))}]},aj?{ajuste:{f:0.9}}:{});
      S.sessions.push(mk(4,100), mk(2,90,true)); const it=rr.items[0]; out.ajNormal=suggestSet(rr,it,it.sets.indexOf(it.sets.find(x=>x.t!=='c'))).kg;
      S.sessions=[mk(2,90,true)]; out.ajSolo=suggestSet(rr,it,it.sets.indexOf(it.sets.find(x=>x.t!=='c'))).kg; S.sessions=S0; window.isPremium=ip; }
    // 1.5 · borrar con deshacer, terminar el ayuno preguntando y limpiar datos de prueba
    { const fz=nut().fast; fz.screened=true; fz.blocked=false; fz.active={start:Date.now()-20*60000,goalH:16}; const n0=fz.history.length; MODALS.length=0; renderModals();
      A.fastEnd(); out.dzPregunta=MODALS.length===1 && !!fz.active && /Terminar el ayuno/.test(document.querySelector('#modals').textContent); MODALS.length=0; renderModals();
      A.fastEndNow(); out.dzCorto=!fz.active && fz.history.length===n0 && !!fz.deshacer;
      A.fastReanudar(); out.dzReanuda=!!fz.active && fz.active.start===Date.now()-20*60000 || (!!fz.active && Math.abs(fz.active.start-(Date.now()-20*60000))<5000);
      fz.active={start:Date.now()-5*3600000,goalH:16}; A.fastEndNow(); const n1=fz.history.length; A.fastReanudar(); out.dzLargo=n1===n0+1 && fz.history.length===n0 && !!fz.active; fz.active=null;
      document.querySelectorAll('.toast').forEach(x=>x.remove());
      const kd=dayKey(); nd().diario[kd]=[{id:'zz1',fid:'05064',n:'Pollo',gr:100,k:100,p:20,c:0,g:2,m:'almuerzo',t:Date.now()}]; NUT_DAY=null; dDel('zz1');
      const bt=document.querySelector('.toast.undo button'); out.dzComida=!(nd().diario[kd]||[]).length && !!bt; if (bt) bt.click(); out.dzDeshacer=(nd().diario[kd]||[]).length===1; delete nd().diario[kd];
      const S1=S.sessions; S.sessions=S1.concat([{id:'zt',routineId:'r',routineName:'Prueba',start:Date.now()-20000,end:Date.now(),intensity:5,items:[{exId:'press_banca',sets:[{t:'n',kg:20,reps:5,done:true}]}]}]);
      fz.history.push({start:Date.now()-3*60000,end:Date.now()-60000,goalH:16,ok:false}); const pd=pruebasDatos(); out.dzDetecta=pd.ent.some(s=>s.id==='zt') && pd.ay.length>=1;
      A.limpiarPruebas(); A.lpBorrar(); out.dzLimpia=!S.sessions.some(s=>s.id==='zt') && !pruebasDatos().ay.length; S.sessions=S1; MODALS.length=0; renderModals(); }
    // 1.5 · flujo real de un mal día: check-in «Mal» → 10 % menos → la sesión se guarda como aligerada → la siguiente vuelve a progresar desde la normal
    { const ip=window.isPremium; window.isPremium=()=>true; const S1=S.sessions, R1=S.routines; S.settings.checkin=true; S.active=null;
      const rr=newRoutine({name:'Prueba mal día',items:[buildItem('press_banca','musculo',2)],pandaria:true,goal:'musculo'}); S.routines=R1.concat([rr]);
      const it0=rr.items[0], w0=it0.sets.filter(x=>x.t!=='c').length;
      S.sessions=[{id:'n1',routineId:rr.id,start:Date.now()-3*DAY-3600000,end:Date.now()-3*DAY,intensity:7,items:[{exId:'press_banca',sets:Array.from({length:w0},()=>({t:'n',kg:100,reps:12,done:true}))}]}];
      S.checkinDia={day:dayKey(),sleep:0,energy:1,sore:2}; MODALS.length=0; renderModals();
      A.startWorkout(rr.id); const it=S.active&&S.active.items[0]; out.mdAjuste=!!(S.active&&S.active.ajuste&&S.active.ajuste.f===0.9) && !MODALS.length;
      if (it){ const w=it.sets.filter(x=>x.t!=='c'); w.forEach(s=>{ const sg=suggestSet(rr,it,it.sets.indexOf(s)); s.kg=sg.kg; s.reps=12; s.done=true; }); out.mdKg=w[0].kg; }
      try{ finishWorkout('save'); }catch(e){ out.mdErr=e.message; } MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();
      const last=S.sessions[S.sessions.length-1]; out.mdGuardada=!!(last&&last.ajuste&&last.ajuste.f===0.9);
      const nx=rr.items[0]; out.mdSiguiente=suggestSet(rr,nx,nx.sets.indexOf(nx.sets.find(x=>x.t!=='c'))).kg;
      S.active=null; S.sessions=S1; S.routines=R1; delete S.checkinDia; window.isPremium=ip; }
    // 1.6 · Mis rutinas en dos modos
    { const u0=S.settings.ui, T0=TAB, R0=S.routines; S.routines=R0.concat([newRoutine({name:'Prueba UI',items:[buildItem('press_banca','musculo',2)]})]); TAB='rutinas'; MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();
      A.setUi('completa'); const vc=document.querySelector('#view');  out.uiComp=!!vc.querySelector('.rcard [data-a="startWorkout"]') && !vc.querySelector('.newbtn') && !!vc.querySelector('.hdr [data-a="newRoutine"]') && !vc.querySelector('.rcard .exs');
      A.setUi('mini'); out.uiMini=!!vc.querySelector('[data-a="openRoutine"]') && !vc.querySelector('.rcard') && !!vc.querySelector('.hdr [data-a="uiToggle"]');
      A.uiToggle(); out.uiToggle=S.settings.ui==='completa';
      delete S.settings.ui; A.uiElegir(); out.uiElegir=MODALS.length===1 && document.querySelectorAll('#modals [data-a="uiElige"]').length===3; A.uiElige('mini'); out.uiElige=S.settings.ui==='mini' && !MODALS.length;
      S.settings.ui=u0||'completa'; S.routines=R0; TAB=T0; render(); }
    // 1.7 · El panda como centro de avisos
    { const ip=window.isPremium, R0=S.routines, P0=S.panda, b0=S.settings.burbuja; window.isPremium=true; S.panda=null; S.settings.burbuja=true; MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();
      const rp=newRoutine({name:'Prueba panda',items:[buildItem('press_banca','musculo',2)]}); rp.sugg=[{t:'x'}]; S.routines=R0.concat([rp]);
      out.pEst=pandaEstado().prop===1; bubSync(); out.pBlink=document.getElementById('pfBub').classList.contains('blink');
      A.guiaAbrir(); out.pHub=!!document.querySelector('#modals .pprop [data-a="pandaNo"]');
      A.pandaNo(document.querySelector('#modals .pprop [data-a="pandaNo"]').dataset.v); out.pNo=pandaEstado().prop===0 && !document.querySelector('#modals .pprop');
      MODALS.length=0; renderModals(); out.pAvisos=avisosHtml(false)==='';
      S.routines=R0; S.panda=P0; S.settings.burbuja=b0; window.isPremium=ip; render(); }
    // 1.5 · Agua completa
    const n5=nut(), k5=dayKey(); n5.water[k5]=300; n5.waterLog={}; n5.waterExtra={}; const g0=waterGoal();
    A.water(330,'Taza'); A.water(500); out.a5log=wLog(k5).length===2 && wLog(k5)[0].n==='Taza' && n5.water[k5]===1130;
    A.water(-250); out.a5deshacer=wLog(k5).length===1 && n5.water[k5]===630;
    A.wDel(0); out.a5borrar=wLog(k5).length===0 && n5.water[k5]===300;
    A.wCalor(); out.a5calor=waterGoal()===g0+500; A.wCalor(); out.a5calorOff=waterGoal()===g0;
    LAYERS.push({t:'aguaStats',p:{y:new Date().getFullYear(),m:new Date().getMonth()}}); renderLayers(); out.a5stats=/Media 7 días/.test(document.querySelector('.layer:last-child').textContent); LAYERS.length=0; renderLayers();
    return JSON.stringify(out); })()`));
  comprobar('Consulta a PandarIA: 30 preguntas o más en las 9 secciones, todas responden con sus datos y su regla', r.consulta.preguntas >= 30 && r.consulta.secciones === 9 && !r.consulta.malos.length, JSON.stringify(r.consulta));
  comprobar('Consulta: ve el estancamiento del press de banca y calcula la proteína (2 g/kg al bajar… 1,6 al mantener: 128 g)', /no sube desde hace/.test(r.estanco) && /128 g/.test(r.proteina), JSON.stringify([r.estanco, r.proteina]));
  comprobar('Consulta: el buscador encuentra «creatina»', r.buscar === 'creatina', r.buscar);
  comprobar('Consulta: con Premium el informe completo; gratis solo la respuesta corta con candado', r.premCompleto && r.gratis);
  comprobar('Consulta: marcada como experimental', r.experimental);
  comprobar('burbuja de PandarIA: visible en las pestañas y oculta durante el entreno', r.bubTab && r.bubEntreno);
  comprobar('abrir un estiramiento o ejercicio de movilidad no falla', r.estira);
  comprobar('guía de PandarIA: icono de la app, experimental, sin texto libre ni correo; responde, pide el ejercicio, vuelve atrás y busca', r.bubIcono && r.guiaAbre && r.guiaResp && r.guiaPar && r.guiaAtras && r.guiaBusca && r.guiaNada && r.sinCorreo && r.sinMatraz, JSON.stringify([r.sinMatraz,r.bubIcono,r.guiaAbre,r.guiaResp,r.guiaPar,r.guiaAtras,r.guiaBusca,r.guiaNada,r.sinCorreo]));
  comprobar('escáner: el nombre del alimento nuevo usa el teclado de letras y los números el numérico', r.teclado);
  comprobar('retos del mes: metas según el plan (3 días por semana)', /^entrenos:\d+:\d+ agua:\d+:\d+/.test(r.retosMes), r.retosMes);
  comprobar('retos con amigos: código PFR dentro de un mensaje, sin duplicados y rechazando códigos malos', r.retoImport && r.retoDuplicado && r.retoMalo);
  comprobar('retos con amigos: el progreso PFP de un amigo se actualiza (no se repite)', r.rival === '[["Ana",9]]', r.rival);
  comprobar('ayuno 1.5: línea de fases en el anillo (una sola vez) y plan 23:1', r.f5linea && r.f5omad);
  comprobar('ayuno 1.5: rachas, y PandarIA compara cómo te sientan los ayunos largos', r.f5racha === '{"act":1,"mej":1}' && r.f5sens, r.f5racha);
  comprobar('ayuno 1.5: añadir un ayuno olvidado y rechazar uno que termina antes de empezar', r.f5anade && r.f5rechaza);
  comprobar('ayuno 1.5: estadísticas con calendario y empezar desde el horario fijo', r.f5stats && r.f5horario);
  comprobar('progreso: un día aligerado no hace retroceder (sube desde los 100 kg, no desde 90; si solo hay días aligerados vuelve a 100)', r.ajNormal === 102.5 && r.ajSolo === 100, JSON.stringify([r.ajNormal, r.ajSolo]));
  comprobar('ayuno 1.5: terminar pregunta antes; uno de menos de 1 h no se guarda; se puede reanudar (y se quita del historial)', r.dzPregunta && r.dzCorto && r.dzReanuda && r.dzLargo, JSON.stringify([r.dzPregunta,r.dzCorto,r.dzReanuda,r.dzLargo]));
  comprobar('borrar 1.5: quitar una comida tiene Deshacer y funciona', r.dzComida && r.dzDeshacer);
  comprobar('limpiar 1.5: detecta un entreno de 20 segundos y un ayuno de 2 minutos y los borra', r.dzDetecta && r.dzLimpia);
  comprobar('mal día (flujo completo): el check-in de la mañana aplica 10 % menos (92,5 kg en vez de 102,5), la sesión se guarda aligerada y la siguiente sube desde 100 kg', r.mdAjuste && r.mdKg === 92.5 && r.mdGuardada && r.mdSiguiente === 102.5, JSON.stringify([r.mdAjuste, r.mdKg, r.mdGuardada, r.mdSiguiente, r.mdErr]));
  comprobar('1.7: el panda parpadea con una propuesta, la muestra al abrirlo, «Ahora no» la calla y los avisos salen de Mis rutinas', r.pEst && r.pBlink && r.pHub && r.pNo && r.pAvisos, JSON.stringify([r.pEst,r.pBlink,r.pHub,r.pNo,r.pAvisos]));
  comprobar('1.6: Mis rutinas en modo completo (tarjetas con empezar, + en la cabecera) y minimalista (una línea), se cambia con un toque y se elige una vez', r.uiComp && r.uiMini && r.uiToggle && r.uiElegir && r.uiElige, JSON.stringify([r.uiComp,r.uiMini,r.uiToggle,r.uiElegir,r.uiElige]));
  comprobar('agua 1.5: lista del día con nombre, deshacer el último y borrar uno', r.a5log && r.a5deshacer && r.a5borrar, JSON.stringify([r.a5log,r.a5deshacer,r.a5borrar]));
  comprobar('agua 1.5: día de calor suma 500 ml a la meta y se quita', r.a5calor && r.a5calorOff);
  comprobar('agua 1.5: estadísticas del agua', r.a5stats);
  comprobar('Tu año: entrenos, días y racha de semanas', r.ano.entrenos === 6 && r.ano.dias === 6 && r.ano.racha >= 1, JSON.stringify(r.ano));
  a.cerrar();
  const nat = fs.readFileSync(path.join(DIR, '..', 'www', 'native.js'), 'utf8');
  const prem = fs.readFileSync(path.join(DIR, '..', 'www', 'premium.js'), 'utf8');
  comprobar('iPhone: native.js salta en iOS el servicio del entreno, el botón atrás y los canales de Android', /const PN = IOS \? null/.test(nat) && /if \(!IOS\) App\.addListener\('backButton'/.test(nat) && /if \(!IOS\)\{ for \(const old/.test(nat));
  comprobar('iPhone: las compras del App Store usan un producto por plan', /IOS_IDS = \{mensual: 'com\.pandaria\.fit\.premium\.mensual'/.test(prem));
  const ex = fs.readFileSync(path.join(DIR, '..', 'scripts', 'android-extra.mjs'), 'utf8');
  comprobar('widgets 1.5: Check-in, Mi día y Calorías registrados, con sus diseños y toques sin abrir la app',
    ['WidgetCheckin', 'WidgetDia', 'WidgetKcal'].every(c => ex.includes(`widget('${c}'`) && ex.includes(`"java/${c}.java"`)) &&
    ['pf_widget_checkin', 'pf_widget_dia', 'pf_widget_kcal', 'pf_widget_chip'].every(f => ex.includes(f + '.xml"')) && /a\.startsWith\(Widgets\.ACT\)/.test(ex));
  comprobar('widgets 1.5: la app aplica agua, deshacer, ayuno y check-in del widget, y les manda los textos traducidos',
    ['water', 'wundo', 'fastStart', 'fastEnd', 'chk'].every(t => nat.includes(`a.type === '${t}'`)) && /window\.pfWidgetApply/.test(nat) && /kMac:/.test(nat) && /'widgetAction'/.test(nat));
  { const ix = fs.readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
    comprobar('1.6: ningún texto se corta con «…» (regla de la casa)', !/text-overflow:\s*ellipsis/.test(ix) && !/line-clamp/.test(ix.replace(/\.rcard \.exs\{[^}]*\}/,'')));
    comprobar('1.6: iPhone con estilo propio (barras translúcidas, interruptores de Apple) y el audio se recrea tras una interrupción de iOS', /html\.native-ios #nav\{[^}]*backdrop-filter/.test(ix) && /#34c759/.test(ix) && /audioCtx\.state!=='running' && ACTX_T/.test(ix) && !/audioCtx=audioCtx\|\|new/.test(ix));
    comprobar('1.6: el escáner no usa en iPhone la comprobación de Google (solo existe en Android) y se puede escribir el código', /if \(!window\.PF_IOS\)\{ try\{ const m=await B\.isGoogleBarcodeScannerModuleAvailable/.test(ix) && /A\.alCodigo=/.test(ix) && /async function alPorCodigo/.test(ix));
    comprobar('1.7: iPhone vuelve atrás deslizando desde el borde izquierdo (solo en iPhone, sin ventanas abiertas)', /if \(!window\.PF_IOS \|\| !LAYERS\.length \|\| MODALS\.length/.test(ix) && /goBack\(\); requestAnimationFrame/.test(ix));
    comprobar('1.7: en iPhone dice «del iPhone» y no «de el iPhone»', fs.readFileSync(new URL('../scripts/version-ios.mjs', import.meta.url), 'utf8').includes("'del iPhone, del Apple Watch u otras apps'"));
    comprobar('1.6: Salud en iPhone explica el motivo real si no conecta', /No se pudo conectar con Salud/.test(nat)); }
  comprobar('Google Play: símbolos nativos en el AAB y la cámara no es obligatoria', /debugSymbolLevel 'SYMBOL_TABLE'/.test(ex) && /'android\.hardware\.camera'/.test(ex) && /android:required="false" tools:replace/.test(ex));
}

/* ---------- 1.8: Parte A (Nutrición, Ayuno, Historial), PandarIA v3 (Parte C) y arreglos invisibles (Parte D) ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE); const out={}; const H=3600000; window.isPremium=()=>true;
    // Parte A
    TAB='historial'; HSEG='informes'; render(); const vh=document.querySelector('#view');
    out.h4=vh.querySelectorAll('.seg [data-a="hgrp"]').length===4 && vh.querySelector('.seg .on').dataset.v==='g:resumen' && !!vh.querySelector('.chip.on[data-v="informes"]');
    A.hgrp('g:progreso'); out.h4b=HSEG==='progreso'; A.hgrp('g:resumen'); out.h4c=HSEG==='informes';
    TAB='nutricion'; NSEG='comida'; render(); out.nutHdr=!!document.querySelector('#view .hdr [data-a="nutMas"]') && !document.querySelector('#view [data-a="openSup"]');
    NSEG='agua'; render(); out.aguaSin=!document.querySelector('#view svg.chart'); NSEG='comida';
    const f=nut().fast; f.screened=true; f.plan='20:4'; f.history=[]; TAB='ayuno'; render(); const va=document.querySelector('#view');
    out.ayBtn=!!va.querySelector('[data-a="fastPlanPick"]') && !va.querySelector('[data-a="fastPlan"]'); out.ayUno=(fastAdvice().match(/class="row sm"/g)||[]).length===1;
    A.fastPlanPick(); out.aySel=document.querySelectorAll('#modals .opt').length===Object.keys(FAST_PLANS).length; closeModal();
    // estado del día
    S.sessions=[]; S.checkinDia=null; out.eSin=estadoDia().score===null;
    S.checkinDia={day:dayKey(),sleep:2,energy:2,sore:2}; const e1=estadoDia(); out.eBien=e1.score===100&&e1.w==='listo';
    S.checkinDia={day:dayKey(),sleep:0,energy:0,sore:0}; const e2=estadoDia(); out.eMal=e2.score===60&&e2.w==='normal'&&e2.top.length===3;
    window.PF_SUENO={last:300,avg:420,n:10,at:Date.now()}; window.PF_HRV={last:40,avg:60,n:10,at:Date.now()}; const e3=estadoDia(); out.eSuave=e3.score===38&&e3.w==='descansa'&&e3.soft;
    window.PF_SUENO=null; window.PF_HRV=null; S.checkinDia=null;
    // tu línea base: con menos de 14 días no compara
    const n=nut(); n.water={}; for (let i=1;i<=10;i++) n.water[dayKey(Date.now()-i*86400000)]=2000; out.lbFalta=lineaBase().find(o=>o.id==='agua').falta===4;
    for (let i=11;i<=20;i++) n.water[dayKey(Date.now()-i*86400000)]=2000; n.water[dayKey()]=2500; const lb=lineaBase().find(o=>o.id==='agua'); out.lbOk=!lb.falta&&lb.n0===20&&lb.pct===25;
    // cansancio acumulado: 3 señales distintas, 2 días o más cada una
    window.PF_HRV={last:40,avg:60,n:10,at:Date.now()}; window.PF_RHR={last:60,avg:50,n:10,at:Date.now()}; S.diaLog={};
    for (let i=0;i<3;i++) S.diaLog[dayKey(Date.now()-i*86400000)]={hrv:40,rhr:60,su:300};
    out.caSi=(cansancioAcum()||{tipos:[]}).tipos.length===3;
    S.lastDeload=Date.now()-5*86400000; out.caNo=cansancioAcum()===null; S.lastDeload=null;
    // la propuesta llega por el panda y se aplica con permiso
    S.panda=null; S.settings.burbuja=true; const I0=pandaItems(); out.pProp=I0.prop.length===1&&I0.prop[0].v3&&/descarga/i.test(I0.prop[0].t);
    A.guiaAbrir(); out.pBtn=!!document.querySelector('#modals [data-a="pandaAplicar"]'); A.pandaAplicar(I0.prop[0].k); out.pAplica=deloadActive()&&!MODALS.length;
    out.pDia=pandaItems().prop.length===0;
    window.PF_HRV=null; window.PF_RHR=null; S.diaLog={}; S.deload=null; S.lastDeload=null; S.panda=null;
    // tus hábitos: siempre saltas los miércoles y entrenas los sábados
    S.routines=[newRoutine({name:'A',items:[buildItem('press_banca','musculo',2)]})]; S.plan={days:[1,3,5],order:[S.routines[0].id]};
    S.sessions=[]; const wk0=weekKey(Date.now());
    for (let w=1;w<=6;w++) [0,4,5].forEach(d=>{ const t=wk0-w*7*86400000+d*86400000+18*H; S.sessions.push({id:'h'+w+d,routineId:S.routines[0].id,start:t-H,end:t,items:[],intensity:6}); });
    const hb=habitosPlan(); out.hab=!!(hb&&hb.salta&&hb.salta.d===3&&hb.salta.por===6);
    const pr=v3Propuestas().find(x=>/^dia-/.test(x.k)); pr.fn(); out.habAplica=S.plan.days.join()==='1,5,6';
    // aprender cómo respondes: semanas con más series de pecho progresan más
    S.sessions=[]; S.plan=null; let kg=60;
    for (let w=10;w>=1;w--){ const alto=w%2===0, t=wk0-w*7*86400000+2*86400000+18*H; S.sessions.push({id:'a'+w,routineId:'x',start:t-H,end:t,intensity:7,items:[{exId:'press_banca',sets:Array.from({length:alto?16:8},()=>({t:'n',kg,reps:8,done:true}))}]});
      S.sessions.push({id:'b'+w,routineId:'x',start:t+86400000-H,end:t+86400000,intensity:7,items:[]}); kg=Math.round(kg*(alto?1.03:1.0)*10)/10; }
    const ap=aprendeSeries(); out.apr=ap.length===1&&ap[0].m==='pecho'&&ap[0].dir===1;
    // predicciones con margen: un rango de meses, solo con tendencia clara
    S.measures=[]; for (let i=40;i>=0;i-=2) S.measures.push({id:'p'+i,date:Date.now()-i*86400000,peso:90-(40-i)*0.07}); S.goals=[{id:'g',type:'peso',target:84}];
    const pp=pesoPrediccion(); out.pred=!!(pp&&pp.desde&&pp.hasta);
    S.measures=S.measures.map((m,i)=>Object.assign({},m,{peso:90+(i%2?0.4:-0.4)})); out.predNo=pesoPrediccion()===null;
    // mirar el diario no crea datos
    delete S.nutri.diario; diaDiario(dayKey()); out.diarioRO=!('diario' in S.nutri);
    // datos que crecen: se compactan solo avisos con fecha y el detalle de vasos de hace más de un año
    S.dismissed={'tip-Mon Jan 05 2026':1,['tip-'+new Date().toDateString()]:1,'upd-12':1}; n.waterLog={'2025-01-01':[{t:1,ml:250}],[dayKey()]:[{t:2,ml:250}]}; n.water['2025-01-01']=250; S.compactado=null;
    const nc=compactarDatos(); out.comp=nc===2&&!S.dismissed['tip-Mon Jan 05 2026']&&S.dismissed['upd-12']&&!n.waterLog['2025-01-01']&&n.water['2025-01-01']===250;
    out.uso=typeof usoDatos().pct==='number';
    // informe de pruebas 1.8: récord sin peso, doble toque en «Terminar», pausa tras una descarga, RIR alto, objetivo raro
    S.sessions=[{id:'r0',routineId:'x',start:Date.now()-2*H,end:Date.now()-H,intensity:6,items:[{exId:'press_banca',sets:[{t:'n',kg:0,reps:12,done:true}]}]}];
    out.recSinPeso=!/undefined/.test(histRecords()) && /12 reps/.test(histRecords());
    S.routines=[newRoutine({name:'F',pandaria:true,items:[buildItem('press_banca','musculo',3)]})]; _startWorkout(S.routines[0].id); MODALS.length=0; renderModals(); out.dobleAct=!!S.active;
    if (S.active){ const it=S.active.items[0]; it.sets[0].kg=40; it.sets[0].reps=8; it.sets[0].done=true; }
    const n0=S.sessions.length; let dobleOk=true; try{ finishWorkout('keep'); finishWorkout('keep'); A.wkFinish(); }catch(e){ dobleOk=false; } out.doble=dobleOk && S.sessions.length===n0+1;
    LAYERS.length=0; renderLayers();
    const r=S.routines[0], it=r.items[0], mk=(d,kg,extra)=>Object.assign({id:'p'+d,routineId:r.id,start:Date.now()-d*86400000-H,end:Date.now()-d*86400000,intensity:7,items:[{exId:'press_banca',sets:[1,2,3].map(()=>({t:'n',kg,reps:10,done:true}))}]},extra||{});
    S.sessions=[mk(20,50), mk(13,50,{ajuste:{f:0.9}}), mk(6,50,{ajuste:{f:0.9}})];
    out.pausa=!/^Volviste/.test(suggestSet(r,it,0).why||'');
    S.sessions=[mk(3,40)]; S.sessions[0].items[0].sets.forEach(s=>{ s.reps=8; s.rir=6; });
    const sg=suggestSet(r,it,0); out.rir=/^Te sobraron/.test(sg.why) && sg.kg>40 && sg.kg<=48;
    nut().goal='subir'; const cn=calcNutrition(); out.metaRara=!!cn && !isNaN(cn.prot) && !isNaN(cn.carbs); nut().goal='mantener';
    return JSON.stringify(out); })()`));
  a.cerrar();
  comprobar('1.8: Historial en 4 pestañas con subpestañas (nada se pierde)', r.h4 && r.h4b && r.h4c, JSON.stringify([r.h4, r.h4b, r.h4c]));
  comprobar('1.8: Nutrición con suplementos y menús en la cabecera, y la gráfica del agua en Estadísticas', r.nutHdr && r.aguaSin, JSON.stringify([r.nutHdr, r.aguaSin]));
  comprobar('1.8: Ayuno con el plan en un botón (selector con explicación) y un solo consejo', r.ayBtn && r.ayUno && r.aySel, JSON.stringify([r.ayBtn, r.ayUno, r.aySel]));
  comprobar('1.8: estado del día (sin datos no da número; check-in, sueño y variabilidad restan lo que dice la regla)', r.eSin && r.eBien && r.eMal && r.eSuave, JSON.stringify([r.eSin, r.eBien, r.eMal, r.eSuave]));
  comprobar('1.8: tu línea base solo con 14 días de datos y frente a tu propia media', r.lbFalta && r.lbOk, JSON.stringify([r.lbFalta, r.lbOk]));
  comprobar('1.8: cansancio acumulado con 3 señales repetidas, nunca justo después de una descarga', r.caSi && r.caNo, JSON.stringify([r.caSi, r.caNo]));
  comprobar('1.8: la propuesta llega por el panda, se aplica solo con «Aplicar» y como mucho una al día', r.pProp && r.pBtn && r.pAplica && r.pDia, JSON.stringify([r.pProp, r.pBtn, r.pAplica, r.pDia]));
  comprobar('1.8: tus hábitos (el día que siempre saltas se cambia por el que de verdad entrenas)', r.hab && r.habAplica, JSON.stringify([r.hab, r.habAplica]));
  comprobar('1.8: aprender cómo respondes (más series de pecho cuando con más progresas más)', r.apr, JSON.stringify(r.apr));
  comprobar('1.8: predicción de tu meta como rango de meses, y ninguna si el peso sube y baja', r.pred && r.predNo, JSON.stringify([r.pred, r.predNo]));
  comprobar('1.8: mirar el diario no crea datos vacíos', r.diarioRO);
  comprobar('1.8 (simulaciones): un récord sin peso muestra sus repeticiones, no «undefined»', r.recSinPeso);
  comprobar('1.8 (simulaciones): un doble toque en «Terminar» guarda un solo entreno y no da error', r.doble && r.dobleAct, JSON.stringify([r.doble, r.dobleAct]));
  comprobar('1.8 (simulaciones): tras una descarga o días suaves PandarIA no cree que volviste de una pausa', r.pausa);
  comprobar('1.8 (simulaciones): si te sobraron muchas repeticiones, el peso se recalcula (como mucho +20 %)', r.rir);
  comprobar('1.8 (simulaciones): un objetivo de nutrición desconocido no deja metas en NaN', r.metaRara);
  comprobar('1.8: datos que crecen: se compactan avisos viejos y vasos de hace más de un año, sin tocar los totales', r.comp && r.uso, JSON.stringify([r.comp, r.uso]));
  const nat = fs.readFileSync(new URL('../www/native.js', import.meta.url), 'utf8'), ex = fs.readFileSync(new URL('../scripts/android-extra.mjs', import.meta.url), 'utf8');
  comprobar('1.8: el widget Mi día muestra el estado del día', /today\.estado = E && E\.score != null/.test(nat) && ex.includes('optString(\\"estado\\"'));
}

/* ---------- 1.8: las fuentes de PandarIA se vinculan y combinan bien ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const ix = fs.readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE); const out={}; const H=3600000, D=86400000; window.isPremium=()=>true;
    // integridad: cada regla con fuentes existentes, cada fuente usada, textos en inglés y enlaces que abren una regla real
    out.srcMal=KB_RULES.flatMap(r=>r.src.filter(s=>!KB_SRC[s]).map(s=>r.id+'→'+s));
    const usadas=new Set(KB_RULES.flatMap(r=>r.src)); out.srcSinUso=Object.keys(KB_SRC).filter(s=>!usadas.has(s));
    out.sinEN=KB_RULES.filter(r=>!KB_EN_T[r.id]).map(r=>r.id);
    out.nRules=KB_RULES.length; out.nSrc=Object.keys(KB_SRC).length;
    // quitar el plan semanal pide confirmación (antes se perdía con un toque)
    S.plan={days:[1,3,5],order:[]}; MODALS.length=0; A.plDel(); out.planSigue=!!S.plan && !!document.querySelector('#modals .btn'); MODALS.length=0; renderModals(); S.plan=null;
    // cada fuente lista las otras reglas que salen de ella
    A.kbOpen('obj.fuerza'); out.otras=!!document.querySelector('#modals [data-a="kbOpen"][data-v="obj.musculo"]'); MODALS.length=0; renderModals();
    // combinaciones: volver tras 12 semanas, en un día con poco descanso y en descarga: nunca más de un 40 % menos
    S.routines=[newRoutine({name:'C',pandaria:true,items:[buildItem('press_banca','musculo',3)]})]; const R=S.routines[0], IT=R.items[0];
    const mk=(d,kg,reps,extra)=>Object.assign({id:'c'+d+kg,routineId:R.id,start:Date.now()-d*D-H,end:Date.now()-d*D,intensity:7,items:[{exId:'press_banca',sets:[1,2,3].map(()=>({t:'n',kg,reps,done:true}))}]},extra||{});
    S.sessions=[mk(90,60,10)]; const base=suggestSet(R,IT,0).kg;
    S.deload={start:Date.now()-D,until:Date.now()+6*D}; S.checkinDia={day:dayKey(),sleep:0,energy:0,sore:0};
    const comb=suggestSet(R,IT,0).kg; out.tope=comb>=Math.floor(60*0.6) && comb<base; S.deload=null; S.checkinDia=null;
    // Bosquet: 3 semanas sin el ejercicio no bajan el peso a los 30 años; a los 70 sí
    S.sessions=[mk(21,60,10)]; S.profile.age=30; out.pausa30=!/^Volviste/.test(suggestSet(R,IT,0).why);
    S.profile.age=70; out.pausa70=/^Volviste/.test(suggestSet(R,IT,0).why); S.profile.age=30;
    // máximo estimado: con series de 10 o menos solo cuentan esas
    out.e1=Math.round(e1Sesion([{kg:100,reps:5},{kg:60,reps:20}]))===Math.round(100*(1+5/30)) && Math.round(e1Sesion([{kg:60,reps:12}]))===Math.round(60*(1+12/30));
    // descarga: una serie menos en ejercicios de 3 o más
    S.sessions=[mk(3,60,10)]; S.deload={start:Date.now()-D,until:Date.now()+6*D}; const nW=x=>x.sets.filter(s=>s.t!=='c').length, N=nW(IT); out.descSerie=N>=3 && nW(activeItemFrom(IT,R))===N-1; S.deload=null; out.normalSerie=nW(activeItemFrom(IT,R))===N; out.nW=N;
    // calibración: la primera serie de un ejercicio nuevo corrige las siguientes
    S.sessions=[]; S.settings.checkin=false; _startWorkout(R.id); MODALS.length=0; renderModals();
    const it=S.active.items[0], s0=it.sets[0], sug=s0.sk, obj=s0.sr; s0.kg=sug; s0.reps=obj+6; completeSet(it.uid,0,true);
    out.calib=it.sets[1].sk>sug && it.sets[1].why==='Ajusté el peso con tu primera serie'; S.active=null; LAYERS.length=0; renderLayers(); MODALS.length=0; renderModals();
    // calorías del entreno (Compendio) y meta de pasos según la edad (Paluch)
    out.kcal=gastoSesion({start:0,end:3600000,intensity:8})===Math.round(6*S.profile.weight/10)*10 && gastoSesion({start:0,end:3600000,intensity:5})===Math.round(3.5*S.profile.weight/10)*10;
    out.pasos=pasosMeta()[0]===8000; S.profile.age=65; out.pasos=out.pasos&&pasosMeta()[0]===6000; S.profile.age=30;
    // FAO/OMS: el factor de actividad ya no se queda corto; Schoenfeld y Aragon: 0,4 g/kg por comida
    out.fao=kb('nut.actividad').sedentario===1.4; out.protComida=kb('nut.proteina_comida').gkg===0.4;
    return JSON.stringify(out); })()`));
  a.cerrar();
  // cada «por qué» del peso sugerido enlaza con una regla
  const whys = [...ix.matchAll(/res\.why='([^']+)'|n\.why='([^']+)'|why:'((?:Pasaste|No llegaste|Serie Bilbo|Pirámide|Completaste esta serie)[^']*)'/g)].map(m => m[1] || m[2] || m[3]);
  const rx = [...ix.match(/const KB_WHY=\[([\s\S]*?)\n\];/)[1].matchAll(/\[\/(.+?)\/(i?),'([a-z._]+)'\]/g)].map(m => new RegExp(m[1], m[2]));
  const sinRegla = whys.filter(w => !rx.some(x => x.test(w)));
  // cada enlace a una regla en el código apunta a una regla que existe
  const ids = new Set([...ix.matchAll(/\{id:'([a-z0-9_.]+)', area:/g)].map(m => m[1]));
  const enlaces = [...ix.matchAll(/kb(?:Link)?\('([a-z0-9_.]+)'/g)].map(m => m[1]).filter(x => x.includes('.') && !x.endsWith('.'));
  const rotos = [...new Set(enlaces.filter(x => !ids.has(x)))];
  comprobar(`1.8 fuentes: ${r.nRules} reglas y ${r.nSrc} fuentes, todas conectadas (ninguna fuente rota ni sin usar, todas con inglés)`, !r.srcMal.length && !r.srcSinUso.length && !r.sinEN.length, JSON.stringify([r.srcMal, r.srcSinUso, r.sinEN]));
  comprobar('1.8: quitar el plan semanal pide confirmación', r.planSigue);
  comprobar('1.8 fuentes: cada «por qué» del peso sugerido enlaza con su regla', !sinRegla.length, JSON.stringify(sinRegla));
  comprobar('1.8 fuentes: ningún enlace a una regla que no existe', !rotos.length, JSON.stringify(rotos));
  comprobar('1.8 fuentes: cada fuente muestra las otras reglas que salen de ella', r.otras);
  comprobar('1.8 fuentes: los ajustes que bajan el peso se suman con tope (nunca más de un 40 % menos)', r.tope);
  comprobar('1.8 fuentes: volver tras 3 semanas no baja el peso a los 30 años y sí a los 70 (Bosquet 2013)', r.pausa30 && r.pausa70, JSON.stringify([r.pausa30, r.pausa70]));
  comprobar('1.8 fuentes: el máximo estimado usa las series de 10 o menos si las hay (Mayhew 2008)', r.e1);
  comprobar('1.8 fuentes: en descarga una serie menos y un 10 % menos de peso (Bell 2023)', r.descSerie && r.normalSerie, JSON.stringify([r.descSerie, r.normalSerie]));
  comprobar('1.8 fuentes: la primera serie de un ejercicio nuevo calibra las siguientes', r.calib);
  comprobar('1.8 fuentes: calorías del entreno con el Compendio 2024 y meta de pasos según la edad (Paluch 2022)', r.kcal && r.pasos, JSON.stringify([r.kcal, r.pasos]));
  comprobar('1.8 fuentes: factor de actividad de la FAO/OMS y proteína por comida de Schoenfeld y Aragon', r.fao && r.protComida);
}

/* ---------- 1.8: lastre en ejercicios de peso corporal y ejercicios nuevos ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE); const out={}; const H=3600000, D=86400000; window.isPremium=()=>true;
    out.nLX=Object.keys(LX).length; const pk=(q,id)=>pkList({q,m:''}).includes('data-v="'+id+'"'); out.ocultos=!pk('dominadas','dominadas_lastre'); out.buscar=pk('dominadas lastre','dominadas_lastre');
    out.bayitas=pk('bayitas','ext_triceps_cuerpo'); out.planchas=pk('planchas','flexiones');
    out.nuevos=['ext_triceps_cuerpo','fondos_barra','curl_cuerpo','crunch_inverso','toes_to_bar','pino_pared','zancada_salto','sentadilla_bulgara_pc','flexiones_hindues','remo_renegado'].filter(i=>!EX[i]||!a3of(EX[i]));
    out.lx3d=Object.keys(LX).filter(i=>!a3of(LX[i]) && a3of(EX[LX[i].base]));
    // primer lastre a partir de tus repeticiones sin él (80 kg, 15 dominadas → unos 12,5 kg para 8)
    S.sessions=[{id:'b',start:Date.now()-2*D-H,end:Date.now()-2*D,intensity:7,items:[{exId:'dominadas',sets:[{t:'n',reps:15,done:true},{t:'n',reps:14,done:true}]}]}];
    out.est=estimateKg('dominadas_lastre',8);
    // en la rutina: activar lastre cambia el ejercicio y pone kg; quitarlo los borra
    S.routines=[newRoutine({name:'L',pandaria:true,items:[buildItem('dominadas','musculo',2)]})]; const R=S.routines[0], IT=R.items[0];
    lastreCambia(IT,'dominadas_lastre',false); out.cambia=IT.exId==='dominadas_lastre' && IT.sets.every(x=>x.kg===out.est);
    // doble progresión con lastre: tope del rango con 0 kg → sube 2,5; con 10 kg → 12,5
    const mk=(kg,reps)=>({id:'l'+kg,routineId:R.id,start:Date.now()-D-H,end:Date.now()-D,intensity:7,items:[{exId:'dominadas_lastre',sets:[1,2,3].map(()=>({t:'n',kg,reps,done:true}))}]});
    IT.range=[8,12]; S.sessions=[mk(0,12)]; out.sube0=suggestSet(R,IT,0).kg; S.sessions=[mk(10,12)]; out.sube10=suggestSet(R,IT,0).kg;
    lastreCambia(IT,'dominadas',false); out.quita=IT.exId==='dominadas' && IT.sets.every(x=>x.kg==null);
    // en un entreno: las series hechas se quedan en 0 kg y las que faltan llevan el lastre sugerido
    const it={uid:'u1',exId:'dominadas',range:[8,12],sets:[{t:'n',reps:10,done:true},{t:'n',sr:10,done:false}]}; S.sessions=[mk(10,10)];
    lastreCambia(it,'dominadas_lastre',true); out.vivo=it.sets[0].kg===0 && it.sets[1].sk===10;
    // PandarIA propone lastre cuando te pasas 3 repeticiones del rango (con pesas en tu equipo)
    S.settings.equip=EQUIP_GYM.slice(); const R2=newRoutine({name:'P',pandaria:true,items:[buildItem('dominadas','musculo',2)]}); R2.items[0].range=[8,12]; S.routines=[R2];
    S.sessions=[1,2,3].map(k=>({id:'p'+k,routineId:R2.id,start:Date.now()-k*2*D-H,end:Date.now()-k*2*D,intensity:7,items:[{exId:'dominadas',uid:R2.items[0].uid,sets:[1,2,3].map(()=>({t:'n',reps:16,done:true}))}]}));
    const pr=reviewExercise(R2,R2.items[0]); out.propone=!!pr && pr.data && pr.data.to==='dominadas_lastre';
    applySuggestion(R2,Object.assign({id:'x'},pr)); out.aplica=R2.items[0].exId==='dominadas_lastre' && R2.items[0].sets.every(x=>x.kg>0);
    // compartir una rutina con lastre: se comparte como el ejercicio de peso corporal
    try { const R3=newRoutine({name:'C',items:[Object.assign(buildItem('dominadas','musculo',2),{exId:'dominadas_lastre'})]}); const c=encodeRoutine?encodeRoutine(R3):null; out.codigo=!!c; } catch(e){ out.codigo='err '+e.message; }
    return JSON.stringify(out); })()`));
  comprobar(`1.8 lastre: ${r.nLX} ejercicios de peso corporal tienen versión con lastre, ocultos en la biblioteca salvo al buscarlos`, r.nLX >= 25 && r.ocultos && r.buscar, JSON.stringify([r.nLX, r.ocultos, r.buscar]));
  comprobar('1.8 lastre: el primer lastre sale de tus repeticiones sin él (15 dominadas a 80 kg → 12,5 kg para 8)', r.est === 12.5, String(r.est));
  comprobar('1.8 lastre: activar y quitar el lastre en la rutina', r.cambia && r.quita, JSON.stringify([r.cambia, r.quita]));
  comprobar('1.8 lastre: doble progresión desde 0 kg y con lastre (sube 2,5 kg al llegar al tope)', r.sube0 === 2.5 && r.sube10 === 12.5, JSON.stringify([r.sube0, r.sube10]));
  comprobar('1.8 lastre: en un entreno las series hechas quedan sin lastre y las que faltan llevan el sugerido', r.vivo);
  comprobar('1.8 ejercicios nuevos: los 10 existen con animación 3D, y todas las versiones con lastre también', !r.nuevos.length && !r.lx3d.length, JSON.stringify([r.nuevos, r.lx3d]));
  comprobar('1.8 lastre: PandarIA propone añadir lastre en dominadas al pasarte 3 repeticiones del rango, y al aceptar pone kg', r.propone && r.aplica, JSON.stringify([r.propone, r.aplica]));
  comprobar('1.8 lastre: una rutina con lastre se puede compartir con código', r.codigo === true, String(r.codigo));
  comprobar('1.8 búsqueda: «bayitas» encuentra la extensión de tríceps y «planchas» las flexiones', r.bayitas && r.planchas);
  a.cerrar();
}

/* ---------- 1.8.1: menú de 4 pestañas, Nutrición recogida y buscador de ingredientes ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE); const out={}; window.isPremium=()=>true; S.settings.orden181=1;
    // buscador de recetas: con el buscador abierto dos veces, escribir actualiza la lista de arriba
    LAYERS.length=0; openLayer('alimBuscar',{m:'almuerzo',q:'',tab:'todo',cat:''}); openLayer('receta',{r:{id:'rx',n:'',rac:2,items:[]},isNew:true}); openLayer('alimBuscar',{receta:true,q:'',tab:'todo',cat:''});
    const ins=[...document.querySelectorAll('input[data-in="alQ"]')], top=ins[ins.length-1]; top.value='arroz'; top.dispatchEvent(new Event('input',{bubbles:true}));
    const L=[...document.querySelectorAll('#allist')]; out.receta=L.length===2 && /Arroz blanco/.test(L[1].textContent) && !/Arroz blanco/.test(L[0].textContent); LAYERS.length=0; renderLayers();
    // plurales y errores de una letra, solo si la búsqueda exacta no encuentra nada
    const q=t=>(alimSearch(t)[0]||{}).n; out.busca=[q('tomates'),q('huevos'),q('arros'),q('bananna'),q('pera'),q('tasajo'),q('yerba mate')];
    // menú: 4 pestañas; Explorar abre su capa y el + tiene sus tres grupos
    A.tab('explorar'); out.explorar=TAB==='rutinas' && LAYERS.length && LAYERS[LAYERS.length-1].t==='explorar'; LAYERS.length=0; renderLayers();
    A.newRoutine(); const m=document.querySelector('#modals').textContent; out.mas=['Explorar ejercicios y rutinas','Crea tu propia rutina','Modo intervalos','Entrenar ahora'].every(t=>m.includes(t)); MODALS.length=0; renderModals();
    out.sinIntervalosArriba=!/data-a="openIntervals"/.test(viewRutinas());
    // gratis con 3 rutinas: Explorar e intervalos se abren; crear una rutina pide Premium
    const pay0=window.pfPay; let pago=null; window.pfPay=x=>{ pago=x; };
    window.__pago=()=>pago; window.__pay0=pay0;
    // Nutrición: bloques desplegables recordados; ayuno en curso con franja en Comida
    NSEG='comida'; nut().fast.screened=true; nut().fast.active={start:Date.now()-3600000*5,goalH:16}; let v=viewNutricion();
    out.franja=/data-a="nseg" data-v="ayuno"/.test(v) && /Ayunando/.test(v); out.objCerrado=!/data-a="nGoal"/.test(v);
    A.fold('objetivo'); v=viewNutricion(); out.objAbierto=/data-a="nGoal"/.test(v) && S.settings.fold.objetivo===true; A.fold('objetivo');
    A.nseg('ayuno'); out.recuerda=S.settings.nseg==='ayuno'; NSEG=null; viewNutricion(); out.recuerda=out.recuerda&&NSEG==='ayuno'; nut().fast.active=null; A.nseg('comida');
    return JSON.stringify(out); })()`));
  // las opciones del + se ejecutan 90 ms después de cerrar la hoja: se espera entre toque y comprobación
  const opc = async t => { a.w.eval(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers(); A.newRoutine(); [...document.querySelectorAll('#modals [data-a=cbm]')].find(b=>${t}.test(b.textContent)).click();`); await espera(400); };
  a.w.eval(`window.isPremium=()=>false; S.routines=[1,2,3].map(i=>newRoutine({name:'R'+i})); window.pfRoomFor=n=>S.routines.length+n<=3;`);
  await opc('/Explorar ejercicios/'); r.gratisExplora = a.w.eval(`!!LAYERS.length && LAYERS[LAYERS.length-1].t==='explorar' && !__pago()`);
  await opc('/Crea tu propia/'); r.gratisCrea = a.w.eval(`__pago()==='routines'`);
  a.w.eval(`MODALS.length=0; renderModals(); LAYERS.length=0; window.pfPay=__pay0; window.isPremium=()=>true; S.routines=[];`);
  comprobar('1.8.1 recetas: el buscador de ingredientes actualiza su propia lista (antes no mostraba nada)', r.receta);
  comprobar('1.8.1 buscador: plurales y errores de una letra (tomates, huevos, arros, bananna) sin estropear la búsqueda exacta (pera)', JSON.stringify(r.busca) === JSON.stringify(['Tomate', 'Huevo', 'Arroz blanco cocido', 'Banana', 'Pera', 'Carne seca salada', 'Té']), JSON.stringify(r.busca));
  comprobar('1.8.1 menú: Explorar se abre desde Rutinas y el + tiene Explorar, Crear rutina y Entrenar ahora', r.explorar && r.mas && r.sinIntervalosArriba, JSON.stringify([r.explorar, r.mas, r.sinIntervalosArriba]));
  comprobar('1.8.1 gratis con 3 rutinas: Explorar se abre; crear una rutina pide Premium', r.gratisExplora && r.gratisCrea, JSON.stringify([r.gratisExplora, r.gratisCrea]));
  comprobar('1.8.1 Nutrición: franja del ayuno, objetivo desplegable que se recuerda y última sección recordada', r.franja && r.objCerrado && r.objAbierto && r.recuerda, JSON.stringify([r.franja, r.objCerrado, r.objAbierto, r.recuerda]));
  a.cerrar();
}

/* ---------- 1.8.2: lo que encontró la simulación de un año ---------- */
{
  // cambio de hora: racha, gráfica y informe semanal con la hora de España y la de Nueva York
  for (const tz of ['Europe/Madrid', 'America/New_York']) {
    let r = {}; try { r = JSON.parse(execFileSync(process.execPath, [new URL('./sim/cambio-hora.mjs', import.meta.url).pathname], { env: Object.assign({}, process.env, { TZ: tz }), encoding: 'utf8' }).trim().split('\n').pop()); } catch (e) { r = { error: String(e).slice(0, 200) }; }
    comprobar(`1.8.2 cambio de hora (${tz}): 8 semanas seguidas dan racha 8, la gráfica las ve todas y el informe compara con la semana anterior`, r.racha === 8 && r.semanas === 8 && r.previa === 1 && !r.errores, JSON.stringify(r));
  }
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE); window.isPremium=()=>true; const out={};
    const ids=['press_banca','remo_barra','press_militar','curl_barra','sentadilla'];
    const mk=n=>__routine(ids.slice(0,n).map(id=>buildItem(id,'musculo',2)));
    const ses=(r,plan,hechos,dias)=>{ S.sessions.push({id:uid(),routineId:r.id,routineName:r.name,start:Date.now()-dias*DAY-3600e3,end:Date.now()-dias*DAY,intensity:7,planned:plan,items:hechos.map(id=>({exId:id,sets:[{t:'n',kg:20,reps:10,done:true}]}))}); };
    // un ejercicio recién cambiado (no estaba planeado en las sesiones anteriores) no se propone quitar
    let r1=mk(5); const nuevo='press_inclinado_man'; r1.items[4].exId=nuevo;
    for (let i=4;i>=1;i--) ses(r1,ids.slice(0,5),ids.slice(0,4),i*7);
    out.nuevo=ejercicioSaltado(); S.sessions=[];
    // uno planeado y saltado 3 de 4 veces sí se propone
    for (let i=4;i>=1;i--) ses(r1,ids.slice(0,4).concat([nuevo]),i===4?ids.slice(0,4).concat([nuevo]):ids.slice(0,4),i*7);
    const sa=ejercicioSaltado(); out.saltado=sa&&sa.it.exId; S.sessions=[];
    // con 4 ejercicios ya no se quita ninguno
    S.routines=[]; const r2=mk(4); for (let i=4;i>=1;i--) ses(r2,ids.slice(0,4),ids.slice(0,3),i*7); out.minimo=ejercicioSaltado(); S.sessions=[]; S.routines=[];
    // las semanas de vacaciones no cuentan como días saltados
    const r3=mk(5); S.plan={days:[1,3,5],order:[r3.id]}; const wk0=weekKey(Date.now());
    for (let w=1;w<=8;w++) if (w>2){ for (const d of [0,4]) { const t=weekShift(wk0,-w)+d*DAY+18*3600e3; S.sessions.push({id:uid(),routineId:r3.id,start:t-3600e3,end:t,items:[],planned:[]}); } }
    S.sessions.sort((x,y)=>x.end-y.end); let hb=habitosPlan(); out.vacaciones=hb&&hb.salta&&hb.salta.sem; // 6 semanas con entrenos, no 8
    // con un plan de 2 días no se propone quitar ninguno
    S.plan={days:[1,3],order:[r3.id]}; S.sessions=S.sessions.filter(x=>new Date(x.end).getDay()===1); hb=habitosPlan(); out.dos=!!(hb&&hb.salta); // sin otro día al que cambiarlo S.sessions=[]; S.plan=null; S.routines=[];
    // peso muy bajo con objetivo mantener: aviso con profesional, sin ayuno, sin celebraciones, estado del día no «listo»
    __reset({name:'C',age:29,height:165,weight:43,sex:'m',fitness:'activo'}); nut().goal='mantener'; nut().fast.screened=true;
    out.card=/médico o nutricionista/.test(riesgoCard()); out.ayuno=/no recomendamos ayunar/.test(fastAdvice());
    S.checkins=S.checkins||{}; A.checkinHoy&&0; const E=estadoDia(); out.estado=E&&E.score!=null?E.score:'sin';
    // comer menos que el metabolismo en reposo 7 días seguidos
    __reset(MUJER); const D=nut().diario||(nut().diario={}); for (let i=1;i<=7;i++){ const k=dayKey(Date.now()-i*DAY); D[k]=[{id:'a'+i,fid:'20045',n:'Arroz',gr:300,k:450,m:'almuerzo'},{id:'b'+i,fid:'05062',n:'Pollo',gr:200,k:450,m:'cena'}]; }
    const rp=riesgoPeso(); out.poco=!!(rp&&rp.poco&&!rp.nivel);
    // mantener y bajando 0,8 % por semana: aviso con lo que come
    __reset(MUJER); nut().goal='mantener'; S.measures=[]; for (let i=0;i<5;i++) S.measures.push({id:'m'+i,date:Date.now()-(28-i*7)*DAY,peso:60-i*0.5});
    const c=calcNutrition(); out.deriva=c.notes.some(t=>/objetivo es mantener/.test(t));
    // ayuno olvidado: a las 48 h pregunta si sigue
    __reset(HOMBRE); nut().fast.screened=true; nut().fast.active={start:Date.now()-50*3600e3,goalH:16}; MODALS.length=0; fastOlvido(); out.olvido=/Sigues ayunando/.test(document.querySelector('#modals').textContent); MODALS.length=0; renderModals();
    // versión gratis: si hiciste todas las repeticiones, te lo dice
    __reset(HOMBRE); window.isPremium=()=>false; const rf=__routine([buildItem('press_banca','musculo',2)],{pandaria:false}); rf.items[0].sets.forEach(x=>{ x.kg=40; x.reps=8; });
    S.sessions.push({id:'f1',routineId:rf.id,start:Date.now()-3*DAY-3600e3,end:Date.now()-3*DAY,intensity:6,items:[{exId:'press_banca',sets:rf.items[0].sets.filter(x=>x.t!=='c').map(x=>({t:'n',kg:40,reps:8,done:true}))}]});
    out.gratis=suggestSet(rf,rf.items[0],rf.items[0].sets.findIndex(x=>x.t!=='c')).why; window.isPremium=()=>true;
    // sesión muy dura: si al ejercicio le sobraron repeticiones se progresa; si llegaste al fallo, se mantiene
    const dur=rir=>{ __reset(HOMBRE,{level:'intermedio'}); const rr=__routine([buildItem('press_banca','musculo',2)]); __hist(rr,{n:5,intensidad:10,rir}); const it=rr.items[0]; return suggestSet(rr,it,it.sets.findIndex(x=>x.t!=='c')).why; };
    out.duroSobra=dur(2); out.duroFallo=dur(0);
    // mancuernas ligeras: si el siguiente peso es un salto grande, primero más repeticiones
    __reset(HOMBRE,{level:'intermedio'}); const rm=__routine([buildItem('press_hombro_man','musculo',2)]); rm.items[0].range=[8,12]; __hist(rm,{n:4,base:0,paso:0,tope:true}); rm.items[0].sets.forEach(x=>{ if(x.t!=='c') x.kg=6; });
    S.sessions.forEach(ss=>ss.items.forEach(it=>it.sets.forEach(x=>{ x.kg=6; x.reps=12; })));
    const sg=suggestSet(rm,rm.items[0],rm.items[0].sets.findIndex(x=>x.t!=='c')); out.salto=[sg.kg,sg.reps,sg.why];
    // un toque en el objetivo se puede deshacer
    __reset(HOMBRE); nut().goal='mantener'; A.nGoal('bajar'); const und=document.querySelector('.toast.undo button'); out.undo=!!und; if (und) und.click(); out.undoOk=nut().goal==='mantener';
    return JSON.stringify(out); })()`));
  // lesión nueva desde el perfil: se ofrece cambiar los ejercicios que la cargan y, al aceptar, ya no queda ninguno
  a.w.eval(`__reset(HOMBRE); window.isPremium=()=>false; __routine(['zancadas','press_banca','ext_cuadriceps','remo_barra'].map(id=>buildItem(id,'musculo',2))); LAYERS.length=0; MODALS.length=0; A.openProfile(); A.pfInj('rodilla'); A.pfSave();`);
  await espera(700);
  r.lesionOfrece = a.w.eval(`/conviene cambiar/.test(document.querySelector('#modals').textContent)`);
  a.w.eval(`[...document.querySelectorAll('#modals [data-a=cbm]')].find(b=>/Cambiarlos/.test(b.textContent)).click();`);
  await espera(300);
  r.lesionQueda = a.w.eval(`lesionBloqueados().map(x=>x.it.exId).join(',')`);
  comprobar('1.8.2 rutinas: un ejercicio recién cambiado por PandarIA no se propone quitar «por saltado»', !r.nuevo, JSON.stringify(r.nuevo));
  comprobar('1.8.2 rutinas: un ejercicio planeado y saltado 3 de 4 veces sí se propone quitar', r.saltado === 'press_inclinado_man', String(r.saltado));
  comprobar('1.8.2 rutinas: con 4 ejercicios PandarIA ya no propone quitar ninguno', !r.minimo, JSON.stringify(r.minimo));
  comprobar('1.8.2 plan: las semanas de vacaciones no cuentan como días saltados, y con 2 días no se propone quitar ninguno', r.vacaciones === 6 && r.dos === false, JSON.stringify([r.vacaciones, r.dos]));
  comprobar('1.8.2 seguridad: con peso muy bajo y objetivo mantener hay aviso con profesional, sin ayuno, y el estado del día no sale «listo»', r.card && r.ayuno && (r.estado === 'sin' || r.estado < 80), JSON.stringify([r.card, r.ayuno, r.estado]));
  comprobar('1.8.2 seguridad: comer menos que el metabolismo en reposo 7 días seguidos se avisa', r.poco);
  comprobar('1.8.2 mantener: si el peso baja un 0,8 % por semana, la app lo dice', r.deriva);
  comprobar('1.8.2 ayuno: a las 48 h pregunta «¿Sigues ayunando?»', r.olvido);
  comprobar('1.8.2 gratis: si hiciste todas las repeticiones, la sugerencia dice «prueba a subir el peso»', /prueba a subir el peso/.test(r.gratis || ''), String(r.gratis));
  comprobar('1.8.2 objetivo: un toque en Bajar/Mantener/Ganar se puede deshacer', r.undo && r.undoOk, JSON.stringify([r.undo, r.undoOk]));
  comprobar('1.8.2 progresión: tras una sesión muy dura con repeticiones de sobra se progresa, y al fallo se mantiene', !/mantén/.test(r.duroSobra) && /mantén/.test(r.duroFallo), JSON.stringify([r.duroSobra, r.duroFallo]));
  comprobar('1.8.2 progresión: con mancuernas de 6 kg (salto a 8 kg, +33 %) primero se suman repeticiones', r.salto[0] === 6 && r.salto[1] > 12 && /salto grande/.test(r.salto[2]), JSON.stringify(r.salto));
  comprobar('1.8.2 lesión: al marcar la rodilla se ofrece cambiar sus ejercicios y, al aceptar, no queda ninguno (también gratis)', r.lesionOfrece && r.lesionQueda === '', JSON.stringify([r.lesionOfrece, r.lesionQueda]));
  comprobar('1.8.2 sin errores en estas comprobaciones', !a.errores.length, a.errores.join(' | '));
  a.cerrar();
}

/* ---------- 1.9 fase 1: logros que no se acaban ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE); window.isPremium=()=>true; const out={};
    // los escalones siguen para siempre: 10, 25 … 1.000 y después uno cada 500
    out.esc=[0,1,2,3,4,5,6,7,8,20].map(i=>hitoUmbral(HITOS.find(h=>h.id==='agua'),i));
    // 10 semanas cumpliendo un plan de 3 días, con agua y diario
    S.plan={days:[1,3,5],order:['r']}; const w0=weekKey(Date.now());
    for (let w=1;w<=10;w++) for (const d of [0,2,4]){ const t=weekShift(w0,-w)+d*DAY+18*3600e3; S.sessions.push({id:'s'+w+d,routineId:'r',start:t-3600e3,end:t,items:[],vol:1000,prs:[]}); }
    const n=nut(); n.water=n.water||{}; for (let i=1;i<=30;i++) n.water[dayKey(Date.now()-i*DAY)]=6000;
    n.diario=n.diario||{}; for (let i=1;i<=12;i++) n.diario[dayKey(Date.now()-i*DAY)]=[{id:'a'+i,fid:'20045',k:300},{id:'b'+i,fid:'05062',k:300}];
    hitosRevisar(); out.agua=S.hitos.agua.n; out.diario=S.hitos.diario.n; out.sem=S.repes.sem.length; out.mesOk=S.repes.mes.length>=1; out.aguaSem=S.repes.agua.length>=3;
    // lo ganado no se pierde aunque cambies el plan
    S.plan={days:[0,1,2,3,4,5,6],order:['r']}; hitosRevisar(); out.noPierde=S.repes.sem.length===out.sem;
    // ayunos con peso bajo: el hito se pausa
    __reset({name:'C',age:29,height:165,weight:43,sex:'m',fitness:'activo'}); nut().fast.screened=true; nut().fast.history=[...Array(12).keys()].map(i=>({start:Date.now()-(i+2)*DAY,end:Date.now()-(i+2)*DAY+16*3600e3,goalH:16,ok:true}));
    hitosRevisar(); out.pausa=(S.hitos.ayunos||{n:0}).n===0;
    // la pantalla de logros muestra lo que se repite y los hitos
    const h=histLogros(); out.pantalla=/Se repiten/.test(h)&&/Hitos/.test(h)&&/En pausa/.test(h);
    // reto estrella: 10 % más que el mes anterior, con tope
    __reset(HOMBRE); S.plan={days:[1,3,5],order:['r']}; const [d0]=mesRango(mesKey(Date.now())); const pm=new Date(d0); pm.setMonth(pm.getMonth()-1);
    for (let i=0;i<8;i++){ const t=pm.getTime()+i*3*DAY+18*3600e3; S.sessions.push({id:'p'+i,routineId:'r',start:t-3600e3,end:t,items:[],checkin:{sleep:2}}); }
    S.sessions.push({id:'hoy',routineId:'r',start:Date.now()-3*3600e3,end:Date.now()-2*3600e3,items:[],checkin:{sleep:2}});
    const es=retosMes().find(x=>x.estrella); out.estrella=es?[es.id,es.meta]:null;
    return JSON.stringify(out); })()`));
  comprobar('1.9 hitos: los escalones no se acaban (10, 25, 50, 100, 250, 500, 1.000 y uno cada 500)', JSON.stringify(r.esc) === JSON.stringify([10,25,50,100,250,500,1000,1500,2000,8000]), JSON.stringify(r.esc));
  comprobar('1.9 hitos: 30 días de agua dan 2 niveles y 12 días de diario 1', r.agua === 2 && r.diario === 1, JSON.stringify([r.agua, r.diario]));
  comprobar('1.9 se repiten: 10 semanas cumpliendo el plan son 10 semanas perfectas, con mes perfecto y semanas hidratadas', r.sem === 10 && r.mesOk && r.aguaSem, JSON.stringify([r.sem, r.mesOk, r.aguaSem]));
  comprobar('1.9 se repiten: lo ganado no se pierde al cambiar el plan', r.noPierde);
  comprobar('1.9 salud: con peso bajo los hitos de ayuno se pausan y la pantalla lo dice', r.pausa && r.pantalla, JSON.stringify([r.pausa, r.pantalla]));
  comprobar('1.9 reto estrella: sale con algo que usas y su meta tiene sentido', !!r.estrella && r.estrella[1] >= 1, JSON.stringify(r.estrella));
  comprobar('1.9 fase 1 sin errores', !a.errores.length, a.errores.join(' | '));
  a.cerrar();
}

/* ---------- 1.9 fase 4: Cardio ahora ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  a.w.eval(`(()=>{ __reset(HOMBRE); window.isPremium=()=>true; const out={};
    const rt=newRoutine({name:'Fuerza A',items:['press_banca','sentadilla','remo_barra'].map(id=>buildItem(id,'musculo',3))}); S.routines=[rt]; S.plan={days:[0,1,2,3,4,5,6],order:[rt.id]};
    S.settings.equip=['man']; out.sinCinta=!cardioActs().some(x=>x.id==='correr_cinta') && cardioActs().some(x=>x.id==='caminar');
    S.settings.equip=['man','cin']; out.conCinta=cardioActs().some(x=>x.id==='correr_cinta');
    A.openCardio(); const scr=SCREENS.cardio(pkP()); out.pantalla=/Actividad/.test(scr)&&/Moderada/.test(scr)&&/No sustituye/.test(scr)&&/kcal/.test(scr);
    A.cardioAct('correr'); A.cardioMin('30'); A.cardioInt('fuerte'); A.cardioNum('-5'); out.cfg=[pkP().cfg.act,pkP().cfg.min,pkP().cfg.int];
    A.cardioStart(); out.fases=INT.ph.length; INT.i=1; INT.t0=Date.now()-12*60000; INT.start=Date.now()-12*60000-5000;
    out.run=/Correr/.test(SCREENS.intRun())&&/\\+5 min/.test(SCREENS.intRun()); A.cardioMas(); out.mas=INT.ph[1].dur===30*60;
    intFinish(); const bt=[...document.querySelectorAll('[data-a="cbm"]')].find(b=>/Guardar/.test(b.textContent)); bt.click(); window.__c={out,rt}; return '{}'; })()`); await espera(300); const r = JSON.parse(a.w.eval(`(()=>{ const {out,rt}=window.__c;
    const s=S.sessions[S.sessions.length-1]; out.ses=[s.routineId,s.intensity,Math.round(s.cardio.work/60),s.items.length,s.routineName];
    out.racha=streakWeeks()>=1; out.pendiente=(rutinaHoyPendiente()||{}).id===rt.id; out.mini=!/Hoy ya entrenaste/.test(hoyMini());
    out.perfecta=!semanaPerfecta(weekKey(Date.now())); out.siguiente=nextInPlan().r.id===rt.id;
    const sum=SCREENS.summary(pkP()); out.oferta=/Empiezas ahora tu rutina/.test(sum)&&!/Te resultó fácil/.test(sum);
    // menos de un minuto: no se guarda
    const n0=S.sessions.length; closeLayer(); A.openCardio(); A.cardioStart(); INT.i=1; INT.t0=Date.now()-20000; intFinish(); out.corto=S.sessions.length===n0 && !INT;
    // con la rutina hecha hoy ya no se ofrece
    S.sessions.push({id:'hoyR',routineId:rt.id,routineName:'Fuerza A',start:Date.now()-60000,end:Date.now(),items:[],vol:0,prs:[]}); out.hecha=!rutinaHoyPendiente();
    return JSON.stringify(out); })()`));
  a.cerrar();
  comprobar('1.9 cardio: solo ofrece las máquinas de tu equipamiento', r.sinCinta && r.conCinta, JSON.stringify([r.sinCinta, r.conCinta]));
  comprobar('1.9 cardio: la pantalla pide actividad, tiempo e intensidad y avisa de que no sustituye el plan', r.pantalla && JSON.stringify(r.cfg) === '["correr",25,"fuerte"]', JSON.stringify([r.pantalla, r.cfg]));
  comprobar('1.9 cardio: temporizador de una fase con +5 min', r.fases === 2 && r.run && r.mas, JSON.stringify([r.fases, r.run, r.mas]));
  comprobar('1.9 cardio: terminar a mitad guarda el tiempo hecho con la intensidad elegida', r.ses[0] === '__cardio' && r.ses[1] === 8 && r.ses[2] === 12 && r.ses[3] === 0, JSON.stringify(r.ses));
  comprobar('1.9 cardio: cuenta para la racha pero la rutina de hoy sigue pendiente', r.racha && r.pendiente && r.mini && r.perfecta && r.siguiente, JSON.stringify([r.racha, r.pendiente, r.mini, r.perfecta, r.siguiente]));
  comprobar('1.9 cardio: el resumen ofrece empezar la rutina de hoy', r.oferta && r.hecha);
  comprobar('1.9 cardio: menos de un minuto no se guarda', r.corto);
  comprobar('1.9 fase 4 sin errores', !a.errores.length, a.errores.join(' | '));
}

/* ---------- 1.9 fase 5: datos del reloj tras el entreno ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE); S.profile.age=30; S.profile.weight=75; S.profile.sex='h'; window.isPremium=()=>true; const out={}; const t=Date.now()-3600e3;
    S.sessions.push({id:'c1',routineId:'__cardio',routineName:'Cardio · Correr',start:t,end:t+30*60000,intensity:8,items:[],prs:[],vol:0,cardio:{act:'correr',int:'fuerte',work:1800}});
    S.sessions.push({id:'f1',routineId:'r',routineName:'Fuerza',start:t,end:t+60*60000,intensity:7,items:[],prs:[],vol:1000});
    out.fc=fcMax();
    out.pocas=relojGuardar('c1',[120,130],0)===false && S.sessions[0].relojN===1 && !S.sessions[0].reloj;
    const hrs=[...Array(60).keys()].map(i=>130+(i%21)); relojGuardar('c1',hrs,3120.4); const c=S.sessions[0]; out.c=[c.reloj.hr,c.reloj.max,c.reloj.pasos,c.relojN===undefined];
    out.kc=relojKcal(c); out.gasto=gastoSesion(c); out.zona=relojZona(c);
    relojGuardar('f1',hrs,0); out.fuerzaKc=relojKcal(S.sessions[1])===null && gastoSesion(S.sessions[1])>0;
    const h=relojHtml(c); out.html=/Tu reloj/.test(h)&&/Pulso medio/.test(h)&&/Lo marcaste fuerte/.test(h)&&/3120/.test(h.replace(/[.,\\s]/g,''));
    window.isPremium=()=>false; out.gratis=/Tu reloj/.test(relojHtml(c)) && !/Lo marcaste/.test(relojHtml(c));
    window.isPremium=()=>true; replaceLayer('summary',{sid:'c1',created:[],ach:[]}); out.resumen=/Tu reloj/.test(document.querySelector('#layers').textContent);
    window.PF_HC_ON=true; S.sessions.push({id:'c2',routineId:'__cardio',routineName:'x',start:Date.now()-60000,end:Date.now(),intensity:6,items:[],prs:[],vol:0,cardio:{act:'caminar',int:'moderada',work:60}});
    out.espera=/Esperando los datos de tu reloj/.test(relojHtml(S.sessions[2])); window.PF_HC_ON=false; out.sinHc=relojHtml(S.sessions[2])==='';
    return JSON.stringify(out); })()`));
  a.cerrar();
  comprobar('1.9 reloj: pulso máximo con Tanaka (208 − 0,7 × edad)', r.fc === 187, String(r.fc));
  comprobar('1.9 reloj: con menos de 5 medidas de pulso y sin pasos no guarda nada y lo reintenta', r.pocas);
  comprobar('1.9 reloj: guarda pulso medio, máximo y pasos', JSON.stringify(r.c) === '[140,150,3120,true]', JSON.stringify(r.c));
  comprobar('1.9 reloj: en el cardio las calorías salen del pulso (Keytel) y se usan en el resumen', r.kc === 390 && r.gasto === 390, JSON.stringify([r.kc, r.gasto]));
  comprobar('1.9 reloj: 140 de 187 es zona moderada (75 %)', r.zona && r.zona.pct === 75 && r.zona.z === 'mod', JSON.stringify(r.zona));
  comprobar('1.9 reloj: en las pesas no se usa el pulso para las calorías', r.fuerzaKc);
  comprobar('1.9 reloj: el resumen muestra tu reloj y PandarIA avisa si lo marcaste fuerte y fue moderado', r.html && r.resumen, JSON.stringify([r.html, r.resumen]));
  comprobar('1.9 reloj: gratis ve sus datos; la interpretación es de Premium', r.gratis);
  comprobar('1.9 reloj: avisa que espera los datos solo si Health Connect está conectado', r.espera && r.sinHc, JSON.stringify([r.espera, r.sinHc]));
  comprobar('1.9 fase 5 sin errores', !a.errores.length, a.errores.join(' | '));
}

/* ---------- 1.8: copias de seguridad de cada versión publicada (de la 0.7 a la actual) ---------- */
{
  const dirC = new URL('./copias/', import.meta.url), fallosC = [];
  const files = fs.existsSync(dirC) ? fs.readdirSync(dirC).filter(f => /^copia-[\d.]+\.json$/.test(f)) : [];
  for (const fn of files) {
    const raw = fs.readFileSync(new URL(fn, dirC), 'utf8'), d0 = JSON.parse(raw);
    const a = abrir({ 'pandaria-fit-v1': raw }); await espera(1200);
    const st = JSON.parse(a.w.eval('JSON.stringify(S)'));
    const igual = k => JSON.stringify(st[k]) === JSON.stringify(d0[k]);
    let tabs = ''; for (const t of ['rutinas', 'explorar', 'nutricion', 'ayuno', 'historial', 'ajustes']) { try { a.w.eval(`TAB='${t}'; render();`); } catch (e) { tabs += t + ' '; } }
    a.w.eval(`S=DEF(); save(true); confirmBox=o=>o.ok(); importText(${JSON.stringify(raw)});`);
    const st2 = JSON.parse(a.w.eval('JSON.stringify(S)'));
    const mal = [!igual('routines') && 'rutinas', !igual('sessions') && 'entrenos', !igual('measures') && 'medidas', st.v !== a.w.eval('DATA_VER') && 'versión', tabs && 'pestañas: ' + tabs, a.errores.length && 'errores: ' + a.errores[0],
      JSON.stringify(st2.sessions) !== JSON.stringify(d0.sessions) && 'importar'].filter(Boolean);
    if (mal.length) fallosC.push(fn + ' → ' + mal.join(', '));
    a.cerrar();
  }
  comprobar(`1.8: las copias de seguridad de todas las versiones (${files.length}) se abren e importan sin perder nada`, files.length >= 10 && !fallosC.length, fallosC.join(' | ') || `solo ${files.length} copias`);
}

/* ---------- 1.8: 3 años de uso intenso: espacio y velocidad ---------- */
{
  const a = abrir();
  await espera(900);
  a.w.eval(AYUDAS());
  const r = JSON.parse(a.w.eval(`(()=>{ __reset(HOMBRE); const out={}; window.isPremium=()=>true; const D=86400000;
    const rs=[0,1,2].map(i=>newRoutine({name:'R'+i,items:['press_banca','sentadilla','remo_barra','press_militar','peso_muerto','curl_barra'].map(id=>buildItem(id,'musculo',3))})); S.routines=rs; S.plan={days:[1,3,5],order:rs.map(r=>r.id)};
    const n=nut(); nd(); n.waterLog={};
    for (let d=3*365; d>=1; d--){ const t=Date.now()-d*D, k=dayKey(t);
      if ([1,3,5].includes(new Date(t).getDay())){ const r=rs[d%3]; S.sessions.push({id:'s'+d,routineId:r.id,routineName:r.name,start:t-3600000,end:t,intensity:7,checkin:{sleep:2,energy:1,sore:2},items:r.items.map(it=>({exId:it.exId,note:'',sets:[1,2,3].map(()=>({t:'n',kg:60,reps:10,done:true,rir:2}))})),prs:[],vol:5400}); }
      n.diario[k]=[1,2,3,4,5,6].map(j=>({id:'d'+j,fid:'09003',n:'Manzana con piel',gr:150,m:'desayuno',t:t+j*3600000,k:78,p:0.5,c:20,g:0.3,f:3,a:15,na:2}));
      n.water[k]=2400; n.waterLog[k]=[1,2,3,4,5,6,7,8].map(j=>({t:t+j*3600000,ml:300}));
      if (d%7===0) S.measures.push({id:'m'+d,date:t,peso:80+Math.sin(d/30)});
      n.fast.history.push({start:t-16*3600000,end:t,goalH:16,ok:true}); }
    n.fast.history=n.fast.history.slice(-400);
    save(true); const antes=usoDatos().c; S.compactado=null; compactarDatos(); save(true); out.antesMB=Math.round(antes/1048576*100)/100; out.despuesMB=Math.round(usoDatos().c/1048576*100)/100;
    out.ms={}; for (const t of ['rutinas','explorar','nutricion','ayuno','historial','ajustes']){ TAB=t; const t0=performance.now(); render(); out.ms[t]=Math.round(performance.now()-t0); }
    const t1=performance.now(); A.guiaAbrir(); out.ms.panda=Math.round(performance.now()-t1); closeModal();
    const t2=performance.now(); A.estadoVer(); out.ms.estado=Math.round(performance.now()-t2);
    return JSON.stringify(out); })()`));
  a.cerrar();
  const lento = Object.entries(r.ms).filter(([, v]) => v > 1500);
  console.log(`3 años de uso: ${r.antesMB} MB → ${r.despuesMB} MB tras compactar · pantallas (ms): ${Object.entries(r.ms).map(([k, v]) => k + ' ' + v).join(', ')}`);
  comprobar('1.8: 3 años de uso intenso caben con margen (menos del 70 % del espacio)', r.despuesMB < 3.5, `${r.despuesMB} MB`);
  comprobar('1.8: con 3 años de datos cada pantalla se dibuja en menos de 1,5 s (en el simulador, más lento que un teléfono)', !lento.length, JSON.stringify(lento));
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
