-- Per-client token-duration controls.
-- Run once in Supabase Dashboard -> SQL Editor.

alter table public.clients
  add column if not exists allowed_token_durations int[] not null default array[1, 3, 7, 365];

alter table public.tokens drop constraint if exists tokens_duration_days_check;
alter table public.tokens
  add constraint tokens_duration_days_check check (duration_days in (1, 3, 7, 365));

create or replace function public.assign_token(p_duration int)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
  v_token public.tokens%rowtype;
  v_remaining int;
  v_allowed_durations int[];
begin
  if p_duration not in (1, 3, 7, 365) then
    raise exception 'duracion_invalida';
  end if;

  select client_id into v_client from public.profiles where id = auth.uid();
  if v_client is null then
    raise exception 'sin_cliente';
  end if;

  select allowed_token_durations into v_allowed_durations from public.clients where id = v_client;
  if not (p_duration = any(v_allowed_durations)) then
    raise exception 'duracion_no_permitida';
  end if;

  select * into v_token from public.tokens
  where client_id = v_client and duration_days = p_duration and status = 'disponible'
  order by created_at limit 1 for update skip locked;

  if v_token.id is null then raise exception 'sin_tokens_disponibles'; end if;

  update public.tokens set status = 'asignado', assigned_at = now(),
    expires_at = now() + make_interval(days => p_duration), assigned_by = auth.uid()
  where id = v_token.id returning * into v_token;

  select count(*) into v_remaining from public.tokens
  where client_id = v_client and duration_days = p_duration and status = 'disponible';

  if v_remaining < 50 and not exists (
    select 1 from public.alerts where client_id = v_client
      and duration_days = p_duration and created_at > now() - interval '12 hours'
  ) then
    insert into public.alerts (client_id, duration_days, remaining)
    values (v_client, p_duration, v_remaining);
  end if;

  return json_build_object('code', v_token.code, 'duration_days', v_token.duration_days,
    'assigned_at', v_token.assigned_at, 'expires_at', v_token.expires_at,
    'remaining', v_remaining, 'low_stock', v_remaining < 50);
end;
$$;

grant execute on function public.assign_token(int) to authenticated;

-- Apply the same client restriction to bulk token generation.
create or replace function public.assign_tokens(p_duration int, p_quantity int)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
  v_ids uuid[];
  v_tokens json;
  v_remaining int;
  v_allowed_durations int[];
begin
  if p_duration not in (1, 3, 7, 365) then raise exception 'duracion_invalida'; end if;
  if p_quantity < 1 or p_quantity > 1000 then raise exception 'cantidad_invalida'; end if;

  select client_id into v_client from public.profiles where id = auth.uid();
  if v_client is null then raise exception 'sin_cliente'; end if;

  select allowed_token_durations into v_allowed_durations from public.clients where id = v_client;
  if not (p_duration = any(v_allowed_durations)) then raise exception 'duracion_no_permitida'; end if;

  select array_agg(id) into v_ids from (
    select id from public.tokens
    where client_id = v_client and duration_days = p_duration and status = 'disponible'
    order by created_at limit p_quantity for update skip locked
  ) available;

  if coalesce(cardinality(v_ids), 0) < p_quantity then
    raise exception 'tokens_insuficientes:%', coalesce(cardinality(v_ids), 0);
  end if;

  with assigned as (
    update public.tokens set status = 'asignado', assigned_at = now(),
      expires_at = now() + make_interval(days => p_duration), assigned_by = auth.uid()
    where id = any(v_ids)
    returning code, duration_days, assigned_at, expires_at
  )
  select json_agg(json_build_object('code', code, 'duration_days', duration_days,
    'assigned_at', assigned_at, 'expires_at', expires_at) order by code)
  into v_tokens from assigned;

  select count(*) into v_remaining from public.tokens
  where client_id = v_client and duration_days = p_duration and status = 'disponible';

  if v_remaining < 50 and not exists (
    select 1 from public.alerts where client_id = v_client
      and duration_days = p_duration and created_at > now() - interval '12 hours'
  ) then
    insert into public.alerts (client_id, duration_days, remaining)
    values (v_client, p_duration, v_remaining);
  end if;

  return json_build_object('tokens', v_tokens, 'remaining', v_remaining,
    'low_stock', v_remaining < 50);
end;
$$;

grant execute on function public.assign_tokens(int, int) to authenticated;
