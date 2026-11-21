# Resumen de la simulación de un año (tests/sim/resultado-anio-*.json)
import json, glob, statistics as st, collections as C
fs = sorted(glob.glob('tests/sim/resultado-anio-P*.json'))
for f in fs:
    d = json.load(open(f)); P = d['perfil']; M = d['meses']
    print(f"\n=== {d['id']} · {d['d']} · {d['seg']} s")
    print(f"  final {d['final']} · reabrir {d['reabrirMs']} ms · comidas {d['comidas']} · botones ok {d['ui']['ok']} fallos {d['ui']['fallo']}")
    print(f"  errores {len(d['errores'])} · raros {len(d['raros'])} · datos {len(d['datos'])} · lento {d['lento'][:3]}")
    for e in d['errores'][:6]: print('   E', e)
    for e in d['raros'][:6]: print('   R', e)
    for e in d['datos'][:6]: print('   D', e)
    print('  avisos', d['avisos'][:4], '· ia', d['ia'][:6])
    if d['fuerza']:
        v = [x['pct'] for x in d['fuerza'].values()]
        print(f"  fuerza real: media +{st.mean(v):.1f} % · min {min(v):.1f} · max {max(v):.1f} · ejercicios {len(v)} · suaves {d['suaves']}")
    S = d['series']
    if S:
        for q in range(4):
            B = [s for s in S if q * 91 <= s['d'] < (q + 1) * 91]
            if B: print(f"   T{q+1}: series {len(B)} · RIR medio {st.mean(s['rir'] for s in B):.1f} · fáciles(RIR≥5) {100*sum(s['rir']>=5 for s in B)/len(B):.0f}% · no llega {100*sum(s['reps']<s['obj'] for s in B)/len(B):.0f}% · bajó peso {100*sum(s['bajo']>0 for s in B)/len(B):.0f}% · %1RM {st.mean(s['pct'] for s in B):.0f}")
    print(f"  peso {d['peso']} · propuestas vistas {sum(x[1] for x in d['propuestas'])} · aplicadas {len(d['aplicadas'])}")
    for p, n in d['propuestas'][:6]: print('    P', n, p)
    print('  mes  kcal  bmr  tdeeF adapt  peso(app/real) ritmo  agua  ayunos(h)  ses desc  estado  datosKB  ms(max)  notas/consejo')
    for m in M:
        print(f"  {m['dia']:3d} {m['kcal']} {m['bmr']} {m['tdeeF']} {m['adapt']}  {m['peso']}/{m['pesoReal']} {m['ritmo']} {m['agua']} {m['ayunosMes']}({m['ayunoMedioH']}) {m['sesiones']} {m['descargas']} {m['estado']} {round(m['datos']['c']/1024)} {max(m['ms'].values())} | {'; '.join(m['notas'])[:90]} | {m['ayunoConsejo'][:70]} | prop {m['propuestas']}")
