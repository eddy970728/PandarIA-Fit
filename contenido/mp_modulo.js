/* ============ 1.9.6 · Mi PandarIA (pretemporada y Temporada 0 en beta) ============
   La quinta pestaña: autosuperación sin servidor. Todo se calcula con tu historial del teléfono; solo se guarda
   en S.mp lo que no se puede deducir (cuándo se abrió, qué contenido viste). Así entra en la copia de Drive y nunca se descuadra.
   - Se gana: 3 entrenos o 7 días con actividad (lo que llegue antes). Antes se ve con un candado y lo que falta.
   - Puntos del día (máx. 150) + bonos de retos y de la Liga contra tu media. Rangos que nunca bajan.
   - Racha con comodín (Premium 1 por semana, gratis 1 al mes) · actividades del día (Premium 2 a tu medida, gratis 1)
   - Contenido del día (MP_CONT, en 3 idiomas, con tarjetas para menores) · calendario de todo · resumen de hoy. */
const MP_INI='2026-11-27';
const MP_TEMP=[
  {id:'pre',n:['Pretemporada','Preseason','Pré-temporada'],a:'2026-11-27',b:'2026-11-30',beta:true},
  {id:'t0',n:['Temporada 0','Season 0','Temporada 0'],a:'2026-12-01',b:'2027-01-31',beta:true},
  {id:'t1',n:['Temporada 1','Season 1','Temporada 1'],a:'2027-02-01',b:'2027-03-31'}];
const MP_RANGOS=[['Cachorro','Cub','Filhote',0,'#9aa3ae'],['Explorador','Explorer','Explorador',600,'#3ecf8e'],['Constante','Steady','Constante',1800,'#4da3ff'],
  ['Fuerte','Strong','Forte',4000,'#ff7a1a'],['Atleta','Athlete','Atleta',8000,'#e0475b'],['Maestro','Master','Mestre',15000,'#a77bff'],['Leyenda','Legend','Lenda',25000,'#f2b632']];
const MP_PTS={entreno:40,plan:10,descanso:30,extra:15,agua:10,comida:10,ayuno:10,checkin:5,contenido:5,max:150};
const MP_ROM=['I','II','III','IV','V'];
const mpI=()=>({en:1,pt:2}[LANG()]||0);
const mpL=a=>Array.isArray(a)?(a[mpI()]||a[0]):a;
const mpK=k=>{ const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d,12).getTime(); };
const mpSum=(k,n)=>dayKey(mpK(k)+n*DAY);
const mpEntre=(a,b)=>Math.round((mpK(b)-mpK(a))/DAY);
function mpS(){ S.mp=S.mp||{}; S.mp.vis=S.mp.vis||{}; return S.mp; }
const mpTemp=k=>MP_TEMP.find(t=>k>=t.a&&k<=t.b)||null;
const mpTempAct=()=>mpTemp(dayKey())||MP_TEMP.find(t=>t.a>dayKey())||MP_TEMP[MP_TEMP.length-1];
const mpPlanDia=k=>!!(S.plan&&S.plan.days&&S.plan.days.includes(new Date(mpK(k)).getDay()));

/* ---------- Actividades del día (temporizador de intervalos) ---------- */
const MP_EXTRAS=[
  {k:'core',n:['Core exprés','Express core','Core expresso'],min:6,suave:true,cfg:{work:40,rest:20,rounds:6},ex:['plancha','dead_bug','bird_dog']},
  {k:'movilidad',n:['Movilidad completa','Full mobility','Mobilidade completa'],min:7,suave:true,cfg:{work:50,rest:10,rounds:7},ex:['mov_articular','gato_vaca','est_flexor_cadera','est_gluteo']},
  {k:'cardio',n:['Cardio suave','Easy cardio','Cardio leve'],min:8,cfg:{work:45,rest:15,rounds:8},ex:['marcha_sitio','jumping_jacks','sombra_boxeo']},
  {k:'tabata',n:['Tabata de piernas','Leg Tabata','Tabata de pernas'],min:4,fuerte:true,cfg:{fmt:'tabata',tWork:20,tRest:10},ex:['sentadilla_salto','zancadas_pc']},
  {k:'estira',n:['Estiramientos','Stretching','Alongamentos'],min:7,suave:true,cfg:{work:50,rest:10,rounds:7},ex:['est_isquios','est_cuadriceps','est_pecho','est_dorsal','est_gemelos']},
  {k:'empuje',n:['Flexiones en EMOM','Push-up EMOM','Flexões em EMOM'],min:6,fuerte:true,cfg:{fmt:'emom',emomMin:6,emomReps:8},ex:['flexiones','flexiones_rodillas']},
  {k:'yoga',n:['Yoga breve','Short yoga','Ioga breve'],min:7,suave:true,cfg:{work:50,rest:10,rounds:7},ex:['yoga_saludo','yoga_perro','yoga_cobra','yoga_nino']},
  {k:'gluteo',n:['Glúteos y espalda baja','Glutes and lower back','Glúteos e lombar'],min:6,cfg:{work:40,rest:20,rounds:6},ex:['puente_gluteo','superman','plancha_lateral']}];
function mpExOk(id){ const e=EX[id]; return !!e && !avoided(id) && (typeof hasEquip!=='function'||hasEquip(e)); }
function mpExtrasPosibles(){ return MP_EXTRAS.map(x=>Object.assign({},x,{exOk:x.ex.filter(mpExOk)})).filter(x=>x.exOk.length>=2||(x.cfg.fmt&&x.exOk.length>=1)); }
function mpSemilla(k){ let h=7; const s=k+'|'+((S.profile&&S.profile.name)||'')+'|'+(S.profile&&S.profile.age||''); for (let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h; }
// Premium: 2 a tu medida (check-in, plan del día, lesiones, equipo); gratis: 1 general y segura
function mpExtrasDe(k){
  const P=mpExtrasPosibles(); if (!P.length) return [];
  const sem=mpSemilla(k), rot=a=>a.length?a.slice(sem%a.length).concat(a.slice(0,sem%a.length)):a;
  if (!premOK()){ const seg=P.filter(x=>x.suave); return rot(seg.length?seg:P).slice(0,1); }
  const ck=(typeof v3Checkin==='function'&&k===dayKey()?v3Checkin():null)||{}, cansado=ck.energy===0||ck.sleep===0||ck.mood===0;
  const fuerzaHoy=mpPlanDia(k), principiante=(S.profile||{}).fitness==='sedentario'||S.sessions.length<6;
  const suaves=rot(P.filter(x=>x.suave)), otras=rot(P.filter(x=>!x.suave&&!(x.fuerte&&principiante)));
  if (cansado||fuerzaHoy) return suaves.slice(0,2).concat(otras).slice(0,2);
  return [otras[0],suaves[0]].filter(Boolean).concat(suaves.slice(1),otras.slice(1)).slice(0,2);
}
A.mpExtra=k=>{
  const x=mpExtrasPosibles().find(e=>e.k===k); if (!x) return;
  const hecho=(mpCalc().dias[dayKey()]||{}).acts||[];
  if (hecho.includes(k)&&!premOK()) return toast(tx('En la versión gratis cada actividad se hace una vez al día','In the free version each activity is done once a day',{pt:'Na versão gratuita cada atividade é feita uma vez por dia'}));
  const c=Object.assign(intDefaults(),{fmt:'hiit',sets:1,setRest:60,prep:10},x.cfg,{ex:x.exOk.slice(0,x.cfg.rounds||8)});
  c.nombre='Mi PandarIA · '+mpL(x.n);
  const plan=intPhases(c).filter(f=>f.type==='work').reduce((a,f)=>a+f.dur,0);
  S.mpRun={k,day:dayKey(),plan,name:c.nombre};
  INT={cfg:c, ph:intPhases(c), i:0, t0:Date.now(), paused:null, rounds:0, start:Date.now(), done:[], lastSec:null}; S.intActivo=INT; save(true);
  openLayer('intRun',{}); keepAwake(); intAnnounce();
};
const _mpSaveInt=saveIntSession;
saveIntSession=function(session){
  const R=S.mpRun;
  if (R && session && session.routineId==='__int' && session.routineName===R.name){ session.mp={k:R.k,day:R.day,ok:((session.int&&session.int.work)||0)>=R.plan*0.8}; delete S.mpRun; }
  return _mpSaveInt.apply(this,arguments);
};

/* ---------- Cálculo: puntos, misiones, racha, retos, liga y rango (todo deducido del historial) ---------- */
let MP_MEMO=null;
function mpCalc(){
  const hoy=dayKey(), firma=[hoy,S.sessions.length,S.measures.length,JSON.stringify((nut().waterLog||{})[hoy]||[]).length,((nut().diario||{})[hoy]||[]).length,(nut().fast.history||[]).length,Object.keys(mpS().vis).length,(S.diaLog||{})[hoy]?1:0,premOK()?1:0,S.plan?JSON.stringify(S.plan.days):''].join('|');
  if (MP_MEMO&&MP_MEMO.firma===firma) return MP_MEMO;
  const ses={}, n=nut(), W=n.waterLog||{}, Dd=n.diario||{}, F=n.fast.history||[], L=S.diaLog||{};
  S.sessions.forEach(s=>{ const k=dayKey(s.end||s.start); if (k>=MP_INI) (ses[k]=ses[k]||[]).push(s); });
  const ayunos={}; F.forEach(f=>{ if (f.ok&&f.end){ const k=dayKey(f.end); if (k>=MP_INI) ayunos[k]=1; } });
  const usaAgua=Object.keys(W).length>0, usaComida=Object.keys(Dd).some(k=>(Dd[k]||[]).length), usaAyuno=!!(n.fast.plan||F.length);
  const meta=k=>((n.waterGoalDia||{})[k])||waterGoal();
  const dias={};
  for (let k=MP_INI;k<=hoy;k=mpSum(k,1)){
    const ss=ses[k]||[], norm=ss.filter(s=>!s.mp&&((s.end||0)-(s.start||0))>=10*60000), acts=[...new Set(ss.filter(s=>s.mp&&s.mp.ok).map(s=>s.mp.k))];
    const plan=mpPlanDia(k), rutina=norm.some(s=>s.routineId&&s.routineId.indexOf('__')!==0);
    const agua=(W[k]||[]).reduce((a,x)=>a+(x.ml||0),0), comidas=(Dd[k]||[]).length;
    const ck=!!(L[k]&&L[k].ck)||(k===hoy&&typeof v3Checkin==='function'&&!!v3Checkin());
    const P={entreno:norm.length?MP_PTS.entreno:0, plan:plan&&rutina?MP_PTS.plan:0, descanso:!plan&&!norm.length&&acts.length?MP_PTS.descanso:0,
      extra:Math.min(2,acts.length)*MP_PTS.extra, agua:agua>0&&agua>=meta(k)?MP_PTS.agua:0, comida:comidas>=2?MP_PTS.comida:0,
      ayuno:ayunos[k]?MP_PTS.ayuno:0, checkin:ck?MP_PTS.checkin:0, contenido:mpS().vis[k]?MP_PTS.contenido:0};
    const base=Math.min(MP_PTS.max,Object.values(P).reduce((a,x)=>a+x,0));
    const moverte=plan?norm.length>0:(norm.length>0||acts.length>0);
    const aguaOk=!usaAgua||P.agua>0;
    dias[k]={P,base,bono:0,acts,norm:norm.length,plan,moverte,aguaOk,cumple:moverte&&aguaOk,agua,comidas,ayuno:!!ayunos[k],ck,activo:ss.length>0||comidas>0||agua>0||!!ayunos[k]};
  }
  // retos (semana · mes · temporada): el bono cuenta el día en que se completa
  const retos=[], planN=Math.max(2,(S.plan&&S.plan.days&&S.plan.days.length)||3);
  const reto=(id,tipo,t,a,b,metaN,f,bono)=>{ let v=0, dia=null; for (let k=a;k<=b&&k<=hoy;k=mpSum(k,1)){ if (f(dias[k])){ v++; if (v===metaN&&!dia) dia=k; } } if (dia&&dias[dia]) dias[dia].bono+=bono; retos.push({id,tipo,t,meta:metaN,v:Math.min(v,metaN),ok:!!dia,bono}); };
  const T=mpTemp(hoy);
  if (T){
    const lun=dayKey(weekKey(mpK(hoy))), dom=mpSum(lun,6), d=new Date(mpK(hoy)), m1=dayKey(new Date(d.getFullYear(),d.getMonth(),1,12).getTime()), m2=dayKey(new Date(d.getFullYear(),d.getMonth()+1,0,12).getTime());
    const rc=(a,b)=>[a<T.a?T.a:a,b>T.b?T.b:b], [sa,sb]=rc(lun,dom), [ma,mb]=rc(m1,m2), lar=(a,b)=>mpEntre(a,b)+1;
    reto('sem','semana',[`${Math.max(1,Math.round(planN*lar(sa,sb)/7))} entrenos`,`${Math.max(1,Math.round(planN*lar(sa,sb)/7))} workouts`,`${Math.max(1,Math.round(planN*lar(sa,sb)/7))} treinos`],sa,sb,Math.max(1,Math.round(planN*lar(sa,sb)/7)),x=>x&&x.norm>0,20);
    if (usaAgua) reto('mes','mes',['Días con tu meta de agua','Days with your water goal','Dias com sua meta de água'],ma,mb,Math.max(2,Math.round(lar(ma,mb)*0.5)),x=>x&&x.P.agua>0,30);
    else reto('mes','mes',['Días con actividad','Active days','Dias com atividade'],ma,mb,Math.max(2,Math.round(lar(ma,mb)*0.5)),x=>x&&x.moverte,30);
    reto('tem','temporada',[`${Math.max(3,Math.round(planN*lar(T.a,T.b)/7*0.75))} entrenos en la temporada`,`${Math.max(3,Math.round(planN*lar(T.a,T.b)/7*0.75))} workouts this season`,`${Math.max(3,Math.round(planN*lar(T.a,T.b)/7*0.75))} treinos na temporada`],T.a,T.b,Math.max(3,Math.round(planN*lar(T.a,T.b)/7*0.75)),x=>x&&x.norm>0,50);
  }
  // Liga: tu semana frente a tu media de las 4 anteriores (desde que empezó Mi PandarIA)
  const semanas=[]; for (let k=dayKey(weekKey(mpK(MP_INI)));k<=hoy;k=mpSum(k,7)){ let s=0; for (let i=0;i<7;i++){ const x=dias[mpSum(k,i)]; if (x) s+=x.base; } semanas.push({k,pts:s}); }
  semanas.forEach((w,i)=>{ const prev=semanas.slice(Math.max(0,i-4),i).filter(x=>x.pts>0); w.media=prev.length?Math.round(prev.reduce((a,x)=>a+x.pts,0)/prev.length):null;
    if (w.media!=null&&i<semanas.length-1){ const r=w.pts>w.media*1.05?'arriba':w.pts>=w.media*0.95?'media':'recupera'; w.res=r; const lunes=mpSum(w.k,7); if (dias[lunes]) dias[lunes].bono+=r==='arriba'?40:r==='media'?20:0; } });
  // racha con comodín: Premium 1 por semana, gratis 1 al mes
  const prem=premOK(); let racha=0, mejor=0, usados={}; const comodines={};
  for (let k=MP_INI;k<=hoy;k=mpSum(k,1)){ const x=dias[k]; if (k===hoy&&!x.cumple){ break; }
    if (x.cumple){ racha++; } else { const per=prem?dayKey(weekKey(mpK(k))):k.slice(0,7); if (!usados[per]&&racha>0){ usados[per]=1; comodines[k]=1; } else racha=0; }
    mejor=Math.max(mejor,racha); }
  let total=0; Object.values(dias).forEach(x=>{ x.total=x.base+x.bono; total+=x.total; });
  return MP_MEMO={firma,dias,retos,semanas,racha,mejor,comodines,total,usaAgua,usaComida,usaAyuno};
}
function mpRango(total){ let r=0; MP_RANGOS.forEach((x,i)=>{ if (total>=x[3]) r=i; }); const a=MP_RANGOS[r][3], b=r<MP_RANGOS.length-1?MP_RANGOS[r+1][3]:a+25000, paso=(b-a)/5, nivel=Math.min(4,Math.floor((total-a)/paso));
  const sig=a+paso*(nivel+1); return {r, nivel, nombre:mpL(MP_RANGOS[r]), color:MP_RANGOS[r][4], txt:mpL(MP_RANGOS[r])+' '+MP_ROM[nivel], falta:Math.max(0,Math.ceil(sig-total)), pct:Math.round(((total-a)-paso*nivel)/paso*100),
    sigTxt:nivel<4?mpL(MP_RANGOS[r])+' '+MP_ROM[nivel+1]:r<MP_RANGOS.length-1?mpL(MP_RANGOS[r+1])+' I':mpL(MP_RANGOS[r])+' V'}; }

/* ---------- Desbloqueo ---------- */
function mpProgreso(){ const ent=S.sessions.filter(s=>!s.mp&&((s.end||0)-(s.start||0))>=10*60000).length, n=nut(), set=new Set();
  S.sessions.forEach(s=>set.add(dayKey(s.end||s.start))); Object.keys(n.diario||{}).forEach(k=>{ if ((n.diario[k]||[]).length) set.add(k); }); Object.keys(n.waterLog||{}).forEach(k=>{ if ((n.waterLog[k]||[]).length) set.add(k); }); (n.fast.history||[]).forEach(f=>{ if (f.end) set.add(dayKey(f.end)); });
  return {ent:Math.min(3,ent), dias:Math.min(7,set.size)}; }
function mpAbierta(){ const M=mpS(); if (M.unl) return true; const p=mpProgreso(); if (p.ent>=3||p.dias>=7){ M.unl=dayKey(); M.bienvenida=1; save(); return true; } return false; }
const mpVisible=()=>!(S.settings&&S.settings.mpOff);

/* ---------- Pantallas ---------- */
const mpChip=(t,c)=>`<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.4px;background:${c}26;color:${c}">${t}</span>`;
function mpEmblema(color,rom,sz){ sz=sz||56; return `<svg width="${sz}" height="${Math.round(sz*1.13)}" viewBox="0 0 62 70" aria-hidden="true"><path d="M31 2 L58 12 V34 C58 52 46 63 31 68 C16 63 4 52 4 34 V12 Z" fill="${color}"/><circle cx="31" cy="31" r="15" fill="#fff"/><circle cx="21" cy="19" r="6" fill="#1a1a1a"/><circle cx="41" cy="19" r="6" fill="#1a1a1a"/><ellipse cx="25" cy="30" rx="4.5" ry="5.5" fill="#1a1a1a"/><ellipse cx="37" cy="30" rx="4.5" ry="5.5" fill="#1a1a1a"/><circle cx="31" cy="37" r="2.4" fill="#1a1a1a"/>${rom?`<text x="31" y="60" text-anchor="middle" font-size="11" font-weight="900" fill="#111">${rom}</text>`:''}</svg>`; }
function viewMP(){
  let h=`<div class="hdr"><h1>Mi PandarIA</h1><button class="ibtn soft" data-a="mpMenu" aria-label="${tx('Opciones','Options',{pt:'Opções'})}">${I('more',22)}</button></div>`;
  if (!mpAbierta()) return h+mpBloqueada();
  if (mpS().bienvenida) setTimeout(()=>{ if (mpS().bienvenida){ delete mpS().bienvenida; save(); mpBienvenida(); } },400);
  const C=mpCalc(), k=dayKey(), D=C.dias[k], R=mpRango(C.total), T=mpTempAct(), en=!!mpTemp(k);
  const w=C.semanas[C.semanas.length-1], liga=w&&w.media?Math.round((w.pts/w.media-1)*100):null;
  h+=`<div class="card" style="border-color:${R.color}55;background:linear-gradient(160deg,${R.color}22,var(--card) 62%);padding:16px">
    <div class="row" style="gap:14px;align-items:center">${mpEmblema(R.color,MP_ROM[R.nivel],64)}
    <div class="grow" style="min-width:0"><div class="xs b" style="letter-spacing:1.2px;color:${R.color}">${tx(`RANGO ${R.r+1} DE 7`,`RANK ${R.r+1} OF 7`,{pt:`NÍVEL ${R.r+1} DE 7`})}</div><div style="font-size:24px;font-weight:900;line-height:1.1">${R.txt}</div>
    <div class="xs mut" style="margin-top:2px">${R.r===6&&R.nivel===4?tx('Rango máximo','Top rank',{pt:'Nível máximo'}):tx(`${fmtNum(R.falta)} puntos para ${R.sigTxt}`,`${fmtNum(R.falta)} points to ${R.sigTxt}`,{pt:`${fmtNum(R.falta)} pontos para ${R.sigTxt}`})}</div>
    <div style="height:6px;border-radius:3px;background:var(--line);margin-top:8px;overflow:hidden"><div style="height:100%;width:${R.pct}%;background:${R.color}"></div></div></div></div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:12px">${mpChip(mpL(T.n).toUpperCase()+(T.beta?' · BETA':''),'#ff7a1a')}${C.racha?mpChip(`${C.racha} ${tx('días de racha','day streak',{pt:'dias seguidos'})}`,'#ff9a4d'):''}${T.id==='t0'&&C.total>0||T.id==='pre'?mpChip(tx('Pionero','Pioneer',{pt:'Pioneiro'}),'#a77bff'):''}</div>
    <button class="srow" data-a="mpLiga" style="width:100%;margin-top:6px;padding:10px 0 0;border-top:1px solid var(--line)"><span class="si" style="color:#3ecf8e">${I('chart',20)}</span><span class="grow sm" style="text-align:left">${liga==null?tx('Liga: tu primera semana marca tu media','League: your first week sets your average',{pt:'Liga: sua primeira semana define sua média'}):liga>5?tx(`Liga: vas un <b style="color:#3ecf8e">${liga} % por encima</b> de tu media`,`League: you are <b style="color:#3ecf8e">${liga} % above</b> your average`,{pt:`Liga: você está <b style="color:#3ecf8e">${liga} % acima</b> da sua média`}):liga>=-5?tx('Liga: vas en tu media','League: you are at your average',{pt:'Liga: você está na sua média'}):tx('Liga: semana de recuperación por ahora','League: a recovery week so far',{pt:'Liga: semana de recuperação por enquanto'})}</span><span class="mut">${I('right',18)}</span></button></div>`;
  if (T.beta) h+=`<div class="banner" style="margin-top:10px"><span class="ic">${I('info',18)}</span><div class="grow xs">${T.id==='pre'?tx('Pretemporada de prueba: los puntos ya cuentan. La Temporada 0 empieza el 1 de diciembre.','Test preseason: points already count. Season 0 starts on 1 December.',{pt:'Pré-temporada de teste: os pontos já contam. A Temporada 0 começa em 1º de dezembro.'}):tx('Mi PandarIA está en beta: tu opinión nos ayuda a mejorarla.','Mi PandarIA is in beta: your feedback helps us improve it.',{pt:'O Mi PandarIA está em beta: sua opinião nos ajuda a melhorá-lo.'})} <button class="link sm" data-a="contacto">${tx('Opinar','Give feedback',{pt:'Opinar'})}</button></div></div>`;
  // puntos de hoy y misiones
  h+=`<div class="sec row" style="justify-content:space-between"><span>${tx('Puntos de hoy','Points today',{pt:'Pontos de hoje'})}</span><button class="link sm" data-a="mpDia" data-v="${k}">${D.total} / ${MP_PTS.max}</button></div>
    <div style="height:8px;border-radius:4px;background:var(--line);overflow:hidden"><div style="height:100%;width:${Math.min(100,Math.round(D.base/MP_PTS.max*100))}%;background:linear-gradient(90deg,var(--ac),#ff4f3a)"></div></div>`;
  const ex=mpExtrasDe(k), r=typeof rutinaHoyPendiente==='function'?rutinaHoyPendiente():null;
  const mis=[];
  mis.push({ok:D.moverte,ic:'dumbbell',t:tx('Moverte','Move',{pt:'Mexer-se'}),d:D.moverte?(D.plan?tx('Entreno hecho','Workout done',{pt:'Treino feito'}):tx('Hecho','Done',{pt:'Feito'})):D.plan?(r?esc(r.name):tx('Toca tu rutina','Your routine is due',{pt:'Hora da sua rotina'})):tx('Una actividad o un entreno','An activity or a workout',{pt:'Uma atividade ou um treino'}),pts:D.plan?50:30,a:D.plan&&r?`data-a="startWorkout" data-v="${r.id}"`:''});
  if (C.usaAgua||!C.usaComida) mis.push({ok:D.P.agua>0,ic:'drop',t:tx('Agua','Water',{pt:'Água'}),d:`${fmtNum(Math.round(D.agua/100)/10)} / ${fmtNum(Math.round(waterGoal()/100)/10)} L`,pts:10,a:'data-a="tab" data-v="nutricion"'});
  if (C.usaAyuno&&nut().fast.plan) mis.push({ok:D.ayuno,ic:'timer',t:tx('Tu ayuno','Your fast',{pt:'Seu jejum'}),d:D.ayuno?tx('Completado','Completed',{pt:'Concluído'}):tx('Complétalo hoy','Complete it today',{pt:'Conclua hoje'}),pts:10,a:'data-a="tab" data-v="ayuno"'});
  else if (C.usaComida) mis.push({ok:D.P.comida>0,ic:'leaf',t:tx('Comida','Food',{pt:'Comida'}),d:tx(`${Math.min(2,D.comidas)} de 2 comidas`,`${Math.min(2,D.comidas)} of 2 meals`,{pt:`${Math.min(2,D.comidas)} de 2 refeições`}),pts:10,a:'data-a="tab" data-v="nutricion"'});
  else mis.push({ok:D.ck,ic:'heart',t:'Check-in',d:D.ck?tx('Hecho','Done',{pt:'Feito'}):tx('¿Cómo llegas hoy?','How are you today?',{pt:'Como você está hoje?'}),pts:5,a:'data-a="checkinHoy"'});
  mis.push({ok:D.acts.length>0||!!mpS().vis[k],ic:'spark',t:tx('Extra','Extra',{pt:'Extra'}),d:tx('Una actividad o el contenido del día','An activity or the content of the day',{pt:'Uma atividade ou o conteúdo do dia'}),pts:15,a:''});
  h+=`<div class="sec">${tx('Misiones de hoy','Today\'s missions',{pt:'Missões de hoje'})}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">`+mis.slice(0,4).map(m=>`<button class="card" ${m.a} style="text-align:left;margin:0;padding:12px;display:flex;flex-direction:column;gap:6px;border-color:${m.ok?'#3ecf8e':'var(--line)'}"><span class="row" style="justify-content:space-between"><span class="si" style="color:${m.ok?'#3ecf8e':'var(--ac)'}">${I(m.ic,20)}</span>${m.ok?`<span style="color:#3ecf8e">${I('check',20)}</span>`:`<span class="xs b" style="color:var(--ac)">+${m.pts}</span>`}</span><span class="b">${m.t}</span><span class="xs mut" style="line-height:1.35">${m.d}</span></button>`).join('')+`</div>`;
  // actividades
  if (ex.length){
    h+=`<div class="sec row" style="justify-content:space-between"><span>${tx('Actividades de hoy','Today\'s activities',{pt:'Atividades de hoje'})}</span>${premOK()?mpChip(tx('A TU MEDIDA','MADE FOR YOU',{pt:'SOB MEDIDA'}),'#f2b632'):''}</div><div class="card" style="padding:4px 14px">`+
      ex.map((x,i)=>{ const ok=D.acts.includes(x.k); return `<div class="row" style="gap:12px;padding:10px 0;${i?'border-top:1px solid var(--line)':''}"><span class="si" style="color:${ok?'#3ecf8e':'var(--ac)'}">${I(ok?'check':'timer',20)}</span><div class="grow"><div class="b sm">${mpL(x.n)}</div><div class="xs mut">${x.min} min · ${x.exOk.slice(0,3).map(id=>esc(getEx(id).n)).join(', ')} · +15</div></div>${ok&&!premOK()?'':`<button class="btn sm ${ok?'':'pri'}" data-a="mpExtra" data-v="${x.k}">${ok?tx('Repetir','Repeat',{pt:'Repetir'}):tx('Hacer','Do it',{pt:'Fazer'})}</button>`}</div>`; }).join('')+
      (premOK()?'':`<div class="xs mut" style="padding:8px 0;border-top:1px solid var(--line)">${tx('Con Premium, PandarIA te prepara 2 actividades a tu medida cada día.','With Premium, PandarIA prepares 2 activities made for you every day.',{pt:'Com o Premium, o PandarIA prepara 2 atividades sob medida todos os dias.'})}</div>`)+`</div>`;
  }
  h+=mpContenidoHtml(k);
  // semana y racha
  const lun=dayKey(weekKey(mpK(k))), nom=[...Array(7)].map((_,i)=>new Date(2026,10,23+i).toLocaleDateString(LOC(),{weekday:'narrow'}));
  h+=`<div class="sec row" style="justify-content:space-between"><span>${tx('Tu semana','Your week',{pt:'Sua semana'})}</span><span class="xs mut">${tx(`Mejor racha: ${C.mejor} días`,`Best streak: ${C.mejor} days`,{pt:`Melhor sequência: ${C.mejor} dias`})}</span></div><div class="card"><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center">`+
    [...Array(7)].map((_,i)=>{ const d=mpSum(lun,i), x=C.dias[d], com=C.comodines[d], fut=d>k||!x;
      const st=fut?'border:1px dashed var(--line);':x.cumple?'background:var(--ac);':com?'border:2px solid #4da3ff;':'background:var(--line);';
      return `<div class="xs mut" style="display:flex;flex-direction:column;align-items:center;gap:6px;${d===k?'color:var(--tx);font-weight:800':''}">${nom[i]}<span style="width:32px;height:32px;border-radius:50%;box-sizing:border-box;display:grid;place-items:center;color:#4da3ff;${st}">${com?I('heart',14):''}</span></div>`; }).join('')+
    `</div><div class="xs mut" style="margin-top:10px;line-height:1.45">${tx(`Un día cuenta si te mueves y llegas a tu agua. Un día sin cumplir no rompe la racha: tienes 1 comodín ${premOK()?'por semana':'al mes'}.`,`A day counts if you move and reach your water. One missed day does not break your streak: you have 1 wildcard per ${premOK()?'week':'month'}.`,{pt:`Um dia conta se você se mexe e chega à sua água. Um dia sem cumprir não quebra a sequência: você tem 1 coringa por ${premOK()?'semana':'mês'}.`})}</div></div>`;
  // retos
  if (C.retos.length){ const nomT={semana:tx('SEMANA','WEEK',{pt:'SEMANA'}),mes:tx('MES','MONTH',{pt:'MÊS'}),temporada:tx('TEMPORADA','SEASON',{pt:'TEMPORADA'})};
    h+=`<div class="sec">${tx('Retos','Challenges',{pt:'Desafios'})}</div><div style="display:grid;grid-template-columns:repeat(${C.retos.length},1fr);gap:8px">`+C.retos.map(x=>{ const p=Math.round(x.v/x.meta*100), c=2*Math.PI*18;
      return `<div class="card" style="margin:0;padding:12px 10px;display:flex;flex-direction:column;gap:6px;${x.ok?'border-color:#3ecf8e':''}"><svg width="44" height="44" viewBox="0 0 44 44" role="img" aria-label="${x.v}/${x.meta}"><circle cx="22" cy="22" r="18" fill="none" stroke="var(--line)" stroke-width="5"/><circle cx="22" cy="22" r="18" fill="none" stroke="${x.ok?'#3ecf8e':'var(--ac)'}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(c*p/100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 22 22)"/><text x="22" y="26" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor">${x.v}/${x.meta}</text></svg><span class="xs b mut">${nomT[x.tipo]} · +${x.bono}</span><span class="b sm" style="line-height:1.25">${mpL(x.t)}</span></div>`; }).join('')+`</div>`; }
  // resumen de hoy y calendario
  h+=`<div class="sec row" style="justify-content:space-between"><span>${tx('Resumen de hoy','Today\'s summary',{pt:'Resumo de hoje'})}</span><button class="link sm" data-a="mpCal">${tx('Calendario','Calendar',{pt:'Calendário'})} ›</button></div>`+mpResumenHtml(k,true);
  h+=`<div class="card" style="padding:0 12px;margin-top:12px"><button class="srow" style="width:100%" data-a="mpComo"><span class="si">${I('info',20)}</span><span class="grow" style="text-align:left"><div class="b">${tx('Cómo funciona','How it works',{pt:'Como funciona'})}</div><div class="xs mut">${tx('Puntos, rangos, racha, retos y Liga','Points, ranks, streak, challenges and League',{pt:'Pontos, níveis, sequência, desafios e Liga'})}</div></span><span class="mut">${I('right',18)}</span></button></div>`;
  return h;
}
function mpBloqueada(){ const p=mpProgreso(), r=typeof rutinaHoyPendiente==='function'?rutinaHoyPendiente():null, falta=3-p.ent;
  const barra=(n,t,c)=>`<div style="display:grid;grid-template-columns:repeat(${t},1fr);gap:5px">${[...Array(t)].map((_,i)=>`<span style="height:10px;border-radius:5px;background:${i<n?c:'var(--line)'}"></span>`).join('')}</div>`;
  return `<div style="text-align:center;padding:6px 8px 4px"><div style="position:relative;width:110px;height:110px;margin:0 auto">${mpEmblema('#e9ecf0','',96)}<span style="position:absolute;right:0;bottom:0;width:42px;height:42px;border-radius:50%;background:var(--ac);color:#1a0702;display:grid;place-items:center">${I('lock',22)}</span></div>
    <div style="font-size:22px;font-weight:900;margin-top:8px">${tx('Se abre con tu constancia','It opens with your consistency',{pt:'Abre com a sua constância'})}</div><p class="sm mut" style="line-height:1.45;margin:6px 0 0">${tx('Aquí vas a competir contigo mismo: rango, puntos, retos y el calendario de todo lo que haces.','Here you will compete with yourself: rank, points, challenges and a calendar of everything you do.',{pt:'Aqui você vai competir com você mesmo: nível, pontos, desafios e o calendário de tudo o que faz.'})}</p></div>
    <div class="card" style="border-color:var(--ac)"><div class="row" style="justify-content:space-between"><b>${tx('3 entrenos','3 workouts',{pt:'3 treinos'})}</b><b style="color:var(--ac)">${p.ent} / 3</b></div><div style="margin:8px 0">${barra(p.ent,3,'var(--ac)')}</div><div class="xs b" style="color:var(--ac)">${falta===1?tx('Te falta 1 entreno.','You need 1 more workout.',{pt:'Falta 1 treino.'}):tx(`Te faltan ${falta} entrenos.`,`You need ${falta} more workouts.`,{pt:`Faltam ${falta} treinos.`})}${r?' '+tx(`Hoy toca ${esc(r.name)}.`,`Today: ${esc(r.name)}.`,{pt:`Hoje: ${esc(r.name)}.`}):''}</div></div>
    <div class="xs mut b" style="text-align:center;letter-spacing:1px;margin:4px 0">${tx('O LO QUE LLEGUE ANTES','OR WHICHEVER COMES FIRST',{pt:'OU O QUE CHEGAR PRIMEIRO'})}</div>
    <div class="card"><div class="row" style="justify-content:space-between"><b>${tx('7 días con actividad','7 active days',{pt:'7 dias com atividade'})}</b><b>${p.dias} / 7</b></div><div style="margin:8px 0">${barra(p.dias,7,'#4da3ff')}</div><div class="xs mut">${tx('Cuenta cualquier día en que entrenes o registres comida, agua o un ayuno.','Any day you train or log food, water or a fast counts.',{pt:'Conta qualquer dia em que você treine ou registre comida, água ou um jejum.'})}</div></div>
    <button class="btn pri big wide" ${r?`data-a="startWorkout" data-v="${r.id}"`:'data-a="tab" data-v="rutinas"'}>${r?tx(`Entrenar ${esc(r.name)}`,`Train ${esc(r.name)}`,{pt:`Treinar ${esc(r.name)}`}):tx('Ir a mis rutinas','Go to my routines',{pt:'Ir para minhas rotinas'})}</button>
    <p class="xs mut" style="text-align:center;line-height:1.4">${tx('Lo que hagas desde hoy ya cuenta: llegarás con tu historia.','What you do from today already counts: you will arrive with your history.',{pt:'O que você fizer a partir de hoje já conta: você chegará com sua história.'})}</p>`; }
function mpBienvenida(){ openModal(`<div class="sheet"><div class="grab"></div><div style="text-align:center">${mpEmblema('#9aa3ae','I',64)}</div><h3 style="text-align:center">${tx('¡Ya entraste en Mi PandarIA!','You are in Mi PandarIA!',{pt:'Você entrou no Mi PandarIA!'})}</h3>
  <div class="sm" style="line-height:1.5;display:flex;flex-direction:column;gap:8px;margin:4px 4px 12px"><div>${tx('🏆 Compites contra ti: tu semana frente a tu media. Nadie más te ve.','🏆 You compete with yourself: your week against your average. Nobody else sees you.',{pt:'🏆 Você compete com você mesmo: sua semana contra sua média. Ninguém mais vê você.'})}</div><div>${tx('⭐ Sumas puntos al entrenar, beber agua, comer, ayunar y hacer las actividades del día. Los rangos nunca bajan.','⭐ You earn points by training, drinking water, eating, fasting and doing the day\'s activities. Ranks never go down.',{pt:'⭐ Você soma pontos ao treinar, beber água, comer, jejuar e fazer as atividades do dia. Os níveis nunca caem.'})}</div><div>${tx('🙈 Si no te apetece, la ocultas desde el menú ⋯ y vuelve cuando quieras.','🙈 If you do not feel like it, hide it from the ⋯ menu and bring it back whenever you want.',{pt:'🙈 Se não quiser, oculte pelo menu ⋯ e traga de volta quando quiser.'})}</div></div>
  <button class="btn pri big wide" data-a="closeModal">${tx('Empezar','Start',{pt:'Começar'})}</button></div>`); }
function mpCont(k){ const it=MP_CONT.find(x=>x.d===k); if (!it) return null; const menor=+((S.profile||{}).age)>0&&+S.profile.age<18; return menor&&it.alt?Object.assign({},it,it.alt,{alt:null,menor:true}):it; }
const MP_TIPO={cur:['Curiosidad','Did you know?','Curiosidade','book'],cancion:['Canción','Song','Música','spark'],libro:['Libro','Book','Livro','book'],podcast:['Podcast','Podcast','Podcast','spark'],pelicula:['Película','Film','Filme','spark'],serie:['Serie','Series','Série','spark'],documental:['Documental','Documentary','Documentário','spark'],videojuego:['Videojuego','Video game','Videogame','spark']};
function mpContenidoHtml(k){ const it=mpCont(k); if (!it) return ''; const visto=!!mpS().vis[k], tp=MP_TIPO[it.ty]||MP_TIPO.cur;
  return `<div class="sec">${tx('Contenido del día','Content of the day',{pt:'Conteúdo do dia'})}</div><button class="card" data-a="mpCont" data-v="${k}" style="width:100%;text-align:left;background:linear-gradient(150deg,rgba(255,122,26,.14),var(--card) 70%);border-color:${visto?'#3ecf8e':'rgba(255,122,26,.35)'}"><div class="row" style="justify-content:space-between"><span class="xs b" style="letter-spacing:1px;color:var(--ac)">${mpL(tp).toUpperCase()}${it.n&&/18|expl/i.test(it.n[0])?' · +18':''}</span>${visto?`<span style="color:#3ecf8e">${I('check',18)}</span>`:`<span class="xs b" style="color:var(--ac)">+5</span>`}</div><div class="b" style="font-size:17px;line-height:1.3;margin-top:6px">${esc(mpL(it.t))}</div><div class="xs mut" style="margin-top:6px;line-height:1.4">${esc(mpL(it.por))}</div></button>`; }
SCREENS.mpCont=p=>{ const it=mpCont(p.k), tp=MP_TIPO[it.ty]||MP_TIPO.cur;
  let b=`<div class="xs b" style="letter-spacing:1px;color:var(--ac)">${mpL(tp).toUpperCase()}</div><h2 style="margin:6px 0 10px;line-height:1.25">${esc(mpL(it.t))}</h2>`;
  if (it.x) b+=`<p style="line-height:1.6">${esc(mpL(it.x))}</p><p class="xs mut">${tx('Fuente','Source',{pt:'Fonte'})}: ${esc(it.src||'')}</p>`;
  else b+=`<div class="card"><div class="xs mut b">${tx('DÓNDE','WHERE',{pt:'ONDE'})}</div><div class="sm" style="margin-top:4px">${esc(mpL(it.pl))}</div>${it.n&&mpL(it.n)?`<div class="xs mut" style="margin-top:8px">${esc(mpL(it.n))}</div>`:''}</div><p class="xs mut">${tx('PandarIA solo recomienda: no tiene relación con estas marcas ni recibe nada a cambio.','PandarIA only recommends: it has no relationship with these brands and receives nothing in return.',{pt:'O PandarIA só recomenda: não tem relação com essas marcas nem recebe nada em troca.'})}</p>`;
  b+=`<div class="card" style="border-color:rgba(255,122,26,.35)"><div class="xs b" style="color:var(--ac);letter-spacing:1px">${tx('POR QUÉ PANDARIA TE LO RECOMIENDA','WHY PANDARIA RECOMMENDS IT',{pt:'POR QUE O PANDARIA RECOMENDA'})}</div><div class="sm" style="margin-top:6px;line-height:1.5">${esc(mpL(it.por))}</div></div>`;
  if (it.x) b+=`<button class="btn wide" data-a="mpPregunta" data-v="${esc(mpL(it.t))}">${I('spark',18)} ${tx('Pregúntale a PandarIA','Ask PandarIA',{pt:'Pergunte ao PandarIA'})}</button>`;
  return lhdr(tx('Contenido del día','Content of the day',{pt:'Conteúdo do dia'}))+`<div class="lbody">${b}</div>`; };
A.mpCont=k=>{ k=k||dayKey(); if (k===dayKey()&&!mpS().vis[k]){ mpS().vis[k]=1; save(); } openLayer('mpCont',{k}); };
A.mpPregunta=q=>openLayer('consulta',{q});
function mpResumenHtml(k,mensaje){ const C=mpCalc(), x=C.dias[k]; if (!x) return `<div class="card sm mut">${tx('Sin datos ese día.','No data that day.',{pt:'Sem dados nesse dia.'})}</div>`;
  const ss=S.sessions.filter(s=>dayKey(s.end||s.start)===k), min=Math.round(ss.reduce((a,s)=>a+((s.end||0)-(s.start||0)),0)/60000), prs=ss.reduce((a,s)=>a+((s.prs||[]).length),0);
  const D=(nut().diario||{})[k]||[], kc=Math.round(D.reduce((a,f)=>a+(f.kcal||0),0)), pr=Math.round(D.reduce((a,f)=>a+(f.p||f.prot||0),0));
  const filas=[]; if (ss.length) filas.push(['#ff7a1a',tx('Entreno','Workout',{pt:'Treino'}),`${min} min${prs?' · '+tx(`${prs} récord${prs>1?'s':''}`,`${prs} PR${prs>1?'s':''}`,{pt:`${prs} recorde${prs>1?'s':''}`}):''}`]);
  if (x.agua) filas.push(['#4da3ff',tx('Agua','Water',{pt:'Água'}),`${fmtNum(Math.round(x.agua/100)/10)} L`]);
  if (x.ayuno) filas.push(['#a77bff',tx('Ayuno','Fast',{pt:'Jejum'}),tx('Completado','Completed',{pt:'Concluído'})]);
  if (D.length) filas.push(['#3ecf8e',tx('Comida','Food',{pt:'Comida'}),`${fmtNum(kc)} kcal${pr?` · ${pr} g ${tx('de proteína','protein',{pt:'de proteína'})}`:''}`]);
  if (x.ck) filas.push(['#f2b632','Check-in',tx('Hecho','Done',{pt:'Feito'})]);
  let h=filas.length?`<div class="card" style="padding:2px 14px">`+filas.map((f,i)=>`<div class="row" style="gap:10px;padding:10px 0;${i?'border-top:1px solid var(--line)':''}"><span style="width:10px;height:10px;border-radius:50%;background:${f[0]}"></span><span class="grow">${f[1]}</span><span class="sm mut">${f[2]}</span></div>`).join('')+`</div>`:`<div class="card sm mut">${tx('Todavía nada hoy. Cualquier paso cuenta.','Nothing yet today. Every step counts.',{pt:'Nada ainda hoje. Cada passo conta.'})}</div>`;
  if (mensaje&&filas.length){ const msg=x.cumple?tx('Día cumplido: así se construye un hábito.','Day done: this is how a habit is built.',{pt:'Dia cumprido: é assim que se constrói um hábito.'}):!x.moverte?tx('Te falta moverte: una actividad de 6 minutos ya cuenta.','You still need to move: a 6-minute activity already counts.',{pt:'Falta se mexer: uma atividade de 6 minutos já conta.'}):tx('Te falta el agua para cumplir el día.','You still need your water to complete the day.',{pt:'Falta a água para cumprir o dia.'});
    h+=`<div class="row" style="gap:10px;align-items:flex-start;padding:12px;border-radius:14px;background:rgba(255,122,26,.10);margin-top:10px"><span style="flex:0 0 auto">${mpEmblema('#ff7a1a','',22)}</span><span class="sm" style="line-height:1.45">${msg}</span></div>`; }
  return h; }
SCREENS.mpDia=p=>{ const C=mpCalc(), x=C.dias[p.k], P=x&&x.P;
  const L=P?[[tx('Entreno','Workout',{pt:'Treino'}),P.entreno+P.plan],[tx('Actividad de descanso','Rest-day activity',{pt:'Atividade de descanso'}),P.descanso],[tx('Actividades del día','Day\'s activities',{pt:'Atividades do dia'}),P.extra],[tx('Agua','Water',{pt:'Água'}),P.agua],[tx('Comidas','Meals',{pt:'Refeições'}),P.comida],[tx('Ayuno','Fast',{pt:'Jejum'}),P.ayuno],['Check-in',P.checkin],[tx('Contenido','Content',{pt:'Conteúdo'}),P.contenido],[tx('Bonos de retos y Liga','Challenge and League bonuses',{pt:'Bônus de desafios e Liga'}),x.bono]]:[];
  const b=P?`<div class="card" style="text-align:center"><div style="font-size:34px;font-weight:900">${x.total}</div><div class="xs mut">${tx('puntos','points',{pt:'pontos'})}${C.comodines[p.k]?' · '+tx('comodín usado','wildcard used',{pt:'coringa usado'}):x.cumple?' · '+tx('día cumplido','day done',{pt:'dia cumprido'}):''}</div></div><div class="card" style="padding:2px 14px">${L.map(([t,v],i)=>`<div class="row" style="padding:10px 0;${i?'border-top:1px solid var(--line)':''}"><span class="grow sm">${t}</span><b style="color:${v?'var(--tx)':'var(--mut)'}">${v?'+'+v:'—'}</b></div>`).join('')}</div>`+mpResumenHtml(p.k):`<div class="card sm mut">${tx('Ese día todavía no llegó.','That day has not come yet.',{pt:'Esse dia ainda não chegou.'})}</div>`;
  return lhdr(new Date(mpK(p.k)).toLocaleDateString(LOC(),{weekday:'long',day:'numeric',month:'long'}))+`<div class="lbody">${b}</div>`; };
A.mpDia=k=>openLayer('mpDia',{k});
SCREENS.mpCal=p=>{ const C=mpCalc(), hoy=dayKey(), mes=p.m||hoy.slice(0,7), [y,m]=mes.split('-').map(Number), d1=new Date(y,m-1,1,12), nd=new Date(y,m,0).getDate(), pad=(d1.getDay()+6)%7;
  const prev=dayKey(new Date(y,m-2,1,12).getTime()).slice(0,7), next=dayKey(new Date(y,m,1,12).getTime()).slice(0,7);
  const nom=[...Array(7)].map((_,i)=>new Date(2026,10,23+i).toLocaleDateString(LOC(),{weekday:'narrow'})), med=new Set(S.measures.map(x=>dayKey(x.date)));
  let g=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center">`+nom.map(n=>`<div class="xs mut b">${n}</div>`).join('')+'<div></div>'.repeat(pad);
  for (let i=1;i<=nd;i++){ const k=`${mes}-${String(i).padStart(2,'0')}`, x=C.dias[k], fut=k>hoy||k<MP_INI;
    const dots=x?[[x.norm||x.acts.length,'#ff7a1a'],[x.P.agua,'#4da3ff'],[x.comidas,'#3ecf8e'],[x.ayuno,'#a77bff'],[med.has(k),'#f2b632']].filter(z=>z[0]).map(z=>`<i style="width:5px;height:5px;border-radius:50%;background:${z[1]}"></i>`).join(''):'';
    g+=`<button ${fut?'disabled':`data-a="mpDia" data-v="${k}"`} style="height:46px;border-radius:10px;border:${k===hoy?'2px solid var(--ac)':'1px solid var(--line)'};background:${fut?'transparent':'var(--card)'};color:inherit;opacity:${fut?.45:1};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:12px;padding:0">${i}<span style="display:flex;gap:2px;min-height:5px">${C.comodines[k]?`<span style="color:#4da3ff">${I('heart',10)}</span>`:dots}</span></button>`; }
  g+=`</div>`;
  const ley=[['#ff7a1a',tx('Entreno','Workout',{pt:'Treino'})],['#4da3ff',tx('Agua','Water',{pt:'Água'})],['#3ecf8e',tx('Comida','Food',{pt:'Comida'})],['#a77bff',tx('Ayuno','Fast',{pt:'Jejum'})],['#f2b632',tx('Cuerpo','Body',{pt:'Corpo'})]].map(z=>`<span class="row xs" style="gap:5px"><i style="width:8px;height:8px;border-radius:50%;background:${z[0]}"></i>${z[1]}</span>`).join('');
  const T=MP_TEMP.find(t=>t.id==='t0');
  const b=`<div class="row" style="justify-content:space-between;margin-bottom:10px"><button class="ibtn soft" data-a="mpCalMes" data-v="${prev}" ${prev<MP_INI.slice(0,7)?'disabled':''} aria-label="${tx('Mes anterior','Previous month',{pt:'Mês anterior'})}">${I('back',20)}</button><b>${d1.toLocaleDateString(LOC(),{month:'long',year:'numeric'})}</b><button class="ibtn soft" data-a="mpCalMes" data-v="${next}" ${next>hoy.slice(0,7)?'disabled':''} aria-label="${tx('Mes siguiente','Next month',{pt:'Próximo mês'})}">${I('right',20)}</button></div><div class="card">${g}<div class="row" style="gap:12px;flex-wrap:wrap;margin-top:10px">${ley}</div></div>
    <div class="sec">${mpL(T.n)} · BETA</div><div class="card sm" style="line-height:1.5">${tx('Del 1 de diciembre al 31 de enero. Quien la juegue se lleva la insignia de Pionero, y todo lo que ganes pasa a la Temporada 1.','From 1 December to 31 January. Everyone who plays it gets the Pioneer badge, and everything you earn carries over to Season 1.',{pt:'De 1º de dezembro a 31 de janeiro. Quem jogar leva a insígnia de Pioneiro, e tudo o que você ganhar passa para a Temporada 1.'})}</div>`;
  return lhdr(tx('Tu calendario','Your calendar',{pt:'Seu calendário'}))+`<div class="lbody">${b}</div>`; };
A.mpCal=()=>openLayer('mpCal',{});
A.mpCalMes=m=>{ const L=LAYERS[LAYERS.length-1]; if (L&&L.t==='mpCal'){ L.p.m=m; refreshTop(); } };
SCREENS.mpLiga=()=>{ const C=mpCalc(), W=C.semanas.slice(-5), w=W[W.length-1], max=Math.max(1,...W.map(x=>x.pts),w&&w.media||0), R=mpRango(C.total);
  let b=`<p class="sm mut" style="margin-top:0;line-height:1.45">${tx('Compites contra ti: tus puntos de esta semana frente a tu media de las 4 anteriores.','You compete with yourself: your points this week against your average of the previous 4.',{pt:'Você compete com você mesmo: seus pontos desta semana contra sua média das 4 anteriores.'})}</p>`;
  b+=`<div class="card"><div class="xs b mut" style="letter-spacing:1px">${tx('ESTA SEMANA','THIS WEEK',{pt:'ESTA SEMANA'})}</div><div style="font-size:32px;font-weight:900">${w?w.pts:0} <span class="sm mut">pts</span></div><div class="xs mut">${w&&w.media!=null?tx(`Tu media: ${w.media} pts`,`Your average: ${w.media} pts`,{pt:`Sua média: ${w.media} pts`}):tx('Tu primera semana marca tu media','Your first week sets your average',{pt:'Sua primeira semana define sua média'})}</div>
    <div style="display:grid;grid-template-columns:repeat(${W.length},1fr);gap:10px;align-items:end;height:130px;margin-top:12px;border-bottom:1px solid var(--line)">${W.map((x,i)=>`<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span class="xs ${i===W.length-1?'b':'mut'}">${x.pts}</span><span style="width:100%;height:${Math.max(4,Math.round(x.pts/max*100))}px;border-radius:8px 8px 0 0;background:${i===W.length-1?'var(--ac)':'var(--line)'}"></span></div>`).join('')}</div>
    <div class="sm" style="margin-top:12px;line-height:1.5;display:flex;flex-direction:column;gap:6px"><div><b style="color:#3ecf8e">${tx('Por encima de tu media','Above your average',{pt:'Acima da sua média'})}</b>: ${tx('+40 puntos el lunes.','+40 points on Monday.',{pt:'+40 pontos na segunda.'})}</div><div><b style="color:#4da3ff">${tx('En tu media','At your average',{pt:'Na sua média'})}</b>: ${tx('+20.','+20.',{pt:'+20.'})}</div><div><b style="color:#a77bff">${tx('Semana de recuperación','Recovery week',{pt:'Semana de recuperação'})}</b>: ${tx('nunca «has perdido»: descansar también es entrenar.','never "you lost": resting is training too.',{pt:'nunca «você perdeu»: descansar também é treinar.'})}</div></div></div>`;
  b+=`<div class="sec row" style="justify-content:space-between"><span>${tx('Rangos · 5 niveles cada uno','Ranks · 5 levels each',{pt:'Níveis · 5 graus cada um'})}</span><span class="xs b" style="color:#3ecf8e">${tx('Nunca se baja','You never drop',{pt:'Nunca se cai'})}</span></div><div class="card" style="padding:2px 14px">`+MP_RANGOS.map((x,i)=>`<div class="row" style="gap:12px;padding:8px 0;${i?'border-top:1px solid var(--line)':''};${i===R.r?'':'opacity:'+(i<R.r?.9:.6)}">${mpEmblema(x[4],i===R.r?MP_ROM[R.nivel]:'',30)}<span class="grow ${i===R.r?'b':''}">${mpL(x)}${i===R.r?' · '+tx('tú','you',{pt:'você'}):''}</span><span class="xs mut">${i<R.r?tx('Superado','Done',{pt:'Superado'}):i===R.r?fmtNum(C.total)+' pts':tx(`desde ${fmtNum(x[3])}`,`from ${fmtNum(x[3])}`,{pt:`a partir de ${fmtNum(x[3])}`})}</span></div>`).join('')+`</div>`;
  return lhdr(tx('Liga PandarIA','PandarIA League',{pt:'Liga PandarIA'}))+`<div class="lbody">${b}</div>`; };
A.mpLiga=()=>openLayer('mpLiga',{});
SCREENS.mpComo=()=>{ const filas=[[tx('Entreno de 10 minutos o más','Workout of 10 minutes or more',{pt:'Treino de 10 minutos ou mais'}),'40'],[tx('…si es un día de tu plan','…on a plan day',{pt:'…se for um dia do seu plano'}),'+10'],[tx('Actividad en día de descanso','Activity on a rest day',{pt:'Atividade em dia de descanso'}),'30'],[tx('Actividades del día (hasta 2)','Day\'s activities (up to 2)',{pt:'Atividades do dia (até 2)'}),'15'],[tx('Meta de agua','Water goal',{pt:'Meta de água'}),'10'],[tx('2 comidas registradas','2 meals logged',{pt:'2 refeições registradas'}),'10'],[tx('Ayuno completado','Fast completed',{pt:'Jejum concluído'}),'10'],['Check-in','5'],[tx('Contenido del día','Content of the day',{pt:'Conteúdo do dia'}),'5']];
  const b=`<div class="card" style="padding:2px 14px">${filas.map(([t,p],i)=>`<div class="row" style="padding:10px 0;${i?'border-top:1px solid var(--line)':''}"><span class="grow sm">${t}</span><b>${p}</b></div>`).join('')}</div>
    <p class="sm" style="line-height:1.55">${tx('Máximo 150 puntos al día. Los retos dan un bono el día que los completas (semana +20, mes +30, temporada +50) y la Liga, el lunes (+40 por encima de tu media, +20 en tu media).','Up to 150 points a day. Challenges give a bonus on the day you complete them (week +20, month +30, season +50) and the League on Monday (+40 above your average, +20 at your average).',{pt:'Máximo de 150 pontos por dia. Os desafios dão um bônus no dia em que você os completa (semana +20, mês +30, temporada +50) e a Liga, na segunda (+40 acima da sua média, +20 na sua média).'})}</p>
    <p class="sm" style="line-height:1.55">${tx('Contra trampas: el entreno cuenta desde 10 minutos, las actividades solo si completas el 80 % del temporizador, y un segundo entreno el mismo día no suma otra vez.','Against cheating: workouts count from 10 minutes, activities only if you complete 80 % of the timer, and a second workout on the same day does not add again.',{pt:'Contra trapaças: o treino conta a partir de 10 minutos, as atividades só se você completar 80 % do cronômetro, e um segundo treino no mesmo dia não soma de novo.'})}</p>
    <p class="sm" style="line-height:1.55">${tx('Hay 7 rangos (Cachorro, Explorador, Constante, Fuerte, Atleta, Maestro y Leyenda) de 5 niveles cada uno. Se sube con tus puntos y nunca se baja.','There are 7 ranks (Cub, Explorer, Steady, Strong, Athlete, Master and Legend) with 5 levels each. You climb with your points and never drop.',{pt:'Há 7 níveis (Filhote, Explorador, Constante, Forte, Atleta, Mestre e Lenda) com 5 graus cada um. Você sobe com seus pontos e nunca cai.'})}</p>
    <p class="sm mut" style="line-height:1.55">${tx('Todo se calcula en tu teléfono con tu historial: no hay servidor ni ranking con otras personas.','Everything is calculated on your phone from your history: there is no server and no ranking against other people.',{pt:'Tudo é calculado no seu telefone com o seu histórico: não há servidor nem ranking com outras pessoas.'})}</p>`;
  return lhdr(tx('Cómo funciona','How it works',{pt:'Como funciona'}))+`<div class="lbody">${b}</div>`; };
A.mpComo=()=>openLayer('mpComo',{});
A.mpMenu=()=>openModal(`<div class="sheet"><div class="grab"></div><h3>Mi PandarIA</h3><button class="srow" style="width:100%" data-a="cbm" data-v="${cb(()=>{ closeModal(); A.mpComo(); })}"><span class="si">${I('info',20)}</span><span class="grow" style="text-align:left">${tx('Cómo funciona','How it works',{pt:'Como funciona'})}</span></button><button class="srow" style="width:100%" data-a="contacto"><span class="si">${I('note',20)}</span><span class="grow" style="text-align:left">${tx('Opinar sobre la beta','Give feedback on the beta',{pt:'Opinar sobre a beta'})}</span></button><button class="srow" style="width:100%" data-a="cbm" data-v="${cb(()=>{ closeModal(); A.mpOcultar(); })}"><span class="si">${I('eyeoff',20)}</span><span class="grow" style="text-align:left"><div>${tx('Ocultar la pestaña','Hide the tab',{pt:'Ocultar a aba'})}</div><div class="xs mut">${tx('Vuelve desde Ajustes › Pantalla','Bring it back from Settings › Display',{pt:'Volte em Ajustes › Tela'})}</div></span></button></div>`);
A.mpOcultar=()=>confirmBox({title:tx('¿Ocultar Mi PandarIA?','Hide Mi PandarIA?',{pt:'Ocultar o Mi PandarIA?'}),text:tx('No se pierde nada: tus puntos siguen contando y la recuperas desde Ajustes › Pantalla.','Nothing is lost: your points keep counting and you can bring it back from Settings › Display.',{pt:'Nada se perde: seus pontos continuam contando e você a recupera em Ajustes › Tela.'}),okText:tx('Ocultar','Hide',{pt:'Ocultar'}),ok:()=>{ S.settings.mpOff=true; save(); TAB='rutinas'; render(); }});
A.mpMostrar=()=>{ S.settings.mpOff=!S.settings.mpOff; save(); render(); toast(S.settings.mpOff?tx('Mi PandarIA oculta','Mi PandarIA hidden',{pt:'Mi PandarIA oculto'}):tx('Mi PandarIA vuelve a la barra','Mi PandarIA is back in the bar',{pt:'O Mi PandarIA voltou à barra'})); };
