// 1.9.5.1 · Simulación «como el usuario»: Me molesta con 1, 4 y 7, siguiente sesión, cintura e informe semanal
import { abrirApp } from './app.mjs';
const DAY = 864e5, t0 = new Date(2026, 10, 23, 18).getTime();
const a = await abrirApp({ t0, seed: 3 });
const ev = c => a.w.eval(c), log = (...x) => console.log(...x);
const modal = () => ev(`(document.querySelector('#modals .scrim:last-child')||{}).textContent||''`).replace(/\s+/g, ' ').trim();
const pulsaTexto = re => { const ok = ev(`(()=>{ const b=[...document.querySelectorAll('#modals button')].find(x=>${re}.test(x.textContent)); if(!b) return false; b.click(); return true; })()`); a.avanzar(400); return ok; };
ev(`window.isPremium=()=>true; S.settings.onboarded=true; S.settings.checkin=false; S.profile={name:'Eddy',age:29,height:178,weight:80,sex:'h',fitness:'activo',injuries:[]};
  S.routines=[newRoutine({name:'Pecho PandarIA',pandaria:true,items:[buildItem('press_banca','musculo',2)]})];
  S.sessions=[{id:'p1',start:Date.now()-3*DAY-3600e3,end:Date.now()-3*DAY,intensity:7,routineId:S.routines[0].id,items:[{exId:'press_banca',sets:[{t:'n',kg:60,reps:8,done:true},{t:'n',kg:60,reps:8,done:true},{t:'n',kg:60,reps:8,done:true}]}]}];
  save(true); render();`);
const rid = ev('S.routines[0].id');
const peso = () => ev(`(()=>{ const R=S.routines[0]; const s=suggestSet(R,R.items[0],R.items[0].sets.findIndex(x=>x.t!=='c')); return s.kg+' kg · '+s.why; })()`);
log('Sugerencia antes de nada:', peso());
const prueba = nota => {
  a.tocar('startWorkout', rid);
  if (/Cómo sigue tu molestia/.test(modal())) {
    log(`\nAl empezar el entreno pregunta «¿Cómo sigue tu molestia?» → respondo ${nota}`); pulsaTexto(`/^\\s*${nota}\\s*$/`);
    log('   ', modal().slice(0, 260)); pulsaTexto('/Entendido|Cerrar/'); a.avanzar(800);
  } else {
    ev('MODALS.length=0; renderModals();');
    const uid = ev('S.active.items[0].uid');
    a.tocar('wkMenu', uid); pulsaTexto('/Preferencias del ejercicio/'); pulsaTexto('/Me molesta/');
    const pide = /Cuánto te duele/.test(modal());
    pulsaTexto(`/^\\s*${nota}\\s*$/`);
    log(`\nDurante el entreno, «Me molesta» con nota ${nota} → ${pide ? 'pide la nota' : 'NO pidió la nota'}`); log('   ', modal().slice(0, 260));
  }
  log('   Marcado «te molesta»:', ev(`S.settings.avoid.press_banca||'no'`));
  ev('MODALS.length=0; renderModals(); S.active=null; LAYERS.length=0; renderLayers(); save();');
};
prueba(1); log('   Sugerencia:', peso());
a.avanzar(DAY); prueba(4); log('   Sugerencia:', peso());
a.avanzar(DAY); prueba(7); log('   Sugerencia siguiente sesión:', peso());
// terminar un entreno con el ejercicio en rojo: ¿propone cambiarlo?
const entrenar = (nota, titulo) => {
  a.tocar('startWorkout', rid);
  const m = modal(); log(`\n${titulo}: al empezar pregunta → ${/Cómo sigue tu molestia/.test(m) ? 'sí («¿Cómo sigue tu molestia?»)' : 'NO pregunta'}`);
  if (nota != null && /Cómo sigue/.test(m)) { pulsaTexto(`/^\\s*${nota}\\s*$/`); log(`   Nota ${nota} →`, modal().slice(0, 230)); pulsaTexto('/Entendido/'); }
  a.avanzar(800);
  log('   Entreno abierto:', ev('!!S.active'), '· peso propuesto en la 1.ª serie:', ev(`(()=>{ const s=S.active&&S.active.items[0].sets.find(x=>x.t!=='c'); return s?s.sk+' kg':'—'; })()`));
  ev('MODALS.length=0; renderModals(); S.active.items[0].sets.filter(x=>x.t!=="c").forEach(x=>{ x.kg=x.kg||x.sk; x.reps=x.reps||x.sr||8; x.done=true; }); S.active.start=Date.now()-40*60e3; save();');
  ev('finishWorkout()'); a.avanzar(1500); ev('MODALS.length=0; renderModals(); LAYERS.length=0; renderLayers();');
  log('   Marca «te molesta»:', ev(`S.settings.avoid.press_banca||'ninguna'`), '· propuesta de cambio:', ev(`((S.routines[0].sugg||[]).find(x=>x.kind==='cambiar')||{}).text||'ninguna'`));
};
a.avanzar(DAY); entrenar(4, 'Día siguiente, sigue en 4');
a.avanzar(DAY); entrenar(1, 'Otro día, ya en 1');
a.avanzar(DAY); entrenar(null, 'Entreno siguiente (ya en verde)');
// cintura: Registrar medidas
a.tocar('tab','historial'); a.tocar('hseg','cuerpo'); a.tocar('addMeasure');
ev(`document.querySelector('#m_peso').value='80'; document.querySelector('#m_cintura').value='84';`);
const guardar = ev(`(()=>{ const b=[...document.querySelectorAll('#layers button')].find(x=>/Guardar/.test(x.textContent)); if(b){ b.click(); return true;} return false; })()`); a.avanzar(500);
a.tocar('hseg','cuerpo');
const cuerpo = ev(`(document.querySelector('#view').textContent||'')`).replace(/\s+/g, ' ');
const i = cuerpo.indexOf('Tu cuerpo en números');
log('\nCuerpo (guardado:', guardar + '):', i >= 0 ? cuerpo.slice(i, i + 330) : 'NO aparece la tarjeta');
// informe semanal con 27 series de pecho y RIR alto
ev(`S.sessions.push({id:'x',start:Date.now()-3600e3,end:Date.now()-60e3,intensity:6,items:[{exId:'press_banca',sets:Array.from({length:27},()=>({t:'n',kg:40,reps:10,rir:6,done:true}))}]},{id:'y',start:Date.now()-8*DAY-3600e3,end:Date.now()-8*DAY,intensity:6,items:[{exId:'press_banca',sets:[{t:'n',kg:40,reps:10,rir:5,done:true},{t:'n',kg:40,reps:10,rir:6,done:true}]}]}); save();
`); a.tocar('hseg','informes');
const inf = ev(`(document.querySelector('#view').textContent||'')`).replace(/\s+/g, ' ');
log('\nInforme semanal:'); (inf.match(/⚠️[^⚠]{0,240}/g) || ['NO hay avisos']).forEach(x => log('  ', x));
log('\n' + (a.errores.length ? 'ERRORES: ' + a.errores.join(' | ') : 'Sin errores de la app'));
process.exit(0);
