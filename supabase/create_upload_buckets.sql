-- Public assets uploaded through server-side, superadmin-authorized endpoints.
insert into storage.buckets (id, name, public)
values
  ('logos', 'logos', true),
  ('card-designs', 'card-designs', true)
on conflict (id) do update set public = true;
