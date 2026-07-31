import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('client_id, role').eq('id', user.id).single();
  if (!profile?.client_id || profile.role !== 'manager') {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'archivo_requerido' }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'archivo_muy_grande' }, { status: 400 });
  }

  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    return NextResponse.json({ error: 'formato_no_soportado' }, { status: 400 });
  }
  const contentTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'formato_no_soportado' }, { status: 400 });
  }

  const path = `${profile.client_id}/card-template-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from('logos').upload(path, buffer, {
    contentType: contentTypes[ext],
    upsert: true,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: publicFile } = admin.storage.from('logos').getPublicUrl(path);
  const url = publicFile.publicUrl;
  const { error: updateError } = await admin
    .from('clients')
    .update({ card_template_url: url })
    .eq('id', profile.client_id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ url });
}
