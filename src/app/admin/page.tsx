import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import type { Profile } from '@/lib/format';
import { AdminApp } from './AdminApp';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
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
  if (profile.role !== 'superadmin') redirect('/panel');

  return <AdminApp profile={profile} />;
}
