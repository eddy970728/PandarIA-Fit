// Prepara la versión web de prueba (para probar el diseño y los entrenos en un iPad o iPhone desde Safari).
//   node scripts/version-web.mjs            → escribe docs/web/ (se publica en GitHub Pages)
//   node scripts/version-web.mjs carpeta    → la escribe en otra carpeta (las pruebas la comparan con docs/web)
// Parte de la versión de Google Play (sin avisos ni descargas de GitHub) y añade premium.js, así Premium queda bloqueado:
// en la web no hay compras, Health Connect ni copia en Drive.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(RAIZ, 'docs', 'web');
const fallo = m => { console.error('ERROR (versión web): ' + m); process.exit(1); };
mkdirSync(OUT, { recursive: true });

// 1) misma limpieza que la versión de Play
const tmp = mkdtempSync(join(tmpdir(), 'pf-web-')), f = join(tmp, 'index.html');
copyFileSync(join(RAIZ, 'www', 'index.html'), f);
execFileSync(process.execPath, [join(RAIZ, 'scripts', 'version-play.mjs'), f], { stdio: 'pipe' });
let h = readFileSync(f, 'utf8'); rmSync(tmp, { recursive: true, force: true });

// 2) icono y nombre en la pantalla de inicio del iPad/iPhone, y premium.js (deja Premium bloqueado en la web)
if (!h.includes('<title>PandarIA Fit</title>') || !h.includes('</body>')) fallo('no se encontró <title> o </body>');
h = h.replace('<title>PandarIA Fit</title>', '<title>PandarIA Fit</title>\n<link rel="apple-touch-icon" href="icono-180.png">\n<meta name="apple-mobile-web-app-title" content="PandarIA Fit">');
const aviso = `<script>window.PF_WEB=true; setTimeout(function(){ try{ if (!localStorage.getItem('pf-web-aviso')){ toast(tx('Versión web de prueba: sin Health Connect, compras ni copia en Drive','Web test version: no Health Connect, purchases or Drive backup')); localStorage.setItem('pf-web-aviso','1'); } }catch(e){} }, 1500);</script>`;
h = h.replace('</body>', `<script src="premium.js"></script>${aviso}</body>`);
writeFileSync(join(OUT, 'index.html'), h);
copyFileSync(join(RAIZ, 'www', 'premium.js'), join(OUT, 'premium.js'));
console.log('Versión web lista en ' + OUT);
