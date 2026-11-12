/* ============ PandarIA Fit · Integración nativa Android (fases 1 a 7) ============
   Se carga después de index.html. En el navegador no hace nada:
   solo actúa dentro de la app instalada (Capacitor). */
(function(){
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const P = name => (C.Plugins && C.Plugins[name]) || (C.registerPlugin ? C.registerPlugin(name) : null);
  const App = P('App'), Haptics = P('Haptics'), StatusBar = P('StatusBar'), Splash = P('SplashScreen'),
        FS = P('Filesystem'), Share = P('Share'), TTS = P('TextToSpeech'), Awake = P('KeepAwake');
  const safe = (fn) => { try { const r = fn(); if (r && r.catch) r.catch(()=>{}); return r; } catch(e){} };
  const BACKUP = 'pandaria-backup.json', BACKUP_PREV = 'pandaria-backup-anterior.json';
  document.documentElement.classList.add('native-android');

  /* ---------- 14. Cuenta de Google para la copia en Drive (0.9) ---------- */
  // Inicio de sesión con el sistema de Android (Credential Manager) y permiso drive.appdata:
  // solo la carpeta oculta de la app en el Drive del usuario. El ID de cliente web no es secreto.
  const SL = P('SocialLogin');
  const GOOGLE_WEB_ID = '879792644217-pd24e4p8954m522jvjf1mhj0skg74t2u.apps.googleusercontent.com';
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  let slInit = null, tok = null, tokAt = 0;
  const slReady = () => slInit || (slInit = SL.initialize({google: {webClientId: GOOGLE_WEB_ID, mode: 'online'}}).catch(e => { slInit = null; throw e; }));
  const claims = jwt => { try{ const b = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))))); }catch(e){ return {}; } };
  safe(() => { const D = P('Device'); return D && D.getInfo().then(i => { window.PF_MODELO = [i.manufacturer, i.model].filter(Boolean).join(' '); }); });
  if (SL) window.PFCloud = {
    ok: true,
    async signIn(){
      await slReady();
      const res = await SL.login({provider: 'google', options: {scopes: [DRIVE_SCOPE]}});
      const r = (res && res.result) || {}, pr = r.profile || {}, c = r.idToken ? claims(r.idToken) : {};
      const at = r.accessToken && r.accessToken.token;
      if (!at) throw new Error('drive-scope');
      tok = at; tokAt = Date.now();
      const sub = c.sub || pr.id; if (!sub) throw new Error('auth');
      return {sub: String(sub), email: c.email || pr.email || '', name: c.name || pr.name || '', given: c.given_name || pr.givenName || ''};
    },
    async token(force){
      if (!force && tok && Date.now() - tokAt < 45 * 60000) return tok;
      try{
        await slReady();
        if (force || !tok) { try{ await SL.refresh({provider: 'google', options: {scopes: [DRIVE_SCOPE]}}); }catch(e){} }
        const a = await SL.getAuthorizationCode({provider: 'google'});
        if (a && a.accessToken){ tok = a.accessToken; tokAt = Date.now(); return tok; }
        await SL.refresh({provider: 'google', options: {scopes: [DRIVE_SCOPE]}});
        const b = await SL.getAuthorizationCode({provider: 'google'});
        if (b && b.accessToken){ tok = b.accessToken; tokAt = Date.now(); return tok; }
      }catch(e){}
      tok = null; return null;
    },
    async signOut(){ tok = null; try{ await slReady(); await SL.logout({provider: 'google'}); }catch(e){} }
  };

  /* ---------- 1. Datos a prueba de borrados ---------- */
  // Si el WebView perdió sus datos pero existe la copia nativa, la recupera y recarga.
  async function restoreIfNeeded(){
    if (localStorage.getItem(KEY)) return false;
    for (const path of [BACKUP, BACKUP_PREV]){
      try{
        const r = await FS.readFile({path, directory:'DATA', encoding:'utf8'});
        const d = JSON.parse(r.data);
        if (d && Array.isArray(d.routines) && Array.isArray(d.sessions)){
          localStorage.setItem(KEY, r.data);
          sessionStorage.setItem('pf-restored','1');
          location.reload();
          return true;
        }
      }catch(e){}
    }
    return false;
  }
  let bkT = null, lastPrevDay = null;
  async function writeBackup(){
    clearTimeout(bkT);
    const data = localStorage.getItem(KEY); if (!data) return;
    try{
      const today = new Date().toDateString();
      if (lastPrevDay !== today){
        lastPrevDay = today;
        try{ const old = await FS.readFile({path:BACKUP, directory:'DATA', encoding:'utf8'});
          await FS.writeFile({path:BACKUP_PREV, directory:'DATA', encoding:'utf8', data:old.data}); }catch(e){}
      }
      await FS.writeFile({path:BACKUP, directory:'DATA', encoding:'utf8', data});
    }catch(e){}
  }
  const scheduleBackup = () => { clearTimeout(bkT); bkT = setTimeout(writeBackup, 3000); };
  const _save = save;
  save = function(now){ _save(now); if (now) setTimeout(writeBackup, 50); else scheduleBackup(); if (scheduleNotifs) scheduleNotifs(); if (window.pushWidgets) window.pushWidgets(); };

  /* ---------- 2. Vibración nativa ---------- */
  vibrate = function(p){
    if (!S.settings.vibrate || !Haptics) return;
    const arr = Array.isArray(p) ? p : [p || 200];
    let t = 0;
    arr.forEach((d, i) => {
      if (i % 2 === 0){
        const dur = Math.max(1, +d || 0);
        setTimeout(() => safe(() => dur <= 40 ? Haptics.impact({style: dur <= 15 ? 'LIGHT' : 'MEDIUM'}) : Haptics.vibrate({duration: dur})), t);
      }
      t += +d || 0;
    });
  };

  /* ---------- 3. Voz nativa ---------- */
  // Elige la voz instalada en el teléfono: es-US, es-MX, es-ES… (antes pedía solo es-ES y fallaba en silencio)
  let ttsLang = null, ttsWarned = false;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function pickLang(){
    const want = EN_LANG() ? ['en-US','en-GB','en'] : ['es-US','es-MX','es-419','es-ES','es'];
    let langs = [];
    for (let i = 0; i < 3 && !langs.length; i++){
      try{ langs = (await TTS.getSupportedLanguages()).languages || []; }catch(e){}
      if (!langs.length) await wait(700);
    }
    const low = langs.map(x => String(x).toLowerCase().replace('_','-'));
    for (const w of want){ const k = low.indexOf(w.toLowerCase()); if (k >= 0) return langs[k]; }
    const k = low.findIndex(x => x.startsWith(want[0].slice(0,2))); if (k >= 0) return langs[k];
    for (const w of want){ try{ if ((await TTS.isLanguageSupported({lang:w})).supported) return w; }catch(e){} }
    return null;
  }
  function ttsHelp(){
    if (ttsWarned) return; ttsWarned = true;
    confirmBox({title:'Falta la voz en español', text:'Tu teléfono no tiene instalada una voz en español para leer los avisos. Instálala en los ajustes de <b>Texto a voz</b> (motor de Google o de Samsung) y vuelve a activar los avisos por voz.',
      okText:'Instalar voz', ok:() => safe(() => TTS.openInstall()), noText:'Ahora no'});
  }
  speak = function(text){
    if (!S.settings.voice || !TTS || !text) return;
    (async () => {
      const k = EN_LANG() ? 'en' : 'es';
      if (!ttsLang || ttsLang.k !== k) ttsLang = {k, l: await pickLang()};
      if (!ttsLang.l){ ttsLang = null; return ttsHelp(); }
      for (let i = 0; i < 3; i++){
        try{ await TTS.speak({text:String(text), lang:ttsLang.l, rate:1.0, pitch:1.0, volume:1.0}); return; }
        catch(e){
          const m = String(e && (e.message || e));
          if (/language/i.test(m)){ ttsLang = null; return ttsHelp(); }
          if (/interrupt|stop/i.test(m)) return;
          await wait(700);
        }
      }
    })();
  };

  /* ---------- 4. Pantalla siempre encendida ---------- */
  let awakeOn = false;
  keepAwake = async function(){
    if (S.settings.awake === false || !Awake || awakeOn) return;
    awakeOn = true; safe(() => Awake.keepAwake());
  };
  releaseAwake = function(){ if (!Awake) return; awakeOn = false; safe(() => Awake.allowSleep()); };

  /* ---------- 5. Barra de estado y tema ---------- */
  function syncBars(){
    const light = S.settings.theme === 'light';
    safe(() => StatusBar.setStyle({style: light ? 'LIGHT' : 'DARK'}));
    safe(() => StatusBar.setBackgroundColor({color: light ? '#ffffff' : '#12151a'}));
  }
  const _applyTheme = applyTheme;
  applyTheme = function(){ _applyTheme(); syncBars(); };

  /* ---------- 6. Botón atrás de Android ---------- */
  let lastBack = 0;
  function onBack(){
    const ov = document.getElementById('restov');
    if (ov && !ov.classList.contains('hide')){ closeRestOv(); return; }
    if (MODALS.length){ goBack(); return; }
    if (LAYERS.length){
      const top = LAYERS[LAYERS.length-1];
      if (top.t === 'intRun' && typeof INT !== 'undefined' && INT){ A.intStop(); return; }
      if (top.t === 'onboard') return;
      goBack(); return;
    }
    if (TAB !== 'rutinas'){ A.tab('rutinas'); return; }
    const busy = !!S.active || (typeof INT !== 'undefined' && INT);
    if (Date.now() - lastBack < 2000){
      save(true); writeBackup();
      if (busy) safe(() => App.minimizeApp()); else safe(() => App.exitApp());
      return;
    }
    lastBack = Date.now();
    toast(busy ? 'Pulsa atrás otra vez para minimizar. Tu entreno sigue en curso.' : 'Pulsa atrás otra vez para salir');
  }

  /* ---------- 7. Archivos reales: exportar, compartir y guardar ---------- */
  const stamp = () => new Date().toISOString().slice(0,10);
  const toB64 = txt => { const b = new TextEncoder().encode(txt); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  async function shareFile(name, data, isBase64, title){
    const opts = {path: name, directory: 'CACHE', data};
    if (!isBase64) opts.encoding = 'utf8';
    const r = await FS.writeFile(opts);
    try { await Share.share({title, dialogTitle: title, files: [r.uri]}); }
    catch(e){ if (!/cancel/i.test(String(e && (e.message || e)))) throw e; }
  }
  async function saveToDocuments(name, data, isBase64){
    const opts = {path: 'PandarIA Fit/' + name, directory: 'DOCUMENTS', data, recursive: true};
    if (!isBase64) opts.encoding = 'utf8';
    await FS.writeFile(opts);
    toast('Guardado en Documentos › PandarIA Fit');
  }
  const fail = () => toast('No se pudo completar. Prueba con Compartir.');
  const backupText = () => JSON.stringify(S);

  A.exportFile = () => shareFile(`pandaria-fit-copia-${stamp()}.json`, backupText(), false, 'Copia de seguridad de PandarIA Fit').catch(fail);
  A.exportData = () => sheet('Exportar copia de seguridad', [
    {icon:'upload', label:'Compartir copia', desc:'Envíala a Google Drive, WhatsApp, correo u otra app.', fn:() => A.exportFile()},
    {icon:'download', label:'Guardar en el teléfono', desc:'Se guarda en Documentos › PandarIA Fit.', fn:() => saveToDocuments(`pandaria-fit-copia-${stamp()}.json`, backupText(), false).catch(fail)},
    {icon:'copy', label:'Copiar al portapapeles', desc:'Para pegarla en una nota o un mensaje.', fn:() => A.exportCopy()}
  ]);
  A.exportCSV = () => {
    const name = `pandaria-fit-entrenos-${stamp()}.csv`, csv = '﻿' + buildCSV();
    sheet('Exportar a Excel (CSV)', [
      {icon:'upload', label:'Compartir archivo .csv', desc:'Ábrelo con Excel, Google Sheets o envíalo.', fn:() => shareFile(name, csv, false, 'Entrenos de PandarIA Fit').catch(fail)},
      {icon:'download', label:'Guardar en el teléfono', desc:'Se guarda en Documentos › PandarIA Fit.', fn:() => saveToDocuments(name, csv, false).catch(fail)},
      {icon:'copy', label:'Copiar al portapapeles', desc:'Pégalo directamente en una hoja de cálculo.', fn:() => { const t = buildCSV(); try{ navigator.clipboard.writeText(t).then(() => toast('CSV copiado'), () => fallbackCopy(t)); }catch(e){ fallbackCopy(t); } }}
    ]);
  };
  A.shareSession = sid => {
    const s = S.sessions.find(x => x.id === sid); if (!s) return;
    const url = shareCardCanvas(s).toDataURL('image/png'), b64 = url.split(',')[1];
    openModal(`<div class="sheet"><div class="grab"></div><h3>Compartir entreno</h3><img src="${url}" alt="Tarjeta del entreno" style="width:100%;border-radius:16px;display:block">
      <div class="row" style="gap:8px;margin-top:14px"><button class="btn grow" data-a="cbm" data-v="${cb(() => saveToDocuments('pandaria-fit-entreno-' + stamp() + '.png', b64, true).catch(fail))}">${I('download',18)} Guardar</button>
      <button class="btn pri grow" data-a="cbm" data-v="${cb(() => shareFile('pandaria-fit-entreno.png', b64, true, 'Mi entreno en PandarIA Fit').catch(fail))}">${I('upload',18)} Compartir</button></div></div>`);
  };

  /* ---------- 9. Notificaciones 2.0 ---------- */
  const LN = P('LocalNotifications');
  const NDEF = {
    on:true, asked:false, quiet:true, quietFrom:'22:00', quietTo:'08:00',
    train:true, trainLead:0, rest:true,
    water:true, waterEvery:120, waterFrom:'09:00', waterTo:'21:00', waterDays:[0,1,2,3,4,5,6], waterAfterGoal:true, waterSmart:true,
    fastHalf:true, fastGoal:true, fastPhases:{4:true, 8:true, 12:true, 16:true, 18:true, 24:true},
    fastWin:true, fastWinLead:60, fastDaily:false, fastDailyTime:'20:00',
    streak:true, streakDay:0, streakTime:'11:00',
    report:true, reportDay:1, reportTime:'09:00',
    pandaria:true, pandariaTime:'10:00', backup:true
  };
  const NS = () => {
    const n = S.settings.notif = Object.assign({}, NDEF, S.settings.notif || {});
    n.fastPhases = Object.assign({}, NDEF.fastPhases, n.fastPhases || {});
    if (n.fast === false){ n.fastHalf = n.fastGoal = n.fastWin = false; delete n.fast; } // ajuste de la versión anterior
    return n;
  };
  const ID = {train:1000, rest:2000, timer:2001, fastGoal:3000, fastHalf:3001, fastWin:3002, fastStart:3003, fastPhase:3010, fastDaily:3030, water:4000, report:5000, streak:6000, pandaria:7000, backup:8000};
  const CHN = {entreno:'pf_entreno', recordatorios:'pf_recordatorios', ayuno:'pf_ayuno', agua:'pf_agua', pandaria:'pf_pandaria'};
  const premium = () => typeof isPremium === 'function' ? isPremium() : true;
  let notifOk = false, exactOk = false, nT = null;

  // Fases del ayuno (aproximadas; varían según la persona)
  const FAST_PHASES = [
    {h:0,  n:'Ayuno iniciado',     t:'Tu cuerpo usa la energía de tu última comida.'},
    {h:4,  n:'Azúcar estable',     t:'El azúcar en sangre se estabiliza. Bebe agua.'},
    {h:8,  n:'Reservas en uso',    t:'Tu cuerpo empieza a tirar de sus reservas de glucógeno.'},
    {h:12, n:'Estado de ayuno',    t:'La insulina baja y el cuerpo usa más grasa como energía.'},
    {h:16, n:'Más quema de grasa', t:'Estás en la zona del 16:8. ¡Buen trabajo!'},
    {h:18, n:'Cetosis leve',       t:'Puede empezar una cetosis leve. Escucha a tu cuerpo.'},
    {h:24, n:'Ayuno largo',        t:'No hay beneficios extra en alargarlo. Considera romperlo con proteína y verduras.'}
  ];
  window.fastPhaseAt = hrs => { let p = FAST_PHASES[0]; for (const x of FAST_PHASES) if (hrs >= x.h) p = x; return p; };
  window.fastNextPhase = hrs => FAST_PHASES.find(x => x.h > hrs) || null;

  async function refreshPerm(){
    if (!LN) return;
    try{ notifOk = (await LN.checkPermissions()).display === 'granted'; }catch(e){}
    try{ exactOk = (await LN.checkExactNotificationSetting()).exact_alarm === 'granted'; }catch(e){ exactOk = true; }
  }
  const hm = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const atTime = (base, s) => { const d = new Date(base); const v = hm(s); d.setHours(Math.floor(v / 60), v % 60, 0, 0); return d; };
  function inQuiet(t){
    const n = NS(); if (!n.quiet) return false;
    const d = new Date(t), v = d.getHours() * 60 + d.getMinutes(), a = hm(n.quietFrom), b = hm(n.quietTo);
    return a <= b ? (v >= a && v < b) : (v >= a || v < b);
  }
  function afterQuiet(t){ // primer momento después de las horas de silencio
    const n = NS(); let d = atTime(t, n.quietTo); if (d.getTime() <= t) d.setDate(d.getDate() + 1); return d;
  }
  const userName = () => { const nm = (S.profile && S.profile.name || '').trim().split(/\s+/)[0]; return nm ? nm + ', ' : ''; };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function mk(id, title, body, when, channel, extra, actionTypeId){
    const n = {id, title, body, largeBody: body, channelId: CHN[channel] || CHN.recordatorios, schedule: {at: when, allowWhileIdle: true}, extra: extra || {},
      smallIcon: 'ic_stat_pandaria', iconColor: '#ff7a1a', isExactNotification: exactOk};
    if (actionTypeId) n.actionTypeId = actionTypeId;
    return n;
  }
  const fmtEvery = m => m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m/60)} h ${m%60} min` : `${m/60} h`;
  const litros = ml => (ml/1000).toLocaleString('es', {maximumFractionDigits: 2});
  const WATER_MSG = ['¡Hora de hidratarse! 💧', 'Tu cuerpo te pide un vaso de agua', 'Un sorbo más cerca de tu meta', 'Pausa de agua: tus músculos lo agradecen', '¿Un vasito? El panda también tiene sed 🐼', 'Hidratarte mejora tu energía y tu rendimiento'];

  async function setupNotif(){
    if (!LN) return;
    try{
      for (const old of ['entreno','recordatorios','ayuno','agua','pandaria']) { try{ await LN.deleteChannel({id: old}); }catch(e){} }
      await LN.createChannel({id:CHN.entreno, name:'Entreno en curso', description:'Fin del descanso y de las series', importance:5, vibration:true, visibility:1});
      await LN.createChannel({id:CHN.recordatorios, name:'Recordatorios de entreno', description:'Cuándo toca entrenar y racha', importance:4, vibration:true, visibility:1});
      await LN.createChannel({id:CHN.ayuno, name:'Ayuno', description:'Fases, meta y ventana de comida', importance:4, vibration:true, visibility:1});
      await LN.createChannel({id:CHN.agua, name:'Agua', description:'Recordatorios para beber agua', importance:4, vibration:true, visibility:1});
      await LN.createChannel({id:CHN.pandaria, name:'PandarIA, informes y copias', description:'Sugerencias, informe semanal y copias de seguridad', importance:3, visibility:1});
      await LN.registerActionTypes({types:[
        {id:'EMPEZAR', actions:[{id:'start', title:'Empezar'}]},
        {id:'AGUA', actions:[{id:'w250', title:'+250 ml'}, {id:'w500', title:'+500 ml'}]},
        {id:'AYUNO', actions:[{id:'faststart', title:'Empezar ayuno'}]},
        {id:'AYUNO_FIN', actions:[{id:'fastend', title:'Terminar ayuno'}]}
      ]});
      LN.addListener('localNotificationActionPerformed', onNotifAction);
    }catch(e){}
    await refreshPerm();
    if (!notifOk && !NS().asked && S.settings.onboarded) setTimeout(askNotifModal, 1500);
    rescheduleAll();
  }
  window.pfNotif = { ok: () => !!notifOk, ask: async () => { NS().asked = true; save(); await enableNotifs(); return notifOk; } };
  function askNotifModal(){
    NS().asked = true; save();
    openModal(`<div class="modal"><h3>🔔 Activa las notificaciones</h3><p class="mut" style="line-height:1.5;margin:0 0 18px">PandarIA te avisará cuando termine el descanso, cuándo toca entrenar, cuándo beber agua y las fases de tu ayuno. Eliges cada aviso en Ajustes › Notificaciones.</p>
      <div class="col" style="gap:8px"><button class="btn pri wide" data-a="cbm" data-v="${cb(enableNotifs)}">Activar</button><button class="btn wide" data-a="closeModal">Ahora no</button></div></div>`, {center:true});
  }
  async function enableNotifs(){
    try{ notifOk = (await LN.requestPermissions()).display === 'granted'; }catch(e){}
    if (!notifOk){ toast('Sin permiso no podemos avisarte. Actívalo en Ajustes de Android › Aplicaciones › PandarIA Fit.'); return; }
    await refreshPerm(); rescheduleAll(); refreshNotifUI();
    if (!exactOk) askExact();
  }
  function askExact(){
    confirmBox({title:'Avisos a la hora exacta', text:'Para que los avisos lleguen justo a tiempo, Android necesita el permiso <b>Alarmas y recordatorios</b>. Se abrirá la pantalla para activarlo; luego vuelve con el botón atrás.',
      okText:'Abrir ajuste', ok: async () => { try{ await LN.changeExactNotificationSetting(); }catch(e){} await refreshPerm(); rescheduleAll(); refreshNotifUI(); }, noText:'Ahora no'});
  }
  function refreshNotifUI(){ if (LAYERS.length && /^nf/.test(LAYERS[LAYERS.length-1].t)) refreshTop(); else { render.keep = true; render(); } }

  var scheduleNotifs = () => { clearTimeout(nT); nT = setTimeout(rescheduleAll, 1200); };
  window.scheduleNotifs = scheduleNotifs;

  function buildList(){
    const n = NS(), list = [], now = Date.now(), DAYMS = 86400000;
    const push = (o, quietRule) => { // quietRule: 'skip' | 'move' | 'none'
      let t = o.schedule.at.getTime();
      if (quietRule !== 'none' && inQuiet(t)){ if (quietRule === 'skip') return; t = afterQuiet(t).getTime(); o.schedule.at = new Date(t); }
      if (t > now + 30000) list.push(o);
    };
    // Recordatorio de entreno (14 días)
    const rem = S.settings.reminders;
    if (n.train && rem.days.length){
      const nx = typeof nextInPlan === 'function' ? nextInPlan() : null, r = nx && nx.r;
      let k = 0;
      for (let d = 0; d < 14; d++){
        const t = atTime(now + d * DAYMS, rem.time); t.setMinutes(t.getMinutes() - (+n.trainLead || 0));
        if (!rem.days.includes(atTime(now + d * DAYMS, rem.time).getDay())) continue;
        if (d === 0 && trainedToday().length) continue;
        const title = r ? `${userName() ? userName() + '¡hoy toca ' : '¡Hoy toca '}${r.name}!` : `${userName() ? userName() + '¡hoy toca entrenar!' : '¡Hoy toca entrenar!'}`;
        push(mk(ID.train + k++, title, r ? `${routineMinutes(r)} min. Tu rutina te espera: toca Empezar y a darle.` : 'Elige una rutina y dale. Unos minutos ya cuentan.', t, 'recordatorios', {go:'train', rid: r && r.id}, r ? 'EMPEZAR' : null), 'none');
      }
    }
    // Agua: repartida en tu horario; tras la meta, menos frecuente; no avisa si bebiste hace poco
    if (n.water){
      const goal = waterGoal(), last = (S.nutri && S.nutri.waterLast) || 0;
      let k = 0;
      for (let d = 0; d < 2 && k < 40; d++){
        const base = now + d * DAYMS, day = new Date(base);
        if (!n.waterDays.includes(day.getDay())) continue;
        const drank = d === 0 ? (typeof waterToday === 'function' ? waterToday() : (nut().water[dayKey()] || 0)) : 0, done = drank >= goal;
        if (done && !n.waterAfterGoal) continue;
        const st = atTime(base, n.waterFrom).getTime(), en = atTime(base, n.waterTo).getTime();
        const step = (done ? n.waterEvery * 2 : n.waterEvery) * 60000;
        for (let t = st, i = 0; t <= en && k < 40; t += step, i++){
          if (t <= now + 60000) continue;
          if (n.waterSmart && d === 0 && last && t - last < 60 * 60000) continue;
          let title, body;
          if (done){ title = '¿Un extra? 💧'; body = `Ya cumpliste tu meta de hoy (${litros(drank)} L). Un vaso más si tienes sed.`; }
          else if (i === 0 && !(d === 0 && drank > 0)){ title = `${userName() ? cap(userName()) + '¡buenos días!' : '¡Buenos días!'} 💧`; body = 'Empieza el día con un vaso de agua.'; }
          else {
            title = WATER_MSG[(i + d) % WATER_MSG.length];
            const expected = goal * Math.min(1, (t - st) / Math.max(1, en - st));
            body = d === 0 ? (drank < expected - 250 ? `Vas un poco atrasado: llevas ${litros(drank)} de ${litros(goal)} L.` : `Vas bien: llevas ${litros(drank)} de ${litros(goal)} L.`) : `Tu meta de hoy: ${litros(goal)} L.`;
          }
          push(mk(ID.water + k++, title, body, new Date(t), 'agua', {go:'water'}, 'AGUA'), 'skip');
        }
      }
    }
    // Ayuno: fases, mitad, meta, ventana de comida y recordatorio diario
    const f = S.nutri && S.nutri.fast;
    if (f && f.screened && !f.blocked){
      if (f.active){
        const g = f.active.goalH, s0 = f.active.start;
        FAST_PHASES.forEach((p, i) => {
          if (!p.h || !n.fastPhases[p.h] || (g && p.h === g)) return;
          const reached = g && p.h > g;
          push(mk(ID.fastPhase + i, `${p.h} h · ${p.n}${reached ? ' 🔥' : ''}`, (reached ? 'Ya pasaste tu meta: sigue si te sientes bien. ' : '') + p.t, new Date(s0 + p.h * 3600000), 'ayuno', {go:'fast'}, reached || p.h >= 24 ? 'AYUNO_FIN' : null), 'skip');
        });
        if (g && n.fastHalf && g / 2 !== 4 && g / 2 !== 8 && g / 2 !== 12) push(mk(ID.fastHalf, 'Vas por la mitad del ayuno 💪', `Llevas ${g/2} h. Agua, café o té sin azúcar te ayudan.`, new Date(s0 + g * 1800000), 'ayuno', {go:'fast'}), 'skip');
        if (g && n.fastGoal) push(mk(ID.fastGoal, `¡${g} h de ayuno cumplidas! 🎉`, 'Rompe el ayuno con proteína y verduras, o sigue si quieres un esfuerzo extra.', new Date(s0 + g * 3600000), 'ayuno', {go:'fast'}, 'AYUNO_FIN'), 'move');
      } else {
        const plan = FAST_PLANS[f.plan], last = f.history[f.history.length - 1];
        if (plan && plan.h && last && n.fastWin){
          const close = last.end + (24 - plan.h) * 3600000, lead = (+n.fastWinLead || 60) * 60000;
          push(mk(ID.fastWin, `Tu ventana de comida cierra en ${fmtEvery(lead / 60000)}`, 'Buen momento para tu última comida, con proteína.', new Date(close - lead), 'ayuno', {go:'fast'}), 'move');
          push(mk(ID.fastStart, 'Hora de empezar tu ayuno ⏱️', `Plan ${plan.n}. Toca para empezarlo.`, new Date(close), 'ayuno', {go:'fast'}, 'AYUNO'), 'move');
        }
        if (n.fastDaily) for (let d = 0; d < 2; d++)
          push(mk(ID.fastDaily + d, 'Hora de empezar tu ayuno ⏱️', `Plan ${(plan && plan.n) || 'libre'}. Toca Empezar ayuno.`, atTime(now + d * DAYMS, n.fastDailyTime), 'ayuno', {go:'fast'}, 'AYUNO'), 'none');
      }
    }
    // Racha en riesgo
    if (n.streak){
      const t = atTime(now, n.streakTime); t.setDate(t.getDate() + ((+n.streakDay - t.getDay() + 7) % 7));
      const wk = weekKey(now), days = new Set(S.sessions.filter(s => weekKey(s.end) === wk).map(s => new Date(s.end).toDateString())).size;
      const target = S.plan && S.plan.days.length ? S.plan.days.length : 1, st = streakWeeks(), falt = target - days;
      if (falt > 0 && weekKey(t.getTime()) === wk)
        push(mk(ID.streak, days === 0 && st > 0 ? `🔥 Tu racha de ${plural(st,'semana','semanas')} está en riesgo` : 'Se acaba la semana',
          days === 0 ? 'Entrena hoy para mantener la racha. Unos minutos ya cuentan.' : `Te ${falt === 1 ? 'falta 1 entreno' : 'faltan ' + falt + ' entrenos'} para tu objetivo semanal.`, t, 'recordatorios', {go:'train'}), 'move');
    }
    // Informe semanal (Premium)
    if (n.report && premium() && S.settings.report !== false){
      const t = atTime(now, n.reportTime); let add = (+n.reportDay - t.getDay() + 7) % 7; if (add === 0 && t.getTime() <= now) add = 7; t.setDate(t.getDate() + add);
      const r = weekReport(weekKey(now));
      const body = r.n ? `Semana: ${plural(r.n,'entreno','entrenos')}${r.pvol ? `, ${r.vol >= r.pvol ? '+' : ''}${Math.round((r.vol - r.pvol) / r.pvol * 100)} % de volumen` : ''}${r.prs ? `, ${plural(r.prs,'récord','récords')}` : ''}. Toca para verlo.` : 'Nueva semana, nuevo comienzo. Toca para ver tu informe.';
      push(mk(ID.report, 'Tu informe semanal está listo 📊', body, t, 'pandaria', {go:'report'}), 'move');
    }
    // Sugerencias de PandarIA (Premium)
    if (n.pandaria && premium()){
      const rs = S.routines.filter(r => !r.archived && (r.sugg || []).length);
      if (rs.length){
        const t = atTime(now, n.pandariaTime); if (t.getTime() < now + 2 * 3600000) t.setDate(t.getDate() + 1);
        const tot = rs.reduce((a, r) => a + r.sugg.length, 0);
        push(mk(ID.pandaria, `PandarIA tiene ${plural(tot,'sugerencia','sugerencias')} para ti`, `${rs[0].name}: ${rs[0].sugg[0].title}`, t, 'pandaria', {go:'routine', rid: rs[0].id}), 'move');
      }
    }
    // Copia de seguridad mensual: día 1 a las 10:00
    if (n.backup){
      const t = new Date(); t.setMonth(t.getMonth() + 1, 1); t.setHours(10, 0, 0, 0);
      push(mk(ID.backup, 'Guarda tu copia de seguridad 💾', 'Un toque y tus rutinas y tu historial quedan a salvo en Drive.', t, 'pandaria', {go:'backup'}), 'move');
    }
    return list;
  }

  async function rescheduleAll(){
    if (!LN) return;
    const n = NS();
    let pend = [];
    try{ pend = (await LN.getPending()).notifications || []; }catch(e){}
    const del = pend.filter(x => x.id !== ID.rest && x.id !== ID.timer && x.id !== 9999).map(x => ({id: x.id}));
    try{ if (del.length) await LN.cancel({notifications: del}); }catch(e){}
    if (!notifOk || !n.on) return;
    const list = buildList();
    try{ if (list.length) await LN.schedule({notifications: list}); }catch(e){}
  }

  // Fin del descanso / serie por tiempo con la app en segundo plano (nunca en silencio)
  function onPauseNotif(){
    if (PN) return; // el servicio nativo ya avisa del descanso
    const n = NS();
    if (!LN || !notifOk || !n.on || !n.rest || !S.active) return;
    const a = S.active, list = [], now = Date.now();
    if (a.rest && a.rest.end > now + 1500){
      const np = nextPending(); let body = 'A por la siguiente serie';
      if (np){ const ex = getEx(np.it.exId), wn = np.it.sets.slice(0, np.i + 1).filter(x => x.t !== 'c').length;
        body = np.it.sets[np.i].t === 'c' ? `Calentamiento de ${ex.n}` : `¡A por la serie ${wn} de ${ex.n}!`; }
      list.push(mk(ID.rest, '⏱️ Descanso terminado', body, new Date(a.rest.end), 'entreno', {go:'workout'}));
    }
    if (a.timer && a.timer.end > now + 1500){
      const it = wkItem(a.timer.uid);
      list.push(mk(ID.timer, '✅ Tiempo cumplido', it ? `${getEx(it.exId).n}: serie completada` : 'Serie completada', new Date(a.timer.end), 'entreno', {go:'workout'}));
    }
    if (list.length) safe(() => LN.schedule({notifications: list}));
  }
  function onResumeNotif(){
    if (!LN) return;
    safe(() => LN.cancel({notifications: [{id: ID.rest}, {id: ID.timer}]}));
    refreshPerm().then(rescheduleAll);
  }

  function onNotifAction(ev){
    const x = (ev && ev.notification && ev.notification.extra) || {}, act = ev && ev.actionId;
    setTimeout(() => { try{
      if (act === 'w250' || act === 'w500'){ A.water(act === 'w250' ? 250 : 500); toast('💧 Agua añadida'); return; }
      if (act === 'faststart'){ if (!nut().fast.active) A.fastStart(); A.tab('nutricion'); return; }
      if (act === 'fastend'){ if (nut().fast.active) A.fastEnd(); A.tab('nutricion'); return; }
      if (act === 'start' && x.rid && findR(x.rid)){ A.startWorkout(x.rid); return; }
      switch (x.go){
        case 'workout': if (S.active && !LAYERS.some(l => l.t === 'workout')) openLayer('workout'); break;
        case 'train': A.tab('rutinas'); break;
        case 'water': case 'fast': A.tab('nutricion'); break;
        case 'report': HSEG = 'informes'; A.tab('historial'); break;
        case 'routine': if (x.rid && findR(x.rid)) A.openRoutine(x.rid); break;
        case 'backup': A.tab('ajustes'); A.exportData(); break;
      }
    }catch(e){} }, 400);
  }

  // Agua: recuerda cuándo bebiste por última vez (agua inteligente)
  const _water = A.water;
  A.water = v => { if (+v > 0){ nut().waterLast = Date.now(); } _water(v); };

  // Fase del ayuno en el anillo
  const _fastCard = fastCard;
  fastCard = function(){
    let h = _fastCard.apply(this, arguments);
    const f = S.nutri && S.nutri.fast;
    if (f && f.active){
      const hrs = (Date.now() - f.active.start) / 3600000, p = fastPhaseAt(hrs), nx = fastNextPhase(hrs);
      const box = `<div style="margin:2px 0 10px"><div class="tag ac" style="font-size:12.5px">${I('flame',13)} ${esc(p.n)}</div><div class="xs mut" style="margin-top:6px;line-height:1.4">${esc(p.t)}${nx ? `<br>Siguiente: ${esc(nx.n)} a las ${nx.h} h` : ''}</div><div class="xs mut" style="margin-top:4px;opacity:.75">Tiempos aproximados · información general, no consejo médico</div></div>`;
      h = h.replace('<div class="sm mut">Empezaste', box + '<div class="sm mut">Empezaste');
    }
    return h;
  };

  /* ----- Pantallas: Notificaciones y Próximos avisos ----- */
  const DS = ['D','L','M','X','J','V','S'], DL = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const nTg = (k, label, desc, lock) => {
    const n = NS(), on = !!n[k];
    return `<button class="srow" data-a="${lock ? 'pfPay' : 'nfTog'}" data-v="${k}"><span class="grow"><div class="b">${label}${lock ? ' 🔒' : ''}</div>${desc ? `<div class="xs mut">${desc}</div>` : ''}</span><span class="toggle ${on && !lock ? 'on' : ''}"></span></button>`;
  };
  const nTime = (k, label) => `<div class="row" style="padding:10px 4px;gap:10px"><span class="grow sm">${label}</span><input type="time" class="inp" style="width:148px;height:42px" value="${NS()[k]}" data-ch="nfTime" data-k="${k}"></div>`;
  const nChips = (k, opts, fmt) => `<div class="chips" style="padding:6px 4px 10px">${opts.map(o => `<button class="chip ${String(NS()[k]) === String(o) ? 'on' : ''}" data-a="nfSet" data-v="${k}|${o}">${fmt ? fmt(o) : o}</button>`).join('')}</div>`;
  const nDays = (k, multi) => `<div class="chips" style="padding:6px 0 10px;gap:6px">${[1,2,3,4,5,6,0].map(d => { const v = NS()[k], on = multi ? v.includes(d) : +v === d;
    return `<button class="chip ${on ? 'on' : ''}" style="width:36px;justify-content:center;padding:0" data-a="${multi ? 'nfDay' : 'nfSet'}" data-v="${k}|${d}">${DS[d]}</button>`; }).join('')}</div>`;
  const card = (ic, title, kind, inner) => `<div class="sec row" style="gap:8px;align-items:center">${I(ic,16)}<span class="grow">${title}</span>${kind ? `<button class="link xs" data-a="nfTest" data-v="${kind}">PROBAR</button>` : ''}</div><div class="card" style="padding:4px 12px">${inner}</div>`;

  SCREENS.nfMenu = () => {
    const n = NS(), prem = premium(), rem = S.settings.reminders;
    let b = '';
    if (!notifOk) b += `<div class="banner"><span class="ic">${I('bell',20)}</span><div class="grow sm">Las notificaciones están desactivadas en Android.<br><button class="link sm" style="margin-top:8px" data-a="nfEnable">Activarlas</button></div></div>`;
    else if (!exactOk) b += `<div class="banner blue"><span class="ic">${I('timer',20)}</span><div class="grow sm">Permite <b>Alarmas y recordatorios</b> para que los avisos lleguen a su hora exacta.<br><button class="link sm" style="margin-top:8px" data-a="nfExact">Permitir</button></div></div>`;
    b += `<div class="card" style="padding:0 12px">${nTg('on','Notificaciones','Interruptor general de todos los avisos')}</div>`;
    if (n.on){
      b += `<div class="row" style="gap:8px;margin-bottom:6px"><button class="btn grow sm" data-a="nfNext">${I('list',16)} Próximos avisos</button><button class="btn grow sm" data-a="nfBattery">${I('info',16)} Que lleguen siempre</button></div>`;
      b += card('moon','Horas de silencio', null, nTg('quiet','Silenciar por la noche','Agua y fases del ayuno no suenan; el resto se mueve al final. El fin del descanso siempre avisa.') + (n.quiet ? nTime('quietFrom','Desde') + nTime('quietTo','Hasta') : ''));
      b += card('dumbbell','Entreno','train', nTg('train','Recordatorio de entreno', rem.days.length ? `${rem.days.length === 7 ? 'Todos los días' : rem.days.map(d => DS[d]).join(' ')} a las ${rem.time}` : 'Elige los días abajo') +
        (n.train ? `<div class="xs mut" style="padding:8px 4px 0">Días de entreno</div><div class="chips" style="padding:6px 0 10px;gap:6px">${[1,2,3,4,5,6,0].map(d => `<button class="chip ${rem.days.includes(d) ? 'on' : ''}" style="width:36px;justify-content:center;padding:0" data-a="nfRemDay" data-v="${d}">${DS[d]}</button>`).join('')}</div>
          <div class="row" style="padding:4px 4px 10px;gap:10px"><span class="grow sm">Hora</span><input type="time" class="inp" style="width:148px;height:42px" value="${rem.time}" data-ch="nfRemTime"></div>
          <div class="xs mut" style="padding:0 4px">Avisar</div>${nChips('trainLead',[0,15,30], v => +v ? `${v} min antes` : 'En punto')}` : '') +
        nTg('rest','Fin del descanso','Si sales de la app durante un descanso o una serie por tiempo') +
        nTg('streak','Racha en riesgo','Si te falta entrenar al acabar la semana') + (n.streak ? `<div class="xs mut" style="padding:8px 4px 0">Día del aviso</div>${nDays('streakDay')}${nTime('streakTime','Hora')}` : ''));
      b += card('drop','Agua','water', nTg('water','Recordatorios de agua','Repartidos en tu horario') + (n.water ? `<div class="xs mut" style="padding:8px 4px 0">Frecuencia</div>${nChips('waterEvery',[30,45,60,90,120,180], v => 'Cada ' + fmtEvery(+v))}
          ${nTime('waterFrom','Desde')}${nTime('waterTo','Hasta')}<div class="xs mut" style="padding:8px 4px 0">Días</div>${nDays('waterDays', true)}
          ${nTg('waterSmart','Agua inteligente','No avisa si bebiste en la última hora y te dice si vas atrasado')}${nTg('waterAfterGoal','Seguir tras la meta','Avisos más espaciados por si quieres beber de más')}` : ''));
      const fp = n.fastPhases;
      b += card('leaf','Ayuno','fast', nTg('fastGoal','Meta cumplida','Al llegar a las horas de tu plan') + nTg('fastHalf','Mitad del ayuno') +
        `<div class="xs mut" style="padding:10px 4px 0">Fases (siguen después de tu meta)</div><div class="chips" style="padding:6px 4px 10px">${FAST_PHASES.filter(p => p.h).map(p => `<button class="chip ${fp[p.h] ? 'on' : ''}" data-a="nfPhase" data-v="${p.h}">${p.h} h · ${p.n}</button>`).join('')}</div>` +
        nTg('fastWin','Ventana de comida','Antes de que cierre y cuando toca volver a ayunar') + (n.fastWin ? `<div class="xs mut" style="padding:8px 4px 0">Avisar antes del cierre</div>${nChips('fastWinLead',[30,60], v => fmtEvery(+v) + ' antes')}` : '') +
        nTg('fastDaily','Recordatorio diario para empezar','A una hora fija, si no estás ayunando') + (n.fastDaily ? nTime('fastDailyTime','Hora') : ''));
      b += card('spark','PandarIA e informes', null, nTg('report','Informe semanal','Resumen de tu semana', !prem) + (n.report && prem ? `<div class="xs mut" style="padding:8px 4px 0">Día</div>${nDays('reportDay')}${nTime('reportTime','Hora')}` : '') +
        nTg('pandaria','Sugerencias de PandarIA','Cuando hay mejoras para tus rutinas', !prem) + (n.pandaria && prem ? nTime('pandariaTime','Hora') : '') +
        nTg('backup','Recordatorio de copia de seguridad','El día 1 de cada mes'));
    }
    return lhdr('Notificaciones') + `<div class="lbody">${b}</div>`;
  };
  SCREENS.nfNext = p => {
    const L = (p.list || []).slice().sort((a, b) => a.at - b.at);
    const rows = L.map(x => { const d = new Date(x.at);
      return `<div class="kv" style="align-items:flex-start;gap:12px"><span class="mut" style="white-space:nowrap">${d.toDateString() === new Date().toDateString() ? 'Hoy' : DL[d.getDay()].slice(0,3) + ' ' + d.getDate()} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}</span><span style="text-align:right"><b>${esc(x.title)}</b><br><span class="xs mut">${esc(x.body || '')}</span></span></div>`; }).join('');
    return lhdr('Próximos avisos') + `<div class="lbody"><p class="sm mut" style="margin-top:0">${L.length ? `${plural(L.length,'aviso programado','avisos programados')}. Se reprograman solos cuando cambias algo.` : 'No hay avisos programados.'}${exactOk ? '' : ' <b>Sin el permiso de alarmas exactas, Android puede retrasarlos.</b>'}</p>${L.length ? `<div class="card" style="padding:4px 14px">${rows}</div>` : ''}</div>`;
  };
  const reN = () => { save(); scheduleNotifs(); refreshTop(); };
  A.nfMenu = () => { refreshPerm().then(() => openLayer('nfMenu')); };
  A.nfTog = k => { const n = NS(); n[k] = !n[k]; if (k === 'on' && n.on && !notifOk) enableNotifs(); reN(); };
  A.nfSet = v => { const [k, val] = v.split('|'); NS()[k] = isNaN(+val) ? val : +val; reN(); };
  A.nfDay = v => { const [k, d] = v.split('|'); const a = NS()[k], i = a.indexOf(+d); if (i >= 0){ if (a.length > 1) a.splice(i, 1); } else a.push(+d); reN(); };
  A.nfPhase = h => { const fp = NS().fastPhases; fp[h] = !fp[h]; reN(); };
  A.nfRemDay = d => { const a = S.settings.reminders.days, i = a.indexOf(+d); if (i >= 0) a.splice(i, 1); else a.push(+d); reN(); };
  CH.nfRemTime = el => { if (el.value){ S.settings.reminders.time = el.value; reN(); } };
  CH.nfTime = el => { if (el.value){ NS()[el.dataset.k] = el.value; reN(); } };
  A.nfEnable = () => enableNotifs();
  A.nfExact = () => askExact();
  A.nfNext = async () => {
    await rescheduleAll();
    let pend = []; try{ pend = (await LN.getPending()).notifications || []; }catch(e){}
    openLayer('nfNext', {list: pend.map(x => ({at: new Date(x.schedule && x.schedule.at || 0).getTime(), title: x.title, body: x.body}))});
  };
  const TESTS = {
    train: ['¡Hoy toca entrenar! 💪', 'Así se verá tu recordatorio de entreno.', 'recordatorios', 'EMPEZAR'],
    water: ['¡Hora de hidratarse! 💧', 'Así se verá el aviso de agua. Prueba el botón +250 ml.', 'agua', 'AGUA'],
    fast:  ['12 h · Estado de ayuno', 'Así se verán las fases de tu ayuno.', 'ayuno', null],
    all:   ['PandarIA Fit 🐼', '¡Las notificaciones funcionan! Bloquea el teléfono y espera…', 'entreno', null]
  };
  A.nfTest = async kind => {
    if (!notifOk){ enableNotifs(); return; }
    const t = TESTS[kind] || TESTS.all;
    try{ await LN.schedule({notifications: [mk(9999, t[0], t[1], new Date(Date.now() + 5000), t[2], {go: kind === 'water' ? 'water' : kind === 'fast' ? 'fast' : 'train'}, t[3])]}); toast('Llegará en 5 segundos. Puedes bloquear el teléfono.'); }catch(e){ toast('No se pudo programar'); }
  };
  A.nfBattery = () => openModal(`<div class="sheet"><div class="grab"></div><h3>Que los avisos lleguen siempre</h3>
    <p class="sm mut" style="margin:-6px 4px 14px;line-height:1.45">Samsung duerme las apps para ahorrar batería y puede retrasar los avisos. Haz esto una sola vez:</p>
    <div class="card">${[
      '<b>Ajustes › Aplicaciones › PandarIA Fit › Batería</b> y elige <b>Sin restricciones</b>.',
      '<b>Ajustes › Batería › Límites de uso en segundo plano › Aplicaciones que nunca se suspenden</b> y añade PandarIA Fit.',
      'En <b>Ajustes › Aplicaciones › PandarIA Fit › Notificaciones</b>, comprueba que todas las categorías estén activadas y con sonido.',
      'En la misma pantalla de la app, en <b>Alarmas y recordatorios</b>, deja el permiso activado.'
    ].map((t, i) => `<div class="row" style="align-items:flex-start;padding:6px 0"><span class="tag ac" style="min-width:24px;justify-content:center">${i+1}</span><span class="sm" style="line-height:1.45">${t}</span></div>`).join('')}</div>
    <p class="xs mut" style="line-height:1.4">Los nombres pueden variar un poco según tu versión de One UI.</p>
    <button class="btn pri big" data-a="closeModal">Entendido</button></div>`);

  // Entrada en Ajustes
  const _va = viewAjustes;
  viewAjustes = function(){
    const n = NS();
    const row = `<div class="sec">Notificaciones</div><div class="card" style="padding:0 12px"><button class="srow" data-a="nfMenu"><span class="si">${I('bell',20)}</span><span class="grow"><div class="b">Notificaciones</div><div class="xs mut">${!notifOk ? 'Desactivadas en Android' : n.on ? 'Entreno, agua, ayuno y más' : 'Todas apagadas'}</div></span>${I('right',18)}</button></div>`;
    return _va.apply(this, arguments).replace('<div class="sec">Recordatorios</div>', row + '<div class="sec">Recordatorios</div>');
  };

  /* ---------- 10. Entreno con la pantalla apagada (Fase 3) ---------- */
  const PN = P('PandaNative');
  let svcOn = false, svcSig = '', intSkips = 0;
  const intRunning = () => typeof INT !== 'undefined' && !!INT;
  // Mientras el servicio nativo lleva el tiempo, los pitidos, la voz y la vibración los pone él (sin duplicados)
  const nativeTiming = () => svcOn && (!!S.active || intRunning());
  function intPhaseInfo(p, c){
    const ex = p.ex ? getEx(p.ex).n : '';
    const label = p.type === 'work' ? (p.amrap ? 'AMRAP' : p.emom ? 'EMOM' : 'TRABAJO') + (ex ? ' · ' + ex : '') : p.type === 'rest' ? (p.label || 'Descanso') : 'Prepárate';
    const sub = p.round ? (p.emom ? `Minuto ${p.round} de ${p.rounds}` : `Ronda ${p.round} de ${p.rounds}`) + (p.sets > 1 ? ` · Tanda ${p.set} de ${p.sets}` : '') : INT_FMT[c.fmt].n;
    const say = p.type === 'work' ? (p.amrap ? '¡Adelante! Máximo de rondas' : (p.emom ? `Minuto ${p.round}. ` : 'Trabajo. ') + ex) : p.type === 'rest' ? (p.label || 'Descanso') : 'Prepárate';
    return {label, sub, dur: p.dur, say};
  }
  function svcState(){
    const base = {sound: S.settings.sound !== false, vibrate: S.settings.vibrate !== false, voice: !!S.settings.voice};
    if (intRunning()){
      const c = INT.cfg;
      return Object.assign(base, {mode:'intervals', title: INT_FMT[c.fmt].n, intervals: {id: INT.start, phases: INT.ph.map(p => intPhaseInfo(p, c)), idx: INT.i, startAt: INT.t0, paused: !!INT.paused, left: intLeft()}});
    }
    if (!S.active) return {mode:'none'};
    const a = S.active;
    Object.assign(base, {mode:'workout', title: a.name, startedAt: a.start});
    if (a.timer){
      const it = wkItem(a.timer.uid), n = it ? getEx(it.exId).n : 'Serie';
      base.rest = {kind:'set', end: a.timer.end, total: a.timer.total, title: `Serie por tiempo · ${n}`, text: a.name, doneTitle: '✅ Tiempo cumplido', doneText: n, say: 'Tiempo'};
    } else if (a.rest){
      const np = nextPending(); let next = 'la siguiente serie', say = 'Descanso terminado';
      if (np){ const ex = getEx(np.it.exId), wn = np.it.sets.slice(0, np.i + 1).filter(x => x.t !== 'c').length;
        next = np.it.sets[np.i].t === 'c' ? `calentamiento de ${ex.n}` : `serie ${wn} de ${ex.n}`; say = `Descanso terminado. Siguiente: ${ex.n}`; }
      base.rest = {kind:'rest', end: a.rest.end, total: a.rest.total, title: `Descanso · ${cap(next)}`, text: a.name, doneTitle: '⏱️ Descanso terminado', doneText: `¡A por la ${next}!`, say};
    }
    return base;
  }
  function svcSync(force){
    if (!PN) return;
    const st = svcState();
    const sig = st.mode === 'intervals' ? `i|${st.intervals.id}|${st.intervals.paused}|${intSkips}|${st.voice}${st.sound}${st.vibrate}`
      : st.mode === 'workout' ? `w|${st.startedAt}|${st.title}|${st.rest ? st.rest.end : 0}|${st.voice}${st.sound}${st.vibrate}` : 'none';
    if (!force && sig === svcSig) return;
    svcSig = sig;
    if (st.mode !== 'none') svcOn = true;
    PN.workout(st).then(() => { svcOn = st.mode !== 'none'; }).catch(() => { svcOn = false; });
  }
  setInterval(() => { if (!document.hidden) svcSync(); }, 600);
  const _beepN = beep; beep = function(){ if (nativeTiming()) return; return _beepN.apply(this, arguments); };
  const _sbN = shortBeep; shortBeep = function(){ if (nativeTiming()) return; return _sbN.apply(this, arguments); };
  const _spN = speak; speak = function(t){ if (nativeTiming()) return; return _spN(t); };
  const _viN = vibrate; vibrate = function(p){ const big = Array.isArray(p) ? p.reduce((a, b) => a + (+b || 0), 0) > 60 : (+p || 200) > 60; if (big && nativeTiming()) return; return _viN(p); };
  const _isk = A.intSkip; A.intSkip = () => { intSkips++; _isk(); };
  // Si el servicio avanzó fases con la app en segundo plano, se registran como hechas
  function intCatchUp(toIdx){
    if (!intRunning()) return;
    while (INT.i < Math.min(toIdx, INT.ph.length)){
      const p = INT.ph[INT.i];
      if (p && p.type === 'work') INT.done.push({ex: p.ex, time: p.dur});
      INT.i++;
    }
  }
  async function svcResync(){
    if (!PN || !intRunning()) return;
    try{
      const r = await PN.getState(), s = JSON.parse(r.state || '{}'), iv = s.intervals;
      if (!iv || iv.id !== INT.start) return;
      if (iv.idx > INT.i) intCatchUp(iv.idx);
      if (INT.i >= INT.ph.length){ intFinish(); return; }
      const dur = INT.ph[INT.i].dur;
      if (iv.paused){ INT.paused = Date.now(); INT.t0 = INT.paused - (dur - (iv.left || 0)) * 1000; }
      else { INT.paused = null; INT.t0 = iv.startAt; }
      INT.lastSec = null; refreshTop();
    }catch(e){}
  }
  function onNativeAction(ev){
    const a = ev && ev.action;
    setTimeout(() => { try{
      if (a === 'skip' && S.active && S.active.rest) A.wkRestAdj('skip');
      else if (a === 'plus30' && S.active && S.active.rest) A.wkRestAdj('30');
      else if ((a === 'ipause' && intRunning() && !INT.paused) || (a === 'iresume' && intRunning() && INT.paused)) A.intPause();
      else if (a === 'iskip' && intRunning()) intNext(true);
      else if (a === 'idone' && intRunning()){ intCatchUp(INT.ph.length); intFinish(); }
      else if (a === 'widgetWater') consumeWidget();
    }catch(e){} }, 60);
  }

  /* ---------- 11. Widgets (Fase 4) ---------- */
  let wT = null;
  function widgetData(){
    const prem = typeof isPremium === 'function' ? isPremium() : true;
    const nx = typeof nextInPlan === 'function' ? nextInPlan() : null, r = nx && nx.r;
    const dow = new Date().getDay(), done = trainedToday().length > 0;
    const anyR = S.routines.find(x => !x.archived);
    let today;
    if (!prem) today = {locked: true};
    else if (done) today = {label:'HOY', title:'¡Hecho por hoy! 💪', sub: r ? 'Próxima: ' + r.name : 'Descansa y recupera', rid:''};
    else if (r && (!S.plan || S.plan.days.includes(dow))) today = {label:'HOY TOCA', title: r.name, sub: `~${routineMinutes(r)} min · ${plural(r.items.filter(i => !i.warm && !i.cool).length,'ejercicio','ejercicios')}`, rid: r.id};
    else if (r) today = {label:'HOY', title:'Día de descanso', sub:'Próxima: ' + r.name, rid:''};
    else if (anyR) today = {label:'TUS RUTINAS', title: anyR.name, sub:'Toca para empezar', rid: anyR.id};
    else today = {label:'HOY TOCA', title:'Crea tu primera rutina', sub:'Toca para abrir la app', rid:''};
    const f = S.nutri && S.nutri.fast;
    const planN = f ? ((FAST_PLANS[f.plan] || {}).n || '') : '';
    const fast = f && f.active ? {active: true, start: f.active.start, goalH: f.active.goalH || 0, plan: planN} : {active: false, plan: planN};
    const water = {ml: (S.nutri && S.nutri.water && S.nutri.water[dayKey()]) || 0, goal: waterGoal(), day: dayKey()};
    const wk = weekKey(Date.now());
    const doneW = new Set(S.sessions.filter(s => weekKey(s.end) === wk).map(s => new Date(s.end).toDateString())).size;
    const streak = prem ? {weeks: streakWeeks(), done: doneW, target: S.plan && S.plan.days.length ? S.plan.days.length : 1} : {locked: true};
    return {today, fast, water, streak};
  }
  function pushWidgets(now){
    if (!PN) return;
    clearTimeout(wT);
    const go = () => { try{ PN.setWidgetData({json: JSON.stringify(widgetData())}).catch(() => {}); }catch(e){} };
    if (now) go(); else wT = setTimeout(go, 1500);
  }
  window.pushWidgets = pushWidgets;
  async function consumeWidget(){
    if (!PN) return;
    try{
      const r = await PN.consumeWidgetActions(), acts = r.actions || [];
      let ml = 0;
      acts.forEach(a => { if (a.type === 'water'){ const k = dayKey(a.at || Date.now()); const n = nut(); n.water[k] = (n.water[k] || 0) + (+a.ml || 250); n.waterLast = Math.max(n.waterLast || 0, a.at || 0); ml += +a.ml || 250; } });
      if (ml){ save(); render.keep = true; render(); toast(`💧 +${ml} ml desde el widget`); }
    }catch(e){}
  }

  /* ---------- 12. Enlaces, accesos directos y tema (Fase 7) ---------- */
  const PAGES = 'https://eddy970728.github.io/PandarIA-Fit/';
  function importRoutineCode(code){
    try{ const d = decodeRoutine(code); const r = newRoutine({name:'Rutina compartida', items: d.items, pandaria: true, goal: d.goal, source:'enlace'}); openEditor(r, true); toast('Rutina importada: revísala y guarda'); }
    catch(e){ toast('El enlace de la rutina no es válido'); }
  }
  function openUrl(url){
    if (!url || !/^pandariafit:/i.test(url)) return;
    let u; try{ u = new URL(url.replace(/^pandariafit:\/*/i, 'https://x/')); }catch(e){ return; }
    const path = u.pathname.replace(/^\/+|\/+$/g, '').toLowerCase(), q = u.searchParams;
    setTimeout(() => { try{
      while (MODALS.length) closeModal();
      if (path === 'entreno'){
        const rid = q.get('rid'), nx = typeof nextInPlan === 'function' ? nextInPlan() : null;
        const r = (rid && findR(rid)) || (nx && nx.r) || S.routines.find(x => !x.archived);
        A.tab('rutinas'); if (r) A.startWorkout(r.id); else toast('Crea una rutina para empezar');
      } else if (path.startsWith('agua')){
        A.tab('nutricion'); if (path === 'agua/250'){ A.water(250); toast('💧 +250 ml'); }
      } else if (path.startsWith('ayuno')){
        A.tab('nutricion'); const f = nut().fast;
        if (path === 'ayuno/empezar'){ if (!f.screened) A.fastScreen(); else if (f.blocked) toast('El ayuno no es recomendable para ti sin supervisión'); else if (!f.active) A.fastStart(); }
        else if (path === 'ayuno/terminar' && f.active) A.fastEnd();
      } else if (path === 'historial') A.tab('historial');
      else if (path === 'premium'){ const c = q.get('c'); A.openPremium(); if (c) setTimeout(() => { const el = $('#pfcode'); if (el){ el.value = c; A.pfActivate(); } }, 400); }
      else if (path === 'rutina'){ const c = q.get('c'); if (c) importRoutineCode(c); }
    }catch(e){} }, 450);
  }
  // Compartir rutina con enlace
  A.shareRoutine = id => {
    const r = findR(id); if (!r) return;
    const {code, skipped} = encodeRoutine(r), link = `${PAGES}r.html#${code}`;
    const text = `Prueba mi rutina «${r.name}» en PandarIA Fit 💪\n${link}\n\nSi no se abre, copia este código en Nueva rutina › Importar con código: ${code}`;
    openModal(`<div class="modal"><h3>Compartir rutina</h3><p class="sm mut" style="line-height:1.45">Comparte el enlace: abre la app e importa la rutina. También vale el código, en <b>Nueva rutina › Importar con código</b>.</p>
      <div class="codebox" style="font-size:17px">${code}</div>${skipped ? `<p class="xs" style="color:var(--gold)">${plural(skipped,'ejercicio propio no se incluye','ejercicios propios no se incluyen')}.</p>` : ''}
      <div class="row" style="gap:8px;margin-top:14px"><button class="btn grow" data-a="cbm" data-v="${cb(() => { try{ navigator.clipboard.writeText(text).then(() => toast('Copiado'), () => fallbackCopy(text)); }catch(e){ fallbackCopy(text); } })}">${I('copy',18)} Copiar</button>
      <button class="btn pri grow" data-a="cbm" data-v="${cb(() => { const Sh = P('Share'); if (Sh) Sh.share({title:'Rutina de PandarIA Fit', text, dialogTitle:'Compartir rutina'}).catch(() => {}); })}">${I('upload',18)} Compartir</button></div></div>`, {center:true});
  };
  // Tema según el sistema
  const darkMQ = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const _atS = applyTheme;
  applyTheme = function(){
    const s = S.settings, keep = s.theme;
    if (keep === 'system') s.theme = darkMQ && darkMQ.matches ? 'dark' : 'light';
    try{ _atS(); } finally { s.theme = keep; }
  };
  if (darkMQ && darkMQ.addEventListener) darkMQ.addEventListener('change', () => { if (S.settings.theme === 'system') applyTheme(); });
  A.setThemeMode = v => { S.settings.theme = v; applyTheme(); save(); render.keep = true; render(); };
  let APPV = '';

  /* ---------- 13. Health Connect (Fase 6) ---------- */
  const HC = P('Health');
  const HCS = () => (S.settings.hc = Object.assign({on:false, steps:true, weight:true, hr:true, writeWeight:true, writeWorkouts:true, writeFood:false, writeWater:false, useInPandaria:true, lastWeightTs:0}, S.settings.hc || {}));
  const HC_READ = ['steps','weight','heartRate','restingHeartRate'], HC_WRITE = ['weight','calories','dietaryEnergyConsumed','dietaryWater'];
  const HD = {available: null, reason: '', steps: null, steps7: null, weight: null, weightAt: 0, hr: null, hrKind: '', lastSync: 0};
  const isPrem = () => typeof isPremium === 'function' ? isPremium() : true;
  async function hcAvail(){ try{ const r = await HC.isAvailable(); HD.available = !!r.available; HD.reason = r.reason || ''; }catch(e){ HD.available = false; } return HD.available; }
  async function hcConnect(){
    if (!HC){ toast('Health Connect no está disponible'); return; }
    if (!(await hcAvail())){ confirmBox({title:'Falta Health Connect', text:'Instala <b>Health Connect</b> de Google desde Play Store (en Android 14 o superior ya viene incluido) y vuelve a intentarlo.', okText:'Entendido', ok:() => {}}); return; }
    try{
      await HC.requestAuthorization({read: HC_READ, write: HC_WRITE});
      const s0 = HCS(); s0.on = true; s0.writeFood = s0.writeWater = true; save(); await hcSync(true); refreshHc(); toast('Health Connect conectado');
    }catch(e){ toast('No se pudo conectar. Revisa los permisos en Health Connect.'); }
  }
  const iso = d => new Date(d).toISOString();
  async function hcSync(force){
    const s = HCS(); if (!HC || !s.on) return;
    if (!force && Date.now() - HD.lastSync < 10 * 60000) return;
    HD.lastSync = Date.now();
    const now = Date.now(), d0 = new Date(); d0.setHours(0, 0, 0, 0); const start7 = d0.getTime() - 6 * 86400000;
    if (s.steps) try{
      const r = await HC.queryAggregated({dataType:'steps', startDate: iso(start7), endDate: iso(now), bucket:'day', aggregation:'sum'});
      const arr = (r.samples || []).slice().sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
      const today = arr.find(x => Date.parse(x.startDate) >= d0.getTime() - 3600000 && Date.parse(x.startDate) <= d0.getTime() + 3600000);
      HD.steps = Math.round(today ? today.value : 0);
      HD.steps7 = arr.length ? Math.round(arr.reduce((a, b) => a + (b.value || 0), 0) / 7) : 0;
    }catch(e){}
    if (s.weight) try{
      const r = await HC.readSamples({dataType:'weight', startDate: iso(now - 90 * 86400000), endDate: iso(now), limit: 30});
      const last = (r.samples || []).filter(x => x.value > 20).sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate))[0];
      if (last){
        HD.weight = Math.round(last.value * 10) / 10; HD.weightAt = Date.parse(last.startDate);
        const mine = S.measures.filter(m => m.peso).sort((a, b) => b.date - a.date)[0];
        if (HD.weightAt > (s.lastWeightTs || 0) && (!mine || HD.weightAt > mine.date + 60000) && (!mine || Math.abs(mine.peso - HD.weight) >= 0.05 || HD.weightAt - mine.date > 86400000)){
          S.measures.push({id: uid(), date: HD.weightAt, peso: HD.weight, src: 'hc'}); s.lastWeightTs = HD.weightAt; save();
        }
      }
    }catch(e){}
    if (s.hr) try{
      let r = await HC.readSamples({dataType:'restingHeartRate', startDate: iso(now - 14 * 86400000), endDate: iso(now), limit: 5});
      let x = (r.samples || []).sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate))[0];
      if (x){ HD.hr = Math.round(x.value); HD.hrKind = 'en reposo'; }
      else { r = await HC.readSamples({dataType:'heartRate', startDate: iso(now - 86400000), endDate: iso(now), limit: 1}); x = (r.samples || [])[0]; if (x){ HD.hr = Math.round(x.value); HD.hrKind = 'última medida'; } }
    }catch(e){}
  }
  function refreshHc(){ if (LAYERS.length && LAYERS[LAYERS.length - 1].t === 'hcMenu') refreshTop(); else { render.keep = true; render(); } }
  // Escribir entrenos (calorías activas estimadas) y peso en Health Connect (Premium)
  const _fw = finishWorkout;
  finishWorkout = function(mode){
    _fw.apply(this, arguments);
    const s = HCS(), sess = S.sessions[S.sessions.length - 1];
    if (HC && s.on && s.writeWorkouts && isPrem() && sess){
      const hours = Math.max(0.05, (sess.end - sess.start) / 3600000), met = 3 + (sess.intensity || 6) * 0.45;
      HC.saveSample({dataType:'calories', value: Math.round(met * bodyWeight() * hours), startDate: iso(sess.start), endDate: iso(sess.end), metadata: {source:'PandarIA Fit', workout: sess.routineName}}).catch(() => {});
    }
  };
  const _ms = A.mSave;
  A.mSave = () => {
    const n0 = S.measures.length; _ms();
    const s = HCS(), m = S.measures[S.measures.length - 1];
    if (HC && s.on && s.writeWeight && isPrem() && S.measures.length > n0 && m && m.peso && m.src !== 'hc')
      HC.saveSample({dataType:'weight', value: +m.peso, startDate: iso(m.date)}).catch(() => {});
  };
  // Comidas del diario (energía consumida) y agua (hidratación) en Health Connect (Premium). Solo lo de hoy.
  const _da = diarioAdded;
  diarioAdded = function(k, entries){
    _da.apply(this, arguments);
    const s = HCS(); if (!HC || !s.on || !s.writeFood || !isPrem() || k !== dayKey()) return;
    (entries || []).forEach(e => { const kc = Math.round(+e.k || 0); if (kc <= 0) return; const t0 = Math.min(Date.now(), e.t || Date.now()) - 60000;
      HC.saveSample({dataType:'dietaryEnergyConsumed', value: kc, startDate: iso(t0), endDate: iso(t0 + 60000), metadata: {source:'PandarIA Fit', food: String(e.n || '').slice(0, 60)}}).catch(() => {}); });
  };
  const _wHc = A.water;
  A.water = v => { _wHc(v); const s = HCS(); if (HC && s.on && s.writeWater && isPrem() && +v > 0){ const t0 = Date.now() - 60000;
    HC.saveSample({dataType:'dietaryWater', value: (+v) / 1000, startDate: iso(t0), endDate: iso(t0 + 60000), metadata: {source:'PandarIA Fit'}}).catch(() => {}); } };
  // PandarIA ajusta tus calorías con tus pasos (Premium)
  const _cn = calcNutrition;
  calcNutrition = function(){
    const c = _cn.apply(this, arguments), s = HCS();
    if (c && s.on && s.useInPandaria && isPrem() && HD.steps7){
      const f = HD.steps7 >= 12000 ? 1.08 : HD.steps7 >= 9000 ? 1.04 : HD.steps7 < 4000 ? 0.96 : 1;
      if (f !== 1){ c.tdee = Math.round(c.tdee * f); c.kcal = Math.round(c.kcal * f / 10) * 10; c.carbs = Math.max(0, Math.round((c.kcal - c.prot * 4 - c.fat * 9) / 4)); }
      c.notes.push(`Ajustado con tus pasos de Health Connect (media de ${HD.steps7.toLocaleString('es')} al día).`);
    }
    return c;
  };
  SCREENS.hcMenu = () => {
    const s = HCS(), prem = isPrem();
    const tg = (k, l, d, premOnly) => { const lock = premOnly && !prem; return `<button class="srow" data-a="${lock ? 'pfPay' : 'hcTog'}" data-v="${k}"><span class="grow"><div class="b">${l}${lock ? ' 🔒' : ''}</div>${d ? `<div class="xs mut">${d}</div>` : ''}</span><span class="toggle ${s[k] && !lock ? 'on' : ''}"></span></button>`; };
    let b = `<p class="sm mut" style="margin-top:0;line-height:1.5">Conecta PandarIA Fit con Health Connect para leer pasos, peso y pulso de Samsung Health u otras apps, y guardar allí tus entrenos, tu peso, tus comidas y tu agua.</p>`;
    if (!s.on) b += `<div class="card" style="text-align:center"><div style="font-size:38px">❤️</div><div class="b" style="margin:6px 0 4px">Health Connect no está conectado</div><div class="xs mut" style="margin-bottom:14px">Tú eliges qué datos compartir. Puedes desconectarlo cuando quieras.</div><button class="btn pri wide" data-a="hcConnect">Conectar Health Connect</button></div>`;
    else {
      const fmtN = n => n == null ? '—' : n.toLocaleString('es');
      b += `<div class="stats"><div class="stat"><div class="v">${fmtN(HD.steps)}</div><div class="l">Pasos hoy</div></div><div class="stat"><div class="v">${fmtN(HD.steps7)}</div><div class="l">Media 7 días</div></div></div>
        <div class="stats"><div class="stat"><div class="v">${HD.weight ? fmtNum(HD.weight) + ' kg' : '—'}</div><div class="l">Peso${HD.weightAt ? ' · ' + fmtDate(HD.weightAt) : ''}</div></div><div class="stat"><div class="v">${HD.hr ? HD.hr + ' lpm' : '—'}</div><div class="l">Pulso${HD.hrKind ? ' ' + HD.hrKind : ''}</div></div></div>
        <button class="btn wide" data-a="hcSyncNow">${I('refresh',18)} Actualizar ahora</button>
        <div class="sec">Leer de Health Connect</div><div class="card" style="padding:4px 12px">${tg('steps','Pasos','Hoy y media de 7 días')}${tg('weight','Peso','Se añade solo a Mi historial › Cuerpo')}${tg('hr','Pulso','En reposo o la última medida')}</div>
        <div class="sec">Guardar en Health Connect</div><div class="card" style="padding:4px 12px">${tg('writeWorkouts','Entrenos','Como calorías activas estimadas por duración e intensidad', true)}${tg('writeWeight','Peso','Cuando registras tu peso en Cuerpo', true)}${tg('writeFood','Comidas','Las calorías de lo que añades hoy a tu diario', true)}${tg('writeWater','Agua','Cada vaso o botella que sumas', true)}</div>
        <div class="xs mut" style="margin:-4px 4px 8px;line-height:1.4">Si quitas algo del diario o del agua, bórralo también en Health Connect: PandarIA solo añade.</div>
        <div class="sec">PandarIA</div><div class="card" style="padding:4px 12px">${tg('useInPandaria','Usar mis pasos en las recomendaciones','Ajusta tus calorías diarias según tu actividad', true)}</div>
        <div class="row" style="gap:8px;margin-top:14px"><button class="btn grow sm" data-a="hcSettings">Permisos en Health Connect</button><button class="btn grow sm danger" data-a="hcOff">Desconectar</button></div>`;
    }
    b += `<p class="xs mut" style="line-height:1.5;margin-top:16px">Tus datos de salud se quedan en tu teléfono: PandarIA Fit no los envía a ningún servidor. <button class="link xs" data-a="hcPrivacy">Política de privacidad</button></p>`;
    return lhdr('Health Connect') + `<div class="lbody">${b}</div>`;
  };
  A.hcMenu = () => { openLayer('hcMenu'); if (HCS().on) hcSync(true).then(refreshHc); };
  A.hcConnect = () => hcConnect();
  A.hcTog = async k => { const s = HCS(); s[k] = !s[k]; save(); refreshTop();
    if (s[k] && (k === 'writeFood' || k === 'writeWater')) try{ await HC.requestAuthorization({read: HC_READ, write: HC_WRITE}); }catch(e){ s[k] = false; save(); refreshTop(); toast('Falta el permiso en Health Connect'); } };
  A.hcSyncNow = async () => { toast('Actualizando…'); await hcSync(true); refreshHc(); };
  A.hcSettings = () => { try{ HC.openHealthConnectSettings(); }catch(e){} };
  A.hcOff = () => confirmBox({title:'¿Desconectar Health Connect?', text:'Dejaremos de leer y guardar datos. Para quitar también los permisos, hazlo en los ajustes de Health Connect.', okText:'Desconectar', danger:true, ok:() => { HCS().on = false; save(); refreshTop(); }});
  SCREENS.privacy = p => lhdr('Privacidad') + `<div class="lbody" style="line-height:1.55">${p.html || 'Cargando…'}</div>`;
  A.hcPrivacy = async () => { let html = ''; try{ const t = await (await fetch('privacypolicy.html')).text(); html = (t.match(/<main[^>]*>([\s\S]*)<\/main>/) || [,''])[1]; }catch(e){} openLayer('privacy', {html: html || 'No se pudo cargar la política de privacidad.'}); };

  // Ajustes: tema del sistema, Health Connect y versión real
  const _vaN = viewAjustes;
  viewAjustes = function(){
    let h = _vaN.apply(this, arguments);
    const t = S.settings.theme;
    h = h.replace(/<button class="srow" data-a="toggleSet" data-v="theme">[\s\S]*?<\/button>/, `<div class="srow" style="display:block"><div class="row" style="margin-bottom:10px"><span class="si">${I('moon',20)}</span><span class="b grow">Tema</span></div><div class="seg">${[['system','Sistema'],['light','Claro'],['dark','Oscuro']].map(([k, n]) => `<button class="${t === k ? 'on' : ''}" data-a="setThemeMode" data-v="${k}">${n}</button>`).join('')}</div></div>`);
    const s = HCS();
    const row = `<div class="sec">Salud</div><div class="card" style="padding:0 12px"><button class="srow" data-a="hcMenu"><span class="si">${I('flame',20)}</span><span class="grow"><div class="b">Health Connect</div><div class="xs mut">${s.on ? 'Conectado' + (HD.steps != null ? ` · ${HD.steps.toLocaleString('es')} pasos hoy` : '') : 'Pasos, peso y pulso de Samsung Health'}</div></span>${I('right',18)}</button></div>`;
    h = h.replace('<div class="sec">Notificaciones</div>', row + '<div class="sec">Notificaciones</div>');
    if (APPV) h = h.replace(/versión 2\.0[^<]*/, `versión ${APPV}`);
    h = h.replace(/<div class="sec">Recordatorios<\/div><div class="card">[\s\S]*?<\/div>\s*(?=<div class="sec">Tus datos<\/div>)/, '');
    return h;
  };
  // Historial › Resumen: tarjeta de Health Connect
  const _vhN = viewHistorial;
  viewHistorial = function(){
    let h = _vhN.apply(this, arguments);
    if (HSEG === 'resumen' && HCS().on && HD.steps != null){
      const card = `<div class="card row" data-a="hcMenu" style="gap:12px;cursor:pointer"><span style="color:var(--bad)">${I('flame',22)}</span><div class="grow"><div class="b">${HD.steps.toLocaleString('es')} pasos hoy</div><div class="xs mut">Media 7 días: ${(HD.steps7 || 0).toLocaleString('es')}${HD.hr ? ` · Pulso ${HD.hrKind}: ${HD.hr} lpm` : ''}</div></div>${I('right',18)}</div>`;
      h = h.replace('<div class="stats">', card + '<div class="stats">');
    }
    return h;
  };

  // Arranque de las fases 3 a 7
  function init2(){
    if (PN) PN.addListener('nativeAction', onNativeAction);
    if (App){
      App.addListener('appUrlOpen', e => openUrl(e && e.url));
      safe(() => App.getLaunchUrl().then(r => r && r.url && openUrl(r.url)));
      safe(() => App.getInfo().then(i => { APPV = i.version || ''; }));
    }
    if (S.settings.theme === 'system') applyTheme();
    consumeWidget(); pushWidgets(true); svcResync(); svcSync(true);
    setTimeout(() => hcSync(false).then(() => { if (HD.steps != null){ render.keep = true; render(); } }), 2500);
  }

  /* ---------- 8. Ciclo de vida ---------- */
  function init(){
    syncBars();
    if (App){
      App.addListener('backButton', onBack);
      App.addListener('pause', () => { save(true); writeBackup(); onPauseNotif(); svcSync(true); pushWidgets(true); });
      App.addListener('resume', () => { onResumeNotif(); svcResync(); consumeWidget(); hcSync(false); if (S.active || (typeof INT !== 'undefined' && INT)) { awakeOn = false; keepAwake(); } render.keep = true; render(); if (LAYERS.length) refreshTop(); });
    }
    if (S.active) keepAwake();
    setupNotif();
    init2();
    setTimeout(() => safe(() => Splash.hide({fadeOutDuration: 250})), 150);
    if (sessionStorage.getItem('pf-restored')){ sessionStorage.removeItem('pf-restored'); setTimeout(() => toast('Recuperamos tus datos de la copia interna'), 800); }
    setTimeout(writeBackup, 4000);
    // Copia exacta de los datos de antes de una actualización (la crea load() al migrar). No se sobrescribe nunca.
    if (window.PF_PREMIG){ const p = window.PF_PREMIG, path = 'pandaria-antes-v' + p.from + '.json';
      FS.stat({path, directory:'DATA'}).catch(() => FS.writeFile({path, directory:'DATA', encoding:'utf8', data:p.raw})).catch(()=>{}); }
  }
  // Espera a que la app termine de arrancar (S cargado) antes de conectar lo nativo
  const whenReady = () => new Promise(res => { const go = () => (typeof S !== 'undefined' && S) ? res() : setTimeout(go, 50);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); });
  restoreIfNeeded().then(restored => { if (!restored) whenReady().then(init); });
})();
