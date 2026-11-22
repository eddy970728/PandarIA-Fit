/* PandarIA Fit · Mi PandarIA (laboratorio)
   Solo entra en la APK de Mi PandarIA (rama lab-mi-pandaria). Nunca en la APK ni el AAB normales.
   - Su estado vive aparte de los datos de la app (clave pandaria-mp-v1): no entra en la copia de Drive ni en exportar.
   - Al servidor solo van: mote aleatorio, nombre (solo lo ven tus amigos), puntos por día y amistades.
   - Para quitarlo basta instalar la versión normal encima: los datos de la app no cambian. */
(function () {
  'use strict';
  const SB_URL = 'https://vjvhpumsfsktkavtxigk.supabase.co';
  const SB_KEY = 'sb_publishable_sL20nOJlssLKJzzkOzTeDw_rTZFyspt'; // clave pública (las reglas del servidor protegen los datos)
  const WEB_ID = '879792644217-pd24e4p8954m522jvjf1mhj0skg74t2u.apps.googleusercontent.com';
  const KEY = 'pandaria-mp-v1';
  const TEMPORADAS = [ // copia local por si no hay conexión; el servidor manda
    {id: 'prueba', name: 'Temporada de prueba', starts: '2026-11-22', ends: '2026-11-30'},
    {id: 't0', name: 'Temporada 0', starts: '2026-12-01', ends: '2027-01-31'},
    {id: 't1', name: 'Temporada 1', starts: '2027-02-01', ends: '2027-03-31'}];
  const RANGOS = [['Bambú', 'Bamboo'], ['Brote', 'Sprout'], ['Garra', 'Claw'], ['Colmillo', 'Fang'], ['Hierro', 'Iron'], ['Titán', 'Titan'], ['Leyenda', 'Legend']];
  const ROM = ['V', 'IV', 'III', 'II', 'I'];
  const PUNTOS = {entreno: 40, plan: 10, extra: 15, contenido: 5, comida: 10, agua: 10, max: 150};

  /* ---------- Estado propio ---------- */
  let M;
  const nuevo = () => ({v: 1, cuentas: {}, activa: null, duenos: {}, dias: {}, enviado: {}, retos: {}, seasons: null, cache: {}});
  try { M = Object.assign(nuevo(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { M = nuevo(); }
  const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(M)); } catch (e) {} };
  window.MP = {estado: () => M, reiniciar: () => { M = nuevo(); guardar(); }};
  const cuenta = () => M.activa && M.cuentas[M.activa] || null;
  const misDias = () => (M.dias[M.activa] = M.dias[M.activa] || {});

  /* ---------- Fechas y temporada ---------- */
  const hoyK = () => dayKey();
  const kDe = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };
  const sumaDias = (k, n) => dayKey(kDe(k) + n * 864e5);
  const entre = (a, b) => Math.round((kDe(b) - kDe(a)) / 864e5);
  const temporadas = () => (M.seasons && M.seasons.length ? M.seasons : TEMPORADAS);
  const temporadaDe = k => temporadas().find(s => k >= s.starts && k <= s.ends) || null;
  const temporada = () => temporadaDe(hoyK()) || temporadas().find(s => s.starts > hoyK()) || temporadas()[temporadas().length - 1];
  const largo = s => entre(s.starts, s.ends) + 1;
  const paso = s => Math.max(1, Math.round(largo(s) * 100 * 0.85 / 35));
  const nombreT = s => s.id === 'prueba' ? tx('Temporada de prueba', 'Test season') : s.id === 't0' ? tx('Temporada 0', 'Season 0') : s.name.replace('Temporada', tx('Temporada', 'Season'));
  const rango = n => { n = Math.max(0, Math.min(34, n | 0)); const r = RANGOS[Math.floor(n / 5)]; return {n, r: Math.floor(n / 5), nombre: tx(r[0], r[1]), sub: ROM[n % 5], txt: tx(r[0], r[1]) + ' ' + ROM[n % 5]}; };

  /* ---------- Servidor ---------- */
  async function sbFetch(path, opt) {
    const c = cuenta(); opt = opt || {};
    const h = Object.assign({apikey: SB_KEY, 'Content-Type': 'application/json'}, opt.headers || {});
    if (c && c.at && !opt.sinSesion) { if (Date.now() > (c.exp || 0) - 60000) await refrescar(); h.Authorization = 'Bearer ' + cuenta().at; }
    const r = await fetch(SB_URL + path, {method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined});
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) { const e = new Error((j && (j.message || j.error_description || j.msg)) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  }
  const rpc = (fn, args) => sbFetch('/rest/v1/rpc/' + fn, {method: 'POST', body: args || {}});
  async function refrescar() {
    const c = cuenta(); if (!c || !c.rt) throw new Error('sin sesión');
    const j = await sbFetch('/auth/v1/token?grant_type=refresh_token', {method: 'POST', body: {refresh_token: c.rt}, sinSesion: true});
    Object.assign(c, {at: j.access_token, rt: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000}); guardar();
  }
  // Tu cuenta de Google → sesión de Supabase (no pide permisos nuevos: solo nombre y correo)
  async function tokenGoogle(elegir) {
    if (window.MP_TEST_ID_TOKEN) return window.MP_TEST_ID_TOKEN();
    const C = window.Capacitor, SL = C && C.Plugins && C.Plugins.SocialLogin;
    if (!SL) throw new Error(tx('Inicia sesión desde la app del teléfono', 'Sign in from the phone app'));
    await SL.initialize({google: {webClientId: WEB_ID, mode: 'online'}});
    if (elegir) { try { await SL.logout({provider: 'google'}); } catch (e) {} }
    const res = await SL.login({provider: 'google', options: {forcePrompt: !!elegir}});
    const r = (res && res.result) || {};
    if (!r.idToken) throw new Error(tx('Google no devolvió la sesión', 'Google did not return a session'));
    return r.idToken;
  }
  async function entrar(elegir) {
    const idt = await tokenGoogle(elegir);
    const j = await sbFetch('/auth/v1/token?grant_type=id_token', {method: 'POST', body: {provider: 'google', id_token: idt}, sinSesion: true});
    const u = j.user || {};
    M.cuentas[u.id] = Object.assign(M.cuentas[u.id] || {desde: Date.now()}, {email: u.email || '', at: j.access_token, rt: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000});
    M.activa = u.id; guardar();
    const nombre = (S.profile && S.profile.name) || (u.user_metadata && (u.user_metadata.given_name || u.user_metadata.name)) || '';
    const p = await rpc('mp_entrar', {p_nombre: M.cuentas[u.id].jugador ? null : nombre});
    M.cuentas[u.id].jugador = p; guardar();
    try { const s = await sbFetch('/rest/v1/mp_seasons?select=id,name,starts,ends&order=starts'); if (Array.isArray(s) && s.length) { M.seasons = s; guardar(); } } catch (e) {}
    asignar(); await sincronizar(true);
  }

  /* ---------- De quién es cada entreno (dos cuentas en el mismo teléfono) ---------- */
  function asignar() {
    const c = cuenta(); if (!c) return false; let n = 0;
    for (const s of S.sessions) if (!M.duenos[s.id] && s.end >= c.desde - 864e5) { M.duenos[s.id] = M.activa; n++; }
    if (n) guardar(); return n > 0;
  }
  const sesionesDe = (k, uid) => S.sessions.filter(s => M.duenos[s.id] === uid && dayKey(s.end) === k);

  /* ---------- Actividades del día ---------- */
  const EXTRAS = [
    {k: 'core', es: 'Core exprés', en: 'Express core', d: ['6 min · plancha, dead bug y bird dog', '6 min · plank, dead bug and bird dog'], cfg: {fmt: 'hiit', work: 40, rest: 20, rounds: 6, sets: 1, prep: 10, ex: ['plancha', 'dead_bug', 'bird_dog']}},
    {k: 'movilidad', es: 'Movilidad completa', en: 'Full mobility', d: ['7 min · articulaciones, gato-vaca y cadera', '7 min · joints, cat-cow and hips'], cfg: {fmt: 'hiit', work: 50, rest: 10, rounds: 7, sets: 1, prep: 10, ex: ['mov_articular', 'gato_vaca', 'est_flexor_cadera', 'est_gluteo']}},
    {k: 'cardio', es: 'Cardio suave', en: 'Easy cardio', d: ['8 min · marcha, jumping jacks y boxeo de sombra', '8 min · marching, jumping jacks and shadow boxing'], cfg: {fmt: 'hiit', work: 45, rest: 15, rounds: 8, sets: 1, prep: 10, ex: ['marcha_sitio', 'jumping_jacks', 'sombra_boxeo']}},
    {k: 'tabata', es: 'Tabata de piernas', en: 'Leg Tabata', d: ['4 min · sentadilla con salto y zancadas', '4 min · jump squats and lunges'], cfg: {fmt: 'tabata', tWork: 20, tRest: 10, sets: 1, prep: 10, ex: ['sentadilla_salto', 'zancadas_pc']}},
    {k: 'estira', es: 'Estiramientos', en: 'Stretching', d: ['7 min · isquios, cuádriceps, pecho y espalda', '7 min · hamstrings, quads, chest and back'], cfg: {fmt: 'hiit', work: 50, rest: 10, rounds: 7, sets: 1, prep: 10, ex: ['est_isquios', 'est_cuadriceps', 'est_pecho', 'est_dorsal', 'est_gemelos']}},
    {k: 'empuje', es: 'Flexiones en EMOM', en: 'Push-up EMOM', d: ['6 min · 8 flexiones cada minuto', '6 min · 8 push-ups every minute'], cfg: {fmt: 'emom', emomMin: 6, emomReps: 8, prep: 10, ex: ['flexiones', 'flexiones_rodillas']}},
    {k: 'yoga', es: 'Yoga breve', en: 'Short yoga', d: ['7 min · saludo al sol, perro, cobra y niño', '7 min · sun salutation, dog, cobra and child'], cfg: {fmt: 'hiit', work: 50, rest: 10, rounds: 7, sets: 1, prep: 10, ex: ['yoga_saludo', 'yoga_perro', 'yoga_cobra', 'yoga_nino']}},
    {k: 'gluteo', es: 'Glúteos y espalda baja', en: 'Glutes and lower back', d: ['6 min · puente, superman y plancha lateral', '6 min · bridge, superman and side plank'], cfg: {fmt: 'hiit', work: 40, rest: 20, rounds: 6, sets: 1, prep: 10, ex: ['puente_gluteo', 'superman', 'plancha_lateral']}}
  ];
  const CONTENIDO = [
    ['Tu músculo no crece en el gimnasio: crece mientras duermes y comes. El entreno es la señal; el descanso, la obra.', 'Muscle does not grow in the gym: it grows while you sleep and eat. Training is the signal; rest is the build.'],
    ['Caminar 10 minutos después de comer baja el pico de azúcar en sangre. Pequeño hábito, gran efecto.', 'A 10-minute walk after a meal lowers the blood sugar spike. Small habit, big effect.'],
    ['Las 2 últimas repeticiones duras de una serie son las que más estímulo dan. Por eso PandarIA te pregunta el esfuerzo.', 'The last 2 hard reps of a set give the most stimulus. That is why PandarIA asks about effort.'],
    ['Beber agua antes de tener sed mejora tu rendimiento: con un 2 % de deshidratación ya rindes menos.', 'Drinking before you feel thirsty helps performance: at 2 % dehydration you already perform worse.'],
    ['El panda gigante come hasta 14 horas al día. Tú no hace falta: con proteína en cada comida vas bien.', 'Giant pandas eat up to 14 hours a day. You don’t need to: protein at every meal is enough.'],
    ['Una racha no se rompe por un día malo, se rompe por dos. Si fallas hoy, mañana vuelves.', 'A streak doesn’t break on one bad day, it breaks on two. Miss today, come back tomorrow.'],
    ['Calentar 5 minutos reduce lesiones y te deja levantar más en tus primeras series.', 'A 5-minute warm-up reduces injuries and lets you lift more in your first sets.'],
    ['La fuerza también es salud: más músculo es más equilibrio, huesos más fuertes y mejor azúcar en sangre.', 'Strength is health too: more muscle means better balance, stronger bones and better blood sugar.'],
    ['Dormir menos de 6 horas sube el hambre al día siguiente. El sueño también es parte de tu dieta.', 'Sleeping under 6 hours raises hunger the next day. Sleep is part of your diet too.'],
    ['Respirar lento por la nariz entre series ayuda a recuperarte antes.', 'Slow nasal breathing between sets helps you recover faster.']
  ];
  const semilla = k => k.split('-').reduce((a, x) => a * 31 + (+x), 7);
  function extrasDe(k) { const n = semilla(k), a = n % EXTRAS.length; let b = (n * 7 + 3) % EXTRAS.length; if (b === a) b = (b + 1) % EXTRAS.length; return [EXTRAS[a], EXTRAS[b]]; }
  const contenidoDe = k => CONTENIDO[semilla(k) % CONTENIDO.length];
  const extraHecho = (k, x, uid) => sesionesDe(k, uid || M.activa).some(s => s.mp && s.mp.k === x.k);

  /* ---------- Puntos de un día ---------- */
  function puntosDia(k, uid) {
    uid = uid || M.activa; const d = (M.dias[uid] || {})[k] || {};
    const ss = sesionesDe(k, uid), norm = ss.filter(s => !s.mp), ext = new Set(ss.filter(s => s.mp).map(s => s.mp.k));
    const plan = !!(S.plan && S.plan.days && S.plan.days.includes(new Date(kDe(k)).getDay()));
    const comidas = ((typeof nd === 'function' ? nd().diario : {})[k] || []).length;
    const n = typeof nut === 'function' ? nut() : {}; const agua = (typeof wLog === 'function' ? wLog(k) : []).reduce((a, x) => a + (x.ml || 0), 0);
    const meta = ((n.waterGoalDia || {})[k]) || (typeof waterGoal === 'function' ? waterGoal() : 2000);
    const P = {entreno: norm.length ? PUNTOS.entreno : 0, plan: norm.length && plan ? PUNTOS.plan : 0, extra: Math.min(2, ext.size) * PUNTOS.extra,
      contenido: d.contenido ? PUNTOS.contenido : 0, comida: comidas >= 2 ? PUNTOS.comida : 0, agua: agua >= meta && agua > 0 ? PUNTOS.agua : 0, retos: (d.retos || 0)};
    P.total = Math.min(PUNTOS.max, Object.values(P).reduce((a, x) => a + x, 0));
    return P;
  }

  /* ---------- Retos: semana, mes y temporada (escalados a lo que dura cada uno) ---------- */
  function periodos(s, k) {
    const lun = dayKey(weekKey(kDe(k))), dom = sumaDias(lun, 6), d = new Date(kDe(k));
    const m1 = dayKey(new Date(d.getFullYear(), d.getMonth(), 1, 12).getTime()), m2 = dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).getTime());
    const rec = (a, b) => [a < s.starts ? s.starts : a, b > s.ends ? s.ends : b];
    return {semana: rec(lun, dom), mes: rec(m1, m2), temporada: [s.starts, s.ends]};
  }
  function retos(k) {
    const s = temporadaDe(k || hoyK()); if (!s || !M.activa) return [];
    k = k || hoyK(); const per = periodos(s, k), diasPlan = Math.max(2, (S.plan && S.plan.days && S.plan.days.length) || 3);
    const lista = [];
    const cuenta_ = (a, b, f) => { let n = 0; for (let x = a; x <= b && x <= hoyK(); x = sumaDias(x, 1)) if (f(puntosDia(x))) n++; return n; };
    const def = (id, per_, t, en, meta, f, bono) => { const [a, b] = per[per_]; const v = cuenta_(a, b, f); lista.push({id: id + ':' + a, tipo: per_, t, en, meta, v: Math.min(v, meta), ok: v >= meta, bono}); };
    const L = p => entre(per[p][0], per[p][1]) + 1;
    def('sem-entreno', 'semana', 'Entrena', 'Train', Math.max(1, Math.round(diasPlan * L('semana') / 7)), p => p.entreno > 0, 20);
    def('sem-extra', 'semana', 'Haz actividades extra', 'Do extra activities', Math.max(1, Math.round(L('semana') * 0.6)), p => p.extra > 0, 20);
    def('mes-activo', 'mes', 'Días con actividad', 'Active days', Math.max(2, Math.round(L('mes') * 0.6)), p => p.total - p.retos >= 40, 30);
    def('mes-agua', 'mes', 'Cumple tu meta de agua', 'Hit your water goal', Math.max(2, Math.round(L('mes') * 0.5)), p => p.agua > 0, 30);
    def('tem-entreno', 'temporada', 'Entrenos de la temporada', 'Season workouts', Math.max(3, Math.round(diasPlan * L('temporada') / 7 * 0.75)), p => p.entreno > 0, 50);
    def('tem-comida', 'temporada', 'Registra tus comidas', 'Log your meals', Math.max(3, Math.round(L('temporada') * 0.6)), p => p.comida > 0, 50);
    return lista;
  }
  // El bono de un reto se suma el día en que se completa (una sola vez)
  function premiarRetos() {
    const R = (M.retos[M.activa] = M.retos[M.activa] || {}); let cambio = false;
    for (const r of retos()) if (r.ok && !R[r.id]) { R[r.id] = hoyK(); const d = misDias()[hoyK()] = misDias()[hoyK()] || {}; d.retos = (d.retos || 0) + r.bono; cambio = true; toast(tx(`Reto completado: ${r.t} · +${r.bono}`, `Challenge done: ${r.en} · +${r.bono}`)); }
    if (cambio) guardar(); return cambio;
  }

  /* ---------- Enviar tus puntos (hoy y los 3 días anteriores) ---------- */
  let sincT = null, sincEnCurso = false;
  async function sincronizar(forzar) {
    if (!cuenta() || sincEnCurso) return; sincEnCurso = true;
    try {
      asignar(); premiarRetos();
      const E = (M.enviado[M.activa] = M.enviado[M.activa] || {});
      for (let i = 3; i >= 0; i--) {
        const k = sumaDias(hoyK(), -i); if (!temporadaDe(k)) continue;
        const p = puntosDia(k); if (!forzar && E[k] === p.total) continue;
        if (!p.total && E[k] == null && !forzar) continue;
        const det = {e: p.entreno ? 1 : 0, x: p.extra / PUNTOS.extra, c: p.contenido ? 1 : 0, m: p.comida ? 1 : 0, a: p.agua ? 1 : 0, r: p.retos};
        const ent = await rpc('mp_dia', {p_dia: k, p_puntos: p.total, p_detalle: det});
        E[k] = p.total; M.cache.entrada = ent; guardar();
      }
      M.cache.err = null;
    } catch (e) { M.cache.err = e.message; } finally { sincEnCurso = false; guardar(); }
  }
  const sincPronto = () => { clearTimeout(sincT); sincT = setTimeout(() => sincronizar(false).then(() => { if (TAB === 'mipandaria' && !LAYERS.length) { render.keep = true; render(); } }), 2500); };
  async function cargarLiga() {
    const s = temporada(); if (!cuenta()) return;
    try {
      const [liga, amigos] = await Promise.all([rpc('mp_liga', {p_temporada: s.id, p_limite: 100}), sbFetch('/rest/v1/mp_players?select=user_id,mote,display_name')]);
      M.cache.liga = {s: s.id, t: Date.now(), filas: liga || []}; M.cache.jugadores = (amigos || []).filter(x => x.user_id !== M.activa);
      const ids = M.cache.jugadores.map(x => x.user_id);
      M.cache.diasAmigos = ids.length ? await sbFetch('/rest/v1/mp_days?select=user_id,day,points&season_id=eq.' + s.id + '&order=day.desc&limit=200') : [];
      M.cache.trofeos = await rpc('mp_trofeos');
      M.cache.err = null;
    } catch (e) { M.cache.err = e.message; }
    guardar();
  }

  /* ---------- Pantalla principal ---------- */
  const fmtD = (k, o) => new Date(kDe(k)).toLocaleDateString(LOC(), o || {weekday: 'short', day: 'numeric'});
  function nivelActual() {
    const s = temporada(), e = M.cache.entrada && M.cache.entrada.season_id === s.id ? M.cache.entrada : null;
    const ini = e ? e.start_level : 0, pts = e ? e.points : 0, p = paso(s), n = Math.min(34, ini + Math.floor(pts / p));
    return {s, pts, p, n, resto: n >= 34 ? 0 : p - (pts % p), pct: n >= 34 ? 100 : Math.round((pts % p) / p * 100)};
  }
  function viewMP() {
    const c = cuenta();
    let h = `<div class="hdr"><h1>Mi PandarIA</h1></div>`;
    if (!c) return h + bienvenida();
    const s = temporada(), k = hoyK(), en = !!temporadaDe(k), N = nivelActual(), R = rango(N.n), j = c.jugador || {};
    const quedan = entre(k, s.ends) + 1;
    h += `<button class="card row" data-a="mpCuenta" style="width:100%;gap:12px;text-align:left"><span style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,var(--ac),#ff4f3a);color:#1a0702;display:grid;place-items:center;font-weight:900;flex:0 0 auto">${R.sub}</span>
      <span class="grow" style="min-width:0"><span class="b" style="font-size:17px">${R.txt}</span><br><span class="xs mut">${esc(j.mote || '')} · ${nombreT(s)}${en ? ' · ' + tx(`quedan ${quedan} días`, `${quedan} days left`) : ' · ' + tx('empieza el ', 'starts ') + fmtD(s.starts, {day: 'numeric', month: 'short'})}</span>
      <span style="display:block;height:6px;border-radius:3px;background:var(--line);margin-top:8px;overflow:hidden"><span style="display:block;height:100%;width:${N.pct}%;background:var(--ac)"></span></span>
      <span class="xs mut">${N.n >= 34 ? tx('Nivel máximo', 'Top level') : tx(`${N.resto} puntos para ${rango(N.n + 1).txt}`, `${N.resto} points to ${rango(N.n + 1).txt}`)} · ${fmtNum(N.pts)} ${tx('puntos', 'points')}</span></span></button>`;
    if (M.cache.err) h += `<div class="banner"><span class="ic">${I('alert', 18)}</span><div class="grow xs">${tx('Sin conexión con el servidor. Tus puntos se envían cuando vuelva.', 'No connection to the server. Your points will be sent when it is back.')}</div></div>`;
    if (en) h += hoyHtml(k);
    h += `<div class="sec">${tx('Calendario', 'Calendar')}</div>` + calendarioHtml(s);
    h += `<div class="sec">${tx('Retos', 'Challenges')}</div>` + retosHtml();
    h += `<div class="card" style="padding:0 12px;margin-top:14px">` +
      fila('mpLiga', 'trophy', tx('Liga', 'League'), tx('Clasificación de la temporada por rango y puntos', 'Season ranking by rank and points')) +
      fila('mpAmigos', 'user', tx('Amigos', 'Friends'), tx('Tu código, añadir amigos y su actividad', 'Your code, add friends and their activity')) +
      fila('mpTrofeos', 'flame', tx('Trofeos', 'Trophies'), tx('Lo que queda de cada temporada terminada', 'What remains from each finished season')) +
      fila('mpComo', 'info', tx('Cómo se ganan puntos', 'How to earn points'), tx('Entrenos, actividades, retos y rangos', 'Workouts, activities, challenges and ranks')) + `</div>`;
    return h;
  }
  const fila = (a, ic, t, d) => `<button class="srow" data-a="${a}"><span class="si">${I(ic, 20)}</span><span class="grow"><div class="b">${t}</div><div class="xs mut">${d}</div></span><span class="mut" style="font-size:22px;line-height:1">›</span></button>`;
  function bienvenida() {
    return `<div class="card" style="text-align:center;padding:22px 18px"><div style="width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,var(--ac),#ff4f3a);display:grid;place-items:center;margin:0 auto;color:#1a0702">${I('trophy', 38)}</div>
      <div style="font-size:22px;font-weight:900;margin-top:12px">${tx('Compite por temporadas', 'Compete by seasons')}</div>
      <p class="sm mut" style="line-height:1.5">${tx('Cada día tienes tu rutina, 2 actividades extra de PandarIA y un contenido. Suma puntos, sube de rango, completa retos y mide tu temporada con tus amigos.', 'Every day you get your routine, 2 extra PandarIA activities and some content. Earn points, climb ranks, complete challenges and compare your season with your friends.')}</p>
      <p class="xs mut" style="line-height:1.5">${tx('Al servidor solo van un mote aleatorio, tus puntos por día y tus amigos. Tu nombre solo lo ven tus amigos. Tus entrenos y tus datos de salud se quedan en el teléfono.', 'Only a random nickname, your daily points and your friends go to the server. Only your friends see your name. Your workouts and health data stay on the phone.')}</p>
      <button class="btn pri big" data-a="mpEntrar" style="margin-top:8px">${tx('Entrar con Google', 'Sign in with Google')}</button></div>`;
  }
  function hoyHtml(k) {
    const P = puntosDia(k), r = typeof rutinaHoyPendiente === 'function' ? rutinaHoyPendiente() : null, hecho = P.entreno > 0, [x1, x2] = extrasDe(k), cont = contenidoDe(k), d = misDias()[k] || {};
    const check = ok => ok ? `<span style="color:var(--good,#3ecf8e)">${I('check', 20)}</span>` : '';
    const ext = x => { const ok = extraHecho(k, x), bloq = ok && !(typeof isPremium === 'function' && isPremium());
      return `<div class="row" style="gap:10px;padding:10px 0;border-top:1px solid var(--line)"><span class="si">${I('timer', 20)}</span><div class="grow"><div class="b sm">${tx(x.es, x.en)}</div><div class="xs mut">${tx(x.d[0], x.d[1])} · +${PUNTOS.extra}</div></div>${check(ok)}${bloq ? '' : `<button class="btn sm ${ok ? 'ghost' : 'pri'}" data-a="mpExtra" data-v="${x.k}">${ok ? tx('Repetir', 'Repeat') : tx('Hacer', 'Do it')}</button>`}</div>`; };
    return `<div class="sec">${tx('Hoy', 'Today')} · ${fmtD(k, {weekday: 'long', day: 'numeric', month: 'long'})} <span class="mut" style="float:right">${P.total} ${tx('pts', 'pts')}</span></div><div class="card" style="padding:4px 14px">
      <div class="row" style="gap:10px;padding:10px 0"><span class="si">${I('dumbbell', 20)}</span><div class="grow"><div class="b sm">${tx('Rutina del día', 'Routine of the day')}</div><div class="xs mut">${hecho ? tx('Hecha', 'Done') : r ? esc(r.name) : tx('Hoy no toca según tu plan: cualquier entreno suma', 'Not planned today: any workout counts')} · +${PUNTOS.entreno}${P.plan || (!hecho && r) ? ' +' + PUNTOS.plan : ''}</div></div>${check(hecho)}${!hecho && r ? `<button class="btn sm pri" data-a="mpRutina" data-v="${r.id}">${tx('Empezar', 'Start')}</button>` : ''}</div>
      ${ext(x1)}${ext(x2)}
      <div class="row" style="gap:10px;padding:10px 0;border-top:1px solid var(--line);align-items:flex-start"><span class="si">${I('book', 20)}</span><div class="grow"><div class="b sm">${tx('Contenido del día', 'Content of the day')} · +${PUNTOS.contenido}</div><div class="sm" style="line-height:1.45;margin-top:4px">${d.contenido ? tx(cont[0], cont[1]) : `<span class="mut">${tx('Toca «Ver» para descubrirlo.', 'Tap «Show» to reveal it.')}</span>`}</div></div>${check(d.contenido)}${d.contenido ? '' : `<button class="btn sm pri" data-a="mpContenido">${tx('Ver', 'Show')}</button>`}</div>
      <div class="xs mut" style="padding:8px 0;border-top:1px solid var(--line)">${tx(`También suman: 2 comidas registradas (+${PUNTOS.comida}) y tu meta de agua (+${PUNTOS.agua}).`, `Also counts: 2 meals logged (+${PUNTOS.comida}) and your water goal (+${PUNTOS.agua}).`)} ${P.comida ? '✓ ' + tx('comidas', 'meals') : ''} ${P.agua ? '✓ ' + tx('agua', 'water') : ''}</div></div>`;
  }
  function calendarioHtml(s) {
    const k0 = s.starts, hoy = hoyK(), first = new Date(kDe(k0)), pad = (first.getDay() + 6) % 7, n = largo(s);
    const dias = [...Array(7)].map((_, i) => new Date(2026, 10, 23 + i).toLocaleDateString(LOC(), {weekday: 'narrow'}));
    let h = `<div class="card" style="padding:12px"><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center">` + dias.map(d => `<div class="xs mut b">${d}</div>`).join('');
    for (let i = 0; i < pad; i++) h += '<div></div>';
    for (let i = 0; i < n; i++) {
      const k = sumaDias(k0, i), fut = k > hoy, p = fut ? null : puntosDia(k), plan = S.plan && S.plan.days && S.plan.days.includes(new Date(kDe(k)).getDay());
      const a = p ? Math.min(1, p.total / 100) : 0, bg = p && p.total ? `rgba(255,122,26,${0.18 + a * 0.62})` : 'var(--bg2,rgba(255,255,255,.04))';
      h += `<button data-a="mpDia" data-v="${k}" style="aspect-ratio:1;border-radius:10px;border:${k === hoy ? '2px solid var(--ac)' : '1px solid var(--line)'};background:${bg};color:inherit;padding:0;position:relative;opacity:${fut ? .55 : 1}"><span class="xs b">${+k.slice(8)}</span>${plan ? `<span style="position:absolute;left:50%;bottom:4px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:${fut ? 'var(--mut)' : 'var(--fg,#fff)'}"></span>` : ''}</button>`;
    }
    return h + `</div><div class="xs mut" style="margin-top:8px">${tx('Más color, más puntos. El punto marca los días de tu plan.', 'More colour, more points. The dot marks your plan days.')}</div></div>`;
  }
  function retosHtml() {
    const L = retos(); if (!L.length) return `<div class="card sm mut">${tx('Los retos empiezan con la temporada.', 'Challenges start with the season.')}</div>`;
    const nom = {semana: tx('Semana', 'Week'), mes: tx('Mes', 'Month'), temporada: tx('Temporada', 'Season')};
    return `<div class="card" style="padding:4px 14px">` + L.map((r, i) => `<div style="padding:10px 0;${i ? 'border-top:1px solid var(--line)' : ''}"><div class="row" style="gap:8px"><span class="tag">${nom[r.tipo]}</span><span class="grow b sm">${tx(r.t, r.en)}</span><span class="xs ${r.ok ? '' : 'mut'}" style="${r.ok ? 'color:var(--ac);font-weight:800' : ''}">${r.ok ? '✓ +' + r.bono : r.v + '/' + r.meta}</span></div>
      <div style="height:5px;border-radius:3px;background:var(--line);margin-top:6px;overflow:hidden"><div style="height:100%;width:${Math.round(r.v / r.meta * 100)}%;background:var(--ac)"></div></div></div>`).join('') + `</div>`;
  }

  /* ---------- Capas ---------- */
  SCREENS.mpLiga = () => {
    const L = M.cache.liga && M.cache.liga.s === temporada().id ? M.cache.liga.filas : null;
    let b = `<p class="sm mut" style="margin-top:0">${nombreT(temporada())}. ${tx('Primero cuenta el rango; a igual rango, los puntos. Todos ven tu mote; tu nombre, solo tus amigos.', 'Rank comes first; with the same rank, points. Everyone sees your nickname; only friends see your name.')}</p>`;
    if (!L) b += `<div class="card sm mut">${tx('Cargando…', 'Loading…')}</div>`;
    else if (!L.length) b += `<div class="card sm mut">${tx('Todavía nadie ha sumado puntos esta temporada.', 'Nobody has scored this season yet.')}</div>`;
    else b += `<div class="card" style="padding:4px 12px">` + L.map((f, i) => `<div class="row" style="gap:10px;padding:10px 0;${i ? 'border-top:1px solid var(--line)' : ''};${f.soy_yo ? 'color:var(--ac)' : ''}"><b style="width:28px;text-align:right">${f.pos}</b><div class="grow" style="min-width:0"><div class="b sm">${esc(f.nombre || f.mote)}${f.soy_yo ? ' · ' + tx('tú', 'you') : ''}</div><div class="xs mut">${f.nombre ? esc(f.mote) + ' · ' : ''}${rango(f.nivel).txt}</div></div><b class="sm">${fmtNum(f.puntos)}</b></div>`).join('') + `</div>`;
    return lhdr(tx('Liga', 'League')) + `<div class="lbody">${b}</div>`;
  };
  SCREENS.mpAmigos = () => {
    const j = (cuenta() || {}).jugador || {}, A0 = M.cache.jugadores || [], D = M.cache.diasAmigos || [];
    let b = `<div class="card" style="text-align:center"><div class="xs mut b" style="letter-spacing:1px">${tx('TU CÓDIGO DE AMIGO', 'YOUR FRIEND CODE')}</div><div style="font-size:30px;font-weight:900;letter-spacing:4px;margin:6px 0" translate="no">${esc(j.friend_code || '······')}</div>
      <button class="btn sm" data-a="mpCopiar">${I('copy', 16)} ${tx('Copiar', 'Copy')}</button><p class="xs mut" style="margin-bottom:0">${tx('Pásaselo a tu amigo para que te añada. Al añadirse, los dos veis vuestro nombre y vuestra actividad.', 'Give it to your friend so they can add you. Once added, you both see each other’s name and activity.')}</p></div>
      <div class="field" style="margin-top:12px"><label>${tx('Añadir con un código', 'Add with a code')}</label><div class="row" style="gap:8px"><input id="mpCod" maxlength="6" autocapitalize="characters" placeholder="ABC123" style="text-transform:uppercase;flex:1"><button class="btn pri" data-a="mpAnadir">${tx('Añadir', 'Add')}</button></div></div>`;
    b += `<div class="sec">${tx('Tus amigos', 'Your friends')}</div>`;
    if (!A0.length) b += `<div class="card sm mut">${tx('Aún no tienes amigos en Mi PandarIA.', 'No friends in Mi PandarIA yet.')}</div>`;
    else b += `<div class="card" style="padding:4px 12px">` + A0.map((f, i) => { const ds = D.filter(x => x.user_id === f.user_id), sem = ds.filter(x => x.day > sumaDias(hoyK(), -7)), hoy = ds.find(x => x.day === hoyK());
      return `<div class="row" style="gap:10px;padding:10px 0;${i ? 'border-top:1px solid var(--line)' : ''}"><div class="grow"><div class="b sm">${esc(f.display_name || f.mote)}</div><div class="xs mut">${esc(f.mote)} · ${tx('hoy', 'today')} ${hoy ? hoy.points : 0} · ${tx('7 días', '7 days')} ${sem.reduce((a, x) => a + x.points, 0)} ${tx('pts', 'pts')}</div></div><button class="ibtn" data-a="mpQuitar" data-v="${f.user_id}" aria-label="${tx('Quitar', 'Remove')}">${I('x', 18)}</button></div>`; }).join('') + `</div>`;
    return lhdr(tx('Amigos', 'Friends')) + `<div class="lbody">${b}</div>`;
  };
  SCREENS.mpTrofeos = () => {
    const T = M.cache.trofeos || [];
    let b = `<p class="sm mut" style="margin-top:0">${tx('Los retos y los puntos se reinician cada temporada. Lo único que queda es el trofeo de cómo la terminaste.', 'Challenges and points reset each season. All that remains is the trophy for how you finished it.')}</p>`;
    b += T.length ? `<div class="card" style="padding:4px 12px">` + T.map((t, i) => `<div class="row" style="gap:10px;padding:12px 0;${i ? 'border-top:1px solid var(--line)' : ''}"><span style="color:var(--ac)">${I('trophy', 26)}</span><div class="grow"><div class="b">${rango(t.nivel).txt}</div><div class="xs mut">${esc(nombreT({id: t.temporada, name: t.nombre}))} · ${tx(`puesto ${t.pos} de ${t.jugadores}`, `place ${t.pos} of ${t.jugadores}`)} · ${fmtNum(t.puntos)} ${tx('pts', 'pts')}</div></div></div>`).join('') + `</div>`
      : `<div class="card sm mut">${tx('Tu primer trofeo llegará cuando termine la temporada.', 'Your first trophy arrives when the season ends.')}</div>`;
    return lhdr(tx('Trofeos', 'Trophies')) + `<div class="lbody">${b}</div>`;
  };
  SCREENS.mpComo = () => {
    const s = temporada(), filas = [[tx('Entreno del día (cualquiera)', 'Workout of the day (any)'), PUNTOS.entreno], [tx('…y si es un día de tu plan', '…and if it is a plan day'), PUNTOS.plan], [tx('Cada actividad extra de PandarIA (2 al día)', 'Each extra PandarIA activity (2 a day)'), PUNTOS.extra], [tx('Contenido del día', 'Content of the day'), PUNTOS.contenido], [tx('2 comidas registradas', '2 meals logged'), PUNTOS.comida], [tx('Meta de agua cumplida', 'Water goal reached'), PUNTOS.agua]];
    const b = `<div class="card" style="padding:4px 12px">${filas.map(([t, p], i) => `<div class="row" style="padding:10px 0;${i ? 'border-top:1px solid var(--line)' : ''}"><span class="grow sm">${t}</span><b>+${p}</b></div>`).join('')}</div>
      <p class="sm" style="line-height:1.5">${tx(`Los retos dan un bono el día que los completas: semana +20, mes +30, temporada +50. Máximo ${PUNTOS.max} puntos al día.`, `Challenges give a bonus on the day you complete them: week +20, month +30, season +50. Max ${PUNTOS.max} points a day.`)}</p>
      <p class="sm" style="line-height:1.5">${tx(`Hay 7 rangos (${RANGOS.map(r => r[0]).join(', ')}) de 5 niveles cada uno (V a I). En ${nombreT(s)} cada nivel cuesta ${paso(s)} puntos. Al empezar una temporada nueva bajas 2 rangos desde donde terminaste.`, `There are 7 ranks (${RANGOS.map(r => r[1]).join(', ')}) of 5 levels each (V to I). In ${nombreT(s)} each level costs ${paso(s)} points. A new season starts you 2 ranks below where you finished.`)}</p>
      <p class="sm mut" style="line-height:1.5">${tx('Las actividades extra van a tu historial sin gastar huecos de rutinas. Con la cuenta gratuita cada una se hace una vez al día; con Premium puedes repetirlas (sin puntos extra).', 'Extra activities go to your history without using routine slots. With the free account each one can be done once a day; with Premium you can repeat them (no extra points).')}</p>`;
    return lhdr(tx('Cómo se ganan puntos', 'How to earn points')) + `<div class="lbody">${b}</div>`;
  };
  SCREENS.mpDia = p => {
    const k = p.k, P = k > hoyK() ? null : puntosDia(k), [x1, x2] = extrasDe(k);
    const L = P ? [[tx('Entreno', 'Workout'), P.entreno + P.plan], [tx('Actividades extra', 'Extra activities'), P.extra], [tx('Contenido', 'Content'), P.contenido], [tx('Comidas', 'Meals'), P.comida], [tx('Agua', 'Water'), P.agua], [tx('Retos', 'Challenges'), P.retos]] : [];
    const b = P ? `<div class="card" style="text-align:center"><div style="font-size:34px;font-weight:900">${P.total}</div><div class="xs mut">${tx('puntos', 'points')}</div></div><div class="card" style="padding:4px 12px">${L.map(([t, v], i) => `<div class="row" style="padding:10px 0;${i ? 'border-top:1px solid var(--line)' : ''}"><span class="grow sm">${t}</span><b class="${v ? '' : 'mut'}">${v ? '+' + v : '—'}</b></div>`).join('')}</div>`
      : `<div class="card sm">${tx('Actividades extra de ese día:', 'Extra activities that day:')} <b>${tx(x1.es, x1.en)}</b> ${tx('y', 'and')} <b>${tx(x2.es, x2.en)}</b>.</div>`;
    return lhdr(fmtD(k, {weekday: 'long', day: 'numeric', month: 'long'})) + `<div class="lbody">${b}</div>`;
  };
  SCREENS.mpCuenta = () => {
    const c = cuenta() || {}, j = c.jugador || {}, otras = Object.entries(M.cuentas).filter(([id]) => id !== M.activa);
    const b = `<div class="card"><div class="xs mut b" style="letter-spacing:1px">${tx('CUENTA ACTIVA', 'ACTIVE ACCOUNT')}</div><div class="b" style="margin-top:4px">${esc(c.email || '')}</div><div class="sm mut">${tx('Mote', 'Nickname')}: <b translate="no">${esc(j.mote || '')}</b> · ${tx('Nombre para amigos', 'Name for friends')}: ${esc(j.display_name || '—')}</div></div>
      <div class="card" style="padding:0 12px;margin-top:12px">${otras.map(([id, o]) => fila('mpUsar', 'user', tx('Usar ', 'Use ') + esc(o.email || ''), tx('Cambiar a esta cuenta', 'Switch to this account')).replace('data-a="mpUsar"', `data-a="mpUsar" data-v="${id}"`)).join('')}
      ${fila('mpOtra', 'plus', tx('Entrar con otra cuenta de Google', 'Sign in with another Google account'), tx('Tus entrenos de hoy en adelante cuentan para la cuenta activa', 'Your workouts from now on count for the active account'))}
      ${fila('mpNombre', 'edit', tx('Cambiar el nombre para amigos', 'Change the name for friends'), tx('El mote no se puede cambiar', 'The nickname cannot be changed'))}
      ${fila('mpCerrar', 'lock', tx('Cerrar sesión en Mi PandarIA', 'Sign out of Mi PandarIA'), tx('Tus puntos se quedan en el servidor', 'Your points stay on the server'))}
      ${fila('mpSalir', 'trash', tx('Salir de Mi PandarIA y borrar mis datos del servidor', 'Leave Mi PandarIA and delete my server data'), tx('Mote, puntos y amigos de esta cuenta', 'Nickname, points and friends of this account'))}</div>`;
    return lhdr(tx('Tu cuenta de Mi PandarIA', 'Your Mi PandarIA account')) + `<div class="lbody">${b}</div>`;
  };

  /* ---------- Acciones ---------- */
  const conEspera = async (fn, ok) => { try { toast(tx('Conectando…', 'Connecting…')); await fn(); if (ok) toast(ok); } catch (e) { toast(tx('No se pudo: ', 'Could not: ') + (e.message || e)); } render.keep = true; render(); if (LAYERS.length) refreshTop(); };
  A.mpEntrar = () => conEspera(() => entrar(false).then(cargarLiga), tx('¡Dentro de Mi PandarIA!', 'You are in Mi PandarIA!'));
  A.mpOtra = () => { closeLayer(); conEspera(() => entrar(true).then(cargarLiga), tx('Cuenta cambiada', 'Account switched')); };
  A.mpUsar = id => { if (!M.cuentas[id]) return; M.activa = id; M.cache = {}; guardar(); closeLayer(); conEspera(() => sincronizar(true).then(cargarLiga), tx('Cuenta cambiada', 'Account switched')); };
  A.mpCuenta = () => openLayer('mpCuenta', {});
  A.mpCerrar = () => { const id = M.activa; delete M.cuentas[id]; M.activa = Object.keys(M.cuentas)[0] || null; M.cache = {}; guardar(); closeLayer(); render(); };
  A.mpSalir = () => confirmBox({title: tx('¿Borrar tus datos de Mi PandarIA?', 'Delete your Mi PandarIA data?'), text: tx('Se borran del servidor tu mote, tus puntos y tus amistades de esta cuenta. Tus entrenos de la app no se tocan.', 'Your nickname, points and friendships for this account are deleted from the server. Your app workouts are not touched.'), okText: tx('Borrar', 'Delete'), danger: true,
    ok: () => conEspera(async () => { await rpc('mp_salir'); const id = M.activa; delete M.cuentas[id]; delete M.dias[id]; delete M.enviado[id]; delete M.retos[id]; M.activa = Object.keys(M.cuentas)[0] || null; M.cache = {}; guardar(); closeLayer(); }, tx('Datos borrados', 'Data deleted'))});
  A.mpNombre = () => { const j = (cuenta() || {}).jugador || {}; openModal(`<div class="modal"><h3>${tx('Nombre para tus amigos', 'Name for your friends')}</h3><input id="mpNom" maxlength="40" value="${esc(j.display_name || '')}"><div class="row" style="gap:8px;margin-top:14px"><button class="btn grow" data-a="closeModal">${tx('Cancelar', 'Cancel')}</button><button class="btn pri grow" data-a="mpNombreOk">${tx('Guardar', 'Save')}</button></div></div>`, {center: true}); };
  A.mpNombreOk = () => { const v = (document.getElementById('mpNom') || {}).value || ''; closeModal(); conEspera(async () => { cuenta().jugador = await rpc('mp_entrar', {p_nombre: v.trim()}); guardar(); }, tx('Nombre guardado', 'Name saved')); };
  A.mpLiga = () => { openLayer('mpLiga', {}); cargarLiga().then(() => refreshTop()); };
  A.mpAmigos = () => { openLayer('mpAmigos', {}); cargarLiga().then(() => refreshTop()); };
  A.mpTrofeos = () => { openLayer('mpTrofeos', {}); cargarLiga().then(() => refreshTop()); };
  A.mpComo = () => openLayer('mpComo', {});
  A.mpDia = k => openLayer('mpDia', {k});
  A.mpCopiar = () => { const c = ((cuenta() || {}).jugador || {}).friend_code || ''; try { navigator.clipboard.writeText(c).then(() => toast(tx('Código copiado', 'Code copied')), () => toast(c)); } catch (e) { toast(c); } };
  A.mpAnadir = () => { const v = ((document.getElementById('mpCod') || {}).value || '').trim().toUpperCase(); if (v.length !== 6) { toast(tx('El código tiene 6 caracteres', 'The code has 6 characters')); return; }
    conEspera(async () => { const r = await rpc('mp_amigo_anadir', {p_codigo: v}); await cargarLiga(); const f = Array.isArray(r) ? r[0] : r; toast(tx('Añadido: ', 'Added: ') + ((f && (f.display_name || f.mote)) || '')); }); };
  A.mpQuitar = id => confirmBox({title: tx('¿Quitar a este amigo?', 'Remove this friend?'), okText: tx('Quitar', 'Remove'), danger: true, ok: () => conEspera(async () => { await rpc('mp_amigo_quitar', {p_user: id}); await cargarLiga(); })});
  A.mpContenido = () => { const d = misDias()[hoyK()] = misDias()[hoyK()] || {}; d.contenido = true; guardar(); sincPronto(); render.keep = true; render(); };
  A.mpRutina = id => { if (typeof A.startWorkout === 'function') A.startWorkout(id); };
  // Actividad extra: usa el temporizador de intervalos de la app y se guarda en el historial marcada como de Mi PandarIA
  let extraEnCurso = null;
  A.mpExtra = kx => {
    const x = EXTRAS.find(e => e.k === kx); if (!x) return;
    const repe = extraHecho(hoyK(), x); if (repe && !(typeof isPremium === 'function' && isPremium())) { toast(tx('Con la cuenta gratuita cada actividad se hace una vez al día', 'With the free account each activity is done once a day')); return; }
    const c = Object.assign(intDefaults(), clone(x.cfg)); extraEnCurso = {k: x.k, day: hoyK(), name: 'Mi PandarIA · ' + tx(x.es, x.en), repe};
    INT = {cfg: c, ph: intPhases(c), i: 0, t0: Date.now(), paused: null, rounds: 0, start: Date.now(), done: [], lastSec: null};
    openLayer('intRun', {}); keepAwake(); intAnnounce();
  };
  const _sis = saveIntSession;
  saveIntSession = function (session) {
    if (extraEnCurso && session && session.routineId === '__int') { session.mp = {k: extraEnCurso.k, day: extraEnCurso.day, repe: extraEnCurso.repe || undefined}; session.routineName = extraEnCurso.name; if (M.activa) M.duenos[session.id] = M.activa; guardar(); }
    extraEnCurso = null; const r = _sis.apply(this, arguments); sincPronto(); return r;
  };
  // una repetición (Premium) no suma: solo cuenta la primera de cada actividad (ya lo hace el Set de puntosDia)

  /* ---------- Pestaña ---------- */
  const _nav = renderNav;
  renderNav = function () {
    _nav.apply(this, arguments);
    const nav = document.getElementById('nav'); if (!nav || nav.querySelector('[data-v="mipandaria"]')) return;
    const b = document.createElement('button'); b.className = TAB === 'mipandaria' ? 'on' : ''; b.dataset.a = 'tab'; b.dataset.v = 'mipandaria';
    b.innerHTML = `<span class="pill">${I('trophy', 22)}</span>${tx('Mi PandarIA', 'Mi PandarIA')}`; b.setAttribute('translate', 'no');
    const hist = nav.querySelector('[data-v="historial"]'); nav.insertBefore(b, hist || null);
    if (TAB === 'mipandaria') nav.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  };
  const _va = viewAjustes;
  viewAjustes = function () { if (TAB === 'mipandaria') { setTimeout(() => { if (cuenta()) sincPronto(); }, 0); return viewMP(); } return _va.apply(this, arguments); };
  const _save = save;
  save = function () { const r = _save.apply(this, arguments); try { if (cuenta() && asignar()) sincPronto(); } catch (e) {} return r; };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && cuenta()) sincPronto(); });
  window.MP.puntosDia = puntosDia; window.MP.retos = retos; window.MP.sincronizar = sincronizar; window.MP.cargarLiga = cargarLiga; window.MP.rango = rango; window.MP.extrasDe = extrasDe; window.MP.entrar = entrar;
  try { renderNav(); } catch (e) {}
  if (cuenta()) setTimeout(() => sincronizar(false), 4000);
})();
