// Pruebas de Mi PandarIA (solo rama lab-mi-pandaria) con un servidor Supabase simulado que imita las funciones SQL.
import fs from 'node:fs';
import { abrirApp } from './sim/app.mjs';

let ok = 0, mal = 0;
const comprobar = (n, c, d) => { if (c) { ok++; console.log('✓ ' + n); } else { mal++; console.log('✗ ' + n + (d ? ' → ' + d : '')); } };
const T0 = Date.UTC(2026, 10, 24, 15); // martes 24 nov 2026, 12:00 en Uruguay
const a = await abrirApp({ t0: T0 });
const w = a.w, ev = c => w.eval(c);
const tic = async (n = 6) => { for (let i = 0; i < n; i++) { await new Promise(r => setImmediate(r)); a.avanzar(50); } };
const jwt = (sub, email) => 'h.' + Buffer.from(JSON.stringify({ sub, email })).toString('base64').replace(/=+$/, '') + '.f';

// ---------- servidor simulado (imita mp_entrar, mp_sync, amigos, trofeos y salir) ----------
const SV = { players: {}, entries: {}, friends: new Set(), llamadas: [], ultimo: {} };
const season = { id: 'prueba', name: 'Temporada de prueba', starts: '2026-11-22', ends: '2026-11-30' };
const hoyS = () => { const d = new Date(w.__T - 3 * 3600e3); return d.toISOString().slice(0, 10); };
const idx = k => Math.round((Date.parse(k) - Date.parse(season.starts)) / 864e5);
const nivel = e => Math.min(34, e.start_level + Math.floor(e.points / 22));
let n = 0;
w.fetch = async (url, opt = {}) => {
  const u = new URL(url), h = opt.headers || {}, body = opt.body ? JSON.parse(opt.body) : {};
  const yo = (h.Authorization || '').replace('Bearer at:', '') || null;
  const fn = u.pathname.replace('/rest/v1/rpc/', '');
  SV.llamadas.push(fn);
  const res = (st, j) => ({ ok: st < 300, status: st, text: async () => JSON.stringify(j) });
  if (h.apikey !== 'sb_publishable_sL20nOJlssLKJzzkOzTeDw_rTZFyspt') return res(401, { message: 'sin apikey' });
  if (u.pathname === '/auth/v1/token') {
    if (u.searchParams.get('grant_type') === 'id_token') { const c = JSON.parse(Buffer.from(body.id_token.split('.')[1], 'base64').toString()); const id = 'u-' + c.sub; return res(200, { access_token: 'at:' + id, refresh_token: 'rt:' + id, expires_in: 3600, user: { id, email: c.email } }); }
    return res(200, { access_token: 'at:' + body.refresh_token.slice(3), refresh_token: body.refresh_token, expires_in: 3600 });
  }
  if (!yo) return res(401, { message: 'permission denied' });
  if (fn === 'mp_entrar') { let p = SV.players[yo]; if (!p) p = SV.players[yo] = { user_id: yo, mote: 'Panda-T' + (++n), display_name: body.p_nombre || '', friend_code: ('COD00' + n).slice(-6) }; else if (body.p_nombre != null) p.display_name = body.p_nombre; return res(200, p); }
  if (fn === 'mp_sync') {
    if (!SV.players[yo]) return res(400, { message: 'sin jugador' });
    const e = SV.entries[yo] = SV.entries[yo] || { start_level: 0, points: 0, dias: Array(9).fill(0), retos: {}, division: 0 };
    if (body.p_dias.length) {
      if (SV.ultimo[yo] && w.__T - SV.ultimo[yo] < 60000) return res(400, { message: 'demasiado pronto' });
      for (const x of body.p_dias) { const i = idx(x.d), hi = idx(hoyS()); if (i >= 0 && i <= hi && i >= hi - 3) e.dias[i] = Math.min(150, Math.max(0, x.p)); }
      e.points = e.dias.reduce((a, b) => a + b, 0); Object.assign(e.retos, body.p_retos || {}); SV.ultimo[yo] = w.__T;
    }
    const filas = Object.entries(SV.entries).map(([id, x]) => [SV.players[id].mote, nivel(x), x.points]).sort((a, b) => b[1] - a[1] || b[2] - a[2]);
    const amigos = Object.keys(SV.players).filter(id => SV.friends.has(yo + '>' + id)).map(id => ({ id, mote: SV.players[id].mote, nombre: SV.players[id].display_name, nivel: SV.entries[id] ? nivel(SV.entries[id]) : null, puntos: (SV.entries[id] || {}).points || 0, hoy: SV.entries[id] ? SV.entries[id].dias[idx(hoyS())] : 0, sem: (SV.entries[id] || { points: 0 }).points }));
    const pos = filas.findIndex(f => f[0] === SV.players[yo].mote) + 1;
    return res(200, { temporada: season, yo: Object.assign({}, e, { nivel: nivel(e), pos, pos_div: pos }), division: { filas, jugadores: filas.length, t: new Date(w.__T).toISOString() }, top: { filas: filas.slice(0, 10), jugadores: filas.length, t: new Date(w.__T).toISOString() }, amigos, jugador: SV.players[yo] });
  }
  if (fn === 'mp_amigo_anadir') { const o = Object.values(SV.players).find(p => p.friend_code === body.p_codigo); if (!o) return res(400, { message: 'código no encontrado' }); if (o.user_id === yo) return res(400, { message: 'es tu propio código' }); SV.friends.add(yo + '>' + o.user_id); SV.friends.add(o.user_id + '>' + yo); return res(200, [{ user_id: o.user_id, mote: o.mote, display_name: o.display_name }]); }
  if (fn === 'mp_amigo_quitar') { SV.friends.delete(yo + '>' + body.p_user); SV.friends.delete(body.p_user + '>' + yo); return res(200, null); }
  if (fn === 'mp_trofeos') return res(200, []);
  if (fn === 'mp_salir') { delete SV.players[yo]; delete SV.entries[yo]; return res(200, null); }
  return res(404, { message: 'no existe ' + u.pathname });
};

// ---------- la app con Mi PandarIA, cargada como en la APK ----------
ev(`S.settings.onboarded=true; S.profile=Object.assign(S.profile||{},{name:'Eddy',weight:80,height:178,age:29,sex:'h'}); save(true);`);
const antes = ev(`JSON.stringify(Object.keys(S).sort())`);
ev(`viewAjustes=AJ_BASE; AJ_BASE=null; Object.defineProperty(document,'readyState',{get:()=>'loading',configurable:true})`);
ev(fs.readFileSync(new URL('../lab/mipandaria.js', import.meta.url), 'utf8'));
ev(`delete document.readyState; document.dispatchEvent(new Event('DOMContentLoaded'))`);
await tic(); ev(`while(LAYERS.length) LAYERS.pop(); MODALS.length=0; document.querySelector('#layers').innerHTML=''; render()`);
const vista = () => ev(`document.querySelector('#view').textContent.replace(/\\s+/g,' ')`);
comprobar('la pestaña Mi PandarIA aparece entre Nutrición y Historial', ev(`[...document.querySelectorAll('#nav button')].map(b=>b.dataset.v).join(',')`) === 'rutinas,nutricion,mipandaria,historial,ajustes');
ev(`A.tab('mipandaria')`); await tic();
comprobar('Mi PandarIA tiene su propia pantalla (no sale dentro de Ajustes)', !/Entrenamiento|Acerca de/.test(vista()) && /<h1>Mi PandarIA<\/h1>/.test(ev(`document.querySelector('#view').innerHTML`)));

// A · sin cuenta de Google en la app no se puede entrar
comprobar('sin cuenta de Google en la app: pide vincularla y no deja entrar', /Vincular mi cuenta de Google/.test(vista()) && !ev(`!!document.querySelector('[data-a="mpEntrar"]')`), vista().slice(0, 200));
ev(`window.MP_TEST_ID_TOKEN=()=>window.__idt`);
ev(`MP.entrar().catch(e=>window.__err=e.message)`); await tic();
comprobar('entrar sin cuenta vinculada da error y no crea nada', /vincula/i.test(ev('window.__err||""')) && !Object.keys(SV.players).length);

// con la cuenta de la app
ev(`S.settings.cloud={sub:'111',email:'eddy@gmail.com',name:'Eddy',given:'Eddy'}; save(true); render()`); await tic();
comprobar('con cuenta en la app: «Entrar con eddy@gmail.com» y «Ahora no»', /Entrar con eddy@gmail\.com/.test(vista()) && /Ahora no/.test(vista()), vista().slice(0, 300));
ev(`A.mpAhoraNo()`); comprobar('«Ahora no» vuelve a la pestaña anterior', ev('TAB') !== 'mipandaria', ev('TAB'));
ev(`A.tab('mipandaria')`);
ev(`window.__idt='${jwt('999', 'otra@gmail.com')}'; window.__err=''; MP.entrar().catch(e=>window.__err=e.message)`); await tic();
comprobar('otra cuenta de Google distinta a la de la app: rechazada', /misma cuenta/.test(ev('window.__err')) && !Object.keys(SV.players).length, ev('window.__err'));
ev(`window.__idt='${jwt('111', 'eddy@gmail.com')}'`);
ev(`A.mpEntrar()`); await tic(14);
comprobar('entra con la cuenta de la app: jugador con mote y la sesión aparte de los datos', !!SV.players['u-111'] && /Panda-/.test(vista()) && !!w.localStorage.getItem('pandaria-mp-v1'), vista().slice(0, 200));
{ const ahora = JSON.parse(ev(`JSON.stringify(Object.keys(S).sort())`)), nuevas = ahora.filter(k => !JSON.parse(antes).includes(k)); comprobar('los datos de la app no ganan claves de Mi PandarIA', !nuevas.some(k => /mp|pandaria/i.test(k)), nuevas.join(',')); }

// B · pocas solicitudes
const n0 = SV.llamadas.length;
ev(`S.plan={days:[new Date().getDay()],order:[]}; S.sessions.push({id:'s1',routineId:'r1',routineName:'Pecho',start:Date.now()-3600000,end:Date.now()-60000,intensity:7,items:[],prs:[],vol:1000}); save(true);`);
ev(`A.mpContenido()`); ev(`const n_=nut(); n_.waterLog=n_.waterLog||{}; n_.waterLog[dayKey()]=[{ml:5000,t:Date.now()}]; nd().diario[dayKey()]=[{id:'a',m:'desayuno'},{id:'b',m:'almuerzo'}]; save(true);`);
for (let i = 0; i < 5; i++) { ev(`save(true)`); await tic(); a.avanzar(3000); await tic(); }
comprobar('guardar muchas veces seguidas no manda nada antes de 30 minutos', SV.llamadas.length === n0, SV.llamadas.slice(n0).join(','));
let P = JSON.parse(ev(`JSON.stringify(MP.puntosDia(dayKey()))`));
comprobar('puntos de hoy: entreno 40 + plan 10 + contenido 5 + comidas 10 + agua 10 (en el teléfono)', P.entreno === 40 && P.plan === 10 && P.contenido === 5 && P.comida === 10 && P.agua === 10, JSON.stringify(P));
a.avanzar(61000);
Object.defineProperty(w.document, 'hidden', { get: () => true, configurable: true }); ev(`document.dispatchEvent(new Event('visibilitychange'))`); await tic(10);
const e1 = SV.entries['u-111'];
comprobar('al salir de la app se envía lo pendiente en UNA solicitud', SV.llamadas.slice(n0).filter(x => x === 'mp_sync').length === 1 && e1.dias[idx('2026-11-24')] === P.total, SV.llamadas.slice(n0).join(',') + ' ' + JSON.stringify(e1 && e1.dias));
delete w.document.hidden;
a.avanzar(31 * 60000); ev(`save(true)`); await tic(); a.avanzar(3000); await tic(10);
comprobar('sin cambios no se envía nada aunque pasen 30 minutos', SV.llamadas.slice(n0).filter(x => x === 'mp_sync').length === 1);

// actividad extra
const kx = ev(`MP.extrasDe(dayKey())[0].k`);
ev(`A.mpExtra('${kx}')`);
comprobar('la actividad extra abre el temporizador de intervalos', ev(`LAYERS[LAYERS.length-1].t`) === 'intRun');
ev(`saveIntSession({id:'x0',routineId:'__int',routineName:'Intervalos',start:Date.now()-30000,end:Date.now(),intensity:6,items:[],prs:[],vol:0,int:{fmt:'hiit',work:20}})`); await tic();
P = JSON.parse(ev(`JSON.stringify(MP.puntosDia(dayKey()))`));
comprobar('una actividad extra cortada antes de tiempo no suma', P.extra === 0, JSON.stringify(P));
ev(`while(LAYERS.length) LAYERS.pop(); A.mpExtra('${kx}')`);
ev(`saveIntSession({id:'x1',routineId:'__int',routineName:'Intervalos',start:Date.now()-400000,end:Date.now(),intensity:6,items:[],prs:[],vol:0,int:{fmt:'hiit',work:3000}})`); await tic();
P = JSON.parse(ev(`JSON.stringify(MP.puntosDia(dayKey()))`));
comprobar('terminada: suma 15, va al historial como «Mi PandarIA · …» y no cuenta como entreno', P.extra === 15 && P.entreno === 40 && /^Mi PandarIA · /.test(ev(`S.sessions.find(s=>s.id==='x1').routineName`)), JSON.stringify(P));
ev(`S.sessions.push({id:'s9',routineId:'r1',routineName:'Corto',start:Date.now()-120000,end:Date.now(),intensity:7,items:[],prs:[],vol:10}); save(true);`);
comprobar('un entreno de menos de 10 minutos no suma', JSON.parse(ev(`JSON.stringify(MP.puntosDia(dayKey()))`)).entreno === 40);
ev(`while(LAYERS.length) LAYERS.pop(); window.isPremium=()=>false; render()`);
comprobar('gratis: la actividad hecha no se puede repetir', !ev(`!!document.querySelector('[data-a="mpExtra"][data-v="${kx}"]')`));
ev(`window.isPremium=()=>true; render()`);
comprobar('Premium: se puede repetir', ev(`!!document.querySelector('[data-a="mpExtra"][data-v="${kx}"]')`));
const R = JSON.parse(ev(`JSON.stringify(MP.retos())`));
comprobar('6 retos: 2 de semana, 2 de mes y 2 de temporada', R.length === 6 && ['semana', 'mes', 'temporada'].every(t => R.filter(r => r.tipo === t).length === 2));

// liga y amigos: abrir la liga dentro de 15 minutos no pide nada
ev(`MP.estado().cache.t=Date.now(); MP.estado().cuentas[MP.estado().activa].ultEnvio=Date.now()`);
const n1 = SV.llamadas.length;
ev(`A.mpLiga()`); await tic(8);
const tL = ev(`document.querySelector('#layers').lastElementChild.textContent.replace(/\\s+/g,' ')`);
comprobar('la liga sale de la respuesta guardada: tu división y el top 10 global', /Tu división/.test(tL) && /Top 10 global/.test(tL) && /tú/.test(tL), tL.slice(0, 300));
ev(`closeLayer(); A.mpAmigos()`); await tic(8); ev(`closeLayer(); A.tab('rutinas'); A.tab('mipandaria')`); await tic(8);
comprobar('abrir liga, amigos y la pestaña en menos de 15 min no hace solicitudes', SV.llamadas.length === n1, SV.llamadas.slice(n1).join(','));

// segunda cuenta: se cambia la cuenta de Google de la app
ev(`S.settings.cloud={sub:'222',email:'segunda@gmail.com',name:'Segunda'}; save(true); window.pfAccountChanged&&window.pfAccountChanged(); render()`); await tic();
comprobar('al cambiar la cuenta de la app, Mi PandarIA se cierra aquí y ofrece entrar con la nueva', /Entrar con segunda@gmail\.com/.test(vista()) && !ev(`MP.estado().activa`), vista().slice(0, 200));
comprobar('los puntos de la primera cuenta siguen en el servidor', SV.entries['u-111'] && SV.entries['u-111'].points > 0);
ev(`window.__idt='${jwt('222', 'segunda@gmail.com')}'; A.mpEntrar()`); await tic(14);
P = JSON.parse(ev(`JSON.stringify(MP.puntosDia(dayKey()))`));
comprobar('los entrenos guardados con la otra cuenta no cuentan para esta', P.entreno === 0 && P.extra === 0, JSON.stringify(P));
const cod1 = SV.players['u-111'].friend_code;
ev(`A.mpAmigos()`); await tic(4); a.avanzar(61000);
ev(`document.getElementById('mpCod').value='${cod1}'; A.mpAnadir()`); await tic(14);
const tA = ev(`document.querySelector('#layers').lastElementChild.textContent.replace(/\\s+/g,' ')`);
comprobar('añadir amigo con su código: sale su nombre y sus puntos', SV.friends.has('u-222>u-111') && /Eddy/.test(tA), tA.slice(0, 300));
ev(`closeLayer()`);

// otro teléfono: los retos ya premiados no se vuelven a premiar y los días viejos vienen del servidor
ev(`S.settings.cloud={sub:'111',email:'eddy@gmail.com',name:'Eddy'}; save(true); window.pfAccountChanged(); const st=MP.estado(); st.retos={}; st.retosEnv={}; st.srv={}; st.enviado={};`);
SV.entries['u-111'].retos['sem-entreno:2026-11-23'] = '2026-11-24'; SV.entries['u-111'].dias[0] = 33;
ev(`window.__idt='${jwt('111', 'eddy@gmail.com')}'; A.mpEntrar()`); await tic(14);
comprobar('al volver a entrar se recuperan los retos ya ganados (no se premian dos veces)', ev(`!!(MP.estado().retos[MP.estado().activa]||{})['sem-entreno:2026-11-23']`));
comprobar('los días de hace más de 3 días salen del servidor', ev(`(MP.estado().srv[MP.estado().activa]||{dias:[]}).dias[0]`) === 33);

// en inglés
ev(`S.settings.lang='en'; applyLang(); render()`); await tic();
comprobar('en inglés: Today, Calendar, Challenges, League', /Today/.test(vista()) && /Calendar/.test(vista()) && /Challenges/.test(vista()) && /League/.test(vista()), vista().slice(0, 300));
ev(`S.settings.lang='es'; applyLang(); render()`);

// borrar del servidor (también desde Ajustes › tu nombre › Mi cuenta)
ev(`A.tab('ajustes'); A.verTarjeta(); A.ajGrupo('cuenta')`); await tic();
comprobar('Ajustes › Mi cuenta tiene «Borrar mis datos de Mi PandarIA»', /Borrar mis datos de Mi PandarIA/.test(ev(`document.querySelector('#layers').lastElementChild.textContent`)));
ev(`while(LAYERS.length) closeLayer(); A.mpCerrar()`); ev(`while(LAYERS.length) closeLayer()`); await tic();
comprobar('cerrar sesión de Mi PandarIA deja los puntos en el servidor', !ev(`MP.estado().activa`) && !!SV.entries['u-111']);
ev(`A.mpSalir()`); await tic(); ev(`(document.querySelector('.modal [data-a="cbm"]')||document.querySelector('[data-a="cbm"]')).click()`); await tic(16);
comprobar('borrar mis datos sin sesión: entra un momento y borra del servidor', !SV.players['u-111'] && !ev(`MP.estado().activa`), JSON.stringify(Object.keys(SV.players)));

// pantallas sin errores
ev(`A.tab('mipandaria')`); ev(`window.__idt='${jwt('111', 'eddy@gmail.com')}'; A.mpEntrar()`); await tic(14);
const errs0 = a.errores.length;
for (const act of ['mpLiga', 'mpAmigos', 'mpTrofeos', 'mpComo', 'mpCuenta']) { ev(`A.${act}()`); await tic(8); ev(`while(LAYERS.length) closeLayer()`); }
ev(`A.mpDia(dayKey())`); ev(`closeLayer()`); ev(`A.mpDia('2026-11-30')`); ev(`closeLayer()`);
comprobar('todas las pantallas de Mi PandarIA se abren sin errores', a.errores.length === errs0 && a.errores.length === 0, a.errores.slice(0, 3).join(' | '));
comprobar('solo se usan las funciones nuevas (nada de mp_dia ni mp_liga)', !SV.llamadas.some(x => x === 'mp_dia' || x === 'mp_liga'));

console.log(`\n${ok} correctas, ${mal} fallidas · ${SV.llamadas.length} solicitudes en toda la prueba`);
process.exit(mal ? 1 : 0);
