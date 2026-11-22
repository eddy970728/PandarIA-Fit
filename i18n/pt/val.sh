#!/bin/bash
# valida que pt-NN tiene las mismas líneas que src-NN y conserva números y símbolos clave
for f in pt-*.txt; do n=${f#pt-}; s=src-$n; a=$(wc -l < $s); b=$(wc -l < $f); [ "$a" = "$b" ] || echo "$f: $b líneas, esperaba $a"; done
node -e "
const fs=require('fs');for(const f of fs.readdirSync('.').filter(x=>/^pt-\d+\.txt$/.test(x))){const s=fs.readFileSync('src-'+f.slice(3),'utf8').split('\n'),p=fs.readFileSync(f,'utf8').split('\n');
s.forEach((x,i)=>{const nx=(x.match(/\d+/g)||[]).sort().join(','),np=((p[i]||'').match(/\d+/g)||[]).sort().join(',');if(nx!==np)console.log(f,i+1,'NUM',JSON.stringify(x).slice(0,80),'|',JSON.stringify(p[i]).slice(0,80));
 for(const t of ['\$','%','·','›','{','}','|']){ if((x.split(t).length)!==((p[i]||'').split(t).length)) console.log(f,i+1,'SIM '+t,JSON.stringify(x).slice(0,70),'|',JSON.stringify(p[i]).slice(0,70)); } }) }"
