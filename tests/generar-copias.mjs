// Genera tests/copias/copia-<versión>.json: la copia de seguridad que exportaba cada versión publicada.
// Cada versión antigua (desde su etiqueta de git) abre la copia de la 0.7, la migra a su formato,
// registra un poco de actividad propia de esa versión y la exporta como lo hacía su botón «Exportar».
//   node tests/generar-copias.mjs   (solo hace falta al publicar una versión nueva)
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.env.TZ = 'UTC';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const COPIA07 = fs.readFileSync(path.join(DIR, 'copia-0.7.json'), 'utf8');
const NOW = Date.UTC(2026, 10, 12, 12, 0, 0);
// la última etiqueta de cada versión
const tags = execSync('git tag', { cwd: DIR }).toString().trim().split('\n').filter(t => /^v\d+\.\d+\.\d+$/.test(t));
const porVer = {}; tags.forEach(t => { const m = t.match(/^v(\d+\.\d+)\.(\d+)$/); if (!porVer[m[1]] || +m[2] > porVer[m[1]].n) porVer[m[1]] = { t, n: +m[2] }; });
// las versiones anteriores a la 0.7 no saben leer su formato: se empieza por la 0.7
for (const v of Object.keys(porVer)) { const [a, b] = v.split('.').map(Number); if (a === 0 && b < 7) delete porVer[v]; }
fs.mkdirSync(path.join(DIR, 'copias'), { recursive: true });
for (const [ver, { t }] of Object.entries(porVer)) {
  const html = execSync(`git show ${t}:www/index.html`, { cwd: DIR, maxBuffer: 64 << 20 }).toString();
  const vc = new VirtualConsole(); const err = []; vc.on('jsdomError', e => err.push(String(e.message || e).slice(0, 200)));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/', virtualConsole: vc,
    beforeParse(w) { const RD = w.Date; class FD extends RD { constructor(...a) { if (a.length === 0) super(NOW); else super(...a); } static now() { return NOW; } } w.Date = FD;
      w.HTMLCanvasElement.prototype.getContext = () => null; w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {};
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      w.localStorage.setItem('pandaria-fit-v1', COPIA07); } });
  await new Promise(r => setTimeout(r, 1500));
  const w = dom.window;
  // actividad propia de esa versión: agua, una medida y un ayuno terminado (cada versión con sus propias funciones)
  w.eval(`try{ if (typeof A.water==='function') A.water(500); }catch(e){}
    try{ S.measures.push({id:'m-${ver}',date:${NOW}-86400000,peso:79.4}); }catch(e){}
    try{ const f=nut().fast; f.screened=true; f.history.push({start:${NOW}-20*3600000,end:${NOW}-4*3600000,goalH:16,ok:true}); }catch(e){}
    try{ save(true); }catch(e){ try{ save(); }catch(e2){} }`);
  const txt = w.eval(`typeof datosJSON==='function'?datosJSON():JSON.stringify(S)`);
  fs.writeFileSync(path.join(DIR, 'copias', `copia-${ver}.json`), txt + '\n');
  console.log(`${ver} (${t}): ${Math.round(txt.length / 1024)} KB${err.length ? ' · avisos: ' + err.slice(0, 2).join(' | ') : ''}`);
  w.close();
}
