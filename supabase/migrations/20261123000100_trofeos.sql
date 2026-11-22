-- mp_trofeos: mp_entries ya tiene su propia columna «pos»; se calcula el puesto final con otro nombre
create or replace function public.mp_trofeos()
returns table(temporada text, nombre text, nivel int, puntos int, pos bigint, jugadores bigint)
language sql stable security definer set search_path = public as $$
  with t as (
    select e.user_id, e.season_id, e.points, public.mp_nivel(e) as nv,
           rank() over (partition by e.season_id order by public.mp_nivel(e) desc, e.points desc) as puesto,
           count(*) over (partition by e.season_id) as n
    from public.mp_entries e
  )
  select s.id, s.name, t.nv, t.points, t.puesto, t.n
  from t join public.mp_seasons s on s.id = t.season_id
  where t.user_id = auth.uid() and s.ends < (now() at time zone 'America/Montevideo')::date
  order by s.ends desc
$$;
revoke execute on function public.mp_trofeos() from public, anon;
grant execute on function public.mp_trofeos() to authenticated;
