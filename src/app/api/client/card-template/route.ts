import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { DEFAULT_CARD_TOKEN_BOX } from '@/lib/token-export';

const validNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

export async function PATCH(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('client_id, role').eq('id', user.id).single();
  if (!profile?.client_id || profile.role !== 'manager') {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const box = body?.card_token_box ?? DEFAULT_CARD_TOKEN_BOX;
  const fontScale = box.fontScale ?? 1;
  if (![box.x, box.y, box.width, box.height, fontScale].every(validNumber) || box.x < 0 || box.y < 0 || box.width < 0.08 || box.height < 0.08 || box.x + box.width > 1 || box.y + box.height > 1 || fontScale < 0.5 || fontScale > 3) {
    return NextResponse.json({ error: 'posicion_invalida' }, { status: 400 });
  }

  const normalized = { x: box.x, y: box.y, width: box.width, height: box.height, fontScale };
  const { error } = await admin.from('clients').update({ card_token_box: normalized }).eq('id', profile.client_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ card_token_box: normalized });
}

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

  const bucket = 'card-designs';
  const path = `${profile.client_id}/card-template-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadOptions = { contentType: contentTypes[ext], upsert: true };
  let { error: uploadError } = await admin.storage.from(bucket).upload(path, buffer, uploadOptions);
  if (uploadError?.message.toLowerCase().includes('bucket not found')) {
    const { error: bucketError } = await admin.storage.createBucket(bucket, { public: true });
    if (bucketError && !bucketError.message.toLowerCase().includes('already exists')) {
      return NextResponse.json({ error: bucketError.message }, { status: 400 });
    }
    ({ error: uploadError } = await admin.storage.from(bucket).upload(path, buffer, uploadOptions));
  }
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: publicFile } = admin.storage.from(bucket).getPublicUrl(path);
  const url = publicFile.publicUrl;
  const { error: updateError } = await admin
    .from('clients')
    .update({ card_template_url: url })
    .eq('id', profile.client_id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ url });
}
