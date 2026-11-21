// Recorre las pantallas con datos de lastre y ejercicios nuevos (ES y EN) buscando errores y textos rotos.
import { abrirApp, RAROS } from './app.mjs';
const D = 864e5, T0 = Date.UTC(2026, 10, 20, 15);
const estado = lang => {
  const ses = []; let k = 0;
  for (let d = 40; d >= 2; d -= 3) { const t = T0 - d * D; const kg = Math.max(0, Math.floor((40 - d) / 6) * 2.5);
    ses.push({ id: 'l' + (k++), routineId: 'r1', name: 'Calistenia', start: t, end: t + 3e6, intensity: 7, items: [
      { exId: d > 25 ? 'dominadas' : 'dominadas_lastre', uid: 'u1', sets: [1, 2, 3].map(() => d > 25 ? { t: 'n', reps: 12 + (k % 3), done: true } : { t: 'n', kg, reps: 8 + (k % 3), done: true }) },
      { exId: 'ext_triceps_cuerpo', uid: 'u2', sets: [1, 2].map(() => ({ t: 'n', reps: 10, done: true })) },
      { exId: 'fondos_pecho_lastre', uid: 'u3', sets: [{ t: 'n', kg: 0, reps: 10, done: true }, { t: 'n', kg: 5, reps: 8, done: true }] },
      { exId: 'pino_pared', uid: 'u4', sets: [{ t: 'n', time: 30, done: true }] }] }); }
  return { pf_state: JSON.stringify({ v: 1, settings: { onboarded: true, lang, unit: 'kg', equip: ['man', 'bar', 'dom', 'par', 'ban'] }, profile: { age: 30, weight: 80, height: 178, sex: 'h' },
    routines: [{ id: 'r1', name: 'Calistenia', items: [{ uid: 'u1', exId: 'dominadas_lastre', range: [6, 10], sets: [1, 2, 3].map(() => ({ t: 'n', kg: 10, reps: 6, rest: 120 })) }, { uid: 'u2', exId: 'ext_triceps_cuerpo', range: [8, 12], sets: [1, 2].map(() => ({ t: 'n', reps: 10, rest: 90 })) }] }],
    sessions: ses.reverse() }) };
};
let mal = 0;
for (const lang of ['es', 'en']) {
  const st = estado(lang); let a;
  try { a = await abrirApp({ t0: T0, storage: {} }); } catch (e) { console.log('no abre', e); process.exit(1); }
  // el formato de guardado lo decide la app: se cargan los datos con su propia función de restaurar
  a.ev(`(()=>{ const o=${st.pf_state}; Object.assign(S.settings,o.settings); Object.assign(S.profile||(S.profile={}),o.profile);
    S.routines=o.routines.map(r=>{ const n=newRoutine({name:r.name,pandaria:true,items:r.items}); n.id=r.id; return n; }); S.sessions=o.sessions; save(true); applyLang(); render(); })()`); a.avanzar(500);
  const ver = async (nombre, code) => { try { a.ev(code); } catch (e) { a.errores.push(nombre + ': ' + e.message); } a.avanzar(600); await new Promise(r => setTimeout(r, 20)); // la traducción al inglés llega en un MutationObserver
    const t = a.texto(); if (lang === 'en' && /con lastre|Añadir lastre|Quitar lastre|bayitas|Primer lastre/.test(t)) { mal++; console.log('en', nombre, 'español sin traducir:', t.match(/.{0,60}(con lastre|Añadir lastre|Quitar lastre|bayitas|Primer lastre).{0,30}/)[0].replace(/\s+/g,' ')); }
    const m = t.match(RAROS); if (m) { mal++; console.log(lang, nombre, 'texto raro:', t.slice(Math.max(0, m.index - 80), m.index + 40).replace(/\s+/g, ' ')); } };
  await ver('rutinas', `LAYERS.length=0; A.tab('routines')`); await ver('historial', `LAYERS.length=0; A.tab('history')`);
  for (const id of ['dominadas_lastre', 'dominadas', 'ext_triceps_cuerpo', 'fondos_pecho_lastre', 'pino_pared'])
    await ver('ejercicio ' + id, `LAYERS.length=0; openLayer('exercise',{id:'${id}'})`);
  await ver('sesión', `LAYERS.length=0; A.openSession(S.sessions[S.sessions.length-1].id)`);
  await ver('editor', `LAYERS.length=0; openEditor(JSON.parse(JSON.stringify(S.routines[0])),false)`);
  await ver('rutina', `LAYERS.length=0; A.openRoutine('r1')`);
  await ver('entreno', `LAYERS.length=0; _startWorkout('r1'); MODALS.length=0; renderModals()`);
  await ver('menú lastre', `A.wkMenu(S.active.items[0].uid)`);
  await ver('quitar lastre', `[...document.querySelectorAll('#modals [data-a]')].find(b=>/lastre|weight/i.test(b.textContent)).click()`);
  await ver('terminar', `MODALS.length=0; S.active.items.forEach(it=>it.sets.forEach(x=>{x.done=true; x.reps=x.reps||x.sr||8; x.kg=x.kg??x.sk??null;})); A.wkFinish()`);
  await ver('guardar', `const b=document.querySelector('[data-a="finDo"][data-v="keep"]'); b&&b.click()`);
  await ver('informes', `LAYERS.length=0; A.tab('history'); typeof A.hgrp==='function'&&A.hgrp('informes')`);
  await ver('récords', `typeof A.hgrp==='function'&&A.hgrp('records')`);
  await ver('picker lastre', `LAYERS.length=0; openLayer('picker',{q:'lastre'})`);
  await ver('compartir', `encodeRoutine(S.routines[0])`);
  console.log(lang, 'errores:', a.errores.length ? a.errores.slice(0, 5) : 'ninguno', '· entrenos', a.ev('S.sessions.length'));
  mal += a.errores.length; a.cerrar();
}
console.log(mal ? `✗ ${mal} problemas` : '✓ lastre y ejercicios nuevos sin errores en ES y EN'); process.exit(mal ? 1 : 0);
