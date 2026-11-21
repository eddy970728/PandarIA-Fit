# Revisa los textos recogidos por textos.mjs: español sin traducir en inglés y erratas en español.
import json, re, sys, collections
modo = sys.argv[1] if len(sys.argv) > 1 else 'en'
T = json.load(open(f'tests/sim/textos-{modo}.json'))
ES_PAL = r'\b(de|del|la|las|el|los|que|para|con|por|una|uno|tu|tus|sin|más|hoy|semana|semanas|días|día|entreno|entrenos|rutina|rutinas|ejercicio|ejercicios|serie|series|peso|comida|agua|ayuno|también|cuando|pero|como|esta|este|está|son|hay|ya|muy|nada|todo|todos|tienes|puedes|desde|hasta|mañana|aquí|añadir|guardar|cancelar|borrar|cambiar|empezar|terminar|ver|cerrar|siguiente|anterior)\b'
OK_EN = re.compile(r'^(PandarIA|PandarIA Fit|kcal|kg|lb|ml|HIIT|EMOM|AMRAP|Tabata|RPE|RIR|IMC|BMI|Premium|Google|Drive|Health Connect|WhatsApp|Apple|iPhone|Android)$')
salida = collections.defaultdict(list)
for t, donde in T.items():
    if modo == 'en':
        if OK_EN.match(t): continue
        if re.search(r'[ñ¿¡]|ción\b|ciones\b', t) or len(re.findall(ES_PAL, t, re.I)) >= 2 or re.search(r'[áéíóú]', t) and len(re.findall(ES_PAL, t, re.I)) >= 1:
            salida['español en inglés'].append((t, donde[0]))
    else:
        if '  ' in t: salida['doble espacio'].append((t, donde[0]))
        if re.search(r' [,.;:!?](?!\d)', t): salida['espacio antes de puntuación'].append((t, donde[0]))
        if re.search(r'\.\s+[a-záéíóúñ]', t) and not re.search(r'\b(p\. ej|etc|aprox|col|vs|min|máx|mín|seg|kg|cm)\.\s', t): salida['minúscula tras punto'].append((t, donde[0]))
        if re.search(r'\.\.(?!\.)', t): salida['dos puntos seguidos'].append((t, donde[0]))
        if re.search(r'\b(dia|dias|sesion|musculo|rapido|minimo|maximo|despues|tambien|aqui|facil|ultimo|proximo|numero|calorias|proteina|energia|tecnica|basico|configuracion|informacion|nutricion|opcion|segun|asi|ademas|todavia|pagina|categoria|movil|anadir|espanol|ingles|linea|gluteos?|biceps|triceps|cuadriceps|lesion|repeticion|duracion|sueno|codigo|camara|grafica|estadisticas|sabado|miercoles|fisica|medico|perdida|azucar|pequeno|manana|anos?|unico|titulo|menu|atras|jamas)\b', t): salida['falta tilde'].append((t, donde[0]))
        if re.search(r'\b(the|and|with|your|you|workout|set|reps|weight|today|week|save|cancel|delete|start|done|next|back)\b', t) and not re.search(r'[áéíóúñ]|\b(de|la|el|tu|con)\b', t): salida['inglés en español'].append((t, donde[0]))
        if re.search(r'(?i)\bentrenamiento\b', t): salida['«entrenamiento» (la app dice «entreno»)'].append((t, donde[0]))
for k, L in salida.items():
    print(f'\n### {k}: {len(L)}')
    for t, d in sorted(L)[:400]: print(f'  · {t[:150]}   ← {d}')
