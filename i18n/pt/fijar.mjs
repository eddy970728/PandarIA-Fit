// node fijar.mjs "español" "portugués"  → cambia la traducción de un texto en pt-NN.txt
import fs from 'fs';
const [es,pt]=process.argv.slice(2); let n=0;
for (const f of fs.readdirSync('.').filter(x=>/^src-\d+\.txt$/.test(x))){ const s=fs.readFileSync(f,'utf8').split('\n'), pf='pt-'+f.slice(4), p=fs.readFileSync(pf,'utf8').split('\n');
  s.forEach((x,i)=>{ if(x===es){ p[i]=pt; n++; } }); fs.writeFileSync(pf,p.join('\n')); }
console.log(n?'ok':'NO ENCONTRADO', es);
