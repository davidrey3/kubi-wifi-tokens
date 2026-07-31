-- Add a configurable printable card background for each client.
-- Run in: Supabase Dashboard -> SQL Editor -> New query

alter table public.clients
  add column if not exists card_template_url text;
