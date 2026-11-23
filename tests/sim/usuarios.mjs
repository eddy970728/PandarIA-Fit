// Simulación de muchos usuarios distintos durante 30 días: cada uno registra (o no) agua, comida,
// ayuno, entrenos y medidas, con y sin Premium, en español e inglés, en modo completo y minimalista.
// Cada día visita todas las pantallas, abre el panda y el estado del día, y toca botones al azar.
// Busca: errores de JavaScript, textos rotos (NaN, undefined…), datos que no se guardan o se corrompen.
//   node tests/sim/usuarios.mjs [días] [semilla]
import { abrirApp, rng, RAROS } from './app.mjs';
import fs from 'node:fs';

const DIAS = +process.argv[2] || 30, SEMILLA = +process.argv[3] || 11;
const T0 = Date.UTC(2026, 0, 5, 7, 0, 0); // lunes
const H = 3600000, D = 24 * H;
const BLOQUEADOS = /^(wipeData|cloud|exportData|exportFile|exportCSV|exportCopy|importData|importCode|updDownload|kbUrl|obGoogle|ciGoogle|alScan|mPhoto|retoCompartir|shareSession|shareRoutine|copyCode|periodoCompartir|fbCopy|animFbSend|chatAbrir|supSalud|retoPegar|obHc|obNotif|setLang|lpBorrar|delCustom|animCam|premigOpen|pfGo|cqPay|dPay|dQPay|pfBuy|pfRestore|pfRegalo)/;
const COMIDAS = [['20038', 70, 'desayuno'], ['01077', 250, 'desayuno'], ['09040', 120, 'desayuno'], ['05062', 180, 'almuerzo'], ['20045', 200, 'almuerzo'], ['04053', 10, 'almuerzo'],
  ['01116', 125, 'merienda'], ['09003', 150, 'merienda'], ['15121', 120, 'cena'], ['16070', 200, 'cena'], ['18069', 60, 'cena'], ['01123', 100, 'cena']];

const usuarios = [];
for (let c = 0; c < 32; c++) {
  const u = { id: c, agua: !!(c & 1), comida: !!(c & 2), ayuno: !!(c & 4), entreno: !!(c & 8), premium: !!(c & 16) };
  u.medidas = c % 3 !== 0; u.checkin = c % 2 === 0; u.en = c % 4 === 3; u.lang = c % 4 === 3 ? 'en' : c % 4 === 1 ? 'pt' : 'es'; u.mini = c % 5 === 1 || c % 5 === 4;
  u.meta = ['fuerza', 'musculo', 'grasa', 'salud'][c % 4]; u.sexo = c % 2 ? 'm' : 'h';
  usuarios.push(u);
}
const nombre = u => `#${String(u.id).padStart(2, '0')} ${[u.agua && 'agua', u.comida && 'comida', u.ayuno && 'ayuno', u.entreno && 'entreno'].filter(Boolean).join('+') || 'nada'} · ${u.premium ? 'Premium' : 'gratis'}${u.en ? ' · EN' : ''}${u.mini ? ' · mini' : ''}`;

const resumen = []; let _tdbg = Date.now(); const DBG = process.env.DBG ? (...x) => { console.log('  ·', ...x, Date.now() - _tdbg, 'ms'); _tdbg = Date.now(); } : () => {};
const SOLO = process.env.SOLO ? process.env.SOLO.split(',').map(Number) : null;
const t0 = Date.now();
for (const u of usuarios.filter(u => !process.env.USU || (u.id >= +process.env.USU.split('-')[0] && u.id <= +process.env.USU.split('-')[1]))) {
  if (SOLO && !SOLO.includes(u.id)) continue;
  const r = rng(SEMILLA * 100 + u.id);
  const a = await abrirApp({ t0: T0, seed: SEMILLA * 100 + u.id });
  const prob = { errores: new Set(), raros: new Map(), datos: [], fuzz: 0, pantallas: 0, intentos: 0 };
  const nota = (tipo, msg) => { if (tipo === 'raro') { if (!prob.raros.has(msg)) prob.raros.set(msg, 1); } else prob.errores.add(msg); };
  // perfil y ajustes, como al terminar la bienvenida
  a.ev(`S=DEF(); S.settings.onboarded=true; S.settings.cloudAsked=true; S.settings.ui='${u.mini ? 'mini' : 'completa'}'; S.settings.lang='${u.lang}'; S.settings.checkin=${u.checkin}; S.settings.equip=${['["pc","est"]','["pc","est","man","ban","bnd"]','EQUIP_GYM.slice()'][u.id%3]};
    S.profile={name:'U${u.id}',age:${25 + u.id % 20},height:${u.sexo === 'h' ? 176 : 163},weight:${u.sexo === 'h' ? 82 : 64},sex:'${u.sexo}',fitness:'activo',injuries:[]};
    S.measures.push({id:'m0',date:Date.now()-30*DAY,peso:S.profile.weight}); window.isPremium=()=>${u.premium}; save(true); LAYERS.length=0; renderLayers(); MODALS.length=0; renderModals(); render();`);
DBG('perfil');
  if (u.entreno && u.premium) {
    a.ev(`openLayer('wizPandaria',{step:0,goal:'${u.meta}',days:3,minutes:50,level:'principiante',priorities:[],program:null}); refreshTop();`);
    a.tocar('wpSet', `goal|${u.meta}`); a.tocar('wpSet', 'days|3');
    for (let i = 0; i < 4; i++) a.tocar('wpStep', '1');
    a.tocar('wpAdd');
    a.ev(`LAYERS.length=0; renderLayers(); MODALS.length=0; renderModals();`);
  }
  // sin Premium, «Confía en PandarIA» lleva a Premium: estos usuarios eligen tres rutinas gratis de Explorar y su plan semanal
  if (u.entreno) {
    if (!u.premium) { for (const i of ['gym|3', 'casa|0', 'piernas|0']) { a.ev(`LAYERS.length=0; renderLayers();`); a.tocar('openTpl', i); a.tocar('tplAdd'); }
      a.ev(`LAYERS.length=0; renderLayers(); S.plan={days:[1,3,5],order:S.routines.filter(r=>!r.archived).map(r=>r.id)}; save(true);`); }
    if (!a.ev(`S.routines.length`)) prob.datos.push('no se pudieron crear las rutinas');
  }
  if (u.ayuno) a.ev(`const f=nut().fast; f.screened=true; f.plan='16:8'; save(true);`);
  if (u.comida) a.ev(`const n=nut(); n.goal='${u.meta === 'grasa' ? 'bajar' : u.meta === 'musculo' ? 'ganar' : 'mantener'}'; save(true);`);
  let peso = u.sexo === 'h' ? 82 : 64;

  const BLQ = u.premium ? /^openPremium$/ : /^$/; // con Premium forzado no hay licencia ni suscripción que mostrar
  for (let dia = 0; dia < DIAS; dia++) {
    const base = T0 + dia * D; a.w.__T = Math.max(a.w.__T, base);
    const dow = new Date(base).getUTCDay();
    try {
DBG('dia');
      // mañana: check-in (la mitad de los días)
      if (u.checkin && r() < 0.5) { a.ev(`A.checkinHoy()`); a.avanzar(500);
        const pick = k => a.tocar('ckhSet', `${k}|${Math.floor(r() * 3)}`); pick('sleep'); pick('energy'); pick('sore');
        const b = a.w.document.querySelector('#modals .btn.pri[data-a="cbm"]'); if (b) b.click(); a.avanzar(500); }
DBG('checkin');
      // ayuno: termina a mediodía (a veces antes de tiempo)
      if (u.ayuno) { a.w.__T = base + 5 * H + (r() < 0.2 ? -4 * H : 0); a.ev(`if (nut().fast.active) A.fastEndNow();`); a.avanzar(8000); a.ev(`MODALS.length=0; renderModals();`); }
DBG('ayuno1');
      // agua a lo largo del día
      if (u.agua) for (let i = 0; i < 4 + Math.floor(r() * 6); i++) { a.w.__T = base + (2 + i * 1.5) * H; a.ev(`A.water(${[250, 300, 500][Math.floor(r() * 3)]})`); a.avanzar(1000); }
      if (u.agua && r() < 0.1) a.ev(`A.water(-1)`);
DBG('agua');
      // comidas
      if (u.comida && r() < 0.9) { a.w.__T = base + 6 * H;
        const elegidas = COMIDAS.filter(() => r() < 0.75);
        a.ev(`(()=>{ const n=nd(), k=dayKey(), add=${JSON.stringify(elegidas)}.map(([id,gr,m])=>{ const f=alimGet(id); return Object.assign(alimMac(f,gr*${0.8 + r() * 0.5}),{id:uid(),fid:id,n:f.n,gr:Math.round(gr),m,t:Date.now()}); });
          n.diario[k]=(n.diario[k]||[]).concat(add); save(); diarioAdded(k,add); render(); })()`); a.avanzar(1000); }
DBG('comida');
      // entreno en los días del plan
      if (u.entreno && a.ev(`!!(S.plan&&S.plan.days.includes(new Date().getDay()))`) && r() < 0.85) {
        a.w.__T = base + 11 * H;
        const rid = a.ev(`(()=>{ const x=nextInPlan(); return x&&x.r?x.r.id:''; })()`);
        if (rid) {
          a.tocar('startWorkout', rid); a.avanzar(500); prob.intentos++;
          // puede haber otro aviso encima (p. ej. el del ayuno): se pulsa el botón Empezar del check-in, no el primero que haya
          const emp = [...a.w.document.querySelectorAll('#modals .btn.pri[data-a="cbm"]')].find(b => /^(Empezar|Start)/.test(b.textContent.trim())); if (emp) { emp.click(); a.avanzar(500); }
          if (!a.ev(`!!S.active`)) prob.datos.push(`día ${dia}: el entreno no empezó`);
          const sets = JSON.parse(a.ev(`JSON.stringify(S.active?S.active.items.flatMap(it=>it.sets.map((s,i)=>({u:it.uid,i,m:getEx(it.exId).mode,kg:s.kg??s.sk??s.tk,reps:s.reps??s.sr??s.tr,time:s.time??s.st??s.tt}))):[])`));
          for (const s of sets) {
            if (r() < 0.06) continue; // a veces se salta una serie
            const falla = r() < 0.15;
            a.ev(`(()=>{ const s=wkItem('${s.u}').sets[${s.i}]; ${s.m === 'p' ? `s.kg=${s.kg == null ? 'null' : s.kg}; s.reps=${Math.max(1, (s.reps || 8) - (falla ? 2 : 0))};` : s.m === 'r' ? `s.reps=${Math.max(1, (s.reps || 10) - (falla ? 3 : 0))};` : `s.time=${s.time || 30};`} })()`);
            a.tocar('wkCheck', `${s.u}|${s.i}`); a.ev(`MODALS.filter(m=>!m.locked).length&&document.querySelector('#modals [data-a="cbm"]')&&document.querySelector('#modals [data-a="cbm"]').click()`); a.avanzar(60000);
          }
          a.tocar('wkFinish'); a.avanzar(300); a.tocar('finDo', r() < 0.2 ? 'update' : 'keep'); a.avanzar(3000);
          a.ev(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`);
          if (a.ev(`!!S.active`)) prob.datos.push(`día ${dia}: el entreno no se cerró`);
        }
      }
DBG('entreno');
      // medidas: una vez por semana
      if (u.medidas && dow === 1) { peso += (u.meta === 'grasa' ? -0.4 : u.meta === 'musculo' ? 0.2 : 0) + (r() - 0.5) * 0.6;
        a.w.__T = base + 1 * H; a.tocar('addMeasure'); a.ev(`(()=>{ const i=document.querySelector('#m_peso'); if (i) i.value='${peso.toFixed(1)}'; })()`); a.tocar('mSave'); a.ev(`LAYERS.length=0; renderLayers();`); }
      // ayuno: empieza a las 20:00
      if (u.ayuno) { a.w.__T = base + 13 * H; a.ev(`if (!nut().fast.active) A.fastStart();`); a.avanzar(300);
        // 1.9.5: si PandarIA pregunta antes («¿Ayunar ahora?» por comer poco), la persona decide empezar igualmente
        if (a.ev(`!nut().fast.active && !!document.querySelector('#modals [data-a="cbm"]')`)) { a.tocar('cbm'); prob.avisoAyuno = (prob.avisoAyuno || 0) + 1; } }
DBG('medidas+ayuno');
      // noche: recorrer todas las pantallas, el panda y el estado del día, y tocar botones al azar
      a.w.__T = base + 14 * H;
      for (const t of ['rutinas', 'explorar', 'nutricion', 'ayuno', 'historial', 'ajustes']) {
        a.ev(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers(); A.tab('${t}');`); a.avanzar(300); prob.pantallas++;
        const tx = a.texto(); const m = tx.match(RAROS); if (m) nota('raro', `${t}: «${tx.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, ' ').trim()}»`);
        // botones al azar en esta pantalla (y en lo que abran)
        for (let k = 0; k < 4; k++) {
          const bs = [...a.w.document.querySelectorAll('#view [data-a], #layers .layer:last-child [data-a], #modals [data-a]')].filter(b => !BLOQUEADOS.test(b.dataset.a) && !BLQ.test(b.dataset.a));
          if (!bs.length) break; const b = bs[Math.floor(r() * bs.length)];
          const antes = a.errores.length;
          try { b.click(); } catch (e) { nota('error', `tocar ${b.dataset.a}(${b.dataset.v || ''}): ${String(e).slice(0, 200)}`); }
          a.avanzar(800); prob.fuzz++;
          if (a.errores.length > antes) a.errores.slice(antes).forEach(e => nota('error', `${t} › ${b.dataset.a}(${(b.dataset.v || '').slice(0, 30)}): ${e}`));
          const t2 = a.texto(); const m2 = t2.match(RAROS); if (m2) nota('raro', `${t} › ${b.dataset.a}: «${t2.slice(Math.max(0, m2.index - 60), m2.index + 40).replace(/\s+/g, ' ').trim()}»`);
        }
        a.ev(`if (S.active) { S.active=null; } MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`);
      }
DBG('pantallas');
      a.ev(`A.tab('rutinas'); A.guiaAbrir();`); a.avanzar(300);
      { const t2 = a.texto(); const m2 = t2.match(RAROS); if (m2) nota('raro', `panda: «${t2.slice(Math.max(0, m2.index - 60), m2.index + 40).replace(/\s+/g, ' ').trim()}»`); }
      a.ev(`MODALS.length=0; renderModals();`);
      if (u.premium) { a.ev(`A.estadoVer()`); a.avanzar(300); const t2 = a.texto(); const m2 = t2.match(RAROS); if (m2) nota('raro', `estado: «${t2.slice(Math.max(0, m2.index - 60), m2.index + 40).replace(/\s+/g, ' ').trim()}»`); a.ev(`LAYERS.length=0; renderLayers();`); }
      // los datos guardados se pueden leer y no se pierden
      const chk = JSON.parse(a.ev(`JSON.stringify((()=>{ let ok=true, ses=0, err=''; try{ const d=JSON.parse(localStorage.getItem(KEY)); ses=d.sessions.length; ok=d.v===DATA_VER; }catch(e){ ok=false; err=String(e); } return {ok,ses,mem:S.sessions.length,err}; })())`));
      if (!chk.ok) prob.datos.push(`día ${dia}: los datos guardados no se pueden leer (${chk.err})`);
      if (chk.ses !== chk.mem) prob.datos.push(`día ${dia}: entrenos en memoria ${chk.mem} y guardados ${chk.ses}`);
    } catch (e) { nota('error', `día ${dia}: ${String(e && (e.stack || e)).slice(0, 400)}`); }
    a.errores.splice(0).forEach(e => nota('error', e));
  }
  // el final: ¿se registró lo que tocaba?
  const fin = JSON.parse(a.ev(`JSON.stringify({ses:S.sessions.length, agua:Object.keys(nut().water||{}).length, diario:Object.keys((S.nutri&&S.nutri.diario)||{}).length, ayunos:nut().fast.history.length, medidas:S.measures.length, kb:Object.keys(KB).length,
    estado:premOK()?(estadoDia()||{}).score??null:'—', propuestas:premOK()?v3Propuestas().map(p=>p.k.split('-')[0]):[], novedades:premOK()?v3Novedades().map(p=>p.k.split('-')[0]):[], tam:usoDatos().c, rutinas:S.routines.filter(r=>!r.archived).length, plan:S.plan?S.plan.days.join(''):'-', activo:!!S.active})`));
  // (el usuario simulado se salta a veces su día: se compara con los entrenos que de verdad empezó)
  if (u.entreno && fin.ses < prob.intentos) prob.datos.push(`empezó ${prob.intentos} entrenos y solo hay ${fin.ses} guardados`);
  if (u.entreno && !prob.intentos) prob.datos.push('no pudo entrenar ningún día');
  if (!u.entreno && fin.ses) prob.datos.push(`${fin.ses} entrenos sin haber entrenado`);
  if (u.agua && fin.agua < DIAS * 0.9) prob.datos.push(`agua en solo ${fin.agua} días`);
  if (u.ayuno && fin.ayunos < DIAS * 0.8) prob.datos.push(`solo ${fin.ayunos} ayunos guardados`);
  resumen.push({ u: nombre(u), fin, errores: [...prob.errores], raros: [...prob.raros.keys()], datos: prob.datos, fuzz: prob.fuzz, pantallas: prob.pantallas });
  console.log(`${nombre(u)}: ${prob.errores.size} errores · ${prob.raros.size} textos raros · ${prob.datos.length} problemas de datos · ${prob.fuzz} toques al azar · ${fin.ses} entrenos`);
  a.cerrar();
}
fs.writeFileSync(new URL(`./resultado-usuarios${process.env.PARTE ? '-' + process.env.PARTE : ''}.json`, import.meta.url), JSON.stringify(resumen, null, 1));
console.log(`\n${resumen.length} usuarios · ${DIAS} días · ${Math.round((Date.now() - t0) / 1000)} s`);
const todos = new Map(); resumen.forEach(x => [...x.errores, ...x.raros, ...x.datos].forEach(e => { const k = e.replace(/\d+/g, '#').slice(0, 160); todos.set(k, (todos.get(k) || 0) + 1); }));
[...todos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).forEach(([k, n]) => console.log(`${n}× ${k}`));
process.exit(0);
