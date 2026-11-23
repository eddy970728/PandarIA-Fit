// Escenarios de ayuno y diario: ¿PandarIA avisa solo cuando tiene datos reales y recientes?
import { abrirApp } from './app.mjs';
const DAY = 864e5, t0 = new Date(2026, 10, 23, 10).getTime();
const a = await abrirApp({ t0, seed: 7 });
const ev = c => a.w.eval(c);
ev(`window.isPremium=()=>true; S.settings.onboarded=true; S.profile={name:'Eddy',age:29,height:178,weight:80,sex:'h',fitness:'activo',injuries:[]}; nut().goal='bajar'; save(true);`);
// helper: crea un día de diario con kcal y proteína dadas (n alimentos)
ev(`window.__dia=(i,k,p,n)=>{ const D=(S.nutri.diario=S.nutri.diario||{}); const key=dayKey(Date.now()-i*DAY); if(k==null){ delete D[key]; return; } n=n||2; D[key]=[...Array(n)].map((_,j)=>({id:'x'+j,n:'Comida',g:100,k:k/n,p:p/n,c:0,g2:0,m:'almuerzo'})); };
window.__limpia=()=>{ S.nutri.diario={}; };
window.__estado=()=>{ const r=riesgoPeso(), pc=protCorta(), ac=ayunoCarga(); return {poco:!!(r&&r.poco), dias:r?r.dias:0, prot:pc?pc.low+'/'+pc.n:null, ayer:ac}; };`);
const casos = [];
const caso = (nombre, prep, esperado) => { ev('__limpia();' + prep); const r = JSON.parse(ev('JSON.stringify(__estado())')); const ok = Object.entries(esperado).every(([k, v]) => r[k] === v); casos.push([ok, nombre, JSON.stringify(r)]); };
// A) Nunca registra comida, ayuna fuerte
caso('A · nunca registra comida (ayuna o no)', '', { poco: false, prot: null, ayer: null });
// B) Tu caso: registra todo, come poco y poca proteína, 7 días
caso('B · registra todo, come muy poco 7 días', 'for(let i=1;i<=7;i++) __dia(i,900,50,3);', { poco: true, prot: '3/3' });
// C) Registra poco 7 días y deja de registrar: hoy-1..hoy-3 sin datos
caso('C1 · deja de registrar hace 3 días', 'for(let i=4;i<=10;i++) __dia(i,900,50,3);', { poco: false });
caso('C2 · deja de registrar hace 6 días (proteína vieja)', 'for(let i=6;i<=12;i++) __dia(i,900,50,3);', { poco: false, prot: null });
caso('C3 · deja de registrar hace 10 días', 'for(let i=10;i<=16;i++) __dia(i,900,50,3);', { poco: false, prot: null });
// D) Registra bien y deja de registrar
caso('D · registraba bien y dejó de registrar', 'for(let i=4;i<=10;i++) __dia(i,2300,160,3);', { poco: false, prot: null });
// E) Registra solo 1 alimento por día (día incompleto)
caso('E · solo 1 alimento al día', 'for(let i=1;i<=7;i++) __dia(i,400,20,1);', { poco: false, prot: null });
// F) Registra días sueltos (3 de 7)
caso('F · registra solo 3 días de 7', '__dia(1,900,50,3);__dia(3,900,50,3);__dia(5,900,50,3);', { poco: false });
// G) Ayer comió bien
caso('G · ayer comió bien', '__dia(1,2300,170,3);', { ayer: null });
// H) Ayer comió muy poco
caso('H · ayer comió muy poco', '__dia(1,700,40,3);', { ayer: 'ayer comiste bastante menos que tu objetivo' });
// I) 5:2: días bajos planificados (lunes y jueves) y el resto normal
caso('I · plan 5:2 con sus días bajos', `nut().fast.plan='5:2'; nut().fast.days52=[1,4]; for(let i=1;i<=7;i++){ const d=new Date(Date.now()-i*DAY).getDay(); if([1,4].includes(d)) __dia(i,550,40,2); else __dia(i,2100,150,3); }`, { poco: false, prot: null });
ev(`nut().fast.plan='16:8';`);
// J) Aviso al empezar el ayuno: solo con riesgo real
const conf = p => { ev('__limpia();' + p + `; MODALS&&(MODALS.length=0); window.__cb=null; const cbo=confirmBox; confirmBox=o=>{ window.__cb=o.title; }; nut().fast.active=null; A.fastStart(); confirmBox=cbo;`); return ev('window.__cb'); };
casos.push([conf('') == null, 'J1 · empezar ayuno sin diario: sin aviso', String(conf(''))]);
casos.push([conf('for(let i=1;i<=7;i++) __dia(i,900,50,3);') != null, 'J2 · empezar ayuno comiendo muy poco: pregunta antes', String(conf('for(let i=1;i<=7;i++) __dia(i,900,50,3);'))]);
// K/L) Anotar comida con el ayuno en marcha: en la primera hora es la última comida anotada tarde (no pregunta); después sí
const durante = hh => { ev(`__limpia(); window.__cb=null; const cbo=confirmBox; window.__cbo=cbo; confirmBox=o=>{ window.__cb=o.title; }; nut().fast.active={start:Date.now()-${hh}*3600000,goalH:16}; diarioAdded(dayKey(),[{fid:'05062',gr:150,m:'cena'}]);`); a.avanzar(500); const r = ev('window.__cb'); ev('confirmBox=window.__cbo; nut().fast.active=null;'); return r; };
casos.push([durante(0.5) == null, 'K · anota la cena 30 min después de empezar el ayuno: no pregunta', String(durante(0.5))]);
casos.push([durante(5) != null, 'L · anota comida con 5 h de ayuno: pregunta si lo termina', String(durante(5))]);
let mal = 0; for (const [ok, n, d] of casos) { if (!ok) mal++; console.log((ok ? '✓ ' : '✗ ') + n + '  ' + d); }
console.log(a.errores.length ? 'errores: ' + a.errores.join(' | ') : 'sin errores de la app');
process.exit(mal ? 1 : 0);
