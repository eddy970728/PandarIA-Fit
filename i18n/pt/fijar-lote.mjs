// node fijar-lote.mjs archivo.tsv  (español<TAB>portugués por línea) → cambia todas las apariciones en pt-NN.txt
import fs from 'fs';
const L=fs.readFileSync(process.argv[2],'utf8').split('\n').filter(l=>l.includes('\t')).map(l=>l.split('\t'));
const M=new Map(L); const usados=new Set();
for (const f of fs.readdirSync('.').filter(x=>/^src-\d+\.txt$/.test(x))){ const s=fs.readFileSync(f,'utf8').split('\n'), pf='pt-'+f.slice(4), p=fs.readFileSync(pf,'utf8').split('\n'); let c=false;
  s.forEach((x,i)=>{ if(M.has(x)){ if(p[i]!==M.get(x)){ p[i]=M.get(x); c=true; } usados.add(x); } }); if(c) fs.writeFileSync(pf,p.join('\n')); }
const no=L.filter(([a])=>!usados.has(a)); console.log('cambiados', usados.size, no.length?'· NO ENCONTRADOS: '+no.map(x=>x[0]).join(' | '):'');
