import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { PanelApp } from './PanelApp';
import type { Client, Profile } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PanelPage() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  if (!profile) redirect('/');
  if (profile.role === 'superadmin') redirect('/admin');
  if (!profile.client_id) redirect('/');

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', profile.client_id)
    .single<Client>();

  if (!client) redirect('/');

  return <PanelApp profile={profile} client={client} />;
}
