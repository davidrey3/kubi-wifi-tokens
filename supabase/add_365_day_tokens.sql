-- Add support for annual (365-day) tokens to an existing Kubi Tokens database.
-- Run in: Supabase Dashboard -> SQL Editor -> New query

alter table public.tokens
  drop constraint if exists tokens_duration_days_check;

alter table public.tokens
  add constraint tokens_duration_days_check
  check (duration_days in (1, 3, 7, 365));

create or replace function public.assign_token(p_duration int)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
  v_token public.tokens%rowtype;
  v_remaining int;
begin
  if p_duration not in (1, 3, 7, 365) then
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
