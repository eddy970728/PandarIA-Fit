// Ajustes extra del proyecto Android que se generan en cada compilación.
// Crea el icono blanco de las notificaciones (panda) en todas las densidades.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="160 150 704 704">
<defs><mask id="m"><rect x="0" y="0" width="1024" height="1024" fill="#fff"/>
<path d="M300 452 L486 528 L476 612 L374 632 L300 560 Z" fill="#000" stroke="#000" stroke-width="24" stroke-linejoin="round"/>
<path d="M724 452 L538 528 L548 612 L650 632 L724 560 Z" fill="#000" stroke="#000" stroke-width="24" stroke-linejoin="round"/>
<path d="M462 664 L562 664 L530 706 L494 706 Z" fill="#000" stroke="#000" stroke-width="16" stroke-linejoin="round"/></mask></defs>
<g mask="url(#m)" fill="#fff"><circle cx="318" cy="300" r="100"/><circle cx="706" cy="300" r="100"/>
<path d="M512 262 L704 312 L782 448 L762 626 L644 762 L512 796 L380 762 L262 626 L242 448 L320 312 Z" stroke="#fff" stroke-width="30" stroke-linejoin="round"/></g></svg>`;

const sizes = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };
for (const [d, px] of Object.entries(sizes)) {
  const dir = `android/app/src/main/res/drawable-${d}`;
  mkdirSync(dir, { recursive: true });
  await sharp(Buffer.from(svg), { density: 300 }).resize(px, px).png().toFile(`${dir}/ic_stat_pandaria.png`);
}
console.log('Icono de notificaciones creado');
