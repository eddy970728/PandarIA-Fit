// 3 meses con PandarIA como entrenador: dos personas promedio (una busca fuerza, otra hipertrofia),
// con Premium, que registran comida, agua, check-in y peso, y siguen lo que PandarIA sugiere.
// Cada persona tiene un «cuerpo simulado» (fuerza real, fatiga, sueño, peso) que la app no ve:
// la app solo ve lo que la persona anota, como en la vida real.
// Se compara con la misma persona sin PandarIA (repite lo de la última vez y sube a ojo, sin descargas).
//   node tests/sim/coach.mjs [semanas] [semilla]
import { abrirApp, rng, RAROS } from './app.mjs';
import fs from 'node:fs';

const SEMANAS = +process.argv[2] || 13, SEMILLA = +process.argv[3] || 5;
const T0 = Date.UTC(2026, 0, 5, 7, 0, 0), H = 3600000, D = 24 * H;
const COMIDA = { avena: '20038', leche: '01077', banana: '09040', pollo: '05062', arroz: '20045', aceite: '04053', yogur: '01116', huevo: '01123', atun: '15121', lentejas: '16070', pan: '18069', carne: '23562' };

const PERSONAS = [
  { id: 'fuerza', meta: 'fuerza', sexo: 'h', edad: 29, alto: 178, peso: 80, tdee: 2650, nutri: 'mantener', dias: 3, min: 60 },
  { id: 'hipertrofia', meta: 'musculo', sexo: 'm', edad: 31, alto: 165, peso: 62, tdee: 2050, nutri: 'ganar', dias: 4, min: 55 },
];

async function vivir(P, conPandaria) {
  const r = rng(SEMILLA * 1000 + P.id.length * 7);          // mismo «cuerpo» y misma vida en los dos brazos
  const a = await abrirApp({ t0: T0, seed: SEMILLA });
  const L = { proposals: new Map(), aplicadas: [], kbVistos: new Map(), porque: new Map(), raros: new Set(), errores: new Set(), estados: [], sesiones: [], suaves: 0, descargas: 0, noches: 0 };
  a.ev(`S=DEF(); S.settings.onboarded=true; S.settings.cloudAsked=true; S.settings.ui='completa'; S.settings.checkin=true; S.settings.equip=EQUIP_GYM.slice(); S.settings.lang='es';
    S.profile={name:'${P.id}',age:${P.edad},height:${P.alto},weight:${P.peso},sex:'${P.sexo}',fitness:'activo',injuries:[]};
    S.measures.push({id:'m0',date:Date.now()-2*DAY,peso:${P.peso}}); window.isPremium=()=>true; nut().goal='${P.nutri}'; save(true); LAYERS.length=0; renderLayers(); MODALS.length=0; renderModals(); render();`);
  // el plan: «Confía en PandarIA» con su objetivo
  a.ev(`openLayer('wizPandaria',{step:0,goal:'${P.meta}',days:${P.dias},minutes:${P.min},level:'principiante',priorities:[],program:null}); refreshTop();`);
  for (let i = 0; i < 4; i++) a.tocar('wpStep', '1');
  a.tocar('wpAdd'); a.ev(`LAYERS.length=0; renderLayers(); MODALS.length=0; renderModals();`);
  if (!conPandaria) a.ev(`S.routines.forEach(r=>r.pandaria=false); save(true);`);
  const rutinas = JSON.parse(a.ev(`JSON.stringify(S.routines.map(r=>({id:r.id,name:r.name,items:r.items.map(it=>({ex:it.exId,n:getEx(it.exId).n,mode:getEx(it.exId).mode,warm:!!it.warm,cool:!!it.cool,sets:it.sets.length}))})))`));
  // el cuerpo simulado: fuerza real de cada ejercicio con peso (1RM), algo distinta de lo que la app estima
  const C = {}, C0 = {};
  rutinas.forEach(rt => rt.items.forEach(it => { if (it.mode === 'p' && !C[it.ex]) { const est = +a.ev(`estimateKg('${it.ex}',10)||0`); C[it.ex] = Math.max(8, est * 1.33 * (0.85 + r() * 0.35)); C0[it.ex] = C[it.ex]; } }));
  let F = 0, peso = P.peso, sinDescargaSem = 0, protOk = 1;
  const sueno = []; const cola = [];
  for (let d = 0; d < SEMANAS * 7; d++) {
    const base = T0 + d * D; a.w.__T = Math.max(a.w.__T, base); const dow = new Date(base).getUTCDay();
    // la noche anterior
    const durmio = r() < 0.15 ? 0 : r() < 0.35 ? 1 : 2; sueno.push(durmio); if (!durmio) L.noches++;
    F *= 0.86; if (F < 0) F = 0;
    // mañana: check-in (casi todos los días) y peso (lunes y jueves)
    if (r() < 0.8) { a.ev(`A.checkinHoy()`); a.avanzar(300); a.tocar('ckhSet', `sleep|${durmio}`); a.tocar('ckhSet', `energy|${F > 0.1 ? 0 : durmio === 0 ? 0 : r() < 0.7 ? 1 : 2}`); a.tocar('ckhSet', `sore|${F > 0.08 ? 0 : F > 0.04 ? 1 : 2}`);
      const b = a.w.document.querySelector('#modals .btn.pri[data-a="cbm"]'); if (b) b.click(); a.avanzar(300); }
    if (dow === 1 || dow === 4) { a.w.__T = base + 0.5 * H; a.tocar('addMeasure'); a.ev(`document.querySelector('#m_peso').value='${(peso + (r() - 0.5) * 0.8).toFixed(1)}'`); a.tocar('mSave'); a.ev(`LAYERS.length=0; renderLayers();`); }
    // agua y comida: come lo que le marca la app, con un ±10 % y algún día peor
    for (let i = 0; i < 6 + Math.floor(r() * 4); i++) { a.w.__T = base + (1 + i * 1.6) * H; a.ev(`A.water(300)`); }
    const obj = JSON.parse(a.ev(`JSON.stringify((()=>{ const c=calcNutrition(); return c?{kcal:c.kcal||c.target||c.tdee,p:c.p||c.prot||Math.round(${P.peso}*1.8)}:null; })())`)) || { kcal: P.tdee, p: P.peso * 1.8 };
    const factor = (r() < 0.1 ? 1.25 : 1) * (0.9 + r() * 0.2), kcalObj = obj.kcal * factor;
    a.w.__T = base + 6 * H;
    const comido = JSON.parse(a.ev(`JSON.stringify((()=>{ const n=nd(), k=dayKey(), lista=[['${COMIDA.avena}',80,'desayuno'],['${COMIDA.leche}',300,'desayuno'],['${COMIDA.banana}',120,'desayuno'],['${COMIDA.pollo}',200,'almuerzo'],['${COMIDA.arroz}',250,'almuerzo'],['${COMIDA.aceite}',15,'almuerzo'],['${COMIDA.yogur}',250,'merienda'],['${COMIDA.huevo}',150,'cena'],['${COMIDA.pan}',80,'cena'],['${COMIDA.atun}',120,'cena']];
      const base=lista.reduce((s,[id,gr])=>s+alimMac(alimGet(id),gr).k,0), f=${kcalObj}/base;
      const add=lista.map(([id,gr,m])=>{ const x=alimGet(id); return Object.assign(alimMac(x,gr*f),{id:uid(),fid:id,n:x.n,gr:Math.round(gr*f),m,t:Date.now()}); });
      n.diario[k]=add; save(); diarioAdded(k,add); const t=dayTotals(k); return {k:t.k,p:t.p}; })())`));
    peso += (comido.k - (P.tdee + (peso - P.peso) * 22)) / 7700; protOk = comido.p >= peso * 1.6 ? 1 : 0.8;
    // entreno: en los días del plan, el 88 % de las veces
    const toca = a.ev(`!!(S.plan&&S.plan.days.includes(new Date().getDay()))`);
    if (toca && r() < 0.88) {
      a.w.__T = base + 11 * H;
      const x = JSON.parse(a.ev(`JSON.stringify((()=>{ const n=nextInPlan(); const E=estadoDia(); return {rid:n&&n.r?n.r.id:'', est:E&&E.score!=null?{s:E.score,w:E.w,soft:E.soft}:null}; })())`));
      if (x.est) L.estados.push(x.est.s);
      // con PandarIA: si el estado del día dice Suave o Descansa, usa el botón «Suave»
      let suave = false;
      if (conPandaria && x.est && x.est.soft && a.w.document.querySelector('[data-a="startSoft"]')) { suave = true; L.suaves++; }
      if (x.rid) {
        if (suave) a.tocar('startSoft', x.rid); else a.tocar('startWorkout', x.rid);
        a.avanzar(300); const emp = a.w.document.querySelector('#modals .btn.pri[data-a="cbm"]'); if (emp) { emp.click(); a.avanzar(300); }
        if (!a.ev('!!S.active')) { L.errores.add(`día ${d}: el entreno no empezó`); }
        else {
          a.w.document.querySelectorAll('#layers [data-a="kbOpen"]').forEach(b => L.kbVistos.set(b.dataset.v, (L.kbVistos.get(b.dataset.v) || 0) + 1));
          const items = JSON.parse(a.ev(`JSON.stringify(S.active.items.map(it=>({u:it.uid,ex:it.exId,mode:getEx(it.exId).mode,sets:it.sets.map((s,i)=>({i,t:s.t,sk:s.sk,sr:s.sr,st:s.st,tk:s.tk,tr:s.tr,tt:s.tt,why:s.why||''}))})))`));
          const ses = { d, rid: x.rid, est: x.est, suave, ex: {} };
          for (const it of items) {
            let Pd = (C[it.ex] || 0) * (1 - F) * (durmio === 0 ? 0.95 : 1) * (0.97 + r() * 0.06);
            const reg = { kg: [], reps: [], why: [...new Set(it.sets.map(s => s.why).filter(Boolean))] };
            reg.why.forEach(w => L.porque.set(w.replace(/[\d.,]+/g, '#'), (L.porque.get(w.replace(/[\d.,]+/g, '#')) || 0) + 1));
            let stim = 0;
            for (const s of it.sets) {
              if (it.mode === 'p') {
                let kg = s.sk ?? s.tk ?? 10, objetivo = s.sr ?? s.tr ?? 8;
                if (!conPandaria && s.t !== 'c') { const prev = cola.filter(c => c.ex === it.ex).pop(); if (prev) { kg = prev.kg + (prev.todas && r() < 0.35 ? 2.5 : 0); objetivo = prev.obj; } }
                // como una persona real: si con ese peso no llega ni al 60 % de las repeticiones, baja el peso hasta poder
                let rmax = kg > 0 ? Math.floor(30 * (Pd / kg - 1)) : 30, bajo = 0;
                while (kg > 2.5 && rmax - 1 < Math.ceil(objetivo * 0.6) && bajo < 8) { kg = Math.round(kg * 0.9 / 1.25) * 1.25; rmax = Math.floor(30 * (Pd / kg - 1)); bajo++; }
                if (bajo) L.bajaPeso = (L.bajaPeso || 0) + 1;
                let reps = Math.max(0, Math.min(objetivo, rmax - 1)); if (reps === 0 && rmax >= 1) reps = 1;
                const rir = Math.max(0, rmax - reps);
                if (reps <= 0) continue; // no puede ni una: se salta la serie
                a.ev(`(()=>{ const s=wkItem('${it.u}').sets[${s.i}]; s.kg=${kg}; s.reps=${reps}; ${s.t !== 'c' ? `s.rir=${Math.min(rir, 5)};` : ''} })()`);
                a.tocar('wkCheck', `${it.u}|${s.i}`); const cbm = a.w.document.querySelector('#modals [data-a="cbm"]'); if (cbm) cbm.click();
                if (s.t !== 'c') { (L.series = L.series || []).push({ d, ex: it.ex, sug: s.sk ?? s.tk, kg, obj: objetivo, reps, rir, bajo, pct: Math.round(kg / (C[it.ex] || 1) * 100), why: s.why || '' });
                  reg.kg.push(kg); reg.reps.push(reps); stim += rir <= 3 ? 1 : rir <= 5 ? 0.5 : 0.1; Pd *= 0.975; }
              } else if (it.mode === 'r') { a.ev(`(()=>{ const s=wkItem('${it.u}').sets[${s.i}]; s.reps=${s.sr ?? s.tr ?? 10}; })()`); a.tocar('wkCheck', `${it.u}|${s.i}`); }
              else { a.ev(`(()=>{ const s=wkItem('${it.u}').sets[${s.i}]; s.time=${s.st ?? s.tt ?? 30}; })()`); a.tocar('wkCheck', `${it.u}|${s.i}`); }
              a.avanzar(90000);
            }
            if (it.mode === 'p' && C[it.ex]) {
              // adaptación: más estímulo, más ganancia (con rendimientos decrecientes), menos si hay fatiga o falta proteína
              const gan = 0.008 * Math.pow(Math.min(stim, 8) / 4, 0.6) * Math.max(0, 1 - 4 * F) * protOk * Math.max(0.3, 1 - (C[it.ex] / C0[it.ex] - 1) * 1.5);
              C[it.ex] *= 1 + gan; F += 0.0022 * stim;
              const obj = it.sets.filter(s => s.t !== 'c').map(s => s.sr ?? s.tr ?? 8)[0];
              cola.push({ ex: it.ex, kg: reg.kg[0] || 0, obj, todas: reg.reps.length && reg.reps.every(x => x >= obj) });
              ses.ex[it.ex] = reg;
            }
          }
          if (F > 0.12) L.sobrecarga = (L.sobrecarga || 0) + 1;
          a.tocar('wkFinish'); a.avanzar(300); a.ev(`(()=>{ const el=document.querySelector('[data-in="finInt"]'); if (el){ el.value=${F > 0.08 ? 9 : 7}; IN.finInt(el); } })()`);
          a.tocar('finDo', 'keep'); a.avanzar(2000);
          a.ev(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`);
          L.sesiones.push(ses);
        }
      }
    }
    // noche: mira la app (rutinas, historial e informes, nutrición y el panda) y aplica las propuestas del panda
    a.w.__T = base + 14 * H;
    for (const [t, extra] of [['rutinas', ''], ['nutricion', ''], ['historial', `A.hseg('informes');`], ['historial', `A.hseg('progreso');`]]) {
      a.ev(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers(); A.tab('${t}'); ${extra}`); a.avanzar(200);
      a.w.document.querySelectorAll('[data-a="kbOpen"]').forEach(b => L.kbVistos.set(b.dataset.v, (L.kbVistos.get(b.dataset.v) || 0) + 1));
      const tx = a.texto(), m = tx.match(RAROS); if (m) L.raros.add(`${t}: «${tx.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, ' ').trim()}»`);
    }
    a.ev(`A.tab('rutinas'); A.guiaAbrir();`); a.avanzar(300);
    a.w.document.querySelectorAll('#modals [data-a="kbOpen"]').forEach(b => L.kbVistos.set(b.dataset.v, (L.kbVistos.get(b.dataset.v) || 0) + 1));
    const prop = a.w.document.querySelector('#modals .pprop');
    if (prop) { const t = prop.querySelector('.b').textContent, kbv = (prop.querySelector('[data-a="kbOpen"]') || { dataset: {} }).dataset.v || '';
      L.proposals.set(t.replace(/\d+/g, '#'), (L.proposals.get(t.replace(/\d+/g, '#')) || 0) + 1);
      const ap = prop.querySelector('[data-a="pandaAplicar"], [data-a="pandaIr"]');
      if (conPandaria && ap) { L.aplicadas.push(`día ${d}: ${t}${kbv ? ' (' + kbv + ')' : ''}`); if (/descarga/i.test(t)) L.descargas++;
        if (ap.dataset.a === 'pandaIr') { ap.click(); a.avanzar(500); const ok = a.w.document.querySelector('[data-a="applySugg"]'); if (ok) { ok.click(); a.avanzar(500); } }
        else { ap.click(); a.avanzar(500); } } }
    a.ev(`MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();`);
    // la semana de descarga que PandarIA propone sola (cada 4–6 semanas) también cuenta
    if (dow === 0) { sinDescargaSem++; if (a.ev('deloadActive()')) { sinDescargaSem = 0; } }
    a.errores.splice(0).forEach(e => L.errores.add(e.slice(0, 300)));
  }
  // resultados
  const app = JSON.parse(a.ev(`JSON.stringify((()=>{ const c=calcNutrition(), T=pesoTendencia();
    const e1={}; Object.keys(${JSON.stringify(C)}).forEach(id=>{ const h=e1Hist(id,40); e1[id]={ini:h[0]?h[0].y:null, fin:h.length?Math.max(...h.slice(-3).map(x=>x.y)):null, n:h.length}; });
    return {sesiones:S.sessions.length, prs:S.sessions.reduce((n,s)=>n+(s.prs||[]).length,0), descargas:(S.deloadLog||[]).length, deloadNow:deloadActive(),
      tdeeApp:c&&c.tdee, adapt:c&&c.adapt?{obs:c.adapt.obs,ok:c.adapt.ok,days:c.adapt.days}:null, kcalObj:c&&(c.kcal||c.target), e1, pesoT:T?{rate:T.rate,last:T.tr&&T.tr[T.tr.length-1]&&T.tr[T.tr.length-1].y}:null,
      lineaBase:lineaBase().filter(o=>!o.falta).map(o=>o.id), kbN:Object.keys(KB).length, informes:v3Novedades().map(x=>x.t), estado:estadoDia()&&estadoDia().score, tam:usoDatos().c}; })())`));
  a.cerrar();
  const fuerza = Object.fromEntries(Object.keys(C).map(id => [id, { ini: Math.round(C0[id] * 10) / 10, fin: Math.round(C[id] * 10) / 10, pct: Math.round((C[id] / C0[id] - 1) * 1000) / 10 }]));
  return { P: P.id, conPandaria, fuerza, peso: { ini: P.peso, fin: Math.round(peso * 10) / 10 }, app, L: { ...L, proposals: [...L.proposals], kbVistos: [...L.kbVistos].sort((a, b) => b[1] - a[1]), porque: [...L.porque].sort((a, b) => b[1] - a[1]), raros: [...L.raros], errores: [...L.errores], estadoMedio: L.estados.length ? Math.round(L.estados.reduce((x, y) => x + y, 0) / L.estados.length) : null, sesiones: L.sesiones.length } };
}

const out = [];
for (const P of PERSONAS.filter(p => !process.env.SOLO || process.env.SOLO === p.id)) for (const con of [true, false]) {
  const t = Date.now(); const res = await vivir(P, con); out.push(res);
  const media = Object.values(res.fuerza).reduce((a, b) => a + b.pct, 0) / Math.max(1, Object.keys(res.fuerza).length);
  console.log(`${P.id} ${con ? 'CON PandarIA' : 'sin PandarIA'}: ${res.app.sesiones} sesiones · fuerza real +${media.toFixed(1)} % de media · peso ${res.peso.ini}→${res.peso.fin} kg · ${res.L.aplicadas.length} propuestas aplicadas · ${res.L.suaves} sesiones suaves · ${res.L.errores.length} errores · ${Math.round((Date.now() - t) / 1000)} s`);
}
fs.writeFileSync(new URL(`./resultado-coach${process.env.SOLO ? '-' + process.env.SOLO : ''}.json`, import.meta.url), JSON.stringify(out, null, 1));
process.exit(0);
