-- Persist the movable/resizable token area for each client's printable card.
alter table public.clients
  add column if not exists card_token_box jsonb not null
  default '{"x":0.56,"y":0.43,"width":0.38,"height":0.34}'::jsonb;
