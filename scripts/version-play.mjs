// Prepara www/index.html para la versión de Google Play (el .aab):
// - apaga el aviso de versiones (AVISOS_DEV=false);
// - borra entero el código que busca versiones en GitHub y descarga el APK (Google Play no permite actualizar por fuera);
// - borra el texto de «instalar apps desconocidas».
// Si algo no está como se espera, termina con error y no se crea el .aab.
import { readFileSync, writeFileSync } from 'node:fs';
const p = process.argv[2] || 'www/index.html';
let h = readFileSync(p, 'utf8');
const fallo = m => { console.error('ERROR (versión de Play): ' + m); process.exit(1); };
if (!h.includes('const AVISOS_DEV=true;')) fallo('no se encontró AVISOS_DEV');
h = h.replace('const AVISOS_DEV=true;', 'const AVISOS_DEV=false;');
const A = '/*@GITHUB-INICIO*/', B = '/*@GITHUB-FIN*/';
const a = h.indexOf(A), b = h.indexOf(B);
if (a < 0 || b < a || h.indexOf(A, a + 1) >= 0 || h.indexOf(B, b + 1) >= 0) fallo('marcas del bloque de GitHub');
h = h.slice(0, a) + "const updOn=()=>false; function updPending(){ return null; } function updCard(){ return ''; } function updCardNew(){ return ''; } function updInit(){}" + h.slice(b + B.length);
h = h.split('\n').filter(l => !l.startsWith('Se descarga el archivo PandarIA-Fit.apk')).join('\n');
for (const x of ['api.github.com', 'browser_download_url', 'PandarIA-Fit.apk', 'apps desconocidas', 'updDownload'])
  if (h.includes(x)) fallo('queda «' + x + '»');
writeFileSync(p, h);
console.log('Versión de Play lista: sin aviso ni descarga de GitHub');
