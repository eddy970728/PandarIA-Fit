# Mi PandarIA · laboratorio

Rama `lab-mi-pandaria`. Nada de esto va a main ni a Google Play hasta que Eddy lo apruebe (plan: pasar a main hacia el 20–25 de enero de 2027 para la Temporada 1 del 1 de febrero).

## Calendario
| Etapa | Fechas | Quién |
|---|---|---|
| Prueba | 22–30 nov 2026 | Las 2 cuentas de Google de Eddy, en el mismo teléfono |
| Temporada 0 | 1 dic 2026 – 31 ene 2027 | Las 2 cuentas de Eddy |
| Temporada 1 | desde el 1 feb 2027 | Todos (lanzamiento) |

## Qué hay
- `lab/mipandaria.js`: toda la sección (pestaña entre Nutrición e Historial). Se inyecta solo en la APK de esta rama.
- `supabase/migrations/`: tablas `mp_*`, reglas RLS y funciones `mp_entrar`, `mp_sync` (envío único), `mp_amigo_anadir`, `mp_amigo_quitar`, `mp_trofeos`, `mp_salir`. Liga precalculada en `mp_liga_foto` (pg_cron cada 15 min; si no hay pg_cron, la rehace el primer envío con la foto vieja).
- `.github/workflows/supabase.yml`: aplica las migraciones (secretos `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`) y comprueba que sin sesión no se ve nada.
- `.github/workflows/android.yml` (solo en esta rama): añade Mi PandarIA, pasa `tests/lab-mipandaria.mjs` y saca solo la APK `…-mipandaria` (sin AAB ni release).
- Proyecto Supabase: `pandaria` (São Paulo), URL `https://vjvhpumsfsktkavtxigk.supabase.co`, clave pública `sb_publishable_sL20…`. El proyecto `pandaria-fit` (us-east-2) no se usa.

## Reglas
- Al servidor solo van: mote aleatorio (no se cambia), nombre para amigos, puntos por día (máx. 150), amistades.
- El estado de Mi PandarIA vive en `localStorage['pandaria-mp-v1']`, aparte de los datos de la app: no entra en la copia de Drive ni en exportar.
- La cuenta de Mi PandarIA es siempre la cuenta de Google de la app (`S.settings.cloud.sub`). Sin cuenta en la app no se entra; si la app cierra sesión o cambia de cuenta, Mi PandarIA se cierra en el teléfono (los puntos quedan en el servidor). Borrar del servidor: siempre, también desde Ajustes › tu nombre › Mi cuenta.
- Bajo consumo: 1 solicitud (`mp_sync`) como mucho cada 30 min y al salir de la app; la respuesta (rango, puesto, división de 50, top 10, amigos) se reutiliza 15 min. El servidor rechaza más de 1 envío por minuto y días fuera de hoy-3..hoy.
- Contra trampas: entreno ≥ 10 min; actividad extra solo si se completó al menos el 80 % del trabajo del temporizador.
- Cada entreno es de la cuenta que estaba activa cuando se guardó (`duenos`).
- Puntos: entreno 40, +10 si es día del plan, 2 actividades extra × 15, contenido 5, 2 comidas 10, agua 10; retos semana +20, mes +30, temporada +50.
- 7 rangos × 5 niveles; nivel = puntos / paso (paso = días de temporada × 100 × 0,85 / 35); temporada nueva = 2 rangos menos.

## Pendiente (ideas ya pedidas por Eddy)
- Fase D (interfaz nueva, tras aprobar la maqueta) y fase E (aviso de consumo semanal a lunadoggybrustudios@gmail.com y eddy970728@gmail.com).
- Racha: cuenta el día si se cumplen las misiones de ese día (día de plan: entreno; día de descanso: sus actividades) más la meta de agua.
- Actividades extra según el tipo de usuario (nivel, objetivo, lesiones, equipo): a dos personas no les salen las mismas.
- Contenido del día con música, notas, audio, vídeo o fotos suyas (hoy: curiosidades).
- Idiomas aparte de español e inglés.
- Política de privacidad: sección del servidor antes del lanzamiento.

## Cómo cancelarlo todo
1. Instalar encima la APK normal de main (o la de Play). Los datos de la app no cambian.
2. Borrar la rama `lab-mi-pandaria`.
3. En Supabase: Project Settings › General › Delete project (`pandaria`).
4. Borrar los 3 secretos `SUPABASE_*` en GitHub.
