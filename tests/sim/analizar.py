import json,statistics as st, collections as C, sys
d=json.load(open(sys.argv[1]))
for x in d:
  S=x['L']['series']; n=len(S); rir=[s['rir'] for s in S]
  print('==',x['P'],'CON' if x['conPandaria'] else 'SIN', 'series',n, 'fuerza +%.1f%%'%st.mean(v['pct'] for v in x['fuerza'].values()))
  print(' efectivas(RIR<=3) %.0f%%  fáciles(RIR>=5) %.0f%%  no llega %.0f%%  bajó el peso %.0f%%  %%1RM %.0f'%(100*sum(r<=3 for r in rir)/n,100*sum(r>=5 for r in rir)/n,100*sum(s['reps']<s['obj'] for s in S)/n,100*sum(s['bajo']>0 for s in S)/n, st.mean(s['pct'] for s in S)))
  for w0 in range(0,13,3):
    B=[s for s in S if w0*7<=s['d']<(w0+3)*7]
    if B: print('  sem %2d-%2d: rir %.1f  fáciles %.0f%%  bajó %.0f%%  %%1RM %.0f'%(w0+1,w0+3,st.mean(s['rir'] for s in B),100*sum(s['rir']>=5 for s in B)/len(B),100*sum(s['bajo']>0 for s in B)/len(B),st.mean(s['pct'] for s in B)))
  if x['conPandaria']:
    c=C.Counter((s['why'].split(':')[0][:40].split(' · ')[0], s['rir']>=5) for s in S)
    print('   ', [(k,v) for k,v in sorted(c.items(),key=lambda t:-t[1])[:12]])
