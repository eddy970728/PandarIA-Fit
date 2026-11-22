import fs from 'fs';
const T=JSON.parse(fs.readFileSync('/tmp/i18n/tpl.json','utf8')), L=JSON.parse(fs.readFileSync('/tmp/i18n/tpl2.json','utf8')), O=JSON.parse(fs.readFileSync('/tmp/i18n/tpl-orden.json','utf8'));
const PT=['tt-01.txt','tt-02.txt','tt-03.txt'].flatMap(f=>fs.readFileSync('/tmp/i18n/'+f,'utf8').replace(/\n$/,'').split('\n'));
if (PT.length!==O.length) throw new Error('líneas '+PT.length+' vs '+O.length);
const key=x=>x.es+'¦'+x.ex.join('¦'); const uni=new Map(O.map((i,n)=>[key(L[i]),n]));
const porArchivo={};
T.forEach((t,i)=>{ const x=L[i], n=uni.get(key(x)); let pt=PT[n];
  // {k} → expresión original
  pt=pt.replace(/\{(\d+)\}/g,(m,k)=>{ if(x.ex[+k]==null) throw new Error('falta {'+k+'} en '+n+': '+pt); return x.ex[+k]; });
  // las expresiones usadas en ES que no aparecen en PT (porque las reescribí) no importan; comprobar que no queden {k}
  (porArchivo[t.f]=porArchivo[t.f]||[]).push({pos:t.endB, txt:',{pt:`'+pt+'`}'});
});
for (const f in porArchivo){ const ruta='/home/claude/repo-pandaria/www/'+f; let h=fs.readFileSync(ruta,'utf8');
  const E=porArchivo[f].sort((a,b)=>b.pos-a.pos); for(const e of E){ if(!"'\"`".includes(h[e.pos-1])) throw new Error('posición rara en '+f+' '+e.pos); h=h.slice(0,e.pos)+e.txt+h.slice(e.pos); }
  fs.writeFileSync(ruta,h); console.log(f, E.length,'plantillas con portugués'); }
