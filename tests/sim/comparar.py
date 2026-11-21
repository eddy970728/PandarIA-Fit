# Compara un perfil Premium con su gemelo sin guía: python3 tests/sim/comparar.py P08 P19
import json, sys, statistics as st, collections as C
for p in sys.argv[1:]:
    d = json.load(open(f'tests/sim/resultado-anio-{p}-limpio.json')); S = d['series']
    v = [x['pct'] for x in d['fuerza'].values()]
    print(f"== {p} {d['d']}: entrenos {d['final']['ses']} · fuerza +{st.mean(v):.1f} % (mediana {st.median(v):.1f}) · ejercicios {len(v)}")
    for q in range(4):
        B = [s for s in S if q * 91 <= s['d'] < (q + 1) * 91]
        if B: print(f"  T{q+1}: series {len(B)} rir {st.mean(s['rir'] for s in B):.1f} fáciles {100*sum(s['rir']>=5 for s in B)/len(B):.0f}% nollega {100*sum(s['reps']<s['obj'] for s in B)/len(B):.0f}% bajó {100*sum(s['bajo']>0 for s in B)/len(B):.0f}% %1RM {st.mean(s['pct'] for s in B):.0f}")
    print('  ', [(k[:55], n) for k, n in d['porque'][:8]])
    m = d['meses']; print('   fuerza por mes', [x['fuerza'] for x in m])
