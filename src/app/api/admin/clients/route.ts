import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { TOKEN_DURATIONS } from '@/lib/format';

function validDurations(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const durations = Array.from(new Set(value.map(Number)));
  if (durations.length === 0 || durations.some((d) => !TOKEN_DURATIONS.includes(d as (typeof TOKEN_DURATIONS)[number]))) return null;
  return TOKEN_DURATIONS.filter((d) => durations.includes(d));
}

/** Crear cliente */
export async function POST(req: NextRequest) {
  const su = await requireSuperadmin();
  if (!su) return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'nombre_requerido' }, { status: 400 });
  const allowedTokenDurations = validDurations(body?.allowed_token_durations ?? TOKEN_DURATIONS);
  if (!allowedTokenDurations) return NextResponse.json({ error: 'duraciones_invalidas' }, { status: 400 });

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
      allowed_token_durations: allowedTokenDurations,
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
  if (body.allowed_token_durations !== undefined) {
    const durations = validDurations(body.allowed_token_durations);
    if (!durations) return NextResponse.json({ error: 'duraciones_invalidas' }, { status: 400 });
    patch.allowed_token_durations = durations;
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.from('clients').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
