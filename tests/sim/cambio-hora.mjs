// 1.8.2: la racha de semanas, la gráfica semanal y el informe no se rompen con el cambio de hora.
// Se ejecuta con TZ=Europe/Madrid y TZ=America/New_York desde tests/pruebas.mjs.
import { abrirApp } from './app.mjs';
// 8 semanas seguidas entrenando cada lunes; hoy es miércoles 8 de abril de 2026 (tras el cambio de hora de marzo)
const a = await abrirApp({ t0: new Date(2026, 3, 8, 12).getTime(), seed: 1 });
a.ev(`S=DEF(); S.settings.onboarded=true; window.isPremium=()=>true;
 for (let i=0;i<8;i++){ const d=new Date(2026,3,6,18); d.setDate(d.getDate()-7*i); S.sessions.push({id:'s'+i,routineId:'x',start:d.getTime()-3600e3,end:d.getTime(),items:[],vol:1000}); }
 save(true);`);
const r = JSON.parse(a.ev(`JSON.stringify({ racha:streakWeeks(),
  semanas:(()=>{ const k0=weekKey(Date.now()); let n=0; for (let i=11;i>=0;i--){ const k=weekShift(k0,-i); n+=S.sessions.filter(s=>weekKey(s.end)===k).length?1:0; } return n; })(),
  previa:weekReport(weekShift(weekKey(Date.now()),-1)).n, errores:0 })`));
r.errores = a.errores.length;
console.log(JSON.stringify(r));
process.exit(0);
