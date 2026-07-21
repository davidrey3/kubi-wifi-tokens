import { supabaseServer } from '@/lib/supabase/server';
import type { Profile } from '@/lib/format';

/** Devuelve el perfil si el usuario autenticado es superadmin; si no, null. */
export async function requireSuperadmin(): Promise<Profile | null> {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();
  if (!profile || profile.role !== 'superadmin') return null;
  return profile;
}
