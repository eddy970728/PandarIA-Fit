// 1.4 · Ajustes del proyecto de iPhone/iPad (se ejecuta después de «npx cap add ios»):
// - textos que iOS muestra al pedir permisos (Salud, cámara para el escáner, fotos de progreso);
// - la carpeta de la app visible en la app Archivos (copias y exportaciones);
// - enlaces pandariafit:// (widgets no hay en iPhone, pero los enlaces de rutinas y regalos sí);
// - Podfile en iOS 15.5 (lo pide ML Kit, el escáner de códigos de barras);
// - entitlements con HealthKit (se firman dentro de la app; AltStore los conserva al volver a firmarla).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const fallo = m => { console.error('ERROR (proyecto iOS): ' + m); process.exit(1); };
const PL = 'ios/App/App/Info.plist', POD = 'ios/App/Podfile';
if (!existsSync(PL)) fallo('no existe ' + PL + ' (¿falta «npx cap add ios»?)');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const claves = {
  NSHealthShareUsageDescription: 'PandarIA Fit lee tus pasos, peso, pulso, sueño y variabilidad del pulso para ajustar tu recuperación y tus objetivos. Los datos se quedan en tu iPhone.',
  NSHealthUpdateUsageDescription: 'PandarIA Fit guarda en Salud tu peso, las calorías de tus entrenos, tus comidas y el agua que bebes, solo si lo activas.',
  NSCameraUsageDescription: 'La cámara se usa para escanear el código de barras de los alimentos y para las fotos de progreso. Nada sale de tu iPhone.',
  NSPhotoLibraryUsageDescription: 'Para elegir fotos de progreso de tu galería. Se guardan solo dentro de la app.',
  NSPhotoLibraryAddUsageDescription: 'Para guardar en tu galería las tarjetas de tus entrenos si lo pides.'
};
let pl = readFileSync(PL, 'utf8');
const fin = pl.lastIndexOf('</dict>'); if (fin < 0) fallo('Info.plist sin </dict>');
let extra = '';
for (const [k, v] of Object.entries(claves)) if (!pl.includes(`<key>${k}</key>`)) extra += `\t<key>${k}</key>\n\t<string>${esc(v)}</string>\n`;
for (const k of ['UIFileSharingEnabled', 'LSSupportsOpeningDocumentsInPlace']) if (!pl.includes(`<key>${k}</key>`)) extra += `\t<key>${k}</key>\n\t<true/>\n`;
if (!pl.includes('<key>ITSAppUsesNonExemptEncryption</key>')) extra += '\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n';
if (!pl.includes('pandariafit')) extra += '\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>com.pandaria.fit</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>pandariafit</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n';
// 1.10 · Copia en Google Drive: con el ID de cliente de iOS en native.js, se añade el esquema que Google usa para volver a la app
{ const m = readFileSync('www/native.js', 'utf8').match(/GOOGLE_IOS_ID = '([^']*)'/); const id = m ? m[1] : '';
  if (id) { if (!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id)) fallo('GOOGLE_IOS_ID no tiene forma de ID de cliente de iOS');
    const inv = 'com.googleusercontent.apps.' + id.replace('.apps.googleusercontent.com', '');
    if (!pl.includes(inv)) extra += `\t<key>GIDClientID</key>\n\t<string>${id}</string>\n`;
    extra = extra.replace('<string>pandariafit</string>', `<string>pandariafit</string>\n\t\t\t\t<string>${inv}</string>`);
    if (!extra.includes(inv) && !pl.includes(inv)) fallo('no se pudo añadir el esquema de Google'); } }
pl = pl.slice(0, fin) + extra + pl.slice(fin);
writeFileSync(PL, pl);

if (existsSync(POD)){
  let pod = readFileSync(POD, 'utf8');
  if (!/platform :ios, '[0-9.]+'/.test(pod)) fallo('Podfile sin «platform :ios»');
  pod = pod.replace(/platform :ios, '[0-9.]+'/, "platform :ios, '15.5'");
  // todos los pods con el mismo mínimo (evita avisos y errores de Xcode con pods antiguos)
  // la plantilla de Capacitor ya ajusta el mínimo de cada pod en su post_install (assertDeploymentTarget); si no lo tiene, se añade
  if (!pod.includes('post_install')) pod += `
post_install do |installer|
  installer.pods_project.targets.each do |t|
    t.build_configurations.each { |c| c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.5' }
  end
end
`;
  writeFileSync(POD, pod);
} else fallo('no existe ' + POD + ' (el proyecto debe crearse con CocoaPods)');

// El proyecto de Xcode también a iOS 15.5
const PBX = 'ios/App/App.xcodeproj/project.pbxproj';
let pbx = readFileSync(PBX, 'utf8');
pbx = pbx.replace(/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 15.5;');
writeFileSync(PBX, pbx);

writeFileSync('ios-entitlements.plist', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.healthkit</key>
	<true/>
	<key>com.apple.developer.healthkit.access</key>
	<array/>
</dict>
</plist>
`);
// 1.9.7 · Firma para App Store / TestFlight: entitlements dentro del proyecto y equipo de Apple en el target App
// (solo en el target App: los Pods no los necesitan y pasarlos por línea de comandos rompe sus rutas)
writeFileSync('ios/App/App/App.entitlements', readFileSync('ios-entitlements.plist', 'utf8'));
let pbx2 = readFileSync(PBX, 'utf8');
if (!pbx2.includes('CODE_SIGN_ENTITLEMENTS')) {
  const n0 = (pbx2.match(/INFOPLIST_FILE = App\/Info.plist;/g) || []).length;
  if (!n0) fallo('no se encontró INFOPLIST_FILE del target App');
  pbx2 = pbx2.replace(/INFOPLIST_FILE = App\/Info.plist;/g, 'INFOPLIST_FILE = App/Info.plist;\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tDEVELOPMENT_TEAM = B7QA53SPD9;\n\t\t\t\tCODE_SIGN_STYLE = Automatic;');
  writeFileSync(PBX, pbx2);
}
console.log('Proyecto iOS listo: permisos, Archivos, enlaces, iOS 15.5 y HealthKit');
