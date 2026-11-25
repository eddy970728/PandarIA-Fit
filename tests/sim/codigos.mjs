// Verificación de los códigos de PandarIA Unlocker: se firman aquí igual que el Unlocker (clave privada fuera del repositorio)
// y se pegan en la app como lo haría el usuario. Si no hay clave en esta máquina, la prueba se salta.
import fs from 'node:fs';
import { webcrypto as C } from 'node:crypto';
import { abrirApp } from './app.mjs';
const PRIV = process.env.PF_PRIV || '/home/claude/pandaria-fit/firma/priv.txt';
if (!fs.existsSync(PRIV)) { console.log('Sin clave privada en esta máquina: prueba saltada'); process.exit(0); }
const AB = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ', EPOCH = Date.UTC(2026, 0, 1), DAY = 864e5, enc = s => new TextEncoder().encode(s);
const toB32 = (bytes, n) => { let bits = 0, val = 0, out = ''; for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += AB[(val >>> (bits - 5)) & 31]; bits -= 5; } val &= (1 << bits) - 1; } if (bits > 0) out += AB[(val << (5 - bits)) & 31]; return n ? out.slice(0, n) : out; };
const txt = fs.readFileSync(PRIV, 'utf8').replace(/^[\s\S]*?(MI[A-Za-z0-9+/=\s]+)$/, '$1').replace(/\s/g, '');
const priv = await C.subtle.importKey('pkcs8', Buffer.from(txt, 'base64'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
const limpio = s => s.toUpperCase().replace(/^\s*P[FA]-?/, '').replace(/[^A-Z0-9]/g, '');
async function firmar(dev, dias, cuenta) { // igual que el Unlocker
  const exp = dias === 0 ? 'P' : new Date(EPOCH + dias * DAY).toISOString().slice(0, 10);
  const sig = new Uint8Array(await C.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, enc(`PANDARIA-FIT|${cuenta ? 'v2' : 'v1'}|${dev}|${exp}`)));
  const b = new Uint8Array(66); b[0] = dias >> 8; b[1] = dias & 255; b.set(sig, 2); return 'PFU-' + toB32(b);
}
const hoyDias = () => Math.round((Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - EPOCH) / DAY);
const casos = []; const ok = (c, n, d = '') => casos.push([!!c, n, d]);
const base = `S.settings.onboarded=true; S.settings.ui='completa'; S.settings.orden181=1; S.profile={name:'Eddy',age:29,height:178,weight:80,sex:'h',fitness:'activo',injuries:[]}; save(true);`;
async function app(storage) { const a = await abrirApp({ t0: Date.now(), storage, antes: w => { Object.defineProperty(w.crypto, 'subtle', { value: C.subtle, configurable: true }); w.TextEncoder = TextEncoder; } }); a.ev(base); for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 50)); a.avanzar(150); } return a; }
const codigoPantalla = a => { a.ev('LAYERS.length=0; A.pfRegalo()'); a.avanzar(600); const m = a.ev(`(document.querySelector('.codebox')||{}).textContent||''`); return m.trim(); };
async function pegar(a, code) { a.ev(`LAYERS.length=0; A.pfRegalo()`); a.avanzar(400); a.ev(`document.querySelector('#pfcode').value=${JSON.stringify(code)}; A.pfActivate()`); for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 50)); a.avanzar(100); } return a.ev('isPremium()'); }
const guarda = a => { const o = {}; for (let i = 0; i < a.w.localStorage.length; i++) { const k = a.w.localStorage.key(i); o[k] = a.w.localStorage.getItem(k); } return o; };

// 1) teléfono: permanente
let a = await app(); const pf = codigoPantalla(a); const dev = limpio(pf);
ok(/^PF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(pf), 'La app muestra el código del teléfono (PF-…)', pf);
const perm = await firmar(dev, 0);
ok(!(await pegar(a, perm.slice(0, -1) + (perm.at(-1) === 'A' ? 'B' : 'A'))), 'Un código con un carácter cambiado se rechaza');
ok(!(await pegar(a, await firmar('ABCDEFGHJKLMNP', 0))), 'Un código hecho para otro teléfono se rechaza');
ok(await pegar(a, '  ' + perm.toLowerCase().replace('pfu-', 'pfu ') + '  '), 'Código permanente: activa Premium (aunque se pegue en minúsculas o con espacios)', a.ev('JSON.stringify(premiumInfo())'));
// 2) sigue activo al volver a abrir la app
const st = guarda(a); a = await app(st); a.avanzar(1500); for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 50)); a.avanzar(100); }
ok(a.ev('isPremium()'), 'Al cerrar y abrir la app, Premium sigue activo');
// 3) con fecha: 30 días y caducado
a = await app(); const dev2 = limpio(codigoPantalla(a));
ok(await pegar(a, await firmar(dev2, hoyDias() + 30)), 'Código de 30 días: activa Premium', a.ev('JSON.stringify(premiumInfo())'));
a = await app(); const dev3 = limpio(codigoPantalla(a));
ok(!(await pegar(a, await firmar(dev3, hoyDias() - 1))) && /caduc/.test(a.ev(`(document.querySelector('.toast')||{}).textContent||''`) + ''), 'Código vencido: no activa y avisa de que caducó');
// 4) cuenta de Google (PA-)
a = await app(); a.ev(`S.settings.cloud={sub:'1234567890',email:'x'}; save(true); pfAccountChanged()`); for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 50)); a.avanzar(100); }
const pa = codigoPantalla(a);
ok(/^PA-/.test(pa), 'Con sesión de Google la app muestra el código de cuenta (PA-…)', pa);
ok(await pegar(a, await firmar(limpio(pa), 0, true)), 'Código de cuenta: activa Premium');
a.ev(`S.settings.cloud={sub:'999',email:'y'}; save(true); pfAccountChanged()`); for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 50)); a.avanzar(100); }
ok(!a.ev('isPremium()'), 'Con otra cuenta de Google ese código ya no vale');
let mal = 0; for (const [c, n, d] of casos) { if (!c) mal++; console.log((c ? '✓ ' : '✗ ') + n + (c ? '' : '  ' + d)); }
process.exit(mal ? 1 : 0);
