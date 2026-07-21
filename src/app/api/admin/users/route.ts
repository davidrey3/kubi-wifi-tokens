import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Crear usuario (gerente) para un cliente */
export async function POST(req: NextRequest) {
  const su = await requireSuperadmin();
  if (!su) return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? '');
  const clientId = String(body?.client_id ?? '');
  const fullName = String(body?.full_name ?? '').trim();

  if (!email || !clientId) return NextResponse.json({ error: 'datos_incompletos' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'contrasena_corta' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) {
    return NextResponse.json({ error: error?.message ?? 'error_creando_usuario' }, { status: 400 });
  }

  const { error: pErr } = await admin.from('profiles').insert({
    id: created.user.id,
    client_id: clientId,
    role: 'manager',
    full_name: fullName,
    email,
  });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  return NextResponse.json({ id: created.user.id, email, full_name: fullName });
}

/** Eliminar usuario */
export async function DELETE(req: NextRequest) {
  const su = await requireSuperadmin();
  if (!su) return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'id_requerido' }, { status: 400 });
  if (id === su.id) return NextResponse.json({ error: 'no_puedes_eliminarte' }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
