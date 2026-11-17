import { JSDOM } from 'jsdom'; import fs from 'node:fs';
const dom=new JSDOM(fs.readFileSync('www/index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://localhost/',beforeParse(w){ w.HTMLCanvasElement.prototype.getContext=()=>null; w.scrollTo=()=>{}; w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});}});
await new Promise(r=>setTimeout(r,1200)); const w=dom.window;
console.log(w.eval(`(()=>{ S=DEF(); S.settings.onboarded=true; window.isPremium=()=>true; const H=3600000; const wk0=weekKey(Date.now()); S.sessions=[]; let kg=60;
    for (let w=10;w>=1;w--){ const alto=w%2===0, t=wk0-w*7*86400000+2*86400000+18*H; S.sessions.push({id:'a'+w,routineId:'x',start:t-H,end:t,intensity:7,items:[{exId:'press_banca',sets:Array.from({length:alto?16:8},()=>({t:'n',kg,reps:8,done:true}))}]});
      S.sessions.push({id:'b'+w,routineId:'x',start:t+86400000-H,end:t+86400000,intensity:7,items:[]}); kg=Math.round(kg*(alto?1.03:1.0)*10)/10; }
  const K=kb('aprende.series'); const first=Math.min(...S.sessions.map(s=>s.end)); return JSON.stringify({sem:(Date.now()-first)/(7*DAY), n:S.sessions.length, ex:getEx('press_banca').prim, mode:getEx('press_banca').mode, r:aprendeSeries()}); })()`));
