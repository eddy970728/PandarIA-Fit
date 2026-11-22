// 1.9.5 · Mete en www/index.html las traducciones al portugués (src-NN ↔ pt-NN) y las reglas PT_RX.
// Uso: node i18n/pt/construir.mjs   (se puede repetir: reemplaza el bloque entre marcas)
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
const D=path.dirname(fileURLToPath(import.meta.url)), ROOT=path.join(D,'../../www/index.html');
const lee=pre=>fs.readdirSync(D).filter(f=>new RegExp('^'+pre+'-\\d+\\.txt$').test(f)).sort().flatMap(f=>fs.readFileSync(path.join(D,f),'utf8').replace(/\n$/,'').split('\n'));
const es=lee('src'), pt=lee('pt'); if (es.length!==pt.length) throw new Error('src '+es.length+' ≠ pt '+pt.length);
const pares=[]; const vistos=new Set();
es.forEach((e,i)=>{ const p=(pt[i]||'').trim(); if(!p||vistos.has(e)) return; vistos.add(e); pares.push([e.replace(/\\n/g,'\n'),p.replace(/\\n/g,'\n')]); });
const extra=fs.existsSync(path.join(D,'extra.txt'))?fs.readFileSync(path.join(D,'extra.txt'),'utf8').split('\n').filter(l=>l.includes('|')&&!l.startsWith('#')).map(l=>{ const i=l.indexOf('|'); return [l.slice(0,i).trim(),l.slice(i+1).trim()]; }):[];
extra.forEach(x=>{ if(!vistos.has(x[0])){ vistos.add(x[0]); pares.push(x); } });
const datos=JSON.stringify(pares).replace(/<\//g,'<\\/');
const rx=fs.readFileSync(path.join(D,'pt-rx.js'),'utf8').trim();
const bloque=`/*PT_INI · generado por i18n/pt/construir.mjs: no editar a mano */
const PT_DATA=${datos};
${rx}
/*PT_FIN*/`;
let h=fs.readFileSync(ROOT,'utf8');
const a=h.indexOf('/*PT_INI'), b=h.indexOf('/*PT_FIN*/');
if (a>=0&&b>a) h=h.slice(0,a)+bloque+h.slice(b+10);
else { const m='function trText(t){'; const k=h.indexOf(m); if(k<0) throw new Error('sin trText'); h=h.slice(0,k)+bloque+'\n'+h.slice(k); }
fs.writeFileSync(ROOT,h); console.log('PT:',pares.length,'textos ·',(datos.length/1024|0),'KB');
