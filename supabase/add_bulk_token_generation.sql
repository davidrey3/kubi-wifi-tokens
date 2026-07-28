-- Add atomic bulk token generation to an existing Kubi Tokens database.
-- Run in: Supabase Dashboard -> SQL Editor -> New query

create or replace function public.assign_tokens(p_duration int, p_quantity int)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
  v_ids uuid[];
  v_tokens json;
  v_remaining int;
begin
  if p_duration not in (1, 3, 7, 365) then
    raise exception 'duracion_invalida';
  end if;
  if p_quantity < 1 or p_quantity > 1000 then
    raise exception 'cantidad_invalida';
  end if;

  select client_id into v_client from public.profiles where id = auth.uid();
  if v_client is null then
    raise exception 'sin_cliente';
  end if;

  select array_agg(id) into v_ids
  from (
    select id
    from public.tokens
    where client_id = v_client
      and duration_days = p_duration
      and status = 'disponible'
    order by created_at
    limit p_quantity
    for update skip locked
  ) available;

  if coalesce(cardinality(v_ids), 0) < p_quantity then
    raise exception 'tokens_insuficientes:%', coalesce(cardinality(v_ids), 0);
  end if;

  with assigned as (
    update public.tokens
    set status = 'asignado',
        assigned_at = now(),
        expires_at = now() + make_interval(days => p_duration),
        assigned_by = auth.uid()
    where id = any(v_ids)
    returning code, duration_days, assigned_at, expires_at
  )
  select json_agg(
    json_build_object(
      'code', code,
      'duration_days', duration_days,
      'assigned_at', assigned_at,
      'expires_at', expires_at
    )
    order by code
  ) into v_tokens
  from assigned;

  select count(*) into v_remaining
  from public.tokens
  where client_id = v_client
    and duration_days = p_duration
    and status = 'disponible';

  if v_remaining < 50 and not exists (
    select 1 from public.alerts
    where client_id = v_client
      and duration_days = p_duration
      and created_at > now() - interval '12 hours'
  ) then
    insert into public.alerts (client_id, duration_days, remaining)
    values (v_client, p_duration, v_remaining);
  end if;

  return json_build_object(
    'tokens', v_tokens,
    'remaining', v_remaining,
    'low_stock', v_remaining < 50
  );
end;
$$;

grant execute on function public.assign_tokens(int, int) to authenticated;
