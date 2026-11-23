// node fijar-linea.mjs cambios.txt   líneas: «NN:LÍNEA<TAB>texto nuevo» (NN = número de pt-NN.txt)
import fs from 'fs';
const C=fs.readFileSync(process.argv[2],'utf8').split('\n').filter(l=>/^\d+:\d+\t/.test(l));
const por={}; for (const l of C){ const [k,t]=[l.slice(0,l.indexOf('\t')),l.slice(l.indexOf('\t')+1)]; const [f,n]=k.split(':'); (por[f]=por[f]||[]).push([+n,t]); }
let n=0; for (const f in por){ const pf='pt-'+f.padStart(2,'0')+'.txt'; const p=fs.readFileSync(pf,'utf8').split('\n'); for (const [i,t] of por[f]){ if(p[i-1]==null) throw new Error('no existe '+pf+':'+i); p[i-1]=t; n++; } fs.writeFileSync(pf,p.join('\n')); }
console.log('cambiadas',n);
