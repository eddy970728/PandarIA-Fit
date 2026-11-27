# Une t0_es/en/pt en www: const MP_CONT=[...] (se inserta en index.html entre marcadores)
import json, sys
sys.path.insert(0, '.')
from t0_es import DIAS
from t0_en import EN
from t0_pt import PT
out = []
for d, ty, t, x, n, por, alt in DIAS:
    e, p = EN[d], PT[d]
    cur = ty == 'cur'
    it = {'d': d, 'ty': ty, 't': [t, e[0] or t, p[0] or t], 'por': [por, e[3], p[3]], 'n': [n, e[2], p[2]]}
    if cur: it['x'] = [x, e[1], p[1]]; it['src'] = n; it['n'] = None
    else: it['pl'] = [x, e[1], p[1]]
    if alt:
        ea, pa = e[4], p[4]
        it['alt'] = {'ty': alt[0], 't': [alt[1], ea[0], pa[0]], 'pl': [alt[2], ea[1], pa[1]], 'n': [alt[3], ea[2], pa[2]], 'por': [alt[4], ea[3], pa[3]]}
    for k in list(it):
        if it[k] is None: del it[k]
    out.append(it)
assert len(out) == 66, len(out)
js = '/* MP_CONT · contenido de Mi PandarIA (generado por contenido/construir.py, no editar a mano) */\nconst MP_CONT=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n/* /MP_CONT */'
open('mp_cont.js', 'w').write(js)
print(len(out), 'días ·', len(js)//1024, 'KB')
