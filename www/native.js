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
  save = function(now){ _save(now); if (now) setTimeout(writeBackup, 50); else scheduleBackup(); };

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
  speak = function(text){
    if (!S.settings.voice || !TTS || !text) return;
    safe(async () => { try{ await TTS.stop(); }catch(e){}
      await TTS.speak({text: String(text), lang: EN_LANG() ? 'en-US' : 'es-ES', rate: 1.0, pitch: 1.0, volume: 1.0, category: 'playback'}); });
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

  /* ---------- 8. Ciclo de vida ---------- */
  function init(){
    syncBars();
    if (App){
      App.addListener('backButton', onBack);
      App.addListener('pause', () => { save(true); writeBackup(); });
      App.addListener('resume', () => { if (S.active || (typeof INT !== 'undefined' && INT)) { awakeOn = false; keepAwake(); } render.keep = true; render(); if (LAYERS.length) refreshTop(); });
    }
    if (S.active) keepAwake();
    setTimeout(() => safe(() => Splash.hide({fadeOutDuration: 250})), 150);
    if (sessionStorage.getItem('pf-restored')){ sessionStorage.removeItem('pf-restored'); setTimeout(() => toast('Recuperamos tus datos de la copia interna'), 800); }
    setTimeout(writeBackup, 4000);
  }
  restoreIfNeeded().then(restored => { if (!restored) init(); });
})();
