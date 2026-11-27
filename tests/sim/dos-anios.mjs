// 1.9.5.4 · 120 personas durante 2 años (marzo 2026 → marzo 2028, con el 29 de febrero de 2028).
// Cada una vive su vida con la app: check-in, agua, comidas, entrenos reales en pantalla, cardio, ayuno, peso, cintura,
// ciclo, retos, recetas y alimentos propios, copias de seguridad, cambios de idioma, de modo, de objetivo, de equipo,
// lesiones que aparecen y se curan, Premium que empieza o caduca, embarazo que termina, unidades de EE. UU.
// La app se cierra y se vuelve a abrir cada 45 días (como en un teléfono), y cada 2 semanas recorre todas las pantallas.
// Comprueba errores, textos rotos, culpa, coherencia científica, datos que se pierden y el tiempo de las pantallas con 2 años de datos.
//   node tests/sim/dos-anios.mjs [días=730] [desde-hasta=0-119]
import { abrirApp, rng, RAROS } from './app.mjs';
import fs from 'node:fs';

const DIAS = +process.argv[2] || 730, REAB = +process.env.REAB || 45;
const [DESDE, HASTA] = (process.argv[3] || '0-119').split('-').map(Number);
const T0 = process.env.INICIO ? Date.parse(process.env.INICIO + "T07:00:00Z") : Date.UTC(2026, 2, 2, 7, 0, 0), H = 3600000, D = 24 * H;
const CULPA = /\bvago\b|\bfloj[oa]\b|fracas|deber[ií]as avergonz|sin excusas|no tienes excusa|\bgord[oa]\b|\blazy\b|you failed|no excuses|\bpregui[cç]os/i;
const BLOQ = /^(wipeData|cloud|exportFile|exportCSV|exportCopy|importData|importCode|updDownload|kbUrl|obGoogle|ciGoogle|alScan|mPhoto|retoCompartir|shareSession|shareRoutine|copyCode|openPremium|pfRegalo|buy|restore|setLang|ciLogin|mpLogin|logout)/;
const LES = ['rodilla', 'lumbar', 'hombro', 'muneca', 'tobillo', 'codo', 'cadera', 'cuello'];
const METAS = ['fuerza', 'musculo', 'grasa', 'salud'];
const AYUNOS = [null, null, null, '14:10', '16:8', '18:6', '20:4', 'OMAD', '5:2'];
const OUT = new URL(process.env.OUTF || `./resultado-2anios.jsonl`, import.meta.url);

// 120 personas: combinaciones deterministas con mucha variedad
const P = [];
for (let i = 0; i < 120; i++) {
  const r = rng(5000 + i), pick = a => a[Math.floor(r() * a.length)];
  const sexo = i % 7 === 6 ? 'x' : i % 2 ? 'm' : 'h';
  const edad = [16, 17, 19, 22, 25, 28, 31, 34, 37, 40, 43, 46, 49, 52, 55, 58, 61, 64, 67, 70, 73, 77, 81, 85][i % 24];
  const alto = Math.round((sexo === 'h' ? 176 : sexo === 'm' ? 163 : 170) + (r() - 0.5) * 24);
  const imc = [16.5, 19, 21, 23, 25, 27, 29, 31, 34, 38, 43][Math.floor(r() * 11)];
  const peso = Math.round(imc * (alto / 100) ** 2 * 10) / 10;
  const p = { i, sexo, edad, alto, peso, meta: pick(METAS), forma: pick(['sedentario', 'activo', 'activo', 'muy_activo']),
    les: r() < 0.3 ? [pick(LES)].concat(r() < 0.3 ? [pick(LES)] : []).filter((x, k, a) => a.indexOf(x) === k) : [],
    premium: r() < 0.65, lang: pick(['es', 'es', 'en', 'pt']), mini: r() < 0.15, us: r() < 0.12,
    ayuno: edad >= 18 ? pick(AYUNOS) : null, embarazo: sexo === 'm' && edad >= 22 && edad <= 40 && r() < 0.12,
    diabetes: r() < 0.08, ciclo: sexo === 'm' && edad < 50 && r() < 0.4, animo: r() < 0.15 ? 'bajo' : null, sueno: r() < 0.15 ? 'poco' : null,
    constancia: pick(['alta', 'alta', 'alta', 'media', 'media', 'baja', 'abandona', 'temporadas']), cardio: r() < 0.3, doble: r() < 0.06,
    equipo: pick(['gym', 'gym', 'casa', 'mancuernas', 'parque']), nocturno: r() < 0.1, datosRaros: r() < 0.08, comida: pick(['bien', 'bien', 'poco', 'mucho', 'nada']),
    eventos: {} };
  // cambios de vida a lo largo de los 2 años
  const ev = (d, k, v) => { (p.eventos[d] = p.eventos[d] || []).push([k, v]); };
  if (r() < 0.3) ev(60 + Math.floor(r() * 500), 'meta', pick(METAS));
  if (r() < 0.25) { const d = 30 + Math.floor(r() * 500); ev(d, 'lesion+', pick(LES)); ev(d + 30 + Math.floor(r() * 90), 'lesion-', null); }
  if (r() < 0.2) ev(90 + Math.floor(r() * 400), 'premium', !p.premium);
  if (r() < 0.15) ev(100 + Math.floor(r() * 500), 'lang', pick(['es', 'en', 'pt']));
  if (r() < 0.15) ev(50 + Math.floor(r() * 600), 'mini', !p.mini);
  if (r() < 0.2) ev(40 + Math.floor(r() * 600), 'equipo', pick(['gym', 'casa', 'mancuernas', 'parque']));
  if (p.embarazo) ev(120 + Math.floor(r() * 120), 'parto', null);
  if (r() < 0.2) ev(150 + Math.floor(r() * 400), 'ayuno', p.ayuno ? null : pick(['14:10', '16:8']));
  if (r() < 0.15) ev(200 + Math.floor(r() * 300), 'animo', p.animo ? null : 'bajo');
  P.push(p);
}
const desc = p => `Q${String(p.i).padStart(3, '0')} ${p.edad}${p.sexo} ${p.peso}kg/${p.alto} ${p.meta}${p.les.length ? ' [' + p.les + ']' : ''}${p.ayuno ? ' ayuno' + p.ayuno : ''}${p.embarazo ? ' embarazo' : ''}${p.diabetes ? ' diabetes' : ''}${p.animo ? ' ánimo' : ''}${p.sueno ? ' sueño' : ''} ${p.constancia} ${p.equipo}${p.us ? ' US' : ''} ${p.premium ? 'Pre' : 'Grat'} ${p.lang}${p.mini ? ' mini' : ''}`;

const EQ = { gym: 'EQUIP_GYM', casa: "['pc','est']", mancuernas: "['pc','est','man','ban','bnd','bici']", parque: "['pc','est','dom','par','barra_paralelas']" };

for (const p of P.filter(p => p.i >= DESDE && p.i <= HASTA)) {
  const t0 = Date.now(), r = rng(7000 + p.i);
  const f = { errores: new Set(), raros: new Set(), ciencia: new Set(), identidad: new Set(), datos: new Set(), lento: {}, reaperturas: 0, toques: 0 };
  const borrados = new Set();
  const abrir = async (storage, t) => { const x = await abrirApp({ t0: t, storage, seed: 7000 + p.i, antes: w => { if (p.us) w.PF_REGION = 'US'; } });
    // entrenos que el usuario simulado intentó borrar (toque al azar en «Eliminar entreno»): si faltan al final, no cuentan como pérdida
    x.w.__borrado = id => borrados.add(id); x.ev(`(()=>{ const o=A.delSession; A.delSession=id=>{ window.__borrado(id); return o(id); }; })()`); return x; };
  let a = await abrir({}, T0);
  const misIds = [];
  const raro = donde => { const t = a.texto(); const m = t.match(RAROS); if (m) f.raros.add(`${donde}: «${t.slice(Math.max(0, m.index - 50), m.index + 30).replace(/\s+/g, ' ').trim()}»`);
    const c = t.match(CULPA); if (c) f.identidad.add(`${donde}: «${t.slice(Math.max(0, c.index - 50), c.index + 30).replace(/\s+/g, ' ').trim()}»`); };
  const limpiar = () => a.ev(`if (S.active) S.active=null; MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`);
  const erroresDe = donde => a.errores.splice(0).forEach(e => f.errores.add(`${donde}: ${e.slice(0, 260)}`));
  const st = { premium: p.premium, lang: p.lang, mini: p.mini, les: [...p.les], meta: p.meta, embarazo: p.embarazo, ayuno: p.ayuno, animo: p.animo, equipo: p.equipo };
  const goalN = m => m === 'grasa' ? 'bajar' : m === 'musculo' ? 'ganar' : 'mantener';
  a.ev(`S=DEF(); unidadesIniciales(); S.settings.onboarded=true; S.settings.cloudAsked=true; S.settings.ui='${st.mini ? 'mini' : 'completa'}'; S.settings.lang='${st.lang}'; S.settings.checkin=true; S.settings.equip=${EQ[st.equipo]};
    S.profile={name:'Q${p.i}',age:${p.edad},height:${p.alto},weight:${p.peso},sex:'${p.sexo}',fitness:'${p.forma}',injuries:${JSON.stringify(st.les)}${st.embarazo ? ',embarazo:true' : ''}};
    S.measures.push({id:'m0',date:Date.now()-7*DAY,peso:${p.peso}}); window.isPremium=()=>${st.premium};
    const n=nut(); n.goal='${goalN(st.meta)}'; ${st.ayuno ? `n.fast.screened=true; n.fast.plan='${st.ayuno}';${p.diabetes ? ' n.fast.diabetes=true;' : ''}` : ''}
    save(true); render();`);
  const rutinas = () => {
    limpiar();
    a.ev(`S.routines.forEach(r=>r.archived=true); S.plan=null; save(true);`);
    if (st.premium) {
      a.ev(`openLayer('wizPandaria',{step:0,goal:'${st.meta}',days:${p.doble ? 5 : p.edad > 65 ? 2 : 3 + Math.floor(r() * 2)},minutes:${p.edad > 60 ? 35 : [30, 45, 60][Math.floor(r() * 3)]},level:'${p.forma === 'sedentario' ? 'principiante' : p.forma === 'activo' ? 'intermedio' : 'avanzado'}',priorities:[],program:null}); refreshTop();`);
      for (let k = 0; k < 4; k++) a.tocar('wpStep', '1');
      a.tocar('wpAdd');
    } else {
      for (const t of st.equipo === 'gym' ? ['gym|3', 'gym|1', 'piernas|0'] : ['casa|0', 'casa|1', 'casa|2']) { limpiar(); a.tocar('openTpl', t); a.tocar('tplAdd'); }
      a.ev(`S.plan={days:[1,3,5],order:S.routines.filter(r=>!r.archived).map(r=>r.id)}; save(true);`);
    }
    limpiar(); erroresDe('rutinas');
    const bloq = JSON.parse(a.ev(`JSON.stringify(S.routines.filter(r=>!r.archived).flatMap(r=>r.items.map(it=>it.exId)).filter(id=>profileBlocks(id)))`));
    if (bloq.length) (st.premium ? f.ciencia : f.identidad).add(`${st.premium ? 'asistente' : 'plantilla'} con ejercicios desaconsejados para su perfil: ${[...new Set(bloq)].slice(0, 4).join(', ')}`);
    if (!a.ev(`S.routines.filter(r=>!r.archived).length`)) f.datos.add('sin rutinas activas tras crear');
  };
  rutinas();

  let peso = p.peso, cintura = Math.round(p.peso * 0.6 + p.alto * 0.15), intentos = 0, sesionesUI = 0, maxSes = 0;
  for (let dia = 0; dia < DIAS; dia++) {
    const b0 = T0 + dia * D; a.w.__T = Math.max(a.w.__T, b0);
    const dow = new Date(b0).getUTCDay();
    try {
      // cambios de vida
      for (const [k, v] of p.eventos[dia] || []) {
        limpiar();
        if (k === 'meta') { st.meta = v; a.ev(`nut().goal='${goalN(v)}'; save(true);`); rutinas(); }
        if (k === 'lesion+') { if (!st.les.includes(v)) st.les.push(v); a.ev(`S.profile.injuries=${JSON.stringify(st.les)}; save(true);`); rutinas(); }
        if (k === 'lesion-') { st.les = [...p.les]; a.ev(`S.profile.injuries=${JSON.stringify(st.les)}; save(true);`); }
        if (k === 'premium') { st.premium = v; a.ev(`window.isPremium=()=>${v}; render();`); }
        if (k === 'lang') { st.lang = v; a.ev(`S.settings.lang='${v}'; save(true); render();`); }
        if (k === 'mini') { st.mini = v; a.ev(`S.settings.ui='${v ? 'mini' : 'completa'}'; save(true); render();`); }
        if (k === 'equipo') { st.equipo = v; a.ev(`S.settings.equip=${EQ[v]}; save(true);`); rutinas(); }
        if (k === 'parto') { st.embarazo = false; a.ev(`delete S.profile.embarazo; save(true); render();`); }
        if (k === 'ayuno') { st.ayuno = v; a.ev(`const ff=nut().fast; ${v ? `ff.screened=true; ff.plan='${v}';` : `delete ff.active; ff.plan=null;`} save(true);`); }
        if (k === 'animo') st.animo = v;
        erroresDe(`evento ${k}`);
      }
      const activo = !(p.constancia === 'abandona' && dia > 120 && dia < 300) && !(p.constancia === 'temporadas' && Math.floor(dia / 60) % 2 === 1);
      const prob = { alta: 0.85, media: 0.6, baja: 0.3, abandona: 0.8, temporadas: 0.8 }[p.constancia];
      const rapido = process.env.RAPIDO && dia >= +process.env.RAPIDO && dow !== 1; // años siguientes: 6 de cada 7 días sin pantallas (los lunes, completos)
      if (activo && rapido) {
        a.w.__T = b0 + 3 * H; for (let k = 0; k < 3; k++) a.ev(`A.water(${[250, 330, 500][k]})`);
        if (p.comida !== 'nada' && r() < 0.7) a.ev(`(()=>{ const f=alimGet('05062'), k=dayKey(), n=nd(); const it=Object.assign(alimMac(f,180),{id:uid(),fid:'05062',n:f.n,gr:180,m:'almuerzo',t:Date.now()}); n.diario[k]=(n.diario[k]||[]).concat([it]); save(); })()`);
        a.w.__T = b0 + 11 * H;
        if (a.ev(`!!(S.plan&&S.plan.days.includes(new Date().getDay()))`) && r() < prob) {
          const ok = a.ev(`(()=>{ try{ const x=nextInPlan(); if (!x||!x.r) return 0; const it=x.r.items.map(i=>({exId:i.exId,uid:uid(),sets:(i.sets||[]).map(s=>Object.assign({},s,{kg:s.kg??s.sk??null,reps:s.reps??s.sr??null,time:s.time??s.st??null,done:true}))})); S.sessions.push({id:uid(),routineId:x.r.id,routineName:x.r.name,start:Date.now()-50*60000,end:Date.now(),intensity:7,items:it,prs:[]}); save(); return 1; }catch(e){ return String(e); } })()`);
          if (ok !== 1 && ok !== 0) f.errores.add('entreno rápido: ' + ok); else if (ok) { sesionesUI++; misIds.push(a.ev(`(S.sessions[S.sessions.length-1]||{}).id+'|'+(S.sessions[S.sessions.length-1]||{}).routineId`)); }
        }
        erroresDe('día rápido');
      }
      if (activo && !rapido) {
        // check-in
        if (r() < 0.5) { a.ev(`A.checkinHoy()`); a.avanzar(200);
          for (const k of ['sleep', 'energy', 'sore', 'mood']) { const bajo = (k === 'mood' && st.animo === 'bajo') || (k === 'sleep' && p.sueno === 'poco'); a.tocar('ckhSet', `${k}|${bajo ? (r() < 0.75 ? 0 : 1) : 1 + Math.floor(r() * 2)}`); }
          const bt = a.w.document.querySelector('#modals .btn.pri[data-a="cbm"]'); if (bt) bt.click(); a.avanzar(200); limpiar(); }
        // agua
        for (let k = 0; k < 2 + Math.floor(r() * 4); k++) { a.w.__T = b0 + (1 + k * 2) * H; a.ev(`A.water(${[200, 250, 330, 500][Math.floor(r() * 4)]})`); }
        // comidas
        if (p.comida !== 'nada' && r() < 0.8) { a.w.__T = b0 + 5 * H; const fac = p.comida === 'poco' ? 0.4 : p.comida === 'mucho' ? 1.8 : 1;
          a.ev(`(()=>{ const n=nd(), k=dayKey(), L=[['20038',70,'desayuno'],['01077',250,'desayuno'],['09040',120,'desayuno'],['05062',180,'almuerzo'],['20045',200,'almuerzo'],['04053',10,'almuerzo'],['01116',125,'merienda'],['15121',120,'cena'],['16070',200,'cena'],['18069',60,'cena']];
            const add=L.filter(()=>Math.random()<0.7).map(([id,gr,m])=>{ const f=alimGet(id); return Object.assign(alimMac(f,gr*${fac}*(0.8+Math.random()*0.5)),{id:uid(),fid:id,n:f.n,gr:Math.round(gr*${fac}),m,t:Date.now()}); });
            n.diario[k]=(n.diario[k]||[]).concat(add); save(); diarioAdded(k,add); })()`); }
        // ayuno: termina a mediodía y empieza a las 20 h
        if (st.ayuno && st.ayuno !== '5:2') { a.w.__T = b0 + 5 * H; a.ev(`if (nut().fast.active) A.fastEndNow();`); a.avanzar(500); limpiar(); }
        // entreno
        const toca = a.ev(`!!(S.plan&&S.plan.days.includes(new Date().getDay()))`);
        if ((toca || (p.doble && r() < 0.3)) && r() < prob) {
          for (let vez = 0; vez < (p.doble && r() < 0.4 ? 2 : 1); vez++) {
            a.w.__T = b0 + (p.nocturno ? 16 : 10 + vez * 6) * H; limpiar();
            if (p.cardio && r() < 0.4) { // cardio ahora, de verdad, con su temporizador
              a.ev(`try{ A.cardioAhora && A.cardioAhora(); }catch(e){}`); a.avanzar(300);
              const cb = a.w.document.querySelector('#modals .btn.pri[data-a="cbm"], #layers .layer:last-child .btn.pri[data-a]'); if (cb) { cb.click(); a.avanzar(300); }
              a.avanzar(25 * 60000); a.ev(`(document.querySelector('#modals .btn.pri[data-a="cbm"]')||{click(){}}).click()`); a.avanzar(500); limpiar(); erroresDe('cardio'); continue;
            }
            const rid = a.ev(`(()=>{ const x=nextInPlan(); return x&&x.r?x.r.id:''; })()`);
            if (!rid) continue;
            a.tocar('startWorkout', rid); a.avanzar(300); intentos++;
            for (let k = 0; k < 3; k++) {
              const sc = a.ev(`(document.querySelector('#modals .scrim:last-child')||{}).textContent||''`); if (!sc) break;
              if (/Cómo sigue tu molestia|How is your discomfort|Como está seu incômodo/.test(sc)) { const nb = [...a.w.document.querySelectorAll('#modals .scrim:last-child button')].filter(x => /^\d+$/.test(x.textContent.trim())); if (nb.length) { nb[Math.floor(r() * nb.length)].click(); a.avanzar(200); } const ok = [...a.w.document.querySelectorAll('#modals .scrim:last-child button')].find(x => /^(Entendido|Got it|Entendi|Cerrar|Close|Fechar)$/.test(x.textContent.trim())); if (ok) { ok.click(); a.avanzar(200); } continue; }
              const emp = [...a.w.document.querySelectorAll('#modals .btn.pri[data-a="cbm"]')].find(x => /^(Empezar|Start|Começar|Iniciar|Entrenar|Train|Treinar|Seguir|Continue|Continuar)/.test(x.textContent.trim()));
              if (emp) { emp.click(); a.avanzar(200); } else break;
            }
            if (!a.ev(`!!S.active`)) { limpiar(); continue; }
            const sets = JSON.parse(a.ev(`JSON.stringify(S.active.items.flatMap(it=>it.sets.map((s,i)=>({u:it.uid,i,m:getEx(it.exId).mode,kg:s.kg??s.sk??s.tk,reps:s.reps??s.sr??s.tr}))))`));
            const ui = intentos % (+process.env.UICADA || 3) === 1; // 1 de cada 3 entrenos serie a serie en pantalla; el resto se marcan y se terminan
            if (!ui) a.ev(`S.active.items.forEach(it=>it.sets.forEach(s=>{ if (Math.random()<0.95){ if (s.kg==null&&s.sk!=null) s.kg=s.sk; if (s.reps==null&&s.sr!=null) s.reps=s.sr; if (s.time==null&&s.st!=null) s.time=s.st; s.done=true; } }))`);
            for (const s of ui ? sets : []) {
              if (r() < 0.05) continue;
              const kg = p.datosRaros && r() < 0.03 ? [0, 999, -5][Math.floor(r() * 3)] : s.kg;
              a.ev(`(()=>{ const s=wkItem('${s.u}').sets[${s.i}]; ${s.m === 'p' ? `s.kg=${kg == null ? 'null' : kg}; s.reps=${Math.max(1, (s.reps || 8) - (r() < 0.15 ? 2 : 0))};` : s.m === 'r' ? `s.reps=${Math.max(1, s.reps || 10)};` : `s.time=${s.time || 30};`} })()`);
              a.tocar('wkCheck', `${s.u}|${s.i}`); a.ev(`document.querySelector('#modals [data-a="cbm"]')&&MODALS.filter(m=>!m.locked).length&&document.querySelector('#modals [data-a="cbm"]').click()`); a.avanzar(3000);
            }
            if (r() < 0.04) a.ev(`(()=>{ const it=S.active.items[0]; typeof dolorGuardar==='function'&&dolorGuardar(it.exId, ${3 + Math.floor(r() * 5)}); })()`);
            a.tocar('wkFinish'); a.avanzar(200); a.tocar('finDo', r() < 0.15 ? 'update' : 'keep'); a.avanzar(1500); limpiar();
            if (a.ev(`!!S.active`)) { f.datos.add('un entreno no se cerró'); a.ev(`S.active=null`); } else { sesionesUI++; misIds.push(a.ev(`(S.sessions[S.sessions.length-1]||{}).id+'|'+(S.sessions[S.sessions.length-1]||{}).routineId`)); }
            erroresDe('entreno');
          }
        }
        // peso cada lunes (con el ritmo que su objetivo y su comida explican), cintura el día 1 de cada mes
        if (dow === 1) { const tend = (st.meta === 'grasa' ? -0.3 : st.meta === 'musculo' ? 0.12 : 0) * (dia > 300 ? 0.3 : 1) + (p.comida === 'mucho' ? 0.2 : p.comida === 'poco' ? -0.2 : 0) + (st.embarazo ? 0.35 : 0);
          peso = Math.max(38, Math.min(220, peso + tend + (r() - 0.5) * 0.6));
          const v = p.datosRaros && r() < 0.2 ? ['0', '-5', '999', '72,5', ' 70 ', 'abc', ''][Math.floor(r() * 7)] : (p.us ? (peso * 2.20462).toFixed(1) : peso.toFixed(1));
          a.w.__T = b0 + H; limpiar(); a.tocar('addMeasure'); a.ev(`(()=>{ const i=document.querySelector('#m_peso'); if (i) i.value='${v}'; const c=document.querySelector('#m_cintura'); if (c && ${new Date(b0).getUTCDate() <= 7}) c.value='${((cintura += (st.meta === 'grasa' ? -0.4 : 0.05)) / (p.us ? 2.54 : 1)).toFixed(1)}'; })()`); a.tocar('mSave'); const trasGuardar = a.ev(`LAYERS.map(l=>l.t).join(',')+' | '+((document.querySelector('#modals')||{}).textContent||'').replace(/\\s+/g,' ').slice(0,160)`); limpiar();
          const ult = a.ev(`(S.measures.filter(m=>m.peso).slice(-1)[0]||{}).peso`);
          if (process.env.DBGP) console.log('lunes', dia, v, ult, a.ev(`S.settings.unit+'/'+S.settings.uLong`), trasGuardar.slice(0,120), a.ev(`[...document.querySelectorAll('.toast')].map(t=>t.textContent).join('|')`));
          if (!(ult > 25 && ult < 400)) f.datos.add(`peso guardado ${ult} al escribir «${v}»`);
          if (p.us && /^\d/.test(v) && Math.abs(ult - peso) > 1.5 && !p.datosRaros) f.datos.add(`en EE. UU. escribió ${v} lb y se guardó ${ult} kg (esperado ~${peso.toFixed(1)}) · día ${dia} · tras guardar: ${trasGuardar} · ${a.ev(`LAYERS.map(l=>l.t).join(',')+' | '+((document.querySelector('#modals')||{}).textContent||'').replace(/\\s+/g,' ').slice(0,140)+' | med '+S.measures.slice(-2).map(m=>new Date(m.date).toISOString().slice(0,10)+':'+m.peso).join(' ')`)}`);
          erroresDe('peso'); }
        // Mi PandarIA cada día: pestaña, puntos que nunca bajan, rapidez del cálculo
        // 1.9.7: después del final de la temporada, Mi PandarIA tiene que estar en pausa y pedir actualizar
        if (process.env.MPDIARIO && dia % 15 === 7 && a.ev(`typeof mpTerminada==='function'&&mpTerminada()&&mpAbierta()&&!S.settings.mpOff`)) {
          limpiar(); a.ev(`MP_MEMO=null; A.tab('mipandaria')`); a.avanzar(200); const vv = a.texto(); raro('mi pandaria terminada');
          if (!/TERMINADA|FINISHED|ENCERRADA/.test(vv) || !/Actualiza|Update|Atualize/.test(vv)) { f.datos.add(`Mi PandarIA no muestra la temporada terminada (día ${dia})`); if (process.env.DBGMP) console.log("MPFIN", dia, a.ev(`TAB+"|"+JSON.stringify(mpS())+"|"+(S.settings.mpOff||"")`), vv.slice(0,400)); }
          const ult = a.ev(`Object.keys(mpCalc().dias).pop()||''`); if (ult > a.ev('MP_FIN()')) f.datos.add(`Mi PandarIA sigue contando después del final (${ult})`);
          limpiar(); erroresDe('mi pandaria terminada');
        }
        if (process.env.MPDIARIO && a.ev(`typeof mpAbierta==='function'&&dayKey()>=MP_INI&&!mpTerminada()`)) {
          a.w.__T = b0 + 14.5 * H; limpiar(); a.ev(`MP_MEMO=null; A.tab('mipandaria')`); a.avanzar(300); raro('mi pandaria'); a.ev(`MODALS.length=0; renderModals();`);
          const t1 = Date.now(); const tot = a.ev(`(MP_MEMO=null, mpCalc().total)`); const ms = Date.now() - t1; (f.lento.mpcalc = f.lento.mpcalc || []).push([dia, ms]);
          
          const rg = a.ev(`mpRango(mpCalc().total).r`); if (f.mpRg != null && rg < f.mpRg) f.ciencia.add(`Mi PandarIA: el rango bajó (día ${dia})`); f.mpRg = Math.max(f.mpRg || 0, rg);
          const dd = JSON.parse(a.ev(`JSON.stringify((()=>{ const d=mpCalc().dias[dayKey()]; return d?{b:d.base,t:d.total,cont:!!mpCont(dayKey()),edad:+(S.profile.age||0),alt:!!(MP_CONT.find(x=>x.d===dayKey())||{}).alt,menor:!!(mpCont(dayKey())||{}).menor}:null; })())`));
          if (!dd) f.datos.add(`Mi PandarIA sin día de hoy (día ${dia})`);
          else { if (!(dd.b >= 0 && dd.b <= 150)) f.ciencia.add(`Mi PandarIA: ${dd.b} puntos base`); if (dd.edad && dd.edad < 18 && dd.alt && !dd.menor) f.identidad.add(`Mi PandarIA: un menor ve una tarjeta +18 (día ${dia})`);
            if (!dd.cont && a.ev(`dayKey()<='2027-01-31'`)) f.datos.add(`Mi PandarIA: sin contenido el ${a.ev('dayKey()')}`); }
          limpiar(); erroresDe('mi pandaria');
        }
        // Mi PandarIA: ver el contenido y hacer una actividad del día (si está abierta)
        if (r() < 0.35 && a.ev(`typeof mpAbierta==='function'&&dayKey()>=MP_INI&&mpAbierta()`)) {
          a.w.__T = b0 + 12 * H; limpiar(); a.ev(`A.mpCont()`); a.avanzar(200); raro('mp contenido'); limpiar();
          if (r() < 0.6) { const kx = a.ev(`(mpExtrasDe(dayKey())[0]||{}).k||''`); if (kx) { a.ev(`A.mpExtra('${kx}')`); for (let s = 0; s < 520; s += 4) a.avanzar(4000); for (let s = 0; s < 10; s++) a.avanzar(1000);
            a.ev(`(()=>{ const b=[...document.querySelectorAll('#modals button')].find(x=>/Guardar|Save|Salvar/.test(x.textContent)); b&&b.click(); })()`); a.avanzar(1500); limpiar(); erroresDe('mp actividad'); } }
          const pm = JSON.parse(a.ev(`JSON.stringify(Object.values(mpCalc().dias).map(d=>d.base))`)); if (pm.some(v => !(v >= 0 && v <= 150))) f.ciencia.add('Mi PandarIA: puntos fuera de 0-150');
        }
        // ciclo
        if (p.ciclo && !st.embarazo && dia % 28 === 3) { a.ev(`if(!S.ciclo) A.cicloOn(); A.cicloHoy();`); erroresDe('ciclo'); }
        // ayuno: empieza a las 20 h (si PandarIA pregunta antes, la persona decide empezar)
        if (st.ayuno && st.ayuno !== '5:2') { a.w.__T = b0 + 13 * H; a.ev(`if (!nut().fast.active) A.fastStart();`); a.avanzar(200);
          if (a.ev(`!nut().fast.active && /Ayunar ahora|Fast now|Jejuar agora/.test((document.querySelector('#modals')||{}).textContent||'')`)) { if (r() < 0.5) a.tocar('cbm'); } limpiar(); }
      }
      // cada 2 semanas: todas las pantallas, la guía, el estado y botones al azar; cada 90 días, mucho más
      a.w.__T = b0 + 15 * H;
      const G = process.env.RAPIDO && dia >= +process.env.RAPIDO ? 63 : (+process.env.GIRA || 21), gira = dia % G === G - 1, grande = dia % 120 === 119 || dia === DIAS - 1;
      if (gira || grande) {
        for (const t of ['rutinas', 'explorar', 'nutricion', 'ayuno', 'mipandaria', 'historial', 'ajustes']) {
          limpiar(); const t1 = Date.now(); a.ev(`A.tab('${t}')`); const ms = Date.now() - t1;
          (f.lento[t] = f.lento[t] || []).push([dia, ms]); a.avanzar(150); raro(t);
          for (let k = 0; k < (grande ? 14 : 3); k++) {
            const bs = [...a.w.document.querySelectorAll('#view [data-a], #layers .layer:last-child [data-a], #modals [data-a]')].filter(x => !BLOQ.test(x.dataset.a));
            if (!bs.length) break; const bt = bs[Math.floor(r() * bs.length)]; const n0 = a.errores.length;
            try { bt.click(); } catch (e) { f.errores.add(`${t} › ${bt.dataset.a}: ${String(e).slice(0, 160)}`); }
            a.avanzar(400); f.toques++;
            a.errores.slice(n0).forEach(e => f.errores.add(`${t} › ${bt.dataset.a}(${(bt.dataset.v || '').slice(0, 20)}): ${e.slice(0, 220)}`)); a.errores.splice(n0);
            raro(`${t} › ${bt.dataset.a}`);
          }
          limpiar();
        }
        a.ev(`A.tab('rutinas'); A.guiaAbrir();`); a.avanzar(200); raro('guía');
        if (st.animo === 'bajo' && st.premium && a.ev(`animoBajosMuchos()`) && !/ánimo bajo|low mood|ânimo baixo/i.test(a.texto())) f.identidad.add(`día ${dia}: muchos días de ánimo bajo y la guía no ofrece apoyo`);
        limpiar();
        if (st.premium) { a.ev(`A.estadoVer&&A.estadoVer()`); a.avanzar(200); raro('estado del día'); limpiar(); }
        // ciencia en cada vuelta
        const N = JSON.parse(a.ev(`JSON.stringify(calcNutrition())`));
        if (N) { const gk = N.prot / (N.wr || N.w);
          if (gk < 1.2 || gk > 2.4) f.ciencia.add(`proteína ${N.prot} g (${gk.toFixed(2)} g/kg de referencia)`);
          if (N.goal === 'bajar' && N.kcal < N.bmr - 10) f.ciencia.add(`meta ${N.kcal} kcal bajo el basal ${N.bmr}`);
          if (N.kcal < (p.sexo === 'h' ? 1500 : 1200) && N.goal !== 'mantener') f.ciencia.add(`meta de ${N.kcal} kcal con objetivo ${N.goal}`);
          if (N.carbs < 60) f.ciencia.add(`solo ${N.carbs} g de carbohidratos (${N.kcal} kcal, ${N.w} kg)`);
          if (p.edad + dia / 365 < 18 && N.goal !== 'mantener') f.ciencia.add('menor de edad con déficit o superávit');
          if (st.embarazo && N.goal === 'bajar') f.ciencia.add('embarazada con déficit'); }
        else f.ciencia.add(`día ${dia}: sin metas de nutrición`);
        const agua = a.ev(`waterGoal()`); if (!(agua >= 1200 && agua <= 5000)) f.ciencia.add(`agua ${agua} ml`);
        const est = st.premium ? a.ev(`(estadoDia()||{}).score??null`) : null; if (est != null && !(est >= 0 && est <= 100)) f.ciencia.add(`estado del día ${est}`);
        erroresDe('vuelta');
      }
      if (grande) {
        // todas las preguntas de la consulta con sus datos
        const C = JSON.parse(a.ev(`JSON.stringify((()=>{ const o={err:[],raros:[],vacias:[],culpa:[]}; CQ.forEach(q=>{ try{ const pp={}; if (q.p) { const ops=CQ_PARAMS[q.p].ops(); if (ops.length) pp[q.p]=ops[Math.floor(Math.random()*ops.length)][0]; }
          const R=q.f(pp); const t=JSON.stringify(R); if (!R||!R.corta) o.vacias.push(q.id); const m=t.match(${RAROS}); if (m) o.raros.push(q.id+': '+t.slice(Math.max(0,m.index-50),m.index+20)); if (${CULPA}.test(t)) o.culpa.push(q.id);
          LAYERS.length=0; openLayer('consultaQ',{id:q.id,p:pp}); const h=document.querySelector('#layers .layer:last-child'); if (h){ const m2=h.textContent.match(${RAROS}); if (m2) o.raros.push('pantalla '+q.id+': '+h.textContent.slice(Math.max(0,m2.index-50),m2.index+20)); } }catch(e){ o.err.push(q.id+': '+String(e.message||e).slice(0,140)); } }); LAYERS.length=0; renderLayers(); return o; })())`));
        C.err.forEach(e => f.errores.add('consulta ' + e)); C.raros.forEach(e => f.raros.add('consulta ' + e)); C.vacias.forEach(e => f.datos.add('consulta sin respuesta: ' + e)); C.culpa.forEach(e => f.identidad.add('consulta con culpa: ' + e));
        // copia de seguridad: exportar e importar sin perder nada
        const bk = a.ev(`(()=>{ try{ const txt=datosCompletosJSON(); const n0=S.sessions.length, m0=S.measures.length; importText(txt); const b=[...document.querySelectorAll('#modals [data-a="cbm"]')].pop(); if (b) b.click(); return JSON.stringify({ok:S.sessions.length===n0&&S.measures.length===m0,n0,n1:S.sessions.length,kb:Math.round(txt.length/1024)}); }catch(e){ return JSON.stringify({ok:false,e:String(e)}); } })()`);
        const B = JSON.parse(bk); if (!B.ok) f.datos.add('copia de seguridad: ' + bk); limpiar(); a.avanzar(1000);
        erroresDe('día grande');
      }
      // cerrar y abrir la app cada 45 días, con todo lo guardado
      if (dia % REAB === REAB - 1) {
        const antes = JSON.parse(a.ev(`JSON.stringify({ses:S.sessions.length, med:S.measures.length, rut:S.routines.length, dia:Object.values(nd().diario).filter(x=>x&&x.length).length})`)); const kAntes = JSON.parse(a.ev(`JSON.stringify(Object.entries(nd().diario).filter(([k,x])=>x&&x.length).map(([k,x])=>k+':'+x.length))`));
        a.ev(`save(true)`); const storage = {}; for (let k = 0; k < a.w.localStorage.length; k++) { const key = a.w.localStorage.key(k); storage[key] = a.w.localStorage.getItem(key); }
        const tt = a.w.__T; if (process.env.DBGK) console.log('LS tiene', process.env.DBGK, JSON.parse(storage['pandaria-fit-v1']||'{}').nutri?.diario?.[process.env.DBGK]?.length, 'mem', a.ev(`(nd().diario['${process.env.DBGK}']||[]).length`), 'pend', a.pendientes()); a.cerrar(); a = await abrir(storage, tt + 6 * H); f.reaperturas++;
        a.ev(`window.isPremium=()=>${st.premium}; MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers(); render();`);
        const desp = JSON.parse(a.ev(`JSON.stringify({ses:S.sessions.length, med:S.measures.length, rut:S.routines.length, dia:Object.values(nd().diario).filter(x=>x&&x.length).length})`));
        if (JSON.stringify(antes) !== JSON.stringify(desp)) { const kD = JSON.parse(a.ev(`JSON.stringify(Object.entries(nd().diario).filter(([k,x])=>x&&x.length).map(([k,x])=>k+':'+x.length))`)); f.datos.add(`al reabrir cambió: ${JSON.stringify(antes)} → ${JSON.stringify(desp)} · perdidos ${kAntes.filter(k=>!kD.includes(k)).join(',')} · nuevos ${kD.filter(k=>!kAntes.includes(k)).join(',')} · hoy ${a.ev('dayKey()')}`); }
        erroresDe('reabrir');
      }
    } catch (e) { f.errores.add(`día ${dia}: ${String(e && (e.stack || e)).slice(0, 300)}`); }
    erroresDe(`día ${dia}`);
    if (dia % 4 === 3) a.purgar();
  }
  const fin = JSON.parse(a.ev(`JSON.stringify({ses:S.sessions.length, med:S.measures.length, kb:Math.round(usoDatos().c/1024), pct:usoDatos().pct, racha:streakWeeks(), ayunos:(nut().fast.history||[]).length})`));
  if (fin.pct > 60) f.datos.add(`datos al ${fin.pct} % del límite tras 2 años`);
  { const R = JSON.parse(a.ev(`JSON.stringify({ids:S.sessions.map(s=>s.id), rut:S.routines.map(r=>r.id)})`)); const faltan = misIds.map(x => x.split('|')).filter(([id]) => !R.ids.includes(id) && !borrados.has(id));
    const sinRutina = faltan.filter(([, rid]) => !R.rut.includes(rid)).length, sueltos = faltan.length - sinRutina;
    if (faltan.length) f.datos.add(`faltan ${faltan.length} de ${misIds.length} entrenos: ${sinRutina} por rutina eliminada (con aviso) y ${sueltos} sueltos`); }
  const lento = Object.fromEntries(Object.entries(f.lento).map(([k, v]) => [k, { primero: v[0] ? v[0][1] : 0, ultimo: v.length ? v[v.length - 1][1] : 0, max: Math.max(0, ...v.map(x => x[1])) }]));
  const res = { p: desc(p), errores: [...f.errores], raros: [...f.raros], ciencia: [...f.ciencia], identidad: [...f.identidad], datos: [...f.datos], lento, fin, reaperturas: f.reaperturas, toques: f.toques, intentos, s: Math.round((Date.now() - t0) / 1000) };
  fs.appendFileSync(OUT, JSON.stringify(res) + '\n');
  console.log(`${res.p}: ${res.errores.length} err · ${res.raros.length} raros · ${res.ciencia.length} ciencia · ${res.identidad.length} ident · ${res.datos.length} datos · ${fin.ses} entrenos · ${fin.kb} KB · ${res.s} s`);
  a.cerrar();
}
process.exit(0);
