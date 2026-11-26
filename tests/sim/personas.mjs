// 1.9.5.4 · 60 personas reales durante semanas: edades de 16 a 82, cuerpos, objetivos, lesiones, embarazo,
// diabetes, ánimo bajo, mal sueño, ayuno, ciclo, cardio, constancia muy distinta, gratis y Premium, 3 idiomas.
// Además de errores y textos rotos, comprueba que PandarIA sea coherente con su ciencia y su manera de ser:
// metas seguras, nada de ejercicios prohibidos por lesión o edad, dolor que frena la carga, ánimo bajo con apoyo y sin culpa,
// todas las preguntas de la consulta respondiendo con los datos de cada persona, y el tiempo de cada pantalla.
//   node tests/sim/personas.mjs [días] [desde-hasta]
import { abrirApp, rng, RAROS } from './app.mjs';
import fs from 'node:fs';

const DIAS = +process.argv[2] || 35;
const [DESDE, HASTA] = (process.argv[3] || '0-59').split('-').map(Number);
const T0 = Date.UTC(2026, 0, 5, 7, 0, 0), H = 3600000, D = 24 * H;
const CULPA = /\bvago\b|\bfloj[oa]\b|fracas|deber[ií]as avergonz|sin excusas|no tienes excusa|\bgord[oa]\b|\blazy\b|you failed|no excuses|\bpregui[cç]os/i;
const BLOQ = /^(wipeData|cloud|exportData|exportFile|exportCSV|exportCopy|importData|importCode|updDownload|kbUrl|obGoogle|ciGoogle|alScan|mPhoto|retoCompartir|shareSession|shareRoutine|copyCode|openPremium|pfRegalo|buy|restore)/;

// edad, sexo, altura, peso, forma, objetivo, lesiones, extras
const P = [];
const base = [
  [16,'h',170,58,'activo','musculo',[]], [17,'m',160,52,'sedentario','grasa',[]], [19,'h',182,70,'muy_activo','fuerza',[]], [21,'m',165,48,'activo','musculo',[]],
  [23,'h',175,95,'sedentario','grasa',['rodilla']], [25,'m',168,62,'activo','salud',[]], [27,'x',172,70,'activo','musculo',[]], [29,'h',180,82,'muy_activo','fuerza',['hombro']],
  [31,'m',163,58,'activo','grasa',[],{embarazo:true}], [33,'h',178,110,'sedentario','grasa',['lumbar']], [35,'m',170,75,'activo','grasa',[],{diabetes:true}], [37,'h',174,78,'activo','musculo',['muneca']],
  [39,'m',158,90,'sedentario','salud',['rodilla','tobillo']], [41,'h',185,88,'activo','fuerza',['codo']], [43,'m',166,61,'muy_activo','musculo',[],{ciclo:true}], [45,'h',171,130,'sedentario','grasa',['rodilla','lumbar']],
  [47,'m',162,55,'activo','salud',['cuello']], [49,'h',176,84,'activo','grasa',[],{ayuno:'16:8'}], [51,'m',164,68,'sedentario','salud',['cadera']], [53,'h',179,92,'activo','musculo',['hombro','lumbar']],
  [55,'m',160,72,'sedentario','grasa',[],{diabetes:true,ayuno:'14:10'}], [57,'h',173,80,'activo','salud',[]], [59,'m',167,64,'activo','fuerza',[]], [61,'h',170,76,'sedentario','salud',['rodilla']],
  [63,'m',155,60,'sedentario','salud',['cadera','muneca']], [65,'h',172,74,'activo','fuerza',[]], [67,'m',161,66,'sedentario','salud',[]], [69,'h',168,85,'sedentario','grasa',['lumbar']],
  [71,'m',158,52,'activo','musculo',[]], [73,'h',175,70,'activo','salud',['hombro']], [76,'m',152,58,'sedentario','salud',['rodilla','cadera']], [82,'h',166,63,'sedentario','salud',[]],
  [28,'m',170,44,'activo','grasa',[]], [24,'h',190,62,'activo','musculo',[]], [34,'m',175,150,'sedentario','grasa',[]], [30,'h',168,68,'muy_activo','fuerza',[],{ayuno:'20:4'}],
  [26,'m',172,66,'activo','musculo',[],{ciclo:true,animo:'bajo'}], [38,'h',177,86,'activo','grasa',[],{sueno:'poco'}], [44,'m',169,70,'activo','salud',[],{animo:'bajo',sueno:'poco'}], [32,'h',181,79,'activo','musculo',[],{constancia:'abandona'}],
  [36,'m',164,63,'activo','grasa',[],{constancia:'irregular'}], [42,'h',176,90,'sedentario','salud',[],{constancia:'casi_nada'}], [22,'h',178,74,'muy_activo','fuerza',[],{doble:true}], [27,'m',166,59,'muy_activo','musculo',[],{doble:true}],
  [48,'h',174,82,'activo','salud',[],{cardio:true}], [52,'m',162,70,'sedentario','grasa',[],{cardio:true}], [40,'h',183,95,'activo','fuerza',[],{dolor:'press_banca'}], [35,'m',167,60,'activo','musculo',[],{dolor:'sentadilla'}],
  [29,'h',175,77,'activo','grasa',[],{ayuno:'OMAD'}], [33,'m',160,49,'activo','grasa',[],{ayuno:'18:6'}], [46,'h',170,100,'sedentario','grasa',[],{comeMuyPoco:true}], [31,'m',165,64,'activo','musculo',[],{comeMucho:true}],
  [58,'h',172,78,'activo','salud',[],{datosRaros:true}], [20,'m',163,57,'activo','salud',[],{datosRaros:true}], [37,'x',170,80,'activo','grasa',[],{mini:true}], [54,'m',165,74,'sedentario','salud',[],{mini:true,animo:'bajo'}],
  [39,'h',179,83,'activo','musculo',['rodilla'],{casaMancuernas:true}], [45,'m',163,67,'activo','fuerza',[],{casaSinEquipo:true}], [60,'h',171,88,'sedentario','grasa',['lumbar'],{casaSinEquipo:true,ayuno:'16:8'}], [25,'h',184,85,'muy_activo','musculo',[],{todo:true}],
];
base.forEach(([edad, sexo, alto, peso, forma, meta, les, x = {}], i) => P.push({ i, edad, sexo, alto, peso, forma, meta, les, ...x,
  premium: i % 3 !== 2, lang: ['es', 'es', 'en', 'pt'][i % 4], mini: !!x.mini || i % 11 === 5 }));

const nombre = p => `P${String(p.i).padStart(2, '0')} ${p.edad}${p.sexo} ${p.peso}kg ${p.meta}${p.les.length ? ' [' + p.les + ']' : ''}${Object.keys(p).filter(k => !['i', 'edad', 'sexo', 'alto', 'peso', 'forma', 'meta', 'les', 'premium', 'lang', 'mini'].includes(k)).map(k => ' ' + k).join('')} ${p.premium ? 'Pre' : 'Grat'} ${p.lang}`;
const out = []; const t0 = Date.now();

for (const p of P.filter(p => p.i >= DESDE && p.i <= HASTA)) {
  const r = rng(9000 + p.i);
  const a = await abrirApp({ t0: T0, seed: 9000 + p.i });
  const f = { errores: new Set(), raros: new Set(), ciencia: new Set(), identidad: new Set(), datos: new Set(), lento: new Map() };
  const raro = (donde) => { const t = a.texto(); const m = t.match(RAROS); if (m) f.raros.add(`${donde}: «${t.slice(Math.max(0, m.index - 50), m.index + 30).replace(/\s+/g, ' ').trim()}»`);
    const c = t.match(CULPA); if (c) f.identidad.add(`${donde}: texto con culpa «${t.slice(Math.max(0, c.index - 50), c.index + 30).replace(/\s+/g, ' ').trim()}»`); };
  const equip = p.casaSinEquipo ? "['pc','est']" : p.casaMancuernas ? "['pc','est','man','ban','bnd','bici']" : 'EQUIP_GYM';
  a.ev(`S=DEF(); S.settings.onboarded=true; S.settings.cloudAsked=true; S.settings.ui='${p.mini ? 'mini' : 'completa'}'; S.settings.lang='${p.lang}'; S.settings.checkin=true; S.settings.equip=${equip};
    S.profile={name:'P${p.i}',age:${p.edad},height:${p.alto},weight:${p.peso},sex:'${p.sexo}',fitness:'${p.forma}',injuries:${JSON.stringify(p.les)}${p.embarazo ? ',embarazo:true' : ''}};
    S.measures.push({id:'m0',date:Date.now()-30*DAY,peso:${p.peso}}); window.isPremium=()=>${p.premium};
    const n=nut(); n.goal='${p.meta === 'grasa' ? 'bajar' : p.meta === 'musculo' ? 'ganar' : 'mantener'}';
    ${p.ayuno ? `n.fast.screened=true; n.fast.plan='${p.ayuno}';${p.diabetes ? ' n.fast.diabetes=true;' : ''}` : ''}
    ${p.ciclo ? `S.ciclo={on:true,inicio:Date.now()-9*DAY,largo:28};` : ''}
    save(true); LAYERS.length=0; renderLayers(); MODALS.length=0; renderModals(); render();`);

  // rutinas: Premium con el asistente de PandarIA; gratis con plantillas de Explorar
  try {
    if (p.premium) {
      a.ev(`openLayer('wizPandaria',{step:0,goal:'${p.meta}',days:${p.doble ? 5 : p.edad > 65 ? 2 : 3},minutes:${p.edad > 60 ? 35 : 50},level:'${p.forma === 'sedentario' ? 'principiante' : 'intermedio'}',priorities:[],program:null}); refreshTop();`);
      for (let k = 0; k < 4; k++) a.tocar('wpStep', '1');
      a.tocar('wpAdd'); a.ev(`LAYERS.length=0; renderLayers(); MODALS.length=0; renderModals();`);
    } else {
      for (const t of p.casaSinEquipo ? ['casa|0', 'casa|1'] : ['gym|3', 'casa|0', 'piernas|0']) { a.ev(`LAYERS.length=0; renderLayers();`); a.tocar('openTpl', t); a.tocar('tplAdd'); }
      a.ev(`LAYERS.length=0; renderLayers(); S.plan={days:[1,3,5],order:S.routines.filter(r=>!r.archived).map(r=>r.id)}; save(true);`);
    }
  } catch (e) { f.errores.add('rutinas: ' + e); }
  const bloq = JSON.parse(a.ev(`JSON.stringify(S.routines.flatMap(r=>r.items.map(it=>it.exId)).filter(id=>profileBlocks(id)))`));
  if (bloq.length) (p.premium ? f.ciencia : f.identidad).add(`${p.premium ? 'el asistente' : 'una plantilla'} pone ejercicios que su perfil desaconseja (${[...new Set(bloq)].slice(0, 5).join(', ')})${p.premium ? '' : ' sin avisar al añadirla'}`);
  if (!a.ev(`S.routines.length`)) f.datos.add('no se pudo crear ninguna rutina');

  // ciencia: metas de nutrición y agua al empezar
  const N = JSON.parse(a.ev(`JSON.stringify(calcNutrition())`));
  if (!N) f.ciencia.add('sin metas de nutrición con un perfil completo');
  else {
    const gk = N.prot / N.w;
    if (gk < 1.2 || gk > 2.4) f.ciencia.add(`proteína ${N.prot} g = ${gk.toFixed(2)} g/kg (fuera de 1,2–2,4)`);
    if (N.w > 110 && gk >= 1.9) f.ciencia.add(`proteína por peso total con ${N.w} kg: ${N.prot} g/día (en obesidad se calcula mejor por peso ajustado o altura)`);
    if (N.goal === 'bajar' && N.kcal < N.bmr - 10) f.ciencia.add(`meta ${N.kcal} kcal por debajo del metabolismo basal ${N.bmr}`);
    if (N.goal === 'bajar' && (N.tdee - N.kcal) / N.tdee > 0.26 && !N.adapt) f.ciencia.add(`déficit del ${Math.round((N.tdee - N.kcal) / N.tdee * 100)} %`);
    if (N.kcal < (p.sexo === 'h' ? 1500 : 1200)) f.ciencia.add(`meta de ${N.kcal} kcal por debajo del mínimo habitual (${p.sexo === 'h' ? 1500 : 1200})`);
    if (N.carbs < 50) f.ciencia.add(`solo ${N.carbs} g de carbohidratos`);
    if (p.edad < 18 && N.goal !== 'mantener') f.ciencia.add('menor de edad con déficit o superávit');
    if (p.embarazo && N.goal === 'bajar') f.ciencia.add('embarazada con déficit');
    if (p.peso / (p.alto / 100) ** 2 < 18.5 && N.goal === 'bajar') f.ciencia.add('IMC bajo con déficit');
    if (p.edad >= 65 && gk < 1.0) f.ciencia.add('mayor de 65 con poca proteína');
  }
  const agua = a.ev(`waterGoal()`); if (!(agua >= 1300 && agua <= 4500)) f.ciencia.add(`agua ${agua} ml`);

  // ayuno: avisos donde toca
  if (p.ayuno || p.embarazo || p.peso / (p.alto / 100) ** 2 < 18.5) {
    a.ev(`MODALS.length=0; renderModals(); const ff=nut().fast; ff.screened=true; ff.plan=ff.plan||'16:8'; delete ff.active; A.fastStart();`); a.avanzar(300);
    const aviso = a.ev(`!nut().fast.active && /Ayunar ahora|Fast now|Jejuar agora/.test((document.querySelector('#modals')||{}).textContent||'')`);
    if ((p.embarazo || p.peso / (p.alto / 100) ** 2 < 18.5) && !aviso) f.ciencia.add('empieza un ayuno sin ningún aviso (embarazo o IMC bajo)');
    a.ev(`MODALS.length=0; renderModals(); delete nut().fast.active; save(true);`);
  }

  let peso = p.peso, entrenos = 0, intentos = 0, ultimoPeso = {};
  const constancia = p.constancia === 'casi_nada' ? 0.15 : p.constancia === 'irregular' ? 0.5 : 0.85;
  for (let dia = 0; dia < DIAS; dia++) {
    const b0 = T0 + dia * D; a.w.__T = Math.max(a.w.__T, b0);
    const dow = new Date(b0).getUTCDay();
    const ausente = p.constancia === 'abandona' && dia >= 10 && dia < 24;
    try {
      // check-in con ánimo y sueño
      if (!ausente && r() < 0.7) { a.ev(`MODALS.length=0; renderModals(); A.checkinHoy()`); a.avanzar(400);
        const v = k => { const bajo = (k === 'mood' && p.animo === 'bajo') || (k === 'sleep' && p.sueno === 'poco'); a.tocar('ckhSet', `${k}|${bajo ? (r() < 0.8 ? 0 : 1) : 1 + Math.floor(r() * 2)}`); };
        ['sleep', 'energy', 'sore', 'mood'].forEach(v);
        const bt = a.w.document.querySelector('#modals .btn.pri[data-a="cbm"]'); if (bt) bt.click(); a.avanzar(400); a.ev(`MODALS.length=0; renderModals();`); }
      // agua y comida
      if (!ausente) {
        for (let k = 0; k < 3 + Math.floor(r() * 5); k++) { a.w.__T = b0 + (2 + k * 1.5) * H; a.ev(`A.water(${[200, 250, 330, 500][Math.floor(r() * 4)]})`); }
        if (r() < 0.8) { a.w.__T = b0 + 6 * H; const fac = p.comeMuyPoco ? 0.35 : p.comeMucho ? 1.9 : 1;
          a.ev(`(()=>{ const n=nd(), k=dayKey(), L=[['20038',70,'desayuno'],['01077',250,'desayuno'],['05062',180,'almuerzo'],['20045',200,'almuerzo'],['01116',125,'merienda'],['15121',120,'cena'],['16070',200,'cena']];
            const add=L.filter(()=>Math.random()<0.8).map(([id,gr,m])=>{ const f=alimGet(id); return Object.assign(alimMac(f,gr*${fac}*(0.8+Math.random()*0.5)),{id:uid(),fid:id,n:f.n,gr:Math.round(gr*${fac}),m,t:Date.now()}); });
            n.diario[k]=(n.diario[k]||[]).concat(add); save(); diarioAdded(k,add); })()`); }
      }
      // entreno
      const toca = a.ev(`!!(S.plan&&S.plan.days.includes(new Date().getDay()))`);
      if (!ausente && (toca || (p.doble && r() < 0.3)) && r() < constancia) {
        for (let vez = 0; vez < (p.doble && r() < 0.4 ? 2 : 1); vez++) {
          a.w.__T = b0 + (11 + vez * 6) * H;
          if (p.cardio && r() < 0.6) { a.ev(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`);
            const ok = a.ev(`(()=>{ try{ const t=Date.now(); S.sessions.push({id:uid(),cardio:true,routineName:'Cardio',start:t-40*60000,end:t,intensity:6,items:[{exId:'bici_estatica',sets:[{t:'n',time:2400,done:true}]}],prs:[]}); save(true); return true; }catch(e){ return String(e); } })()`);
            if (ok !== true) f.errores.add('cardio: ' + ok); entrenos++; continue; }
          const rid = a.ev(`(()=>{ const x=nextInPlan(); return x&&x.r?x.r.id:''; })()`);
          if (!rid) continue;
          a.ev(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`);
          a.tocar('startWorkout', rid); a.avanzar(400); intentos++;
          for (let k = 0; k < 3; k++) { // avisos encima: dolor, ánimo, ayuno, segundo entreno…
            const sc = a.ev(`(document.querySelector('#modals .scrim:last-child')||{}).textContent||''`);
            if (!sc) break;
            if (/Cómo sigue tu molestia|How is your discomfort|Como está seu incômodo/.test(sc)) { const nb = [...a.w.document.querySelectorAll('#modals .scrim:last-child button')].filter(x => /^\d+$/.test(x.textContent.trim())); if (nb.length) { nb[p.dolor ? Math.min(nb.length - 1, 6) : 1].click(); a.avanzar(300); } const ok = [...a.w.document.querySelectorAll('#modals .scrim:last-child button')].find(x => /^(Entendido|Got it|Entendi|Cerrar|Close|Fechar)$/.test(x.textContent.trim())); if (ok) { ok.click(); a.avanzar(300); } continue; }
            const emp = [...a.w.document.querySelectorAll('#modals .btn.pri[data-a="cbm"]')].find(x => /^(Empezar|Start|Começar|Iniciar|Entrenar|Train|Treinar|Seguir|Continue|Continuar)/.test(x.textContent.trim()));
            if (emp) { emp.click(); a.avanzar(300); } else break;
          }
          if (!a.ev(`!!S.active`)) { a.ev(`MODALS.length=0; renderModals();`); continue; }
          const sets = JSON.parse(a.ev(`JSON.stringify(S.active.items.flatMap(it=>it.sets.map((s,i)=>({u:it.uid,ex:it.exId,i,m:getEx(it.exId).mode,kg:s.kg??s.sk??s.tk,reps:s.reps??s.sr??s.tr}))))`));
          for (const s of sets) {
            if (r() < 0.05) continue;
            const kg = p.datosRaros && r() < 0.05 ? (r() < 0.5 ? 0 : 999) : s.kg;
            a.ev(`(()=>{ const s=wkItem('${s.u}').sets[${s.i}]; ${s.m === 'p' ? `s.kg=${kg == null ? 'null' : kg}; s.reps=${Math.max(1, (s.reps || 8) - (r() < 0.15 ? 2 : 0))};` : s.m === 'r' ? `s.reps=${Math.max(1, (s.reps || 10))};` : `s.time=${s.time || 30};`} })()`);
            a.tocar('wkCheck', `${s.u}|${s.i}`); a.ev(`document.querySelector('#modals [data-a="cbm"]')&&MODALS.filter(m=>!m.locked).length&&document.querySelector('#modals [data-a="cbm"]').click()`); a.avanzar(50000);
          }
          if (p.dolor) a.ev(`typeof dolorGuardar==='function'&&dolorGuardar('${p.dolor}',${dia < 14 ? 6 : 3})`);
          a.tocar('wkFinish'); a.avanzar(300); a.tocar('finDo', 'keep'); a.avanzar(2000);
          a.ev(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`);
          if (a.ev(`!!S.active`)) { f.datos.add('un entreno no se cerró'); a.ev(`S.active=null`); } else entrenos++;
        }
      }
      // peso semanal (a veces con datos raros)
      if (!ausente && dow === 1) { peso += (p.meta === 'grasa' ? -0.35 : p.meta === 'musculo' ? 0.15 : 0) + (r() - 0.5) * 0.5;
        const v = p.datosRaros && r() < 0.3 ? ['0', '-5', '999', '72,5', ' 70 ', 'abc'][Math.floor(r() * 6)] : peso.toFixed(1);
        a.w.__T = b0 + H; a.ev(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`); a.tocar('addMeasure'); a.ev(`(()=>{ const i=document.querySelector('#m_peso'); if (i) i.value='${v}'; })()`); a.tocar('mSave'); a.ev(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`);
        const ult = a.ev(`(S.measures.filter(m=>m.peso).slice(-1)[0]||{}).peso`); ultimoPeso[v] = ult;
        if (!(ult > 25 && ult < 400)) f.datos.add(`peso guardado ${ult} al escribir «${v}»`); }
      // por la noche: pantallas, guía, consulta
      a.w.__T = b0 + 14 * H;
      const full = dia % 5 === 4 || dia === DIAS - 1;
      for (const t of full ? ['rutinas', 'explorar', 'nutricion', 'ayuno', 'historial', 'ajustes'] : ['rutinas']) {
        a.ev(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`);
        const t1 = Date.now(); a.ev(`A.tab('${t}')`); const ms = Date.now() - t1; if (ms > (f.lento.get(t) || 0)) f.lento.set(t, ms);
        a.avanzar(200); raro(t);
        if (full) for (let k = 0; k < 3; k++) {
          const bs = [...a.w.document.querySelectorAll('#view [data-a], #layers .layer:last-child [data-a], #modals [data-a]')].filter(x => !BLOQ.test(x.dataset.a));
          if (!bs.length) break; const bt = bs[Math.floor(r() * bs.length)]; const n0 = a.errores.length;
          try { bt.click(); } catch (e) { f.errores.add(`${t} › ${bt.dataset.a}: ${String(e).slice(0, 160)}`); }
          a.avanzar(500); a.errores.slice(n0).forEach(e => f.errores.add(`${t} › ${bt.dataset.a}(${(bt.dataset.v || '').slice(0, 20)}): ${e.slice(0, 220)}`)); raro(`${t} › ${bt.dataset.a}`);
        }
        a.ev(`if (S.active) S.active=null; MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`);
      }
      a.ev(`A.tab('rutinas'); A.guiaAbrir();`); a.avanzar(200); raro('guía');
      // identidad: con ánimo bajo varios días, la guía tiene que ofrecer apoyo
      if (p.animo === 'bajo' && dia > 6 && p.premium && dia % 7 === 0) { const g = a.texto(); if (!/ánimo|animo|mood|humor|Muévete|movimiento suave|gentle|leve|apoyo|support/i.test(g)) f.identidad.add(`día ${dia}: ánimo bajo varios días y la guía no lo menciona`); }
      a.ev(`MODALS.length=0; renderModals();`);
    } catch (e) { f.errores.add(`día ${dia}: ${String(e && (e.stack || e)).slice(0, 300)}`); }
    a.errores.splice(0).forEach(e => f.errores.add(e.slice(0, 300)));
    if (dia % 3 === 2) a.purgar(); if (process.env.MEM) console.log("día", dia, Math.round(process.memoryUsage().heapUsed/1e6), "MB", a.ev("JSON.stringify(S).length"), a.ev("S.sessions.length"), a.ev("document.body.innerHTML.length"), a.ev("MODALS.length+'/'+LAYERS.length"), a.pendientes());
  }

  // al final: todas las preguntas de la consulta, con sus datos, sin NaN y sin culpa
  const C = JSON.parse(a.ev(`JSON.stringify((()=>{ const o={err:[],raros:[],vacias:[],culpa:[],n:0}; [true,false].forEach(pr=>{ window.isPremium=()=>pr; CQ.forEach(q=>{ try{ const pp={}; if (q.p) { const ops=CQ_PARAMS[q.p].ops(); if (ops.length) pp[q.p]=ops[Math.floor(ops.length/2)][0]; }
      const R=q.f(pp); o.n++; const txt=JSON.stringify(R); if (!R||!R.corta) o.vacias.push(q.id); if (${RAROS}.test(txt.replace(/"(?:cuidado|kb)":null/g,''))) o.raros.push(q.id+': '+txt.match(${RAROS})[0]+' … '+txt.slice(Math.max(0,txt.search(${RAROS})-60),txt.search(${RAROS})+20)); if (${CULPA}.test(txt)) o.culpa.push(q.id);
      LAYERS.length=0; openLayer('consultaQ',{id:q.id,p:pp}); const h=document.querySelector('#layers .layer:last-child'); if (h && ${RAROS}.test(h.textContent)) o.raros.push('pantalla '+q.id); }catch(e){ o.err.push(q.id+': '+String(e.message||e).slice(0,120)); } }); }); window.isPremium=()=>${p.premium}; LAYERS.length=0; renderLayers(); return o; })())`));
  C.err.forEach(e => f.errores.add('consulta ' + e)); C.raros.forEach(e => f.raros.add('consulta ' + e)); C.vacias.forEach(e => f.datos.add('consulta sin respuesta: ' + e)); C.culpa.forEach(e => f.identidad.add('consulta con culpa: ' + e));
  // dolor: con molestia roja la carga no sube
  if (p.dolor) { const s = JSON.parse(a.ev(`JSON.stringify((()=>{ const h=exHistory('${p.dolor}'); return {n:h.length, kg:h.slice(-4).map(x=>x.best||x.kg||0)}; })())`));
    if (s.kg.length >= 3 && s.kg[2] > s.kg[0] * 1.001 && s.kg[1] > s.kg[0]) f.ciencia.add(`con dolor rojo en ${p.dolor} la carga siguió subiendo (${s.kg.join(' → ')})`); }
  // progresión prudente: ningún ejercicio sube más de un 15 % de una sesión a la siguiente
  const salto = JSON.parse(a.ev(`JSON.stringify((()=>{ const m={}; S.sessions.forEach(s=>(s.items||[]).forEach(it=>{ const kg=Math.max(0,...(it.sets||[]).filter(x=>x.done&&x.kg>0&&x.kg<500).map(x=>x.kg)); if (kg>0){ (m[it.exId]=m[it.exId]||[]).push(kg); } })); const r=[]; Object.entries(m).forEach(([k,v])=>{ for(let i=1;i<v.length;i++) if (v[i]>v[i-1]*1.15+2.5) r.push(k+' '+v[i-1]+'→'+v[i]); }); return r.slice(0,4); })())`));
  if (salto.length && !p.datosRaros) f.ciencia.add('subidas de carga de más del 15 %: ' + salto.join(', '));
  const fin = JSON.parse(a.ev(`JSON.stringify({ses:S.sessions.length, racha:(typeof streak==='function'?streak():null), tam:usoDatos().c, est:premOK()?((estadoDia()||{}).score??null):null, pred:(()=>{ try{ const x=pesoPrediccion(); return x?JSON.stringify(x).slice(0,140):null; }catch(e){ return 'ERR '+e.message; } })()})`));
  if (p.premium && fin.est != null && !(fin.est >= 0 && fin.est <= 100)) f.ciencia.add(`estado del día ${fin.est}`);
  if (fin.pred && /ERR|NaN|Infinity|-\d{3,}/.test(fin.pred)) f.ciencia.add('predicción de peso rara: ' + fin.pred);
  if (intentos > fin.ses + 1) f.datos.add(`empezó ${intentos} entrenos y hay ${fin.ses}`);
  const res = { p: nombre(p), errores: [...f.errores], raros: [...f.raros], ciencia: [...f.ciencia], identidad: [...f.identidad], datos: [...f.datos], lento: Object.fromEntries(f.lento), consulta: C.n, fin };
  out.push(res); fs.appendFileSync(new URL('./resultado-personas.jsonl', import.meta.url), JSON.stringify(res) + '\n');
  console.log(`${res.p}: ${res.errores.length} err · ${res.raros.length} raros · ${res.ciencia.length} ciencia · ${res.identidad.length} identidad · ${res.datos.length} datos · ${fin.ses} entrenos · máx ${Math.max(...f.lento.values())} ms`);
  a.cerrar();
}
fs.writeFileSync(new URL(`./resultado-personas-${DESDE}-${HASTA}.json`, import.meta.url), JSON.stringify(out, null, 1));
console.log(`\n${out.length} personas · ${DIAS} días · ${Math.round((Date.now() - t0) / 1000)} s`);
process.exit(0);
