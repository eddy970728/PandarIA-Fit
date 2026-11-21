// 1.9 fases 2 y 3: recorre la app en español y en inglés con datos de un usuario completo,
// toca cada botón de cada pantalla (y los de las ventanas que se abren) y guarda todos los textos visibles
// (también placeholder, aria-label y title) en tests/sim/textos-es.json y textos-en.json para revisarlos.
//   node tests/sim/textos.mjs [es|en]
import { abrirApp } from './app.mjs';
import fs from 'node:fs';

const D = 864e5, T0 = new Date(2026, 10, 18, 9, 0).getTime();
const BLOQ = /^(wipeData|cloud|exportData|exportFile|exportCSV|exportCopy|importData|importCode|updDownload|kbUrl|obGoogle|ciGoogle|alScan|mPhoto|retoCompartir|shareSession|shareRoutine|copyCode|periodoCompartir|fbCopy|animFbSend|chatAbrir|supSalud|retoPegar|obHc|obNotif|setLang|lpBorrar|delCustom|animCam|premigOpen|pfGo|cqPay|dPay|dQPay|pfBuy|pfRestore|pfRegalo|tab|nav|back|closeLayer|lback)$/;
const espera = () => new Promise(r => setTimeout(r, 8));

async function datos(a, lang) {
  a.ev(`S=DEF(); S.settings.onboarded=true; S.settings.cloudAsked=true; S.settings.lang='${lang}'; S.settings.checkin=true; S.settings.equip=EQUIP_GYM.slice();
    S.profile={name:'Eddy',age:30,height:178,weight:80,sex:'h',fitness:'activo',injuries:[]}; window.isPremium=()=>true;
    for (let i=8;i>=0;i--) S.measures.push({id:'m'+i,date:Date.now()-i*7*DAY,peso:82-i*0.25,cintura:86-i*0.2});
    save(true); applyLang(); MODALS.length=0; LAYERS.length=0; render();`);
  a.ev(`openLayer('wizPandaria',{step:0,goal:'musculo',days:4,minutes:55,level:'principiante',priorities:[],program:null})`);
  for (let i = 0; i < 4; i++) a.tocar('wpStep', '1');
  a.tocar('wpAdd'); a.ev(`MODALS.length=0; LAYERS.length=0; renderModals(); renderLayers();`);
  a.tocar('openTpl', 'casa|0'); a.tocar('tplAdd'); a.ev(`MODALS.length=0; LAYERS.length=0; renderModals(); renderLayers();`);
  // 12 entrenos de verdad, día por medio
  for (let i = 0; i < 12; i++) {
    a.w.__T += 2 * D;
    const rid = a.ev(`(nextInPlan()||{}).r?nextInPlan().r.id:S.routines[0].id`);
    a.ev(`_startWorkout('${rid}'); MODALS.length=0; renderModals();
      S.active.items.forEach(it=>it.sets.forEach(x=>{ x.done=true; x.reps=(x.reps||x.sr||x.tr||8)+(${i}%3===0?1:0); x.kg=x.kg??x.sk??x.tk??null; x.time=x.time||x.st||x.tt||null; x.rir=2; }));
      A.wkFinish();`);
    a.avanzar(500); a.tocar('finDo', 'keep'); a.avanzar(2500); a.ev(`MODALS.length=0; LAYERS.length=0; renderModals(); renderLayers();`);
  }
  // comida, agua, ayunos, check-ins, recetas y alimentos propios
  a.ev(`(()=>{ const n=nut(); n.goal='mantener'; n.fast.screened=true; n.fast.plan='16:8'; n.water=n.water||{}; n.diario=n.diario||{};
    for (let i=0;i<20;i++){ const k=dayKey(Date.now()-i*DAY); n.water[k]=2200+i*30;
      n.diario[k]=[['20038',80,'desayuno'],['05062',180,'almuerzo'],['20045',200,'almuerzo'],['15121',120,'cena']].map(([id,gr,m])=>{ const x=alimGet(id); return Object.assign(alimMac(x,gr),{id:uid(),fid:id,n:x.n,gr,m,t:Date.now()-i*DAY}); });
      n.fast.history.push({start:Date.now()-i*DAY-30*3600e3,end:Date.now()-i*DAY-14*3600e3,goalH:16,ok:i%4!==0,plan:'16:8'}); }
    nd().alim.push({id:'c_x',n:'Barrita casera',porl:'1 barrita',porg:40,k:180,p:8,c:22,g:6});
    nd().recetas.push({id:'r_x',n:'Lentejas de la abuela',rac:4,items:[{f:'16070',gr:400},{f:'20045',gr:200}]});
    S.checkinDia={day:dayKey(),sleep:1,energy:1,sore:2}; v3Log(); save(true); })()`);
  a.ev(`nut().fast.active={start:Date.now()-5*3600e3,goalH:16}; save(true);`);
}

function cosecha(w, onde, T) {
  const add = (t, k) => { t = String(t || '').replace(/\s+/g, ' ').trim(); if (!t || t.length < 2 || /^[\d\s.,:%/+\-–×·kgminhsl]+$/i.test(t)) return; (T[t] = T[t] || new Set()).add(k); };
  const raices = ['#view', '#layers .layer:last-child', '#modals', '#nav', '.toast'].flatMap(s => [...w.document.querySelectorAll(s)]);
  const INL = /^(SPAN|B|I|EM|STRONG|SMALL|A|BR|SVG|PATH|SUP|SUB|CODE|U|MARK|LABEL)$/;
  for (const r of raices) {
    for (const el of r.querySelectorAll('*')) {
      if (/^(SCRIPT|STYLE|SVG|PATH|G|CIRCLE|LINE|RECT|POLYLINE|POLYGON|ELLIPSE|DEFS|TEXT|TSPAN)$/i.test(el.tagName)) continue;
      for (const at of ['placeholder', 'aria-label', 'title']) if (el.getAttribute && el.getAttribute(at)) add(el.getAttribute(at), onde + ' [' + at + ']');
      const hijos = [...el.childNodes];
      if (hijos.some(n => n.nodeType === 3 && n.textContent.trim()) && hijos.every(n => n.nodeType === 3 || INL.test(n.nodeName.toUpperCase()))) add(el.textContent, onde);
    }
  }
}

for (const lang of (process.argv[2] ? [process.argv[2]] : ['es', 'en'])) {
  const a = await abrirApp({ t0: T0, seed: 5 });
  await datos(a, lang);
  const T = {}, w = a.w;
  const base = async (v) => { try { a.ev(`S.settings.onboarded=true; MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers(); if (S.active) S.active=null; ${v}`); } catch (e) { a.errores.push('vista: ' + String(e).slice(0, 160)); } a.avanzar(400); await espera(); };
  const botones = sel => [...w.document.querySelectorAll(sel)].filter(b => b.dataset && b.dataset.a && !BLOQ.test(b.dataset.a));
  const firma = b => b.dataset.a + '|' + (b.dataset.v || '').slice(0, 40);
  const vistas = [
    ['rutinas', `A.tab('rutinas')`], ['explorar', `A.tab('explorar')`], ['comida', `A.tab('nutricion'); A.nseg('comida')`],
    ['agua', `A.tab('nutricion'); A.nseg('agua')`], ['ayuno', `A.tab('nutricion'); A.nseg('ayuno')`], ['historial', `A.tab('historial')`],
    ['ajustes', `A.tab('ajustes')`], ['panda', `A.tab('rutinas'); A.guiaAbrir()`],
    ['entreno', `_startWorkout(S.routines[0].id); MODALS.length=0; renderModals();`],
    ['biblioteca', `A.openKb&&A.openKb()`], ['perfil', `A.openProfile()`], ['premium', `A.openPremium&&A.openPremium()`],
    ['bienvenida', `S.settings.onboarded=false; render();`], ['intervalos', `A.openIntervals()`], ['consulta', `A.cqAbrir()`],
    ['plan', `A.openPlan()`], ['informe', `A.openReport&&A.openReport()`], ['ciencia', `A.openCiencia()`], ['novedades', `A.openChangelog()`],
    ['wizard', `openLayer('wizPandaria',{step:0,goal:'musculo',days:4,minutes:55,level:'principiante',priorities:[],program:null})`], ['equipo', `A.openEquip()`], ['suplementos', `A.openSup()`],
  ];
  const histSeg = a.ev(`JSON.stringify([...new Set([...document.querySelectorAll('[data-a]')].map(b=>b.dataset.a))].filter(x=>/^h(seg|grp)$/i.test(x)))`);
  let clics = 0; const vistos = new Set();
  const guardar = () => { const o = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, [...v].slice(0, 4)])); fs.writeFileSync(new URL(`./textos-${lang}${process.env.SUF || ''}.json`, import.meta.url), JSON.stringify(o, null, 1)); return o; };
  const SOLO_V = process.env.VISTAS ? process.env.VISTAS.split(',') : null, TOPE_V = +process.env.TOPE_V || 1e9;
  for (const [nom, code] of vistas) {
    if (SOLO_V && !SOLO_V.includes(nom)) continue; const c0 = clics;
    await base(code); cosecha(w, nom, T);
    const lista = botones('#view [data-a], #layers .layer:last-child [data-a], #modals [data-a]').map(firma).filter((f, i, arr) => arr.indexOf(f) === i);
    for (const f of lista) {
      if (vistos.has(nom + f) || clics > (+process.env.CAP || 2500) || clics - c0 > TOPE_V) continue; vistos.add(nom + f);
      await base(code);
      const b = botones('#view [data-a], #layers .layer:last-child [data-a], #modals [data-a]').find(x => firma(x) === f); if (!b) continue;
      try { b.click(); } catch (e) { a.errores.push(`${nom} › ${f}: ${e}`); }
      a.avanzar(700); await espera(); clics++;
      cosecha(w, `${nom} › ${f.split('|')[0]}`, T);
      // segundo nivel: los botones de la ventana o capa que se abrió
      const sub = botones('#layers .layer:last-child [data-a], #modals [data-a]').map(firma).filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 12);
      for (const g of sub) {
        if (vistos.has(nom + f + g) || clics > (+process.env.CAP || 2500) || clics - c0 > TOPE_V) continue; vistos.add(nom + f + g);
        await base(code);
        const b1 = botones('#view [data-a], #layers .layer:last-child [data-a], #modals [data-a]').find(x => firma(x) === f); if (!b1) continue;
        try { b1.click(); } catch (e) {} a.avanzar(500); await espera();
        const b2 = botones('#layers .layer:last-child [data-a], #modals [data-a]').find(x => firma(x) === g); if (!b2) continue;
        try { b2.click(); } catch (e) { a.errores.push(`${nom} › ${f} › ${g}: ${e}`); }
        a.avanzar(700); await espera(); clics++;
        cosecha(w, `${nom} › ${f.split('|')[0]} › ${g.split('|')[0]}`, T);
      }
      a.purgar();
    }
    guardar();
  }
  const guardarFin = guardar(); const out = guardarFin;
  console.log(lang, Object.keys(out).length, 'textos distintos ·', clics, 'toques · errores', a.errores.length, a.errores.slice(0, 3), histSeg);
  a.cerrar();
}
process.exit(0);
