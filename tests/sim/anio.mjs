// 1.8.2 · Un año de uso real con 16 perfiles distintos (de pago y gratis): desde quien lo usa todo
// hasta quien solo ayuna, solo bebe agua o solo controla y crea comida.
// Cada perfil tiene un «cuerpo simulado» (fuerza real, fatiga, peso, gasto real) que la app no ve:
// la app solo ve lo que la persona anota, como en la vida real.
// Usa la app por sus botones (buscar alimentos, crear alimentos y recetas, comidas guardadas, ayunos,
// agua, entrenos, check-in, medidas, propuestas del panda) y una vez por semana recorre todas las
// pantallas tocando botones al azar.
// Busca: errores, textos rotos, datos perdidos, lentitud con un año de datos y, sobre todo,
// si lo que PandarIA aconseja ayuda a la persona (o la empuja en mala dirección).
//   SOLO=P01,P02 TZ=Europe/Madrid node tests/sim/anio.mjs [días] [semilla]
import { abrirApp, rng, RAROS } from './app.mjs';
import fs from 'node:fs';

const DIAS = +process.argv[2] || 365, SEMILLA = +process.argv[3] || 7;
const H = 3600000, D = 24 * H;
// lunes 5 de enero de 2026, 07:00 hora local (sea cual sea la zona horaria del proceso)
const T0 = new Date(2026, 0, 5, 7, 0, 0).getTime();
const BLOQUEADOS = /^(wipeData|cloud|exportData|exportFile|exportCSV|exportCopy|importData|importCode|updDownload|kbUrl|obGoogle|ciGoogle|alScan|mPhoto|retoCompartir|shareSession|shareRoutine|copyCode|periodoCompartir|fbCopy|animFbSend|chatAbrir|supSalud|retoPegar|obHc|obNotif|setLang|lpBorrar|delCustom|animCam|premigOpen|pfGo|cqPay|dPay|dQPay|pfBuy|pfRestore|pfRegalo|recRemove|plDel|goalDel|delRoutine|rDel|mDel)/;
const MENU = [['20038', 80, 'desayuno'], ['01077', 250, 'desayuno'], ['09040', 120, 'desayuno'], ['05062', 180, 'almuerzo'], ['20045', 220, 'almuerzo'], ['04053', 12, 'almuerzo'],
  ['01116', 200, 'merienda'], ['09003', 150, 'merienda'], ['15121', 120, 'cena'], ['16070', 200, 'cena'], ['18069', 70, 'cena'], ['01123', 100, 'cena']];
const BUSQUEDAS = ['pollo', 'arroz', 'banana', 'avena', 'huevo', 'lentejas', 'yogur', 'manzana', 'pan', 'atun', 'palta', 'frijoles', 'leche', 'queso', 'papa', 'tomate'];

// e: entreno · a: agua · c: comida (r: recetas, p: alimentos propios, g: comidas guardadas) · f: plan de ayuno
const PERFILES = [
  { id: 'P01', d: 'Lo usa todo · Premium · sigue al panda', prem: true, e: { meta: 'musculo', dias: 4, eq: 'gym' }, a: 1, c: { goal: 'mantener', r: 1, p: 1, g: 1 }, f: '16:8', ck: 1, med: 1, sigue: 1, sexo: 'h', edad: 30, alto: 178, peso: 80, tdee: 2650 },
  { id: 'P02', d: 'Lo usa todo · gratis', prem: false, e: { meta: 'fuerza', dias: 3, eq: 'gym' }, a: 1, c: { goal: 'mantener', r: 1, p: 1, g: 1 }, f: '14:10', ck: 1, med: 1, sexo: 'm', edad: 27, alto: 164, peso: 60, tdee: 2000 },
  { id: 'P03', d: 'Solo ayuno · gratis', prem: false, f: '16:8', sube: 1, sexo: 'm', edad: 41, alto: 160, peso: 72, tdee: 1950 },
  { id: 'P04', d: 'Solo ayuno · Premium · ayunos largos', prem: true, f: '20:4', largos: 1, med: 1, sexo: 'h', edad: 48, alto: 175, peso: 92, tdee: 2500 },
  { id: 'P05', d: 'Solo comida y crear comida · gratis', prem: false, c: { goal: 'bajar', r: 1, p: 1, g: 1, muchas: 1 }, med: 1, sexo: 'm', edad: 35, alto: 166, peso: 78, tdee: 2050 },
  { id: 'P06', d: 'Solo comida y crear comida · Premium', prem: true, c: { goal: 'bajar', r: 1, p: 1, g: 1, muchas: 1 }, med: 1, sigue: 1, sexo: 'h', edad: 39, alto: 180, peso: 98, tdee: 2800 },
  { id: 'P07', d: 'Entreno + agua · gratis', prem: false, e: { meta: 'fuerza', dias: 3, eq: 'gym' }, a: 1, ck: 1, sexo: 'h', edad: 24, alto: 182, peso: 76, tdee: 2700 },
  { id: 'P08', d: 'Calistenia en casa con lastre · Premium', prem: true, e: { meta: 'fuerza', dias: 3, eq: 'casa' }, a: 1, ck: 1, sigue: 1, med: 1, sexo: 'h', edad: 28, alto: 174, peso: 72, tdee: 2500 },
  { id: 'P09', d: 'Solo agua · gratis', prem: false, a: 1, sexo: 'm', edad: 52, alto: 158, peso: 66, tdee: 1800 },
  { id: 'P10', d: 'Abandona 6 semanas y vuelve · Premium', prem: true, e: { meta: 'musculo', dias: 3, eq: 'gym' }, a: 1, c: { goal: 'mantener' }, ck: 1, med: 1, sigue: 1, pausa: [70, 112], sexo: 'm', edad: 33, alto: 168, peso: 63, tdee: 2100 },
  { id: 'P11', d: 'Premium 4 meses y luego deja de pagar', prem: true, finPrem: 120, e: { meta: 'musculo', dias: 4, eq: 'gym' }, a: 1, c: { goal: 'ganar', r: 1, p: 1, muchas: 1 }, f: '16:8', ck: 1, med: 1, sigue: 1, sexo: 'h', edad: 26, alto: 176, peso: 70, tdee: 2700 },
  { id: 'P12', d: 'Inglés · minimalista · comida + entreno · gratis', prem: false, en: 1, mini: 1, e: { meta: 'salud', dias: 3, eq: 'casa' }, c: { goal: 'mantener', r: 1 }, med: 1, sexo: 'm', edad: 45, alto: 170, peso: 70, tdee: 2100 },
  { id: 'P13', d: 'Se lesiona la rodilla a mitad de año · Premium', prem: true, e: { meta: 'musculo', dias: 4, eq: 'gym' }, a: 1, ck: 1, med: 1, sigue: 1, lesion: [150, 'rodilla'], sexo: 'h', edad: 37, alto: 177, peso: 84, tdee: 2600 },
  { id: 'P14', d: 'Come muy poco y ayuna (riesgo) · Premium', prem: true, c: { goal: 'bajar' }, f: '18:6', med: 1, ck: 1, sigue: 1, comeFijo: 1100, sexo: 'm', edad: 29, alto: 165, peso: 64, tdee: 2050 },
  { id: 'P15', d: '62 años · salud · duerme mal · Premium', prem: true, e: { meta: 'salud', dias: 2, eq: 'casa' }, a: 1, ck: 1, med: 1, sigue: 1, duermeMal: 1, sexo: 'h', edad: 62, alto: 172, peso: 86, tdee: 2200 },
  { id: 'P16', d: 'Mujer · ganar músculo · todo menos ayuno · Premium · inglés', prem: true, en: 1, e: { meta: 'musculo', dias: 4, eq: 'gym' }, a: 1, c: { goal: 'ganar', r: 1, p: 1, g: 1 }, ck: 1, med: 1, sigue: 1, sexo: 'm', edad: 31, alto: 165, peso: 58, tdee: 2050 },
];
// gemelos: la misma persona (misma vida, mismo cuerpo, mismas rutinas de partida) sin Premium ni guía de PandarIA
for (const [id, base] of [['P17', 'P01'], ['P18', 'P16'], ['P19', 'P08'], ['P20', 'P15']]) {
  const B = PERFILES.find(x => x.id === base);
  PERFILES.push(Object.assign({}, B, { id, base, gemelo: 1, sigue: 0, d: `Gemelo de ${base} sin Premium ni guía` }));
}
const numero = P => parseInt((P.base || P.id).slice(1));

const SOLO = process.env.SOLO ? process.env.SOLO.split(',') : null;
const salida = [];
const t0 = Date.now();
const recorta = (tx, m) => tx.slice(Math.max(0, m.index - 70), m.index + 40).replace(/\s+/g, ' ').trim();

for (const P of PERFILES) {
  if (SOLO && !SOLO.includes(P.id)) continue;
  const tP = Date.now();
  const r = rng(SEMILLA * 1000 + numero(P) * 13);
  const a = await abrirApp({ t0: T0, seed: SEMILLA * 100 + numero(P) });
  const L = { errores: new Map(), raros: new Map(), datos: [], avisos: [], ia: [], meses: [], fuzz: 0, propuestas: new Map(), aplicadas: [], porque: new Map(), series: [], suaves: 0, ui: { ok: 0, fallo: new Map() }, lento: [], dias: { toca: 0, salta: 0, guardadas: 0 } };
  const err = (k, m) => { const kk = (k + ': ' + m).replace(/\d{3,}/g, '#').slice(0, 260); L.errores.set(kk, (L.errores.get(kk) || 0) + 1); };
  const raro = (donde) => { const tx = a.texto(), m = tx.match(RAROS); if (m) { const k = `${donde}: «${recorta(tx, m)}»`; L.raros.set(k, (L.raros.get(k) || 0) + 1); } };
  const uiFallo = (k) => L.ui.fallo.set(k, (L.ui.fallo.get(k) || 0) + 1);
  const limpiar = () => a.ev(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`);
  const q = s => a.w.document.querySelector(s), qa = s => [...a.w.document.querySelectorAll(s)];
  const capa = s => q(`#layers .layer:last-child ${s}`);
  const ultimoModal = s => { const m = qa(`#modals ${s}`); return m[m.length - 1] || null; };
  const escribir = (el, v) => { el.value = String(v); const k = el.dataset.in; if (k) a.ev(`IN[${JSON.stringify(k)}](document.querySelectorAll('[data-in="${k}"]')[${qa(`[data-in="${k}"]`).indexOf(el)}])`); };
  let premAhora = P.prem;

  // ---- perfil, como al terminar la bienvenida ----
  a.ev(`S=DEF(); S.settings.onboarded=true; S.settings.cloudAsked=true; S.settings.ui='${P.mini ? 'mini' : 'completa'}'; S.settings.lang='${P.en ? 'en' : 'es'}'; S.settings.checkin=${!!P.ck};
    S.settings.equip=${P.e && P.e.eq === 'casa' ? '["pc","bar","ban","man"]' : 'EQUIP_GYM.slice()'};
    S.profile={name:'${P.id}',age:${P.edad},height:${P.alto},weight:${P.peso},sex:'${P.sexo}',fitness:'activo',injuries:[]};
    S.measures.push({id:'m0',date:Date.now()-2*DAY,peso:${P.peso}}); window.isPremium=()=>window.__PREM; window.__PREM=${!!P.prem}; save(true); LAYERS.length=0; renderLayers(); MODALS.length=0; renderModals(); render();`);

  // ---- entreno: plan con PandarIA (Premium) o tres rutinas de Explorar (gratis) ----
  if (P.e) {
    if (P.prem) {
      a.ev(`openLayer('wizPandaria',{step:0,goal:'${P.e.meta}',days:${P.e.dias},minutes:55,level:'principiante',priorities:[],program:null}); refreshTop();`);
      a.tocar('wpSet', `goal|${P.e.meta}`); a.tocar('wpSet', `days|${P.e.dias}`);
      for (let i = 0; i < 4; i++) a.tocar('wpStep', '1');
      a.tocar('wpAdd'); limpiar();
    } else {
      for (const i of (P.e.eq === 'casa' ? ['casa|0', 'casa|1', 'casa|2'] : ['gym|3', 'gym|0', 'piernas|0'])) { limpiar(); a.tocar('openTpl', i); a.tocar('tplAdd'); }
      limpiar();
      const dias = P.e.dias === 3 ? '[1,3,5]' : P.e.dias === 2 ? '[2,5]' : '[1,2,4,5]';
      a.ev(`S.plan={days:${dias},order:S.routines.filter(r=>!r.archived).map(r=>r.id)}; save(true);`);
    }
    if (!a.ev(`S.routines.length`)) L.datos.push('no se pudieron crear las rutinas');
    // el gemelo: mismas rutinas, pero sin Premium y sin PandarIA (repite lo de la última vez)
    if (P.gemelo) { a.ev(`S.routines.forEach(r=>r.pandaria=false); window.__PREM=false; save(true); render();`); premAhora = false; }
  }
  if (P.f) a.ev(`const f=nut().fast; f.screened=true; f.plan='${P.f}'; save(true);`);
  if (P.c) a.ev(`nut().goal='${P.c.goal}'; save(true);`);

  // ---- el cuerpo simulado ----
  const rutinas = P.e ? JSON.parse(a.ev(`JSON.stringify(S.routines.filter(r=>!r.archived).map(r=>({id:r.id,items:r.items.map(it=>({ex:it.exId,mode:getEx(it.exId).mode}))})))`)) : [];
  // fuerza por patrón de movimiento (empuje, tirón, sentadilla, bisagra…): lo que se gana con un ejercicio se conserva
  // al cambiarlo por otro del mismo patrón, como en la vida real. Cada ejercicio tiene su fuerza base sin entrenar (B).
  const B = {}, PAT = {}, M = {}, C = {}, C0 = {};
  const fuerzaDe = ex => { if (!B[ex]) { const est = +a.ev(`estimateKg('${ex}',10)||0`); B[ex] = Math.max(8, est * 1.33 * (0.85 + r() * 0.35)); PAT[ex] = a.ev(`getEx('${ex}').pat||'otro'`); if (!M[PAT[ex]]) M[PAT[ex]] = 1; C0[ex] = B[ex] * M[PAT[ex]]; }
    C[ex] = B[ex] * M[PAT[ex]]; return C[ex]; };
  // estímulo de una serie según las repeticiones que sobraron (las series lejos del fallo cuentan poco: Robinson 2024, Refalo 2023)
  const ESTIM = rir => rir <= 2 ? 1 : rir === 3 ? 0.9 : rir === 4 ? 0.75 : rir === 5 ? 0.55 : rir === 6 ? 0.35 : rir === 7 ? 0.2 : 0.1;
  rutinas.forEach(rt => rt.items.forEach(it => { if (it.mode === 'p') fuerzaDe(it.ex); }));
  let F = 0, peso = P.peso, protOk = 1;
  const cola = [];
  const comidasHechas = { recetas: 0, propios: 0, buscadas: 0, guardadas: 0, limiteGratis: 0 };

  // ---- acciones por la interfaz ----
  // buscar un alimento en el diario y añadirlo (como un toque real)
  const buscarYAnadir = (txt, gr, comida) => {
    a.ev(`A.tab('nutricion'); A.nseg&&A.nseg('comida'); A.dAdd('${comida}')`); a.avanzar(300);
    const inp = capa('[data-in="alQ"]'); if (!inp) { uiFallo('el buscador no se abrió'); limpiar(); return false; }
    escribir(inp, txt); a.avanzar(200);
    const pick = capa('#allist [data-a="alPick"]'); if (!pick) { uiFallo(`el buscador no encontró «${txt}»`); limpiar(); return false; }
    pick.click(); a.avanzar(200);
    const g = q('#aqg'); if (g) { a.ev(`A.aqPor(-1)`); escribir(g, gr); }
    const ok = ultimoModal('.btn.pri[data-a="cbm"]'); if (!ok) { uiFallo('no salió la ventana de cantidad'); limpiar(); return false; }
    ok.click(); a.avanzar(400); limpiar(); comidasHechas.buscadas++; L.ui.ok++; return true;
  };
  // crear un alimento propio con los datos de la etiqueta
  const crearAlimento = (n) => {
    a.ev(`A.tab('nutricion'); A.dAdd('merienda')`); a.avanzar(300);
    a.tocar('alNew'); a.avanzar(200);
    if (!capa('#an_n')) { if (ultimoModal('.sheet') || /Premium/.test(a.texto())) { comidasHechas.limiteGratis++; limpiar(); return 'limite'; } uiFallo('no se abrió «Crear alimento»'); limpiar(); return false; }
    const v = { n, porl: '1 barrita', porg: 40, k: 160 + Math.round(r() * 60), p: 6 + Math.round(r() * 6), c: 20, g: 5 };
    for (const [k, x] of Object.entries(v)) { const el = capa('#an_' + k); if (el) escribir(el, x); }
    a.tocar('anSave'); a.avanzar(300);
    const ok = a.ev(`nd().alim.some(x=>x.n===${JSON.stringify(n)})`);
    if (!ok) { if (/Premium|gratis|free/i.test(a.texto())) { comidasHechas.limiteGratis++; limpiar(); return 'limite'; } uiFallo('el alimento creado no se guardó'); }
    else { comidasHechas.propios++; L.ui.ok++; }
    limpiar(); return ok;
  };
  // crear una receta buscando cada ingrediente con el buscador
  const crearReceta = (n, ings) => {
    a.ev(`A.tab('nutricion'); A.dAdd('almuerzo')`); a.avanzar(300);
    a.tocar('recNew'); a.avanzar(200);
    const nom = capa('[data-in="recN"]');
    if (!nom) { if (/Premium|gratis|free/i.test(a.texto())) { comidasHechas.limiteGratis++; limpiar(); return 'limite'; } uiFallo('no se abrió «Crear receta»'); limpiar(); return false; }
    escribir(nom, n);
    for (const [txt, gr] of ings) {
      a.tocar('recAdd'); a.avanzar(200);
      const inp = capa('[data-in="alQ"]'); if (!inp) { uiFallo('el buscador de ingredientes no se abrió'); continue; }
      escribir(inp, txt); a.avanzar(200);
      const pick = capa('#allist [data-a="alPick"]'); if (!pick) { uiFallo(`el buscador de ingredientes no encontró «${txt}»`); a.ev(`closeLayer()`); continue; }
      pick.click(); a.avanzar(200);
      const g = q('#rcg'); if (g) g.value = String(gr);
      const ok = ultimoModal('.btn.pri[data-a="cbm"]'); if (ok) { ok.click(); a.avanzar(300); } else uiFallo('no salió la ventana de gramos del ingrediente');
    }
    const nIng = +a.ev(`(()=>{ for (let i=LAYERS.length-1;i>=0;i--) if (LAYERS[i].t==='receta') return LAYERS[i].p.r.items.length; return -1; })()`);
    if (nIng !== ings.length) uiFallo(`la receta quedó con ${nIng} de ${ings.length} ingredientes`);
    a.tocar('recSave'); a.avanzar(300);
    const ok = a.ev(`nd().recetas.some(x=>x.n===${JSON.stringify(n)})`);
    if (!ok) { if (/Premium|gratis|free/i.test(a.texto())) { comidasHechas.limiteGratis++; limpiar(); return 'limite'; } uiFallo('la receta no se guardó'); } else { comidasHechas.recetas++; L.ui.ok++; }
    limpiar(); return ok;
  };
  // registrar una ración de una receta o un alimento propio desde «Mis alimentos»
  const anadirPropio = () => {
    a.ev(`A.tab('nutricion'); A.dAdd('cena')`); a.avanzar(300); a.tocar('alTab', 'propios'); a.avanzar(200);
    const picks = qa('#layers .layer:last-child #allist [data-a="alPick"]'); if (!picks.length) { limpiar(); return false; }
    picks[Math.floor(r() * picks.length)].click(); a.avanzar(200);
    const ok = ultimoModal('.btn.pri[data-a="cbm"]'); if (ok) { ok.click(); a.avanzar(300); L.ui.ok++; } else uiFallo('no salió la ventana de cantidad de «Mis alimentos»');
    limpiar(); return !!ok;
  };
  const anadirComidaGuardada = () => {
    a.ev(`A.tab('nutricion'); A.dAdd('desayuno')`); a.avanzar(300); a.tocar('alTab', 'comidas'); a.avanzar(200);
    const b = capa('#allist [data-a="alMealAdd"]'); if (!b) { limpiar(); return false; }
    b.click(); a.avanzar(300); limpiar(); comidasHechas.guardadas++; L.ui.ok++; return true;
  };

  // ---- foto mensual de lo que dice la IA ----
  const fotoMes = (dia) => {
    const t = performance.now();
    const tiempos = {};
    for (const tab of ['rutinas', 'nutricion', 'historial', 'ajustes']) { const t1 = performance.now(); a.ev(`LAYERS.length=0; renderLayers(); A.tab('${tab}')`); tiempos[tab] = Math.round(performance.now() - t1); }
    for (const seg of ['agua', 'ayuno']) { const t1 = performance.now(); a.ev(`A.nseg('${seg}')`); tiempos['nut-' + seg] = Math.round(performance.now() - t1); }
    a.ev(`A.nseg('comida')`);
    const f = JSON.parse(a.ev(`JSON.stringify((()=>{ const c=calcNutrition(), T=pesoTendencia(), wt=weightTrend();
      const fa=nut().fast, H=fa.history.slice(-30);
      return { prem:premOK(), kcal:c&&c.kcal, bmr:c&&c.bmr, tdeeF:c&&c.tdee, adapt:c&&c.adapt&&c.adapt.ok?c.adapt.tdee:null, prot:c&&c.prot, goal:c&&c.goal, notas:c?c.notes:[], limite:c&&c.limite,
        peso:bodyWeight(), ritmo:T&&T.rate, pct:wt?Math.round(wt.pct*100)/100:null,
        agua:waterGoal(), ayunoConsejo:(fastAdvice().match(/<span>([^<]*)<\\/span>/)||[])[1]||'', ayunosMes:H.length, ayunoMedioH:H.length?Math.round(H.reduce((s,x)=>s+(x.end-x.start),0)/H.length/36e5*10)/10:null,
        sesiones:S.sessions.length, descargas:(S.deloadLog||[]).length, deload:deloadActive(), estado:premOK()?(estadoDia()||{}).score??null:null,
        propuestas:premOK()?v3Propuestas().map(p=>p.k.split('-')[0]):[], novedades:premOK()?v3Novedades().map(p=>(p.t||'').slice(0,90)):[],
        rutinas:S.routines.filter(r=>!r.archived).length, archivadas:S.routines.filter(r=>r.archived).length, alim:nd().alim.length, recetas:nd().recetas.length, comidas:nd().comidas.length,
        datos:usoDatos(), lesiones:(S.profile.injuries||[]).slice(), plan:S.plan?S.plan.days.slice():[], ejercicios:S.routines.filter(r=>!r.archived).reduce((n,r)=>n+r.items.filter(i=>!i.warm&&!i.cool).length,0), series:S.routines.filter(r=>!r.archived).reduce((n,r)=>n+r.items.filter(i=>!i.warm&&!i.cool).reduce((m,i)=>m+i.sets.filter(x=>x.t!=='c').length,0),0), meta:nut().goal, faPlan:nut().fast.plan }; })())`));
    f.dia = dia; f.ms = tiempos; f.pesoReal = Math.round(peso * 10) / 10;
    f.fuerza = Object.keys(M).length ? Math.round(Object.values(M).reduce((s, v) => s + v - 1, 0) / Object.keys(M).length * 1000) / 10 : null;
    L.meses.push(f);
    limpiar();
    return f;
  };

  // ---- el año ----
  let vivoAyer = true, largo = false;
  const FASES = new Map(); let hAnt = 0;
  const hp = (k) => { if (!process.env.MEM2) return; global.gc(); const h = process.memoryUsage().heapUsed / 1048576; if (hAnt) FASES.set(k, (FASES.get(k) || 0) + h - hAnt); hAnt = h; };
  for (let dia = 0; dia < DIAS; dia++) {
    const base = T0 + dia * D;
    const en = t => { a.w.__T = Math.max(a.w.__T, t); };
    const dow = new Date(base).getDay();
    const enPausa = P.pausa && dia >= P.pausa[0] && dia < P.pausa[1];
    try {
      // fin del ayuno que empezó anoche a las 20:00 (antes de nada: puede terminar de madrugada)
      if (P.f && a.ev(`!!nut().fast.active`)) {
        const plan = +P.f.split(':')[0];
        if (largo) { en(base + 1 * H); largo = false; }
        else {
          const horas = enPausa ? 0 : plan + (r() < 0.15 ? -3 - r() * 4 : r() * 1.5);
          en(base - 11 * H + horas * H);
          if (P.largos && dia % 28 === 6) { largo = true; L.avisos.push(`día ${dia}: empieza un ayuno de 36 h`); }
        }
        if (!largo && a.ev(`!!nut().fast.active`)) { a.ev(`A.fastEndNow()`); a.avanzar(7000);
          if (r() < 0.5) { const s = qa('#modals [data-a="fsS"]'); if (s.length) { s[Math.floor(r() * s.length)].click(); const ok = ultimoModal('[data-a="fsOk"]'); if (ok) ok.click(); } }
          limpiar(); }
        if (P.sube && dia === 120) a.ev(`nut().fast.plan='18:6'; save();`);
        if (P.sube && dia === 240) a.ev(`nut().fast.plan='20:4'; save();`);
      }
      en(base);
      if (P.finPrem && dia === P.finPrem) { a.ev(`window.__PREM=false; render();`); premAhora = false; L.avisos.push(`día ${dia}: deja de pagar Premium`); }
      if (P.lesion && dia === P.lesion[0]) {
        a.ev(`A.openProfile()`); a.avanzar(300); a.tocar('pfInj', P.lesion[1]); a.tocar('pfSave'); a.avanzar(800);
        const ok = qa('#modals .btn.pri[data-a="cbm"]').pop(); const ofrece = !!ok; if (ok) { ok.click(); a.avanzar(500); }
        L.avisos.push(`día ${dia}: se lesiona (${P.lesion[1]}) y lo marca en su perfil · la app ${ofrece ? 'ofrece cambiar ejercicios y los cambia' : 'NO ofrece cambiar ejercicios'}`); limpiar();
        if (!a.ev(`(S.profile.injuries||[]).includes('${P.lesion[1]}')`)) L.datos.push('la lesión no se guardó en el perfil');
      }
      // la noche anterior y la fatiga
      const durmio = P.duermeMal ? (r() < 0.4 ? 0 : r() < 0.7 ? 1 : 2) : (r() < 0.12 ? 0 : r() < 0.35 ? 1 : 2);
      F *= 0.86;
      // check-in de la mañana
      if (P.ck && !enPausa && r() < 0.7) {
        a.ev(`A.checkinHoy()`); a.avanzar(300);
        a.tocar('ckhSet', `sleep|${durmio}`); a.tocar('ckhSet', `energy|${F > 0.1 || durmio === 0 ? 0 : r() < 0.7 ? 1 : 2}`); a.tocar('ckhSet', `sore|${F > 0.08 ? 0 : F > 0.04 ? 1 : 2}`);
        const b = q('#modals .btn.pri[data-a="cbm"]'); if (b) b.click(); a.avanzar(300); limpiar();
      }
      // medidas (lunes; quien adelgaza también el jueves)
      if (P.med && !enPausa && (dow === 1 || (dow === 4 && P.c && P.c.goal === 'bajar'))) {
        en(base + 0.5 * H); a.tocar('addMeasure'); const i = q('#m_peso'); if (i) i.value = (peso + (r() - 0.5) * 0.8).toFixed(1); else uiFallo('no se abrió «Añadir medida»');
        a.tocar('mSave'); limpiar();
      }
      a.w.__T = Math.max(a.w.__T, base + 1 * H);
      hp('ayuno+checkin+medidas');
      // agua
      if (P.a && !enPausa) {
        const vasos = 4 + Math.floor(r() * 6);
        for (let i = 0; i < vasos; i++) { a.w.__T = Math.max(a.w.__T, base + (1.5 + i * 1.4) * H); a.ev(`A.water(${[250, 300, 500][Math.floor(r() * 3)]})`); }
        if (r() < 0.05) a.ev(`A.water(-1)`);
      }
      hp('agua');
      // comida: come según lo que marca la app (±10 %, y algún día de más); P14 come siempre muy poco
      let comido = null;
      if (P.c && !enPausa && r() < 0.92) {
        a.w.__T = Math.max(a.w.__T, base + 5 * H);
        const obj = +a.ev(`(()=>{ const c=calcNutrition(); return c?c.kcal:0; })()`) || P.tdee;
        const meta = P.comeFijo ? P.comeFijo * (0.95 + r() * 0.1) : obj * (r() < 0.1 ? 1.25 : 1) * (0.9 + r() * 0.2);
        // la mayor parte del día se anota de golpe (como «copiar» o una comida guardada); una o dos cosas, por el buscador
        const lista = MENU.filter(() => r() < 0.85);
        comido = JSON.parse(a.ev(`JSON.stringify((()=>{ const n=nd(), k=dayKey(), lista=${JSON.stringify(lista)};
          const tot=lista.reduce((s,[id,gr])=>s+alimMac(alimGet(id),gr).k,0)||1, f=${meta * 0.85}/tot;
          const add=lista.map(([id,gr,m])=>{ const x=alimGet(id); return Object.assign(alimMac(x,gr*f),{id:uid(),fid:id,n:x.n,gr:Math.round(gr*f),m,t:Date.now()}); });
          n.diario[k]=(n.diario[k]||[]).concat(add); save(); diarioAdded(k,add); const t=dayTotals(k); return {k:t.k,p:t.p}; })())`));
        if (r() < 0.35) buscarYAnadir(BUSQUEDAS[Math.floor(r() * BUSQUEDAS.length)], 80 + Math.round(r() * 120), ['desayuno', 'almuerzo', 'merienda', 'cena'][Math.floor(r() * 4)]);
        if (P.c.r && dia % 9 === 3 && (P.c.muchas || comidasHechas.recetas < 3)) crearReceta(`Receta ${P.id} ${dia}`, [['lentejas', 300], ['arroz', 200], ['tomate', 150], ['aceite', 15]].slice(0, 2 + Math.floor(r() * 3)));
        if (P.c.p && dia % 11 === 5 && (P.c.muchas || comidasHechas.propios < 3)) crearAlimento(`Barrita ${P.id} ${dia}`);
        if ((P.c.r || P.c.p) && r() < 0.3) anadirPropio();
        if (P.c.g && dia === 10) { a.ev(`(()=>{ const n=nd(), k=dayKey(); const it=(n.diario[k]||[]).filter(e=>e.m==='desayuno'); if (it.length) { n.comidas.push({id:uid(),n:'Mi desayuno',items:it.map(e=>({f:e.fid,gr:e.gr,por:null,q:null}))}); save(); } })()`); }
        if (P.c.g && dia > 10 && r() < 0.15) anadirComidaGuardada();
        comido = JSON.parse(a.ev(`JSON.stringify(dayTotals(dayKey()))`));
      }
      hp('comida');
      // peso real: lo que come frente a lo que gasta de verdad (quien no anota come lo suyo)
      const gasto = P.tdee + (peso - P.peso) * 22 + (P.e && !enPausa ? 60 : 0);
      const ingesta = comido ? comido.k : P.comeFijo ? P.comeFijo : gasto * (0.97 + r() * 0.06);
      peso += (ingesta - gasto) / 7700; protOk = comido ? (comido.p >= peso * 1.4 ? 1 : 0.8) : 0.9;
      // entreno
      const toca = P.e && !enPausa && a.ev(`!!(S.plan&&S.plan.days.includes(new Date().getDay()))`);
      const tira = r(); if (process.env.DBGPLAN && P.e && !enPausa) { const pd=a.ev(`JSON.stringify(S.plan&&S.plan.days)`); if (toca || dia%7===4) console.log('  plan', dia, 'dow', dow, 'appDow', a.ev('new Date().getDay()'), 'toca', toca, 'tira', tira.toFixed(2), pd, new Date(a.w.__T).toISOString()); }
      if (toca) { L.dias.toca++; if (tira >= 0.85) L.dias.salta++; }
      if (toca && tira < 0.85) {
        a.w.__T = Math.max(a.w.__T, base + 10 * H);
        const x = JSON.parse(a.ev(`JSON.stringify((()=>{ const n=nextInPlan(); const E=estadoDia(); return {rid:n&&n.r?n.r.id:'', est:E&&E.score!=null?{s:E.score,soft:E.soft}:null}; })())`));
        let suave = false;
        if (P.sigue && x.est && x.est.soft && q('[data-a="startSoft"]')) { suave = true; L.suaves++; }
        if (!x.rid) L.datos.push(`día ${dia}: tocaba entrenar y nextInPlan no dio rutina`);
        if (x.rid) {
          a.tocar(suave ? 'startSoft' : 'startWorkout', x.rid); a.avanzar(300);
          const emp = qa('#modals .btn.pri[data-a="cbm"]').find(b => /^(Empezar|Start)/.test(b.textContent.trim())); if (emp) { emp.click(); a.avanzar(300); }
          if (!a.ev('!!S.active')) L.datos.push(`día ${dia}: el entreno no empezó`);
          else {
            const items = JSON.parse(a.ev(`JSON.stringify(S.active.items.map(it=>({u:it.uid,ex:it.exId,mode:getEx(it.exId).mode,lastre:!!getEx(it.exId).lastre,sets:it.sets.map((s,i)=>({i,t:s.t,sk:s.sk,sr:s.sr,st:s.st,tk:s.tk,tr:s.tr,tt:s.tt,why:s.why||''}))})))`));
            const lesionadas = P.lesion && dia >= P.lesion[0] + 14 ? items.filter(it => a.ev(`(INJURIES['${P.lesion[1]}'].ex||[]).includes(getEx('${it.ex}').base||'${it.ex}')`)).map(it => it.ex) : [];
            if (lesionadas.length) L.ia.push({ dia, tipo: 'ejercicio-contraindicado', txt: lesionadas.join(', ') });
            const estPat = {};
            for (const it of items) {
              if (it.mode === 'p') fuerzaDe(it.ex);
              let Pd = (it.mode === 'p' ? C[it.ex] : 0) * (1 - F) * (durmio === 0 ? 0.95 : 1) * (0.97 + r() * 0.06);
              const why = [...new Set(it.sets.map(s => s.why).filter(Boolean))];
              why.forEach(w => { const k = w.replace(/[\d.,]+/g, '#'); L.porque.set(k, (L.porque.get(k) || 0) + 1); });
              let stim = 0, kg0 = 0, todas = true, obj0 = 0;
              for (const s of it.sets) {
                if (r() < 0.04) continue;
                if (it.mode === 'p') {
                  let kg = s.sk ?? s.tk ?? 10, objetivo = s.sr ?? s.tr ?? 8;
                  let rmax = kg > 0 ? Math.floor(30 * (Pd / kg - 1)) : 30, bajo = 0;
                  while (kg > 2.5 && rmax - 1 < Math.ceil(objetivo * 0.6) && bajo < 8) { kg = Math.round(kg * 0.9 / 1.25) * 1.25; rmax = Math.floor(30 * (Pd / kg - 1)); bajo++; }
                  let reps = Math.max(0, Math.min(objetivo, rmax - 1)); if (reps === 0 && rmax >= 1) reps = 1;
                  const rir = Math.max(0, rmax - reps); if (reps <= 0) continue;
                  a.ev(`(()=>{ const s=wkItem('${it.u}').sets[${s.i}]; s.kg=${kg}; s.reps=${reps}; ${s.t !== 'c' ? `s.rir=${Math.min(rir, 5)};` : ''} })()`);
                  a.tocar('wkCheck', `${it.u}|${s.i}`); const cbm = q('#modals [data-a="cbm"]'); if (cbm) cbm.click();
                  if (s.t !== 'c') { L.series.push({ d: dia, ex: it.ex, sug: s.sk ?? s.tk, kg, obj: objetivo, reps, rir, bajo, pct: Math.round(kg / (C[it.ex] || 1) * 100), why: (s.why || '').slice(0, 60) });
                    stim += ESTIM(rir); Pd *= 0.975; if (!kg0) { kg0 = kg; obj0 = objetivo; } if (reps < objetivo) todas = false; }
                } else if (it.mode === 'r') { a.ev(`(()=>{ const s=wkItem('${it.u}').sets[${s.i}]; s.reps=${s.sr ?? s.tr ?? 10}; })()`); a.tocar('wkCheck', `${it.u}|${s.i}`); }
                else { a.ev(`(()=>{ const s=wkItem('${it.u}').sets[${s.i}]; s.time=${s.st ?? s.tt ?? 30}; })()`); a.tocar('wkCheck', `${it.u}|${s.i}`); }
                a.avanzar(90000);
              }
              if (it.mode === 'p' && C[it.ex]) { estPat[PAT[it.ex]] = (estPat[PAT[it.ex]] || 0) + stim; F += 0.0022 * stim; }
            }
            // adaptación por patrón: más estímulo, más ganancia (rendimientos decrecientes por sesión y con lo ya ganado); el cansancio la frena algo
            for (const [pt, st0] of Object.entries(estPat)) M[pt] *= 1 + 0.008 * Math.pow(Math.min(st0, 10) / 4, 0.6) * Math.max(0.5, 1 - 2 * F) * protOk * Math.max(0.15, 1 - (M[pt] - 1) * 1.2);
            a.tocar('wkFinish'); a.avanzar(300); a.ev(`(()=>{ const el=document.querySelector('[data-in="finInt"]'); if (el){ el.value=${F > 0.08 ? 9 : 7}; IN.finInt(el); } })()`);
            a.tocar('finDo', r() < 0.1 ? 'update' : 'keep'); a.avanzar(2000); limpiar();
            if (a.ev('!!S.active')) L.datos.push(`día ${dia}: el entreno no se cerró`); else L.dias.guardadas++;
            if (process.env.DBGPLAN) console.log('  fin', dia, 'sesiones', a.ev('S.sessions.length'), 'items', items.length, items.map(i=>i.mode+i.sets.length).join(''), 'última', a.ev('JSON.stringify((S.sessions[S.sessions.length-1]||{}).items?.map(i=>i.sets.length))'), a.ev('(S.sessions[S.sessions.length-1]||{}).routineName'));
          }
        }
      }
      hp('entreno');
      // pérdida de fuerza durante la pausa (desentrenamiento)
      if (enPausa) for (const k in M) M[k] *= 0.9985;
      // comienzo del ayuno a las 20:00
      if (P.f && !enPausa) { en(base + 13 * H); if (!a.ev(`!!nut().fast.active`)) a.ev(`A.fastStart()`); }
      if (largo) { en(base + 14 * H); a.ev(`A.tab('nutricion'); A.nseg('ayuno')`); raro('ayuno largo'); L.ia.push({ dia, tipo: 'ayuno de 36 h, a las 25 h', txt: a.ev(`(fastAdvice().match(/<span>([^<]*)<\\/span>/)||[])[1]||''`) }); }
      hp('ayunoIni');
      // noche: mira el panda y, si le hace caso, aplica la propuesta
      a.w.__T = Math.max(a.w.__T, base + 14 * H);
      if (!enPausa) {
        a.ev(`A.tab('rutinas'); A.guiaAbrir();`); a.avanzar(300); raro('panda');
        const prop = q('#modals .pprop');
        if (prop) {
          const t = (prop.querySelector('.b') || prop).textContent.trim();
          L.propuestas.set(t.replace(/\d+([.,]\d+)?/g, '#').slice(0, 140), (L.propuestas.get(t.replace(/\d+([.,]\d+)?/g, '#').slice(0, 140)) || 0) + 1);
          const ap = prop.querySelector('[data-a="pandaAplicar"], [data-a="pandaIr"]');
          if (P.sigue && ap) {
            L.aplicadas.push(`día ${dia}: ${t.slice(0, 120)}`); if (process.env.DBGPLAN) console.log('  aplica', dia, t.slice(0,80), a.ev('JSON.stringify(S.plan&&S.plan.days)'));
            if (ap.dataset.a === 'pandaIr') { ap.click(); a.avanzar(500); const ok = q('[data-a="applySugg"]'); if (ok) { ok.click(); a.avanzar(500); } }
            else { ap.click(); a.avanzar(500); }
          }
        }
        limpiar();
        // la pantalla del día, cada día
        const tab = P.e ? 'rutinas' : P.c || P.a || P.f ? 'nutricion' : 'historial';
        a.ev(`A.tab('${tab}')`); raro(tab);
      }
      hp('panda+tab');
      // una vez por semana: todas las pantallas con toques al azar
      if (dow === 0 && !process.env.NOFUZZ) {
        for (const t of ['rutinas', 'explorar', 'nutricion', 'ayuno', 'historial', 'ajustes']) {
          limpiar(); a.ev(`A.tab('${t}')`); a.avanzar(300); raro(t);
          for (let k = 0; k < 5; k++) {
            const bs = qa('#view [data-a], #layers .layer:last-child [data-a], #modals [data-a]').filter(b => !BLOQUEADOS.test(b.dataset.a) && !(premAhora && b.dataset.a === 'openPremium'));
            if (!bs.length) break; const b = bs[Math.floor(r() * bs.length)];
            const antes = a.errores.length;
            try { b.click(); } catch (e) { err(`${t} › ${b.dataset.a}`, String(e).slice(0, 200)); }
            a.avanzar(800); L.fuzz++;
            if (a.errores.length > antes) a.errores.splice(antes).forEach(e => err(`${t} › ${b.dataset.a}(${(b.dataset.v || '').slice(0, 24)})`, e));
            raro(`${t} › ${b.dataset.a}`);
          }
          a.ev(`if (S.active) S.active=null;`); limpiar();
        }
      }
      hp('fuzz');
      // el día 1 de cada mes (aprox.), la foto de lo que dice la IA
      if (dia % 30 === 29 || dia === DIAS - 1) { const f = fotoMes(dia); const lento = Object.entries(f.ms).filter(([, v]) => v > 1500); if (lento.length) L.lento.push(`día ${dia}: ${lento.map(([k, v]) => `${k} ${v} ms`).join(', ')}`); }
      hp('foto');
      // los datos guardados se leen y coinciden
      if (dow === 0 || dia === DIAS - 1) {
        const chk = JSON.parse(a.ev(`JSON.stringify((()=>{ let ok=true, ses=0, e=''; try{ const d=JSON.parse(localStorage.getItem(KEY)); ses=d.sessions.length; ok=d.v===DATA_VER; }catch(x){ ok=false; e=String(x); } return {ok,ses,mem:S.sessions.length,e}; })())`));
        if (!chk.ok) L.datos.push(`día ${dia}: los datos guardados no se pueden leer (${chk.e})`);
        if (chk.ses !== chk.mem) L.datos.push(`día ${dia}: entrenos en memoria ${chk.mem} y guardados ${chk.ses}`);
      }
    } catch (e) { err(`día ${dia}`, String(e && (e.stack || e)).slice(0, 300)); }
    a.errores.splice(0).forEach(e => err('general', e));
    a.purgar();
    // jsdom avisa de cada cambio de localStorage con un temporizador real de Node que guarda el texto viejo y el nuevo: hay que dejarlos correr
    await new Promise(res => setTimeout(res, 2));
    hp('fin');
    if (process.env.MEM2 && dia % 5 === 4) console.log('  fases', [...FASES].map(([k,v])=>k+' '+Math.round(v)).join(' · '));
    if (process.env.MEM && dia % 10 === 0) console.log(`  ${P.id} día ${dia}: ${Math.round(process.memoryUsage().rss / 1048576)} MB · temporizadores ${a.pendientes()} · CB ${a.ev('Object.keys(CB).length')} · heap ${(global.gc&&global.gc(),Math.round(process.memoryUsage().heapUsed/1048576))} MB · nodos ${a.w.document.getElementsByTagName('*').length} · ${Math.round((Date.now() - tP) / 1000)} s`);
    vivoAyer = !enPausa;
  }

  if (process.env.SNAP) { a.purgar(); global.gc(); const v8 = await import('node:v8'); console.log('snapshot', v8.writeHeapSnapshot(process.env.SNAP)); }
  // ---- reapertura: la app se cierra y se vuelve a abrir con el año de datos ----
  const guardado = {}; for (let i = 0; i < a.w.localStorage.length; i++) { const k = a.w.localStorage.key(i); guardado[k] = a.w.localStorage.getItem(k); }
  const finalApp = JSON.parse(a.ev(`JSON.stringify({ses:S.sessions.length, ayunos:nut().fast.history.length, aguaDias:Object.keys(nut().water||{}).length, diarioDias:Object.keys((S.nutri&&S.nutri.diario)||{}).length, medidas:S.measures.length, alim:nd().alim.length, recetas:nd().recetas.length})`));
  a.cerrar();
  const b = await abrirApp({ t0: a.w.__T, storage: guardado, seed: 3 });
  b.ev(`window.isPremium=()=>${premAhora};`);
  const tRe = performance.now(); b.ev(`render()`); const msRe = Math.round(performance.now() - tRe);
  const reab = JSON.parse(b.ev(`JSON.stringify({ses:S.sessions.length, ayunos:nut().fast.history.length, aguaDias:Object.keys(nut().water||{}).length, diarioDias:Object.keys((S.nutri&&S.nutri.diario)||{}).length, medidas:S.measures.length, alim:nd().alim.length, recetas:nd().recetas.length})`));
  for (const k of Object.keys(finalApp)) if (finalApp[k] !== reab[k]) L.datos.push(`al reabrir: ${k} ${finalApp[k]} → ${reab[k]}`);
  for (const t of ['rutinas', 'nutricion', 'historial', 'ajustes']) { b.ev(`A.tab('${t}')`); b.avanzar(300); const tx = b.texto(), m = tx.match(RAROS); if (m) L.raros.set(`reabrir ${t}: «${recorta(tx, m)}»`, 1); }
  b.errores.forEach(e => err('reabrir', e));
  b.cerrar();

  const fuerza = Object.fromEntries(Object.keys(M).map(pt => [pt, { pct: Math.round((M[pt] - 1) * 1000) / 10, ejercicios: Object.keys(PAT).filter(e => PAT[e] === pt) }]));
  const efectivas = L.series.filter(x => x.rir <= 3).length;
  const out = { id: P.id, d: P.d, perfil: P, fuerza, peso: { ini: P.peso, fin: Math.round(peso * 10) / 10 }, final: finalApp, reabrirMs: msRe, comidas: comidasHechas,
    errores: [...L.errores], raros: [...L.raros], datos: L.datos, avisos: L.avisos, ia: L.ia, meses: L.meses, fuzz: L.fuzz, propuestas: [...L.propuestas].sort((x, y) => y[1] - x[1]),
    aplicadas: L.aplicadas, efectivas, porque: [...L.porque].sort((x, y) => y[1] - x[1]).slice(0, 25), series: L.series, suaves: L.suaves, ui: { ok: L.ui.ok, fallo: [...L.ui.fallo] }, lento: L.lento, dias: L.dias, seg: Math.round((Date.now() - tP) / 1000) };
  salida.push(out);
  fs.writeFileSync(new URL(`./resultado-anio-${P.id}${process.env.NOFUZZ ? '-limpio' : ''}.json`, import.meta.url), JSON.stringify(out, null, 1));
  const fz = Object.values(fuerza); const fm = fz.length ? (fz.reduce((s, x) => s + x.pct, 0) / fz.length).toFixed(1) : '—';
  console.log(`${P.id} ${P.d}: ${L.errores.size} errores · ${L.raros.size} textos raros · ${L.datos.length} datos · ${L.ui.fallo.size} fallos de botones · ${finalApp.ses} entrenos · fuerza ${fm} % · peso ${P.peso}→${out.peso.fin} · ${out.seg} s`);
}
console.log(`\n${salida.length} perfiles · ${DIAS} días · ${Math.round((Date.now() - t0) / 1000)} s`);
process.exit(0);
