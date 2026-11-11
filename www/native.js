/* ============ PandarIA Fit · Integración nativa Android (Fases 1, 2 y N) ============
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
  save = function(now){ _save(now); if (now) setTimeout(writeBackup, 50); else scheduleBackup(); if (scheduleNotifs) scheduleNotifs(); };

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
        const drank = d === 0 ? (nut().water[dayKey()] || 0) : 0, done = drank >= goal;
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

  /* ---------- 8. Ciclo de vida ---------- */
  function init(){
    syncBars();
    if (App){
      App.addListener('backButton', onBack);
      App.addListener('pause', () => { save(true); writeBackup(); onPauseNotif(); });
      App.addListener('resume', () => { onResumeNotif(); if (S.active || (typeof INT !== 'undefined' && INT)) { awakeOn = false; keepAwake(); } render.keep = true; render(); if (LAYERS.length) refreshTop(); });
    }
    if (S.active) keepAwake();
    setupNotif();
    setTimeout(() => safe(() => Splash.hide({fadeOutDuration: 250})), 150);
    if (sessionStorage.getItem('pf-restored')){ sessionStorage.removeItem('pf-restored'); setTimeout(() => toast('Recuperamos tus datos de la copia interna'), 800); }
    setTimeout(writeBackup, 4000);
  }
  // Espera a que la app termine de arrancar (S cargado) antes de conectar lo nativo
  const whenReady = () => new Promise(res => { const go = () => (typeof S !== 'undefined' && S) ? res() : setTimeout(go, 50);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); });
  restoreIfNeeded().then(restored => { if (!restored) whenReady().then(init); });
})();
