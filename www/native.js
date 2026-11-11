/* ============ PandarIA Fit · Integración nativa Android (Fase 1) ============
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

  /* ---------- 9. Notificaciones (Fase 2) ---------- */
  const LN = P('LocalNotifications');
  const NDEF = {train:true, rest:true, fast:true, water:true, waterEvery:120, waterFrom:'09:00', waterTo:'21:00', report:true, streak:true, pandaria:true, asked:false};
  const NS = () => (S.settings.notif = Object.assign({}, NDEF, S.settings.notif || {}));
  const ID = {train:1000, rest:2000, timer:2001, fastGoal:3000, fastHalf:3001, fastWin:3002, fastStart:3003, water:4000, report:5000, streak:6000, pandaria:7000};
  let notifOk = false, exactOk = false, nT = null;

  async function refreshPerm(){
    if (!LN) return;
    try{ notifOk = (await LN.checkPermissions()).display === 'granted'; }catch(e){}
    try{ exactOk = (await LN.checkExactNotificationSetting()).exact_alarm === 'granted'; }catch(e){ exactOk = true; }
  }
  function mk(id, title, body, when, channelId, extra, actionTypeId, exact){
    const n = {id, title, body, largeBody: body, channelId, schedule: {at: when, allowWhileIdle: true}, extra: extra || {},
      smallIcon: 'ic_stat_pandaria', iconColor: '#ff7a1a', isExactNotification: !!(exact && exactOk)};
    if (actionTypeId) n.actionTypeId = actionTypeId;
    return n;
  }
  const fmtEvery = m => m % 60 ? `${Math.floor(m/60)} h ${m%60} min` : `${m/60} h`;
  const litros = ml => (ml/1000).toLocaleString('es', {maximumFractionDigits: 2});
  const WATER_MSG = ['¡Hora de hidratarse! 💧', 'Tu cuerpo te pide un vaso de agua', 'Un sorbo más cerca de tu meta', 'Pausa de agua: tus músculos lo agradecen', '¿Un vasito? Tu llama interior también tiene sed 🦙', 'Hidratarte mejora tu energía y tu rendimiento'];

  async function setupNotif(){
    if (!LN) return;
    try{
      await LN.createChannel({id:'entreno', name:'Entreno en curso', description:'Fin del descanso y de las series', importance:5, vibration:true, visibility:1});
      await LN.createChannel({id:'recordatorios', name:'Recordatorios de entreno', description:'Cuándo toca entrenar y racha', importance:4, vibration:true});
      await LN.createChannel({id:'ayuno', name:'Ayuno', description:'Meta y ventana de comida', importance:4, vibration:true});
      await LN.createChannel({id:'agua', name:'Agua', description:'Recordatorios para beber agua', importance:3, vibration:false});
      await LN.createChannel({id:'pandaria', name:'PandarIA e informes', description:'Sugerencias e informe semanal', importance:3});
      await LN.registerActionTypes({types:[
        {id:'EMPEZAR', actions:[{id:'start', title:'Empezar'}]},
        {id:'AGUA', actions:[{id:'w250', title:'+250 ml'}, {id:'w500', title:'+500 ml'}]},
        {id:'AYUNO', actions:[{id:'faststart', title:'Empezar ayuno'}]},
        {id:'AYUNO_FIN', actions:[{id:'fastend', title:'Terminar ayuno'}]}
      ]});
      LN.addListener('localNotificationActionPerformed', onNotifAction);
    }catch(e){}
    await refreshPerm();
    if (!notifOk && !NS().asked && S.settings.onboarded) setTimeout(askNotifModal, 1200);
    rescheduleAll();
  }
  function askNotifModal(){
    NS().asked = true; save();
    openModal(`<div class="modal"><h3>🔔 Activa las notificaciones</h3><p class="mut" style="line-height:1.5;margin:0 0 18px">PandarIA te avisará cuando termine el descanso, cuándo toca entrenar, cuándo beber agua y los hitos de tu ayuno. Eliges cada aviso en Ajustes.</p>
      <div class="col" style="gap:8px"><button class="btn pri wide" data-a="cbm" data-v="${cb(enableNotifs)}">Activar</button><button class="btn wide" data-a="closeModal">Ahora no</button></div></div>`, {center:true});
  }
  async function enableNotifs(){
    try{ notifOk = (await LN.requestPermissions()).display === 'granted'; }catch(e){}
    if (!notifOk){ toast('Sin permiso no podemos avisarte. Actívalo en Ajustes de Android › Aplicaciones › PandarIA Fit.'); return; }
    await refreshPerm(); rescheduleAll(); render.keep = true; render();
    if (!exactOk) askExact();
  }
  function askExact(){
    confirmBox({title:'Avisos a la hora exacta', text:'Para que el fin del descanso y los recordatorios lleguen justo a tiempo, Android necesita el permiso <b>Alarmas y recordatorios</b>. Se abrirá la pantalla para activarlo; luego vuelve con el botón atrás.',
      okText:'Abrir ajuste', ok: async () => { try{ await LN.changeExactNotificationSetting(); }catch(e){} await refreshPerm(); rescheduleAll(); render.keep = true; render(); }, noText:'Ahora no'});
  }

  var scheduleNotifs = () => { clearTimeout(nT); nT = setTimeout(rescheduleAll, 1500); };

  async function rescheduleAll(){
    if (!LN || !notifOk) return;
    const n = NS(), list = [], now = Date.now();
    // Recordatorio de entreno (próximos 14 días)
    const rem = S.settings.reminders;
    if (n.train && rem.days.length){
      const [h, m] = rem.time.split(':').map(Number);
      const nx = typeof nextInPlan === 'function' ? nextInPlan() : null, r = nx && nx.r;
      let k = 0;
      for (let d = 0; d < 14; d++){
        const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0);
        if (t.getTime() <= now || !rem.days.includes(t.getDay())) continue;
        if (d === 0 && trainedToday().length) continue;
        list.push(mk(ID.train + k++, r ? `Hoy toca ${r.name} · ${routineMinutes(r)} min` : '¡Hoy toca entrenar!',
          r ? 'Tu rutina te espera. Toca Empezar y a darle.' : 'Elige una rutina y dale. Unos minutos ya cuentan.', t, 'recordatorios', {go:'train', rid: r && r.id}, r ? 'EMPEZAR' : null, true));
      }
    }
    // Agua al estilo Waterllama: repartida en tu horario y se detiene al llegar a la meta
    if (n.water){
      const goal = waterGoal(), [fh, fm] = n.waterFrom.split(':').map(Number), [th, tm] = n.waterTo.split(':').map(Number);
      let k = 0;
      for (let d = 0; d < 2 && k < 40; d++){
        const base = new Date(); base.setDate(base.getDate() + d);
        const drank = d === 0 ? (nut().water[dayKey()] || 0) : 0;
        if (drank >= goal) continue;
        const st = new Date(base); st.setHours(fh, fm, 0, 0); const en = new Date(base); en.setHours(th, tm, 0, 0);
        for (let t = st.getTime(), i = 0; t <= en.getTime() && k < 40; t += n.waterEvery * 60000, i++){
          if (t <= now + 60000) continue;
          const title = i === 0 ? '¡Buenos días! 💧' : WATER_MSG[(i + d) % WATER_MSG.length];
          const body = i === 0 ? 'Empieza el día con un vaso de agua.' : d === 0 ? `Llevas ${litros(drank)} de ${litros(goal)} L hoy.` : `Tu meta de hoy: ${litros(goal)} L.`;
          list.push(mk(ID.water + k++, title, body, new Date(t), 'agua', {go:'water'}, 'AGUA', false));
        }
      }
    }
    // Ayuno: mitad, meta y ventana de comida
    const f = S.nutri && S.nutri.fast;
    if (n.fast && f && f.screened && !f.blocked){
      if (f.active && f.active.goalH){
        const goalT = f.active.start + f.active.goalH * 3600000, halfT = f.active.start + f.active.goalH * 1800000;
        if (halfT > now) list.push(mk(ID.fastHalf, 'Vas por la mitad del ayuno 💪', `Llevas ${f.active.goalH/2} h. Agua, café o té sin azúcar te ayudan.`, new Date(halfT), 'ayuno', {go:'fast'}, null, false));
        if (goalT > now) list.push(mk(ID.fastGoal, `¡${f.active.goalH} h de ayuno cumplidas! 🎉`, 'Rompe el ayuno con proteína y verduras.', new Date(goalT), 'ayuno', {go:'fast'}, 'AYUNO_FIN', true));
      } else if (!f.active){
        const plan = FAST_PLANS[f.plan], last = f.history[f.history.length - 1];
        if (plan && plan.h && last){
          const close = last.end + (24 - plan.h) * 3600000;
          if (close - 3600000 > now) list.push(mk(ID.fastWin, 'Tu ventana de comida cierra en 1 h', 'Buen momento para tu última comida, con proteína.', new Date(close - 3600000), 'ayuno', {go:'fast'}, null, false));
          if (close > now) list.push(mk(ID.fastStart, 'Hora de empezar tu ayuno ⏱️', `Plan ${plan.n}. Toca para empezarlo.`, new Date(close), 'ayuno', {go:'fast'}, 'AYUNO', true));
        }
      }
    }
    // Informe semanal: lunes 9:00
    if (n.report && S.settings.report !== false){
      const t = new Date(); t.setHours(9, 0, 0, 0); let add = (8 - t.getDay()) % 7; if (add === 0 && t.getTime() <= now) add = 7; t.setDate(t.getDate() + add);
      const r = weekReport(weekKey(now));
      const body = r.n ? `Semana: ${plural(r.n,'entreno','entrenos')}${r.pvol ? `, ${r.vol >= r.pvol ? '+' : ''}${Math.round((r.vol - r.pvol) / r.pvol * 100)} % de volumen` : ''}${r.prs ? `, ${plural(r.prs,'récord','récords')}` : ''}. Toca para verlo.` : 'Nueva semana, nuevo comienzo. Toca para ver tu informe.';
      list.push(mk(ID.report, 'Tu informe semanal está listo 📊', body, t, 'pandaria', {go:'report'}, null, false));
    }
    // Racha en riesgo: domingo 11:00
    if (n.streak){
      const t = new Date(); t.setHours(11, 0, 0, 0); t.setDate(t.getDate() + (7 - t.getDay()) % 7);
      if (t.getTime() > now){
        const wk = weekKey(now), days = new Set(S.sessions.filter(s => weekKey(s.end) === wk).map(s => new Date(s.end).toDateString())).size;
        const target = S.plan && S.plan.days.length ? S.plan.days.length : 1, st = streakWeeks(), falt = target - days;
        if (falt > 0){
          const title = days === 0 && st > 0 ? `🔥 Tu racha de ${plural(st,'semana','semanas')} está en riesgo` : 'Último día de la semana';
          const body = days === 0 ? 'Entrena hoy para mantener la racha. Unos minutos ya cuentan.' : `Te ${falt === 1 ? 'falta 1 entreno' : 'faltan ' + falt + ' entrenos'} para tu objetivo semanal.`;
          list.push(mk(ID.streak, title, body, t, 'recordatorios', {go:'train'}, null, false));
        }
      }
    }
    // Sugerencias de PandarIA: a las 10:00
    if (n.pandaria){
      const rs = S.routines.filter(r => !r.archived && (r.sugg || []).length);
      if (rs.length){
        const t = new Date(); t.setHours(10, 0, 0, 0); if (t.getTime() < now + 2 * 3600000) t.setDate(t.getDate() + 1);
        const tot = rs.reduce((a, r) => a + r.sugg.length, 0);
        list.push(mk(ID.pandaria, `PandarIA tiene ${plural(tot,'sugerencia','sugerencias')} para ti`, `${rs[0].name}: ${rs[0].sugg[0].title}`, t, 'pandaria', {go:'routine', rid: rs[0].id}, null, false));
      }
    }
    try{
      const p = await LN.getPending();
      const del = (p.notifications || []).filter(x => x.id !== ID.rest && x.id !== ID.timer).map(x => ({id: x.id}));
      if (del.length) await LN.cancel({notifications: del});
      if (list.length) await LN.schedule({notifications: list});
    }catch(e){}
  }

  // Fin del descanso / serie por tiempo con la app en segundo plano
  function onPauseNotif(){
    if (!LN || !notifOk || !NS().rest || !S.active) return;
    const a = S.active, list = [], now = Date.now();
    if (a.rest && a.rest.end > now + 1500){
      const np = nextPending(); let body = 'A por la siguiente serie';
      if (np){ const ex = getEx(np.it.exId), wn = np.it.sets.slice(0, np.i + 1).filter(x => x.t !== 'c').length;
        body = np.it.sets[np.i].t === 'c' ? `Calentamiento de ${ex.n}` : `¡A por la serie ${wn} de ${ex.n}!`; }
      list.push(mk(ID.rest, '⏱️ Descanso terminado', body, new Date(a.rest.end), 'entreno', {go:'workout'}, null, true));
    }
    if (a.timer && a.timer.end > now + 1500){
      const it = wkItem(a.timer.uid);
      list.push(mk(ID.timer, '✅ Tiempo cumplido', it ? `${getEx(it.exId).n}: serie completada` : 'Serie completada', new Date(a.timer.end), 'entreno', {go:'workout'}, null, true));
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
      }
    }catch(e){} }, 400);
  }

  // Sección en Ajustes
  function notifSection(){
    const n = NS();
    const tg = (k, ic, l, d) => `<button class="srow" data-a="nfTog" data-v="${k}"><span class="si">${I(ic,20)}</span><span class="grow"><div class="b">${l}</div>${d ? `<div class="xs mut">${d}</div>` : ''}</span><span class="toggle ${n[k] ? 'on' : ''}"></span></button>`;
    let h = `<div class="sec">Notificaciones</div>`;
    if (!notifOk) h += `<div class="banner"><span class="ic">${I('bell',20)}</span><div class="grow sm">Las notificaciones están desactivadas.<br><button class="link sm" style="margin-top:8px" data-a="nfEnable">Activarlas</button></div></div>`;
    else if (!exactOk) h += `<div class="banner blue"><span class="ic">${I('timer',20)}</span><div class="grow sm">Permite <b>Alarmas y recordatorios</b> para que el fin del descanso llegue al segundo.<br><button class="link sm" style="margin-top:8px" data-a="nfExact">Permitir</button></div></div>`;
    h += `<div class="card" style="padding:0 12px">
      ${tg('train','dumbbell','Recordatorio de entreno','Los días y la hora de Recordatorios')}
      ${tg('rest','timer','Fin del descanso','Si sales de la app durante un descanso')}
      ${tg('fast','leaf','Ayuno','Mitad, meta y ventana de comida')}
      ${tg('water','drop','Agua', `Cada ${fmtEvery(n.waterEvery)}, de ${n.waterFrom} a ${n.waterTo}. Se detiene al llegar a tu meta.`)}
      ${tg('report','chart','Informe semanal','Los lunes a las 9:00')}
      ${tg('streak','flame','Racha en riesgo','El domingo, si te falta entrenar')}
      ${tg('pandaria','spark','Sugerencias de PandarIA','Cuando hay mejoras para tus rutinas')}</div>`;
    if (n.water) h += `<div class="card"><div class="b sm" style="margin-bottom:10px">Recordatorios de agua</div>
      <div class="chips">${[60,90,120,180].map(m => `<button class="chip ${n.waterEvery === m ? 'on' : ''}" data-a="nfEvery" data-v="${m}">Cada ${fmtEvery(m)}</button>`).join('')}</div>
      <div class="row" style="gap:8px;margin-top:12px"><span class="sm">De</span><input type="time" class="inp grow" style="height:42px" value="${n.waterFrom}" data-ch="nfFrom"><span class="sm">a</span><input type="time" class="inp grow" style="height:42px" value="${n.waterTo}" data-ch="nfTo"></div></div>`;
    h += `<button class="btn wide" data-a="nfBattery">${I('info',18)} Que los avisos lleguen siempre (Samsung)</button>
      <button class="btn ghost wide" style="margin-top:6px" data-a="nfTest">${I('bell',18)} Enviar una notificación de prueba</button>`;
    return h;
  }
  const _va = viewAjustes;
  viewAjustes = function(){ return _va.apply(this, arguments).replace('<div class="sec">Tus datos</div>', notifSection() + '<div class="sec">Tus datos</div>'); };
  const reAj = () => { save(); render.keep = true; render(); };
  A.nfTog = k => { const n = NS(); n[k] = !n[k]; reAj(); };
  A.nfEnable = () => enableNotifs();
  A.nfExact = () => askExact();
  A.nfEvery = m => { NS().waterEvery = +m; reAj(); };
  CH.nfFrom = el => { if (el.value) { NS().waterFrom = el.value; reAj(); } };
  CH.nfTo = el => { if (el.value) { NS().waterTo = el.value; reAj(); } };
  A.nfTest = async () => {
    if (!notifOk){ enableNotifs(); return; }
    try{ await LN.schedule({notifications: [mk(9999, 'PandarIA Fit 🐼', '¡Las notificaciones funcionan! Bloquea el teléfono y espera…', new Date(Date.now() + 5000), 'entreno', {}, null, true)]}); toast('Llegará en 5 segundos'); }catch(e){ toast('No se pudo programar'); }
  };
  A.nfBattery = () => openModal(`<div class="sheet"><div class="grab"></div><h3>Que los avisos lleguen siempre</h3>
    <p class="sm mut" style="margin:-6px 4px 14px;line-height:1.45">Samsung duerme las apps para ahorrar batería y puede retrasar los avisos. Haz esto una sola vez:</p>
    <div class="card">${[
      '<b>Ajustes › Aplicaciones › PandarIA Fit › Batería</b> y elige <b>Sin restricciones</b>.',
      '<b>Ajustes › Batería › Límites de uso en segundo plano › Aplicaciones que nunca se suspenden</b> y añade PandarIA Fit.',
      'En <b>Ajustes › Aplicaciones › PandarIA Fit › Notificaciones</b>, comprueba que estén activadas y que <i>Entreno en curso</i> tenga sonido.',
      'En la misma pantalla de la app, en <b>Alarmas y recordatorios</b>, deja el permiso activado.'
    ].map((t, i) => `<div class="row" style="align-items:flex-start;padding:6px 0"><span class="tag ac" style="min-width:24px;justify-content:center">${i+1}</span><span class="sm" style="line-height:1.45">${t}</span></div>`).join('')}</div>
    <p class="xs mut" style="line-height:1.4">Los nombres pueden variar un poco según tu versión de One UI.</p>
    <button class="btn pri big" data-a="closeModal">Entendido</button></div>`);

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
