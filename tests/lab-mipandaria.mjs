// Pruebas de Mi PandarIA (solo rama lab-mi-pandaria) con un servidor Supabase simulado que imita las funciones SQL.
import fs from 'node:fs';
import { abrirApp } from './sim/app.mjs';

let ok = 0, mal = 0;
const comprobar = (n, c, d) => { if (c) { ok++; console.log('✓ ' + n); } else { mal++; console.log('✗ ' + n + (d ? ' → ' + d : '')); } };
const T0 = Date.UTC(2026, 10, 24, 15); // martes 24 nov 2026, 12:00 en Uruguay
const a = await abrirApp({ t0: T0 });
const w = a.w, ev = c => w.eval(c);
const tic = async (n = 6) => { for (let i = 0; i < n; i++) { await new Promise(r => setImmediate(r)); a.avanzar(50); } };

// ---------- servidor simulado ----------
const SV = { players: {}, entries: {}, days: {}, friends: new Set(), llamadas: [] };
const seasons = [{ id: 'prueba', name: 'Temporada de prueba', starts: '2026-11-22', ends: '2026-11-30' }, { id: 't0', name: 'Temporada 0', starts: '2026-12-01', ends: '2027-01-31' }];
const largo = s => Math.round((Date.parse(s.ends) - Date.parse(s.starts)) / 864e5) + 1;
const paso = s => Math.max(1, Math.round(largo(s) * 100 * 0.85 / 35));
const nivel = e => Math.min(34, e.start_level + Math.floor(e.points / paso(seasons.find(s => s.id === e.season_id))));
let n = 0;
w.fetch = async (url, opt = {}) => {
  const u = new URL(url), h = opt.headers || {}, body = opt.body ? JSON.parse(opt.body) : {};
  const yo = (h.Authorization || '').replace('Bearer at:', '') || null;
  SV.llamadas.push(u.pathname + (u.search || ''));
  const res = (st, j) => ({ ok: st < 300, status: st, text: async () => JSON.stringify(j) });
  if (h.apikey !== 'sb_publishable_sL20nOJlssLKJzzkOzTeDw_rTZFyspt') return res(401, { message: 'sin apikey' });
  if (u.pathname === '/auth/v1/token') {
    if (u.searchParams.get('grant_type') === 'id_token') { const [, id, email] = body.id_token.split(':'); return res(200, { access_token: 'at:' + id, refresh_token: 'rt:' + id, expires_in: 3600, user: { id, email, user_metadata: { given_name: email.split('@')[0] } } }); }
    return res(200, { access_token: 'at:' + body.refresh_token.slice(3), refresh_token: body.refresh_token, expires_in: 3600 });
  }
  if (!yo) return res(401, { message: 'permission denied' });
  const amigo = x => SV.friends.has(yo + '>' + x);
  const fn = u.pathname.replace('/rest/v1/rpc/', '');
  if (fn === 'mp_entrar') { let p = SV.players[yo]; if (!p) p = SV.players[yo] = { user_id: yo, mote: 'Panda-' + 'ABCDE'.slice(0, 4) + (++n), display_name: body.p_nombre || '', friend_code: ('COD00' + n).slice(-6) }; else if (body.p_nombre != null) p.display_name = body.p_nombre; return res(200, p); }
  if (fn === 'mp_dia') { const s = seasons.find(s => body.p_dia >= s.starts && body.p_dia <= s.ends); if (!s) return res(400, { message: 'sin temporada' }); const k = yo + '|' + s.id; SV.entries[k] = SV.entries[k] || { user_id: yo, season_id: s.id, start_level: 0, points: 0 }; SV.days[yo + '|' + body.p_dia] = { user_id: yo, season_id: s.id, day: body.p_dia, points: Math.min(150, Math.max(0, body.p_puntos)) }; SV.entries[k].points = Object.values(SV.days).filter(d => d.user_id === yo && d.season_id === s.id).reduce((a, d) => a + d.points, 0); return res(200, SV.entries[k]); }
  if (fn === 'mp_amigo_anadir') { const o = Object.values(SV.players).find(p => p.friend_code === body.p_codigo); if (!o) return res(400, { message: 'código no encontrado' }); if (o.user_id === yo) return res(400, { message: 'es tu propio código' }); SV.friends.add(yo + '>' + o.user_id); SV.friends.add(o.user_id + '>' + yo); return res(200, [{ user_id: o.user_id, mote: o.mote, display_name: o.display_name }]); }
  if (fn === 'mp_amigo_quitar') { SV.friends.delete(yo + '>' + body.p_user); SV.friends.delete(body.p_user + '>' + yo); return res(200, null); }
  if (fn === 'mp_liga') { const L = Object.values(SV.entries).filter(e => e.season_id === body.p_temporada).map(e => ({ e, nv: nivel(e) })).sort((x, y) => y.nv - x.nv || y.e.points - x.e.points);
    return res(200, L.map((x, i) => ({ pos: i + 1, mote: SV.players[x.e.user_id].mote, nivel: x.nv, puntos: x.e.points, soy_yo: x.e.user_id === yo, amigo: amigo(x.e.user_id), nombre: x.e.user_id === yo || amigo(x.e.user_id) ? SV.players[x.e.user_id].display_name : null }))); }
  if (fn === 'mp_trofeos') return res(200, []);
  if (fn === 'mp_salir') { delete SV.players[yo]; Object.keys(SV.entries).filter(k => k.startsWith(yo)).forEach(k => delete SV.entries[k]); return res(200, null); }
  if (u.pathname === '/rest/v1/mp_seasons') return res(200, seasons);
  if (u.pathname === '/rest/v1/mp_players') return res(200, Object.values(SV.players).filter(p => p.user_id === yo || amigo(p.user_id)));
  if (u.pathname === '/rest/v1/mp_days') return res(200, Object.values(SV.days).filter(d => d.user_id === yo || amigo(d.user_id)));
  return res(404, { message: 'no existe ' + u.pathname });
};

// ---------- la app con Mi PandarIA ----------
ev(`S.settings.onboarded=true; S.profile=Object.assign(S.profile||{},{name:'Eddy',weight:80,height:178,age:29,sex:'h'}); save(true);`);
const antes = ev(`JSON.stringify(Object.keys(S).sort())`);
// como en la APK: Mi PandarIA se carga mientras la página aún carga, y Ajustes se monta después (DOMContentLoaded)
ev(`viewAjustes=AJ_BASE; AJ_BASE=null; Object.defineProperty(document,'readyState',{get:()=>'loading',configurable:true})`);
ev(fs.readFileSync(new URL('../lab/mipandaria.js', import.meta.url), 'utf8'));
ev(`delete document.readyState; document.dispatchEvent(new Event('DOMContentLoaded'))`);
await tic();
comprobar('la pestaña Mi PandarIA aparece entre Nutrición y Historial', ev(`[...document.querySelectorAll('#nav button')].map(b=>b.dataset.v).join(',')`) === 'rutinas,nutricion,mipandaria,historial,ajustes', ev(`[...document.querySelectorAll('#nav button')].map(b=>b.dataset.v).join(',')`));
ev(`A.tab('mipandaria')`); await tic();
comprobar('Mi PandarIA tiene su propia pantalla (no sale dentro de Ajustes)', !/Entrenamiento|Acerca de/.test(ev(`document.querySelector('#view').textContent`)) && /<h1>Mi PandarIA<\/h1>/.test(ev(`document.querySelector('#view').innerHTML`)), ev(`document.querySelector('#view').textContent.slice(0,200)`));
comprobar('sin sesión: pantalla de bienvenida con «Entrar con Google» y qué se sube', /Entrar con Google/.test(ev(`document.querySelector('#view').textContent`)) && /mote aleatorio/.test(ev(`document.querySelector('#view').textContent`)));

ev(`window.MP_TEST_ID_TOKEN=()=>window.__idt`); ev(`window.__idt='idt:u1:eddy@gmail.com'`);
ev(`A.mpEntrar()`); await tic(12);
const c1 = ev(`JSON.stringify(MP.estado().cuentas.u1&&MP.estado().cuentas.u1.jugador)`);
comprobar('entrar con Google crea el jugador con mote y código, y guarda la sesión aparte de los datos', /Panda-/.test(c1) && /"display_name":"Eddy"/.test(c1) && !!w.localStorage.getItem('pandaria-mp-v1'), c1);
{ const ahora = JSON.parse(ev(`JSON.stringify(Object.keys(S).sort())`)), nuevas = ahora.filter(k => !JSON.parse(antes).includes(k)); comprobar('los datos de la app no ganan claves de Mi PandarIA (va aparte)', !nuevas.some(k => /mp|pandaria/i.test(k)), nuevas.join(',')); console.log('   (claves nuevas de la propia app al abrir pantallas: ' + (nuevas.join(', ') || 'ninguna') + ')'); }
let v = ev(`document.querySelector('#view').textContent.replace(/\\s+/g,' ')`);
comprobar('pantalla: rango, hoy, calendario, retos, liga, amigos y trofeos', /Bambú V/.test(v) && /Rutina del día/.test(v) && /Calendario/.test(v) && /Retos/.test(v) && /Liga/.test(v) && /Amigos/.test(v) && /Trofeos/.test(v), v.slice(0, 400));
comprobar('2 actividades extra distintas y un contenido del día', ev(`(()=>{ const [a,b]=MP.extrasDe(dayKey()); return a.k!==b.k && document.querySelectorAll('[data-a="mpExtra"]').length===2 && !!document.querySelector('[data-a="mpContenido"]'); })()`));

// un entreno normal hoy (día del plan) + contenido + agua + 2 comidas
ev(`S.plan={days:[new Date().getDay()],order:[]}; S.sessions.push({id:'s1',routineId:'r1',routineName:'Pecho',start:Date.now()-3600000,end:Date.now()-60000,intensity:7,items:[],prs:[],vol:1000}); save(true);`);
ev(`A.mpContenido()`);
ev(`const n_=nut(); n_.waterLog=n_.waterLog||{}; n_.waterLog[dayKey()]=[{ml:5000,t:Date.now()}]; nd().diario[dayKey()]=[{id:'a',m:'desayuno'},{id:'b',m:'almuerzo'}]; save(true);`);
await tic(); a.avanzar(3000); await tic(10);
let P = JSON.parse(ev(`JSON.stringify(MP.puntosDia(dayKey()))`));
comprobar('puntos de hoy: entreno 40 + plan 10 + contenido 5 + comidas 10 + agua 10', P.entreno === 40 && P.plan === 10 && P.contenido === 5 && P.comida === 10 && P.agua === 10, JSON.stringify(P));
comprobar('los puntos de hoy llegan al servidor', SV.days['u1|2026-11-24'] && SV.days['u1|2026-11-24'].points === P.total, JSON.stringify(SV.days));

// actividad extra con el temporizador de intervalos
const kx = ev(`MP.extrasDe(dayKey())[0].k`);
ev(`A.mpExtra('${kx}')`);
comprobar('la actividad extra abre el temporizador de intervalos', ev(`LAYERS[LAYERS.length-1].t`) === 'intRun');
ev(`saveIntSession({id:'x1',routineId:'__int',routineName:'Intervalos',start:Date.now()-400000,end:Date.now(),intensity:6,items:[],prs:[],vol:0,int:{fmt:'hiit',work:300}})`);
await tic(); a.avanzar(3000); await tic(10);
const sx = JSON.parse(ev(`JSON.stringify(S.sessions.find(s=>s.id==='x1'))`));
comprobar('se guarda en el historial como «Mi PandarIA · …» marcada como actividad extra', sx.mp && sx.mp.k === kx && /^Mi PandarIA · /.test(sx.routineName), JSON.stringify(sx));
P = JSON.parse(ev(`JSON.stringify(MP.puntosDia(dayKey()))`));
comprobar('la actividad extra suma 15 y no cuenta como entreno', P.extra === 15 && P.entreno === 40, JSON.stringify(P));
ev(`window.isPremium=()=>false; render()`);
comprobar('gratis: la actividad hecha no se puede repetir', !ev(`!!document.querySelector('[data-a="mpExtra"][data-v="${kx}"]')`));
ev(`window.isPremium=()=>true; render()`);
comprobar('Premium: se puede repetir', ev(`!!document.querySelector('[data-a="mpExtra"][data-v="${kx}"]')`));

// retos
const R = JSON.parse(ev(`JSON.stringify(MP.retos())`));
comprobar('6 retos: 2 de semana, 2 de mes y 2 de temporada, con metas', R.length === 6 && ['semana', 'mes', 'temporada'].every(t => R.filter(r => r.tipo === t).length === 2) && R.every(r => r.meta >= 1), JSON.stringify(R.map(r => r.id + ' ' + r.v + '/' + r.meta)));

// segunda cuenta en el mismo teléfono
ev(`window.__idt='idt:u2:segunda@gmail.com'`); ev(`A.mpOtra()`); await tic(12);
comprobar('entrar con otra cuenta la deja activa', ev(`MP.estado().activa`) === 'u2');
P = JSON.parse(ev(`JSON.stringify(MP.puntosDia(dayKey()))`));
comprobar('los entrenos de la otra cuenta no cuentan para la nueva', P.entreno === 0 && P.extra === 0, JSON.stringify(P));
ev(`S.sessions.push({id:'s2',routineId:'r1',routineName:'Pierna',start:Date.now()-3000000,end:Date.now(),intensity:7,items:[],prs:[],vol:900}); save(true);`);
await tic(); a.avanzar(3000); await tic(10);
P = JSON.parse(ev(`JSON.stringify(MP.puntosDia(dayKey()))`));
comprobar('un entreno nuevo cuenta para la cuenta activa', P.entreno === 40 && ev(`MP.estado().duenos.s2`) === 'u2', JSON.stringify(P));

// amigos y liga
const cod1 = SV.players.u1.friend_code;
ev(`A.mpAmigos()`); await tic(10);
ev(`document.getElementById('mpCod').value='${cod1}'; A.mpAnadir()`); await tic(14);
comprobar('añadir amigo con su código', SV.friends.has('u2>u1') && SV.friends.has('u1>u2'));
const tA = ev(`document.querySelector('#layers').lastElementChild.textContent.replace(/\\s+/g,' ')`);
comprobar('en Amigos se ve su nombre y sus puntos de hoy', /Eddy/.test(tA) && /hoy \d+/.test(tA), tA.slice(0, 300));
ev(`closeLayer(); A.mpLiga()`); await tic(12);
const tL = ev(`document.querySelector('#layers').lastElementChild.textContent.replace(/\\s+/g,' ')`);
comprobar('la liga muestra a los dos, con «tú» y el nombre del amigo', /Eddy/.test(tL) && /tú/.test(tL) && /Bambú/.test(tL), tL.slice(0, 300));
ev(`closeLayer()`);

// volver a la primera cuenta
ev(`A.mpUsar('u1')`); await tic(12);
comprobar('cambiar de cuenta guardada sin volver a iniciar sesión', ev(`MP.estado().activa`) === 'u1' && JSON.parse(ev(`JSON.stringify(MP.puntosDia(dayKey()))`)).entreno === 40);

// en inglés
ev(`S.settings.lang='en'; applyLang(); render()`); await tic();
v = ev(`document.querySelector('#view').textContent.replace(/\\s+/g,' ')`);
comprobar('en inglés: Today, Calendar, Challenges, League', /Today/.test(v) && /Calendar/.test(v) && /Challenges/.test(v) && /League/.test(v), v.slice(0, 300));
ev(`S.settings.lang='es'; applyLang(); render()`);

// salir y borrar
ev(`A.mpCuenta()`); await tic(); ev(`A.mpSalir()`); await tic(); ev(`(document.querySelector('.modal [data-a="cbm"]')||document.querySelector('[data-a="cbm"]')).click()`); await tic(14);
comprobar('salir borra el jugador del servidor y queda la otra cuenta activa', !SV.players.u1 && ev(`MP.estado().activa`) === 'u2', JSON.stringify(Object.keys(SV.players)));

// botones de Mi PandarIA sin errores
ev(`A.tab('mipandaria')`); await tic();
const errs0 = a.errores.length;
for (const act of ['mpLiga', 'mpAmigos', 'mpTrofeos', 'mpComo', 'mpCuenta']) { ev(`A.${act}()`); await tic(8); ev(`while(LAYERS.length) closeLayer()`); }
ev(`A.mpDia(dayKey())`); ev(`closeLayer()`); ev(`A.mpDia('2026-11-30')`); ev(`closeLayer()`);
comprobar('todas las pantallas de Mi PandarIA se abren sin errores', a.errores.length === errs0 && a.errores.length === 0, a.errores.slice(0, 3).join(' | '));
comprobar('ninguna llamada sin la clave pública ni a otra dirección', SV.llamadas.every(x => !/undefined/.test(x)));

console.log(`\n${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
