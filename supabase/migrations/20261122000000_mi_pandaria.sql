-- Mi PandarIA · temporada de prueba (22-30 nov 2026), temporada 0 (dic-ene) y temporada 1 (feb-mar).
-- Al servidor solo llega: mote aleatorio, nombre visible para amigos, código de amigo, puntos por día y amistades.
-- Todas las escrituras pasan por funciones (security definer) que validan; las tablas no tienen políticas de escritura.

create table if not exists public.mp_seasons(
  id text primary key,
  name text not null,
  starts date not null,
  ends date not null,
  check (ends >= starts)
);
insert into public.mp_seasons(id,name,starts,ends) values
  ('prueba','Temporada de prueba','2026-11-22','2026-11-30'),
  ('t0','Temporada 0','2026-12-01','2027-01-31'),
  ('t1','Temporada 1','2027-02-01','2027-03-31')
on conflict (id) do update set name=excluded.name, starts=excluded.starts, ends=excluded.ends;

create table if not exists public.mp_players(
  user_id uuid primary key references auth.users(id) on delete cascade,
  mote text not null unique,
  display_name text not null default '' check (char_length(display_name) <= 40),
  friend_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.mp_entries(
  user_id uuid not null references public.mp_players(user_id) on delete cascade,
  season_id text not null references public.mp_seasons(id),
  start_level int not null default 0 check (start_level between 0 and 34),
  points int not null default 0,
  primary key (user_id, season_id)
);

create table if not exists public.mp_days(
  user_id uuid not null,
  season_id text not null,
  day date not null,
  points int not null check (points between 0 and 150),
  detail jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  foreign key (user_id, season_id) references public.mp_entries(user_id, season_id) on delete cascade
);

create table if not exists public.mp_friends(
  a uuid not null references public.mp_players(user_id) on delete cascade,
  b uuid not null references public.mp_players(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a <> b)
);

alter table public.mp_seasons enable row level security;
alter table public.mp_players enable row level security;
alter table public.mp_entries enable row level security;
alter table public.mp_days enable row level security;
alter table public.mp_friends enable row level security;

create or replace function public.mp_es_amigo(x uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.mp_friends f where f.a = auth.uid() and f.b = x)
$$;

drop policy if exists mp_seasons_leer on public.mp_seasons;
create policy mp_seasons_leer on public.mp_seasons for select to authenticated using (true);
drop policy if exists mp_players_leer on public.mp_players;
create policy mp_players_leer on public.mp_players for select to authenticated using (user_id = auth.uid() or public.mp_es_amigo(user_id));
drop policy if exists mp_entries_leer on public.mp_entries;
create policy mp_entries_leer on public.mp_entries for select to authenticated using (user_id = auth.uid() or public.mp_es_amigo(user_id));
drop policy if exists mp_days_leer on public.mp_days;
create policy mp_days_leer on public.mp_days for select to authenticated using (user_id = auth.uid() or public.mp_es_amigo(user_id));
drop policy if exists mp_friends_leer on public.mp_friends;
create policy mp_friends_leer on public.mp_friends for select to authenticated using (a = auth.uid());

revoke insert, update, delete on public.mp_seasons, public.mp_players, public.mp_entries, public.mp_days, public.mp_friends from anon, authenticated;
revoke select on public.mp_seasons, public.mp_players, public.mp_entries, public.mp_days, public.mp_friends from anon;

-- Puntos que cuesta cada nivel: con el 85 % del máximo diario (100) durante toda la temporada se suben los 35 niveles
create or replace function public.mp_paso(s public.mp_seasons) returns int
language sql immutable as $$ select greatest(1, round(((s.ends - s.starts + 1) * 100 * 0.85) / 35.0)::int) $$;

create or replace function public.mp_nivel(e public.mp_entries) returns int
language sql stable security definer set search_path = public as $$
  select least(34, e.start_level + e.points / public.mp_paso(s)) from public.mp_seasons s where s.id = e.season_id
$$;

-- Entrar (o volver) a Mi PandarIA: mote aleatorio que no se puede cambiar y código para añadir amigos
create or replace function public.mp_entrar(p_nombre text default null) returns public.mp_players
language plpgsql security definer set search_path = public as $$
declare yo uuid := auth.uid(); r public.mp_players; m text; c text; abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if yo is null then raise exception 'sin sesión'; end if;
  select * into r from public.mp_players where user_id = yo;
  if not found then
    loop
      m := 'Panda-'; c := '';
      for i in 1..5 loop m := m || substr(abc, 1 + floor(random() * 32)::int, 1); end loop;
      for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); end loop;
      exit when not exists(select 1 from public.mp_players where mote = m or friend_code = c);
    end loop;
    insert into public.mp_players(user_id, mote, display_name, friend_code)
      values (yo, m, coalesce(left(trim(p_nombre), 40), ''), c) returning * into r;
  elsif p_nombre is not null then
    update public.mp_players set display_name = left(trim(p_nombre), 40) where user_id = yo returning * into r;
  end if;
  return r;
end $$;

-- Puntos de un día (los calcula la app con tu actividad). Solo hoy y los 3 días anteriores, dentro de una temporada.
create or replace function public.mp_dia(p_dia date, p_puntos int, p_detalle jsonb default '{}'::jsonb) returns public.mp_entries
language plpgsql security definer set search_path = public as $$
declare yo uuid := auth.uid(); s public.mp_seasons; prev public.mp_seasons; pe public.mp_entries; e public.mp_entries; ini int := 0; hoy date := (now() at time zone 'America/Montevideo')::date;
begin
  if yo is null then raise exception 'sin sesión'; end if;
  if not exists(select 1 from public.mp_players where user_id = yo) then raise exception 'sin jugador'; end if;
  if p_dia > hoy + 1 or p_dia < hoy - 3 then raise exception 'día fuera de plazo'; end if;
  select * into s from public.mp_seasons where p_dia between starts and ends;
  if not found then raise exception 'sin temporada'; end if;
  if octet_length(coalesce(p_detalle, '{}'::jsonb)::text) > 2000 then raise exception 'detalle demasiado largo'; end if;
  select * into e from public.mp_entries where user_id = yo and season_id = s.id;
  if not found then
    -- se empieza 2 rangos (10 niveles) por debajo de donde terminaste la temporada anterior
    select * into prev from public.mp_seasons where ends < s.starts order by ends desc limit 1;
    if found then
      select * into pe from public.mp_entries where user_id = yo and season_id = prev.id;
      if found then ini := greatest(0, public.mp_nivel(pe) - 10); end if;
    end if;
    insert into public.mp_entries(user_id, season_id, start_level) values (yo, s.id, ini) returning * into e;
  end if;
  insert into public.mp_days(user_id, season_id, day, points, detail)
    values (yo, s.id, p_dia, least(150, greatest(0, coalesce(p_puntos, 0))), coalesce(p_detalle, '{}'::jsonb))
    on conflict (user_id, day) do update set points = excluded.points, detail = excluded.detail, updated_at = now();
  update public.mp_entries set points = (select coalesce(sum(points), 0) from public.mp_days where user_id = yo and season_id = s.id)
    where user_id = yo and season_id = s.id returning * into e;
  return e;
end $$;

create or replace function public.mp_amigo_anadir(p_codigo text) returns table(user_id uuid, mote text, display_name text)
language plpgsql security definer set search_path = public as $$
declare yo uuid := auth.uid(); o public.mp_players;
begin
  if yo is null then raise exception 'sin sesión'; end if;
  select * into o from public.mp_players where friend_code = upper(trim(p_codigo));
  if not found then raise exception 'código no encontrado'; end if;
  if o.user_id = yo then raise exception 'es tu propio código'; end if;
  if (select count(*) from public.mp_friends where a = yo) >= 50 then raise exception 'máximo 50 amigos'; end if;
  insert into public.mp_friends(a, b) values (yo, o.user_id), (o.user_id, yo) on conflict do nothing;
  return query select o.user_id, o.mote, o.display_name;
end $$;

create or replace function public.mp_amigo_quitar(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.mp_friends where (a = auth.uid() and b = p_user) or (a = p_user and b = auth.uid())
$$;

-- Clasificación de una temporada: todos ven mote, rango y puntos; el nombre real solo de amigos y el tuyo
create or replace function public.mp_liga(p_temporada text, p_limite int default 100)
returns table(pos bigint, mote text, nivel int, puntos int, soy_yo boolean, amigo boolean, nombre text)
language sql stable security definer set search_path = public as $$
  with t as (
    select e.user_id, p.mote, public.mp_nivel(e) as nivel, e.points,
           rank() over (order by public.mp_nivel(e) desc, e.points desc) as pos,
           p.display_name
    from public.mp_entries e join public.mp_players p using (user_id)
    where e.season_id = p_temporada
  )
  select t.pos, t.mote, t.nivel, t.points, t.user_id = auth.uid(), public.mp_es_amigo(t.user_id),
         case when t.user_id = auth.uid() or public.mp_es_amigo(t.user_id) then t.display_name else null end
  from t
  where auth.uid() is not null and (t.pos <= least(greatest(p_limite, 1), 500) or t.user_id = auth.uid() or public.mp_es_amigo(t.user_id))
  order by t.pos, t.mote
$$;

-- Tus temporadas terminadas (los trofeos que se quedan)
create or replace function public.mp_trofeos()
returns table(temporada text, nombre text, nivel int, puntos int, pos bigint, jugadores bigint)
language sql stable security definer set search_path = public as $$
  with t as (
    select e.*, public.mp_nivel(e) as nivel,
           rank() over (partition by e.season_id order by public.mp_nivel(e) desc, e.points desc) as pos,
           count(*) over (partition by e.season_id) as n
    from public.mp_entries e
  )
  select s.id, s.name, t.nivel, t.points, t.pos, t.n
  from t join public.mp_seasons s on s.id = t.season_id
  where t.user_id = auth.uid() and s.ends < (now() at time zone 'America/Montevideo')::date
  order by s.ends desc
$$;

-- Salir de Mi PandarIA: borra tu jugador, tus puntos y tus amistades
create or replace function public.mp_salir() returns void
language sql security definer set search_path = public as $$
  delete from public.mp_players where user_id = auth.uid()
$$;

revoke execute on function public.mp_es_amigo(uuid), public.mp_entrar(text), public.mp_dia(date,int,jsonb), public.mp_amigo_anadir(text),
  public.mp_amigo_quitar(uuid), public.mp_liga(text,int), public.mp_trofeos(), public.mp_salir(), public.mp_nivel(public.mp_entries) from public, anon;
grant execute on function public.mp_es_amigo(uuid), public.mp_entrar(text), public.mp_dia(date,int,jsonb), public.mp_amigo_anadir(text),
  public.mp_amigo_quitar(uuid), public.mp_liga(text,int), public.mp_trofeos(), public.mp_salir() to authenticated;
grant select on public.mp_seasons, public.mp_players, public.mp_entries, public.mp_days, public.mp_friends to authenticated;
