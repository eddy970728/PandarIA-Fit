// 1.9.5.2 · Si el sistema cierra la app durante un cardio, unos intervalos o un entreno, al volver siguen abiertos
import { abrirApp } from './app.mjs';
const t0 = new Date(2026, 10, 23, 18).getTime(), MIN = 60e3;
const base = `window.isPremium=()=>true; S.settings.onboarded=true; S.settings.ui='completa'; S.settings.orden181=1; S.settings.checkin=false; S.profile={name:'Eddy',age:29,height:178,weight:80,sex:'h',fitness:'activo',injuries:[]}; save(true);`;
const guarda = a => { const o = {}; for (let i = 0; i < a.w.localStorage.length; i++) { const k = a.w.localStorage.key(i); o[k] = a.w.localStorage.getItem(k); } return o; };
const paso = (a, ms) => { for (let x = 0; x < ms; x += 1000) a.avanzar(Math.min(1000, ms - x)); };
const casos = []; const ok = (c, n, d) => casos.push([!!c, n, d ?? '']);
const modal = a => a.ev(`(document.querySelector('#modals .scrim:last-child')||{}).textContent||''`).replace(/\s+/g, ' ');
const cardio = async (min, cierraTras, vuelveTras) => {
  const a = await abrirApp({ t0 }); a.ev(base); a.ev(`openLayer('cardio',{cfg:{act:'eliptica',min:${min},int:'moderada'}})`);
  a.ev(`A.cardioStart()`); paso(a, cierraTras); a.ev(`save(true)`); const st = guarda(a); const n0 = a.ev('S.sessions.length');
  const b = await abrirApp({ t0: t0 + cierraTras + vuelveTras, storage: st }); b.avanzar(1500); return { a, b, n0 };
};
// A) cierre a mitad: vuelve en marcha y descontando el tiempo que pasó
{ const { b } = await cardio(30, 10 * MIN, 5 * MIN);
  const left = b.ev('INT?Math.round(intLeft()):-1');
  ok(b.ev(`!!INT && LAYERS.some(l=>l.t==='intRun')`) && Math.abs(left - 15 * 60 + 5) < 10, 'A · cierro a los 10 min y vuelvo a los 5: el cardio sigue abierto con ~15 min', `quedan ${left} s`); }
// B) tu caso: cierro a 20 s del final y vuelvo cuando ya debía terminar → pregunta si guardar, con el tiempo completo
{ const { b } = await cardio(30, 30 * MIN + 5e3 - 20e3, 3 * MIN);
  const m = modal(b); ok(/completado/i.test(m), 'B · cierro a 20 s del final y vuelvo después: pregunta «¡Cardio completado!»', m.slice(0, 60));
  const btn = [...b.w.document.querySelectorAll('#modals button')].find(x => /Guardar en el historial/.test(x.textContent)); btn && btn.click(); b.avanzar(800);
  const s = JSON.parse(b.ev(`JSON.stringify(S.sessions.map(x=>({n:x.routineName,min:Math.round(x.cardio?x.cardio.work/60:0)})))`));
  ok(s.length === 1 && s[0].min === 30 && !b.ev('S.intActivo') && !b.ev('S.intPend'), 'B · se guarda una vez, con sus 30 min, y no queda nada pendiente', JSON.stringify(s)); }
// C) se cierra con la ventana de guardar abierta → al volver sigue la ventana
{ const a = await abrirApp({ t0 }); a.ev(base); a.ev(`openLayer('cardio',{cfg:{act:'eliptica',min:10,int:'moderada'}})`); a.ev('A.cardioStart()'); paso(a, 10 * MIN + 8e3);
  const st = guarda(a); const b = await abrirApp({ t0: t0 + 12 * MIN, storage: st }); b.avanzar(1500);
  ok(/completado/i.test(modal(b)) && b.ev('!!S.intPend'), 'C · la app se cerró con «¿Cómo te fue hoy?» abierta: al volver sigue ahí', modal(b).slice(0, 50));
  const d = [...b.w.document.querySelectorAll('#modals button')].find(x => /Descartar/.test(x.textContent)); d && d.click(); b.avanzar(600);
  ok(!b.ev('S.intPend') && b.ev('S.sessions.length') === 0, 'C · y si la descarto, no vuelve a salir', ''); }
// D) intervalos: vuelven donde iban
{ const a = await abrirApp({ t0 }); a.ev(base); a.ev(`A.openIntervals(); A.intStart();`); paso(a, 70e3); a.ev('save(true)'); const i0 = a.ev('INT.i');
  const b = await abrirApp({ t0: t0 + 70e3 + 15e3, storage: guarda(a) }); b.avanzar(1000);
  ok(b.ev(`!!INT && LAYERS.some(l=>l.t==='intRun')`) && b.ev('INT.i') >= i0, 'D · intervalos: siguen abiertos y avanzados', `fase ${i0} → ${b.ev('INT.i')}`); }
// E) más de 6 horas después: se descarta en silencio
{ const { b } = await cardio(30, 5 * MIN, 7 * 3600e3); ok(!b.ev('INT') && !b.ev('S.intActivo'), 'E · vuelvo 7 horas después: no se recupera (se descarta)'); }
// F) entreno de rutina: al volver se abre directamente
{ const a = await abrirApp({ t0 }); a.ev(base + `S.routines=[newRoutine({name:'R',pandaria:true,items:[buildItem('press_banca','musculo',2)]})]; save(true);`);
  a.ev(`A.startWorkout(S.routines[0].id)`); a.avanzar(2000); a.ev('save(true)');
  const b = await abrirApp({ t0: t0 + 20 * MIN, storage: guarda(a) }); b.avanzar(1500);
  ok(b.ev(`!!S.active && LAYERS.some(l=>l.t==='workout')`), 'F · entreno de rutina: al volver se abre la pantalla del entreno', ''); }
let mal = 0; for (const [c, n, d] of casos) { if (!c) mal++; console.log((c ? '✓ ' : '✗ ') + n + '  ' + d); }
process.exit(mal ? 1 : 0);
