// 1.4 · Prepara www/ para la versión de iPhone y iPad (se ejecuta DESPUÉS de version-play.mjs, que ya quitó
// el aviso de versiones y la descarga del APK de GitHub, que en iPhone no sirven).
// - Health Connect pasa a ser Apple Health (el mismo plugin usa HealthKit en iPhone);
// - Samsung Health pasa a ser el iPhone o el Apple Watch;
// - «Documentos» pasa a ser la app Archivos;
// - en Premium, Google Play pasa a ser App Store.
// Los cambios se aplican igual al texto en español y a su clave del diccionario inglés, así la traducción sigue funcionando.
// Si algo no está como se espera, termina con error y no se crea la app de iPhone.
import { readFileSync, writeFileSync } from 'node:fs';
const fallo = m => { console.error('ERROR (versión de iPhone): ' + m); process.exit(1); };
const leer = p => readFileSync(p, 'utf8');
const cambiar = (h, a, b, nombre) => { if (!h.includes(a)) fallo('no se encontró ' + nombre); return h.split(a).join(b); };

let idx = leer('www/index.html'), nat = leer('www/native.js'), pre = leer('www/premium.js');
if (idx.includes('/*@GITHUB-INICIO*/') || idx.includes('api.github.com')) fallo('primero hay que ejecutar version-play.mjs');

// Textos concretos (antes del cambio general de nombre)
nat = cambiar(nat, "confirmBox({title:'Falta Health Connect', text:'Instala <b>Health Connect</b> de Google desde Play Store (en Android 14 o superior ya viene incluido) y vuelve a intentarlo.'",
  "confirmBox({title:'Apple Health no está disponible', text:'Este dispositivo no tiene la app Salud de Apple (algunos iPad no la tienen).'", 'aviso de Health Connect');
nat = cambiar(nat, 'A.hcSettings = () => { try{ HC.openHealthConnectSettings(); }catch(e){} };',
  "A.hcSettings = () => confirmBox({title:'Permisos de Apple Health', text:'Abre la app <b>Salud</b> › tu foto (arriba a la derecha) › <b>Apps</b> › <b>PandarIA Fit</b> y elige qué datos compartes.', okText:'Entendido', ok:() => {}});", 'permisos de Health Connect');
for (const [a, b] of [
  ['de Samsung Health u otras apps', 'del iPhone, del Apple Watch u otras apps'],
  ['Samsung Health or other apps', 'your iPhone, Apple Watch or other apps'],
  ['Pasos, peso y pulso de Samsung Health', 'Pasos, peso y pulso del iPhone o del Apple Watch'],
  ['Steps, weight and heart rate from Samsung Health', 'Steps, weight and heart rate from your iPhone or Apple Watch'],
  // 1.9.5: portugués (PT_DATA)
  ['do Samsung Health ou de outros apps', 'do iPhone, do Apple Watch ou de outros apps'],
  ['Passos, peso e frequência cardíaca do Samsung Health', 'Passos, peso e frequência cardíaca do iPhone ou do Apple Watch']
]){ const n = (idx.includes(a) ? 1 : 0) + (nat.includes(a) ? 1 : 0); if (!n) fallo('no se encontró «' + a + '»'); idx = idx.split(a).join(b); nat = nat.split(a).join(b); }
// 1.10: en iPhone, Google solo guarda la copia en Drive (no es una cuenta de la app): así no se confunde con un inicio de sesión
// y no hace falta «Iniciar sesión con Apple» (norma 4.8 de la App Store).
idx = cambiar(idx, "tx('Continuar con Google','Continue with Google')", "tx('Copia en Google Drive','Backup to Google Drive',{pt:'Backup no Google Drive'})", 'botón de Google');
// 1.10: en la bienvenida (index.html) la suscripción se cancela en los ajustes del iPhone, no en Google Play
for (const [x, y] of [['Cancela cuando quieras en Google Play', 'Cancela cuando quieras en Ajustes › tu Apple ID › Suscripciones'],
  ['Cancel anytime in Google Play', 'Cancel anytime in Settings › your Apple ID › Subscriptions'],
  ['Cancele quando quiser no Google Play', 'Cancele quando quiser em Ajustes › seu Apple ID › Assinaturas']]) idx = cambiar(idx, x, y, '«' + x + '»');
nat = cambiar(nat, 'Se guarda en Documentos › PandarIA Fit.', 'Se guarda en Archivos › En mi iPhone › PandarIA Fit.', 'texto de Documentos');

// Nombre general
idx = cambiar(idx, 'Health Connect', 'Apple Health', 'Health Connect (index.html)');
nat = cambiar(nat, 'Health Connect', 'Apple Health', 'Health Connect (native.js)');
pre = cambiar(pre, 'Google Play', 'App Store', 'Google Play (premium.js)');

for (const [n, h] of [['index.html', idx], ['native.js', nat]]) for (const x of ['Health Connect', 'Samsung Health', 'Play Store'])
  if (h.includes(x)) fallo(`queda «${x}» en ${n}`);
writeFileSync('www/index.html', idx); writeFileSync('www/native.js', nat); writeFileSync('www/premium.js', pre);
console.log('Versión de iPhone lista: Apple Health, Archivos y App Store');
