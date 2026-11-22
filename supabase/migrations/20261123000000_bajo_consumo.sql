-- Mi PandarIA · fase B: servidor de bajo consumo
-- · Los puntos de cada día van en una sola fila por jugador y temporada (array), en lugar de una fila por día.
-- · Un solo envío (mp_sync) manda los últimos días y recibe tu rango, tu puesto, tu división y tus amigos.
-- · La liga se precalcula cada 15 minutos (pg_cron); nadie la calcula al abrir la pantalla.
-- · Divisiones de 50 jugadores por rango; el top 10 global sigue visible.
-- · Máximo 1 envío por minuto por cuenta.

alter table public.mp_entries add column if not exists dias smallint[] not null default '{}';
alter table public.mp_entries add column if not exists retos jsonb not null default '{}'::jsonb;
alter table public.mp_entries add column if not exists division int;
alter table public.mp_entries add column if not exists pos int;
alter table public.mp_entries add column if not exists pos_div int;
alter table public.mp_entries add column if not exists ultimo_envio timestamptz;

-- pasar los días de la prueba (una fila por día) al array y retirar la tabla vieja
do $$ begin
  if to_regclass('public.mp_days') is not null then
    update public.mp_entries e set dias = coalesce((
      select array_agg(coalesce(d.points, 0)::smallint order by g.i)
      from public.mp_seasons s
      cross join generate_series(0, (s.ends - s.starts)) as g(i)
      left join public.mp_days d on d.user_id = e.user_id and d.day = s.starts + g.i
      where s.id = e.season_id), '{}')
    where exists (select 1 from public.mp_days d where d.user_id = e.user_id and d.season_id = e.season_id);
    drop table public.mp_days;
  end if;
end $$;

update public.mp_entries set division = (start_level / 5) * 1000 where division is null;

create table if not exists public.mp_liga_foto(
  season_id text not null references public.mp_seasons(id),
  division int not null,            -- -1 = top 10 global
  filas jsonb not null default '[]'::jsonb,  -- [[mote, nivel, puntos], ...] ordenado
  jugadores int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (season_id, division)
);
alter table public.mp_liga_foto enable row level security;
revoke all on public.mp_liga_foto from anon, authenticated;

-- División para un jugador nuevo en la temporada: la primera de su rango con menos de 50 jugadores
create or replace function public.mp_division_para(p_temporada text, p_rango int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select division from public.mp_entries where season_id = p_temporada and division / 1000 = p_rango
      group by division having count(*) < 50 order by division limit 1),
    p_rango * 1000 + coalesce((select max(division % 1000) + 1 from public.mp_entries where season_id = p_temporada and division / 1000 = p_rango), 0))
$$;

-- Rehace posiciones y fotos de la liga (la llama pg_cron cada 15 min; también al final de cada envío si la foto tiene más de 15 min)
create or replace function public.mp_refrescar_liga() returns void
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  for s in select * from public.mp_seasons where ends >= (now() at time zone 'America/Montevideo')::date - 1 and starts <= (now() at time zone 'America/Montevideo')::date + 1 loop
    with r as (
      select user_id, rank() over (order by public.mp_nivel(e) desc, points desc) as p,
             rank() over (partition by division order by public.mp_nivel(e) desc, points desc) as pd
      from public.mp_entries e where season_id = s.id)
    update public.mp_entries e set pos = r.p, pos_div = r.pd from r where e.user_id = r.user_id and e.season_id = s.id;
    delete from public.mp_liga_foto where season_id = s.id;
    insert into public.mp_liga_foto(season_id, division, filas, jugadores)
      select s.id, e.division, jsonb_agg(jsonb_build_array(p.mote, public.mp_nivel(e), e.points) order by e.pos_div, p.mote), count(*)
      from public.mp_entries e join public.mp_players p using (user_id)
      where e.season_id = s.id group by e.division;
    insert into public.mp_liga_foto(season_id, division, filas, jugadores)
      select s.id, -1, coalesce(jsonb_agg(jsonb_build_array(t.mote, t.nivel, t.points) order by t.pos, t.mote), '[]'::jsonb),
             (select count(*) from public.mp_entries where season_id = s.id)
      from (select p.mote, public.mp_nivel(e) as nivel, e.points, e.pos from public.mp_entries e join public.mp_players p using (user_id)
            where e.season_id = s.id order by e.pos, p.mote limit 10) t;
  end loop;
end $$;

-- El envío del día: hasta 4 días (hoy y 3 anteriores) + retos ganados. Devuelve todo lo que la pantalla necesita.
create or replace function public.mp_sync(p_dias jsonb default '[]'::jsonb, p_retos jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare yo uuid := auth.uid(); hoy date := (now() at time zone 'America/Montevideo')::date; s public.mp_seasons; prev public.mp_seasons;
  e public.mp_entries; pe public.mp_entries; x jsonb; dia date; pts int; ini int := 0; idx int; a smallint[]; n int;
  foto public.mp_liga_foto; glob public.mp_liga_foto; amigos jsonb; vieja boolean;
begin
  if yo is null then raise exception 'sin sesión'; end if;
  if not exists(select 1 from public.mp_players where user_id = yo) then raise exception 'sin jugador'; end if;
  if jsonb_typeof(p_dias) <> 'array' or jsonb_array_length(p_dias) > 4 then raise exception 'envío no válido'; end if;
  if octet_length(p_retos::text) > 4000 then raise exception 'retos demasiado largos'; end if;
  select * into s from public.mp_seasons where hoy between starts and ends;
  if found then
    select * into e from public.mp_entries where user_id = yo and season_id = s.id;
    if not found then
      select * into prev from public.mp_seasons where ends < s.starts order by ends desc limit 1;
      if found then
        select * into pe from public.mp_entries where user_id = yo and season_id = prev.id;
        if found then ini := greatest(0, public.mp_nivel(pe) - 10); end if;
      end if;
      insert into public.mp_entries(user_id, season_id, start_level, division, dias)
        values (yo, s.id, ini, public.mp_division_para(s.id, ini / 5), array_fill(0::smallint, array[s.ends - s.starts + 1]))
        returning * into e;
    end if;
    if jsonb_array_length(p_dias) > 0 then
      if e.ultimo_envio is not null and e.ultimo_envio > now() - interval '60 seconds' then raise exception 'demasiado pronto'; end if;
      a := e.dias; n := s.ends - s.starts + 1;
      if coalesce(array_length(a, 1), 0) < n then a := a || array_fill(0::smallint, array[n - coalesce(array_length(a, 1), 0)]); end if;
      for x in select * from jsonb_array_elements(p_dias) loop
        dia := (x->>'d')::date; pts := least(150, greatest(0, coalesce((x->>'p')::int, 0)));
        if dia between greatest(s.starts, hoy - 3) and least(s.ends, hoy) then
          idx := dia - s.starts + 1; a[idx] := pts;
        end if;
      end loop;
      update public.mp_entries set dias = a, points = (select coalesce(sum(v), 0) from unnest(a) v),
        retos = retos || coalesce(p_retos, '{}'::jsonb), ultimo_envio = now()
        where user_id = yo and season_id = s.id returning * into e;
    end if;
  else
    select * into s from public.mp_seasons where starts > hoy order by starts limit 1;
  end if;
  -- foto de la liga: si tiene más de 15 minutos (o no existe), se rehace aquí (por si pg_cron no está)
  select * into glob from public.mp_liga_foto where season_id = s.id and division = -1;
  vieja := not found or glob.updated_at < now() - interval '15 minutes';
  if vieja then perform public.mp_refrescar_liga(); select * into glob from public.mp_liga_foto where season_id = s.id and division = -1; end if;
  select * into e from public.mp_entries where user_id = yo and season_id = s.id;
  if e.division is not null then select * into foto from public.mp_liga_foto where season_id = s.id and division = e.division; end if;
  -- amigos: mote, nombre, nivel, puntos de hoy y de los últimos 7 días
  select coalesce(jsonb_agg(jsonb_build_object('id', p.user_id, 'mote', p.mote, 'nombre', p.display_name,
           'nivel', case when fe.user_id is null then null else public.mp_nivel(fe) end, 'puntos', coalesce(fe.points, 0),
           'hoy', coalesce(fe.dias[hoy - s.starts + 1], 0),
           'sem', coalesce((select sum(v) from unnest(fe.dias[greatest(1, hoy - s.starts - 5):hoy - s.starts + 1]) v), 0))), '[]'::jsonb)
    into amigos
    from public.mp_friends f join public.mp_players p on p.user_id = f.b
    left join public.mp_entries fe on fe.user_id = f.b and fe.season_id = s.id
    where f.a = yo;
  return jsonb_build_object(
    'temporada', jsonb_build_object('id', s.id, 'name', s.name, 'starts', s.starts, 'ends', s.ends),
    'yo', case when e.user_id is null then null else jsonb_build_object('start_level', e.start_level, 'points', e.points, 'nivel', public.mp_nivel(e),
      'pos', e.pos, 'pos_div', e.pos_div, 'division', e.division, 'dias', to_jsonb(e.dias), 'retos', e.retos) end,
    'division', case when foto.season_id is null then null else jsonb_build_object('filas', foto.filas, 'jugadores', foto.jugadores, 't', foto.updated_at) end,
    'top', case when glob.season_id is null then null else jsonb_build_object('filas', glob.filas, 'jugadores', glob.jugadores, 't', glob.updated_at) end,
    'amigos', amigos,
    'jugador', (select to_jsonb(p) - 'created_at' from public.mp_players p where p.user_id = yo));
end $$;

-- mp_liga y mp_dia antiguas: se quitan (todo pasa por mp_sync)
drop function if exists public.mp_dia(date, int, jsonb);
drop function if exists public.mp_liga(text, int);

revoke execute on function public.mp_sync(jsonb, jsonb), public.mp_refrescar_liga(), public.mp_division_para(text, int) from public, anon;
grant execute on function public.mp_sync(jsonb, jsonb) to authenticated;

-- pg_cron: rehacer la liga cada 15 minutos (si la extensión existe en el proyecto)
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'mp-liga';
    perform cron.schedule('mp-liga', '*/15 * * * *', 'select public.mp_refrescar_liga()');
  end if;
end $$;
