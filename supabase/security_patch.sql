-- Ejecutar una vez en Supabase SQL Editor si schema.sql ya fue aplicado.
-- Restringe la edición del perfil para impedir cambios de role o client_id.

drop policy if exists profiles_own_update on public.profiles;

create policy profiles_own_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
