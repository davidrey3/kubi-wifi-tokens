import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Subir logo de cliente al bucket público "logos". FormData: file, client_id */
export async function POST(req: NextRequest) {
  const su = await requireSuperadmin();
  if (!su) return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const clientId = String(form?.get('client_id') ?? '');
  if (!(file instanceof File) || !clientId) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'archivo_muy_grande' }, { status: 400 });
  }

  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  if (!['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext)) {
    return NextResponse.json({ error: 'formato_no_soportado' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const path = `${clientId}/logo-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from('logos').upload(path, buf, {
    contentType: file.type || 'image/png',
    upsert: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: pub } = admin.storage.from('logos').getPublicUrl(path);
  const url = pub.publicUrl;

  await admin.from('clients').update({ logo_url: url }).eq('id', clientId);
  return NextResponse.json({ url });
}
