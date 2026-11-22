// 1.9.3 · Cada permiso de la app tiene que estar en la pantalla de Permisos (PERMISOS_APP) o, si no pide nada al usuario,
// en PERMISOS_SIN_PANTALLA (las dos listas están en www/index.html). Si aparece uno nuevo sin clasificar, la compilación se detiene
// para que nadie olvide explicarlo en la pantalla de Permisos.
// Uso: node scripts/control-permisos.mjs permisos.txt   (permisos.txt = salida de aapt2 dump permissions, uno por línea)
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
const app = [...html.matchAll(/android:\[([^\]]*)\]/g)].flatMap(m => m[1].split(',').map(x => x.trim().replace(/['"]/g, '')).filter(Boolean));
const sin = (html.match(/const PERMISOS_SIN_PANTALLA=\[([^\]]*)\]/) || [, ''])[1].split(',').map(x => x.trim().replace(/['"]/g, '')).filter(Boolean);
if (!app.length || !sin.length) { console.error('ERROR: no encontré PERMISOS_APP o PERMISOS_SIN_PANTALLA en www/index.html'); process.exit(1); }
const lista = fs.readFileSync(process.argv[2] || 'permisos.txt', 'utf8').split('\n').map(x => x.trim()).filter(Boolean);
const nombre = p => p.replace(/^.*?\.permission\./, '');
const cubre = n => app.some(a => a.endsWith('.*') ? n.startsWith(a.slice(0, -1)) : a === n) || sin.includes(n);
const faltan = lista.map(nombre).filter(n => !cubre(n));
console.log('Permisos en pantalla:', app.join(', '));
if (faltan.length) { console.error('ERROR: permisos sin explicar en la pantalla de Permisos ni en PERMISOS_SIN_PANTALLA: ' + faltan.join(', ')); process.exit(1); }
console.log('Todos los permisos están clasificados (' + lista.length + ')');
