// Abre PandarIA Fit en un navegador simulado con reloj y temporizadores propios,
// para poder vivir días y meses de uso en segundos.
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const idl = createRequire(import.meta.url)('jsdom/lib/jsdom/living/generated/utils.js');

// como en la versión web: la app y después premium.js (candados, pagos y licencias)
const HTML = fs.readFileSync(new URL('../../www/index.html', import.meta.url), 'utf8').replace(/<\/body>(?![\s\S]*<\/body>)/, () => `<script>${fs.readFileSync(new URL('../../www/premium.js', import.meta.url), 'utf8')}</script></body>`);

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export async function abrirApp({ t0, storage = {}, seed = 1 } = {}) {
  const errores = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errores.push('jsdom: ' + String(e.message || e).slice(0, 300)));
  let cola = [], sig = 1;
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: false, url: 'https://localhost/', virtualConsole: vc,
    beforeParse(w) {
      w.PF_REGION = 'ES'; // 1.9.2: unidades métricas en las pruebas, aunque el navegador simulado sea de EE. UU.
      w.__T = t0;
      const RD = w.Date;
      class FD extends RD { constructor(...a) { if (a.length === 0) super(w.__T); else super(...a); } static now() { return w.__T; } }
      w.Date = FD;
      // temporizadores con el reloj simulado
      w.setTimeout = (fn, ms, ...a) => { const id = sig++; cola.push({ id, t: w.__T + Math.max(0, +ms || 0), fn, a }); return id; };
      w.setInterval = (fn, ms, ...a) => { const id = sig++; cola.push({ id, t: w.__T + Math.max(1, +ms || 1), fn, a, p: Math.max(1, +ms || 1) }); return id; };
      w.clearTimeout = w.clearInterval = id => { cola = cola.filter(x => x.id !== id); };
      w.requestAnimationFrame = fn => w.setTimeout(() => fn(w.__T), 16);
      w.cancelAnimationFrame = id => w.clearTimeout(id);
      const r = rng(seed); w.Math.random = r;
      // un lienzo 2D de mentira: acepta cualquier dibujo (los navegadores reales lo tienen siempre)
      const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : /^create/.test(String(k)) ? () => ({ addColorStop() {} }) : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
      w.HTMLCanvasElement.prototype.getContext = function () { ctx.canvas = this; return ctx; };
      w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
      w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {}; w.Element.prototype.scrollTo = function () {};
      w.addEventListener('error', e => errores.push('error: ' + (e.message || e.error)));
      w.addEventListener('unhandledrejection', e => errores.push('promesa: ' + String(e.reason && (e.reason.stack || e.reason)).slice(0, 300)));
      for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
    }
  });
  const w = dom.window;
  // avanza el reloj ejecutando lo que toque (los intervalos largos no se repiten miles de veces)
  const avanzar = ms => {
    const fin = w.__T + ms;
    for (let n = 0; n < 5000; n++) {
      cola.sort((a, b) => a.t - b.t);
      const x = cola[0]; if (!x || x.t > fin) break;
      if (x.p) { x.t = (fin - x.t > 20 * x.p) ? fin : x.t + x.p; } else cola.shift();
      w.__T = Math.max(w.__T, Math.min(x.t, fin));
      try { x.fn(...(x.a || [])); } catch (e) { errores.push('temporizador: ' + String(e && (e.stack || e)).slice(0, 400)); }
    }
    w.__T = fin;
  };
  await new Promise(r => setTimeout(r, 30));
  avanzar(2000);
  const ev = code => w.eval(code);
  // ejecuta una acción como un toque en pantalla: si el botón está visible lo pulsa; si no, llama a la acción
  const tocar = (a, v) => {
    const sel = v == null ? `[data-a="${a}"]` : `[data-a="${a}"][data-v="${String(v).replace(/"/g, '\\"')}"]`;
    const el = w.document.querySelector(sel);
    try { if (el) el.click(); else w.eval(`A[${JSON.stringify(a)}](${v == null ? '' : JSON.stringify(v)})`); } catch (e) { errores.push(`acción ${a}(${v}): ` + String(e && (e.stack || e)).slice(0, 400)); }
    avanzar(400);
    return !!el;
  };
  const texto = () => ['#view', '#layers', '#modals', '#nav'].map(s => { const e = w.document.querySelector(s); return e ? e.textContent : ''; }).join(' \n ');
  return { w, ev, avanzar, tocar, texto, errores, pendientes: () => cola.length,
    // jsdom (nwsapi) guarda los resultados de hasta 1000 selectores con su árbol aunque ya no esté en pantalla (los navegadores no): se vacía de vez en cuando
    purgar: () => { const d = idl.implForWrapper(w.document); for (const n of [d._nwsapi, d._nwsapiDontThrow]) if (n) { n.selectResolvers && n.selectResolvers.clear(); n.matchResolvers && n.matchResolvers.clear(); } }, cerrar: () => w.close() };
}

// texto que nunca debería verse en pantalla
export const RAROS = /\bNaN\b|\bundefined\b|\bInfinity\b|\[object|\bnull\b(?! *(?:kg|%))|-Infinity|\{\{|\$\{/;
