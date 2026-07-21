import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Crear cliente */
export async function POST(req: NextRequest) {
  const su = await requireSuperadmin();
  if (!su) return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'nombre_requerido' }, { status: 400 });

  const slug =
    String(body?.slug ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('clients')
    .insert({
      name,
      slug,
      logo_url: body?.logo_url || null,
      accent_color: body?.accent_color || '#BCFF5E',
      accent_hover: body?.accent_hover || '#d4ff8f',
      brand_label: body?.brand_label || `${name} x Kubi`,
      network_name: body?.network_name || 'Kubi WiFi',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/** Actualizar cliente (branding, nombre, etc.) */
export async function PATCH(req: NextRequest) {
  const su = await requireSuperadmin();
  if (!su) return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'id_requerido' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of ['name', 'logo_url', 'accent_color', 'accent_hover', 'brand_label', 'network_name']) {
    if (body[k] !== undefined) patch[k] = body[k];
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.from('clients').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
