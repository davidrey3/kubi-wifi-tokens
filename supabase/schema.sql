-- ============================================================
-- Kubi Tokens WiFi — Esquema de base de datos (Supabase)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ---------- TABLAS ----------

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  accent_color text not null default '#BCFF5E',
  accent_hover text not null default '#d4ff8f',
  brand_label text not null default 'x Kubi', -- ej: "Amber Cove x Kubi"
  network_name text not null default 'Kubi WiFi',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  role text not null default 'manager' check (role in ('superadmin', 'manager')),
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  code text not null,
  duration_days int not null check (duration_days in (1, 3, 7)),
  status text not null default 'disponible' check (status in ('disponible', 'asignado')),
  assigned_at timestamptz,
  expires_at timestamptz,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, code)
);

create index if not exists tokens_pool_idx
  on public.tokens (client_id, duration_days, status);
create index if not exists tokens_code_idx
  on public.tokens (client_id, upper(code));

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  duration_days int not null,
  remaining int not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- HELPERS ----------

create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.get_my_client()
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid();
$$;

-- ---------- RLS ----------

alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.tokens enable row level security;
alter table public.alerts enable row level security;

-- clients: superadmin todo; manager solo su cliente (lectura)
create policy clients_superadmin_all on public.clients
  for all using (public.get_my_role() = 'superadmin');
create policy clients_manager_read on public.clients
  for select using (id = public.get_my_client());

-- profiles: cada quien lee/edita su perfil; superadmin todo
create policy profiles_own_read on public.profiles
  for select using (id = auth.uid());
create policy profiles_own_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_superadmin_all on public.profiles
  for all using (public.get_my_role() = 'superadmin');

-- Los usuarios autenticados solo pueden editar su nombre desde el cliente.
-- Impide que un manager cambie su role o client_id mediante la API pública.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- tokens: superadmin todo; manager solo lee los ASIGNADOS de su cliente
-- (el pool disponible no se lista al manager; se consume vía RPC)
create policy tokens_superadmin_all on public.tokens
  for all using (public.get_my_role() = 'superadmin');
create policy tokens_manager_read on public.tokens
  for select using (
    client_id = public.get_my_client() and status = 'asignado'
  );

-- alerts: solo superadmin
create policy alerts_superadmin_all on public.alerts
  for all using (public.get_my_role() = 'superadmin');

-- ---------- RPC: asignación atómica de token ----------
-- Toma un token 'disponible' del pool del cliente del usuario autenticado,
-- lo marca como 'asignado', fija fechas y devuelve el token + cuántos quedan.
-- FOR UPDATE SKIP LOCKED garantiza que dos usuarios nunca reciban el mismo.

create or replace function public.assign_token(p_duration int)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
  v_token public.tokens%rowtype;
  v_remaining int;
begin
  if p_duration not in (1, 3, 7) then
    raise exception 'duracion_invalida';
  end if;

  select client_id into v_client from public.profiles where id = auth.uid();
  if v_client is null then
    raise exception 'sin_cliente';
  end if;

  select * into v_token
  from public.tokens
  where client_id = v_client
    and duration_days = p_duration
    and status = 'disponible'
  order by created_at
  limit 1
  for update skip locked;

  if v_token.id is null then
    raise exception 'sin_tokens_disponibles';
  end if;

  update public.tokens
  set status = 'asignado',
      assigned_at = now(),
      expires_at = now() + make_interval(days => p_duration),
      assigned_by = auth.uid()
  where id = v_token.id
  returning * into v_token;

  select count(*) into v_remaining
  from public.tokens
  where client_id = v_client
    and duration_days = p_duration
    and status = 'disponible';

  -- Umbral global fijo: 50. Alerta como máximo una vez cada 12 h por combinación.
  if v_remaining < 50 then
    if not exists (
      select 1 from public.alerts
      where client_id = v_client
        and duration_days = p_duration
        and created_at > now() - interval '12 hours'
    ) then
      insert into public.alerts (client_id, duration_days, remaining)
      values (v_client, p_duration, v_remaining);
    end if;
  end if;

  return json_build_object(
    'code', v_token.code,
    'duration_days', v_token.duration_days,
    'assigned_at', v_token.assigned_at,
    'expires_at', v_token.expires_at,
    'remaining', v_remaining,
    'low_stock', v_remaining < 50
  );
end;
$$;

grant execute on function public.assign_token(int) to authenticated;

-- ---------- RPC: consulta de token por código (manager, solo su cliente) ----------

create or replace function public.lookup_token(p_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
  v_token public.tokens%rowtype;
begin
  select client_id into v_client from public.profiles where id = auth.uid();
  if v_client is null then
    raise exception 'sin_cliente';
  end if;

  select * into v_token
  from public.tokens
  where client_id = v_client
    and upper(code) = upper(trim(p_code))
    and status = 'asignado'
  limit 1;

  if v_token.id is null then
    return json_build_object('found', false);
  end if;

  return json_build_object(
    'found', true,
    'code', v_token.code,
    'duration_days', v_token.duration_days,
    'assigned_at', v_token.assigned_at,
    'expires_at', v_token.expires_at
  );
end;
$$;

grant execute on function public.lookup_token(text) to authenticated;

-- ---------- VISTA: estadísticas por cliente ----------

create or replace view public.client_token_stats
with (security_invoker = on) as
select
  client_id,
  duration_days,
  count(*) filter (where status = 'disponible') as disponibles,
  count(*) filter (where status = 'asignado') as asignados,
  count(*) filter (where status = 'asignado' and expires_at > now()) as activos
from public.tokens
group by client_id, duration_days;

-- ---------- STORAGE (logos) ----------
-- Crear bucket público "logos" desde el dashboard (Storage → New bucket → public),
-- o descomentar:
-- insert into storage.buckets (id, name, public) values ('logos', 'logos', true)
--   on conflict do nothing;
