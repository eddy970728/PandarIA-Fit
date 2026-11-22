// Junta todos los textos en español que la app puede mostrar, con su inglés de referencia.
import fs from 'fs';
const ROOT='/home/claude/repo-pandaria/www/';
const en=JSON.parse(fs.readFileSync('/tmp/en.json','utf8'));
const M=new Map(); // es -> {en, src}
const add=(es,e,src)=>{ if(!es) return; es=es.trim(); if(!es||M.has(es)) return; if(!/[a-záéíóúñ¿¡]/i.test(es)) return; M.set(es,{en:(e||'').trim(),src}); };
en.map.forEach(([a,b])=>add(a,b,'map'));
// literales JS
function unq(s){ const q=s[0]; let b=s.slice(1,-1); if(q==='`') return b; try{ return JSON.parse('"'+b.replace(/\\'/g,"'").replace(/"/g,'\\"')+'"'); }catch(e){ return b.replace(/\\'/g,"'"); } }
const tpl=[];
for (const f of ['index.html','premium.js','native.js']){
  const h=fs.readFileSync(ROOT+f,'utf8');
  // tx(a,b)
  let i=0;
  const lit=(p)=>{ while(/\s/.test(h[p])) p++; const q=h[p]; if(!"'\"`".includes(q)) return null; let j=p+1;
    while(j<h.length){ const c=h[j]; if(c==='\\'){j+=2;continue;} if(q==='`'&&c==='$'&&h[j+1]==='{'){ let d=1; j+=2; while(j<h.length&&d){ if(h[j]==='{')d++; else if(h[j]==='}')d--; else if(h[j]==='`'){ let k=j+1; while(k<h.length&&h[k]!=='`'){ if(h[k]==='\\')k++; k++; } j=k; } else if(h[j]==="'"||h[j]==='"'){ const qq=h[j]; let k=j+1; while(k<h.length&&h[k]!==qq){ if(h[k]==='\\')k++; k++; } j=k; } j++; } continue; }
      if(c===q) return {s:h.slice(p,j+1),end:j+1}; j++; } return null; };
  while((i=h.indexOf('tx(',i))>=0){ if(/[\w.$]/.test(h[i-1])){i+=3;continue;} const a=lit(i+3); if(!a){i+=3;continue;} let p=a.end; while(/\s/.test(h[p]))p++; if(h[p]!==','){i+=3;continue;} const b=lit(p+1); if(!b){i+=3;continue;}
    if (a.s[0]==='`' && a.s.includes('${')) tpl.push({f,at:i,es:a.s,en:b.s,endB:b.end}); else add(unq(a.s),unq(b.s),'tx:'+f);
    i=b.end; }
  // ['es','en'] y ["es","en"]
  const rx=/\[\s*'((?:[^'\\]|\\.){3,})'\s*,\s*'((?:[^'\\]|\\.){2,})'\s*\]/g; let m;
  while((m=rx.exec(h))){ const a=m[1].replace(/\\'/g,"'"), b=m[2].replace(/\\'/g,"'"); if(a!==b && (/\s|[áéíóúñ¿¡]/.test(a)) && /[a-z]/i.test(b)) add(a,b,'arr:'+f); }
  // t:'es',en:'en'  d:'es',den:'en'
  const rx2=/\b(\w+):'((?:[^'\\]|\\.)+)',\s*(?:en|den|\1en|\1_en):'((?:[^'\\]|\\.)+)'/g;
  while((m=rx2.exec(h))) add(m[2].replace(/\\'/g,"'"),m[3].replace(/\\'/g,"'"),'obj:'+f);
}
const lista=[...M.entries()].map(([es,v])=>({es,en:v.en,src:v.src}));
fs.writeFileSync('/tmp/i18n/textos.json',JSON.stringify(lista));
fs.writeFileSync('/tmp/i18n/tpl.json',JSON.stringify(tpl));
const by={}; lista.forEach(x=>{ const k=x.src.split(':')[0]; by[k]=(by[k]||0)+1; });
console.log('textos',lista.length,by,'chars',lista.reduce((a,x)=>a+x.es.length,0),'plantillas',tpl.length);
