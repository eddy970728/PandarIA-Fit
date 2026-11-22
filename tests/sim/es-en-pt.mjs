// 1.9.5 · Busca texto en español que quede en textos-pt.json (lo que se ve con la app en portugués)
import fs from 'node:fs';
const T = JSON.parse(fs.readFileSync(new URL('./textos-pt.json', import.meta.url), 'utf8'));
const OK = /Jäger|Rosé|Pérez|choripán|Choripán|chivito|Jesús|doi\.org|https?:|www\.|PandarIA|Health Connect|Español|English|Português|TACO|NEPA|UNICAMP|USDA|EFSA|ISSN|ACSM|OMS|AASM|SRS/g;
const ES = /[ñ¿¡]|ción\b|ciones\b|(^|[^\wÀ-ÿ])(el|los|las|del|y|con|una|unos|unas|hoy|más|también|puedes|tienes|aquí|cuando|muy|pero|entreno|entrenos|rutina|rutinas|ejercicio|ejercicios|serie|series|día|días|toca|sin|hay|tu|tus|mañana|ayuno|comida|cena|desayuno|almuerzo|agua|nuevo|nueva|añadir|guardar|borrar|elige|elegir|ver)([^\wÀ-ÿ]|$)/i;
const malos = Object.entries(T).filter(([t]) => ES.test(t.replace(OK, '')));
console.log(malos.length, 'textos con español de', Object.keys(T).length);
const out = malos.map(([t, w]) => t + '   ⟦' + w[0] + '⟧');
fs.writeFileSync('/tmp/pt-malos.txt', out.join('\n'));
console.log(out.slice(0, +process.argv[2] || 60).join('\n'));
