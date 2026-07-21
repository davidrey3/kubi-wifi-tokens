import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Carga masiva de tokens (export de Linkyfi).
 * Body: { client_id, duration_days: 1|3|7, codes: string[] }
 * Acepta hasta 10.000 códigos por llamada. Duplicados (mismo cliente+código) se omiten.
 */
export async function POST(req: NextRequest) {
  const su = await requireSuperadmin();
  if (!su) return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const clientId = String(body?.client_id ?? '');
  const duration = Number(body?.duration_days);
  const rawCodes: unknown = body?.codes;

  if (!clientId || ![1, 3, 7].includes(duration) || !Array.isArray(rawCodes)) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }

  const codes = Array.from(
    new Set(
      rawCodes
        .map((c) => String(c).trim().toUpperCase())
        .filter((c) => c.length > 0 && c.length <= 64)
    )
  );
  if (codes.length === 0) return NextResponse.json({ error: 'sin_codigos' }, { status: 400 });
  if (codes.length > 10000) return NextResponse.json({ error: 'demasiados_codigos' }, { status: 400 });

  const admin = supabaseAdmin();
  const rows = codes.map((code) => ({ client_id: clientId, code, duration_days: duration }));

  // upsert ignorando duplicados por (client_id, code)
  const { error, count } = await admin
    .from('tokens')
    .upsert(rows, { onConflict: 'client_id,code', ignoreDuplicates: true, count: 'exact' });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ received: codes.length, inserted: count ?? codes.length });
}

/** Eliminar tokens disponibles (por si se cargó algo por error). No borra asignados. */
export async function DELETE(req: NextRequest) {
  const su = await requireSuperadmin();
  if (!su) return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const clientId = String(body?.client_id ?? '');
  const duration = Number(body?.duration_days);
  if (!clientId || ![1, 3, 7].includes(duration)) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error, count } = await admin
    .from('tokens')
    .delete({ count: 'exact' })
    .eq('client_id', clientId)
    .eq('duration_days', duration)
    .eq('status', 'disponible');

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: count ?? 0 });
}
