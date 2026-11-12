/* ============ PandarIA Fit · Premium (P1 + P2) ============
   Código de teléfono, verificación de licencias firmadas por PandarIA Unlocker
   (ECDSA P-256) y candados de las funciones Premium. Funciona sin internet. */
(function(){
  const PUB = 'BJpnO5SDxv3Z8ECzomAf5EsWoD0a2WNwi4bqS15vicZmftuV/hBwsjrpJ27o2Tc2wjxscWV5cYfqFQ+W6NXdncU=';
  const MAIL = 'eddy970728@gmail.com';
  const PRICE_ONCE = '5,99 USD', PRICE_MONTH = '0,49 USD';
  const AB = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin 0, 1, I ni O
  const EPOCH = Date.UTC(2026, 0, 1), DAYMS = 86400000;
  const C = window.Capacitor, native = !!(C && C.isNativePlatform && C.isNativePlatform());
  const P = n => native ? ((C.Plugins && C.Plugins[n]) || (C.registerPlugin ? C.registerPlugin(n) : null)) : null;
  const FS = P('Filesystem'), Device = P('Device'), Share = P('Share');
  const subtle = window.crypto && crypto.subtle;
  const enc = s => new TextEncoder().encode(s);
  const b64bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  /* ---------- Base32 propio ---------- */
  function toB32(bytes, nChars){
    let bits = 0, val = 0, out = '';
    for (const b of bytes){ val = (val << 8) | b; bits += 8; while (bits >= 5){ out += AB[(val >>> (bits - 5)) & 31]; bits -= 5; } val &= (1 << bits) - 1; }
    if (bits > 0) out += AB[(val << (5 - bits)) & 31];
    return nChars ? out.slice(0, nChars) : out;
  }
  function fromB32(str, nBytes){
    let bits = 0, val = 0; const out = [];
    for (const ch of str){ const v = AB.indexOf(ch); if (v < 0) return null; val = (val << 5) | v; bits += 5; if (bits >= 8){ out.push((val >>> (bits - 8)) & 255); bits -= 8; val &= (1 << bits) - 1; } }
    return Uint8Array.from(out.slice(0, nBytes));
  }
  const sha = async s => new Uint8Array(await subtle.digest('SHA-256', enc(s)));
  const clean = s => String(s || '').toUpperCase().replace(/^\s*PFU?-?/, '').replace(/[^A-Z0-9]/g, '');
  async function checkChars(body){ return toB32(await sha('pandaria-chk|' + body), 2); }

  /* ---------- Identidad de esta instalación ---------- */
  let DEV = null, DEVMODEL = '', PREM = null; // PREM: {exp:'P'|'YYYY-MM-DD', code, at}
  const LSI = 'pf-install', LSL = 'pf-license';
  async function readFile(path){ try{ return (await FS.readFile({path, directory:'DATA', encoding:'utf8'})).data; }catch(e){ return null; } }
  async function writeFile(path, data){ try{ await FS.writeFile({path, directory:'DATA', encoding:'utf8', data}); }catch(e){} }
  async function installId(){
    let id = FS ? await readFile('pf-install.txt') : null;
    if (!id){ try{ id = localStorage.getItem(LSI); }catch(e){} }
    if (!id){ const r = crypto.getRandomValues(new Uint8Array(16)); id = Array.from(r, b => b.toString(16).padStart(2,'0')).join(''); }
    try{ localStorage.setItem(LSI, id); }catch(e){}
    if (FS) await writeFile('pf-install.txt', id);
    return id;
  }
  async function deviceCode(){
    let hw = 'web';
    if (Device){ try{ hw = (await Device.getId()).identifier || 'android'; }catch(e){}
      try{ const i = await Device.getInfo(); DEVMODEL = [i.manufacturer, i.model].filter(Boolean).join(' '); }catch(e){} }
    const body = toB32(await sha(`pandaria-fit|${hw}|${await installId()}`), 12);
    return body + await checkChars(body);
  }
  const fmtDev = c => c ? `PF-${c.slice(0,4)}-${c.slice(4,8)}-${c.slice(8,12)}-${c.slice(12,14)}` : '…';

  /* ---------- Licencia ---------- */
  let pubKey = null;
  async function key(){ if (!pubKey) pubKey = await subtle.importKey('raw', b64bytes(PUB), {name:'ECDSA', namedCurve:'P-256'}, false, ['verify']); return pubKey; }
  async function verify(code, dev){
    const c = clean(code); if (c.length < 100) return null;
    const bytes = fromB32(c, 66); if (!bytes || bytes.length < 66) return null;
    const days = (bytes[0] << 8) | bytes[1], sig = bytes.slice(2, 66);
    const exp = days === 0 ? 'P' : new Date(EPOCH + days * DAYMS).toISOString().slice(0, 10);
    try{
      const ok = await subtle.verify({name:'ECDSA', hash:'SHA-256'}, await key(), sig, enc(`PANDARIA-FIT|v1|${dev}|${exp}`));
      return ok ? {exp, code: c} : null;
    }catch(e){ return null; }
  }
  const expired = l => l && l.exp !== 'P' && new Date().toISOString().slice(0, 10) > l.exp;
  window.isPremium = () => !!(PREM && !expired(PREM));
  window.premiumInfo = () => PREM;
  async function loadLicense(){
    let raw = FS ? await readFile('pf-license.json') : null;
    if (!raw){ try{ raw = localStorage.getItem(LSL); }catch(e){} }
    if (!raw) return;
    try{
      const l = JSON.parse(raw), v = await verify(l.code, DEV);
      if (v){ PREM = Object.assign({at: l.at || Date.now()}, v); try{ localStorage.setItem(LSL, JSON.stringify(PREM)); }catch(e){} if (FS) writeFile('pf-license.json', JSON.stringify(PREM)); }
    }catch(e){}
  }
  async function activate(code){
    const v = await verify(code, DEV);
    if (!v) return false;
    if (expired(v)) return 'expired';
    PREM = Object.assign({at: Date.now()}, v);
    const raw = JSON.stringify(PREM);
    try{ localStorage.setItem(LSL, raw); }catch(e){}
    if (FS) await writeFile('pf-license.json', raw);
    return true;
  }
  const fmtExp = e => e === 'P' ? 'permanente' : `hasta el ${fmtDate(new Date(e + 'T12:00:00').getTime())}`;

  /* ---------- Pantalla Premium ---------- */
  const BENEFITS = [
    ['spark','PandarIA completo','Sube pesos y repeticiones por ti, detecta estancamientos, renueva tus rutinas y planifica bloques y descargas.'],
    ['target','Rutinas a tu medida','Rutina por grupo muscular y plan semanal completo «Confía en PandarIA».'],
    ['compass','Todo Explorar','Rutinas de nivel Medio y Difícil, y Fuerza pura, Kettlebell, Running y Boxeo.'],
    ['chart','Progreso a fondo','Gráficas, series por músculo, informes semanales, desequilibrios y metas con fecha.'],
    ['timer','Intervalos sin límite','HIIT, EMOM y AMRAP personalizados.'],
    ['camera','Fotos de progreso','Guarda fotos y compáralas lado a lado.'],
    ['leaf','Calorías y macros','Tu objetivo diario de calorías y macros, y tu diario de comidas comparado con él, día a día y semana a semana.'],
    ['spark','Calidad de la dieta y menús','Fibra, sodio y proteína por comida en tu diario, y ejemplos de menú con tus calorías, tu alimentación y tus alergias.'],
    ['list','Alimentos y recetas sin límite','En la versión gratis, hasta 10. Registrar comidas es gratis.'],
    ['dumbbell','Rutinas ilimitadas','En la versión gratis, hasta 3 (contando las archivadas).'],
    ['edit','Ejercicios propios ilimitados','En la versión gratis, hasta 5.'],
    ['flame','Músculos en las animaciones','Mira en rojo qué músculos trabajan en cada ejercicio, y descansos ajustados por PandarIA en cada serie.']
  ];
  const REASONS = {
    pandaria:'Las rutinas diseñadas por PandarIA son parte de Premium.', explore:'Esta rutina es parte de Premium.', intervals:'Este modo de intervalos es parte de Premium.',
    history:'Esta sección del historial es parte de Premium.', photos:'Las fotos de progreso son parte de Premium.', nutrition:'Las calorías y macros son parte de Premium.', diario:'Comparar tu diario con tu objetivo de calorías y macros, y ver tu semana, es parte de Premium.', alimProp:'En la versión gratis puedes crear hasta 10 alimentos y recetas propios.', calidad:'La calidad del día (fibra, sodio y proteína por comida) es parte de Premium.', menu:'Los ejemplos de menú hechos con tus calorías y tus preferencias son parte de Premium.',
    customEx:'En la versión gratis puedes crear hasta 5 ejercicios propios.', routines:'En la versión gratis puedes tener hasta 3 rutinas, contando las archivadas. Para crear otra, elimina alguna (en Mis rutinas o en Ajustes › Archivadas) o hazte Premium.', anim:'Ver los músculos que trabajan en cada animación es parte de Premium.', notif:'Este aviso es parte de Premium.'
  };
  SCREENS.premium = p => {
    const on = isPremium();
    let b = `<div style="text-align:center;padding:8px 0 4px"><div style="width:76px;height:76px;border-radius:22px;background:linear-gradient(135deg,var(--ac),#ff4f3a);display:grid;place-items:center;margin:0 auto;color:#1a0702">${I('trophy',40)}</div>
      <div style="font-size:26px;font-weight:900;margin-top:14px">PandarIA Fit <span style="color:var(--ac)">Premium</span></div>
      <p class="mut sm" style="margin:6px 12px 0;line-height:1.5">${on ? `Premium activo · ${fmtExp(PREM.exp)}. ¡Gracias por apoyar el proyecto!` : 'Sin anuncios, nunca. Entrenar, la biblioteca de ejercicios, el agua y el ayuno son gratis para siempre.'}</p></div>`;
    if (p.reason && !on) b += `<div class="banner" style="margin-top:14px"><span class="ic">${I('info',20)}</span><div class="grow sm">${esc(REASONS[p.reason] || '')}</div></div>`;
    b += `<div class="sec">Qué incluye</div><div class="card" style="padding:4px 14px">${BENEFITS.map(([ic, t, d], i) => `<div class="row" style="align-items:flex-start;gap:12px;padding:10px 0;${i ? 'border-top:1px solid var(--line)' : ''}"><span style="color:var(--ac)">${I(ic,20)}</span><div class="grow"><div class="b">${t}</div><div class="xs mut" style="line-height:1.4;margin-top:2px">${d}</div></div>${on ? `<span style="color:var(--ok)">${I('check',18)}</span>` : ''}</div>`).join('')}</div>`;
    if (!on){
      b += `<div class="sec">Comprar</div><div class="card"><button class="btn pri wide" disabled style="opacity:.55">Pago único · ${PRICE_ONCE}</button><button class="btn wide" disabled style="opacity:.55;margin-top:8px">Suscripción · ${PRICE_MONTH} al mes</button>
        <div class="xs mut" style="text-align:center;margin-top:10px"><b>Próximamente.</b> Pago una sola vez con las mejoras futuras incluidas, o una suscripción mensual.</div></div>`;
      b += `<div class="sec">¿No puedes pagarlo? Pídeselo al creador</div><div class="card">
        <p class="sm" style="margin:0 0 12px;line-height:1.5">PandarIA Fit es un proyecto personal. Si no puedes pagar, escríbeme y te lo regalo. Solo funcionará en este teléfono; si borras la app tendrás que pedirlo de nuevo.</p>
        <div class="xs mut b" style="letter-spacing:1px;margin-bottom:6px">TU CÓDIGO DE TELÉFONO</div>
        <div class="codebox" style="font-size:19px">${fmtDev(DEV)}</div>
        <div class="row" style="gap:8px;margin-top:10px"><button class="btn grow sm" data-a="pfCopyDev">${I('copy',16)} Copiar</button><button class="btn grow sm" data-a="pfShareDev">${I('upload',16)} Compartir</button></div>
        <button class="btn pri wide" style="margin-top:8px" data-a="pfMail">${I('note',18)} Enviar correo al creador</button>
        <div class="xs mut b" style="letter-spacing:1px;margin:18px 0 6px">CÓDIGO DE DESBLOQUEO</div>
        <textarea id="pfcode" class="inp" rows="3" placeholder="Pega aquí el código que te enviaron (empieza por PFU-)" style="font-family:ui-monospace,Menlo,monospace;font-size:13px"></textarea>
        <button class="btn ok wide" style="margin-top:10px" data-a="pfActivate">${I('check',18)} Activar Premium</button></div>`;
    } else {
      b += `<div class="sec">Tu licencia</div><div class="card" style="padding:4px 14px"><div class="kv"><span class="mut">Estado</span><b style="color:var(--ok)">Activa</b></div><div class="kv"><span class="mut">Duración</span><b>${cap1(fmtExp(PREM.exp))}</b></div><div class="kv"><span class="mut">Activada</span><b>${fmtDate(PREM.at)}</b></div><div class="kv"><span class="mut">Teléfono</span><b style="font-family:ui-monospace,Menlo,monospace;font-size:13px">${fmtDev(DEV)}</b></div></div>`;
    }
    return lhdr('Premium') + `<div class="lbody">${b}<p class="xs mut" style="text-align:center;margin:18px 8px 0;line-height:1.5">Tus datos siempre son tuyos: exportar, copias de seguridad, accesibilidad y seguridad nunca se bloquean.</p></div>`;
  };
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  const pay = reason => openLayer('premium', {reason});
  window.pfPay = pay;
  A.pfPay = () => pay('notif');
  A.openPremium = () => openLayer('premium', {});
  const copyText = t => { try{ navigator.clipboard.writeText(t).then(() => toast('Copiado'), () => fallbackCopy(t)); }catch(e){ fallbackCopy(t); } };
  A.pfCopyDev = () => copyText(fmtDev(DEV));
  const mailBody = () => `Hola, quiero usar PandarIA Fit Premium.\n\nMi código de teléfono: ${fmtDev(DEV)}\nTeléfono: ${DEVMODEL || 'no indicado'}\n\n¡Gracias!`;
  A.pfShareDev = () => {
    const text = mailBody();
    if (Share) Share.share({title:'Desbloqueo PandarIA Fit', text, dialogTitle:'Enviar código'}).catch(() => {});
    else if (navigator.share) navigator.share({title:'Desbloqueo PandarIA Fit', text}).catch(() => {});
    else copyText(text);
  };
  A.pfMail = () => { location.href = `mailto:${MAIL}?subject=${encodeURIComponent('Desbloqueo PandarIA Fit')}&body=${encodeURIComponent(mailBody())}`; };
  A.pfActivate = async () => {
    const el = $('#pfcode'), v = el && el.value.trim();
    if (!v){ toast('Pega primero el código de desbloqueo'); return; }
    const r = await activate(v);
    if (r === true){
      if (typeof sfx === 'function') sfx('finish'); if (typeof confetti === 'function') confetti({n:150});
      refreshTop(); render.keep = true; render(); toast(`🎉 ¡Premium activado! (${fmtExp(PREM.exp)})`);
      if (typeof scheduleNotifs === 'function') scheduleNotifs();
    } else toast(r === 'expired' ? 'Ese código ya caducó. Pide uno nuevo.' : 'Código no válido para este teléfono. Revisa que esté completo.');
  };

  /* ---------- Candados (P2) ---------- */
  const st = document.createElement('style');
  st.textContent = `.pf-lockwrap{position:relative}.pf-blur{filter:blur(5px);opacity:.55;pointer-events:none;user-select:none;max-height:560px;overflow:hidden}
  .pf-lockcard{position:absolute;left:50%;top:70px;transform:translateX(-50%);width:min(88%,360px);background:var(--bg2);border:1px solid var(--line);border-radius:18px;padding:18px;text-align:center;box-shadow:0 12px 34px rgba(0,0,0,.35);z-index:2}
  .xlock{position:absolute;top:10px;right:10px;font-size:11px;font-weight:800;background:rgba(0,0,0,.35);color:#fff;border-radius:9px;padding:3px 8px;z-index:1}`;
  document.head.appendChild(st);
  const lockCard = (title, reason) => `<div class="pf-lockcard"><div style="font-size:30px">🔒</div><div class="b" style="margin-top:6px">${title}</div><div class="xs mut" style="margin:6px 0 12px;line-height:1.4">Disponible con PandarIA Fit Premium.</div><button class="btn pri wide" data-a="pfGo" data-v="${reason}">Ver Premium</button></div>`;
  A.pfGo = r => pay(r);
  const locked = () => !isPremium();

  // Rutinas de PandarIA y por grupo muscular
  const _openLayer = openLayer;
  openLayer = function(t, p){
    if (locked() && (t === 'wizGrupo' || t === 'wizPandaria')) return _openLayer('premium', {reason:'pandaria'});
    return _openLayer.apply(this, arguments);
  };
  const _sheet = sheet;
  sheet = function(title, items){
    if (locked() && title === 'Nueva rutina') items = items.map(it => /grupo muscular|Confía en PandarIA/.test(it.label || '') ? Object.assign({}, it, {label: it.label + ' 🔒'}) : it);
    return _sheet.call(this, title, items);
  };
  // PandarIA completo: sin Premium, solo "lo de la última vez" y peso inicial estimado
  const _suggest = suggestSet;
  suggestSet = function(r, it, idx){ if (locked() && r && r.pandaria) r = Object.assign({}, r, {pandaria:false}); return _suggest.call(this, r, it, idx); };
  const _after = afterSession;
  afterSession = function(session){
    const r = locked() && S.routines.find(x => x.id === session.routineId);
    if (r && r.pandaria){ r.pandaria = false; try{ return _after.call(this, session); } finally { r.pandaria = true; } }
    return _after.call(this, session);
  };
  const _pp = periodPhase; periodPhase = function(r){ return locked() ? null : _pp.call(this, r); };
  const _pi = phaseInfo; phaseInfo = function(){ return locked() ? null : _pi.call(this); };
  const _start = A.startWorkout;
  A.startWorkout = rid => { if (!locked()) return _start(rid); const c = S.settings.checkin; S.settings.checkin = false; try{ return _start(rid); } finally { S.settings.checkin = c; } };
  const _rb = reportBanner; reportBanner = function(){ return locked() ? '' : _rb.call(this); };
  const _bb = balanceBanner; balanceBanner = function(){ return locked() ? '' : _bb.call(this); };

  // Explorar: niveles Medio y Difícil, y secciones especiales
  const PREM_SECTIONS = ['fuerza','kettlebell','running','boxeo'];
  const tplLocked = (sid, i) => { if (!locked()) return false; const sec = EXPLORE.find(s => s.id === sid); const r = sec && sec.r[i]; return PREM_SECTIONS.includes(sid) || (r && r.l >= 2); };
  const _vx = viewExplorar;
  viewExplorar = function(){
    let h = _vx.apply(this, arguments);
    if (locked()) h = h.replace(/data-a="openTpl" data-v="([a-z]+)\|(\d+)">/g, (m, sid, i) => tplLocked(sid, +i) ? `${m}<span class="xlock">🔒 Premium</span>` : m);
    return h;
  };
  const _ot = A.openTpl;
  A.openTpl = v => { const [sid, i] = v.split('|'); if (tplLocked(sid, +i)) return pay('explore'); return _ot(v); };

  // Modo intervalos: HIIT, EMOM y AMRAP
  const _si = SCREENS.intervals;
  SCREENS.intervals = p => { let h = _si(p); if (locked()) ['HIIT','EMOM','AMRAP'].forEach(n => { h = h.replace(`data-v="${n.toLowerCase()}">${n}<`, `data-v="${n.toLowerCase()}">${n} 🔒<`); }); return h; };
  const _if = A.intFmt; A.intFmt = v => { if (locked() && v !== 'tabata') return pay('intervals'); _if(v); };
  const _is = A.intStart; A.intStart = () => { const t = LAYERS[LAYERS.length-1]; if (locked() && t && t.p.cfg && t.p.cfg.fmt !== 'tabata'){ t.p.cfg.fmt = 'tabata'; refreshTop(); return pay('intervals'); } _is(); };

  // Historial: Informes, Metas y Progreso con vista previa borrosa
  const HLOCK = {informes:'Informes semanales', metas:'Metas con fecha', progreso:'Gráficas de progreso'};
  const _vh = viewHistorial;
  viewHistorial = function(){
    let h = _vh.apply(this, arguments);
    if (!locked()) return h;
    Object.keys(HLOCK).forEach(k => { h = h.replace(new RegExp(`(data-v="${k}">)([^<]+)<`), `$1$2 🔒<`); });
    if (!HLOCK[HSEG]) return h;
    const a = h.indexOf('<div class="chips scroll"'), b = h.indexOf('</div>', a) + 6;
    return h.slice(0, b) + `<div class="pf-lockwrap"><div class="pf-blur">${h.slice(b)}</div>${lockCard(HLOCK[HSEG], 'history')}</div>`;
  };

  // Cuerpo: fotos de progreso
  const _mp = A.mPhoto; A.mPhoto = () => locked() ? pay('photos') : _mp();
  const _pc = A.photoCmp; A.photoCmp = () => locked() ? pay('photos') : _pc();

  // Nutrición: calorías y macros
  const _vn = viewNutricion;
  viewNutricion = function(){
    let h = _vn.apply(this, arguments);
    if (!locked()) return h;
    const a = h.indexOf('<div class="sec">Tu objetivo diario</div>'), b = h.indexOf('<div class="sec">Agua</div>');
    if (a < 0 || b < 0) return h;
    return h.slice(0, a) + `<div class="pf-lockwrap" style="min-height:300px"><div class="pf-blur">${h.slice(a, b)}</div>${lockCard('Calorías y macros', 'nutrition')}</div>` + h.slice(b);
  };

  // Rutinas: hasta 3 en la versión gratis, contando las archivadas (para crear más hay que eliminar alguna)
  const FREE_ROUTINES = 3;
  const roomFor = (n=1) => !locked() || S.routines.length + n <= FREE_ROUTINES;
  const guard = (fn, n) => function(){ const k = typeof n === 'function' ? n() : (n || 1); if (!roomFor(k)) return pay('routines'); return fn.apply(this, arguments); };
  A.newRoutine = guard(A.newRoutine);
  A.tplAdd = guard(A.tplAdd);
  A.importCode = guard(A.importCode);
  if (A.wgGo) A.wgGo = guard(A.wgGo);
  if (A.wpAdd) A.wpAdd = guard(A.wpAdd, () => { const t = LAYERS[LAYERS.length-1]; return (t && t.p && t.p.program && t.p.program.length) || 1; });
  const _se = A.saveEditor;
  A.saveEditor = function(){ const t = LAYERS[LAYERS.length-1]; if (t && t.p && t.p.isNew && !roomFor(1)) return pay('routines'); return _se.apply(this, arguments); };
  const _sh2 = sheet;
  sheet = function(title, items){ if (Array.isArray(items)) items = items.map(it => it && it.label === 'Duplicar' ? Object.assign({}, it, {fn: guard(it.fn)}) : it); return _sh2.call(this, title, items); };
  const _vr = viewRutinas;
  viewRutinas = function(){
    let h = _vr.apply(this, arguments);
    if (!locked()) return h;
    const n = S.routines.length, arch = S.routines.filter(r => r.archived).length;
    const note = `<div class="xs mut" style="text-align:center;margin:-4px 0 12px">${n > FREE_ROUTINES ? `Versión gratis: tienes ${n} rutinas${arch ? ` (${arch} archivada${arch > 1 ? 's' : ''})` : ''} y el límite es ${FREE_ROUTINES}. Puedes seguir usándolas todas; para crear otra, elimina ${n - FREE_ROUTINES + 1} o <a data-a="pfGo" data-v="routines" style="color:var(--ac);font-weight:800">hazte Premium</a>` : `Versión gratis: ${n} de ${FREE_ROUTINES} rutinas${arch ? ` (${arch} archivada${arch > 1 ? 's' : ''})` : ''}`}${n === FREE_ROUTINES ? ' · elimina una para crear otra o <a data-a="pfGo" data-v="routines" style="color:var(--ac);font-weight:800">hazte Premium</a>' : ''}</div>`;
    return h.replace(/(<button class="newbtn" data-a="newRoutine">[\s\S]*?<\/button>)/, `$1${note}`);
  };

  // Ejercicios propios: hasta 5 gratis
  const _ce = A.ceSave; A.ceSave = () => { if (locked() && S.customEx.length >= 5) return pay('customEx'); _ce(); };

  // Ajustes: fila de Premium
  const _va = viewAjustes;
  viewAjustes = function(){
    const on = isPremium();
    const row = `<div class="card row tap" data-a="openPremium" style="cursor:pointer;gap:14px;${on ? '' : 'border-color:rgba(255,122,26,.45);background:var(--acs)'}"><span style="width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,var(--ac),#ff4f3a);display:grid;place-items:center;color:#1a0702;flex:0 0 auto">${I('trophy',22)}</span><div class="grow"><div class="b">PandarIA Fit Premium</div><div class="sm mut">${on ? `Activo · ${fmtExp(PREM.exp)}` : 'Desbloquea PandarIA completo y más'}</div></div>${I('right',18)}</div>`;
    return _va.apply(this, arguments).replace('<div class="sec">Entrenamiento</div>', row + '<div class="sec">Entrenamiento</div>');
  };

  /* ---------- Arranque ---------- */
  (async () => {
    if (!subtle) return;
    try{ DEV = await deviceCode(); }catch(e){}
    await loadLicense();
    const go = () => { if (typeof S === 'undefined' || !S) return setTimeout(go, 60); render.keep = true; render(); if (LAYERS.length) refreshTop(); if (typeof scheduleNotifs === 'function') scheduleNotifs(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  })();
})();
